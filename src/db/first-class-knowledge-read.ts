/** Local, read-only fields displayed by the Things-to-Remember surface. */
import { getImpactInputs } from "@/db/impact-read";
import type { SqlExecutor } from "@/db/types";
import type { GravityResult } from "@/services/gravity-logic";
import {
  computeContactGravity,
  computeContactIntensity,
} from "@/services/impact";
import type { IntensityResult } from "@/services/intensity-logic";

export interface FirstClassFields {
  birthday: string | null;
  socialBattery: string | null;
  intervalDays: number | null;
  categoryName: string | null;
}

export interface FirstClassDerived {
  gravity: GravityResult | null;
  intensity: IntensityResult | null;
}

/**
 * Read the durable first-class fields in one local SELECT. Birthday stays raw
 * stored text so the caller cannot accidentally introduce a UTC date shift.
 */
export async function getFirstClassFields(
  exec: SqlExecutor,
  contactId: number,
): Promise<FirstClassFields | null> {
  const row = await exec.getFirstAsync<{
    birthday: string | null;
    social_battery: string | null;
    interval_days: number | null;
    category_name: string | null;
  }>(
    `SELECT c.birthday, c.social_battery, c.interval_days,
            cat.name AS category_name
       FROM contacts c
       LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE c.id = ?`,
    [contactId],
  );
  if (!row) {
    return null;
  }
  return {
    birthday: row.birthday,
    socialBattery: row.social_battery,
    intervalDays: row.interval_days,
    categoryName: row.category_name,
  };
}

/**
 * Derive gravity and intensity from one local impact read. These values are
 * intentionally never stored: they depend on history and the current clock.
 */
export async function getFirstClassDerived(
  exec: SqlExecutor,
  contactId: number,
  now: string,
): Promise<FirstClassDerived | null> {
  const inputs = await getImpactInputs(exec, contactId);
  if (!inputs) {
    return null;
  }

  const hasHistory = inputs.interactions.length > 0;
  const gravity = hasHistory ? computeContactGravity(inputs, now) : null;
  const derivedIntensity = hasHistory
    ? computeContactIntensity(inputs, now)
    : null;
  const intensity =
    derivedIntensity && "available" in derivedIntensity
      ? null
      : derivedIntensity;

  return { gravity, intensity };
}
