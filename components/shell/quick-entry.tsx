"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveEntryAction } from "@/app/(app)/actions";
import {
  fromLocalInput,
  REMINDER_OPTIONS,
  reminderFrom,
} from "@/components/central/dates";
import { TYPE_LABEL } from "@/components/central/labels";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AttachmentPicker,
  attachmentFields,
  useAttachments,
} from "@/components/central/attachments";
import { cn } from "cn";
import {
  RECURRENCES,
  type EntryType,
  type Recurrence,
  type SaveEntryInput,
} from "@/lib/central/schemas";

const TYPE_ORDER: EntryType[] = [
  "tarefa",
  "evento",
  "nota",
  "ideia",
  "decisao",
  "progresso",
  "contexto",
  "post",
];

const NEW_AREA = "__nova__";
const RECURRENCE_LABEL: Record<Recurrence, string> = {
  diaria: "Todo dia",
  semanal: "Toda semana",
  mensal: "Todo mês",
  anual: "Todo ano",
};

export function QuickEntry() {
  const { quickEntry, closeQuickEntry } = useCentral();

  return (
    <Dialog
      open={quickEntry.open}
      onOpenChange={(open) => !open && closeQuickEntry()}
    >
      <DialogContent className="glass max-h-[88dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo registro</DialogTitle>
          <DialogDescription>
            Organize uma ideia, tarefa ou informação.
          </DialogDescription>
        </DialogHeader>
        <QuickEntryForm
          initialArea={quickEntry.areaSlug ?? "inbox"}
          initialType={quickEntry.type ?? "nota"}
          onSaved={closeQuickEntry}
        />
      </DialogContent>
    </Dialog>
  );
}

