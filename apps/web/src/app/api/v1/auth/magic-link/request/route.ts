import { z } from "zod";
import { createShareToken, hashToken } from "@opentrust/core/proof-ledger";
import { prisma } from "@/lib/prisma";
import { ok, readJson } from "@/lib/json";
import { rateLimit } from "@/lib/request-security";

const requestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).optional()
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "magic-link-request", 5, 60_000);
  if (limited) return limited;

  const parsed = await readJson(request, requestSchema);
  if ("response" in parsed) return parsed.response;

  const token = createShareToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const user = await prisma.user.upsert({
    where: { email: parsed.data.email },
    create: {
      email: parsed.data.email,
      name: parsed.data.name
    },
    update: {
      name: parsed.data.name
    }
  });

  await prisma.magicLinkToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  return ok({
    message: "Development magic link token created",
    token,
    expiresAt: expiresAt.toISOString()
  });
}
