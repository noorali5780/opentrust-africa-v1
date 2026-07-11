"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ClipboardCheck, Search } from "lucide-react";
import { reasonCodeMeta } from "@opentrust/core/reason-codes";
import type { DemoRecord, VerificationResult } from "./types";
import { formatDate, statusTone } from "./utils";

type IconComponent = typeof ClipboardCheck;

export function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: IconComponent }) {
  return (
    <div className="metric">
      <div className="metric-icon">
        <Icon size={20} aria-hidden />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export function TextField({
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

export function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function RecordList({ records, actions }: { records: DemoRecord[]; actions: (record: DemoRecord) => ReactNode }) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(records.slice(0, 1).map((record) => record.id)));
  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;

    return records.filter((record) =>
      [record.courseName, record.description, record.holderName, record.holderEmail, record.status, record.consentStatus]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query, records]);
  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="record-list">
      <div className="list-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" />
        </label>
        <span>{filteredRecords.length} shown</span>
      </div>

      {filteredRecords.map((record) => {
        const expanded = expandedIds.has(record.id);

        return (
          <div className="record-row" data-expanded={expanded} key={record.id}>
            <div className="record-summary">
              <div className="record-heading">
                <h3 className="record-title">{record.courseName}</h3>
                <div className="record-meta">
                  <span className="status" data-tone={statusTone(record.status)}>
                    {record.status}
                  </span>
                  <span className="status" data-tone={statusTone(record.consentStatus)}>
                    consent {record.consentStatus}
                  </span>
                </div>
              </div>

              <div className="row-actions">
                {actions(record)}
                <button className="secondary-button compact-button" type="button" onClick={() => toggleExpanded(record.id)} title={expanded ? "Minimize record" : "Expand record"}>
                  {expanded ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                  {expanded ? "Minimize" : "Expand"}
                </button>
              </div>
            </div>

            <div className="record-preview">
              <span>{record.holderName}</span>
              <span>{record.holderEmail}</span>
              <span>Issued {formatDate(record.issuedAt)}</span>
            </div>

            {expanded && (
              <div className="record-details">
                <p className="record-description">{record.description}</p>
                <div className="detail-grid">
                  <div>
                    <span>Holder</span>
                    <strong>{record.holderName}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{record.holderEmail}</strong>
                  </div>
                  <div>
                    <span>Issued</span>
                    <strong>{formatDate(record.issuedAt)}</strong>
                  </div>
                  <div>
                    <span>Expires</span>
                    <strong>{formatDate(record.expiresAt)}</strong>
                  </div>
                </div>
                {record.shareToken && (
                  <div className="detail-section">
                    <span>Share token</span>
                    <div className="token-box">{record.shareToken}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {records.length === 0 && <div className="empty">No records yet.</div>}
      {records.length > 0 && filteredRecords.length === 0 && <div className="empty">No records match this search.</div>}
    </div>
  );
}

export function VerificationPanel({ result }: { result: VerificationResult }) {
  const trustScore = typeof result.trustScore === "number" ? result.trustScore : 0;
  const confidence = typeof result.confidence === "number" ? result.confidence : undefined;

  return (
    <div className="result">
      <div className="result-main" data-valid={result.valid}>
        <div className="result-heading">
          <span className="status" data-tone={result.valid ? "good" : "bad"}>
            {result.valid ? "valid" : "review"}
          </span>
          <h3>{result.title}</h3>
        </div>
        {result.holderName && (
          <p>
            {result.holderName} holds {result.courseName} from {result.issuerName}.
          </p>
        )}
        {typeof result.trustScore === "number" && (
          <div className="trust-meter" style={{ "--score": `${trustScore}%` } as CSSProperties}>
            <div>
              <span>Trust score</span>
              <strong>{trustScore}</strong>
            </div>
            <div className="meter-track">
              <span />
            </div>
          </div>
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
            {result.riskLevel && (
              <span className="status" data-tone={result.riskLevel === "low" ? "good" : result.riskLevel === "medium" ? "warn" : "bad"}>
                {result.riskLevel} risk
              </span>
            )}
            {typeof confidence === "number" && <span>{confidence}% confidence</span>}
            {result.reviewRequired && <span>review required</span>}
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
