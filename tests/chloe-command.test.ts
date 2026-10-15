import { describe, expect, it } from "vitest";
import { parseNaturalDate } from "@/lib/central/natural-date";
import { interpretCommand } from "@/lib/chloe/command";

// Quarta-feira, 14/10/2026, 10:00 em São Paulo.
const now = new Date("2026-10-14T13:00:00Z");

describe("novas expressões de data", () => {
  it("entende daqui a pouco e daqui a N minutos", () => {
    expect(parseNaturalDate("tirar a roupa daqui a pouco", now)).toMatchObject({ text: "tirar a roupa", at: "2026-10-14T13:30:00.000Z" });
    expect(parseNaturalDate("ligar daqui a 2 horas", now).at).toBe("2026-10-14T15:00:00.000Z");
  });

  it("entende dia do mês sem o mês", () => {
    expect(parseNaturalDate("dia 20 prova às 19h", now)).toMatchObject({ text: "prova", at: "2026-10-20T22:00:00.000Z" });
    expect(parseNaturalDate("dia 3 pagar aluguel", now).at).toBe("2026-11-03T12:00:00.000Z");
  });
});

describe("comandos da Chloe", () => {
  it("cria lembrete com horário", () => {
    expect(interpretCommand("me lembra daqui a pouco de tirar o bolo", now)).toEqual({
      kind: "lembrete",
      title: "Tirar o bolo",
      at: "2026-10-14T13:30:00.000Z",
    });
  });

  it("lembrete sem horário vira tarefa", () => {
    expect(interpretCommand("me lembra de comprar café", now)).toEqual({ kind: "tarefa", title: "Comprar café", at: null });
  });

  it("cria evento com dia e hora", () => {
    expect(interpretCommand("dia 20 tenho prova às 19h", now)).toEqual({
      kind: "evento",
      title: "Prova",
      start: "2026-10-20T22:00:00.000Z",
      allDay: false,
    });
  });

  it("evento sem hora fica o dia todo", () => {
    expect(interpretCommand("sexta tenho viagem para BH", now)).toEqual({ kind: "evento", title: "Viagem para BH", start: "2026-10-16", allDay: true });
  });

  it("anota nota e ideia", () => {
    expect(interpretCommand("anota aí: o cliente prefere azul", now)).toMatchObject({ kind: "nota", title: "O cliente prefere azul" });
    expect(interpretCommand("ideia: app de caronas da PUC", now)).toMatchObject({ kind: "ideia", title: "App de caronas da PUC" });
  });

  it("tarefa com prazo", () => {
    expect(interpretCommand("preciso pagar o boleto amanhã", now)).toEqual({ kind: "tarefa", title: "Pagar o boleto", at: "2026-10-15T12:00:00.000Z" });
  });

  it("consultas de agenda", () => {
    expect(interpretCommand("o que tenho amanhã?", now)).toEqual({ kind: "consulta", from: "2026-10-15", to: "2026-10-15", label: "amanhã" });
    expect(interpretCommand("minha agenda", now)).toMatchObject({ kind: "consulta", from: "2026-10-14", label: "hoje" });
    expect(interpretCommand("o que tenho essa semana", now)).toMatchObject({ from: "2026-10-14", to: "2026-10-20" });
  });

  it("pedido de vigia de preço", () => {
    expect(interpretCommand("quero comprar um monitor, me avise quando estiver em promoção", now)).toEqual({ kind: "vigia", product: "Monitor", target: null });
    expect(interpretCommand("vigia o preço do iPhone 15 até R$ 3.500", now)).toEqual({ kind: "vigia", product: "iPhone 15", target: 3500 });
    expect(interpretCommand("me avisa quando o tênis Nike baixar o preço, até 400 reais", now)).toMatchObject({ kind: "vigia", target: 400 });
  });

  it("texto solto vira nota e vazio é ignorado", () => {
    expect(interpretCommand("frase que não é comando", now)).toMatchObject({ kind: "nota" });
    expect(interpretCommand("   ", now)).toBeNull();
  });
});
