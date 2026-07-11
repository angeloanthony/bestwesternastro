// Recently Viewed attractions (M4, Part 2). Deliberately CLIENT-ONLY: the site
// has no per-attraction routes to track server-side, and a browsing trail is
// low-value, high-churn data not worth a DB round-trip or a schema. We keep the
// last few viewed slugs in localStorage, per browser. Safe to call during SSR
// (guards `window`); never throws on private-mode / quota errors.
const KEY = 'ap.recentlyViewed';
const MAX = 6;

export function getRecentlyViewed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Record a view: moves the slug to the front, de-duplicated, capped at MAX. */
export function recordView(slug: string): string[] {
  if (typeof window === 'undefined') return [];
  const next = [slug, ...getRecentlyViewed().filter((s) => s !== slug)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private-mode failures — recently-viewed is best-effort */
  }
  return next;
}
