/**
 * Orrery perf fixture — the deterministic SPEC (38.7 Plan 01, D-56).
 *
 * DEV-ONLY. Pure data: no native import, no clock, no randomness, no hashing
 * (Hermes has no `globalThis.crypto`; the spec test pins `SEED_SPEC_VERSION`
 * against a node-crypto hash instead). `orrery-seed.ts` writes this spec
 * through the app's real DAOs; `scripts/dev/orrery-perf/fixture_manifest.py`
 * reads `SEED_SPEC_VERSION` from this file at the measured commit.
 *
 * Two parts:
 *   - the shared Size CAST: 120 contacts that reproduce, member for member, the
 *     cast the three Orrery labs seeded (`lab-c-seed.ts` / `lab-b-seed.ts`
 *     `sizeSpec(i)`, `seed-lab-a.py`) — same names, intervals, status pattern,
 *     band solver, history counts, photo slots and moons — so the Day-1 baseline
 *     (Plan 02), the D-44 spike (Plan 08) and the final pass (Plan 16) measure
 *     the same people the lab evidence did. "Size N" = cast members 0..N-1.
 *   - the All Contacts STRESS set: 880 more contacts (All Contacts ≈ 1,000 on a
 *     test phone) with light histories, a photo on every 4th and moons on the
 *     first 60, in the custom System "Orrery Stress" (also its idempotency
 *     marker).
 *
 * `days` is days since the LATEST touchpoint at offset 0 (the seed day). Every
 * touchpoint of a member is `daysAgo` local calendar days before the anchor
 * day at `hour`:00, so query-time status (src/db/status.ts, day-granular) is
 * fixed by `days` + the common offset the fixture has aged by.
 *
 * Procedural photo pixels are fixture IMAGE content: the seed computes them
 * numerically from `photoSeed`, never from colour literals or theme tokens.
 */
import type { OrreryDensity } from "@/db/app-settings-dao";

// --- Tunables -----------------------------------------------------------------
/** Shared lab cast size; "Size 120" holds all of it. */
export const SIZE_CAST = 120;
/** The comparison Systems: "Size N" = the first N cast members. */
export const SIZE_SYSTEM_SIZES = [5, 10, 20, 32, 120] as const;
/** Extra contacts so All Contacts holds ≈ 1,000 with the cast. */
export const STRESS_COUNT = 880;
/** Every Nth stress member (index % N === 1) carries a procedural photo. */
export const STRESS_PHOTO_EVERY = 4;
/** The first N stress members carry 1-3 moons (relationships). */
export const STRESS_MOON_PARENTS = 60;
/** Custom System holding every stress member (and its idempotency marker). */
export const STRESS_SYSTEM_NAME = "Orrery Stress";
/** The cast's idempotency marker (the smallest Size System). */
export const CAST_MARKER_SYSTEM_NAME = `Size ${SIZE_SYSTEM_SIZES[0]}`;
/** Photo seeds for stress members start here so they never reuse a cast seed. */
export const STRESS_PHOTO_SEED_BASE = 100_000;
/** Procedural photo edge (px). */
export const FIXTURE_PHOTO_PX = 256;

/**
 * Pinned to the first 12 hex chars of SHA-256(JSON.stringify(buildOrrerySeedPlan())),
 * asserted by orrery-seed-spec.test.ts with node's crypto. Any spec change fails
 * that test until this is bumped, so a manifest recorded at the baseline can
 * never be silently compared against a different fixture.
 */
export const SEED_SPEC_VERSION = "2ded9f40dc01";

/**
 * Persistent Orrery inputs the fixture pins (cycle-2 C-M5). Satellites are on
 * because the cast and the stress set carry moons; the last System is the
 * seeded "Size 120", resolved to its `custom:<uid>` ref at run time.
 */
export const ORRERY_FIXTURE_PREFERENCES: {
  density: OrreryDensity;
  satellitesEnabled: 0 | 1;
  lastSystemName: string;
} = {
  density: "balanced",
  satellitesEnabled: 1,
  lastSystemName: `Size ${SIZE_CAST}`,
};

// --- Types --------------------------------------------------------------------
/** S stable, W wobble, D decay, R rogue (rarely responds), N never, O rogue (overdue). */
export type SeedKind = "S" | "W" | "D" | "R" | "N" | "O";
export type SeedPart = "cast" | "stress";

export interface SeedTouchpoint {
  /** Local calendar days before the anchor day. */
  daysAgo: number;
  /** Local hour of day (minutes/seconds 0). */
  hour: number;
  channel: string;
}

export interface SeedMoon {
  personName: string;
  relationType: string;
}

