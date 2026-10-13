/**
 * Backup format 7 -> 8 conversion (Phase 38.10, D-55).
 *
 * This is the `FORWARD_MIGRATIONS[7]` step. It lives in its own file so the
 * no-legacy-identifier gate (D-01, plan 18) can allowlist exactly one backup
 * module: every other backup file is written against format 8 only.
 *
 * It applies RESEARCH 2.3 steps 1-7 and produces the same rows migration 033
 * produces from the same data (RESEARCH 1.4; pinned by
 * `v7-v8-migration-equivalence.test.ts`):
 *   1. the v7 `fuel[]` array is mapped row by row to its D-56 home through
 *      `mapLegacyFuelRow` (Allow AI off, uid and timestamps kept, contentless
 *      non-off_limits rows skipped per D-97, `fromShare` per D-108);
 *   2. each legacy tombstone becomes three tombstones (memory, off_limits,
 *      current_state_entry), as migration 033 step 8 does;
 *   3. custom memories become general, label kept, `modifiedAt` = now (D-86);
 *   4. soft-deleted memories and key people leave their arrays and become
 *      tombstones carrying their own `deletedAt` (D-69, D-88);
 *   5. current-state entries take `entryDate` by the `legacyEntryDate` rule
 *      and lose `isCurrent`;
 *   6. the two new AI-default settings default to 0 (D-61, D-92);
 *   7. `backupFormatVersion: 8`.
 *
 * A collided legacy uid is re-minted through the shared collision-complete
 * `allocateLegacyUids` (convergence c3/c4/c7), never through `newUid`, so the
 * converter and migration 033 (which carries a frozen copy of the allocator)
 * land on the same final uids.
 *
 * Time source: the manifest's own `metadata.exportedAt`, so a conversion is
 * deterministic for a given file. A string that is not the app's
 * `YYYY-MM-DD HH:MM:SS` local wall-clock shape is not rejected; the converter
 * uses the fixed literal `1970-01-01 00:00:00` instead, so a converted
 * `modifiedAt` loses Merge last-writer-wins to any real local edit
 * (fail-safe direction; plan 38.10-04 only). A non-string `exportedAt` is left
 * for the format-8 validator, which rejects it.
 *
 * Wording note: plan 08's end-of-wave SQL grep covers this file, so comments
 * and strings here say "the v7 `fuel[]` array" or "the legacy rows" rather
 * than phrases that read like SQL against the retired table.
 */
import { BackupSchemaError } from "@/backup/types";
import {
  allocatedLegacyUid,
  allocateLegacyUids,
  LEGACY_FUEL_TOMBSTONE_TYPES,
  type LegacyDestinationTable,
  type LegacyFuelRowInput,
  legacyEntryDate,
  mapLegacyFuelRow,
} from "@/db/legacy-fuel-mapping";
import { newUid } from "@/db/uid";

type RawManifest = Record<string, unknown>;
type RawRow = Record<string, unknown>;
type RawTombstone = {
  entityType: string;
  entityUid: string;
  deletedAt: string;
};

/** The fallback conversion time for an `exportedAt` of an unexpected shape. */
export const V7_CONVERSION_FALLBACK_NOW = "1970-01-01 00:00:00";

const LOCAL_DATE_TIME =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/;

/** The legacy tombstone entity type in a v7 file. */
const LEGACY_TOMBSTONE_TYPE = "fuel";

export interface V7ConversionDeps {
  /**
   * The converter's uid source. No converted row takes a fresh uid today
   * (collisions are re-minted deterministically); the dependency keeps the
   * source injectable, and it defaults to `newUid`, which guards a missing
   * `globalThis.crypto` (Hermes).
   */
  newUid: () => string;
}

function fail(message: string): never {
  throw new BackupSchemaError(message);
}

function rows(value: unknown, label: string): RawRow[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      fail(`${label}[] must be an object`);
    return item as RawRow;
  });
}

function optionalText(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || typeof value === "string";
}

/** The conversion time (see the file header). */
export function v7ConversionNow(manifest: RawManifest): string {
  const metadata = manifest.metadata;
  const exportedAt =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as RawRow).exportedAt
      : undefined;
  return typeof exportedAt === "string" && LOCAL_DATE_TIME.test(exportedAt)
    ? exportedAt
    : V7_CONVERSION_FALLBACK_NOW;
}

function legacyRow(row: RawRow): LegacyFuelRowInput & { contactUid: unknown } {
  if (
    typeof row.uid !== "string" ||
    row.uid.length === 0 ||
    typeof row.kind !== "string" ||
    typeof row.source !== "string" ||
    typeof row.createdAt !== "string" ||
    typeof row.modifiedAt !== "string" ||
    !optionalText(row.label) ||
    !optionalText(row.text) ||
    !optionalText(row.url)
  )
    fail("the v7 legacy knowledge array has an invalid row");
  return {
    uid: row.uid,
    contactUid: row.contactUid,
    kind: row.kind,
    label: row.label ?? null,
    text: row.text ?? null,
    url: row.url ?? null,
    source: row.source,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  };
}

