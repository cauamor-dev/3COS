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
import { Bell, Settings2, CheckCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldSelect } from "@/components/ui/field-select";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { noticePath } from "@/lib/central/links";

export function NotificationInbox() {
  const [items, setItems] = useState<InboxNotice[]>([]),
    [settings, setSettings] = useState(false),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.filter((n) => !n.read_at).length} novos avisos
        </p>
        <Button
          variant="outline"
          className="h-10"
          onClick={() => setSettings(true)}
        >
          <Settings2 /> Preferências
        </Button>
      </div>
      <section className="glass space-y-3 rounded-2xl p-4 sm:p-5">
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
            <CheckCheck /> Marcar como lidos
          </Button>
        </div>
        {loading && <p role="status">Carregando avisos…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && !items.length && (
          <EmptyState
            icon={Bell}
            title="Tudo em dia"
            description="Seus lembretes, entregas e aprovações aparecem aqui."
          />
        )}
        {items.map((n) => (
          <article
            key={n.id}
            className={`rounded-xl border p-3 ${!n.read_at ? "border-primary/40" : "opacity-70"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={noticePath(n)}
                onClick={() => {
                  if (!n.read_at) mark([n.id]);
                }}
                className="min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
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
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Preferências de avisos</DialogTitle>
            <DialogDescription>
              Escolha o que receber e quando.
            </DialogDescription>
          </DialogHeader>
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
            <h2 className="font-medium">Na Central</h2>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={prefs.in_app}
                onCheckedChange={(checked) =>
                  setPrefs({ ...prefs, in_app: checked === true })
                }
              />
              Guardar novos avisos na Central
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(NOTICE_LABELS).map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={prefs.kinds.includes(
                      key as keyof typeof NOTICE_LABELS,
                    )}
                    onCheckedChange={(checked) =>
                      setPrefs({
                        ...prefs,
                        kinds:
                          checked === true
                            ? [
                                ...prefs.kinds,
                                key as keyof typeof NOTICE_LABELS,
                              ]
                            : prefs.kinds.filter((k) => k !== key),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <label>
                Silêncio das{" "}
                <FieldSelect
                  label="Início do silêncio"
                  value={String(prefs.quiet_start)}
                  onValueChange={(v) =>
                    setPrefs({ ...prefs, quiet_start: Number(v) })
                  }
                  options={Array.from({ length: 24 }, (_, h) => ({
                    value: String(h),
                    label: `${h}h`,
                  }))}
                />
              </label>
              <label>
                até{" "}
                <FieldSelect
                  label="Fim do silêncio"
                  value={String(prefs.quiet_end)}
                  onValueChange={(v) =>
                    setPrefs({ ...prefs, quiet_end: Number(v) })
                  }
                  options={Array.from({ length: 24 }, (_, h) => ({
                    value: String(h),
                    label: `${h}h`,
                  }))}
                />
              </label>
              <label>
                Avisar antes do prazo{" "}
                <FieldSelect
                  label="Antecedência do aviso"
                  value={String(prefs.lead_minutes)}
                  onValueChange={(v) =>
                    setPrefs({
                      ...prefs,
                      lead_minutes: Number(
                        v,
                      ) as NotificationPreferences["lead_minutes"],
                    })
                  }
                  options={[15, 30, 60, 180, 1440].map((m) => ({
                    value: String(m),
                    label: m < 60 ? `${m} min` : `${m / 60} h`,
                  }))}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Horários de Brasília. Horas iguais desativam o silêncio. O aviso
              fica na Central durante o silêncio; o push aguarda. Verificação a
              cada cinco minutos.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={prefs.push}
                onCheckedChange={(checked) =>
                  setPrefs({ ...prefs, push: checked === true })
                }
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