export interface SeedMember {
  part: SeedPart;
  index: number;
  name: string;
  kind: SeedKind;
  interval: number;
  /** Days since the latest touchpoint at offset 0; null = never contacted. */
  days: number | null;
  rarely: 0 | 1;
  /** Older touchpoints beyond the latest one. */
  history: number;
  photo: boolean;
  photoSeed: number;
  moons: SeedMoon[];
  /** Newest first. Empty for never-contacted members. */
  touchpoints: SeedTouchpoint[];
}

export interface SeedSystem {
  name: string;
  part: SeedPart;
  /** Member indexes into that part. */
  members: number[];
}

export interface OrrerySeedPlan {
  cast: SeedMember[];
  stress: SeedMember[];
  systems: SeedSystem[];
  preferences: typeof ORRERY_FIXTURE_PREFERENCES;
}

// --- Shared lab cast (verbatim rewrite of the labs' sizeSpec) -----------------
const SIZE_FIRST = [
  "Aiden",
  "Bianca",
  "Callum",
  "Daria",
  "Emeka",
  "Freya",
  "Gideon",
  "Helena",
  "Ines",
  "Jonah",
  "Keira",
  "Luca",
  "Maren",
  "Nolan",
  "Odette",
  "Pavel",
  "Rania",
  "Silas",
  "Talia",
  "Ulrich",
  "Vesna",
  "Wade",
  "Ximena",
  "Yusuf",
];
const SIZE_LAST = [
  "Ashworth",
  "Bellamy",
  "Carver",
  "Delacroix",
  "Esposito",
  "Fairbanks",
  "Gallagher",
  "Hargrove",
  "Iwasaki",
  "Jaramillo",
  "Kessler",
  "Lombardi",
  "Mercer",
  "Nakamura",
  "Oduya",
];
const SIZE_INTERVALS = [7, 14, 21, 30, 45, 60, 90];
const SIZE_PATTERN = "SWDRNSSWDO";
const SIZE_MOONS: Record<number, [string, string][]> = {
  11: [
    ["Mara", "Partner"],
    ["Theo", "Child"],
  ],
  17: [["Ilse", "Sibling"]],
  26: [["Ruth", "Parent"]],
  70: [
    ["Owen", "Friend"],
    ["Lia", "Partner"],
  ],
};
const CHANNELS = ["Message", "Call", "In Person"];

/** Integer-only hash shared with the labs (Python Lab A agrees bit for bit). */
function sizeH(i: number, salt: number): number {
  return (((i + 1) * 7919 + salt * 104729) % 1000) / 1000;
}

function sizeBand(days: number, interval: number, rarely: number): SeedKind {
  const p = days / interval;
  if (rarely && p >= 1) return "R";
  if (p >= 3) return "O";
  if (p >= 1) return "D";
  if (p >= 0.8) return "W";
  return "S";
}

/** The labs' band solver: start from the target progress, step until the band matches. */
function solveDays(kind: Exclude<SeedKind, "N">, interval: number, h: number) {
  const rarely = kind === "R" ? 1 : 0;
  const p = {
    S: 0.1 + 0.6 * h,
    W: 0.82 + 0.15 * h,
    D: 1.1 + 1.7 * h,
    R: 1.2 + 1.2 * h,
    O: 3.3 + 1.5 * h,
  }[kind];
  let days = Math.max(1, Math.floor(p * interval + 0.5));
  const order = "SWDO";
  for (let n = 0; n < 400; n += 1) {
    const got = sizeBand(days, interval, rarely);
    if (got === kind) break;
    if (kind === "R" || order.indexOf(got) < order.indexOf(kind)) days += 1;
    else days = Math.max(1, days - 1);
  }
  return days;
}

/** Latest at `days` (hour 9), then one touchpoint per interval further back. */
function touchpointsFor(
  index: number,
  days: number | null,
  interval: number,
  history: number,
): SeedTouchpoint[] {
  if (days === null) return [];
  const out: SeedTouchpoint[] = [
    { daysAgo: days, hour: 9, channel: CHANNELS[index % 3] },
  ];
  for (let k = 1; k <= history; k += 1)
    out.push({
      daysAgo: days + k * interval,
      hour: 9 + (k % 8),
      channel: CHANNELS[(index + k) % 3],
    });
  return out;
}

