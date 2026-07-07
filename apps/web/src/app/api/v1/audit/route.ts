import { prisma } from "@/lib/prisma";
import { ok, serviceUnavailable } from "@/lib/json";
import { publicAuditAnchorSelect } from "@/lib/api-shapes";
import { pageInfo, parsePagination } from "@/lib/api-query";
import { rateLimit } from "@/lib/request-security";

export async function GET(request: Request) {
  const limited = rateLimit(request, "audit-read", 120, 60_000);
  if (limited) return limited;

  const { limit, cursor } = parsePagination(request);
  try {
    const anchors = await prisma.auditAnchor.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ sequence: "desc" }, { id: "desc" }],
      select: publicAuditAnchorSelect
    });
    const page = pageInfo(anchors, limit);

    return ok({ anchors: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    return serviceUnavailable(error);
  }
}
