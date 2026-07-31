# Best Western Vernal Inn — Business Knowledge Workbook

**Owner:** General Manager
**Maintained at:** `docs/BUSINESS_KNOWLEDGE_WORKBOOK.md`
**Last reviewed:** *(not yet started)*
**Next annual review due:** *(set on first completion)*

---

## What this document is

The single source of truth for everything the business knows about itself: rates, policies, corporate accounts, procurement capability, and the local knowledge held by the people at the front desk.

It is **not** an SEO checklist. The website is one consumer of this workbook, not its purpose. Rates, policies, and insurance certificates matter to the front desk, the bookkeeper, and a new GM on their first day, whether or not a website exists.

### The operating rule

> **When a rate, policy, corporate account, amenity, or document changes, the workbook is updated first. The website is then updated from the workbook.**

Not the other way around. A change made directly on the website — or in a data file — without a workbook entry is how a business loses track of what it actually promises. Within a year, nobody remembers whether the $588 weekly rate was approved or inherited.

### The workbook is internal. The website is public.

Two different things, and the difference matters:

- **Confidence** answers *"is this true?"*
- **Visibility** answers *"may we publish it?"*

They are independent. A negotiated corporate rate can be fully verified and entirely confidential. Company names, occupancy figures, and account terms are recorded here because the business needs them — **not** because they go on a web page. Publishing a client company's name without written permission is a business-relationship claim the hotel is not entitled to make.

Every table below has both columns. Fill in both.

---

## How to fill this in

Do **not** try to complete this in one sitting. It is designed to be filled over months and maintained for years.

**Start with the fast path below** — about 20 questions, roughly 30 minutes. Those are the answers currently blocking real work. Everything after that can be filled in as time allows.

### Confidence levels

Beside every answer, record how well it is known. This is what stops facts from quietly becoming folklore.

| Level | Meaning | What the website may do with it |
|---|---|---|
| **Verified** | Traceable to a document or official source — a contract, invoice, form, or official website | Publish as fact, with the source cited |
| **GM Approved** | Management has authorized this specific wording or number for publication | Publish, including prices and policies in structured data |
| **Local Knowledge** | True from front-desk experience, but not documented anywhere | Publish **only** when attributed to a named person who signed off |
| **Pending** | Believed, but not confirmed. Nobody has checked | **Publish nothing.** Not a soft warning |
| **N/A** | Does not apply to this property | Say so plainly if guests ask |

The website already enforces these in code. `Pending` is not a suggestion — an unset rate in `src/data/rates.ts` renders "Call for pricing", an unconfirmed benefit in `src/data/business.ts` renders nothing at all, and a front-desk insight without a named reviewer renders nothing at all. **A `Pending` answer physically cannot leak onto the live site.** That is the point.

### Visibility levels

| Level | Meaning |
|---|---|
| **Public** | May appear on the website |
| **On request** | Given to a caller or a company who asks, not published |
| **Internal** | Staff only. Never leaves the building |
| **Confidential** | Contractual or client-sensitive. Requires written permission to share at all |

### Review cycle — how fast does it go stale?

Confidence asks *is it true?* Visibility asks *may we publish it?* Review cycle asks the third question: **when does it stop being true?**

| Cycle | Use for | Example |
|---|---|---|
| **Never** | Facts that do not change | Elevation, distance, geology |
| **Annual** | Yearly-ish drift | Office locations, fee structures, published regulations |
| **Seasonal** | Re-check before each season | Campground openings, road closures, seasonal access |
| **Monthly** | Volatile | Airline schedules, construction detours |
| **On change** | No clock — an event triggers it | Rates, policies, corporate accounts (see §8.2) |

Set it once per answer and the system tracks the rest. The website reports what is overdue rather than relying on anyone remembering.

**Use "Never" sparingly and honestly.** It is the correct answer for the elevation of a mountain, and the wrong answer for almost everything else. A cycle set to Never to avoid the reminder is how a workbook rots.

> **Why this exists:** it is not anticipation. 22 pages on the site currently hand-type "last updated April 2026", the homepage says February, and the business record agrees with neither — today is July. That is the same silent drift that centralizing rates was meant to end, still happening to freshness. §8 of this workbook already promises an annual review; the review cycle is what puts a mechanism behind that promise.

> **Being overdue never removes anything from the website.** Stale local knowledge is unaudited, not false — and silently stripping content from live pages would be a worse failure than mild staleness. Overdue items are reported for a person to act on.

### Filling in a row

Answer in plain language. Do not write for the website — that translation happens later, by someone else. "Yes but only if they call ahead, and usually not in July" is a **better** answer than "Yes, subject to availability."

If the answer is *no*, write *no* and say why. A clear "we don't do direct billing because we've been burned on collections" is more useful than a blank, and it tells the website team to stop asking.

---

## ⚡ Start Here — the 20 answers that unblock everything

These are currently blocking nine planned web pages and several front-desk problems. Nothing else in this workbook is as urgent.

