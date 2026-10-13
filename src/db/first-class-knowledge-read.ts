/** Local, read-only fields displayed by the Things-to-Remember surface. */
import type { SqlExecutor } from "@/db/types";

export interface FirstClassFields {
  birthday: string | null;
  socialBattery: string | null;
  intervalDays: number | null;
  categoryName: string | null;
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
