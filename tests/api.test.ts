import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryCentral, resetMemory, routeContext, stubEnv, TEST_ENV, memory } from "./helpers";

vi.mock("@/lib/central/server", () => ({ adminCentral: memoryCentral }));

const { GET, POST, PATCH, PUT } = await import("@/app/api/v1/[...path]/route");
const { GET: getOpenApi } = await import("@/app/api/v1/openapi.json/route");

const BASE = "https://central.exemplo.com/api/v1";

function call(
  handler: typeof GET,
  method: string,
  path: string[],
  { token = TEST_ENV.API_KEY, body, query = "" }: { token?: string | null; body?: unknown; query?: string } = {},
) {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": "10.0.0.1" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const request = new Request(`${BASE}/${path.join("/")}${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handler(request, routeContext({ path }));
}

beforeEach(() => {
  stubEnv();
  resetMemory();
});

describe("autenticação da API", () => {
  it("recusa sem token", async () => {
    const response = await call(GET, "GET", ["briefing"], { token: null });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("recusa token errado", async () => {
    const response = await call(GET, "GET", ["briefing"], { token: "errado" });
    expect(response.status).toBe(401);
  });

  it("aceita a API key correta", async () => {
    const response = await call(GET, "GET", ["briefing"]);
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("areas_ativas");
  });
});

describe("rotas", () => {
  it("salva registro com fonte chatgpt e lê a área criada", async () => {
    const saved = await call(POST, "POST", ["entries"], {
      body: { area_slug: "axial", titulo: "Deploy feito", conteudo: "Subiu na Vercel", tipo: "progresso" },
    });
    expect(saved.status).toBe(200);
    expect(memory.repo.entries[0].source).toBe("chatgpt");

    const area = await call(GET, "GET", ["areas", "axial"], { query: "?limite_registros=5" });
    const body = await area.json();
    expect(body.registros[0].titulo).toBe("Deploy feito");
  });

  it("atualiza resumo pelo caminho e edita registro", async () => {
    await call(PUT, "PUT", ["areas", "orion", "summary"], { body: { resumo: "Sistema acadêmico" } });
    expect(memory.repo.areas[0].summary_md).toBe("Sistema acadêmico");

    await call(POST, "POST", ["entries"], { body: { area_slug: "orion", titulo: "T" } });
    const id = memory.repo.entries[0].id;
    const edited = await call(PATCH, "PATCH", ["entries", id], { body: { arquivado: true } });
    expect(edited.status).toBe(200);
    expect(memory.repo.entries[0].archived).toBe(true);
  });

  it("retorna 400 com mensagem para entrada inválida e 404 para área inexistente", async () => {
    const invalid = await call(POST, "POST", ["entries"], { body: { titulo: "" } });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("invalid");

    const missing = await call(GET, "GET", ["areas", "nada"]);
    expect(missing.status).toBe(404);
  });

  it("responde 405 para método errado e 404 para rota desconhecida", async () => {
    expect((await call(PATCH, "PATCH", ["briefing"])).status).toBe(405);
    expect((await call(GET, "GET", ["nada"])).status).toBe(404);
  });
});

describe("OpenAPI", () => {
  it("gera 3.1 com operationId em todas as operações e servidor da env", async () => {
    const spec = await (getOpenApi() as Response).json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.servers[0].url).toBe(`${TEST_ENV.NEXT_PUBLIC_APP_URL}/api/v1`);

    const ops = Object.values(spec.paths).flatMap((methods) => Object.values(methods as Record<string, { operationId: string; description: string }>));
    expect(ops).toHaveLength(8);
    for (const op of ops) {
      expect(op.operationId).toMatch(/^[a-zA-Z]+$/);
      expect(op.description.length).toBeLessThanOrEqual(300);
    }
    expect(JSON.stringify(spec)).not.toContain("anyOf");
  });
});
