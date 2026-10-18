import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AgendaView, type AgendaItem } from "@/components/agenda/agenda-view";
import { dayKey } from "@/components/central/dates";
import { PageHeader } from "@/components/shell/page-header";
import { getCachedMember, PAGE_DATA_LIFE } from "@/lib/auth";
import { addDays, startOfLocalDay } from "@/lib/central/time";

export const metadata: Metadata = { title: "Agenda" };

async function loadAgenda() {
  "use cache: private";
  cacheLife(PAGE_DATA_LIFE);
  const member = await getCachedMember();
  if (!member) return null;
  const { central } = member;
  const today=startOfLocalDay();
  const from = addDays(today,-40);
  const to = addDays(today, 100);
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

  return { items, todayKey: dayKey(today.getTime() + 12 * 3600_000) };
}

async function Agenda() {
  const data = await loadAgenda();
  if (!data) redirect("/login");
  return <AgendaView items={data.items} todayKey={data.todayKey} />;
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
