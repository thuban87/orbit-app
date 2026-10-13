/**
 * Purge fan-out DAO (CRUD-06) — the irreversible whole-contact delete, the
 * second and unrecoverable stage of the archive→purge lifecycle.
 *
 * There is NO server and NO backup: a purge cannot be undone remotely, so the
 * safeguards live entirely at the write boundary here plus the impact-summary
 * confirm the Archived list shows before calling in.
 *
 * =============================================================================
 * WRITE-BOUNDARY GUARD — READ BEFORE EDITING (review T-04-12):
 *   `purgeContact` verifies `archived_at IS NOT NULL` INSIDE its transaction and
 *   asserts EXACTLY ONE contacts row deleted. A live (non-archived) contact
 *   therefore cannot be purged even by a caller that reaches this DAO directly —
 *   the two-stage safety is structural, not merely UI routing.
 *
 *   The transaction body lives in `purgeContactCore` so another aggregate can
 *   run the same purge inside its own transaction. The core keeps the archive
 *   gate on by default. Exactly one caller may turn the archive gate off: the
 *   share Undo that removes a contact the share itself just created
 *   (`undoCreateContactAndShare` in capture-dao, D-100), which runs its own
 *   ownership guard first (D-109, D-110). That narrow exception is owner
 *   ruling D-106 and amends ADR-018; every other purge stays archive-first.
 *
 * EXPLICIT FAN-OUT, NOT FK CASCADE (review T-04-13):
 *   Every owned child is deleted EXPLICITLY in ONE `inWriteTransaction`:
 *   interactions, events, off_limits, custom_field_values, contact_links,
 *   memories, relationships, current_state_entries, `field_history`, then the
 *   contacts row.
 *   `field_history` has NO FK to
 *   `contacts` and never cascades — it MUST be deleted here or its rows would
 *   outlive the contact. The FK CASCADEs on the other children are live but we
 *   do not rely on them: explicit deletes keep the blast radius auditable and
 *   matched to `computeImpact`'s explicit COUNTs.
 *
 * POST-COMMIT EXTENSION HOOK — NEVER AWAITED INSIDE THE TRANSACTION (T-04-16):
 *   Non-DB cleanup (photo-file `unlink`, `expo-notifications` cancels) is a
 *   non-transactional OS side effect. Awaiting it inside the open `BEGIN` would
 *   hold the shared write mutex on an OS call and could not be rolled back. It
 *   therefore runs AFTER the transaction commits, as idempotent best-effort in
 *   its own try/catch — a throwing adapter is logged, never fatal, and never
 *   undoes the already-committed deletes. Phases 5 (photo) and 11 (notifications)
 *   register the adapter; Phase 4 passes none.
 *
 * SECURITY (T-04-02): every value is `?`-bound; no identifier is interpolated —
 * each table name is a literal in a constant SQL string.
 *
 * REVISION BUMPS (PLAN-MAP §5): one purge advances `data_revision` by exactly
 *   one. `purgeContactCore` forwards its `bumpRevision` option to every
 *   tombstone write; `purgeContact` passes false and bumps once itself.
 *
 * Node-pure control flow: takes `exec: SqlExecutor` as its first argument and
 * imports the shared `inWriteTransaction` — never expo `withTransactionAsync`.
 */

import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  SAFE_RELATIVE,
} from "@/db/photo-relative-path";
import { enqueueDeleteIntentCore } from "@/db/restore-photo-journal-dao";
import {
  insertTombstoneCore,
  type TombstoneEntityType,
} from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";
import { plural } from "@/utils/plural";

const LOG_SCOPE = "purge-dao";

/**
 * The blast radius of a purge. The multi-row children carry a COUNT; the
 * normalized `custom_field_values` child is a BOOLEAN. Migration 006 creates one
 * durable row per contact-and-definition pair, so a count would tell a user with
 * all-blank fields that purge destroys N custom values. `events` is now a genuine blast-radius
 * child: the Phase-6 events writer (events-dao) landed, so archive/restore emit
 * immutable events and `impactSummaryLines` surfaces the events count.
 */
