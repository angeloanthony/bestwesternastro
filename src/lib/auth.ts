// Adventure Pass identity (M2) — passwordless magic-link auth over the anon
// Supabase client (ADR-006). Client-side only: the whole flow runs in the browser,
// the session lives in localStorage and auto-refreshes (supabase-js defaults), and
// the magic-link redirect is auto-detected by the SDK (`detectSessionInUrl`). No
// SSR, no server session — the static SEO pages are untouched.
//
// Every function degrades gracefully when Supabase is unconfigured (env unset):
// it returns a typed result / null rather than throwing, so the member UI can
// FAIL OPEN (show "not available yet") instead of crashing, and public pages that
// never import this are wholly unaffected.
import type { Session, User, Subscription } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export type AuthResult = { ok: true } | { ok: false; error: 'unconfigured' | string };

/**
 * Send a magic link (email OTP). One account per email; the user is created on
 * first login (`shouldCreateUser` defaults true) — ADR-006. The link returns the
 * guest to `redirectTo` (default: the Pass page on this origin), where the SDK
 * establishes the session automatically.
 */
export async function sendMagicLink(email: string, redirectTo?: string): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'unconfigured' };
  const emailRedirectTo =
    redirectTo ?? (typeof window !== 'undefined' ? `${window.location.origin}/pass` : undefined);
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Subscribe to auth changes (sign-in after a magic-link click, sign-out, token
 * refresh). Returns an unsubscribe function; a no-op when Supabase is unconfigured.
 */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => (data.subscription as Subscription).unsubscribe();
}

export async function signOut(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'unconfigured' };
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export { isSupabaseConfigured };
