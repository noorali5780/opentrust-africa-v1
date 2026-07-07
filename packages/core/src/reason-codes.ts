import { z } from "zod";

export const reasonCodeSchema = z.enum([
  "issuer_verified",
  "issuer_not_authorized",
  "signature_valid",
  "signature_invalid",
  "record_expired",
  "record_revoked",
  "dispute_open",
  "identity_confirmed",
  "identity_uncertain",
  "evidence_missing",
  "duplicate_risk",
  "document_hash_matched",
  "consent_valid",
  "consent_expired",
  "verification_offline_cache",
  "community_confirmed",
  "community_disputed"
]);

export type ReasonCode = z.infer<typeof reasonCodeSchema>;

export const reasonCodeMeta: Record<ReasonCode, { label: string; sentiment: "positive" | "negative" | "neutral" }> = {
  issuer_verified: { label: "Issuer identity and role are confirmed", sentiment: "positive" },
  issuer_not_authorized: { label: "Issuer is not allowed to issue this claim type", sentiment: "negative" },
  signature_valid: { label: "Record signature is valid", sentiment: "positive" },
  signature_invalid: { label: "Record signature is invalid", sentiment: "negative" },
  record_expired: { label: "Record has passed its validity period", sentiment: "negative" },
  record_revoked: { label: "Issuer revoked the record", sentiment: "negative" },
  dispute_open: { label: "There is an unresolved dispute", sentiment: "negative" },
  identity_confirmed: { label: "Subject identity meets required confidence", sentiment: "positive" },
  identity_uncertain: { label: "Subject identity confidence is low", sentiment: "negative" },
  evidence_missing: { label: "Required evidence is missing", sentiment: "negative" },
  duplicate_risk: { label: "Similar identity or record appears elsewhere", sentiment: "negative" },
  document_hash_matched: { label: "Document matches stored proof hash", sentiment: "positive" },
  consent_valid: { label: "Access consent is valid", sentiment: "positive" },
  consent_expired: { label: "Access consent expired", sentiment: "negative" },
  verification_offline_cache: { label: "Verification used offline cache and may need refresh", sentiment: "neutral" },
  community_confirmed: { label: "Trusted group members confirmed record", sentiment: "positive" },
  community_disputed: { label: "Trusted group members disputed record", sentiment: "negative" }
};

export type VerificationReasonInput = {
  issuerVerified: boolean;
  issuerAuthorized: boolean;
  signatureValid: boolean;
  identityConfirmed: boolean;
  consentValid: boolean;
  expired: boolean;
  revoked: boolean;
  disputeOpen: boolean;
  offlineCache?: boolean;
  evidencePresent?: boolean;
};

export function buildVerificationReasonCodes(input: VerificationReasonInput): ReasonCode[] {
  const codes: ReasonCode[] = [];

  codes.push(input.issuerVerified ? "issuer_verified" : "issuer_not_authorized");
  codes.push(input.issuerAuthorized ? "issuer_verified" : "issuer_not_authorized");
  codes.push(input.signatureValid ? "signature_valid" : "signature_invalid");
  codes.push(input.identityConfirmed ? "identity_confirmed" : "identity_uncertain");
  codes.push(input.consentValid ? "consent_valid" : "consent_expired");

  if (input.expired) codes.push("record_expired");
  if (input.revoked) codes.push("record_revoked");
  if (input.disputeOpen) codes.push("dispute_open");
  if (input.offlineCache) codes.push("verification_offline_cache");
  if (input.evidencePresent === false) codes.push("evidence_missing");

  return Array.from(new Set(codes));
}
