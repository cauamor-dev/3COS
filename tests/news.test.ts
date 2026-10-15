import { describe, expect, it } from "vitest";
import { extractOgImage, parseFeed, stripHtml } from "@/lib/news/parse";
import { keywordHits, newsScore } from "@/lib/news/ranking";
import { rankNews, type NewsItem } from "@/lib/news/store";

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Tecnoblog</title>
    <item>
      <title>Next.js 17 chega com &lt;novidades&gt;</title>
      <link>https://tecnoblog.net/next-17</link>
      <guid isPermaLink="false">tb-123</guid>
      <pubDate>Wed, 14 Oct 2026 12:00:00 -0300</pubDate>
      <description><![CDATA[<p>O <b>framework</b> da Vercel&nbsp;ganhou cache novo.</p>]]></description>
      <media:content url="https://img.tecnoblog.net/next.jpg" medium="image" />
    </item>
    <item>
      <title>Sem imagem na mídia</title>
      <link>/relativo</link>
      <content:encoded><![CDATA[<p>Texto</p><img src="https://cdn.site/foto.png" />]]></content:encoded>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Simon Willison</title>
  <entry>
    <title>Claude ganha novo modo</title>
    <link href="https://simonwillison.net/2026/Oct/14/claude/" rel="alternate" />
    <id>tag:simonwillison.net,2026:1</id>
    <published>2026-10-14T15:00:00Z</published>
    <summary type="html">Resumo com &lt;em&gt;HTML&lt;/em&gt;</summary>
  </entry>
</feed>`;

describe("leitor de feeds", () => {
  it("lê RSS com imagem de mídia, HTML no resumo e entidades", () => {
    const [first, second] = parseFeed(rss, "https://tecnoblog.net/feed/", new Date("2026-10-15T00:00:00Z"));
    expect(first).toEqual({
      guid: "tb-123",
      title: "Next.js 17 chega com <novidades>",
      summary: "O framework da Vercel ganhou cache novo.",
      url: "https://tecnoblog.net/next-17",
      imageUrl: "https://img.tecnoblog.net/next.jpg",
      publishedAt: "2026-10-14T15:00:00.000Z",
    });
    expect(second.url).toBe("https://tecnoblog.net/relativo");
    expect(second.imageUrl).toBe("https://cdn.site/foto.png");
    expect(second.publishedAt).toBe("2026-10-15T00:00:00.000Z");
  });

  it("lê Atom com link alternativo e id", () => {
    const [entry] = parseFeed(atom, "https://simonwillison.net/atom/everything/");
    expect(entry).toMatchObject({
      guid: "tag:simonwillison.net,2026:1",
      title: "Claude ganha novo modo",
      url: "https://simonwillison.net/2026/Oct/14/claude/",
      summary: "Resumo com HTML",
      imageUrl: null,
    });
  });

  it("extrai og:image em qualquer ordem de atributos", () => {
    expect(extractOgImage('<meta property="og:image" content="/capa.jpg">', "https://site.com/post")).toBe("https://site.com/capa.jpg");
    expect(extractOgImage('<meta content="https://x.com/a.png" name="twitter:image">', "https://x.com")).toBe("https://x.com/a.png");
  });

  it("limpa HTML com atributos e entidades numéricas, mas preserva texto entre < >", () => {
    expect(stripHtml('<p class="x">Caf&#233; &amp; <a href="/y">c&#xF3;digo</a></p>')).toBe("Café & código");
    expect(stripHtml("Next.js <novidades>")).toBe("Next.js <novidades>");
  });
});

describe("ranking de notícias", () => {
  const base = { title: "", summary: "", topic: "Dev", image_url: null, published_at: "2026-10-15T00:00:00Z", read_at: null };
  const now = Date.parse("2026-10-15T01:00:00Z");

  it("casa palavras curtas só como palavra inteira", () => {
    expect(keywordHits({ title: "Nova IA da Google", summary: "" }, ["IA"])).toEqual(["IA"]);
    expect(keywordHits({ title: "Media e mídia", summary: "" }, ["IA"])).toEqual([]);
    expect(keywordHits({ title: "Vaga para dev .NET", summary: "" }, [".NET", "vagas"])).toEqual([".NET"]);
  });

  it("prioriza interesse e novidade, e esconde tópicos silenciados", () => {
    const settings = { keywords: ["Next.js"], mutedTopics: ["Startups e negócios"] };
    const match = newsScore({ ...base, title: "Next.js 17" }, settings, now);
    const plain = newsScore({ ...base, title: "Outra coisa" }, settings, now);
    const old = newsScore({ ...base, title: "Next.js 16", published_at: "2026-10-10T00:00:00Z" }, settings, now);
    const muted = newsScore({ ...base, topic: "Startups e negócios" }, settings, now);
    expect(match).toBeGreaterThan(plain);
    expect(match).toBeGreaterThan(old);
    expect(muted).toBe(-Infinity);
  });
});

describe("ordem das notícias", () => {
  const item = (id: string, title: string, topic = "Dev", hoursAgo = 1): NewsItem => ({
    id,
    feed_id: "f",
    title,
    summary: "",
    url: `https://site.com/${id}`,
    image_url: null,
    published_at: new Date(Date.parse("2026-10-15T12:00:00Z") - hoursAgo * 3_600_000).toISOString(),
    topic,
    read_at: null,
    saved: false,
    source: "Site",
    hits: [],
  });

  it("põe interesses primeiro, marca o que casou e tira tópicos silenciados", () => {
    const ranked = rankNews(
      [item("a", "Notícia qualquer"), item("b", "Saiu o Next.js 17", "Dev", 3), item("c", "Rodada de investimento", "Startups")],
      { keywords: ["Next.js"], mutedTopics: ["Startups"] },
      Date.parse("2026-10-15T12:00:00Z"),
    );
    expect(ranked.map((n) => n.id)).toEqual(["b", "a"]);
    expect(ranked[0].hits).toEqual(["Next.js"]);
  });
});
