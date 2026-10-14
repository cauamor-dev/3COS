import type { AreaStatus, EntryType, Source } from "@/lib/central/schemas";
import type { Area, Entry } from "@/lib/central/types";

export interface GraphEntry {
  id: string;
  area_id: string;
  title: string;
  excerpt: string;
  type: EntryType;
  source: Source;
  tags: string[];
  created_at: string;
}

export interface BrainNode {
  id: string;
  kind: "area" | "entry";
  label: string;
  source: Source;
  activityAt: string;
  slug?: string;
  status?: AreaStatus;
  type?: EntryType;
  refId: string;
  weight: number;
  x?: number;
  y?: number;
}

export interface BrainLink {
  id: string;
  kind: "area" | "tag";
  source: string | BrainNode;
  target: string | BrainNode;
  createdAt: string;
}

export interface BrainFilters {
  source: Source | "todas";
  type: EntryType | "todos";
  period: "7" | "30" | "90" | "tudo";
  status: AreaStatus | "todos";
}

export function toGraphEntry(entry: Entry): GraphEntry {
  return {
    id: entry.id,
    area_id: entry.area_id,
    title: entry.title,
    excerpt: entry.content_md.slice(0, 160),
    type: entry.type,
    source: entry.source,
    tags: entry.tags,
    created_at: entry.created_at,
  };
}

const DAY = 86_400_000;
const MAX_TAG_GROUP = 25;

export function buildGraph(areas: Area[], entries: GraphEntry[], filters: BrainFilters, now = Date.now()) {
  const visibleAreas = areas.filter((area) => filters.status === "todos" || area.status === filters.status);
  const areaIds = new Set(visibleAreas.map((area) => area.id));
  const since = filters.period === "tudo" ? 0 : now - Number(filters.period) * DAY;

  const visibleEntries = entries.filter(
    (entry) =>
      areaIds.has(entry.area_id) &&
      (filters.source === "todas" || entry.source === filters.source) &&
      (filters.type === "todos" || entry.type === filters.type) &&
      new Date(entry.created_at).getTime() >= since,
  );

  const countByArea = new Map<string, number>();
  for (const entry of visibleEntries) countByArea.set(entry.area_id, (countByArea.get(entry.area_id) ?? 0) + 1);

  const nodes: BrainNode[] = [
    ...visibleAreas.map((area) => ({
      id: `a:${area.id}`,
      kind: "area" as const,
      label: area.name,
      source: area.updated_by,
      activityAt: area.updated_at,
      slug: area.slug,
      status: area.status,
      refId: area.id,
      weight: 7 + Math.min(countByArea.get(area.id) ?? 0, 30) * 0.35,
    })),
    ...visibleEntries.map((entry) => ({
      id: `e:${entry.id}`,
      kind: "entry" as const,
      label: entry.title,
      source: entry.source,
      activityAt: entry.created_at,
      type: entry.type,
      refId: entry.id,
      weight: 2.4,
    })),
  ];

  const links: BrainLink[] = visibleEntries.map((entry) => ({
    id: `l:${entry.id}`,
    kind: "area",
    source: `e:${entry.id}`,
    target: `a:${entry.area_id}`,
    createdAt: entry.created_at,
  }));

  // Chain entries that share a tag (oldest to newest) instead of linking every pair.
  const byTag = new Map<string, GraphEntry[]>();
  for (const entry of visibleEntries) {
    for (const tag of entry.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), entry]);
  }
  const seen = new Set<string>();
  for (const [tag, group] of byTag) {
    const sorted = group.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-MAX_TAG_GROUP);
    for (let i = 1; i < sorted.length; i++) {
      const pair = [sorted[i - 1].id, sorted[i].id].sort().join("|");
      if (seen.has(pair)) continue;
      seen.add(pair);
      links.push({
        id: `t:${tag}:${pair}`,
        kind: "tag",
        source: `e:${sorted[i - 1].id}`,
        target: `e:${sorted[i].id}`,
        createdAt: sorted[i].created_at,
      });
    }
  }

  return { nodes, links };
}

export function recency(dateIso: string, now = Date.now()) {
  const ageHours = (now - new Date(dateIso).getTime()) / 3_600_000;
  return Math.exp(-ageHours / 48);
}
