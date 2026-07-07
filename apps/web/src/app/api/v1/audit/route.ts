import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/json";

export async function GET() {
  const anchors = await prisma.auditAnchor.findMany({
    orderBy: { sequence: "desc" },
    take: 100,
    include: {
      issuer: {
        select: {
          id: true,
          name: true,
          verified: true
        }
      }
    }
  });

  return ok({ anchors });
}
