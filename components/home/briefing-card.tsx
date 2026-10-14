"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { SOURCE_LABEL } from "@/components/central/labels";
import { SourceDot } from "@/components/central/source-badge";
import { formatRelative } from "@/components/central/time-ago";
import type { Source } from "@/lib/central/schemas";
import type { Entry } from "@/lib/central/types";
import { useNow } from "@/hooks/use-now";

const LAST_VISIT_KEY = "c3c-last-visit";
const DAY = 24 * 60 * 60 * 1000;

// Read once per page load so the timestamp written below doesn't hide what changed.
let previousVisit: string | null | undefined;
function readPreviousVisit() {
  if (previousVisit === undefined) {
    try {
      previousVisit = localStorage.getItem(LAST_VISIT_KEY);
    } catch {
      previousVisit = null;
    }
  }
  return previousVisit;
}

const noopSubscribe = () => () => {};

export function BriefingCard({ recent }: { recent: Entry[] }) {
  const lastVisit = useSyncExternalStore(noopSubscribe, readPreviousVisit, () => undefined);
  const now = useNow();

  useEffect(() => {
    readPreviousVisit();
    try {
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    } catch {}
  }, []);

  const since = lastVisit ?? new Date((now ?? 0) - DAY).toISOString();
  const fresh = recent.filter((entry) => entry.created_at > since && entry.source !== "manual");
  const bySource = fresh.reduce<Partial<Record<Source, number>>>((acc, entry) => {
    acc[entry.source] = (acc[entry.source] ?? 0) + 1;
    return acc;
  }, {});
  const touchedAreas = [...new Map(fresh.map((entry) => [entry.area.slug, entry.area])).values()];

  return (
    <section className="glass border-beam rounded-2xl p-5 md:p-6">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-lilac" />
        <h2 className="label-mono text-lilac">
          briefing · {lastVisit ? `desde ${formatRelative(lastVisit)}` : "últimas 24 h"}
        </h2>
      </div>

      {lastVisit === undefined ? (
        <div className="mt-4 h-14 animate-pulse rounded-lg bg-white/5" />
      ) : fresh.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted-foreground">
          Nada novo das IAs desde a sua última visita. Quando Claude ou ChatGPT gravarem algo, aparece aqui na hora.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xl font-medium tracking-tight md:text-2xl">
            <span className="text-gradient">
              {fresh.length} {fresh.length === 1 ? "registro novo" : "registros novos"}
            </span>{" "}
            em {touchedAreas.length} {touchedAreas.length === 1 ? "área" : "áreas"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {(Object.entries(bySource) as [Source, number][]).map(([source, count]) => (
              <span key={source} className="flex items-center gap-1.5">
                <SourceDot source={source} /> {SOURCE_LABEL[source]} · <span className="font-mono">{count}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {touchedAreas.slice(0, 6).map((area) => (
              <Link
                key={area.slug}
                href={`/areas/${area.slug}`}
                className="rounded-lg border bg-white/[0.03] px-2.5 py-1 text-sm transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10"
              >
                {area.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
