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
  handoff_at: string;
  created_at: string;
  contact_name: string;
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

/** Read the stable, eligible pending queue with the target name needed by the banner. */
export function listEligiblePendingAssists(
  exec: SqlExecutor,
  now: string,
): Promise<EligiblePendingAssist[]> {
  return exec.getAllAsync<EligiblePendingAssist>(
    `SELECT a.id, a.uid, a.contact_id, a.channel, a.endpoint_value,
            a.handoff_at, a.created_at, c.name AS contact_name
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
