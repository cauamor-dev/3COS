"use client";

import { cn } from "cn";
import { Loader2, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { restoreVersionAction } from "@/app/(app)/actions";
import { Markdown } from "@/components/central/markdown";
import { SourceBadge } from "@/components/central/source-badge";
import { TimeAgo } from "@/components/central/time-ago";
import { Button } from "@/components/ui/button";
import type { Version } from "@/lib/central/types";

export function VersionList({ current, versions }: { current: { title: string | null; content: string }; versions: Version[] }) {
  const [selected, setSelected] = useState<string | null>(versions[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const version = versions.find((v) => v.id === selected);

  function restore(id: string) {
    startTransition(async () => {
      const result = await restoreVersionAction(id);
      if (result.ok) toast.success("Versão restaurada. O conteúdo anterior também foi para o histórico.");
      else toast.error(result.error);
    });
  }

  if (versions.length === 0) {
    return <p className="glass rounded-xl p-5 text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <ol className="glass h-fit divide-y divide-white/5 overflow-hidden rounded-xl">
        {versions.map((v, index) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => setSelected(v.id)}
              className={cn(
                "flex w-full flex-col items-start gap-1.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-white/[0.04]",
                selected === v.id && "bg-primary/10",
              )}
            >
              <span className="flex w-full items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">v{versions.length - index}</span>
                <TimeAgo date={v.created_at} className="ml-auto font-mono text-[11px] text-muted-foreground" />
              </span>
              <span className="text-xs text-muted-foreground">
                substituída por <SourceBadge source={v.source} className="ml-1" />
              </span>
            </button>
          </li>
        ))}
      </ol>

      {version && (
        <div className="space-y-4">
          <section className="glass rounded-xl p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="label-mono mr-auto text-lilac">conteúdo desta versão</h2>
              <Button size="sm" onClick={() => restore(version.id)} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restaurar esta versão
              </Button>
            </div>
            {version.previous_title && <p className="mb-2 font-medium">{version.previous_title}</p>}
            <Markdown>{version.previous_content || "_Vazio_"}</Markdown>
          </section>
          <section className="rounded-xl border border-dashed p-5 opacity-80">
            <h2 className="label-mono mb-3">atual</h2>
            {current.title && <p className="mb-2 font-medium">{current.title}</p>}
            <Markdown>{current.content || "_Vazio_"}</Markdown>
          </section>
        </div>
      )}
    </div>
  );
}
