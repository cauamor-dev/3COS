import fs from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const base = (
  process.env.CENTRAL_TEST_URL ??
  "https://codex-evolution-preview--central3c-caua.netlify.app"
).replace(/\/$/, "");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const evidence = [];
const testRunKey=String(Date.now());
function check(name, condition) {
  evidence.push({ name, passed: !!condition });
  if (!condition) throw new Error(`Falhou: ${name}`);
}
async function table(result) {
  if (result.error)
    throw new Error(
      `Preparação de teste falhou (${result.error.code}); dados omitidos`,
    );
  return result.data;
}
const users = await db.auth.admin.listUsers({ page: 1, perPage: 100 });
const owner = users.data.users.find(
  (u) => u.email?.toLowerCase() === process.env.ALLOWED_EMAIL.toLowerCase(),
);
if (!owner) throw new Error("Proprietário Auth não encontrado.");
let area = await table(
  await db
    .from("areas")
    .select("id,slug")
    .eq("slug", "validacao-3c")
    .maybeSingle(),
);
if (!area)
  area = await table(
    await db
      .from("areas")
      .insert({
        slug: "validacao-3c",
        name: "Validação operacional 3C",
        kind: "projeto",
        summary_md:
          "Testes operacionais identificados. Não representam clientes, vagas ou execuções de outras IAs.",
        updated_by: "codex",
      })
      .select("id,slug")
      .single(),
  );
