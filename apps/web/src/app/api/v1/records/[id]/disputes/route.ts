import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, problem, readJson } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { publicTrustRecordSelect } from "@/lib/api-shapes";
import { authorizeMutation, authorizeRecordAccess, rateLimit } from "@/lib/request-security";
import { replayIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";

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
    where: { id },
    select: {
      issuerId: true,
      holderId: true,
      publicSummaryJson: true,
      version: true
    }
  });

  if (!record) return problem("Record not found", 404);

  const accessDenied = await authorizeRecordAccess(request, record);
  if (accessDenied) return accessDenied;

  const idempotentBody = { id, ...parsed.data };
  const replayed = await replayIdempotentResponse(request, "POST /api/v1/records/:id/disputes", idempotentBody);
  if (replayed) return replayed;

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
      },
      select: publicTrustRecordSelect
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

  const responseBody = { record: updatedRecord, dispute };
  await storeIdempotentResponse(request, "POST /api/v1/records/:id/disputes", idempotentBody, responseBody, 201);

  return ok(responseBody, { status: 201 });
}
