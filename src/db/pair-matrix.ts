import type { SqlExecutor } from "@/db/types";

/** Complete only missing global pairs. Existing identities and values are immutable here. */
const missingPairs = `FROM contacts c CROSS JOIN custom_field_defs d
  WHERE d.scope = 'global'
    AND NOT EXISTS (
      SELECT 1 FROM custom_field_values v
      WHERE v.contact_id = c.id AND v.field_def_id = d.id
    )`;

export const GLOBAL_PAIR_COMPLETION_SQL = [
  `INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at)
   SELECT 'pair:' || hex(c.uid) || ':' || hex(d.uid), c.id, d.id, NULL,
          max(c.created_at,d.created_at), max(c.created_at,d.created_at)
   ${missingPairs}
     AND NOT EXISTS (
       SELECT 1 FROM custom_field_values occupied
       WHERE occupied.uid = 'pair:' || hex(c.uid) || ':' || hex(d.uid)
     )`,
  `INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at)
   SELECT 'pairx:' || lower(hex(randomblob(16))), c.id, d.id, NULL,
          max(c.created_at,d.created_at), max(c.created_at,d.created_at)
   ${missingPairs}`,
] as const;

/** Caller owns the one outer write transaction. */
export async function completeGlobalPairsCore(
  exec: SqlExecutor,
): Promise<number> {
  let inserted = 0;
  for (const statement of GLOBAL_PAIR_COMPLETION_SQL) {
    inserted += (await exec.runAsync(statement)).changes;
  }
  return inserted;
}
