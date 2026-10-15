import { describe, expect, it } from "vitest";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService, type NewsSource } from "@/lib/central/service";

const now = Date.now();
const story = (title: string, topic: string, hoursAgo: number) => ({
  title,
  summary: `${title} resumo`,
  topic,
  url: `https://exemplo.com/${encodeURIComponent(title)}`,
  source: "Fonte",
  image_url: null,
  published_at: new Date(now - hoursAgo * 3_600_000).toISOString(),
  read_at: null,
});

const source: NewsSource = {
  items: async () => [story("Next.js 17 lançado", "Dev", 2), story("Nova rodada de startups", "Startups", 1), story("Claude ganha memória", "IA", 3)],
  settings: async () => ({ keywords: ["Claude"], mutedTopics: ["Startups"] }),
};

describe("ver_noticias", () => {
  it("ordena pelos interesses, respeita tópicos silenciados e filtra por tópico", async () => {
    const central = new CentralService(new MemoryRepository(), source);
    const all = await central.news();
    expect(all.noticias.map((n) => n.titulo)).toEqual(["Claude ganha memória", "Next.js 17 lançado"]);
    expect(all.noticias[0].interesses).toEqual(["Claude"]);

    const dev = await central.news({ topico: "dev", limite: 5 });
    expect(dev.noticias.map((n) => n.titulo)).toEqual(["Next.js 17 lançado"]);
  });

  it("avisa quando não há fonte de notícias", async () => {
    await expect(new CentralService(new MemoryRepository()).news()).rejects.toThrow("Notícias indisponíveis");
  });
});
