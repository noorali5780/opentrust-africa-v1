# OpenTrust Africa Foundation MVP

This repository implements the first self-hostable web MVP for OpenTrust Africa: a certificate trust loop where an issuer creates a certificate, a holder receives it in a Trust Passport, a holder shares a verify-only link, a verifier checks the claim, and revocation, disputes, access history, and proof anchors are auditable.

## What is included

- TypeScript npm workspaces
- Next.js-style web app in `apps/web`
- Shared trust schemas and proof logic in `packages/core`
- Prisma/Postgres schema in `prisma/schema.prisma`
- REST-style JSON API under `/api/v1`
- Issuer Dashboard, Holder Trust Passport, Verifier, and Audit views
- Certificate-first W3C Verifiable Credential-style records
- Consent grants, verify-only share links, revocation, disputes, access history, and audit anchors
- Offline-aware local draft queue and verification cache labeling

## Local setup

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Start Postgres and set `DATABASE_URL` in `.env`.

   With Docker Desktop:

   ```powershell
   docker compose up -d
   ```

4. Generate Prisma client and apply the schema:

   ```powershell
   npm.cmd run prisma:generate
   npm.cmd run prisma:migrate
   npm.cmd run seed
   ```

5. Start the web app:

   ```powershell
   npm.cmd run dev
   ```

PowerShell may block `npm.ps1` on this machine; use `npm.cmd` as shown above.

## Runtime modes

The console attempts to connect to `/api/v1/bootstrap` on load.

- If Postgres is migrated and reachable, the app enters persistent mode and all issue, share, verify, revoke, dispute, access-history, and audit actions use the API.
- If the API or database is unavailable, the app stays usable in local demo mode with browser storage and an offline draft queue.

Use the Reconnect control in the app after starting Postgres or applying migrations.

## Security hardening

Generate production secrets before any real deployment:

```powershell
npm.cmd run security:keys
```

Then copy the generated values into `.env` or your hosting secret store and set `ENFORCE_API_AUTH=true`. See `docs/security.md` for the current tamper-evidence and encryption model.

## Product boundaries

The MVP intentionally does not include marketplace flows, map-first UX, AI-issued records, biometrics, payment integrations, public blockchain anchoring, or a universal human trust score.
