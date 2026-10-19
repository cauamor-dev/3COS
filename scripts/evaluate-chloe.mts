import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { EVALUATION_CASES } from "../lib/chloe/evaluation-cases";
import { evaluateCase } from "../lib/chloe/evaluate";
import {
  ChloeProviderError,
  GROQ_CANDIDATES,
  providerChat,
} from "../lib/chloe/llm";
const model = process.argv[2] ?? GROQ_CANDIDATES[0];
if (!(GROQ_CANDIDATES as readonly string[]).includes(model))
  throw new Error("Modelo fora dos candidatos preparados.");
await fs.mkdir(".local-reports", { recursive: true });
const reportPath = `.local-reports/chloe-evaluation-${model.split("/").at(-1)}.json`;
const fingerprint = createHash("sha256");
for (const file of [
  "lib/chloe/agent.ts",
  "lib/chloe/llm.ts",
  "lib/chloe/evaluation-cases.ts",
  "lib/chloe/evaluate.ts",
  "scripts/evaluate-chloe.mts",
])
  fingerprint.update(await fs.readFile(file));
const source_fingerprint = fingerprint.digest("hex");
const key_id = createHash("sha256")
  .update(process.env.GROQ_API_KEY ?? "")
  .digest("hex");
if (
  !process.env.GROQ_API_KEY ||
  process.env.CHLOE_FREE_TIER_CONFIRMED !== "1"
) {
  const report = {
    model,
    cases: EVALUATION_CASES.length,
    executed: 0,
    passed: false,
    status: "not_executed",
    reason:
      "Chave e plano gratuito precisam ser confirmados pelo proprietário.",
    source_fingerprint,
    activation_written: false,
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exit(2);
}
process.env.CHLOE_AI_ENABLED = "1";
process.env.CHLOE_EVALUATION_PASSED = "1";
process.env.CHLOE_PROVIDER = "groq";
process.env.GROQ_MODEL_FAST = model;
process.env.GROQ_MODEL_SMART = model;
type Result = Awaited<ReturnType<typeof evaluateCase>>;
let results: Result[] = [];
try {
  const previous = JSON.parse(await fs.readFile(reportPath, "utf8"));
  if (
    previous.source_fingerprint === source_fingerprint &&
    previous.key_id === key_id &&
    previous.model === model &&
    Date.now() - Date.parse(previous.updated_at) < 7 * 86400000
  )
    results = previous.results ?? [];
} catch {}
let blocked: string | undefined;
async function save() {
  const executed = results.length,
    passed =
      executed === 20 &&
      results.filter((r) => r.passed).length >= 18 &&
      results.filter((r) => r.critical).every((r) => r.passed);
  const report = {
    model,
    executed,
    passed,
    results,
    status: blocked ? "paused" : "evaluated",
    blocked,
    source_fingerprint,
    key_id,
    updated_at: new Date().toISOString(),
    completed_at: executed === 20 ? new Date().toISOString() : null,
    synthetic_data: true,
    external_integrations_proven: false,
    activation_written: false,
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  return report;
}
for (const c of EVALUATION_CASES) {
  if (results.some((r) => r.id === c.id)) continue;
  try {
    results.push(await evaluateCase(c, providerChat));
    await save();
  } catch (error) {
    blocked =
      error instanceof ChloeProviderError
        ? error.code
        : "evaluation_unavailable";
    break;
  }
}
const report = await save();
console.log(
  JSON.stringify({
    model,
    executed: report.executed,
    passed: report.passed,
    status: report.status,
    blocked: report.blocked,
    activation_written: false,
  }),
);
if (!report.passed) process.exitCode = 2;
