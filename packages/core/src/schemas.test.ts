import { describe, expect, it } from "vitest";
import { certificateCredentialSchema, publicCertificateSummarySchema, verificationResponseSchema } from "./schemas";

describe("certificate schemas", () => {
  it("accepts W3C-style certificate credentials", () => {
    const credential = certificateCredentialSchema.parse({
      id: "urn:opentrust:certificate:record_1",
      issuer: {
        id: "issuer_1",
        name: "Nairobi Digital Skills Centre",
        verified: true,
        authorizedRecordTypes: ["certificate"]
      },
      issuanceDate: "2026-07-01T09:00:00.000Z",
      credentialSubject: {
        id: "holder_1",
        name: "Amina Owino",
        email: "amina.owino@example.com",
        achievement: {
          name: "Full-Stack Web Foundations",
          description: "Completed the training program"
        },
        completionDate: "2026-06-30T09:00:00.000Z"
      }
    });

    expect(credential.type).toContain("OpenTrustCertificateCredential");
    expect(credential.credentialSubject.achievement.name).toBe("Full-Stack Web Foundations");
  });

  it("keeps verification responses minimal", () => {
    const summary = publicCertificateSummarySchema.parse({
      recordId: "record_1",
      recordType: "certificate",
      status: "issued",
      issuer: {
        id: "issuer_1",
        name: "Nairobi Digital Skills Centre",
        verified: true
      },
      holderName: "Amina Owino",
      achievementName: "Full-Stack Web Foundations",
      achievementDescription: "Completed the training program",
      issuedAt: "2026-07-01T09:00:00.000Z",
      disputeStatus: "none"
    });

    const response = verificationResponseSchema.parse({
      valid: true,
      status: "issued",
      issuer: summary.issuer,
      recordType: "certificate",
      disclosureMode: "verify_only",
      summary,
      reasonCodes: ["issuer_verified", "signature_valid", "consent_valid"],
      verifiedAt: "2026-07-02T09:00:00.000Z",
      cacheState: "fresh"
    });

    expect(JSON.stringify(response)).not.toContain("phone");
    expect(JSON.stringify(response)).not.toContain("privateSubject");
  });
});
