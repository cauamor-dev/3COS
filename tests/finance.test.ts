import { describe, expect, it } from "vitest";
import {
  parseFinanceCsv,
  moneyToCents,
  centsToDecimal,
  possibleFinanceMatches,
} from "@/lib/finance/csv";
describe("Finanças sem perda decimal", () => {
  it("avisa correspondências entre arquivos sem eliminar despesas legítimas", () => {
    const r = {
      date: "2026-10-18",
      description: "Café",
      category: "Alimentação",
      direction: "saida" as const,
      amount: "12.50",
    };
    const rows = [r, { ...r }];
    expect(possibleFinanceMatches(rows, [{ ...r, amount: "12,50" }])).toEqual([
      0, 1,
    ]);
    expect(rows).toHaveLength(2);
  });
  it("converte valores brasileiros e recusa formatos perigosos", () => {
    expect(moneyToCents("1.234,56")).toBe(123456);
    expect(centsToDecimal(moneyToCents("0,10"))).toBe("0.10");
    for (const s of ["NaN", "1e3", "-10", "1,234", "0", "9999999999999"])
      expect(() => moneyToCents(s)).toThrow();
  });
  it("preserva duas despesas legítimas e lê aspas, BOM e delimitadores", () => {
    const r = parseFinanceCsv(
      '\uFEFFdata;descricao;categoria;direcao;valor\r\n18/10/2026;"Café; pão";Alimentação;saida;12,50\r\n18/10/2026;"Café; pão";Alimentação;saida;12,50',
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      date: "2026-10-18",
      description: "Café; pão",
      amount: "12.50",
    });
  });
  it("não importa silenciosamente linhas inválidas", () => {
    const r = parseFinanceCsv(
      "data,descricao,direcao,valor\n2026-02-30,X,saida,abc",
    );
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
  });
});
