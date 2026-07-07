"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  BadgeCheck,
  ClipboardCheck,
  Clock,
  FileCheck2,
  History,
  KeyRound,
  Link2,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  WifiOff
} from "lucide-react";
import { reasonCodeMeta, type ReasonCode } from "@opentrust/core/reason-codes";

type Role = "issuer" | "holder" | "verifier" | "audit";
type RecordStatus = "draft" | "issued" | "revoked" | "expired" | "disputed";
type ConsentStatus = "none" | "active" | "revoked";

type AccessEvent = {
  id: string;
  verifier: string;
  purpose: string;
  at: string;
  cacheState: "fresh" | "offline_cache";
};

type DemoRecord = {
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

type DraftRecord = {
  id: string;
  holderName: string;
  holderEmail: string;
  courseName: string;
  description: string;
  expiresAt: string;
  createdAt: string;
  attempts: number;
};

type AuditRow = {
  id: string;
  action: string;
  recordId: string | null;
  status: string;
  payloadHash: string;
  previousHash: string | null;
  anchorHash: string;
  createdAt: string;
};

type VerificationResult = {
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

type BackendMode = "checking" | "api" | "demo";

type Workspace = {
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

type ApiTrustRecord = {
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

type ApiAuditAnchor = {
  id: string;
  action: string;
  recordId: string | null;
  status: string;
  payloadHash: string;
  previousHash: string | null;
  anchorHash: string;
  createdAt: string;
};

type ApiVerificationResponse = {
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

const storageKeys = {
  records: "opentrust.records",
  drafts: "opentrust.drafts",
  audit: "opentrust.audit"
};

const today = () => new Date().toISOString();

function simpleHash(value: unknown): string {
  const source = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sha256:${(hash >>> 0).toString(16).padStart(8, "0")}${source.length.toString(16).padStart(8, "0")}`;
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function createAudit(action: string, recordId: string, status: string, payload: unknown, previousHash: string | null): AuditRow {
  const createdAt = today();
  const payloadHash = simpleHash(payload);
  const anchorHash = simpleHash({ action, recordId, status, payloadHash, previousHash, createdAt });

  return {
    id: createId("aud"),
    action,
    recordId,
    status,
    payloadHash,
    previousHash,
    anchorHash,
    createdAt
  };
}

const seededRecord: DemoRecord = {
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

const seededAudit = [
  createAudit("record_issued", seededRecord.id, seededRecord.status, seededRecord, null),
  createAudit("consent_granted", seededRecord.id, "active", { token: seededRecord.shareToken, purpose: seededRecord.consentPurpose }, simpleHash(seededRecord))
];

const defaultIssueForm = {
  holderName: "Amina Owino",
  holderEmail: "amina.owino@example.com",
  courseName: "Full-Stack Web Foundations",
  description: "Completed a verified training program with assessment and attendance evidence.",
  expiresAt: "2028-06-30"
};

function parseStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function statusTone(status: string): "good" | "warn" | "bad" {
  if (status === "issued" || status === "active" || status === "valid") return "good";
  if (status === "disputed" || status === "offline_cache") return "warn";
  return "bad";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? `Request failed with HTTP ${response.status}`);
  }

  return data;
}

function mapApiRecord(record: ApiTrustRecord, tokenByRecord: Record<string, string>): DemoRecord {
  const summary = record.publicSummaryJson;
  const activeConsent = record.consentGrants.find((consent) => consent.status === "active") ?? record.consentGrants[0];
  const status = (record.status === "revoked" || record.status === "disputed" ? record.status : "issued") satisfies RecordStatus;

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

function mapAuditRows(anchors: ApiAuditAnchor[]): AuditRow[] {
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

function mapApiVerification(response: ApiVerificationResponse): VerificationResult {
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

export function OpenTrustConsole() {
  const [activeRole, setActiveRole] = useState<Role>("issuer");
  const [records, setRecords] = useState<DemoRecord[]>([seededRecord]);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>(seededAudit);
  const [ready, setReady] = useState(false);
  const [backendMode, setBackendMode] = useState<BackendMode>("checking");
  const [backendMessage, setBackendMessage] = useState("Checking persistent API");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [shareTokensByRecord, setShareTokensByRecord] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [issueForm, setIssueForm] = useState(defaultIssueForm);
  const [verifierToken, setVerifierToken] = useState("otv_demo_certificate");
  const [verifierName, setVerifierName] = useState("Kijani Works HR");
  const [verifierPurpose, setVerifierPurpose] = useState("Verify skills certificate");
  const [offlineVerification, setOfflineVerification] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  useEffect(() => {
    setRecords(parseStored(storageKeys.records, [seededRecord]));
    setDrafts(parseStored(storageKeys.drafts, []));
    setAuditRows(parseStored(storageKeys.audit, seededAudit));
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      setVerifierToken(token);
      setActiveRole("verifier");
    }
    setReady(true);
    void loadApiData();
  }, []);

  useEffect(() => {
    if (!ready || backendMode === "api" || typeof window === "undefined") return;
    window.localStorage.setItem(storageKeys.records, JSON.stringify(records));
    window.localStorage.setItem(storageKeys.drafts, JSON.stringify(drafts));
    window.localStorage.setItem(storageKeys.audit, JSON.stringify(auditRows));
  }, [auditRows, backendMode, drafts, ready, records]);

  const metrics = useMemo(
    () => ({
      issued: records.filter((record) => record.status === "issued").length,
      revoked: records.filter((record) => record.status === "revoked").length,
      disputes: records.filter((record) => record.disputeStatus === "open").length,
      verifications: records.reduce((total, record) => total + record.accessHistory.length, 0)
    }),
    [records]
  );

  function appendAudit(action: string, recordId: string, status: string, payload: unknown) {
    setAuditRows((current) => {
      const previousHash = current.at(-1)?.anchorHash ?? null;
      return [createAudit(action, recordId, status, payload, previousHash), ...current];
    });
  }

  async function loadApiData(nextTokens = shareTokensByRecord) {
    try {
      const bootstrap = await apiJson<Workspace>("/api/v1/bootstrap", { method: "POST" });
      const [recordsResponse, auditResponse] = await Promise.all([
        apiJson<{ records: ApiTrustRecord[] }>("/api/v1/records"),
        apiJson<{ anchors: ApiAuditAnchor[] }>("/api/v1/audit")
      ]);

      setWorkspace(bootstrap);
      setRecords(recordsResponse.records.map((record) => mapApiRecord(record, nextTokens)));
      setAuditRows(mapAuditRows(auditResponse.anchors));
      setBackendMode("api");
      setBackendMessage("Persistent API connected");
      return true;
    } catch (error) {
      setBackendMode("demo");
      setBackendMessage(error instanceof Error ? `Using local demo mode: ${error.message}` : "Using local demo mode");
      return false;
    }
  }

  function issueLocalCertificate(source = issueForm) {
    const issuedAt = today();
    const record: DemoRecord = {
      id: createId("rec"),
      holderName: source.holderName,
      holderEmail: source.holderEmail,
      courseName: source.courseName,
      description: source.description,
      issuedAt,
      expiresAt: new Date(`${source.expiresAt}T23:59:59.000Z`).toISOString(),
      status: "issued",
      disputeStatus: "none",
      signature: simpleHash({ source, issuedAt, issuer: "Nairobi Digital Skills Centre" }),
      shareToken: null,
      consentStatus: "none",
      consentPurpose: "",
      consentExpiresAt: "",
      accessHistory: []
    };

    setRecords((current) => [record, ...current]);
    appendAudit("record_issued", record.id, "issued", record);
    setIssueForm(defaultIssueForm);
  }

  async function issueCertificate(source = issueForm) {
    if (backendMode === "api" && workspace) {
      setSyncing(true);
      try {
        await apiJson("/api/v1/records", {
          method: "POST",
          body: JSON.stringify({
            issuerId: workspace.issuer.id,
            templateId: workspace.template.id,
            holderName: source.holderName,
            holderEmail: source.holderEmail,
            achievementName: source.courseName,
            achievementDescription: source.description,
            expiresAt: new Date(`${source.expiresAt}T23:59:59.000Z`).toISOString()
          })
        });
        setIssueForm(defaultIssueForm);
        await loadApiData();
        return;
      } catch (error) {
        setBackendMode("demo");
        setBackendMessage(error instanceof Error ? `API write failed, saved locally: ${error.message}` : "API write failed, saved locally");
      } finally {
        setSyncing(false);
      }
    }

    issueLocalCertificate(source);
  }

  function saveDraft() {
    const draft: DraftRecord = {
      id: createId("draft"),
      ...issueForm,
      createdAt: today(),
      attempts: 0
    };
    setDrafts((current) => [draft, ...current]);
  }

  async function syncDrafts() {
    if (drafts.length === 0) return;

    if (backendMode === "api" && workspace) {
      setSyncing(true);
      try {
        for (const draft of drafts.slice().reverse()) {
          await apiJson("/api/v1/records", {
            method: "POST",
            body: JSON.stringify({
              issuerId: workspace.issuer.id,
              templateId: workspace.template.id,
              holderName: draft.holderName,
              holderEmail: draft.holderEmail,
              achievementName: draft.courseName,
              achievementDescription: draft.description,
              expiresAt: new Date(`${draft.expiresAt}T23:59:59.000Z`).toISOString()
            })
          });
        }
        setDrafts([]);
        await loadApiData();
        return;
      } catch (error) {
        setDrafts((current) =>
          current.map((draft) => ({
            ...draft,
            attempts: draft.attempts + 1
          }))
        );
        setBackendMessage(error instanceof Error ? `Draft sync failed: ${error.message}` : "Draft sync failed");
      } finally {
        setSyncing(false);
      }
    }

    drafts
      .slice()
      .reverse()
      .forEach((draft) => {
        issueLocalCertificate(draft);
      });
    setDrafts([]);
  }

  async function createShareLink(recordId: string) {
    if (backendMode === "api") {
      setSyncing(true);
      try {
        const response = await apiJson<{ shareLink: { token: string } }>("/api/v1/consents", {
          method: "POST",
          body: JSON.stringify({
            recordId,
            mode: "verify_only",
            purpose: "Employer certificate verification",
            audience: "Any employer with this link",
            expiresAt: "2026-12-31T23:59:59.000Z"
          })
        });
        const nextTokens = { ...shareTokensByRecord, [recordId]: response.shareLink.token };
        setShareTokensByRecord(nextTokens);
        setVerifierToken(response.shareLink.token);
        await loadApiData(nextTokens);
        return;
      } catch (error) {
        setBackendMode("demo");
        setBackendMessage(error instanceof Error ? `API share failed, using local link: ${error.message}` : "API share failed, using local link");
      } finally {
        setSyncing(false);
      }
    }

    const token = `otv_${Math.random().toString(36).slice(2, 12)}`;
    setRecords((current) =>
      current.map((record) =>
        record.id === recordId
          ? {
              ...record,
              shareToken: token,
              consentStatus: "active",
              consentPurpose: "Employer certificate verification",
              consentExpiresAt: "2026-12-31T23:59:59.000Z"
            }
          : record
      )
    );
    setVerifierToken(token);
    appendAudit("consent_granted", recordId, "active", { token, mode: "verify_only" });
  }

  async function revokeShare(recordId: string) {
    if (backendMode === "api") {
      setSyncing(true);
      try {
        await apiJson(`/api/v1/records/${encodeURIComponent(recordId)}/consents/revoke`, {
          method: "POST"
        });
        const nextTokens = { ...shareTokensByRecord };
        delete nextTokens[recordId];
        setShareTokensByRecord(nextTokens);
        await loadApiData(nextTokens);
        return;
      } catch (error) {
        setBackendMessage(error instanceof Error ? `Access revoke failed: ${error.message}` : "Access revoke failed");
      } finally {
        setSyncing(false);
      }
    }

    setRecords((current) => current.map((record) => (record.id === recordId ? { ...record, consentStatus: "revoked" } : record)));
    appendAudit("consent_revoked", recordId, "revoked", { mode: "verify_only" });
  }

  async function revokeRecord(recordId: string) {
    if (backendMode === "api" && workspace) {
      setSyncing(true);
      try {
        await apiJson(`/api/v1/records/${encodeURIComponent(recordId)}/revoke`, {
          method: "POST",
          body: JSON.stringify({
            issuerId: workspace.issuer.id,
            reason: "Issuer revoked test record",
            reasonCode: "record_revoked"
          })
        });
        await loadApiData();
        return;
      } catch (error) {
        setBackendMessage(error instanceof Error ? `Record revoke failed: ${error.message}` : "Record revoke failed");
      } finally {
        setSyncing(false);
      }
    }

    setRecords((current) => current.map((record) => (record.id === recordId ? { ...record, status: "revoked" } : record)));
    appendAudit("record_revoked", recordId, "revoked", { reason: "Issuer revoked test record" });
  }

  async function openDispute(recordId: string) {
    const record = records.find((item) => item.id === recordId);

    if (backendMode === "api") {
      setSyncing(true);
      try {
        await apiJson(`/api/v1/records/${encodeURIComponent(recordId)}/disputes`, {
          method: "POST",
          body: JSON.stringify({
            holderId: record?.holderId,
            openedByEmail: record?.holderEmail,
            reason: "Holder requested correction or review"
          })
        });
        await loadApiData();
        return;
      } catch (error) {
        setBackendMessage(error instanceof Error ? `Dispute failed: ${error.message}` : "Dispute failed");
      } finally {
        setSyncing(false);
      }
    }

    setRecords((current) =>
      current.map((record) => (record.id === recordId ? { ...record, status: "disputed", disputeStatus: "open" } : record))
    );
    appendAudit("dispute_opened", recordId, "open", { reason: "Holder requested correction or review" });
  }

  async function verifyToken() {
    if (backendMode === "api") {
      setSyncing(true);
      try {
        const query = new URLSearchParams({
          verifier: verifierName,
          purpose: verifierPurpose,
          offlineCache: String(offlineVerification)
        });
        const response = await apiJson<ApiVerificationResponse>(`/api/v1/verify/${encodeURIComponent(verifierToken.trim())}?${query}`);
        setVerification(mapApiVerification(response));
        await loadApiData();
        return;
      } catch (error) {
        setVerification({
          valid: false,
          title: "Share link not found",
          status: "not_found",
          reasonCodes: ["consent_expired", "signature_invalid"],
          cacheState: offlineVerification ? "offline_cache" : "fresh"
        });
        setBackendMessage(error instanceof Error ? `Verification API failed: ${error.message}` : "Verification API failed");
      } finally {
        setSyncing(false);
      }
    }

    const record = records.find((item) => item.shareToken === verifierToken.trim());
    const verifiedAt = today();

    if (!record) {
      setVerification({
        valid: false,
        title: "Share link not found",
        status: "not_found",
        reasonCodes: ["consent_expired", "signature_invalid"],
        cacheState: offlineVerification ? "offline_cache" : "fresh"
      });
      return;
    }

    const consentExpired = record.consentStatus !== "active" || new Date(record.consentExpiresAt).getTime() < Date.now();
    const revoked = record.status === "revoked";
    const disputed = record.disputeStatus === "open";
    const valid = !consentExpired && !revoked && !disputed;
    const reasonCodes: ReasonCode[] = ["issuer_verified", "signature_valid", "identity_confirmed"];

    reasonCodes.push(consentExpired ? "consent_expired" : "consent_valid");
    if (revoked) reasonCodes.push("record_revoked");
    if (disputed) reasonCodes.push("dispute_open");
    if (offlineVerification) reasonCodes.push("verification_offline_cache");

    const accessEvent: AccessEvent = {
      id: createId("acc"),
      verifier: verifierName || "Unnamed verifier",
      purpose: verifierPurpose || "Verification request",
      at: verifiedAt,
      cacheState: offlineVerification ? "offline_cache" : "fresh"
    };

    setRecords((current) =>
      current.map((item) => (item.id === record.id ? { ...item, accessHistory: [accessEvent, ...item.accessHistory] } : item))
    );
    appendAudit("record_verified", record.id, valid ? "valid" : record.status, { verifierName, verifierPurpose, reasonCodes });

    setVerification({
      valid,
      title: valid ? "Certificate verified" : "Certificate needs review",
      status: consentExpired ? "consent_expired" : record.status,
      holderName: record.holderName,
      courseName: record.courseName,
      issuerName: "Nairobi Digital Skills Centre",
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      reasonCodes,
      cacheState: offlineVerification ? "offline_cache" : "fresh",
      trustScore: valid ? 88 : revoked ? 12 : 54,
      band: valid ? "Highly trusted" : revoked ? "Suspicious or invalid" : "Needs review"
    });
  }

  const currentShareTokens = records.filter((record) => record.shareToken).map((record) => record.shareToken as string);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">OT</div>
            <div>
              <h1>OpenTrust Africa Foundation MVP</h1>
              <p>Issuer, holder, verifier, consent, dispute, and audit loop</p>
            </div>
          </div>

          <nav className="tabs" aria-label="Workspace views">
            <RoleTab role="issuer" activeRole={activeRole} onSelect={setActiveRole} icon={ClipboardCheck} label="Issuer" />
            <RoleTab role="holder" activeRole={activeRole} onSelect={setActiveRole} icon={UserRoundCheck} label="Holder" />
            <RoleTab role="verifier" activeRole={activeRole} onSelect={setActiveRole} icon={ScanLine} label="Verifier" />
            <RoleTab role="audit" activeRole={activeRole} onSelect={setActiveRole} icon={History} label="Audit" />
          </nav>
        </div>
      </header>

      <main className="main">
        <section className="mode-banner" data-mode={backendMode}>
          <div>
            <strong>{backendMode === "api" ? "Persistent mode" : backendMode === "checking" ? "Connecting" : "Local demo mode"}</strong>
            <span>{backendMessage}</span>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadApiData()} disabled={syncing} title="Reconnect persistent API">
            <RefreshCw size={18} aria-hidden />
            Reconnect
          </button>
        </section>

        <section className="summary-grid" aria-label="MVP metrics">
          <Metric label="Issued records" value={metrics.issued} icon={FileCheck2} />
          <Metric label="Verifications" value={metrics.verifications} icon={BadgeCheck} />
          <Metric label="Open disputes" value={metrics.disputes} icon={ShieldAlert} />
          <Metric label="Revoked records" value={metrics.revoked} icon={RotateCcw} />
        </section>

        {activeRole === "issuer" && renderIssuer()}
        {activeRole === "holder" && renderHolder()}
        {activeRole === "verifier" && renderVerifier()}
        {activeRole === "audit" && renderAudit()}
      </main>
    </div>
  );

  function renderIssuer() {
    return (
      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <ClipboardCheck size={22} aria-hidden />
              <div>
                <h2>Issue certificate</h2>
                <p>Nairobi Digital Skills Centre</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <TextField label="Holder name" value={issueForm.holderName} onChange={(holderName) => setIssueForm({ ...issueForm, holderName })} />
              <TextField label="Holder email" value={issueForm.holderEmail} onChange={(holderEmail) => setIssueForm({ ...issueForm, holderEmail })} />
              <TextField label="Certificate title" value={issueForm.courseName} onChange={(courseName) => setIssueForm({ ...issueForm, courseName })} />
              <TextArea label="Evidence summary" value={issueForm.description} onChange={(description) => setIssueForm({ ...issueForm, description })} />
              <TextField label="Expires on" type="date" value={issueForm.expiresAt} onChange={(expiresAt) => setIssueForm({ ...issueForm, expiresAt })} />
              <div className="button-row">
                <button className="primary-button" type="button" onClick={() => void issueCertificate()} disabled={syncing} title="Issue certificate">
                  <FileCheck2 size={18} aria-hidden />
                  Issue
                </button>
                <button className="secondary-button" type="button" onClick={saveDraft} disabled={syncing} title="Save draft for delayed sync">
                  <WifiOff size={18} aria-hidden />
                  Save draft
                </button>
                <button className="secondary-button" type="button" onClick={() => void syncDrafts()} disabled={drafts.length === 0 || syncing} title="Sync queued drafts">
                  <RefreshCw size={18} aria-hidden />
                  Sync {drafts.length}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Archive size={22} aria-hidden />
              <div>
                <h2>Issued records</h2>
                <p>Certificate status, revocation, and disputes</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <RecordList
              records={records}
              actions={(record) => (
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={() => void createShareLink(record.id)} disabled={syncing} title="Create verify-only link">
                    <Link2 size={18} aria-hidden />
                    Share
                  </button>
                  <button className="danger-button" type="button" onClick={() => void revokeRecord(record.id)} disabled={record.status === "revoked" || syncing} title="Revoke record">
                    <RotateCcw size={18} aria-hidden />
                    Revoke
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      </section>
    );
  }

  function renderHolder() {
    return (
      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <KeyRound size={22} aria-hidden />
              <div>
                <h2>Trust Passport</h2>
                <p>Holder-controlled records and access</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <RecordList
              records={records}
              actions={(record) => (
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={() => void createShareLink(record.id)} disabled={syncing} title="Grant verify-only access">
                    <LockKeyhole size={18} aria-hidden />
                    Grant
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void revokeShare(record.id)} disabled={record.consentStatus !== "active" || syncing} title="Revoke access">
                    <RotateCcw size={18} aria-hidden />
                    Access
                  </button>
                  <button className="danger-button" type="button" onClick={() => void openDispute(record.id)} disabled={record.disputeStatus === "open" || syncing} title="Open dispute">
                    <ShieldAlert size={18} aria-hidden />
                    Dispute
                  </button>
                </div>
              )}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <History size={22} aria-hidden />
              <div>
                <h2>Access history</h2>
                <p>Who checked records and why</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="access-list">
              {records.flatMap((record) =>
                record.accessHistory.map((access) => (
                  <div className="access-row" key={access.id}>
                    <strong>{access.verifier}</strong>
                    <span>{access.purpose}</span>
                    <div className="record-meta">
                      <span>{record.courseName}</span>
                      <span>{formatDate(access.at)}</span>
                      <span className="status" data-tone={statusTone(access.cacheState)}>
                        {access.cacheState}
                      </span>
                    </div>
                  </div>
                ))
              )}
              {records.every((record) => record.accessHistory.length === 0) && <div className="empty">No access events yet.</div>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderVerifier() {
    return (
      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <ScanLine size={22} aria-hidden />
              <div>
                <h2>Verify certificate</h2>
                <p>Verify-only disclosure by token</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <TextField label="Verifier" value={verifierName} onChange={setVerifierName} />
              <TextField label="Purpose" value={verifierPurpose} onChange={setVerifierPurpose} />
              <TextField label="Share token" value={verifierToken} onChange={setVerifierToken} />
              <label className="switch-line">
                <input type="checkbox" checked={offlineVerification} onChange={(event) => setOfflineVerification(event.target.checked)} />
                Use offline verification cache
              </label>
              <div className="button-row">
                <button className="primary-button" type="button" onClick={() => void verifyToken()} disabled={syncing} title="Verify token">
                  <ShieldCheck size={18} aria-hidden />
                  Verify
                </button>
                {currentShareTokens.map((token) => (
                  <button className="secondary-button" key={token} type="button" onClick={() => setVerifierToken(token)} title="Use active token">
                    <Link2 size={18} aria-hidden />
                    Token
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <ListChecks size={22} aria-hidden />
              <div>
                <h2>Verification result</h2>
                <p>Minimal disclosure with reason codes</p>
              </div>
            </div>
          </div>
          <div className="panel-body">{verification ? <VerificationPanel result={verification} /> : <div className="empty">Submit a token to verify a certificate.</div>}</div>
        </div>
      </section>
    );
  }

  function renderAudit() {
    return (
      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <History size={22} aria-hidden />
              <div>
                <h2>Audit anchors</h2>
                <p>Hashes, status, versions, and previous links</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="audit-list">
              {auditRows.map((row) => (
                <div className="audit-row" key={row.id}>
                  <div className="record-meta">
                    <span className="status" data-tone={statusTone(row.status)}>
                      {row.status}
                    </span>
                    <strong>{row.action}</strong>
                    <span>{formatDate(row.createdAt)}</span>
                  </div>
                  <div className="hash-box">{row.anchorHash}</div>
                  <div className="audit-meta">
                    <span>Record {row.recordId}</span>
                    <span>Payload {row.payloadHash}</span>
                    <span>Previous {row.previousHash ?? "chain-start"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Clock size={22} aria-hidden />
              <div>
                <h2>Offline queue</h2>
                <p>Drafts waiting for connectivity</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="record-list">
              {drafts.map((draft) => (
                <div className="record-row" key={draft.id}>
                  <div>
                    <h3 className="record-title">{draft.courseName}</h3>
                    <div className="record-meta">
                      <span>{draft.holderName}</span>
                      <span>{formatDate(draft.createdAt)}</span>
                      <span className="status" data-tone="warn">
                        queued
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {drafts.length === 0 && <div className="empty">No queued drafts.</div>}
            </div>
          </div>
        </div>
      </section>
    );
  }
}

function RoleTab({
  role,
  activeRole,
  onSelect,
  icon: Icon,
  label
}: {
  role: Role;
  activeRole: Role;
  onSelect: (role: Role) => void;
  icon: typeof ClipboardCheck;
  label: string;
}) {
  return (
    <button className="tab" type="button" data-active={activeRole === role} onClick={() => onSelect(role)} title={label}>
      <Icon size={17} aria-hidden />
      {label}
    </button>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ClipboardCheck }) {
  return (
    <div className="metric">
      <Icon size={20} aria-hidden />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function RecordList({
  records,
  actions
}: {
  records: DemoRecord[];
  actions: (record: DemoRecord) => ReactNode;
}) {
  return (
    <div className="record-list">
      {records.map((record) => (
        <div className="record-row" key={record.id}>
          <div>
            <h3 className="record-title">{record.courseName}</h3>
            <p>{record.description}</p>
            <div className="record-meta">
              <span>{record.holderName}</span>
              <span>{record.holderEmail}</span>
              <span>Issued {formatDate(record.issuedAt)}</span>
              <span>Expires {formatDate(record.expiresAt)}</span>
              <span className="status" data-tone={statusTone(record.status)}>
                {record.status}
              </span>
              <span className="status" data-tone={statusTone(record.consentStatus)}>
                consent {record.consentStatus}
              </span>
            </div>
            {record.shareToken && <div className="token-box">{record.shareToken}</div>}
          </div>
          {actions(record)}
        </div>
      ))}
    </div>
  );
}

function VerificationPanel({ result }: { result: VerificationResult }) {
  return (
    <div className="result">
      <div className="result-main" data-valid={result.valid}>
        <span className="status" data-tone={result.valid ? "good" : "bad"}>
          {result.valid ? "valid" : "review"}
        </span>
        <h3>{result.title}</h3>
        {result.holderName && (
          <p>
            {result.holderName} holds {result.courseName} from {result.issuerName}.
          </p>
        )}
        {result.issuedAt && result.expiresAt && (
          <div className="record-meta">
            <span>Issued {formatDate(result.issuedAt)}</span>
            <span>Expires {formatDate(result.expiresAt)}</span>
            <span className="status" data-tone={statusTone(result.cacheState)}>
              {result.cacheState}
            </span>
            {typeof result.trustScore === "number" && <span>{result.trustScore} trust score</span>}
            {result.band && <span>{result.band}</span>}
          </div>
        )}
      </div>

      <div className="reason-list">
        {result.reasonCodes.map((code) => (
          <span className="reason-code" data-tone={reasonCodeMeta[code].sentiment} title={reasonCodeMeta[code].label} key={code}>
            {code}
          </span>
        ))}
      </div>
    </div>
  );
}
