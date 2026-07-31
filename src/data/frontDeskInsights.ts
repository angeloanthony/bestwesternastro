// src/data/frontDeskInsights.ts
//
// FIRST-HAND LOCAL KNOWLEDGE — the one thing on a destination page that research
// cannot produce and competitors cannot copy.
//
// ─────────────────────────────────────────────────────────────────────────────
// v2 — this file is now an EDITORIAL DATA MODEL, not a content list.
//
// It is the code half of `docs/BUSINESS_KNOWLEDGE_WORKBOOK.md`. The workbook is
// filled in by people at the property; the answers land here; the gates below
// decide what may reach a page. The pipeline is:
//
//     Workbook  →  reviewed answers  →  this file  →  FrontDeskInsight.astro  →  site
//
// WHAT CHANGED FROM v1 AND WHY:
//
//   • Questions have STABLE IDs. Answers are keyed by `questionId`, never by array
//     position — so reordering or rewording a prompt cannot silently reassign
//     answers to the wrong question. The workbook prints the same IDs.
//
//   • Two independent axes on every answer:
//       `confidence` — is it TRUE?        (verified / gm-approved / local-knowledge / pending / na)
//       `visibility` — may we PUBLISH it? (public / on-request / internal / confidential)
//     They are independent. "Halliburton stays here" can be fully `verified` and
//     strictly `confidential`. One axis would have forced a choice between
//     recording knowledge and protecting it.
//
//   • `personallyVerified` separates OBSERVATION from RESEARCH. Staff who have
//     stood in the parking lot know something a Forest Service PDF cannot tell
//     them. When false, `basedOn` must name the source — enforced, not suggested.
//
//   • Subjects are not limited to catalogue attractions. A record can describe a
//     `facility` (the airport), a `venue` (conference center), or a `region`
//     (the Uinta Mountains) — none of which are in `attractions.generated.ts`.
//
// THE PUBLICATION GATE IS UNCHANGED IN SPIRIT: an answer nobody signed off on
// renders NOTHING. Same discipline as `BUSINESS.bookDirect[].confirmed` and
// `RATES`' null-means-unpublished. A fabricated "insider tip" has no path to the
// live site, because there is no mechanism to publish an unconfirmed one.
//
// TO PUBLISH: fill `answers`, set `reviewed: true`, `reviewedBy`, `reviewedOn`.
// No code change required beyond this file.

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/** Is it true, and how well is that known? Mirrors the workbook's Confidence column. */
export type Confidence =
  /** Traceable to a document or official source. */
  | 'verified'
  /** Management authorized this specific wording for publication. */
  | 'gm-approved'
  /** True from front-desk experience; not documented anywhere. Publishable only when signed. */
  | 'local-knowledge'
  /** Believed but unchecked. NEVER published. */
  | 'pending'
  /** Does not apply to this subject. */
  | 'na';

/** May we publish it? Mirrors the workbook's Visibility column. Orthogonal to Confidence. */
export type Visibility =
  /** May appear on the website. */
  | 'public'
  /** Given to a caller or company who asks; not published. */
  | 'on-request'
  /** Staff only. */
  | 'internal'
  /** Contractual or client-sensitive; requires written permission to share at all. */
  | 'confidential';

/** What kind of thing the knowledge is about. Wider than the attraction catalogue. */
export type SubjectKind = 'attraction' | 'facility' | 'venue' | 'region';

/** How fast does this decay? The third axis, after Confidence (is it true?) and
 *  Visibility (may we publish it?): Freshness asks WHEN DOES IT STOP BEING TRUE?
 *
 *  Justified by observed drift, not anticipation: 22 pages hand-type
 *  `lastUpdated="April 2026"`, the homepage says February, and `BUSINESS.lastUpdated`
 *  agrees with neither — the same class of decay that `rates.ts` was built to end.
 *  The workbook's §8 annual review already PROMISES this cadence; without a schedule
 *  in data, that promise has no mechanism behind it. */
export type ReviewCycle =
  /** Static facts — elevation, geology, distance. Use sparingly and honestly. */
  | 'never'
  /** Re-check before each season: campground openings, road closures, seasonal access. */
  | 'seasonal'
  /** Yearly: office locations, fee structures, published regulations. */
  | 'annual'
  /** Volatile: airline schedules, construction detours. */
  | 'monthly'
  /** No clock — driven by an event instead (a rate change, a policy change).
   *  Never reported as overdue; §8.2 of the workbook lists the triggers. */
  | 'on-change';

