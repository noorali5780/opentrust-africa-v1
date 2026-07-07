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
};

export type TrustScoreResult = {
  score: number;
  band: "Highly trusted" | "Trusted" | "Needs review" | "Weak proof" | "Suspicious or invalid";
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function calculateTrustScore(input: TrustScoreInput): TrustScoreResult {
  const score = clamp(
    input.identityConfidence * 0.25 +
      input.issuerTrust * 0.2 +
      input.evidenceStrength * 0.15 +
      input.consistencyScore * 0.15 +
      input.domainReputation * 0.1 +
      input.recencyScore * 0.1 +
      input.communityValidation * 0.05 -
      (input.fraudPenalty ?? 0) -
      (input.disputePenalty ?? 0)
  );

  return {
    score: Math.round(score),
    band: score >= 85 ? "Highly trusted" : score >= 70 ? "Trusted" : score >= 50 ? "Needs review" : score >= 30 ? "Weak proof" : "Suspicious or invalid"
  };
}
