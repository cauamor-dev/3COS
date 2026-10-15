import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { collectNews } from "./collector";
import { parseFeed } from "./parse";
import { keywordHits, newsScore, type NewsSettings } from "./ranking";

export interface NewsItem {
  id: string;
  feed_id: string;
  title: string;
  summary: string;
  url: string;
  image_url: string | null;
  published_at: string;
  topic: string;
  read_at: string | null;
  saved: boolean;
  source: string;
  hits: string[];
}

export interface NewsFeed {
  id: string;
  url: string;
  name: string;
  topic: string;
  enabled: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
}

export const newsSettingsSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(40)).max(40),
  mutedTopics: z.array(z.string().trim().min(1).max(60)).max(20),
});

export const newsFeedInput = z.object({
  url: z.url().max(500),
  name: z.string().trim().min(1).max(80),
  topic: z.string().trim().min(1).max(60),
});
export type NewsFeedInput = z.infer<typeof newsFeedInput>;

const DEFAULT_SETTINGS: NewsSettings = { keywords: [], mutedTopics: [] };

export interface NewsListOptions {
  /** Only items newer than this many hours. */
  hours?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface NewsStore {
  items(options?: NewsListOptions): Promise<NewsItem[]>;
  get(id: string): Promise<NewsItem | null>;
  feeds(): Promise<NewsFeed[]>;
  settings(): Promise<NewsSettings>;
  saveSettings(settings: NewsSettings): Promise<void>;
  markRead(ids: string[], read: boolean): Promise<void>;
  setSaved(id: string, saved: boolean): Promise<void>;
  addFeed(input: NewsFeedInput): Promise<NewsFeed>;
  setFeedEnabled(id: string, enabled: boolean): Promise<void>;
  removeFeed(id: string): Promise<void>;
  refresh(feedId?: string): Promise<{ feeds: number; items: number }>;
}

/** Best items first, muted topics removed, with the matched interests attached. */
export function rankNews(items: NewsItem[], settings: NewsSettings, now = Date.now()) {
  return items
    .map((item) => ({ item: { ...item, hits: keywordHits(item, settings.keywords) }, score: newsScore(item, settings, now) }))
    .filter((ranked) => ranked.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .map((ranked) => ranked.item);
}

const ITEM_COLUMNS = "id, feed_id, title, summary, url, image_url, published_at, topic, read_at, saved, news_feeds(name)";

type ItemRow = Omit<NewsItem, "source" | "hits"> & { news_feeds: { name: string } | { name: string }[] | null };

function toItem(row: ItemRow): NewsItem {
  const feed = Array.isArray(row.news_feeds) ? row.news_feeds[0] : row.news_feeds;
  const { news_feeds: _feed, ...rest } = row;
  // "" means the collector looked for an image and found none.
  return { ...rest, image_url: rest.image_url || null, source: feed?.name ?? "", hits: [] };
}

function check<T>(result: { data: T; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export class SupabaseNewsStore implements NewsStore {
  constructor(private readonly db: SupabaseClient) {}

  async items({ hours = 72, limit = 150, unreadOnly = false }: NewsListOptions = {}) {
    let query = this.db
      .from("news_items")
      .select(ITEM_COLUMNS)
      .gte("published_at", new Date(Date.now() - hours * 3_600_000).toISOString())
      .order("published_at", { ascending: false })
      .limit(limit);
    if (unreadOnly) query = query.is("read_at", null);
    return (check(await query) as unknown as ItemRow[]).map(toItem);
  }

  async get(id: string) {
    const row = check(await this.db.from("news_items").select(ITEM_COLUMNS).eq("id", id).maybeSingle());
    return row ? toItem(row as unknown as ItemRow) : null;
  }

  async feeds() {
    return check(
      await this.db.from("news_feeds").select("id, url, name, topic, enabled, last_fetched_at, last_error").order("topic").order("name"),
    ) as NewsFeed[];
  }

  async settings() {
    const row = check(await this.db.from("settings").select("value").eq("key", "news").maybeSingle());
    const parsed = newsSettingsSchema.safeParse(row?.value);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  }

  async saveSettings(settings: NewsSettings) {
    check(await this.db.from("settings").upsert({ key: "news", value: settings, updated_at: new Date().toISOString() }));
  }

  async markRead(ids: string[], read: boolean) {
    if (!ids.length) return;
    check(await this.db.from("news_items").update({ read_at: read ? new Date().toISOString() : null }).in("id", ids));
  }

  async setSaved(id: string, saved: boolean) {
    check(await this.db.from("news_items").update({ saved }).eq("id", id));
  }

  async addFeed(input: NewsFeedInput) {
    return check(
      await this.db.from("news_feeds").insert(input).select("id, url, name, topic, enabled, last_fetched_at, last_error").single(),
    ) as NewsFeed;
  }

  async setFeedEnabled(id: string, enabled: boolean) {
    check(await this.db.from("news_feeds").update({ enabled }).eq("id", id));
  }

  async removeFeed(id: string) {
    check(await this.db.from("news_feeds").delete().eq("id", id));
  }

  refresh(feedId?: string) {
    return collectNews(this.db, feedId);
  }
}

/** In-memory store for demo mode; pulls a few real feeds once so the UI shows real images. */
export class MemoryNewsStore implements NewsStore {
  private list: NewsItem[] = [];
  private feedList: NewsFeed[] = [
    { id: "f1", url: "https://tecnoblog.net/feed/", name: "Tecnoblog", topic: "Tecnologia BR", enabled: true, last_fetched_at: null, last_error: null },
    { id: "f2", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", name: "The Verge · IA", topic: "IA", enabled: true, last_fetched_at: null, last_error: null },
    { id: "f3", url: "https://devblogs.microsoft.com/dotnet/feed/", name: ".NET Blog", topic: "Dev", enabled: true, last_fetched_at: null, last_error: null },
    { id: "f4", url: "https://startups.com.br/feed/", name: "Startups", topic: "Startups e negócios", enabled: true, last_fetched_at: null, last_error: null },
  ];
  private prefs: NewsSettings = { keywords: ["Next.js", ".NET", "React", "IA", "Claude", "ChatGPT", "startup"], mutedTopics: [] };
  private loaded: Promise<void> | null = null;

  private ensure() {
    this.loaded ??= this.refresh().then(() => undefined);
    return this.loaded;
  }

  async items({ hours = 72, limit = 150, unreadOnly = false }: NewsListOptions = {}) {
    await this.ensure();
    const since = new Date(Date.now() - hours * 3_600_000).toISOString();
    return this.list
      .filter((item) => item.published_at >= since && (!unreadOnly || !item.read_at))
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, limit);
  }

  async get(id: string) {
    return this.list.find((item) => item.id === id) ?? null;
  }

  async feeds() {
    return this.feedList;
  }

  async settings() {
    return this.prefs;
  }

  async saveSettings(settings: NewsSettings) {
    this.prefs = settings;
  }

  async markRead(ids: string[], read: boolean) {
    for (const item of this.list) if (ids.includes(item.id)) item.read_at = read ? new Date().toISOString() : null;
  }

  async setSaved(id: string, saved: boolean) {
    const item = this.list.find((news) => news.id === id);
    if (item) item.saved = saved;
  }

  async addFeed(input: NewsFeedInput) {
    const feed: NewsFeed = { ...input, id: crypto.randomUUID(), enabled: true, last_fetched_at: null, last_error: null };
    this.feedList.push(feed);
    return feed;
  }

  async setFeedEnabled(id: string, enabled: boolean) {
    const feed = this.feedList.find((f) => f.id === id);
    if (feed) feed.enabled = enabled;
  }

  async removeFeed(id: string) {
    this.feedList = this.feedList.filter((feed) => feed.id !== id);
    this.list = this.list.filter((item) => item.feed_id !== id);
  }

  async refresh(feedId?: string) {
    const targets = this.feedList.filter((feed) => feed.enabled && (!feedId || feed.id === feedId));
    let count = 0;
    await Promise.all(
      targets.map(async (feed) => {
        try {
          const response = await fetch(feed.url, { signal: AbortSignal.timeout(8_000) });
          const parsed = parseFeed(await response.text(), feed.url).slice(0, 12);
          for (const item of parsed) {
            if (this.list.some((news) => news.feed_id === feed.id && news.url === item.url)) continue;
            count++;
            this.list.push({
              id: crypto.randomUUID(),
              feed_id: feed.id,
              title: item.title,
              summary: item.summary,
              url: item.url,
              image_url: item.imageUrl,
              published_at: item.publishedAt,
              topic: feed.topic,
              read_at: null,
              saved: false,
              source: feed.name,
              hits: [],
            });
          }
          feed.last_fetched_at = new Date().toISOString();
          feed.last_error = null;
        } catch (error) {
          feed.last_error = error instanceof Error ? error.message : String(error);
        }
      }),
    );
    return { feeds: targets.length, items: count };
  }
}
