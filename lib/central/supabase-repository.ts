import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { CentralError } from "./errors";
import type { Source } from "./schemas";
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
  SearchFilter,
  Version,
} from "./types";

const ENTRY_COLUMNS =
  "id, area_id, type, title, content_md, tags, source, updated_by, pinned, archived, created_at, updated_at, area:areas!inner(slug, name)";

function check<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error) {
    if (result.error.code === "23505") throw new CentralError("conflict", `${what}: registro duplicado.`);
    throw new Error(`${what}: ${result.error.message}`);
  }
  return result.data as T;
}

interface SearchRow extends Omit<Entry, "area"> {
  area_slug: string;
  area_name: string;
  rank: number;
  total_count: number;
}

export class SupabaseRepository implements CentralRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listAreas(filter: AreaFilter) {
    let query = this.db.from("areas").select("*", { count: "exact" });
    if (filter.statuses?.length) query = query.in("status", filter.statuses);
    if (filter.kind) query = query.eq("kind", filter.kind);
    const result = await query
      .order("updated_at", { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1);
    return { items: check(result, "listar áreas") as Area[], total: result.count ?? 0 };
  }

  async findAreaBySlug(slug: string) {
    return check(await this.db.from("areas").select("*").eq("slug", slug).maybeSingle(), "buscar área") as Area | null;
  }

  async findAreaById(id: string) {
    return check(await this.db.from("areas").select("*").eq("id", id).maybeSingle(), "buscar área") as Area | null;
  }

  async insertArea(area: NewArea) {
    return check(await this.db.from("areas").insert(area).select("*").single(), "criar área") as Area;
  }

  async updateArea(id: string, { touch, ...patch }: AreaPatch) {
    const values = touch ? { ...patch, updated_at: new Date().toISOString() } : patch;
    return check(
      await this.db.from("areas").update(values).eq("id", id).select("*").single(),
      "atualizar área",
    ) as Area;
  }

  async listEntries(filter: EntryFilter) {
    let query = this.db.from("entries").select(ENTRY_COLUMNS, { count: "exact" });
    if (filter.areaId) query = query.eq("area_id", filter.areaId);
    if (filter.source) query = query.eq("source", filter.source);
    if (!filter.includeArchived) query = query.eq("archived", false);
    if (filter.since) query = query.gte("created_at", filter.since);
    if (filter.before) query = query.lt("created_at", filter.before);
    const result = await query
      .order("created_at", { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1);
    return { items: check(result, "listar registros") as unknown as Entry[], total: result.count ?? 0 };
  }

  async findEntryById(id: string) {
    const result = await this.db.from("entries").select(ENTRY_COLUMNS).eq("id", id).maybeSingle();
    return check(result, "buscar registro") as unknown as Entry | null;
  }

  async insertEntry(entry: NewEntry) {
    const result = await this.db
      .from("entries")
      .insert({ ...entry, updated_by: entry.source })
      .select(ENTRY_COLUMNS)
      .single();
    return check(result, "salvar registro") as unknown as Entry;
  }

  async updateEntry(id: string, patch: EntryPatch) {
    const result = await this.db.from("entries").update(patch).eq("id", id).select(ENTRY_COLUMNS).single();
    return check(result, "atualizar registro") as unknown as Entry;
  }

  async searchEntries(filter: SearchFilter) {
    const result = await this.db.rpc("search_entries", {
      q: filter.query,
      p_area_id: filter.areaId ?? null,
      p_type: filter.type ?? null,
      p_since: filter.since ?? null,
      p_until: filter.until ?? null,
      p_limit: filter.limit,
      p_offset: filter.offset,
    });
    const rows = check(result, "buscar") as SearchRow[];
    return {
      items: rows.map(({ area_slug, area_name, total_count: _total, ...row }) => ({
        ...row,
        area: { slug: area_slug, name: area_name },
      })),
      total: rows[0]?.total_count ?? 0,
    };
  }

  async countEntriesBySource(since: string) {
    const rows = check(
      await this.db.from("entries").select("source").eq("archived", false).gte("created_at", since).limit(5000),
      "contar registros",
    ) as { source: Source }[];
    const counts: Partial<Record<Source, number>> = {};
    for (const row of rows) counts[row.source] = (counts[row.source] ?? 0) + 1;
    return counts;
  }

  async insertVersion(version: NewVersion) {
    return check(await this.db.from("versions").insert(version).select("*").single(), "salvar versão") as Version;
  }

  async listVersions(targetTable: Version["target_table"], targetId: string, limit: number) {
    const result = await this.db
      .from("versions")
      .select("*")
      .eq("target_table", targetTable)
      .eq("target_id", targetId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return check(result, "listar versões") as Version[];
  }

  async findVersionById(id: string) {
    return check(await this.db.from("versions").select("*").eq("id", id).maybeSingle(), "buscar versão") as Version | null;
  }

  async ping() {
    check(await this.db.from("areas").select("id").limit(1), "keepalive");
  }
}