| # | Question | Answer | Confidence | Visibility |
|---|---|---|---|---|
| 1 | What is the exact **legal entity name** that appears on a W-9? | | | Internal |
| 2 | Is the property currently branded **Best Western Vernal Inn**, or something else? *(see §1.2 — three different names appear in our own systems)* | | | Public |
| 3 | Are the weekly rates **$588 Standard Queen / $660 Double Queen / $700 Standard King** still current? | | | Public |
| 4 | What is the **monthly rate** for a Standard Queen? | | | Public |
| 5 | Is that monthly rate **28 or 30 nights**? | | | Public |
| 6 | What is the **highest** monthly rate charged in peak season? *(this becomes the published "from" price — see §2.4)* | | | Public |
| 7 | What is the **Jacuzzi Suite** weekly rate? | | | Public |
| 8 | Is guest **laundry free or coin-operated**? *(our own pages currently contradict each other)* | | | Public |
| 9 | What is the **pet fee** — exact amount, per night or per stay? | | | Public |
| 10 | What is the **cancellation policy**? | | | Public |
| 11 | Do we honor a **best-rate guarantee**? | | | Public |
| 12 | How many rooms have **kitchenettes**, and what exactly is in them? | | | Public |
| 13 | How often is **housekeeping** on a weekly or monthly stay? | | | Public |
| 14 | Do we offer **direct billing** to companies? If yes, what are the payment terms? | | | Public |
| 15 | Do we have a **W-9** ready to send? | | | On request |
| 16 | Can we produce a **Certificate of Insurance**, and how long does it take? | | | On request |
| 17 | What does a guest need to bring for a **tax-exempt** stay? | | | Public |
| 18 | How many rooms make a **room block**, and when is the rooming list due? | | | Public |
| 19 | Who **owns corporate accounts** — name, email, extension? | | | Public |
| 20 | What **response time** can we actually commit to on a corporate inquiry? | | | Public |

> **Note on #6:** we publish the *peak* monthly rate as the "from" price, not the lowest. That way the published number can be honored in any month of the year. A rate the front desk cannot honor is worse than no rate at all.

---

## Section 1 — Property

**Owner:** GM · **Review:** annually, or on any ownership/brand change

### 1.1 Legal identity

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Legal business name (as on the W-9) | | | Internal |
| Entity type (LLC, corporation, partnership) | | | Internal |
| DBA / trade name used publicly | | | Public |
| State of registration | | | Internal |
| Who holds the EIN / who signs the W-9 | | | Internal |
| Business license number and renewal month | | | Internal |
| Physical address (confirm: 1935 South 1500 East, Vernal, UT 84078) | | | Public |
| Mailing address, if different | | | On request |
| Remittance address for invoice payments | | | On request |

### 1.2 Brand identity — needs resolution

Three different property identities currently appear in our own systems. A procurement department that receives inconsistent names will stall vendor onboarding, and search engines treat conflicting names as a signal that the business cannot be identified.

| Where it appears | Name used | Is this correct? | Confidence |
|---|---|---|---|
| Website, signage, schema | Best Western Vernal Inn | | |
| Contact email on file (`surestayplus53027@…`) | SureStay Plus | | |
| Booking engine URL (`…/executiveinnsuites.php`) | Executive Inn Suites | | |

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Which name is current and correct? | | | Public |
| Are the others historical, or still in active use? | | | Internal |
| Is the property a Best Western, SureStay Plus by Best Western, or another brand tier? | | | Public |
| Best Western property code / site number | | | Internal |
| Franchise agreement start and renewal dates | | | Confidential |
| Are we permitted to use the Best Western logo on our own website? | | | Internal |
| Should the contact email move to a branded domain? | | | Internal |

### 1.3 Management and ownership

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Ownership entity | | | Internal |
| Management company (currently listed as MSC Companies) — is this current? | | | Public |
| What decisions require owner vs. GM approval? | | | Internal |
| Who signs contracts and corporate rate agreements? | | | Internal |
| After-hours escalation contact | | | Internal |

### 1.4 Booking channels

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Which OTAs do we list on? | | | Internal |
| Approximate commission rate paid to OTAs | | | Confidential |
| Which booking engine is current? | | | Internal |
| Is the third-party engine still in use, or is phone-direct now the only path? | | | Internal |
| Does Best Western central reservations send us business? | | | Internal |
| Roughly what share of bookings comes from each channel? | | | Confidential |

### 1.5 Programs and affiliations

| Program | Do we participate? | Details / rate | Confidence | Visibility |
|---|---|---|---|---|
| Best Western Rewards | | | | Public |
| **GSA / government per diem rate** | | | | Public |
| Military / veteran rate | | | | Public |
| **Railroad crew program** | | | | On request |
| AAA | | | | Public |
| AARP / senior | | | | Public |
| Trucking or fleet programs | | | | On request |
| Airline crew contracts | | | | Confidential |
| FEMA / emergency response lodging | | | | On request |
| Chamber of Commerce membership | | | | Public |

> **On the railroad program:** railroad crews are a distinct lodging segment with dedicated booking desks and their own rate structures. If we participate, that is worth a page. If we don't, it may be worth asking whether we should — Vernal's rail access is limited, so this may be N/A. *(Answer it either way so nobody has to ask again.)*

