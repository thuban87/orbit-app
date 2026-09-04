/** Atomic contact consolidation. Every DB mutation is contained in one write transaction. */
import {
  setContactPhotoCore,
  updateContactMetadataCore,
  type UpdateContactFullInput,
} from "@/db/contacts-dao";
import { upsertValueCore } from "@/db/field-values-dao";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import { recomputeLastContactCore } from "@/db/recency-dao";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export type MergeChoice = "survivor" | "absorbed";

/** Empty scalar values do not carry information worth preserving over an absorbed value. */
function isEmptyMergeValue(value: string | number | null): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

/** Explicit UI-to-writer contract, shared with the conflict-resolution screen. */
export interface MergeResolutions {
  scalars?: Partial<Record<"name" | "categoryId" | "intervalDays" | "trackingEnabled" | "socialBattery" | "birthday" | "rarelyResponds" | "remindersOff", MergeChoice>>;
  customFields?: Record<number, MergeChoice>;
  primaryMethod?: Partial<Record<ContactMethodType, MergeChoice>>;
  photo?: "keep-survivor" | { choice: "absorbed"; relative: string };
}

/** Normalize untrusted UI state to the deliberately small, durable merge contract. */
export function normalizeMergeResolutions(input: unknown): MergeResolutions {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const choice = (value: unknown): MergeChoice | undefined =>
    value === "survivor" || value === "absorbed" ? value : undefined;
  const scalars: Record<string, MergeChoice> = {};
  if (raw.scalars && typeof raw.scalars === "object" && !Array.isArray(raw.scalars)) {
    for (const key of ["name", "categoryId", "intervalDays", "trackingEnabled", "socialBattery", "birthday", "rarelyResponds", "remindersOff"]) {
      const value = choice((raw.scalars as Record<string, unknown>)[key]);
      if (value) scalars[key] = value;
    }
  }
  const customFields: Record<number, MergeChoice> = {};
  if (raw.customFields && typeof raw.customFields === "object" && !Array.isArray(raw.customFields)) {
    for (const [key, value] of Object.entries(raw.customFields as Record<string, unknown>)) {
      const id = Number(key);
      const normalized = choice(value);
      if (Number.isInteger(id) && id > 0 && normalized) customFields[id] = normalized;
    }
  }
  const primaryMethod: Partial<Record<ContactMethodType, MergeChoice>> = {};
  if (raw.primaryMethod && typeof raw.primaryMethod === "object" && !Array.isArray(raw.primaryMethod)) {
    for (const type of ["phone", "email"] as const) {
      const value = choice((raw.primaryMethod as Record<string, unknown>)[type]);
      if (value) primaryMethod[type] = value;
    }
  }
  const photo = raw.photo === "keep-survivor"
    ? "keep-survivor"
    : raw.photo && typeof raw.photo === "object" &&
        (raw.photo as Record<string, unknown>).choice === "absorbed" &&
        typeof (raw.photo as Record<string, unknown>).relative === "string"
      ? { choice: "absorbed" as const, relative: (raw.photo as Record<string, string>).relative }
      : undefined;
  return {
    ...(Object.keys(scalars).length ? { scalars } : {}),
    ...(Object.keys(customFields).length ? { customFields } : {}),
    ...(Object.keys(primaryMethod).length ? { primaryMethod } : {}),
    ...(photo ? { photo } : {}),
  };
}

type ContactRow = {
  id: number; uid: string; name: string; category_id: number | null; interval_days: number | null;
  tracking_enabled: number; social_battery: string | null; birthday: string | null; photo: string | null;
  rarely_responds: number; reminders_off: number; favourite_rank: number | null; ring_seq: number | null;
  snooze_until: string | null; archived_at: string | null;
};
type MethodRow = { id: number; uid: string; contact_id: number; method_type: ContactMethodType; canonical_value: string | null; is_primary: number };

