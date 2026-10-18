"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { editEntryAction } from "@/app/(app)/actions";
import type { Entry } from "@/lib/central/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "./markdown";
import {
  AttachmentPicker,
  attachmentFields,
  useAttachments,
} from "./attachments";
import { fromLocalInput, toLocalInput } from "./dates";
import { RECURRENCES } from "@/lib/central/schemas";

export function EntryDetail({ entry }: { entry: Entry }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.content_md);
  const [access, setAccess] = useState(entry.ai_access ?? "shared");
  const [start, setStart] = useState(toLocalInput(entry.starts_at));
  const [due, setDue] = useState(toLocalInput(entry.due_at));
  const [end,setEnd]=useState(toLocalInput(entry.ends_at));
  const [remind,setRemind]=useState(toLocalInput(entry.remind_at));
  const [allDay,setAllDay]=useState(entry.all_day);
  const [recurrence,setRecurrence]=useState(entry.recurrence??"");
  const [pending, run] = useTransition();
  const files = useAttachments();
  function save(patch: Parameters<typeof editEntryAction>[0]) {
    run(async () => {
      const result = await editEntryAction({
        ...patch,
        id: entry.id,
        revision: entry.revision,
      });
      if (!result.ok) toast.error(result.error);
      else {
        setEditing(false);
        files.clear();
        toast.success("Registro atualizado; histórico preservado.");
      }
    });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditing(!editing)}>
          Editar
        </Button>
        {(entry.type === "tarefa" || entry.type === "evento") && (
          <Button
            disabled={pending}
            onClick={() => save({ id: entry.id, concluida: !entry.done_at })}
          >
            {entry.done_at ? "Reabrir" : "Concluir"}
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => save({ id: entry.id, arquivado: !entry.archived })}
        >
          {entry.archived ? "Restaurar" : "Arquivar"}
        </Button>
        <Link
          className="self-center text-sm text-lilac"
          href={`/historico/registro/${entry.id}`}
        >
          Histórico e desfazer
        </Link>
      </div>
      {editing ? (
        <form
          className="glass space-y-4 rounded-xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save({
              id: entry.id,
              titulo: title,
              conteudo: body,
              ai_access: access,
              ...(start && { inicio: fromLocalInput(start) }),
              ...(due && { prazo: fromLocalInput(due) }),
              ...(end && {fim:fromLocalInput(end)}),
              ...(remind && {lembrar_em:fromLocalInput(remind)}),
              dia_inteiro:allDay,
              ...(recurrence&&{recorrencia:recurrence as typeof entry.recurrence & string}),
              limpar:[...(!due&&entry.due_at?["prazo" as const]:[]),...(!end&&entry.ends_at?["fim" as const]:[]),...(!remind&&entry.remind_at?["lembrar_em" as const]:[]),...(!recurrence&&entry.recurrence?["recorrencia" as const]:[])],
              ...(files.items.length && {
                links: [
                  ...entry.links,
                  ...attachmentFields(files.items).links,
                ].slice(0, 10),
              }),
            });
          }}
        >
          <label className="block text-sm">
            Título
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label className="block text-sm">
            Conteúdo
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              maxLength={50000}
            />
          </label>
          {entry.type === "evento" && (
            <label className="block text-sm">
              Início (Brasília)
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
          )}
          {entry.type === "tarefa" && (
            <label className="block text-sm">
              Prazo (Brasília)
              <Input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          )}
          {entry.type==="evento"&&<><label className="block text-sm">Fim (Brasília)<Input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} /></label><label className="block text-sm"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)} /> Dia inteiro</label></>}
          {(entry.type==="evento"||entry.type==="tarefa")&&<><label className="block text-sm">Lembrete (Brasília)<Input type="datetime-local" value={remind} onChange={e=>setRemind(e.target.value)} /></label><label className="block text-sm">Recorrência<select className="mt-1 block w-full rounded-lg border bg-background p-2" value={recurrence} onChange={e=>setRecurrence(e.target.value)}><option value="">Sem repetição</option>{RECURRENCES.map(r=><option key={r} value={r}>{({diaria:"Diária",semanal:"Semanal",mensal:"Mensal",anual:"Anual"})[r]}</option>)}</select></label></>}
          <label className="block text-sm">
            Acesso de IA
            <select
              className="mt-1 block w-full rounded-lg border bg-background p-2"
              value={access}
              onChange={(e) => setAccess(e.target.value as typeof access)}
            >
              <option value="shared">
                Compartilhado com conexões autorizadas
              </option>
              <option value="restricted">
                Restrito: exige concessão explícita
              </option>
              <option value="private">Privado: fora do contexto de IA</option>
            </select>
          </label>
          <AttachmentPicker attachments={files} />
          <Button disabled={pending || files.busy}>Salvar</Button>
        </form>
      ) : (
        <div className="glass rounded-xl p-5">
          <Markdown>{entry.content_md || "Sem conteúdo adicional."}</Markdown>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Origem: {entry.origin_chat_title ?? "origem não informada"} · Revisão{" "}
        {entry.revision ?? 1} ·{" "}
        {entry.ai_access === "private"
          ? "Privado"
          : entry.ai_access === "restricted"
            ? "Restrito"
            : "Compartilhado"}
      </p>
      {entry.original_text && entry.original_text !== entry.content_md && (
        <details className="glass rounded-xl p-4">
          <summary>Texto original preservado</summary>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm">
            {entry.original_text}
          </p>
        </details>
      )}
    </div>
  );
}