> **On GSA:** this determines whether a `/government-per-diem-lodging-vernal` page gets built at all. If we do not offer a per diem rate, the page is not built — no page is better than a page that disappoints a federal traveler.

---

## Section 2 — Rates

**Owner:** GM · **Review:** whenever a rate changes, and at minimum annually
**Feeds:** `src/data/rates.ts`

Do not answer "what is the monthly rate." Answer the structure below — season, minimum stay, and exceptions — because those are what the front desk actually needs at 11 p.m., and they are what makes a published rate honest.

### 2.1 Room inventory

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Total room count | | | Public |
| Standard Queen — how many | | | Internal |
| Double Queen — how many | | | Internal |
| Standard King — how many | | | Internal |
| Jacuzzi Suite — how many | | | Internal |
| Rooms with kitchenettes — how many | | | Public |
| ADA-accessible rooms — how many | | | Public |
| Pet-designated rooms — how many | | | Public |
| Ground-floor rooms — how many | | | Public |
| Are there room types not listed on the website? | | | Public |

### 2.2 Rate grid

Fill one row per room type. Leave a cell blank rather than guessing — blank renders as "Call for pricing," which is safe.

**Standard Queen**

| Rate type | Peak season | Off season | Minimum stay | Confidence |
|---|---|---|---|---|
| Nightly | | | | |
| Weekly (7 nights) | *(currently published: $588)* | | | |
| Monthly | | | | |
| Typical negotiated corporate | | | | |

**Double Queen**

| Rate type | Peak season | Off season | Minimum stay | Confidence |
|---|---|---|---|---|
| Nightly | | | | |
| Weekly (7 nights) | *(currently published: $660)* | | | |
| Monthly | | | | |
| Typical negotiated corporate | | | | |

**Standard King**

| Rate type | Peak season | Off season | Minimum stay | Confidence |
|---|---|---|---|---|
| Nightly | | | | |
| Weekly (7 nights) | *(currently published: $700)* | | | |
| Monthly | | | | |
| Typical negotiated corporate | | | | |

**Jacuzzi Suite**

| Rate type | Peak season | Off season | Minimum stay | Confidence |
|---|---|---|---|---|
| Nightly | | | | |
| Weekly (7 nights) | *(never published — no number on file)* | | | |
| Monthly | | | | |
| Typical negotiated corporate | | | | |

### 2.3 Seasons

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Which months are peak? | | | Public |
| Which months are slowest? | | | Internal |
| What drives peak — tourism, drilling activity, hunting, events? | | | Public |
| Are there specific weekends that sell out every year? | | | Public |
| How far ahead does peak season sell out? | | | Public |
| Do weekly/monthly rates change by season, or hold year-round? | | | Public |

### 2.4 Publication rules

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Highest monthly rate charged in any season *(this becomes the published "from" price)* | | | Public |
| Effective date to publish beside rates (e.g. "Rates effective August 2026") | | | Public |
| Are published rates before or after tax? *(site currently says "+ tax")* | | | Public |
| What is the total tax rate on a room in Vernal? | | | Public |
| Are long stays exempt from transient room tax after a certain number of nights? | | | Public |
| Conditions to print beside the monthly rate | | | Public |

> **Why the peak rate becomes the "from" price:** a "from" number is only honest if the front desk can honor it in any month. Setting it at the peak rate guarantees that. Setting it at the off-season rate creates a promise that fails every summer.

### 2.5 Discounts and exceptions

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Is the 10% direct-booking discount (code ROCCO) still active? | | | Public |
| Is it applied even if the guest forgets to mention the code? | | | Public |
| Does it stack with corporate or weekly rates? | | | Public |
| Who can authorize an off-grid rate? | | | Internal |
| Lowest rate ever authorized, and under what circumstances | | | Confidential |
| Do we price-match competitors? | | | Public |
| Deposit required for long stays? | | | Public |

---

## Section 3 — Corporate Travel

**Owner:** GM · **Review:** quarterly
**Feeds:** workforce housing, oilfield housing, and `/business/*` pages

The most commercially valuable section in this workbook. Very little of it is SEO — it is the operational knowledge that determines whether a company can actually book here.

### 3.1 Existing relationships

> **Confidentiality:** record company names here for internal use. **None may be published without written permission.** Ask permission where the relationship is strong — a named client with consent is one of the most persuasive things a lodging page can carry, and one of the few things an OTA can never replicate.

| Company | Industry | Rooms/yr (approx) | Invoiced directly? | Permission to name publicly? | Confidence |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Which companies stay here most often? | | | Confidential |
| Which crews return year after year? | | | Confidential |
| Which have formal rate agreements vs. informal arrangements? | | | Confidential |
| Have we lost a corporate account? Why? | | | Internal |
| Which industries do we serve that the website doesn't mention? | | | Public |
| Has any client offered to provide a testimonial? | | | Internal |

### 3.2 Corporate rate policy

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Minimum rooms or room-nights to qualify for corporate pricing | | | Public |
| Typical corporate discount off rack | | | Confidential |
| Is a credit application required? | | | Public |
| Who approves a corporate rate? | | | Internal |
| How long does approval take? | | | Public |
| Is the rate guaranteed for a term, or reviewed periodically? | | | Public |
| Does the corporate rate hold during peak season? | | | Public |
| Do we require a minimum volume commitment? | | | Public |

