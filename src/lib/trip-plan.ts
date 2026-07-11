// src/lib/trip-plan.ts
//
// DETERMINISTIC trip planning for the Adventure Pass (M4, Parts 3 & 4).
// Pure functions only — no I/O, no Supabase, no `Date.now()` inside (the caller
// passes `todayISO`). That makes every output reproducible from its inputs and
// trivially testable, and keeps the rules auditable.
//
// ┌───────────────────────────────────────────────────────────────────────────┐
// │ AI REPLACEMENT SEAM (M5 — Concierge, ADR-005).                              │
// │ `generateItinerary(input)` is the swap point. Today it ranks attractions   │
// │ with hand-written rules and distributes them across days greedily. In M5   │
// │ the Concierge replaces the RANKING + DISTRIBUTION with RAG over the seeded │
// │ `location` table + an LLM, grounded and Vernal-scoped — but the CONTRACT   │
// │ stays identical: PlanInput → ItineraryDay[]. Persistence (src/lib/trip.ts) │
// │ and the UI never change. Trip status (Part 4) stays deterministic — no AI. │
// └───────────────────────────────────────────────────────────────────────────┘
import { ATTRACTIONS, getAttraction, type Attraction, type InterestId } from '../data/attractions';

// ── Public shapes (also the JSON stored in itinerary.days) ──────────────────
export type ItineraryStop = {
  slug: string;
  name: string;
  emoji: string;
  kind: 'attraction' | 'meal';
  note: string;
  href: string;
};

export type ItineraryDay = {
  day: number; // 1-based
  date: string | null; // ISO 'YYYY-MM-DD' for this day, null if dates unknown
  label: string; // 'Arrival day' | 'Day 2' | 'Departure day'
  stops: ItineraryStop[];
};

export type PlanInput = {
  arrival: string | null; // ISO date
  departure: string | null; // ISO date
  interests: InterestId[];
  favorites: string[]; // attraction slugs
};

// ── Date helpers (UTC-midnight to dodge DST; inputs are plain 'YYYY-MM-DD') ──
const DAY_MS = 86_400_000;

function parseISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(fromISO: string, toISO: string): number | null {
  const a = parseISO(fromISO);
  const b = parseISO(toISO);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function addDaysISO(iso: string, n: number): string | null {
  const d = parseISO(iso);
  if (!d) return null;
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Number of nights between arrival and departure (>=0), or null if unknown. */
export function nightsBetween(arrival: string | null, departure: string | null): number | null {
  if (!arrival || !departure) return null;
  const n = diffDays(arrival, departure);
  return n === null ? null : Math.max(0, n);
}

// ── Ranking ─────────────────────────────────────────────────────────────────
// Score = favorite boost + interest overlap + editorial priority. Higher wins.
function scoreOf(a: Attraction, interests: InterestId[], favorites: Set<string>): number {
  const fav = favorites.has(a.slug) ? 1000 : 0;
  const overlap = a.interests.filter((i) => interests.includes(i)).length;
  const priorityScore = 20 - a.priority; // priority 1 (crown jewel) → 19
  return fav + overlap * 10 + priorityScore;
}

function rankAttractions(input: PlanInput): Attraction[] {
  const favorites = new Set(input.favorites);
  // 'downtown-vernal' is reserved for the evening dinner slot, not a daytime stop.
  return ATTRACTIONS.filter((a) => a.slug !== 'downtown-vernal')
    .map((a) => ({ a, s: scoreOf(a, input.interests, favorites) }))
    .sort(
      (x, y) =>
        y.s - x.s || // score desc
        x.a.priority - y.a.priority || // then editorial priority
        x.a.driveMinutes - y.a.driveMinutes || // then closer first
        x.a.name.localeCompare(y.a.name)
    )
    .map((r) => r.a);
}

// ── Day capacity model ───────────────────────────────────────────────────────
// Each day has a unit budget. full-day = 2 units, half-day/quick = 1 unit.
const unitCost = (a: Attraction): number => (a.duration === 'full-day' ? 2 : 1);

type DayRole = 'single' | 'arrival' | 'middle' | 'departure';

function dayBudget(role: DayRole): number {
  // Arrival & departure days are light (you arrive/leave partway through them).
  return role === 'arrival' || role === 'departure' ? 1 : 2;
}

// On arrival/departure days prefer close-to-town stops; full days can range far.
function areaAllowed(role: DayRole, a: Attraction): boolean {
  if (role === 'arrival' || role === 'departure') return a.area !== 'day-trip';
  return true;
}

function toStop(a: Attraction): ItineraryStop {
  const durationLabel =
    a.duration === 'full-day' ? 'full day' : a.duration === 'half-day' ? 'half day' : 'quick stop';
  return {
    slug: a.slug,
    name: a.name,
    emoji: a.emoji,
    kind: 'attraction',
    note: `~${a.driveMinutes} min drive · ${durationLabel}`,
    href: a.href,
  };
}

const DINNER = getAttraction('downtown-vernal');
function dinnerStop(): ItineraryStop {
  return {
    slug: DINNER?.slug ?? 'downtown-vernal',
    name: 'Dinner in Downtown Vernal',
    emoji: '🍽️',
    kind: 'meal',
    note: 'Top-rated local Italian, Thai, Mexican & BBQ minutes from the hotel',
    href: DINNER?.href ?? 'explore.html#restaurants',
  };
}

/**
 * Generate a simple, deterministic itinerary. Never throws and never returns an
 * empty plan: with no interests and no favorites it falls back to the highest
 * editorial-priority attractions so a guest always sees a useful sample.
 */
export function generateItinerary(input: PlanInput): ItineraryDay[] {
  // Day count: from the date range if given, else a sensible 3-day sample.
  const nights = nightsBetween(input.arrival, input.departure);
  const count = Math.min(14, Math.max(1, nights === null ? 3 : nights + 1));

  const ranked = rankAttractions(input);
  const remaining = [...ranked];
  const days: ItineraryDay[] = [];

  for (let i = 0; i < count; i++) {
    const role: DayRole =
      count === 1 ? 'single' : i === 0 ? 'arrival' : i === count - 1 ? 'departure' : 'middle';

    const date = input.arrival ? addDaysISO(input.arrival, i) : null;
    const label =
      role === 'arrival' ? 'Arrival day' : role === 'departure' ? 'Departure day' : `Day ${i + 1}`;

    let budget = dayBudget(role);
    const stops: ItineraryStop[] = [];

    // Greedily take the best remaining attraction that fits this day's budget
    // and area rule. Prefer area-appropriate picks, then fall back to any fit.
    while (budget > 0) {
      let idx = remaining.findIndex((a) => unitCost(a) <= budget && areaAllowed(role, a));
      if (idx === -1) idx = remaining.findIndex((a) => unitCost(a) <= budget);
      if (idx === -1) break;
      const [picked] = remaining.splice(idx, 1);
      stops.push(toStop(picked));
      budget -= unitCost(picked);
    }

    // Evening: a downtown dinner suggestion on every night you're in town
    // (i.e. every day except a multi-day trip's checkout/departure day).
    if (role !== 'departure') stops.push(dinnerStop());

    days.push({ day: i + 1, date, label, stops });
  }

  return days;
}

// ── Trip status (Part 4) — deterministic, no external APIs ──────────────────
export type SeasonId = 'winter' | 'spring' | 'summer' | 'fall';

export type TripStatus = {
  hasDates: boolean;
  nights: number | null;
  days: number | null;
  phase: 'upcoming' | 'in-progress' | 'past' | 'unknown';
  daysUntilArrival: number | null; // >=0; 0 = arrives today
  daysRemaining: number | null; // when in-progress: whole days until departure
  countdown: string; // headline label
  season: { id: SeasonId; label: string; note: string } | null;
  packing: string[];
};

const SEASON: Record<SeasonId, { label: string; note: string }> = {
  winter: {
    label: 'Winter',
    note: 'Cold with snow possible (Vernal sits above 5,300 ft). Some canyon roads may be limited — the Quarry and museum stay open year-round.',
  },
  spring: {
    label: 'Spring',
    note: 'Mild days and cool nights — one of the best times to hike with far fewer crowds.',
  },
  summer: {
    label: 'Summer',
    note: 'Warm and the busiest season. Start early to beat the heat and the Quarry shuttle line.',
  },
  fall: {
    label: 'Fall',
    note: 'Crisp, quiet, and great light — locals will tell you it is the finest time to visit.',
  },
};

function seasonOf(monthIndex0: number): SeasonId {
  // monthIndex0: 0 = Jan … 11 = Dec
  if (monthIndex0 <= 1 || monthIndex0 === 11) return 'winter';
  if (monthIndex0 <= 4) return 'spring';
  if (monthIndex0 <= 7) return 'summer';
  return 'fall';
}

const BASE_PACKING = [
  'Refillable water bottle',
  'Sun protection — hat & sunscreen',
  'Comfortable walking / hiking shoes',
];

const SEASON_PACKING: Record<SeasonId, string[]> = {
  winter: ['Warm insulated layers & jacket', 'Traction cleats for icy trails'],
  spring: ['Layers for cool mornings', 'Light rain shell'],
  summer: ['Light, breathable clothing', 'Extra water — it is high desert'],
  fall: ['A warm layer for chilly evenings', 'Camera for the fall color'],
};

/**
 * Compute trip status relative to `todayISO` (the caller passes local "today"
 * as 'YYYY-MM-DD'). Pure — same inputs always yield the same result.
 */
export function tripStatus(
  arrival: string | null,
  departure: string | null,
  todayISO: string
): TripStatus {
  const nights = nightsBetween(arrival, departure);
  const days = nights === null ? null : nights + 1;

  if (!arrival) {
    return {
      hasDates: false,
      nights,
      days,
      phase: 'unknown',
      daysUntilArrival: null,
      daysRemaining: null,
      countdown: 'Add your dates to start a countdown',
      season: null,
      packing: [],
    };
  }

  const arr = parseISO(arrival);
  const untilArrival = diffDays(todayISO, arrival);
  const untilDeparture = departure ? diffDays(todayISO, departure) : null;

  let phase: TripStatus['phase'] = 'unknown';
  let countdown = '';
  let daysRemaining: number | null = null;

  if (untilArrival !== null && untilArrival > 0) {
    phase = 'upcoming';
    countdown = untilArrival === 1 ? 'Tomorrow — 1 day to go!' : `${untilArrival} days to go`;
  } else if (untilArrival !== null && untilArrival <= 0) {
    // Arrived. Are we still before/at departure?
    if (untilDeparture !== null && untilDeparture >= 0) {
      phase = 'in-progress';
      daysRemaining = untilDeparture;
      const dayNumber = Math.abs(untilArrival) + 1;
      countdown =
        days !== null
          ? `You're here — day ${Math.min(dayNumber, days)} of ${days}`
          : "You're here in Vernal";
    } else if (untilDeparture !== null && untilDeparture < 0) {
      phase = 'past';
      countdown = 'Hope you had a great trip — come back soon!';
    } else {
      // Arrival only, no departure, and arrival is today/past.
      phase = 'in-progress';
      countdown = "You're here in Vernal";
    }
  }

  const seasonId = arr ? seasonOf(arr.getUTCMonth()) : null;
  const season = seasonId ? { id: seasonId, ...SEASON[seasonId] } : null;
  const packing =
    phase === 'past' || !seasonId ? [] : [...BASE_PACKING, ...SEASON_PACKING[seasonId]];

  return {
    hasDates: true,
    nights,
    days,
    phase,
    daysUntilArrival: untilArrival === null ? null : Math.max(0, untilArrival),
    daysRemaining,
    countdown,
    season,
    packing,
  };
}
