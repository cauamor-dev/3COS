import { CentralError, notFound } from "./errors";
import {
  agendaInput,
  briefingInput,
  tasksInput,
  createAreaInput,
  editEntryInput,
  feedInput,
  importInput,
  listAreasInput,
  readAreaInput,
  readEntryInput,
  saveEntryInput,
  searchInput,
  updateAreaMetaInput,
  updateSummaryInput,
  type AgendaInput,
  type AreaKind,
  type TasksInput,
  type EntryType,
  type BriefingInput,
  type CreateAreaInput,
  type EditEntryInput,
  type FeedInput,
  type ImportInput,
  type ListAreasInput,
  type ReadAreaInput,
  type ReadEntryInput,
  type SaveEntryInput,
  type SearchInput,
  type Source,
  type UpdateAreaMetaInput,
  type UpdateSummaryInput,
} from "./schemas";
import { normalizeTags, slugify, titleFromSlug, truncate } from "./text";
import {
  addDays,
  formatLocalDay,
  formatLocalTime,
  isDateOnly,
  occurrencesBetween,
  startOfLocalDay,
  stepRecurrence,
  toIsoEnd,
  toIsoStart,
} from "./time";
import type { Area, CentralRepository, Entry, EntryPatch, ScheduleFields, Version } from "./types";

export const LIMITS = {
  entryInList: 600,
  entryInBriefing: 240,
  summaryInList: 280,
  summaryInArea: 12_000,
  profile: 3_000,
  entryFull: 20_000,
} as const;

export const PROFILE_SLUGS = ["perfil", "preferencias"] as const;
export const INBOX_SLUG = "inbox";

const DAY = 24 * 60 * 60 * 1000;

function entryView(entry: Entry, max: number) {
  const content = truncate(entry.content_md, max);
  return {
    id: entry.id,
    area: entry.area.slug,
    tipo: entry.type,
    titulo: entry.title,
    conteudo: content.text,
    ...(content.truncated && { truncado: true, total_caracteres: content.total_chars }),
    tags: entry.tags,
    fonte: entry.source,
    ...(entry.pinned && { fixado: true }),
    ...(entry.archived && { arquivado: true }),
    criado_em: entry.created_at,
    ...(entry.updated_at !== entry.created_at && { atualizado_em: entry.updated_at }),
    ...scheduleView(entry),
  };
}

function scheduleView(entry: Entry) {
  return {
    ...(entry.starts_at && { inicio: entry.starts_at }),
    ...(entry.ends_at && { fim: entry.ends_at }),
    ...(entry.all_day && { dia_inteiro: true }),
    ...(entry.location && { local: entry.location }),
    ...(entry.recurrence && { recorrencia: entry.recurrence }),
    ...(entry.due_at && { prazo: entry.due_at }),
    ...(entry.type === "tarefa" && { concluida: !!entry.done_at }),
    ...(entry.done_at && { concluida_em: entry.done_at }),
    ...(entry.remind_at && { lembrar_em: entry.remind_at }),
    ...(entry.links?.length && { links: entry.links }),
    ...(entry.image_url && { imagem: entry.image_url }),
    ...(entry.priority && { prioridade: entry.priority }),
  };
}

interface ScheduleInput {
  inicio?: string;
  fim?: string;
  dia_inteiro?: boolean;
  local?: string;
  recorrencia?: ScheduleFields["recurrence"];
  prazo?: string;
  lembrar_em?: string;
  links?: ScheduleFields["links"];
  imagem?: string;
  prioridade?: ScheduleFields["priority"];
}

function scheduleFromInput(input: ScheduleInput): Partial<ScheduleFields> {
  const fields: Partial<ScheduleFields> = {};
  if (input.inicio !== undefined) {
    fields.starts_at = toIsoStart(input.inicio)!;
    if (isDateOnly(input.inicio) && input.dia_inteiro === undefined) fields.all_day = true;
  }
  if (input.fim !== undefined) fields.ends_at = toIsoEnd(input.fim)!;
  if (input.dia_inteiro !== undefined) fields.all_day = input.dia_inteiro;
  if (input.local !== undefined) fields.location = input.local;
  if (input.recorrencia !== undefined) fields.recurrence = input.recorrencia;
  if (input.prazo !== undefined) fields.due_at = toIsoEnd(input.prazo)!;
  if (input.lembrar_em !== undefined) {
    fields.remind_at = toIsoStart(input.lembrar_em)!;
    fields.reminded_at = null;
  }
  if (input.links !== undefined) fields.links = input.links;
  if (input.imagem !== undefined) fields.image_url = input.imagem;
  if (input.prioridade !== undefined) fields.priority = input.prioridade;
  return fields;
}

