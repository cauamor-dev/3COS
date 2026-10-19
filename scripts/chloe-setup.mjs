import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { centralHost } from "./lib/netlify-central.mjs";
const action = process.argv[2] ?? "inspect";
const model = process.argv[3] ?? "openai/gpt-oss-20b";
if (!["inspect", "prepare", "evaluate", "activate", "disable"].includes(action))
  throw new Error("Use inspect, prepare, evaluate, activate ou disable.");
if (!["openai/gpt-oss-20b", "openai/gpt-oss-120b"].includes(model))
  throw new Error("Modelo fora dos candidatos preparados.");
const host = await centralHost();
const key = host.get("GROQ_API_KEY");
const reportPath = `.local-reports/chloe-evaluation-${model.split("/").at(-1)}.json`;
export async function evaluationFingerprint() {
  const h = createHash("sha256");
  for (const f of [
    "lib/chloe/agent.ts",
    "lib/chloe/llm.ts",
    "lib/chloe/evaluation-cases.ts",
    "lib/chloe/evaluate.ts",
    "scripts/evaluate-chloe.mts",
  ])
    h.update(await fs.readFile(f));
  return h.digest("hex");
}
if (action === "inspect") {
  console.log(
    JSON.stringify({
      key_present: !!key,
      free_confirmed: host.get("CHLOE_FREE_TIER_CONFIRMED") === "1",
      evaluation_passed: host.get("CHLOE_EVALUATION_PASSED") === "1",
      enabled: host.get("CHLOE_AI_ENABLED") === "1",
      provider: host.get("CHLOE_PROVIDER") ?? "groq",
      model: host.get("GROQ_MODEL_FAST") ?? model,
      secret_values_printed: false,
    }),
  );
} else if (action === "prepare") {
  if (host.get("CHLOE_AI_ENABLED") === "1")
    throw new Error(
      "A IA já está ligada; não alterar sua configuração por uma preparação.",
    );
  const defaults = {
    CHLOE_PROVIDER: "groq",
    GROQ_MODEL_FAST: model,
    GROQ_MODEL_SMART: model,
    CHLOE_DAILY_CALLS: "100",
    CHLOE_DAILY_TOKENS: "100000",
    CHLOE_AI_ENABLED: "0",
    CHLOE_FREE_TIER_CONFIRMED: "0",
    CHLOE_EVALUATION_PASSED: "0",
  };
  const configured = [];
  for (const [name, value] of Object.entries(defaults))
    if (!host.get(name)) {
      await host.set(name, value);
      configured.push(name);
    }
  console.log(
    JSON.stringify({
      prepared: true,
      configured,
      enabled: false,
      key_present: !!key,
      secret_values_printed: false,
    }),
  );
} else if (action === "disable") {
  await host.set("CHLOE_AI_ENABLED", "0");
  console.log(JSON.stringify({ enabled: false, redeploy_required: true }));
} else if (!key || host.get("CHLOE_FREE_TIER_CONFIRMED") !== "1") {
  console.log(
    JSON.stringify({
      status: "needs_owner",
      reason: !key ? "missing_groq_key" : "free_plan_not_confirmed",
      executed: 0,
      enabled: false,
    }),
  );
  process.exitCode = 2;
} else if (action === "evaluate") {
  const env = {};
  for (const k of ["PATH", "Path", "SystemRoot", "TEMP", "TMP", "USERPROFILE"])
    if (process.env[k]) env[k] = process.env[k];
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const v = host.get(k);
    if (!v) throw new Error("Configuração obrigatória do host ausente.");
    env[k] = v;
  }
  Object.assign(env, {
    GROQ_API_KEY: key,
    CHLOE_FREE_TIER_CONFIRMED: "1",
    CHLOE_EVALUATION_KEY_ID: createHash("sha256").update(key).digest("hex"),
    CHLOE_EVALUATION_SOURCE: await evaluationFingerprint(),
    NODE_ENV: "test",
  });
  const child = spawn(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/evaluate-chloe.mts",
      model,
    ],
    { stdio: "inherit", env, shell: false },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (c) => resolve(c ?? 1));
  });
} else {
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  if (
    !report.passed ||
    report.executed !== 20 ||
    report.model !== model ||
    report.key_id !== createHash("sha256").update(key).digest("hex") ||
    report.source_fingerprint !== (await evaluationFingerprint()) ||
    Date.now() - Date.parse(report.completed_at) > 7 * 86400000 ||
    Date.parse(report.completed_at) > Date.now() ||
    !Number.isFinite(Date.parse(report.completed_at))
  )
    throw new Error(
      "Avaliação ausente, vencida ou de outra chave/código. Ativação recusada.",
    );
  for (const [name, value] of Object.entries({
    CHLOE_PROVIDER: "groq",
    GROQ_MODEL_FAST: model,
    GROQ_MODEL_SMART: model,
    CHLOE_DAILY_CALLS: "100",
    CHLOE_DAILY_TOKENS: "100000",
    CHLOE_EVALUATION_PASSED: "1",
    CHLOE_AI_ENABLED: "1",
  }))
    await host.set(name, value);
  console.log(
    JSON.stringify({
      activated_configuration: true,
      model,
      redeploy_required: true,
      paid_fallback: false,
      dispatcher_changed: false,
    }),
  );
}
