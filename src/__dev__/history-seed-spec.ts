/**
 * History seed spec — the deterministic synthetic History datasets (38.8 Plan
 * 01, D-30).
 *
 * DEV-ONLY and PURE: no DB, no React, no `expo-*` import. `history-seed.ts`
 * writes this plan through the app's own Core writers; it is reached only from
 * the `__DEV__` dev menu (`uat-probes.ts`), so it never enters a release bundle.
 *
 * Every timestamp is a LOCAL wall-clock `YYYY-MM-DD HH:MM:SS` built from local
 * `Date` components (never UTC ISO slicing), counted back from the injected
 * `now`, so Today / Yesterday labels and year boundaries are exercisable on the
 * day the seed runs. A today-dated record is clamped to at or before `now`
 * (C3-04): it is never dropped or moved to another day, so counts and dates do
 * not depend on the time of day, and no seeded row is in the future.
 */

// --- Tunables -----------------------------------------------------------------
/** Bump whenever the dataset shape changes (logged with every seed run). */
export const HISTORY_SEED_SPEC_VERSION = 1;
/** Every seeded contact's uid starts with this; the idempotency marker. */
export const HISTORY_SEED_UID_PREFIX = "dev-history-seed-";

// --- Types --------------------------------------------------------------------
export type HistorySeedKey = "long";

export interface SeedInteraction {
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS`. */
  occurredAt: string;
  channel: string;
  direction: string | null;
  connected: number;
  quality: string | null;
  note: string | null;
}

export interface HistorySeedContact {
  key: HistorySeedKey;
  uid: string;
  name: string;
  intervalDays: number | null;
  trackingEnabled: boolean;
  interactions: SeedInteraction[];
}

export interface HistorySeedPlan {
  /** The injected now's local calendar date. */
  today: string;
  /** The injected now as a local wall-clock string (the clamp ceiling). */
  now: string;
  contacts: HistorySeedContact[];
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

/** Builds clamped local timestamps relative to one injected `now`. */
function clock(now: Date) {
  const nowStamp = localStamp(now);
  const today = localDate(now);
  return {
    today,
    nowStamp,
    /** `hh:mm` local, `daysAgo` calendar days before now's local day; clamped. */
    at(daysAgo: number, hh: number, mm: number): string {
      const stamp = localStamp(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - daysAgo,
          hh,
          mm,
          0,
        ),
      );
      return stamp > nowStamp ? nowStamp : stamp;
    },
  };
}

// --- Plan ---------------------------------------------------------------------
export function buildHistorySeedPlan(now: Date): HistorySeedPlan {
  const c = clock(now);
  const long: HistorySeedContact = {
    key: "long",
    uid: `${HISTORY_SEED_UID_PREFIX}long`,
    name: "History Long",
    intervalDays: 7,
    trackingEnabled: true,
    interactions: [
      {
        occurredAt: c.at(0, 9, 0),
        channel: "Call",
        direction: "outbound",
        connected: 1,
        quality: "Positive",
        note: "Synthetic seed call.",
      },
    ],
  };
  return { today: c.today, now: c.nowStamp, contacts: [long] };
}
