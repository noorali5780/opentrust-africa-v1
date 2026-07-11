# Operations Control

OpenTrust Africa now uses a centralized task-control layer for API mutations and audit-ledger writes.

## Core scheduler

`@opentrust/core/task-control` provides:

- Controlled concurrency through `maxConcurrent`.
- Lock keys to prevent conflicting work from running at the same time.
- Dedupe keys to collapse duplicate in-flight execution.
- Priorities: `low`, `normal`, `high`, and `critical`.
- Dependency gates between scheduled tasks.
- Cooperative cancellation through `AbortSignal`.
- Cooperative timeouts through `timeoutMs`.
- Retry limits with bounded exponential backoff.
- Fallback handlers for safe recovery.
- Health snapshots for queued, active, locked, and recent tasks.
- Graceful shutdown support for cancelling queued work and aborting active work.

Task handlers should call `throwIfAborted()` before expensive or state-changing steps. JavaScript cannot forcibly stop non-cooperative database calls, so timeout and cancellation are safest when handlers observe the provided signal between operations.

## Web API control

`apps/web/src/lib/operation-control.ts` owns the app-level controllers:

- `apiTaskScheduler`: general API mutations, max concurrency 8.
- `auditTaskScheduler`: serial audit-chain writes, max concurrency 1.
- `runApiOperation()`: wraps route mutations with logging, safe error translation, retry policy, timeout, lock, dedupe, and cancellation behavior.
- `runAuditOperation()`: serializes audit-anchor writes and retries transient ledger conflicts.
- `operationHealth()`: returns scheduler state for health checks.

Route-level retries default to one attempt because most API mutations are not safely repeatable after partial side effects. Add explicit retries only around idempotent or fully transactional work. Audit writes are serialized and retry transient ledger conflicts separately.

Current controlled routes include:

- Issuer creation.
- Template creation.
- Certificate issuance.
- Consent creation and revocation.
- Record revocation.
- Dispute opening.
- Magic-link request and verification.
- Audit anchor creation.

## Health checks

`GET /api/v1/health` checks database availability and returns scheduler health:

- `status`
- `checkedAt`
- `services.database`
- `services.schedulers.api`
- `services.schedulers.audit`

Use this endpoint for container, load balancer, and deployment health probes.

## Locking guidance

Use lock keys around the narrowest resource that can conflict:

- Record state changes: `record:{id}:state`
- Record consent changes: `record:{id}:consent`
- Holder issuance: `holder:{email}:issue`
- Magic token verification: `magic-link-token:{tokenHash}`
- Audit ledger writes: `audit-ledger`

Use `idempotencyDedupeKey()` for mutating routes that already accept `Idempotency-Key`, so same-body retries collapse while the first request is still running.

## Failure behavior

The wrapper maps failures to safe responses:

- Conflicting in-flight operation: `409`
- Timeout: `504`
- Shutdown or cancellation: `503`
- Unique constraint conflict: `409`
- Missing row during update: `404`
- Other unexpected failures: `503`

All controlled failures are logged as structured JSON through `logOperation()`.
