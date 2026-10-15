import { describe, expect, it } from "vitest";
import { parseNaturalDate } from "@/lib/central/natural-date";

// Quarta-feira, 14/10/2026, 10:00 em São Paulo.
const now = new Date("2026-10-14T13:00:00Z");

describe("datas em linguagem natural", () => {
  it("entende amanhã com horário", () => {
    expect(parseNaturalDate("me lembra amanhã às 9h de ligar pro Lott", now)).toEqual({
      text: "ligar pro Lott",
      at: "2026-10-15T12:00:00.000Z",
      hasTime: true,
    });
  });

  it("entende dia da semana e minutos", () => {
    const parsed = parseNaturalDate("reunião Axial sexta 14:30", now);
    expect(parsed.text).toBe("reunião Axial");
    expect(parsed.at).toBe("2026-10-16T17:30:00.000Z");
  });

  it("entende tempo relativo", () => {
    expect(parseNaturalDate("tirar o bolo em 30 min", now).at).toBe("2026-10-14T13:30:00.000Z");
  });

  it("entende data explícita e usa 9h quando não há horário", () => {
    const parsed = parseNaturalDate("pagar boleto 20/10", now);
    expect(parsed).toMatchObject({ text: "pagar boleto", at: "2026-10-20T12:00:00.000Z", hasTime: false });
  });

  it("joga horário passado para o dia seguinte", () => {
    expect(parseNaturalDate("academia 8h", now).at).toBe("2026-10-15T11:00:00.000Z");
  });

  it("devolve o texto intacto quando não há data", () => {
    expect(parseNaturalDate("ideia: app de vagas para devs", now)).toEqual({
      text: "ideia: app de vagas para devs",
      at: null,
      hasTime: false,
    });
  });
});
