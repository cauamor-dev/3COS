import { notFound } from "./errors";
import type {
  Area,
  AreaFilter,
  AreaPatch,
  CentralRepository,
  Entry,
  EntryFilter,
  EntryPatch,
  NewArea,
  NewEntry,
  NewVersion,
  Page,
  ScheduleFields,
  SearchFilter,
  TaskFilter,
  Version,
} from "./types";

const EMPTY_SCHEDULE: ScheduleFields = {
  starts_at: null,
  ends_at: null,
  all_day: false,
  location: null,
  recurrence: null,
  due_at: null,
  done_at: null,
  remind_at: null,
  reminded_at: null,
  links: [],
  image_url: null,
};
import type { Source } from "./schemas";

type StoredEntry = Omit<Entry, "area">;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export class MemoryRepository implements CentralRepository {
  areas: Area[] = [];
  entries: StoredEntry[] = [];
  versions: Version[] = [];
  private clock = Date.now() - 60 * 60 * 1000;

  private now() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  private withArea(entry: StoredEntry): Entry {
    const area = this.areas.find((a) => a.id === entry.area_id);
    if (!area) throw notFound("Área");
    return { ...entry, area: { slug: area.slug, name: area.name } };
  }

  private page<T>(items: T[], limit: number, offset: number): Page<T> {
    return { items: items.slice(offset, offset + limit), total: items.length };
  }

  async listAreas(filter: AreaFilter) {
    const items = this.areas
      .filter((a) => !filter.statuses || filter.statuses.includes(a.status))
      .filter((a) => !filter.kind || a.kind === filter.kind)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return this.page(items, filter.limit, filter.offset);
  }

  async findAreaBySlug(slug: string) {
    return this.areas.find((a) => a.slug === slug) ?? null;
  }

  async findAreaById(id: string) {
    return this.areas.find((a) => a.id === id) ?? null;
  }

  async insertArea(area: NewArea) {
    const now = this.now();
    const created: Area = { ...area, id: crypto.randomUUID(), created_at: now, updated_at: now };
    this.areas.push(created);
    return created;
  }

  async updateArea(id: string, { touch: _touch, ...patch }: AreaPatch) {
    const area = this.areas.find((a) => a.id === id);
    if (!area) throw notFound("Área");
    Object.assign(area, patch, { updated_at: this.now() });
    return { ...area };
  }

  private filterEntries(filter: Omit<EntryFilter, "limit" | "offset">) {
    return this.entries
      .filter((e) => !filter.areaId || e.area_id === filter.areaId)
      .filter((e) => !filter.source || e.source === filter.source)
      .filter((e) => !filter.type || e.type === filter.type)
      .filter((e) => filter.includeArchived || !e.archived)
      .filter((e) => !filter.since || e.created_at >= filter.since)
      .filter((e) => !filter.before || e.created_at < filter.before)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listEntries(filter: EntryFilter) {
    const page = this.page(this.filterEntries(filter), filter.limit, filter.offset);
    return { items: page.items.map((e) => this.withArea(e)), total: page.total };
  }

  async findEntryById(id: string) {
    const entry = this.entries.find((e) => e.id === id);
    return entry ? this.withArea(entry) : null;
  }

  async insertEntry(entry: NewEntry) {
    const now = this.now();
    const created: StoredEntry = {
      ...EMPTY_SCHEDULE,
      ...entry,
      id: crypto.randomUUID(),
      updated_by: entry.source,
      archived: false,
      created_at: now,
      updated_at: now,
    };
    this.entries.push(created);
    return this.withArea(created);
  }

  async updateEntry(id: string, patch: EntryPatch) {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw notFound("Registro");
    Object.assign(entry, patch, { updated_at: this.now() });
    return this.withArea(entry);
  }

  async searchEntries(filter: SearchFilter) {
    const terms = normalize(filter.query).split(/\s+/).filter(Boolean);
    const scored = this.entries
      .filter((e) => !e.archived)
      .filter((e) => !filter.areaId || e.area_id === filter.areaId)
      .filter((e) => !filter.type || e.type === filter.type)
      .filter((e) => !filter.since || e.created_at >= filter.since)
      .filter((e) => !filter.until || e.created_at <= filter.until)
      .map((e) => {
        const title = normalize(e.title);
        const body = normalize(e.content_md);
        const matches = terms.every((t) => title.includes(t) || body.includes(t));
        const rank = terms.reduce((sum, t) => sum + (title.includes(t) ? 2 : 0) + (body.includes(t) ? 1 : 0), 0);
        return { entry: e, matches, rank };
      })
      .filter((r) => r.matches)
      .sort((a, b) => b.rank - a.rank || b.entry.created_at.localeCompare(a.entry.created_at));
    const page = this.page(scored, filter.limit, filter.offset);
    return { items: page.items.map((r) => ({ ...this.withArea(r.entry), rank: r.rank })), total: page.total };
  }

  async countEntriesBySource(since: string) {
    const counts: Partial<Record<Source, number>> = {};
    for (const e of this.entries) {
      if (!e.archived && e.created_at >= since) counts[e.source] = (counts[e.source] ?? 0) + 1;
    }
    return counts;
  }

  async listEvents(filter: { from: string; to: string; areaId?: string }) {
    return this.entries
      .filter((e) => e.type === "evento" && e.starts_at && !e.archived)
      .filter((e) => !filter.areaId || e.area_id === filter.areaId)
      .filter((e) => e.starts_at! <= filter.to && (e.recurrence || (e.ends_at ?? e.starts_at!) >= filter.from))
      .map((e) => this.withArea(e));
  }

  async listTasks(filter: TaskFilter) {
    return this.entries
      .filter((e) => e.type === "tarefa" && !e.archived)
      .filter((e) => !filter.areaId || e.area_id === filter.areaId)
      .filter((e) => filter.status === "todas" || (filter.status === "pendentes" ? !e.done_at : !!e.done_at))
      .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"))
      .slice(0, filter.limit)
      .map((e) => this.withArea(e));
  }

  async listDueReminders(now: string) {
    return this.entries
      .filter((e) => e.remind_at && !e.reminded_at && e.remind_at <= now && !e.archived)
      .map((e) => this.withArea(e));
  }

  async insertVersion(version: NewVersion) {
    const created: Version = { ...version, id: crypto.randomUUID(), created_at: this.now() };
    this.versions.push(created);
    return created;
  }

  async listVersions(targetTable: Version["target_table"], targetId: string, limit: number) {
    return this.versions
      .filter((v) => v.target_table === targetTable && v.target_id === targetId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  async findVersionById(id: string) {
    return this.versions.find((v) => v.id === id) ?? null;
  }

  async ping() {}
}