/** Days after which a cycle is due for re-review. `never` / `on-change` have no clock. */
const CYCLE_DAYS: Record<ReviewCycle, number | null> = {
  never: null,
  'on-change': null,
  monthly: 30,
  seasonal: 90,
  annual: 365,
};

/** Lower = more demanding. A record inherits the most demanding cycle among its answers:
 *  one monthly fact pulls the whole sheet forward, which is the correct behaviour —
 *  you re-review a sheet, not an individual sentence. */
const CYCLE_URGENCY: Record<ReviewCycle, number> = {
  monthly: 0,
  seasonal: 1,
  annual: 2,
  'on-change': 3,
  never: 4,
};

// ─── The standing questionnaire ──────────────────────────────────────────────

export interface InsightQuestion {
  /** Stable identifier. The durable contract — never renamed, same as attraction slugs (ADR-007).
   *  The workbook prints these IDs so a paper sheet and this file cannot drift. */
  id: string;
  /** Wording shown to staff in the workbook AND as the sub-heading when published. */
  prompt: string;
  /** Editorial completeness signal — a reviewed record missing one of these is reported by
   *  `validateInsights()`. Deliberately NOT a publication blocker: making it one would pressure
   *  staff to invent an answer rather than leave a blank, which is the failure this file exists
   *  to prevent. Warn, never block. */
  required: boolean;
  /** Whether an answer may EVER reach the website. `false` = operational knowledge only. */
  publishable: boolean;
}

/** The standing questions, asked identically of every subject. One instrument, reused
 *  indefinitely — that is what lets this scale to all 48 catalogue locations without
 *  becoming a new project each time. */
export const STANDARD_QUESTIONS: readonly InsightQuestion[] = [
  {
    id: 'guest_questions',
    prompt: 'What do guests most often ask about this place?',
    required: true,
    publishable: true,
  },
  {
    id: 'common_mistake',
    prompt: 'What mistake do visitors commonly make?',
    required: true,
    publishable: true,
  },
  {
    id: 'surprises',
    prompt: 'What surprises people?',
    required: false,
    publishable: true,
  },
  {
    id: 'best_season',
    prompt: 'What is the best season, and why?',
    required: true,
    publishable: true,
  },
  {
    id: 'local_knowledge',
    prompt: 'What do locals know that the guidebooks miss?',
    required: true,
    publishable: true,
  },
  {
    id: 'what_to_bring',
    prompt: 'What should people bring?',
    // Optional: meaningless for a museum or a restaurant, essential for a canyon.
    required: false,
    publishable: true,
  },
  {
    id: 'best_time_of_day',
    prompt: 'What is the best time of day to go?',
    required: false,
    publishable: true,
  },
  {
    id: 'parking',
    prompt: 'Is parking ever full — and when?',
    required: false,
    publishable: true,
  },
  {
    id: 'food_after',
    prompt: 'What restaurant do you recommend afterward?',
    required: false,
    publishable: true,
  },
  {
    id: 'not_right_for',
    prompt: 'Who is this not right for?',
    // The honest negative. Almost impossible for an OTA to answer and the highest-trust
    // thing on the page — it also prevents the bad review that follows a wasted afternoon.
    required: true,
    publishable: true,
  },
  {
    id: 'complaints',
    prompt: 'What do guests complain about after visiting?',
    // NEVER published. Operational only: it tells the front desk what to pre-empt at check-in.
    // Recording it is valuable; publishing it would be self-harm.
    required: false,
    publishable: false,
  },
] as const;

export const QUESTION_BY_ID: ReadonlyMap<string, InsightQuestion> = new Map(
  STANDARD_QUESTIONS.map((q) => [q.id, q]),
);

/** Back-compat: v1 exported bare prompt strings. Kept so nothing external breaks. */
export const STANDARD_PROMPTS: readonly string[] = STANDARD_QUESTIONS.map((q) => q.prompt);

// ─── Answers and records ─────────────────────────────────────────────────────

export interface InsightAnswer {
  /** Must match an `InsightQuestion.id`. Verified by `validateInsights()`. */
  questionId: string;
  /** Staff answer in their own words. The plain phrasing IS the value — it is not rewritten
   *  into marketing copy downstream. Empty means unanswered. */
  answer: string;
  /** Overrides the record default. */
  confidence?: Confidence;
  /** Overrides the record default. */
  visibility?: Visibility;
  /** Did the person answering actually go there? Overrides the record default.
   *  A single sheet legitimately mixes the two: staff have stood at the trailhead
   *  (observation) but took the seasonal closure date from the Forest Service (research). */
  personallyVerified?: boolean;
  /** REQUIRED whenever `personallyVerified` resolves to false. Names the source.
   *  An answer missing it fails closed — it is not published. */
  basedOn?: string;
  /** Overrides the record default. "Ashley's elevation" is `never`; "which campground
   *  is open" is `seasonal`; both can live on the same sheet. */
  reviewCycle?: ReviewCycle;
}

