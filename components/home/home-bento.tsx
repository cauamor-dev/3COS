"use client";

import { cn } from "cn";
import { AlertTriangle, ArrowUpRight, Check, Clock, Eye, Flame, Inbox, MapPin, Newspaper } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { editEntryAction } from "@/app/(app)/actions";
import { dayKey, dayLabel, formatTime } from "@/components/central/dates";
import { SOURCE_COLOR, SOURCE_PERSONA, WATCH_TAG } from "@/components/central/labels";
import { TimeAgo } from "@/components/central/time-ago";
import { NewsReader } from "@/components/news/news-reader";
import { useNewsActions } from "@/components/news/use-news-actions";
import type { Source } from "@/lib/central/schemas";
import type { Entry } from "@/lib/central/types";
import type { NewsItem } from "@/lib/news/store";
import type { FeedEvent } from "./home-feed";

const HOUR = 3600_000;

function countdown(ms: number) {
  if (ms < 60_000) return "agora";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return `em ${Math.round(hours / 24)} d`;
  return minutes % 60 ? `em ${hours}h ${minutes % 60}min` : `em ${hours}h`;
}

/** Widget-style overview: the few things that matter, at a glance, in blocks of different sizes. */
export function HomeBento({ events, tasks, recent, news, inboxCount, now, onOpenFeed }: {
  events: FeedEvent[];
  tasks: Entry[];
  recent: Entry[];
  news: NewsItem[];
  inboxCount: number;
  now: number;
  onOpenFeed(): void;
}) {
  const [done, markDone] = useOptimistic<string[], string>([], (current, id) => [...current, id]);
  const [, startTransition] = useTransition();
  const newsActions = useNewsActions();
  const today = dayKey(now);

  const upcoming = events.filter((e) => Date.parse(e.end ?? e.start) + (e.end ? 0 : HOUR) >= now).sort((a, b) => a.start.localeCompare(b.start));
  const next = upcoming[0];
  const open = tasks.filter((t) => !t.done_at && !t.archived && !done.includes(t.id));
  const watches = open.filter((t) => t.tags.includes(WATCH_TAG));
  const late = open.filter((t) => t.due_at && Date.parse(t.due_at) < now);
  const dueToday = open.filter((t) => t.due_at && dayKey(t.due_at) === today && Date.parse(t.due_at) >= now);
  const focus = [...late, ...dueToday, ...open.filter((t) => t.priority === "alta" && !late.includes(t) && !dueToday.includes(t))].slice(0, 4);
  const stories = news.filter((n) => !newsActions.isDismissed(n));
  const hero = stories.find((n) => n.image_url) ?? stories[0];
  const carousel = stories.filter((n) => n !== hero).slice(0, 10);
  const fromAgent = (source: Source) => recent.find((e) => e.source === source && !e.archived);

  function complete(task: Entry) {
    startTransition(async () => {
      markDone(task.id);
      const result = await editEntryAction({ id: task.id, concluida: true });
      if (!result.ok) toast.error(result.error);
      else toast.success("Concluída", { description: task.title });
    });
  }

  return (
    <div className="grid grid-flow-row-dense auto-rows-[minmax(7.5rem,auto)] grid-cols-2 gap-3 md:grid-cols-4">
      <NewsReader actions={newsActions} />
      {/* Agora */}
      <Block className="glass border-beam col-span-2 md:row-span-2" delay={0}>
        <p className="label-mono text-lilac">agora</p>
        {next ? (
          <Link href={`/areas/${next.entry.area.slug}#${next.entry.id}`} className="mt-3 flex flex-1 flex-col">
            <p className="font-mono text-3xl font-medium tracking-tight text-lilac tabular-nums md:text-5xl">
              {Date.parse(next.start) <= now ? "acontecendo" : countdown(Date.parse(next.start) - now)}
            </p>
            <p className="mt-2 line-clamp-2 text-xl font-semibold tracking-tight md:text-2xl">{next.entry.title}</p>
            <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {dayKey(next.start) !== today && `${dayLabel(dayKey(next.start), today)} · `}
                {next.entry.all_day ? "dia todo" : formatTime(next.start)}
              </span>
              {next.entry.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {next.entry.location}
                </span>
              )}
            </p>
          </Link>
        ) : (
          <div className="mt-3 flex flex-1 flex-col justify-end">
            <p className="text-2xl font-semibold tracking-tight">Agenda livre</p>
            <p className="text-sm text-muted-foreground">Nenhum compromisso nos próximos dias.</p>
          </div>
        )}
      </Block>

      {/* Números */}
      <Stat href="/tarefas" icon={AlertTriangle} label="atrasadas" value={late.length} tone={late.length ? "late" : undefined} delay={0.04} />
      <Stat href="/agenda" icon={Flame} label="hoje" value={dueToday.length + upcoming.filter((e) => dayKey(e.start) === today).length} tone="today" delay={0.08} />

      {/* Foco de hoje */}
      <Block className="glass col-span-2 md:row-span-2" delay={0.12}>
        <div className="flex items-center justify-between">
          <p className="label-mono">foco</p>
          <Link href="/tarefas" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
            {open.length} abertas →
          </Link>
        </div>
        {focus.length ? (
          <ul className="mt-2 space-y-1">
            {focus.map((task) => {
              const isLate = late.includes(task);
              return (
                <li key={task.id} className="flex items-center gap-3 rounded-lg py-1.5">
                  <button
                    type="button"
                    onClick={() => complete(task)}
                    aria-label="Concluir tarefa"
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors duration-150 hover:border-emerald-400 hover:bg-emerald-400/10",
                      isLate ? "border-red-400/70" : "border-white/25",
                    )}
                  />
                  <Link href={`/areas/${task.area.slug}#${task.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">{task.title}</p>
                    <p className={cn("font-mono text-[11px]", isLate ? "text-red-300" : "text-muted-foreground")}>
                      {isLate ? "atrasada" : task.due_at ? formatTime(task.due_at) : "prioridade alta"} · #{task.area.slug}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-end gap-1">
            <Check className="size-6 text-emerald-400" />
            <p className="font-medium">Nada urgente</p>
            <p className="text-sm text-muted-foreground">Bom momento para o projeto principal.</p>
          </div>
        )}
      </Block>

      {/* Notícia em destaque */}
      {hero && (
        <Block className="col-span-2 row-span-2 overflow-hidden border p-0 md:col-span-2" delay={0.16}>
          <a href={hero.url} target="_blank" rel="noreferrer" onClick={newsActions.reader(hero)} className="group relative flex h-full min-h-64 flex-col justify-end">
            {hero.image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- images come from any news site
              <img src={hero.image_url} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            <div className="relative p-4">
              <p className="flex items-center gap-2 font-mono text-[11px] text-white/70">
                <Newspaper className="size-3.5" /> {hero.source} · <TimeAgo date={hero.published_at} />
                {hero.hits[0] && <span className="rounded bg-primary/40 px-1 text-white">{hero.hits[0]}</span>}
              </p>
              <p className="mt-1.5 line-clamp-3 text-lg leading-snug font-semibold text-white">{hero.title}</p>
            </div>
          </a>
        </Block>
      )}

      {/* Semana */}
      <WeekBlock events={upcoming} tasks={open} now={now} />

      {/* Time: Vega e Nox */}
      <AgentBlock source="claude" entry={fromAgent("claude")} delay={0.24} />
      <AgentBlock source="chatgpt" entry={fromAgent("chatgpt")} delay={0.28} />

      {/* Inbox */}
      <Stat href="/areas/inbox" icon={Inbox} label="na inbox" value={inboxCount} delay={0.32} />
      <button
        type="button"
        onClick={onOpenFeed}
        className="glass flex flex-col justify-between rounded-2xl p-4 text-left transition-colors duration-150 hover:border-primary/40"
      >
        <p className="label-mono">feed</p>
        <p className="flex items-end justify-between text-sm font-medium">
          Ver tudo em lista <ArrowUpRight className="size-4 text-lilac" />
        </p>
      </button>

      {/* Vigias de preço (pedidos delegados à Vega) */}
      {watches.length > 0 && (
        <Link
          href="/tarefas"
          className="glass col-span-2 flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 transition-colors duration-150 hover:border-primary/40 md:col-span-4"
        >
          <Eye className="size-4 shrink-0 text-lilac" />
          <p className="label-mono shrink-0">vigiando</p>
          <p className="min-w-0 truncate text-sm">{watches.map((t) => t.title.replace(/^Vigiar preço:\s*/i, "")).join(" · ")}</p>
        </Link>
      )}

      {/* Mais notícias */}
      {carousel.length > 0 && (
        <section className="col-span-2 md:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="label-mono">para você</p>
            <Link href="/mural" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
              mural →
            </Link>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {carousel.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                onClick={newsActions.reader(item)}
                className={cn("glass w-60 shrink-0 snap-start overflow-hidden rounded-2xl transition-opacity", newsActions.isRead(item) && "opacity-60")}
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- images come from any news site
                  <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[16/9] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[16/9] place-items-center bg-white/[0.03] font-mono text-xs text-muted-foreground">{item.topic}</div>
                )}
                <div className="p-3">
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {item.source} · <TimeAgo date={item.published_at} />
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm leading-snug font-medium">{item.title}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** CSS entrance (not Motion) so blocks are visible in the server HTML before JavaScript loads. */
function Block({ className, delay, children }: { className?: string; delay: number; children: React.ReactNode }) {
  return (
    <section
      style={{ animationDelay: `${delay}s` }}
      className={cn("flex flex-col rounded-2xl p-4 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-300", className)}
    >
      {children}
    </section>
  );
}

function Stat({ href, icon: Icon, label, value, tone, delay }: {
  href: string;
  icon: typeof Flame;
  label: string;
  value: number;
  tone?: "late" | "today";
  delay: number;
}) {
  const active = tone && value > 0;
  return (
    <Block
      delay={delay}
      className={cn(
        "glass p-0",
        active && tone === "late" && "border-red-400/40 bg-red-500/10",
        active && tone === "today" && "border-amber-300/40 bg-amber-400/10",
      )}
    >
      <Link href={href} className="flex h-full flex-col justify-between p-4">
        <p
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase",
            active && tone === "late" && "text-red-300",
            active && tone === "today" && "text-amber-200",
          )}
        >
          <Icon className="size-3.5" /> {label}
        </p>
        <p className="font-mono text-4xl font-medium tabular-nums">{value}</p>
      </Link>
    </Block>
  );
}

function WeekBlock({ events, tasks, now }: { events: FeedEvent[]; tasks: Entry[]; now: number }) {
  const today = dayKey(now);
  const days = Array.from({ length: 7 }, (_, i) => dayKey(now + i * 24 * HOUR));
  const counts = days.map((key) => ({
    key,
    events: events.filter((e) => dayKey(e.start) === key).length,
    tasks: tasks.filter((t) => t.due_at && dayKey(t.due_at) === key).length,
  }));
  return (
    <Block className="glass col-span-2" delay={0.2}>
      <div className="flex items-center justify-between">
        <p className="label-mono">semana</p>
        <Link href="/agenda" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
          agenda →
        </Link>
      </div>
      <div className="mt-auto grid grid-cols-7 gap-1 pt-3">
        {counts.map((day, i) => (
          <Link
            key={day.key}
            href="/agenda"
            className={cn("flex flex-col items-center gap-1.5 rounded-xl py-2", i === 0 && "bg-primary/15 ring-1 ring-primary/40")}
          >
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {i === 0 ? "hoje" : dayLabel(day.key, today).split(" ")[0]}
            </span>
            <span className="font-mono text-lg tabular-nums">{Number(day.key.slice(8))}</span>
            <span className="flex h-1.5 gap-0.5">
              {Array.from({ length: Math.min(day.events, 3) }, (_, j) => (
                <span key={`e${j}`} className="size-1.5 rounded-full bg-lilac" />
              ))}
              {Array.from({ length: Math.min(day.tasks, 3) }, (_, j) => (
                <span key={`t${j}`} className="size-1.5 rounded-full bg-white/50" />
              ))}
            </span>
          </Link>
        ))}
      </div>
    </Block>
  );
}

function AgentBlock({ source, entry, delay }: { source: Source; entry: Entry | undefined; delay: number }) {
  const persona = SOURCE_PERSONA[source];
  const color = SOURCE_COLOR[source];
  const content = (
    <>
      <p className="flex items-center gap-2">
        <span
          className="grid size-7 place-items-center rounded-full font-mono text-xs font-semibold"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          {persona.name.charAt(0)}
        </span>
        <span className="text-sm font-medium">{persona.name}</span>
      </p>
      {entry ? (
        <div className="mt-auto pt-2">
          <p className="line-clamp-3 text-sm leading-snug">{entry.title}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            <TimeAgo date={entry.created_at} />
          </p>
        </div>
      ) : (
        <p className="mt-auto pt-2 text-sm text-muted-foreground">Sem novidades ainda.</p>
      )}
    </>
  );
  return (
    <Block delay={delay} className="glass p-0">
      {entry ? (
        <Link href={`/areas/${entry.area.slug}#${entry.id}`} className="flex h-full flex-col p-4">
          {content}
        </Link>
      ) : (
        <div className="flex h-full flex-col p-4">{content}</div>
      )}
    </Block>
  );
}

