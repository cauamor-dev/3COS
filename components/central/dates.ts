const TIME_ZONE = "America/Sao_Paulo";

const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return dateTimeFormat.format(new Date(iso));
}

/** yyyy-mm-dd in São Paulo time. */
export function dayKey(at: string | number | Date) {
  return keyFormat.format(new Date(at));
}

export function dayLabel(key: string, todayKey: string) {
  const diff = Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`)) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return dayFormat.format(new Date(`${key}T12:00:00-03:00`)).replace(".", "");
}

/** Value for <input type="datetime-local"> from an ISO string, in local browser time. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export const REMINDER_OPTIONS = [
  { value: "none", label: "Sem lembrete", minutes: null },
  { value: "0", label: "Na hora", minutes: 0 },
  { value: "10", label: "10 min antes", minutes: 10 },
  { value: "60", label: "1 hora antes", minutes: 60 },
  { value: "1440", label: "1 dia antes", minutes: 1440 },
] as const;

export function reminderFrom(baseIso: string | undefined, option: string) {
  const choice = REMINDER_OPTIONS.find((o) => o.value === option);
  if (!baseIso || !choice || choice.minutes === null) return undefined;
  return new Date(Date.parse(baseIso) - choice.minutes * 60_000).toISOString();
}