export interface InsightRecord {
  /** Stable ID for this knowledge record. Durable contract — append-only, never renamed. */
  subject: string;
  /** Display name. */
  name: string;
  kind: SubjectKind;
  /** Catalogue slugs in `attractions.generated.ts` this record covers. Empty when the subject
   *  is not a catalogue attraction (a region, the airport, a conference venue) or when it spans
   *  several entries (Split Mountain is both a boat ramp and a campground).
   *  Cross-checked against the catalogue by the verify script. */
  catalogueSlugs: string[];
  /** Page slugs permitted to render this record. Knowledge is about the PLACE, not the page —
   *  one subject can legitimately surface on several pages. */
  pages: string[];

  /** Master gate. While false the whole record is omitted, regardless of anything below. */
  reviewed: boolean;
  /** Who at the property confirmed this. Required for publication. */
  reviewedBy: string | null;
  /** ISO date (YYYY-MM-DD) of that review. Required for publication. */
  reviewedOn: string | null;
  /** Sheet-level default: has the reviewer been there themselves? Individual answers override. */
  personallyVerified: boolean | null;
  /** Sheet-level source when `personallyVerified` is false. */
  basedOn?: string | null;

  /** Applied to any answer that does not set its own. */
  defaultConfidence: Confidence;
  /** Applied to any answer that does not set its own. */
  defaultVisibility: Visibility;
  /** Applied to any answer that does not set its own, and the floor for the whole sheet's
   *  schedule. Local knowledge decays quietly, so `annual` is the default. */
  defaultReviewCycle: ReviewCycle;

  answers: InsightAnswer[];
  /** Editorial note for whoever fills this in. Never rendered. */
  note?: string;
}

/** A blank record — every subject starts here and costs nothing to carry. */
function blank(
  subject: string,
  name: string,
  kind: SubjectKind,
  catalogueSlugs: string[],
  pages: string[] = [],
  note?: string,
  cycle: ReviewCycle = 'annual',
): InsightRecord {
  return {
    subject,
    name,
    kind,
    catalogueSlugs,
    pages,
    reviewed: false, // ← flip to true only after a named person answers these
    reviewedBy: null,
    reviewedOn: null,
    personallyVerified: null,
    basedOn: null,
    // Local knowledge is what this instrument collects; it is experiential by nature.
    defaultConfidence: 'local-knowledge',
    defaultVisibility: 'public',
    defaultReviewCycle: cycle,
    answers: STANDARD_QUESTIONS.map((q) => ({ questionId: q.id, answer: '' })),
    ...(note ? { note } : {}),
  };
}

/** Fill answers on a blank sheet, keyed by `questionId`.
 *
 *  Exists because `blank()` produces all eleven answers and an interview only ever
 *  answers some of them — writing the full array by hand each time invites the
 *  position-keyed mistakes that stable `questionId`s were introduced to prevent.
 *  Merging by id means an unanswered question stays a blank string (reported by
 *  `validateInsights()`) rather than being silently dropped from the sheet.
 *
 *  Throws on an unknown id: a typo here would otherwise fail closed and silently,
 *  which is the one failure mode this file's gates cannot distinguish from
 *  "nobody has answered that yet". */
function withAnswers(
  record: InsightRecord,
  filled: Record<string, Omit<InsightAnswer, 'questionId'>>,
): InsightRecord {
  for (const id of Object.keys(filled)) {
    if (!QUESTION_BY_ID.has(id)) throw new Error(`withAnswers: unknown questionId "${id}"`);
  }
  return {
    ...record,
    answers: record.answers.map((a) => (filled[a.questionId] ? { ...a, ...filled[a.questionId] } : a)),
  };
}

/** Every answer below traces to this one source. Cited on each sheet whose
 *  `personallyVerified` is false — which, for now, is all of them. */
const OWNER_INTERVIEW = 'Owner interview, 2026-07-31 (see docs/BUSINESS_KNOWLEDGE_WORKBOOK.md)';

