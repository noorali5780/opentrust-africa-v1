import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenTrust Africa MVP",
  description: "Certificate trust loop for issuer, holder, verifier, and audit workflows."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
