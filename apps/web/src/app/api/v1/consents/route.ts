import { z } from "zod";
import { createShareToken, hashToken } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { ok, problem, readJson } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, rateLimit } from "@/lib/request-security";

const consentSchema = z.object({
  recordId: z.string().min(1),
  mode: z.literal("verify_only").default("verify_only"),
  purpose: z.string().min(3),
  audience: z.string().min(2).optional(),
  expiresAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "consent-write", 60, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const parsed = await readJson(request, consentSchema);
  if ("response" in parsed) return parsed.response;

  const record = await prisma.trustRecord.findUnique({
    where: { id: parsed.data.recordId },
    include: { holder: true }
  });

  if (!record) return problem("Record not found", 404);

  const token = createShareToken();
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;
  const consent = await prisma.consentGrant.create({
    data: {
      holderId: record.holderId,
      recordId: record.id,
      mode: parsed.data.mode,
      purpose: parsed.data.purpose,
      audience: parsed.data.audience,
      expiresAt
    }
  });

  const shareLink = await prisma.shareLink.create({
    data: {
      tokenHash: hashToken(token),
      holderId: record.holderId,
      recordId: record.id,
      consentGrantId: consent.id,
      expiresAt
    }
  });

  await writeAuditAnchor({
    action: "consent_granted",
    issuerId: record.issuerId,
    recordId: record.id,
    status: consent.status,
    version: record.version,
    payload: {
      mode: parsed.data.mode,
      purpose: parsed.data.purpose,
      audience: parsed.data.audience,
      expiresAt: expiresAt?.toISOString()
    }
  });

  return ok(
    {
      consent,
      shareLink: {
        id: shareLink.id,
        token,
        expiresAt: shareLink.expiresAt?.toISOString() ?? null,
        url: `${process.env.APP_URL ?? "http://localhost:3000"}/verify/${token}`
      }
    },
    { status: 201 }
  );
}