export interface PurgeImpact {
  interactions: number;
  events: number;
  links: number;
  methods: number;
  externalLinks: number;
  methodProvenance: number;
  memories: number;
  relationships: number;
  currentStateEntries: number;
  hasCustomValues: boolean;
}

interface PurgeChildSpec {
  countSql: string;
  tombstoneSql: string;
  deleteSql: string;
}

/** Every tombstone type is deliberately given a purge disposition here. */
export const PURGE_CHILDREN: Record<
  TombstoneEntityType,
  PurgeChildSpec | null
> = {
  contact: null,
  interaction: {
    countSql: "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM interactions WHERE contact_id = ?",
    deleteSql: "DELETE FROM interactions WHERE contact_id = ?",
  },
  event: {
    countSql: "SELECT COUNT(*) AS n FROM events WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM events WHERE contact_id = ?",
    deleteSql: "DELETE FROM events WHERE contact_id = ?",
  },
  off_limits: {
    countSql: "SELECT COUNT(*) AS n FROM off_limits WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM off_limits WHERE contact_id = ?",
    deleteSql: "DELETE FROM off_limits WHERE contact_id = ?",
  },
  custom_field_value: {
    countSql:
      "SELECT COUNT(*) AS n FROM custom_field_values WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM custom_field_values WHERE contact_id = ?",
    deleteSql: "DELETE FROM custom_field_values WHERE contact_id = ?",
  },
  custom_field_value_history: {
    countSql:
      "SELECT COUNT(*) AS n FROM custom_field_value_history WHERE contact_id = ?",
    tombstoneSql:
      "SELECT uid FROM custom_field_value_history WHERE contact_id = ?",
    deleteSql: "DELETE FROM custom_field_value_history WHERE contact_id = ?",
  },
  contact_link: {
    countSql: "SELECT COUNT(*) AS n FROM contact_links WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM contact_links WHERE contact_id = ?",
    deleteSql: "DELETE FROM contact_links WHERE contact_id = ?",
  },
  contact_method: {
    countSql: "SELECT COUNT(*) AS n FROM contact_methods WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM contact_methods WHERE contact_id = ?",
    deleteSql: "DELETE FROM contact_methods WHERE contact_id = ?",
  },
  external_contact_link: {
    countSql:
      "SELECT COUNT(*) AS n FROM external_contact_links WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM external_contact_links WHERE contact_id = ?",
    deleteSql: "DELETE FROM external_contact_links WHERE contact_id = ?",
  },
  contact_method_provenance: {
    countSql:
      "SELECT COUNT(*) AS n FROM contact_method_provenance p JOIN contact_methods m ON m.id = p.method_id WHERE m.contact_id = ?",
    tombstoneSql:
      "SELECT p.uid FROM contact_method_provenance p JOIN contact_methods m ON m.id = p.method_id WHERE m.contact_id = ?",
    deleteSql:
      "DELETE FROM contact_method_provenance WHERE method_id IN (SELECT id FROM contact_methods WHERE contact_id = ?)",
  },
  custom_field_def: null,
  memory: {
    // Live rows only (D-88): a soft-deleted row is already gone from the
    // user's view, so it is not part of the blast radius the dialog shows.
    countSql:
      "SELECT COUNT(*) AS n FROM memories WHERE contact_id = ? AND deleted_at IS NULL",
    tombstoneSql: "SELECT uid FROM memories WHERE contact_id = ?",
    deleteSql: "DELETE FROM memories WHERE contact_id = ?",
  },
  relationship: {
    countSql:
      "SELECT COUNT(*) AS n FROM relationships WHERE contact_id = ? AND deleted_at IS NULL",
    tombstoneSql: "SELECT uid FROM relationships WHERE contact_id = ?",
    deleteSql: "DELETE FROM relationships WHERE contact_id = ?",
  },
  current_state_entry: {
    countSql:
      "SELECT COUNT(*) AS n FROM current_state_entries WHERE contact_id = ?",
    tombstoneSql: "SELECT uid FROM current_state_entries WHERE contact_id = ?",
    deleteSql: "DELETE FROM current_state_entries WHERE contact_id = ?",
  },
  // Group Events are not contact-scoped purge children.
  group_event: null,
  // Categories have their own aggregate deletion path and are never contact purge children.
  category: null,
};

