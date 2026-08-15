/**
 * `sortExpr()` — the SOLE place TEXT storage is observable (FLD-06, HANDOFF §14.2).
 *
 * Every custom-field value column is TEXT forever (CLAUDE.md invariant), so a
 * naive `ORDER BY col` sorts numbers lexicographically ("10" < "9"). This helper
 * is the ONE expression through which every sort AND filter on a custom field
 * routes, so the TEXT-storage decision leaks in exactly one auditable place:
 *   - number → CAST(col AS REAL)     — numeric ordering
 *   - toggle → CAST(col AS INTEGER)  — "0" before "1" (canonical parser output)
 *   - date   → col                   — ISO YYYY-MM-DD sorts chronologically as text
 *   - else   → col                   — text / textarea / dropdown / photo
 * Filters reuse the SAME expression (a numeric filter is `WHERE CAST(col AS REAL)
 * > ?`). Do NOT build a second interpolation site anywhere in the phase.
 *
 * INJECTION (T-03-01): `col_name` is the one identifier this subsystem
 * interpolates — identifiers cannot be `?`-bound. Plan 01 constructs it from a
 * restricted charset (`makeColName`), but `sortExpr` is designated the app-wide
 * PERMANENT sort/filter interpolation site: the Phase-8 dashboard sort and
 * Phase-13 orrery ordering will feed it defs from wherever THEY hold them, so
 * provenance cannot be assumed forever. It therefore GUARDS the name with
 * `isSafeColName` (throwing on an unsafe name) before double-quoting — belt and
 * suspenders at the boundary, mirroring every other interpolation site in the
 * phase. Node-pure: no DB/UI/expo import.
 *
 * =============================================================================
 * SORTS RAW STORED TEXT — DIVERGES FROM THE PERMISSIVE RENDER PARSER (WR-01):
 *   The number/toggle CASTs below run over the RAW stored TEXT bytes. Storage
 *   is TEXT forever and is NEVER canonicalized: the field-parsers.ts parsers are
 *   read-time-only and `applyTypeChange` leaves value bytes byte-identical
 *   (§14.2 blast-radius-zero, CLAUDE.md invariant — no value rewrite on a type
 *   change). So a value that RENDERS clean can SORT wrong when it is a
 *   non-canonical legacy value left behind by a type change:
 *     - toggle "yes"/"true" (from a text→toggle change) parses to canonical "1"
 *       and renders On, but CAST('yes' AS INTEGER) = 0 → sorts into the false
 *       group.
 *     - number "1,000" parses clean (commas stripped → 1000) and renders 1000,
 *       but CAST('1,000' AS REAL) = 1.0 → sorts as 1.
 *   This divergence is INTENTIONAL and is NOT a bug to "fix" here: rewriting
 *   stored values to canonical form is forbidden by the type-change invariant,
 *   and replicating the JS parser in SQL is not feasible (toggle word-forms in
 *   particular cannot be canonicalized in pure SQL). The tap-to-fix error state
 *   already surfaces these non-canonical values on the profile; re-editing a
 *   flagged value through its widget rewrites it to canonical form and it then
 *   sorts correctly. It is latent in Phase 3 — `sortExpr` has no runtime
 *   consumer yet.
 *
 *   <legacy_compat> HANDOFF TO PHASE 8 (first sortExpr consumer — dashboard
 *   sort/filter): decide how flagged / non-canonical rows should ORDER relative
 *   to canonical ones (e.g. sort tap-to-fix values last, exclude them from a
 *   numeric filter, or drive users to fix them before the sort is meaningful).
 *   Do NOT resolve it by rewriting storage. Whatever Phase 8 chooses, it layers
 *   ON TOP of this expression; this helper stays a pure raw-TEXT ordering.
 *   </legacy_compat>
 * =============================================================================
 */
import { isSafeColName } from "@/db/col-name";
import type { CustomFieldDef } from "@/db/field-types";

/**
 * Build the ORDER BY / filter expression for a custom field's TEXT value column.
 * Throws if `col_name` is not a well-formed identifier — this is the defensive
 * guard at the sole interpolation site, not a recoverable condition (a bad
 * col_name means a bug upstream, never user input).
 */
export function sortExpr(
  field: Pick<CustomFieldDef, "col_name" | "type">,
): string {
  if (!isSafeColName(field.col_name)) {
    throw new Error(
      `sortExpr: unsafe col_name ${JSON.stringify(field.col_name)}`,
    );
  }
  const col = `"${field.col_name}"`; // guarded above; quote defensively
  switch (field.type) {
    case "number":
      return `CAST(${col} AS REAL)`;
    case "toggle":
      return `CAST(${col} AS INTEGER)`;
    default:
      // date (ISO text sorts correctly) + text / textarea / dropdown / photo
      return col;
  }
}
