# OpenTrust Africa Foundation MVP

OpenTrust Africa is a self-hostable trust infrastructure MVP for issuing, sharing, verifying, and auditing certificate-based claims. The platform supports a certificate trust loop in which an issuer creates a credential, a holder receives it in a Trust Passport, a verifier checks the claim through a verify-only link, and all key actions remain auditable.

## What this repository includes

- A TypeScript monorepo with npm workspaces
- A web application in apps/web
- Shared trust logic and schemas in packages/core
- Prisma and PostgreSQL-backed persistence in prisma/schema.prisma
- REST-style API endpoints under /api/v1
- Dedicated views for issuer, holder, verifier, sentinel, and audit workflows
- Certificate-first, W3C-style record handling with consent, revocation, disputes, and access history
- Sentinel support for GPS and location-aware evidence
- Offline-friendly draft queue and verification cache behavior

## Quick start

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Create your environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Start PostgreSQL and set DATABASE_URL in .env.

   With Docker Desktop:

   ```powershell
   docker compose up -d
   ```

4. Generate the Prisma client, apply the schema, and seed the database:

   ```powershell
   npm.cmd run prisma:generate
   npm.cmd run prisma:migrate
   npm.cmd run seed
   ```

5. Start the web app:

   ```powershell
   npm.cmd run dev
   ```

If PowerShell blocks npm.ps1 on your machine, use npm.cmd as shown above.

## Runtime behavior

The console attempts to connect to /api/v1/bootstrap on load.

- When PostgreSQL is available, the app runs in persistent mode and uses the API for issuance, sharing, verification, revocation, disputes, access history, and audit actions.
- If the API or database is unavailable, the app remains usable in local demo mode with browser storage and an offline draft queue.

Use the Reconnect control in the app after starting PostgreSQL or applying migrations.

## Main routes

- /issuer for certificate issuance and issuer record management
- /holder for the Trust Passport, consent grants, access history, and disputes
- /verifier for verify-only checks
- /sentinel for GPS and location evidence workflows
- /audit for audit logs and offline draft queue review
- /verify/{token} for share-link landing pages

## Security and deployment

Generate production secrets before deploying to production:

```powershell
npm.cmd run security:keys
```

Then copy the generated values into .env or your hosting secret store and set ENFORCE_API_AUTH=true. See docs/security.md for the current tamper-evidence and encryption model.

For large-scale deployment planning, review docs/production-scale.md. The MVP includes bounded API reads, scoped record access, idempotent writes, and safer audit verification, but high-traffic environments still require gateway, database, queue, cache, and observability infrastructure.

The repository also includes a production Dockerfile and CI workflow. See docs/deployment.md for build, runtime, and migration notes.

## Product boundaries

This MVP is intentionally focused on certificate-first trust workflows. It does not include marketplace flows, AI-issued records, biometrics, payment integrations, public blockchain anchoring, or a universal human trust score.

Signed,

Sadiki Noor
Manila Inc
admin@sadiki.online
