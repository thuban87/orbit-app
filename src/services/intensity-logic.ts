/**
 * PURE intensity math (LOG-03 intensity half) — this-period contact RATE vs the
 * intended frequency, plus the long-run trailing cadence (actual-vs-intended).
 *
 * No react-native, no Skia, no expo, no DB import: node-unit-tested
 * (`intensity-logic.test.ts`) exactly like `gravity-logic.ts` / `crop-geometry.ts`.
 * The period tunable (INTENSITY_PERIOD_DAYS) lives at the top of `impact.ts` and
 * is injected here as `periodDays`, so tuning is a single-number edit there
 * (CLAUDE.md).
 *
 * =============================================================================
 * THE DECISIONS (docs/dossier/04-log.md Cluster G — owner [DECIDED]):
 *
 *   • NEUTRAL RATE, NEVER A JUDGEMENT. Intensity is a rate stated as FACT
 *     ("5× this period vs Monthly intended"), never a scold. Frequency is a
 *     FLOOR, not a ceiling — contacting MORE than intended is not "too much".
 *     No danger/warning semantics live here; the renderer stays on neutral text
 *     tokens.
 *
 *   • DIRECTION MATTERS — count only where YOU reached out. Only rows whose
 *     `direction` is 'outbound' or 'mutual' raise `currentCount`. Inbound-only
 *     volume (they blew up your phone) is NOT you over-contacting, so it does
 *     not inflate intensity.
 *
 *   • FILTER-CONSISTENT WITH RECENCY (decision-without-you #8). For a
 *     `rarely_responds` contact, only CONNECTED rows count — the same
 *     `rarely_responds = 0 OR connected = 1` scope recency and gravity use — so
 *     the metric never disagrees with the orbit. A non-connected outbound
 *     attempt to a rarely-responds contact does not inflate intensity.
 *
 *   • ASCENDING-SORT BEFORE THE CADENCE. `trailingAvgGapDays` is the mean gap
 *     between consecutive qualifying `occurredAt` over ALL history. The
 *     `ImpactInputs` rows arrive NEWEST-FIRST (occurred_at DESC from
 *     getImpactInputs), so this function MUST sort the qualifying rows ASCENDING
 *     by occurredAt before differencing — otherwise every consecutive gap is
 *     NEGATIVE. Null when there are fewer than 2 qualifying rows (no
 *     divide-by-zero, never throws).
 *
 * DERIVED-NEVER-STORED: no write statement, no column — computed at read time.
 *
 * UNITS: `occurredAt`/`now` are stored local wall-clock `YYYY-MM-DD HH:MM:SS`
 * strings (DATA-05). They are parsed with LOCAL components (never toISOString /
 * UTC), matching `parseLocalDateTime` — the dates.ts convention.
 * =============================================================================
 */

/** One row's inputs to intensity: when it happened, connected, and direction. */
export interface IntensityInteraction {
  occurredAt: string;
  connected: number;
  direction: string | null;
}

/** The derived intensity result — a neutral rate plus the long-run cadence. */
export interface IntensityResult {
  /** The period length in days the rate is measured over (= interval_days). */
  periodDays: number;
  /** Qualifying (outbound/mutual, connected-scoped) rows within the last period. */
  currentCount: number;
  /** The intended rate: one contact per interval (frequency is a floor). */
  intendedPerPeriod: number;
  /** currentCount / intendedPerPeriod — the "N× this period" multiple. */
  multiple: number;
  /** Mean day-gap between consecutive qualifying rows over ALL history; null < 2. */
  trailingAvgGapDays: number | null;
}

/**
 * Parse a stored `YYYY-MM-DD HH:MM:SS` (or bare `YYYY-MM-DD`) as a LOCAL Date —
 * local components so there is no UTC evening off-by-one (dates.ts convention;
 * mirrors `parseLocalDateTime` / gravity-logic's parseLocalMs). A missing time
 * defaults to `00:00:00`.
 */
function parseLocalMs(stored: string): number {
  const m = stored
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    throw new Error(`intensity-logic: unparseable timestamp "${stored}"`);
  }
  const [, y, mo, d, hh, mm, ss] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh ?? 0),
    Number(mm ?? 0),
    Number(ss ?? 0),
  ).getTime();
}

const MS_PER_DAY = 86_400_000;

/**
 * Derive intensity from a contact's interaction rows.
 *
 * Counts only rows where YOU reached out (`direction` 'outbound' or 'mutual');
 * for a `rarelyResponds` contact additionally requires `connected === 1` (the
 * recency-mirroring scope). `currentCount` is the qualifying rows within the last
 * `periodDays` of `now`; `trailingAvgGapDays` is the mean consecutive day-gap
 * across ALL qualifying history (rows sorted ascending first). Zero/one
 * qualifying rows → currentCount as counted, trailingAvgGapDays null.
 */
export function computeIntensity(
  interactions: IntensityInteraction[],
  periodDays: number,
  rarelyResponds: number,
  now: string,
): IntensityResult {
  const nowMs = parseLocalMs(now);
  const periodStartMs = nowMs - periodDays * MS_PER_DAY;

  // You-reached-out filter (direction), then the recency-mirroring connected
  // scope for rarely-responds contacts. Inbound-only volume never qualifies.
  const qualifying = interactions.filter((i) => {
    const youReachedOut =
      i.direction === "outbound" || i.direction === "mutual";
    if (!youReachedOut) {
      return false;
    }
    if (rarelyResponds === 1 && i.connected !== 1) {
      return false;
    }
    return true;
  });

  // This period's count: qualifying rows whose occurredAt is within periodDays
  // of now (day-granular is fine; parse local, never toISOString).
  const currentCount = qualifying.filter(
    (i) => parseLocalMs(i.occurredAt) >= periodStartMs,
  ).length;

  const intendedPerPeriod = 1;
  const multiple = currentCount / intendedPerPeriod;

  // Trailing cadence over ALL qualifying history. SORT ASCENDING first — the
  // input arrives newest-first (DESC), so un-sorted gaps would be NEGATIVE.
  let trailingAvgGapDays: number | null = null;
  if (qualifying.length >= 2) {
    const ascMs = qualifying
      .map((i) => parseLocalMs(i.occurredAt))
      .sort((a, b) => a - b);
    let gapSum = 0;
    for (let i = 1; i < ascMs.length; i++) {
      gapSum += (ascMs[i] - ascMs[i - 1]) / MS_PER_DAY;
    }
    trailingAvgGapDays = gapSum / (ascMs.length - 1);
  }

  return {
    periodDays,
    currentCount,
    intendedPerPeriod,
    multiple,
    trailingAvgGapDays,
  };
}
