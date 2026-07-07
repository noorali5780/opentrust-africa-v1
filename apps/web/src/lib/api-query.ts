import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional()
});

export function parsePagination(request: Request) {
  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined
  });

  return parsed.success ? parsed.data : { limit: 25, cursor: undefined };
}

export function pageInfo<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const visible = hasMore ? items.slice(0, limit) : items;

  return {
    items: visible,
    nextCursor: hasMore ? visible.at(-1)?.id ?? null : null
  };
}
