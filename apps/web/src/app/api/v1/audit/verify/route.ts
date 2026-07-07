import {
  constantTimeEqual,
  hashPayload,
  verifyCredentialSignature,
  type AuditAnchorEntry
} from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { publicAuditAnchorSelect } from "@/lib/api-shapes";
import { ok, problem, serviceUnavailable } from "@/lib/json";
import { pageInfo, parsePagination } from "@/lib/api-query";
import { rateLimit } from "@/lib/request-security";

type AnchorRow = {
  action: string;
  issuerId: string;
  recordId: string | null;
  status: string;
  version: number;
  payloadHash: string;
  previousHash: string | null;
  anchorHash: string;
  signature: string | null;
  signatureAlgorithm: string | null;
  keyId: string | null;
  publicKey: string | null;
  createdAt: Date;
};

function toAuditEntry(anchor: AnchorRow): AuditAnchorEntry {
  return {
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
  };
}

function verifyAnchorWindow(entries: AuditAnchorEntry[], expectedPreviousHash: string | null) {
  return entries.every((entry, index) => {
    const expectedPrevious = index === 0 ? expectedPreviousHash : entries[index - 1]?.anchorHash ?? null;
    if (entry.previousHash !== expectedPrevious) return false;

    const expectedHash = hashPayload({
      action: entry.action,
      issuerId: entry.issuerId,
      recordId: entry.recordId ?? null,
      status: entry.status,
      version: entry.version,
      payloadHash: entry.payloadHash,
      previousHash: entry.previousHash,
      createdAt: entry.createdAt
    });

    if (!constantTimeEqual(entry.anchorHash, expectedHash)) return false;

    if (entry.signature || entry.publicKey) {
      if (!entry.signature || !entry.publicKey) return false;

      return verifyCredentialSignature(
        {
          action: entry.action,
          issuerId: entry.issuerId,
          recordId: entry.recordId ?? null,
          status: entry.status,
          version: entry.version,
          payloadHash: entry.payloadHash,
          previousHash: entry.previousHash,
          anchorHash: entry.anchorHash,
          createdAt: entry.createdAt
        },
        entry.signature,
        entry.publicKey
      );
    }

    return true;
  });
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "audit-verify", 30, 60_000);
  if (limited) return limited;

  const { limit, cursor } = parsePagination(request);
  try {
    const previousAnchor = cursor
      ? await prisma.auditAnchor.findUnique({
          where: { id: cursor },
          select: { anchorHash: true }
        })
      : null;

    if (cursor && !previousAnchor) return problem("Invalid audit cursor", 400);

    const anchors = await prisma.auditAnchor.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
      select: publicAuditAnchorSelect
    });
    const page = pageInfo(anchors, limit);
    const entries = page.items.map(toAuditEntry);
    const expectedPreviousHash = previousAnchor?.anchorHash ?? null;
    const verified = verifyAnchorWindow(entries, expectedPreviousHash);

    return ok({
      verified,
      verificationScope: cursor ? "window" : "chain_prefix",
      anchorsChecked: entries.length,
      firstAnchor: entries[0]?.anchorHash ?? null,
      lastAnchor: entries.at(-1)?.anchorHash ?? null,
      nextCursor: page.nextCursor,
      note: "Use cursor pagination for API checks; run full-chain verification as a scheduled background control for large ledgers."
    });
  } catch (error) {
    return serviceUnavailable(error);
  }
}