### 3.3 Long-term projects

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Longest stay we have hosted | | | Public |
| Typical project length for crews | | | Public |
| Can a project be extended mid-stay? | | | Public |
| Is the rate held if a project extends? | | | Public |
| Can rooms be added mid-project? | | | Public |
| Can a crew rotate people through the same block? | | | Public |
| Notice needed to release rooms without penalty | | | Public |
| Deposit policy for long-term blocks | | | Public |
| Have we ever turned down a large crew? Why? | | | Internal |

### 3.4 Amenities that matter to crews

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| **Housekeeping** frequency on a weekly stay | | | Public |
| **Housekeeping** frequency on a monthly stay | | | Public |
| Can a guest decline housekeeping? Any rate effect? | | | Public |
| **Laundry** — free or coin-operated? *(pages contradict — resolve)* | | | Public |
| Number of washers and dryers | | | Public |
| Are laundry machines ever a bottleneck when full of crews? | | | Public |
| **Kitchenette** — exact contents (fridge size, stovetop, microwave, cookware, utensils?) | | | Public |
| Are kitchenettes guaranteed or on request? | | | Public |
| **Truck parking** — how many oversized spaces? | | | Public |
| Can crews park trailers or equipment overnight? | | | Public |
| Any vehicle we cannot accommodate? | | | Public |
| Is parking ever full? | | | Public |
| Is there a plug for block heaters in winter? | | | Public |
| **Breakfast** hours — and do they work for a pre-shift departure? | | | Public |
| Can early-shift crews get anything before breakfast opens? | | | Public |
| **Internet** — speed, and does it hold up when full? | | | Public |
| Is there a workspace or meeting room? | | | Public |
| Can we receive mail or packages for long-stay guests? | | | Public |
| Is there a place to store tools or gear? | | | Public |
| Any policy on muddy or greased work clothing? | | | Public |

---

## Section 4 — Procurement

**Owner:** GM + bookkeeper · **Review:** annually, or on any banking/insurance change
**Feeds:** `/business/*` pages and the document downloads

For every capability: **Yes → where is it, and how fast?** **No → why not?** A clear "no" is a real answer and saves everyone time.

### 4.1 Capability checklist

| Capability | Yes/No | Where it lives / who produces it | Turnaround | Confidence |
|---|---|---|---|---|
| **W-9** | | | | |
| **Certificate of Insurance (COI)** | | | | |
| COI naming a client as certificate holder | | | | |
| **ACH / EFT payment details** | | | | |
| Bank verification letter | | | | |
| **Vendor onboarding packet** | | | | |
| Accept **purchase orders** | | | | |
| **Direct invoicing** to a company | | | | |
| **Consolidated invoice** for multiple rooms | | | | |
| Invoice split by cost center or project code | | | | |
| **Tax exemption** processing | | | | |
| Credit application form | | | | |
| Signed rate agreement / contract | | | | |
| Registration in a vendor portal (Ariba, Coupa, etc.) | | | | |
| Master service agreement | | | | |
| Business license copy on request | | | | |

### 4.2 Direct billing

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Do we offer direct billing? | | | Public |
| What qualifies a company for it? | | | Public |
| What does the application require? | | | Public |
| How long does approval take? | | | Public |
| Payment terms (net 15, net 30, other) | | | Public |
| Is there a credit limit? | | | On request |
| What appears on the invoice? | | | Public |
| Are incidentals billed to the company or the guest? | | | Public |
| What happens on a no-show against a direct-billed block? | | | Public |
| How is a disputed charge handled? | | | Public |
| Have we had collection problems? Did that change the policy? | | | Internal |

### 4.3 Tax exemption

> **Do not restate Utah tax law in this workbook or on the website.** Record *our procedure* — what we need and when. Regulatory language must always link to the Utah State Tax Commission, never be paraphrased from memory. Tax rules change and a wrong summary creates liability.

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Which exemption form do we require? | | | Public |
| Must payment come directly from the organization? | | | Public |
| What if an employee pays personally and is reimbursed? | | | Public |
| What must be presented at check-in? | | | Public |
| Can tax be refunded after checkout? | | | Public |
| Are state sales tax and local transient room tax treated differently? | | | Public |
| Are long stays exempt from room tax after N nights? | | | Public |
| Which organization types have we successfully processed? | | | Public |
| Who at the property handles exemption paperwork? | | | Internal |
| Official source URL for the current rules | | | Public |

### 4.4 Procurement contact

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Named contact for corporate accounts | | | Public |
| Direct email | | | Public |
| Phone extension | | | Public |
| Hours that person is reachable | | | Public |
| Backup contact | | | Public |
| **Committed response time to a corporate inquiry** | | | Public |
| Who answers a procurement question at 9 p.m.? | | | Internal |

---

## Section 5 — Front Desk Knowledge (the standing questionnaire)

**Owner:** Front Desk Manager · **Review:** rolling — one attraction per month
**Feeds:** `src/data/frontDeskInsights.ts`

