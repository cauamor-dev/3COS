import { cn } from "cn";
import { Pin } from "lucide-react";
import Link from "next/link";
import type { Entry } from "@/lib/central/types";
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
      <h3 className="mt-2.5 font-medium leading-snug">{entry.title}</h3>
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
      {children}
    </article>
  );
}
