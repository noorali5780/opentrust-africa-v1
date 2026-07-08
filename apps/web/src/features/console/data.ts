import type { ApiAuditAnchor, ApiTrustRecord, ApiVerificationResponse, AuditRow, DemoRecord, IssueForm, VerificationResult } from "./types";
import { createAudit, simpleHash } from "./utils";

export const storageKeys = {
  records: "opentrust.records",
  drafts: "opentrust.drafts",
  audit: "opentrust.audit"
};

export const seededRecord: DemoRecord = {
  id: "rec_demo_certificate",
  holderName: "Amina Owino",
  holderEmail: "amina.owino@example.com",
  courseName: "Full-Stack Web Foundations",
  description: "Completed the OpenTrust Africa demo training certificate track",
  issuedAt: "2026-07-01T09:00:00.000Z",
  expiresAt: "2028-06-30T09:00:00.000Z",
  status: "issued",
  disputeStatus: "none",
  signature: "sha256:demo-valid-signature",
  shareToken: "otv_demo_certificate",
  consentStatus: "active",
  consentPurpose: "Employer certificate verification",
  consentExpiresAt: "2026-12-31T23:59:59.000Z",
  accessHistory: [
    {
      id: "acc_demo_1",
      verifier: "Kijani Works HR",
      purpose: "Verify skills certificate",
      at: "2026-07-05T10:30:00.000Z",
      cacheState: "fresh"
    }
  ]
};

export const seededAudit: AuditRow[] = [
  createAudit("record_issued", seededRecord.id, seededRecord.status, seededRecord, null),
  createAudit("consent_granted", seededRecord.id, "active", { token: seededRecord.shareToken, purpose: seededRecord.consentPurpose }, simpleHash(seededRecord))
];

export const defaultIssueForm: IssueForm = {
  holderName: "Amina Owino",
  holderEmail: "amina.owino@example.com",
  courseName: "Full-Stack Web Foundations",
  description: "Completed a verified training program with assessment and attendance evidence.",
  expiresAt: "2028-06-30"
};

export function mapApiRecord(record: ApiTrustRecord, tokenByRecord: Record<string, string>): DemoRecord {
  const summary = record.publicSummaryJson;
  const activeConsent = record.consentGrants.find((consent) => consent.status === "active") ?? record.consentGrants[0];
  const status = record.status === "revoked" || record.status === "disputed" ? record.status : "issued";

  return {
    id: record.id,
    issuerId: record.issuerId,
    holderId: record.holderId,
    activeConsentId: activeConsent?.id,
    holderName: summary.holderName ?? record.holder.displayName,
    holderEmail: record.holder.email,
    courseName: summary.achievementName ?? "Training Certificate",
    description: summary.achievementDescription ?? "Certificate record",
    issuedAt: summary.issuedAt ?? record.issuedAt,
    expiresAt: summary.expiresAt ?? record.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status,
    disputeStatus: record.disputeState === "open" || summary.disputeStatus === "open" ? "open" : "none",
    signature: record.signature,
    shareToken: tokenByRecord[record.id] ?? null,
    consentStatus: activeConsent ? (activeConsent.status === "active" ? "active" : "revoked") : "none",
    consentPurpose: activeConsent?.purpose ?? "",
    consentExpiresAt: activeConsent?.expiresAt ?? "",
    accessHistory: record.verificationEvents.map((event) => ({
      id: event.id,
      verifier: event.verifierReference ?? "Verifier",
      purpose: event.purpose ?? "Verification request",
      at: event.createdAt,
      cacheState: event.cached ? "offline_cache" : "fresh"
    }))
  };
}

export function mapAuditRows(anchors: ApiAuditAnchor[]): AuditRow[] {
  return anchors.map((anchor) => ({
    id: anchor.id,
    action: anchor.action,
    recordId: anchor.recordId,
    status: anchor.status,
    payloadHash: anchor.payloadHash,
    previousHash: anchor.previousHash,
    anchorHash: anchor.anchorHash,
    createdAt: anchor.createdAt
  }));
}

export function mapApiVerification(response: ApiVerificationResponse): VerificationResult {
  return {
    valid: response.valid,
    title: response.valid ? "Certificate verified" : "Certificate needs review",
    status: response.status,
    holderName: response.summary.holderName,
    courseName: response.summary.achievementName,
    issuerName: response.issuer.name,
    issuedAt: response.summary.issuedAt,
    expiresAt: response.summary.expiresAt,
    reasonCodes: response.reasonCodes,
    cacheState: response.cacheState,
    trustScore: response.trustScore?.score,
    band: response.trustScore?.band
  };
}
