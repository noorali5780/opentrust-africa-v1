import { describe, expect, it } from "vitest";
import { TaskCancelledError, TaskConflictError, TaskScheduler, TaskTimeoutError } from "./task-control";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("task control scheduler", () => {
  it("serializes tasks that share a lock", async () => {
    const scheduler = new TaskScheduler({ name: "test-locks", maxConcurrent: 3 });
    let active = 0;
    let maxActive = 0;

    await Promise.all([
      scheduler.run(
        async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await sleep(10);
          active -= 1;
          return "a";
        },
        { lockKey: "record:1" }
      ),
      scheduler.run(
        async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await sleep(10);
          active -= 1;
          return "b";
        },
        { lockKey: "record:1" }
      )
    ]);

    expect(maxActive).toBe(1);
  });

  it("can reject conflicting work immediately", async () => {
    const scheduler = new TaskScheduler({ name: "test-conflicts", maxConcurrent: 1 });
    const first = scheduler.run(
      async ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve("cancelled"), { once: true });
        }),
      { id: "first", lockKey: "issuer:1" }
    );

    await expect(
      scheduler.run(async () => "second", {
        lockKey: "issuer:1",
        rejectOnConflict: true
      })
    ).rejects.toBeInstanceOf(TaskConflictError);

    scheduler.cancel("first");
    await expect(first).rejects.toBeInstanceOf(TaskCancelledError);
  });

  it("deduplicates active execution by key", async () => {
    const scheduler = new TaskScheduler({ name: "test-dedupe", maxConcurrent: 2 });
    let executions = 0;
    const handler = async () => {
      executions += 1;
      await sleep(5);
      return "same-result";
    };

    const [first, second] = await Promise.all([
      scheduler.run(handler, { dedupeKey: "POST:/records:key-1" }),
      scheduler.run(handler, { dedupeKey: "POST:/records:key-1" })
    ]);

    expect(first).toBe("same-result");
    expect(second).toBe("same-result");
    expect(executions).toBe(1);
  });

  it("retries retryable failures within the configured limit", async () => {
    const scheduler = new TaskScheduler({ name: "test-retry" });
    let attempts = 0;

    const result = await scheduler.run(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("temporary");
        return "recovered";
      },
      {
        retry: {
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 1
        }
      }
    );

    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
  });

  it("uses a fallback without poisoning the scheduler", async () => {
    const scheduler = new TaskScheduler({ name: "test-fallback" });

    const result = await scheduler.run(
      async () => {
        throw new Error("primary failed");
      },
      {
        fallback: () => "fallback-result"
      }
    );

    expect(result).toBe("fallback-result");
    expect(scheduler.getHealth().recentTasks.at(-1)?.status).toBe("recovered");
  });

  it("runs dependent tasks after their dependencies complete", async () => {
    const scheduler = new TaskScheduler({ name: "test-deps", maxConcurrent: 2 });
    const order: string[] = [];

    const first = scheduler.run(
      async () => {
        await sleep(5);
        order.push("first");
        return "first";
      },
      { id: "first", priority: "low" }
    );
    const second = scheduler.run(
      async () => {
        order.push("second");
        return "second";
      },
      { id: "second", dependencies: ["first"], priority: "critical" }
    );

    await Promise.all([first, second]);

    expect(order).toEqual(["first", "second"]);
  });

  it("propagates cooperative timeout cancellation", async () => {
    const scheduler = new TaskScheduler({ name: "test-timeout" });

    await expect(
      scheduler.run(
        async ({ signal }) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
        { timeoutMs: 5 }
      )
    ).rejects.toBeInstanceOf(TaskTimeoutError);
  });

  it("supports cooperative cancellation", async () => {
    const scheduler = new TaskScheduler({ name: "test-cancel" });
    const task = scheduler.run(
      async ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
      { id: "cancel-me" }
    );

    scheduler.cancel("cancel-me");

    await expect(task).rejects.toBeInstanceOf(TaskCancelledError);
  });
});
