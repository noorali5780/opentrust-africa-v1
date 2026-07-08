"use client";

import type { ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";
import { reasonCodeMeta } from "@opentrust/core/reason-codes";
import type { DemoRecord, VerificationResult } from "./types";
import { formatDate, statusTone } from "./utils";

type IconComponent = typeof ClipboardCheck;

export function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: IconComponent }) {
  return (
    <div className="metric">
      <Icon size={20} aria-hidden />
      <span>{label}</span>
      <strong>{value}</strong>
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

export function VerificationPanel({ result }: { result: VerificationResult }) {
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
