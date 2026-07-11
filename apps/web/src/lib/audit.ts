import { Prisma } from "@prisma/client";
import { createAuditAnchor, type AuditAction } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { getIssuerSigningKeys } from "@/lib/security-keys";
import { runAuditOperation } from "@/lib/operation-control";

export async function writeAuditAnchor(input: {
  action: AuditAction;
  issuerId: string;
  recordId?: string;
  status: string;
  version: number;
  payload: unknown;
}) {
  return runAuditOperation("audit.write_anchor", async ({ throwIfAborted }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        throwIfAborted();
        return await prisma.$transaction(
          async (tx) => {
            const previous = await tx.auditAnchor.findFirst({
              orderBy: { sequence: "desc" }
            });

            const signer = getIssuerSigningKeys();
            const anchor = createAuditAnchor({
              ...input,
              previousHash: previous?.anchorHash ?? null,
              signer
            });

            return tx.auditAnchor.create({
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
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5_000,
            timeout: 8_000
          }
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Unable to write audit anchor");
  });
}
