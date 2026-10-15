import "server-only";

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
  const list: (Provider | null)[] = [
    env.GROQ_API_KEY
      ? {
          name: "groq",
          baseUrl: "https://api.groq.com/openai/v1",
          key: env.GROQ_API_KEY,
          models: { rapido: env.GROQ_MODEL_FAST ?? "llama-3.1-8b-instant", raciocinio: env.GROQ_MODEL_SMART ?? "llama-3.3-70b-versatile" },
        }
      : null,
    env.OPENROUTER_API_KEY
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
    env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN
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
  return list.filter((provider): provider is Provider => !!provider);
}

export function chloeAvailable() {
  return providers().length > 0;
}

/** Tries each configured provider in order; the first good answer wins. */
export const providerChat: ChatFn = async ({ messages, tools, tier }) => {
  const errors: string[] = [];
  for (const provider of providers()) {
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: provider.models[tier], messages, tools, tool_choice: "auto", temperature: 0.2, max_tokens: 600 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = (await response.json()) as { choices?: { message?: ChatMessage }[] };
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error("resposta vazia");
      return message;
    } catch (error) {
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
