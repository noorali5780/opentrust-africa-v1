import { ensureDemoWorkspace } from "@/lib/demo-bootstrap";
import { ok, problem } from "@/lib/json";
import { authorizeMutation, rateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const limited = rateLimit(request, "bootstrap", 10, 60_000);
  if (limited) return limited;

  const denied = await authorizeMutation(request);
  if (denied) return denied;

  try {
    const workspace = await ensureDemoWorkspace();

    return ok({
      issuer: {
        id: workspace.issuer.id,
        name: workspace.issuer.name,
        verified: workspace.issuer.verified
      },
      template: {
        id: workspace.template.id,
        name: workspace.template.name,
        type: workspace.template.type
      },
      holder: {
        id: workspace.holder.id,
        displayName: workspace.holder.displayName,
        email: workspace.holder.email
      },
      demoRecordId: workspace.demoRecord.id
    });
  } catch (error) {
    return problem(
      "Persistent database is not ready",
      503,
      process.env.NODE_ENV === "production"
        ? undefined
        : "Set DATABASE_URL, run prisma:migrate, then retry the bootstrap endpoint."
    );
  }
}
