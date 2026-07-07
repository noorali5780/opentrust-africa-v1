import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, timingSafeEqual, verify } from "node:crypto";

export type AuditAction =
  | "issuer_created"
  | "template_created"
  | "record_issued"
  | "consent_granted"
  | "consent_revoked"
  | "record_verified"
  | "record_revoked"
  | "dispute_opened"
  | "access_logged";

export type AuditAnchorInput = {
  action: AuditAction;
  issuerId: string;
  recordId?: string;
  status: string;
  version: number;
  payload: unknown;
  previousHash?: string | null;
  signer?: {
    keyId: string;
    privateKeyDerBase64: string;
    publicKeyDerBase64: string;
  };
  createdAt?: Date;
};

export type AuditAnchorEntry = {
  action: AuditAction;
  issuerId: string;
  recordId?: string;
  status: string;
  version: number;
  payloadHash: string;
  previousHash: string | null;
  anchorHash: string;
  signature?: string;
  signatureAlgorithm?: "Ed25519";
  keyId?: string;
  publicKey?: string;
  createdAt: string;
};

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

export function signCredentialPayload(payload: unknown, privateKeyDerBase64: string): string {
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyDerBase64, "base64"),
    format: "der",
    type: "pkcs8"
  });
  const signature = sign(null, Buffer.from(canonicalize(payload)), privateKey);

  return `ed25519:${signature.toString("base64url")}`;
}

export function verifyCredentialSignature(payload: unknown, signatureValue: string, publicKeyDerBase64: string): boolean {
  if (!signatureValue.startsWith("ed25519:")) return false;

  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyDerBase64, "base64"),
      format: "der",
      type: "spki"
    });
    const signatureBytes = Buffer.from(signatureValue.slice("ed25519:".length), "base64url");

    return verify(null, Buffer.from(canonicalize(payload)), publicKey, signatureBytes);
  } catch {
    return false;
  }
}

export function constantTimeEqual(first: string, second: string): boolean {
  const firstBytes = Buffer.from(first);
  const secondBytes = Buffer.from(second);

  if (firstBytes.length !== secondBytes.length) return false;
  return timingSafeEqual(firstBytes, secondBytes);
}

export function createShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAuditAnchor(input: AuditAnchorInput): AuditAnchorEntry {
  const createdAt = (input.createdAt ?? new Date()).toISOString();
  const payloadHash = hashPayload(input.payload);
  const previousHash = input.previousHash ?? null;
  const anchorHash = hashPayload({
    action: input.action,
    issuerId: input.issuerId,
    recordId: input.recordId ?? null,
    status: input.status,
    version: input.version,
    payloadHash,
    previousHash,
    createdAt
  });
  const unsignedAnchor = {
    action: input.action,
    issuerId: input.issuerId,
    recordId: input.recordId ?? null,
    status: input.status,
    version: input.version,
    payloadHash,
    previousHash,
    anchorHash,
    createdAt
  };
  const signature = input.signer ? signCredentialPayload(unsignedAnchor, input.signer.privateKeyDerBase64) : undefined;

  return {
    action: input.action,
    issuerId: input.issuerId,
    recordId: input.recordId,
    status: input.status,
    version: input.version,
    payloadHash,
    previousHash,
    anchorHash,
    signature,
    signatureAlgorithm: signature ? "Ed25519" : undefined,
    keyId: input.signer?.keyId,
    publicKey: input.signer?.publicKeyDerBase64,
    createdAt
  };
}

export function verifyAnchorChain(entries: AuditAnchorEntry[]): boolean {
  return entries.every((entry, index) => {
    const expectedPrevious = index === 0 ? null : entries[index - 1]?.anchorHash;
    if (entry.previousHash !== expectedPrevious) return false;

    const expectedHash = hashPayload({
      action: entry.action,
      issuerId: entry.issuerId,
      recordId: entry.recordId ?? null,
      status: entry.status,
      version: entry.version,
      payloadHash: entry.payloadHash,
      previousHash: entry.previousHash,
      createdAt: entry.createdAt
    });

    if (!constantTimeEqual(entry.anchorHash, expectedHash)) return false;

    if (entry.signature || entry.publicKey) {
      if (!entry.signature || !entry.publicKey) return false;

      return verifyCredentialSignature(
        {
          action: entry.action,
          issuerId: entry.issuerId,
          recordId: entry.recordId ?? null,
          status: entry.status,
          version: entry.version,
          payloadHash: entry.payloadHash,
          previousHash: entry.previousHash,
          anchorHash: entry.anchorHash,
          createdAt: entry.createdAt
        },
        entry.signature,
        entry.publicKey
      );
    }

    return true;
  });
}