/**
 * Merge a tombstone into the list, keeping the later `deletedAt` for an
 * existing `(entityType, entityUid)` (the same rule as migration 033's
 * tombstone upsert), so the format-8 duplicate check passes.
 */
function upsertTombstone(
  tombstones: RawTombstone[],
  index: Map<string, RawTombstone>,
  next: RawTombstone,
): void {
  const key = `${next.entityType}\u0000${next.entityUid}`;
  const current = index.get(key);
  if (!current) {
    const copy = { ...next };
    tombstones.push(copy);
    index.set(key, copy);
    return;
  }
  if (next.deletedAt > current.deletedAt) current.deletedAt = next.deletedAt;
}

/** Remove soft-deleted rows and turn each into a tombstone with its own time. */
function purgeSoftDeleted(
  input: RawRow[],
  entityType: "memory" | "relationship",
  label: string,
  tombstones: RawTombstone[],
  index: Map<string, RawTombstone>,
): RawRow[] {
  const kept: RawRow[] = [];
  for (const row of input) {
    const { deletedAt, ...rest } = row;
    if (deletedAt === null || deletedAt === undefined) {
      kept.push(rest);
      continue;
    }
    if (typeof deletedAt !== "string" || typeof row.uid !== "string")
      fail(`${label} has an invalid optional value`);
    upsertTombstone(tombstones, index, {
      entityType,
      entityUid: row.uid,
      deletedAt,
    });
  }
  return kept;
}

function uidsOf(input: RawRow[]): string[] {
  return input
    .map((row) => row.uid)
    .filter((uid): uid is string => typeof uid === "string");
}

/**
 * Convert a format-7 manifest to format 8. Pure: the time comes from the file
 * and no clock or random source is read.
 */