function QuickEntryForm({
  initialArea,
  initialType,
  onSaved,
}: {
  initialArea: string;
  initialType: EntryType;
  onSaved(): void;
}) {
  const { areas } = useCentral();
  const [areaSlug, setAreaSlug] = useState(initialArea);
  const [newAreaName, setNewAreaName] = useState("");
  const [type, setType] = useState<EntryType>(initialType);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | "none">("none");
  const [due, setDue] = useState("");
  const [reminder, setReminder] = useState("none");
  const [link, setLink] = useState("");
  const attachments = useAttachments();
  const [pending, startTransition] = useTransition();

  const sortedAreas = [...areas]
    .filter((area) => area.status !== "arquivado")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function scheduleInput(): Partial<SaveEntryInput> {
    if (type === "evento") {
      const startIso = allDay ? undefined : fromLocalInput(start);
      return {
        inicio: allDay ? start.slice(0, 10) : startIso,
        fim: allDay ? undefined : fromLocalInput(end),
        dia_inteiro: allDay,
        local: location || undefined,
        recorrencia: recurrence === "none" ? undefined : recurrence,
        lembrar_em: reminderFrom(
          allDay ? fromLocalInput(`${start.slice(0, 10)}T09:00`) : startIso,
          reminder,
        ),
      };
    }
    if (type === "tarefa") {
      const dueIso = fromLocalInput(due);
      return { prazo: dueIso, lembrar_em: reminderFrom(dueIso, reminder) };
    }
    if (type === "post") {
      return {
        links: link ? [{ url: link }] : undefined,
      };
    }
    return {};
  }

  // Uploaded files join the entry: first image as highlight, every file as a link.
  function withAttachments(
    input: Partial<SaveEntryInput>,
  ): Partial<SaveEntryInput> {
    if (!attachments.items.length) return input;
    const files = attachmentFields(attachments.items);
    return {
      ...input,
      ...files,
      ...(input.imagem && { imagem: input.imagem }),
      links: [...(input.links ?? []), ...files.links],
    };
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!title.trim() || attachments.busy) return;
    if (type === "evento" && !start) {
      toast.error("Escolha a data do evento.");
      return;
    }
    const creating = areaSlug === NEW_AREA;
    if (creating && !newAreaName.trim()) return;

    startTransition(async () => {
      const result = await saveEntryAction({
        area_slug: creating ? newAreaName : areaSlug,
        area_nome: creating ? newAreaName.trim() : undefined,
        tipo: type,
        titulo: title,
        conteudo: content,
        ...withAttachments(scheduleInput()),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        type === "evento"
          ? "Evento na agenda"
          : type === "tarefa"
            ? "Tarefa criada"
            : "Registro salvo",
      );
      onSaved();
    });
  }

  return (
    <form
      {...attachments.formProps}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
      }}
      className="min-w-0 space-y-4"
    >
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Tipo"
      >
        {TYPE_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => setType(value)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-[13px] text-muted-foreground transition-colors duration-150",
              type === value &&
                "border-primary/60 bg-primary/20 text-foreground",
            )}
          >
            {TYPE_LABEL[value]}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        <div className="space-y-2">
          <Label>Área</Label>
          <Select value={areaSlug} onValueChange={setAreaSlug}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortedAreas.map((area) => (
                <SelectItem key={area.id} value={area.slug}>
                  {area.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_AREA}>+ Nova área…</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {areaSlug === NEW_AREA && (
        <div className="space-y-2">
          <Label htmlFor="qe-area">Nome da nova área</Label>
          <Input
            id="qe-area"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            placeholder="Ex.: Axial"
            required
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="qe-title">Título</Label>
        <Input
          id="qe-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "evento"
              ? "Ex.: Reunião com o Lott"
              : type === "tarefa"
                ? "Ex.: Enviar proposta"
                : "O que aconteceu?"
          }
          required
          maxLength={200}
          autoFocus
        />
      </div>

      {type === "evento" && (
        <div className="space-y-3 rounded-lg border bg-white/[0.02] p-3">
          <label className="flex items-center justify-between text-sm">
            Dia inteiro
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qe-start">{allDay ? "Data" : "Início"}</Label>
              <Input
                id="qe-start"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? start.slice(0, 10) : start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            {!allDay && (
              <div className="space-y-1.5">
                <Label htmlFor="qe-end">Fim</Label>
                <Input
                  id="qe-end"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Local (opcional)"
            />
            <Select
              value={recurrence}
              onValueChange={(value) =>
                setRecurrence(value as Recurrence | "none")
              }
            >
              <SelectTrigger className="w-full" aria-label="Repetição">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não repete</SelectItem>
                {RECURRENCES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {RECURRENCE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ReminderSelect value={reminder} onChange={setReminder} />
        </div>
      )}

      {type === "tarefa" && (
        <div className="grid gap-3 rounded-lg border bg-white/[0.02] p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="qe-due">Prazo (opcional)</Label>
            <Input
              id="qe-due"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lembrete</Label>
            <ReminderSelect
              value={reminder}
              onChange={setReminder}
              disabled={!due}
            />
          </div>
        </div>
      )}

      {type === "post" && (
        <div className="grid gap-3 rounded-lg border bg-white/[0.02] p-3">
          <Input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (opcional)"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="qe-content">Texto</Label>
        <Textarea
          id="qe-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Markdown é bem-vindo"
          className="min-h-24 font-mono text-[13px]"
        />
      </div>
      <AttachmentPicker attachments={attachments} />
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono hidden sm:block">ctrl + enter</span>
        <Button
          type="submit"
          disabled={pending || attachments.busy}
          className="ml-auto"
        >
          {pending ? <Loader2 className="animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function ReminderSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label="Lembrete">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {REMINDER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QuickEntryFab() {
  const { openQuickEntry } = useCentral();
  return (
    <Button
      onClick={() => openQuickEntry()}
      size="lg"
      className="fixed right-6 bottom-6 z-30 hidden h-12 rounded-full px-5 shadow-[0_10px_40px_-8px_oklch(0.62_0.24_293/0.7)] md:inline-flex"
    >
      <Plus /> Novo registro
    </Button>
  );
}
