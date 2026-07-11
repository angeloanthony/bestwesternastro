/** @jsxImportSource preact */
// Trip Status (M4, Part 4). Countdown, trip length, days remaining, season, and
// a packing reminder — all computed deterministically from the trip dates by
// src/lib/trip-plan.tripStatus(). No external APIs (no weather/geo). "Today" is
// the browser's local date, passed in so the pure helper stays testable.
import { tripStatus } from '../lib/trip-plan';
import { CARD, H3, MUTED } from './pass-ui';

function localTodayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function PassTripStatus({
  arrival,
  departure,
}: {
  arrival: string | null;
  departure: string | null;
}) {
  const s = tripStatus(arrival, departure, localTodayISO());
  if (!s.hasDates) return null;

  const tiles: Array<{ label: string; value: string }> = [];
  if (s.phase === 'upcoming' && s.daysUntilArrival !== null)
    tiles.push({ label: 'Countdown', value: s.countdown });
  if (s.phase === 'in-progress') tiles.push({ label: 'Right now', value: s.countdown });
  if (s.days !== null)
    tiles.push({
      label: 'Trip length',
      value: `${s.days} day${s.days === 1 ? '' : 's'}${s.nights ? ` · ${s.nights} night${s.nights === 1 ? '' : 's'}` : ''}`,
    });
  if (s.phase === 'in-progress' && s.daysRemaining !== null)
    tiles.push({
      label: 'Days remaining',
      value: `${s.daysRemaining} day${s.daysRemaining === 1 ? '' : 's'}`,
    });
  if (s.season) tiles.push({ label: 'Season', value: s.season.label });

  return (
    <div class={`${CARD} bg-[#fdf8f0]`}>
      <h3 class={H3}>Trip status</h3>

      {s.phase === 'past' ? (
        <p class="mt-1 text-[#1a2e52]">{s.countdown}</p>
      ) : (
        <>
          <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} class="rounded-md border border-[#1a2e52]/10 bg-white p-3">
                <p class="text-xs uppercase tracking-wide text-[#c9a84c]">{t.label}</p>
                <p class="font-bold text-[#1a2e52]">{t.value}</p>
              </div>
            ))}
          </div>

          {s.season && <p class="mt-3 text-sm text-[#1a2e52]/80">{s.season.note}</p>}

          {s.packing.length > 0 && (
            <div class="mt-3">
              <p class="text-sm font-semibold text-[#1a2e52]">Packing reminder</p>
              <ul class="mt-1 grid gap-1 sm:grid-cols-2">
                {s.packing.map((p) => (
                  <li key={p} class="flex items-start gap-2 text-sm text-[#1a2e52]/80">
                    <span aria-hidden="true">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
              <p class={`mt-2 ${MUTED}`}>
                A quick reminder, not a forecast — check conditions before you head out.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
