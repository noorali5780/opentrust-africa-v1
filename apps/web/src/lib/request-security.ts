import { hashToken, constantTimeEqual } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { problem } from "@/lib/json";

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip");
  return `${scope}:${forwardedFor || realIp || "local"}`;
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function rateLimit(request: Request, scope: string, limit = 60, windowMs = 60_000) {
  const key = getClientKey(request, scope);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return problem("Too many requests", 429);
  }

  return null;
}

export async function authorizeMutation(request: Request) {
  const shouldEnforce = process.env.NODE_ENV === "production" || process.env.ENFORCE_API_AUTH === "true";
  if (!shouldEnforce) return null;

  const configuredApiKey = process.env.OPEN_TRUST_API_KEY;
  const suppliedApiKey = request.headers.get("x-opentrust-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (configuredApiKey && suppliedApiKey && constantTimeEqual(configuredApiKey, suppliedApiKey)) {
    return null;
  }

  const sessionToken = readCookie(request, "ota_session");
  if (!sessionToken) return problem("Authentication required", 401);

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) }
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      return problem("Authentication required", 401);
    }

    return null;
  } catch {
    return problem("Authentication backend unavailable", 503);
  }
}
