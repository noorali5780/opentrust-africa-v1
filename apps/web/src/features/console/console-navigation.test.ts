import { describe, expect, it } from "vitest";
import { roleFromPathname } from "./console-navigation";

describe("console route helpers", () => {
  it.each([
    ["/issuer", "issuer"],
    ["/holder", "holder"],
    ["/verifier?token=abc", "verifier"],
    ["/sentinel", "sentinel"],
    ["/audit", "audit"],
    ["/", "issuer"]
  ] as const)("maps %s to %s", (pathname, role) => {
    expect(roleFromPathname(pathname)).toBe(role);
  });
});
