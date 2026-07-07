import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { ZodError, type ZodSchema } from "zod";

const defaultHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8"
};

function withRequestId(init?: ResponseInit): ResponseInit {
  return {
      ...init,
      headers: {
      ...defaultHeaders,
      "X-Request-Id": randomUUID(),
      ...init?.headers
    }
  };
}

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, withRequestId(init));
}

export function problem(message: string, status = 400, details?: unknown) {
  const body = {
    error: message,
    ...(details && process.env.NODE_ENV !== "production" ? { details } : {})
  };

  return Response.json(body, withRequestId({ status }));
}

export async function readJson<T>(
  request: Request,
  schema: ZodSchema<T>,
  options: { maxBytes?: number } = {}
): Promise<{ data: T } | { response: Response }> {
  const maxBytes = options.maxBytes ?? 64 * 1024;
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > maxBytes) {
    return { response: problem("Request body is too large", 413) };
  }

  try {
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
      return { response: problem("Request body is too large", 413) };
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    return { data: schema.parse(body) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { response: problem("Invalid request body", 422, error.flatten()) };
    }
    return { response: problem("Request body must be valid JSON", 400) };
  }
}
