import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractOgImage, parseFeed } from "./parse";

const USER_AGENT = "Mozilla/5.0 (compatible; 3C-OS/1.0; +https://central3c-caua.vercel.app)";
const ITEMS_PER_FEED = 15;
const OG_LOOKUPS_PER_RUN = 12;

interface FeedRow {
  id: string;
  url: string;
  topic: string;
}

async function fetchText(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/html;q=0.8" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function collectFeed(db: SupabaseClient, feed: FeedRow) {
  try {
    const items = parseFeed(await fetchText(feed.url, 10_000), feed.url)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, ITEMS_PER_FEED);
    if (items.length) {
      const { error } = await db.from("news_items").upsert(
        items.map((item) => ({
          feed_id: feed.id,
          guid: item.guid,
          title: item.title,
          summary: item.summary,
          url: item.url,
          image_url: item.imageUrl,
          published_at: item.publishedAt,
          topic: feed.topic,
        })),
        { onConflict: "feed_id,guid", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    }
    await db.from("news_feeds").update({ last_fetched_at: new Date().toISOString(), last_error: null }).eq("id", feed.id);
    return items.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("news_feeds").update({ last_fetched_at: new Date().toISOString(), last_error: message.slice(0, 300) }).eq("id", feed.id);
    return 0;
  }
}

/** Fills missing images from each article's og:image, a few per run to stay fast. */
async function fillImages(db: SupabaseClient) {
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data } = await db
    .from("news_items")
    .select("id, url")
    .is("image_url", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(OG_LOOKUPS_PER_RUN);

  await Promise.allSettled(
    (data ?? []).map(async (item) => {
      const html = await fetchText(item.url, 5_000);
      // Empty string marks "looked, nothing found" so the item isn't retried every run.
      const image = extractOgImage(html.slice(0, 200_000), item.url) ?? "";
      await db.from("news_items").update({ image_url: image }).eq("id", item.id);
    }),
  );
}

export async function collectNews(db: SupabaseClient, onlyFeedId?: string) {
  let query = db.from("news_feeds").select("id, url, topic").eq("enabled", true);
  if (onlyFeedId) query = query.eq("id", onlyFeedId);
  const { data: feeds, error } = await query;
  if (error) throw new Error(error.message);

  const counts: number[] = [];
  // Small batches keep the function well inside its time limit even when a source is slow.
  for (let i = 0; i < (feeds ?? []).length; i += 6) {
    counts.push(...(await Promise.all(feeds!.slice(i, i + 6).map((feed) => collectFeed(db, feed)))));
  }
  await fillImages(db);
  return { feeds: feeds?.length ?? 0, items: counts.reduce((sum, n) => sum + n, 0) };
}