const KNOWLEDGE_CHILD_TABLES = {
  memory: "memories",
  relationship: "relationships",
  current_state_entry: "current_state_entries",
  custom_field_value_history: "custom_field_value_history",
  // off_limits exists only from migration 033; probed like the other
  // knowledge children so a purge on an older schema still works (checker B1).
  off_limits: "off_limits",
} as const;

type KnowledgeChildEntityType = keyof typeof KNOWLEDGE_CHILD_TABLES;

async function availableKnowledgeChildren(
  exec: SqlExecutor,
): Promise<ReadonlySet<KnowledgeChildEntityType>> {
  const rows = await exec.getAllAsync<{ name: string }>(
    `SELECT name
       FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('memories', 'relationships', 'current_state_entries', 'custom_field_value_history', 'off_limits')`,
  );
  const names = new Set(rows.map((row) => row.name));
  return new Set(
    (
      Object.entries(KNOWLEDGE_CHILD_TABLES) as Array<
        [KnowledgeChildEntityType, string]
      >
    )
      .filter(([, table]) => names.has(table))
      .map(([entityType]) => entityType),
  );
}

function isAvailablePurgeChild(
  entityType: TombstoneEntityType,
  knowledgeChildren: ReadonlySet<KnowledgeChildEntityType>,
): boolean {
  return (
    !(entityType in KNOWLEDGE_CHILD_TABLES) ||
    knowledgeChildren.has(entityType as KnowledgeChildEntityType)
  );
}

/** What the purge retired that needs non-DB cleanup after COMMIT. */
export interface PurgeRetired {
  importStagingPaths: string[];
}

/**
 * Idempotent best-effort OS cleanup (photo unlink, notification cancels), run
 * POST-COMMIT in its own try/catch — never awaited inside the transaction.
 */
export type PurgeExtensions = (
  contactId: number,
  retired: PurgeRetired,
) => Promise<void> | void;

/** Required purge timing plus optional post-commit cleanup registered by Phases 5/11. */
export interface PurgeOptions {
  /** Caller-supplied local wall-clock timestamp for the merge-visible sun update. */
  now: string;
  onPurgeExtensions?: PurgeExtensions;
}

/** Options for `purgeContactCore`, which runs inside a caller's transaction. */
export interface PurgeCoreOptions {
  /** Caller-supplied local wall-clock timestamp (tombstones, sun reset, import rows). */
  now: string;
  /**
   * The archive-before-purge gate. Defaults to on. Only the D-100 share Undo
   * may turn it off, behind its own ownership guard (D-106, amends ADR-018).
   */
  requireArchived?: boolean;
  /**
   * Whether each tombstone write advances `data_revision`. Defaults to on, so a
   * bare core call still records the change. An aggregate that bumps once
   * itself passes false (PLAN-MAP §5 Revision bumps).
   */
  bumpRevision?: boolean;
}

/**
 * The cleanup a committed purge still owes: runs `onPurgeExtensions` (if any)
 * with what the purge retired, best-effort. Call it only AFTER the caller's
 * transaction has committed; a throwing adapter is logged, never rethrown.
 */
export type PurgePostCommitCleanup = (
  onPurgeExtensions?: PurgeExtensions,
) => Promise<void>;

async function countRows(
  exec: SqlExecutor,
  sql: string,
  contactId: number,
): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(sql, [contactId]);
  return row?.n ?? 0;
}

