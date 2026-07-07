import { verifyAnchorChain, type AuditAnchorEntry } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/json";

export async function GET() {
  const anchors = await prisma.auditAnchor.findMany({
    orderBy: { sequence: "asc" }
  });

  const entries: AuditAnchorEntry[] = anchors.map((anchor) => ({
    action: anchor.action as AuditAnchorEntry["action"],
    issuerId: anchor.issuerId,
    recordId: anchor.recordId ?? undefined,
    status: anchor.status,
    version: anchor.version,
    payloadHash: anchor.payloadHash,
    previousHash: anchor.previousHash,
    anchorHash: anchor.anchorHash,
    signature: anchor.signature ?? undefined,
    signatureAlgorithm: anchor.signatureAlgorithm === "Ed25519" ? "Ed25519" : undefined,
    keyId: anchor.keyId ?? undefined,
    publicKey: anchor.publicKey ?? undefined,
    createdAt: anchor.createdAt.toISOString()
  }));

  return ok({
    verified: verifyAnchorChain(entries),
    anchorsChecked: entries.length,
    firstAnchor: entries[0]?.anchorHash ?? null,
    lastAnchor: entries.at(-1)?.anchorHash ?? null
  });
}
