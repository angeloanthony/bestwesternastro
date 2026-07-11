// Resolve the seeded 'vernal' destination id. member_profile.destination_id is
// NOT NULL, so any write that upserts a profile row needs it. anon/authenticated
// have SELECT on `destination` (grant 004). Returns null when Supabase is
// unconfigured so callers degrade gracefully (never throws).
//
// Small module of its own so both the trip layer and any future profile writer
// can share it without importing each other. (M2's src/lib/profile.ts keeps its
// own private copy — left untouched to avoid touching verified code.)
import { supabase } from './supabase';

let cached: string | null = null;

export async function vernalDestinationId(): Promise<string | null> {
  if (!supabase) return null;
  if (cached) return cached;
  const { data } = await supabase.from('destination').select('id').eq('slug', 'vernal').single();
  cached = data?.id ?? null;
  return cached;
}
