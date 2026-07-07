import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, problem, readJson } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, rateLimit } from "@/lib/request-security";

const disputeSchema = z.object({
  holderId: z.string().min(1).optional(),
  openedByEmail: z.string().email().optional(),
  reason: z.string().min(3)
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const limited = rateLimit(request, "record-dispute", 30, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const { id } = await context.params;
  const parsed = await readJson(request, disputeSchema);
  if ("response" in parsed) return parsed.response;

  const record = await prisma.trustRecord.findUnique({
    where: { id }
  });

  if (!record) return problem("Record not found", 404);

  const summary = {
    ...(record.publicSummaryJson as Record<string, unknown>),
    status: "disputed",
    disputeStatus: "open"
  };

  const [updatedRecord, dispute] = await prisma.$transaction([
    prisma.trustRecord.update({
      where: { id },
      data: {
        status: "disputed",
        disputeState: "open",
        publicSummaryJson: summary as Prisma.InputJsonValue
      }
    }),
    prisma.dispute.create({
      data: {
        recordId: id,
        holderId: parsed.data.holderId,
        issuerId: record.issuerId,
        openedByEmail: parsed.data.openedByEmail,
        reason: parsed.data.reason,
        status: "open"
      }
    })
  ]);

  await writeAuditAnchor({
    action: "dispute_opened",
    issuerId: record.issuerId,
    recordId: id,
    status: "open",
    version: updatedRecord.version,
    payload: {
      reason: parsed.data.reason,
      openedByEmail: parsed.data.openedByEmail
    }
  });

  return ok({ record: updatedRecord, dispute }, { status: 201 });
}
