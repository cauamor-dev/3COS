"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { markNewsReadAction, saveNewsToMuralAction } from "@/app/(app)/news-actions";
import type { NewsItem } from "@/lib/news/store";

/** Local read/dismissed/saved state so taps feel instant; the server catches up in the background. */
export function useNewsActions() {
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [reading, setReading] = useState<NewsItem | null>(null);
  const [, startTransition] = useTransition();

  const add = (set: Set<string>, id: string) => new Set(set).add(id);

  function open(item: NewsItem) {
    if (item.read_at || read.has(item.id)) return;
    setRead((current) => add(current, item.id));
    void markNewsReadAction([item.id]);
  }

  function dismiss(item: NewsItem) {
    setDismissed((current) => add(current, item.id));
    void markNewsReadAction([item.id]).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
    toast("Notícia dispensada", { action: { label: "Desfazer", onClick: () => undismiss(item) } });
  }

  function undismiss(item: NewsItem) {
    setDismissed((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    void markNewsReadAction([item.id], false);
  }

  function save(item: NewsItem) {
    setSaved((current) => add(current, item.id));
    startTransition(async () => {
      const result = await saveNewsToMuralAction(item.id);
      if (result.ok) toast.success("Salva no Mural", { description: item.title });
      else {
        toast.error(result.error);
        setSaved((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    });
  }

  async function share(item: NewsItem) {
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: item.url });
      else {
        await navigator.clipboard.writeText(item.url);
        toast.success("Link copiado");
      }
    } catch {
      // The user closed the share sheet.
    }
  }

  /** Click handler for story links: opens the in-app reader; modified clicks still go to the source. */
  function reader(item: NewsItem) {
    return (event: React.MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return open(item);
      event.preventDefault();
      open(item);
      setReading(item);
    };
  }

  return {
    reading,
    closeReader: () => setReading(null),
    reader,
    isRead: (item: NewsItem) => !!item.read_at || read.has(item.id),
    isDismissed: (item: NewsItem) => dismissed.has(item.id),
    isSaved: (item: NewsItem) => item.saved || saved.has(item.id),
    open,
    dismiss,
    undismiss,
    save,
    share,
  };
}

export type NewsActions = ReturnType<typeof useNewsActions>;

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
