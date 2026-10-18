"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  notificationInboxAction,
  markNotificationsAction,
  saveNotificationPreferencesAction,
} from "@/app/(app)/notification-actions";
import {
  DEFAULT_PREFERENCES,
  NOTICE_LABELS,
  type InboxNotice,
  type NotificationPreferences,
} from "@/lib/notify/preferences";
import { Button } from "@/components/ui/button";
import { PushToggle } from "./push-toggle";

export function NotificationInbox() {
  const [items, setItems] = useState<InboxNotice[]>([]),
    [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [pending, run] = useTransition();
  useEffect(() => {
    let active = true;
    void notificationInboxAction().then((r) => {
      if (!active) return;
      if (r.ok) {
        setItems(r.data.items);
        setPrefs(r.data.preferences);
      } else setError(r.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);
  function mark(ids: string[]) {
    run(async () => {
      const r = await markNotificationsAction(ids);
      if (!r.ok) toast.error(r.error);
      else
        setItems((old) =>
          old.map((n) =>
            ids.includes(n.id)
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ),
        );
    });
  }
  return (
    <div className="space-y-5">
      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Seus avisos</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !items.some((n) => !n.read_at)}
            onClick={() =>
              mark(
                items
                  .filter((n) => !n.read_at)
                  .slice(0, 30)
                  .map((n) => n.id),
              )
            }
          >
            Marcar estes como lidos
          </Button>
        </div>
        {loading && <p role="status">Carregando avisos…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && !items.length && (
          <p className="text-sm text-muted-foreground">
            Nenhum aviso por enquanto. Lembretes, prazos e pedidos de aprovação
            aparecem aqui.
          </p>
        )}
        {items.map((n) => (
          <article
            key={n.id}
            className={`rounded-xl border p-3 ${!n.read_at ? "border-primary/40" : "opacity-70"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={
                  n.path.startsWith("/") && !n.path.startsWith("//")
                    ? n.path
                    : "/notificacoes"
                }
                onClick={() => {
                  if (!n.read_at) mark([n.id]);
                }}
                className="min-w-0"
              >
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {n.body}
                </p>
              </Link>
              {!n.read_at && (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => mark([n.id])}
                >
                  Lido
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              ·{" "}
              {n.push_status === "sent"
                ? "Aceito pelo serviço push"
                : n.push_status === "uncertain"
                  ? "Push sem confirmação"
                  : n.push_status === "failed"
                    ? "Push indisponível; aviso salvo"
                    : "Salvo na Central"}
            </p>
          </article>
        ))}
        {items.length >= 30 && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const last = items.at(-1)!;
                const r = await notificationInboxAction(
                  JSON.stringify({ at: last.created_at, id: last.id }),
                );
                if (r.ok) setItems((old) => [...old, ...r.data.items]);
                else toast.error(r.error);
              })
            }
          >
            Carregar anteriores
          </Button>
        )}
      </section>
      <form
        className="glass space-y-4 rounded-2xl p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await saveNotificationPreferencesAction(prefs);
            if (r.ok) toast.success("Preferências salvas.");
            else toast.error(r.error);
          });
        }}
      >
        <h2 className="font-medium">O que você quer receber</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.in_app}
            onChange={(e) => setPrefs({ ...prefs, in_app: e.target.checked })}
          />
          Guardar novos avisos na Central
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(NOTICE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.kinds.includes(
                  key as keyof typeof NOTICE_LABELS,
                )}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    kinds: e.target.checked
                      ? [...prefs.kinds, key as keyof typeof NOTICE_LABELS]
                      : prefs.kinds.filter((k) => k !== key),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label>
            Silêncio das{" "}
            <select
              aria-label="Início do silêncio"
              className="rounded border bg-background p-2"
              value={prefs.quiet_start}
              onChange={(e) =>
                setPrefs({ ...prefs, quiet_start: Number(e.target.value) })
              }
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
          </label>
          <label>
            até{" "}
            <select
              aria-label="Fim do silêncio"
              className="rounded border bg-background p-2"
              value={prefs.quiet_end}
              onChange={(e) =>
                setPrefs({ ...prefs, quiet_end: Number(e.target.value) })
              }
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
          </label>
          <label>
            Avisar antes do prazo{" "}
            <select
              className="rounded border bg-background p-2"
              value={prefs.lead_minutes}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  lead_minutes: Number(
                    e.target.value,
                  ) as NotificationPreferences["lead_minutes"],
                })
              }
            >
              {[15, 30, 60, 180, 1440].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : `${m / 60} h`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Horários de Brasília. Horas iguais desativam o silêncio. O aviso fica
          na Central durante o silêncio; o push aguarda. Verificação a cada
          cinco minutos.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.push}
            onChange={(e) => setPrefs({ ...prefs, push: e.target.checked })}
          />
          Permitir push nos aparelhos cadastrados
        </label>
        <Button disabled={pending || loading}>Salvar preferências</Button>
      </form>
      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="font-medium">Este aparelho</h2>
        <p className="text-sm text-muted-foreground">
          Push é opcional. O texto na tela bloqueada é discreto; os detalhes
          ficam dentro da Central. Ative também a permissão no aparelho.
        </p>
        <PushToggle />
      </section>
    </div>
  );
}