/**
 * Read the per-child blast radius of purging `contactId`: four `COUNT(*)` reads
 * for the multi-row children plus an `EXISTS` probe for normalized custom values.
 * The boolean remains deliberately unrendered because v6 persists blank rows for
 * every contact-and-definition pair. A pure read (no transaction). Every table
 * name is a literal.
 */
export async function computeImpact(
  exec: SqlExecutor,
  contactId: number,
): Promise<PurgeImpact> {
  const knowledgeChildren = await availableKnowledgeChildren(exec);
  const interactions = await countRows(
    exec,
    "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
    contactId,
  );
  const events = await countRows(
    exec,
    "SELECT COUNT(*) AS n FROM events WHERE contact_id = ?",
    contactId,
  );
  const links = await countRows(
    exec,
    "SELECT COUNT(*) AS n FROM contact_links WHERE contact_id = ?",
    contactId,
  );
  const methods = await countRows(
    exec,
    PURGE_CHILDREN.contact_method!.countSql,
    contactId,
  );
  const externalLinks = await countRows(
    exec,
    PURGE_CHILDREN.external_contact_link!.countSql,
    contactId,
  );
  const methodProvenance = await countRows(
    exec,
    PURGE_CHILDREN.contact_method_provenance!.countSql,
    contactId,
  );
  const memories = knowledgeChildren.has("memory")
    ? await countRows(exec, PURGE_CHILDREN.memory!.countSql, contactId)
    : 0;
  const relationships = knowledgeChildren.has("relationship")
    ? await countRows(exec, PURGE_CHILDREN.relationship!.countSql, contactId)
    : 0;
  const currentStateEntries = knowledgeChildren.has("current_state_entry")
    ? await countRows(
        exec,
        PURGE_CHILDREN.current_state_entry!.countSql,
        contactId,
      )
    : 0;
  const cv = await exec.getFirstAsync<{ present: number }>(
    "SELECT EXISTS(SELECT 1 FROM custom_field_values WHERE contact_id = ?) AS present",
    [contactId],
  );
  return {
    interactions,
    events,
    links,
    methods,
    externalLinks,
    methodProvenance,
    memories,
    relationships,
    currentStateEntries,
    hasCustomValues: (cv?.present ?? 0) === 1,
  };
}

/**
 * The pure, unit-tested render helper: the ordered, omit-zero blast-radius parts
 * for the impact-summary confirm. Renders the genuine multi-row children —
 * interactions, events, links, memories, relationships — each
 * `"${n} ${label}"` (pluralised),
 * and omits any whose count is 0. `events` IS surfaced now (the Phase-6 events
 * writer landed); `hasCustomValues` remains DELIBERATELY not rendered because v6
 * custom-field rows include durable blanks and are not a meaningful blast-radius
 * count for the user.
 *
 * `name` is part of the caller's sentence ("Permanently delete {name} and
 * {parts}?"), not of these fragments — the screen owns the surrounding copy.
 */
export function impactSummaryLines(
  name: string,
  impact: PurgeImpact,
): string[] {
  void name;
  const lines: string[] = [];
  if (impact.interactions > 0) {
    lines.push(plural(impact.interactions, "interaction", "interactions"));
  }
  if (impact.events > 0) {
    lines.push(plural(impact.events, "event", "events"));
  }
  if (impact.links > 0) {
    lines.push(plural(impact.links, "link", "links"));
  }
  if (impact.memories > 0) {
    lines.push(plural(impact.memories, "memory", "memories"));
  }
  if (impact.relationships > 0) {
    lines.push(plural(impact.relationships, "relationship", "relationships"));
  }
  // Current-state history is durable but not a user-meaningful blast-radius count.
  return lines;
}

/**
 * The purge transaction body: everything `purgeContact` does between BEGIN and
 * COMMIT — the archive guard, the photo delete-intent journal, import-row
 * cleanup, tombstones for every mergeable child and the contact, the explicit
 * child fan-out, the sun reset and the contact delete (exactly one row).
 *
 * It NEVER opens a transaction: the caller must already hold one (BEGIN open,
 * inside `inWriteTransaction`), so a failure here rolls back with the caller.
 * It returns the post-commit cleanup, which the caller runs after COMMIT.
 */
