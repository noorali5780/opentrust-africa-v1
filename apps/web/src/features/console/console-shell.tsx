"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BadgeCheck, ClipboardCheck, FileCheck2, History, MapPinned, RefreshCw, RotateCcw, ScanLine, ShieldAlert, UserRoundCheck } from "lucide-react";
import { useConsole } from "./console-context";
import { consoleRoutes, roleFromPathname } from "./console-navigation";
import { Metric } from "./console-widgets";
import type { ConsoleRole } from "./types";

const routeIcons = {
  issuer: ClipboardCheck,
  holder: UserRoundCheck,
  verifier: ScanLine,
  sentinel: MapPinned,
  audit: History
} satisfies Record<ConsoleRole, typeof ClipboardCheck>;

const roleCopy = {
  issuer: {
    title: "Issuer desk",
    eyebrow: "Records",
    summary: "Issue, share, revoke, and monitor certificates."
  },
  holder: {
    title: "Trust passport",
    eyebrow: "Holder",
    summary: "Control record access, disputes, and verification history."
  },
  verifier: {
    title: "Verification desk",
    eyebrow: "Verifier",
    summary: "Check a share token and review confidence signals."
  },
  sentinel: {
    title: "Sentinel",
    eyebrow: "Field evidence",
    summary: "Capture location context for high-trust events."
  },
  audit: {
    title: "Audit ledger",
    eyebrow: "Integrity",
    summary: "Inspect anchored actions and offline sync work."
  }
} satisfies Record<ConsoleRole, { title: string; eyebrow: string; summary: string }>;

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeRole = roleFromPathname(pathname);
  const { backendMode, backendMessage, loadApiData, metrics, syncing } = useConsole();
  const activeCopy = roleCopy[activeRole];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OT</div>
          <div>
            <strong>OpenTrust Africa</strong>
            <span>Foundation console</span>
          </div>
        </div>

        <nav className="tabs" aria-label="Workspace views">
          {consoleRoutes.map((route) => {
            const Icon = routeIcons[route.role];

            return (
              <Link className="tab" data-active={activeRole === route.role} href={route.href} key={route.role} title={route.label}>
                <Icon size={18} aria-hidden />
                <span>{route.label}</span>
              </Link>
            );
          })}
        </nav>

        <section className="connection-card" data-mode={backendMode}>
          <span className="connection-dot" aria-hidden />
          <div>
            <strong>{backendMode === "api" ? "Persistent" : backendMode === "checking" ? "Connecting" : "Demo"}</strong>
            <span>{backendMessage}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => void loadApiData()} disabled={syncing} title="Reconnect persistent API">
            <RefreshCw size={17} aria-hidden />
          </button>
        </section>
      </aside>

      <main className="main">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">{activeCopy.eyebrow}</span>
            <h1>{activeCopy.title}</h1>
            <p>{activeCopy.summary}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadApiData()} disabled={syncing} title="Reconnect persistent API">
            <RefreshCw size={18} aria-hidden />
            Reconnect
          </button>
        </header>

        <section className="mode-banner" data-mode={backendMode}>
          <div>
            <strong>{backendMode === "api" ? "Persistent database online" : backendMode === "checking" ? "Checking database" : "Local demo mode active"}</strong>
            <span>{backendMessage}</span>
          </div>
        </section>

        <section className="summary-grid" aria-label="MVP metrics">
          <Metric label="Issued records" value={metrics.issued} icon={FileCheck2} />
          <Metric label="Verifications" value={metrics.verifications} icon={BadgeCheck} />
          <Metric label="Open disputes" value={metrics.disputes} icon={ShieldAlert} />
          <Metric label="Revoked records" value={metrics.revoked} icon={RotateCcw} />
        </section>

        {children}
      </main>
    </div>
  );
}
