/**
 * Durable deletion evidence. These are non-mutexed cores: writers call them
 * from their existing outer transaction immediately before the matching delete.
 */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import type { SqlExecutor } from "@/db/types";

export type TombstoneEntityType =
  | "contact"
  | "interaction"
  | "event"
  | "off_limits"
  | "contact_link"
  | "contact_method"
  | "external_contact_link"
  | "contact_method_provenance"
  | "custom_field_def"
  | "custom_field_value"
  | "custom_field_value_history"
  | "memory"
  | "relationship"
  | "current_state_entry"
  | "group_event"
  | "category";

export interface TombstoneInput {
  entityType: TombstoneEntityType;
  entityUid: string;
  deletedAt: string;
}

export interface Tombstone {
  entityType: TombstoneEntityType;
  entityUid: string;
  deletedAt: string;
}

export function assertTombstoneEntityType(
  value: unknown,
): asserts value is TombstoneEntityType {
  switch (value) {
    case "contact":
    case "interaction":
    case "event":
    case "off_limits":
    case "contact_link":
    case "contact_method":
    case "external_contact_link":
    case "contact_method_provenance":
    case "custom_field_def":
    case "custom_field_value":
    case "custom_field_value_history":
    case "memory":
    case "relationship":
    case "current_state_entry":
    case "group_event":
    case "category":
      return;
    default:
      throw new Error(`unsupported tombstone entity type: ${String(value)}`);
  }
}

/** Insert deletion evidence and advance the revision in the same caller-owned transaction. */
export async function insertTombstoneCore(
  exec: SqlExecutor,
  input: TombstoneInput,
  { bumpRevision = true }: { bumpRevision?: boolean } = {},
): Promise<void> {
  assertTombstoneEntityType(input.entityType);
  await exec.runAsync(
    `INSERT INTO tombstones (entity_type, entity_uid, deleted_at)
     VALUES (?, ?, ?)
     ON CONFLICT(entity_type, entity_uid) DO UPDATE SET
       deleted_at = CASE
         WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_at
         ELSE tombstones.deleted_at
       END`,
    [input.entityType, input.entityUid, input.deletedAt],
  );
  if (bumpRevision) {
    await bumpDataRevisionCore(exec);
  }
}

/**
 * Remove one piece of deletion evidence, assuming BEGIN is already open. Undo
 * of a delete (D-69, plan 02) calls this as it restores the row. Deleting a
 * tombstone that is not there is a no-op; more than one change is impossible
 * under UNIQUE(entity_type, entity_uid) and throws so the caller rolls back.
 */
export async function deleteTombstoneCore(
  exec: SqlExecutor,
  input: { entityType: TombstoneEntityType; entityUid: string },
): Promise<number> {
  assertTombstoneEntityType(input.entityType);
  const result = await exec.runAsync(
    "DELETE FROM tombstones WHERE entity_type = ? AND entity_uid = ?",
    [input.entityType, input.entityUid],
  );
  if (result.changes > 1) {
    throw new Error(
      `deleteTombstoneCore: removed ${result.changes} tombstones for ${input.entityType} ${input.entityUid}`,
    );
  }
  return result.changes;
}

/** Query durable evidence in deterministic order for export and reconciliation. */
export async function listTombstones(exec: SqlExecutor): Promise<Tombstone[]> {
  const rows = await exec.getAllAsync<{
    entity_type: unknown;
    entity_uid: string;
    deleted_at: string;
  }>(
    `SELECT entity_type, entity_uid, deleted_at
       FROM tombstones
      ORDER BY entity_type, entity_uid`,
  );
  return rows.map((row) => {
    assertTombstoneEntityType(row.entity_type);
    return {
      entityType: row.entity_type,
      entityUid: row.entity_uid,
      deletedAt: row.deleted_at,
    };
  });
}
