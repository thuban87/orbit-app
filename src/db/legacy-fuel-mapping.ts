/**
 * Legacy knowledge-row mapping (Phase 38.10, D-54 / D-56 / D-97).
 *
 * The retired five-kind knowledge table is gone from the schema after
 * migration 033. This pure module is the single TypeScript statement of where
 * each legacy row lives now, and it is shared by:
 *   - the v7 -> v8 backup converter (plan 04), which applies it to the legacy
 *     rows in a v7 backup file;
 *   - the temporary Off Limits shim behind the old DAO names (plan 02).
 *
 * Migration 033 itself never imports this module (runbook Pitfall 9): it keeps
 * frozen literal copies of the same rules, and `legacy-fuel-mapping.test.ts`
 * pins those literals equal to the outputs here.
 *
 * Wording note: the end-of-wave SQL grep forbids phrases that look like SQL
 * against the retired table in this file, so comments here say "legacy rows"
 * or "the retired table".
 *
 * Pure: no executor, no clock, no uid source.
 */

import { firstNonBlank, isBlank } from "@/utils/blank-text";

/** The documented legacy kind vocabulary. Stored rows may hold any string. */
export type LegacyFuelKind =
  | "recent"
  | "topic"
  | "fact"
  | "gift"
  | "off_limits";

/** The three tables a legacy row can land in. */
export type LegacyDestinationTable =
  | "off_limits"
  | "memories"
  | "current_state_entries";

export const LEGACY_DESTINATION_TABLES: readonly LegacyDestinationTable[] = [
  "off_limits",
  "memories",
  "current_state_entries",
];

/** The memory type a memory-bound legacy kind lands as (D-56). */
export type LegacyMemoryType = "gift_idea" | "thought_of_them" | "general";

/**
 * Kind -> home (D-56). A kind not listed here (no CHECK ever constrained the
 * column) lands as a `general` memory; the mapping never throws.
 */
export const LEGACY_FUEL_KIND_HOMES: Readonly<
  Record<
    LegacyFuelKind,
    | { table: "off_limits" }
    | { table: "memories"; memoryType: LegacyMemoryType }
    | { table: "current_state_entries"; fieldKey: "last_talked_about" }
  >
> = {
  off_limits: { table: "off_limits" },
  gift: { table: "memories", memoryType: "gift_idea" },
  topic: { table: "memories", memoryType: "thought_of_them" },
  fact: { table: "memories", memoryType: "general" },
  recent: { table: "current_state_entries", fieldKey: "last_talked_about" },
};

/** The memory type an unknown legacy kind lands as. */
export const LEGACY_UNKNOWN_KIND_MEMORY_TYPE: LegacyMemoryType = "general";

/**
 * A legacy tombstone carries only a uid, so it is converted into one tombstone
 * per possible home (Research Q3, decided in plan 01: triple conversion). With
 * uids preserved, the tombstone matching the row's real home is the live one
 * and the other two are inert.
 */
export const LEGACY_FUEL_TOMBSTONE_TYPES: readonly {
  entityType: "memory" | "off_limits" | "current_state_entry";
  table: LegacyDestinationTable;
}[] = [
  { entityType: "memory", table: "memories" },
  { entityType: "off_limits", table: "off_limits" },
  { entityType: "current_state_entry", table: "current_state_entries" },
];

/**
 * How contentless legacy rows (text, label and url all blank) are handled.
 * `"skip"` is D-97: a contentless off_limits row is copied as-is; any other
 * kind is skipped (home `none`) and counted by the caller.
 */
export type LegacyContentlessRule = "skip";

/** One legacy row, in the camelCase shape the v7 backup and the shim both use. */
export interface LegacyFuelRowInput {
  uid: string;
  kind: string;
  label?: string | null;
  text?: string | null;
  url?: string | null;
  source: string;
  createdAt: string;
  modifiedAt: string;
}

/** The uid allocation for collided legacy uids, per destination table. */
export type LegacyUidAllocation = Readonly<
  Record<LegacyDestinationTable, ReadonlyMap<string, string>>
>;

export type LegacyFuelMapping =
  | {
      home: "off_limits";
      uid: string;
      label: string | null;
      text: string | null;
      url: string | null;
      groupNoteCopy: 0;
      fromShare: 0 | 1;
      createdAt: string;
      modifiedAt: string;
    }
  | {
      home: "memory";
      uid: string;
      type: LegacyMemoryType;
      value: string | null;
      customLabel: string | null;
      url: string | null;
      provenance: "share" | "user";
      allowAi: 0;
      pinned: 0;
      hidden: null;
      groupNoteCopy: 0;
      createdAt: string;
      modifiedAt: string;
    }
  | {
      home: "current_state";
      uid: string;
      fieldKey: "last_talked_about";
      value: string;
      url: string | null;
      entryDate: string;
      entryTime: null;
      groupNoteCopy: 0;
      fromShare: 0 | 1;
      createdAt: string;
      modifiedAt: string;
    }
  | { home: "none"; uid: string; reason: "contentless" };