function areaView(area: Area, max: number) {
  const summary = truncate(area.summary_md, max);
  return {
    slug: area.slug,
    nome: area.name,
    tipo: area.kind,
    status: area.status,
    resumo: summary.text,
    ...(summary.truncated && { resumo_truncado: true, total_caracteres: summary.total_chars }),
    atualizado_em: area.updated_at,
    atualizado_por: area.updated_by,
  };
}

function pagination(total: number, offset: number, count: number) {
  const hasMore = offset + count < total;
  return { total, offset, ...(hasMore && { proximo_offset: offset + count }) };
}

export interface Notice {
  title: string;
  body: string;
  path: string;
  entryId?: string;
  kind?: Entry["type"];
}

function reminderNotice(entry: Entry): Notice {
  return { ...reminderText(entry), entryId: entry.id, kind: entry.type };
}

function reminderText(entry: Entry): Notice {
  const path = `/areas/${entry.area.slug}#${entry.id}`;
  if (entry.type === "evento" && entry.starts_at) {
    const when = entry.all_day ? "Hoje, o dia todo" : `Às ${formatLocalTime(entry.starts_at)}`;
    return { title: entry.title, body: [when, entry.location].filter(Boolean).join(" · "), path };
  }
  if (entry.type === "tarefa") {
    const due = entry.due_at ? `Prazo às ${formatLocalTime(entry.due_at)}` : "Tarefa pendente";
    return { title: `Lembrete: ${entry.title}`, body: due, path };
  }
  return { title: `Lembrete: ${entry.title}`, body: entry.content_md.slice(0, 140) || entry.area.name, path };
}

const truncationHint = "Conteúdos marcados com truncado=true estão cortados; use ler_registro com o id para ler completo.";

export class CentralService {
  constructor(private readonly repo: CentralRepository) {}

  async briefing(raw: BriefingInput = {}) {
    const input = briefingInput.parse(raw);
    const since = toIsoStart(input.desde) ?? new Date(Date.now() - 7 * DAY).toISOString();

    const [profile, preferences, active, recent, inbox] = await Promise.all([
      this.repo.findAreaBySlug("perfil"),
      this.repo.findAreaBySlug("preferencias"),
      this.repo.listAreas({ statuses: ["ativo"], limit: 50, offset: 0 }),
      this.repo.listEntries({ since, limit: input.limite_registros, offset: 0 }),
      this.repo.findAreaBySlug(INBOX_SLUG),
    ]);

    const inboxCount = inbox
      ? (await this.repo.listEntries({ areaId: inbox.id, limit: 1, offset: 0 })).total
      : 0;

    return {
      perfil: profile ? truncate(profile.summary_md, LIMITS.profile).text : "",
      preferencias: preferences ? truncate(preferences.summary_md, LIMITS.profile).text : "",
      areas_ativas: active.items
        .filter((area) => area.kind !== "perfil" && area.slug !== INBOX_SLUG)
        .map((area) => areaView(area, LIMITS.summaryInList)),
      registros_recentes: {
        desde: since,
        total: recent.total,
        itens: recent.items.map((entry) => entryView(entry, LIMITS.entryInBriefing)),
      },
      inbox_pendentes: inboxCount,
      dica: `Use ler_area para o resumo completo de uma área. ${truncationHint}`,
    };
  }

  async listAreas(raw: ListAreasInput = {}) {
    const input = listAreasInput.parse(raw);
    const page = await this.repo.listAreas({
      statuses: input.status ? [input.status] : undefined,
      kind: input.kind,
      limit: input.limite,
      offset: input.offset,
    });
    return {
      areas: page.items.map((area) => areaView(area, LIMITS.summaryInList)),
      ...pagination(page.total, input.offset, page.items.length),
    };
  }

