/**
 * Temporary Off Limits shim (Phase 38.10). It keeps `listFuelForEditor` and
 * `FuelItem` compiling for the contact form screens until plans 14, 15 and 17
 * retarget those screens; plan 18 deletes this module.
 *
 * It reads the `off_limits` table only. A pure, read-only SELECT: no
 * transaction, the contact id is the sole `?`-bound value, no network.
 */
import type { FuelKind } from "@/db/fuel-dao";
import type { SqlExecutor } from "@/db/types";

/**
 * One Off Limits entry in the legacy editor row shape. Since migration 033 the
 * shim reads `off_limits` only, so `kind` is always `off_limits` and `source`
 * always `user` (Phase 38.10 plan 02; plan 18 deletes this module).
 */
export interface FuelItem {
  id: number;
  contact_id: number;
  kind: FuelKind;
  label: string | null;
  text: string | null;
  url: string | null;
  created_at: string;
  /** Always `user` in the shim. */
  source: string;
}

/**
 * The editor list: a contact's Off Limits entries in the legacy row shape,
 * newest first (`id DESC` breaks a created_at tie). `contact_id` is the sole
 * bound value.
 */
const LIST_FUEL_FOR_EDITOR = `SELECT id, contact_id, 'off_limits' AS kind, label, text, url,
         created_at, 'user' AS source
    FROM off_limits
   WHERE contact_id = ?
   ORDER BY created_at DESC, id DESC`;

/**
 * Read a contact's Off Limits entries for the legacy editor hosts,
 * newest-first. Returns `[]` when there are none; other contacts' rows are
 * excluded. Pure read — no transaction.
 */
export function listFuelForEditor(
  exec: SqlExecutor,
  contactId: number,
): Promise<FuelItem[]> {
  return exec.getAllAsync<FuelItem>(LIST_FUEL_FOR_EDITOR, [contactId]);
}
