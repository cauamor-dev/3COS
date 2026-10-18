"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  createClientAction,
  createThreadAction,
  createWorkAction,
  decideApprovalAction,
  decideApprovalsAction,
  pauseTeamAction,
  postTeamMessageAction,
  revokeClientAction,
  teamMessagesAction,
  workStateAction,
  toggleAgentAction,
} from "@/app/(app)/team-actions";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TeamMessage, TeamSnapshot } from "@/lib/team/types";
import { STATUS_LABEL, WORKFLOWS } from "@/lib/work/contracts";

const TABS = [
  "Visão geral",
  "Conversas",
  "Trabalhos",
  "Rotinas",
  "Conexões",
  "Entregas",
  "Aprovações",
];
export function TeamView({ snapshot: s }: { snapshot: TeamSnapshot }) {
  const [tab, setTab] = useState("Visão geral");
  const [pending, run] = useTransition();
  const { areas } = useCentral();
  const [thread, setThread] = useState(s.threads[0]?.id ?? "");
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedApprovals, setSelectedApprovals] = useState<string[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    if (thread)
      void teamMessagesAction(thread).then((r) => {
        if (active) {
          if (r.ok) setMessages(r.data as TeamMessage[]);
          else setError(r.error);
        }
      });
    return () => {
      active = false;
    };
  }, [thread]);
  const label = (status: string) => STATUS_LABEL[status] ?? status;
  function execute(fn: () => Promise<{ ok: boolean; error?: string }>) {
    run(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Falha na operação");
    });
  }
  const active = s.works.filter(
    (w) => !["delivered", "cancelled"].includes(w.status),
  );
  return (
    <div className="space-y-5">
      {s.error && (
        <p role="status" className="glass rounded-xl p-4 text-sm">
          {s.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {active.length} trabalhos em aberto ·{" "}
          {s.approvals.filter((a) => a.status === "pending").length} aguardando
          revisão
        </p>
        <Button
          variant={s.paused ? "outline" : "default"}
          disabled={pending || s.demo}
          onClick={() => execute(() => pauseTeamAction(!s.paused))}
        >
          {s.paused ? "Retomar execuções" : "Pausar tudo"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Pausar tudo bloqueia novas execuções e efeitos pela Central. Rotinas
        nativas do Grok/Claude continuam sob controle da plataforma.
      </p>
      <nav
        aria-label="Seções da equipe"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "secondary" : "ghost"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      {tab === "Visão geral" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.slice(0, 6).map((w) => (
              <article key={w.entry_id} className="glass rounded-xl p-4">
                <Link
                  className="font-medium hover:text-lilac"
                  href={`/registros/${w.entry_id}`}
                >
                  {w.objective}
                </Link>
                <p className="mt-2 text-xs text-lilac">
                  {s.agents.find((a) => a.id === w.assigned_agent_id)?.name} ·{" "}
                  {label(w.status)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Próximo passo: {w.current_step}
                </p>
              </article>
            ))}
          </div>
          {!active.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum trabalho em aberto. Crie um em Trabalhos ou use Pedir à
              equipe na Chloe.
            </p>
          )}
          <h2 className="font-medium">Pessoas e agentes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.agents.map((a) => (
              <article key={a.id} className="glass rounded-xl p-4">
                <p>
                  {a.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {a.platform}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{a.role}</p>
                <p className="mt-2 text-xs text-lilac">
                  {a.handle === "teo"
                    ? "Fora da automação"
                    : a.external_active && !a.active
                      ? "Ativo no Grok; conexão Central pendente"
                      : a.active
                        ? "Habilitado; disponibilidade depende da conexão"
                        : "Pausado / ativação pendente"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Última atividade: consulte execuções comprovadas nos
                  trabalhos.
                </p>
                {!["human", "central"].includes(a.platform) &&
                  (a.platform !== "grok" || a.handle === "clara") && (
                    <Button
                      size="xs"
                      variant="outline"
                      className="mt-2"
                      disabled={pending || s.demo}
                      onClick={() =>
                        execute(() =>
                          toggleAgentAction({ id: a.id, active: !a.active }),
                        )
                      }
                    >
                      {a.active
                        ? "Pausar aquisições"
                        : "Habilitar aquisições na Central"}
                    </Button>
                  )}
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "Conversas" && (
        <div className="space-y-4">
          <label className="block text-sm">
            Conversa
            <select
              className="mt-1 block w-full rounded-lg border bg-background p-2"
              value={thread}
              onChange={(e) => {
                setThread(e.target.value);
                setReplyTo(undefined);
              }}
            >
              {s.threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              execute(() =>
                createThreadAction({
                  title: f.get("title"),
                  area_slug: f.get("area"),
                  participants: f.getAll("participants"),
                }),
              );
            }}
          >
            <Input
              name="title"
              placeholder="Conversa de um trabalho"
              required
              aria-label="Título da conversa"
            />
            <select
              aria-label="Área da conversa"
              name="area"
              className="min-w-0 rounded-lg border bg-background p-2"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button disabled={pending || s.demo}>Criar</Button>
            <select
              multiple
              name="participants"
              aria-label="Participantes da conversa"
              className="max-h-20 max-w-36 rounded border bg-background p-1 text-xs"
            >
              {s.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </form>
          <p className="text-xs text-muted-foreground">
            Participantes:{" "}
            {(s.threads.find((t) => t.id === thread)?.participants ?? [])
              .map((id) => s.agents.find((a) => a.id === id)?.name)
              .filter(Boolean)
              .join(", ") || "não definidos"}
            . Menções reconhecem @clara, @rastro, @tereza, @atlas, @nox e @vega.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="space-y-3">
            {[...messages].reverse().map((m) => (
              <article key={m.id} className="glass rounded-xl p-4">
                <p className="text-xs text-lilac">
                  {s.agents.find((a) => a.id === m.agent_id)?.name ??
                    (m.source === "manual" ? "Você" : m.source)}{" "}
                  ·{" "}
                  {new Date(m.created_at).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {m.body}
                </p>
                {m.reply_to && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Em resposta a:{" "}
                    {messages
                      .find((p) => p.id === m.reply_to)
                      ?.body.slice(0, 100) ?? "mensagem anterior"}
                  </p>
                )}
                {(m.refs ?? []).map((ref) => (
                  <a
                    key={ref.artifact_id}
                    className="mt-2 block text-xs text-lilac"
                    href={`/api/files/${ref.artifact_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir anexo autorizado
                  </a>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">
                  {m.origin_chat_title ?? "origem não informada"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setReplyTo(m.id)}
                  >
                    Responder
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setTab("Trabalhos");
                      setBody(m.body);
                    }}
                  >
                    Transformar em tarefa
                  </Button>
                  {m.entry_id && (
                    <Link
                      className="text-xs text-lilac"
                      href={`/registros/${m.entry_id}`}
                    >
                      Trabalho relacionado
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          {messages.length >= 30 && (
            <Button
              variant="outline"
              onClick={() => {
                const last = messages.at(-1);
                if (last)
                  run(async () => {
                    const r = await teamMessagesAction(
                      thread,
                      last.created_at,
                      last.id,
                    );
                    if (r.ok)
                      setMessages((current) => [
                        ...current,
                        ...(r.data as TeamMessage[]),
                      ]);
                    else toast.error(r.error);
                  });
              }}
            >
              Carregar anteriores
            </Button>
          )}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await postTeamMessageAction({
                  thread_id: thread,
                  body,
                  reply_to: replyTo,
                  artifact_ids: attached,
                  idempotency_key: crypto.randomUUID(),
                });
                if (r.ok) {
                  setBody("");
                  setReplyTo(undefined);
                  setAttached([]);
                  const next = await teamMessagesAction(thread);
                  if (next.ok) setMessages(next.data as TeamMessage[]);
                } else toast.error(r.error);
              });
            }}
          >
            {replyTo && (
              <p className="text-xs">
                Respondendo à mensagem selecionada{" "}
                <button type="button" onClick={() => setReplyTo(undefined)}>
                  Cancelar
                </button>
              </p>
            )}
            <Textarea
              required
              maxLength={20000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-label="Mensagem"
              placeholder="Mensagem para a equipe. @menções aguardam a próxima rotina."
            />
            <Button disabled={pending || !thread || s.demo}>
              Enviar à conversa
            </Button>
            <label className="block text-xs">
              Anexar arquivo da biblioteca (Ctrl/Cmd para selecionar mais de um)
              <select
                multiple
                className="mt-1 block max-h-24 w-full rounded border bg-background p-2"
                value={attached}
                onChange={(e) =>
                  setAttached([...e.target.selectedOptions].map((o) => o.value))
                }
              >
                {s.artifacts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              Mensagens não criam tarefas nem confirmam acionamento externo.
            </p>
          </form>
        </div>
      )}
      {tab === "Trabalhos" && (
        <div className="space-y-5">
          <form
            className="glass space-y-3 rounded-xl p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              execute(() =>
                createWorkAction({
                  area_slug: String(f.get("area")),
                  objective: String(f.get("objective")),
                  assigned_agent: String(f.get("agent")),
                  workflow_key: String(
                    f.get("workflow"),
                  ) as keyof typeof WORKFLOWS,
                  expected_output: String(f.get("output")),
                  acceptance_criteria: String(f.get("criteria")),
                  idempotency_key: crypto.randomUUID(),
                }),
              );
            }}
          >
            <h2 className="font-medium">Novo trabalho</h2>
            <Textarea
              name="objective"
              required
              minLength={3}
              defaultValue={body}
              placeholder="Objetivo"
              aria-label="Objetivo do trabalho"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                aria-label="Área do trabalho"
                name="area"
                className="min-w-0 rounded-lg border bg-background p-2"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                name="agent"
                aria-label="Responsável"
                className="rounded-lg border bg-background p-2"
              >
                {s.agents
                  .filter((a) => a.handle !== "teo")
                  .map((a) => (
                    <option key={a.id} value={a.handle}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <select
                name="workflow"
                aria-label="Fluxo"
                className="rounded-lg border bg-background p-2"
              >
                {Object.entries(WORKFLOWS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.next}
                  </option>
                ))}
              </select>
            </div>
            <Input
              name="output"
              required
              placeholder="Entrega esperada"
              aria-label="Entrega esperada"
            />
            <Input
              name="criteria"
              required
              placeholder="Critério de pronto"
              aria-label="Critério de pronto"
            />
            <Button disabled={pending || s.demo}>Criar trabalho</Button>
          </form>
          {s.works.map((w) => (
            <article
              key={w.entry_id}
              className="glass space-y-2 rounded-xl p-4"
            >
              <Link
                href={`/registros/${w.entry_id}`}
                className="font-medium text-lilac"
              >
                {w.objective}
              </Link>
              <p className="text-sm">
                {s.agents.find((a) => a.id === w.assigned_agent_id)?.name} ·{" "}
                {label(w.status)}
              </p>
              <p className="text-sm text-muted-foreground">
                Próximo passo: {w.current_step}
              </p>
              <details className="text-sm">
                <summary>Entrega e critérios</summary>
                <p className="mt-2">{w.expected_output}</p>
                <p>{w.acceptance_criteria}</p>
              </details>
              {w.last_error && (
                <p role="alert" className="text-sm text-destructive">
                  {w.last_error}
                </p>
              )}
              {!["delivered", "cancelled"].includes(w.status) && (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    execute(() =>
                      workStateAction({
                        entry_id: w.entry_id,
                        status: "cancelled",
                      }),
                    )
                  }
                >
                  Cancelar trabalho
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === "Rotinas" && (
        <div className="space-y-3">
          {s.schedules.map((r) => (
            <article className="glass space-y-2 rounded-xl p-4" key={r.id}>
              <h2>{r.title}</h2>
              <p className="text-sm">
                {r.cadence} · Brasília · origem: {r.origin}
              </p>
              <p className="text-xs text-lilac">
                {r.verified_at
                  ? r.active
                    ? "Ativa"
                    : "Pausada"
                  : "Horário informado; verificação pendente"}
              </p>
              <p className="text-xs text-muted-foreground">
                Última execução: {r.last_run_at ?? "não comprovada"} · Próxima:{" "}
                {r.next_run_at ?? "a confirmar na plataforma"} · Consumo
                registrado: {r.consumption}
              </p>
              <p className="text-sm text-muted-foreground">
                {r.activation_steps}
              </p>
              <p className="text-xs">
                Pausa/retomada e execução única de rotinas externas devem
                ocorrer na plataforma de origem até haver mecanismo de
                atualização verificado.
              </p>
            </article>
          ))}
        </div>
      )}
      {tab === "Conexões" && (
        <div className="space-y-4">
          {s.connections.map((c) => (
            <article
              className="glass space-y-2 rounded-xl p-4"
              key={c.provider}
            >
              <h2 className="font-medium">
                {c.provider} · {label(c.status)}
              </h2>
              <p className="text-xs text-lilac">
                Capacidades testadas: {c.capabilities.join(", ") || "nenhuma"}
              </p>
              <p className="text-xs">
                Último sucesso: {c.last_success_at ?? "não comprovado"}
              </p>
              <p className="text-sm text-muted-foreground">
                {c.activation_steps}
              </p>
            </article>
          ))}
          <form
            className="glass space-y-3 rounded-xl p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                const r = await createClientAction({
                  name: f.get("name"),
                  agent_id: f.get("agent_id"),
                  areas: f.getAll("areas"),
                  execute: f.get("execute") === "on",
                });
                if (r.ok) setToken(r.data.token);
                else toast.error(r.error);
              });
            }}
          >
            <h2 className="font-medium">Conceder acesso limitado</h2>
            <Input
              required
              name="name"
              placeholder="Nome desta conexão"
              aria-label="Nome da conexão"
            />
            <select
              required
              name="agent_id"
              aria-label="Agente da conexão"
              className="w-full rounded-lg border bg-background p-2"
            >
              {s.agents
                .filter(
                  (a) =>
                    [
                      "grok",
                      "claude",
                      "chatgpt",
                      "codex",
                      "cursor",
                      "opencode",
                    ].includes(a.platform) &&
                    (a.platform !== "grok" || a.handle === "clara"),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
            <fieldset className="flex flex-wrap gap-3">
              <legend className="mb-2 text-sm">
                Áreas permitidas (nenhuma selecionada por padrão)
              </legend>
              {areas.map((a) => (
                <label key={a.id} className="text-xs">
                  <input type="checkbox" name="areas" value={a.id} /> {a.name}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm">
              <input type="checkbox" name="execute" /> Permitir assumir
              trabalhos dessas áreas
            </label>
            <p className="text-xs text-muted-foreground">
              Somente Clara recebe conexão Grok. Os demais bots trabalham por
              ela. Notas privadas e finanças continuam fora do acesso. O token
              expira em 90 dias e pode ser revogado.
            </p>
            <Button disabled={pending || s.demo}>Gerar token uma vez</Button>
          </form>
          {token && (
            <div className="glass rounded-xl p-4">
              <label className="text-sm">
                Token novo — copie diretamente para o segredo da plataforma
                <Input
                  type="password"
                  readOnly
                  value={token}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <Button
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(token);
                  toast.success(
                    "Copiado para configurar o destino autorizado.",
                  );
                }}
              >
                Copiar
              </Button>
              <Button variant="ghost" onClick={() => setToken(null)}>
                Ocultar e descartar
              </Button>
            </div>
          )}
          {s.clients.map((c) => (
            <div
              key={c.id}
              className="glass flex flex-wrap items-center gap-3 rounded-xl p-3"
            >
              <span className="text-sm">
                {c.name} · {c.token_prefix}… ·{" "}
                {c.revoked_at ? "Revogado" : "Criado; confira validade"}
              </span>
              {!c.revoked_at && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={() => execute(() => revokeClientAction(c.id))}
                >
                  Revogar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "Entregas" && (
        <div className="space-y-3">
          {s.artifacts.map((a) => (
            <article className="glass rounded-xl p-4" key={a.id}>
              <a
                className="text-lilac"
                href={`/api/files/${a.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {a.name}
              </a>
              <p className="text-xs text-muted-foreground">{a.mime}</p>
              {a.entry_id && (
                <Link
                  className="text-xs text-lilac"
                  href={`/registros/${a.entry_id}`}
                >
                  Trabalho relacionado
                </Link>
              )}
            </article>
          ))}
          {!s.artifacts.length && (
            <p className="text-sm text-muted-foreground">
              Nenhuma entrega anexada. Caminho local e mensagem de intenção não
              contam como entrega acessível.
            </p>
          )}
        </div>
      )}
      {tab === "Aprovações" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Clara apresenta as propostas Grok. Confira conteúdo, destino e
            anexos antes de selecionar cada peça. O ok vale somente para esta
            versão.
          </p>
          {selectedApprovals.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">
                {selectedApprovals.length} peças selecionadas
              </span>
              {[true, false].map((approve) => (
                <Button
                  key={String(approve)}
                  variant={approve ? "default" : "outline"}
                  disabled={pending}
                  onClick={() =>
                    execute(async () => {
                      const r = await decideApprovalsAction({
                        items: s.approvals
                          .filter((a) => selectedApprovals.includes(a.id))
                          .map((a) => ({
                            id: a.id,
                            payload_hash: a.payload_hash,
                          })),
                        approve,
                      });
                      if (r.ok) setSelectedApprovals([]);
                      return r;
                    })
                  }
                >
                  {approve ? "Aprovar selecionadas" : "Rejeitar selecionadas"}
                </Button>
              ))}
            </div>
          )}
          {s.approvals.map((a) => (
            <article key={a.id} className="glass space-y-3 rounded-xl p-4">
              {a.status === "pending" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedApprovals.includes(a.id)}
                    disabled={
                      pending ||
                      (!selectedApprovals.includes(a.id) &&
                        selectedApprovals.length >= 20)
                    }
                    onChange={(e) =>
                      setSelectedApprovals((ids) =>
                        e.target.checked
                          ? [...ids, a.id]
                          : ids.filter((id) => id !== a.id),
                      )
                    }
                  />
                  Revisei esta peça e quero incluí-la na seleção
                </label>
              )}
              <p>
                {a.payload_ref.action} · {label(a.status)}
              </p>
              <p className="break-words text-sm">
                Conta: {a.payload_ref.account} · Destino: {a.target}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {a.payload_ref.body}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.payload_ref.attachments.length} anexos/versões · Válida até{" "}
                {new Date(a.expires_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </p>
              {a.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    disabled={pending}
                    onClick={() =>
                      execute(() =>
                        decideApprovalAction({
                          id: a.id,
                          payload_hash: a.payload_hash,
                          approve: true,
                        }),
                      )
                    }
                  >
                    Aprovar este conteúdo
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      execute(() =>
                        decideApprovalAction({
                          id: a.id,
                          payload_hash: a.payload_hash,
                          approve: false,
                        }),
                      )
                    }
                  >
                    Rejeitar
                  </Button>
                </div>
              )}
            </article>
          ))}
          {!s.approvals.length && (
            <p className="text-sm text-muted-foreground">
              Nenhuma proposta aguardando revisão. Aprovar não comprova envio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
