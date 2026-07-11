/** @jsxImportSource preact */
// Corporate rate / room-block request form (Report §12). First real AdventureOS
// island — genuinely interactive (validation, submit states), so it earns Preact.
// Submits via src/lib/leads.ts: Supabase `lead` insert when configured, else a
// pre-filled mailto fallback. Styled with Tailwind (preflight-off — ADR-004).
import { useState } from 'preact/hooks';
import { submitLead, type LeadInput } from '../lib/leads';
import '../styles/tailwind.css';

type Status = 'idle' | 'submitting' | 'done' | 'error';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Fire a GA4 event directly from the island (outcome-based). `corporate_lead_submit`
// is the click-level *attempt*, emitted by the delegated [data-track] listener in
// Analytics.astro; success/error are emitted here so conversions and failures are
// distinguishable from raw button clicks. No-op until gtag is configured.
function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', event, { transport_type: 'beacon', ...params });
  }
}

const FIELD =
  'w-full rounded-md border border-[#1a2e52]/30 bg-white px-3 py-2 text-[#1a2e52] ' +
  'outline-none focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/40';
const LABEL = 'mb-1 block text-sm font-semibold text-[#1a2e52]';

export default function CorporateRateForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [values, setValues] = useState({
    kind: 'corporate_rate' as LeadInput['kind'],
    company: '',
    contact_name: '',
    email: '',
    phone: '',
    rooms: '',
    nights: '',
    arrival: '',
    notes: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email);
  const nameValid = values.contact_name.trim().length > 0;
  const formValid = emailValid && nameValid;

  async function onSubmit(e: Event) {
    e.preventDefault();
    setTouched({ contact_name: true, email: true });
    if (!formValid) {
      track('corporate_lead_error', { reason: 'validation' });
      return;
    }
    setStatus('submitting');
    setError('');

    const input: LeadInput = {
      kind: values.kind,
      company: values.company || null,
      contact_name: values.contact_name.trim(),
      email: values.email.trim(),
      phone: values.phone || null,
      rooms: values.rooms ? Number(values.rooms) : null,
      nights: values.nights ? Number(values.nights) : null,
      arrival: values.arrival || null,
      notes: values.notes || null,
      source_page: typeof window !== 'undefined' ? window.location.pathname : null,
    };

    const result = await submitLead(input);
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      track('corporate_lead_error', { reason: 'backend' });
      return;
    }
    track('corporate_lead_success', { via: result.via }); // 'supabase' | 'mailto'
    if (result.via === 'mailto') {
      window.location.href = result.href; // hand off to the mail client
    }
    setStatus('done');
  }

  if (status === 'done') {
    return (
      <div
        class="rounded-lg border border-[#c9a84c] bg-[#fdf8f0] p-6 text-[#1a2e52]"
        role="status"
        aria-live="polite"
      >
        <p class="text-lg font-bold">Request received.</p>
        <p class="mt-1 text-sm">
          Our front desk will follow up shortly with corporate rates and availability. For anything
          urgent, call{' '}
          <a class="font-semibold underline" href="tel:4357896625">
            (435) 789-6625
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form class="grid gap-4" onSubmit={onSubmit} noValidate aria-describedby="crf-status">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class={LABEL} for="crf-kind">
            Request type
          </label>
          <select
            id="crf-kind"
            class={FIELD}
            value={values.kind}
            onChange={(e) => set('kind', (e.target as HTMLSelectElement).value)}
          >
            <option value="corporate_rate">Corporate / negotiated rate</option>
            <option value="room_block">Room block (group)</option>
          </select>
        </div>

        <div>
          <label class={LABEL} for="crf-name">
            Contact name<span class="text-[#c9a84c]"> *</span>
          </label>
          <input
            id="crf-name"
            class={FIELD}
            value={values.contact_name}
            onInput={(e) => set('contact_name', (e.target as HTMLInputElement).value)}
            onBlur={() => setTouched((t) => ({ ...t, contact_name: true }))}
            aria-invalid={touched.contact_name && !nameValid}
            required
          />
          {touched.contact_name && !nameValid && (
            <p class="mt-1 text-sm text-red-600">Please enter your name.</p>
          )}
        </div>

        <div>
          <label class={LABEL} for="crf-company">
            Company
          </label>
          <input
            id="crf-company"
            class={FIELD}
            value={values.company}
            onInput={(e) => set('company', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label class={LABEL} for="crf-email">
            Email<span class="text-[#c9a84c]"> *</span>
          </label>
          <input
            id="crf-email"
            type="email"
            class={FIELD}
            value={values.email}
            onInput={(e) => set('email', (e.target as HTMLInputElement).value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={touched.email && !emailValid}
            required
          />
          {touched.email && !emailValid && (
            <p class="mt-1 text-sm text-red-600">Please enter a valid email.</p>
          )}
        </div>

        <div>
          <label class={LABEL} for="crf-phone">
            Phone
          </label>
          <input
            id="crf-phone"
            type="tel"
            class={FIELD}
            value={values.phone}
            onInput={(e) => set('phone', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label class={LABEL} for="crf-rooms">
            Rooms
          </label>
          <input
            id="crf-rooms"
            type="number"
            min="1"
            class={FIELD}
            value={values.rooms}
            onInput={(e) => set('rooms', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label class={LABEL} for="crf-nights">
            Nights
          </label>
          <input
            id="crf-nights"
            type="number"
            min="1"
            class={FIELD}
            value={values.nights}
            onInput={(e) => set('nights', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div>
          <label class={LABEL} for="crf-arrival">
            Arrival date
          </label>
          <input
            id="crf-arrival"
            type="date"
            class={FIELD}
            value={values.arrival}
            onInput={(e) => set('arrival', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="sm:col-span-2">
          <label class={LABEL} for="crf-notes">
            Notes
          </label>
          <textarea
            id="crf-notes"
            rows={3}
            class={FIELD}
            value={values.notes}
            onInput={(e) => set('notes', (e.target as HTMLTextAreaElement).value)}
          />
        </div>
      </div>

      <div id="crf-status" aria-live="polite">
        {status === 'error' && (
          <p class="text-sm text-red-600">Something went wrong: {error}. Please call us instead.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        class="justify-self-start rounded-md bg-[#c9a84c] px-6 py-3 font-bold text-[#0e1c33] transition hover:bg-[#e0bb5a] disabled:opacity-60"
        data-track="corporate_lead_submit"
      >
        {status === 'submitting' ? 'Sending…' : 'Request corporate rates'}
      </button>
    </form>
  );
}
