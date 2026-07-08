# Production Scale Runbook

This repository now has safer API defaults: bounded reads, cursor pagination, schema validation, idempotent write replay, issuer/holder access checks, signed audit anchors, encrypted private payloads, and indexed database access paths.

No single web app process can honestly guarantee one billion requests without failing. That target requires production infrastructure around the application.

## Required Architecture For Very High Traffic

- Put the app behind a CDN, WAF, and API gateway.
- Terminate TLS at the edge and enforce modern TLS settings.
- Use a distributed rate limiter such as Redis, Cloudflare, Fastly, AWS API Gateway, or another edge/gateway limiter. The in-memory limiter is only an MVP fallback.
- Horizontally scale stateless Next.js/API workers across multiple zones.
- Run Postgres as a managed HA cluster with automated backups, point-in-time recovery, connection pooling, and tested failover.
- Add read replicas for list, audit, and verifier read paths.
- Partition or archive high-volume append tables such as `VerificationEvent` and `AuditAnchor`.
- Move high-volume verification event processing to a queue and worker pool.
- Batch or schedule full-chain audit verification instead of exposing full ledger scans through public request paths.
- For Sentinel maps, self-host OpenStreetMap tiles or use an open tile service with a policy suitable for production traffic.
- Use centralized logs, metrics, tracing, uptime checks, and alerts.
- Load test with realistic request mixes before claiming capacity.

## API Decisions Already In The Code

- `GET` list endpoints are capped to 100 records per page.
- Record reads are production-scoped by issuer membership or holder ownership.
- Mutating record, consent, dispute, revocation, issuer, and template endpoints support `Idempotency-Key`.
- API responses use `Cache-Control: no-store` and request IDs.
- Request bodies are size-limited before JSON parsing.
- Private certificate payload fields are not selected by normal record API responses.
- The audit verifier checks cursor windows, not the entire ledger in one request.
- Audit anchor writes use a serializable transaction with retry on serialization conflict.

## Database Operations

Run migrations before deployment:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

For production, use Prisma migrations in CI/CD rather than interactive local migration commands. Keep database credentials in a secret store, not in Git.

## Minimum Production Environment

Set these values before real data is stored:

- `DATABASE_URL`
- `APP_URL`
- `ENFORCE_API_AUTH=true`
- `OPEN_TRUST_API_KEY`
- `ISSUER_KEY_ID`
- `ISSUER_ED25519_PUBLIC_KEY`
- `ISSUER_ED25519_PRIVATE_KEY`
- `DATA_ENCRYPTION_KEY_ID`
- `DATA_ENCRYPTION_KEY`

Do not set `ALLOW_DEMO_BOOTSTRAP=true` in production unless you are running an isolated demo environment.

## Capacity Claim Checklist

Before claiming billion-request readiness:

- Run load tests with peak and sustained traffic targets.
- Test database failover and worker restarts.
- Test gateway rate limits and abusive traffic patterns.
- Verify queue backpressure behavior.
- Verify audit verification alerts.
- Verify backup restore and key rotation procedures.
- Review all public responses for minimal disclosure.
