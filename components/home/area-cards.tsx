"use client";

import { cn } from "cn";
import Link from "next/link";
import { KIND_LABEL } from "@/components/central/labels";
import { SourceDot } from "@/components/central/source-badge";
import { TimeAgo } from "@/components/central/time-ago";
import { useCentral } from "@/components/providers/central-provider";
import { useNow } from "@/hooks/use-now";

const RECENT_MS = 6 * 60 * 60 * 1000;

export function AreaCards() {
  const { areas } = useCentral();
  const now = useNow();
  const active = areas
    .filter((area) => area.status === "ativo" && area.kind !== "perfil" && area.slug !== "inbox")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 9);

  if (active.length === 0) {
    return (
      <p className="glass rounded-xl p-5 text-sm text-muted-foreground">
        Nenhuma área ativa ainda. Peça ao Claude ou ChatGPT para salvar o contexto de um projeto, ou crie uma em{" "}
        <Link href="/areas" className="text-lilac underline underline-offset-4">Áreas</Link>.
      </p>
    );
  }

  const newest = active[0];
  const highlight = now !== null && now - new Date(newest.updated_at).getTime() < RECENT_MS;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {active.map((area) => (
        <Link
          key={area.id}
          href={`/areas/${area.slug}`}
          className={cn(
            "glass glass-hover group flex flex-col rounded-xl p-4",
            highlight && area.id === newest.id && "border-beam",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="label-mono">{KIND_LABEL[area.kind]}</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <SourceDot source={area.updated_by} />
              <TimeAgo date={area.updated_at} />
            </span>
          </div>
          <h3 className="mt-2 font-medium group-hover:text-lilac">{area.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {area.summary_md.replace(/[#*_`>]/g, "").trim() || "Sem resumo ainda."}
          </p>
        </Link>
      ))}
    </div>
  );
}
