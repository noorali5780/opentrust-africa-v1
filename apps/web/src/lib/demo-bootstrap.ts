import type { Prisma } from "@prisma/client";
import { encryptJsonPayload } from "@opentrust/core/encryption";
import { certificateCredentialSchema, publicCertificateSummarySchema } from "@opentrust/core/schemas";
import { hashPayload, signCredentialPayload } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { writeAuditAnchor } from "@/lib/audit";
import { getDataEncryptionKey, getIssuerSigningKeys } from "@/lib/security-keys";

const issuerSlug = "nairobi-digital-skills-centre";
const holderEmail = "amina.owino@example.com";

export async function ensureDemoWorkspace() {
  const issuer = await prisma.issuer.upsert({
    where: { slug: issuerSlug },
    create: {
      name: "Nairobi Digital Skills Centre",
      slug: issuerSlug,
      verified: true
    },
    update: {
      name: "Nairobi Digital Skills Centre",
      verified: true,
      status: "active"
    }
  });

  const template =
    (await prisma.recordTemplate.findFirst({
      where: {
        issuerId: issuer.id,
        type: "certificate",
        name: "Training Certificate"
      }
    })) ??
    (await prisma.recordTemplate.create({
      data: {
        issuerId: issuer.id,
        name: "Training Certificate",
        type: "certificate",
        schemaJson: {
          requiredFields: ["holderName", "holderEmail", "achievementName", "completionDate"],
          disclosure: "verify_only"
        } satisfies Prisma.InputJsonValue
      }
    }));

  const holder =
    (await prisma.holder.findFirst({
      where: { email: holderEmail }
    })) ??
    (await prisma.holder.create({
      data: {
        displayName: "Amina Owino",
        email: holderEmail,
        phone: "+254700000001"
      }
    }));

  const existingRecord = await prisma.trustRecord.findFirst({
    where: {
      issuerId: issuer.id,
      holderId: holder.id,
      type: "certificate"
    },
    orderBy: { createdAt: "asc" }
  });

  if (existingRecord) {
    return { issuer, template, holder, demoRecord: existingRecord };
  }

  const recordId = "rec_demo_certificate";
  const issuedAt = new Date("2026-07-01T09:00:00.000Z");
  const completionDate = new Date("2026-06-30T09:00:00.000Z");
  const expiresAt = new Date("2028-06-30T09:00:00.000Z");
  const signingKeys = getIssuerSigningKeys();
  const encryptionKey = getDataEncryptionKey();
  const unsignedCredential = certificateCredentialSchema.parse({
    id: `urn:opentrust:certificate:${recordId}`,
    issuer: {
      id: issuer.id,
      name: issuer.name,
      verified: issuer.verified,
      authorizedRecordTypes: ["certificate"]
    },
    issuanceDate: issuedAt.toISOString(),
    expirationDate: expiresAt.toISOString(),
    credentialSubject: {
      id: holder.id,
      name: holder.displayName,
      email: holder.email,
      achievement: {
        name: "Full-Stack Web Foundations",
        description: "Completed the OpenTrust Africa demo training certificate track",
        level: "Foundation"
      },
      completionDate: completionDate.toISOString(),
      cohort: "July 2026"
    },
    evidence: [
      {
        type: "TrainingCompletionRoster",
        hash: hashPayload({
          holder: holder.email,
          completionDate: completionDate.toISOString(),
          course: "Full-Stack Web Foundations"
        }),
        label: "Signed attendance and assessment roster"
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
      holderEmail: holder.email,
      holderPhone: holder.phone,
      cohort: credential.credentialSubject.cohort
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
    holderName: holder.displayName,
    achievementName: credential.credentialSubject.achievement.name,
    achievementDescription: credential.credentialSubject.achievement.description,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    disputeStatus: "none"
  });

  const demoRecord = await prisma.trustRecord.create({
    data: {
      id: recordId,
      issuerId: issuer.id,
      holderId: holder.id,
      templateId: template.id,
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
    recordId: demoRecord.id,
    status: demoRecord.status,
    version: demoRecord.version,
    payload: credential
  });

  return { issuer, template, holder, demoRecord };
}
