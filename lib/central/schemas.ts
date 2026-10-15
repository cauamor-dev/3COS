import { z } from "zod";

export const SOURCES = ["claude", "chatgpt", "manual", "cursor"] as const;
export const AREA_KINDS = ["projeto", "trabalho", "faculdade", "curso", "pessoal", "ideia", "perfil"] as const;
export const AREA_STATUSES = ["ativo", "pausado", "concluido", "arquivado"] as const;
export const ENTRY_TYPES = ["contexto", "decisao", "progresso", "tarefa", "nota", "ideia", "evento", "post"] as const;
export const RECURRENCES = ["diaria", "semanal", "mensal", "anual"] as const;
export const PRIORITIES = ["alta", "media", "baixa"] as const;

export type Source = (typeof SOURCES)[number];
export type AreaKind = (typeof AREA_KINDS)[number];
export type AreaStatus = (typeof AREA_STATUSES)[number];
export type EntryType = (typeof ENTRY_TYPES)[number];
export type Recurrence = (typeof RECURRENCES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const sourceSchema = z.enum(SOURCES);
export const areaKindSchema = z.enum(AREA_KINDS).describe("Tipo da área");
export const areaStatusSchema = z.enum(AREA_STATUSES).describe("Status da área");
export const entryTypeSchema = z
  .enum(ENTRY_TYPES)
  .describe("Tipo do registro. evento = compromisso na agenda (exige inicio); tarefa = algo a fazer (prazo opcional); post = publicação no Mural (notícias, achados, resumos de tarefas agendadas)");

const slugInput = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .describe("Slug da área, ex.: axial, orion, faculdade-grafos. Acentos e espaços são normalizados.");

const isoDate = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value)), "Data inválida")
  .describe("Data ISO 8601, ex.: 2026-10-01 ou 2026-10-01T12:00:00-03:00");

const tags = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .describe("Etiquetas curtas, minúsculas, ex.: [\"frontend\", \"deploy\"]");

const limit = (max: number, fallback: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback).describe(`Quantidade de itens (máx. ${max})`);

const offset = z.coerce.number().int().min(0).default(0).describe("Quantos itens pular (paginação)");

const booleanish = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

const linkSchema = z.object({
  url: z.url().describe("Endereço do link"),
  titulo: z.string().trim().max(200).optional().describe("Título do link"),
  imagem: z.url().optional().describe("Imagem de prévia do link"),
});

export type EntryLink = z.infer<typeof linkSchema>;

const scheduleFields = {
  inicio: isoDate.optional().describe("Início do evento, com fuso. Ex.: 2026-10-20T19:00:00-03:00 ou 2026-10-20 para dia inteiro"),
  fim: isoDate.optional().describe("Fim do evento, com fuso"),
  dia_inteiro: booleanish.optional().describe("Evento de dia inteiro"),
  local: z.string().trim().max(200).optional().describe("Local do evento"),
  recorrencia: z.enum(RECURRENCES).optional().describe("Repetição do evento ou lembrete"),
  prazo: isoDate.optional().describe("Prazo da tarefa, com fuso. Ex.: 2026-10-20T18:00:00-03:00"),
  lembrar_em: isoDate.optional().describe("Quando avisar o usuário, com fuso. Ex.: 2026-10-20T08:00:00-03:00"),
  links: z.array(linkSchema).max(10).optional().describe("Links de fontes e referências"),
  imagem: z.url().optional().describe("URL de imagem para destacar o registro (útil em posts)"),
  prioridade: z.enum(PRIORITIES).optional().describe("Prioridade (alta, media, baixa). Use alta só para o que é realmente urgente"),
};

export const briefingInput = z.object({
  desde: isoDate.optional().describe("Mostrar registros a partir desta data. Padrão: últimos 7 dias."),
  limite_registros: limit(30, 10),
});

export const listAreasInput = z.object({
  status: areaStatusSchema.optional(),
  kind: areaKindSchema.optional(),
  limite: limit(100, 30),
  offset,
});

export const readAreaInput = z.object({
  slug: slugInput,
  limite_registros: limit(50, 10),
  incluir_arquivados: booleanish.default(false).describe("Incluir registros arquivados"),
});

export const readEntryInput = z.object({
  id: z.uuid().describe("ID do registro"),
});

export const searchInput = z.object({
  consulta: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("Termos de busca em português. Aceita aspas para frase exata, OR e -palavra para excluir."),
  area: slugInput.optional().describe("Restringir a uma área (slug)"),
  tipo: entryTypeSchema.optional(),
  desde: isoDate.optional(),
  ate: isoDate.optional(),
  limite: limit(30, 10),
  offset,
});

