import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";

export type IssuerSigningKeys = {
  keyId: string;
  publicKeyDerBase64: string;
  privateKeyDerBase64: string;
};

function createEphemeralSigningKeys(): IssuerSigningKeys {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDerBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const privateKeyDerBase64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  const keyId = `dev-ephemeral-${createHash("sha256").update(publicKeyDerBase64).digest("hex").slice(0, 16)}`;

  return { keyId, publicKeyDerBase64, privateKeyDerBase64 };
}

const ephemeralSigningKeys = createEphemeralSigningKeys();
const ephemeralEncryptionKey = randomBytes(32).toString("base64");

export function getIssuerSigningKeys(): IssuerSigningKeys {
  const keyId = process.env.ISSUER_KEY_ID;
  const publicKeyDerBase64 = process.env.ISSUER_ED25519_PUBLIC_KEY;
  const privateKeyDerBase64 = process.env.ISSUER_ED25519_PRIVATE_KEY;

  if (keyId && publicKeyDerBase64 && privateKeyDerBase64) {
    return { keyId, publicKeyDerBase64, privateKeyDerBase64 };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("ISSUER_KEY_ID, ISSUER_ED25519_PUBLIC_KEY, and ISSUER_ED25519_PRIVATE_KEY are required in production");
  }

  return ephemeralSigningKeys;
}

export function getDataEncryptionKey() {
  const key = process.env.DATA_ENCRYPTION_KEY;

  if (key) return { key, keyId: process.env.DATA_ENCRYPTION_KEY_ID ?? "primary-local-key" };
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATA_ENCRYPTION_KEY is required in production");
  }

  return { key: ephemeralEncryptionKey, keyId: "dev-ephemeral-aes-gcm" };
}

export function generateApiKey() {
  return randomBytes(32).toString("base64url");
}