// ─── The records ─────────────────────────────────────────────────────────────
//
// Blank records are created for everything we expect to cover this year. An empty
// record costs almost nothing; adding one later usually never happens.
//
// Priority order is set by data, not by preference: Ashley draws 36% of all site
// impressions and earns zero clicks, so it is the highest-value sheet in the building.

export const FRONT_DESK_INSIGHTS: InsightRecord[] = [
  // ── Priority 1–8: the sheets that unblock existing or planned pages ──────────
  withAnswers(
    blank(
      'ashley-national-forest',
      'Ashley National Forest',
      'attraction',
      ['ashley-national-forest'],
      ['hotel-near-ashley-national-forest'],
      'HIGHEST PRIORITY. The page ranks nationally for forests in Missouri, North Carolina, ' +
      'Arkansas and Texas because its copy could describe any national forest. Answers here ' +
      'must name THIS forest specifically: which access point our guests actually use, the ' +
      'measured drive time to it, which road closes and roughly when. See the extra questions ' +
      'on Sheet 1 of the workbook. ' +
      'THE 2026-07-31 INTERVIEW DID NOT ANSWER THIS SHEET. The one answer below is a general ' +
      'remark about "recreation areas" that may or may not describe Ashley — it is marked ' +
        'pending for exactly that reason. This sheet is still the highest-value blank in the file.',
      'seasonal', // road and campground access changes every year
    ),
    {
      local_knowledge: {
        answer:
          'Download your maps to your phone before you drive up. Cell coverage gets unreliable once you are into the recreation areas.',
        // PENDING, and it must stay pending until the owner confirms it of THIS forest.
        // The interview said "many recreation areas" — applying that to Ashley specifically
        // is our inference, not his statement, and this page's whole problem is copy that
        // could describe any national forest. Publishing an unverified generic here would
        // deepen the exact failure the sheet exists to fix.
        confidence: 'pending',
        basedOn: OWNER_INTERVIEW,
      },
    },
  ),
  withAnswers(
    blank(
      'dinosaur-national-monument',
      'Dinosaur National Monument',
      'attraction',
      ['dinosaur-national-monument', 'dnm-cub-creek-petroglyphs', 'dnm-sound-of-silence-trail'],
      ['hotel-near-dinosaur-national-monument'],
      'Largest draw in the area. Quarry Exhibit Hall vs. the Colorado side is the single most ' +
        'common point of guest confusion — worth capturing under common_mistake. ' +
        'FROM 2026-07-31 INTERVIEW: the entrance confusion was confirmed as a recurring, ' +
        'first-hand front-desk observation. Remaining blanks are genuinely unanswered.',
    ),
    {
      guest_questions: {
        answer:
          'Which entrance to Dinosaur National Monument has the Quarry Exhibit Hall — the wall of fossils. It is one of the questions we answer most often at the desk.',
        basedOn: OWNER_INTERVIEW,
      },
      common_mistake: {
        answer:
          'Driving to the Colorado entrance expecting to see the fossil wall. The Quarry Exhibit Hall is on the Utah side near Jensen, and the two entrances are far enough apart that the mistake costs most of a day.',
        basedOn: OWNER_INTERVIEW,
      },
      local_knowledge: {
        answer:
          'Decide which side you are going to before you leave the hotel. The monument spans two states and the Utah and Colorado sides are separate visits, not two doors to the same place.',
        // The geography does not change; park operations do, but this answer does not depend on them.
        reviewCycle: 'never',
        basedOn: OWNER_INTERVIEW,
      },
    },
  ),
  withAnswers(
    blank(
      'flaming-gorge',
      'Flaming Gorge',
      'attraction',
      ['flaming-gorge', 'flaming-gorge-dam-visitor-center', 'flaming-gorge-marina', 'red-canyon-overlook'],
      ['hotel-near-flaming-gorge'],
      'not_right_for matters here: at 40 miles it is not a practical afternoon trip for a ' +
        'one-night guest, and saying so plainly is worth more than the booking it might cost. ' +
        'STILL UNANSWERED after the 2026-07-31 interview — ask it directly at review.',
    ),
    {
      guest_questions: {
        answer:
          'Whether their phone will work once they are out there. It comes up almost every time someone tells us they are heading to Flaming Gorge.',
        basedOn: OWNER_INTERVIEW,
      },
      local_knowledge: {
        answer:
          'Download your maps to your phone on our WiFi before you leave town. Cell coverage is unreliable across a lot of the recreation area, and people do not think about it until the map stops loading.',
        // Carriers extend coverage; this is true today and worth re-checking yearly.
        reviewCycle: 'annual',
        basedOn: OWNER_INTERVIEW,
      },
      // what_to_bring is deliberately EMPTY. The interview supports downloaded maps only.
      // "Bring water, fill your gas tank" appeared in a draft written for us, not in
      // anything the owner said — so it is not recorded here. Ask at review.
    },
  ),
  blank(
    'fantasy-canyon',
    'Fantasy Canyon',
    'attraction',
    ['fantasy-canyon'],
    [],
    'Remote, unpaved approach. not_right_for and what_to_bring are the load-bearing answers.',
    'seasonal', // road condition drives everything here
  ),
  blank(
    'red-fleet-state-park',
    'Red Fleet State Park',
    'attraction',
    ['red-fleet-state-park', 'red-fleet-dinosaur-trackway'],
    ['hotel-near-red-fleet-state-park'],
    'The dinosaur trackway requires a hike and a water crossing that surprises people — ' +
      'a genuine differentiator no OTA describes.',
  ),
  blank(
    'jensen-utah',
    'Jensen, Utah',
    'region',
    [],
    ['hotel-near-jensen-utah'],
    'Migrated from the v1 page-keyed block. Page 1 for city-level queries is entirely OTA ' +
      'aggregators; this page wins only on the attraction-qualified variant.',
  ),
  blank(
    'steinaker-state-park',
    'Steinaker State Park',
    'attraction',
    ['steinaker-state-park', 'steinaker-boat-ramp'],
    [],
    'Closest recreation to the hotel — the realistic answer for a guest with two spare hours.',
  ),
  blank(
    'mcconkie-ranch-petroglyphs',
    'McConkie Ranch Petroglyphs',
    'attraction',
    ['mcconkie-ranch-petroglyphs'],
    [],
    'On private land with visitor etiquette expectations that are poorly documented elsewhere. ' +
      'High-value local knowledge.',
  ),

  // ── The property itself ──────────────────────────────────────────────────────
  //
  // The first `facility` sheet about THIS building rather than somewhere to drive to.
  // It exists because the 2026-07-31 interview's strongest material was operational,
  // not geographic: how the property is actually run for people who stay weeks.
  //
  // NAMING: this sheet is deliberately brand-free. The owner states the property is
  // currently Executive Inn & Suites Extended Stay, with Best Western pending franchise
  // approval, so neither name is safe to bake into a durable record yet. `subject` is a
  // permanent contract (append-only, never renamed) — putting an unapproved brand in it
  // would be the one mistake here that cannot be quietly corrected later.
  withAnswers(
    blank(
      'extended-stay-operations',
      'Staying Here Long-Term',
      'facility',
      [],
      // NOT surfaced yet: no page imports FrontDeskInsight for these routes. Wiring that
      // is a page edit, deliberately deferred until this sheet is reviewed — there is no
      // point rendering a component that is gated shut.
      [
        'extended-stay-hotel-vernal-utah',
        'workforce-housing-vernal-utah',
        'oilfield-housing-vernal',
        'weekly-hotel-rates-vernal-utah',
      ],
      'The differentiator no OTA listing can reproduce: the property serves long-term ' +
        'industrial crews and family tourists at the same time, on purpose. ' +
        'not_right_for and complaints are both EMPTY and both matter — the honest negative ' +
        'is the highest-trust answer on any sheet, and complaints (never published) is what ' +
        'tells the desk what to pre-empt at check-in. Ask for both at review.',
      'on-change', // operating practice, not a calendar — it changes when the practice changes
    ),
    {
      local_knowledge: {
        answer:
          'Crews working night shifts get put in the quietest part of the building whenever we can manage it, so a rotation sleeping through the middle of the day is not next to a family checking out.',
        basedOn: OWNER_INTERVIEW,
      },
      parking: {
        answer:
          'The lot is large and takes trucks and trailers, and most rooms open to the outside, so you can park at your door and unload work gear without carrying it through a lobby.',
        basedOn: OWNER_INTERVIEW,
      },
      surprises: {
        answer:
          'How hot and how strong the showers are. It is the thing guests mention to us most often, and it is not what people expect from an extended-stay property.',
        // MAPPING TO CONFIRM: the interview recorded this as a recurring guest COMPLIMENT.
        // There is no compliments question in STANDARD_QUESTIONS, and `surprises` is the
        // closest honest fit — but it is our mapping, not the owner's words. Confirm at
        // review, or leave it out. Not folded into a new question: adding one to the
        // standing instrument changes every sheet in the file and every printed workbook.
        confidence: 'pending',
        basedOn: OWNER_INTERVIEW,
      },
      guest_questions: {
        answer:
          'Long-stay guests ask about kitchenettes, whether we can bill their company directly, and where to put a work truck or trailer.',
        basedOn: OWNER_INTERVIEW,
      },
      // DELIBERATELY NOT RECORDED — comparative and superlative claims from the interview
      // ("we bridge that gap better than anyone else in town", "best in Vernal", "nobody
      // else does this", "our plumbing can handle a full house at 6:00 AM"). Each asserts
      // something about competitors or about mechanical capacity that nobody has measured.
      // They are omitted rather than entered as `pending`: a pending answer is a real
      // answer awaiting verification, and none of these is verifiable as written. The
      // supporting FACTS — trailer parking, exterior access, quiet placement — are above,
      // and they are more persuasive than the claims were.
    },
  ),

  // ── Priority 9+: blank now, filled over the year ────────────────────────────
  blank(
    'uinta-mountains',
    'Uinta Mountains',
    'region',
    [],
    [],
    'Not a catalogue entry — a region spanning several. The only major east–west range in the ' +
      'lower 48, which is a genuine distinguishing fact worth confirming before publishing.',
  ),
  blank('utah-field-house-museum', 'Utah Field House of Natural History', 'attraction', ['utah-field-house-museum']),
  blank(
    'jones-hole',
    'Jones Hole',
    'attraction',
    ['jones-hole-fish-hatchery', 'jones-hole-trail'],
    [],
    'Hatchery and trail are separate catalogue entries but one destination to a guest.',
  ),
  blank(
    'split-mountain',
    'Split Mountain',
    'attraction',
    ['split-mountain-boat-ramp', 'split-mountain-campground'],
    [],
    'Spans two catalogue entries; guests treat it as one place.',
  ),
  blank('sheep-creek-canyon', 'Sheep Creek Canyon Geologic Loop', 'attraction', ['sheep-creek-canyon']),
  blank(
    'vernal-regional-airport',
    'Vernal Regional Airport (VEL)',
    'facility',
    [],
    ['hotel-near-vernal-airport'],
    'Not an attraction — a facility, and the load-bearing entity for crew rotation. Different ' +
      'questions matter: flight reliability, rental car availability, what happens when weather ' +
      'cancels the inbound, whether Salt Lake is the practical backup. Most tourism sites answer ' +
      '"how do I get there"; almost none answer "what happens when I cannot".',
    'monthly', // airline schedules and carriers change on short notice
  ),
  blank(
    'uintah-conference-center',
    'Uintah Conference Center',
    'venue',
    [],
    [],
    'Event venue. Relevant to group and corporate business rather than leisure — conference ' +
      'attendees are a room-block source the site does not currently address.',
  ),
];

