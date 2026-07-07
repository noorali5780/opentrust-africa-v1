import { z } from "zod";

export const offlineQueueItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["issue_record", "revoke_record", "open_dispute", "create_consent"]),
  payload: z.unknown(),
  createdAt: z.string().datetime(),
  attempts: z.number().int().min(0).default(0),
  lastError: z.string().optional()
});

export type OfflineQueueItem = z.infer<typeof offlineQueueItemSchema>;

export function enqueueOfflineItem(queue: OfflineQueueItem[], item: Omit<OfflineQueueItem, "attempts">): OfflineQueueItem[] {
  return [...queue, { ...item, attempts: 0 }];
}

export function markOfflineAttempt(queue: OfflineQueueItem[], id: string, lastError?: string): OfflineQueueItem[] {
  return queue.map((item) => (item.id === id ? { ...item, attempts: item.attempts + 1, lastError } : item));
}

export function removeOfflineItem(queue: OfflineQueueItem[], id: string): OfflineQueueItem[] {
  return queue.filter((item) => item.id !== id);
}
