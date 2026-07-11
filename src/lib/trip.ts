// src/lib/trip.ts
//
// Persistence for the member's trip (M4, Part 3). Reuses EXISTING tables — no
// schema change:
//   • member_profile.arrival_date / departure_date / interests  (the trip dates
//     & preferences; columns from migration 001, unused until now)
//   • itinerary.days                                            (the generated
//     plan; the table from 001 was built for exactly this)
//
// The app keeps ONE itinerary row per member: saveTrip updates the existing row
// if present, else inserts. Partial upserts on member_profile are safe — the M2
// profile fields (user_types / visit_reason / marketing_optin) are not in the
// payload, so PostgREST leaves them untouched. RLS (prof_own / itin_own) scopes
// everything to auth.uid(). Degrades gracefully when Supabase is unconfigured.
import { supabase } from './supabase';
import { vernalDestinationId } from './destination';
import type { InterestId } from '../data/attractions';
import type { ItineraryDay } from './trip-plan';
import type { ItineraryRow, MemberProfileRow } from './database.types';

export type Trip = {
  arrival: string | null;
  departure: string | null;
  interests: InterestId[];
  days: ItineraryDay[] | null; // the saved generated plan
  hasItinerary: boolean;
};

export type SaveTripInput = {
  arrival: string | null;
  departure: string | null;
  interests: InterestId[];
  days: ItineraryDay[];
};

// `outcome` lets the caller emit trip_created vs trip_updated (Part 5 analytics).
export type SaveTripResult =
  { ok: true; outcome: 'created' | 'updated' } | { ok: false; error: string };

export type TripResult = { ok: true } | { ok: false; error: string };

const ITINERARY_TITLE = 'My Vernal Trip';

export async function getTrip(userId: string): Promise<Trip> {
  const empty: Trip = {
    arrival: null,
    departure: null,
    interests: [],
    days: null,
    hasItinerary: false,
  };
  if (!supabase) return empty;

  const [{ data: profile }, { data: itin }] = await Promise.all([
    supabase
      .from('member_profile')
      .select('arrival_date, departure_date, interests')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('itinerary')
      .select('days')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const p = profile as Pick<
    MemberProfileRow,
    'arrival_date' | 'departure_date' | 'interests'
  > | null;
  const days = (itin as Pick<ItineraryRow, 'days'> | null)?.days as ItineraryDay[] | undefined;

  return {
    arrival: p?.arrival_date ?? null,
    departure: p?.departure_date ?? null,
    interests: (p?.interests ?? []) as InterestId[],
    days: days ?? null,
    hasItinerary: Boolean(days && days.length),
  };
}

export async function saveTrip(userId: string, input: SaveTripInput): Promise<SaveTripResult> {
  if (!supabase) return { ok: false, error: 'unconfigured' };

  const destination_id = await vernalDestinationId();
  if (!destination_id) return { ok: false, error: 'destination unavailable' };

  // 1. Trip dates + interests → member_profile (partial upsert; M2 fields safe).
  const { error: profErr } = await supabase.from('member_profile').upsert({
    user_id: userId,
    destination_id,
    arrival_date: input.arrival,
    departure_date: input.departure,
    interests: input.interests,
  });
  if (profErr) return { ok: false, error: profErr.message };

  // 2. Generated plan → itinerary (one row per member: update if it exists).
  const { data: existing } = await supabase
    .from('itinerary')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('itinerary')
      .update({ title: ITINERARY_TITLE, start_date: input.arrival, days: input.days })
      .eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, outcome: 'updated' };
  }

  const { error } = await supabase.from('itinerary').insert({
    user_id: userId,
    title: ITINERARY_TITLE,
    start_date: input.arrival,
    days: input.days,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, outcome: 'created' };
}

/** Remove the saved plan and clear the trip dates. Interests (a standing
 *  preference) are kept. */
export async function deleteTrip(userId: string): Promise<TripResult> {
  if (!supabase) return { ok: false, error: 'unconfigured' };

  const { error: itinErr } = await supabase.from('itinerary').delete().eq('user_id', userId);
  if (itinErr) return { ok: false, error: itinErr.message };

  const destination_id = await vernalDestinationId();
  if (destination_id) {
    await supabase.from('member_profile').upsert({
      user_id: userId,
      destination_id,
      arrival_date: null,
      departure_date: null,
    });
  }
  return { ok: true };
}
