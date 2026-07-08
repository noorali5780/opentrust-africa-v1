"use client";

import { Clock, History } from "lucide-react";
import { useConsole } from "../console-context";
import { formatDate, statusTone } from "../utils";

export function AuditView() {
  const { auditRows, drafts } = useConsole();

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
