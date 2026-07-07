import { hashToken, constantTimeEqual } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { problem } from "@/lib/json";

const buckets = new Map<string, { count: number; resetAt: number }>();

type RequestAuthorization =
  | { ok: true; type: "development" | "api_key" }
  | { ok: true; type: "session"; userId: string }
  | { ok: false; response: Response };

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

function shouldEnforceApiAuth() {
  return process.env.NODE_ENV === "production" || process.env.ENFORCE_API_AUTH === "true";
}

function readSuppliedApiKey(request: Request) {
  return request.headers.get("x-opentrust-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function getRequestAuthorization(request: Request): Promise<RequestAuthorization> {
  const shouldEnforce = process.env.NODE_ENV === "production" || process.env.ENFORCE_API_AUTH === "true";
  if (!shouldEnforce) return { ok: true, type: "development" };

  const configuredApiKey = process.env.OPEN_TRUST_API_KEY;
  const suppliedApiKey = readSuppliedApiKey(request);

  if (configuredApiKey && suppliedApiKey && constantTimeEqual(configuredApiKey, suppliedApiKey)) {
    return { ok: true, type: "api_key" };
  }

  const sessionToken = readCookie(request, "ota_session");
  if (!sessionToken) return { ok: false, response: problem("Authentication required", 401) };

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
      select: { userId: true, expiresAt: true }
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      return { ok: false, response: problem("Authentication required", 401) };
    }

    return { ok: true, type: "session", userId: session.userId };
  } catch {
    return { ok: false, response: problem("Authentication backend unavailable", 503) };
  }
}

export async function authorizeMutation(request: Request) {
  const authorization = await getRequestAuthorization(request);

  return authorization.ok ? null : authorization.response;
}

export async function authorizeIssuerMutation(request: Request, issuerId: string) {
  const authorization = await getRequestAuthorization(request);
  if (!authorization.ok) return authorization.response;
  if (authorization.type !== "session") return null;

  try {
    const membership = await prisma.issuerMember.findFirst({
      where: {
        userId: authorization.userId,
        issuerId,
        status: "active",
        role: { in: ["admin", "issuer_admin", "issuer_operator"] }
      }
    });

    if (!membership) return problem("Issuer access denied", 403);
    return null;
  } catch {
    return problem("Authorization backend unavailable", 503);
  }
}

export async function authorizeRecordAccess(request: Request, input: { issuerId: string; holderId: string }) {
  const authorization = await getRequestAuthorization(request);
  if (!authorization.ok) return authorization.response;
  if (authorization.type !== "session") return null;

  try {
    const issuerMembership = await prisma.issuerMember.findFirst({
      where: {
        userId: authorization.userId,
        issuerId: input.issuerId,
        status: "active",
        role: { in: ["admin", "issuer_admin", "issuer_operator"] }
      },
      select: { id: true }
    });

    if (issuerMembership) return null;

    const user = await prisma.user.findUnique({
      where: { id: authorization.userId },
      select: { email: true }
    });
    const holder = await prisma.holder.findFirst({
      where: {
        id: input.holderId,
        OR: [{ userId: authorization.userId }, ...(user?.email ? [{ email: user.email }] : [])]
      },
      select: { id: true }
    });

    return holder ? null : problem("Record access denied", 403);
  } catch {
    return problem("Authorization backend unavailable", 503);
  }
}

export async function getRecordReadScope(request: Request): Promise<
  | { all: true }
  | {
      all: false;
      issuerIds: string[];
      holderIds: string[];
    }
  | { response: Response }
> {
  const authorization = await getRequestAuthorization(request);
  if (!authorization.ok) return { response: authorization.response };
  if (authorization.type !== "session") return { all: true };

  try {
    const user = await prisma.user.findUnique({
      where: { id: authorization.userId },
      select: { email: true }
    });
    const [memberships, holders] = await Promise.all([
      prisma.issuerMember.findMany({
        where: {
          userId: authorization.userId,
          status: "active",
          role: { in: ["admin", "issuer_admin", "issuer_operator"] }
        },
        select: { issuerId: true }
      }),
      prisma.holder.findMany({
        where: {
          OR: [{ userId: authorization.userId }, ...(user?.email ? [{ email: user.email }] : [])]
        },
        select: { id: true }
      })
    ]);

    const issuerIds = memberships.map((membership) => membership.issuerId);
    const holderIds = holders.map((holder) => holder.id);
    if (issuerIds.length === 0 && holderIds.length === 0) {
      return { response: problem("Record access denied", 403) };
    }

    return { all: false, issuerIds, holderIds };
  } catch {
    return { response: problem("Authorization backend unavailable", 503) };
  }
}

export function isApiAuthEnforced() {
  return shouldEnforceApiAuth();
}
