/**
 * Decay-notification eligibility predicate (NOTIF-03) — the "eligible to receive
 * a decay nudge at SOME future date" SQL fragment, composed ENTIRELY from
 * `status.ts` code-constants. Follows status.ts's string-constant posture: this
 * module exports only an SQL STRING CONSTANT and issues NO write statement.
 *
 * =============================================================================
 * WHAT THIS PREDICATE IS (review H5 — the phase premise is PRE-SCHEDULED dated
 * notifications that fire while the app is CLOSED): the ELIGIBLE set is the FULL
 * set of contacts that could be nudged at some future due date — NOT only those
 * currently overdue. A stable or wobble contact must be schedulable so its
 * FUTURE due-date fire is armed before it silently crosses overdue with the app
 * shut. There is therefore intentionally NO lower `>= WOBBLE_MAX` bound. The
 * SCHEDULED subset is bounded downstream in 11-10 (HORIZON_DAYS + a soonest-N
 * cap — Android's pending-notification cap silently drops schedules past it);
 * bounding here would defeat H5.
 *
 * EXCLUSIONS (the NOTIF-03 suppressors, all in-query, never a UI .filter()):
 *   - never-contacted  (last_contact IS NULL)
 *   - rarely_responds  (= 1)
 *   - muted            (reminders_off = 1)
 *   - archived         (archived_at IS NOT NULL)
 *   - rogue            (progress >= ROGUE_K — read from status.ts, NEVER re-typed)
 *
 * A FUTURE SNOOZE IS NOT AN EXCLUSION. A snoozed contact stays eligible and is
 * surfaced WITH its `snooze_until` (notification-read.ts) so the scheduler arms
 * the reminder at max(dueDate, snooze_until) — firing AFTER the snooze window,
 * never during it (T-11-SUP: honoured without disclosure). Dropping the contact
 * here would lose the future fire entirely.
 *
 * TIMEZONE (matches status.ts:14-24): PROGRESS_SQL converts only `now` via
 * `date('now','localtime')`; the stored `last_contact` is already local
 * wall-clock and is truncated with a BARE `date()` — never re-run through
 * 'localtime'. This fragment inherits that behaviour by reusing PROGRESS_SQL
 * verbatim; it adds no date math of its own.
 *
 * INJECTION (T-11-INJ): the ONLY interpolated values are the closed status.ts
 * code-constants `PROGRESS_SQL` and `ROGUE_K`. There is no user free-text and no
 * runtime value here — the predicate is entirely closed constants (every runtime
 * value in the eventual query, of which there are none, is `?`-bound).
 *
 * `WOBBLE_MAX` is deliberately NOT imported: the removed lower bound was its only
 * use here, so importing it would be dead (biome noUnusedImports). The single
 * rogue cutoff lives in status.ts (`ROGUE_K`) and is read, never restated
 * (CLAUDE.md / RESEARCH anti-pattern: never a second rogue constant).
 * =============================================================================
 */
import { PROGRESS_SQL, ROGUE_K } from "@/db/status";

/**
 * The decay-eligibility WHERE fragment (no leading `WHERE`), intended to be
 * dropped into a `FROM contacts` read with BARE column names (no table alias) —
 * matching status.ts's alias-free PROGRESS_SQL. A contact is decay-eligible when
 * ALL hold: contacted, not rarely-responds, not muted, not archived, and
 * progress below the rogue cutoff. NO lower bound (H5) and NO snooze exclusion
 * (the future-snoozed contact is surfaced, not dropped).
 */
export const DECAY_ELIGIBLE_WHERE = `last_contact IS NOT NULL
     AND rarely_responds = 0
     AND reminders_off = 0
     AND archived_at IS NULL
     AND (${PROGRESS_SQL}) < ${ROGUE_K}`;
