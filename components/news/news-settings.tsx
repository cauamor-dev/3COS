"use client";

import { cn } from "cn";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addNewsFeedAction,
  removeNewsFeedAction,
  saveNewsSettingsAction,
  setNewsFeedEnabledAction,
} from "@/app/(app)/news-actions";
import { TimeAgo } from "@/components/central/time-ago";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { NewsSettings } from "@/lib/news/ranking";
import type { NewsFeed } from "@/lib/news/store";
import { hostname } from "./use-news-actions";

export function NewsSettingsSheet({ open, onOpenChange, settings, feeds }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  settings: NewsSettings;
  feeds: NewsFeed[];
}) {
  const [prefs, setPrefs] = useState(settings);
  const [keyword, setKeyword] = useState("");
  const [, startTransition] = useTransition();
  const topics = [...new Set([...feeds.map((feed) => feed.topic), ...prefs.mutedTopics])].sort();

  function persist(next: NewsSettings) {
    setPrefs(next);
    startTransition(async () => {
      const result = await saveNewsSettingsAction(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  function addKeyword() {
    const value = keyword.trim();
    setKeyword("");
    if (!value || prefs.keywords.some((k) => k.toLowerCase() === value.toLowerCase())) return;
    persist({ ...prefs, keywords: [...prefs.keywords, value] });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-2xl px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="p-0">
          <SheetTitle>Interesses e fontes</SheetTitle>
          <SheetDescription>O que aparece primeiro no Início e no Mural.</SheetDescription>
        </SheetHeader>

        <section className="space-y-2">
          <p className="label-mono">interesses</p>
          <div className="flex flex-wrap gap-1.5">
            {prefs.keywords.map((value) => (
              <span key={value} className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 py-1 pr-1 pl-2.5 text-[13px]">
                {value}
                <button
                  type="button"
                  aria-label={`Remover ${value}`}
                  onClick={() => persist({ ...prefs, keywords: prefs.keywords.filter((k) => k !== value) })}
                  className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addKeyword();
            }}
          >
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ex.: Docker, vagas remotas" maxLength={40} className="text-base sm:text-sm" />
            <Button type="submit" variant="outline" size="icon" aria-label="Adicionar interesse" disabled={!keyword.trim()}>
              <Plus className="size-4" />
            </Button>
          </form>
        </section>

        <section className="space-y-1">
          <p className="label-mono">tópicos</p>
          {topics.map((topic) => {
            const muted = prefs.mutedTopics.includes(topic);
            return (
              <label key={topic} className="flex h-11 items-center justify-between gap-3 text-sm">
                <span className={cn(muted && "text-muted-foreground line-through")}>{topic}</span>
                <Switch
                  checked={!muted}
                  onCheckedChange={(on) =>
                    persist({ ...prefs, mutedTopics: on ? prefs.mutedTopics.filter((t) => t !== topic) : [...prefs.mutedTopics, topic] })
                  }
                />
              </label>
            );
          })}
        </section>

        <FeedsSection feeds={feeds} topics={topics} />
      </SheetContent>
    </Sheet>
  );
}

function FeedsSection({ feeds, topics }: { feeds: NewsFeed[]; topics: string[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ url: "", name: "", topic: topics[0] ?? "Dev" });

  function act(task: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error ?? "Não foi possível salvar.");
      else if (success) toast.success(success);
    });
  }

  return (
    <section className="space-y-2">
      <p className="label-mono">fontes · {feeds.filter((f) => f.enabled).length} ativas</p>
      <ul className="divide-y divide-white/5">
        {feeds.map((feed) => (
          <li key={feed.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm", !feed.enabled && "text-muted-foreground")}>{feed.name}</p>
              <p className="flex items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground">
                {feed.last_error ? (
                  <span className="flex items-center gap-1 text-amber-200" title={feed.last_error}>
                    <AlertTriangle className="size-3" /> falhou
                  </span>
                ) : feed.last_fetched_at ? (
                  <TimeAgo date={feed.last_fetched_at} />
                ) : (
                  "aguardando"
                )}
                · {feed.topic} · {hostname(feed.url)}
              </p>
            </div>
            <Switch checked={feed.enabled} onCheckedChange={(on) => act(() => setNewsFeedEnabledAction(feed.id, on))} aria-label={`Ativar ${feed.name}`} />
            <button
              type="button"
              aria-label={`Remover ${feed.name}`}
              onClick={() => {
                if (confirm(`Remover a fonte "${feed.name}" e as notícias dela?`)) act(() => removeNewsFeedAction(feed.id), "Fonte removida");
              }}
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:text-red-300"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <form
        className="space-y-2 rounded-xl border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            const result = await addNewsFeedAction(form);
            if (result.ok) setForm({ ...form, url: "", name: "" });
            return result;
          }, "Fonte adicionada");
        }}
      >
        <p className="text-sm font-medium">Adicionar fonte RSS</p>
        <Input
          type="url"
          required
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="https://site.com/feed"
          className="text-base sm:text-sm"
        />
        <div className="flex gap-2">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" maxLength={80} className="text-base sm:text-sm" />
          <Input
            required
            list="news-topics"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Tópico"
            maxLength={60}
            className="w-36 text-base sm:text-sm"
          />
          <datalist id="news-topics">
            {topics.map((topic) => (
              <option key={topic} value={topic} />
            ))}
          </datalist>
        </div>
        <Button type="submit" size="sm" className="w-full" disabled={pending}>
          {pending ? "Verificando a fonte…" : "Adicionar"}
        </Button>
      </form>
    </section>
  );
}