export const RECORD_BY_SUBJECT: ReadonlyMap<string, InsightRecord> = new Map(
  FRONT_DESK_INSIGHTS.map((r) => [r.subject, r]),
);

// ─── Publication gates ───────────────────────────────────────────────────────

/** An answer resolved against its record's defaults, ready to render. */
export interface ResolvedInsight {
  questionId: string;
  prompt: string;
  answer: string;
  confidence: Confidence;
  personallyVerified: boolean | null;
  basedOn: string | null;
}

export interface PublishedRecord {
  subject: string;
  name: string;
  kind: SubjectKind;
  reviewedBy: string;
  reviewedOn: string;
  /** True only when EVERY published answer came from someone who went there. Lets the
   *  component distinguish observation from research to the reader, which is the whole
   *  point of collecting it. */
  allPersonallyVerified: boolean;
  insights: ResolvedInsight[];
}

/** Every condition an answer must satisfy to reach a page. Fails closed at each step. */
function publishableAnswer(record: InsightRecord, a: InsightAnswer): ResolvedInsight | null {
  const question = QUESTION_BY_ID.get(a.questionId);
  if (!question) return null; // unknown id — typo or a removed question
  if (!question.publishable) return null; // operational-only, e.g. `complaints`
  if (!a.answer.trim()) return null; // unanswered

  const confidence = a.confidence ?? record.defaultConfidence;
  if (confidence === 'pending' || confidence === 'na') return null;

  const visibility = a.visibility ?? record.defaultVisibility;
  if (visibility !== 'public') return null;

  const personallyVerified = a.personallyVerified ?? record.personallyVerified;
  const basedOn = a.basedOn ?? record.basedOn ?? null;
  // Research-based claims must name their source. No source, no publication.
  if (personallyVerified === false && !basedOn?.trim()) return null;

  return {
    questionId: a.questionId,
    prompt: question.prompt,
    answer: a.answer.trim(),
    confidence,
    personallyVerified,
    basedOn: basedOn?.trim() || null,
  };
}

