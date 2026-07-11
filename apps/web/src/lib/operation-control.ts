import { Prisma } from "@prisma/client";
import { hashPayload } from "@opentrust/core/proof-ledger";
import {
  TaskCancelledError,
  TaskConflictError,
  TaskScheduler,
  TaskSchedulerShutdownError,
  TaskTimeoutError,
  type TaskExecutionContext,
  type TaskOptions,
  type TaskPriority
} from "@opentrust/core/task-control";
import { problem, serviceUnavailable } from "@/lib/json";

type SchedulerGlobals = typeof globalThis & {
  __opentrustApiScheduler?: TaskScheduler;
  __opentrustAuditScheduler?: TaskScheduler;
  __opentrustShutdownHandlersInstalled?: boolean;
};

type ApiOperationOptions = {
  name: string;
  priority?: TaskPriority;
  lockKey?: string;
  dedupeKey?: string;
  timeoutMs?: number;
  retry?: TaskOptions<Response>["retry"];
  rejectOnConflict?: boolean;
  metadata?: Record<string, unknown>;
};

const globalForSchedulers = globalThis as SchedulerGlobals;

export function logOperation(
  level: "debug" | "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown> = {}
) {
  const payload = {
    at: new Date().toISOString(),
    event,
    ...details
  };
  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
  } else if (level === "warn") {
    console.warn(message);
  } else if (process.env.NODE_ENV !== "test") {
    console.info(message);
  }
}

function createScheduler(name: string, maxConcurrent: number, defaultTimeoutMs: number) {
  return new TaskScheduler({
    name,
    maxConcurrent,
    defaultTimeoutMs,
    logger: (event) =>
      logOperation(event.level, event.event, {
        scheduler: event.scheduler,
        taskId: event.taskId,
        taskName: event.taskName,
        message: event.message,
        ...event.details
      })
  });
}

export const apiTaskScheduler =
  globalForSchedulers.__opentrustApiScheduler ??
  (globalForSchedulers.__opentrustApiScheduler = createScheduler("api-operations", 8, 20_000));

export const auditTaskScheduler =
  globalForSchedulers.__opentrustAuditScheduler ??
  (globalForSchedulers.__opentrustAuditScheduler = createScheduler("audit-ledger", 1, 10_000));

installShutdownHandlers();

export function taskLockKey(...parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined && String(part).length > 0)
    .map((part) => String(part).replace(/[^A-Za-z0-9._:-]/g, "_"))
    .join(":");
}

export function idempotencyDedupeKey(request: Request, route: string, requestBody: unknown) {
  const key = request.headers.get("idempotency-key");
  return key ? taskLockKey("idempotency", route, key, hashPayload(requestBody)) : undefined;
}

export async function runApiOperation(
  request: Request,
  options: ApiOperationOptions,
  operation: (context: TaskExecutionContext) => Promise<Response> | Response
) {
  const url = new URL(request.url);
  const startedAt = Date.now();

  try {
    return await apiTaskScheduler.run(operation, {
      name: options.name,
      priority: options.priority ?? "normal",
      lockKey: options.lockKey,
      dedupeKey: options.dedupeKey,
      timeoutMs: options.timeoutMs ?? 20_000,
      retry: options.retry ?? {
        maxAttempts: 1,
        baseDelayMs: 75,
        maxDelayMs: 500,
        retryOn: isRetryableOperationError
      },
      rejectOnConflict: options.rejectOnConflict ?? true,
      signal: request.signal,
      metadata: {
        method: request.method,
        path: url.pathname,
        ...options.metadata
      }
    });
  } catch (error) {
    logOperation("error", "api.operation_failed", {
      operation: options.name,
      path: url.pathname,
      method: request.method,
      durationMs: Date.now() - startedAt,
      error: errorMessage(error)
    });

    if (error instanceof TaskConflictError) {
      return problem("A conflicting operation is already running. Retry shortly.", 409);
    }

    if (error instanceof TaskTimeoutError) {
      return problem("Operation timed out before it could complete safely", 504);
    }

    if (error instanceof TaskCancelledError || error instanceof TaskSchedulerShutdownError) {
      return problem("Operation was cancelled before completion", 503);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return problem("Resource already exists", 409);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return problem("Requested resource was not found", 404);
    }

    return serviceUnavailable(error);
  }
}

export function runAuditOperation<T>(name: string, operation: (context: TaskExecutionContext) => Promise<T> | T) {
  return auditTaskScheduler.run(operation, {
    name,
    lockKey: "audit-ledger",
    priority: "critical",
    timeoutMs: 10_000,
    retry: {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 300,
      retryOn: isRetryableOperationError
    },
    rejectOnConflict: false
  });
}

export function operationHealth() {
  return {
    api: apiTaskScheduler.getHealth(),
    audit: auditTaskScheduler.getHealth()
  };
}

export function isRetryableOperationError(error: unknown) {
  if (error instanceof TaskConflictError || error instanceof TaskTimeoutError || error instanceof TaskCancelledError) {
    return false;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1017", "P2024", "P2034"].includes(error.code);
  }

  return false;
}

function installShutdownHandlers() {
  if (globalForSchedulers.__opentrustShutdownHandlersInstalled) return;
  globalForSchedulers.__opentrustShutdownHandlersInstalled = true;

  if (typeof process === "undefined" || typeof process.once !== "function") return;

  const shutdown = (signal: string) => {
    logOperation("warn", "scheduler.shutdown_requested", { signal });
    void Promise.all([
      apiTaskScheduler.shutdown({ timeoutMs: 5_000, cancelQueued: true, abortActive: true }),
      auditTaskScheduler.shutdown({ timeoutMs: 5_000, cancelQueued: true, abortActive: true })
    ]).then((health) => {
      logOperation("warn", "scheduler.shutdown_complete", { health });
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
