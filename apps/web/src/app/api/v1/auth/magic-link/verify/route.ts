import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createShareToken, hashToken } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { problem, readJson } from "@/lib/json";
import { rateLimit } from "@/lib/request-security";
import { runApiOperation, taskLockKey } from "@/lib/operation-control";

const verifySchema = z.object({
  token: z.string().min(16)
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "magic-link-verify", 10, 60_000);
  if (limited) return limited;

  const parsed = await readJson(request, verifySchema);
  if ("response" in parsed) return parsed.response;

  const tokenHash = hashToken(parsed.data.token);
  return runApiOperation(
    request,
    {
      name: "auth.magic_link.verify",
      priority: "high",
      lockKey: taskLockKey("magic-link-token", tokenHash),
      timeoutMs: 8_000
    },
    async ({ throwIfAborted }) => {
      throwIfAborted();
      const magicToken = await prisma.magicLinkToken.findUnique({
        where: { tokenHash },
        include: { user: true }
      });

      if (!magicToken || magicToken.usedAt || magicToken.expiresAt.getTime() < Date.now()) {
        return problem("Magic link token is invalid or expired", 401);
      }

      const sessionToken = createShareToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.$transaction([
        prisma.magicLinkToken.update({
          where: { id: magicToken.id },
          data: { usedAt: new Date() }
        }),
        prisma.session.create({
          data: {
            userId: magicToken.userId,
            tokenHash: hashToken(sessionToken),
            expiresAt
          }
        })
      ]);

      const response = NextResponse.json({
        user: {
          id: magicToken.user.id,
          email: magicToken.user.email,
          name: magicToken.user.name
        },
        expiresAt: expiresAt.toISOString()
      });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Request-Id", randomUUID());

      response.cookies.set("ota_session", sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        expires: expiresAt,
        path: "/"
      });

      return response;
    }
  );
}
