import { addContactMethodsCore } from "@/db/contact-methods-dao";
import { updateContactMetadataCore } from "@/db/contacts-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { upsertReviewedSnapshotCore } from "@/db/reconcile-snapshot-dao";
import type { SqlExecutor } from "@/db/types";
import {
  isBirthdayUnreadable,
  mapBirthdayForStorage,
} from "@/logic/picked-contact-map";
import type {
  ReconcileFieldFamily,
  ReconcileMethod,
} from "@/logic/reconcile-diff";

type ReconcileWriteField = "name" | "birthday" | "phones" | "emails" | "photo";

export interface ReconcileSelection {
  fieldFamily: ReconcileWriteField;
  /** The exact Orbit-side value observed at scan, used for freshness validation. */
  baseline: string | null;
  /** A user-selected source value; false means the user chose Keep Orbit. */
  useSource: boolean;
  /** Stable classifier option selected in the UI, when useSource is true. */
  sourceOptionId?: string;
  /**
   * Phones/emails: every picked option, in display order (convergence c3
   * D-1). `sourceOptionId` is the first of them.
   */
  sourceOptionIds?: readonly string[];
  /**
   * Phones/emails detail pick (D-102, D-148): the first of `sourceMethods`
   * (the person's own tick) becomes the type's primary and every other
   * method of that type a secondary. Absent for bulk and for pre-ticked
   * defaults, which keep Orbit's primary.
   */
  electPrimary?: boolean;
  sourceValue: string | null;
  sourceMethods?: readonly ReconcileMethod[];
  sourceLinkIds: readonly number[];
  /**
   * The value persisted in source memory after a review: the field's reviewed
   * comparable (every source option joined). Photo Keep Orbit writes it in the
   * apply transaction; Use phone's photo writes it post-commit.
   */
  reviewedValue: string | null;
  stagedPhotoRelative?: string | null;
  photoContentHash?: string | null;
}

export interface ApplyReconcileSelectionsInput {
  contactId: number;
  now: string;
  selections: readonly ReconcileSelection[];
  effectivePhoneRegion?: string | null;
}

export interface ApplyReconcileSelectionsResult {
  staleFields: ReconcileWriteField[];
  /** Deferred work which must execute post-commit before the photo snapshot is written. */
  pendingPhoto: ReconcileSelection | null;
}

interface ContactApplyRow {
  id: number;
  name: string;
  category_id: number | null;
  interval_days: number | null;
  tracking_enabled: number;
  social_battery: string | null;
  birthday: string | null;
  rarely_responds: number;
  reminders_off: number;
  photo: string | null;
  modified_at: string;
}

function scalarLiveValue(
  row: ContactApplyRow,
  field: "name" | "birthday",
): string | null {
  return field === "name" ? row.name : row.birthday;
}

