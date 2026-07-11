// Saved Adventures (M4) — read/write the current member's own favorites.
// RLS `fav_own` (005) scopes every query to auth.uid(); we still pass user_id
// explicitly because it's part of the unique key and the INSERT check needs it.
// Every function degrades gracefully when Supabase is unconfigured (returns []
// or a typed error) so the member UI never crashes.
import { supabase } from './supabase';
import type { FavoriteRow } from './database.types';

export type FavResult = { ok: true } | { ok: false; error: string };

/** All saved attraction slugs for a member, newest first. */
export async function getFavoriteSlugs(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('favorite')
    .select('attraction_slug')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r: Pick<FavoriteRow, 'attraction_slug'>) => r.attraction_slug);
}

/** Save an attraction. Idempotent: the unique (user_id, slug) constraint plus
 *  upsert-on-conflict means saving twice is a no-op, not an error. */
export async function addFavorite(userId: string, slug: string): Promise<FavResult> {
  if (!supabase) return { ok: false, error: 'unconfigured' };
  const { error } = await supabase
    .from('favorite')
    .upsert({ user_id: userId, attraction_slug: slug }, { onConflict: 'user_id,attraction_slug' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeFavorite(userId: string, slug: string): Promise<FavResult> {
  if (!supabase) return { ok: false, error: 'unconfigured' };
  const { error } = await supabase
    .from('favorite')
    .delete()
    .eq('user_id', userId)
    .eq('attraction_slug', slug);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
