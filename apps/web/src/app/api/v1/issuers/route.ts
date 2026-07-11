import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, readJson, serviceUnavailable } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, rateLimit } from "@/lib/request-security";
import { pageInfo, parsePagination } from "@/lib/api-query";
import { replayIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { idempotencyDedupeKey, runApiOperation, taskLockKey } from "@/lib/operation-control";

const issuerSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  verified: z.boolean().default(false)
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "issuer-read", 120, 60_000);
  if (limited) return limited;

  const { limit, cursor } = parsePagination(request);
  try {
    const issuers = await prisma.issuer.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        verified: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            templates: true,
            records: true,
            verificationEvents: true
          }
        }
      }
    });

    const page = pageInfo(issuers, limit);

    return ok({ issuers: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    return serviceUnavailable(error);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "issuer-write", 20, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const parsed = await readJson(request, issuerSchema);
  if ("response" in parsed) return parsed.response;

  const replayed = await replayIdempotentResponse(request, "POST /api/v1/issuers", parsed.data);
  if (replayed) return replayed;

  return runApiOperation(
    request,
    {
      name: "issuer.create",
      priority: "high",
      lockKey: taskLockKey("issuer", parsed.data.slug),
      dedupeKey: idempotencyDedupeKey(request, "POST /api/v1/issuers", parsed.data),
      timeoutMs: 10_000
    },
    async ({ throwIfAborted }) => {
      throwIfAborted();
      const issuer = await prisma.issuer.create({
        data: parsed.data
      });

      await writeAuditAnchor({
        action: "issuer_created",
        issuerId: issuer.id,
        status: issuer.status,
        version: 1,
        payload: issuer
      });

      const responseBody = { issuer };
      await storeIdempotentResponse(request, "POST /api/v1/issuers", parsed.data, responseBody, 201);

      return ok(responseBody, { status: 201 });
    }
  );
}
