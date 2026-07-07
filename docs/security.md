# Security Model

OpenTrust Africa aims for tamper-evident trust infrastructure. No software system is literally untamperable, so the MVP makes tampering detectable and reviewable.

## Cryptographic Controls

- Certificate credentials are signed with Ed25519 issuer keys.
- Verification checks the public key embedded in the credential proof.
- Audit anchors form a SHA-256 hash chain using `previousHash`.
- Audit anchors are also Ed25519-signed so altered rows fail integrity checks.
- Verify the full audit chain with `GET /api/v1/audit/verify`.

## Private Data

- Private subject data is encrypted with AES-256-GCM before storage.
- `privateSubjectJson` stores only metadata such as encrypted fields and key ID.
- Raw private subject values must not be stored in audit anchors or proof ledgers.

## Production Secrets

Generate real keys before deployment:

```powershell
npm.cmd run security:keys
```

Set the generated values in `.env` or the hosting secret store:

- `ISSUER_KEY_ID`
- `ISSUER_ED25519_PUBLIC_KEY`
- `ISSUER_ED25519_PRIVATE_KEY`
- `DATA_ENCRYPTION_KEY_ID`
- `DATA_ENCRYPTION_KEY`
- `OPEN_TRUST_API_KEY`

Set `ENFORCE_API_AUTH=true` outside local development.

If these keys are missing in local development, the app generates process-local ephemeral keys so the demo can run. Do not use that fallback for persistent deployments because encrypted private fields may not be recoverable after restart.

## API Protection

- Mutating routes require a valid session or `OPEN_TRUST_API_KEY` when auth enforcement is enabled.
- Public verification and magic-link endpoints have in-memory rate limits for the MVP.
- Production deployments should replace in-memory rate limiting with a shared store such as Redis or a gateway rate limiter.

## Security Headers

The app sets baseline security headers including content type protection, frame denial, referrer policy, permissions policy, and HSTS in production.
