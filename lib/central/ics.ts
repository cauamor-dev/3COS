import type { Entry } from "./types";

const RRULE: Record<NonNullable<Entry["recurrence"]>, string> = {
  diaria: "DAILY",
  semanal: "WEEKLY",
  mensal: "MONTHLY",
  anual: "YEARLY",
};

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function utcStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** All-day dates are stored as São Paulo midnight; subtracting 3h before slicing keeps the local date. */
function localDate(iso: string) {
  return new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
}

// RFC 5545 asks for lines of at most 75 octets, continued with a leading space.
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function eventLines(entry: Entry, appUrl: string, stamp: string): string[] {
  const isTask = entry.type === "tarefa";
  const start = isTask ? entry.due_at! : entry.starts_at!;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${entry.id}@central-3c`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeText(isTask ? `Prazo: ${entry.title}` : entry.title)}`,
  ];

  if (entry.all_day && !isTask) {
    lines.push(`DTSTART;VALUE=DATE:${localDate(start)}`);
  } else {
    lines.push(`DTSTART:${utcStamp(start)}`);
    const end = !isTask && entry.ends_at ? entry.ends_at : new Date(Date.parse(start) + (isTask ? 15 : 60) * 60_000).toISOString();
    lines.push(`DTEND:${utcStamp(end)}`);
  }

  if (entry.recurrence && !isTask) lines.push(`RRULE:FREQ=${RRULE[entry.recurrence]}`);
  if (entry.location) lines.push(`LOCATION:${escapeText(entry.location)}`);
  if (entry.content_md) lines.push(`DESCRIPTION:${escapeText(entry.content_md.slice(0, 1000))}`);
  lines.push(`URL:${appUrl}/areas/${entry.area.slug}#${entry.id}`);

  if (entry.remind_at) {
    const minutes = Math.max(0, Math.round((Date.parse(start) - Date.parse(entry.remind_at)) / 60_000));
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(entry.title)}`, `TRIGGER:-PT${minutes}M`, "END:VALARM");
  }

  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar(entries: Entry[], appUrl: string, now = new Date()) {
  const stamp = utcStamp(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//3C OS//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:3C OS",
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...entries
      .filter((entry) => (entry.type === "evento" && entry.starts_at) || (entry.type === "tarefa" && entry.due_at && !entry.done_at))
      .flatMap((entry) => eventLines(entry, appUrl, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