// `isBlank` / `firstNonBlank` live in `@/utils/blank-text` (38.10-18) so the
// live move DAO need not import this module; they are re-exported unchanged.
export { firstNonBlank, isBlank };

const DATE_PREFIX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function datePrefix(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const prefix = value.slice(0, 10);
  return DATE_PREFIX.test(prefix) ? prefix : null;
}

/**
 * The entry date for a legacy Last Talked About row (and the migration's
 * rebuild of existing current-state rows): the date part of `createdAt` when
 * it has the `YYYY-MM-DD` shape, else the same rule on `modifiedAt`, else the
 * date part of `now` (a local wall-clock stamp, never UTC).
 */
export function legacyEntryDate(
  createdAt: string | null | undefined,
  modifiedAt: string | null | undefined,
  now: string,
): string {
  return datePrefix(createdAt) ?? datePrefix(modifiedAt) ?? now.slice(0, 10);
}

/**
 * The plain re-mint for a legacy uid that already exists in its destination
 * (F-D5): `legacy-<table>-<uid>`, then `-2`, `-3`, … for later attempts.
 */
export function remintLegacyUid(
  destinationTable: LegacyDestinationTable,
  uid: string,
  attempt = 1,
): string {
  const base = `legacy-${destinationTable}-${uid}`;
  return attempt <= 1 ? base : `${base}-${attempt}`;
}

/** The D-56 home for a stored kind, or undefined for an unknown kind. */
function knownHome(
  kind: string,
): (typeof LEGACY_FUEL_KIND_HOMES)[LegacyFuelKind] | undefined {
  // Own-property check: a stored kind such as "toString" must not resolve
  // through Object.prototype.
  return Object.hasOwn(LEGACY_FUEL_KIND_HOMES, kind)
    ? LEGACY_FUEL_KIND_HOMES[kind as LegacyFuelKind]
    : undefined;
}

function isContentless(
  row: Pick<LegacyFuelRowInput, "label" | "text" | "url">,
): boolean {
  return isBlank(row.text) && isBlank(row.label) && isBlank(row.url);
}

/**
 * The destination table for a legacy row, or null when D-97 skips it
 * (contentless and not off_limits).
 */
export function legacyHomeTable(
  row: Pick<LegacyFuelRowInput, "kind" | "label" | "text" | "url">,
): LegacyDestinationTable | null {
  const home = knownHome(row.kind) ?? ({ table: "memories" } as const);
  if (home.table !== "off_limits" && isContentless(row)) return null;
  return home.table;
}

/**
 * Collision-complete uid allocation (convergence c3, Codex C-03; c4; c7).
 *
 * Per destination table T:
 *   - legacy uids for T = uids of legacy rows whose home is T, plus every
 *     legacy tombstone uid (each tombstone is converted into all three types);
 *   - collided = legacy uids for T already in T's pre-copy uid set (its rows,
 *     including soft-deleted memories, plus its existing tombstone uids of T's
 *     entity type);
 *   - reserved = T's pre-copy set plus the legacy uids that did not collide;
 *   - collided uids are walked in ascending code-unit order, and each takes the
 *     first of `legacy-T-uid`, `legacy-T-uid-2`, … not yet reserved.
 *
 * Only re-minted uids appear in the result; every other legacy uid keeps its
 * own value. Migration 033 carries a frozen copy of this loop.
 */
export function allocateLegacyUids(input: {
  legacyRows: readonly Pick<
    LegacyFuelRowInput,
    "uid" | "kind" | "label" | "text" | "url"
  >[];
  legacyTombstoneUids: readonly string[];
  destinationUids: Readonly<Record<LegacyDestinationTable, Iterable<string>>>;
}): LegacyUidAllocation {
  const result = {} as Record<LegacyDestinationTable, Map<string, string>>;
  for (const table of LEGACY_DESTINATION_TABLES) {
    const preCopy = new Set(input.destinationUids[table]);
    const legacy = new Set<string>();
    for (const row of input.legacyRows) {
      if (legacyHomeTable(row) === table) legacy.add(row.uid);
    }
    for (const uid of input.legacyTombstoneUids) legacy.add(uid);

    const collided: string[] = [];
    const reserved = new Set(preCopy);
    for (const uid of legacy) {
      if (preCopy.has(uid)) collided.push(uid);
      else reserved.add(uid);
    }
    collided.sort();

    const allocated = new Map<string, string>();
    for (const uid of collided) {
      let attempt = 1;
      let candidate = remintLegacyUid(table, uid, attempt);
      while (reserved.has(candidate)) {
        attempt += 1;
        candidate = remintLegacyUid(table, uid, attempt);
      }
      reserved.add(candidate);
      allocated.set(uid, candidate);
    }
    result[table] = allocated;
  }
  return result;
}

