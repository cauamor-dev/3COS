"use client";

import { cn } from "cn";
import { CalendarDays, CheckSquare } from "lucide-react";
import Link from "next/link";
import { formatTime } from "@/components/central/dates";
import { SOURCE_COLOR } from "@/components/central/labels";
import { useNow } from "@/hooks/use-now";
import type { Entry } from "@/lib/central/types";

export interface TodayEvent {
  key: string;
  entry: Entry;
  start: string;
}

export function TodayCard({ events, tasks }: { events: TodayEvent[]; tasks: Entry[] }) {
  const now = useNow();
  if (events.length === 0 && tasks.length === 0) return null;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="label-mono text-lilac">hoje</h2>
        <div className="flex gap-3 text-xs">
          <Link href="/agenda" className="text-muted-foreground hover:text-foreground">Agenda</Link>
          <Link href="/tarefas" className="text-muted-foreground hover:text-foreground">Tarefas</Link>
        </div>
      </div>
      <ul className="space-y-2">
        {events.map(({ key, entry, start }) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            <CalendarDays className="size-4 shrink-0" style={{ color: SOURCE_COLOR[entry.source] }} />
            <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{entry.all_day ? "dia" : formatTime(start)}</span>
            <span className="truncate">{entry.title}</span>
          </li>
        ))}
        {tasks.map((task) => {
          const late = now !== null && Date.parse(task.due_at!) < now;
          return (
            <li key={task.id} className="flex items-center gap-3 text-sm">
              <CheckSquare className={cn("size-4 shrink-0", late ? "text-destructive" : "text-muted-foreground")} />
              <span className={cn("w-12 shrink-0 font-mono text-xs", late ? "text-destructive" : "text-muted-foreground")}>
                {late ? "atraso" : formatTime(task.due_at!)}
              </span>
              <span className="truncate">{task.title}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
