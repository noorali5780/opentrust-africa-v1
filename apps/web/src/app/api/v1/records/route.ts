import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { encryptJsonPayload } from "@opentrust/core/encryption";
import { certificateCredentialSchema, publicCertificateSummarySchema } from "@opentrust/core/schemas";
import { hashPayload, signCredentialPayload } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { ok, problem, readJson } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { getDataEncryptionKey, getIssuerSigningKeys } from "@/lib/security-keys";
import { publicTrustRecordSelect } from "@/lib/api-shapes";
import { authorizeIssuerMutation, getRecordReadScope, rateLimit } from "@/lib/request-security";
import { pageInfo, parsePagination } from "@/lib/api-query";
import { replayIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";

const issueCertificateSchema = z.object({
  issuerId: z.string().min(1),
  templateId: z.string().min(1).optional(),
  holderName: z.string().min(2),
  holderEmail: z.string().email(),
  holderPhone: z.string().optional(),
  achievementName: z.string().min(2),
  achievementDescription: z.string().min(2),
  cohort: z.string().optional(),
  completionDate: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional()
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "record-read", 120, 60_000);
  if (limited) return limited;

  const { limit, cursor } = parsePagination(request);
  const url = new URL(request.url);
  const issuerId = url.searchParams.get("issuerId") ?? undefined;
  const holderId = url.searchParams.get("holderId") ?? undefined;
  const scope = await getRecordReadScope(request);
  if ("response" in scope) return scope.response;

  const andFilters: Prisma.TrustRecordWhereInput[] = [];
  if (issuerId) andFilters.push({ issuerId });
  if (holderId) andFilters.push({ holderId });
  if (!scope.all) {
    const accessFilters: Prisma.TrustRecordWhereInput[] = [];
    if (scope.issuerIds.length > 0) accessFilters.push({ issuerId: { in: scope.issuerIds } });
    if (scope.holderIds.length > 0) accessFilters.push({ holderId: { in: scope.holderIds } });
    andFilters.push({ OR: accessFilters });
  }

  const records = await prisma.trustRecord.findMany({
    where: andFilters.length > 0 ? { AND: andFilters } : undefined,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: publicTrustRecordSelect
  });
  const page = pageInfo(records, limit);

  return ok({ records: page.items, nextCursor: page.nextCursor });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "record-write", 40, 60_000);
  if (limited) return limited;

  const parsed = await readJson(request, issueCertificateSchema);
  if ("response" in parsed) return parsed.response;

  const issuerDenied = await authorizeIssuerMutation(request, parsed.data.issuerId);
  if (issuerDenied) return issuerDenied;

  const replayed = await replayIdempotentResponse(request, "POST /api/v1/records", parsed.data);
  if (replayed) return replayed;

  const issuer = await prisma.issuer.findUnique({
    where: { id: parsed.data.issuerId }
  });

  if (!issuer) return problem("Issuer not found", 404);

  const holder =
    (await prisma.holder.findFirst({
      where: { email: parsed.data.holderEmail }
    })) ??
    (await prisma.holder.create({
      data: {
        displayName: parsed.data.holderName,
        email: parsed.data.holderEmail,
        phone: parsed.data.holderPhone
      }
    }));

  const recordId = `rec_${randomUUID()}`;
  const issuedAt = new Date();
  const signingKeys = getIssuerSigningKeys();
  const encryptionKey = getDataEncryptionKey();
  const completionDate = parsed.data.completionDate ? new Date(parsed.data.completionDate) : issuedAt;
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;
  const unsignedCredential = certificateCredentialSchema.parse({
    id: `urn:opentrust:certificate:${recordId}`,
    issuer: {
      id: issuer.id,
      name: issuer.name,
      verified: issuer.verified,
      authorizedRecordTypes: ["certificate"]
    },
    issuanceDate: issuedAt.toISOString(),
    expirationDate: expiresAt?.toISOString(),
    credentialSubject: {
      id: holder.id,
      name: parsed.data.holderName,
      email: parsed.data.holderEmail,
      achievement: {
        name: parsed.data.achievementName,
        description: parsed.data.achievementDescription
      },
      completionDate: completionDate.toISOString(),
      cohort: parsed.data.cohort
    },
    evidence: [
      {
        type: "IssuerAttestation",
        hash: hashPayload({
          issuerId: issuer.id,
          holderEmail: parsed.data.holderEmail,
          achievementName: parsed.data.achievementName,
          completionDate: completionDate.toISOString()
        }),
        label: "Issuer confirmed completion"
      }
    ]
  });
  const signature = signCredentialPayload(unsignedCredential, signingKeys.privateKeyDerBase64);
  const credential = certificateCredentialSchema.parse({
    ...unsignedCredential,
    proof: {
      type: "OpenTrustEd25519Signature2026",
      created: issuedAt.toISOString(),
      proofPurpose: "assertionMethod",
      verificationMethod: `opentrust:issuer:${issuer.id}#key-1`,
      publicKey: signingKeys.publicKeyDerBase64,
      keyId: signingKeys.keyId,
      signature
    }
  });
  const encryptedPrivateSubject = encryptJsonPayload(
    {
      holderEmail: parsed.data.holderEmail,
      holderPhone: parsed.data.holderPhone,
      cohort: parsed.data.cohort
    },
    encryptionKey.key,
    encryptionKey.keyId
  );
  const publicSummary = publicCertificateSummarySchema.parse({
    recordId,
    recordType: "certificate",
    status: "issued",
    issuer: {
      id: issuer.id,
      name: issuer.name,
      verified: issuer.verified
    },
    holderName: parsed.data.holderName,
    achievementName: parsed.data.achievementName,
    achievementDescription: parsed.data.achievementDescription,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt?.toISOString(),
    disputeStatus: "none"
  });

  const record = await prisma.trustRecord.create({
    data: {
      id: recordId,
      issuerId: issuer.id,
      holderId: holder.id,
      templateId: parsed.data.templateId,
      type: "certificate",
      status: "issued",
      credentialJson: credential as Prisma.InputJsonValue,
      privateSubjectJson: {
        encrypted: true,
        algorithm: encryptedPrivateSubject.algorithm,
        keyId: encryptedPrivateSubject.keyId,
        fields: ["holderEmail", "holderPhone", "cohort"]
      } satisfies Prisma.InputJsonValue,
      privateSubjectCiphertext: encryptedPrivateSubject.ciphertext,
      privateSubjectIv: encryptedPrivateSubject.iv,
      privateSubjectTag: encryptedPrivateSubject.tag,
      privateSubjectKeyId: encryptedPrivateSubject.keyId,
      publicSummaryJson: publicSummary as Prisma.InputJsonValue,
      evidenceHash: hashPayload(credential.evidence),
      signature,
      issuedAt,
      expiresAt
    },
    select: publicTrustRecordSelect
  });

  await writeAuditAnchor({
    action: "record_issued",
    issuerId: issuer.id,
    recordId: record.id,
    status: record.status,
    version: record.version,
    payload: credential
  });

  const responseBody = { record, publicSummary };
  await storeIdempotentResponse(request, "POST /api/v1/records", parsed.data, responseBody, 201);

  return ok(responseBody, { status: 201 });
}
