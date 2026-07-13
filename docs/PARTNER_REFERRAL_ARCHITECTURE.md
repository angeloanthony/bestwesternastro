# Partner Referral & Attribution Architecture

Status: **design + application layer built (migration 006), offline-verified.**
Not "verified" until 006 is applied live and the reconciliation loop runs once against
a real partner report (see [ROADMAP.md](ROADMAP.md) milestone convention).

This is the reference for the outbound-attribution system: the pipe that turns a
"Book Now" click into a tracked, reconcilable, commissionable event. Read it before
extending `/go`, `booking_intent`, or the reconciliation logic.

---

## 1. What problem are we solving?

The booking engine (`theworld24.com` today) is **not ours**. Once a visitor leaves for
it we have **no server-side view of the conversion** — no pixel, no webhook, no order
row. So we cannot answer the question the whole business depends on: _which of our
visitors actually booked, and what is that worth?_

We cannot make the conversion visible. We **can** make every outbound click
**identifiable**, and get the partner to **confirm matches monthly**. That is the entire
strategy: identify on the way out, reconcile after the fact.

## 2. The three nouns (say them precisely)

- **Referral** — the _relationship_: we sent this visitor to this partner. Every partner
  type is a referral, not just hotels. A restaurant, museum, raft company, or ATV outfitter
  routed through `/go` is the same shape. Nothing in the data model is hotel-specific;
  `booking_intent.partner_slug` is the only partner reference and it is partner-**type**
  agnostic. When the language in code/UI needs a generic term, prefer **partner referral**.
- **Redirect** — the _mechanism_: `/go/[partner]` is the interstitial that never lets a
  visitor link straight to the engine. It mints the code, records the intent, then hands off.
- **Booking intent** — the _record_: one row in `booking_intent` per outbound click. It is
  an *intent*, not a booking — we only know they set out to book. Whether they completed is
  resolved later, at reconciliation.

Distinct from **`lead`** (migration 001): that table is the _inbound form_ path (corporate
rate / room block). A lead is a person who asked us to follow up; a booking intent is a
person who clicked out to book themselves. Different funnels, kept separate on purpose.

## 3. How a click flows

```
"Book Now"  →  /go/[partner]?checkin&checkout&guests&utm_*
                 │
                 ├─ generateRefCode(partner.refPrefix)        e.g. BW26-7Q3K9F
                 ├─ track('partner_interstitial_view' | 'partner_referral')   GA4 (once each)
                 ├─ journey snapshot (member only, time-boxed, fail-open):
                 │      getSession → getTrip + getFavoriteSlugs               interests · has_itinerary · saved_slugs
                 ├─ recordBookingIntent(…)                    insert booking_intent (best-effort)
                 │      └─ on SUCCESS only: track('booking_intent_created')
                 ├─ staged progress + code shown to the guest
                 └─ track('partner_redirect') → window.location.replace(destinationUrl)   ref + utm always; promo iff confirmed
```

Fail-open is a hard rule: if Supabase is unconfigured, the insert errors, or anything
throws, **the redirect still happens** (`REDIRECT_CAP_MS` guarantees it). An unrecorded
click must never cost a booking.

Code map: [src/pages/go/[partner].astro](../src/pages/go/%5Bpartner%5D.astro) ·
[src/islands/GoRedirect.tsx](../src/islands/GoRedirect.tsx) ·
[src/lib/referrals.ts](../src/lib/referrals.ts) ·
[src/data/partners.ts](../src/data/partners.ts) ·
[006_booking_intent.sql](../database/migrations/006_booking_intent.sql).

## 4. Attribution keys — in priority order

Best → worst by likelihood of surviving the engine's funnel **and** appearing on the report:

1. **Promo code** (`partner.promo_code`, e.g. `ADVENTURE`) — the guest says it at the desk;
   it lands on the folio and is a first-class field in the PMS/CRS report. **This is the
   load-bearing signal.** A `ref`/`utm` URL param almost certainly gets stripped by the
   engine and is not something the partner reports. Do not invert this ordering.
2. **Promo code + arrival within [checkin ± 1 day]** — medium confidence.
3. **Member last name + arrival date** — medium confidence, Pass members only.
4. **`ref_code`** on the report — high confidence _if_ it appears, but assume it usually won't.

Because #1 is a promise the partner must honor, the guest-facing code/offer is **gated**
behind `partners.ts › offerConfirmed` (mirrors `business.ts › bookDirect[].confirmed`).
While `false`: clicks are still recorded, the interstitial stays neutral, and the `promo`
param is withheld from the outbound URL. Flip to `true` only after §7 is validated.

## 5. Reconciliation

Monthly, the partner sends a CSV. Store it verbatim in `hotel_report.raw_csv` (staff-only
table, service_role) so the matcher can be re-run when its logic improves. A matcher script
(not yet built — see §6) walks `booking_intent` rows still in `clicked`, applies §4 in
priority order, and advances status:

```
clicked → confirmed → stayed        (matched, stay completed)
clicked → no_match                  (aged out ~45 days, never matched)
clicked → cancelled                 (matched then cancelled)
```

`revenue_cents` / `commission_cents` / `confirmation_number` / `room_nights` are filled
from the report at this step, server-side only. The 5 states are deliberately the ones we
can _observe_ — no speculative CRM pipeline.

## 6. Intentionally postponed (do not build until there's data)

- **Matcher script** — build against the _first real CSV_, not a guessed schema.
- **`partner_public` view** — when a partner-admin UI arrives, `/go` config moves from
  `partners.ts` (TS, offline-first per [ADR-007](adr/ADR-007-attraction-catalogue-in-typescript.md))
  to a non-PII DB view feeding the build. **The route contract does not change** — only the
  source of `bookingUrl`/`promoCode`/`refPrefix`. This is the multi-tenant seam.
- ~~**Internal dashboard** (sessions → clicks → confirmed → stayed; members vs anonymous).~~
  **Built (M7)** as an offline operational report — `scripts/booking-report.mjs` reads
  booking_intent via service_role (it is not client-readable) and writes a static
  `reports/booking-report.html`. See [M7_PARTNER_REFERRAL_VERIFICATION.md](M7_PARTNER_REFERRAL_VERIFICATION.md).
- **Trip upsell before redirect** — the interstitial is the natural home for "add ATV
  tickets / restaurant coupons to your trip." Designed-for, not built: the flow already
  pauses on our infrastructure with the trip context in hand.
- **Commission automation, billing, referral scoring, partner dashboards.**

## 7. Business dependency — validate before trusting the input

The software assumes the partner will cooperate. That is a **business** dependency, not a
technical one, and it must be confirmed with the Best Western property **before** treating
the monthly report as a guaranteed input. Ask the GM:

- [ ] Can you provide a **monthly reservation report**?
- [ ] Can it include the **promo code** used?
- [ ] Can it include **arrival date, room nights, confirmation number**?
- [ ] How often / by what date each month?
- [ ] Any **corporate restrictions** on sharing this data?
- [ ] Will you **register `ADVENTURE`** in the engine and **honor** the check-in offer?

If yes → the business process the code depends on is validated; flip `offerConfirmed`. If
no → adjust the attribution strategy now, not after months of development.

## 8. Contract terms to lock (before SEO spend)

Attribution = ref **or** promo **or** name+date match. Window = 30 days from click.
Report by the 10th, schema per §5/§7. Commission = % of room revenue (ex tax/fees) on
**stayed** nights. Payment net-30. Data: they get no visitor list; we get no PII beyond
last name + confirmation number.
