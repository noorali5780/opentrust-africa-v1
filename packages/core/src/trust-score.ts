export type TrustScoreInput = {
  identityConfidence: number;
  issuerTrust: number;
  evidenceStrength: number;
  consistencyScore: number;
  domainReputation: number;
  recencyScore: number;
  communityValidation: number;
  fraudPenalty?: number;
  disputePenalty?: number;
  criticalSignals?: Partial<Record<TrustCriticalSignal, boolean>>;
  anomalySignals?: TrustAnomalySignals;
};

export type TrustCriticalSignal =
  | "issuerUnverified"
  | "issuerUnauthorized"
  | "signatureInvalid"
  | "consentInvalid"
  | "expired"
  | "revoked"
  | "disputeOpen"
  | "evidenceMissing"
  | "duplicateRisk"
  | "impossibleTimestamp"
  | "evidenceHashMismatch"
  | "abnormalIssuanceBurst"
  | "communityDisputed";

export type TrustAnomalySignals = {
  duplicateIdentityMatches?: number;
  recentIssuerIssueCount?: number;
  issuerRevocationRate?: number;
  issuerDisputeRate?: number;
  subjectRecordConflictCount?: number;
  templateMismatch?: boolean;
  deviceInconsistent?: boolean;
  geofenceRisk?: "low" | "medium" | "high";
  offlineCache?: boolean;
};

export type TrustScoreBand = "Highly trusted" | "Trusted" | "Needs review" | "Weak proof" | "Suspicious or invalid";
export type TrustRiskLevel = "low" | "medium" | "high" | "critical";

export type TrustScoreReason =
  | "weighted_score"
  | "issuer_unverified"
  | "issuer_unauthorized"
  | "signature_invalid"
  | "consent_invalid"
  | "record_expired"
  | "record_revoked"
  | "dispute_open"
  | "evidence_missing"
  | "duplicate_risk"
  | "impossible_timestamp"
  | "evidence_hash_mismatch"
  | "abnormal_issuance_burst"
  | "community_disputed"
  | "anomaly_pattern_detected"
  | "low_prediction_confidence";

export type TrustScoreResult = {
  score: number;
  band: TrustScoreBand;
  riskLevel: TrustRiskLevel;
  confidence: number;
  reviewRequired: boolean;
  reasonCodes: TrustScoreReason[];
  components: {
    baseScore: number;
    penalty: number;
    anomalyScore: number;
    scoreCap: number;
  };
};

type NormalizedComponents = Pick<
  TrustScoreInput,
  "identityConfidence" | "issuerTrust" | "evidenceStrength" | "consistencyScore" | "domainReputation" | "recencyScore" | "communityValidation"
>;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalizeScore = (value: number) => (Number.isFinite(value) ? clamp(value) : 0);

const round = (value: number) => Math.round(value);

const unique = <T>(items: T[]) => Array.from(new Set(items));

const bandForScore = (score: number): TrustScoreBand =>
  score >= 85 ? "Highly trusted" : score >= 70 ? "Trusted" : score >= 50 ? "Needs review" : score >= 30 ? "Weak proof" : "Suspicious or invalid";

const guardrails: Array<{
  signal: TrustCriticalSignal;
  reason: TrustScoreReason;
  cap: number;
  penalty: number;
}> = [
  { signal: "revoked", reason: "record_revoked", cap: 10, penalty: 80 },
  { signal: "signatureInvalid", reason: "signature_invalid", cap: 24, penalty: 45 },
  { signal: "evidenceHashMismatch", reason: "evidence_hash_mismatch", cap: 19, penalty: 60 },
  { signal: "impossibleTimestamp", reason: "impossible_timestamp", cap: 19, penalty: 60 },
  { signal: "issuerUnauthorized", reason: "issuer_unauthorized", cap: 29, penalty: 35 },
  { signal: "consentInvalid", reason: "consent_invalid", cap: 39, penalty: 30 },
  { signal: "duplicateRisk", reason: "duplicate_risk", cap: 39, penalty: 35 },
  { signal: "abnormalIssuanceBurst", reason: "abnormal_issuance_burst", cap: 49, penalty: 25 },
  { signal: "disputeOpen", reason: "dispute_open", cap: 49, penalty: 25 },
  { signal: "communityDisputed", reason: "community_disputed", cap: 49, penalty: 20 },
  { signal: "expired", reason: "record_expired", cap: 49, penalty: 20 },
  { signal: "evidenceMissing", reason: "evidence_missing", cap: 59, penalty: 20 },
  { signal: "issuerUnverified", reason: "issuer_unverified", cap: 69, penalty: 15 }
];

function weightedBaseScore(components: NormalizedComponents) {
  return (
    components.identityConfidence * 0.25 +
    components.issuerTrust * 0.2 +
    components.evidenceStrength * 0.15 +
    components.consistencyScore * 0.15 +
    components.domainReputation * 0.1 +
    components.recencyScore * 0.1 +
    components.communityValidation * 0.05
  );
}

