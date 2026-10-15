import { TZ_OFFSET } from "./time";

/**
 * Small pt-BR date parser for quick capture ("amanhã às 9h", "sexta 14:30",
 * "em 2 horas", "20/10 18h"). Returns the cleaned text and an ISO date, if any.
 */
export interface ParsedDate {
  text: string;
  at: string | null;
  hasTime: boolean;
}

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function localParts(now: Date) {
  const local = new Date(now.getTime() - 3 * 3600_000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate(), weekday: local.getUTCDay() };
}

function toIso(year: number, month: number, day: number, hour: number, minute: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = new Date(Date.UTC(year, month, day));
  return new Date(
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(hour)}:${pad(minute)}:00${TZ_OFFSET}`,
  ).toISOString();
}

export function parseNaturalDate(input: string, now = new Date()): ParsedDate {
  let text = input;
  const lower = () => strip(text);
  const remove = (match: RegExpMatchArray) => {
    text = (text.slice(0, match.index) + text.slice(match.index! + match[0].length)).replace(/\s{2,}/g, " ").trim();
  };

  const relative = lower().match(/\bem (\d+) ?(min|minutos?|h|horas?|dias?)\b/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const ms = unit.startsWith("min") ? amount * 60_000 : unit.startsWith("h") ? amount * 3600_000 : amount * 86_400_000;
    remove(relative);
    return { text: cleanup(text), at: new Date(now.getTime() + ms).toISOString(), hasTime: !unit.startsWith("d") };
  }

  const today = localParts(now);
  let target: { year: number; month: number; day: number } | null = null;

  const dayWord = lower().match(/\b(hoje|amanha|depois de amanha)\b/);
  if (dayWord) {
    const offset = dayWord[1] === "hoje" ? 0 : dayWord[1] === "amanha" ? 1 : 2;
    target = { year: today.year, month: today.month, day: today.day + offset };
    remove(dayWord);
  }

  const weekday = !target && lower().match(/\b(?:na |no |proxima |proximo )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/);
  if (weekday) {
    const wanted = WEEKDAYS.indexOf(weekday[1]);
    const diff = (wanted - today.weekday + 7) % 7 || 7;
    target = { year: today.year, month: today.month, day: today.day + diff };
    remove(weekday);
  }

  const explicit = !target && lower().match(/\b(?:dia )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicit) {
    const year = explicit[3] ? Number(explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3]) : today.year;
    target = { year, month: Number(explicit[2]) - 1, day: Number(explicit[1]) };
    if (!explicit[3] && Date.UTC(year, target.month, target.day) < Date.UTC(today.year, today.month, today.day)) target.year += 1;
    remove(explicit);
  }

  const time = lower().match(/\b(?:as |às |a partir das )?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?:\s?h(?:oras?)?)?\b/);
  let hour = 9;
  let minute = 0;
  let hasTime = false;
  if (time) {
    hour = Number(time[1]);
    minute = Number(time[2] ?? time[3] ?? 0);
    if (hour < 24 && minute < 60) {
      hasTime = true;
      remove(time);
    }
  }

  if (!target && hasTime) {
    target = { year: today.year, month: today.month, day: today.day };
    if (toIso(target.year, target.month, target.day, hour, minute) <= now.toISOString()) target.day += 1;
  }

  if (!target) return { text: cleanup(input), at: null, hasTime: false };
  return { text: cleanup(text), at: toIso(target.year, target.month, target.day, hour, minute), hasTime };
}

function cleanup(text: string) {
  return text
    .replace(/^\s*(me lembra(r)?|lembrete|lembrar)( de| que)?\s*/i, "")
    .replace(/\s+(de|que)$/i, "")
    .replace(/^(de|que)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
