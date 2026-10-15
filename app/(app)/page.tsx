import { Suspense } from "react";
import { HomeFeed } from "@/components/home/home-feed";
import { requireMember } from "@/lib/auth";
import { addDays, startOfLocalDay } from "@/lib/central/time";

async function loadHome() {
  const { central } = await requireMember();
  const today = startOfLocalDay();
  const [feed, events, tasks, inbox] = await Promise.all([
    central.feed({ limite: 60 }),
    central.eventsBetween(today, addDays(today, 14)),
    central.tasksForPanel(),
    central.feed({ area: "inbox", limite: 1 }).catch(() => ({ total: 0 })),
  ]);
  return { feed, events, tasks, inbox, serverNow: Date.now() };
}

async function HomeContent() {
  const { feed, events, tasks, inbox, serverNow } = await loadHome();
  return (
    <HomeFeed
      events={events.map((o) => ({ key: `${o.entry.id}:${o.start}`, entry: o.entry, start: o.start, end: o.end }))}
      tasks={tasks.filter((task) => !task.done_at)}
      recent={feed.items}
      inboxCount={inbox.total}
      serverNow={serverNow}
    />
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-10 animate-pulse rounded-full bg-white/5" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
