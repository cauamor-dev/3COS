import type { z } from "zod";
import {
  briefingInput,
  editEntryInput,
  listAreasInput,
  readAreaInput,
  readEntryInput,
  saveEntryInput,
  searchInput,
  updateSummaryInput,
  type Source,
} from "./schemas";
import type { CentralService } from "./service";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH";

export interface Operation<S extends z.ZodObject = z.ZodObject> {
  tool: string;
  operationId: string;
  title: string;
  description: string;
  schema: S;
  readOnly: boolean;
  http: { method: HttpMethod; path: string; pathParams?: (keyof z.input<S> & string)[] };
  run(central: CentralService, input: z.input<S>, source: Source): Promise<unknown>;
}

function defineOperation<S extends z.ZodObject>(operation: Operation<S>): Operation {
  return operation as unknown as Operation;
}

export const operations: Operation[] = [
  defineOperation({
    tool: "obter_briefing",
    operationId: "obterBriefing",
    title: "Obter briefing",
    description:
      "Retorna o contexto do usuário: perfil, preferências, áreas ativas com resumo curto e os registros mais recentes salvos por Claude e ChatGPT. Chame no início de qualquer conversa sobre projetos, trabalho, estudos ou quando o usuário mencionar algo que você não conhece.",
    schema: briefingInput,
    readOnly: true,
    http: { method: "GET", path: "/briefing" },
    run: (central, input) => central.briefing(input),
  }),
  defineOperation({
    tool: "listar_areas",
    operationId: "listarAreas",
    title: "Listar áreas",
    description:
      "Lista as áreas (projetos, trabalho, faculdade, cursos, ideias) com slug, status e resumo curto. Use para descobrir o slug certo antes de ler ou salvar.",
    schema: listAreasInput,
    readOnly: true,
    http: { method: "GET", path: "/areas" },
    run: (central, input) => central.listAreas(input),
  }),
  defineOperation({
    tool: "ler_area",
    operationId: "lerArea",
    title: "Ler área",
    description:
      "Lê o resumo vivo completo de uma área e seus registros mais recentes (decisões, progresso, contexto). Use quando o usuário falar de um projeto específico ou perguntar o que há de novo nele.",
    schema: readAreaInput,
    readOnly: true,
    http: { method: "GET", path: "/areas/{slug}", pathParams: ["slug"] },
    run: (central, input) => central.readArea(input),
  }),
  defineOperation({
    tool: "ler_registro",
    operationId: "lerRegistro",
    title: "Ler registro completo",
    description: "Lê o conteúdo completo de um registro pelo id. Use quando um registro veio com truncado=true.",
    schema: readEntryInput,
    readOnly: true,
    http: { method: "GET", path: "/entries/{id}", pathParams: ["id"] },
    run: (central, input) => central.readEntry(input),
  }),
  defineOperation({
    tool: "buscar",
    operationId: "buscar",
    title: "Buscar",
    description:
      "Busca full-text em português em todos os registros, com filtros opcionais por área, tipo e período. Use para encontrar decisões, contexto ou progresso antigos.",
    schema: searchInput,
    readOnly: true,
    http: { method: "GET", path: "/search" },
    run: (central, input) => central.search(input),
  }),
  defineOperation({
    tool: "salvar_registro",
    operationId: "salvarRegistro",
    title: "Salvar registro",
    description:
      "Cria um registro na linha do tempo de uma área. Use ao fim de uma sessão de trabalho ou quando houver decisão, progresso ou contexto novo. Se a área não existir, ela é criada; se não souber a área, pergunte ao usuário ou use inbox. Escreva de forma autossuficiente: outra IA vai ler sem ver esta conversa.",
    schema: saveEntryInput,
    readOnly: false,
    http: { method: "POST", path: "/entries" },
    run: (central, input, source) => central.saveEntry(input, source),
  }),
  defineOperation({
    tool: "atualizar_resumo",
    operationId: "atualizarResumo",
    title: "Atualizar resumo da área",
    description:
      "Substitui o resumo vivo (documento canônico) de uma área pelo texto completo novo e opcionalmente muda o status. A versão anterior fica no histórico. Use só quando algo mudou de verdade (escopo, stack, status, próximos passos) e leia a área antes para não perder informação.",
    schema: updateSummaryInput,
    readOnly: false,
    http: { method: "PUT", path: "/areas/{area_slug}/summary", pathParams: ["area_slug"] },
    run: (central, input, source) => central.updateSummary(input, source),
  }),
  defineOperation({
    tool: "editar_registro",
    operationId: "editarRegistro",
    title: "Editar registro",
    description:
      "Altera título, conteúdo, tipo, tags, fixação ou área de um registro, ou arquiva/desarquiva. Nada é apagado: arquivar é reversível e edições de conteúdo ficam no histórico. Só arquive se o usuário pedir.",
    schema: editEntryInput,
    readOnly: false,
    http: { method: "PATCH", path: "/entries/{id}", pathParams: ["id"] },
    run: (central, input, source) => central.editEntry(input, source),
  }),
];
