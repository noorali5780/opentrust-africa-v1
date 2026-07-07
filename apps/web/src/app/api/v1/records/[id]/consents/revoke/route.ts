import { prisma } from "@/lib/prisma";
import { ok, problem } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, rateLimit } from "@/lib/request-security";

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
    include: {
      consentGrants: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!record) return problem("Record not found", 404);

  const consent = record.consentGrants[0];
  if (!consent) return problem("No active consent grant found", 404);

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

  return ok({ consent: updatedConsent });
}
