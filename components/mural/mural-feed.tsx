"use client";

import { cn } from "cn";
import { ExternalLink, Newspaper } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SOURCE_COLOR, SOURCE_PERSONA } from "@/components/central/labels";
import { Markdown } from "@/components/central/markdown";
import { TimeAgo } from "@/components/central/time-ago";
import { useCentral, useLiveEvents } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { SOURCES, type Source } from "@/lib/central/schemas";
import type { Entry } from "@/lib/central/types";

const COLLAPSED_CHARS = 420;

export function MuralFeed({ initial }: { initial: Entry[] }) {
  const { openQuickEntry } = useCentral();
  const [live, setLive] = useState<Entry[]>([]);
  const [source, setSource] = useState<Source | null>(null);

  useLiveEvents((event) => {
    if (event.kind === "area-change" || event.entry.type !== "post") return;
    setLive((current) => [event.entry, ...current.filter((post) => post.id !== event.entry.id)]);
  });

  const posts = useMemo(() => {
    const byId = new Map<string, Entry>();
    for (const post of [...live, ...initial]) if (!byId.has(post.id)) byId.set(post.id, post);
    return [...byId.values()]
      .filter((post) => !post.archived && (!source || post.source === source))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [live, initial, source]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={!source} onClick={() => setSource(null)}>Todos</Chip>
        {SOURCES.map((value) => (
          <Chip key={value} active={source === value} onClick={() => setSource(value)} color={SOURCE_COLOR[value]}>
            {SOURCE_PERSONA[value].name}
          </Chip>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => openQuickEntry({ type: "post", areaSlug: "noticias" })}>
          Publicar
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <Newspaper className="size-6 text-lilac" />
          <p className="text-sm text-muted-foreground">
            O Mural recebe o que as tarefas agendadas da Vega e do Nox encontram: notícias, vagas, achados e resumos. Veja os prompts prontos no guia.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          <AnimatePresence initial={false}>
            {posts.map((post) => (
              <motion.li
                key={post.id}
                layout="position"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <PostCard post={post} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}

function PostCard({ post }: { post: Entry }) {
  const [expanded, setExpanded] = useState(false);
  const persona = SOURCE_PERSONA[post.source];
  const color = SOURCE_COLOR[post.source];
  const long = post.content_md.length > COLLAPSED_CHARS;

  return (
    <article data-entry-id={post.id} className="glass rounded-2xl p-4">
      <header className="flex items-center gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full font-mono text-sm font-semibold"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)` }}
        >
          {persona.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">{persona.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {persona.handle} ·{" "}
            <Link href={`/areas/${post.area.slug}`} className="hover:text-lilac">
              /{post.area.slug}
            </Link>{" "}
            · <TimeAgo date={post.created_at} />
          </p>
        </div>
      </header>

      <h3 className="mt-3 font-medium leading-snug"><Link href={`/registros/${post.id}`} className="hover:text-lilac">{post.title}</Link></h3>
      {post.content_md && (
        <div className={cn("relative mt-1", long && !expanded && "max-h-48 overflow-hidden")}>
          <Markdown className="text-[14px]">{post.content_md}</Markdown>
          {long && !expanded && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--card)] to-transparent" />}
        </div>
      )}
      {long && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-lilac hover:underline">
          {expanded ? "Mostrar menos" : "Ler tudo"}
        </button>
      )}

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- remote images from any source; next/image would need every domain whitelisted
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="mt-3 max-h-80 w-full rounded-xl border object-cover"
        />
      )}

      {post.links.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {post.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border bg-white/[0.02] p-2.5 transition-colors duration-150 hover:border-primary/40"
            >
              {link.imagem && (
                // eslint-disable-next-line @next/next/no-img-element -- see above
                <img src={link.imagem} alt="" loading="lazy" className="size-12 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{link.titulo ?? link.url}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{hostname(link.url)}</p>
              </div>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick(): void; color?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground",
        active && "border-primary/50 bg-primary/15 text-foreground",
      )}
    >
      {color && <span className="size-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}
