import { cn } from "cn";
import type { Source } from "@/lib/central/schemas";
import { SOURCE_COLOR, SOURCE_LABEL } from "./labels";

export function SourceDot({ source, live, className }: { source: Source; live?: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", live && "live-dot", className)}
      style={{ background: SOURCE_COLOR[source], color: SOURCE_COLOR[source] }}
    />
  );
}

export function SourceBadge({ source, className }: { source: Source; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-wide uppercase",
        className,
      )}
      style={{
        color: SOURCE_COLOR[source],
        borderColor: `color-mix(in srgb, ${SOURCE_COLOR[source]} 35%, transparent)`,
        background: `color-mix(in srgb, ${SOURCE_COLOR[source]} 10%, transparent)`,
      }}
    >
      <SourceDot source={source} />
      {SOURCE_LABEL[source]}
    </span>
  );
}
