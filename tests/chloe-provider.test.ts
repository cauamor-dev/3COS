import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
import {
  chloeAvailable,
  chloeReadiness,
  providerChat,
  evaluationChat,
  evaluationKeyIdentity,
} from "@/lib/chloe/llm";
beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "fixture-key");
  vi.stubEnv("CHLOE_PROVIDER", "groq");
  for (const k of [
    "CHLOE_AI_ENABLED",
    "CHLOE_FREE_TIER_CONFIRMED",
    "CHLOE_EVALUATION_PASSED",
  ])
    vi.stubEnv(k, "1");
  vi.stubEnv("GROQ_MODEL_FAST", "openai/gpt-oss-20b");
  vi.stubEnv("GROQ_MODEL_SMART", "openai/gpt-oss-20b");
  rpc.mockReset().mockImplementation(async (name: string) => ({
    data: name === "reserve_usage" ? "reservation" : null,
    error: null,
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = {
  messages: [{ role: "user" as const, content: "Oi" }],
  tools: [],
  tier: "rapido" as const,
};
describe("IA gratuita sem fallback pago", () => {
  it("avalia sem ligar a IA no processo e invalida aprovação ao trocar chave ou modelo", async () => {
    vi.stubEnv("CHLOE_AI_ENABLED", "0");
    vi.stubEnv("CHLOE_EVALUATION_PASSED", "0");
    vi.stubEnv("CHLOE_EVALUATION_BUILD", "fixture-code");
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: { role: "assistant", content: "Teste" },
            finish_reason: "stop",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await evaluationChat("openai/gpt-oss-20b")(request);
    expect(chloeAvailable()).toBe(false);
    vi.stubEnv("CHLOE_AI_ENABLED", "1");
    vi.stubEnv("CHLOE_EVALUATION_PASSED", "1");
    vi.stubEnv(
      "CHLOE_EVALUATION_IDENTITY",
      evaluationKeyIdentity("openai/gpt-oss-20b"),
    );
    expect(chloeAvailable()).toBe(true);
    vi.stubEnv("GROQ_API_KEY", "different-fixture");
    expect(chloeReadiness().reason).toBe("evaluation_pending");
    vi.stubEnv("CHLOE_FREE_TIER_CONFIRMED", "0");
    expect(() => evaluationChat("openai/gpt-oss-20b")).toThrow();
  });
  it("não faz inferência sem confirmação de gratuidade e avaliação", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("CHLOE_FREE_TIER_CONFIRMED", "0");
    expect(chloeReadiness().reason).toBe("free_unconfirmed");
    await expect(providerChat(request)).rejects.toMatchObject({
      code: "disabled",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    vi.stubEnv("CHLOE_FREE_TIER_CONFIRMED", "1");
    vi.stubEnv("CHLOE_EVALUATION_PASSED", "0");
    expect(chloeAvailable()).toBe(false);
  });
  it("recusa modelo fora da lista e OpenRouter sem sufixo free", () => {
    vi.stubEnv("GROQ_MODEL_FAST", "gpt-paid");
    expect(chloeAvailable()).toBe(false);
    vi.stubEnv("CHLOE_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "fixture");
    vi.stubEnv("OPENROUTER_MODEL", "vendor/paid");
    expect(chloeAvailable()).toBe(false);
  });
  it("429 encerra uma tentativa, contabiliza uma vez e oculta o corpo do erro", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("fixture-secret-do-not-echo", {
        status: 429,
        headers: { "retry-after": "10" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(providerChat(request)).rejects.toMatchObject({
      code: "quota",
      retryAfterSeconds: 10,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.filter((c) => c[0] === "settle_usage")).toHaveLength(
      1,
    );
    expect(rpc.mock.calls.at(-1)?.[1]).toMatchObject({
      p_failed: true,
      p_used: 0,
    });
  });
  it("reserva antes da chamada e liquida consumo real uma vez", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: { role: "assistant", content: "Olá" },
            finish_reason: "stop",
          },
        ],
        usage: { total_tokens: 121 },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect((await providerChat(request)).content).toBe("Olá");
    expect(rpc.mock.calls.at(-1)?.[1]).toEqual({
      p_id: "reservation",
      p_used: 121,
      p_failed: false,
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.model).toBe("openai/gpt-oss-20b");
    expect(body.max_completion_tokens).toBe(2048);
  });
  it("não envia pedido que exceda o teto e rejeita resposta cortada", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      providerChat({
        ...request,
        messages: [{ role: "user", content: "texto".repeat(10000) }],
      }),
    ).rejects.toMatchObject({ code: "input_limit" });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue(
      Response.json({
        choices: [
          {
            message: { role: "assistant", content: "incompleto" },
            finish_reason: "length",
          },
        ],
      }),
    );
    await expect(providerChat(request)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
