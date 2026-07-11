// Lead submission service. Writes a corporate rate / room-block request to the
// Supabase `lead` table via the anon client (RLS policy `lead_insert` allows
// anonymous INSERT). If Supabase isn't configured yet, it degrades to a
// pre-filled mailto so no lead is ever silently lost.
import { supabase, isSupabaseConfigured } from './supabase';
import type { LeadInsert } from './database.types';
import { BUSINESS } from '../data/business';

export type LeadInput = LeadInsert;

export type LeadResult =
  | { ok: true; via: 'supabase' }
  | { ok: true; via: 'mailto'; href: string }
  | { ok: false; error: string };

export async function submitLead(input: LeadInput): Promise<LeadResult> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('lead').insert(input);
    if (error) return { ok: false, error: error.message };
    return { ok: true, via: 'supabase' };
  }
  // No backend yet → hand off to email so the request still reaches the front desk.
  return { ok: true, via: 'mailto', href: buildMailto(input) };
}

function buildMailto(input: LeadInput): string {
  const subjectKind = input.kind === 'room_block' ? 'Room Block' : 'Corporate Rate';
  const subject = `${subjectKind} Request — ${input.company ?? input.contact_name}`;
  const lines = [
    `Kind: ${input.kind}`,
    `Name: ${input.contact_name}`,
    `Company: ${input.company ?? ''}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone ?? ''}`,
    `Rooms: ${input.rooms ?? ''}`,
    `Nights: ${input.nights ?? ''}`,
    `Arrival: ${input.arrival ?? ''}`,
    '',
    input.notes ?? '',
  ];
  return `mailto:${BUSINESS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join('\n')
  )}`;
}