This is the most durable asset in the workbook. Rates change annually; local knowledge compounds.

### 5.1 The instrument

The same questions are asked about **every** subject. One instrument, reused indefinitely — that is what makes it scale to all 48 locations in the catalogue without becoming a new project each time.

Each question has a permanent **ID**. Quote the ID, not the wording, whenever an answer is recorded or discussed — the wording of a prompt may be improved over time, but the ID never changes, so answers can never be reassigned to the wrong question. These are the same IDs used in `src/data/frontDeskInsights.ts`.

| # | ID | Question | Required | Publishable |
|---|---|---|---|---|
| 1 | `guest_questions` | What do guests most often ask about this place? | ✅ | Public |
| 2 | `common_mistake` | What mistake do visitors commonly make? | ✅ | Public |
| 3 | `surprises` | What surprises people? | — | Public |
| 4 | `best_season` | What is the best season, and why? | ✅ | Public |
| 5 | `local_knowledge` | What do locals know that the guidebooks miss? | ✅ | Public |
| 6 | `what_to_bring` | What should people bring? | — | Public |
| 7 | `best_time_of_day` | What is the best time of day to go? | — | Public |
| 8 | `parking` | Is parking ever full — and when? | — | Public |
| 9 | `food_after` | What restaurant do you recommend afterward? | — | Public |
| 10 | `not_right_for` | Who is this *not* right for? | ✅ | Public |
| 11 | `complaints` | What do guests complain about after visiting? | — | **Never published** |

> **On question 10:** the honest negative is the highest-trust content a hotel can publish and almost nobody does it. "Fantasy Canyon is not worth the drive if you have small kids or a low-clearance car" earns more credibility than ten paragraphs of enthusiasm — and it prevents the bad review that follows a guest's wasted afternoon. Answer it candidly.

> **On question 11:** this one is operational, not editorial. Knowing what guests complain about lets the front desk pre-empt it at check-in. It is marked non-publishable **in code** — there is no configuration that puts it on a page. Answer it as bluntly as you like.

> **"Required" is a completeness signal, not a gate.** A sheet missing a required answer is reported, not blocked. Making it a hard requirement would pressure staff into inventing an answer rather than leaving a blank — the exact failure this whole system exists to prevent. A blank is always the correct answer to a question you cannot answer.

### 5.1a Personally verified — observation vs. research

Every answer records whether the person answering has **actually been there**.

| Field | Meaning |
|---|---|
| **Personally verified: Yes** | The answer comes from having been there |
| **Personally verified: No** | The answer comes from a published source — **name it** |

This is not bureaucracy. "The lot fills by 10 a.m." from someone who has driven past at 10 a.m. is worth more than the same sentence copied from a brochure, and the reader is entitled to know which they are reading. The website displays the distinction.

A single sheet can legitimately mix the two — staff have stood at the trailhead (observation) but took the seasonal closure date from the Forest Service (research). Record it per answer where it differs.

**An answer marked "No" without a named source is not published.** The code enforces this; it is not a matter of editorial discipline.

### 5.2 Rules for answers

- **Answer in your own words.** The website team will not rewrite them into marketing copy — the plain phrasing *is* the value.
- **Specific beats general.** "The lot fills by 10 a.m. on summer Saturdays" is usable; "it gets busy" is not.
- **"I don't know" is a valid answer.** Better than a guess that becomes permanent.
- **Every sheet needs a name and a date.** Unsigned local knowledge cannot be published — the site enforces this in code.
- **Do not state regulations.** Hunting seasons, fishing limits, and permit rules change annually. Point to the official source instead; §8 handles the annual re-check.

### 5.3 How this reaches the website

`src/data/frontDeskInsights.ts` carries all eleven questions with the IDs above, and a blank record for every subject in §7. **Built and verified 2026-07-31.**

The pipeline:

```
Workbook sheet  →  reviewed answers  →  frontDeskInsights.ts  →  FrontDeskInsight.astro  →  live page
```

Seven conditions must all hold before a single answer appears on a page. Each was tested:

| # | Condition | If it fails |
|---|---|---|
| 1 | The sheet is marked reviewed | Nothing publishes |
| 2 | A named reviewer is recorded | Nothing publishes |
| 3 | A review date is recorded | Nothing publishes |
| 4 | The question is publishable (not `complaints`) | That answer is dropped |
| 5 | Confidence is not `Pending` or `N/A` | That answer is dropped |
| 6 | Visibility is `Public` | That answer is dropped |
| 7 | If not personally verified, a source is named | That answer is dropped |

Filling in a sheet requires **no code change** — only this file and the data file. Nobody needs an engineer to publish local knowledge, and nobody can bypass the gates to publish something unreviewed.

---

## Section 6 — Oilfield Knowledge

**Owner:** GM + Front Desk Manager · **Review:** twice yearly, or when basin activity shifts materially

This is knowledge no competitor can research and no OTA can replicate. Booking.com knows the room type. It does not know that crews leave at 4:45 a.m. and what that means for breakfast.

