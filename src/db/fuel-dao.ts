/**
 * TEMPORARY Off Limits shim behind the retired knowledge-table DAO names
 * (Phase 38.10 plan 02; deleted by plan 18).
 *
 * Migration 033 dropped the five-kind table. The exported names and types are
 * kept so the UI hosts that later plans rewrite (Create / Edit Contact, the
 * Off Limits editor, Update Contact, Capture) keep compiling. There is no SQL
 * against the retired table here (D-01):
 *   - adds route by kind through `legacy-fuel-mapping` (D-56): off_limits ->
 *     the Off Limits DAO; gift / topic / fact -> a memory (Gift Ideas /
 *     Thought of Them / general) with Allow AI off; recent -> Last Talked About;
 *   - edits and deletes reach only `off_limits` (D-11). An edit carrying any
 *     other kind throws.
 *
 * Core / wrapper split (transaction.ts): cores never open a transaction; each
 * wrapper owns exactly one. `deleteFuelCore` keeps its `bumpRevision` option,
 * which the Edit Contact aggregate's single bump relies on.
 */

import { setCurrentStateValueCore } from "@/db/current-state-history-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { mapLegacyFuelRow } from "@/db/legacy-fuel-mapping";
import { addMemoryCore } from "@/db/memories-dao";
import {
  addOffLimitsCore,
  deleteOffLimitsCore,
  editOffLimitsCore,
} from "@/db/off-limits-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/**
 * The legacy five-kind vocabulary. In the shim it only chooses an add's home
 * (D-56); edits and deletes accept `off_limits` alone.
 */
export type FuelKind = "recent" | "topic" | "fact" | "gift" | "off_limits";

/**
 * The legacy provenance string. `share` routes a memory add to provenance
 * `share` and marks an Off Limits add `from_share` (D-108); anything else is a
 * user add.
 */
export type FuelSource = string;

/** One new entry to add against an existing contact (routed by kind). */
export interface NewFuelItem {
  /** Merge-key UUID for the new row (caller-minted, e.g. `newUid()`). */
  uid: string;
  contactId: number;
  kind: FuelKind;
  /** Optional short label; stored NULL when null/undefined. */
  label?: string | null;
  /** Optional body text; stored NULL when null/undefined. */
  text?: string | null;
  /** Optional link; stored NULL when null/undefined. */
  url?: string | null;
  /** Local wall-clock creation stamp — immutable once set (FUEL-04 age). */
  createdAt: string;
  /** Provenance (see `FuelSource`). */
  source: FuelSource;
  /** Local wall-clock now — the `modified_at` stamp. */
  now: string;
}

/**
 * A patch to an existing Off Limits entry, scoped by BOTH id AND contactId.
 * Only the fields present (`!== undefined`) are written (review HIGH-1), so a
 * one-field commit never reverts a concurrent edit. `created_at` never changes.
 */
export interface EditFuelInput {
  id: number;
  contactId: number;
  /** Must be `off_limits` when present; any other kind throws. */
  kind?: FuelKind;
  /**
   * Present → UPDATE label (a blank optional is normalized to NULL at the commit
   * boundary). Absent (`undefined`) → left untouched.
   */
  label?: string | null;
  /** Present → UPDATE text. Absent (`undefined`) → left untouched. */
  text?: string | null;
  /** Present → UPDATE url. Absent (`undefined`) → left untouched. */
  url?: string | null;
  /** Local wall-clock now — bumps `modified_at`; `created_at` is left untouched. */
  now: string;
}

// --- Non-mutexed cores (assume BEGIN already open — never open a transaction) --

/**
 * Add one entry, routed by kind to its post-033 home (D-56). A live add has no
 * legacy uid to keep, so no allocation is passed: Off Limits keeps the
 * caller-minted uid, and the memory / current-state cores mint their own.
 * Returns the new row's id in its home table.
 */
export async function addFuelCore(
  exec: SqlExecutor,
  input: NewFuelItem,
): Promise<number> {
  const mapped = mapLegacyFuelRow(
    {
      uid: input.uid,
      kind: input.kind,
      label: input.label ?? null,
      text: input.text ?? null,
      url: input.url ?? null,
      source: input.source,
      createdAt: input.createdAt,
      modifiedAt: input.now,
    },
    { now: input.now, contentlessRule: "skip" },
  );
  switch (mapped.home) {
    case "off_limits":
      return addOffLimitsCore(exec, {
        uid: mapped.uid,
        contactId: input.contactId,
        label: mapped.label,
        text: mapped.text,
        url: mapped.url,
        createdAt: input.createdAt,
        fromShare: mapped.fromShare,
        now: input.now,
      });
    case "memory":
      return addMemoryCore(exec, {
        contactId: input.contactId,
        type: mapped.type,
        value: mapped.value,
        customLabel: mapped.customLabel,
        url: mapped.url,
        provenance: input.source === "share" ? "share" : "user",
        allowAi: 0,
        createdAt: input.createdAt,
        now: input.now,
      });
    case "current_state":
      return setCurrentStateValueCore(exec, {
        contactId: input.contactId,
        fieldKey: mapped.fieldKey,
        value: mapped.value,
        now: input.now,
      });
    case "none":
      throw new Error("fuel-dao: an entry needs a label, text or url");
  }
}

/**
 * Patch one Off Limits entry (D-11). Only the fields present are written; an
 * edit that names any kind other than off_limits throws (the shim never
 * guesses another table from an id).
 */
export async function editFuelCore(
  exec: SqlExecutor,
  input: EditFuelInput,
): Promise<void> {
  if (input.kind !== undefined && input.kind !== "off_limits") {
    throw new Error("fuel-dao: only Off Limits entries can be edited here");
  }
  await editOffLimitsCore(exec, {
    id: input.id,
    contactId: input.contactId,
    label: input.label,
    text: input.text,
    url: input.url,
    now: input.now,
  });
}

/**
 * Hard-delete one Off Limits entry with its tombstone. The tombstone write
 * bumps `data_revision` by default; an aggregate that owns the single bump
 * (`updateContactFull`) passes `bumpRevision: false`.
 */
export async function deleteFuelCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string; bumpRevision?: boolean },
): Promise<void> {
  await deleteOffLimitsCore(exec, input);
}

// --- Standalone wrappers (own ONE transaction each) --------------------------

/** Add one fuel row (standalone). Wraps `addFuelCore` in one transaction. */
export function addFuel(
  exec: SqlExecutor,
  input: NewFuelItem,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addFuelCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}

/** Edit one fuel row (standalone). Wraps `editFuelCore` in one transaction. */
export function editFuel(
  exec: SqlExecutor,
  input: EditFuelInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await editFuelCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/** Delete one fuel row (standalone). Wraps `deleteFuelCore` in one transaction. */
export function deleteFuel(
  exec: SqlExecutor,
  input: { id: number; contactId: number; now: string },
): Promise<void> {
  return inWriteTransaction(exec, () => deleteFuelCore(exec, input));
}
