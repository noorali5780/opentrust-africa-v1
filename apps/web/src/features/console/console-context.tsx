"use client";

import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { ReasonCode } from "@opentrust/core/reason-codes";
import { apiJson } from "./api";
import { defaultIssueForm, mapApiRecord, mapApiVerification, mapAuditRows, seededAudit, seededRecord, seededSentinelEvents, sentinelSites, storageKeys } from "./data";
import { createSentinelEvent } from "./sentinel";
import type {
  AccessEvent,
  ApiAuditAnchor,
  ApiTrustRecord,
  ApiVerificationResponse,
  AuditRow,
  BackendMode,
  ConsoleMetrics,
  DemoRecord,
  DraftRecord,
  GpsFix,
  GpsStatus,
  IssueForm,
  SentinelEvent,
  SentinelSite,
  VerificationResult,
  Workspace
} from "./types";
import { createAudit, createId, parseStored, simpleHash, today } from "./utils";

type ConsoleContextValue = {
  records: DemoRecord[];
  drafts: DraftRecord[];
  auditRows: AuditRow[];
  sentinelSites: SentinelSite[];
  sentinelEvents: SentinelEvent[];
  gpsStatus: GpsStatus;
  gpsMessage: string;
  currentGpsFix: GpsFix | null;
  selectedSentinelSiteId: string;
  setSelectedSentinelSiteId: Dispatch<SetStateAction<string>>;
  backendMode: BackendMode;
  backendMessage: string;
  syncing: boolean;
  metrics: ConsoleMetrics;
  issueForm: IssueForm;
  setIssueForm: Dispatch<SetStateAction<IssueForm>>;
  verifierToken: string;
  setVerifierToken: Dispatch<SetStateAction<string>>;
  verifierName: string;
  setVerifierName: Dispatch<SetStateAction<string>>;
  verifierPurpose: string;
  setVerifierPurpose: Dispatch<SetStateAction<string>>;
  offlineVerification: boolean;
  setOfflineVerification: Dispatch<SetStateAction<boolean>>;
  verification: VerificationResult | null;
  currentShareTokens: string[];
  loadApiData: () => Promise<boolean>;
  issueCertificate: () => Promise<void>;
  saveDraft: () => void;
  syncDrafts: () => Promise<void>;
  createShareLink: (recordId: string) => Promise<void>;
  revokeShare: (recordId: string) => Promise<void>;
  revokeRecord: (recordId: string) => Promise<void>;
  openDispute: (recordId: string) => Promise<void>;
  verifyToken: () => Promise<void>;
  requestGpsFix: () => void;
  useDemoGpsFix: () => void;
  runSentinelCheck: () => void;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<DemoRecord[]>([seededRecord]);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>(seededAudit);
  const [sentinelEvents, setSentinelEvents] = useState<SentinelEvent[]>(seededSentinelEvents);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gpsMessage, setGpsMessage] = useState("GPS not requested");
  const [currentGpsFix, setCurrentGpsFix] = useState<GpsFix | null>(null);
  const [selectedSentinelSiteId, setSelectedSentinelSiteId] = useState(sentinelSites[0]?.id ?? "");
  const [ready, setReady] = useState(false);
  const [backendMode, setBackendMode] = useState<BackendMode>("checking");
  const [backendMessage, setBackendMessage] = useState("Checking persistent API");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [shareTokensByRecord, setShareTokensByRecord] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [issueForm, setIssueForm] = useState<IssueForm>(defaultIssueForm);
  const [verifierToken, setVerifierToken] = useState("otv_demo_certificate");
  const [verifierName, setVerifierName] = useState("Kijani Works HR");
  const [verifierPurpose, setVerifierPurpose] = useState("Verify skills certificate");
  const [offlineVerification, setOfflineVerification] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  useEffect(() => {
    setRecords(parseStored(storageKeys.records, [seededRecord]));
    setDrafts(parseStored(storageKeys.drafts, []));
    setAuditRows(parseStored(storageKeys.audit, seededAudit));
    setSentinelEvents(parseStored(storageKeys.sentinel, seededSentinelEvents));
    setReady(true);
    void loadApiData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || backendMode === "api" || typeof window === "undefined") return;
    window.localStorage.setItem(storageKeys.records, JSON.stringify(records));
    window.localStorage.setItem(storageKeys.drafts, JSON.stringify(drafts));
    window.localStorage.setItem(storageKeys.audit, JSON.stringify(auditRows));
  }, [auditRows, backendMode, drafts, ready, records]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem(storageKeys.sentinel, JSON.stringify(sentinelEvents));
  }, [ready, sentinelEvents]);

  const metrics = useMemo(
    () => ({
      issued: records.filter((record) => record.status === "issued").length,
      revoked: records.filter((record) => record.status === "revoked").length,
      disputes: records.filter((record) => record.disputeStatus === "open").length,
      verifications: records.reduce((total, record) => total + record.accessHistory.length, 0)
    }),
    [records]
  );

  const currentShareTokens = useMemo(() => records.filter((record) => record.shareToken).map((record) => record.shareToken as string), [records]);

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

  async function issueCertificate() {
    if (backendMode === "api" && workspace) {
      setSyncing(true);
      try {
        await apiJson("/api/v1/records", {
          method: "POST",
          body: JSON.stringify({
            issuerId: workspace.issuer.id,
            templateId: workspace.template.id,
            holderName: issueForm.holderName,
            holderEmail: issueForm.holderEmail,
            achievementName: issueForm.courseName,
            achievementDescription: issueForm.description,
            expiresAt: new Date(`${issueForm.expiresAt}T23:59:59.000Z`).toISOString()
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

    issueLocalCertificate();
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
        setDrafts((current) => current.map((draft) => ({ ...draft, attempts: draft.attempts + 1 })));
        setBackendMessage(error instanceof Error ? `Draft sync failed: ${error.message}` : "Draft sync failed");
      } finally {
        setSyncing(false);
      }
    }

    drafts
      .slice()
      .reverse()
      .forEach((draft) => issueLocalCertificate(draft));
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
        await apiJson(`/api/v1/records/${encodeURIComponent(recordId)}/consents/revoke`, { method: "POST" });
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
      current.map((item) => (item.id === recordId ? { ...item, status: "disputed", disputeStatus: "open" } : item))
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

  function requestGpsFix() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unavailable");
      setGpsMessage("Geolocation is not available in this browser");
      return;
    }

    setGpsStatus("locating");
    setGpsMessage("Requesting device GPS");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const fix: GpsFix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
          source: "device_gps"
        };

        setCurrentGpsFix(fix);
        setGpsStatus("ready");
        setGpsMessage(`GPS ready within ${Math.round(position.coords.accuracy)}m`);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setGpsStatus(denied ? "denied" : "error");
        setGpsMessage(denied ? "GPS permission denied" : "GPS fix failed");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 12_000
      }
    );
  }

  function useDemoGpsFix() {
    const site = sentinelSites.find((item) => item.id === selectedSentinelSiteId) ?? sentinelSites[0];
    if (!site) return;

    setCurrentGpsFix({
      lat: site.lat + 0.00055,
      lng: site.lng + 0.0004,
      accuracyMeters: 42,
      capturedAt: today(),
      source: "demo_location"
    });
    setGpsStatus("ready");
    setGpsMessage("Demo GPS fix loaded");
  }

  function runSentinelCheck() {
    const site = sentinelSites.find((item) => item.id === selectedSentinelSiteId) ?? sentinelSites[0];
    if (!site) return;

    if (!currentGpsFix) {
      setGpsStatus("unavailable");
      setGpsMessage("GPS fix required before Sentinel check");
      return;
    }

    const event = createSentinelEvent(site, currentGpsFix);
    setSentinelEvents((current) => [event, ...current]);
    appendAudit("sentinel_check", event.siteId, event.status, event);
  }

  const value: ConsoleContextValue = {
    records,
    drafts,
    auditRows,
    sentinelSites,
    sentinelEvents,
    gpsStatus,
    gpsMessage,
    currentGpsFix,
    selectedSentinelSiteId,
    setSelectedSentinelSiteId,
    backendMode,
    backendMessage,
    syncing,
    metrics,
    issueForm,
    setIssueForm,
    verifierToken,
    setVerifierToken,
    verifierName,
    setVerifierName,
    verifierPurpose,
    setVerifierPurpose,
    offlineVerification,
    setOfflineVerification,
    verification,
    currentShareTokens,
    loadApiData: () => loadApiData(),
    issueCertificate,
    saveDraft,
    syncDrafts,
    createShareLink,
    revokeShare,
    revokeRecord,
    openDispute,
    verifyToken,
    requestGpsFix,
    useDemoGpsFix,
    runSentinelCheck
  };

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const context = useContext(ConsoleContext);

  if (!context) {
    throw new Error("useConsole must be used inside ConsoleProvider");
  }

  return context;
}
