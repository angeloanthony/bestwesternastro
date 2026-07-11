/** @jsxImportSource preact */
// "My Adventures" (M4, Part 2). Three sub-sections with graceful empty states:
//   • Saved Adventures  — the member's favorites
//   • Recently Viewed   — client-side trail (localStorage)
//   • Recommended Next  — deterministic: top attractions they haven't saved,
//                         ranked by interest overlap then editorial priority
// State (favorites, recently, interests) is owned by PassMemberHome and passed
// in — this component is presentational plus the recommendation rule.
import { ATTRACTIONS, getAttraction, type InterestId } from '../data/attractions';
import { AttractionCard, H2, H3, MUTED } from './pass-ui';

function recommend(
  favorites: string[],
  interests: InterestId[],
  limit = 3
): ReturnType<typeof getAttraction>[] {
  const saved = new Set(favorites);
  return ATTRACTIONS.filter((a) => !saved.has(a.slug))
    .map((a) => ({
      a,
      overlap: a.interests.filter((i) => interests.includes(i)).length,
    }))
    .sort((x, y) => y.overlap - x.overlap || x.a.priority - y.a.priority)
    .slice(0, limit)
    .map((r) => r.a);
}

export default function PassMyAdventures({
  favorites,
  recently,
  interests,
  saving,
  onToggle,
  onView,
}: {
  favorites: string[];
  recently: string[];
  interests: InterestId[];
  saving: Set<string>;
  onToggle: (slug: string) => void;
  onView: (slug: string) => void;
}) {
  const saved = favorites.map(getAttraction).filter(Boolean);
  const recent = recently.map(getAttraction).filter(Boolean);
  const recommended = recommend(favorites, interests);
  const savedSet = new Set(favorites);

  return (
    <section class="grid gap-6">
      <h2 class={H2}>My Adventures</h2>

      {/* Saved Adventures */}
      <div class="grid gap-3">
        <h3 class={H3}>❤️ Saved Adventures</h3>
        {saved.length === 0 ? (
          <p class={MUTED}>
            You haven’t saved anything yet. Tap the heart on any place below and it’ll wait for you
            here.
          </p>
        ) : (
          <div class="grid gap-3 sm:grid-cols-2">
            {saved.map((a) => (
              <AttractionCard
                key={a!.slug}
                attraction={a!}
                saved
                busy={saving.has(a!.slug)}
                onToggle={() => onToggle(a!.slug)}
                onView={() => onView(a!.slug)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recently Viewed */}
      {recent.length > 0 && (
        <div class="grid gap-2">
          <h3 class={H3}>🕒 Recently Viewed</h3>
          <ul class="flex flex-wrap gap-2">
            {recent.map((a) => (
              <li key={a!.slug}>
                <a
                  href={a!.href}
                  onClick={() => onView(a!.slug)}
                  class="inline-flex items-center gap-1 rounded-full border border-[#1a2e52]/15 bg-white px-3 py-1 text-sm text-[#1a2e52] transition hover:bg-[#1a2e52]/5"
                >
                  <span aria-hidden="true">{a!.emoji}</span>
                  {a!.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Next */}
      <div class="grid gap-3">
        <h3 class={H3}>✨ Recommended Next</h3>
        <p class={MUTED}>
          {interests.length
            ? 'Picked from what you told the trip planner you’re into.'
            : 'Popular with guests. Set your interests in the trip planner to tailor these.'}
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          {recommended.map((a) => (
            <AttractionCard
              key={a!.slug}
              attraction={a!}
              saved={savedSet.has(a!.slug)}
              busy={saving.has(a!.slug)}
              onToggle={() => onToggle(a!.slug)}
              onView={() => onView(a!.slug)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
