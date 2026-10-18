import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { CentralError } from "./errors";
import { assertArea, HUMAN_ACTOR, SENSITIVE_ENTRY_IDS, type ActorContext } from "./access";
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
  TaskFilter,
  Version,
} from "./types";

const ENTRY_COLUMNS =
  "id, area_id, type, title, content_md, tags, source, updated_by, pinned, archived, created_at, updated_at, " +
  "starts_at, ends_at, all_day, location, recurrence, due_at, done_at, remind_at, reminded_at, links, image_url, priority, revision, ai_access, owner_id, original_text, origin_chat_id, origin_chat_title, origin_chat_url, agent_id, external_id, " +
  "area:areas!inner(slug, name)";

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
  constructor(private readonly db: SupabaseClient, private readonly actor: ActorContext = HUMAN_ACTOR) {}
  forActor(actor: ActorContext) { return new SupabaseRepository(this.db, actor); }

  private entriesQuery(count = false) {
    let query = this.db.from("entries").select(ENTRY_COLUMNS, count ? { count: "exact" } : {});
    if (this.actor.kind !== "human") {
      for (const id of SENSITIVE_ENTRY_IDS) query = query.neq("id", id);
      const restricted = this.actor.grants?.filter(g => g.restricted && g.operations.includes("read")).map(g => g.areaId) ?? [];
      query = restricted.length ? query.or(`ai_access.eq.shared,and(ai_access.eq.restricted,area_id.in.(${restricted.join(",")}))`) : query.eq("ai_access", "shared");
    } else if (this.actor.userId) query = query.or(`owner_id.is.null,owner_id.eq.${this.actor.userId}`);
    if (this.actor.kind === "integration") query = query.in("area_id", this.allowedAreas());
    return query;
  }
  private allowedAreas() { return this.actor.grants?.filter(g => g.operations.includes("read")).map(g => g.areaId) ?? []; }

  async listAreas(filter: AreaFilter) {
    let query = this.db.from("areas").select("*", { count: "exact" });
    if (this.actor.kind === "integration") query = query.in("id", this.allowedAreas());
    if (filter.statuses?.length) query = query.in("status", filter.statuses);
    if (filter.kind) query = query.eq("kind", filter.kind);
    const result = await query
      .order("updated_at", { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1);
    return { items: check(result, "listar áreas") as Area[], total: result.count ?? 0 };
  }

  async findAreaBySlug(slug: string) {
    let query = this.db.from("areas").select("*").eq("slug", slug);
    if (this.actor.kind === "integration") query = query.in("id", this.allowedAreas());
    return check(await query.maybeSingle(), "buscar área") as Area | null;
  }

  async findAreaById(id: string) {
    assertArea(this.actor, id);
    return check(await this.db.from("areas").select("*").eq("id", id).maybeSingle(), "buscar área") as Area | null;
  }

  async insertArea(area: NewArea) {
    if (this.actor.kind === "integration") throw new CentralError("forbidden", "Criação de áreas exige o proprietário.");
    return check(await this.db.from("areas").insert(area).select("*").single(), "criar área") as Area;
  }

  async updateArea(id: string, { touch, ...patch }: AreaPatch) {
    assertArea(this.actor, id, "write");
    const values = touch ? { ...patch, updated_at: new Date().toISOString() } : patch;
    return check(
      await this.db.from("areas").update(values).eq("id", id).select("*").single(),
      "atualizar área",
    ) as Area;
  }

  async listEntries(filter: EntryFilter) {
    let query = this.entriesQuery(true);
    if (filter.areaId) query = query.eq("area_id", filter.areaId);
    if (filter.source) query = query.eq("source", filter.source);
    if (filter.type) query = query.eq("type", filter.type);
    if (!filter.includeArchived) query = query.eq("archived", false);
    if (filter.since) query = query.gte("created_at", filter.since);
    if (filter.before) query = query.lt("created_at", filter.before);
    const result = await query
      .order("created_at", { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1);
    return { items: check(result, "listar registros") as unknown as Entry[], total: result.count ?? 0 };
  }

  async findEntryById(id: string) {
    const result = await this.entriesQuery().eq("id", id).maybeSingle();
    return check(result, "buscar registro") as unknown as Entry | null;
  }
  async findEntryByExternalId(externalId:string,clientId:string){return check(await this.entriesQuery().eq("external_id",externalId).eq("origin_client_id",clientId).maybeSingle(),"localizar importação") as unknown as Entry|null;}

  async insertEntry(entry: NewEntry) {
    assertArea(this.actor, entry.area_id, "write");
    const result = await this.db
      .from("entries")
      .insert({ ...entry, updated_by: entry.source })
      .select(ENTRY_COLUMNS)
      .single();
    return check(result, "salvar registro") as unknown as Entry;
  }

  async updateEntry(id: string, patch: EntryPatch, expectedRevision?: number) {
    const current = await this.findEntryById(id);
    if (!current) throw new CentralError("not_found", "Registro não encontrado.");
    assertArea(this.actor, current.area_id, "write");
    if (patch.area_id) assertArea(this.actor, patch.area_id, "write");
    const result = await this.db.rpc("edit_entry_atomic", { p_id: id, p_revision: expectedRevision ?? current.revision, p_patch: patch });
    if (result.error?.code === "40001") throw new CentralError("conflict", "Registro alterado por outra sessão. Reabra a versão atual antes de salvar.");
    check(result, "atualizar registro");
    return (await this.findEntryById(id))!;
  }

  async searchEntries(filter: SearchFilter) {
    const result = await this.db.rpc("search_entries_scoped", {
      p_ai: this.actor.kind !== "human",
      p_areas: this.actor.kind === "integration" ? this.allowedAreas() : null,
      p_restricted: this.actor.grants?.filter(g => g.restricted && g.operations.includes("read")).map(g => g.areaId) ?? [],
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
      await this.entriesQuery().eq("archived", false).gte("created_at", since).limit(5000),
      "contar registros",
    ) as unknown as { source: Source }[];
    const counts: Partial<Record<Source, number>> = {};
    for (const row of rows) counts[row.source] = (counts[row.source] ?? 0) + 1;
    return counts;
  }

  async listEvents(filter: { from: string; to: string; areaId?: string }) {
    let query = this.entriesQuery()
      .eq("type", "evento")
      .eq("archived", false)
      .lte("starts_at", filter.to)
      .or(`recurrence.not.is.null,ends_at.gte.${filter.from},starts_at.gte.${filter.from}`);
    if (filter.areaId) query = query.eq("area_id", filter.areaId);
    const result = await query.order("starts_at").limit(500);
    return check(result, "listar eventos") as unknown as Entry[];
  }

  async listTasks(filter: TaskFilter) {
    let query = this.entriesQuery().eq("type", "tarefa").eq("archived", false);
    if (filter.areaId) query = query.eq("area_id", filter.areaId);
    if (filter.status === "pendentes") query = query.is("done_at", null);
    if (filter.status === "concluidas") query = query.not("done_at", "is", null);
    const result = await query
      .order(filter.status === "concluidas" ? "done_at" : "due_at", {
        ascending: filter.status !== "concluidas",
        nullsFirst: false,
      })
      .limit(filter.limit);
    return check(result, "listar tarefas") as unknown as Entry[];
  }

  async listDueReminders(now: string) {
    const result = await this.entriesQuery()
      .eq("archived", false)
      .is("reminded_at", null)
      .lte("remind_at", now)
      .limit(50);
    return check(result, "listar lembretes") as unknown as Entry[];
  }

  async insertVersion(version: NewVersion) {
    return check(await this.db.from("versions").insert(version).select("*").single(), "salvar versão") as Version;
  }

  async listVersions(targetTable: Version["target_table"], targetId: string, limit: number) {
    if (targetTable === "entries" ? !(await this.findEntryById(targetId)) : !(await this.findAreaById(targetId))) return [];
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
    const version = check(await this.db.from("versions").select("*").eq("id", id).maybeSingle(), "buscar versão") as Version | null;
    if (!version || !(await this.listVersions(version.target_table, version.target_id, 100)).some(v => v.id === id)) return null;
    return version;
  }

  async ping() {
    check(await this.db.from("areas").select("id").limit(1), "keepalive");
  }
}
