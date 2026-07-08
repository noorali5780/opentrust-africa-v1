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

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeRole = roleFromPathname(pathname);
  const { backendMode, backendMessage, loadApiData, metrics, syncing } = useConsole();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">OT</div>
            <div>
              <h1>OpenTrust Africa Foundation MVP</h1>
              <p>Issuer, holder, verifier, consent, dispute, and audit loop</p>
            </div>
          </div>

          <nav className="tabs" aria-label="Workspace views">
            {consoleRoutes.map((route) => {
              const Icon = routeIcons[route.role];

              return (
                <Link className="tab" data-active={activeRole === route.role} href={route.href} key={route.role} title={route.label}>
                  <Icon size={17} aria-hidden />
                  {route.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="main">
        <section className="mode-banner" data-mode={backendMode}>
          <div>
            <strong>{backendMode === "api" ? "Persistent mode" : backendMode === "checking" ? "Connecting" : "Local demo mode"}</strong>
            <span>{backendMessage}</span>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadApiData()} disabled={syncing} title="Reconnect persistent API">
            <RefreshCw size={18} aria-hidden />
            Reconnect
          </button>
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
