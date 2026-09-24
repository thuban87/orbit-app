/** Shared user-edit path for normalized custom values. */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  assertContactScopedWriteAllowedCore,
  upsertValueCore,
} from "@/db/field-values-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { maybeAppendPriorValueHistoryCore } from "@/db/value-history-dao";

export interface UserCustomValueEdit {
  contactId: number;
  fieldDefId: number;
  value: string | null;
  now: string;
}

/** Compose only inside an already-open write transaction. */
export async function applyUserCustomValueEditCore(
  exec: SqlExecutor,
  input: UserCustomValueEdit,
): Promise<void> {
  await assertContactScopedWriteAllowedCore(
    exec,
    input.contactId,
    input.fieldDefId,
  );
  await maybeAppendPriorValueHistoryCore(exec, {
    contactId: input.contactId,
    fieldDefId: input.fieldDefId,
    incomingValue: input.value,
    now: input.now,
  });
  // The UPSERT update branch retains the existing pair uid and raw TEXT value.
  await upsertValueCore(
    exec,
    input.contactId,
    input.fieldDefId,
    newUid(),
    input.value,
    input.now,
  );
}

/** Rapid editor writer. An unchanged value does not write or bump revision. */
export function saveUserCustomValueEdit(
  exec: SqlExecutor,
  input: UserCustomValueEdit,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const current = await exec.getFirstAsync<{ value: string | null }>(
      "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
      [input.contactId, input.fieldDefId],
    );
    if (current?.value === input.value) return;
    await applyUserCustomValueEditCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}
