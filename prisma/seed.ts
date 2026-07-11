import { PrismaClient } from "@prisma/client";
import { encryptJsonPayload } from "@opentrust/core/encryption";
import { certificateCredentialSchema, publicCertificateSummarySchema } from "@opentrust/core/schemas";
import { createAuditAnchor, createShareToken, hashPayload, hashToken, signCredentialPayload } from "@opentrust/core/proof-ledger";
import { getDataEncryptionKey, getIssuerSigningKeys } from "../apps/web/src/lib/security-keys";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.verificationEvent.deleteMany(),
    prisma.shareLink.deleteMany(),
    prisma.consentGrant.deleteMany(),
    prisma.auditAnchor.deleteMany(),
    prisma.dispute.deleteMany(),
    prisma.revocation.deleteMany(),
    prisma.trustRecord.deleteMany(),
    prisma.recordTemplate.deleteMany(),
    prisma.issuerMember.deleteMany(),
    prisma.holder.deleteMany(),
    prisma.magicLinkToken.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.issuer.deleteMany()
  ]);

  const issuerUser = await prisma.user.create({
    data: {
      email: "admin@nairobitech.example",
      name: "Training Center Admin"
    }
  });

  const holderUser = await prisma.user.create({
    data: {
      email: "amina.owino@example.com",
      name: "Amina Owino"
    }
  });

  const holder = await prisma.holder.create({
    data: {
      userId: holderUser.id,
      displayName: "Amina Owino",
      email: "amina.owino@example.com",
      phone: "+254700000001"
    }
  });

  const issuer = await prisma.issuer.create({
    data: {
      name: "Nairobi Digital Skills Centre",
      slug: "nairobi-digital-skills-centre",
      verified: true,
      members: {
        create: {
          userId: issuerUser.id,
          role: "admin"
        }
      }
    }
  });

  const template = await prisma.recordTemplate.create({
    data: {
      issuerId: issuer.id,
      name: "Training Certificate",
      type: "certificate",
      schemaJson: {
        requiredFields: ["holderName", "holderEmail", "achievementName", "completionDate"],
        disclosure: "verify_only"
      }
    }
  });

  const issuedAt = new Date();
  const completionDate = new Date("2026-06-30T09:00:00.000Z");
  const signingKeys = getIssuerSigningKeys();
  const encryptionKey = getDataEncryptionKey();
  const unsignedCredential = certificateCredentialSchema.parse({
    id: `urn:opentrust:certificate:${crypto.randomUUID()}`,
    issuer: {
      id: issuer.id,
      name: issuer.name,
      verified: issuer.verified,
      authorizedRecordTypes: ["certificate"]
    },
    issuanceDate: issuedAt.toISOString(),
    expirationDate: new Date("2028-06-30T09:00:00.000Z").toISOString(),
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
        hash: hashPayload({ holder: holder.email, completionDate: completionDate.toISOString(), course: "Full-Stack Web Foundations" }),
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
    recordId: "seed-placeholder",
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
    expiresAt: credential.expirationDate,
    disputeStatus: "none"
  });

  const record = await prisma.trustRecord.create({
    data: {
      issuerId: issuer.id,
      holderId: holder.id,
      templateId: template.id,
      type: "certificate",
      status: "issued",
      credentialJson: credential,
      privateSubjectJson: {
        encrypted: true,
        algorithm: encryptedPrivateSubject.algorithm,
        keyId: encryptedPrivateSubject.keyId,
        fields: ["holderEmail", "holderPhone", "cohort"]
      },
      privateSubjectCiphertext: encryptedPrivateSubject.ciphertext,
      privateSubjectIv: encryptedPrivateSubject.iv,
      privateSubjectTag: encryptedPrivateSubject.tag,
      privateSubjectKeyId: encryptedPrivateSubject.keyId,
      publicSummaryJson: publicSummary,
      evidenceHash: hashPayload(credential.evidence),
      signature,
      issuedAt,
      expiresAt: credential.expirationDate ? new Date(credential.expirationDate) : null
    }
  });

  await prisma.trustRecord.update({
    where: { id: record.id },
    data: {
      publicSummaryJson: {
        ...publicSummary,
        recordId: record.id
      }
    }
  });

  const anchor = createAuditAnchor({
    action: "record_issued",
    issuerId: issuer.id,
    recordId: record.id,
    status: "issued",
    version: 1,
    payload: credential,
    previousHash: null,
    signer: signingKeys,
    createdAt: issuedAt
  });

  await prisma.auditAnchor.create({
    data: {
      issuerId: issuer.id,
      recordId: record.id,
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
    }
  });

  const token = createShareToken();
  const consent = await prisma.consentGrant.create({
    data: {
      holderId: holder.id,
      recordId: record.id,
      mode: "verify_only",
      purpose: "Employer certificate verification",
      audience: "Any employer with this link",
      expiresAt: new Date("2026-12-31T23:59:59.000Z")
    }
  });

  await prisma.shareLink.create({
    data: {
      tokenHash: hashToken(token),
      holderId: holder.id,
      recordId: record.id,
      consentGrantId: consent.id,
      expiresAt: consent.expiresAt
    }
  });

  console.log("Seed complete");
  console.log(`Issuer: ${issuer.name}`);
  console.log(`Holder: ${holder.displayName}`);
  console.log(`Verify token: ${token}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
