/**
 * col_name producer (FLD-02, T-03-01) — the SINGLE place a custom-field column
 * identifier is ever created.
 *
 * `col_name` is the one identifier this subsystem interpolates (double-quoted)
 * into SQL; identifiers cannot be `?`-bound, so it is made safe BY CONSTRUCTION,
 * never by escaping. `slugify` builds the name from the restricted charset
 * `[a-z][a-z0-9_]*` — a SQL-injection payload label produces an ordinary slug
 * with none of its original punctuation, because the punctuation is discarded,
 * not quoted. `makeColName` then uniquifies against `RESERVED_COLUMN_NAMES`
 * (fixed columns can never be shadowed) and the caller's set of existing
 * col_names. `isSafeColName` is the downstream defensive guard every interpolation
 * site calls before quoting a name.
 *
 * STABLE SLUG (CONTEXT sub-decision): `col_name` is minted ONCE at field
 * creation and never re-derived. A later label rename edits `label` only — it
 * must NOT call back into here, or the physical column would drift from its def.
 *
 * The label→slug transform idea is salvaged from the plugin's `keyToLabel`
 * (schemas/loader.ts) — this is its inverse. Node-pure: no DB/UI/expo import.
 */
import { RESERVED_COLUMN_NAMES } from "@/db/reserved-columns";

/** Fallback base when a label slugs to nothing usable. */
const FALLBACK_BASE = "field";

/**
 * Construct a safe column identifier from an arbitrary user label. Lowercases,
 * collapses every run of non-`[a-z0-9]` into a single `_`, trims leading/trailing
 * `_`, and prefixes `f_` when the result is empty or does not start with a
 * letter. The output is GUARANTEED to satisfy `^[a-z][a-z0-9_]*$` — this is
 * construction from a restricted charset, not escaping of user text.
 */
export function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (base === "" || !/^[a-z]/.test(base)) {
    return `f_${base}`;
  }
  return base;
}

/**
 * Produce a unique, safe `col_name` for `label`. Starts from `slugify(label)`
 * (falling back to `field`), then appends `_2`, `_3`, … until the name collides
 * with neither a reserved fixed column nor a name already in `existing`.
 *
 * `existing` MUST include quarantined fields' col_names (Plan 08 builds it from
 * `listDefs({ includeQuarantined: true })`): a quarantined field still owns its
 * physical column, so re-creating its label must yield a suffixed name rather
 * than a duplicate-column collision.
 */
export function makeColName(
  label: string,
  existing: ReadonlySet<string>,
): string {
  const base = slugify(label) || FALLBACK_BASE;
  let candidate = base;
  let n = 2;
  while (RESERVED_COLUMN_NAMES.has(candidate) || existing.has(candidate)) {
    candidate = `${base}_${n}`;
    n++;
  }
  return candidate;
}

/**
 * Defensive guard: true only for a well-formed `[a-z][a-z0-9_]*` identifier.
 * Every site that interpolates a col_name as a quoted identifier calls this
 * first, so a name that somehow bypassed `makeColName` still cannot reach SQL.
 */
export function isSafeColName(col: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(col);
}
