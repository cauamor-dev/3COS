"use client";

import { cn } from "cn";
import { ExternalLink, Loader2, Maximize2, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type ForceGraph from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { getAreaAction, getEntryAction } from "@/app/(app)/actions";
import { KIND_LABEL, SOURCE_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/components/central/labels";
import { Markdown } from "@/components/central/markdown";
import { SourceBadge } from "@/components/central/source-badge";
import { TimeAgo } from "@/components/central/time-ago";
import { useCentral, useLiveEvents } from "@/components/providers/central-provider";
import { useMotionPreference } from "@/components/providers/motion-provider";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AREA_STATUSES, ENTRY_TYPES, SOURCES, type Source } from "@/lib/central/schemas";
import type { Area, Entry } from "@/lib/central/types";
import { buildGraph, recency, toGraphEntry, type BrainFilters, type BrainLink, type BrainNode, type GraphEntry } from "./graph-data";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <Loader2 className="size-5 animate-spin text-lilac" />
    </div>
  ),
}) as typeof ForceGraph;

const CANVAS_COLOR: Record<Source, string> = {
  claude: "#eda574",
  chatgpt: "#6fd8a6",
  manual: "#a78bfa",
  cursor: "#7cc4ec",
};
const AREA_COLOR = "#8b5cf6";

type Selected = { kind: "area"; area: Area } | { kind: "entry"; entry: Entry } | { kind: "loading" };

