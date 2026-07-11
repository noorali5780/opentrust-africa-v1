import { describe, expect, it } from "vitest";
import { buildVerificationReasonCodes } from "./reason-codes";
import { calculateTrustScore } from "./trust-score";

describe("verification trust loop", () => {
  it("explains revoked and disputed records with reason codes", () => {
    const reasonCodes = buildVerificationReasonCodes({
      issuerVerified: true,
      issuerAuthorized: true,
      signatureValid: true,
      identityConfirmed: true,
      consentValid: true,
      expired: false,
      revoked: true,
      disputeOpen: true,
      offlineCache: true,
      evidencePresent: true
    });

    expect(reasonCodes).toContain("record_revoked");
    expect(reasonCodes).toContain("dispute_open");
    expect(reasonCodes).toContain("verification_offline_cache");
  });

  it("lowers trust when a dispute penalty is present", () => {
    const clean = calculateTrustScore({
      identityConfidence: 90,
      issuerTrust: 90,
      evidenceStrength: 90,
      consistencyScore: 90,
      domainReputation: 90,
      recencyScore: 90,
      communityValidation: 50
    });
    const disputed = calculateTrustScore({
      identityConfidence: 90,
      issuerTrust: 90,
      evidenceStrength: 90,
      consistencyScore: 90,
      domainReputation: 90,
      recencyScore: 90,
      communityValidation: 50,
      disputePenalty: 30
    });

    expect(clean.score).toBeGreaterThan(disputed.score);
    expect(disputed.band).toBe("Needs review");
  });

  it("caps critical failures so strong-looking inputs cannot bypass verification", () => {
    const compromised = calculateTrustScore({
      identityConfidence: 100,
      issuerTrust: 100,
      evidenceStrength: 100,
      consistencyScore: 100,
      domainReputation: 100,
      recencyScore: 100,
      communityValidation: 100,
      criticalSignals: {
        signatureInvalid: true
      }
    });

    expect(compromised.score).toBeLessThanOrEqual(24);
    expect(compromised.band).toBe("Suspicious or invalid");
    expect(compromised.riskLevel).toBe("critical");
    expect(compromised.reviewRequired).toBe(true);
    expect(compromised.reasonCodes).toContain("signature_invalid");
  });

  it("predicts anomaly risk from repeated conflicts and issuer abuse signals", () => {
    const anomalous = calculateTrustScore({
      identityConfidence: 88,
      issuerTrust: 82,
      evidenceStrength: 85,
      consistencyScore: 80,
      domainReputation: 76,
      recencyScore: 90,
      communityValidation: 55,
      anomalySignals: {
        duplicateIdentityMatches: 3,
        recentIssuerIssueCount: 240,
        issuerRevocationRate: 0.18,
        subjectRecordConflictCount: 2
      }
    });

    expect(anomalous.score).toBeLessThanOrEqual(49);
    expect(anomalous.riskLevel).toBe("critical");
    expect(anomalous.reviewRequired).toBe(true);
    expect(anomalous.reasonCodes).toContain("anomaly_pattern_detected");
  });
});
