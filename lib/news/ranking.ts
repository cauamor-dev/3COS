export interface NewsSettings {
  keywords: string[];
  mutedTopics: string[];
}

export interface RankableNews {
  title: string;
  summary: string;
  topic: string;
  image_url: string | null;
  published_at: string;
  read_at: string | null;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function keywordHits(item: Pick<RankableNews, "title" | "summary">, keywords: string[]) {
  const haystack = ` ${normalize(`${item.title} ${item.summary}`)} `;
  return keywords.filter((keyword) => {
    const needle = normalize(keyword.trim());
    if (!needle) return false;
    // Short keywords ("IA", "AI") must match as whole words to avoid noise.
    return needle.length <= 3
      ? new RegExp(`[^a-z0-9]${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(haystack)
      : haystack.includes(needle);
  });
}

/** Higher is better: recent, matching your interests, with an image, unread. */
export function newsScore(item: RankableNews, settings: NewsSettings, now = Date.now()) {
  if (settings.mutedTopics.includes(item.topic)) return -Infinity;
  const ageHours = Math.max(0, (now - Date.parse(item.published_at)) / 3_600_000);
  const freshness = 100 * Math.exp(-ageHours / 18);
  const interest = keywordHits(item, settings.keywords).length * 35;
  const visual = item.image_url ? 8 : 0;
  const unread = item.read_at ? -60 : 0;
  return freshness + interest + visual + unread;
}

/** Best items first, muted topics removed, with the matched interests attached. */
export function rankNews<T extends RankableNews>(items: T[], settings: NewsSettings, now = Date.now()): (T & { hits: string[] })[] {
  return items
    .map((item) => ({ item: { ...item, hits: keywordHits(item, settings.keywords) }, score: newsScore(item, settings, now) }))
    .filter((ranked) => ranked.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .map((ranked) => ranked.item);
}