### 6.1 Who stays here

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Which types of crews stay here most? | | | Public |
| Which companies return regularly? | | | Confidential |
| Typical crew size per booking | | | Public |
| Typical stay length | | | Public |
| Longest-running crew relationship | | | Internal |
| Do crews book directly, or through a coordinator? | | | Public |
| How far ahead do they book? | | | Public |
| Are bookings seasonal, or steady year-round? | | | Public |
| How much does basin activity swing occupancy? | | | Confidential |

### 6.2 What crews actually need

| Question | Answer | Confidence | Visibility |
|---|---|---|---|
| Biggest complaint from crew guests | | | Internal |
| Biggest compliment | | | Public |
| Most common special request | | | Public |
| Typical shift start time | | | Public |
| Typical return time | | | Public |
| Do crews need breakfast before it opens? What do we do about it? | | | Public |
| Do they need late check-in? | | | Public |
| Do they need quiet daytime rooms for night-shift sleepers? | | | Public |
| Can we group a crew on one floor or wing? | | | Public |
| How much do they use the laundry? | | | Public |
| What do they cook in the kitchenettes? | | | Public |
| Any recurring internet complaints? | | | Internal |
| What do they ask for that we cannot provide? | | | Internal |
| Why do crews choose us over a man camp? | | | Public |
| Why would a crew choose a competitor? | | | Internal |

### 6.3 Geography — must be measured, never estimated

Drive times published on the website must be measured. An estimate that costs a crew a late arrival is worse than no number.

| Destination | Drive time | Route | Measured by | Date | Confidence |
|---|---|---|---|---|---|
| Vernal Regional Airport (VEL) | *(0.6 mi published — confirm)* | | | | |
| Roosevelt | | | | | |
| Duchesne | | | | | |
| Rangely, CO | | | | | |
| Bonanza / Gilsonite area | | | | | |
| Ouray / Pariette area | | | | | |
| Nearest truck stop with diesel | | | | | |
| Nearest 24-hour food | | | | | |
| Nearest hardware / industrial supply | | | | | |
| Nearest urgent care | | | | | |
| Ashley Regional Medical Center | | | | | |

---

## Section 7 — Attraction Review Sheets

**Owner:** Front Desk Manager · **Review:** one per month until complete, then annually

One sheet per subject, using the questions from §5.1.

**Subjects are not only attractions.** The airport is a *facility*, the conference center is a *venue*, and the Uinta Mountains are a *region* — none are in the attraction catalogue, and all three are things guests ask about. The knowledge system covers what guests ask about, not what a catalogue happens to list.

A blank record already exists in code for every subject below. **An empty record costs almost nothing; adding one later usually never happens.**

### Priority order

| # | Subject | Kind | Why this order |
|---|---|---|---|
| 1 | **Ashley National Forest** | attraction | 36% of all site impressions and **zero** clicks. Highest-value single sheet in the building |
| 2 | **Dinosaur National Monument** | attraction | Largest draw, existing page |
| 3 | **Flaming Gorge** | attraction | Existing page, high intent |
| 4 | **Fantasy Canyon** | attraction | Remote — `not_right_for` matters most here |
| 5 | **Red Fleet State Park** | attraction | Existing page; the trackway is a genuine differentiator |
| 6 | **Jensen, Utah** | region | Existing page |
| 7 | **Steinaker State Park** | attraction | Closest recreation to the hotel |
| 8 | **McConkie Ranch Petroglyphs** | attraction | Private land, etiquette expectations poorly documented elsewhere |
| 9 | **Uinta Mountains** | region | Spans several catalogue entries |
| 10 | **Utah Field House of Natural History** | attraction | In-town, all-weather option |
| 11 | **Jones Hole** | attraction | Hatchery and trail are one destination to a guest |
| 12 | **Split Mountain** | attraction | Boat ramp and campground, one place to a guest |
| 13 | **Sheep Creek Canyon** | attraction | Seasonal access |
| 14 | **Vernal Regional Airport (VEL)** | facility | Crew-rotation entity — different questions apply (see below) |
| 15 | **Uintah Conference Center** | venue | Room-block source the site does not currently address |

Sheets 16+ work through the remaining catalogue as time allows.

### Blank sheet template

Copy this block for each subject. Every field maps to a field in the data model.

---

**Subject:** ________________________ **Kind:** attraction / facility / venue / region

**Completed by:** ________________ **Date:** ______________ *(YYYY-MM-DD)*

**Personally verified:** Yes / No — *if No, source:* ________________________

**More than one person can fill in one sheet.** Housekeeping, maintenance, breakfast, and the
front desk each see the property from a different angle, and the interesting answers are often
not the owner's. Where a row comes from someone other than the person signing the sheet, write
their role next to the answer — *"(housekeeping)"*, *"(breakfast, 5:30 shift)"*. It lands in
that answer's `basedOn` field and survives into the record.

This does **not** change who signs. One person authorises publication for the whole sheet — that
is `reviewedBy`, and it should be the owner or GM. Contribution and authorisation are different
acts, and only the second one puts words on the public site.

**Default confidence:** Local Knowledge *(this instrument collects experience by nature)*
**Default visibility:** Public *(override per answer where it differs)*
**Default review cycle:** ______________ *(annual unless the subject drifts faster)*

