import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { centralHost } from "./lib/netlify-central.mjs";
const action = process.argv[2] ?? "inspect";
const model = process.argv[3] ?? "openai/gpt-oss-20b";
if (!["inspect", "prepare", "evaluate", "activate", "disable"].includes(action))
  throw new Error("Ação inválida.");
if (!["openai/gpt-oss-20b", "openai/gpt-oss-120b"].includes(model))
  throw new Error("Modelo fora dos candidatos preparados.");
const host = await centralHost();
const metadata = host.metadata("GROQ_API_KEY");
const reportPath = `.local-reports/chloe-host-evaluation-${model.split("/").at(-1)}.json`;
async function fingerprint() {
  const files = JSON.parse(
    await fs.readFile("lib/chloe/evaluation-sources.json", "utf8"),
  );
  const h = createHash("sha256");
  for (const f of files)
    h.update((await fs.readFile(f, "utf8")).replace(/\r\n/g, "\n"));
  return h.digest("hex");
}
async function remote(action, case_id) {
  let credential = host.get("CRON_SECRET");
  if (!credential) {
    const { parseEnv } = await import("node:util");
    credential = parseEnv(await fs.readFile(".env.local", "utf8")).CRON_SECRET;
  }
  if (!credential) throw new Error("Credencial interna de operação ausente.");
  const r = await fetch(
    "https://central3c-caua.netlify.app/api/internal/chloe-evaluation",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, model, ...(case_id ? { case_id } : {}) }),
      signal: AbortSignal.timeout(90000),
    },
  );
  const contentType = r.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw new Error(`O teste no host precisa ser publicado (${r.status}).`);
  const result = await r.json();
  if (!result.ok) {
    console.log(
      JSON.stringify({
        status: "paused",
        error: result.error ?? "host_unavailable",
        retry_after: result.retry_after,
        executed_in_this_request: 0,
      }),
    );
    process.exitCode = 2;
    return null;
  }
  if (result.report.source_fingerprint !== (await fingerprint()))
    throw new Error(
      "Código do host diferente do código local; publicar antes de avaliar/ativar.",
    );
  return result;
}
if (action === "inspect") {
  console.log(
    JSON.stringify({
      key_registered: metadata.present,
      secret: metadata.secret,
      contexts: metadata.contexts,
      free_confirmed: host.get("CHLOE_FREE_TIER_CONFIRMED") === "1",
      evaluation_passed: host.get("CHLOE_EVALUATION_PASSED") === "1",
      enabled: host.get("CHLOE_AI_ENABLED") === "1",
      secret_values_printed: false,
    }),
  );
} else if (action === "prepare") {
  if (host.get("CHLOE_AI_ENABLED") === "1")
    throw new Error("IA já ligada; preparação recusada.");
  for (const [key, value] of Object.entries({
    CHLOE_PROVIDER: "groq",
    GROQ_MODEL_FAST: model,
    GROQ_MODEL_SMART: model,
    CHLOE_DAILY_CALLS: "100",
    CHLOE_DAILY_TOKENS: "100000",
    CHLOE_AI_ENABLED: "0",
    CHLOE_FREE_TIER_CONFIRMED: "0",
    CHLOE_EVALUATION_PASSED: "0",
  }))
    if (!host.get(key)) await host.set(key, value);
  console.log(
    JSON.stringify({
      prepared: true,
      enabled: false,
      key_registered: metadata.present,
    }),
  );
} else if (action === "disable") {
  await host.set("CHLOE_AI_ENABLED", "0");
  console.log(
    JSON.stringify({ enabled: false, production_redeploy_required: true }),
  );
} else if (!metadata.present || host.get("CHLOE_FREE_TIER_CONFIRMED") !== "1") {
  console.log(
    JSON.stringify({
      status: "needs_owner",
      reason: !metadata.present
        ? "missing_groq_key"
        : "free_plan_not_confirmed",
      executed: 0,
      enabled: false,
    }),
  );
  process.exitCode = 2;
} else {
  let status = await remote(action === "activate" ? "attest" : "status");
  if (status && action === "evaluate") {
    for (let n = 1; n <= 20; n++) {
      const id = `E${String(n).padStart(2, "0")}`;
      if (status.report.results.some((r) => r.id === id)) continue;
      const next = await remote("evaluate", id);
      if (!next) break;
      status = next;
      await fs.mkdir(".local-reports", { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(status.report, null, 2));
      console.log(
        JSON.stringify({
          case_id: id,
          executed: status.report.executed,
          passed_case: status.report.results.find((r) => r.id === id)?.passed,
        }),
      );
    }
    console.log(
      JSON.stringify({
        model,
        executed: status.report.executed,
        passed: status.report.passed,
        activation_written: false,
      }),
    );
    if (!status.report.passed) process.exitCode = 2;
  } else if (status) {
    if (!status.report.passed || status.report.executed !== 20)
      throw new Error("Avaliação real ainda não aprovada; ativação recusada.");
    for (const [key, value] of Object.entries({
      CHLOE_PROVIDER: "groq",
      GROQ_MODEL_FAST: model,
      GROQ_MODEL_SMART: model,
      CHLOE_EVALUATION_IDENTITY: status.report.identity,
      CHLOE_EVALUATION_PASSED: "1",
      CHLOE_AI_ENABLED: "1",
    }))
      await host.set(key, value);
    console.log(
      JSON.stringify({
        activated_configuration: true,
        model,
        production_redeploy_required: true,
        paid_fallback: false,
        dispatcher_changed: false,
      }),
    );
  }
}
