import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Model router for Chloe: OpenAI-compatible providers (Groq, OpenRouter, Cloudflare
 * Workers AI), tried in order, with a fast model for short commands and a larger one
 * for planning. Nothing here runs without a key; the rule-based commands keep working.
 */
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
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export type Tier = "rapido" | "raciocinio";

/** One chat completion; returns the assistant message. Injected so tests can fake it. */
export type ChatFn = (request: { messages: ChatMessage[]; tools: ToolSpec[]; tier: Tier }) => Promise<ChatMessage>;

interface Provider {
  name: string;
  baseUrl: string;
  key: string;
  models: Record<Tier, string>;
}

function providers(): Provider[] {
  const env = process.env;
  if(env.CHLOE_AI_ENABLED!=="1" || env.CHLOE_FREE_TIER_CONFIRMED!=="1" || env.CHLOE_EVALUATION_PASSED!=="1")return [];
  const list: (Provider | null)[] = [
    env.GROQ_API_KEY && (!env.CHLOE_PROVIDER || env.CHLOE_PROVIDER === "groq")
      ? {
          name: "groq",
          baseUrl: "https://api.groq.com/openai/v1",
          key: env.GROQ_API_KEY,
          models: { rapido: env.GROQ_MODEL_FAST ?? "openai/gpt-oss-20b", raciocinio: env.GROQ_MODEL_SMART ?? "openai/gpt-oss-120b" },
        }
      : null,
    env.OPENROUTER_API_KEY && env.CHLOE_PROVIDER === "openrouter"
      ? {
          name: "openrouter",
          baseUrl: "https://openrouter.ai/api/v1",
          key: env.OPENROUTER_API_KEY,
          models: {
            rapido: env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
            raciocinio: env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
          },
        }
      : null,
    env.CHLOE_PROVIDER === "cloudflare" && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN
      ? {
          name: "cloudflare",
          baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
          key: env.CLOUDFLARE_API_TOKEN,
          models: {
            rapido: env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            raciocinio: env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          },
        }
      : null,
  ];
  return list.filter((provider): provider is Provider => !!provider).slice(0,1);
}

export function chloeStatus() {
  return {active:chloeAvailable(),message:chloeAvailable()?"IA avaliada ativa; limite local estimado.":!process.env.GROQ_API_KEY?"Modo regras: Groq não configurada. Anotações continuam disponíveis.":"Modelo desativado até confirmação de gratuidade e aprovação da avaliação."};
}

export function chloeAvailable() {
  return providers().length > 0;
}

/** Tries each configured provider in order; the first good answer wins. */
export const providerChat: ChatFn = async ({ messages, tools, tier }) => {
  const errors: string[] = [];
  for (const provider of providers()) {
    const db=createAdminClient();
    const budget=await db.rpc("reserve_usage",{p_provider:provider.name,p_client:"chloe",p_tokens:7000,p_call_limit:Math.min(Number(process.env.CHLOE_DAILY_CALLS)||100,100),p_token_limit:Math.min(Number(process.env.CHLOE_DAILY_TOKENS)||100000,100000)});
    if(budget.error)throw new Error("Chloe pausada: limite local ou quota indisponível.");
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: provider.models[tier], messages, tools, tool_choice: "auto", temperature: 0.2, max_tokens: 2048 }),
        signal: AbortSignal.timeout(18_000),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = (await response.json()) as { choices?: { message?: ChatMessage;finish_reason?:string }[];usage?:{total_tokens?:number} };
      await db.rpc("settle_usage",{p_id:budget.data,p_used:data.usage?.total_tokens??7000});
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error("resposta vazia");
      return message;
    } catch (error) {
      await db.rpc("settle_usage",{p_id:budget.data,p_used:7000,p_failed:true});
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(errors.length ? `Chloe sem resposta (${errors.join("; ")})` : "Chloe indisponível: nenhuma chave de IA configurada.");
};

/** Longer or open-ended requests go to the bigger model. */
export function pickTier(text: string): Tier {
  const words = text.trim().split(/\s+/).length;
  return words > 18 || /\b(planej|organiz|resum|compar|explic|por que|sugest|ideias? para)\w*/i.test(text) ? "raciocinio" : "rapido";
}