const agent = await table(
  await db.from("agents").select("id").eq("handle", "codex").single(),
);
await fs.mkdir(".private-backups", { recursive: true });
let credential;
try {
  credential = JSON.parse(
    await fs.readFile(".private-backups/smoke-client.json", "utf8"),
  );
} catch {
  const token = `c3c_${randomBytes(32).toString("hex")}`;
  const client = await table(
    await db
      .from("integration_clients")
      .insert({
        name: "Codex — validação operacional",
        owner_id: owner.id,
        source: "codex",
        agent_id: agent.id,
        token_hash: createHash("sha256").update(token).digest("hex"),
        token_prefix: token.slice(0, 12),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select("id")
      .single(),
  );
  credential = { id: client.id, token };
  await fs.writeFile(
    ".private-backups/smoke-client.json",
    JSON.stringify(credential),
    { mode: 0o600 },
  );
}
await table(
  await db
    .from("client_area_grants")
    .upsert(
      {
        client_id: credential.id,
        area_id: area.id,
        operations: ["read", "write", "team", "files", "execute"],
      },
      { onConflict: "client_id,area_id" },
    ),
);
async function call(route, method = "GET", body, extra = {}) {
  return fetch(`${base}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${credential.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
}
async function json(route, method = "GET", body) {
  const r = await call(route, method, body);
  if (!r.ok)
    throw new Error(
      `HTTP ${r.status} no teste ${route.replace(/[0-9a-f-]{36}/g, "[id]")}; resposta privada omitida`,
    );
  return r.json();
}
const originalControl = await table(
  await db.from("execution_control").select("paused").eq("id", true).single(),
);
try {
  const areas = await json("/api/v1/areas");
  check(
    "REST lista somente área concedida",
    areas.areas.length === 1 && areas.areas[0].slug === area.slug,
  );
  const denied = await call(
    "/api/v1/entries/86a4b8dc-bb95-477f-9664-8badbcaea50a",
  );
  check(
    "Nota real sensível negada sem ler conteúdo",
    denied.status === 404 || denied.status === 403,
  );
  await denied.body?.cancel();
  const saved = await call(
    "/api/v1/entries",
    "POST",
    {
      area_slug: area.slug,
      titulo: "Validação Codex — REST",
      conteudo:
        "Execução real do script de validação pelo Codex. Dados de teste, sem envio externo.",
      origin_chat_title: "Implementação 3C OS — validação operacional",
    },
    { "x-central-fonte": "claude" },
  );
  check("Escrita real aceita", saved.ok);
  const entry = (await saved.json()).registro;
  check("Fonte forjada ignorada", entry.fonte === "codex");
  let thread = await table(
    await db
      .from("team_threads")
      .select("id")
      .eq("title", "Validação operacional")
      .maybeSingle(),
  );
  if (!thread)
    thread = await table(
      await db
        .from("team_threads")
        .insert({
          title: "Validação operacional",
          area_id: area.id,
          owner_id: owner.id,
        })
        .select("id")
        .single(),
    );
  const posted = await json("/api/team/equipe_mensagem", "POST", {
    thread_id: thread.id,
    body: "Codex executou os testes REST desta entrega. Nenhuma resposta está atribuída a Grok, Vega ou Nox.",
    entry_id: entry.id,
    origin_chat_title: "Implementação 3C OS",
    idempotency_key: `smoke-message-${testRunKey}`,
  });
  check("Mensagem com identidade real registrada", !!posted.id);
  const job = await json("/api/team/equipe_trabalho", "POST", {
    area_slug: area.slug,
    objective: "Validar leitura, posse e entrega operacional do Codex",
    assigned_agent: "codex",
    workflow_key: "code_demo",
    expected_output: "Relatório de checks com evidências HTTP",
    acceptance_criteria:
      "Identidade correta, negação de área privada, posse única e resultado rastreável",
    idempotency_key: `smoke-work-${testRunKey}`,
  });
  const repeated = await json("/api/team/equipe_trabalho", "POST", {
    area_slug: area.slug,
    objective: "Validar leitura, posse e entrega operacional do Codex",
    assigned_agent: "codex",
    workflow_key: "code_demo",
    expected_output: "Relatório de checks com evidências HTTP",
    acceptance_criteria:
      "Identidade correta, negação de área privada, posse única e resultado rastreável",
    idempotency_key: `smoke-work-${testRunKey}`,
  });
  check(
    "Repetição não duplica tarefa/fila",
    job.entry_id === repeated.entry_id,
  );
  await table(
    await db.from("agents").update({ active: true }).eq("id", agent.id),
  );
  await table(
    await db.from("execution_control").update({ paused: false }).eq("id", true),
  );
  const runs = await json("/api/team/equipe_assumir", "POST", {
    entry_id: job.entry_id,
  });
  const run = runs[0];
  check("Executor autenticado adquire posse", !!run?.lease_token);
  if (run) {
    const lease = {
      run_id: run.id,
      lease_token: run.lease_token,
      fencing_token: Number(run.fencing_token),
    };
    await json("/api/team/equipe_heartbeat", "POST", {
      ...lease,
      checkpoint: { step: "http_checks_verified" },
    });
    await json("/api/team/equipe_entregar", "POST", {
      ...lease,
      status: "delivered",
      result: {
        summary:
          "Codex verificou REST, autoria, privacidade, mensagem e aquisição idempotente nesta chamada real. Sem chamada a outra IA e sem envio externo.",
        evidence: [
          {
            url: `https://codex-evolution-preview--central3c-caua.netlify.app/registros/${entry.id}`,
            title: "Registro criado pela chamada REST autenticada",
          },
        ],
      },
    });
    check("Entrega real aceita com posse e evidência", true);
  }
  const mcp = await call(
    "/api/mcp",
    "POST",
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "codex-3c-validation", version: "1.0" },
      },
    },
    { accept: "application/json, text/event-stream" },
  );
  check("MCP Bearer responde ao handshake", mcp.ok);
  await mcp.body?.cancel();
  await table(
    await db
      .from("integration_status")
      .update({
        status: base.startsWith("https:")?"verified":"configured_unverified",
        connection_mode:base.startsWith("https:")?"https_tested_executor":"local_http_tested_remote_pending",
        capabilities: ["read_queue", "claim", "report", "read", "write"],
        last_checked_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        error_code: null,
      })
      .eq("provider", "codex"),
  );
} finally {
  await db
    .from("execution_control")
    .update({ paused: originalControl.paused })
    .eq("id", true);
  await fs.mkdir(".local-reports", { recursive: true });
  await fs.writeFile(
    ".local-reports/integration-smoke.json",
    JSON.stringify(
      {
        tested_at: new Date().toISOString(),
        url: base,
        evidence,
        external_ai_handoff: false,
        scope:
          "Codex executor → Central; outras plataformas não foram simuladas",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      url: base,
      checks: evidence,
      external_ai_handoff: false,
      dispatcher_paused: originalControl.paused,
    }),
  );
}
