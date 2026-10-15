"use client";

import { Bookmark, BookmarkCheck, ChevronLeft, ExternalLink, Languages, Share2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { TimeAgo } from "@/components/central/time-ago";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { NewsItem } from "@/lib/news/store";
import { looksEnglish, translatedUrl } from "@/lib/news/translate";
import type { NewsActions } from "./use-news-actions";

/** In-app reading panel: image, summary and the way out to the source (translated or not). */
export function NewsReader({ actions }: { actions: NewsActions }) {
  const item = actions.reading;
  const open = !!item;
  const { closeReader } = actions;
  const touch = useRef<{ x: number; y: number } | null>(null);

  // The reader gets its own history entry, so the phone's back gesture/button closes it
  // instead of leaving the page (in the installed iPhone app there is no back gesture at all).
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ ...window.history.state, newsReader: true }, "");
    const onPop = () => closeReader();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.newsReader) window.history.back();
    };
  }, [open, closeReader]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeReader()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onTouchStart={(event) => {
          const t = event.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const t = event.changedTouches[0];
          const dx = t.clientX - start.x;
          // Swipe right to go back, like any iPhone screen.
          if (dx > 80 && Math.abs(t.clientY - start.y) < dx * 0.6) closeReader();
        }}
        className="gap-0 overflow-y-auto overscroll-contain border-l bg-background/95 p-0 backdrop-blur-xl data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <div className="sticky top-0 z-10 flex items-center border-b bg-background/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <button
            type="button"
            onClick={closeReader}
            className="flex h-12 items-center gap-1 rounded-lg px-2 text-[15px] text-lilac active:opacity-60"
          >
            <ChevronLeft className="size-5" /> Voltar
          </button>
        </div>
        {item && <Story item={item} actions={actions} />}
      </SheetContent>
    </Sheet>
  );
}

function Story({ item, actions }: { item: NewsItem; actions: NewsActions }) {
  const english = looksEnglish(`${item.title} ${item.summary}`);
  const saved = actions.isSaved(item);
  return (
    <>
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- images come from any news site
        <img src={item.image_url} alt="" referrerPolicy="no-referrer" className="aspect-[16/9] w-full border-b object-cover" />
      )}
      <div className="space-y-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground/80">{item.source}</span>
          <span>#{item.topic.toLowerCase()}</span>
          <TimeAgo date={item.published_at} />
          {english && <span className="rounded bg-white/10 px-1">em inglês</span>}
        </p>
        <SheetTitle className="text-xl leading-snug font-semibold tracking-tight">{item.title}</SheetTitle>
        <SheetDescription className="text-[15px] leading-relaxed text-foreground/80">
          {item.summary || "Sem resumo. Abra a fonte para ler a notícia completa."}
        </SheetDescription>

        <div className="grid gap-2 pt-2">
          {english && (
            <a
              href={translatedUrl(item.url)}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground"
            >
              <Languages className="size-4" /> Ler traduzida em português
            </a>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 font-medium transition-colors duration-150 hover:border-primary/50"
          >
            <ExternalLink className="size-4" /> {english ? "Abrir original" : "Ler na fonte"}
          </a>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => !saved && actions.save(item)}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {saved ? <BookmarkCheck className="size-4 text-lilac" /> : <Bookmark className="size-4" />} {saved ? "No Mural" : "Salvar no Mural"}
            </button>
            <button
              type="button"
              onClick={() => actions.share(item)}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <Share2 className="size-4" /> Compartilhar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
