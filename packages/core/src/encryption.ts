import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { canonicalize } from "./proof-ledger";

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
  algorithm: "AES-256-GCM";
  keyId: string;
};

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
  const key = parseAes256Key(keyBase64);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64url"));

  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64url")), decipher.final()]).toString("utf8");

  return JSON.parse(plaintext) as T;
}
