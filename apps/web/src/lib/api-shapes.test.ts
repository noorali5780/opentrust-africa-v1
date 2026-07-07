import { describe, expect, it } from "vitest";
import { publicTrustRecordSelect } from "./api-shapes";

describe("public API record shapes", () => {
  it("does not select private record payload columns", () => {
    const serialized = JSON.stringify(publicTrustRecordSelect);

    expect(serialized).not.toContain("credentialJson");
    expect(serialized).not.toContain("privateSubjectJson");
    expect(serialized).not.toContain("privateSubjectCiphertext");
    expect(serialized).not.toContain("privateSubjectIv");
    expect(serialized).not.toContain("privateSubjectTag");
    expect(serialized).not.toContain("privateSubjectKeyId");
  });
});
