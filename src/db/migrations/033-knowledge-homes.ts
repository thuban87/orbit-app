/**
 * Migration 033 — knowledge homes (Phase 38.10).
 *
 * Head+1 VERIFIED on disk at author time (2026-10-13): migration 032 is the
 * latest registered step and `TARGET_VERSION` was 32.
 *
 * One forward-only, irreversible step, run inside the runner's per-step
 * transaction with foreign keys ON:
 *
 * Schema
 *   1. `off_limits` table: no AI column and no content CHECK (D-09, D-36;
 *      RESEARCH 1.3). `group_note_copy` (D-102) and `from_share` (D-108) are
 *      origin markers, not AI columns.
 *   2. `memories` gains `interaction_id` (FK SET NULL), `link_source` and
 *      `group_note_copy`, plus a partial unique link index (D-37, D-95, D-96,
 *      D-102). The link CHECK is one-directional on purpose: a both-or-neither
 *      CHECK would fail every interaction delete, because ON DELETE SET NULL
 *      nulls only `interaction_id` (checker W19).
 *   2b. `interactions.note_ai_locked` (D-103).
 *   3. Two `app_settings` AI defaults, off on upgrade and fresh install (D-61,
 *      D-92).
 *   4. D-88: soft-deleted memories and key people are tombstoned with their
 *      own `deleted_at`, then deleted.
 *   5. D-86: custom memories become general; the label is kept.
 *   6. `current_state_entries` is rebuilt without `is_current`, with
 *      `entry_date NOT NULL`, `entry_time`, `url`, links and both markers
 *      (D-41, D-45, D-48, D-37, D-102, D-108).
 *
 * Data
 *   7. Every fuel row is copied by kind to its D-56 home with Allow AI off,
 *      keeping its uid and timestamps; a collided uid is re-minted by the
 *      collision-complete allocation (F-D5; convergence c3/c4/c7); contentless
 *      non-off_limits rows are skipped and counted (D-97). Every copy is
 *      re-read and proven before any source row is deleted.
 *   8. Fuel tombstones become memory, off_limits and current_state_entry
 *      tombstones (Research Q3, triple conversion), under the allocated uid
 *      where the destination already held that uid.
 *   9. DROP TABLE fuel (D-54, owner-accepted one-way door).
 *  10. Scoped post-checks.
 *
 * The migration never throws on legitimate-but-odd data. It throws only when a
 * copy proof or post-check fails, and the runner then rolls the whole step
 * back (a rejected migration bricks the app, App.tsx:381-397).
 *
 * Runbook Pitfall 9: this file never imports `legacy-fuel-mapping.ts`. The
 * kind map, value rules and uid allocator below are frozen literal copies,
 * pinned equal to that module by `legacy-fuel-mapping.test.ts`.
 *
 * No legacy-repair step (D-60). `data_revision` is not bumped (017 precedent).
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const KNOWLEDGE_HOMES_SCHEMA_VERSION = 33;

export const MIGRATION033_INTEGRITY_CODE = "migration-033-integrity-failure";

/** A recognizable failure for a copy or post-check that cannot be proved. */
export class Migration033IntegrityError extends Error {
  readonly code = MIGRATION033_INTEGRITY_CODE;

  constructor(reason: string) {
    super(`Migration 033 integrity failure: ${reason}`);
    this.name = "Migration033IntegrityError";
  }
}

export function isMigration033IntegrityError(
  error: unknown,
): error is Migration033IntegrityError {
  return (
    error instanceof Migration033IntegrityError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === MIGRATION033_INTEGRITY_CODE)
  );
}

function fail(reason: string): never {
  throw new Migration033IntegrityError(reason);
}

// --- Frozen literals (pinned by legacy-fuel-mapping.test.ts) -----------------

type DestinationTable = "off_limits" | "memories" | "current_state_entries";

