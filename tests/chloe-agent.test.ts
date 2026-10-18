import { describe, expect, it } from "vitest";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";
import { CHLOE_TOOLS, runChloe } from "@/lib/chloe/agent";
import type { ChatFn, ChatMessage } from "@/lib/chloe/llm";

const call = (name: string, args: object): ChatMessage => ({
  role: "assistant",
  content: null,
  tool_calls: [{ id: `c-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
});

/** Plays back scripted answers and records what the model was sent. */
function fakeChat(script: ChatMessage[]) {
  const seen: ChatMessage[][] = [];
  const chat: ChatFn = async ({ messages }) => {
    seen.push(structuredClone(messages));
    return script.shift() ?? { role: "assistant", content: "Fim." };
  };
  return { chat, seen };
}

describe("Chloe com ferramentas", () => {
  it("executa a ferramenta escolhida e devolve a resposta final com desfazer", async () => {
    const central = new CentralService(new MemoryRepository());
    const { chat, seen } = fakeChat([
      call("criar_evento", { titulo: "Prova de Grafos", inicio: "2026-10-20T19:00:00-03:00" }),
      { role: "assistant", content: "Marquei a prova de Grafos para terça, 19h." },
    ]);

    const result = await runChloe("bota minha prova de grafos dia 20 às 7 da noite", { central, chat, tier: "rapido" });

    expect(result.reply).toBe("Marquei a prova de Grafos para terça, 19h.");
    expect(result.undoId).toBeTruthy();
    const agenda = await central.agenda({ de: "2026-10-20", ate: "2026-10-20" });
    expect(agenda.eventos.map((e) => e.titulo)).toEqual(["Prova de Grafos"]);
    // The tool result goes back to the model before the final answer.
    expect(seen[1].at(-1)).toMatchObject({ role: "tool", tool_call_id: "c-criar_evento" });
  });

  it("não anuncia uma delegação operacional quando a fila está ausente", async () => {
    const central = new CentralService(new MemoryRepository());
    const { chat,seen } = fakeChat([call("delegar", { para: "vega", titulo: "Comparar notebooks", pedido: "Até R$ 5 mil, para programar" }), { role: "assistant", content: "A fila está indisponível." }]);
    await runChloe("pesquisa um notebook bom pra programar até 5 mil", { central, chat, tier: "raciocinio" });
    const { tarefas } = await central.listTasks();
    expect(tarefas).toHaveLength(0);
    expect(seen[1].at(-1)?.content).toContain("Nenhum agente externo foi acionado");
  });

  it("devolve o erro da ferramenta ao modelo em vez de quebrar", async () => {
    const central = new CentralService(new MemoryRepository());
    const { chat, seen } = fakeChat([call("criar_evento", { titulo: "Sem data" }), { role: "assistant", content: "Qual o dia?" }]);
    const result = await runChloe("marca uma reunião", { central, chat, tier: "rapido" });
    expect(result.reply).toBe("Qual o dia?");
    expect(result.undoId).toBeUndefined();
    expect(seen[1].at(-1)?.content).toContain("erro");
  });

  it("descreve todas as ferramentas com parâmetros", () => {
    for (const spec of CHLOE_TOOLS) expect(spec.function.parameters).toMatchObject({ type: "object" });
  });
});
