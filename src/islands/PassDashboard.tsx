/** @jsxImportSource preact */
// Adventure Pass dashboard + client-side guard (M2). The single hydrated island on
// /pass. It is the ONLY thing that decides member-vs-anon, entirely in the browser:
//
//   loading → (Supabase reports a session?) → member view : join view (PassSignIn)
//
// The magic-link click returns the guest to /pass with a token in the URL; supabase-js
// auto-detects it (detectSessionInUrl) and fires onAuthChange('SIGNED_IN'), which flips
// this to the member view — no explicit callback route needed. Rendered `client:only`
// so no logged-out shell is ever prerendered into static HTML.
//
// FAIL-OPEN: if Supabase is unconfigured or Auth is unreachable, it degrades to the
// join view (which shows a friendly "not available yet" notice) — it never throws, and
// because only /pass imports it, every public SEO page is unaffected.
import { useEffect, useState } from 'preact/hooks';
import type { User } from '@supabase/supabase-js';
import { getSession, getUser, onAuthChange, signOut, isSupabaseConfigured } from '../lib/auth';
import { getProfile } from '../lib/profile';
import type { MemberProfileRow } from '../lib/database.types';
import { track } from '../lib/analytics';
import PassSignIn from './PassSignIn';
import PassProfileForm from './PassProfileForm';
import PassMemberHome from './PassMemberHome';
import '../styles/tailwind.css';

type View = 'loading' | 'anon' | 'member';

function clearAuthHashFromUrl() {
  if (typeof window === 'undefined') return;
  if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

export default function PassDashboard() {
  const [view, setView] = useState<View>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MemberProfileRow | null>(null);

  useEffect(() => {
    let active = true;

    // Unconfigured → straight to the join view (PassSignIn renders the notice).
    if (!isSupabaseConfigured) {
      setView('anon');
      return;
    }

    async function loadMember(u: User) {
      setUser(u);
      setProfile(await getProfile(u.id));
      if (active) setView('member');
    }

    (async () => {
      const session = await getSession();
      if (!active) return;
      if (session) {
        clearAuthHashFromUrl();
        await loadMember(session.user);
      } else {
        setView('anon');
      }
    })();

    // React to the magic-link landing (SIGNED_IN) and to sign-out.
    const unsub = onAuthChange(async (session) => {
      if (!active) return;
      if (session) {
        clearAuthHashFromUrl();
        const u = (await getUser()) ?? session.user;
        await loadMember(u);
      } else {
        setUser(null);
        setProfile(null);
        setView('anon');
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  async function onSignOut() {
    track('pass_signout');
    await signOut();
    // onAuthChange('SIGNED_OUT') flips the view; no manual state juggling needed.
  }

  if (view === 'loading') {
    return (
      <p class="text-[#1a2e52]" role="status" aria-live="polite">
        Loading your Adventure Pass…
      </p>
    );
  }

  if (view === 'anon') {
    return (
      <div class="grid gap-5">
        <p class="text-[#1a2e52]">
          Your free Vernal Adventure Pass saves the places you love, keeps your trip plans in one
          spot, and unlocks local guides. Enter your email and we’ll send a one-tap link — no
          password to create.
        </p>
        <PassSignIn />
      </div>
    );
  }

  // member view
  return (
    <div class="grid gap-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-[#1a2e52]">
          Signed in as <span class="font-semibold">{user?.email}</span>
        </p>
        <button
          type="button"
          onClick={onSignOut}
          class="rounded-md border border-[#1a2e52]/30 px-4 py-2 text-sm font-semibold text-[#1a2e52] transition hover:bg-[#1a2e52]/5"
        >
          Sign out
        </button>
      </div>

      <details class="rounded-lg border border-[#1a2e52]/15 bg-white p-5">
        <summary class="cursor-pointer text-lg font-bold text-[#1a2e52]">
          Personalise your Pass
        </summary>
        <div class="mt-3">
          <PassProfileForm userId={user!.id} initial={profile} />
        </div>
      </details>

      {/* M4 — Saved Adventures, My Adventures, and the Trip Planner. */}
      <PassMemberHome userId={user!.id} />
    </div>
  );
}
