"use client";

import { Archive, ClipboardCheck, FileCheck2, Link2, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { useConsole } from "../console-context";
import { RecordList, TextArea, TextField } from "../console-widgets";

export function IssuerView() {
  const { records, drafts, issueForm, setIssueForm, syncing, issueCertificate, saveDraft, syncDrafts, createShareLink, revokeRecord } = useConsole();

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
