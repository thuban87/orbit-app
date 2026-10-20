import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type { SqlExecutor } from "@/db/types";
import {
  ELIGIBLE_AFTER_SECONDS,
  EXPIRE_AFTER_HOURS,
} from "@/logic/assist-eligibility";

export type EligiblePendingAssist = {
  id: number;
  uid: string;
  contact_id: number;
  channel: "call" | "text" | "email";
  endpoint_value: string | null;
  /**
   * The destination as written on the contact's matching contact method
   * (38.14 D-74, D-79): the `display_value` of the method whose canonical value
   * is the stored endpoint (phone for call / text, email for email), falling
   * back to the stored `endpoint_value` when that method no longer exists; null
   * when no endpoint was stored. Shown on device only — never added to History,
   * never transmitted, never in AI context (D-22).
   */
  endpoint_display: string | null;
  handoff_at: string;
  created_at: string;
  contact_name: string;
  /** The contact's stored RELATIVE photo path, rendered through Avatar (38.6 D-14); null without one. */
  contact_photo: string | null;
};

export type ReachRoutes = {
  call: boolean;
  text: boolean;
  email: boolean;
  primaryPhone: ContactMethodRow | null;
  primaryEmail: ContactMethodRow | null;
  hidden: boolean;
};

const ELIGIBILITY_SQL = `
  a.status = 'pending'
  AND (CAST(strftime('%s', ?) AS INTEGER) - CAST(strftime('%s', a.handoff_at) AS INTEGER)) >= ${ELIGIBLE_AFTER_SECONDS}
  AND (CAST(strftime('%s', ?) AS INTEGER) - CAST(strftime('%s', a.handoff_at) AS INTEGER)) <= ${EXPIRE_AFTER_HOURS * 60 * 60}`;

/**
 * Read the stable, eligible pending queue with the target name (and photo) and
 * the destination line (38.14 D-74 / D-79: a read-only lookup of the contact's
 * matching method, no schema change) needed by the banner and sheet. Every
 * stored endpoint is a method's `canonical_value` (Compose, Profile and the
 * Reach Out router all hand off `canonical_value`), so the match is exact.
 */
export function listEligiblePendingAssists(
  exec: SqlExecutor,
  now: string,
): Promise<EligiblePendingAssist[]> {
  return exec.getAllAsync<EligiblePendingAssist>(
    `SELECT a.id, a.uid, a.contact_id, a.channel, a.endpoint_value,
            COALESCE(
              (SELECT m.display_value
                 FROM contact_methods m
                WHERE m.contact_id = a.contact_id
                  AND m.canonical_value = a.endpoint_value
                  AND m.method_type =
                      CASE a.channel WHEN 'email' THEN 'email' ELSE 'phone' END
                ORDER BY m.is_primary DESC, m.display_order ASC, m.id ASC
                LIMIT 1),
              a.endpoint_value
            ) AS endpoint_display,
            a.handoff_at, a.created_at, c.name AS contact_name,
            c.photo AS contact_photo
       FROM interaction_assists a
       JOIN contacts c ON c.id = a.contact_id
      WHERE ${ELIGIBILITY_SQL}
      ORDER BY a.created_at DESC, a.id DESC`,
    [now, now],
  );
}

/** Count banner-eligible pending assists using the same durable time window. */
export async function countPending(
  exec: SqlExecutor,
  now: string,
): Promise<number> {
  const row = await exec.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM interaction_assists a
       JOIN contacts c ON c.id = a.contact_id
      WHERE ${ELIGIBILITY_SQL}`,
    [now, now],
  );
  return row?.count ?? 0;
}

/** Derive every available route from already-loaded actionable primary methods. */
export function deriveReachRoutes(actionable: {
  phone: ContactMethodRow | null;
  email: ContactMethodRow | null;
}): ReachRoutes {
  const call = actionable.phone !== null;
  const email = actionable.email !== null;
  return {
    call,
    text: call,
    email,
    primaryPhone: actionable.phone,
    primaryEmail: actionable.email,
    hidden: !call && !email,
  };
}
