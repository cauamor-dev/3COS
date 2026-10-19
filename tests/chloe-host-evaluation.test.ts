import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/chloe/evaluate", () => ({ evaluateCase: mocks.run }));
import { hostEvaluation } from "@/lib/chloe/host-evaluation";
import { EVALUATION_CASES } from "@/lib/chloe/evaluation-cases";
afterEach(() => vi.unstubAllEnvs());
it("retoma casos persistidos, exige todos os críticos e invalida ao trocar a chave", async () => {
  vi.stubEnv("GROQ_API_KEY", "fixture-key");
  vi.stubEnv("CHLOE_FREE_TIER_CONFIRMED", "1");
  vi.stubEnv("CHLOE_EVALUATION_BUILD", "fixture-build");
  const rows: Record<string, unknown>[] = [];
  const db = {
    from: () => {
      const filters: Record<string, unknown> = {};
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters[k] = v;
          return q;
        },
        gte: async () => ({
          data: rows.filter((row) =>
            Object.entries(filters).every(([k, v]) => row[k] === v),
          ),
          error: null,
        }),
        upsert: async (row: Record<string, unknown>) => {
          rows.push(row);
          return { error: null };
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
  mocks.run.mockImplementation(async (c) => ({
    id: c.id,
    passed: true,
    critical: !!c.critical,
    tools: [],
    checks: {},
    ms: 1,
  }));
  for (const c of EVALUATION_CASES)
    await hostEvaluation(db, "openai/gpt-oss-20b", c.id);
  expect((await hostEvaluation(db, "openai/gpt-oss-20b", "E01")).passed).toBe(
    true,
  );
  expect(mocks.run).toHaveBeenCalledTimes(20);
  (
    rows.find((row) => row.idempotency_key === "E17")!.result as {
      passed: boolean;
    }
  ).passed = false;
  expect((await hostEvaluation(db, "openai/gpt-oss-20b")).passed).toBe(false);
  vi.stubEnv("GROQ_API_KEY", "rotated-fixture");
  expect((await hostEvaluation(db, "openai/gpt-oss-20b")).executed).toBe(0);
});
