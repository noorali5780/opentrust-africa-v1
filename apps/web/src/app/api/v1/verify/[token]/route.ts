import type { Prisma } from "@prisma/client";
import { buildVerificationReasonCodes } from "@opentrust/core/reason-codes";
import { certificateCredentialSchema, publicCertificateSummarySchema, verificationResponseSchema } from "@opentrust/core/schemas";
import { hashToken, verifyCredentialSignature } from "@opentrust/core/proof-ledger";
import { calculateTrustScore } from "@opentrust/core/trust-score";
import { prisma } from "@/lib/prisma";
import { ok, problem, serviceUnavailable } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { rateLimit } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = rateLimit(request, "verify-token", 120, 60_000);
  if (limited) return limited;

  const { token } = await context.params;
  if (token.length < 16 || token.length > 256) return problem("Verification link not found", 404);

  const url = new URL(request.url);
  const offlineCache = url.searchParams.get("offlineCache") === "true";
  const verifierReference = url.searchParams.get("verifier") ?? undefined;
  const purpose = url.searchParams.get("purpose") ?? undefined;
  const tokenHash = hashToken(token);

  try {
    const shareLink = await prisma.shareLink.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        consentGrantId: true,
        expiresAt: true,
        revokedAt: true,
        consentGrant: {
          select: {
            id: true,
            mode: true,
            status: true,
            expiresAt: true,
            revokedAt: true
          }
        },
        record: {
          select: {
            id: true,
            issuerId: true,
            holderId: true,
            templateId: true,
            type: true,
            status: true,
            version: true,
            credentialJson: true,
            publicSummaryJson: true,
            evidenceHash: true,
            expiresAt: true,
            revokedAt: true,
            disputeState: true,
            issuer: {
              select: {
                id: true,
                name: true,
                verified: true
              }
            }
          }
        }
      }
    });

    if (!shareLink) return problem("Verification link not found", 404);

    const record = shareLink.record;
    const credential = certificateCredentialSchema.parse(record.credentialJson);
    const { proof, ...unsignedCredential } = credential;
    const signatureValid = Boolean(proof?.signature && proof.publicKey && verifyCredentialSignature(unsignedCredential, proof.signature, proof.publicKey));
    const issuerAuthorized = credential.issuer.authorizedRecordTypes.includes("certificate");
    const recordExpired = Boolean(record.expiresAt && record.expiresAt.getTime() < Date.now());
    const consentExpired = Boolean(
      shareLink.revokedAt ||
        shareLink.consentGrant.revokedAt ||
        shareLink.consentGrant.status !== "active" ||
        (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) ||
        (shareLink.consentGrant.expiresAt && shareLink.consentGrant.expiresAt.getTime() < Date.now())
    );
    const revoked = record.status === "revoked";
    const disputeOpen = record.disputeState === "open" || record.status === "disputed";
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const [
      duplicateEvidenceMatches,
      duplicateTemplateMatches,
      recentIssuerIssueCount,
      issuerRecordCount,
      issuerRevokedCount,
      issuerDisputedCount,
      subjectRecordConflictCount
    ] = await Promise.all([
      record.evidenceHash
        ? prisma.trustRecord.count({
            where: {
              id: { not: record.id },
              evidenceHash: record.evidenceHash,
              type: record.type
            }
          })
        : Promise.resolve(0),
      record.templateId
        ? prisma.trustRecord.count({
            where: {
              id: { not: record.id },
              holderId: record.holderId,
              templateId: record.templateId,
              type: record.type,
              status: { in: ["issued", "disputed"] }
            }
          })
        : Promise.resolve(0),
      prisma.trustRecord.count({
        where: {
          issuerId: record.issuerId,
          createdAt: { gte: oneDayAgo }
        }
      }),
      prisma.trustRecord.count({
        where: {
          issuerId: record.issuerId,
          createdAt: { gte: ninetyDaysAgo }
        }
      }),
      prisma.trustRecord.count({
        where: {
          issuerId: record.issuerId,
          status: "revoked",
          createdAt: { gte: ninetyDaysAgo }
        }
      }),
      prisma.trustRecord.count({
        where: {
          issuerId: record.issuerId,
          createdAt: { gte: ninetyDaysAgo },
          OR: [{ disputeState: "open" }, { status: "disputed" }]
        }
      }),
      prisma.trustRecord.count({
        where: {
          holderId: record.holderId,
          id: { not: record.id },
          createdAt: { gte: ninetyDaysAgo },
          OR: [{ status: "revoked" }, { status: "disputed" }, { disputeState: "open" }]
        }
      })
    ]);
    const duplicateIdentityMatches = duplicateEvidenceMatches + duplicateTemplateMatches;
    const issuerRevocationRate = issuerRecordCount > 0 ? issuerRevokedCount / issuerRecordCount : 0;
    const issuerDisputeRate = issuerRecordCount > 0 ? issuerDisputedCount / issuerRecordCount : 0;
    const reasonCodes = buildVerificationReasonCodes({
      issuerVerified: record.issuer.verified,
      issuerAuthorized,
      signatureValid,
      identityConfirmed: true,
      consentValid: !consentExpired,
      expired: recordExpired,
      revoked,
      disputeOpen,
      offlineCache,
      evidencePresent: Boolean(record.evidenceHash),
      duplicateRisk: duplicateIdentityMatches > 0
    });
    const trustScore = calculateTrustScore({
      identityConfidence: 90,
      issuerTrust: record.issuer.verified ? 92 : 45,
      evidenceStrength: record.evidenceHash ? 86 : 42,
      consistencyScore: signatureValid ? 90 : 20,
      domainReputation: 80,
      recencyScore: recordExpired ? 20 : 88,
      communityValidation: 50,
      fraudPenalty: signatureValid ? 0 : 35,
      disputePenalty: revoked ? 70 : disputeOpen ? 25 : 0,
      criticalSignals: {
        issuerUnverified: !record.issuer.verified,
        issuerUnauthorized: !issuerAuthorized,
        signatureInvalid: !signatureValid,
        consentInvalid: consentExpired,
        expired: recordExpired,
        revoked,
        disputeOpen,
        evidenceMissing: !record.evidenceHash,
        duplicateRisk: duplicateIdentityMatches > 0,
        abnormalIssuanceBurst: recentIssuerIssueCount > 200
      },
      anomalySignals: {
        duplicateIdentityMatches,
        recentIssuerIssueCount,
        issuerRevocationRate,
        issuerDisputeRate,
        subjectRecordConflictCount,
        offlineCache
      }
    });
    const valid =
      record.issuer.verified &&
      issuerAuthorized &&
      signatureValid &&
      !recordExpired &&
      !consentExpired &&
      !revoked &&
      !disputeOpen &&
      !trustScore.reviewRequired;
    const responseStatus = revoked ? "revoked" : disputeOpen ? "disputed" : recordExpired ? "expired" : record.status;
    const summary = publicCertificateSummarySchema.parse({
      ...(record.publicSummaryJson as Record<string, unknown>),
      status: responseStatus,
      revokedAt: record.revokedAt?.toISOString(),
      disputeStatus: disputeOpen ? "open" : "none"
    });
    const verificationResponse = verificationResponseSchema.parse({
      valid,
      status: responseStatus,
      issuer: {
        id: record.issuer.id,
        name: record.issuer.name,
        verified: record.issuer.verified
      },
      recordType: "certificate",
      disclosureMode: shareLink.consentGrant.mode,
      summary,
      reasonCodes,
      trustScore,
      verifiedAt: new Date().toISOString(),
      cacheState: offlineCache ? "offline_cache" : "fresh"
    });

    await prisma.$transaction([
      prisma.shareLink.update({
        where: { id: shareLink.id },
        data: { lastUsedAt: new Date() }
      }),
      prisma.consentGrant.update({
        where: { id: shareLink.consentGrantId },
        data: { accessCount: { increment: 1 } }
      }),
      prisma.verificationEvent.create({
        data: {
          recordId: record.id,
          issuerId: record.issuerId,
          shareLinkId: shareLink.id,
          consentGrantId: shareLink.consentGrantId,
          verifierReference,
          purpose,
          status: responseStatus,
          reasonCodes: reasonCodes as Prisma.InputJsonValue,
          cached: offlineCache
        }
      })
    ]);

    await writeAuditAnchor({
      action: "record_verified",
      issuerId: record.issuerId,
      recordId: record.id,
      status: responseStatus,
      version: record.version,
      payload: {
        verifierReference,
        purpose,
        reasonCodes,
        offlineCache
      }
    });

    return ok(verificationResponse);
  } catch (error) {
    return serviceUnavailable(error);
  }
}
