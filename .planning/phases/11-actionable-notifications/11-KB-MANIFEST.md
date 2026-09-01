# Phase KB Manifest: 11

**Phase:** 11-actionable-notifications
**Processed:** 2026-09-01
**Decision-source tier:** dossier + context-prose — `docs/dossier/11-notify.md` was canonical; phase context and shipped artifacts overlaid implementation facts.
**Source docs consumed:** 36 files (608K): mapped dossier; CONTEXT, RESEARCH, PATTERNS; 13 plans; 13 summaries; REVIEW, REVIEWS, UAT-NOTES, UI-SPEC, VALIDATION, and VERIFICATION.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-039 | Pre-Scheduled Inexact Decay Reminders | dossier 11 Clusters A–B; CONTEXT timing/cadence |
| ADR-040 | Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing | dossier 11 Cluster C; CONTEXT action routing |
| ADR-041 | Notification Settings, Privacy Channels, and Birthday Alerts | dossier 11 Cluster D; CONTEXT owner reversal and OQ-1/OQ-2 |

## ADRs Superseded

| Existing ADR | Superseded by | Scope |
|--------------|---------------|-------|
| ADR-029 | ADR-039 | Partial: decay notifications no longer show ranked fuel in frozen OS bodies. |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/persistence-core.md` | Added migration 002 and the SQLite app-settings boundary. |
| `docs/systems/contacts.md` | Added snooze/mute behavior and derived reminder state. |
| `docs/systems/interaction-log.md` | Documented notification one-tap and snooze lifecycle writes. |
| `docs/systems/contact-methods.md` | Added reminder entry to Compose with Dashboard-rooted Back behavior. |
| `docs/systems/app-shell.md` | Added notification initialization, reconciliation, and response-gate lifecycle. |
| `docs/systems/dashboard.md` | Documented durable snooze activation and shared reminder semantics. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/notifications.md` | Local reminder scheduling, privacy channels, actions, routing, and purge cleanup. |

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `docs/runbooks/sqlite-migration-pipeline.md` | Added migration 002 as the singleton-settings migration example. |

## Runbooks Created

| Runbook | Process |
|---------|---------|
| `docs/runbooks/local-notification-integration.md` | Adding a reconciled, privacy-safe local notification kind. |

## Deferred / Not Captured

- Killed-app FCM-less mark/snooze and decay body-tap device exercise — remaining physical-device UAT follow-up, not a separate design decision.
- Weekly digest and widget notification reuse — owned by later phases.
- Direct lock-screen visual confirmation — a retained low-risk UAT follow-up after private posting was observed live.

## Phase Stats

- **Plans in phase:** 13
- **Decisions captured:** 3 as 3 ADRs
- **Systems touched:** Notifications, Persistence core, Contacts, Interaction log, Contact methods, App shell, Dashboard
- **New gotchas added:** 13
