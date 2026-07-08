import type { ReasonCode } from "@opentrust/core/reason-codes";

export type ConsoleRole = "issuer" | "holder" | "verifier" | "sentinel" | "audit";
export type RecordStatus = "draft" | "issued" | "revoked" | "expired" | "disputed";
export type ConsentStatus = "none" | "active" | "revoked";
export type BackendMode = "checking" | "api" | "demo";
export type GpsStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "error";
export type SentinelEventStatus = "inside_geofence" | "nearby" | "outside_geofence" | "gps_unavailable";
export type SentinelRiskLevel = "low" | "medium" | "high";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type GpsFix = GeoPoint & {
  accuracyMeters: number;
  capturedAt: string;
  source: "device_gps" | "demo_location";
};

export type SentinelSite = GeoPoint & {
  id: string;
  name: string;
  category: "issuer_site" | "training_site" | "verifier_site";
  radiusMeters: number;
  address: string;
};

export type SentinelEvent = GeoPoint & {
  id: string;
  siteId: string;
  siteName: string;
  status: SentinelEventStatus;
  riskLevel: SentinelRiskLevel;
  distanceMeters: number;
  radiusMeters: number;
  accuracyMeters: number;
  source: GpsFix["source"];
  capturedAt: string;
  reasonCodes: string[];
};

export type AccessEvent = {
  id: string;
  verifier: string;
  purpose: string;
  at: string;
  cacheState: "fresh" | "offline_cache";
};

export type DemoRecord = {
  id: string;
  issuerId?: string;
  holderId?: string;
  activeConsentId?: string;
  holderName: string;
  holderEmail: string;
  courseName: string;
  description: string;
  issuedAt: string;
  expiresAt: string;
  status: RecordStatus;
  disputeStatus: "none" | "open";
  signature: string;
  shareToken: string | null;
  consentStatus: ConsentStatus;
  consentPurpose: string;
  consentExpiresAt: string;
  accessHistory: AccessEvent[];
};

export type IssueForm = {
  holderName: string;
  holderEmail: string;
  courseName: string;
  description: string;
  expiresAt: string;
};

export type DraftRecord = IssueForm & {
  id: string;
  createdAt: string;
  attempts: number;
};

export type AuditRow = {
  id: string;
  action: string;
  recordId: string | null;
  status: string;
  payloadHash: string;
  previousHash: string | null;
  anchorHash: string;
  createdAt: string;
};

export type VerificationResult = {
  valid: boolean;
  title: string;
  status: RecordStatus | "not_found" | "consent_expired";
  holderName?: string;
  courseName?: string;
  issuerName?: string;
  issuedAt?: string;
  expiresAt?: string;
  reasonCodes: ReasonCode[];
  cacheState: "fresh" | "offline_cache";
  trustScore?: number;
  band?: string;
};

export type Workspace = {
  issuer: {
    id: string;
    name: string;
    verified: boolean;
  };
  template: {
    id: string;
    name: string;
    type: string;
  };
};

export type ApiTrustRecord = {
  id: string;
  type: string;
  status: string;
  issuerId: string;
  holderId: string;
  publicSummaryJson: {
    holderName?: string;
    achievementName?: string;
    achievementDescription?: string;
    issuedAt?: string;
    expiresAt?: string;
    revokedAt?: string;
    disputeStatus?: "none" | "open";
  };
  signature: string;
  issuedAt: string;
  expiresAt: string | null;
  disputeState: string;
  issuer: {
    id: string;
    name: string;
    verified: boolean;
  };
  holder: {
    id: string;
    displayName: string;
    email: string;
  };
  consentGrants: Array<{
    id: string;
    mode: string;
    purpose: string;
    status: string;
    expiresAt: string | null;
  }>;
  verificationEvents: Array<{
    id: string;
    verifierReference: string | null;
    purpose: string | null;
    createdAt: string;
    cached: boolean;
  }>;
};

export type ApiAuditAnchor = {
  id: string;
  action: string;
  recordId: string | null;
  status: string;
  payloadHash: string;
  previousHash: string | null;
  anchorHash: string;
  createdAt: string;
};

export type ApiVerificationResponse = {
  valid: boolean;
  status: RecordStatus;
  issuer: {
    name: string;
  };
  summary: {
    holderName: string;
    achievementName: string;
    issuedAt: string;
    expiresAt?: string;
  };
  reasonCodes: ReasonCode[];
  trustScore?: {
    score: number;
    band: string;
  };
  cacheState: "fresh" | "offline_cache";
};

export type ConsoleMetrics = {
  issued: number;
  revoked: number;
  disputes: number;
  verifications: number;
};
