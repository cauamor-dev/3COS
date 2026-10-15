import type { Recurrence } from "./schemas";

// Brazil dropped daylight saving in 2019, so São Paulo is a fixed UTC-3.
export const TZ_OFFSET = "-03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string) {
  return DATE_ONLY.test(value);
}

export function toIsoStart(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(isDateOnly(value) ? `${value}T00:00:00${TZ_OFFSET}` : value).toISOString();
}

export function toIsoEnd(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(isDateOnly(value) ? `${value}T23:59:59.999${TZ_OFFSET}` : value).toISOString();
}

/** Midnight of the local (São Paulo) day that contains `at`, as a UTC Date. */
export function startOfLocalDay(at: Date | number = Date.now()) {
  const local = new Date(new Date(at).getTime() - OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + OFFSET_MS);
}

export function addDays(at: Date, days: number) {
  return new Date(at.getTime() + days * DAY);
}

export function localDateKey(at: Date | string) {
  return new Date(new Date(at).getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

/** Next occurrence after one step of the recurrence, keeping the local wall-clock time. */
export function stepRecurrence(at: Date, recurrence: Recurrence) {
  if (recurrence === "diaria") return addDays(at, 1);
  if (recurrence === "semanal") return addDays(at, 7);
  const local = new Date(at.getTime() - OFFSET_MS);
  if (recurrence === "mensal") local.setUTCMonth(local.getUTCMonth() + 1);
  else local.setUTCFullYear(local.getUTCFullYear() + 1);
  return new Date(local.getTime() + OFFSET_MS);
}

export interface Occurrence {
  start: Date;
  end: Date | null;
}

/** Occurrences of an event that overlap [from, to]. Capped to keep runaway rules cheap. */
export function occurrencesBetween(
  startsAt: string,
  endsAt: string | null,
  recurrence: Recurrence | null,
  from: Date,
  to: Date,
): Occurrence[] {
  const first = new Date(startsAt);
  const duration = endsAt ? new Date(endsAt).getTime() - first.getTime() : 0;
  const result: Occurrence[] = [];
  let current = first;

  for (let i = 0; i < 1000 && current <= to; i++) {
    const end = new Date(current.getTime() + duration);
    if (end >= from) result.push({ start: current, end: endsAt ? end : null });
    if (!recurrence) break;
    current = stepRecurrence(current, recurrence);
  }
  return result;
}
