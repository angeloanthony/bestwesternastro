/** @jsxImportSource preact */
// "Get your Adventure Pass" — the magic-link request (M2, ADR-006). Rendered by
// PassDashboard for logged-out guests. Framed as joining the Pass, not "logging in":
// one email field, no password, no friction. Sends a magic link via src/lib/auth.
// FAILS OPEN: if Supabase isn't configured, it shows a "not available yet" notice
// instead of a broken form — public pages never import this, so they're unaffected.
import { useState } from 'preact/hooks';
import { sendMagicLink, isSupabaseConfigured } from '../lib/auth';
import { track } from '../lib/analytics';
import '../styles/tailwind.css';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FIELD =
  'w-full rounded-md border border-[#1a2e52]/30 bg-white px-3 py-2 text-[#1a2e52] ' +
  'outline-none focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/40';
const LABEL = 'mb-1 block text-sm font-semibold text-[#1a2e52]';

export default function PassSignIn() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!isSupabaseConfigured) {
    return (
      <div
        class="rounded-lg border border-[#c9a84c] bg-[#fdf8f0] p-6 text-[#1a2e52]"
        role="status"
        aria-live="polite"
      >
        <p class="text-lg font-bold">The Adventure Pass is almost here.</p>
        <p class="mt-1 text-sm">
          Sign-in isn’t switched on yet — check back soon. In the meantime, everything on the site
          is open to browse.
        </p>
      </div>
    );
  }

  async function onSubmit(e: Event) {
    e.preventDefault();
    setTouched(true);
    if (!emailValid) {
      track('pass_signup_error', { reason: 'validation' });
      return;
    }
    setStatus('sending');
    setError('');
    track('pass_signup_request');

    const result = await sendMagicLink(email.trim());
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      track('pass_signup_error', { reason: 'backend' });
      return;
    }
    setStatus('sent');
    track('pass_signup_sent');
  }

  if (status === 'sent') {
    return (
      <div
        class="rounded-lg border border-[#c9a84c] bg-[#fdf8f0] p-6 text-[#1a2e52]"
        role="status"
        aria-live="polite"
      >
        <p class="text-lg font-bold">Check your inbox.</p>
        <p class="mt-1 text-sm">
          We sent a one-tap link to <span class="font-semibold">{email}</span>. Open it on this
          device to unlock your Adventure Pass. No password to remember — the link is all you need.
        </p>
      </div>
    );
  }

  return (
    <form class="grid gap-4" onSubmit={onSubmit} noValidate aria-describedby="pass-signin-status">
      <div>
        <label class={LABEL} for="pass-email">
          Email<span class="text-[#c9a84c]"> *</span>
        </label>
        <input
          id="pass-email"
          type="email"
          class={FIELD}
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && !emailValid}
          placeholder="you@email.com"
          required
        />
        {touched && !emailValid && (
          <p class="mt-1 text-sm text-red-600">Please enter a valid email.</p>
        )}
      </div>

      <div id="pass-signin-status" aria-live="polite">
        {status === 'error' && (
          <p class="text-sm text-red-600">
            We couldn’t send the link ({error}). Please try again in a moment.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        class="justify-self-start rounded-md bg-[#c9a84c] px-6 py-3 font-bold text-[#0e1c33] transition hover:bg-[#e0bb5a] disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending…' : 'Get my Adventure Pass'}
      </button>
      <p class="text-xs text-[#1a2e52]/70">
        We’ll email you a secure sign-in link. No password, ever. One Pass per email.
      </p>
    </form>
  );
}