async function snapshot(exec: SqlExecutor, contactId: number, field: string, value: string | number | null, operation: string, now: string): Promise<void> {
  await exec.runAsync(
    "INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at) VALUES (?, ?, ?, ?, ?)",
    [contactId, field, value == null ? null : String(value), operation, now],
  );
}

async function reparent(exec: SqlExecutor, table: string, survivorId: number, absorbedId: number, now: string): Promise<void> {
  await exec.runAsync(`UPDATE ${table} SET contact_id = ?, modified_at = ? WHERE contact_id = ?`, [survivorId, now, absorbedId]);
}

export async function mergeContacts(
  exec: SqlExecutor,
  input: { survivorId: number; absorbedId: number; resolutions?: MergeResolutions; now: string },
): Promise<void> {
  if (input.survivorId === input.absorbedId) throw new Error("mergeContacts: a contact cannot absorb itself");
  const resolutions = normalizeMergeResolutions(input.resolutions);
  await inWriteTransaction(exec, async () => {
    const columns = "id, uid, name, category_id, interval_days, tracking_enabled, social_battery, birthday, photo, rarely_responds, reminders_off, favourite_rank, ring_seq, snooze_until, archived_at";
    const survivor = await exec.getFirstAsync<ContactRow>(`SELECT ${columns} FROM contacts WHERE id = ?`, [input.survivorId]);
    const absorbed = await exec.getFirstAsync<ContactRow>(`SELECT ${columns} FROM contacts WHERE id = ?`, [input.absorbedId]);
    if (!survivor || survivor.archived_at !== null || !absorbed || absorbed.archived_at !== null) {
      throw new Error("mergeContacts: both contacts must be live");
    }
    const retired = await exec.getFirstAsync<{ id: number }>("SELECT id FROM tombstones WHERE entity_type = 'contact' AND entity_uid = ?", [absorbed.uid]);
    if (retired) throw new Error("mergeContacts: absorbed contact is already tombstoned");

    const methods = await exec.getAllAsync<MethodRow>("SELECT id, uid, contact_id, method_type, canonical_value, is_primary FROM contact_methods WHERE contact_id IN (?, ?)", [survivor.id, absorbed.id]);
    for (const type of ["phone", "email"] as const) {
      const own = methods.filter((row) => row.contact_id === survivor.id && row.method_type === type && row.is_primary === 1);
      const other = methods.filter((row) => row.contact_id === absorbed.id && row.method_type === type && row.is_primary === 1);
      if (!own.length || !other.length) continue;
      if (resolutions.primaryMethod?.[type] === "absorbed") {
        await exec.runAsync("UPDATE contact_methods SET is_primary = 0, modified_at = ? WHERE id = ?", [input.now, own[0].id]);
      } else {
        await exec.runAsync("UPDATE contact_methods SET is_primary = 0, modified_at = ? WHERE id = ?", [input.now, other[0].id]);
      }
    }
    const links = await exec.getAllAsync<{ id: number; provider: string; external_contact_id: string }>("SELECT id, provider, external_contact_id FROM external_contact_links WHERE contact_id = ? AND is_active = 1", [survivor.id]);
    const absorbedLinks = await exec.getAllAsync<{ id: number; provider: string; external_contact_id: string }>("SELECT id, provider, external_contact_id FROM external_contact_links WHERE contact_id = ? AND is_active = 1", [absorbed.id]);
    for (const link of absorbedLinks) if (links.some((own) => own.provider === link.provider && own.external_contact_id === link.external_contact_id)) {
      await exec.runAsync("UPDATE external_contact_links SET is_active = 0, modified_at = ? WHERE id = ?", [input.now, link.id]);
    }
    for (const absorbedMethod of methods.filter((row) => row.contact_id === absorbed.id && row.canonical_value)) {
      const duplicate = methods.find((row) => row.contact_id === survivor.id && row.method_type === absorbedMethod.method_type && row.canonical_value === absorbedMethod.canonical_value);
      if (!duplicate) continue;
      const selectedAbsorbed = resolutions.primaryMethod?.[absorbedMethod.method_type] === "absorbed" && absorbedMethod.is_primary === 1;
      const kept = selectedAbsorbed ? absorbedMethod : duplicate;
      const losing = selectedAbsorbed ? duplicate : absorbedMethod;
      await exec.runAsync("UPDATE contact_method_provenance SET method_id = ?, modified_at = ? WHERE method_id = ?", [kept.id, input.now, losing.id]);
      await exec.runAsync("DELETE FROM contact_methods WHERE id = ?", [losing.id]);
    }

    const survivorValues = await exec.getAllAsync<{ field_def_id: number; value: string | null }>("SELECT field_def_id, value FROM custom_field_values WHERE contact_id = ?", [survivor.id]);
    const absorbedValues = await exec.getAllAsync<{ field_def_id: number; value: string | null }>("SELECT field_def_id, value FROM custom_field_values WHERE contact_id = ?", [absorbed.id]);
    for (const other of absorbedValues) {
      const own = survivorValues.find((value) => value.field_def_id === other.field_def_id);
      if (!own) continue;
      // An explicit choice always wins. In the absence of one, retain an
      // informative absorbed value instead of replacing it with an empty survivor
      // value during the child-row reparent below.
      const takeAbsorbed = resolutions.customFields?.[other.field_def_id] === "absorbed" ||
        (resolutions.customFields?.[other.field_def_id] == null &&
          isEmptyMergeValue(own.value) && !isEmptyMergeValue(other.value));
      if (takeAbsorbed) {
        await snapshot(exec, survivor.id, `custom_field:${other.field_def_id}`, own.value, "merge-overwritten", input.now);
        await upsertValueCore(exec, survivor.id, other.field_def_id, newUid(), other.value, input.now);
      }
      await snapshot(exec, survivor.id, `custom_field:${other.field_def_id}`, other.value, "merge-dropped", input.now);
      await exec.runAsync("DELETE FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?", [absorbed.id, other.field_def_id]);
    }

    // Demote absorbed current values that would collide with the survivor's
    // current value before reparenting into the partial unique index.
    await exec.runAsync(
      `UPDATE current_state_entries
          SET is_current = 0, modified_at = ?
        WHERE contact_id = ?
          AND is_current = 1
          AND field_key IN (
            SELECT field_key FROM current_state_entries
             WHERE contact_id = ? AND is_current = 1
          )`,
      [input.now, absorbed.id, survivor.id],
    );
    // This must precede reparenting: links in either direction between the two
    // merging contacts would otherwise become persisted self-links.
    await exec.runAsync(
      `UPDATE relationships SET linked_contact_id = NULL, modified_at = ?
        WHERE contact_id IN (?, ?) AND linked_contact_id IN (?, ?)`,
      [input.now, survivor.id, absorbed.id, survivor.id, absorbed.id],
    );
    // Preserve third-party links to the absorbed contact by pointing them at its
    // survivor after the two would-be self-links have been cleared.
    await exec.runAsync(
      "UPDATE relationships SET linked_contact_id = ?, modified_at = ? WHERE linked_contact_id = ?",
      [survivor.id, input.now, absorbed.id],
    );

    for (const table of ["interactions", "events", "fuel", "custom_field_values", "contact_links", "contact_methods", "external_contact_links", "interaction_assists", "memories", "relationships", "current_state_entries"] as const) await reparent(exec, table, survivor.id, absorbed.id, input.now);
    await exec.runAsync("UPDATE field_history SET contact_id = ? WHERE contact_id = ?", [survivor.id, absorbed.id]);
    await exec.runAsync("UPDATE custom_field_value_history SET contact_id = ? WHERE contact_id = ?", [survivor.id, absorbed.id]);

    const scalar = resolutions.scalars ?? {};
    const fields: Array<[keyof typeof scalar, keyof ContactRow, keyof UpdateContactFullInput]> = [
      ["name", "name", "name"], ["categoryId", "category_id", "categoryId"], ["intervalDays", "interval_days", "intervalDays"], ["trackingEnabled", "tracking_enabled", "trackingEnabled"], ["socialBattery", "social_battery", "socialBattery"], ["birthday", "birthday", "birthday"], ["rarelyResponds", "rarely_responds", "rarelyResponds"], ["remindersOff", "reminders_off", "remindersOff"],
    ];
    const next: UpdateContactFullInput = { id: survivor.id, name: survivor.name, categoryId: survivor.category_id, intervalDays: survivor.interval_days, trackingEnabled: survivor.tracking_enabled === 1, socialBattery: survivor.social_battery, birthday: survivor.birthday, rarelyResponds: survivor.rarely_responds, remindersOff: survivor.reminders_off, now: input.now };
    for (const [resolutionKey, rowKey, inputKey] of fields) {
      // Explicit UI conflict resolutions remain authoritative. This fallback
      // prevents conflict-free merges from discarding a populated absorbed value
      // solely because the survivor stored a null/blank scalar.
      const takeAbsorbed = scalar[resolutionKey] === "absorbed" ||
        (scalar[resolutionKey] == null &&
          isEmptyMergeValue(survivor[rowKey] as string | number | null) &&
          !isEmptyMergeValue(absorbed[rowKey] as string | number | null));
      if (!takeAbsorbed) continue;
      await snapshot(exec, survivor.id, String(resolutionKey), survivor[rowKey] as string | number | null, "merge-overwritten", input.now);
      (next as unknown as Record<string, unknown>)[inputKey] = absorbed[rowKey];
    }
    if (Object.keys(scalar).length || fields.some(([resolutionKey, rowKey]) => scalar[resolutionKey] == null && isEmptyMergeValue(survivor[rowKey] as string | number | null) && !isEmptyMergeValue(absorbed[rowKey] as string | number | null))) await updateContactMetadataCore(exec, next);
    if (resolutions.photo && resolutions.photo !== "keep-survivor") await setContactPhotoCore(exec, survivor.id, resolutions.photo.relative, input.now);

    await exec.runAsync("UPDATE app_settings SET sun_contact_id = ?, modified_at = ? WHERE id = 1 AND sun_contact_id = ?", [survivor.id, input.now, absorbed.id]);
    for (const [field, value] of [["favourite_rank", absorbed.favourite_rank], ["ring_seq", absorbed.ring_seq], ["snooze_until", absorbed.snooze_until]] as const) if (value != null) await snapshot(exec, survivor.id, field, value, "merge-dropped", input.now);
    const cards = await exec.getAllAsync<{ session_id: number }>("SELECT DISTINCT session_id FROM reconciliation_session_cards WHERE contact_id = ?", [absorbed.id]);
    await exec.runAsync("DELETE FROM reconciliation_session_cards WHERE contact_id = ?", [absorbed.id]);
    for (const card of cards) {
      const remaining = await exec.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM reconciliation_session_cards WHERE session_id = ? AND card_status NOT IN ('resolved', 'missing_source')", [card.session_id]);
      if (remaining?.n === 0) await exec.runAsync("UPDATE reconciliation_sessions SET status = 'complete', modified_at = ? WHERE id = ?", [input.now, card.session_id]);
    }
    await insertTombstoneCore(exec, { entityType: "contact", entityUid: absorbed.uid, deletedAt: input.now });
    const deleted = await exec.runAsync("DELETE FROM contacts WHERE id = ?", [absorbed.id]);
    if (deleted.changes !== 1) throw new Error(`mergeContacts: expected one absorbed contact deleted, got ${deleted.changes}`);
    await recomputeLastContactCore(exec, survivor.id, input.now);
  });
}
