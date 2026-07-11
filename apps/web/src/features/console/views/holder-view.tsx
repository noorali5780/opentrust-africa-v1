"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History, KeyRound, LockKeyhole, RotateCcw, ShieldAlert } from "lucide-react";
import { useConsole } from "../console-context";
import { RecordList } from "../console-widgets";
import { formatDate, statusTone } from "../utils";

export function HolderView() {
  const { records, syncing, createShareLink, revokeShare, openDispute } = useConsole();
  const [expandedAccessIds, setExpandedAccessIds] = useState<Set<string>>(new Set());
  const toggleAccess = (id: string) => {
    setExpandedAccessIds((current) => {
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
                <div className="access-row" data-expanded={expandedAccessIds.has(access.id)} key={access.id}>
                  <div className="data-row-summary">
                    <div>
                      <strong>{access.verifier}</strong>
                      <div className="record-meta">
                        <span>{record.courseName}</span>
                        <span>{formatDate(access.at)}</span>
                        <span className="status" data-tone={statusTone(access.cacheState)}>
                          {access.cacheState}
                        </span>
                      </div>
                    </div>
                    <button className="secondary-button compact-button" type="button" onClick={() => toggleAccess(access.id)} title={expandedAccessIds.has(access.id) ? "Minimize access event" : "Expand access event"}>
                      {expandedAccessIds.has(access.id) ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                      {expandedAccessIds.has(access.id) ? "Minimize" : "Expand"}
                    </button>
                  </div>
                  {expandedAccessIds.has(access.id) && (
                    <div className="record-details">
                      <div className="detail-grid">
                        <div>
                          <span>Purpose</span>
                          <strong>{access.purpose}</strong>
                        </div>
                        <div>
                          <span>Record</span>
                          <strong>{record.courseName}</strong>
                        </div>
                        <div>
                          <span>Checked at</span>
                          <strong>{formatDate(access.at)}</strong>
                        </div>
                        <div>
                          <span>Cache state</span>
                          <strong>{access.cacheState}</strong>
                        </div>
                      </div>
                    </div>
                  )}
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
