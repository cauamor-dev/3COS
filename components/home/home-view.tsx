"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useNow } from "@/hooks/use-now";
import type { Entry } from "@/lib/central/types";
import type { NewsItem } from "@/lib/news/store";
import { ChloeCommand } from "./chloe-command";
import { HomeBento } from "./home-bento";
import { HomeFeed, type FeedEvent } from "./home-feed";

type View = "painel" | "feed";

const VIEW_KEY = "3c:home-view";

const noSubscribe = () => () => {};

function readSavedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "feed" ? "feed" : "painel";
  } catch {
    return "painel";
  }
}

/** Home with two views: the visual panel (default) and the full filtered feed. */
export function HomeView(props: {
  events: FeedEvent[];
  tasks: Entry[];
  recent: Entry[];
  news: NewsItem[];
  inboxCount: number;
  serverNow: number;
}) {
  const now = useNow() ?? props.serverNow;
  // Remembers the last view; the server snapshot keeps the HTML on the default.
  const saved = useSyncExternalStore(noSubscribe, readSavedView, () => "painel" as View);
  const [chosen, setView] = useState<View | null>(null);
  const view = chosen ?? saved;

  function show(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-4">
      <ChloeCommand now={now} />
      <div className="flex justify-end">
        <div role="tablist" aria-label="Visualização" className="glass flex rounded-full p-1">
          {([
            ["painel", "Painel", LayoutGrid],
            ["feed", "Feed", Rows3],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => show(id)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors duration-150 ${view === id ? "bg-primary/25 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      {view === "painel" ? <HomeBento {...props} now={now} onOpenFeed={() => show("feed")} /> : <HomeFeed {...props} />}
    </div>
  );
}
