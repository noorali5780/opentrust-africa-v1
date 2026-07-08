import type { AuditRow } from "./types";

export const today = () => new Date().toISOString();

export function simpleHash(value: unknown): string {
  const source = JSON.stringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `sha256:${(hash >>> 0).toString(16).padStart(8, "0")}${source.length.toString(16).padStart(8, "0")}`;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function createAudit(action: string, recordId: string, status: string, payload: unknown, previousHash: string | null): AuditRow {
  const createdAt = today();
  const payloadHash = simpleHash(payload);
  const anchorHash = simpleHash({ action, recordId, status, payloadHash, previousHash, createdAt });

  return {
    id: createId("aud"),
    action,
    recordId,
    status,
    payloadHash,
    previousHash,
    anchorHash,
    createdAt
  };
}

export function parseStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function statusTone(status: string): "good" | "warn" | "bad" {
  if (status === "issued" || status === "active" || status === "valid") return "good";
  if (status === "disputed" || status === "offline_cache") return "warn";
  return "bad";
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
