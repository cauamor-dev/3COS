import type { Metadata } from "next";
import { Suspense } from "react";
import { AgendaView, type AgendaItem } from "@/components/agenda/agenda-view";
import { dayKey } from "@/components/central/dates";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";
import { addDays, startOfLocalDay } from "@/lib/central/time";

export const metadata: Metadata = { title: "Agenda" };

async function Agenda() {
  const { central } = await requireMember();
  const from = startOfLocalDay();
  const to = addDays(from, 60);
  const [occurrences, tasks] = await Promise.all([central.eventsBetween(from, to), central.tasksForPanel()]);

  const items: AgendaItem[] = [
    ...occurrences.map((occurrence) => ({
      key: `${occurrence.entry.id}:${occurrence.start}`,
      kind: "evento" as const,
      entry: occurrence.entry,
      start: occurrence.start,
      end: occurrence.end,
    })),
    ...tasks
      .filter((task) => task.due_at && !task.done_at && task.due_at >= from.toISOString() && task.due_at <= to.toISOString())
      .map((task) => ({ key: task.id, kind: "tarefa" as const, entry: task, start: task.due_at!, end: null })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return <AgendaView items={items} todayKey={dayKey(from.getTime() + 12 * 3600_000)} />;
}

export default function AgendaPage() {
  return (
    <>
      <PageHeader eyebrow="agenda" title="Seus próximos dias" description="Compromissos e prazos de todas as áreas. Assine no calendário do celular em Conexões." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-white/5" />}>
        <Agenda />
      </Suspense>
    </>
  );
}
