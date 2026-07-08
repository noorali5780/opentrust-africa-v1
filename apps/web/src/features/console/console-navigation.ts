import type { ConsoleRole } from "./types";

export const consoleRoutes: Array<{ role: ConsoleRole; href: string; label: string }> = [
  { role: "issuer", href: "/issuer", label: "Issuer" },
  { role: "holder", href: "/holder", label: "Holder" },
  { role: "verifier", href: "/verifier", label: "Verifier" },
  { role: "audit", href: "/audit", label: "Audit" }
];

export function roleFromPathname(pathname: string): ConsoleRole {
  if (pathname.startsWith("/holder")) return "holder";
  if (pathname.startsWith("/verifier")) return "verifier";
  if (pathname.startsWith("/audit")) return "audit";
  return "issuer";
}
