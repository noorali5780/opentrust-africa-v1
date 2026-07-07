import { ZodError, type ZodSchema } from "zod";

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function problem(message: string, status = 400, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export async function readJson<T>(request: Request, schema: ZodSchema<T>): Promise<{ data: T } | { response: Response }> {
  try {
    const body = await request.json();
    return { data: schema.parse(body) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { response: problem("Invalid request body", 422, error.flatten()) };
    }
    return { response: problem("Request body must be valid JSON", 400) };
  }
}