| ID | Question | Answer | Verified? | Visibility | Cycle |
|---|---|---|---|---|---|
| `guest_questions` | What do guests most often ask about this place? | | | | |
| `common_mistake` | What mistake do visitors commonly make? | | | | |
| `surprises` | What surprises people? | | | | |
| `best_season` | Best season, and why? | | | | |
| `local_knowledge` | What do locals know that guidebooks miss? | | | | |
| `what_to_bring` | What should people bring? | | | | |
| `best_time_of_day` | Best time of day to go? | | | | |
| `parking` | Is parking ever full — and when? | | | | |
| `food_after` | What restaurant do you recommend afterward? | | | | |
| `not_right_for` | Who is this *not* right for? | | | | |
| `complaints` | What do guests complain about afterward? | | | **Internal — never published** | |

*Leave the last three columns blank to accept the sheet defaults above. Fill them in only where a specific answer differs — an answer taken from a published source, one that should stay internal, or one that goes stale faster than the rest of the sheet.*

*A single fast-moving answer pulls the whole sheet's schedule forward. That is intended: you re-review a sheet, not an individual sentence.*

**Anything else guests should know:**

**Regulations mentioned above** *(list only — do not restate the rule; link the official source)*:

---

### Sheet 1 — Ashley National Forest

*(Blank — highest priority)*

**Extra questions specific to this sheet.** The Ashley page currently ranks nationally for forests in Missouri, North Carolina, Arkansas, and Texas because its copy could describe any national forest. These answers exist to bind the page to *this* forest:

| Question | Answer | Confidence |
|---|---|---|
| Which specific entrance or access point do our guests actually use? | | |
| What is the exact drive time from the hotel to that access point? | | |
| What is at that access point — trailhead, ranger station, campground? | | |
| Which trail or area do we recommend most often, by name? | | |
| Which road closes seasonally, and roughly when? | | |
| What is the elevation difference between Vernal and the forest? | | |
| What is one thing true of *this* forest and no other? | | |
| Which GPS route sends guests wrong, and where does it send them? | | |
| **Does cell service drop, and roughly where does it stop?** | | |
| When do the roads turn to mud, and when do fall colours peak? | | |
| Do guests underestimate the distance — and by how much? | | |

**⚠ The cell-service row is not optional.** `frontDeskInsights.ts` currently carries an Ashley
`local_knowledge` answer about downloading maps before you drive up, marked **`pending`** and
therefore unpublishable. It came from a remark about "recreation areas" generally, not about
Ashley. This row is what decides whether that answer becomes true of *this* forest or gets
deleted. Answer it either way — "no, coverage is fine" is a perfectly good answer and closes
the record just as well.

**The scenario question — ask this one out loud, not on paper.**

> A guest at the desk says: *"We're heading up to the forest tomorrow morning."*
> What do you tell them, in the order you'd tell them?

Whatever comes out of that is the sheet. It is the closest thing to a transcript of the
expertise this page is missing, and it tends to produce answers the numbered questions above
do not — take it down verbatim rather than tidying it into prose.

**Why this sheet is now the top of the queue.** The 2026‑07‑31 owner interview produced usable
answers for Dinosaur National Monument, Flaming Gorge, and property operations — and **nothing
for Ashley**. The facts on that page are already right; the experience is what is absent, and
it is the page carrying 36% of site impressions at zero clicks. This is a dedicated
conversation, not a question tacked onto another meeting.

### Sheet 14 — Vernal Regional Airport (VEL)

A facility, not an attraction. The standard questions still apply, but these matter more — this is the crew-rotation entity, and getting it wrong costs a company a missed shift:

| Question | Answer | Confidence |
|---|---|---|
| Which airlines serve VEL, and to where? | | |
| How reliable are the flights — how often cancelled? | | |
| Is there a rental car counter, and does it run out of cars? | | |
| What happens to a crew when the inbound flight is cancelled? | | |
| **What happens when someone misses the connection?** | | |
| **Is Salt Lake City the practical backup airport?** | | |
| **Do crews usually fly into VEL, or drive from Salt Lake?** | | |
| Drive time from Salt Lake City, if they drive | | |
| **How late can someone check in after a delayed arrival?** | | |
| Do we hold rooms for weather-stranded passengers? | | |
| Do we hold a late arrival's room, and until when? | | |
| Is our shuttle or pickup arrangement — if any — accurate as published? | | |

> Most travel sites answer *"how do I get there?"* Almost none answer *"what happens when I can't?"* — which is the question a travel coordinator is actually holding. The 24-hour front desk means we can answer the late-arrival question in a way most properties cannot; that is worth stating plainly rather than leaving implied.
>
> **Review cycle: monthly.** Airline service at regional airports changes on short notice, and a published carrier that no longer flies is worse than saying nothing.

### Sheets 2–13 and 15

*(Copy the blank template above for each.)*

---

## Section 8 — Annual Review

**Owner:** GM · **Due:** same month every year

### 8.0 The maintenance report

The annual review is no longer the only thing standing between the site and stale content. Every record carries a review cycle (see *How to fill this in*), and the build reports against it:

```
3 overdue · 2 due within 30 days · 9 current · 1 never reviewed
```

