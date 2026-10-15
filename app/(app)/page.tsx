import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomeFeed } from "@/components/home/home-feed";
import { getCachedMember, PAGE_DATA_LIFE } from "@/lib/auth";
import { addDays, startOfLocalDay } from "@/lib/central/time";
import { rankNews } from "@/lib/news/store";

async function loadHome() {
  "use cache: private";
  cacheLife(PAGE_DATA_LIFE);
  const member = await getCachedMember();
  if (!member) return null;
  const { central, news } = member;
  const today = startOfLocalDay();
  const [feed, events, tasks, inbox, stories] = await Promise.all([
    central.feed({ limite: 60 }),
    central.eventsBetween(today, addDays(today, 14)),
    central.tasksForPanel(),
    central.feed({ area: "inbox", limite: 1 }).catch(() => ({ total: 0 })),
    // News is a bonus: if collection or the table fails, the rest of the home still loads.
    Promise.all([news.items({ hours: 36, limit: 150, unreadOnly: true }), news.settings()])
      .then(([items, settings]) => rankNews(items, settings).slice(0, 40))
      .catch(() => []),
  ]);
  return { feed, events, tasks, inbox, stories, serverNow: Date.now() };
}

async function HomeContent() {
  const data = await loadHome();
  if (!data) redirect("/login");
  const { feed, events, tasks, inbox, stories, serverNow } = data;
  return (
    <HomeFeed
      events={events.map((o) => ({ key: `${o.entry.id}:${o.start}`, entry: o.entry, start: o.start, end: o.end }))}
      tasks={tasks.filter((task) => !task.done_at)}
      recent={feed.items}
      news={stories}
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
