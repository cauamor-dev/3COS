import { Suspense } from "react";
import { AreaCards } from "@/components/home/area-cards";
import { BriefingCard } from "@/components/home/briefing-card";
import { LiveFeed } from "@/components/home/live-feed";
import { StatsBar } from "@/components/home/stats-bar";
import { TodayCard } from "@/components/home/today-card";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";
import { addDays, startOfLocalDay } from "@/lib/central/time";

async function HomeContent() {
  const { central } = await requireMember();
  const today = startOfLocalDay();
  const tomorrow = addDays(today, 1);
  const [feed, stats, todayEvents, tasks] = await Promise.all([
    central.feed({ limite: 50 }),
    central.stats(),
    central.eventsBetween(today, tomorrow),
    central.tasksForPanel(),
  ]);
  const dueTasks = tasks.filter((task) => !task.done_at && task.due_at && task.due_at < tomorrow.toISOString());

  return (
    <div className="space-y-8">
      <StatsBar initial={stats} />
      <TodayCard
        events={todayEvents.map((o) => ({ key: `${o.entry.id}:${o.start}`, entry: o.entry, start: o.start }))}
        tasks={dueTasks}
      />
      <BriefingCard recent={feed.items} />
      <section>
        <h2 className="mb-3 text-sm font-medium">Áreas ativas</h2>
        <AreaCards />
      </section>
      <LiveFeed initial={feed.items} />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[74px] animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <PageHeader eyebrow="central 3c" title="O que suas IAs sabem agora" />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </>
  );
}
