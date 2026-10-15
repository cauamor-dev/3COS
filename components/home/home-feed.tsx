"use client";

import { cn } from "cn";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  Inbox,
  MapPin,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { editEntryAction } from "@/app/(app)/actions";
import { dayKey, dayLabel, formatTime } from "@/components/central/dates";
import { SOURCE_COLOR, SOURCE_PERSONA, TYPE_LABEL } from "@/components/central/labels";
import { TimeAgo } from "@/components/central/time-ago";
import { NewsRow } from "@/components/news/news-card";
import { useNewsActions } from "@/components/news/use-news-actions";
import { useLiveEvents } from "@/components/providers/central-provider";
import { useNow } from "@/hooks/use-now";
import type { Source } from "@/lib/central/schemas";
import type { Entry } from "@/lib/central/types";
import type { NewsItem } from "@/lib/news/store";

const AUTHORS: Source[] = ["claude", "chatgpt", "manual"];

export interface FeedEvent {
  key: string;
  entry: Entry;
  start: string;
  end: string | null;
}

type Tone = "late" | "today" | "normal" | "quiet";
type Filter = "tudo" | "urgente" | "agenda" | "tarefas" | "noticias" | "mural" | "time";

// How many stories mix into "Tudo"; the Notícias filter shows the full ranked list.
const NEWS_IN_FEED = 8;

interface Card {
  key: string;
  kind: "task" | "event" | "post" | "activity";
  entry: Entry;
  at: string;
  tone: Tone;
  score: number;
  event?: FeedEvent;
  fresh?: boolean;
}

const LAST_VISIT_KEY = "c3c-last-visit";
// Read once per page load so the timestamp written below doesn't hide what changed.
let lastVisitCache: string | null | undefined;
function readLastVisit() {
  if (lastVisitCache === undefined) {
    try {
      lastVisitCache = localStorage.getItem(LAST_VISIT_KEY);
    } catch {
      lastVisitCache = null;
    }
  }
  return lastVisitCache;
}
const noopSubscribe = () => () => {};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "tudo", label: "Tudo" },
  { id: "urgente", label: "Urgente" },
  { id: "agenda", label: "Agenda" },
  { id: "tarefas", label: "Tarefas" },
  { id: "noticias", label: "Notícias" },
  { id: "mural", label: "Mural" },
  { id: "time", label: "Time" },
];

const HOUR = 3600_000;

function countdown(ms: number) {
  if (ms < 60_000) return "agora";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `em ${hours}h ${rest}min` : `em ${hours}h`;
}

