/** @jsxImportSource preact */
// Outbound booking interstitial (attribution spine). Mounted client:only by
// src/pages/go/[partner].astro. On mount it: mints a per-click ref code, builds the
// destination URL, records the intent to Supabase (best-effort), shows staged
// progress + the code, then redirects. FAILS OPEN — any error still ends in a
// redirect, and a hard cap guarantees we never strand the guest on a slow insert.
//
// GA4 events (M7 Phase 5), each fired exactly once, in funnel order:
//   partner_interstitial_view — the interstitial rendered
//   partner_referral          — a referral click began (partner + ref_code)
//   booking_intent_created    — ONLY after a SUCCESSFUL Supabase insert (never on
//                               skip/failure — "no events after failures")
//   partner_redirect          — immediately before hand-off to the booking engine
// Styled with Tailwind (preflight-off, ADR-004).
import { useEffect, useRef, useState } from 'preact/hooks';
import { getPartner, type Partner } from '../data/partners';
import { generateRefCode, buildDestinationUrl, recordBookingIntent } from '../lib/referrals';
import type { BookingParams } from '../lib/referrals';
import { track } from '../lib/analytics';
import '../styles/tailwind.css';

// Absolute ceiling on the interstitial regardless of insert latency — the guest
// always reaches the booking engine.
const REDIRECT_CAP_MS = 6000;

function readParams(search: string): BookingParams {
  const p = new URLSearchParams(search);
  const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  return {
    checkin: p.get('checkin'),
    checkout: p.get('checkout'),
    partySize: num(p.get('guests') ?? p.get('party_size')),
    utmSource: p.get('utm_source'),
    utmMedium: p.get('utm_medium'),
    utmCampaign: p.get('utm_campaign'),
  };
}

export default function GoRedirect({ slug }: { slug: string }) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [refCode, setRefCode] = useState('');
  const [stepsDone, setStepsDone] = useState(0); // 0..3, drives the progress checklist
  const destRef = useRef('');
  const doneRef = useRef(false);
  const metaRef = useRef<{ slug: string; code: string } | null>(null); // for the redirect event

  const navigate = () => {
    if (doneRef.current || !destRef.current) return;
    doneRef.current = true;
    // Fire exactly once, right before hand-off. Redirect is not a failure state,
    // so this always emits (unlike booking_intent_created).
    if (metaRef.current) {
      track('partner_redirect', { partner: metaRef.current.slug, ref_code: metaRef.current.code });
    }
    window.location.replace(destRef.current);
  };

  useEffect(() => {
    const p = getPartner(slug);
    if (!p) {
      window.location.replace('/'); // unknown partner — never a dead end
      return;
    }
    const params = readParams(window.location.search);
    const code = generateRefCode(p.refPrefix);
    destRef.current = buildDestinationUrl(p, code, params);
    metaRef.current = { slug: p.slug, code };
    setPartner(p);
    setRefCode(code);

    // Top-of-funnel events — interstitial shown + referral click begun. Once each.
    track('partner_interstitial_view', { partner: p.slug, ref_code: code });
    track('partner_referral', {
      partner: p.slug,
      partner_type: p.type,
      ref_code: code,
      has_dates: Boolean(params.checkin),
      party_size: params.partySize ?? undefined,
    });

    const landingPage = document.referrer || null;
    const record = (async () => {
      const result = await recordBookingIntent({
        partner: p,
        refCode: code,
        params,
        landingPage,
      });
      // Only a real, persisted row counts as "created" — never on skip or error.
      if (result.ok && result.via === 'supabase') {
        track('booking_intent_created', {
          partner: p.slug,
          ref_code: code,
        });
      }
      return result;
    })();

    // Honest staged progress: step 1 (code) is already true; step 2 lands when the
    // record settles; step 3 fires just before we hand off. Dwell is longer when a
    // confirmed offer means there's a code to read.
    const dwell = p.offerConfirmed ? 2600 : 1100;
    const timers: number[] = [];
    let cancelled = false;
    const advance = (n: number) => {
      if (!cancelled) setStepsDone((s) => (s < n ? n : s));
    };

    timers.push(window.setTimeout(() => advance(1), 300));
    record.then(() => advance(2));
    timers.push(window.setTimeout(() => advance(2), Math.round(dwell * 0.6))); // floor if insert is slow/skipped
    timers.push(window.setTimeout(() => advance(3), Math.max(dwell - 300, 400)));

    const dwellTimer = new Promise<void>((r) => window.setTimeout(r, dwell));
    const cap = new Promise<void>((r) => window.setTimeout(r, REDIRECT_CAP_MS));
    Promise.race([Promise.allSettled([record, dwellTimer]), cap]).then(() => {
      advance(3);
      if (!cancelled) navigate();
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [slug]);

  const steps = partner
    ? [
        'Generating your booking code',
        'Preparing your reservation details',
        `Connecting to ${partner.name}`,
      ]
    : [];

  return (
    <div
      class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#c9a84c]">
        Preparing your reservation
      </p>

      {partner?.offerConfirmed && refCode && (
        <div class="flex flex-col items-center gap-1">
          <p class="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#1a2e52]/60">
            Your booking code
          </p>
          <p class="select-all rounded-md border border-[#c9a84c] bg-[#fdf8f0] px-4 py-2 font-mono text-xl font-bold tracking-widest text-[#1a2e52]">
            {refCode}
          </p>
          <p class="max-w-xs text-sm text-[#1a2e52]">{partner.offer}</p>
        </div>
      )}

      <ul class="flex w-full max-w-xs flex-col gap-2 text-left">
        {steps.map((label, i) => {
          const done = i < stepsDone;
          return (
            <li class="flex items-center gap-3 text-sm text-[#1a2e52]">
              <span
                class={
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ' +
                  (done
                    ? 'bg-[#c9a84c] text-[#0e1c33]'
                    : 'border-2 border-[#c9a84c]/40 text-transparent')
                }
                aria-hidden="true"
              >
                {done ? '✓' : ''}
              </span>
              <span class={done ? '' : 'text-[#1a2e52]/50'}>{label}</span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={navigate}
        class="rounded-md bg-[#c9a84c] px-5 py-2.5 font-bold text-[#0e1c33] transition hover:bg-[#e0bb5a]"
      >
        Continue to booking now →
      </button>
    </div>
  );
}