export function convertV7ToV8(
  manifest: RawManifest,
  _deps: V7ConversionDeps = { newUid },
): RawManifest {
  const now = v7ConversionNow(manifest);
  const { fuel: legacyArray, ...rest } = manifest;
  const legacyRows = rows(legacyArray ?? [], "fuel").map(legacyRow);
  const seenLegacy = new Set<string>();
  for (const row of legacyRows) {
    if (seenLegacy.has(row.uid))
      fail("the v7 legacy knowledge array has a duplicate uid");
    seenLegacy.add(row.uid);
  }

  const memoriesIn = rows(manifest.memories, "memories");
  const relationshipsIn = rows(manifest.relationships, "relationships");
  const currentIn = rows(manifest.currentStateEntries, "currentStateEntries");
  const interactionsIn = rows(manifest.interactions, "interactions");

  // Tombstones: the legacy ones are split off; the rest are kept as-is (the
  // format-8 validator still checks their shape).
  const tombstonesIn = Array.isArray(manifest.tombstones)
    ? (manifest.tombstones as unknown[])
    : undefined;
  const legacyTombstones: { entityUid: string; deletedAt: string }[] = [];
  const tombstones: RawTombstone[] = [];
  const passThrough: unknown[] = [];
  const index = new Map<string, RawTombstone>();
  for (const item of tombstonesIn ?? []) {
    const row = item as RawRow | null;
    if (
      row &&
      typeof row === "object" &&
      row.entityType === LEGACY_TOMBSTONE_TYPE
    ) {
      if (
        typeof row.entityUid !== "string" ||
        row.entityUid.length === 0 ||
        typeof row.deletedAt !== "string"
      )
        fail("tombstones has an invalid row");
      legacyTombstones.push({
        entityUid: row.entityUid,
        deletedAt: row.deletedAt,
      });
      continue;
    }
    if (
      row &&
      typeof row === "object" &&
      typeof row.entityType === "string" &&
      typeof row.entityUid === "string" &&
      typeof row.deletedAt === "string"
    ) {
      const copy: RawTombstone = {
        entityType: row.entityType,
        entityUid: row.entityUid,
        deletedAt: row.deletedAt,
      };
      const key = `${copy.entityType}\u0000${copy.entityUid}`;
      if (!index.has(key)) {
        index.set(key, copy);
        tombstones.push(copy);
        continue;
      }
    }
    // Malformed or duplicate: passed through untouched for the validator to
    // reject with its own message.
    passThrough.push(item);
  }

  // Pre-conversion destination uid sets, exactly as migration 033 snapshots
  // them before its purge: each table's rows (soft-deleted memories included)
  // plus that table's existing tombstones of its own entity type
  // (convergence c4, c7). A v7 file has no Off Limits rows.
  const tombstoneUids = (entityType: string) =>
    tombstones
      .filter((row) => row.entityType === entityType)
      .map((row) => row.entityUid);
  const destinationUids: Record<LegacyDestinationTable, string[]> = {
    off_limits: tombstoneUids("off_limits"),
    memories: [...uidsOf(memoriesIn), ...tombstoneUids("memory")],
    current_state_entries: [
      ...uidsOf(currentIn),
      ...tombstoneUids("current_state_entry"),
    ],
  };
  const allocation = allocateLegacyUids({
    legacyRows,
    legacyTombstoneUids: legacyTombstones.map((row) => row.entityUid),
    destinationUids,
  });

  // D-88: soft-deleted memories and key people become tombstones (step 4).
  const memories: RawRow[] = purgeSoftDeleted(
    memoriesIn,
    "memory",
    "memories",
    tombstones,
    index,
  ).map((row) => ({
    ...row,
    // D-86 (step 3): custom -> general, label kept, re-dated like the migration.
    ...(row.type === "custom" ? { type: "general", modifiedAt: now } : {}),
    interactionUid: null,
    linkSource: null,
    groupNoteCopy: 0,
  }));
  const relationships = purgeSoftDeleted(
    relationshipsIn,
    "relationship",
    "relationships",
    tombstones,
    index,
  );

  // Step 5: dated current-state entries without the retired current flag.
  const currentStateEntries: RawRow[] = currentIn.map((row) => {
    const { isCurrent: _isCurrent, ...entry } = row;
    return {
      ...entry,
      entryDate: legacyEntryDate(
        typeof row.createdAt === "string" ? row.createdAt : null,
        typeof row.modifiedAt === "string" ? row.modifiedAt : null,
        now,
      ),
      entryTime: null,
      url: null,
      interactionUid: null,
      linkSource: null,
      groupNoteCopy: 0,
      fromShare: 0,
    };
  });

  const interactions = interactionsIn.map((row) => ({
    ...row,
    noteAiLocked: 0,
  }));

  // Step 1: each legacy row to its D-56 home.
  const offLimits: RawRow[] = [];
  for (const row of legacyRows) {
    const mapped = mapLegacyFuelRow(row, {
      now,
      allocation,
      contentlessRule: "skip",
    });
    if (mapped.home === "none") continue;
    if (mapped.home === "off_limits") {
      offLimits.push({
        uid: mapped.uid,
        contactUid: row.contactUid,
        label: mapped.label,
        text: mapped.text,
        url: mapped.url,
        groupNoteCopy: mapped.groupNoteCopy,
        fromShare: mapped.fromShare,
        createdAt: mapped.createdAt,
        modifiedAt: mapped.modifiedAt,
      });
    } else if (mapped.home === "memory") {
      memories.push({
        uid: mapped.uid,
        contactUid: row.contactUid,
        type: mapped.type,
        customLabel: mapped.customLabel,
        value: mapped.value,
        note: null,
        url: mapped.url,
        meaningfulDate: null,
        pinned: mapped.pinned,
        outdated: 0,
        hidden: mapped.hidden,
        provenance: mapped.provenance,
        allowAi: mapped.allowAi,
        createdAt: mapped.createdAt,
        modifiedAt: mapped.modifiedAt,
        interactionUid: null,
        linkSource: null,
        groupNoteCopy: mapped.groupNoteCopy,
      });
    } else {
      currentStateEntries.push({
        uid: mapped.uid,
        contactUid: row.contactUid,
        fieldKey: mapped.fieldKey,
        value: mapped.value,
        entryDate: mapped.entryDate,
        entryTime: mapped.entryTime,
        url: mapped.url,
        interactionUid: null,
        linkSource: null,
        groupNoteCopy: mapped.groupNoteCopy,
        fromShare: mapped.fromShare,
        createdAt: mapped.createdAt,
        modifiedAt: mapped.modifiedAt,
      });
    }
  }

  // Step 2: each legacy tombstone becomes three, under the allocated uid for
  // a table whose destination already held it (migration 033 step 8).
  for (const legacy of legacyTombstones)
    for (const { entityType, table } of LEGACY_FUEL_TOMBSTONE_TYPES)
      upsertTombstone(tombstones, index, {
        entityType,
        entityUid: allocatedLegacyUid(allocation, table, legacy.entityUid),
        deletedAt: legacy.deletedAt,
      });

  const settings = manifest.appSettings;
  const appSettings =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? {
          ...(settings as RawRow),
          aiDefaultGiftIdeaAllow:
            (settings as RawRow).aiDefaultGiftIdeaAllow ?? 0,
          aiDefaultThoughtOfThemAllow:
            (settings as RawRow).aiDefaultThoughtOfThemAllow ?? 0,
        }
      : settings;

  return {
    ...rest,
    backupFormatVersion: 8,
    appSettings,
    interactions:
      manifest.interactions === undefined
        ? manifest.interactions
        : interactions,
    memories,
    relationships,
    currentStateEntries,
    offLimits,
    tombstones:
      tombstonesIn === undefined
        ? manifest.tombstones
        : [...tombstones, ...passThrough],
  };
}
