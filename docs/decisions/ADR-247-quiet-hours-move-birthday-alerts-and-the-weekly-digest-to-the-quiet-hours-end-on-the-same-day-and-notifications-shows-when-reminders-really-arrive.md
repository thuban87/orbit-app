# ADR-247: Quiet Hours Move Birthday Alerts and the Weekly Digest to the Quiet-Hours End on the Same Day, and Notifications Shows When Reminders Really Arrive

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-142, D-152, D-78, D-77 (38.12-CONTEXT.md; mid-execution rulings Q6, Q7, R8); carried D-06
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Picking a reminder time inside quiet hours gave no hint of when reminders would arrive, and the helper copy ("wait until the next morning") did not match the scheduler. While building the arrival line, the phase found that a birthday whose slot fell in quiet hours was skipped altogether. The weekly digest ignored quiet hours. With Allow notifications off, the page still read as if alerts would come, and the Unbound birthday switch stayed live with Birthday alerts off.

## Decision

A birthday alert whose slot falls in quiet hours fires at the quiet-hours end on the birthday itself, plus the contact's usual stagger, instead of being skipped (D-142). If the reminder time or the quiet end has already passed that day, the birthday is still skipped as before. The weekly digest respects quiet hours the same way: it moves to the quiet-hours end on Sunday itself, never Monday, so ADR-055's Sunday delivery stands. One helper does both, `sameDayAllowedInstant` (with `sameDayAllowedHour` for the digest and Settings copy). Decay reminders are unchanged: they still roll to the next allowed morning. Quiet hours that end at midnight fire these alerts at 12:00 AM, accepted as-is (D-152).

Picking a reminder time inside quiet hours shows when reminders will actually arrive, computed with the scheduler's own `nextAllowedFireInstant` (D-78). The helper copy says what the code does: "Reminders wait until quiet hours end; birthday alerts and the weekly digest come when quiet hours end on their own day."

With Allow notifications off, Notifications shows one "paused" line, and the master description reads the same in both states (D-77). "Birthday alerts for Unbound contacts" is disabled, drawn Off, unless Birthday alerts is on (D-06), matching the scheduler's own gate.

## Alternatives Considered

- **Keep skipping a quiet-hours birthday** — rejected (Q6: "keep" the fix).
- **Deliver the digest on Monday morning** after an evening quiet window — the plan's literal reading; not built, since ADR-055 rejected Monday delivery and D-142 says only "at the end of quiet hours".
- **Move a birthday to the next day** — not taken; ADR-041 rejected deferring birthdays and requires them never to roll into the following day.

## Consequences

### Positive

- No birthday alert or digest is lost to quiet hours.
- The Settings copy matches the schedulers.

### Negative

- With quiet hours ending at midnight, alerts can arrive at 12:00 AM.

### Risks

- The digest drift check must use the quiet-adjusted hour, or it reschedules on every launch; it does (`digestFireHour`).

## Implementation

**Key files:**
- `src/services/notifications/fire-instant.ts` — `sameDayAllowedInstant`, `sameDayAllowedHour`, exported `nextAllowedFireInstant`.
- `src/services/notifications/notification-schedule.ts` — birthdays at the quiet-hours end.
- `src/services/notifications/digest-schedule.ts` — `digestFireHour`; the drift check.
- `src/screens/settings-notifications-logic.ts` — `effectiveReminderArrival`, `reminderArrivalLine`, `QUIET_HOURS_HELPER`, `NOTIFICATIONS_PAUSED_LINE`.
- `src/screens/SettingsNotificationsScreen.tsx` — the arrival line, paused line and the disabled Unbound switch.

**Depends on:** ADR-039 (Pre-Scheduled Inexact Decay Reminders); ADR-041 (Notification Settings, Privacy Channels, and Birthday Alerts); ADR-055 (Dedicated Weekly Digest Scheduling and Persisted Notification Policy); ADR-203 (One Orbit Switch, the Disabled Look, Chip Tiers and Visible Swatch Selection)
**Required by:** None
