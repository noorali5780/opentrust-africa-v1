import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashPayload } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { problem } from "@/lib/json";

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{12,128}$/;

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function replayIdempotentResponse(request: Request, route: string, requestBody: unknown) {
  const key = request.headers.get("idempotency-key");
  if (!key) return null;

  if (!idempotencyKeyPattern.test(key)) {
    return problem("Invalid Idempotency-Key", 400);
  }

  const requestHash = hashPayload({ route, requestBody });
  const existing = await prisma.apiIdempotencyKey.findUnique({
    where: { key_route: { key, route } }
  });

  if (!existing) return null;
  if (existing.requestHash !== requestHash) {
    return problem("Idempotency-Key was reused with a different request body", 409);
  }

  return Response.json(existing.responseJson, {
    status: existing.statusCode,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Idempotency-Replayed": "true",
      "X-Request-Id": randomUUID()
    }
  });
}

export async function storeIdempotentResponse(request: Request, route: string, requestBody: unknown, responseBody: unknown, statusCode = 200) {
  const key = request.headers.get("idempotency-key");
  if (!key) return;

  const requestHash = hashPayload({ route, requestBody });
  await prisma.apiIdempotencyKey.upsert({
    where: { key_route: { key, route } },
    create: {
      key,
      route,
      requestHash,
      responseJson: jsonValue(responseBody),
      statusCode,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    update: {
      responseJson: jsonValue(responseBody),
      statusCode,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
}