  async readArea(raw: ReadAreaInput) {
    const input = readAreaInput.parse(raw);
    const area = await this.requireArea(input.slug);
    const entries = await this.repo.listEntries({
      areaId: area.id,
      includeArchived: input.incluir_arquivados,
      limit: input.limite_registros,
      offset: 0,
    });
    const pinnedFirst = [...entries.items].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return {
      area: areaView(area, LIMITS.summaryInArea),
      registros: pinnedFirst.map((entry) => entryView(entry, LIMITS.entryInList)),
      total_registros: entries.total,
      dica: truncationHint,
    };
  }

  async readEntry(raw: ReadEntryInput) {
    const input = readEntryInput.parse(raw);
    const entry = await this.repo.findEntryById(input.id);
    if (!entry) throw notFound("Registro");
    return { registro: entryView(entry, LIMITS.entryFull) };
  }

  async search(raw: SearchInput) {
    const input = searchInput.parse(raw);
    const area = input.area ? await this.requireArea(input.area) : null;
    const page = await this.repo.searchEntries({
      query: input.consulta,
      areaId: area?.id,
      type: input.tipo,
      since: toIsoStart(input.desde),
      until: toIsoEnd(input.ate),
      limit: input.limite,
      offset: input.offset,
    });
    return {
      resultados: page.items.map((entry) => entryView(entry, LIMITS.entryInList)),
      ...pagination(page.total, input.offset, page.items.length),
    };
  }

  async saveEntry(raw: SaveEntryInput, source: Source) {
    const input = saveEntryInput.parse(raw);
    const { area, created } = await this.ensureArea(input.area_slug, source, {
      name: input.area_nome,
      kind: input.area_tipo,
    });
    const entry = await this.repo.insertEntry({
      area_id: area.id,
      type: input.tipo,
      title: input.titulo,
      content_md: input.conteudo,
      tags: normalizeTags(input.tags),
      source,
      pinned: input.fixado,
      ...scheduleFromInput(input),
    });
    await this.repo.updateArea(area.id, { updated_by: source, touch: true });
    return {
      registro: entryView(entry, LIMITS.entryInList),
      area_criada: created,
      mensagem: created
        ? `Registro salvo. A área "${area.slug}" não existia e foi criada.`
        : `Registro salvo em "${area.slug}".`,
    };
  }

  async updateSummary(raw: UpdateSummaryInput, source: Source) {
    const input = updateSummaryInput.parse(raw);
    const { area, created } = await this.ensureArea(input.area_slug, source, {
      name: input.area_nome,
      kind: input.area_tipo,
    });

    if (!created && area.summary_md.trim() && area.summary_md !== input.resumo) {
      await this.repo.insertVersion({
        target_table: "areas",
        target_id: area.id,
        previous_title: null,
        previous_content: area.summary_md,
        source,
      });
    }

    const updated = await this.repo.updateArea(area.id, {
      summary_md: input.resumo,
      updated_by: source,
      ...(input.status && { status: input.status }),
    });
    return {
      area: areaView(updated, LIMITS.summaryInList),
      area_criada: created,
      mensagem: "Resumo atualizado. A versão anterior ficou no histórico.",
    };
  }

  async editEntry(raw: EditEntryInput, source: Source) {
    const input = editEntryInput.parse(raw);
    const entry = await this.repo.findEntryById(input.id);
    if (!entry) throw notFound("Registro");

    const patch: EntryPatch = { updated_by: source };
    if (input.titulo !== undefined) patch.title = input.titulo;
    if (input.conteudo !== undefined) patch.content_md = input.conteudo;
    if (input.tipo !== undefined) patch.type = input.tipo;
    if (input.tags !== undefined) patch.tags = normalizeTags(input.tags);
    if (input.fixado !== undefined) patch.pinned = input.fixado;
    if (input.arquivado !== undefined) patch.archived = input.arquivado;
    if (input.area_slug !== undefined) patch.area_id = (await this.requireArea(input.area_slug)).id;
    if (input.concluida !== undefined) patch.done_at = input.concluida ? new Date().toISOString() : null;
    Object.assign(patch, scheduleFromInput(input));

    const contentChanged = patch.content_md !== undefined && patch.content_md !== entry.content_md;
    const titleChanged = patch.title !== undefined && patch.title !== entry.title;
    if (contentChanged || titleChanged) {
      await this.repo.insertVersion({
        target_table: "entries",
        target_id: entry.id,
        previous_title: entry.title,
        previous_content: entry.content_md,
        source,
      });
    }

    const updated = await this.repo.updateEntry(entry.id, patch);
    return { registro: entryView(updated, LIMITS.entryInList), mensagem: "Registro atualizado." };
  }

