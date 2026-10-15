import { beforeEach, describe, expect, it, vi } from "vitest";
import { memory, memoryCentral, resetMemory, routeContext, stubEnv, TEST_ENV } from "./helpers";

vi.mock("@/lib/central/server", () => ({ adminCentral: memoryCentral }));

const { POST } = await import("@/app/api/mcp/[secret]/route");

let nextId = 1;

async function rpc(method: string, params: Record<string, unknown> = {}, secret = TEST_ENV.MCP_SECRET, query = "") {
  const request = new Request(`https://central.exemplo.com/api/mcp/${secret}${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const response = await POST(request, routeContext({ secret }));
  const text = await response.text();
  const payload = text.startsWith("{")
    ? text
    : text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .at(-1);
  return { status: response.status, body: payload ? JSON.parse(payload) : null };
}

beforeEach(() => {
  stubEnv();
  resetMemory();
});

describe("autenticação do MCP", () => {
  it("responde 404 quando o segredo do caminho está errado", async () => {
    const { status } = await rpc("tools/list", {}, "segredo-errado");
    expect(status).toBe(404);
  });

  it("aceita o segredo correto", async () => {
    const { status, body } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    expect(status).toBe(200);
    expect(body.result.serverInfo.name).toBe("3c-os");
  });
});

describe("ferramentas", () => {
  it("lista as ferramentas com readOnlyHint correto", async () => {
    const { body } = await rpc("tools/list");
    const tools = body.result.tools as { name: string; annotations: { readOnlyHint: boolean } }[];
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations.readOnlyHint]));

    expect(byName).toEqual({
      obter_briefing: true,
      listar_areas: true,
      ler_area: true,
      ler_registro: true,
      buscar: true,
      ver_agenda: true,
      listar_tarefas: true,
      salvar_registro: false,
      atualizar_resumo: false,
      editar_registro: false,
    });
  });

  it("salva registro com fonte claude", async () => {
    const { body } = await rpc("tools/call", {
      name: "salvar_registro",
      arguments: { area_slug: "axial", titulo: "Contexto da Axial", conteudo: "Stack: Next.js", tipo: "contexto" },
    });
    expect(body.result.isError).toBeFalsy();
    expect(JSON.parse(body.result.content[0].text).area_criada).toBe(true);
    expect(memory.repo.entries[0].source).toBe("claude");
  });

  it("usa a fonte da query string quando informada", async () => {
    await rpc("tools/call", { name: "salvar_registro", arguments: { titulo: "Via Cursor" } }, TEST_ENV.MCP_SECRET, "?fonte=cursor");
    expect(memory.repo.entries.at(-1)?.source).toBe("cursor");
  });

  it("devolve erro legível para área inexistente", async () => {
    const { body } = await rpc("tools/call", { name: "ler_area", arguments: { slug: "nao-existe" } });
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("listar_areas");
  });
});

describe("fonte pelo cliente", () => {
  it("identifica o ChatGPT pelo user-agent", async () => {
    const request = new Request(`https://central.exemplo.com/api/mcp/${TEST_ENV.MCP_SECRET}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        "user-agent": "openai-mcp/1.0.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "tools/call",
        params: { name: "salvar_registro", arguments: { titulo: "Do ChatGPT" } },
      }),
    });
    await (await POST(request, routeContext({ secret: TEST_ENV.MCP_SECRET }))).text();
    expect(memory.repo.entries.at(-1)?.source).toBe("chatgpt");
  });
});
