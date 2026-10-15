import type { AreaKind, AreaStatus, EntryType, Source } from "@/lib/central/schemas";

export const SOURCE_LABEL: Record<Source, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  manual: "Manual",
  cursor: "Cursor",
};

export const SOURCE_COLOR: Record<Source, string> = {
  claude: "var(--source-claude)",
  chatgpt: "var(--source-chatgpt)",
  manual: "var(--source-manual)",
  cursor: "var(--source-cursor)",
};

export const KIND_LABEL: Record<AreaKind, string> = {
  projeto: "Projeto",
  trabalho: "Trabalho",
  faculdade: "Faculdade",
  curso: "Curso",
  pessoal: "Pessoal",
  ideia: "Ideia",
  perfil: "Perfil",
};

export const STATUS_LABEL: Record<AreaStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

export const TYPE_LABEL: Record<EntryType, string> = {
  contexto: "Contexto",
  decisao: "Decisão",
  progresso: "Progresso",
  tarefa: "Tarefa",
  nota: "Nota",
  ideia: "Ideia",
  evento: "Evento",
  post: "Post",
};