function castMember(i: number): SeedMember {
  const kind = SIZE_PATTERN[i % 10] as SeedKind;
  const interval = SIZE_INTERVALS[(i * 3 + Math.floor(i / 10)) % 7];
  const name = `${SIZE_FIRST[i % 24]} ${SIZE_LAST[(i + 3 * Math.floor(i / 24)) % 15]}`;
  const photo = i % 3 === 1;
  const moons = (SIZE_MOONS[i] ?? []).map(([personName, relationType]) => ({
    personName,
    relationType,
  }));
  const days = kind === "N" ? null : solveDays(kind, interval, sizeH(i, 1));
  const history = kind === "N" ? 0 : Math.floor(sizeH(i, 3) * 6);
  return {
    part: "cast",
    index: i,
    name,
    kind,
    interval,
    days,
    rarely: kind === "R" ? 1 : 0,
    history,
    photo,
    photoSeed: i,
    moons,
    touchpoints: touchpointsFor(i, days, interval, history),
  };
}

// --- Stress set ---------------------------------------------------------------
/** Disjoint from SIZE_FIRST, so no stress name can collide with a cast name. */
const STRESS_FIRST = [
  "Adele",
  "Bram",
  "Cora",
  "Dario",
  "Edda",
  "Fenn",
  "Greta",
  "Hugo",
  "Isla",
  "Joaquin",
  "Kasia",
  "Leif",
  "Mila",
  "Nico",
  "Orla",
  "Pia",
  "Quentin",
  "Rhea",
  "Soren",
  "Tess",
  "Umar",
  "Vera",
  "Wim",
  "Xavi",
  "Yael",
  "Zora",
  "Anouk",
  "Bastian",
  "Celine",
  "Dax",
];
const STRESS_LAST = [
  "Abbott",
  "Brennan",
  "Calloway",
  "Draper",
  "Ellery",
  "Finch",
  "Grieve",
  "Holt",
  "Ingram",
  "Jessup",
  "Kerrigan",
  "Lowell",
  "Marlowe",
  "Nyberg",
  "Orwin",
  "Prescott",
  "Quade",
  "Rourke",
  "Sterling",
  "Tolland",
  "Underhill",
  "Vickery",
  "Whitlock",
  "Yardley",
  "Zimmer",
  "Ashcombe",
  "Blackwood",
  "Corrigan",
  "Dunmore",
  "Everly",
];
const STRESS_MOON_NAMES = [
  "Robin",
  "Sky",
  "Ash",
  "Juno",
  "Rey",
  "Max",
  "Lou",
  "Noor",
];
const STRESS_RELATIONS = [
  "Partner",
  "Child",
  "Parent",
  "Sibling",
  "Friend",
  "Colleague",
];

function stressKind(h: number): SeedKind {
  if (h < 0.4) return "S";
  if (h < 0.55) return "W";
  if (h < 0.75) return "D";
  if (h < 0.85) return "O";
  if (h < 0.93) return "R";
  return "N";
}

function stressMember(i: number): SeedMember {
  const kind = stressKind(sizeH(i, 21));
  const interval = SIZE_INTERVALS[Math.floor(sizeH(i * 13 + 5, 22) * 7)];
  const name = `${STRESS_FIRST[i % STRESS_FIRST.length]} ${STRESS_LAST[Math.floor(i / STRESS_FIRST.length) % STRESS_LAST.length]}`;
  const days =
    kind === "N" ? null : solveDays(kind, interval, sizeH(i * 7 + 1, 23));
  const history = kind === "N" ? 0 : Math.floor(sizeH(i * 11 + 2, 24) * 4);
  const moons: SeedMoon[] = [];
  if (i < STRESS_MOON_PARENTS) {
    const count = 1 + Math.floor(sizeH(i * 3 + 7, 25) * 3);
    for (let m = 0; m < count; m += 1)
      moons.push({
        personName: STRESS_MOON_NAMES[(i + m) % STRESS_MOON_NAMES.length],
        relationType: STRESS_RELATIONS[(i + m) % STRESS_RELATIONS.length],
      });
  }
  return {
    part: "stress",
    index: i,
    name,
    kind,
    interval,
    days,
    rarely: kind === "R" ? 1 : 0,
    history,
    photo: i % STRESS_PHOTO_EVERY === 1,
    photoSeed: STRESS_PHOTO_SEED_BASE + i,
    moons,
    touchpoints: touchpointsFor(i, days, interval, history),
  };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** The whole fixture as data. Deterministic: two calls deep-equal. */
export function buildOrrerySeedPlan(): OrrerySeedPlan {
  return {
    cast: range(SIZE_CAST).map(castMember),
    stress: range(STRESS_COUNT).map(stressMember),
    systems: [
      ...SIZE_SYSTEM_SIZES.map((size) => ({
        name: `Size ${size}`,
        part: "cast" as const,
        members: range(size),
      })),
      {
        name: STRESS_SYSTEM_NAME,
        part: "stress",
        members: range(STRESS_COUNT),
      },
    ],
    preferences: { ...ORRERY_FIXTURE_PREFERENCES },
  };
}
