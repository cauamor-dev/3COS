"use client";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  createClientAction,
  createThreadAction,
  createWorkAction,
} from "@/app/(app)/team-actions";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldSelect } from "@/components/ui/field-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TeamSnapshot, TeamWork } from "@/lib/team/types";
import { WORKFLOWS } from "@/lib/work/contracts";
import { TeamAvatar } from "./team-primitives";

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
const workflowLabels: Record<keyof typeof WORKFLOWS, string> = {
  message_delivery: "Responder uma conversa",
  capture: "Organizar uma anotação",
  career_review: "Revisar carreira",
  axial_lead: "Trabalhar um lead",
  code_demo: "Construir uma demo",
  marketing_package: "Preparar conteúdo",
  weekly_review: "Revisar a semana",
};
export function WorkDialog({
  s,
  open,
  onOpenChange,
  draft = "",
}: {
  s: TeamSnapshot;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft?: string;
}) {
  const { areas } = useCentral();
  const [pending, run] = useTransition();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Novo trabalho"
      description="Defina o resultado e quem cuida dele."
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            const r = await createWorkAction({
              area_slug: String(f.get("area")),
              objective: String(f.get("objective")),
              assigned_agent: String(f.get("agent")),
              workflow_key: String(f.get("workflow")) as keyof typeof WORKFLOWS,
              expected_output: String(f.get("output")),
              acceptance_criteria: String(f.get("criteria")),
              idempotency_key: crypto.randomUUID(),
            });
            if (r.ok) {
              onOpenChange(false);
              toast.success("Trabalho criado.");
            } else toast.error(r.error);
          });
        }}
      >
        <FormField label="O que precisa ser feito?">
          <Textarea
            name="objective"
            aria-label="Objetivo do trabalho"
            required
            minLength={3}
            defaultValue={draft}
            placeholder="Ex.: preparar três posts para a próxima semana"
            className="min-h-24"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Projeto">
            <FieldSelect
              label="Projeto do trabalho"
              name="area"
              defaultValue={
                areas.find((a) => a.slug === "inbox")?.slug ?? areas[0]?.slug
              }
              options={areas.map((a) => ({ value: a.slug, label: a.name }))}
              required
            />
          </FormField>
          <FormField label="Responsável">
            <FieldSelect
              label="Responsável pelo trabalho"
              name="agent"
              defaultValue={
                s.agents.find((a) => a.handle === "clara")?.handle ??
                s.agents[0]?.handle
              }
              options={s.agents
                .filter((a) => a.handle !== "teo")
                .map((a) => ({ value: a.handle, label: a.name }))}
              required
            />
          </FormField>
        </div>
        <FormField label="Tipo de trabalho">
          <FieldSelect
            label="Tipo de trabalho"
            name="workflow"
            defaultValue="weekly_review"
            options={Object.keys(WORKFLOWS).map((key) => ({
              value: key,
              label: workflowLabels[key as keyof typeof WORKFLOWS],
            }))}
          />
        </FormField>
        <FormField label="Entrega esperada">
          <Input
            name="output"
            aria-label="Entrega esperada"
            required
            minLength={3}
            placeholder="Ex.: três rascunhos com texto e imagem"
            className="h-10"
          />
        </FormField>
        <FormField label="Como saberemos que está pronto?">
          <Input
            name="criteria"
            aria-label="Critério de pronto"
            required
            minLength={3}
            placeholder="Ex.: textos revisados e arquivos anexados"
            className="h-10"
          />
        </FormField>
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button className="h-10" disabled={pending || s.demo}>
            {pending ? "Criando…" : "Criar trabalho"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
export function ThreadDialog({
  s,
  open,
  onOpenChange,
  onCreated,
  work,
}: {
  s: TeamSnapshot;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
  work?: TeamWork | null;
}) {
  const { areas } = useCentral();
  const [pending, run] = useTransition();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nova conversa"
      description={
        work
          ? "Uma conversa ligada a este trabalho."
          : "Reúna o contexto de um projeto em um só lugar."
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            const r = await createThreadAction({
              title: f.get("title"),
              area_slug: f.get("area"),
              entry_id: work?.entry_id,
              participants: f.getAll("participants"),
            });
            if (r.ok) {
              onOpenChange(false);
              onCreated((r.data as { id: string }).id);
              toast.success("Conversa criada.");
            } else toast.error(r.error);
          });
        }}
      >
        <FormField label="Nome da conversa">
          <Input
            name="title"
            aria-label="Nome da conversa"
            required
            maxLength={200}
            defaultValue={work?.objective}
            placeholder="Ex.: Conteúdo da semana"
            className="h-11"
          />
        </FormField>
        <FormField label="Projeto">
          <FieldSelect
            name="area"
            label="Projeto da conversa"
            defaultValue={
              areas.find((a) => a.id === work?.area_id)?.slug ??
              areas.find((a) => a.slug === "inbox")?.slug ??
              areas[0]?.slug
            }
            options={areas.map((a) => ({ value: a.slug, label: a.name }))}
            required
          />
        </FormField>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Participantes</legend>
          <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
            {s.agents.map((a) => (
              <label
                key={a.id}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  name="participants"
                  value={a.id}
                  defaultChecked={
                    a.id === work?.assigned_agent_id ||
                    a.id === work?.bridge_agent_id
                  }
                  aria-label={`Incluir ${a.name}`}
                />
                <TeamAvatar name={a.name} small />
                <span className="truncate">{a.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button className="h-10" disabled={pending || s.demo}>
            {pending ? "Criando…" : "Criar conversa"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
export function ClientDialog({
  s,
  open,
  onOpenChange,
  onToken,
}: {
  s: TeamSnapshot;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onToken: (token: string) => void;
}) {
  const { areas } = useCentral();
  const [pending, run] = useTransition();
  const options = s.agents.filter(
    (a) =>
      ["grok", "claude", "chatgpt", "codex", "cursor", "opencode"].includes(
        a.platform,
      ) &&
      (a.platform !== "grok" || a.handle === "clara"),
  );
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Conectar agente"
      description="Escolha quem pode acessar e quais projetos compartilhar."
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            const r = await createClientAction({
              name: f.get("name"),
              agent_id: f.get("agent_id"),
              areas: selected,
              execute: f.get("execute") === "on",
            });
            if (r.ok) {
              onOpenChange(false);
              onToken(r.data.token);
            } else toast.error(r.error);
          });
        }}
      >
        <FormField label="Nome da conexão">
          <Input
            name="name"
            aria-label="Nome da conexão"
            required
            placeholder="Ex.: Clara no Grok Bot"
            className="h-10"
          />
        </FormField>
        <FormField label="Agente">
          <FieldSelect
            name="agent_id"
            label="Agente da conexão"
            defaultValue={
              options.find((a) => a.handle === "clara")?.id ?? options[0]?.id
            }
            options={options.map((a) => ({ value: a.id, label: a.name }))}
            required
          />
        </FormField>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">
            Projetos permitidos
          </legend>
          <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
            {areas.map((a) => (
              <label
                key={a.id}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.includes(a.id)}
                  onCheckedChange={(v) =>
                    setSelected((ids) =>
                      v === true
                        ? [...ids, a.id]
                        : ids.filter((id) => id !== a.id),
                    )
                  }
                  aria-label={`Permitir ${a.name}`}
                />
                <span className="truncate">{a.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Checkbox name="execute" className="mt-0.5" />
          Permitir assumir trabalhos dos projetos selecionados
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Só Clara recebe conexão Grok. Notas privadas e finanças ficam fora
          deste acesso. O token expira em 90 dias e pode ser revogado.
        </p>
        <div className="flex justify-end border-t pt-4">
          <Button
            className="h-10"
            disabled={pending || s.demo || !selected.length}
          >
            Gerar acesso limitado
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
