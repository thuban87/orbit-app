/**
 * Shared prop contract for the 7 custom-field VALUE widgets (FLD-04).
 *
 * Each widget is a CONTROLLED input over the field's TEXT storage: it reads a
 * `string | null` and emits a raw `string` via `onChange`. Widgets NEVER coerce
 * or clear on keystroke — canonicalisation and flagging live in the tested
 * parser layer (`src/db/field-parsers.ts`), not the UI (T-03-04, HANDOFF §14.3).
 *
 * This is the RN rewrite of the plugin `FormRenderer` field props; the DOM
 * plumbing (`FieldDef.key`, `FormEvent`, className) is dropped. `label` drives
 * the `accessibilityLabel` only — the host form renders the visible label.
 */
export interface FieldWidgetProps {
  /** The stored TEXT value (or `null`/`""` when absent). */
  value: string | null;
  /**
   * Emits the value on edit — never a coerced/typed value. `string | null` so the
   * photo widget's Remove can emit `onChange(null)` to clear the field; the other
   * six widgets only ever pass a `string`, which this wider signature accepts.
   */
  onChange: (value: string | null) => void;
  /** Accessibility label for uiautomator verification at the --to 3 gate. */
  label: string;
  /** Parsed option list — dropdown only; ignored by other widgets. */
  options?: string[];
  /**
   * The contact being edited — photo widget ONLY (edit-only gate + derivable
   * `cv-` filename). Undefined on the create form / def preview → disabled.
   */
  contactId?: number;
  /** The field's stable `col_name` — photo widget ONLY (derivable filename). */
  colName?: string;
  /** Stable testID mirroring the `HomeScreen` verification pattern. */
  testID?: string;
}
