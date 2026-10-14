"use client";

import { useNow } from "@/hooks/use-now";

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const absolute = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function formatRelative(date: string, now = Date.now()) {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "agora";
}

export function TimeAgo({ date, className }: { date: string; className?: string }) {
  const now = useNow();

  return (
    <time dateTime={date} title={absolute.format(new Date(date))} className={className}>
      {now === null ? absolute.format(new Date(date)) : formatRelative(date, now)}
    </time>
  );
}
