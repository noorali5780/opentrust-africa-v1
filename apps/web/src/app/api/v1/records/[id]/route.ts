import { prisma } from "@/lib/prisma";
import { ok, problem } from "@/lib/json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const record = await prisma.trustRecord.findUnique({
    where: { id },
    include: {
      issuer: {
        select: { id: true, name: true, verified: true }
      },
      holder: {
        select: { id: true, displayName: true, email: true }
      },
      consentGrants: {
        orderBy: { createdAt: "desc" }
      },
      verificationEvents: {
        orderBy: { createdAt: "desc" }
      },
      revocation: true,
      disputes: {
        orderBy: { createdAt: "desc" }
      },
      auditAnchors: {
        orderBy: { sequence: "desc" }
      }
    }
  });

  if (!record) return problem("Record not found", 404);

  return ok({ record });
}
