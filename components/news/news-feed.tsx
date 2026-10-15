"use client";

import { cn } from "cn";
import { Newspaper, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { refreshNewsAction } from "@/app/(app)/news-actions";
import { Button } from "@/components/ui/button";
import type { NewsSettings } from "@/lib/news/ranking";
import type { NewsFeed, NewsItem } from "@/lib/news/store";
import { NewsCard } from "./news-card";
import { NewsReader } from "./news-reader";
import { NewsSettingsSheet } from "./news-settings";
import { useNewsActions } from "./use-news-actions";

const FOR_YOU = "para-voce";
const PAGE = 20;

export function NewsFeed({ items, settings, feeds }: { items: NewsItem[]; settings: NewsSettings; feeds: NewsFeed[] }) {
  const actions = useNewsActions();
  const [topic, setTopic] = useState(FOR_YOU);
  const [visible, setVisible] = useState(PAGE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [items]);

  // Ranking already puts your interests and fresh stories first; topics just narrow it down.
  const list = items.filter((item) => !actions.isDismissed(item) && (topic === FOR_YOU || item.topic === topic));
  const shown = list.slice(0, visible);

  function refreshNow() {
    startRefresh(async () => {
      const result = await refreshNewsAction();
      if (result.ok) toast.success(result.data.items ? `${result.data.items} notícias verificadas` : "Tudo em dia");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          <Chip active={topic === FOR_YOU} onClick={() => setTopic(FOR_YOU)}>
            <Sparkles className="size-3.5" /> Para você
          </Chip>
          {topics.map((name) => (
            <Chip key={name} active={topic === name} onClick={() => setTopic(name)}>
              {name}
            </Chip>
          ))}
        </div>
        <Button size="icon" variant="outline" aria-label="Interesses e fontes" onClick={() => setSettingsOpen(true)} className="shrink-0">
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>

      {shown.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <Newspaper className="size-6 text-lilac" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "As notícias das suas fontes chegam aqui a cada 30 minutos, ordenadas pelos seus interesses."
              : "Nada novo neste tópico."}
          </p>
          <Button size="sm" variant="outline" onClick={refreshNow} disabled={refreshing}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> Buscar agora
          </Button>
        </div>
      ) : (
        <ol className="space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((item, index) => (
              <motion.li key={item.id} layout="position" exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}>
                <NewsCard item={item} actions={actions} featured={index === 0 || (index % 6 === 0 && !actions.isRead(item))} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      {list.length > visible && (
        <Button variant="outline" className="w-full" onClick={() => setVisible(visible + PAGE)}>
          Mostrar mais · {list.length - visible}
        </Button>
      )}

      {shown.length > 0 && (
        <button
          type="button"
          onClick={refreshNow}
          disabled={refreshing}
          className="mx-auto flex items-center gap-2 py-2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> atualiza sozinho a cada 30 min · buscar agora
        </button>
      )}

      <NewsReader actions={actions} />
      <NewsSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} feeds={feeds} />
    </div>
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