function calculateAnomalyScore(signals: TrustAnomalySignals = {}) {
  let anomalyScore = 0;

  if ((signals.duplicateIdentityMatches ?? 0) > 0) {
    anomalyScore += Math.min(35, 20 + (signals.duplicateIdentityMatches ?? 0) * 5);
  }

  if ((signals.recentIssuerIssueCount ?? 0) > 200) {
    anomalyScore += 35;
  } else if ((signals.recentIssuerIssueCount ?? 0) > 50) {
    anomalyScore += 15;
  }

  if ((signals.issuerRevocationRate ?? 0) >= 0.15) {
    anomalyScore += 30;
  } else if ((signals.issuerRevocationRate ?? 0) >= 0.05) {
    anomalyScore += 12;
  }

  if ((signals.issuerDisputeRate ?? 0) >= 0.12) {
    anomalyScore += 30;
  } else if ((signals.issuerDisputeRate ?? 0) >= 0.04) {
    anomalyScore += 12;
  }

  if ((signals.subjectRecordConflictCount ?? 0) > 0) {
    anomalyScore += Math.min(30, 15 + (signals.subjectRecordConflictCount ?? 0) * 5);
  }

  if (signals.templateMismatch) anomalyScore += 30;
  if (signals.deviceInconsistent) anomalyScore += 20;
  if (signals.geofenceRisk === "high") anomalyScore += 25;
  if (signals.geofenceRisk === "medium") anomalyScore += 8;
  if (signals.offlineCache) anomalyScore += 6;

  return clamp(anomalyScore);
}

function confidenceScore(components: NormalizedComponents, anomalyScore: number, activeGuardrailCount: number, offlineCache?: boolean) {
  const values = Object.values(components);
  const coverage = (values.filter((value) => value > 0).length / values.length) * 100;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const agreement = clamp(100 - Math.sqrt(variance) * 1.6);
  const uncertaintyPenalty = activeGuardrailCount * 7 + anomalyScore * 0.25 + (offlineCache ? 8 : 0);

  return round(clamp(coverage * 0.55 + agreement * 0.45 - uncertaintyPenalty));
}

function riskLevelFor(score: number, scoreCap: number, anomalyScore: number, reviewRequired: boolean): TrustRiskLevel {
  if (score <= 29 || scoreCap <= 29 || anomalyScore >= 90) return "critical";
  if (score < 50 || scoreCap <= 49 || anomalyScore >= 70 || reviewRequired) return "high";
  if (score < 70 || anomalyScore >= 40) return "medium";
  return "low";
}

export function calculateTrustScore(input: TrustScoreInput): TrustScoreResult {
  const components: NormalizedComponents = {
    identityConfidence: normalizeScore(input.identityConfidence),
    issuerTrust: normalizeScore(input.issuerTrust),
    evidenceStrength: normalizeScore(input.evidenceStrength),
    consistencyScore: normalizeScore(input.consistencyScore),
    domainReputation: normalizeScore(input.domainReputation),
    recencyScore: normalizeScore(input.recencyScore),
    communityValidation: normalizeScore(input.communityValidation)
  };
  const reasons: TrustScoreReason[] = ["weighted_score"];
  const baseScore = weightedBaseScore(components);
  let scoreCap = 100;
  let penalty = normalizeScore(input.fraudPenalty ?? 0) + normalizeScore(input.disputePenalty ?? 0);
  let activeGuardrailCount = 0;

  for (const guardrail of guardrails) {
    if (input.criticalSignals?.[guardrail.signal]) {
      activeGuardrailCount += 1;
      scoreCap = Math.min(scoreCap, guardrail.cap);
      penalty += guardrail.penalty;
      reasons.push(guardrail.reason);
    }
  }

  const anomalyScore = calculateAnomalyScore(input.anomalySignals);

  if (anomalyScore >= 40) {
    reasons.push("anomaly_pattern_detected");
    penalty += anomalyScore * 0.25;

    if (anomalyScore >= 90) {
      scoreCap = Math.min(scoreCap, 29);
    } else if (anomalyScore >= 70) {
      scoreCap = Math.min(scoreCap, 49);
    } else {
      scoreCap = Math.min(scoreCap, 69);
    }
  }

  const rawScore = clamp(baseScore - penalty);
  const score = round(Math.min(rawScore, scoreCap));
  const confidence = confidenceScore(components, anomalyScore, activeGuardrailCount, input.anomalySignals?.offlineCache);

  if (confidence < 65) reasons.push("low_prediction_confidence");

  const reviewRequired = score < 70 || confidence < 65 || activeGuardrailCount > 0 || anomalyScore >= 40;

  return {
    score,
    band: bandForScore(score),
    riskLevel: riskLevelFor(score, scoreCap, anomalyScore, reviewRequired),
    confidence,
    reviewRequired,
    reasonCodes: unique(reasons),
    components: {
      baseScore: round(baseScore),
      penalty: round(penalty),
      anomalyScore: round(anomalyScore),
      scoreCap
    }
  };
}
