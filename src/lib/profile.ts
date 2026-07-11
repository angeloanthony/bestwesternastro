// Adventure Pass member profile (M2) — read/write the current member's own row.
// RLS `prof_own` (002) already scopes every query to auth.uid(); we still pass
// user_id explicitly because it's the primary key and the INSERT check needs it.
// Profile completion is optional (ADR-006), so this is only ever called after a
// deliberate "Save" — it never runs as part of login.
import { supabase } from './supabase';
import type { MemberProfileRow } from './database.types';

export type ProfileInput = {
  user_types: string[];
  visit_reason: string | null;
  marketing_optin: boolean;
};

export type ProfileResult = { ok: true } | { ok: false; error: string };

// member_profile.destination_id is NOT NULL → resolve the seeded 'vernal' row.
// anon/authenticated have SELECT on destination (grant 004).
async function vernalDestinationId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('destination').select('id').eq('slug', 'vernal').single();
  return data?.id ?? null;
}

export async function getProfile(userId: string): Promise<MemberProfileRow | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('member_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export async function saveProfile(userId: string, input: ProfileInput): Promise<ProfileResult> {
  if (!supabase) return { ok: false, error: 'unconfigured' };
  const destination_id = await vernalDestinationId();
  if (!destination_id) return { ok: false, error: 'destination unavailable' };
  const { error } = await supabase.from('member_profile').upsert({
    user_id: userId,
    destination_id,
    user_types: input.user_types,
    visit_reason: input.visit_reason,
    marketing_optin: input.marketing_optin,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
