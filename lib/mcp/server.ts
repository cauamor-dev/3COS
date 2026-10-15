import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { describeError } from "@/lib/central/format-error";
import { operations } from "@/lib/central/operations";
import type { Source } from "@/lib/central/schemas";
import { SOURCES } from "@/lib/central/schemas";
import type { CentralService } from "@/lib/central/service";

export const MCP_INSTRUCTIONS = [
  "3C OS (antes chamado Central 3C) é o ambiente pessoal do Cauã: memória compartilhada entre Claude e ChatGPT, agenda, tarefas e Mural.",
  "Chame obter_briefing no início de conversas sobre projetos, trabalho ou estudos.",
  "Salve registros (salvar_registro) quando houver decisão, progresso ou contexto novo, e atualize o resumo da área só quando algo mudar de verdade.",
  "Nunca arquive nada sem o usuário pedir. Se a área for ambígua, pergunte.",
].join(" ");

function sourceFrom(clientId: string | undefined): Source {
  return SOURCES.find((source) => source === clientId) ?? "claude";
}

export function registerCentralTools(server: McpServer, getCentral: () => CentralService) {
  for (const operation of operations) {
    server.registerTool(
      operation.tool,
      {
        title: operation.title,
        description: operation.description,
        inputSchema: operation.schema,
        annotations: {
          title: operation.title,
          readOnlyHint: operation.readOnly,
          destructiveHint: false,
          idempotentHint: operation.readOnly || operation.tool === "atualizar_resumo",
          openWorldHint: false,
        },
      },
      async (input, ctx): Promise<CallToolResult> => {
        try {
          const source = sourceFrom(ctx.http?.authInfo?.clientId);
          const result = await operation.run(getCentral(), input, source);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        } catch (error) {
          const { message } = describeError(error);
          return { isError: true, content: [{ type: "text", text: message }] };
        }
      },
    );
  }
}
