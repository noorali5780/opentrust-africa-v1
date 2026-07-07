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
});
