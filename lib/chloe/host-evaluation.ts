import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVALUATION_CASES } from "./evaluation-cases";
import { evaluateCase } from "./evaluate";
import { evaluationChat, evaluationKeyIdentity } from "./llm";

type CaseResult = Awaited<ReturnType<typeof evaluateCase>>;
const OPERATION = "chloe-model-evaluation";
export function evaluationIdentity(model: string) {
  if (!process.env.GROQ_API_KEY || !process.env.CHLOE_EVALUATION_BUILD)
    throw new Error("evaluation_not_configured");
  return evaluationKeyIdentity(model);
}
export async function hostEvaluation(
  db: SupabaseClient,
  model: string,
  caseId?: string,
) {
  const identity = evaluationIdentity(model),
    client = `chloe-eval:${identity}`;
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  async function readResults() {
    const response = await db
      .from("operation_receipts")
      .select("idempotency_key,result,created_at")
      .eq("client_id", client)
      .eq("operation", OPERATION)
      .eq("request_hash", process.env.CHLOE_EVALUATION_BUILD!)
      .gte("created_at", since);
    if (response.error) throw new Error("evaluation_storage_unavailable");
    const rows = response.data ?? [];
    return EVALUATION_CASES.flatMap((c) => {
      const r = rows.find((row) => row.idempotency_key === c.id)?.result as
        CaseResult | undefined;
      return r && r.id === c.id && typeof r.passed === "boolean" ? [r] : [];
    });
  }
  let results = await readResults();
  if (caseId && !results.some((r) => r.id === caseId)) {
    const c = EVALUATION_CASES.find((c) => c.id === caseId);
    if (!c) throw new Error("invalid_case");
    const result = await evaluateCase(c, evaluationChat(model));
    const saved = await db.from("operation_receipts").upsert(
      {
        client_id: client,
        operation: OPERATION,
        idempotency_key: c.id,
        request_hash: process.env.CHLOE_EVALUATION_BUILD,
        result,
        created_at: new Date().toISOString(),
      },
      { onConflict: "client_id,operation,idempotency_key" },
    );
    if (saved.error) throw new Error("evaluation_storage_unavailable");
    results = await readResults();
  }
  const passed =
    results.length === EVALUATION_CASES.length &&
    results.filter((r) => r.passed).length >= 18 &&
    EVALUATION_CASES.filter((c) => "critical" in c && c.critical).every(
      (c) => results.find((r) => r.id === c.id)?.passed,
    );
  return {
    model,
    source_fingerprint: process.env.CHLOE_EVALUATION_BUILD,
    identity,
    executed: results.length,
    passed,
    results,
    synthetic_data: true,
    activation_written: false,
  };
}
