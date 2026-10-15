import { describe, expect, it } from "vitest";
import { buildCalendar } from "@/lib/central/ics";
import type { Entry } from "@/lib/central/types";

const base: Entry = {
  id: "11111111-1111-1111-1111-111111111111",
  area_id: "a",
  area: { slug: "faculdade", name: "Faculdade" },
  type: "evento",
  title: "Prova, Grafos; parte 1",
  content_md: "",
  tags: [],
  source: "claude",
  updated_by: "claude",
  pinned: false,
  archived: false,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  starts_at: "2026-11-03T22:00:00Z",
  ends_at: "2026-11-04T01:30:00Z",
  all_day: false,
  location: "PUC Betim",
  recurrence: "semanal",
  due_at: null,
  done_at: null,
  remind_at: "2026-11-03T11:00:00Z",
  reminded_at: null,
  links: [],
  image_url: null,
};

describe("feed ICS", () => {
  it("gera VEVENT com recorrência, alarme e texto escapado", () => {
    const ics = buildCalendar([base], "https://app.test", new Date("2026-10-15T00:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261103T220000Z");
    expect(ics).toContain("DTEND:20261104T013000Z");
    expect(ics).toContain("RRULE:FREQ=WEEKLY");
    expect(ics).toContain(String.raw`SUMMARY:Prova\, Grafos\; parte 1`);
    expect(ics).toContain("TRIGGER:-PT660M");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("usa data local em eventos de dia inteiro e inclui prazos pendentes", () => {
    const allDay = { ...base, all_day: true, starts_at: "2026-12-10T03:00:00Z", ends_at: null, recurrence: null, remind_at: null };
    const task = { ...base, id: "t", type: "tarefa" as const, starts_at: null, due_at: "2026-10-20T21:00:00Z", recurrence: null, remind_at: null };
    const done = { ...task, id: "d", done_at: "2026-10-19T00:00:00Z" };
    const ics = buildCalendar([allDay, task, done], "https://app.test");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261210");
    expect(ics).toContain("SUMMARY:Prazo: Prova");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