  async agenda(raw: AgendaInput = {}) {
    const input = agendaInput.parse(raw);
    const from = input.de ? new Date(toIsoStart(input.de)!) : startOfLocalDay();
    const to = input.ate ? new Date(toIsoEnd(input.ate)!) : addDays(startOfLocalDay(), 8);
    const area = input.area ? await this.requireArea(input.area) : null;

    const [events, pending] = await Promise.all([
      this.repo.listEvents({ from: from.toISOString(), to: to.toISOString(), areaId: area?.id }),
      this.repo.listTasks({ status: "pendentes", areaId: area?.id, limit: 200 }),
    ]);

    const occurrences = events
      .flatMap((event) =>
        occurrencesBetween(event.starts_at!, event.ends_at, event.recurrence, from, to).map((occurrence) => ({
          ...entryView(event, LIMITS.entryInBriefing),
          inicio: occurrence.start.toISOString(),
          ...(occurrence.end && { fim: occurrence.end.toISOString() }),
        })),
      )
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

    const now = new Date().toISOString();
    const withDue = pending.filter((task) => task.due_at);
    return {
      periodo: { de: from.toISOString(), ate: to.toISOString() },
      eventos: occurrences,
      tarefas_atrasadas: withDue
        .filter((task) => task.due_at! < now)
        .map((task) => entryView(task, LIMITS.entryInBriefing)),
      tarefas_no_periodo: withDue
        .filter((task) => task.due_at! >= now && task.due_at! <= to.toISOString())
        .map((task) => entryView(task, LIMITS.entryInBriefing)),
    };
  }

  async listTasks(raw: TasksInput = {}) {
    const input = tasksInput.parse(raw);
    const area = input.area ? await this.requireArea(input.area) : null;
    const tasks = await this.repo.listTasks({ status: input.status, areaId: area?.id, limit: input.limite });
    return { tarefas: tasks.map((task) => entryView(task, LIMITS.entryInList)), total: tasks.length };
  }

  async dispatchReminders(send: (notice: Notice) => Promise<unknown>, now = new Date()) {
    const due = await this.repo.listDueReminders(now.toISOString());
    for (const entry of due) {
      await send(reminderNotice(entry));
      if (entry.recurrence) {
        let next = new Date(entry.remind_at!);
        while (next <= now) next = stepRecurrence(next, entry.recurrence);
        await this.repo.updateEntry(entry.id, { remind_at: next.toISOString(), reminded_at: null });
      } else {
        await this.repo.updateEntry(entry.id, { reminded_at: now.toISOString() });
      }
    }
    return due.length;
  }

  async snoozeReminder(id: string, minutes: number, source: Source) {
    const remindAt = new Date(Date.now() + minutes * 60_000).toISOString();
    return this.editEntry({ id, lembrar_em: remindAt }, source);
  }

