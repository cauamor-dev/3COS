import { describe, expect, it } from "vitest";
import { normalizeTags, slugify, titleFromSlug, truncate } from "@/lib/central/text";

describe("slugify", () => {
  it("remove acentos, espaços e caixa alta", () => {
    expect(slugify("Faculdade — Grafos & Algoritmos")).toBe("faculdade-grafos-algoritmos");
    expect(slugify("  Ação Já!  ")).toBe("acao-ja");
    expect(slugify("ORION")).toBe("orion");
  });

  it("retorna vazio quando não sobra nada", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("limita o tamanho sem terminar em hífen", () => {
    const slug = slugify("a".repeat(59) + " bbbb");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("truncate", () => {
  it("não mexe em texto curto", () => {
    expect(truncate("curto", 10)).toEqual({ text: "curto", truncated: false, total_chars: 5 });
  });

  it("corta no limite e informa o tamanho original", () => {
    const text = "palavra ".repeat(50);
    const result = truncate(text, 100);
    expect(result.truncated).toBe(true);
    expect(result.total_chars).toBe(text.length);
    expect(result.text.length).toBeLessThanOrEqual(101);
    expect(result.text.endsWith("…")).toBe(true);
  });
});

describe("helpers", () => {
  it("normaliza tags e remove duplicadas", () => {
    expect(normalizeTags(["Front End", "front-end", "Deploy"])).toEqual(["front-end", "deploy"]);
  });

  it("gera título a partir do slug", () => {
    expect(titleFromSlug("faculdade-grafos")).toBe("Faculdade Grafos");
  });
});
