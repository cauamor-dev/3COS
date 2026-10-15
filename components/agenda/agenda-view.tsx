"use client";

import { cn } from "cn";
import { CalendarPlus, CheckSquare, MapPin, Repeat } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { dayKey, dayLabel, formatTime } from "@/components/central/dates";
import { SOURCE_COLOR } from "@/components/central/labels";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import type { Entry } from "@/lib/central/types";

export interface AgendaItem {
  key: string;
  kind: "evento" | "tarefa";
  entry: Entry;
  start: string;
  end: string | null;
}

const STRIP_DAYS = 21;

export function AgendaView({ items, todayKey }: { items: AgendaItem[]; todayKey: string }) {
  const now = useNow();
  const { openQuickEntry } = useCentral();
  const [selected, setSelected] = useState<string | null>(null);
  const currentToday = now === null ? todayKey : dayKey(now);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const item of items) {
      const key = dayKey(item.start);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const strip = Array.from({ length: STRIP_DAYS }, (_, i) => dayKey(Date.parse(`${currentToday}T12:00:00-03:00`) + i * 86_400_000));
  const days = [...byDay.keys()].filter((key) => (selected ? key === selected : key >= currentToday)).sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1">
          {strip.map((key) => {
            const count = byDay.get(key)?.length ?? 0;
            const date = new Date(`${key}T12:00:00-03:00`);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(selected === key ? null : key)}
                className={cn(
                  "glass flex w-12 shrink-0 flex-col items-center rounded-xl py-2 transition-colors duration-150",
                  key === currentToday && "border-primary/50",
                  selected === key && "bg-primary/20",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  {date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).slice(0, 3)}
                </span>
                <span className="text-base font-medium">{date.getUTCDate()}</span>
                <span className={cn("mt-0.5 size-1.5 rounded-full", count ? "bg-lilac" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
        <Button size="sm" onClick={() => openQuickEntry({ type: "evento" })} className="shrink-0">
          <CalendarPlus /> Evento
        </Button>
      </div>

      {days.length === 0 ? (
        <p className="glass rounded-xl p-5 text-sm text-muted-foreground">
          {selected ? "Nada neste dia." : "Agenda livre nos próximos dias."} Peça para a Vega ou o Nox agendar algo, ou use o botão Evento.
        </p>
      ) : (
        days.map((key) => (
          <section key={key}>
            <h2 className={cn("label-mono mb-2", key === currentToday && "text-lilac")}>{dayLabel(key, currentToday)}</h2>
            <ul className="space-y-2">
              {byDay.get(key)!.map((item) => (
                <AgendaRow key={item.key} item={item} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const { entry } = item;
  const color = SOURCE_COLOR[entry.source];
  const isTask = item.kind === "tarefa";

  return (
    <li className="glass glass-hover flex gap-3 rounded-xl p-3">
      <div className="w-14 shrink-0 text-right font-mono text-xs leading-5 text-muted-foreground">
        {entry.all_day && !isTask ? "dia todo" : formatTime(item.start)}
        {item.end && !entry.all_day && <div className="opacity-60">{formatTime(item.end)}</div>}
      </div>
      <span className="w-0.5 shrink-0 rounded-full" style={{ background: isTask ? "var(--muted-foreground)" : color }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {isTask && <CheckSquare className="size-3.5 text-muted-foreground" />}
          <span className="truncate">{entry.title}</span>
          {entry.recurrence && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="Repete" />}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-muted-foreground">
          <Link href={`/areas/${entry.area.slug}#${entry.id}`} className="hover:text-lilac">
            /{entry.area.slug}
          </Link>
          {entry.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {entry.location}
            </span>
          )}
          {isTask && <span>prazo</span>}
        </div>
      </div>
    </li>
  );
}