/** Frozen D-56 kind -> home map. An unknown kind lands as a general memory. */
export const MIGRATION033_KIND_HOMES = {
  off_limits: { table: "off_limits" },
  gift: { table: "memories", memoryType: "gift_idea" },
  topic: { table: "memories", memoryType: "thought_of_them" },
  fact: { table: "memories", memoryType: "general" },
  recent: { table: "current_state_entries", fieldKey: "last_talked_about" },
} as const;

export const MIGRATION033_UNKNOWN_KIND_MEMORY_TYPE = "general";

/** Frozen triple tombstone conversion: entity type -> destination table. */
export const MIGRATION033_TOMBSTONE_TYPES = [
  { entityType: "memory", table: "memories" },
  { entityType: "off_limits", table: "off_limits" },
  { entityType: "current_state_entry", table: "current_state_entries" },
] as const;

const DESTINATION_TABLES: readonly DestinationTable[] = [
  "off_limits",
  "memories",
  "current_state_entries",
];

/** The SQL GLOB for a `YYYY-MM-DD` date prefix (the step 6 / 7 date rule). */
const DATE_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]";

// --- Schema statements -------------------------------------------------------

export const CREATE_OFF_LIMITS = `
CREATE TABLE off_limits (
  id              INTEGER PRIMARY KEY,
  uid             TEXT NOT NULL UNIQUE,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  label           TEXT,
  text            TEXT,
  url             TEXT,
  group_note_copy INTEGER NOT NULL DEFAULT 0 CHECK (group_note_copy IN (0,1)),
  from_share      INTEGER NOT NULL DEFAULT 0 CHECK (from_share IN (0,1)),
  created_at      TEXT NOT NULL,
  modified_at     TEXT NOT NULL
);
CREATE INDEX idx_off_limits_contact ON off_limits(contact_id, created_at);`;

export const ALTER_MEMORIES_LINKS = `
ALTER TABLE memories
  ADD COLUMN interaction_id INTEGER REFERENCES interactions(id) ON DELETE SET NULL;
ALTER TABLE memories
  ADD COLUMN link_source TEXT
    CHECK (link_source IS NULL OR link_source IN ('note','group_note'))
    CHECK (interaction_id IS NULL OR link_source IS NOT NULL);
ALTER TABLE memories
  ADD COLUMN group_note_copy INTEGER NOT NULL DEFAULT 0
    CHECK (group_note_copy IN (0,1))
    CHECK (group_note_copy = 0 OR allow_ai = 0);
CREATE UNIQUE INDEX idx_memories_interaction_link
  ON memories(interaction_id, link_source)
  WHERE interaction_id IS NOT NULL;`;

export const ALTER_INTERACTIONS_NOTE_LOCK = `
ALTER TABLE interactions
  ADD COLUMN note_ai_locked INTEGER NOT NULL DEFAULT 0
    CHECK (note_ai_locked IN (0,1))
    CHECK (note_ai_locked = 0 OR allow_ai = 0);`;

export const ALTER_APP_SETTINGS_AI_DEFAULTS = `
ALTER TABLE app_settings
  ADD COLUMN ai_default_gift_idea_allow INTEGER NOT NULL DEFAULT 0
    CHECK(ai_default_gift_idea_allow IN (0,1));
ALTER TABLE app_settings
  ADD COLUMN ai_default_thought_of_them_allow INTEGER NOT NULL DEFAULT 0
    CHECK(ai_default_thought_of_them_allow IN (0,1));`;

export const CREATE_CURRENT_STATE_ENTRIES_V33 = `
CREATE TABLE current_state_entries_new (
  id              INTEGER PRIMARY KEY,
  uid             TEXT UNIQUE NOT NULL,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_key       TEXT NOT NULL,
  value           TEXT NOT NULL,
  entry_date      TEXT NOT NULL,
  entry_time      TEXT,
  url             TEXT,
  interaction_id  INTEGER REFERENCES interactions(id) ON DELETE SET NULL,
  link_source     TEXT,
  group_note_copy INTEGER NOT NULL DEFAULT 0 CHECK (group_note_copy IN (0,1)),
  from_share      INTEGER NOT NULL DEFAULT 0 CHECK (from_share IN (0,1)),
  created_at      TEXT NOT NULL,
  modified_at     TEXT NOT NULL,
  CHECK (link_source IS NULL OR link_source IN ('note','group_note')),
  CHECK (interaction_id IS NULL OR link_source IS NOT NULL)
);`;

