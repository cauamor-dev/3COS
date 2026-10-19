import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
export type Tier = "rapido" | "raciocinio";
export type ChatFn = (request: {
  messages: ChatMessage[];
  tools: ToolSpec[];
  tier: Tier;
}) => Promise<ChatMessage>;
export const GROQ_CANDIDATES = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
] as const;
export class ChloeProviderError extends Error {
  constructor(
    readonly code:
      | "disabled"
      | "quota"
      | "auth"
      | "unavailable"
      | "input_limit"
      | "invalid_response",
    readonly retryAfterSeconds?: number,
  ) {
    super(
      code === "quota"
        ? "Limite gratuito ou local atingido. Tente mais tarde; nenhum provedor pago foi acionado."
        : code === "auth"
          ? "A chave da IA precisa ser conferida na configuração."
          : code === "input_limit"
            ? "Pedido extenso para a cota gratuita. Reduza a pergunta; Anotar continua disponível para o texto integral."
            : "A IA está indisponível. Anotações e consultas por regras continuam disponíveis.",
    );
    this.name = "ChloeProviderError";
  }
}
interface Provider {
  name: string;
  baseUrl: string;
  key: string;
  models: Record<Tier, string>;
}
function configuredProvider(): Provider | null {
  const e = process.env;
  if ((!e.CHLOE_PROVIDER || e.CHLOE_PROVIDER === "groq") && e.GROQ_API_KEY) {
    const models = {
      rapido: e.GROQ_MODEL_FAST ?? GROQ_CANDIDATES[0],
      raciocinio: e.GROQ_MODEL_SMART ?? e.GROQ_MODEL_FAST ?? GROQ_CANDIDATES[0],
    };
    if (
      Object.values(models).some(
        (m) => !(GROQ_CANDIDATES as readonly string[]).includes(m),
      )
    )
      return null;
    return {
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      key: e.GROQ_API_KEY,
      models,
    };
  }
  if (e.CHLOE_PROVIDER === "openrouter" && e.OPENROUTER_API_KEY) {
    const model =
      e.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";
    if (!model.endsWith(":free")) return null;
    return {
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      key: e.OPENROUTER_API_KEY,
      models: { rapido: model, raciocinio: model },
    };
  }
  // Other providers need their own verified free-only adapter before activation.
  return null;
}
export function chloeReadiness() {
  const e = process.env,
    provider = configuredProvider();
  const keyPresent =
    e.CHLOE_PROVIDER === "openrouter"
      ? !!e.OPENROUTER_API_KEY
      : e.CHLOE_PROVIDER === "cloudflare"
        ? !!e.CLOUDFLARE_API_TOKEN
        : !!e.GROQ_API_KEY;
  const evaluated =
    e.CHLOE_EVALUATION_PASSED === "1" &&
    (!e.CHLOE_EVALUATION_IDENTITY ||
      (provider?.name === "groq" &&
        Object.values(provider.models).every(
          (m) => evaluationKeyIdentity(m) === e.CHLOE_EVALUATION_IDENTITY,
        )));
  const reason = !keyPresent
    ? "missing_key"
    : !provider
      ? "unsupported_configuration"
      : e.CHLOE_FREE_TIER_CONFIRMED !== "1"
        ? "free_unconfirmed"
        : !evaluated
          ? "evaluation_pending"
          : e.CHLOE_AI_ENABLED !== "1"
            ? "disabled"
            : "ready";
  return {
    active: reason === "ready",
    reason,
    keyPresent,
    freeConfirmed: e.CHLOE_FREE_TIER_CONFIRMED === "1",
    evaluated,
    provider: provider?.name ?? e.CHLOE_PROVIDER ?? "groq",
    model: provider?.models.rapido ?? null,
  };
}
export function evaluationKeyIdentity(model: string) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        process.env.GROQ_API_KEY,
        model,
        process.env.CHLOE_EVALUATION_BUILD,
      ]),
    )
    .digest("hex");
}
export function chloeAvailable() {
  return chloeReadiness().active;
}
export function chloeStatus() {
  const s = chloeReadiness();
  const messages: Record<string, string> = {
    missing_key:
      "Modo regras: chave da IA ainda não configurada. Anotações continuam disponíveis.",
    unsupported_configuration:
      "Configuração fora dos modelos gratuitos preparados. IA permanece desligada.",
    free_unconfirmed:
      "Chave presente; falta confirmar o plano gratuito antes de testar.",
    evaluation_pending: "Chave presente; avaliação real do modelo pendente.",
    disabled: "Avaliação aprovada; ativação da IA pendente.",
    ready: "IA avaliada ativa, com limites locais e sem fallback pago.",
  };
  return { active: s.active, message: messages[s.reason] };
}
const bounded = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, fallback) : fallback;
};
/** One selected provider, one attempt. Unknown outcomes count conservatively against quota. */
export const providerChat: ChatFn = async ({ messages, tools, tier }) => {
  const provider = configuredProvider();
  if (!chloeAvailable() || !provider) throw new ChloeProviderError("disabled");
  return callProvider(provider, { messages, tools, tier });
};
/** Only the authenticated evaluation runner uses this; never changes process-wide flags. */
export function evaluationChat(model: string): ChatFn {
  if (
    !process.env.GROQ_API_KEY ||
    process.env.CHLOE_FREE_TIER_CONFIRMED !== "1" ||
    !(GROQ_CANDIDATES as readonly string[]).includes(model)
  )
    throw new ChloeProviderError("disabled");
  const provider: Provider = {
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    key: process.env.GROQ_API_KEY,
    models: { rapido: model, raciocinio: model },
  };
  return (request) => callProvider(provider, request);
}
async function callProvider(
  provider: Provider,
  { messages, tools, tier }: Parameters<ChatFn>[0],
): ReturnType<ChatFn> {
  const body = JSON.stringify({
    model: provider.models[tier],
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.2,
    ...(provider.name === "groq"
      ? { max_completion_tokens: 2048 }
      : { max_tokens: 2048 }),
  });
  const estimate = Math.ceil(Buffer.byteLength(body, "utf8") / 2) + 2048;
  if (estimate > 7500) throw new ChloeProviderError("input_limit");
  const db = createAdminClient();
  const budget = await db.rpc("reserve_usage", {
    p_provider: provider.name,
    p_client: "chloe",
    p_tokens: estimate,
    p_call_limit: bounded(process.env.CHLOE_DAILY_CALLS, 100),
    p_token_limit: bounded(process.env.CHLOE_DAILY_TOKENS, 100000),
  });
  if (budget.error || !budget.data) throw new ChloeProviderError("quota");
  let used = estimate,
    failed = true;
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after"));
      throw new ChloeProviderError(
        response.status === 429
          ? "quota"
          : [401, 403].includes(response.status)
            ? "auth"
            : "unavailable",
        Number.isFinite(retry) && retry > 0
          ? Math.min(retry, 86400)
          : undefined,
      );
    }
    const data = (await response.json()) as {
      choices?: { message?: ChatMessage; finish_reason?: string }[];
      usage?: { total_tokens?: number };
    };
    if (
      typeof data.usage?.total_tokens === "number" &&
      Number.isFinite(data.usage.total_tokens) &&
      data.usage.total_tokens >= 0
    )
      used = Math.ceil(data.usage.total_tokens);
    const choice = data.choices?.[0],
      message = choice?.message;
    if (
      !message ||
      choice?.finish_reason === "length" ||
      (!message.content?.trim() && !message.tool_calls?.length) ||
      message.role !== "assistant"
    )
      throw new ChloeProviderError("invalid_response");
    failed = false;
    return message;
  } catch (error) {
    if (error instanceof ChloeProviderError) throw error;
    throw new ChloeProviderError("unavailable");
  } finally {
    const settled = await db.rpc("settle_usage", {
      p_id: budget.data,
      p_used: used,
      p_failed: failed,
    });
    if (settled.error) throw new ChloeProviderError("quota");
  }
}
export function pickTier(text: string): Tier {
  return text.trim().split(/\s+/).length > 18 ||
    /\b(planej|organiz|resum|compar|explic|por que|sugest|ideias? para)\w*/i.test(
      text,
    )
    ? "raciocinio"
    : "rapido";
}