  async dailySummary(now = new Date()): Promise<Notice & { lines: string[] }> {
    const today = startOfLocalDay(now);
    const tomorrow = addDays(today, 1);
    const [events, pending, inbox] = await Promise.all([
      this.eventsBetween(today, tomorrow),
      this.repo.listTasks({ status: "pendentes", limit: 200 }),
      this.repo.findAreaBySlug(INBOX_SLUG),
    ]);
    const inboxCount = inbox ? (await this.repo.listEntries({ areaId: inbox.id, limit: 1, offset: 0 })).total : 0;
    const late = pending.filter((task) => task.due_at && task.due_at < now.toISOString());
    const dueToday = pending.filter((task) => task.due_at && task.due_at >= now.toISOString() && task.due_at < tomorrow.toISOString());

    const lines = [
      ...events.map(({ entry, start }) => `${entry.all_day ? "Dia todo" : formatLocalTime(start)} · ${entry.title}`),
      ...dueToday.map((task) => `Prazo ${formatLocalTime(task.due_at!)} · ${task.title}`),
      ...late.map((task) => `Atrasada · ${task.title}`),
      ...(inboxCount > 0 ? [`${inboxCount} registro(s) na inbox para revisar`] : []),
    ];
    return {
      title: `Bom dia! ${formatLocalDay(now)}`,
      body: lines.length ? lines.join("\n") : "Agenda livre hoje. Bom momento para avançar no projeto principal.",
      path: "/agenda",
      lines,
    };
  }

  // Painel

  async tasksForPanel() {
    return this.repo.listTasks({ status: "todas", limit: 300 });
  }

  async rawEventsBetween(from: Date, to: Date) {
    return this.repo.listEvents({ from: from.toISOString(), to: to.toISOString() });
  }

  async eventsBetween(from: Date, to: Date) {
    const events = await this.repo.listEvents({ from: from.toISOString(), to: to.toISOString() });
    return events
      .flatMap((event) =>
        occurrencesBetween(event.starts_at!, event.ends_at, event.recurrence, from, to).map((occurrence) => ({
          entry: event,
          start: occurrence.start.toISOString(),
          end: occurrence.end?.toISOString() ?? null,
        })),
      )
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async getArea(slug: string) {
    return this.requireArea(slug);
  }

  async listAllAreas() {
    return (await this.repo.listAreas({ limit: 500, offset: 0 })).items;
  }

  async areaEntries(areaId: string, includeArchived = true) {
    return (await this.repo.listEntries({ areaId, includeArchived, limit: 200, offset: 0 })).items;
  }

  async getEntry(id: string) {
    const entry = await this.repo.findEntryById(id);
    if (!entry) throw notFound("Registro");
    return entry;
  }

  async feed(raw: FeedInput = {}) {
    const input = feedInput.parse(raw);
    const area = input.area ? await this.requireArea(input.area) : null;
    return this.repo.listEntries({
      areaId: area?.id,
      source: input.fonte,
      type: input.tipo,
      before: toIsoStart(input.antes_de),
      limit: input.limite,
      offset: 0,
    });
  }

  async searchEntries(query: string, options: { limit?: number; area?: string; type?: EntryType } = {}) {
    const area = options.area ? await this.requireArea(options.area) : null;
    return this.repo.searchEntries({ query, areaId: area?.id, type: options.type, limit: options.limit ?? 20, offset: 0 });
  }

  async stats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [areas, entries, today] = await Promise.all([
      this.repo.listAreas({ limit: 1, offset: 0 }),
      this.repo.listEntries({ limit: 1, offset: 0 }),
      this.repo.countEntriesBySource(startOfDay.toISOString()),
    ]);
    return { areas: areas.total, entries: entries.total, today };
  }

  async graph() {
    const [areas, entries] = await Promise.all([
      this.repo.listAreas({ limit: 500, offset: 0 }),
      this.repo.listEntries({ limit: 1000, offset: 0 }),
    ]);
    return { areas: areas.items, entries: entries.items };
  }

  async createArea(raw: CreateAreaInput, source: Source) {
    const input = createAreaInput.parse(raw);
    const slug = slugify(input.slug ?? input.nome);
    if (!slug) throw new CentralError("invalid", "Nome ou slug inválido.");
    if (await this.repo.findAreaBySlug(slug)) {
      throw new CentralError("conflict", `Já existe uma área com o slug "${slug}".`);
    }
    return this.repo.insertArea({
      slug,
      name: input.nome,
      kind: input.tipo,
      status: input.status,
      summary_md: input.resumo,
      updated_by: source,
    });
  }

