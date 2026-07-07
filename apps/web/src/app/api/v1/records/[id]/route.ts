import { prisma } from "@/lib/prisma";
import { ok, problem } from "@/lib/json";
import { publicTrustRecordSelect } from "@/lib/api-shapes";
import { authorizeMutation, authorizeRecordAccess, rateLimit } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = rateLimit(request, "record-detail-read", 120, 60_000);
  if (limited) return limited;

  const authenticated = await authorizeMutation(request);
  if (authenticated) return authenticated;

  const { id } = await context.params;
  const accessRecord = await prisma.trustRecord.findUnique({
    where: { id },
    select: { issuerId: true, holderId: true }
  });

  if (!accessRecord) return problem("Record not found", 404);

  const denied = await authorizeRecordAccess(request, accessRecord);
  if (denied) return denied;

  const record = await prisma.trustRecord.findUnique({
    where: { id },
    select: publicTrustRecordSelect
  });
  if (!record) return problem("Record not found", 404);

  return ok({ record });
}
