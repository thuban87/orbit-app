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
  | "fuel"
  | "contact_link"
  | "contact_method"
  | "external_contact_link"
  | "contact_method_provenance"
  | "custom_field_def"
  | "custom_field_value";

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

function assertTombstoneEntityType(
  value: unknown,
): asserts value is TombstoneEntityType {
  switch (value) {
    case "contact":
    case "interaction":
    case "event":
    case "fuel":
    case "contact_link":
    case "contact_method":
    case "external_contact_link":
    case "contact_method_provenance":
    case "custom_field_def":
    case "custom_field_value":
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
     VALUES (?, ?, ?)`,
    [input.entityType, input.entityUid, input.deletedAt],
  );
  if (bumpRevision) {
    await bumpDataRevisionCore(exec);
  }
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
