"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Circle,
  CirclePause,
  FileText,
  FolderKanban,
  Link2,
  LockKeyhole,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { pauseTeamAction, workStateAction } from "@/app/(app)/team-actions";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldSelect } from "@/components/ui/field-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TeamSnapshot } from "@/lib/team/types";
import { BOARD_COLUMNS, filterWorks, workColumn } from "@/lib/team/board";
import { StatusBadge, TeamAvatar, stepLabel } from "./team-primitives";
import { ClientDialog, ThreadDialog, WorkDialog } from "./team-forms";
import { TeamChat } from "./team-chat";
import {
  TeamApprovals,
  TeamConnections,
  TeamDeliveries,
  TeamPeople,
  TeamRoutines,
} from "./team-sections";

const tabs = [
  { id: "board", title: "Quadro", icon: FolderKanban },
  { id: "chat", title: "Conversas", icon: MessageSquare },
  { id: "approvals", title: "Aprovações", icon: ShieldCheck },
  { id: "deliveries", title: "Entregas", icon: CheckCheck },
  { id: "people", title: "Pessoas", icon: Users },
  { id: "routines", title: "Rotinas", icon: CalendarClock },
  { id: "connections", title: "Conexões", icon: Link2 },
];
export function TeamView({
  snapshot: s,
  focusWork,
  focusTab,
  focusConnect,
}: {
  snapshot: TeamSnapshot;
  focusWork?: string;
  focusTab?: string;
  focusConnect?: string;
}) {
  const { areas } = useCentral();
  const [tab, setTab] = useState(
      tabs.some((t) => t.id === focusTab) ? focusTab! : "board",
    ),
    [query, setQuery] = useState(""),
    [area, setArea] = useState("all"),
    [thread, setThread] = useState(s.threads[0]?.id ?? ""),
    [threadQuery, setThreadQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(
      focusTab === "approvals" ? null : (focusWork ?? null),
    ),
    [workOpen, setWorkOpen] = useState(false),
    [threadOpen, setThreadOpen] = useState(false),
    [threadWork, setThreadWork] = useState<string | null>(null),
    [clientOpen, setClientOpen] = useState(
      focusConnect === "clara" || focusConnect === "cursor",
    ),
    [draft, setDraft] = useState(""),
    [token, setToken] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const active = s.works.filter(
    (w) => !["delivered", "cancelled"].includes(w.status),
  );
  const approvals = s.approvals.filter((a) => a.status === "pending");
  const works = filterWorks(s.works, query, area);
  const work = s.works.find((w) => w.entry_id === selected);
  const workThread = work
    ? s.threads.find((t) => t.entry_id === work.entry_id)
    : undefined;
  const selectedThread = s.threads.find((t) => t.id === thread) ?? s.threads[0];
  const newWork = (text = "") => {
    setDraft(text);
    setWorkOpen(true);
  };
  const openThread = (workId?: string) => {
    setThreadWork(workId ?? null);
    setThreadOpen(true);
  };
  return (
    <div className="min-w-0 space-y-5">
      {s.error && (
        <p
          role="status"
          className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm"
        >
          {s.error}
        </p>
      )}
      {s.demo && (
        <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
          Demonstração visual · dados fictícios, sem ações ou conexões externas.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2">
            <span
              className="size-1.5 rounded-full bg-lilac"
              aria-hidden="true"
            />
            <strong className="font-medium">{active.length}</strong>
            <span className="text-muted-foreground">em aberto</span>
          </span>
          <span className="h-4 border-l" />
          <button
            className="inline-flex min-h-10 items-center gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setTab("approvals")}
          >
            <ShieldCheck className="size-4" />
            <strong className="font-medium text-foreground">
              {approvals.length}
            </strong>
            para revisar
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10"
            disabled={pending || s.demo}
            onClick={() =>
              run(async () => {
                try {
                  const r = await pauseTeamAction(!s.paused);
                  if (!r.ok) toast.error(r.error);
                } catch {
                  toast.error("Não foi possível alterar a pausa.");
                }
              })
            }
          >
            {s.paused ? <Play /> : <Pause />}
            {s.paused ? "Retomar" : "Pausar tudo"}
          </Button>
          <Button className="h-10 px-4" onClick={() => newWork()}>
            <Plus />
            Novo trabalho
          </Button>
        </div>
      </div>
      {s.paused && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CirclePause className="size-3.5 shrink-0" />
          <span>Execuções da Central pausadas.</span>
          <details className="relative">
            <summary className="cursor-pointer text-lilac">Entender</summary>
            <div className="absolute left-0 top-7 z-20 w-64 rounded-xl border bg-popover p-4 text-xs leading-relaxed shadow-lg">
              A pausa bloqueia novas execuções da Central. Rotinas nativas do
              Grok e do Claude continuam sob controle da plataforma.
            </div>
          </details>
        </div>
      )}
      <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-5">
        <div className="no-scrollbar max-w-full overflow-x-auto overflow-y-hidden border-b pb-1">
          <TabsList
            variant="line"
            aria-label="Seções da equipe"
            className="h-12! gap-1 p-0"
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="h-11! gap-2 px-3 data-active:text-lilac data-active:after:bg-primary"
              >
                <t.icon className="size-4" />
                {t.title}
                {t.id === "approvals" && approvals.length > 0 && (
                  <span className="rounded bg-primary/15 px-1.5 text-[10px] text-lilac">
                    {approvals.length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="board" className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Buscar trabalho"
                placeholder="Buscar no quadro…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <div className="w-full sm:w-56">
              <FieldSelect
                label="Filtrar por projeto"
                value={area}
                onValueChange={setArea}
                options={[
                  { value: "all", label: "Todos os projetos" },
                  ...areas.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map((col) => {
              const cards = works.filter(
                (w) => workColumn(w.status) === col.id,
              );
              return (
                <section
                  key={col.id}
                  aria-label={col.title}
                  className="min-w-0 rounded-2xl border bg-muted/15 p-3"
                >
                  <header className="mb-4 flex items-center gap-2 px-1 pt-1">
                    <span
                      className={`size-2 shrink-0 rounded-full ${col.id === "doing" ? "bg-primary" : col.id === "review" ? "bg-amber-300" : "bg-muted-foreground/50"}`}
                      aria-hidden="true"
                    />
                    <h2 className="text-sm font-medium">{col.title}</h2>
                    <span className="ml-auto rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {cards.length}
                    </span>
                  </header>
                  <div className="space-y-3">
                    {cards.map((w) => {
                      const agent = s.agents.find(
                        (a) => a.id === w.assigned_agent_id,
                      );
                      return (
                        <button
                          key={w.entry_id}
                          onClick={() => setSelected(w.entry_id)}
                          className="group w-full min-w-0 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <p className="mb-2 truncate text-[11px] text-muted-foreground">
                            {areas.find((a) => a.id === w.area_id)?.name ??
                              "Projeto"}
                          </p>
                          <h3 className="break-words text-sm font-semibold leading-relaxed">
                            {w.objective}
                          </h3>
                          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {stepLabel(w.current_step)}
                          </p>
                          <div className="mt-4 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <TeamAvatar
                                name={agent?.name ?? "Equipe"}
                                small
                              />
                              <span className="truncate text-xs">
                                {agent?.name ?? "Equipe"}
                              </span>
                            </div>
                            {s.threads.some(
                              (t) => t.entry_id === w.entry_id,
                            ) && (
                              <MessageSquare
                                className="size-3.5 text-muted-foreground"
                                aria-label="Tem conversa"
                              />
                            )}
                          </div>
                          <div className="mt-3">
                            <StatusBadge status={w.status} />
                          </div>
                        </button>
                      );
                    })}
                    {!cards.length && (
                      <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed px-3 text-center text-xs text-muted-foreground">
                        {col.id === "done" ? (
                          <CheckCircle2 className="mb-3 size-5 opacity-40" />
                        ) : (
                          <Circle className="mb-3 size-5 opacity-40" />
                        )}
                        <p>
                          {col.id === "todo"
                            ? "Espaço para o próximo passo"
                            : col.id === "doing"
                              ? "Nenhum trabalho em execução"
                              : col.id === "review"
                                ? "Nenhuma decisão pendente"
                                : "As entregas aparecem aqui"}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          {!works.length && s.works.length > 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Nenhum trabalho encontrado com esses filtros.
            </p>
          )}
        </TabsContent>
        <TabsContent value="chat">
          <div className="glass grid min-w-0 overflow-hidden rounded-2xl md:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="min-w-0 border-b bg-background/30 md:border-r md:border-b-0">
              <div className="flex items-center justify-between gap-2 p-4">
                <h2 className="text-sm font-semibold">Conversas</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="Nova conversa"
                  onClick={() => openThread()}
                >
                  <Plus />
                </Button>
              </div>
              <div className="px-3 pb-3">
                <Input
                  aria-label="Buscar conversa"
                  placeholder="Buscar…"
                  value={threadQuery}
                  onChange={(e) => setThreadQuery(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto p-2 pt-0 md:block md:max-h-[65dvh] md:space-y-1 md:overflow-y-auto">
                {s.threads
                  .filter((t) =>
                    t.title
                      .toLocaleLowerCase()
                      .includes(threadQuery.toLocaleLowerCase()),
                  )
                  .map((t) => (
                    <button
                      key={t.id}
                      className={`flex min-h-14 min-w-36 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors md:w-full ${selectedThread?.id === t.id ? "border border-primary/20 bg-primary/10" : "border border-transparent hover:bg-muted/50"}`}
                      onClick={() => setThread(t.id)}
                    >
                      {t.visibility === "personal" ? (
                        <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <MessageSquare
                          className={`size-4 shrink-0 ${selectedThread?.id === t.id ? "text-lilac" : "text-muted-foreground"}`}
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block max-w-36 truncate text-sm font-medium">
                          {t.title}
                        </span>
                        <span className="mt-1 block max-w-36 truncate text-[11px] text-muted-foreground">
                          {areas.find((a) => a.id === t.area_id)?.name ??
                            "Geral"}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            </aside>
            <div className="min-w-0">
              {selectedThread ? (
                <TeamChat
                  key={selectedThread.id}
                  s={s}
                  threadId={selectedThread.id}
                  onTask={(text) => newWork(text)}
                />
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="Uma conversa para cada projeto"
                  description="Decisões, referências e próximos passos juntos."
                  action={
                    <Button className="h-10" onClick={() => openThread()}>
                      <Plus />
                      Nova conversa
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="approvals">
          <TeamApprovals s={s} focusWork={focusWork} />
        </TabsContent>
        <TabsContent value="deliveries">
          <TeamDeliveries s={s} />
        </TabsContent>
        <TabsContent value="people">
          <TeamPeople s={s} />
        </TabsContent>
        <TabsContent value="routines">
          <TeamRoutines s={s} />
        </TabsContent>
        <TabsContent value="connections">
          <TeamConnections s={s} onConnect={() => setClientOpen(true)} />
        </TabsContent>
      </Tabs>
      <Sheet
        open={!!work}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <SheetContent className="w-full! gap-0 overflow-y-auto sm:max-w-2xl!">
          <SheetHeader className="border-b px-6 pt-7 pb-5">
            <SheetTitle className="pr-8 text-xl leading-snug">
              {work?.objective}
            </SheetTitle>
            <SheetDescription>
              {s.agents.find((a) => a.id === work?.assigned_agent_id)?.name ??
                "Equipe"}{" "}
              · {areas.find((a) => a.id === work?.area_id)?.name ?? "Projeto"}
            </SheetDescription>
          </SheetHeader>
          {work && (
            <>
              <div className="space-y-3 border-b px-6 py-4">
                <StatusBadge status={work.status} />
                <p className="text-sm leading-relaxed">
                  <span className="text-muted-foreground">
                    Próximo passo ·{" "}
                  </span>
                  {stepLabel(work.current_step)}
                </p>
                {work.last_error && (
                  <p role="alert" className="text-sm text-destructive">
                    {work.last_error}
                  </p>
                )}
              </div>
              <Tabs defaultValue="conversation" className="gap-0">
                <TabsList className="mx-6 my-4 h-10">
                  <TabsTrigger value="conversation" className="px-4">
                    <MessageSquare />
                    Conversa
                  </TabsTrigger>
                  <TabsTrigger value="details" className="px-4">
                    <FileText />
                    Detalhes
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="conversation">
                  {workThread ? (
                    <TeamChat
                      key={workThread.id}
                      s={s}
                      threadId={workThread.id}
                      onTask={(text) => newWork(text)}
                    />
                  ) : (
                    <EmptyState
                      icon={MessageSquare}
                      title="Converse sobre este trabalho"
                      description="Mantenha decisões e arquivos ligados ao cartão."
                      action={
                        <Button
                          className="h-10"
                          onClick={() => openThread(work.entry_id)}
                        >
                          <Plus />
                          Iniciar conversa
                        </Button>
                      }
                    />
                  )}
                </TabsContent>
                <TabsContent value="details" className="space-y-5 px-6 pb-6">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">
                      Entrega esperada
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {work.expected_output}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium">
                      Critério de pronto
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {work.acceptance_criteria}
                    </p>
                  </div>
                  {work.due_at && (
                    <p className="text-sm">
                      Prazo:{" "}
                      {new Date(work.due_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </p>
                  )}
                  <div className="space-y-2">
                    {s.artifacts
                      .filter((a) => a.entry_id === work.entry_id)
                      .map((a) => (
                        <a
                          key={a.id}
                          href={`/api/files/${a.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/40"
                        >
                          <FileText className="size-4 shrink-0 text-lilac" />
                          <span className="truncate">{a.name}</span>
                        </a>
                      ))}
                  </div>
                  <Link
                    href={`/registros/${work.entry_id}`}
                    className="inline-flex min-h-10 items-center gap-2 text-sm text-lilac"
                  >
                    Abrir registro completo <ChevronRight className="size-4" />
                  </Link>
                  {!["delivered", "cancelled"].includes(work.status) && (
                    <details className="border-t pt-4 text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        Ações do trabalho
                      </summary>
                      <Button
                        variant="destructive"
                        className="mt-3 h-10"
                        disabled={pending || s.demo}
                        onClick={() =>
                          run(async () => {
                            const r = await workStateAction({
                              entry_id: work.entry_id,
                              status: "cancelled",
                            });
                            if (!r.ok) toast.error(r.error);
                          })
                        }
                      >
                        <X />
                        Cancelar trabalho
                      </Button>
                    </details>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
      <WorkDialog
        s={s}
        open={workOpen}
        onOpenChange={setWorkOpen}
        draft={draft}
      />
      <ThreadDialog
        s={s}
        open={threadOpen}
        onOpenChange={setThreadOpen}
        work={s.works.find((w) => w.entry_id === threadWork)}
        onCreated={(id) => {
          setThread(id);
          if (!threadWork) setTab("chat");
        }}
      />
      <ClientDialog
        preset={
          focusConnect === "clara" || focusConnect === "cursor"
            ? focusConnect
            : undefined
        }
        s={s}
        open={clientOpen}
        onOpenChange={setClientOpen}
        onToken={setToken}
      />
      <Dialog
        open={!!token}
        onOpenChange={(v) => {
          if (!v) setToken(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Acesso gerado</DialogTitle>
            <DialogDescription>
              Copie agora para o segredo da plataforma autorizada. Ele não será
              exibido novamente.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            aria-label="Token gerado"
            readOnly
            value={token ?? ""}
            onFocus={(e) => e.target.select()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setToken(null)}>
              Ocultar
            </Button>
            <Button
              onClick={() => {
                if (token)
                  void navigator.clipboard
                    .writeText(token)
                    .then(() =>
                      toast.success(
                        "Copiado para configurar o destino autorizado.",
                      ),
                    )
                    .catch(() =>
                      toast.error("Selecione e copie o campo manualmente."),
                    );
              }}
            >
              Copiar token
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