export const CREATE_CURRENT_STATE_V33_INDEXES = `
CREATE INDEX idx_current_state_order
  ON current_state_entries(contact_id, field_key, entry_date, created_at);
CREATE UNIQUE INDEX idx_current_state_interaction_link
  ON current_state_entries(interaction_id, link_source)
  WHERE interaction_id IS NOT NULL;`;

// --- Result ------------------------------------------------------------------

/** What one run did; `migration033.apply` discards it, tests read it. */
export interface Migration033Result {
  purged: { memories: number; relationships: number };
  customConverted: number;
  currentStateRebuilt: number;
  copied: { offLimits: number; memories: number; currentState: number };
  /** D-97: contentless non-off_limits rows, skipped and deleted. */
  skippedContentless: number;
  /** Re-minted uids per destination table: original uid -> final uid. */
  reminted: Record<DestinationTable, Record<string, string>>;
  legacyTombstonesConverted: number;
}

// --- Helpers -----------------------------------------------------------------

interface LegacyRow {
  id: number;
  uid: string;
  contact_id: number;
  kind: string;
  label: string | null;
  text: string | null;
  url: string | null;
  created_at: string;
  source: string;
  modified_at: string;
}

function blank(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

/** Frozen first-non-blank rule: the first non-blank candidate, as stored. */
function firstNonBlankFrozen(...candidates: (string | null)[]): string | null {
  for (const candidate of candidates) {
    if (!blank(candidate)) return candidate;
  }
  return null;
}

/**
 * Frozen Last Talked About value for a legacy `recent` row (D-56 as amended by
 * D-128): "<label>: <text>" with both parts trimmed when both are non-blank,
 * else the first non-blank of (text, label, url) as stored.
 */
function lastTalkedAboutValueFrozen(row: {
  label: string | null;
  text: string | null;
  url: string | null;
}): string | null {
  const { label, text } = row;
  if (label !== null && text !== null && !blank(label) && !blank(text)) {
    return `${label.trim()}: ${text.trim()}`;
  }
  return firstNonBlankFrozen(row.text, row.label, row.url);
}

function datePrefixFrozen(value: string): string | null {
  const prefix = value.slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(prefix) ? prefix : null;
}

/** Frozen entry-date rule; identical to the step 6 SQL CASE. */
function entryDateFrozen(
  createdAt: string,
  modifiedAt: string,
  now: string,
): string {
  return (
    datePrefixFrozen(createdAt) ??
    datePrefixFrozen(modifiedAt) ??
    now.slice(0, 10)
  );
}

function homeOf(row: LegacyRow): DestinationTable | null {
  const known = Object.hasOwn(
    MIGRATION033_KIND_HOMES,
    row.kind,
  )
    ? MIGRATION033_KIND_HOMES[row.kind as keyof typeof MIGRATION033_KIND_HOMES]
    : undefined;
  const table: DestinationTable = known?.table ?? "memories";
  const contentless = blank(row.text) && blank(row.label) && blank(row.url);
  if (table !== "off_limits" && contentless) return null;
  return table;
}

function memoryTypeOf(row: LegacyRow): string {
  const known = Object.hasOwn(
    MIGRATION033_KIND_HOMES,
    row.kind,
  )
    ? MIGRATION033_KIND_HOMES[row.kind as keyof typeof MIGRATION033_KIND_HOMES]
    : undefined;
  return known !== undefined && known.table === "memories"
    ? known.memoryType
    : MIGRATION033_UNKNOWN_KIND_MEMORY_TYPE;
}

/** Frozen copy of `allocateLegacyUids` (collision-complete re-mint). */
function allocateFrozen(
  rows: readonly LegacyRow[],
  tombstoneUids: readonly string[],
  preCopy: Record<DestinationTable, Set<string>>,
): Record<DestinationTable, Map<string, string>> {
  const result = {} as Record<DestinationTable, Map<string, string>>;
  for (const table of DESTINATION_TABLES) {
    const legacy = new Set<string>();
    for (const row of rows) {
      if (homeOf(row) === table) legacy.add(row.uid);
    }
    for (const uid of tombstoneUids) legacy.add(uid);

    const collided: string[] = [];
    const reserved = new Set(preCopy[table]);
    for (const uid of legacy) {
      if (preCopy[table].has(uid)) collided.push(uid);
      else reserved.add(uid);
    }
    collided.sort();

    const allocated = new Map<string, string>();
    for (const uid of collided) {
      let attempt = 1;
      let candidate = `legacy-${table}-${uid}`;
      while (reserved.has(candidate)) {
        attempt += 1;
        candidate = `legacy-${table}-${uid}-${attempt}`;
      }
      reserved.add(candidate);
      allocated.set(uid, candidate);
    }
    result[table] = allocated;
  }
  return result;
}

async function uidSet(
  exec: SqlExecutor,
  sql: string,
  params: unknown[] = [],
): Promise<Set<string>> {
  const rows = await exec.getAllAsync<{ uid: string }>(sql, params);
  return new Set(rows.map((row) => row.uid));
}

async function count(exec: SqlExecutor, sql: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(sql);
  return row?.n ?? 0;
}

const UPSERT_TOMBSTONE = `INSERT INTO tombstones (entity_type, entity_uid, deleted_at)
  VALUES (?, ?, ?)
  ON CONFLICT(entity_type, entity_uid) DO UPDATE SET
    deleted_at = CASE
      WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_at
      ELSE tombstones.deleted_at
    END`;

function assertReadable(row: LegacyRow): void {
  const optionalText = (value: unknown) =>
    value === null || typeof value === "string";
  if (
    !Number.isInteger(row.id) ||
    typeof row.uid !== "string" ||
    !Number.isInteger(row.contact_id) ||
    typeof row.kind !== "string" ||
    typeof row.source !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.modified_at !== "string" ||
    !optionalText(row.label) ||
    !optionalText(row.text) ||
    !optionalText(row.url)
  ) {
    fail(`unreadable legacy row ${String(row.uid)}`);
  }
}

// --- Apply -------------------------------------------------------------------

/**
 * Run every step of migration 033 against an already-open transaction and
 * report what it did. `migration033.apply` is the registered entry point.
 */
export async function applyMigration033(
  exec: SqlExecutor,
  deps: MigrationDeps,
): Promise<Migration033Result> {
  const nowDate = deps.now.slice(0, 10);

  // Pre-copy uid snapshot, taken before step 4's purge (convergence c4) and
  // including each destination's own tombstones (convergence c7).
  const preCopy: Record<DestinationTable, Set<string>> = {
    off_limits: await uidSet(
      exec,
      "SELECT entity_uid AS uid FROM tombstones WHERE entity_type = 'off_limits'",
    ),
    memories: await uidSet(
      exec,
      `SELECT uid FROM memories
       UNION SELECT entity_uid AS uid FROM tombstones WHERE entity_type = 'memory'`,
    ),
    current_state_entries: await uidSet(
      exec,
      `SELECT uid FROM current_state_entries
       UNION SELECT entity_uid AS uid FROM tombstones
             WHERE entity_type = 'current_state_entry'`,
    ),
  };

  // 1. Off Limits.
  await exec.execAsync(CREATE_OFF_LIMITS);

  // 2. Memory links and the Group Note copy marker.
  await exec.execAsync(ALTER_MEMORIES_LINKS);

  // 2b. Interaction note lock.
  await exec.execAsync(ALTER_INTERACTIONS_NOTE_LOCK);

  // 3. The two new AI defaults.
  await exec.execAsync(ALTER_APP_SETTINGS_AI_DEFAULTS);

  // 4. D-88 purge of soft-deleted memories and key people.
  const purged = { memories: 0, relationships: 0 };
  for (const [table, entityType, key] of [
    ["memories", "memory", "memories"],
    ["relationships", "relationship", "relationships"],
  ] as const) {
    const rows = await exec.getAllAsync<{
      id: number;
      uid: string;
      deleted_at: string;
    }>(
      `SELECT id, uid, deleted_at FROM ${table}
       WHERE deleted_at IS NOT NULL ORDER BY id`,
    );
    for (const row of rows) {
      await exec.runAsync(UPSERT_TOMBSTONE, [
        entityType,
        row.uid,
        row.deleted_at,
      ]);
      const deleted = await exec.runAsync(`DELETE FROM ${table} WHERE id = ?`, [
        row.id,
      ]);
      if (deleted.changes !== 1) {
        fail(`soft-deleted ${entityType} ${row.uid} vanished before purge`);
      }
    }
    purged[key] = rows.length;
  }

  // 5. D-86: custom memories become general, label kept.
  const custom = await exec.runAsync(
    "UPDATE memories SET type = 'general', modified_at = ? WHERE type = 'custom'",
    [deps.now],
  );

  // 6. Rebuild current_state_entries (SQLite-documented new-table order).
  const currentStateBefore = await count(
    exec,
    "SELECT COUNT(*) AS n FROM current_state_entries",
  );
  await exec.execAsync(CREATE_CURRENT_STATE_ENTRIES_V33);
  await exec.runAsync(
    `INSERT INTO current_state_entries_new (
       id, uid, contact_id, field_key, value,
       entry_date, entry_time, url, interaction_id, link_source,
       group_note_copy, from_share, created_at, modified_at
     )
     SELECT id, uid, contact_id, field_key, value,
            CASE
              WHEN substr(created_at, 1, 10) GLOB ? THEN substr(created_at, 1, 10)
              WHEN substr(modified_at, 1, 10) GLOB ? THEN substr(modified_at, 1, 10)
              ELSE ?
            END,
            NULL, NULL, NULL, NULL,
            0, 0, created_at, modified_at
       FROM current_state_entries`,
    [DATE_GLOB, DATE_GLOB, nowDate],
  );
  const currentStateMatched = await count(
    exec,
    `SELECT COUNT(*) AS n
       FROM current_state_entries o
       JOIN current_state_entries_new n
         ON n.id = o.id AND n.uid = o.uid AND n.contact_id = o.contact_id
        AND n.field_key = o.field_key AND n.value = o.value
        AND n.created_at = o.created_at AND n.modified_at = o.modified_at`,
  );
  const currentStateAfter = await count(
    exec,
    "SELECT COUNT(*) AS n FROM current_state_entries_new",
  );
  if (
    currentStateAfter !== currentStateBefore ||
    currentStateMatched !== currentStateBefore
  ) {
    fail(
      `current_state_entries rebuild copied ${currentStateMatched}/${currentStateAfter} of ${currentStateBefore} rows`,
    );
  }
  await exec.execAsync("DROP TABLE current_state_entries");
  await exec.execAsync(
    "ALTER TABLE current_state_entries_new RENAME TO current_state_entries",
  );
  await exec.execAsync(CREATE_CURRENT_STATE_V33_INDEXES);

  // 7. Copy every legacy row to its D-56 home, prove, then delete the source.
  const rows = await exec.getAllAsync<LegacyRow>(
    `SELECT id, uid, contact_id, kind, label, text, url, created_at, source, modified_at
       FROM fuel ORDER BY id`,
  );
  for (const row of rows) assertReadable(row);
  const legacyTombstones = await exec.getAllAsync<{
    entity_uid: string;
    deleted_at: string;
  }>(
    `SELECT entity_uid, deleted_at FROM tombstones
      WHERE entity_type = 'fuel' ORDER BY entity_uid`,
  );
  const allocation = allocateFrozen(
    rows,
    legacyTombstones.map((t) => t.entity_uid),
    preCopy,
  );
  const finalUid = (table: DestinationTable, uid: string) =>
    allocation[table].get(uid) ?? uid;

  const copied = { offLimits: 0, memories: 0, currentState: 0 };
  let skippedContentless = 0;
  const proofs: (() => Promise<void>)[] = [];

  for (const row of rows) {
    const home = homeOf(row);
    if (home === null) {
      skippedContentless += 1;
      continue;
    }
    const uid = finalUid(home, row.uid);
    const fromShare = row.source === "share" ? 1 : 0;

    if (home === "off_limits") {
      await exec.runAsync(
        `INSERT INTO off_limits (
           uid, contact_id, label, text, url, group_note_copy, from_share,
           created_at, modified_at
         ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [
          uid,
          row.contact_id,
          row.label,
          row.text,
          row.url,
          fromShare,
          row.created_at,
          row.modified_at,
        ],
      );
      copied.offLimits += 1;
      proofs.push(async () => {
        const got = await exec.getFirstAsync<Record<string, unknown>>(
          `SELECT contact_id, label, text, url, group_note_copy, from_share,
                  created_at, modified_at
             FROM off_limits WHERE uid = ?`,
          [uid],
        );
        if (
          !got ||
          got.contact_id !== row.contact_id ||
          got.label !== row.label ||
          got.text !== row.text ||
          got.url !== row.url ||
          got.group_note_copy !== 0 ||
          got.from_share !== fromShare ||
          got.created_at !== row.created_at ||
          got.modified_at !== row.modified_at
        ) {
          fail(`post-copy proof failed for legacy off_limits row ${row.uid}`);
        }
      });
      continue;
    }

    if (home === "current_state_entries") {
      const value = lastTalkedAboutValueFrozen(row);
      const entryDate = entryDateFrozen(
        row.created_at,
        row.modified_at,
        deps.now,
      );
      await exec.runAsync(
        `INSERT INTO current_state_entries (
           uid, contact_id, field_key, value, entry_date, entry_time, url,
           interaction_id, link_source, group_note_copy, from_share,
           created_at, modified_at
         ) VALUES (?, ?, 'last_talked_about', ?, ?, NULL, ?, NULL, NULL, 0, ?, ?, ?)`,
        [
          uid,
          row.contact_id,
          value,
          entryDate,
          row.url,
          fromShare,
          row.created_at,
          row.modified_at,
        ],
      );
      copied.currentState += 1;
      proofs.push(async () => {
        const got = await exec.getFirstAsync<Record<string, unknown>>(
          `SELECT contact_id, field_key, value, entry_date, entry_time, url,
                  interaction_id, link_source, group_note_copy, from_share,
                  created_at, modified_at
             FROM current_state_entries WHERE uid = ?`,
          [uid],
        );
        if (
          !got ||
          got.contact_id !== row.contact_id ||
          got.field_key !== "last_talked_about" ||
          got.value !== value ||
          got.entry_date !== entryDate ||
          got.entry_time !== null ||
          got.url !== row.url ||
          got.interaction_id !== null ||
          got.link_source !== null ||
          got.group_note_copy !== 0 ||
          got.from_share !== fromShare ||
          got.created_at !== row.created_at ||
          got.modified_at !== row.modified_at
        ) {
          fail(`post-copy proof failed for legacy recent row ${row.uid}`);
        }
      });
      continue;
    }

    const type = memoryTypeOf(row);
    const value = firstNonBlankFrozen(row.text, row.url);
    const customLabel = blank(row.label) ? null : row.label;
    const provenance = row.source === "share" ? "share" : "user";
    await exec.runAsync(
      `INSERT INTO memories (
         uid, contact_id, type, custom_label, value, note, url, meaningful_date,
         pinned, outdated, hidden, provenance, created_at, modified_at,
         deleted_at, allow_ai, interaction_id, link_source, group_note_copy
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, 0, 0, NULL, ?, ?, ?, NULL, 0, NULL, NULL, 0)`,
      [
        uid,
        row.contact_id,
        type,
        customLabel,
        value,
        row.url,
        provenance,
        row.created_at,
        row.modified_at,
      ],
    );
    copied.memories += 1;
    proofs.push(async () => {
      const got = await exec.getFirstAsync<Record<string, unknown>>(
        `SELECT contact_id, type, custom_label, value, note, url,
                meaningful_date, pinned, outdated, hidden, provenance,
                created_at, modified_at, deleted_at, allow_ai,
                interaction_id, link_source, group_note_copy
           FROM memories WHERE uid = ?`,
        [uid],
      );
      if (
        !got ||
        got.contact_id !== row.contact_id ||
        got.type !== type ||
        got.custom_label !== customLabel ||
        got.value !== value ||
        got.note !== null ||
        got.url !== row.url ||
        got.meaningful_date !== null ||
        got.pinned !== 0 ||
        got.outdated !== 0 ||
        got.hidden !== null ||
        got.provenance !== provenance ||
        got.created_at !== row.created_at ||
        got.modified_at !== row.modified_at ||
        got.deleted_at !== null ||
        got.allow_ai !== 0 ||
        got.interaction_id !== null ||
        got.link_source !== null ||
        got.group_note_copy !== 0
      ) {
        fail(`post-copy proof failed for legacy ${row.kind} row ${row.uid}`);
      }
    });
  }

  if (
    copied.offLimits + copied.memories + copied.currentState +
      skippedContentless !==
      rows.length ||
    proofs.length !== rows.length - skippedContentless
  ) {
    fail("legacy-row mapping is incomplete");
  }
  for (const prove of proofs) await prove();

  for (const row of rows) {
    const deleted = await exec.runAsync("DELETE FROM fuel WHERE id = ?", [
      row.id,
    ]);
    if (deleted.changes !== 1) {
      fail(`copied legacy row disappeared before deletion: ${row.uid}`);
    }
  }
  if ((await count(exec, "SELECT COUNT(*) AS n FROM fuel")) !== 0) {
    fail("legacy rows remain after copy-and-remove");
  }

  // 8. Triple tombstone conversion, under the allocated uid per table.
  for (const tombstone of legacyTombstones) {
    for (const { entityType, table } of MIGRATION033_TOMBSTONE_TYPES) {
      await exec.runAsync(UPSERT_TOMBSTONE, [
        entityType,
        finalUid(table, tombstone.entity_uid),
        tombstone.deleted_at,
      ]);
    }
  }
  const removedTombstones = await exec.runAsync(
    "DELETE FROM tombstones WHERE entity_type = 'fuel'",
  );
  if (removedTombstones.changes !== legacyTombstones.length) {
    fail("legacy tombstone set changed during conversion");
  }

  // 9. One-way door (D-54).
  await exec.execAsync("DROP TABLE fuel");

  // 10. Post-checks. foreign_key_check is scoped to the three tables this
  // migration writes; an unscoped check would let an unrelated pre-existing
  // violation reject the migration and brick the app (checker W19).
  for (const table of DESTINATION_TABLES) {
    const violations = await exec.getAllAsync(
      `PRAGMA foreign_key_check(${table})`,
    );
    if (violations.length !== 0) {
      fail(`foreign-key check failed for ${table}`);
    }
  }
  if (
    (await count(
      exec,
      "SELECT COUNT(*) AS n FROM pragma_table_info('current_state_entries') WHERE name = 'is_current'",
    )) !== 0
  ) {
    fail("current_state_entries still has is_current");
  }
  if (
    (await count(
      exec,
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'fuel'",
    )) !== 0
  ) {
    fail("the legacy table still exists");
  }

  const reminted = {} as Record<DestinationTable, Record<string, string>>;
  for (const table of DESTINATION_TABLES) {
    reminted[table] = Object.fromEntries(allocation[table]);
  }
  return {
    purged,
    customConverted: custom.changes,
    currentStateRebuilt: currentStateBefore,
    copied,
    skippedContentless,
    reminted,
    legacyTombstonesConverted: legacyTombstones.length,
  };
}

export const migration033: Migration = {
  version: KNOWLEDGE_HOMES_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void> {
    await applyMigration033(exec, deps);
  },
};
