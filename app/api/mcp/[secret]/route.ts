import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { adminCentral } from "@/lib/central/server";
import { SOURCES, type Source } from "@/lib/central/schemas";
import { serverEnv } from "@/lib/env";
import { clientIp, safeEqual } from "@/lib/http/auth";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { MCP_INSTRUCTIONS, registerCentralTools } from "@/lib/mcp/server";

const mcpHandler = createMcpHandler((server) => registerCentralTools(server, adminCentral), {
  serverInfo: { name: "3c-os", version: "2.0.0" },
  instructions: MCP_INSTRUCTIONS,
});

const rateLimit = createRateLimiter({ limit: 120, windowMs: 60_000 });

function sourceFor(request: Request): Source {
  const requested = new URL(request.url).searchParams.get("fonte");
  const explicit = SOURCES.find((s) => s === requested && s !== "manual");
  if (explicit) return explicit;
  const agent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  if (/openai|chatgpt/.test(agent)) return "chatgpt";
  if (/cursor/.test(agent)) return "cursor";
  return "claude";
}

// Path-secret auth keeps the personal connector simple; swapping to OAuth means
// replacing this check with mcp-handler's withMcpAuth and a token verifier.
async function handler(request: Request, { params }: RouteContext<"/api/mcp/[secret]">) {
  const { secret } = await params;
  if (!safeEqual(secret, serverEnv.mcpSecret)) {
    return new Response("Not found", { status: 404 });
  }

  const limited = rateLimit(`mcp:${clientIp(request)}`);
  if (!limited.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSeconds) },
    });
  }

  const rpcMethod = request.method === "POST" ? await request.clone().json().then((body) => body?.method, () => null) : null;
  console.info(`[mcp] ${request.method} ${rpcMethod ?? "-"} ua=${request.headers.get("user-agent")?.slice(0, 60) ?? "-"}`);

  const source = sourceFor(request);
  const auth: AuthInfo = { token: "path-secret", clientId: source, scopes: [] };
  Object.assign(request, { auth });
  return mcpHandler(request);
}

export { handler as GET, handler as POST, handler as DELETE };
