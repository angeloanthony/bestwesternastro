/** @jsxImportSource preact */
// Shared presentational bits for the M4 Adventure Pass member sections. Keeps
// the navy/gold styling identical across My Adventures, the browser, and the
// planner (same palette the M2 islands use: navy #1a2e52, gold #c9a84c).
import type { Attraction } from '../data/attractions';

export const CARD = 'rounded-lg border border-[#1a2e52]/15 bg-white p-5';
export const H2 = 'text-lg font-bold text-[#1a2e52]';
export const H3 = 'text-base font-bold text-[#1a2e52]';
export const MUTED = 'text-sm text-[#1a2e52]/70';
export const FIELD =
  'w-full rounded-md border border-[#1a2e52]/30 bg-white px-3 py-2 text-[#1a2e52] ' +
  'outline-none focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/40';
export const LABEL = 'mb-1 block text-sm font-semibold text-[#1a2e52]';
export const BTN_PRIMARY =
  'rounded-md bg-[#1a2e52] px-5 py-2.5 font-bold text-white transition hover:bg-[#26406e] disabled:opacity-60';
export const BTN_GOLD =
  'rounded-md bg-[#c9a84c] px-5 py-2.5 font-bold text-[#0e1c33] transition hover:bg-[#e0bb5a] disabled:opacity-60';
export const BTN_GHOST =
  'rounded-md border border-[#1a2e52]/30 px-4 py-2 text-sm font-semibold text-[#1a2e52] transition hover:bg-[#1a2e52]/5 disabled:opacity-60';

/** ❤️ save toggle. `aria-pressed` conveys saved state to assistive tech. */
export function Heart({
  active,
  busy,
  onToggle,
  label,
}: {
  active: boolean;
  busy: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? `Remove ${label} from saved` : `Save ${label}`}
      title={active ? 'Saved — tap to remove' : 'Save this adventure'}
      class="shrink-0 rounded-full border border-[#1a2e52]/15 px-2 py-1 text-lg leading-none transition hover:bg-[#1a2e52]/5 disabled:opacity-50"
    >
      {active ? '❤️' : '🤍'}
    </button>
  );
}

/** One attraction, as a card. Used by the browser and the saved list. */
export function AttractionCard({
  attraction,
  saved,
  busy,
  onToggle,
  onView,
}: {
  attraction: Attraction;
  saved: boolean;
  busy: boolean;
  onToggle: () => void;
  onView: () => void;
}) {
  return (
    <div class="flex gap-3 rounded-lg border border-[#1a2e52]/12 bg-white p-4">
      <span class="text-2xl leading-none" aria-hidden="true">
        {attraction.emoji}
      </span>
      <div class="min-w-0 grow">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-wide text-[#c9a84c]">{attraction.category}</p>
            <h4 class="font-bold text-[#1a2e52]">{attraction.name}</h4>
          </div>
          <Heart active={saved} busy={busy} onToggle={onToggle} label={attraction.name} />
        </div>
        <p class="mt-1 text-sm text-[#1a2e52]/80">{attraction.blurb}</p>
        <div class="mt-2 flex items-center gap-3 text-xs text-[#1a2e52]/70">
          <span>~{attraction.driveMinutes} min drive</span>
          <a
            href={attraction.href}
            onClick={onView}
            class="font-semibold text-[#1a2e52] underline decoration-[#c9a84c] underline-offset-2"
          >
            Learn more →
          </a>
        </div>
      </div>
    </div>
  );
}
