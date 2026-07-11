// Cloudflare Worker: POST /  — lead alerting (Report §7).
// Triggered by a Supabase Database Webhook on INSERT into `lead`. Verifies a
// shared secret, then emails the front desk via Resend so a corporate request
// is seen immediately. Deployed separately (see docs/PROVISIONING.md); nothing
// in the site build depends on it.

export interface Env {
  RESEND_API_KEY: string;
  FRONT_DESK_EMAIL: string;
  LEAD_WEBHOOK_SECRET: string;
  FROM_EMAIL?: string;
}

interface LeadRecord {
  kind: string;
  company: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  rooms: number | null;
  nights: number | null;
  arrival: string | null;
  notes: string | null;
  source_page: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: LeadRecord | null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    // Supabase webhook sends this header (configured when creating the webhook).
    if (
      !env.LEAD_WEBHOOK_SECRET ||
      request.headers.get('x-webhook-secret') !== env.LEAD_WEBHOOK_SECRET
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    let payload: WebhookPayload;
    try {
      payload = (await request.json()) as WebhookPayload;
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    if (payload.type !== 'INSERT' || payload.table !== 'lead' || !payload.record) {
      return new Response('Ignored', { status: 200 });
    }

    const lead = payload.record;
    const subject = `New ${lead.kind} lead — ${lead.company ?? lead.contact_name}`;
    const text = [
      `Kind:     ${lead.kind}`,
      `Name:     ${lead.contact_name}`,
      `Company:  ${lead.company ?? '—'}`,
      `Email:    ${lead.email}`,
      `Phone:    ${lead.phone ?? '—'}`,
      `Rooms:    ${lead.rooms ?? '—'}`,
      `Nights:   ${lead.nights ?? '—'}`,
      `Arrival:  ${lead.arrival ?? '—'}`,
      `Source:   ${lead.source_page ?? '—'}`,
      '',
      `Notes:\n${lead.notes ?? '—'}`,
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL ?? 'leads@bestwesternvernalinn.com',
        to: env.FRONT_DESK_EMAIL,
        reply_to: lead.email,
        subject,
        text,
      }),
    });

    if (!res.ok) {
      return new Response(`Email failed: ${res.status}`, { status: 502 });
    }
    return new Response('OK', { status: 200 });
  },
};
