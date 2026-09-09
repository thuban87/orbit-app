import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  type ProfileCollapseMap,
  type ProfileCollapsibleModuleId,
  parseProfileCollapseMap,
} from "@/profile/persisted-contract";

interface CollapseRow {
  collapse_json: string;
}

/** Malformed legacy/local state must not prevent Profile from rendering. */
export async function readProfileCollapseOverride(
  exec: Pick<SqlExecutor, "getFirstAsync">,
  contactId: number,
): Promise<ProfileCollapseMap> {
  const row = await exec.getFirstAsync<CollapseRow>(
    "SELECT collapse_json FROM profile_contact_presentation WHERE contact_id = ?",
    [contactId],
  );
  if (!row) return {};
  try {
    return parseProfileCollapseMap(row.collapse_json);
  } catch {
    return {};
  }
}

export interface SetProfileCollapseOverrideInput {
  contactId: number;
  moduleId: ProfileCollapsibleModuleId;
  expanded: boolean;
  now: string;
}

/** Transaction-body core for future composition; caller owns BEGIN/COMMIT. */
export async function setProfileCollapseOverrideCore(
  exec: SqlExecutor,
  input: SetProfileCollapseOverrideInput,
): Promise<void> {
  const current = await readProfileCollapseOverride(exec, input.contactId);
  const collapseJson = JSON.stringify(
    parseProfileCollapseMap({ ...current, [input.moduleId]: input.expanded }),
  );
  await exec.runAsync(
    `INSERT INTO profile_contact_presentation(
       contact_id, collapse_json, created_at, modified_at
     ) VALUES(?, ?, ?, ?)
     ON CONFLICT(contact_id) DO UPDATE SET
       collapse_json = excluded.collapse_json,
       modified_at = excluded.modified_at`,
    [input.contactId, collapseJson, input.now, input.now],
  );
  await bumpDataRevisionCore(exec);
}

/** Persist one semantic collapse override and bump backup revision exactly once. */
export function setProfileCollapseOverride(
  exec: SqlExecutor,
  input: SetProfileCollapseOverrideInput,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    setProfileCollapseOverrideCore(exec, input),
  );
}
