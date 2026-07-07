import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, readJson } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, rateLimit } from "@/lib/request-security";

const issuerSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  verified: z.boolean().default(false)
});

export async function GET() {
  const issuers = await prisma.issuer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      templates: true,
      _count: {
        select: {
          records: true,
          verificationEvents: true
        }
      }
    }
  });

  return ok({ issuers });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "issuer-write", 20, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const parsed = await readJson(request, issuerSchema);
  if ("response" in parsed) return parsed.response;

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

  return ok({ issuer }, { status: 201 });
}
