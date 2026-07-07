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
import { authorizeMutation, rateLimit } from "@/lib/request-security";

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

export async function GET() {
  const records = await prisma.trustRecord.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      issuer: {
        select: { id: true, name: true, verified: true }
      },
      holder: {
        select: { id: true, displayName: true, email: true }
      },
      consentGrants: {
        orderBy: { createdAt: "desc" },
        take: 3
      },
      verificationEvents: {
        orderBy: { createdAt: "desc" },
        take: 5
      },
      revocation: true,
      disputes: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return ok({ records });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "record-write", 40, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const parsed = await readJson(request, issueCertificateSchema);
  if ("response" in parsed) return parsed.response;

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
    }
  });

  await writeAuditAnchor({
    action: "record_issued",
    issuerId: issuer.id,
    recordId: record.id,
    status: record.status,
    version: record.version,
    payload: credential
  });

  return ok({ record, publicSummary }, { status: 201 });
}
