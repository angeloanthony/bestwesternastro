/** @jsxImportSource preact */
// Outbound booking interstitial (attribution spine). Mounted client:only by
// src/pages/go/[partner].astro. On mount it: mints a per-click ref code, builds the
// destination URL, fires a GA4 booking_click, records the intent to Supabase
// (best-effort, enriched with the member's user_id when signed in), briefly shows the
// code, then redirects. FAILS OPEN — any error still ends in a redirect; an unrecorded
// click must never cost a booking. Styled with Tailwind (preflight-off, ADR-004).
import { useEffect, useRef, useState } from 'preact/hooks';
import { getPartner, type Partner } from '../data/partners';
import { generateRefCode, buildDestinationUrl, recordBookingIntent } from '../lib/referrals';
import type { BookingParams } from '../lib/referrals';
import { getSession } from '../lib/auth';
import { track } from '../lib/analytics';
import '../styles/tailwind.css';

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
  const destRef = useRef('');
  const doneRef = useRef(false);

  const navigate = () => {
    if (doneRef.current || !destRef.current) return;
    doneRef.current = true;
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
    setPartner(p);
    setRefCode(code);

    track('booking_click', {
      partner: p.slug,
      ref_code: code,
      has_dates: Boolean(params.checkin),
      party_size: params.partySize ?? undefined,
    });

    const landingPage = document.referrer || null;
    const record = (async () => {
      const session = await getSession(); // local read, no network
      return recordBookingIntent({
        partner: p,
        refCode: code,
        params,
        userId: session?.user?.id ?? null,
        landingPage,
      });
    })();

    // Show the code long enough to read when there's a confirmed offer; otherwise a
    // brief beat. Redirect once BOTH the dwell and the record settle (record failure
    // is swallowed — we redirect regardless).
    const dwell = p.offerConfirmed ? 2600 : 900;
    let cancelled = false;
    Promise.allSettled([record, new Promise<void>((r) => window.setTimeout(r, dwell))]).then(() => {
      if (!cancelled) navigate();
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div
      class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <span
        class="h-9 w-9 animate-spin rounded-full border-4 border-[#c9a84c]/30 border-t-[#c9a84c]"
        aria-hidden="true"
      />

      {partner?.offerConfirmed ? (
        <>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#c9a84c]">
            Your booking code
          </p>
          <p class="select-all rounded-md border border-[#c9a84c] bg-[#fdf8f0] px-4 py-2 font-mono text-xl font-bold tracking-widest text-[#1a2e52]">
            {refCode}
          </p>
          <p class="text-sm text-[#1a2e52]">{partner.offer}</p>
          <p class="text-sm text-[#1a2e52]/70">Taking you to {partner.name}’s secure booking…</p>
        </>
      ) : (
        <p class="text-base text-[#1a2e52]">
          Taking you to {partner ? `${partner.name}’s` : 'the'} secure booking…
        </p>
      )}

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
