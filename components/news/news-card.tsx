"use client";

import { cn } from "cn";
import { Bookmark, BookmarkCheck, EyeOff, Share2 } from "lucide-react";
import { useState } from "react";
import { TimeAgo } from "@/components/central/time-ago";
import type { NewsItem } from "@/lib/news/store";
import type { NewsActions } from "./use-news-actions";

function Thumb({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- images come from any news site; next/image would need every domain whitelisted
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("border bg-white/[0.03] object-cover", className)}
    />
  );
}

function Hits({ hits }: { hits: string[] }) {
  if (!hits.length) return null;
  return (
    <>
      {hits.slice(0, 2).map((hit) => (
        <span key={hit} className="rounded bg-primary/25 px-1 text-lilac">
          {hit}
        </span>
      ))}
    </>
  );
}

/** Full story card for the Mural's news tab. */
export function NewsCard({ item, actions, featured }: { item: NewsItem; actions: NewsActions; featured?: boolean }) {
  const read = actions.isRead(item);
  const saved = actions.isSaved(item);

  return (
    <article className={cn("glass overflow-hidden rounded-2xl transition-opacity duration-200", read && "opacity-60")}>
      <a href={item.url} target="_blank" rel="noreferrer" onClick={() => actions.open(item)} className="block">
        {featured && item.image_url && <Thumb src={item.image_url} className="aspect-[16/9] w-full border-0 border-b" />}
        <div className="flex gap-3 p-4 pb-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
              <span className="text-foreground/80">{item.source}</span>
              <span>#{item.topic.toLowerCase()}</span>
              <TimeAgo date={item.published_at} />
              <Hits hits={item.hits} />
            </p>
            <h3 className="mt-1.5 text-[15px] leading-snug font-medium">{item.title}</h3>
            {item.summary && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>}
          </div>
          {!featured && item.image_url && <Thumb src={item.image_url} className="size-20 shrink-0 rounded-lg" />}
        </div>
      </a>
      <div className="flex items-center gap-1 px-2 pb-2">
        <IconButton label={saved ? "Salva no Mural" : "Salvar no Mural"} onClick={() => !saved && actions.save(item)} active={saved}>
          {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </IconButton>
        <IconButton label="Compartilhar" onClick={() => actions.share(item)}>
          <Share2 className="size-4" />
        </IconButton>
        <IconButton label="Dispensar" onClick={() => actions.dismiss(item)} className="ml-auto">
          <EyeOff className="size-4" />
        </IconButton>
      </div>
    </article>
  );
}

/** Compact row for the home feed. */
export function NewsRow({ item, actions }: { item: NewsItem; actions: NewsActions }) {
  const read = actions.isRead(item);
  return (
    <div className={cn("glass relative flex gap-3 overflow-hidden rounded-xl p-3.5", read && "opacity-60")}>
      <span className="absolute inset-y-0 left-0 w-1 bg-white/25" />
      <a href={item.url} target="_blank" rel="noreferrer" onClick={() => actions.open(item)} className="ml-1 flex min-w-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground/80">{item.source}</span>
            <span>notícia</span>
            <TimeAgo date={item.published_at} />
            <Hits hits={item.hits} />
          </p>
          <p className="mt-1 line-clamp-3 text-[15px] leading-snug font-medium">{item.title}</p>
        </div>
        {item.image_url && <Thumb src={item.image_url} className="size-16 shrink-0 rounded-lg" />}
      </a>
      <button
        type="button"
        onClick={() => actions.dismiss(item)}
        aria-label="Dispensar notícia"
        className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <EyeOff className="size-3.5" />
      </button>
    </div>
  );
}

function IconButton({ label, onClick, active, className, children }: {
  label: string;
  onClick(): void;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground",
        active && "text-lilac",
        className,
      )}
    >
      {children}
    </button>
  );
}
