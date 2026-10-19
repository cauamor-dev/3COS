"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronDown,
  FileText,
  KeyRound,
  Link2,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  decideApprovalAction,
  decideApprovalsAction,
  revokeClientAction,
  toggleAgentAction,
} from "@/app/(app)/team-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import type { TeamSnapshot } from "@/lib/team/types";
import { PROVIDER_LABEL, StatusBadge, TeamAvatar } from "./team-primitives";

type Operation = () => Promise<{ ok: boolean; error?: string }>;
function useOperation() {
  const [pending, run] = useTransition();
  return {
    pending,
    execute: (fn: Operation) =>
      run(async () => {
        try {
          const r = await fn();
          if (!r.ok) toast.error(r.error ?? "Não foi possível concluir.");
        } catch {
          toast.error("Não foi possível concluir. Confira sua conexão.");
        }
      }),
  };
}
export function TeamPeople({ s }: { s: TeamSnapshot }) {
  const { pending, execute } = useOperation();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {s.agents.map((a) => (
        <article key={a.id} className="glass rounded-xl p-4">
          <div className="flex items-start gap-3">
            <TeamAvatar name={a.name} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{a.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {PROVIDER_LABEL[a.platform] ?? a.platform}
              </p>
            </div>
            <span
              className={`mt-1 size-2 shrink-0 rounded-full ${a.active ? "bg-lilac" : "bg-muted-foreground/40"}`}
              aria-hidden="true"
            />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {a.role}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {a.handle === "teo"
                ? "Fora da automação"
                : a.platform === "grok" && a.handle !== "clara"
                  ? "Ponte pela Clara"
                  : a.external_active && !a.active
                    ? "Conexão pendente"
                    : a.active
                      ? "Disponibilidade depende da conexão"
                      : "Não habilitado na Central"}
            </span>
            {!["human", "central"].includes(a.platform) &&
              (a.platform !== "grok" || a.handle === "clara") && (
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={pending || s.demo}
                  onClick={() =>
                    execute(() =>
                      toggleAgentAction({ id: a.id, active: !a.active }),
                    )
                  }
                >
                  {a.active ? "Pausar" : "Habilitar"}
                </Button>
              )}
          </div>
        </article>
      ))}
    </div>
  );
}
export function TeamRoutines({ s }: { s: TeamSnapshot }) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2">
      {s.schedules.map((r) => (
        <article key={r.id} className="glass rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-1 size-5 shrink-0 text-lilac" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{r.title}</h2>
              <p className="mt-2 text-sm">{r.cadence}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Brasília · {PROVIDER_LABEL[r.origin] ?? r.origin}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <StatusBadge
              status={
                r.verified_at
                  ? r.active
                    ? "verified"
                    : "unavailable"
                  : "configured_unverified"
              }
              label={
                r.verified_at
                  ? r.active
                    ? "Ativa"
                    : "Pausada"
                  : "Horário a confirmar"
              }
            />
          </div>
          <details className="mt-4 border-t pt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Ver detalhes
            </summary>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>{r.activation_steps}</p>
              <p>
                Última execução:{" "}
                {r.last_run_at
                  ? new Date(r.last_run_at).toLocaleString("pt-BR")
                  : "não comprovada"}
              </p>
              <p>
                Próxima:{" "}
                {r.next_run_at
                  ? new Date(r.next_run_at).toLocaleString("pt-BR")
                  : "confirmar na plataforma"}
              </p>
              <p>
                Consumo registrado: {r.consumption}. Rotinas externas são
                ajustadas na plataforma de origem.
              </p>
            </div>
          </details>
        </article>
      ))}
      {!s.schedules.length && (
        <EmptyState icon={CalendarClock} title="Nenhuma rotina cadastrada" />
      )}
    </div>
  );
}
export function TeamConnections({
  s,
  onConnect,
}: {
  s: TeamSnapshot;
  onConnect: () => void;
}) {
  const { pending, execute } = useOperation();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Conexões da equipe</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso limitado por agente e projeto.
          </p>
        </div>
        <Button className="h-10" onClick={onConnect}>
          <Link2 />
          Conectar agente
        </Button>
      </div>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {s.connections.map((c) => (
          <article key={c.provider} className="glass rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TeamAvatar
                  name={PROVIDER_LABEL[c.provider] ?? c.provider}
                  small
                />
                <h3 className="font-semibold">
                  {PROVIDER_LABEL[c.provider] ?? c.provider}
                </h3>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <details className="mt-4 text-sm">
              <summary className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                Como configurar <ChevronDown className="size-3" />
              </summary>
              <div className="mt-3 space-y-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                <p>{c.activation_steps}</p>
                <p>
                  Capacidades testadas: {c.capabilities.join(", ") || "nenhuma"}
                </p>
                <p>
                  Último sucesso:{" "}
                  {c.last_success_at
                    ? new Date(c.last_success_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })
                    : "ainda não verificado"}
                </p>
              </div>
            </details>
          </article>
        ))}
      </div>
      <details className="glass rounded-xl p-4">
        <summary className="cursor-pointer text-sm font-medium">
          <KeyRound className="mr-2 inline size-4 text-lilac" />
          Acessos gerados · {s.clients.length}
        </summary>
        <div className="mt-4 divide-y">
          {s.clients.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.revoked_at
                    ? "Revogado"
                    : `Válido até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}`}{" "}
                  · {c.token_prefix}…
                </p>
              </div>
              {!c.revoked_at && (
                <Button
                  variant="destructive"
                  className="h-9"
                  disabled={pending || s.demo}
                  onClick={() => execute(() => revokeClientAction(c.id))}
                >
                  Revogar
                </Button>
              )}
            </div>
          ))}
          {!s.clients.length && (
            <p className="py-2 text-sm text-muted-foreground">
              Nenhum acesso gerado.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
export function TeamDeliveries({ s }: { s: TeamSnapshot }) {
  if (!s.artifacts.length)
    return (
      <EmptyState
        icon={FileText}
        title="As entregas ficam aqui"
        description="Arquivos concluídos pela equipe aparecem com acesso ao trabalho de origem."
      />
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {s.artifacts.map((a) => (
        <article
          key={a.id}
          className="glass flex min-w-0 flex-col rounded-xl p-5"
        >
          <div className="mb-5 flex size-11 items-center justify-center rounded-xl border bg-muted/50 text-lilac">
            {a.mime.startsWith("video/") ? (
              <Video className="size-5" />
            ) : (
              <FileText className="size-5" />
            )}
          </div>
          <a
            href={`/api/files/${a.id}`}
            target="_blank"
            rel="noreferrer"
            className="break-words text-base font-medium leading-snug hover:text-lilac"
          >
            {a.name}
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            {a.mime.startsWith("video/")
              ? "Vídeo"
              : a.mime.startsWith("image/")
                ? "Imagem"
                : "Documento"}
          </p>
          {a.entry_id && (
            <Link
              href={`/registros/${a.entry_id}`}
              className="mt-5 inline-flex min-h-9 items-center text-xs text-lilac"
            >
              Abrir trabalho →
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
const actionNames: Record<string, string> = {
  email: "Enviar e-mail",
  message: "Enviar mensagem",
  post: "Publicar conteúdo",
  publication: "Publicar conteúdo",
  application: "Enviar candidatura",
  calendar_change: "Alterar calendário",
  purchase: "Compra",
  delete: "Exclusão",
};
export function TeamApprovals({
  s,
  focusWork,
}: {
  s: TeamSnapshot;
  focusWork?: string;
}) {
  const [focused, setFocused] = useState(!!focusWork);
  const { pending, execute } = useOperation();
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState(false);
  const rows = s.approvals.filter((a) =>
    focused ? a.entry_id === focusWork : history || a.status === "pending",
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Seu ok, peça por peça</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confira conteúdo, destino e anexos.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-10"
          onClick={() => setHistory((v) => !v)}
        >
          {history ? "Só pendentes" : "Ver histórico"}
        </Button>
      </div>
      {focused && (
        <Button variant="outline" onClick={() => setFocused(false)}>
          Ver todas as aprovações
        </Button>
      )}
      {selected.length > 0 && (
        <div className="sticky top-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-popover p-3">
          <span className="mr-auto text-sm">
            {selected.length} selecionadas
          </span>
          {[true, false].map((approve) => (
            <Button
              key={String(approve)}
              className="h-10"
              variant={approve ? "default" : "outline"}
              disabled={pending || s.demo}
              onClick={() =>
                execute(async () => {
                  const r = await decideApprovalsAction({
                    items: s.approvals
                      .filter(
                        (a) =>
                          a.status === "pending" && selected.includes(a.id),
                      )
                      .map((a) => ({ id: a.id, payload_hash: a.payload_hash })),
                    approve,
                  });
                  if (r.ok) setSelected([]);
                  return r;
                })
              }
            >
              {approve ? <Check /> : <X />}
              {approve ? "Aprovar seleção" : "Rejeitar"}
            </Button>
          ))}
        </div>
      )}
      {rows.map((a) => (
        <article key={a.id} className="glass space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">
              {actionNames[a.payload_ref.action] ?? a.payload_ref.action}
            </h3>
            <StatusBadge status={a.status} />
          </div>
          <dl className="grid gap-3 rounded-lg border bg-background/30 p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Conta</dt>
              <dd className="mt-1 break-words">{a.payload_ref.account}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Destino</dt>
              <dd className="mt-1 break-words">{a.target}</dd>
            </div>
          </dl>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {a.payload_ref.body}
          </p>
          {a.payload_ref.attachments.map((raw, i) => {
            const file = raw as { artifact_id?: string; version?: number };
            return (
              <div key={i} className="rounded-lg border p-3 text-xs">
                {file.artifact_id ? (
                  <a
                    href={`/api/files/${file.artifact_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lilac"
                  >
                    {s.artifacts.find((f) => f.id === file.artifact_id)?.name ??
                      "Conferir anexo"}
                  </a>
                ) : (
                  "Anexo"
                )}{" "}
                · versão {file.version ?? "informada na proposta"}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Válida até{" "}
            {new Date(a.expires_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
            . Mudar a peça exige nova aprovação.
          </p>
          {a.status === "pending" && (
            <div className="space-y-3 border-t pt-3">
              <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={selected.includes(a.id)}
                  disabled={
                    pending ||
                    (!selected.includes(a.id) && selected.length >= 20)
                  }
                  onCheckedChange={(v) =>
                    setSelected((ids) =>
                      v === true
                        ? [...ids, a.id]
                        : ids.filter((id) => id !== a.id),
                    )
                  }
                />
                Revisei e quero incluir na seleção
              </label>
              <div className="flex flex-wrap gap-2">
                {[true, false].map((approve) => (
                  <Button
                    key={String(approve)}
                    variant={approve ? "default" : "outline"}
                    className="h-10"
                    disabled={pending || s.demo}
                    onClick={() =>
                      execute(() =>
                        decideApprovalAction({
                          id: a.id,
                          payload_hash: a.payload_hash,
                          approve,
                        }),
                      )
                    }
                  >
                    {approve ? <Check /> : <X />}
                    {approve ? "Aprovar esta peça" : "Rejeitar"}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}
      {!rows.length && (
        <EmptyState
          icon={ShieldCheck}
          title="Tudo revisado por aqui"
          description="Quando uma ação precisar do seu ok, a proposta aparece aqui antes de qualquer envio."
        />
      )}
    </div>
  );
}
