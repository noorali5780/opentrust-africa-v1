import { describe, expect, it } from "vitest";
import { createHash, generateKeyPairSync } from "node:crypto";
import { createAuditAnchor, hashPayload, signCredentialPayload, verifyAnchorChain, verifyCredentialSignature } from "./proof-ledger";

function createTestKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDerBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const privateKeyDerBase64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  const keyId = `test-${createHash("sha256").update(publicKeyDerBase64).digest("hex").slice(0, 16)}`;

  return { keyId, publicKeyDerBase64, privateKeyDerBase64 };
}

describe("proof ledger", () => {
  it("hashes equivalent objects deterministically", () => {
    const first = hashPayload({ b: 2, a: 1 });
    const second = hashPayload({ a: 1, b: 2 });

    expect(first).toBe(second);
  });

  it("creates a tamper-evident anchor chain without storing raw payloads", () => {
    const testKeys = createTestKeys();
    const first = createAuditAnchor({
      action: "record_issued",
      issuerId: "issuer_1",
      recordId: "record_1",
      status: "issued",
      version: 1,
      payload: { privateName: "Amina Owino", phone: "+254700000001" },
      previousHash: null,
      signer: testKeys,
      createdAt: new Date("2026-07-01T09:00:00.000Z")
    });
    const second = createAuditAnchor({
      action: "record_verified",
      issuerId: "issuer_1",
      recordId: "record_1",
      status: "valid",
      version: 1,
      payload: { verifier: "Kijani Works HR" },
      previousHash: first.anchorHash,
      signer: testKeys,
      createdAt: new Date("2026-07-02T09:00:00.000Z")
    });

    expect(verifyAnchorChain([first, second])).toBe(true);
    expect(JSON.stringify(first)).not.toContain("Amina");
    expect(first.payloadHash).toHaveLength(64);
    expect(first.signature).toMatch(/^ed25519:/);
  });

  it("signs and verifies credential payloads with Ed25519", () => {
    const testKeys = createTestKeys();
    const payload = { id: "record_1", claim: "certificate valid" };
    const signature = signCredentialPayload(payload, testKeys.privateKeyDerBase64);

    expect(verifyCredentialSignature(payload, signature, testKeys.publicKeyDerBase64)).toBe(true);
    expect(verifyCredentialSignature({ ...payload, claim: "changed" }, signature, testKeys.publicKeyDerBase64)).toBe(false);
  });

  it("detects tampered audit anchors", () => {
    const testKeys = createTestKeys();
    const first = createAuditAnchor({
      action: "record_issued",
      issuerId: "issuer_1",
      recordId: "record_1",
      status: "issued",
      version: 1,
      payload: { claim: "certificate valid" },
      previousHash: null,
      signer: testKeys,
      createdAt: new Date("2026-07-01T09:00:00.000Z")
    });

    expect(verifyAnchorChain([{ ...first, status: "revoked" }])).toBe(false);
  });
});
