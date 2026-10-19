"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUp,
  FileText,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Reply,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  postTeamMessageAction,
  teamMessagesAction,
} from "@/app/(app)/team-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TeamMessage, TeamSnapshot } from "@/lib/team/types";
import { TeamAvatar } from "./team-primitives";

export function TeamChat({
  s,
  threadId,
  onTask,
}: {
  s: TeamSnapshot;
  threadId: string;
  onTask: (body: string) => void;
}) {
  const [state, setState] = useState<{
    key: string;
    messages: TeamMessage[];
    error?: string;
  }>({ key: "", messages: [] });
  const [version, setVersion] = useState(0),
    [body, setBody] = useState(""),
    [reply, setReply] = useState<TeamMessage | null>(null),
    [attached, setAttached] = useState<string[]>([]),
    [picker, setPicker] = useState(false),
    [fileQuery, setFileQuery] = useState("");
  const [pending, run] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const current = s.threads.find((t) => t.id === threadId);
  const key = `${threadId}:${version}`;
  useEffect(() => {
    let active = true;
    const request = s.demo
      ? Promise.resolve({
          ok: true as const,
          data: s.demoMessages?.[threadId] ?? [],
        })
      : teamMessagesAction(threadId);
    void request
      .then((r) => {
        if (active)
          setState(
            r.ok
              ? { key, messages: r.data as TeamMessage[] }
              : { key, messages: [], error: r.error },
          );
      })
      .catch(() => {
        if (active)
          setState({
            key,
            messages: [],
            error: "Não foi possível carregar. Tente atualizar a conversa.",
          });
      });
    return () => {
      active = false;
    };
  }, [threadId, key, s.demo, s.demoMessages]);
  useEffect(() => {
    if (s.demo) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setVersion((v) => v + 1);
    }, 45000);
    return () => clearInterval(timer);
  }, [s.demo]);
  const messages = state.key.startsWith(`${threadId}:`) ? state.messages : [];
  const loading = state.key !== key;
  return (
    <div className="flex min-h-[480px] min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">
            {current?.title ?? "Conversa"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {current?.visibility === "personal"
              ? "Privada · só você"
              : (current?.participants.length ?? 0) > 0
                ? current?.participants
                    .map((id) => s.agents.find((a) => a.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")
                : "Conversa do projeto"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label="Atualizar conversa"
          disabled={loading}
          onClick={() => setVersion((v) => v + 1)}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
      <div
        className="min-h-60 flex-1 space-y-5 overflow-y-auto p-5 md:max-h-[52dvh]"
        aria-live="polite"
        aria-busy={loading}
      >
        {state.error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-4 text-sm"
          >
            {state.error}
          </p>
        )}
        {loading && !messages.length ? (
          <p
            role="status"
            className="py-10 text-center text-sm text-muted-foreground"
          >
            Carregando conversa…
          </p>
        ) : !messages.length && !state.error ? (
          <EmptyState
            icon={MessageSquare}
            title="O contexto começa aqui"
            description="Converse sobre o projeto ou mencione alguém da equipe."
            compact
          />
        ) : null}
        {messages.length >= 30 && (
          <div className="text-center">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                const last = messages.at(-1);
                if (last)
                  run(async () => {
                    const r = await teamMessagesAction(
                      threadId,
                      last.created_at,
                      last.id,
                    );
                    if (r.ok)
                      setState((old) => ({
                        ...old,
                        messages: [
                          ...old.messages,
                          ...(r.data as TeamMessage[]),
                        ],
                      }));
                    else toast.error(r.error);
                  });
              }}
            >
              Carregar anteriores
            </Button>
          </div>
        )}
        {[...messages].reverse().map((m) => {
          const author =
            s.agents.find((a) => a.id === m.agent_id)?.name ??
            (m.source === "manual" ? "Você" : m.source);
          return (
            <article key={m.id} className="group flex gap-3">
              <TeamAvatar name={author} small />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold">{author}</span>
                  <time
                    className="text-[11px] text-muted-foreground"
                    dateTime={m.created_at}
                  >
                    {new Date(m.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {m.reply_to && (
                  <p className="mt-2 truncate border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">
                    ↳{" "}
                    {messages
                      .find((p) => p.id === m.reply_to)
                      ?.body.slice(0, 100) ?? "Mensagem anterior"}
                  </p>
                )}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                  {m.body}
                </p>
                {(m.refs ?? []).map((ref) => (
                  <a
                    key={ref.artifact_id}
                    href={`/api/files/${ref.artifact_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted"
                  >
                    <Paperclip className="size-3" />
                    {s.artifacts.find((a) => a.id === ref.artifact_id)?.name ??
                      "Abrir anexo"}
                  </a>
                ))}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    onClick={() => setReply(m)}
                  >
                    <Reply />
                    Responder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    onClick={() => onTask(m.body)}
                  >
                    <FileText />
                    Criar trabalho
                  </Button>
                  {m.entry_id && (
                    <Link
                      href={`/registros/${m.entry_id}`}
                      className="inline-flex min-h-8 items-center px-2 text-xs text-lilac"
                    >
                      Abrir registro
                    </Link>
                  )}
                </div>
                {m.origin_chat_title && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {m.origin_chat_title}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <form
        ref={form}
        className="border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim() || pending) return;
          run(async () => {
            const r = await postTeamMessageAction({
              thread_id: threadId,
              body,
              reply_to: reply?.id,
              entry_id: current?.entry_id ?? undefined,
              artifact_ids: attached,
              idempotency_key: crypto.randomUUID(),
            });
            if (r.ok) {
              setBody("");
              setReply(null);
              setAttached([]);
              setVersion((v) => v + 1);
            } else toast.error(r.error);
          });
        }}
      >
        {reply && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
            <p className="truncate">
              <Reply className="mr-2 inline size-3" />
              {reply.body.slice(0, 100)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancelar resposta"
              onClick={() => setReply(null)}
            >
              <X />
            </Button>
          </div>
        )}
        {attached.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attached.map((id) => (
              <span
                key={id}
                className="flex max-w-full items-center gap-1 rounded-lg border bg-muted/40 pl-2 text-xs"
              >
                <span className="max-w-44 truncate">
                  {s.artifacts.find((a) => a.id === id)?.name ?? "Anexo"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${s.artifacts.find((a) => a.id === id)?.name ?? "anexo"}`}
                  onClick={() =>
                    setAttached((ids) => ids.filter((v) => v !== id))
                  }
                >
                  <X />
                </Button>
              </span>
            ))}
          </div>
        )}
        <div className="rounded-xl border bg-background/70 p-2 focus-within:border-primary/50">
          <Textarea
            aria-label="Mensagem para a equipe"
            placeholder="Escreva uma mensagem…"
            maxLength={20000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                form.current?.requestSubmit();
              }
            }}
            className="min-h-20 resize-y border-0 bg-transparent! p-2 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-10 text-muted-foreground"
              onClick={() => setPicker(true)}
            >
              <Paperclip />
              Anexar
            </Button>
            <Button
              type="submit"
              className="h-10 px-4"
              disabled={pending || !body.trim() || s.demo}
            >
              <ArrowUp />
              {pending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          @menções entram na fila da próxima rotina.
        </p>
      </form>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Arquivos da biblioteca</DialogTitle>
            <DialogDescription>Até dez anexos por mensagem.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Buscar anexo"
            placeholder="Buscar arquivo…"
            value={fileQuery}
            onChange={(e) => setFileQuery(e.target.value)}
          />
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {s.artifacts
              .filter((a) =>
                a.name
                  .toLocaleLowerCase()
                  .includes(fileQuery.toLocaleLowerCase()),
              )
              .map((a) => (
                <label
                  key={a.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
                >
                  <Checkbox
                    aria-label={`Anexar ${a.name}`}
                    checked={attached.includes(a.id)}
                    disabled={!attached.includes(a.id) && attached.length >= 10}
                    onCheckedChange={(v) =>
                      setAttached((ids) =>
                        v === true
                          ? [...ids, a.id]
                          : ids.filter((id) => id !== a.id),
                      )
                    }
                  />
                  <FileText className="size-4 shrink-0 text-lilac" />
                  <span className="truncate text-sm">{a.name}</span>
                </label>
              ))}
            {!s.artifacts.length && (
              <EmptyState
                icon={Paperclip}
                title="Sua biblioteca está vazia"
                description="Envie um arquivo na aba Arquivos para anexá-lo aqui."
                compact
              />
            )}
          </div>
          <Button className="h-10" onClick={() => setPicker(false)}>
            Concluir · {attached.length}{" "}
            {attached.length === 1 ? "anexo" : "anexos"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
