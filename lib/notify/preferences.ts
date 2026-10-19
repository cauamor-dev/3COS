import { z } from "zod";
export const NOTICE_LABELS = {
  reminder: "Lembretes da agenda",
  task_assigned: "Tarefas novas",
  due_soon: "Prazos próximos",
  overdue: "Tarefas atrasadas",
  approval: "Aguardando meu ok",
  delivery: "Entregas",
  failure: "Falhas e impedimentos",
  daily_summary: "Resumo diário",
} as const;
export const preferencesInput = z.object({
  in_app: z.boolean(),
  push: z.boolean(),
  kinds: z
    .array(
      z.enum(
        Object.keys(NOTICE_LABELS) as [
          keyof typeof NOTICE_LABELS,
          ...(keyof typeof NOTICE_LABELS)[],
        ],
      ),
    )
    .max(8),
  quiet_start: z.number().int().min(0).max(23),
  quiet_end: z.number().int().min(0).max(23),
  lead_minutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(180),
    z.literal(1440),
  ]),
});
export type NotificationPreferences = z.infer<typeof preferencesInput>;
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  in_app: true,
  push: false,
  kinds: [
    "reminder",
    "task_assigned",
    "due_soon",
    "overdue",
    "approval",
    "delivery",
    "failure",
  ],
  quiet_start: 22,
  quiet_end: 8,
  lead_minutes: 60,
};
export interface InboxNotice {
  entry_id?: string | null;
  id: string;
  kind: string;
  title: string;
  body: string;
  path: string;
  created_at: string;
  read_at: string | null;
  push_status: string;
}
