"use client";

import { History, KeyRound, LockKeyhole, RotateCcw, ShieldAlert } from "lucide-react";
import { useConsole } from "../console-context";
import { RecordList } from "../console-widgets";
import { formatDate, statusTone } from "../utils";

export function HolderView() {
  const { records, syncing, createShareLink, revokeShare, openDispute } = useConsole();

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