/** The record only when it is safe to publish. Pages render nothing otherwise. */
export function getPublishedRecord(subject: string): PublishedRecord | null {
  const record = RECORD_BY_SUBJECT.get(subject);
  if (!record) return null;
  if (!record.reviewed || !record.reviewedBy || !record.reviewedOn) return null;

  const insights = record.answers
    .map((a) => publishableAnswer(record, a))
    .filter((r): r is ResolvedInsight => r !== null);
  if (!insights.length) return null;

  return {
    subject: record.subject,
    name: record.name,
    kind: record.kind,
    reviewedBy: record.reviewedBy,
    reviewedOn: record.reviewedOn,
    allPersonallyVerified: insights.every((i) => i.personallyVerified === true),
    insights,
  };
}

/** Every publishable record a given page may render. */
export function getPublishedInsightsForPage(pageSlug: string): PublishedRecord[] {
  return FRONT_DESK_INSIGHTS.filter((r) => r.pages.includes(pageSlug))
    .map((r) => getPublishedRecord(r.subject))
    .filter((r): r is PublishedRecord => r !== null);
}

/** Back-compat with v1: resolve by PAGE slug, first publishable match.
 *  `FrontDeskInsight.astro` still calls this, so the two existing pages needed no change. */
export function getPublishedInsights(pageSlug: string): PublishedRecord | null {
  return getPublishedInsightsForPage(pageSlug)[0] ?? null;
}

