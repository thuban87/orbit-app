/**
 * Merge conflicts read (38.12 D-44, D-129): the data the Merge conflicts
 * screen resolves before the merge summary — both contacts' scalar fields,
 * every custom field where both hold different non-blank values, and the
 * primary phone/email pairs that disagree. Moved out of `MergeConflictsScreen`
 * (CLAUDE.md: queries go through DAOs, never inline in components; 38.9-16
 * out-of-scope finding). A pure read — no transaction. Every table name is a
 * literal and every id is `?`-bound.
 *
 * Each custom conflict carries a `kind` (D-129): `"photo"` when the field is
 * photo-type and both values are stored photos (`isStoredPhotoPath`), shown as
 * a photo choice; `"text"` otherwise, so text left in a photo field (e.g. kept
 * after a Text→Photo type change) is shown as text, never resolved as a path
 * (38.6 D-34). The values themselves stay raw TEXT (CLAUDE.md custom-field
 * invariants); `kind` drives the display only.
 */
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import type { SqlExecutor } from "@/db/types";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import type { FieldType } from "@/schemas/types";

export type MergeConflictContact = {
  id: number;
  name: string;
  birthday: string | null;
  category_id: number | null;
  category_label: string | null;
  photo: string | null;
};

/** How a custom-field conflict is shown (D-129). Display only. */
export type MergeCustomConflictKind = "photo" | "text";

export type MergeCustomConflict = {
  field_def_id: number;
  label: string;
  /** The field's type; drives the display form only (38.9 D-66). */
  type: FieldType;
  kind: MergeCustomConflictKind;
  survivor_value: string;
  absorbed_value: string;
};

export type MergePrimaryMethod = {
  uid: string;
  contact_id: number;
  method_type: ContactMethodType;
  raw_value: string;
  display_value: string;
  canonical_value: string | null;
};

export type MergeConflictData = {
  survivor: MergeConflictContact;
  absorbed: MergeConflictContact;
  customFields: MergeCustomConflict[];
  primaryByType: Partial<
    Record<
      ContactMethodType,
      { survivor: MergePrimaryMethod; absorbed: MergePrimaryMethod }
    >
  >;
};

/** The display kind of one custom-field conflict (D-129). */
export function mergeCustomConflictKind(
  type: FieldType,
  survivorValue: string,
  absorbedValue: string,
): MergeCustomConflictKind {
  return type === "photo" &&
    isStoredPhotoPath(survivorValue) &&
    isStoredPhotoPath(absorbedValue)
    ? "photo"
    : "text";
}

function primaryConflict(
  survivor: MergePrimaryMethod | undefined,
  absorbed: MergePrimaryMethod | undefined,
): survivor is MergePrimaryMethod {
  if (!survivor || !absorbed) return false;
  return (
    (survivor.canonical_value ?? survivor.raw_value.trim()) !==
    (absorbed.canonical_value ?? absorbed.raw_value.trim())
  );
}

/**
 * Read the conflicts between two live contacts. Rejects when either contact is
 * gone or in the Bin (the merge itself refuses them too).
 */
export async function readMergeConflictData(
  exec: SqlExecutor,
  survivorId: number,
  absorbedId: number,
): Promise<MergeConflictData> {
  const contacts = await exec.getAllAsync<MergeConflictContact>(
    `SELECT c.id, c.name, c.birthday, c.category_id, c.photo, category.name AS category_label
       FROM contacts AS c
       LEFT JOIN categories AS category ON category.id = c.category_id
      WHERE c.id IN (?, ?) AND c.archived_at IS NULL`,
    [survivorId, absorbedId],
  );
  const survivor = contacts.find((contact) => contact.id === survivorId);
  const absorbed = contacts.find((contact) => contact.id === absorbedId);
  if (!survivor || !absorbed) throw new Error("merge contacts are unavailable");
  const [customRows, methods] = await Promise.all([
    exec.getAllAsync<Omit<MergeCustomConflict, "kind">>(
      `SELECT defs.id AS field_def_id, defs.label, defs.type,
              survivor_values.value AS survivor_value, absorbed_values.value AS absorbed_value
         FROM custom_field_defs AS defs
         JOIN custom_field_values AS survivor_values
           ON survivor_values.field_def_id = defs.id AND survivor_values.contact_id = ?
         JOIN custom_field_values AS absorbed_values
           ON absorbed_values.field_def_id = defs.id AND absorbed_values.contact_id = ?
        WHERE defs.quarantined_at IS NULL
          AND NULLIF(TRIM(COALESCE(survivor_values.value, '')), '') IS NOT NULL
          AND NULLIF(TRIM(COALESCE(absorbed_values.value, '')), '') IS NOT NULL
          AND survivor_values.value <> absorbed_values.value
        ORDER BY defs.display_order, defs.id`,
      [survivorId, absorbedId],
    ),
    exec.getAllAsync<MergePrimaryMethod>(
      `SELECT uid, contact_id, method_type, raw_value, display_value, canonical_value
         FROM contact_methods
        WHERE contact_id IN (?, ?) AND is_primary = 1`,
      [survivorId, absorbedId],
    ),
  ]);
  const customFields = customRows.map((row) => ({
    ...row,
    kind: mergeCustomConflictKind(
      row.type,
      row.survivor_value,
      row.absorbed_value,
    ),
  }));
  const primaryByType: MergeConflictData["primaryByType"] = {};
  for (const type of ["phone", "email"] as const) {
    const own = methods.find(
      (method) =>
        method.contact_id === survivorId && method.method_type === type,
    );
    const other = methods.find(
      (method) =>
        method.contact_id === absorbedId && method.method_type === type,
    );
    if (primaryConflict(own, other) && other)
      primaryByType[type] = { survivor: own, absorbed: other };
  }
  return { survivor, absorbed, customFields, primaryByType };
}