Work the overdue list first — it is sorted by how far past due each item is. This turns maintenance from *hoping someone remembers* into a list someone can finish.

The annual review below remains the backstop for everything the report cannot see: business facts, documents, photos, and anything held only on paper.

### 8.1 Annual checklist

| Item | Reviewed | Changed? | Date | By |
|---|---|---|---|---|
| **Freshness report clear — nothing overdue** | | | | |
| **`lastUpdated` strings match reality** *(22 pages hand-type "April 2026"; the homepage says February)* | | | | |
| All rates (§2) still current | | | | |
| Effective date updated beside published rates | | | | |
| Peak/off-season months still accurate | | | | |
| All policies (§2.5, §3) still accurate | | | | |
| Corporate account list current — additions and losses | | | | |
| Permission to name clients publicly still valid | | | | |
| W-9 current | | | | |
| **COI not expired** | | | | |
| Banking / ACH details current | | | | |
| Tax exemption procedure still matches state guidance | | | | |
| Amenity list matches reality | | | | |
| Breakfast hours current | | | | |
| Room counts and inventory current | | | | |
| Procurement contact still correct | | | | |
| Photos current — no closed venues, no old signage | | | | |
| FAQ answers still accurate | | | | |
| **Hunting regulations — official source link still live** | | | | |
| **Fishing regulations — official source link still live** | | | | |
| Seasonal road and facility closures re-confirmed | | | | |
| Attraction sheets — any that changed | | | | |
| Any attraction permanently closed or renamed | | | | |
| Brand identity (§1.2) unchanged | | | | |

> **Regulations:** never restate hunting or fishing rules in our own words, in this workbook or on the website. They change annually, and a stale limit or season date published as fact is a genuine liability. Confirm the official source URL still resolves, and link it. That is the whole job.

> **COI expiry is the one to watch.** An expired certificate stops a corporate booking on the day the client's procurement team checks it, with no warning.

### 8.2 Off-cycle updates

The annual review is a backstop, not the main mechanism. Update the workbook **immediately** when any of these happen:

| Trigger | Update section | Then update |
|---|---|---|
| Any rate changes | §2 | `src/data/rates.ts` |
| A policy changes (pets, cancellation, housekeeping) | §2.5 / §3.4 | `src/data/business.ts` + affected pages |
| A new corporate account opens | §3.1 | Nothing public without permission |
| An amenity is added or removed | §3.4 | `src/data/business.ts` |
| Insurance renews | §4.1 | Replace the COI file |
| Banking details change | §4.1 | Replace ACH details |
| Procurement contact changes | §4.4 | `/business/` pages |
| Brand or ownership changes | §1 | Sitewide — this is a large change |
| A front-desk insight is confirmed | §5 / §7 | `src/data/frontDeskInsights.ts` |
| An attraction closes or changes access | §7 | The relevant destination page |

### 8.3 Change log

| Date | Section | What changed | Changed by | Website updated? |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

---

## Appendix A — Workbook → website mapping

Which file each section feeds. Nothing on the website should be edited without a corresponding workbook entry.

| Workbook section | Source of truth file | What it controls |
|---|---|---|
| §1 Property | `src/data/business.ts` | Name, address, phone, email, schema identity |
| §2 Rates | `src/data/rates.ts` | Every price, rate table, and `Offer` in structured data |
| §2.5 Discounts | `src/data/business.ts` → `directBooking`, `bookDirect[]` | The ROCCO discount and the benefit list |
| §3 Corporate | `/workforce-housing-*`, `/oilfield-housing-*` | Crew and coordinator content |
| §4 Procurement | `/business/*` + `public/documents/` | Direct billing, W-9, COI, tax exemption |
| §5, §7 Local knowledge | `src/data/frontDeskInsights.ts` | Every front-desk insight on every destination page |
| §6 Oilfield | `/oilfield-housing-vernal` | Basin content and measured drive times |

### The publication gates, in plain terms

Three mechanisms already in the code enforce the confidence levels. None of them can be bypassed by editing a page:

1. **`RATES` uses `null` for unpublished.** A rate nobody confirmed renders "Call for pricing." It cannot render a number.
2. **`BUSINESS.bookDirect[].confirmed`** gates each benefit claim. `false` renders nothing. *(Best-rate guarantee and flexible cancellation are currently `false` — see fast-path questions 10 and 11.)*
3. **`frontDeskInsights` requires `reviewed` + `reviewedBy` + `reviewedOn`.** An insight without a named person and a date renders nothing.

This is deliberate. It means the honest failure mode — a blank where a fact should be — is the only failure mode available. The site cannot invent a rate, a policy, or an insider tip, because it has no mechanism to publish an unconfirmed one.

---

## Appendix B — Never publish without verification

Regardless of confidence level, these are never written from memory or inference:

Pricing · policies · amenities · **regulations** (hunting, fishing, tax, permits) · travel and drive times · seasonal closures · **business relationships and client names** · certifications · response-time commitments · GSA per diem rates · review ratings and counts

When the answer is unknown: leave it blank and mark it **Pending**. A blank is a task. A guess is a liability that outlives everyone who remembers it was a guess.
