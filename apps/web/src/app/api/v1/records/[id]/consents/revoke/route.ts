import { prisma } from "@/lib/prisma";
import { ok, problem } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, authorizeRecordAccess, rateLimit } from "@/lib/request-security";
import { replayIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { idempotencyDedupeKey, runApiOperation, taskLockKey } from "@/lib/operation-control";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const limited = rateLimit(request, "consent-revoke", 30, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const { id } = await context.params;
  const record = await prisma.trustRecord.findUnique({
    where: { id },
    select: {
      id: true,
      issuerId: true,
      holderId: true,
      version: true,
      consentGrants: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!record) return problem("Record not found", 404);

  const accessDenied = await authorizeRecordAccess(request, record);
  if (accessDenied) return accessDenied;

  const idempotentBody = { id };
  const replayed = await replayIdempotentResponse(request, "POST /api/v1/records/:id/consents/revoke", idempotentBody);
  if (replayed) return replayed;

  const consent = record.consentGrants[0];
  if (!consent) return problem("No active consent grant found", 404);

  return runApiOperation(
    request,
    {
      name: "consent.revoke",
      priority: "high",
      lockKey: taskLockKey("record", id, "consent"),
      dedupeKey: idempotencyDedupeKey(request, "POST /api/v1/records/:id/consents/revoke", idempotentBody),
      timeoutMs: 12_000
    },
    async ({ throwIfAborted }) => {
      throwIfAborted();
      const revokedAt = new Date();
      const [updatedConsent] = await prisma.$transaction([
        prisma.consentGrant.update({
          where: { id: consent.id },
          data: {
            status: "revoked",
            revokedAt
          }
        }),
        prisma.shareLink.updateMany({
          where: {
            consentGrantId: consent.id,
            revokedAt: null
          },
          data: { revokedAt }
        })
      ]);

      await writeAuditAnchor({
        action: "consent_revoked",
        issuerId: record.issuerId,
        recordId: record.id,
        status: "revoked",
        version: record.version,
        payload: {
          consentGrantId: consent.id,
          revokedAt: revokedAt.toISOString()
        }
      });

      const responseBody = { consent: updatedConsent };
      await storeIdempotentResponse(request, "POST /api/v1/records/:id/consents/revoke", idempotentBody, responseBody);

      return ok(responseBody);
    }
  );
}
