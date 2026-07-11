import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, readJson, serviceUnavailable } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeIssuerMutation, rateLimit } from "@/lib/request-security";
import { pageInfo, parsePagination } from "@/lib/api-query";
import { replayIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { idempotencyDedupeKey, runApiOperation, taskLockKey } from "@/lib/operation-control";

const templateSchema = z.object({
  issuerId: z.string().min(1),
  name: z.string().min(2),
  type: z.literal("certificate").default("certificate")
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "template-read", 120, 60_000);
  if (limited) return limited;

  const { limit, cursor } = parsePagination(request);
  try {
    const templates = await prisma.recordTemplate.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        issuerId: true,
        name: true,
        type: true,
        version: true,
        schemaJson: true,
        createdAt: true,
        issuer: {
          select: {
            id: true,
            name: true,
            verified: true
          }
        }
      }
    });
    const page = pageInfo(templates, limit);

    return ok({ templates: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    return serviceUnavailable(error);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "template-write", 30, 60_000);
  if (limited) return limited;

  const parsed = await readJson(request, templateSchema);
  if ("response" in parsed) return parsed.response;

  const denied = await authorizeIssuerMutation(request, parsed.data.issuerId);
  if (denied) return denied;

  const replayed = await replayIdempotentResponse(request, "POST /api/v1/templates", parsed.data);
  if (replayed) return replayed;

  return runApiOperation(
    request,
    {
      name: "template.create",
      priority: "normal",
      lockKey: taskLockKey("issuer", parsed.data.issuerId, "templates"),
      dedupeKey: idempotencyDedupeKey(request, "POST /api/v1/templates", parsed.data),
      timeoutMs: 10_000
    },
    async ({ throwIfAborted }) => {
      throwIfAborted();
      const template = await prisma.recordTemplate.create({
        data: {
          issuerId: parsed.data.issuerId,
          name: parsed.data.name,
          type: parsed.data.type,
          schemaJson: {
            requiredFields: ["holderName", "holderEmail", "achievementName", "completionDate"],
            disclosure: "verify_only"
          } satisfies Prisma.InputJsonValue
        }
      });

      await writeAuditAnchor({
        action: "template_created",
        issuerId: parsed.data.issuerId,
        status: "active",
        version: template.version,
        payload: template
      });

      const responseBody = { template };
      await storeIdempotentResponse(request, "POST /api/v1/templates", parsed.data, responseBody, 201);

      return ok(responseBody, { status: 201 });
    }
  );
}
