# Phase KB Manifest: 12

**Phase:** 12-home-screen-widget
**Processed:** 2026-09-01
**Decision-source tier:** dossier + context-prose — `docs/dossier/12-widget.md` was canonical; phase context and shipped artifacts overlaid implementation facts.
**Source docs consumed:** 24 files: mapped dossier; CONTEXT, RESEARCH, PATTERNS; 8 plans; 8 summaries; REVIEWS, UI-SPEC, VALIDATION, and VERIFICATION.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-042 | Shared Status Palette for Dashboard and Widget Rings | dossier Cluster A; CONTEXT status palette |
| ADR-043 | Static Globally Mirrored Favourites Widget | dossier Clusters A, C, D, F |
| ADR-044 | Headless Widget Actions and Dashboard-Rooted Deep Links | dossier Cluster B; CONTEXT interaction affordances |
| ADR-045 | Event-Driven Widget Refresh and Boot Recovery | dossier Cluster E; CONTEXT freshness wiring |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/app-shell.md` | Added widget routing, refresh lifecycle, Settings CTA, and shared status tokens. |
| `docs/systems/dashboard.md` | Added shared status rings and rank-preserving favourites projection. |
| `docs/systems/contacts.md` | Added post-commit refresh publication for contact-visible mutations. |
| `docs/systems/status-engine.md` | Documented refresh-bounded external status presentation. |
| `docs/systems/interaction-log.md` | Added widget-sourced one-tap writes through recency DAO. |
| `docs/systems/conversational-fuel.md` | Added larger-layout fuel consumption and refresh publication. |
| `docs/systems/photos.md` | Added transient base64 widget thumbnails. |
| `docs/systems/capture.md` | Added post-capture widget refresh publication. |
| `docs/systems/notifications.md` | Added refresh after notification-originated marks. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/widget.md` | State-free Android favourites widget, actions, routing, and recovery. |

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `docs/runbooks/desktop-build-pipeline.md` | Added release/debug widget build and device-verification discipline. |

## Runbooks Created

| Runbook | Process |
|---------|---------|
| `docs/runbooks/android-home-screen-widget-integration.md` | Adding or changing the native widget safely. |

## Deferred / Not Captured

- Grid-capacity/bitmap ceiling and reboot-receiver observation — owner-accepted device follow-ups, not new architectural decisions.
- Add-contact UX gap and debug-to-release database anomaly — out-of-scope UAT findings.
- Self-swap profile view and per-instance configuration — explicitly deferred to v2.

## Phase Stats

- **Plans in phase:** 8
- **Decisions captured:** 12 tightly coupled decisions as 4 ADRs
- **Systems touched:** Widget, App shell, Dashboard, Contacts, Status engine, Interaction log, Conversational fuel, Photos, Capture, Notifications
- **New gotchas added:** 14