export function HomeFeed({ events, tasks, recent, news, inboxCount, serverNow }: {
  events: FeedEvent[];
  tasks: Entry[];
  recent: Entry[];
  news: NewsItem[];
  inboxCount: number;
  serverNow: number;
}) {
  const newsActions = useNewsActions();
  const now = useNow() ?? serverNow;
  const [filter, setFilter] = useState<Filter>("tudo");
  const [topic, setTopic] = useState<string | null>(null);
  const [author, setAuthor] = useState<Source | null>(null);
  const [showQuiet, setShowQuiet] = useState(false);
  const [live, setLive] = useState<Entry[]>([]);
  const lastVisit = useSyncExternalStore(noopSubscribe, readLastVisit, () => null);

  useEffect(() => {
    readLastVisit();
    try {
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    } catch {}
  }, []);
  const [done, markDone] = useOptimistic<string[], string>([], (current, id) => [...current, id]);
  const [, startTransition] = useTransition();

  useLiveEvents((event) => {
    if (event.kind === "area-change") return;
    setLive((current) => [event.entry, ...current.filter((e) => e.id !== event.entry.id)]);
  });

  const cards = useMemo(() => {
    const reference = now;
    const today = dayKey(reference);
    const result: Card[] = [];
    const seen = new Set<string>();

    const liveTasks = live.filter((e) => e.type === "tarefa" && !e.done_at);
    const allTasks = [...liveTasks, ...tasks.filter((t) => !liveTasks.some((l) => l.id === t.id))];
    for (const task of allTasks) {
      if (task.done_at || task.archived || done.includes(task.id)) continue;
      seen.add(task.id);
      const due = task.due_at ? Date.parse(task.due_at) : null;
      const late = due !== null && due < reference;
      const isToday = due !== null && dayKey(due) === today;
      const high = task.priority === "alta";
      const tone: Tone = late ? "late" : isToday || high ? "today" : due && due - reference < 3 * 24 * HOUR ? "normal" : "quiet";
      const score = late ? 1000 : isToday ? 800 - (due! - reference) / HOUR : high ? 700 : due ? 400 - (due - reference) / HOUR : 100;
      result.push({ key: task.id, kind: "task", entry: task, at: task.due_at ?? task.created_at, tone, score });
    }

    for (const event of events) {
      const start = Date.parse(event.start);
      const end = event.end ? Date.parse(event.end) : start + HOUR;
      if (end < reference) continue;
      seen.add(event.entry.id);
      const isToday = dayKey(start) === today;
      const soon = start - reference < 3 * HOUR;
      const tone: Tone = isToday ? (soon ? "today" : "normal") : start - reference < 3 * 24 * HOUR ? "normal" : "quiet";
      const score = isToday ? 900 - (start - reference) / HOUR : 450 - (start - reference) / HOUR;
      result.push({ key: event.key, kind: "event", entry: event.entry, at: event.start, tone, score, event });
    }

    const activity = [...live, ...recent].filter((entry, i, list) => list.findIndex((e) => e.id === entry.id) === i);
    for (const entry of activity) {
      if (seen.has(entry.id) || entry.archived || entry.type === "tarefa" || entry.type === "evento") continue;
      const age = reference - Date.parse(entry.created_at);
      const fresh = !!lastVisit && entry.created_at > lastVisit && entry.source !== "manual";
      const isPost = entry.type === "post";
      const tone: Tone = fresh || age < 24 * HOUR ? "normal" : "quiet";
      const score = (fresh ? 600 : 300) - age / HOUR + (isPost ? 20 : 0) + (entry.type === "decisao" ? 10 : 0);
      result.push({ key: entry.id, kind: isPost ? "post" : "activity", entry, at: entry.created_at, tone, score, fresh });
    }

    return result.sort((a, b) => b.score - a.score);
  }, [events, tasks, recent, live, done, now, lastVisit]);

  const filtered = cards.filter((card) => {
    if (topic && card.entry.area.slug !== topic) return false;
    if (author && card.entry.source !== author) return false;
    if (filter === "urgente") return card.tone === "late" || card.tone === "today";
    if (filter === "agenda") return card.kind === "event";
    if (filter === "tarefas") return card.kind === "task";
    if (filter === "mural") return card.kind === "post";
    if (filter === "time") return (card.kind === "activity" || card.kind === "post") && card.entry.source !== "manual";
    if (filter === "noticias") return false;
    return true;
  });
  const main = filtered.filter((card) => card.tone !== "quiet");
  const quiet = filtered.filter((card) => card.tone === "quiet");
  const rows = mixNews(main, news.filter((item) => !newsActions.isDismissed(item)), filter, !!topic || !!author);

  const topics = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const card of cards) {
      if (card.tone === "quiet") continue;
      const current = counts.get(card.entry.area.slug) ?? { name: card.entry.area.name, count: 0 };
      counts.set(card.entry.area.slug, { ...current, count: current.count + 1 });
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  }, [cards]);

  function complete(task: Entry) {
    startTransition(async () => {
      markDone(task.id);
      const result = await editEntryAction({ id: task.id, concluida: true });
      if (!result.ok) toast.error(result.error);
      else toast.success("Concluída", { description: task.title });
    });
  }

  return (
    <div className="space-y-5">
      <NowCard cards={cards} now={now} inboxCount={inboxCount} lastVisit={lastVisit} />

      <div className="sticky top-[calc(env(safe-area-inset-top)+3.9rem)] z-20 -mx-4 space-y-2 bg-background/80 px-4 py-2 backdrop-blur-md md:top-0">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map((item) => (
            <Chip key={item.id} active={filter === item.id} onClick={() => setFilter(item.id)}>
              {item.id === "urgente" && <Flame className="size-3.5" />}
              {item.label}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {AUTHORS.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setAuthor(author === source ? null : source)}
              aria-pressed={author === source}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] text-muted-foreground transition-colors duration-150",
                author === source && "border-white/30 bg-white/10 text-foreground",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: SOURCE_COLOR[source] }} />
              {SOURCE_PERSONA[source].name}
            </button>
          ))}
          {topics.length > 1 && <span className="mx-1 h-4 w-px shrink-0 bg-white/10" />}
          {topics.length > 1 &&
            topics.map(([slug, info]) => (
              <button
                key={slug}
                type="button"
                onClick={() => setTopic(topic === slug ? null : slug)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] transition-colors duration-150",
                  topic === slug ? "bg-primary/25 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                #{slug} <span className="opacity-60">{info.count}</span>
              </button>
            ))}
        </div>
      </div>

      {main.length === 0 && filter !== "noticias" && (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
          <CheckCircle2 className="size-7 text-emerald-400" />
          <p className="font-medium">Você está em dia</p>
          <p className="text-sm text-muted-foreground">Nada urgente {filter !== "tudo" || topic ? "com esses filtros" : "agora"}. Bom momento para avançar no projeto principal.</p>
        </div>
      )}

      {filter === "noticias" && rows.length === 0 && (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
          <Newspaper className="size-6 text-lilac" />
          <p className="text-sm text-muted-foreground">Sem notícias novas agora. Ajuste interesses e fontes no Mural.</p>
          <Link href="/mural" className="text-sm text-lilac hover:underline">Abrir o Mural</Link>
        </div>
      )}

      <ol className="space-y-2.5">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.li
              key={row.kind === "card" ? row.card.key : `news:${row.item.id}`}
              layout="position"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 80, transition: { duration: 0.2 } }}
              transition={{ duration: 0.22 }}
            >
              {row.kind === "card" ? (
                <FeedCard card={row.card} now={now} onComplete={complete} />
              ) : (
                <NewsRow item={row.item} actions={newsActions} />
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {filter === "noticias" && rows.length > 0 && (
        <Link href="/mural" className="mx-auto block py-2 text-center font-mono text-[11px] text-muted-foreground hover:text-foreground">
          mais notícias, interesses e fontes no Mural →
        </Link>
      )}

      {main.length > 0 && (
        <p className="flex items-center justify-center gap-2 py-2 font-mono text-[11px] text-muted-foreground">
          <Check className="size-3.5 text-emerald-400" /> fim do que importa agora
        </p>
      )}

      {quiet.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowQuiet(!showQuiet)}
            className="label-mono flex items-center gap-1 hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform duration-150", !showQuiet && "-rotate-90")} />
            Mais adiante e histórico · {quiet.length}
          </button>
          {showQuiet && (
            <ol className="mt-2.5 space-y-2 opacity-80">
              {quiet.slice(0, 40).map((card) => (
                <li key={card.key}>
                  <FeedCard card={card} now={now} onComplete={complete} compact />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

type Row = { kind: "card"; card: Card } | { kind: "news"; item: NewsItem };

/** Urgent cards first, then the feed with a story every two cards, so news never buries what matters. */
function mixNews(main: Card[], news: NewsItem[], filter: Filter, narrowed: boolean): Row[] {
  if (filter === "noticias") return news.map((item) => ({ kind: "news", item }));
  const cards: Row[] = main.map((card) => ({ kind: "card", card }));
  if (filter !== "tudo" || narrowed) return cards;
  const urgent = main.filter((card) => card.tone === "late" || card.tone === "today").length;
  const rows = cards.slice(0, urgent);
  const rest = cards.slice(urgent);
  const pool = news.slice(0, NEWS_IN_FEED);
  for (let i = 0; rest.length || i < pool.length; i++) {
    rows.push(...rest.splice(0, 2));
    if (i < pool.length) rows.push({ kind: "news", item: pool[i] });
  }
  return rows;
}

function NowCard({ cards, now, inboxCount, lastVisit }: { cards: Card[]; now: number | null; inboxCount: number; lastVisit: string | null }) {
  const late = cards.filter((c) => c.kind === "task" && c.tone === "late").length;
  const today = cards.filter((c) => c.tone === "today").length;
  const fresh = cards.filter((c) => c.fresh).length;
  const next = now === null ? undefined : cards
    .filter((c) => c.kind === "event" && Date.parse(c.at) >= now - 15 * 60_000)
    .sort((a, b) => a.at.localeCompare(b.at))[0];

  return (
    <section className="glass border-beam overflow-hidden rounded-2xl p-5">
      <p className="label-mono text-lilac">agora</p>
      {next ? (
        <Link href={`/areas/${next.entry.area.slug}#${next.entry.id}`} className="mt-2 block">
          <p className="text-sm text-muted-foreground">
            Próximo {now !== null && dayKey(next.at) !== dayKey(now) ? dayLabel(dayKey(next.at), dayKey(now)).toLowerCase() : ""}
            {" · "}
            <span className="text-lilac">{now !== null ? countdown(Date.parse(next.at) - now) : ""}</span>
          </p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{next.entry.title}</p>
          <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Clock className="size-3.5" /> {next.entry.all_day ? "dia todo" : formatTime(next.at)}
            {next.entry.location && (
              <>
                <MapPin className="size-3.5" /> {next.entry.location}
              </>
            )}
          </p>
        </Link>
      ) : (
        <p className="mt-2 text-xl font-semibold tracking-tight">Agenda livre pelos próximos dias</p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat icon={AlertTriangle} label="atrasadas" value={late} tone={late ? "late" : undefined} href="/tarefas" />
        <Stat icon={Flame} label="hoje" value={today} tone={today ? "today" : undefined} href="/agenda" />
        <Stat
          icon={fresh ? Sparkles : Inbox}
          label={fresh ? "novidades" : "na inbox"}
          value={fresh || inboxCount}
          href={fresh ? undefined : "/areas/inbox"}
          title={lastVisit ? undefined : "desde ontem"}
        />
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, tone, href, title }: {
  icon: typeof Flame;
  label: string;
  value: number;
  tone?: "late" | "today";
  href?: string;
  title?: string;
}) {
  const content = (
    <div
      title={title}
      className={cn(
        "rounded-xl border bg-white/[0.02] px-3 py-2.5",
        tone === "late" && "border-red-400/40 bg-red-500/10",
        tone === "today" && "border-amber-300/40 bg-amber-400/10",
      )}
    >
      <p className={cn("flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase", tone === "late" && "text-red-300", tone === "today" && "text-amber-200")}>
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-0.5 font-mono text-2xl font-medium tabular-nums">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

const TONE_BAR: Record<Tone, string> = {
  late: "bg-red-400",
  today: "bg-amber-300",
  normal: "bg-primary/70",
  quiet: "bg-white/15",
};

function FeedCard({ card, now, onComplete, compact }: { card: Card; now: number | null; onComplete(task: Entry): void; compact?: boolean }) {
  const { entry } = card;
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [0, 90], [0, 1]);
  const swipeable = card.kind === "task";
  const href = `/areas/${entry.area.slug}#${entry.id}`;

  const body = (
    <div className={cn("glass relative flex gap-3 overflow-hidden rounded-xl", compact ? "p-3" : "p-3.5")} data-entry-id={entry.id}>
      <span className={cn("absolute inset-y-0 left-0 w-1", TONE_BAR[card.tone])} />
      {card.kind === "task" ? (
        <button
          type="button"
          onClick={() => onComplete(entry)}
          aria-label="Concluir tarefa"
          className={cn(
            "mt-0.5 ml-1 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors duration-150 hover:border-emerald-400 hover:bg-emerald-400/10",
            card.tone === "late" ? "border-red-400/70" : card.tone === "today" ? "border-amber-300/70" : "border-white/25",
          )}
        />
      ) : (
        <CardIcon card={card} />
      )}
      <Link href={href} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px]">
          <Meta card={card} now={now} />
          <span className="text-muted-foreground">#{entry.area.slug}</span>
          {entry.priority === "alta" && (
            <span className="rounded bg-red-500/20 px-1 text-red-300">alta</span>
          )}
          {card.fresh && <span className="rounded bg-primary/25 px-1 text-lilac">novo</span>}
        </div>
        <p className={cn("mt-1 leading-snug", compact ? "text-sm" : "text-[15px] font-medium")}>{entry.title}</p>
        {!compact && (card.kind === "post" || card.kind === "activity") && entry.content_md && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.content_md.replace(/[#*_`>\[\]]/g, "").trim()}</p>
        )}
        {!compact && card.kind === "post" && entry.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- remote images from any source
          <img src={entry.image_url} alt="" loading="lazy" className="mt-2 max-h-48 w-full rounded-lg border object-cover" />
        )}
      </Link>
    </div>
  );

  if (!swipeable) return body;

  return (
    <div className="relative">
      <motion.div
        style={{ opacity: revealOpacity }}
        className="absolute inset-0 flex items-center rounded-xl bg-emerald-500/20 pl-4 text-emerald-300"
      >
        <Check className="size-5" /> <span className="ml-2 text-sm font-medium">Concluir</span>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.6 }}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 90) onComplete(entry);
        }}
        className="relative touch-pan-y"
      >
        {body}
      </motion.div>
    </div>
  );
}

function CardIcon({ card }: { card: Card }) {
  const { entry } = card;
  if (card.kind === "event") {
    return (
      <span className="mt-0.5 ml-1 grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-lilac">
        <CalendarDays className="size-3.5" />
      </span>
    );
  }
  const color = SOURCE_COLOR[entry.source];
  return (
    <span
      className="mt-0.5 ml-1 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold"
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      {card.kind === "post" ? <Newspaper className="size-3.5" /> : SOURCE_PERSONA[entry.source].name.charAt(0)}
    </span>
  );
}

function Meta({ card, now }: { card: Card; now: number | null }) {
  const { entry } = card;
  const today = now === null ? null : dayKey(now);
  if (card.kind === "task") {
    if (!entry.due_at) return <span className="text-muted-foreground">tarefa</span>;
    const label = card.tone === "late" ? "atrasada" : today ? `${dayLabel(dayKey(entry.due_at), today)} ${formatTime(entry.due_at)}` : formatTime(entry.due_at);
    return <span className={cn(card.tone === "late" ? "text-red-300" : card.tone === "today" ? "text-amber-200" : "text-muted-foreground")}>{label}</span>;
  }
  if (card.kind === "event") {
    const label = entry.all_day ? "dia todo" : formatTime(card.at);
    return (
      <span className={cn(card.tone === "today" ? "text-amber-200" : "text-lilac")}>
        {today && dayKey(card.at) !== today ? `${dayLabel(dayKey(card.at), today)} ` : ""}
        {label}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      <span style={{ color: SOURCE_COLOR[entry.source] }}>{SOURCE_PERSONA[entry.source].name}</span> · {TYPE_LABEL[entry.type].toLowerCase()} ·{" "}
      <TimeAgo date={entry.created_at} />
    </span>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground",
        active && "border-primary/60 bg-primary/20 text-foreground",
      )}
    >
      {children}
    </button>
  );
}