export function BrainView({ initialEntries }: { initialEntries: GraphEntry[] }) {
  const { areas } = useCentral();
  const { enabled: motionEnabled } = useMotionPreference();
  const graphRef = useRef<ForceGraphMethods<BrainNode, BrainLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [liveEntries, setLiveEntries] = useState<GraphEntry[]>([]);
  const [filters, setFilters] = useState<BrainFilters>({ source: "todas", type: "todos", period: "tudo", status: "todos" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pulse, setPulse] = useState<{ nodes: Set<string>; until: number }>({ nodes: new Set(), until: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const entries = useMemo(() => {
    const byId = new Map<string, GraphEntry>();
    for (const entry of [...liveEntries, ...initialEntries]) if (!byId.has(entry.id)) byId.set(entry.id, entry);
    return [...byId.values()];
  }, [liveEntries, initialEntries]);

  const graphData = useMemo(() => buildGraph(areas, entries, filters), [areas, entries, filters]);
  const graphDataRef = useRef(graphData);
  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    return new Set(graphData.nodes.filter((node) => node.label.toLowerCase().includes(term)).map((node) => node.id));
  }, [graphData.nodes, query]);

  useLiveEvents((event) => {
    if (event.kind !== "entry-insert") return;
    const entry = toGraphEntry(event.entry);
    setLiveEntries((current) => [entry, ...current.filter((e) => e.id !== entry.id)]);
    setPulse({ nodes: new Set([`e:${entry.id}`, `a:${entry.area_id}`]), until: Date.now() + 6000 });
    if (!motionEnabled) return;
    setTimeout(() => {
      const link = graphDataRef.current.links.find((l) => l.id === `l:${entry.id}`);
      if (link) for (let i = 0; i < 4; i++) setTimeout(() => graphRef.current?.emitParticle(link), i * 180);
    }, 400);
  });

  const openNode = useCallback(async (node: BrainNode) => {
    setSelected({ kind: "loading" });
    if (node.kind === "area") {
      const result = await getAreaAction(node.slug!);
      setSelected(result.ok ? { kind: "area", area: result.data } : null);
    } else {
      const result = await getEntryAction(node.refId);
      setSelected(result.ok ? { kind: "entry", entry: result.data } : null);
    }
  }, []);

  const drawNode = useCallback(
    (node: BrainNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const glow = Math.max(recency(node.activityAt), pulse.until > Date.now() && pulse.nodes.has(node.id) ? 1 : 0);
      const dimmed = matches !== null && !matches.has(node.id);
      const color = node.kind === "area" ? AREA_COLOR : CANVAS_COLOR[node.source];
      const radius = node.weight;

      ctx.globalAlpha = dimmed ? 0.15 : 1;
      if (glow > 0.05 && !dimmed) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + glow * 22;
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.kind === "area" ? "#1a1430" : color;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (node.kind === "area") {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.38, 0, 2 * Math.PI);
        ctx.fillStyle = CANVAS_COLOR[node.source];
        ctx.fill();
      }

      if (matches?.has(node.id)) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = "#f5f3ff";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      const showLabel = node.kind === "area" || scale > 2.6 || matches?.has(node.id);
      if (showLabel && !dimmed) {
        const fontSize = (node.kind === "area" ? 13 : 11) / Math.max(scale, 0.8);
        ctx.font = `${node.kind === "area" ? 600 : 400} ${fontSize}px "IBM Plex Sans", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = node.kind === "area" ? "rgba(245,243,255,0.92)" : "rgba(200,196,220,0.85)";
        const label = node.label.length > 32 ? `${node.label.slice(0, 31)}…` : node.label;
        ctx.fillText(label, x, y + radius + 3 / scale);
      }
      ctx.globalAlpha = 1;
    },
    [matches, pulse],
  );

  const now = useNow();
  const recentLinkCutoff = now === null ? Infinity : now - 60 * 60 * 1000;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex min-w-48 flex-1 items-center gap-2 rounded-lg px-2.5">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Destacar nós…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Destacar nós"
          />
          {matches && <span className="font-mono text-[11px] text-muted-foreground">{matches.size}</span>}
        </div>
        <FilterSelect
          value={filters.source}
          onChange={(source) => setFilters((f) => ({ ...f, source: source as BrainFilters["source"] }))}
          options={[["todas", "Todas as fontes"], ...SOURCES.map((s) => [s, SOURCE_LABEL[s]] as [string, string])]}
          label="Fonte"
        />
        <FilterSelect
          value={filters.type}
          onChange={(type) => setFilters((f) => ({ ...f, type: type as BrainFilters["type"] }))}
          options={[["todos", "Todos os tipos"], ...ENTRY_TYPES.map((t) => [t, TYPE_LABEL[t]] as [string, string])]}
          label="Tipo"
        />
        <FilterSelect
          value={filters.period}
          onChange={(period) => setFilters((f) => ({ ...f, period: period as BrainFilters["period"] }))}
          options={[["tudo", "Todo o período"], ["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"]]}
          label="Período"
        />
        <FilterSelect
          value={filters.status}
          onChange={(status) => setFilters((f) => ({ ...f, status: status as BrainFilters["status"] }))}
          options={[["todos", "Todos os status"], ...AREA_STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string])]}
          label="Status"
        />
        <Button variant="outline" size="icon-sm" onClick={() => graphRef.current?.zoomToFit(500, 50)} aria-label="Enquadrar grafo">
          <Maximize2 />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="glass relative h-[calc(100dvh-16rem)] min-h-[420px] overflow-hidden rounded-2xl md:h-[calc(100dvh-13rem)]"
      >
        {size.width > 0 && (
          <ForceGraph2D<BrainNode, BrainLink>
            ref={graphRef}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            nodeRelSize={1}
            nodeVal={(node) => node.weight * node.weight}
            nodeLabel={(node) => node.label}
            nodeCanvasObject={drawNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, node.weight + 4, 0, 2 * Math.PI);
              ctx.fill();
            }}
            linkColor={(link) => (link.kind === "tag" ? "rgba(196,181,253,0.12)" : "rgba(139,92,246,0.22)")}
            linkWidth={(link) => (link.kind === "tag" ? 0.6 : 1)}
            linkLineDash={(link) => (link.kind === "tag" ? [2, 3] : null)}
            linkDirectionalParticles={(link) => (motionEnabled && new Date(link.createdAt).getTime() > recentLinkCutoff ? 2 : 0)}
            linkDirectionalParticleWidth={2.2}
            linkDirectionalParticleSpeed={0.008}
            linkDirectionalParticleColor={(link) => CANVAS_COLOR[(typeof link.source === "object" ? link.source.source : "manual") as Source]}
            cooldownTicks={120}
            warmupTicks={motionEnabled ? 0 : 80}
            d3VelocityDecay={0.3}
            onEngineStop={() => {
              if (!fitted.current) {
                fitted.current = true;
                graphRef.current?.zoomToFit(400, 48);
              }
            }}
            onNodeClick={(node) => openNode(node)}
            enableNodeDrag={size.width > 768}
            minZoom={0.3}
            maxZoom={8}
          />
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-black/40 px-3 py-2 font-mono text-[10.5px] text-muted-foreground backdrop-blur">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-primary bg-[#1a1430]" /> área</span>
          {SOURCES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: CANVAS_COLOR[s] }} /> {SOURCE_LABEL[s]}
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute top-3 right-3 font-mono text-[11px] text-muted-foreground">
          {graphData.nodes.length} nós · {graphData.links.length} ligações
        </div>
      </div>

      <NodePanel selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }: {
  value: string;
  onChange(value: string): void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className="glass">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NodePanel({ selected, onClose }: { selected: Selected | null; onClose(): void }) {
  return (
    <Sheet open={selected !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className={cn("w-full overflow-y-auto border-l bg-background/95 backdrop-blur-xl sm:max-w-md")}>
        {selected?.kind === "loading" && (
          <>
            <SheetHeader>
              <SheetTitle>Carregando…</SheetTitle>
              <SheetDescription className="sr-only">Carregando o conteúdo do nó</SheetDescription>
            </SheetHeader>
            <Loader2 className="mx-auto mt-10 size-5 animate-spin text-lilac" />
          </>
        )}
        {selected?.kind === "area" && (
          <>
            <SheetHeader>
              <p className="label-mono text-lilac">
                {KIND_LABEL[selected.area.kind]} · {STATUS_LABEL[selected.area.status]}
              </p>
              <SheetTitle className="text-xl">{selected.area.name}</SheetTitle>
              <SheetDescription className="font-mono text-[11px]">
                /{selected.area.slug} · {SOURCE_LABEL[selected.area.updated_by]} · <TimeAgo date={selected.area.updated_at} />
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <Markdown>{selected.area.summary_md || "_Sem resumo ainda._"}</Markdown>
              <Button asChild className="mt-6 w-full">
                <Link href={`/areas/${selected.area.slug}`}>
                  Abrir área <ExternalLink />
                </Link>
              </Button>
            </div>
          </>
        )}
        {selected?.kind === "entry" && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={selected.entry.source} />
                <span className="label-mono">{TYPE_LABEL[selected.entry.type]}</span>
              </div>
              <SheetTitle className="text-lg">{selected.entry.title}</SheetTitle>
              <SheetDescription className="font-mono text-[11px]">
                /{selected.entry.area.slug} · <TimeAgo date={selected.entry.created_at} />
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <Markdown>{selected.entry.content_md || "_Sem conteúdo._"}</Markdown>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link href={`/areas/${selected.entry.area.slug}#${selected.entry.id}`}>
                  Ver na área <ExternalLink />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
