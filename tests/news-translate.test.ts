import { describe, expect, it } from "vitest";
import { looksEnglish, translatedUrl } from "@/lib/news/translate";

describe("tradução de notícias", () => {
  it("reconhece títulos em inglês e em português", () => {
    expect(looksEnglish("The AI race is back on, and this time it is for real")).toBe(true);
    expect(looksEnglish("Governo anuncia novas regras para o uso de IA nas escolas")).toBe(false);
  });

  it("monta o link do Google Tradutor para a página", () => {
    expect(translatedUrl("https://example.com/a?b=1")).toBe(
      "https://translate.google.com/translate?sl=auto&tl=pt&u=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1",
    );
  });
});
