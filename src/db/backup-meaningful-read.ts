/**
 * Whether the database holds anything worth backing up — the Backup screen's
 * nudge input (`resolveBackupNudge` `hasMeaningfulData`). A pure read.
 *
 * Contacts, interactions, events, Off Limits items, links, custom fields and
 * a named or pictured profile count. Memories, key people and current state
 * stay out of the list, unchanged from before Off Limits replaced the retired
 * table here (every one of them belongs to a contact, which already counts).
 */
import type { SqlExecutor } from "@/db/types";

export async function hasMeaningfulBackupData(
  exec: SqlExecutor,
): Promise<boolean> {
  const row = await exec.getFirstAsync<{ meaningful: number }>(
    `SELECT EXISTS(
      SELECT 1 FROM contacts
      UNION ALL SELECT 1 FROM interactions
      UNION ALL SELECT 1 FROM events
      UNION ALL SELECT 1 FROM off_limits
      UNION ALL SELECT 1 FROM contact_links
      UNION ALL SELECT 1 FROM custom_field_defs
      UNION ALL SELECT 1 FROM custom_field_values
      UNION ALL SELECT 1 FROM profile WHERE name IS NOT NULL OR photo IS NOT NULL
    ) AS meaningful`,
  );
  return row?.meaningful === 1;
}
