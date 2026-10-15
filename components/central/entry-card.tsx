import { cn } from "cn";
import { Bell, CalendarDays, CheckSquare, ExternalLink, MapPin, Pin, Repeat } from "lucide-react";
import Link from "next/link";
import type { Entry } from "@/lib/central/types";
import { formatDateTime } from "./dates";
import { TYPE_LABEL } from "./labels";
import { SourceBadge } from "./source-badge";
import { TimeAgo } from "./time-ago";

export function EntryCard({ entry, showArea = true, className, children }: {
  entry: Entry;
  showArea?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const excerpt = entry.content_md.replace(/[#*_`>\[\]]/g, "").trim();

  return (
    <article
      id={entry.id}
      data-entry-id={entry.id}
      className={cn("glass glass-hover rounded-xl p-4", entry.archived && "opacity-60", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge source={entry.source} />
        <span className="label-mono">{TYPE_LABEL[entry.type]}</span>
        {showArea && (
          <Link href={`/areas/${entry.area.slug}`} className="font-mono text-[11px] text-lilac/90 hover:text-lilac">
            /{entry.area.slug}
          </Link>
        )}
        {entry.pinned && <Pin className="size-3.5 text-lilac" aria-label="Fixado" />}
        <TimeAgo date={entry.created_at} className="ml-auto font-mono text-[11px] text-muted-foreground" />
      </div>
      <h3 className={cn("mt-2.5 font-medium leading-snug", entry.done_at && "text-muted-foreground line-through")}>
        {entry.title}
      </h3>
      <ScheduleLine entry={entry} />
      {excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>}
      {entry.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      )}
      <EntryImages entry={entry} />
      {entry.links?.some((link) => link.imagem !== link.url) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.links.filter((link) => link.imagem !== link.url).map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-0.5 text-xs text-lilac hover:border-primary/40"
            >
              <ExternalLink className="size-3 shrink-0" />
              <span className="truncate">{link.titulo ?? link.url}</span>
            </a>
          ))}
        </div>
      )}
      {children}
    </article>
  );
}

/** The entry's highlight image plus any attached images, as a small gallery. */
function EntryImages({ entry }: { entry: Entry }) {
  const images = [...new Set([entry.image_url, ...(entry.links ?? []).map((link) => link.imagem)].filter((url): url is string => !!url))];
  if (!images.length) return null;
  return (
    <div className={images.length === 1 ? "mt-3" : "mt-3 grid grid-cols-3 gap-2"}>
      {images.slice(0, 9).map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote or signed storage links */}
          <img src={url} alt="" loading="lazy" className={images.length === 1 ? "max-h-80 w-full object-cover" : "aspect-square w-full object-cover"} />
        </a>
      ))}
    </div>
  );
}

function ScheduleLine({ entry }: { entry: Entry }) {
  const parts: React.ReactNode[] = [];
  if (entry.starts_at) {
    parts.push(
      <span key="start" className="flex items-center gap-1">
        <CalendarDays className="size-3" />
        {entry.all_day ? formatDateTime(entry.starts_at).split(",")[0] : formatDateTime(entry.starts_at)}
        {entry.recurrence && <Repeat className="size-3" aria-label="Repete" />}
      </span>,
    );
  }
  if (entry.location) {
    parts.push(
      <span key="location" className="flex items-center gap-1">
        <MapPin className="size-3" /> {entry.location}
      </span>,
    );
  }
  if (entry.due_at) {
    parts.push(
      <span key="due" className="flex items-center gap-1">
        <CheckSquare className="size-3" /> {entry.done_at ? "concluída" : `prazo ${formatDateTime(entry.due_at)}`}
      </span>,
    );
  }
  if (entry.remind_at && !entry.reminded_at) {
    parts.push(
      <span key="remind" className="flex items-center gap-1">
        <Bell className="size-3" /> {formatDateTime(entry.remind_at)}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">{parts}</div>;
}
