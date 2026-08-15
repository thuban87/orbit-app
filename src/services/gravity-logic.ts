/**
 * PURE gravity math (LOG-03 gravity half) — the age-decayed accumulated-familiarity
 * "grace buffer" from the interaction log, mapped to coarse named tiers.
 *
 * No react-native, no Skia, no expo, no DB import: node-unit-tested
 * (`gravity-logic.test.ts`) exactly like `crop-geometry.ts` — the ONLY on-device
 * unknown left is the visual (GravityBar). The tunables (half-life, floor,
 * tiers) live at the top of `impact.ts` and are injected here, so tuning is a
 * single-number edit there (CLAUDE.md).
 *
 * =============================================================================
 * THE DECISIONS (docs/dossier/04-log.md Cluster G — all owner [DECIDED]):
 *
 *   • DECAYS WITH AGE TOWARD A FLOOR, NOT TO ZERO. A recent interaction weighs
 *     ~1; an ancient one fades but asymptotes to `floorW`, never to 0 — history
 *     already built is never entirely lost, but it stops growing when you stop
 *     showing up. (A pure lifetime total only ever rises and cannot show a
 *     relationship thinning; a pure decay would call a lapsed best friend a
 *     stranger.)  weight(age) = floorW + (1-floorW)·2^(-age/halfLife).
 *
 *   • RAW IS A SUM OF PER-INTERACTION WEIGHTS, then mapped to the HIGHEST tier
 *     whose threshold <= raw. This makes gravity MONOTONE IN RECENCY (shifting
 *     the same set more-recent never lowers it) and a SUPERSET never lowers it —
 *     both are asserted in the tests.
 *
 *   • COARSE NAMED TIERS, NEVER A RAW NUMBER. A raw score is gameable like a
 *     streak (it climbs on one more tap, manufacturing an incentive to log
 *     contact that did not happen — corrupting the log every other feature
 *     reads). Coarse tiers do not move for one more tap, so there is nothing to
 *     optimise. The raw is exposed ONLY to drive the bar fill — the LABEL is the
 *     tier name (GravityBar enforces this).
 *
 * NOTE on `connected` / `direction`: this pure core sums over whatever rows it
 * is given and does NOT itself filter. The recency-mirroring "Rarely responds →
 * connected rows only" rule (Cluster G: rarely_responds contacts feed gravity
 * differently) is applied by `computeContactGravity` in impact.ts BEFORE calling
 * here — the same scoping the single-writer recency DAO already uses. `direction`
 * is deliberately NOT an input to gravity (familiarity accrues regardless of who
 * reached out; direction drives INTENSITY, Plan 06-06).
 *
 * UNITS: `occurredAt`/`now` are stored local wall-clock `YYYY-MM-DD HH:MM:SS`
 * strings (DATA-05). They are parsed with LOCAL components (never toISOString /
 * UTC), matching `parseLocalDateTime` — the dates.ts convention.
 * =============================================================================
 */

/** One gravity tier: a display name and the raw threshold it starts at. */
export interface GravityTier {
  name: string;
  threshold: number;
}

/** Injected gravity tunables — the owner-approved constants live in impact.ts. */
export interface GravityTunables {
  /** Days for a per-interaction weight to decay HALF-way to the floor. */
  halfLifeDays: number;
  /** The floor fraction an ancient interaction still weighs (never 0). */
  floorW: number;
  /** Ordered tiers, ASCENDING threshold; `tiers[0].threshold` must be 0. */
  tiers: GravityTier[];
}

/** The derived gravity result. `raw` drives the bar fill ONLY — never the label. */
export interface GravityResult {
  raw: number;
  tierIndex: number;
  tierName: string;
  tierCount: number;
}

/** One row's inputs to gravity: when it happened + whether it connected. */
export interface GravityInteraction {
  occurredAt: string;
  connected: number;
}

/**
 * Parse a stored `YYYY-MM-DD HH:MM:SS` (or bare `YYYY-MM-DD`) as a LOCAL Date —
 * local components so there is no UTC evening off-by-one (dates.ts convention;
 * mirrors `parseLocalDateTime`). A missing time defaults to `00:00:00`.
 */
function parseLocalMs(stored: string): number {
  const m = stored
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    throw new Error(`gravity-logic: unparseable timestamp "${stored}"`);
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
 * Per-interaction weight: `floorW + (1-floorW)·2^(-ageDays/halfLifeDays)`.
 * Age is clamped at 0 so a nominally-future row (which the write guards forbid,
 * but a clock skew could produce) can never weigh MORE than a same-instant one.
 * Decays toward `floorW`, never to zero.
 */
function weight(
  occurredAt: string,
  nowMs: number,
  halfLifeDays: number,
  floorW: number,
): number {
  const ageDays = Math.max(0, (nowMs - parseLocalMs(occurredAt)) / MS_PER_DAY);
  const decayed = Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
  return floorW + (1 - floorW) * decayed;
}

/**
 * Sum the age-decayed weights over `interactions` → `raw`, then map to the
 * highest tier whose `threshold <= raw`. Zero interactions → raw 0 → tier 0.
 * Pure and side-effect-free; the caller injects the tunables.
 */
export function computeGravity(
  interactions: GravityInteraction[],
  now: string,
  tunables: GravityTunables,
): GravityResult {
  const nowMs = parseLocalMs(now);
  const raw = interactions.reduce(
    (sum, i) =>
      sum + weight(i.occurredAt, nowMs, tunables.halfLifeDays, tunables.floorW),
    0,
  );

  // Highest tier whose threshold the raw clears. tiers[0].threshold is 0, so a
  // raw of 0 always lands on tier 0 (the lowest).
  let tierIndex = 0;
  for (let i = 0; i < tunables.tiers.length; i++) {
    if (raw >= tunables.tiers[i].threshold) {
      tierIndex = i;
    }
  }

  return {
    raw,
    tierIndex,
    tierName: tunables.tiers[tierIndex].name,
    tierCount: tunables.tiers.length,
  };
}
