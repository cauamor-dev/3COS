import { XMLParser } from "fast-xml-parser";

export interface ParsedItem {
  guid: string;
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
}

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ["item", "entry", "link", "media:content", "media:thumbnail", "enclosure", "category"].includes(name),
});

// Only real HTML tags are removed, so a title like "Next.js <novidades>" survives decoding.
const HTML_TAG =
  /<\/?(?:a|abbr|article|b|blockquote|br|cite|code|div|em|figcaption|figure|footer|h[1-6]|header|hr|i|iframe|img|li|mark|ol|p|path|picture|pre|s|section|small|source|span|strong|sub|sup|svg|table|tbody|td|th|thead|time|tr|u|ul|video)(?=[\s/>])[^>]*>/gi;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object") return text((value as Node)["#text"]);
  return "";
}

export function stripHtml(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(HTML_TAG, " ")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (match, code: string) => {
      if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, max = 280) {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

function firstImageInHtml(html: string) {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function mediaUrl(list: unknown, accept: (node: Node) => boolean = () => true): string | null {
  if (!Array.isArray(list)) return null;
  const found = (list as Node[]).find((node) => typeof node["@_url"] === "string" && accept(node));
  return (found?.["@_url"] as string | undefined) ?? null;
}

function isImage(node: Node) {
  const type = String(node["@_type"] ?? node["@_medium"] ?? "");
  const url = String(node["@_url"] ?? "");
  return type.startsWith("image") || type === "" || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

function absolute(url: string | null, base: string) {
  if (!url) return null;
  try {
    const resolved = new URL(url, base);
    return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.href : null;
  } catch {
    return null;
  }
}

function date(value: string, fallback: Date) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : fallback.toISOString();
}

function atomLink(links: unknown): string {
  if (!Array.isArray(links)) return text(links);
  const nodes = links as Node[];
  const alternate = nodes.find((link) => !link["@_rel"] || link["@_rel"] === "alternate") ?? nodes[0];
  return String(alternate?.["@_href"] ?? text(alternate));
}

export function parseFeed(xml: string, feedUrl: string, now = new Date()): ParsedItem[] {
  const doc = parser.parse(xml) as Node;
  const rss = doc.rss as Node | undefined;
  const channel = (rss?.channel ?? (doc["rdf:RDF"] as Node | undefined)) as Node | undefined;
  const atom = doc.feed as Node | undefined;
  const rawItems = ((channel?.item ?? (doc["rdf:RDF"] as Node | undefined)?.item ?? atom?.entry ?? []) as Node[]).slice(0, 40);

  return rawItems
    .map((item) => {
      const isAtom = !!atom;
      const link = isAtom ? atomLink(item.link) : text(Array.isArray(item.link) ? item.link[0] : item.link);
      const url = absolute(link.trim(), feedUrl);
      const html = text(item["content:encoded"]) || text(item.content) || text(item.description) || text(item.summary);
      const image =
        mediaUrl(item["media:content"], isImage) ??
        mediaUrl(item["media:thumbnail"]) ??
        mediaUrl((item["media:group"] as Node | undefined)?.["media:content"], isImage) ??
        mediaUrl(item.enclosure, isImage) ??
        firstImageInHtml(html);
      return {
        guid: (text(item.guid) || text(item.id) || link).trim().slice(0, 500),
        title: shorten(stripHtml(text(item.title)), 300),
        summary: shorten(stripHtml(html)),
        url: url ?? "",
        imageUrl: absolute(image, url ?? feedUrl),
        publishedAt: date(text(item.pubDate) || text(item.published) || text(item.updated) || text(item["dc:date"]), now),
      };
    })
    .filter((item) => item.title && item.url && item.guid);
}

/** Pulls og:image / twitter:image from an article page. */
export function extractOgImage(html: string, pageUrl: string) {
  const match =
    html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  return absolute(match?.[1] ?? null, pageUrl);
}
