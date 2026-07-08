"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Link2, ListChecks, ScanLine, ShieldCheck } from "lucide-react";
import { useConsole } from "../console-context";
import { TextField, VerificationPanel } from "../console-widgets";

export function VerifierView() {
  const searchParams = useSearchParams();
  const {
    verifierName,
    setVerifierName,
    verifierPurpose,
    setVerifierPurpose,
    verifierToken,
    setVerifierToken,
    offlineVerification,
    setOfflineVerification,
    currentShareTokens,
    verification,
    syncing,
    verifyToken
  } = useConsole();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) setVerifierToken(token);
  }, [searchParams, setVerifierToken]);

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
