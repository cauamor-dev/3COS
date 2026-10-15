export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface Truncated {
  text: string;
  truncated: boolean;
  total_chars: number;
}

export function truncate(text: string, max: number): Truncated {
  if (text.length <= max) return { text, truncated: false, total_chars: text.length };
  const cut = text.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  const clean = lastBreak > max * 0.8 ? cut.slice(0, lastBreak) : cut;
  return { text: `${clean.trimEnd()}…`, truncated: true, total_chars: text.length };
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => slugify(tag)).filter(Boolean))];
}
