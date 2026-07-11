/** @jsxImportSource preact */
// "Browse & Save" (M4, Part 1). The full Vernal attraction catalogue with a
// ❤️ save toggle on each — this is where favorites get created. A lightweight
// interest filter (client-only) helps guests narrow a long list. Saving and
// view-tracking are lifted to PassMemberHome so every section stays in sync.
import { useState } from 'preact/hooks';
import { ATTRACTIONS, INTERESTS, type InterestId } from '../data/attractions';
import { AttractionCard, H2, MUTED } from './pass-ui';

export default function PassAdventureBrowser({
  favorites,
  saving,
  onToggle,
  onView,
}: {
  favorites: string[];
  saving: Set<string>;
  onToggle: (slug: string) => void;
  onView: (slug: string) => void;
}) {
  const [filter, setFilter] = useState<InterestId | null>(null);
  const savedSet = new Set(favorites);

  const shown = filter ? ATTRACTIONS.filter((a) => a.interests.includes(filter)) : ATTRACTIONS;

  return (
    <section class="grid gap-4">
      <div>
        <h2 class={H2}>Browse &amp; save adventures</h2>
        <p class={MUTED}>Everything within an hour of the hotel. Tap ❤️ to save it to your Pass.</p>
      </div>

      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by interest">
        <button
          type="button"
          onClick={() => setFilter(null)}
          aria-pressed={filter === null}
          class={`rounded-full border px-3 py-1 text-sm transition ${
            filter === null
              ? 'border-[#c9a84c] bg-[#fdf8f0] font-semibold text-[#1a2e52]'
              : 'border-[#1a2e52]/20 text-[#1a2e52] hover:bg-[#1a2e52]/5'
          }`}
        >
          All
        </button>
        {INTERESTS.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setFilter(filter === i.id ? null : i.id)}
            aria-pressed={filter === i.id}
            class={`rounded-full border px-3 py-1 text-sm transition ${
              filter === i.id
                ? 'border-[#c9a84c] bg-[#fdf8f0] font-semibold text-[#1a2e52]'
                : 'border-[#1a2e52]/20 text-[#1a2e52] hover:bg-[#1a2e52]/5'
            }`}
          >
            <span aria-hidden="true">{i.emoji}</span> {i.label}
          </button>
        ))}
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        {shown.map((a) => (
          <AttractionCard
            key={a.slug}
            attraction={a}
            saved={savedSet.has(a.slug)}
            busy={saving.has(a.slug)}
            onToggle={() => onToggle(a.slug)}
            onView={() => onView(a.slug)}
          />
        ))}
      </div>
    </section>
  );
}
