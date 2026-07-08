import { describe, expect, it } from "vitest";
import { mapApiRecord, mapApiVerification } from "./data";
import type { ApiTrustRecord, ApiVerificationResponse } from "./types";

describe("console data mappers", () => {
  it("maps API records into the holder-visible console model", () => {
    const record: ApiTrustRecord = {
      id: "rec_1",
      type: "certificate",
      status: "issued",
      issuerId: "iss_1",
      holderId: "hol_1",
      publicSummaryJson: {
        holderName: "Amina Owino",
        achievementName: "Full-Stack Web Foundations",
        achievementDescription: "Completed training",
        issuedAt: "2026-07-01T09:00:00.000Z",
        expiresAt: "2028-06-30T09:00:00.000Z",
        disputeStatus: "none"
      },
      signature: "sig",
      issuedAt: "2026-07-01T09:00:00.000Z",
      expiresAt: null,
      disputeState: "none",
      issuer: { id: "iss_1", name: "Training Centre", verified: true },
      holder: { id: "hol_1", displayName: "Amina", email: "amina@example.com" },
      consentGrants: [
        {
          id: "con_1",
          mode: "verify_only",
          purpose: "Employer verification",
          status: "active",
          expiresAt: "2026-12-31T23:59:59.000Z"
        }
      ],
      verificationEvents: [
        {
          id: "ver_1",
          verifierReference: "Kijani Works HR",
          purpose: "Verify skills certificate",
          createdAt: "2026-07-05T10:30:00.000Z",
          cached: false
        }
      ]
    };

    const mapped = mapApiRecord(record, { rec_1: "share-token" });

    expect(mapped.courseName).toBe("Full-Stack Web Foundations");
    expect(mapped.consentStatus).toBe("active");
    expect(mapped.shareToken).toBe("share-token");
    expect(mapped.accessHistory).toHaveLength(1);
  });

  it("maps verification results into compact view state", () => {
    const response: ApiVerificationResponse = {
      valid: true,
      status: "issued",
      issuer: { name: "Training Centre" },
      summary: {
        holderName: "Amina Owino",
        achievementName: "Full-Stack Web Foundations",
        issuedAt: "2026-07-01T09:00:00.000Z"
      },
      reasonCodes: ["issuer_verified", "signature_valid", "consent_valid"],
      trustScore: { score: 88, band: "Highly trusted" },
      cacheState: "fresh"
    };

    expect(mapApiVerification(response)).toMatchObject({
      valid: true,
      title: "Certificate verified",
      issuerName: "Training Centre",
      trustScore: 88
    });
  });
});