// ─── Build-time integrity ────────────────────────────────────────────────────

export interface ValidationIssue {
  subject: string;
  /** `error` blocks the build; `warning` is an editorial completeness signal. */
  level: 'error' | 'warning';
  message: string;
}

/** Structural checks. Call from `scripts/verify-destination-pages.mjs`.
 *  Catalogue-slug cross-checking lives in the script (see `catalogueRefs`) so this
 *  module stays free of a dependency on the generated catalogue. */
export function validateInsights(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const r of FRONT_DESK_INSIGHTS) {
    const err = (message: string) => issues.push({ subject: r.subject, level: 'error', message });
    const warn = (message: string) => issues.push({ subject: r.subject, level: 'warning', message });

    if (seen.has(r.subject)) err('duplicate subject id');
    seen.add(r.subject);

    const ids = new Set<string>();
    for (const a of r.answers) {
      if (!QUESTION_BY_ID.has(a.questionId)) err(`unknown questionId "${a.questionId}"`);
      if (ids.has(a.questionId)) err(`duplicate answer for "${a.questionId}"`);
      ids.add(a.questionId);

      const pv = a.personallyVerified ?? r.personallyVerified;
      const basedOn = a.basedOn ?? r.basedOn;
      if (a.answer.trim() && pv === false && !basedOn?.trim()) {
        err(`"${a.questionId}" is research-based but names no source (basedOn)`);
      }
    }

    if (r.reviewed) {
      if (!r.reviewedBy) err('reviewed but reviewedBy is empty');
      if (!r.reviewedOn) err('reviewed but reviewedOn is empty');
      if (r.reviewedOn && !/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedOn)) {
        err(`reviewedOn "${r.reviewedOn}" is not YYYY-MM-DD`);
      }
      if (r.personallyVerified === null) {
        warn('reviewed but personallyVerified is unset — observation or research?');
      }
      // Completeness only. Deliberately not an error: see InsightQuestion.required.
      for (const q of STANDARD_QUESTIONS) {
        if (!q.required) continue;
        const a = r.answers.find((x) => x.questionId === q.id);
        if (!a?.answer.trim()) warn(`required question "${q.id}" is unanswered`);
      }
    }
  }
  return issues;
}

/** Catalogue slugs referenced by any record — the verify script cross-checks these
 *  against `ATTRACTION_BY_SLUG` so a renamed or mistyped slug fails the build. */
export function catalogueRefs(): { subject: string; slug: string }[] {
  return FRONT_DESK_INSIGHTS.flatMap((r) => r.catalogueSlugs.map((slug) => ({ subject: r.subject, slug })));
}

/** Build-time visibility: which subjects are still awaiting local review. */
export function pendingReview(): string[] {
  return FRONT_DESK_INSIGHTS.filter((r) => !r.reviewed).map((r) => r.subject);
}

// ─── Freshness ───────────────────────────────────────────────────────────────
//
// Freshness REPORTS. It deliberately does NOT gate.
//
// Auto-unpublishing a record because a review date passed would silently strip live
// content from pages with nobody noticing — and stale local knowledge is not false,
// merely unaudited. Worse, an unpublish-on-stale rule would push every cycle toward
// `never` to avoid breakage, which games the schedule into meaninglessness. So this
// is the one place the fail-closed instinct is wrong: report loudly, publish anyway,
// let a person decide.

export type FreshnessStatus =
  | 'not-reviewed'
  | 'no-schedule'
  | 'current'
  | 'due-soon'
  | 'overdue';

export interface FreshnessEntry {
  subject: string;
  name: string;
  /** Most demanding cycle across the record and its answers. */
  cycle: ReviewCycle;
  status: FreshnessStatus;
  reviewedOn: string | null;
  /** ISO date the next review is due; null when the cycle has no clock. */
  dueOn: string | null;
  /** Negative = overdue by that many days. */
  daysUntilDue: number | null;
}

/** The cycle a record is actually held to: the most demanding among its own default
 *  and any per-answer override on an answered question. */
export function effectiveCycle(record: InsightRecord): ReviewCycle {
  let winner = record.defaultReviewCycle;
  for (const a of record.answers) {
    if (!a.reviewCycle || !a.answer.trim()) continue;
    if (CYCLE_URGENCY[a.reviewCycle] < CYCLE_URGENCY[winner]) winner = a.reviewCycle;
  }
  return winner;
}

const DAY_MS = 86_400_000;

/** Freshness for one record. `asOf` is injectable so builds and tests stay deterministic. */
export function freshness(record: InsightRecord, asOf: Date = new Date()): FreshnessEntry {
  const cycle = effectiveCycle(record);
  const base = { subject: record.subject, name: record.name, cycle, reviewedOn: record.reviewedOn };

  if (!record.reviewed || !record.reviewedOn) {
    return { ...base, status: 'not-reviewed', dueOn: null, daysUntilDue: null };
  }
  const days = CYCLE_DAYS[cycle];
  if (days === null) {
    return { ...base, status: 'no-schedule', dueOn: null, daysUntilDue: null };
  }

  const due = new Date(new Date(record.reviewedOn).getTime() + days * DAY_MS);
  const daysUntilDue = Math.floor((due.getTime() - asOf.getTime()) / DAY_MS);
  const status: FreshnessStatus =
    daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 30 ? 'due-soon' : 'current';

  return { ...base, status, dueOn: due.toISOString().slice(0, 10), daysUntilDue };
}

/** The maintenance dashboard: what is overdue, what is due, what is current.
 *  Overdue first, then soonest-due — the order someone would actually work through. */
export function freshnessReport(asOf: Date = new Date()): {
  overdue: FreshnessEntry[];
  dueSoon: FreshnessEntry[];
  current: FreshnessEntry[];
  notReviewed: FreshnessEntry[];
  noSchedule: FreshnessEntry[];
  summary: string;
} {
  const all = FRONT_DESK_INSIGHTS.map((r) => freshness(r, asOf)).sort(
    (a, b) => (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity),
  );
  const by = (s: FreshnessStatus) => all.filter((e) => e.status === s);
  const overdue = by('overdue');
  const dueSoon = by('due-soon');
  const current = by('current');
  const notReviewed = by('not-reviewed');
  const noSchedule = by('no-schedule');

  return {
    overdue,
    dueSoon,
    current,
    notReviewed,
    noSchedule,
    summary:
      `${overdue.length} overdue · ${dueSoon.length} due within 30 days · ` +
      `${current.length} current · ${notReviewed.length} never reviewed`,
  };
}

/** Completion reporting for the workbook — how far through the questionnaire we are. */
export function reviewProgress(): { total: number; reviewed: number; answered: number; publishable: number } {
  const answered = FRONT_DESK_INSIGHTS.filter((r) => r.answers.some((a) => a.answer.trim())).length;
  return {
    total: FRONT_DESK_INSIGHTS.length,
    reviewed: FRONT_DESK_INSIGHTS.filter((r) => r.reviewed).length,
    answered,
    publishable: FRONT_DESK_INSIGHTS.filter((r) => getPublishedRecord(r.subject) !== null).length,
  };
}

/** v1 compatibility alias. */
export type Insight = ResolvedInsight;
export type InsightBlock = PublishedRecord;