async function snapshotPriorScalar(
  exec: SqlExecutor,
  contactId: number,
  field: "name" | "birthday",
  oldValue: string | null,
  now: string,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at)
     VALUES (?, ?, ?, 'reconcile-overwritten', ?)`,
    [contactId, field, oldValue, now],
  );
}

async function writeReviewedSnapshots(
  exec: SqlExecutor,
  selection: ReconcileSelection,
  now: string,
): Promise<void> {
  // Use phone's photo remembers post-commit, only after the promote succeeds.
  // Keep Orbit remembers here, inside the caller's transaction, with the
  // reviewed comparable (field.reviewedComparable — "" when the phone has no
  // photo, the joined fingerprints for several; D-45, convergence c4 E-4).
  if (selection.fieldFamily === "photo" && selection.useSource) return;
  for (const externalContactLinkId of [...selection.sourceLinkIds].sort(
    (a, b) => a - b,
  )) {
    await upsertReviewedSnapshotCore(exec, {
      externalContactLinkId,
      fieldFamily: selection.fieldFamily as ReconcileFieldFamily,
      reviewedValue: selection.reviewedValue,
      reviewedAt: now,
    });
  }
}

/**
 * Shared caller-owned transaction helper for detail and bulk reconciliation.
 * It deliberately does not promote/write photos; a Use phone's photo choice is
 * returned as `pendingPhoto` and its memory is written post-commit only after
 * setContactPhoto succeeds. A Keep Orbit photo choice is remembered here.
 */
export async function applyReconcileSelections(
  exec: SqlExecutor,
  input: ApplyReconcileSelectionsInput,
): Promise<ApplyReconcileSelectionsResult> {
  const contact = await exec.getFirstAsync<ContactApplyRow>(
    `SELECT id, name, category_id, interval_days, tracking_enabled, social_battery,
            birthday, rarely_responds, reminders_off, photo, modified_at
       FROM contacts WHERE id = ?`,
    [input.contactId],
  );
  if (!contact)
    throw new Error(
      `applyReconcileSelections: contact ${input.contactId} missing`,
    );

  const staleFields: ReconcileWriteField[] = [];
  const fresh: ReconcileSelection[] = [];
  for (const selection of input.selections) {
    if (selection.fieldFamily === "photo") {
      fresh.push(selection);
      continue;
    }
    if (
      selection.fieldFamily === "phones" ||
      selection.fieldFamily === "emails"
    ) {
      // Method freshness is protected by the complete seeded desired list. A future
      // durable-card shape supplies a serialized method baseline; this thin slice
      // uses the same current list as the seed and never removes a method.
      fresh.push(selection);
      continue;
    }
    if (selection.useSource && selection.sourceValue == null) {
      staleFields.push(selection.fieldFamily);
      continue;
    }
    if (
      scalarLiveValue(contact, selection.fieldFamily) !== selection.baseline
    ) {
      staleFields.push(selection.fieldFamily);
    } else {
      fresh.push(selection);
    }
  }

  const scalarSelections = fresh.filter(
    (
      selection,
    ): selection is ReconcileSelection & { fieldFamily: "name" | "birthday" } =>
      selection.fieldFamily === "name" || selection.fieldFamily === "birthday",
  );
  const sourceScalars = scalarSelections.filter(
    (selection) => selection.useSource,
  );
  let scalarChanged = false;
  let name = contact.name;
  let birthday = contact.birthday;
  for (const selection of sourceScalars) {
    if (selection.fieldFamily === "name" && selection.sourceValue != null)
      name = selection.sourceValue;
    if (selection.fieldFamily === "birthday") {
      if (isBirthdayUnreadable(selection.sourceValue)) {
        staleFields.push("birthday");
        continue;
      }
      birthday = mapBirthdayForStorage(selection.sourceValue);
    }
  }
  scalarChanged = name !== contact.name || birthday !== contact.birthday;
  if (scalarChanged) {
    for (const selection of sourceScalars) {
      if (selection.fieldFamily === "name" && name !== contact.name) {
        await snapshotPriorScalar(
          exec,
          input.contactId,
          "name",
          contact.name,
          input.now,
        );
      }
      if (
        selection.fieldFamily === "birthday" &&
        birthday !== contact.birthday
      ) {
        await snapshotPriorScalar(
          exec,
          input.contactId,
          "birthday",
          contact.birthday,
          input.now,
        );
      }
    }
    await updateContactMetadataCore(exec, {
      id: input.contactId,
      name,
      categoryId: contact.category_id,
      intervalDays: contact.interval_days,
      trackingEnabled: contact.tracking_enabled === 1,
      socialBattery: contact.social_battery,
      birthday,
      rarelyResponds: contact.rarely_responds,
      remindersOff: contact.reminders_off,
      now: input.now,
    });
    await bumpDataRevisionCore(exec);
  }

  const methodSelections = fresh.filter(
    (selection) =>
      selection.fieldFamily === "phones" || selection.fieldFamily === "emails",
  );
  if (
    methodSelections.some(
      (selection) => selection.useSource && selection.sourceMethods?.length,
    )
  ) {
    // Append-only (D-102 "nothing is deleted"; 38.12 review B-WR-05): stored
    // methods are never re-normalized, deleted or tombstoned, even when two
    // of them collide under today's region. Only is_primary can change.
    for (const selection of methodSelections) {
      if (!selection.useSource || !selection.sourceMethods?.length) continue;
      const first = selection.sourceMethods[0];
      await addContactMethodsCore(exec, {
        contactId: input.contactId,
        additions: selection.sourceMethods.map((method) => ({
          type: method.type,
          value: method.value,
          label: method.label ?? null,
        })),
        primary: selection.electPrimary
          ? { type: first.type, value: first.value }
          : undefined,
        now: input.now,
        effectivePhoneRegion: input.effectivePhoneRegion,
      });
    }
  }

  for (const selection of fresh) {
    if (!staleFields.includes(selection.fieldFamily)) {
      await writeReviewedSnapshots(exec, selection, input.now);
    }
  }
  return {
    staleFields,
    pendingPhoto:
      fresh.find(
        (selection) => selection.fieldFamily === "photo" && selection.useSource,
      ) ?? null,
  };
}
