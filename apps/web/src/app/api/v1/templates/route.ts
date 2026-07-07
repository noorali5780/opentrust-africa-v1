import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, readJson } from "@/lib/json";
import { writeAuditAnchor } from "@/lib/audit";
import { authorizeMutation, rateLimit } from "@/lib/request-security";

const templateSchema = z.object({
  issuerId: z.string().min(1),
  name: z.string().min(2),
  type: z.literal("certificate").default("certificate")
});

export async function GET() {
  const templates = await prisma.recordTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { issuer: true }
  });

  return ok({ templates });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "template-write", 30, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  const parsed = await readJson(request, templateSchema);
  if ("response" in parsed) return parsed.response;

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

  return ok({ template }, { status: 201 });
}