export async function purgeContactCore(
  exec: SqlExecutor,
  contactId: number,
  { now, requireArchived = true, bumpRevision = true }: PurgeCoreOptions,
): Promise<PurgePostCommitCleanup> {
  // (1) Write-boundary guard: only an archived contact may be purged unless
  //     the caller turned the archive gate off (D-106; see the module header).
  const row = await exec.getFirstAsync<{
    archived_at: string | null;
    uid: string;
    photo: string | null;
  }>("SELECT archived_at, uid, photo FROM contacts WHERE id = ?", [contactId]);
  if (!row) {
    throw new Error(
      `purgeContact: contact id=${contactId} does not exist — refusing to purge (no rows deleted)`,
    );
  }
  if (requireArchived && row.archived_at === null) {
    throw new Error(
      `purgeContact: contact id=${contactId} is not archived — refusing to purge (no rows deleted)`,
    );
  }
  const knowledgeChildren = await availableKnowledgeChildren(exec);

  // Journal identity-derived masters before their rows disappear. Exact
  // references in other rows protect shared legacy paths at drain time.
  const definitions = await exec.getAllAsync<{ col_name: string }>(
    "SELECT col_name FROM custom_field_defs",
  );
  const photoPaths = new Set([
    contactPhotoRelPath(contactId),
    ...definitions.map((def) =>
      customFieldPhotoRelPath(contactId, def.col_name),
    ),
  ]);
  if (row.photo && SAFE_RELATIVE.test(row.photo)) photoPaths.add(row.photo);
  for (const path of photoPaths) await enqueueDeleteIntentCore(exec, path);

  // Workflow snapshots are local-only copies. Match the contact's direct
  // rows and every source identity owned by its external links before those
  // links disappear below; pending rows stay available for review.
  let ownedRows: Array<{
    id: number;
    photo_rel_path: string | null;
  }> = [];
  // Migration-chain tests also exercise purge on pre-import schemas.
  const importTable = await exec.getFirstAsync(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'import_session_rows'",
  );
  if (importTable) {
    ownedRows = await exec.getAllAsync<{
      id: number;
      photo_rel_path: string | null;
    }>(
      `SELECT r.id, r.photo_rel_path FROM import_session_rows r
      WHERE r.row_status IN ('imported', 'linked', 'skipped')
        AND (r.contact_id = ?
          OR (r.row_status = 'skipped' AND r.matched_contact_id = ?)
          OR (r.contact_id IS NULL AND r.external_contact_id IN
            (SELECT l.external_contact_id FROM external_contact_links l
              WHERE l.contact_id = ? AND l.provider = 'android')))`,
      [contactId, contactId, contactId],
    );
    for (const owned of ownedRows) {
      await exec.runAsync("DELETE FROM import_session_rows WHERE id = ?", [
        owned.id,
      ]);
    }
    const candidates = await exec.getAllAsync<{
      id: number;
      candidates_json: string | null;
    }>(
      `SELECT id, candidates_json FROM import_session_rows
      WHERE row_status IN ('pending', 'needs_review')
        AND candidates_json IS NOT NULL`,
    );
    for (const candidate of candidates) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate.candidates_json ?? "null");
      } catch {
        parsed = null;
      }
      const filtered = Array.isArray(parsed)
        ? parsed.filter(
            (item) =>
              typeof item !== "object" ||
              item === null ||
              (item as { contactId?: unknown }).contactId !== contactId,
          )
        : null;
      const next = filtered === null ? null : JSON.stringify(filtered);
      if (next !== candidate.candidates_json) {
        await exec.runAsync(
          "UPDATE import_session_rows SET candidates_json = ?, modified_at = ? WHERE id = ?",
          [next, now, candidate.id],
        );
      }
    }
  }

  // (2) Capture every mergeable UID before deleting it. field_history has no
  //     merge identity and remains deliberately excluded from evidence.
  for (const [entityType, source] of Object.entries(PURGE_CHILDREN) as Array<
    [TombstoneEntityType, PurgeChildSpec | null]
  >) {
    if (
      !source ||
      entityType === "contact" ||
      !isAvailablePurgeChild(entityType, knowledgeChildren)
    ) {
      continue;
    }
    const rows = await exec.getAllAsync<{ uid: string }>(source.tombstoneSql, [
      contactId,
    ]);
    for (const child of rows) {
      await insertTombstoneCore(
        exec,
        { entityType, entityUid: child.uid, deletedAt: now },
        { bumpRevision },
      );
    }
  }
  await insertTombstoneCore(
    exec,
    { entityType: "contact", entityUid: row.uid, deletedAt: now },
    { bumpRevision },
  );

  // (3) Explicit fan-out of every owned child (incl. field_history, which has
  //     no FK and never cascades). Not relying on FK CASCADE — auditable.
  for (const entityType of [
    "contact_method_provenance",
    "interaction",
    "event",
    "off_limits",
    "custom_field_value",
    "custom_field_value_history",
    "contact_link",
    "external_contact_link",
    "contact_method",
    "memory",
    "relationship",
    "current_state_entry",
  ] as const) {
    if (!isAvailablePurgeChild(entityType, knowledgeChildren)) continue;
    await exec.runAsync(PURGE_CHILDREN[entityType]!.deleteSql, [contactId]);
  }
  await exec.runAsync("DELETE FROM field_history WHERE contact_id = ?", [
    contactId,
  ]);

  // Keep an explicit merge-visible timestamp when the purged row was the sun;
  // the WHERE makes this a harmless no-op for every other contact.
  await exec.runAsync(
    `UPDATE app_settings
        SET sun_contact_id = NULL, modified_at = ?
      WHERE id = 1 AND sun_contact_id = ?`,
    [now, contactId],
  );

  // (4) The contact itself — assert exactly one row deleted.
  const deleted = await exec.runAsync("DELETE FROM contacts WHERE id = ?", [
    contactId,
  ]);
  if (deleted.changes !== 1) {
    throw new Error(
      `purgeContact: expected exactly one contacts row deleted for id=${contactId} (deleted ${deleted.changes})`,
    );
  }
  const retired: PurgeRetired = {
    importStagingPaths: ownedRows.flatMap((owned) =>
      owned.photo_rel_path ? [owned.photo_rel_path] : [],
    ),
  };
  return async (onPurgeExtensions) => {
    // POST-COMMIT best-effort cleanup — the caller's transaction has committed
    // and the mutex is released. A throwing adapter is logged, never fatal,
    // and cannot undo the deletes above.
    try {
      await onPurgeExtensions?.(contactId, retired);
    } catch (err) {
      Logger.error(
        LOG_SCOPE,
        `post-commit purge cleanup failed for contact id=${contactId} (best-effort)`,
        err,
      );
    }
  };
}

/**
 * Permanently delete an ARCHIVED contact and every row it owns, in ONE
 * transaction. Asserts `archived_at IS NOT NULL` before any delete (a live
 * contact throws → rollback, nothing deleted) and asserts exactly one contacts
 * row deleted. Advances `data_revision` exactly once. After COMMIT, fires
 * `onPurgeExtensions` as idempotent best-effort (see the module header) —
 * never inside the transaction/mutex.
 */
export async function purgeContact(
  exec: SqlExecutor,
  contactId: number,
  opts: PurgeOptions,
): Promise<void> {
  const cleanup = await inWriteTransaction(exec, async () => {
    const postCommit = await purgeContactCore(exec, contactId, {
      now: opts.now,
      requireArchived: true,
      bumpRevision: false,
    });
    await bumpDataRevisionCore(exec);
    return postCommit;
  });
  await cleanup(opts.onPurgeExtensions);
}
