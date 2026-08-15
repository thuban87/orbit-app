/**
 * Conversational-fuel read module (FUEL-01/FUEL-02) — the SINGLE shared,
 * user-facing / projection fuel read choke point. A pure, read-only SELECT: NO
 * transaction, every value `?`-bound, no network — and only static column names
 * are literal text (T-07-01). Modelled on `timeline-read.ts`.
 *
 * =============================================================================
 * LOAD-BEARING READ-PATH RULES — READ BEFORE ADDING A READER:
 *   1. This file is the ONLY user-facing / projection fuel read path. Every
 *      projection added later (getRankedFuel, Plan 02; searchFuel, Plan 04) lands
 *      HERE. purge-dao's MAINTENANCE reads — the impact count at `purge-dao.ts:105`
 *      (`SELECT COUNT(*) … FROM fuel`) and the delete fan-out at `:188`
 *      (`DELETE FROM fuel …`) — are a SEPARATE maintenance path and are EXPLICITLY
 *      EXEMPT: do NOT "consolidate" them here (that would duplicate the purge
 *      path). (Addresses review LOW-6.)
 *   2. `listFuelForEditor` is the ONLY projection read that OMITS the off_limits
 *      predicate — you must be able to edit off_limits on the profile, so the
 *      editor list returns EVERY kind. Every OTHER projection (ranked line, search)
 *      MUST exclude off_limits IN-QUERY, never in the UI: the structural
 *      "off_limits never leaves the device / never surfaces at a glance" guarantee
 *      lives in SQL, not in a component that could be refactored away.
 * =============================================================================
 */
import type { FuelKind } from "@/db/fuel-dao";
import type { SqlExecutor } from "@/db/types";

/** One fuel row as rendered by the profile editor. */
export interface FuelItem {
  id: number;
  contact_id: number;
  kind: FuelKind;
  label: string | null;
  text: string | null;
  url: string | null;
  created_at: string;
  /** Provenance (see `FuelSource` in fuel-dao) — a plain string, no CHECK. */
  source: string;
}

/**
 * The editor list: ALL of a contact's fuel, every kind INCLUDING off_limits and
 * every source INCLUDING 'ai', newest-first. `created_at DESC` is the canonical
 * order; `id DESC` is the deterministic tiebreak when two rows share a created_at.
 * `contact_id` is the sole `?`-bound value; only column names are literal text.
 */
const LIST_FUEL_FOR_EDITOR = `SELECT id, contact_id, kind, label, text, url, created_at, source
    FROM fuel
   WHERE contact_id = ?
   ORDER BY created_at DESC, id DESC`;

/**
 * Read a contact's full fuel list for the profile editor, newest-first. Returns
 * `[]` for a contact with no fuel (never throws); rows for other contacts are
 * excluded (`contact_id` bound). This is the ONE read that surfaces off_limits —
 * see the read-path rules above. Pure read — no transaction.
 */
export function listFuelForEditor(
  exec: SqlExecutor,
  contactId: number,
): Promise<FuelItem[]> {
  return exec.getAllAsync<FuelItem>(LIST_FUEL_FOR_EDITOR, [contactId]);
}
