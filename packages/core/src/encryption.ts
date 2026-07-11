import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { canonicalize } from "./proof-ledger";

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
  algorithm: "AES-256-GCM";
  keyId: string;
};

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

function decodeBase64UrlField(value: string, fieldName: string, expectedLength?: number): Buffer {
  if (!value || !base64UrlPattern.test(value)) {
    throw new Error(`Encrypted payload ${fieldName} must be canonical base64url`);
  }

  const decoded = Buffer.from(value, "base64url");

  if (decoded.toString("base64url") !== value) {
    throw new Error(`Encrypted payload ${fieldName} must be canonical base64url`);
  }

  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    throw new Error(`Encrypted payload ${fieldName} has an invalid length`);
  }

  return decoded;
}

export function parseAes256Key(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be a base64 encoded 32-byte key");
  }

  return key;
}

export function encryptJsonPayload(payload: unknown, keyBase64: string, keyId = "local-aes-gcm"): EncryptedPayload {
  const key = parseAes256Key(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(canonicalize(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    algorithm: "AES-256-GCM",
    keyId
  };
}

export function decryptJsonPayload<T = unknown>(encrypted: EncryptedPayload, keyBase64: string): T {
  if (encrypted.algorithm !== "AES-256-GCM") {
    throw new Error("Encrypted payload uses an unsupported algorithm");
  }

  if (!encrypted.keyId) {
    throw new Error("Encrypted payload is missing a key id");
  }

  const key = parseAes256Key(keyBase64);
  const iv = decodeBase64UrlField(encrypted.iv, "iv", 12);
  const tag = decodeBase64UrlField(encrypted.tag, "tag", 16);
  const ciphertext = decodeBase64UrlField(encrypted.ciphertext, "ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

  return JSON.parse(plaintext) as T;
}
