import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicDer = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const privateDer = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const keyId = `issuer-ed25519-${createHash("sha256").update(publicDer).digest("hex").slice(0, 16)}`;

const env = {
  ISSUER_KEY_ID: keyId,
  ISSUER_ED25519_PUBLIC_KEY: publicDer,
  ISSUER_ED25519_PRIVATE_KEY: privateDer,
  DATA_ENCRYPTION_KEY_ID: `data-aes-gcm-${randomBytes(8).toString("hex")}`,
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  OPEN_TRUST_API_KEY: randomBytes(32).toString("base64url")
};

for (const [key, value] of Object.entries(env)) {
  console.log(`${key}="${value}"`);
}
