/** @jsxImportSource preact */
// Optional post-login profile (M2, ADR-006). Shown INSIDE the dashboard after a
// guest is authenticated — it never gates signup and can always be skipped. Answers
// "why are you visiting?" so later milestones can personalise recommendations.
// Writes the member's own row via src/lib/profile (RLS prof_own scopes it).
import { useState } from 'preact/hooks';
import { saveProfile, type ProfileInput } from '../lib/profile';
import type { MemberProfileRow } from '../lib/database.types';
import { track } from '../lib/analytics';

type Status = 'idle' | 'saving' | 'saved' | 'error';

// Guest-facing labels → the user_types[] text array stored on the profile.
const VISIT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'tourist', label: 'Exploring the area' },
  { value: 'business', label: 'Here for work / crew' },
  { value: 'family', label: 'Visiting family & friends' },
  { value: 'passing_through', label: 'Passing through' },
];

const LABEL = 'mb-1 block text-sm font-semibold text-[#1a2e52]';
const FIELD =
  'w-full rounded-md border border-[#1a2e52]/30 bg-white px-3 py-2 text-[#1a2e52] ' +
  'outline-none focus:border-[#c9a84c] focus:ring-2 focus:ring-[#c9a84c]/40';

export default function PassProfileForm({
  userId,
  initial,
}: {
  userId: string;
  initial?: MemberProfileRow | null;
}) {
  const [types, setTypes] = useState<string[]>(initial?.user_types ?? []);
  const [visitReason, setVisitReason] = useState(initial?.visit_reason ?? '');
  const [optin, setOptin] = useState<boolean>(initial?.marketing_optin ?? false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const toggleType = (value: string) =>
    setTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  async function onSave(e: Event) {
    e.preventDefault();
    setStatus('saving');
    setError('');
    const input: ProfileInput = {
      // Default to the schema's default rather than writing an empty array.
      user_types: types.length ? types : ['tourist'],
      visit_reason: visitReason.trim() || null,
      marketing_optin: optin,
    };
    const result = await saveProfile(userId, input);
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      track('pass_profile_error', { reason: 'backend' });
      return;
    }
    setStatus('saved');
    track('pass_profile_saved');
  }

  if (status === 'saved') {
    return (
      <p class="text-sm text-[#1a2e52]" role="status" aria-live="polite">
        Thanks — your Pass is personalised. You can update this any time.
      </p>
    );
  }

  return (
    <form class="grid gap-4" onSubmit={onSave}>
      <fieldset>
        <legend class={LABEL}>What brings you to Vernal? (optional)</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          {VISIT_TYPES.map((t) => (
            <label key={t.value} class="flex items-center gap-2 text-sm text-[#1a2e52]">
              <input
                type="checkbox"
                checked={types.includes(t.value)}
                onChange={() => toggleType(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label class={LABEL} for="pass-visit-reason">
          Anything you’re hoping to see or do? (optional)
        </label>
        <input
          id="pass-visit-reason"
          class={FIELD}
          value={visitReason}
          onInput={(e) => setVisitReason((e.target as HTMLInputElement).value)}
          placeholder="Dinosaurs, Flaming Gorge, a quiet week…"
        />
      </div>

      <label class="flex items-start gap-2 text-sm text-[#1a2e52]">
        <input
          type="checkbox"
          checked={optin}
          onChange={(e) => setOptin((e.target as HTMLInputElement).checked)}
        />
        <span>Email me seasonal Vernal tips and Best Western Vernal Inn offers. (optional)</span>
      </label>

      <div aria-live="polite">
        {status === 'error' && (
          <p class="text-sm text-red-600">Couldn’t save ({error}). Please try again.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={status === 'saving'}
        class="justify-self-start rounded-md bg-[#1a2e52] px-5 py-2.5 font-bold text-white transition hover:bg-[#26406e] disabled:opacity-60"
      >
        {status === 'saving' ? 'Saving…' : 'Save my preferences'}
      </button>
    </form>
  );
}
