import { allowedMethods, matchOperation } from "@/lib/api/router";
import { describeError } from "@/lib/central/format-error";
import { SOURCES, type Source } from "@/lib/central/schemas";
import { adminCentral } from "@/lib/central/server";
import { serverEnv } from "@/lib/env";
import { bearerToken, clientIp, safeEqual } from "@/lib/http/auth";
import { createRateLimiter } from "@/lib/http/rate-limit";

const rateLimit = createRateLimiter({ limit: 60, windowMs: 60_000 });

function errorResponse(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

function sourceFrom(request: Request): Source {
  const requested = request.headers.get("x-central-fonte");
  return SOURCES.find((s) => s === requested && s !== "manual") ?? "chatgpt";
}

async function readInput(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET") return Object.fromEntries(new URL(request.url).searchParams);
  const text = await request.text();
  if (!text.trim()) return {};
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SyntaxError("Body deve ser um objeto.");
  return body as Record<string, unknown>;
}

async function handler(request: Request, { params }: RouteContext<"/api/v1/[...path]">) {
  if (!safeEqual(bearerToken(request), serverEnv.apiKey)) {
    return errorResponse(401, "unauthorized", "API key ausente ou inválida.", { "WWW-Authenticate": "Bearer" });
  }

  const limited = rateLimit(`api:${clientIp(request)}`);
  if (!limited.ok) {
    return errorResponse(429, "rate_limited", "Muitas requisições. Aguarde um pouco.", {
      "Retry-After": String(limited.retryAfterSeconds),
    });
  }

  const { path } = await params;
  const match = matchOperation(request.method, path);
  if (!match) {
    const allowed = allowedMethods(path);
    return allowed.length > 0
      ? errorResponse(405, "method_not_allowed", "Método não suportado.", { Allow: allowed.join(", ") })
      : errorResponse(404, "not_found", "Rota não encontrada.");
  }

  let input: Record<string, unknown>;
  try {
    input = { ...(await readInput(request)), ...match.pathParams };
  } catch {
    return errorResponse(400, "invalid", "JSON inválido no corpo da requisição.");
  }

  try {
    const result = await match.operation.run(adminCentral(), input, sourceFrom(request));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const { status, code, message } = describeError(error);
    return errorResponse(status, code, message);
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH };
