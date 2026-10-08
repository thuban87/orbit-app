/**
 * History seed spec — the deterministic synthetic History datasets (38.8 Plan
 * 01, D-30).
 *
 * DEV-ONLY and PURE: no DB, no React, no `expo-*` import. `history-seed.ts`
 * writes this plan through the app's own Core writers; it is reached only from
 * the `__DEV__` dev menu (`uat-probes.ts`), so it never enters a release bundle.
 *
 * Every timestamp is a LOCAL wall-clock `YYYY-MM-DD HH:MM:SS` built from local
 * `Date` components (never UTC ISO slicing), counted from the injected `now`,
 * so Today / Yesterday labels and year boundaries are exercisable on the day
 * the seed runs. A today-dated record is clamped to at or before `now` (C3-04):
 * it is never dropped or moved to another day, so counts and dates do not
 * depend on the time of day, and no seeded row is in the future. Group events
 * are dated strictly before today.
 *
 * Every per-family COUNT is a constant (only the dates move with `now`), so
 * verification can compare counts on any later day.
 *
 * Datasets (each a separately named synthetic contact, "History …"):
 *   long        several years, the year three back empty, > 20 records in the
 *               current year and every populated older year, records today and
 *               yesterday, knowledge + lifecycle on interaction days and on
 *               days with none, ~900+ interactions, group-linked rows
 *   dense       its newest day holds exactly 25 records (> the 20 initial)
 *   sparse      three interactions in three different years (two of them
 *               group-linked)
 *   notes-only  zero interactions; knowledge and lifecycle records only
 *   unbound     no cadence, tracking off
 *   quiet-year  every record predates the current year
 *   archived    history, then archived (the seed writer archives it at now)
 *   empty       no record of any family
 */
import type { CurrentStateFieldKey } from "@/db/memory-registry";

// --- Tunables -----------------------------------------------------------------
/** Bump whenever the dataset shape changes (logged with every seed run). */
export const HISTORY_SEED_SPEC_VERSION = 1;
/** Every seeded contact's uid starts with this; the idempotency marker. */
export const HISTORY_SEED_UID_PREFIX = "dev-history-seed-";
/** Fixed PRNG seed so a given `now` always yields the same plan. */
const PRNG_SEED = 0x380801;
/** Long: interactions per populated year, by years back (3 is the empty year). */
const LONG_YEARS: ReadonlyArray<{ back: number; count: number }> = [
  { back: 0, count: 180 },
  { back: 1, count: 260 },
  { back: 2, count: 220 },
  { back: 4, count: 150 },
  { back: 5, count: 100 },
];
/** Long: of the current year's count, this many land today and yesterday each. */
const LONG_TODAY = 2;
const LONG_YESTERDAY = 2;
/** Dense: records on its newest day (Plans 02 and 06 rely on exactly 25). */
const DENSE_TOP_DAY = 25;
/** Dense: one older interaction every other day before the top day. */
const DENSE_OLDER = 30;
/** Earliest/latest hour of a generated record time. */
const HOUR_MIN = 8;
const HOUR_MAX = 21;

// --- Types --------------------------------------------------------------------
export type HistorySeedKey =
  | "long"
  | "dense"
  | "sparse"
  | "notes-only"
  | "unbound"
  | "quiet-year"
  | "archived"
  | "empty";

export interface SeedInteraction {
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS`. */
  occurredAt: string;
  channel: string;
  direction: string | null;
  connected: number;
  quality: string | null;
  note: string | null;
}

export interface SeedKnowledge {
  fieldKey: CurrentStateFieldKey;
  value: string;
  /** Local wall-clock change time (becomes `created_at`). */
  at: string;
}

export interface SeedLifecycle {
  type: "bind" | "snooze" | "unsnooze";
  occurredAt: string;
  detail: null;
}

export interface HistorySeedContact {
  key: HistorySeedKey;
  uid: string;
  name: string;
  intervalDays: number | null;
  trackingEnabled: boolean;
  /** Excludes group children (createGroupEvent writes those). */
  interactions: SeedInteraction[];
  /** Chronological (the writer demotes the previous current value per field). */
  knowledge: SeedKnowledge[];
  lifecycle: SeedLifecycle[];
  /** Archive after the history is written (adds one `archive` event at now). */
  archive: boolean;
}

export interface SeedGroupEvent {
  title: string;
  /** Strictly before today. */
  occurredAt: string;
  channel: string;
  quality: string | null;
  groupNote: string | null;
  participants: HistorySeedKey[];
}

export interface HistorySeedPlan {
  /** The injected now's local calendar date. */
  today: string;
  /** The injected now as a local wall-clock string (the clamp ceiling). */
  now: string;
  contacts: HistorySeedContact[];
  groupEvents: SeedGroupEvent[];
}

// --- Local date helpers (never UTC) --------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");

/** Local `YYYY-MM-DD` — mirrors `formatLocalDate` without importing app code. */
function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localStamp(date: Date): string {
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Whole calendar days between two local dates (component arithmetic). */
function dayDiff(from: Date, to: Date): number {
  return Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000,
  );
}

/** Deterministic 32-bit PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local dates/stamps relative to one injected `now`; every stamp is clamped. */
function clock(now: Date) {
  const nowStamp = localStamp(now);
  const year = now.getFullYear();
  const clamp = (stamp: string) => (stamp > nowStamp ? nowStamp : stamp);
  return {
    today: localDate(now),
    nowStamp,
    year,
    /** Days from Jan 1 of the current year to today (0 on Jan 1). */
    todayIndex: dayDiff(new Date(year, 0, 1), now),
    daysInYear: (y: number) =>
      dayDiff(new Date(y, 0, 1), new Date(y + 1, 0, 1)),
    /** `hh:mm` local, `daysAgo` calendar days before today. */
    ago(daysAgo: number, hh: number, mm: number): string {
      return clamp(
        localStamp(
          new Date(year, now.getMonth(), now.getDate() - daysAgo, hh, mm, 0),
        ),
      );
    },
    /** `hh:mm` local on day `index` (0-based) of year `y`. */
    onYearDay(y: number, index: number, hh: number, mm: number): string {
      return clamp(localStamp(new Date(y, 0, 1 + index, hh, mm, 0)));
    },
  };
}
type Clock = ReturnType<typeof clock>;

// --- Synthetic content ----------------------------------------------------------
const CHANNELS = ["Message", "Call", "In Person"] as const;
const DIRECTIONS = ["outbound", "inbound", "mutual"] as const;
const QUALITIES = ["Positive", "Neutral", "Negative", null] as const;
const SHORT_NOTES = [
  "Quick synthetic check-in.",
  "Synthetic catch-up about weekend plans.",
  "Short synthetic note.",
] as const;
const LONG_NOTES = [
  "Synthetic long note. We talked through a made-up project timeline and the trade-offs of each option. They promised to send a follow-up with the remaining details next week, and we agreed to compare notes after.",
  "Synthetic long note. A slow walk around an imaginary park with plenty of tangents. The conversation covered travel, a book neither of us finished and a plan to meet again before the end of the month.",
] as const;
const TOPICS = [
  "a synthetic garden project",
  "an imaginary trip",
  "a made-up board game",
  "a fictional job change",
  "a pretend recipe",
] as const;
const PLACES = [
  "Synthetic City",
  "Example Town",
  "Placeholder Bay",
  "Mock Harbour",
] as const;

/** The i-th interaction's attributes: channels, directions and tones cycle. */
function attributes(i: number): Omit<SeedInteraction, "occurredAt"> {
  const channel = CHANNELS[i % CHANNELS.length];
  const direction = DIRECTIONS[Math.floor(i / 3) % DIRECTIONS.length];
  const quality = QUALITIES[i % QUALITIES.length];
  // "No reply" on a few non-in-person rows.
  const connected = channel !== "In Person" && i % 13 === 4 ? 0 : 1;
  const slot = i % 6;
  const note =
    slot === 1 || slot === 4
      ? SHORT_NOTES[i % SHORT_NOTES.length]
      : slot === 3
        ? LONG_NOTES[i % LONG_NOTES.length]
        : null;
  return { channel, direction, connected, quality, note };
}

function knowledgeValue(field: CurrentStateFieldKey, i: number): string {
  return field === "last_talked_about"
    ? `Talked about ${TOPICS[i % TOPICS.length]}`
    : PLACES[i % PLACES.length];
}

// --- Builders -------------------------------------------------------------------
function randomTime(rand: () => number): [number, number] {
  const hh = HOUR_MIN + Math.floor(rand() * (HOUR_MAX - HOUR_MIN + 1));
  const mm = 5 * Math.floor(rand() * 12);
  return [hh, mm];
}

/** Random day index in `yearsBack` (current year capped at today). */
function randomDayIndex(c: Clock, yearsBack: number, rand: () => number) {
  const span =
    yearsBack === 0 ? c.todayIndex + 1 : c.daysInYear(c.year - yearsBack);
  return Math.floor(rand() * span);
}

function interactionsFrom(stamps: string[]): SeedInteraction[] {
  return stamps.map((occurredAt, i) => ({ occurredAt, ...attributes(i) }));
}

/** Alternate the two current-state fields; return in chronological order. */
function knowledgeFrom(stamps: string[]): SeedKnowledge[] {
  return [...stamps].sort().map((at, i) => {
    const fieldKey: CurrentStateFieldKey =
      i % 2 === 0 ? "last_talked_about" : "current_location";
    return { fieldKey, value: knowledgeValue(fieldKey, i), at };
  });
}

/** Chronological lifecycle: an optional leading bind, then snooze/unsnooze pairs. */
function lifecycleFrom(
  stamps: string[],
  leadingBind: boolean,
): SeedLifecycle[] {
  return [...stamps].sort().map((occurredAt, i) => {
    const k = leadingBind ? i - 1 : i;
    const type: SeedLifecycle["type"] =
      k < 0 ? "bind" : k % 2 === 0 ? "snooze" : "unsnooze";
    return { type, occurredAt, detail: null };
  });
}

function contact(
  key: HistorySeedKey,
  name: string,
  intervalDays: number | null,
  parts: Partial<
    Pick<
      HistorySeedContact,
      "interactions" | "knowledge" | "lifecycle" | "archive"
    >
  > = {},
): HistorySeedContact {
  return {
    key,
    uid: `${HISTORY_SEED_UID_PREFIX}${key}`,
    name,
    intervalDays,
    trackingEnabled: intervalDays !== null,
    interactions: parts.interactions ?? [],
    knowledge: parts.knowledge ?? [],
    lifecycle: parts.lifecycle ?? [],
    archive: parts.archive ?? false,
  };
}

function buildLong(c: Clock, rand: () => number): HistorySeedContact {
  const stamps: string[] = [];
  /** Day indexes holding an interaction, per years-back. */
  const busy = new Map<number, Set<number>>();
  const add = (back: number, index: number, hh: number, mm: number) => {
    stamps.push(c.onYearDay(c.year - back, index, hh, mm));
    busy.set(back, (busy.get(back) ?? new Set()).add(index));
  };
  for (const { back, count } of LONG_YEARS) {
    let remaining = count;
    if (back === 0) {
      // Today and yesterday (on Jan 1 "yesterday" is Dec 31 of last year).
      for (let i = 0; i < LONG_TODAY; i++) add(0, c.todayIndex, 8 + i, 15);
      for (let i = 0; i < LONG_YESTERDAY; i++)
        add(0, c.todayIndex - 1, 12 + 4 * i, 30);
      remaining -= LONG_TODAY + LONG_YESTERDAY;
    }
    for (let i = 0; i < remaining; i++) {
      const [hh, mm] = randomTime(rand);
      add(back, randomDayIndex(c, back, rand), hh, mm);
    }
  }

  /** A day in `back` with (or without) an interaction; falls back to any day. */
  const pick = (back: number, withInteraction: boolean): string => {
    const [hh, mm] = randomTime(rand);
    const days = [...(busy.get(back) ?? [])].filter((d) => d >= 0);
    let index = randomDayIndex(c, back, rand);
    if (withInteraction && days.length)
      index = days[Math.floor(rand() * days.length)];
    else if (!withInteraction)
      for (let attempt = 0; attempt < 400; attempt++) {
        if (!busy.get(back)?.has(index)) break;
        index = randomDayIndex(c, back, rand);
      }
    return c.onYearDay(c.year - back, index, hh, mm);
  };

  // Knowledge: 14 changes across the populated years, alternating on/off days.
  const knowledgeYears = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 4, 4, 5];
  const knowledge = knowledgeYears.map((back, i) => pick(back, i % 2 === 0));
  // Lifecycle: a bind in the oldest year, then three snooze/unsnooze pairs.
  const lifecycleYears = [5, 4, 4, 1, 1, 0, 0];
  const lifecycle = lifecycleYears.map((back, i) => pick(back, i % 2 === 1));

  return contact("long", "History Long", 7, {
    interactions: interactionsFrom(stamps),
    knowledge: knowledgeFrom(knowledge),
    lifecycle: lifecycleFrom(lifecycle, true),
  });
}

function buildDense(c: Clock): HistorySeedContact {
  const stamps: string[] = [];
  // The newest day (yesterday): exactly 25 records, 07:00 → 19:00 every 30 min.
  for (let i = 0; i < DENSE_TOP_DAY; i++)
    stamps.push(c.ago(1, 7 + Math.floor(i / 2), (i % 2) * 30));
  for (let i = 0; i < DENSE_OLDER; i++)
    stamps.push(c.ago(3 + 2 * i, 10 + (i % 9), 20));
  return contact("dense", "History Dense", 14, {
    interactions: interactionsFrom(stamps),
    knowledge: knowledgeFrom([c.ago(10, 9, 45), c.ago(40, 18, 5)]),
  });
}

function buildSparse(c: Clock): HistorySeedContact {
  // Its other two interactions come from the two group events (this year and
  // last year), so the three land in three different years.
  return contact("sparse", "History Sparse", 30, {
    interactions: interactionsFrom([c.onYearDay(c.year - 3, 131, 18, 30)]),
  });
}

function buildNotesOnly(c: Clock): HistorySeedContact {
  return contact("notes-only", "History Notes Only", 30, {
    knowledge: knowledgeFrom([
      c.ago(2, 10, 15),
      c.ago(9, 19, 40),
      c.ago(25, 8, 5),
      c.ago(70, 13, 0),
      c.ago(200, 16, 30),
      c.ago(400, 11, 10),
    ]),
    lifecycle: lifecycleFrom(
      [c.ago(30, 9, 0), c.ago(16, 9, 0), c.ago(300, 20, 0), c.ago(280, 20, 0)],
      false,
    ),
  });
}

function buildUnbound(c: Clock): HistorySeedContact {
  const days = [5, 19, 33, 60, 95, 130, 170, 220, 300, 380, 450, 520];
  return contact("unbound", "History Unbound", null, {
    interactions: interactionsFrom(
      days.map((d, i) => c.ago(d, 9 + (i % 10), 10)),
    ),
    knowledge: knowledgeFrom([c.ago(45, 12, 0)]),
  });
}

function buildQuietYear(c: Clock, rand: () => number): HistorySeedContact {
  const stamps: string[] = [];
  for (const [back, count] of [
    [1, 24],
    [2, 8],
  ] as const)
    for (let i = 0; i < count; i++) {
      const [hh, mm] = randomTime(rand);
      stamps.push(
        c.onYearDay(c.year - back, randomDayIndex(c, back, rand), hh, mm),
      );
    }
  return contact("quiet-year", "History Quiet Year", 30, {
    interactions: interactionsFrom(stamps),
    knowledge: knowledgeFrom([
      c.onYearDay(c.year - 1, 60, 10, 0),
      c.onYearDay(c.year - 1, 250, 17, 45),
    ]),
    lifecycle: lifecycleFrom(
      [c.onYearDay(c.year - 1, 100, 9, 0), c.onYearDay(c.year - 1, 110, 9, 0)],
      false,
    ),
  });
}

function buildArchived(c: Clock): HistorySeedContact {
  const days = [10, 24, 41, 57, 80, 101, 125, 150, 172, 200];
  return contact("archived", "History Archived", 30, {
    interactions: interactionsFrom(
      days.map((d, i) => c.ago(d, 11 + (i % 8), 25)),
    ),
    knowledge: knowledgeFrom([c.ago(65, 15, 0)]),
    lifecycle: lifecycleFrom([c.ago(90, 9, 30), c.ago(84, 9, 30)], false),
    archive: true,
  });
}

// --- Plan ---------------------------------------------------------------------
/** The whole synthetic History fixture as of the injected local `now`. */
export function buildHistorySeedPlan(now: Date): HistorySeedPlan {
  const c = clock(now);
  const rand = mulberry32(PRNG_SEED);
  const contacts = [
    buildLong(c, rand),
    buildDense(c),
    buildSparse(c),
    buildNotesOnly(c),
    buildUnbound(c),
    buildQuietYear(c, rand),
    buildArchived(c),
    contact("empty", "History Empty", 30),
  ];
  // Group events: strictly before today (never today, so never clamped).
  const groupEvents: SeedGroupEvent[] = [
    {
      title: "Synthetic group dinner",
      occurredAt: c.ago(Math.max(1, Math.min(c.todayIndex, 12)), 18, 0),
      channel: "In Person",
      quality: "Positive",
      groupNote: "Synthetic shared note for the group.",
      participants: ["long", "sparse"],
    },
    {
      title: "Synthetic group hike",
      occurredAt: c.onYearDay(c.year - 1, 277, 14, 0),
      channel: "In Person",
      quality: null,
      groupNote: null,
      participants: ["long", "sparse"],
    },
  ];
  return { today: c.today, now: c.nowStamp, contacts, groupEvents };
}
