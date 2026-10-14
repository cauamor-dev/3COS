"use client";

import { cn } from "cn";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { EntryCard } from "@/components/central/entry-card";
import { SOURCE_COLOR, SOURCE_LABEL } from "@/components/central/labels";
import { useCentral, useLiveEvents } from "@/components/providers/central-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCES, type Source } from "@/lib/central/schemas";
import type { Entry } from "@/lib/central/types";

const ALL = "todas";

export function LiveFeed({ initial }: { initial: Entry[] }) {
  const { areas, live } = useCentral();
  const [liveEntries, setLiveEntries] = useState<Entry[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [area, setArea] = useState(ALL);

  useLiveEvents((event) => {
    if (event.kind === "area-change") return;
    setLiveEntries((current) => [event.entry, ...current.filter((e) => e.id !== event.entry.id)]);
  });

  const entries = useMemo(() => {
    const byId = new Map<string, Entry>();
    for (const entry of [...liveEntries, ...initial]) if (!byId.has(entry.id)) byId.set(entry.id, entry);
    return [...byId.values()]
      .filter((entry) => !entry.archived)
      .filter((entry) => !source || entry.source === source)
      .filter((entry) => area === ALL || entry.area.slug === area)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 60);
  }, [liveEntries, initial, source, area]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-sm font-medium">
          <span
            data-signal-origin
            className={cn("size-2 rounded-full", live ? "live-dot bg-emerald-400 text-emerald-400" : "bg-zinc-500")}
          />
          Feed ao vivo
        </h2>
        <div className="flex gap-1 overflow-x-auto">
          <FilterChip active={!source} onClick={() => setSource(null)}>Todas</FilterChip>
          {SOURCES.map((value) => (
            <FilterChip key={value} active={source === value} onClick={() => setSource(value)} color={SOURCE_COLOR[value]}>
              {SOURCE_LABEL[value]}
            </FilterChip>
          ))}
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger size="sm" className="w-40" aria-label="Filtrar por área">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.slug}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entries.length === 0 ? (
        <p className="glass rounded-xl p-5 text-sm text-muted-foreground">Nenhum registro com esses filtros.</p>
      ) : (
        <ol className="space-y-2.5">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout="position"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <EntryCard entry={entry} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

function FilterChip({ active, onClick, color, children }: {
  active: boolean;
  onClick(): void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground",
        active && "border-primary/50 bg-primary/15 text-foreground",
      )}
    >
      {color && <span className="size-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}
