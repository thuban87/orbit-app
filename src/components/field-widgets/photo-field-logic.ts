/**
 * Pure derive/guard logic for the custom `photo`-field widget (PHOTO-01, the
 * custom-field reuse).
 *
 * Extracted from `PhotoFieldWidget.tsx` so the two correctness-critical rules —
 * the field VALUE is the derivable `cv-` relPath, and the widget is EDIT-ONLY —
 * are unit-tested in the node Vitest env (the .tsx imports react-native and
 * cannot load there, the same split as `frequency-picker-logic`).
 *
 * The stored field value EQUALS the file's derivable relative path
 * (`avatars/cv-<id>-<col>.jpg`), so the widget never invents a second identifier
 * and the crop pipeline, the widget value, and purge cleanup (Plan 07) all agree
 * on one path. The value flows to SQLite only through the edit form's existing
 * guarded upsert — this module builds NO SQL and touches NO native module.
 */
import { customFieldPhotoRelPath } from "@/services/photos/photo-storage";

/**
 * The value a custom photo field stores once a crop succeeds: the SAME derivable
 * relative path the pipeline wrote the master to. Delegating to
 * `customFieldPhotoRelPath` keeps the value and the file path a single source of
 * truth (and inherits its positive-int contactId + `isSafeColName` guards).
 */
export function customFieldValueForTarget(
  contactId: number,
  colName: string,
): string {
  return customFieldPhotoRelPath(contactId, colName);
}

/**
 * EDIT-ONLY guard: the photo widget is functional only for a defined numeric
 * contactId (the edit form). On the create form / def preview (no contactId) it
 * stays a disabled placeholder — a photo needs a persisted contact to derive its
 * stable filename. `null`/`undefined` are both false.
 */
export function isPhotoWidgetEnabled(
  contactId: number | null | undefined,
): contactId is number {
  return typeof contactId === "number";
}