export const saveEntryInput = z.object({
  area_slug: slugInput.default("inbox").describe("Área de destino. Se não existir, é criada. Use inbox se não souber."),
  area_nome: z.string().trim().min(1).max(120).optional().describe("Nome legível da área, usado só se ela for criada agora"),
  area_tipo: areaKindSchema.optional().describe("Tipo da área, usado só se ela for criada agora. Padrão: projeto"),
  tipo: entryTypeSchema.default("nota"),
  titulo: z.string().trim().min(1).max(200).describe("Título curto e específico"),
  conteudo: z.string().max(50_000).default("").describe("Conteúdo em markdown"),
  tags: tags.default([]),
  fixado: booleanish.default(false).describe("Fixar no topo da área"),
  ...scheduleFields,
}).refine((input) => input.tipo !== "evento" || !!input.inicio, {
  message: "Eventos precisam de inicio.",
  path: ["inicio"],
});

export const updateSummaryInput = z.object({
  area_slug: slugInput,
  resumo: z.string().max(50_000).describe("Novo resumo completo em markdown. Substitui o anterior (que fica no histórico)."),
  status: areaStatusSchema.optional().describe("Novo status da área, se mudou"),
  area_nome: z.string().trim().min(1).max(120).optional().describe("Nome legível, usado só se a área for criada agora"),
  area_tipo: areaKindSchema.optional().describe("Tipo, usado só se a área for criada agora"),
});

export const editEntryInput = z.object({
  id: z.uuid().describe("ID do registro"),
  titulo: z.string().trim().min(1).max(200).optional(),
  conteudo: z.string().max(50_000).optional().describe("Novo conteúdo completo em markdown"),
  tipo: entryTypeSchema.optional(),
  tags: tags.optional(),
  fixado: booleanish.optional(),
  arquivado: booleanish.optional().describe("true para arquivar (não apaga), false para restaurar"),
  area_slug: slugInput.optional().describe("Mover o registro para outra área existente"),
  concluida: booleanish.optional().describe("true marca a tarefa como concluída, false reabre"),
  ...scheduleFields,
});

export const agendaInput = z.object({
  de: isoDate.optional().describe("Início do período. Padrão: hoje"),
  ate: isoDate.optional().describe("Fim do período. Padrão: 7 dias a partir de hoje"),
  area: slugInput.optional().describe("Restringir a uma área (slug)"),
});

export const tasksInput = z.object({
  status: z.enum(["pendentes", "concluidas", "todas"]).default("pendentes").describe("Quais tarefas listar"),
  area: slugInput.optional().describe("Restringir a uma área (slug)"),
  limite: limit(100, 30),
});

export const newsInput = z.object({
  topico: z.string().trim().max(60).optional().describe("Filtrar por tópico (ex.: IA, Dev, Tecnologia BR). Sem filtro: as melhores para o usuário"),
  horas: z.coerce.number().int().min(1).max(168).default(48).describe("Só notícias das últimas N horas (máx. 168)"),
  limite: limit(30, 10),
});

export const createAreaInput = z.object({
  nome: z.string().trim().min(1).max(120),
  slug: slugInput.optional(),
  tipo: areaKindSchema.default("projeto"),
  status: areaStatusSchema.default("ativo"),
  resumo: z.string().max(50_000).default(""),
});

export const updateAreaMetaInput = z.object({
  slug: slugInput,
  nome: z.string().trim().min(1).max(120).optional(),
  tipo: areaKindSchema.optional(),
  status: areaStatusSchema.optional(),
});

export const feedInput = z.object({
  fonte: sourceSchema.optional(),
  tipo: entryTypeSchema.optional(),
  area: slugInput.optional(),
  antes_de: isoDate.optional(),
  limite: limit(100, 30),
});

export const importInput = z.object({
  area_slug: slugInput,
  area_nome: z.string().trim().min(1).max(120).optional(),
  modo: z.enum(["registro", "resumo"]).default("registro"),
  arquivos: z
    .array(z.object({ nome: z.string().max(200), conteudo: z.string().max(200_000) }))
    .min(1)
    .max(50),
});

export type BriefingInput = z.input<typeof briefingInput>;
export type ListAreasInput = z.input<typeof listAreasInput>;
export type ReadAreaInput = z.input<typeof readAreaInput>;
export type ReadEntryInput = z.input<typeof readEntryInput>;
export type SearchInput = z.input<typeof searchInput>;
export type SaveEntryInput = z.input<typeof saveEntryInput>;
export type UpdateSummaryInput = z.input<typeof updateSummaryInput>;
export type EditEntryInput = z.input<typeof editEntryInput>;
export type CreateAreaInput = z.input<typeof createAreaInput>;
export type UpdateAreaMetaInput = z.input<typeof updateAreaMetaInput>;
export type FeedInput = z.input<typeof feedInput>;
export type AgendaInput = z.input<typeof agendaInput>;
export type TasksInput = z.input<typeof tasksInput>;
export type NewsInput = z.input<typeof newsInput>;
export type ImportInput = z.input<typeof importInput>;
