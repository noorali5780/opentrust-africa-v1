import { describe, expect, it } from "vitest";
import { enqueueOfflineItem, markOfflineAttempt, offlineQueueItemSchema, removeOfflineItem } from "./offline";

describe("offline queue", () => {
  it("queues, retries, and removes sync work", () => {
    const queued = enqueueOfflineItem([], {
      id: "draft_1",
      type: "issue_record",
      payload: { holderName: "Amina Owino" },
      createdAt: "2026-07-01T09:00:00.000Z"
    });
    const retried = markOfflineAttempt(queued, "draft_1", "network unavailable");
    const removed = removeOfflineItem(retried, "draft_1");

    expect(offlineQueueItemSchema.parse(retried[0]).attempts).toBe(1);
    expect(retried[0]?.lastError).toBe("network unavailable");
    expect(removed).toHaveLength(0);
  });
});
