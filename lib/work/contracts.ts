import { z } from "zod";
export const WORKFLOWS = {
  ai_delivery: {
    version: 1,
    executor: "cursor",
    next: "Nox: ideia → Vega: especificação → Cursor: implementação → Vega: revisão e testes → Nox e Cauã: validação. Passagens assistidas com evidências na Central.",
  },
  message_delivery: {
    version: 1,
    executor: "clara",
    next: "Ler a menção e responder com referência à conversa",
  },
  capture: {
    version: 1,
    executor: "central",
    next: "Preservar e organizar anotação",
  },
  career_review: {
    version: 1,
    executor: "nox",
    next: "Verificar fonte, perfil e lacunas",
  },
  axial_lead: {
    version: 1,
    executor: "clara",
    next: "Validar demanda e contrato com o Painel",
  },
  code_demo: {
    version: 1,
    executor: "codex",
    next: "Implementar em ambiente isolado e executar testes",
  },
  marketing_package: {
    version: 1,
    executor: "rastro",
    next: "Preparar roteiro e peças de uma demo real",
  },
  weekly_review: {
    version: 1,
    executor: "clara",
    next: "Consolidar entregas, impedimentos e três próximos passos",
  },
} as const;
export const workInput = z.object({
  area_slug: z.string().min(1).max(80),
  objective: z.string().min(3).max(5000),
  assigned_agent: z.string().min(1).max(60),
  workflow_key: z.enum(
    Object.keys(WORKFLOWS) as [
      keyof typeof WORKFLOWS,
      ...(keyof typeof WORKFLOWS)[],
    ],
  ),
  expected_output: z.string().min(3).max(3000),
  acceptance_criteria: z.string().min(3).max(3000),
  input_refs: z
    .array(z.object({ url: z.url(), title: z.string().max(200).optional() }))
    .max(20)
    .default([]),
  allowed_actions: z
    .array(z.enum(["read", "prepare", "code", "render", "central_release"]))
    .default(["read", "prepare"]),
  depends_on: z.array(z.uuid()).max(10).default([]),
  due_at: z.iso.datetime({ offset: true }).optional(),
  idempotency_key: z.string().min(8).max(150),
});
export const messageInput = z.object({
  artifact_ids: z.array(z.uuid()).max(10).default([]),
  thread_id: z.uuid(),
  body: z.string().min(1).max(20000),
  reply_to: z.uuid().optional(),
  entry_id: z.uuid().optional(),
  origin_chat_title: z.string().max(200).optional(),
  origin_chat_url: z.url().optional(),
  idempotency_key: z.string().min(8).max(150),
});
export const leaseInput = z.object({
  run_id: z.uuid(),
  lease_token: z.uuid(),
  fencing_token: z.number().int().positive(),
});
export const reportInput = leaseInput.extend({
  status: z.enum([
    "delivered",
    "failed",
    "blocked",
    "waiting_approval",
    "uncertain",
  ]),
  result: z.object({
    summary: z.string().min(1).max(5000),
    evidence: z
      .array(
        z.object({
          url: z
            .url()
            .refine(
              (value) => new URL(value).protocol === "https:",
              "Evidência deve ter link HTTPS acessível; caminho local não é entrega.",
            ),
          title: z.string().min(1).max(200),
        }),
      )
      .max(30),
    next_step: z.string().max(1000).optional(),
  }),
});
export const approvalPayload = z.object({
  action: z.enum([
    "calendar_change",
    "purchase",
    "delete",
    "email",
    "message",
    "application",
    "social_post",
    "public_profile",
    "central_release",
  ]),
  account: z.string().min(1).max(200),
  target: z.string().min(1).max(1000),
  body: z.string().min(1).max(30000),
  attachments: z
    .array(
      z.object({
        artifact_id: z.uuid(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        version: z.number().int().positive(),
      }),
    )
    .max(20)
    .default([]),
});
export const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  running: "Executando",
  waiting_executor: "Aguardando executor",
  waiting_approval: "Aguardando aprovação",
  blocked: "Bloqueado",
  delivered: "Entregue",
  failed: "Falhou",
  cancelled: "Cancelado",
  pending: "Aguardando revisão",
  approved: "Aprovado",
  rejected: "Rejeitado",
  consuming: "Efeito em andamento",
  uncertain: "Resultado incerto",
  not_configured: "Não configurada",
  configured_unverified: "Configurada; teste pendente",
  verified: "Verificada",
  expired: "Expirada",
  quota_paused: "Pausada por cota",
  unavailable: "Indisponível",
};
