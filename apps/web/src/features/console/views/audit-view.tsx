"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, History } from "lucide-react";
import { useConsole } from "../console-context";
import { formatDate, statusTone } from "../utils";

export function AuditView() {
  const { auditRows, drafts } = useConsole();
  const [expandedAuditIds, setExpandedAuditIds] = useState<Set<string>>(() => new Set(auditRows.slice(0, 1).map((row) => row.id)));
  const [expandedDraftIds, setExpandedDraftIds] = useState<Set<string>>(new Set());
  const toggleAudit = (id: string) => {
    setExpandedAuditIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleDraft = (id: string) => {
    setExpandedDraftIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
              <div className="audit-row" data-expanded={expandedAuditIds.has(row.id)} key={row.id}>
                <div className="data-row-summary">
                  <div>
                    <div className="record-meta">
                      <span className="status" data-tone={statusTone(row.status)}>
                        {row.status}
                      </span>
                      <strong>{row.action}</strong>
                      <span>{formatDate(row.createdAt)}</span>
                    </div>
                    <p>Record {row.recordId ?? "system"}</p>
                  </div>
                  <button className="secondary-button compact-button" type="button" onClick={() => toggleAudit(row.id)} title={expandedAuditIds.has(row.id) ? "Minimize audit row" : "Expand audit row"}>
                    {expandedAuditIds.has(row.id) ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                    {expandedAuditIds.has(row.id) ? "Minimize" : "Expand"}
                  </button>
                </div>
                {expandedAuditIds.has(row.id) && (
                  <div className="record-details">
                    <div className="detail-section">
                      <span>Anchor hash</span>
                      <div className="hash-box">{row.anchorHash}</div>
                    </div>
                    <div className="detail-grid">
                      <div>
                        <span>Payload hash</span>
                        <strong>{row.payloadHash}</strong>
                      </div>
                      <div>
                        <span>Previous hash</span>
                        <strong>{row.previousHash ?? "chain-start"}</strong>
                      </div>
                    </div>
                  </div>
                )}
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
              <div className="record-row" data-expanded={expandedDraftIds.has(draft.id)} key={draft.id}>
                <div className="record-summary">
                  <h3 className="record-title">{draft.courseName}</h3>
                  <div className="row-actions">
                    <button className="secondary-button compact-button" type="button" onClick={() => toggleDraft(draft.id)} title={expandedDraftIds.has(draft.id) ? "Minimize draft" : "Expand draft"}>
                      {expandedDraftIds.has(draft.id) ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                      {expandedDraftIds.has(draft.id) ? "Minimize" : "Expand"}
                    </button>
                  </div>
                </div>
                <div className="record-preview">
                  <span>{draft.holderName}</span>
                  <span>{formatDate(draft.createdAt)}</span>
                  <span className="status" data-tone="warn">
                    queued
                  </span>
                </div>
                {expandedDraftIds.has(draft.id) && (
                  <div className="record-details">
                    <p className="record-description">{draft.description}</p>
                    <div className="detail-grid">
                      <div>
                        <span>Holder</span>
                        <strong>{draft.holderName}</strong>
                      </div>
                      <div>
                        <span>Email</span>
                        <strong>{draft.holderEmail}</strong>
                      </div>
                      <div>
                        <span>Attempts</span>
                        <strong>{draft.attempts}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>Queued</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {drafts.length === 0 && <div className="empty">No queued drafts.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
