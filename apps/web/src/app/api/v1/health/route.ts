import { prisma } from "@/lib/prisma";
import { ok, problem } from "@/lib/json";
import { operationHealth } from "@/lib/operation-control";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({
      status: "healthy",
      checkedAt,
      services: {
        database: "healthy",
        schedulers: operationHealth()
      }
    });
  } catch (error) {
    return problem("Health check failed", 503, {
      checkedAt,
      services: {
        database: "unavailable",
        schedulers: operationHealth()
      },
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
