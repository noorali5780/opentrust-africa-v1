export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskStatus = "queued" | "running" | "succeeded" | "recovered" | "failed" | "cancelled" | "timed_out" | "blocked";

export type TaskRetryPolicy = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryOn?: (error: unknown, attempt: number) => boolean;
};

export type TaskExecutionContext = {
  taskId: string;
  name: string;
  attempt: number;
  signal: AbortSignal;
  throwIfAborted: () => void;
};

export type TaskFallbackContext = Omit<TaskExecutionContext, "attempt"> & {
  attempts: number;
};

export type TaskOptions<T> = {
  id?: string;
  name?: string;
  priority?: TaskPriority;
  lockKey?: string;
  dedupeKey?: string;
  dependencies?: string[];
  timeoutMs?: number;
  retry?: TaskRetryPolicy;
  fallback?: (error: unknown, context: TaskFallbackContext) => Promise<T> | T;
  rejectOnConflict?: boolean;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type TaskSnapshot = {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  lockKey?: string;
  dedupeKey?: string;
  dependencies: string[];
  attempts: number;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  lastError?: string;
  metadata?: Record<string, unknown>;
};

export type TaskSchedulerHealth = {
  name: string;
  status: "healthy" | "busy" | "shutting_down";
  maxConcurrent: number;
  active: number;
  queued: number;
  locks: string[];
  recentTasks: TaskSnapshot[];
};

export type TaskSchedulerOptions = {
  name?: string;
  maxConcurrent?: number;
  defaultTimeoutMs?: number;
  maxHistory?: number;
  logger?: (event: TaskLogEvent) => void;
};

export type TaskLogEvent = {
  level: "debug" | "info" | "warn" | "error";
  event: string;
  scheduler: string;
  taskId?: string;
  taskName?: string;
  message?: string;
  details?: Record<string, unknown>;
};

type TaskRecord = {
  id: string;
  sequence: number;
  name: string;
  priority: TaskPriority;
  lockKey?: string;
  dedupeKey?: string;
  dependencies: string[];
  timeoutMs: number;
  retry: Required<Omit<TaskRetryPolicy, "retryOn">> & Pick<TaskRetryPolicy, "retryOn">;
  fallback?: (error: unknown, context: TaskFallbackContext) => Promise<unknown> | unknown;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  controller: AbortController;
  handler: (context: TaskExecutionContext) => Promise<unknown> | unknown;
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  status: TaskStatus;
  attempts: number;
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  lastError?: string;
};

const priorityWeight: Record<TaskPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3
};

export class TaskControlError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class TaskConflictError extends TaskControlError {
  constructor(lockKey: string) {
    super("TASK_CONFLICT", `Task lock is already held: ${lockKey}`);
  }
}

export class TaskTimeoutError extends TaskControlError {
  constructor(taskId: string, timeoutMs: number) {
    super("TASK_TIMEOUT", `Task ${taskId} exceeded ${timeoutMs}ms`);
  }
}

export class TaskCancelledError extends TaskControlError {
  constructor(taskId: string, reason = "Task was cancelled") {
    super("TASK_CANCELLED", `${reason}: ${taskId}`);
  }
}

export class TaskDependencyError extends TaskControlError {
  constructor(taskId: string, dependencyId: string) {
    super("TASK_DEPENDENCY_FAILED", `Task ${taskId} cannot run because dependency ${dependencyId} did not complete`);
  }
}

export class TaskSchedulerShutdownError extends TaskControlError {
  constructor(name: string) {
    super("TASK_SCHEDULER_SHUTTING_DOWN", `Task scheduler is shutting down: ${name}`);
  }
}

