/**
 * Notification read layer (NOTIF-03/04) — the SINGLE read source the decay +
 * birthday scheduler (11-10) asks "who could be notified, and from what base
 * date?". Pure READ-ONLY, dashboard-read.ts posture: no transaction, no writer,
 * no migration, no network — async `getAllAsync` only (NEVER the sync variants).
 * On-device SQLite; local-first.
 *
 * =============================================================================
 * IT RE-USES, NEVER RE-DERIVES:
 *   - the decay-eligibility predicate: `DECAY_ELIGIBLE_WHERE` from
 *     `decay-suppression.ts`, itself composed from status.ts's `PROGRESS_SQL` /
 *     `ROGUE_K` — the single shared rogue cutoff is read, never re-typed here.
 *   - the birthday candidate shape: the same
 *     `archived_at IS NULL AND birthday IS NOT NULL` population as
 *     dashboard-read.ts's `listBirthdayCandidates` (the banner source).
 *
 * TWO READS, DELIBERATELY DIFFERENT SUPPRESSION RULES:
 *
 * 1. `listDecayEligibleCandidates` — every SCHEDULABLE contact (stable, wobble,
 *    OR overdue — NOT only currently-overdue; review H5), excluding only the
 *    NOTIF-03 suppressors (never-contacted, rarely_responds, muted, archived,
 *    rogue). Returns `snooze_until` on every row: a future snooze is NOT an
 *    exclusion — the scheduler arms the reminder at max(dueDate, snooze_until),
 *    so 11-10 needs the raw value. Also returns `last_contact` + `interval_days`
 *    so 11-10 can derive each due date, the weekly re-nag cadence, and the
 *    fire base. Ordered `id` ASC — a DETERMINISTIC candidate order (item C):
 *    11-10's stagger keys on contactId and its soonest-N cap needs a stable base
 *    order; never rely on SQLite's implicit rowid order.
 *
 * 2. `listBirthdayNotificationCandidates` — every NON-ARCHIVED contact with a
 *    birthday (NOTIF-04), ignoring EVERY decay suppressor (a muted / snoozed /
 *    rogue contact STILL gets a birthday nudge — mirrors the 08-dashboard
 *    banner). NO day-of JS filter here: 11-10 computes each one's next day-of
 *    occurrence via the single `daysUntilBirthday` parser (birthday-logic.ts) —
 *    the raw birthday rows are returned so both Obsidian day-of/Feb-29 bugs stay
 *    fixed in that one parser and are never re-implemented. Ordered `id` ASC.
 *
 * INJECTION: both queries are static strings; the only interpolated value is the
 * closed `DECAY_ELIGIBLE_WHERE` fragment (status.ts code-constants). No user
 * free-text; no runtime value is interpolated (there are none to bind).
 * =============================================================================
 */
import type { SqlExecutor } from "@/db/types";
import { DECAY_ELIGIBLE_WHERE } from "@/services/notifications/decay-suppression";

/**
 * One decay-eligible candidate. `last_contact` + `interval_days` let 11-10
 * derive the due date; `snooze_until` (nullable) is the snooze base so the
 * scheduler fires at max(dueDate, snooze_until) — surfaced, never used to drop
 * the row.
 */
export interface DecayEligibleCandidate {
  id: number;
  name: string;
  last_contact: string;
  interval_days: number;
  snooze_until: string | null;
}

/** A birthday-notification candidate — a non-archived contact with a birthday. */
export interface BirthdayNotificationCandidate {
  id: number;
  name: string;
  birthday: string;
}

/**
 * Every decay-schedulable contact (stable / wobble / overdue) with its snooze
 * base, excluding the NOTIF-03 suppressors. The full ELIGIBLE set — 11-10 bounds
 * the SCHEDULED subset by HORIZON_DAYS + a soonest-N cap (item A). Ordered by id
 * for a deterministic candidate order (item C).
 */
export function listDecayEligibleCandidates(
  exec: SqlExecutor,
): Promise<DecayEligibleCandidate[]> {
  return exec.getAllAsync<DecayEligibleCandidate>(
    `SELECT id, name, last_contact, interval_days, snooze_until
       FROM contacts
      WHERE ${DECAY_ELIGIBLE_WHERE}
      ORDER BY id`,
  );
}

/**
 * Every non-archived contact with a birthday — the next-occurrence day-of
 * computation (via `daysUntilBirthday`) is 11-10's job, so the raw rows are
 * returned here. Applies NO decay suppressor (NOTIF-04). Ordered by id (item C).
 */
export function listBirthdayNotificationCandidates(
  exec: SqlExecutor,
): Promise<BirthdayNotificationCandidate[]> {
  return exec.getAllAsync<BirthdayNotificationCandidate>(
    `SELECT id, name, birthday
       FROM contacts
      WHERE archived_at IS NULL AND birthday IS NOT NULL
      ORDER BY id`,
  );
}