/** The final uid for a legacy uid in one destination table. */
export function allocatedLegacyUid(
  allocation: LegacyUidAllocation | undefined,
  table: LegacyDestinationTable,
  uid: string,
): string {
  return allocation?.[table].get(uid) ?? uid;
}

/**
 * The Last Talked About value for a legacy `recent` row (D-56 as amended by
 * D-128): "<label>: <text>" with both parts trimmed when both are non-blank,
 * else the first non-blank of (text, label, url) as stored. Migration 033
 * carries a frozen copy of this rule.
 */
export function legacyLastTalkedAboutValue(
  row: Pick<LegacyFuelRowInput, "label" | "text" | "url">,
): string {
  if (!isBlank(row.label) && !isBlank(row.text)) {
    return `${(row.label as string).trim()}: ${(row.text as string).trim()}`;
  }
  // Non-null: a contentless row never reaches the recent branch.
  return firstNonBlank(row.text, row.label, row.url) as string;
}

/**
 * Map one legacy row to its new home (D-56, D-97, D-108, RESEARCH 1.5).
 *
 * - off_limits -> off_limits: label, text and url as-is; `fromShare` 1 when
 *   the source was `share`.
 * - gift / topic / fact / unknown -> memories as gift_idea / thought_of_them /
 *   general / general: value = first non-blank of (text, url), custom label =
 *   label when non-blank, url as-is, provenance `share` for a share else
 *   `user`, Allow AI off (D-56).
 * - recent -> current_state_entries as Last Talked About: value =
 *   "<label>: <text>" (both trimmed) when label and text are both non-blank
 *   (D-128, so the label is not lost), else the first non-blank of (text,
 *   label, url); url as-is, entry date by `legacyEntryDate`, no entry time
 *   (D-48).
 * - contentless non-off_limits rows -> `none` (D-97).
 *
 * The uid, created_at and modified_at are kept (RESEARCH 1.4), except that a
 * collided uid takes its allocated value for the home table.
 */
export function mapLegacyFuelRow(
  row: LegacyFuelRowInput,
  options: {
    now: string;
    allocation?: LegacyUidAllocation;
    contentlessRule: LegacyContentlessRule;
  },
): LegacyFuelMapping {
  const table = legacyHomeTable(row);
  if (table === null) {
    return { home: "none", uid: row.uid, reason: "contentless" };
  }
  const uid = allocatedLegacyUid(options.allocation, table, row.uid);
  const fromShare: 0 | 1 = row.source === "share" ? 1 : 0;

  if (table === "off_limits") {
    return {
      home: "off_limits",
      uid,
      label: row.label ?? null,
      text: row.text ?? null,
      url: row.url ?? null,
      groupNoteCopy: 0,
      fromShare,
      createdAt: row.createdAt,
      modifiedAt: row.modifiedAt,
    };
  }

  if (table === "current_state_entries") {
    return {
      home: "current_state",
      uid,
      fieldKey: "last_talked_about",
      value: legacyLastTalkedAboutValue(row),
      url: row.url ?? null,
      entryDate: legacyEntryDate(row.createdAt, row.modifiedAt, options.now),
      entryTime: null,
      groupNoteCopy: 0,
      fromShare,
      createdAt: row.createdAt,
      modifiedAt: row.modifiedAt,
    };
  }

  const known = knownHome(row.kind);
  const type =
    known !== undefined && known.table === "memories"
      ? known.memoryType
      : LEGACY_UNKNOWN_KIND_MEMORY_TYPE;
  return {
    home: "memory",
    uid,
    type,
    value: firstNonBlank(row.text, row.url),
    customLabel: isBlank(row.label) ? null : (row.label as string),
    url: row.url ?? null,
    provenance: row.source === "share" ? "share" : "user",
    allowAi: 0,
    pinned: 0,
    hidden: null,
    groupNoteCopy: 0,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  };
}