export function throwIfTaskAborted(signal: AbortSignal, taskId = "task") {
  if (!signal.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  throw new TaskCancelledError(taskId, typeof reason === "string" ? reason : "Task was aborted");
}

export class TaskScheduler {
  private readonly name: string;
  private readonly maxConcurrent: number;
  private readonly defaultTimeoutMs: number;
  private readonly maxHistory: number;
  private readonly logger?: TaskSchedulerOptions["logger"];
  private sequence = 0;
  private shuttingDown = false;
  private queue: TaskRecord[] = [];
  private active = new Map<string, TaskRecord>();
  private locks = new Map<string, string>();
  private dedupePromises = new Map<string, Promise<unknown>>();
  private history = new Map<string, TaskSnapshot>();

  constructor(options: TaskSchedulerOptions = {}) {
    this.name = options.name ?? "task-scheduler";
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 4);
    this.defaultTimeoutMs = Math.max(1, options.defaultTimeoutMs ?? 30_000);
    this.maxHistory = Math.max(10, options.maxHistory ?? 100);
    this.logger = options.logger;
  }

  run<T>(handler: (context: TaskExecutionContext) => Promise<T> | T, options: TaskOptions<T> = {}): Promise<T> {
    if (this.shuttingDown) {
      return Promise.reject(new TaskSchedulerShutdownError(this.name));
    }

    if (options.signal?.aborted) {
      return Promise.reject(options.signal.reason instanceof Error ? options.signal.reason : new TaskCancelledError(options.id ?? "task"));
    }

    if (options.dedupeKey) {
      const existing = this.dedupePromises.get(options.dedupeKey);
      if (existing) return existing as Promise<T>;
    }

    if (options.rejectOnConflict && options.lockKey && this.isLockContended(options.lockKey)) {
      return Promise.reject(new TaskConflictError(options.lockKey));
    }

    const id = options.id ?? `${this.name}-${Date.now().toString(36)}-${(this.sequence + 1).toString(36)}`;
    const name = options.name ?? id;
    let resolve!: (value: unknown) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<unknown>((outerResolve, outerReject) => {
      resolve = outerResolve;
      reject = outerReject;
    });
    const record: TaskRecord = {
      id,
      sequence: ++this.sequence,
      name,
      priority: options.priority ?? "normal",
      lockKey: options.lockKey,
      dedupeKey: options.dedupeKey,
      dependencies: options.dependencies ?? [],
      timeoutMs: Math.max(1, options.timeoutMs ?? this.defaultTimeoutMs),
      retry: {
        maxAttempts: Math.max(1, options.retry?.maxAttempts ?? 1),
        baseDelayMs: Math.max(0, options.retry?.baseDelayMs ?? 100),
        maxDelayMs: Math.max(0, options.retry?.maxDelayMs ?? 2_000),
        backoffFactor: Math.max(1, options.retry?.backoffFactor ?? 2),
        retryOn: options.retry?.retryOn
      },
      fallback: options.fallback,
      signal: options.signal,
      metadata: options.metadata,
      controller: new AbortController(),
      handler,
      promise,
      resolve,
      reject,
      status: "queued",
      attempts: 0,
      queuedAt: Date.now()
    };

    this.queue.push(record);
    this.remember(record);
    if (options.dedupeKey) {
      const dedupeKey = options.dedupeKey;
      this.dedupePromises.set(
        dedupeKey,
        promise.finally(() => {
          this.dedupePromises.delete(dedupeKey);
        })
      );
    }

    this.log("debug", "task.queued", record);
    this.pump();
    return promise as Promise<T>;
  }

  cancel(taskId: string, reason = "Task was cancelled") {
    const queuedIndex = this.queue.findIndex((task) => task.id === taskId);
    if (queuedIndex >= 0) {
      const [task] = this.queue.splice(queuedIndex, 1);
      task.status = "cancelled";
      task.finishedAt = Date.now();
      task.lastError = reason;
      this.remember(task);
      task.reject(new TaskCancelledError(task.id, reason));
      this.log("warn", "task.cancelled", task, { reason });
      return true;
    }

    const active = this.active.get(taskId);
    if (!active) return false;
    active.controller.abort(new TaskCancelledError(taskId, reason));
    this.log("warn", "task.cancel_requested", active, { reason });
    return true;
  }

  async shutdown(options: { timeoutMs?: number; cancelQueued?: boolean; abortActive?: boolean } = {}) {
    this.shuttingDown = true;
    const timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);

    if (options.cancelQueued ?? true) {
      for (const task of [...this.queue]) {
        this.cancel(task.id, "Scheduler shutdown");
      }
    }

    if (options.abortActive) {
      for (const task of this.active.values()) {
        task.controller.abort(new TaskCancelledError(task.id, "Scheduler shutdown"));
      }
    }

    const startedAt = Date.now();
    while (this.active.size > 0 && Date.now() - startedAt < timeoutMs) {
      await sleep(25);
    }

    return this.getHealth();
  }

  getHealth(): TaskSchedulerHealth {
    return {
      name: this.name,
      status: this.shuttingDown ? "shutting_down" : this.active.size >= this.maxConcurrent || this.queue.length > 0 ? "busy" : "healthy",
      maxConcurrent: this.maxConcurrent,
      active: this.active.size,
      queued: this.queue.length,
      locks: Array.from(this.locks.keys()),
      recentTasks: Array.from(this.history.values()).slice(-20)
    };
  }

  private pump() {
    while (!this.shuttingDown && this.active.size < this.maxConcurrent) {
      const nextIndex = this.findNextRunnableIndex();
      if (nextIndex < 0) return;
      const [task] = this.queue.splice(nextIndex, 1);
      void this.start(task);
    }
  }

  private findNextRunnableIndex() {
    this.queue.sort((first, second) => {
      const priorityDelta = priorityWeight[second.priority] - priorityWeight[first.priority];
      return priorityDelta || first.sequence - second.sequence;
    });

    for (const [index, task] of this.queue.entries()) {
      const blockedBy = this.blockingDependency(task);
      if (blockedBy === "waiting") continue;
      if (typeof blockedBy === "string") {
        this.queue.splice(index, 1);
        task.status = "blocked";
        task.finishedAt = Date.now();
        task.lastError = `Dependency failed: ${blockedBy}`;
        this.remember(task);
        task.reject(new TaskDependencyError(task.id, blockedBy));
        continue;
      }

      if (task.lockKey && this.locks.has(task.lockKey)) continue;
      return index;
    }

    return -1;
  }

  private blockingDependency(task: TaskRecord): false | "waiting" | string {
    for (const dependencyId of task.dependencies) {
      const dependency = this.history.get(dependencyId);
      if (dependency?.status === "succeeded" || dependency?.status === "recovered") continue;
      if (dependency && dependency.status !== "queued" && dependency.status !== "running") return dependencyId;
      if (this.active.has(dependencyId) || this.queue.some((queued) => queued.id === dependencyId)) return "waiting";
      return dependencyId;
    }

    return false;
  }

  private async start(task: TaskRecord) {
    task.status = "running";
    task.startedAt = Date.now();
    if (task.lockKey) this.locks.set(task.lockKey, task.id);
    this.active.set(task.id, task);
    this.remember(task);
    this.log("info", "task.started", task);

    try {
      const result = await this.execute(task);
      task.status = "succeeded";
      task.resolve(result);
      this.log("info", "task.succeeded", task);
    } catch (error) {
      if (task.fallback) {
        try {
          const fallbackResult = await task.fallback(error, {
            taskId: task.id,
            name: task.name,
            attempts: task.attempts,
            signal: task.controller.signal,
            throwIfAborted: () => throwIfTaskAborted(task.controller.signal, task.id)
          });
          task.status = "recovered";
          task.resolve(fallbackResult);
          this.log("warn", "task.recovered", task, { error: errorMessage(error) });
        } catch (fallbackError) {
          this.failTask(task, fallbackError);
        }
      } else {
        this.failTask(task, error);
      }
    } finally {
      task.finishedAt = Date.now();
      if (task.lockKey && this.locks.get(task.lockKey) === task.id) this.locks.delete(task.lockKey);
      this.active.delete(task.id);
      this.remember(task);
      this.pump();
    }
  }

  private failTask(task: TaskRecord, error: unknown) {
    task.lastError = errorMessage(error);
    task.status = error instanceof TaskTimeoutError ? "timed_out" : error instanceof TaskCancelledError ? "cancelled" : "failed";
    task.reject(error);
    this.log(task.status === "cancelled" ? "warn" : "error", `task.${task.status}`, task, { error: task.lastError });
  }

  private async execute(task: TaskRecord) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= task.retry.maxAttempts; attempt += 1) {
      task.attempts = attempt;
      const attemptController = new AbortController();
      const linked = linkSignals([task.controller.signal, task.signal, attemptController.signal]);
      const timeout = setTimeout(() => {
        attemptController.abort(new TaskTimeoutError(task.id, task.timeoutMs));
      }, task.timeoutMs);

      try {
        throwIfTaskAborted(linked.signal, task.id);
        const result = await task.handler({
          taskId: task.id,
          name: task.name,
          attempt,
          signal: linked.signal,
          throwIfAborted: () => throwIfTaskAborted(linked.signal, task.id)
        });
        throwIfTaskAborted(linked.signal, task.id);
        return result;
      } catch (error) {
        lastError = normalizeAbortError(error, linked.signal, task.id);
        task.lastError = errorMessage(lastError);
        this.remember(task);

        const retryable = attempt < task.retry.maxAttempts && (task.retry.retryOn?.(lastError, attempt) ?? isRetryableTaskError(lastError));
        if (!retryable) throw lastError;

        const delayMs = retryDelay(task.retry, attempt);
        this.log("warn", "task.retry", task, { attempt, delayMs, error: task.lastError });
        await delay(delayMs, task.controller.signal, task.id);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error(`Task ${task.id} failed`);
  }

  private isLockContended(lockKey: string) {
    return this.locks.has(lockKey) || this.queue.some((task) => task.lockKey === lockKey);
  }

  private remember(task: TaskRecord) {
    this.history.set(task.id, {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      lockKey: task.lockKey,
      dedupeKey: task.dedupeKey,
      dependencies: task.dependencies,
      attempts: task.attempts,
      queuedAt: new Date(task.queuedAt).toISOString(),
      startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : undefined,
      finishedAt: task.finishedAt ? new Date(task.finishedAt).toISOString() : undefined,
      durationMs: task.startedAt && task.finishedAt ? task.finishedAt - task.startedAt : undefined,
      lastError: task.lastError,
      metadata: task.metadata
    });

    if (this.history.size <= this.maxHistory) return;
    const firstKey = this.history.keys().next().value as string | undefined;
    if (firstKey) this.history.delete(firstKey);
  }

  private log(level: TaskLogEvent["level"], event: string, task: TaskRecord, details?: Record<string, unknown>) {
    this.logger?.({
      level,
      event,
      scheduler: this.name,
      taskId: task.id,
      taskName: task.name,
      message: task.lastError,
      details
    });
  }
}

function linkSignals(signals: Array<AbortSignal | undefined>) {
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      abort(signal);
      continue;
    }
    signal.addEventListener("abort", () => abort(signal), { once: true });
  }

  return controller;
}

function normalizeAbortError(error: unknown, signal: AbortSignal, taskId: string) {
  if (!signal.aborted) return error;
  if (signal.reason instanceof Error) return signal.reason;
  return new TaskCancelledError(taskId, typeof signal.reason === "string" ? signal.reason : "Task was aborted");
}

function isRetryableTaskError(error: unknown) {
  return !(error instanceof TaskConflictError) && !(error instanceof TaskTimeoutError) && !(error instanceof TaskCancelledError) && !(error instanceof TaskDependencyError);
}

function retryDelay(retry: Required<Omit<TaskRetryPolicy, "retryOn">>, attempt: number) {
  const exponentialDelay = retry.baseDelayMs * Math.pow(retry.backoffFactor, attempt - 1);
  return Math.min(retry.maxDelayMs, exponentialDelay);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delay(ms: number, signal: AbortSignal, taskId: string) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason instanceof Error ? signal.reason : new TaskCancelledError(taskId));
      },
      { once: true }
    );
  });
}
