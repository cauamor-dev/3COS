import { z } from "zod";

export const SOURCES = ["claude", "chatgpt", "manual", "cursor"] as const;
export const AREA_KINDS = ["projeto", "trabalho", "faculdade", "curso", "pessoal", "ideia", "perfil"] as const;
export const AREA_STATUSES = ["ativo", "pausado", "concluido", "arquivado"] as const;
export const ENTRY_TYPES = ["contexto", "decisao", "progresso", "tarefa", "nota", "ideia"] as const;

export type Source = (typeof SOURCES)[number];
export type AreaKind = (typeof AREA_KINDS)[number];
export type AreaStatus = (typeof AREA_STATUSES)[number];
export type EntryType = (typeof ENTRY_TYPES)[number];

export const sourceSchema = z.enum(SOURCES);
export const areaKindSchema = z.enum(AREA_KINDS).describe("Tipo da área");
export const areaStatusSchema = z.enum(AREA_STATUSES).describe("Status da área");
export const entryTypeSchema = z.enum(ENTRY_TYPES).describe("Tipo do registro");

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
export type ImportInput = z.input<typeof importInput>;
