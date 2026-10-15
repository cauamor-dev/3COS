import type { AreaKind, AreaStatus, EntryLink, EntryType, Priority, Recurrence, Source } from "./schemas";

export interface Area {
  id: string;
  slug: string;
  name: string;
  kind: AreaKind;
  status: AreaStatus;
  summary_md: string;
  created_at: string;
  updated_at: string;
  updated_by: Source;
}

export interface Entry {
  id: string;
  area_id: string;
  area: { slug: string; name: string };
  type: EntryType;
  title: string;
  content_md: string;
  tags: string[];
  source: Source;
  updated_by: Source;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  recurrence: Recurrence | null;
  due_at: string | null;
  done_at: string | null;
  remind_at: string | null;
  reminded_at: string | null;
  links: EntryLink[];
  image_url: string | null;
  priority: Priority | null;
}

export type ScheduleFields = Pick<
  Entry,
  | "starts_at"
  | "ends_at"
  | "all_day"
  | "location"
  | "recurrence"
  | "due_at"
  | "done_at"
  | "remind_at"
  | "reminded_at"
  | "links"
  | "image_url"
  | "priority"
>;

export interface Version {
  id: string;
  target_table: "areas" | "entries";
  target_id: string;
  previous_title: string | null;
  previous_content: string;
  source: Source;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export type NewArea = Pick<Area, "slug" | "name" | "kind" | "status" | "summary_md" | "updated_by">;
export type AreaPatch = Partial<Pick<Area, "name" | "kind" | "status" | "summary_md" | "updated_by">> & {
  touch?: boolean;
};

export type NewEntry = Pick<Entry, "area_id" | "type" | "title" | "content_md" | "tags" | "source" | "pinned"> &
  Partial<ScheduleFields>;
export type EntryPatch = Partial<
  Pick<Entry, "area_id" | "type" | "title" | "content_md" | "tags" | "pinned" | "archived" | "updated_by"> & ScheduleFields
>;

export type NewVersion = Omit<Version, "id" | "created_at">;

export interface AreaFilter {
  statuses?: AreaStatus[];
  kind?: AreaKind;
  limit: number;
  offset: number;
}

export interface EntryFilter {
  areaId?: string;
  source?: Source;
  type?: EntryType;
  includeArchived?: boolean;
  since?: string;
  before?: string;
  limit: number;
  offset: number;
}

export interface SearchFilter {
  query: string;
  areaId?: string;
  type?: EntryType;
  since?: string;
  until?: string;
  limit: number;
  offset: number;
}

export interface TaskFilter {
  status: "pendentes" | "concluidas" | "todas";
  areaId?: string;
  limit: number;
}

export interface CentralRepository {
  listAreas(filter: AreaFilter): Promise<Page<Area>>;
  findAreaBySlug(slug: string): Promise<Area | null>;
  findAreaById(id: string): Promise<Area | null>;
  insertArea(area: NewArea): Promise<Area>;
  updateArea(id: string, patch: AreaPatch): Promise<Area>;

  listEntries(filter: EntryFilter): Promise<Page<Entry>>;
  findEntryById(id: string): Promise<Entry | null>;
  insertEntry(entry: NewEntry): Promise<Entry>;
  updateEntry(id: string, patch: EntryPatch): Promise<Entry>;
  searchEntries(filter: SearchFilter): Promise<Page<Entry & { rank: number }>>;
  countEntriesBySource(since: string): Promise<Partial<Record<Source, number>>>;
  listEvents(filter: { from: string; to: string; areaId?: string }): Promise<Entry[]>;
  listTasks(filter: TaskFilter): Promise<Entry[]>;
  listDueReminders(now: string): Promise<Entry[]>;

  insertVersion(version: NewVersion): Promise<Version>;
  listVersions(targetTable: Version["target_table"], targetId: string, limit: number): Promise<Version[]>;
  findVersionById(id: string): Promise<Version | null>;

  ping(): Promise<void>;
}
