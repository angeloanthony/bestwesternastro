// Supabase browser client (anon key). Safe to import anywhere — if the env vars
// are unset (the default until a project is provisioned), `supabase` is null and
// `isSupabaseConfigured` is false, so callers degrade gracefully rather than crash.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url as string, anonKey as string)
  : null;
