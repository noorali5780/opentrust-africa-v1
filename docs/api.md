# OpenTrust Africa MVP API

All routes are JSON endpoints under `/api/v1`.

## Auth

- `POST /api/v1/auth/magic-link/request` creates a local development magic link token for an email address.
- `POST /api/v1/auth/magic-link/verify` verifies a token and sets an HTTP-only session cookie.

The first MVP ships with email/passwordless auth and a phone-ready adapter contract. No SMS provider is required.

## Issuer and templates

- `POST /api/v1/bootstrap` creates or returns the default training-center demo workspace for local MVP testing.
- `GET /api/v1/issuers` lists issuers.
- `POST /api/v1/issuers` creates an issuer.
- `GET /api/v1/templates` lists record templates.
- `POST /api/v1/templates` creates a certificate template.

## Records

- `GET /api/v1/records` lists records.
- `POST /api/v1/records` issues a certificate record.
- `GET /api/v1/records/{id}` returns one record.
- `POST /api/v1/records/{id}/revoke` revokes a record and writes an audit anchor.
- `POST /api/v1/records/{id}/disputes` opens a holder-visible dispute.
- `POST /api/v1/records/{id}/consents/revoke` revokes the latest active verify-only access grant for a record.

## Consent and verification

- `POST /api/v1/consents` creates a consent grant and verify-only share link.
- `GET /api/v1/verify/{token}` verifies a share token and returns a minimal disclosure result.

Verification responses include status, issuer, record type, revocation/dispute/expiry state, reason codes, and only the fields needed for verify-only disclosure.

## Audit

- `GET /api/v1/audit` lists tamper-evident audit anchors.
- `GET /api/v1/audit/verify` verifies audit anchor ordering, hashes, and signatures.

Audit anchors store hashes, status, timestamps, issuer IDs, versions, and previous-hash references. Private certificate payloads stay in the off-chain record table.

## Protected writes

When `ENFORCE_API_AUTH=true` or the app runs in production, mutating API routes require a valid `ota_session` cookie or an `OPEN_TRUST_API_KEY` supplied as `x-opentrust-api-key` or `Authorization: Bearer`.
