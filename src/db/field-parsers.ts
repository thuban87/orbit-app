/**
 * The 7 permissive target-type parsers (FLD-04) — READ-TIME validators, never
 * value rewriters.
 *
 * STORAGE IS TEXT FOREVER (HANDOFF §14.3, CLAUDE.md invariant). A custom field's
 * `type` drives the UI widget only; every value column in `contact_custom_values`
 * is declared TEXT for its whole life. These parsers do NOT change that — they
 * decide, at read time, whether a stored string is valid under the field's
 * CURRENT type. A clean value renders (and its canonical form is what
 * `sortExpr`'s CASTs expect); an unconvertible value is FLAGGED as the
 * tap-to-fix error state on the profile.
 *
 * There are exactly 7 parsers — ONE per TARGET type, NOT 42 pairwise converters
 * (HANDOFF §14.4). A parser MUST NOT throw and MUST NOT clear or coerce a failing
 * value: `{ ok: false }` is a SIGNAL to flag, never a licence to rewrite bytes
 * (T-03-04 — data loss on a "cleared" value is forbidden). This is why a type
 * change is a one-row UPDATE on `custom_field_defs` and touches
 * `contact_custom_values` not at all.
 *
 * Canonical output forms (so `sortExpr` sorts correctly on the TEXT column):
 *   - toggle → "1" / "0"   (so CAST(col AS INTEGER) groups false before true)
 *   - date   → YYYY-MM-DD  (ISO text sorts chronologically)
 *   - number → String(n)   (so CAST(col AS REAL) sorts numerically)
 *
 * Node-pure: imports only the `FieldType` union and the DEFS row type; nothing
 * from expo/react-native. Source: HANDOFF §14.4 (boolean example verbatim).
 */
import type { CustomFieldDef } from "@/db/field-types";
import type { FieldType } from "@/schemas/types";

/**
 * A read-time parse outcome. `{ ok: true, value }` accepts the value in its
 * canonical TEXT form (or `null` for absent); `{ ok: false }` FLAGS the stored
 * string as unconvertible under the current type — the tap-to-fix signal. There
 * is deliberately no third "cleared" variant: a parser never destroys data.
 */
export type ParseResult = { ok: true; value: string | null } | { ok: false };

/**
 * One permissive parser per TARGET `FieldType`. The `Record<FieldType, …>` type
 * makes exhaustiveness a compile-time guarantee — adding an 8th field type
 * without a parser fails `tsc`.
 */
export const parsers: Record<FieldType, (raw: string | null) => ParseResult> = {
  // text / textarea / photo: accept anything, incl. digits (§14.3). Null-safe
  // pass-through — never reject, never rewrite. `photo`'s native picker is
  // deferred to Phase 5; the identity parser keeps the 7-type set complete.
  text: (r) => ({ ok: true, value: r ?? null }),
  textarea: (r) => ({ ok: true, value: r ?? null }),
  photo: (r) => ({ ok: true, value: r ?? null }),

  // dropdown: identity pass-through. Option-membership is NOT a parser concern
  // (a value dropped from the options list is not "wrong under the type") — it
  // is checked separately by `isValueInOptions` so the caller can flag an
  // out-of-list value with the SAME tap-to-fix state without this staying
  // identity being compromised.
  dropdown: (r) => ({ ok: true, value: r ?? null }),

  // number: empty/null → absent; else strip thousands commas + trim and parse.
  // Finite → canonical `String(n)` (so CAST AS REAL sorts numerically);
  // non-finite (e.g. "about 60k") → flag. Never throws.
  number: (r) => {
    if (r == null || r.trim() === "") return { ok: true, value: null };
    const n = Number(r.replace(/,/g, "").trim());
    return Number.isFinite(n) ? { ok: true, value: String(n) } : { ok: false };
  },

  // date: empty/null → absent; else match a LEADING YYYY-MM-DD (trailing text
  // tolerated) and canonicalise to YYYY-MM-DD (ISO text sorts chronologically);
  // no match → flag.
  date: (r) => {
    if (r == null || r.trim() === "") return { ok: true, value: null };
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.trim());
    return m ? { ok: true, value: `${m[1]}-${m[2]}-${m[3]}` } : { ok: false };
  },

  // toggle: empty/null → absent; yes/true/y/on → "1"; no/false/n/off/none →
  // "0"; else a finite number → nonzero "1" / zero "0" (§14.4: "3"→yes, "0"→no);
  // otherwise flag. Canonical "1"/"0" so CAST AS INTEGER groups correctly.
  toggle: (r) => {
    if (r == null || r.trim() === "") return { ok: true, value: null };
    const s = r.trim().toLowerCase();
    if (["yes", "true", "y", "on"].includes(s)) return { ok: true, value: "1" };
    if (["no", "false", "n", "off", "none"].includes(s)) {
      return { ok: true, value: "0" };
    }
    const n = Number(s);
    if (Number.isFinite(n)) return { ok: true, value: n !== 0 ? "1" : "0" };
    return { ok: false };
  },
};

/**
 * Dropdown option-membership check (review MED). `parsers.dropdown` stays
 * IDENTITY — a value dropped from the options list is not invalid "under the
 * type" — so without this the out-of-list tap-to-fix state is unreachable. This
 * is a PURE membership test, reused by `CustomFieldValue` (Plan 06) and the
 * options-change pre-flight (Plan 05/08) so an out-of-list value renders as the
 * SAME error state as an unconvertible type change (CONTEXT consistency rule).
 *
 * Rules:
 *   - non-dropdown type → true (not applicable; never fabricate an error).
 *   - dropdown, empty/null value → true (absent, not "wrong").
 *   - dropdown with a parseable options array → membership of `value`.
 *   - dropdown whose `options` is null or fails to parse → true (cannot
 *     classify → do not fabricate an error state).
 */
export function isValueInOptions(
  field: Pick<CustomFieldDef, "type" | "options">,
  value: string | null,
): boolean {
  if (field.type !== "dropdown") return true;
  if (value == null || value === "") return true;
  if (field.options == null) return true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(field.options);
  } catch {
    return true;
  }
  if (!Array.isArray(parsed)) return true;
  return parsed.includes(value);
}