  async updateAreaMeta(raw: UpdateAreaMetaInput, source: Source) {
    const input = updateAreaMetaInput.parse(raw);
    const area = await this.requireArea(input.slug);
    return this.repo.updateArea(area.id, {
      updated_by: source,
      ...(input.nome && { name: input.nome }),
      ...(input.tipo && { kind: input.tipo }),
      ...(input.status && { status: input.status }),
    });
  }

  async versions(target: Version["target_table"], targetId: string) {
    return this.repo.listVersions(target, targetId, 50);
  }

  async restoreVersion(versionId: string, source: Source) {
    const version = await this.repo.findVersionById(versionId);
    if (!version) throw notFound("Versão");

    if (version.target_table === "areas") {
      const area = await this.repo.findAreaById(version.target_id);
      if (!area) throw notFound("Área");
      await this.repo.insertVersion({
        target_table: "areas",
        target_id: area.id,
        previous_title: null,
        previous_content: area.summary_md,
        source,
      });
      await this.repo.updateArea(area.id, { summary_md: version.previous_content, updated_by: source });
      return { target_table: "areas" as const, slug: area.slug };
    }

    const entry = await this.repo.findEntryById(version.target_id);
    if (!entry) throw notFound("Registro");
    await this.repo.insertVersion({
      target_table: "entries",
      target_id: entry.id,
      previous_title: entry.title,
      previous_content: entry.content_md,
      source,
    });
    await this.repo.updateEntry(entry.id, {
      content_md: version.previous_content,
      ...(version.previous_title && { title: version.previous_title }),
      updated_by: source,
    });
    return { target_table: "entries" as const, slug: entry.area.slug, id: entry.id };
  }

  async exportAll() {
    const pageSize = 1000;
    const areas = await this.repo.listAreas({ limit: pageSize, offset: 0 });
    const entries: Entry[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.repo.listEntries({ includeArchived: true, limit: pageSize, offset });
      entries.push(...page.items);
      if (page.items.length < pageSize) break;
    }
    return { exported_at: new Date().toISOString(), areas: areas.items, entries };
  }

  async importFiles(raw: ImportInput, source: Source) {
    const input = importInput.parse(raw);
    if (input.modo === "resumo") {
      const summary = input.arquivos.map((file) => file.conteudo.trim()).join("\n\n---\n\n");
      await this.updateSummary({ area_slug: input.area_slug, area_nome: input.area_nome, resumo: summary }, source);
      return { imported: 1 };
    }
    for (const file of input.arquivos) {
      const { title, body } = splitMarkdownTitle(file.conteudo, file.nome);
      await this.saveEntry(
        { area_slug: input.area_slug, area_nome: input.area_nome, tipo: "contexto", titulo: title, conteudo: body },
        source,
      );
    }
    return { imported: input.arquivos.length };
  }

  async ping() {
    await this.repo.ping();
  }

  private async requireArea(slugInput: string) {
    const slug = slugify(slugInput);
    const area = slug ? await this.repo.findAreaBySlug(slug) : null;
    if (!area) {
      throw new CentralError(
        "not_found",
        `Área "${slugInput}" não encontrada. Use listar_areas para ver os slugs existentes.`,
      );
    }
    return area;
  }

  private async ensureArea(slugInput: string, source: Source, defaults: { name?: string; kind?: AreaKind }) {
    const slug = slugify(slugInput);
    if (!slug) throw new CentralError("invalid", "Slug de área inválido.");
    const existing = await this.repo.findAreaBySlug(slug);
    if (existing) return { area: existing, created: false };
    const area = await this.repo.insertArea({
      slug,
      name: defaults.name ?? titleFromSlug(slug),
      kind: defaults.kind ?? "projeto",
      status: "ativo",
      summary_md: "",
      updated_by: source,
    });
    return { area, created: true };
  }
}

export function splitMarkdownTitle(content: string, fileName: string) {
  const match = content.match(/^\s*#\s+(.+)\n?/);
  if (match) return { title: match[1].trim().slice(0, 200), body: content.slice(match[0].length).trim() };
  const fallback = fileName.replace(/\.(md|markdown|txt)$/i, "").trim() || "Importado";
  return { title: fallback.slice(0, 200), body: content.trim() };
}
