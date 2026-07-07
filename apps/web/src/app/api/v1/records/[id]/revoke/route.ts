import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, problem, readJson } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, rateLimit } from "@/lib/request-security";

const revokeSchema = z.object({
  issuerId: z.string().min(1),
  reason: z.string().min(3),
  reasonCode: z.string().default("record_revoked")
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const limited = rateLimit(request, "record-revoke", 30, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const { id } = await context.params;
  const parsed = await readJson(request, revokeSchema);
  if ("response" in parsed) return parsed.response;

  const record = await prisma.trustRecord.findUnique({
    where: { id }
  });

  if (!record) return problem("Record not found", 404);
  if (record.issuerId !== parsed.data.issuerId) return problem("Issuer cannot revoke this record", 403);

  const revokedAt = new Date();
  const summary = {
    ...(record.publicSummaryJson as Record<string, unknown>),
    status: "revoked",
    revokedAt: revokedAt.toISOString()
  };

  const [updatedRecord, revocation] = await prisma.$transaction([
    prisma.trustRecord.update({
      where: { id },
      data: {
        status: "revoked",
        revokedAt,
        publicSummaryJson: summary as Prisma.InputJsonValue
      }
    }),
    prisma.revocation.upsert({
      where: { recordId: id },
      create: {
        recordId: id,
        issuerId: parsed.data.issuerId,
        reason: parsed.data.reason,
        reasonCode: parsed.data.reasonCode
      },
      update: {
        reason: parsed.data.reason,
        reasonCode: parsed.data.reasonCode
      }
    })
  ]);

  await writeAuditAnchor({
    action: "record_revoked",
    issuerId: parsed.data.issuerId,
    recordId: id,
    status: "revoked",
    version: updatedRecord.version,
    payload: {
      reason: parsed.data.reason,
      reasonCode: parsed.data.reasonCode,
      revokedAt: revokedAt.toISOString()
    }
  });

  return ok({ record: updatedRecord, revocation });
}
