/** @jsxImportSource preact */
// Simple Trip Planner (M4, Part 3). The member picks arrival, departure, and
// interests; we generate a deterministic day-by-day itinerary (src/lib/trip-plan)
// that folds in their saved favorites, then persist it (src/lib/trip). No AI —
// the rules live in trip-plan.ts behind a documented replacement seam for M5.
// Trip Status (Part 4) renders below once dates are set.
import { useState } from 'preact/hooks';
import { INTERESTS, getAttraction, type InterestId } from '../data/attractions';
import { generateItinerary, type ItineraryDay } from '../lib/trip-plan';
import { saveTrip, deleteTrip, type Trip } from '../lib/trip';
import { track } from '../lib/analytics';
import PassTripStatus from './PassTripStatus';
import { BTN_GOLD, BTN_GHOST, CARD, FIELD, H2, H3, LABEL, MUTED } from './pass-ui';

type Status = 'idle' | 'working' | 'saved' | 'error';

export default function PassTripPlanner({
  userId,
  favorites,
  trip,
  onChange,
}: {
  userId: string;
  favorites: string[];
  trip: Trip;
  onChange: (next: Partial<Trip>) => void;
}) {
  const [arrival, setArrival] = useState(trip.arrival ?? '');
  const [departure, setDeparture] = useState(trip.departure ?? '');
  const [interests, setInterests] = useState<Set<InterestId>>(new Set(trip.interests));
  const [days, setDays] = useState<ItineraryDay[] | null>(trip.days);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(trip.hasItinerary);
  // Dates that Trip Status reflects: the last persisted trip, not keystrokes.
  const [statusDates, setStatusDates] = useState<{
    arrival: string | null;
    departure: string | null;
  }>({ arrival: trip.arrival, departure: trip.departure });

  const toggleInterest = (id: InterestId) =>
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function validate(): string | null {
    if (!arrival) return 'Add an arrival date to build your itinerary.';
    if (departure && departure < arrival) return 'Departure can’t be before arrival.';
    return null;
  }

  async function onBuild(e: Event) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setStatus('error');
      setError(problem);
      return;
    }
    setStatus('working');
    setError('');

    const interestList = [...interests];
    const generated = generateItinerary({
      arrival,
      departure: departure || null,
      interests: interestList,
      favorites,
    });
    setDays(generated);
    track('itinerary_viewed', { days: generated.length });

    const result = await saveTrip(userId, {
      arrival,
      departure: departure || null,
      interests: interestList,
      days: generated,
    });

    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      track('trip_error', { reason: 'backend' });
      return;
    }
    setSaved(true);
    setStatus('saved');
    setStatusDates({ arrival, departure: departure || null });
    track(result.outcome === 'created' ? 'trip_created' : 'trip_updated', {
      days: generated.length,
      interests: interestList.length,
    });
    onChange({
      arrival,
      departure: departure || null,
      interests: interestList,
      days: generated,
      hasItinerary: true,
    });
  }

  async function onDelete() {
    setStatus('working');
    const result = await deleteTrip(userId);
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      return;
    }
    track('trip_deleted');
    setDays(null);
    setSaved(false);
    setArrival('');
    setDeparture('');
    setStatusDates({ arrival: null, departure: null });
    setStatus('idle');
    onChange({ arrival: null, departure: null, days: null, hasItinerary: false });
  }

  return (
    <section class="grid gap-4">
      <div>
        <h2 class={H2}>Plan your trip</h2>
        <p class={MUTED}>
          Tell us when you’re here and what you’re into — we’ll lay out a day-by-day plan and weave
          in the places you’ve saved.
        </p>
      </div>

      <form class={`${CARD} grid gap-4`} onSubmit={onBuild}>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class={LABEL} for="trip-arrival">
              Arrival<span class="text-[#c9a84c]"> *</span>
            </label>
            <input
              id="trip-arrival"
              type="date"
              class={FIELD}
              value={arrival}
              onInput={(e) => setArrival((e.target as HTMLInputElement).value)}
              required
            />
          </div>
          <div>
            <label class={LABEL} for="trip-departure">
              Departure
            </label>
            <input
              id="trip-departure"
              type="date"
              class={FIELD}
              value={departure}
              min={arrival || undefined}
              onInput={(e) => setDeparture((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        <fieldset>
          <legend class={LABEL}>What are you into? (optional)</legend>
          <div class="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = interests.has(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggleInterest(i.id)}
                  aria-pressed={on}
                  class={`rounded-full border px-3 py-1 text-sm transition ${
                    on
                      ? 'border-[#c9a84c] bg-[#fdf8f0] font-semibold text-[#1a2e52]'
                      : 'border-[#1a2e52]/20 text-[#1a2e52] hover:bg-[#1a2e52]/5'
                  }`}
                >
                  <span aria-hidden="true">{i.emoji}</span> {i.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div aria-live="polite">
          {status === 'error' && <p class="text-sm text-red-600">{error}</p>}
          {status === 'saved' && (
            <p class="text-sm text-[#1a2e52]" role="status">
              Saved — your itinerary will be here next time you open your Pass.
            </p>
          )}
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={status === 'working'} class={BTN_GOLD}>
            {status === 'working'
              ? 'Working…'
              : saved
                ? 'Update my itinerary'
                : 'Build my itinerary'}
          </button>
          {saved && (
            <button
              type="button"
              onClick={onDelete}
              disabled={status === 'working'}
              class={BTN_GHOST}
            >
              Clear trip
            </button>
          )}
        </div>
      </form>

      {days && days.length > 0 && (
        <div class="grid gap-3">
          <h3 class={H3}>Your itinerary</h3>
          {days.map((d) => (
            <div key={d.day} class={CARD}>
              <div class="mb-2 flex items-baseline justify-between gap-2">
                <p class="font-bold text-[#1a2e52]">{d.label}</p>
                {d.date && <p class="text-sm text-[#1a2e52]/60">{d.date}</p>}
              </div>
              <ul class="grid gap-2">
                {d.stops.map((s, idx) => (
                  <li key={`${s.slug}-${idx}`} class="flex items-start gap-3">
                    <span class="text-xl leading-none" aria-hidden="true">
                      {s.emoji}
                    </span>
                    <div class="grow">
                      <a
                        href={getAttraction(s.slug)?.href ?? s.href}
                        class="font-semibold text-[#1a2e52] underline decoration-[#c9a84c] underline-offset-2"
                      >
                        {s.name}
                      </a>
                      <p class="text-sm text-[#1a2e52]/70">{s.note}</p>
                    </div>
                    {s.kind === 'meal' && (
                      <span class="shrink-0 rounded-full bg-[#1a2e52]/5 px-2 py-0.5 text-xs text-[#1a2e52]/70">
                        dinner
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p class={MUTED}>
            A deterministic starting point — reorder it in your head, or save more places and
            rebuild.
          </p>
        </div>
      )}

      <PassTripStatus arrival={statusDates.arrival} departure={statusDates.departure} />
    </section>
  );
}
