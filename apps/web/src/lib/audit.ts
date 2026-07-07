import type { Prisma } from "@prisma/client";
import { createAuditAnchor, type AuditAction } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { getIssuerSigningKeys } from "@/lib/security-keys";

export async function writeAuditAnchor(input: {
  action: AuditAction;
  issuerId: string;
  recordId?: string;
  status: string;
  version: number;
  payload: unknown;
}) {
  const previous = await prisma.auditAnchor.findFirst({
    orderBy: { sequence: "desc" }
  });

  const signer = getIssuerSigningKeys();
  const anchor = createAuditAnchor({
    ...input,
    previousHash: previous?.anchorHash ?? null,
    signer
  });

  return prisma.auditAnchor.create({
    data: {
      issuerId: input.issuerId,
      recordId: input.recordId,
      action: anchor.action,
      status: anchor.status,
      version: anchor.version,
      payloadHash: anchor.payloadHash,
      previousHash: anchor.previousHash,
      anchorHash: anchor.anchorHash,
      signature: anchor.signature,
      signatureAlgorithm: anchor.signatureAlgorithm,
      keyId: anchor.keyId,
      publicKey: anchor.publicKey,
      createdAt: new Date(anchor.createdAt)
    } satisfies Prisma.AuditAnchorUncheckedCreateInput
  });
}
