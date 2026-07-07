import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptJsonPayload, encryptJsonPayload } from "./encryption";

const key = randomBytes(32).toString("base64");

describe("private payload encryption", () => {
  it("encrypts and decrypts private JSON payloads", () => {
    const encrypted = encryptJsonPayload({ holderEmail: "amina.owino@example.com" }, key, "test-key");
    const decrypted = decryptJsonPayload<{ holderEmail: string }>(encrypted, key);

    expect(encrypted.algorithm).toBe("AES-256-GCM");
    expect(encrypted.ciphertext).not.toContain("amina");
    expect(decrypted.holderEmail).toBe("amina.owino@example.com");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptJsonPayload({ holderEmail: "amina.owino@example.com" }, key, "test-key");
    const last = encrypted.ciphertext.at(-1);
    const tamperedLast = last === "A" ? "B" : "A";

    expect(() =>
      decryptJsonPayload(
        {
          ...encrypted,
          ciphertext: `${encrypted.ciphertext.slice(0, -1)}${tamperedLast}`
        },
        key
      )
    ).toThrow();
  });
});
