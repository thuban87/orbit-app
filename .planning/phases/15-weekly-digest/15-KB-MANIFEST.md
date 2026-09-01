# Phase KB Manifest: 15

**Phase:** 15-weekly-digest
**Processed:** 2026-09-01
**Decision-source tier:** dossier — `docs/dossier/14-digest.md`, overlaid by Phase 15 context and implementation artifacts
**Source docs consumed:** 21 files — mapped dossier; CONTEXT, RESEARCH, PATTERNS, UI-SPEC, VALIDATION, VERIFICATION, REVIEW, REVIEWS; plans 01–06; summaries 01–05

## ADRs Produced

| ADR | Title | Source Decisions |
|---|---|---|
| ADR-054 | Live Weekly Digest Retrospective and Overlooked Relationship Read | dossier Clusters A–C; CONTEXT Grey Areas 1–3 |
| ADR-055 | Dedicated Weekly Digest Scheduling and Persisted Notification Policy | dossier Cluster D; CONTEXT delivery and persistence ruling |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|---|---|
| `docs/systems/notifications.md` | Added the independently reconciled weekly trigger, private channel, durable gate, and reset route. |
| `docs/systems/persistence-core.md` | Added migration 005 and the default-on digest setting. |
| `docs/systems/app-shell.md` | Added the Digest route, notification reset, and ready-gated schedule registration. |
| `docs/systems/dashboard.md` | Added the non-badged Your week entry to the separate live surface. |

## System Docs Created

| System Doc | Covers |
|---|---|
| `docs/systems/digest.md` | Live weekly retrospective, overlooked relationship read, and its scheduling boundary. |

## Runbooks Updated

| Runbook | What Changed |
|---|---|
| `docs/runbooks/local-notification-integration.md` | Added the independent singleton-weekly scheduler pattern, durable gate, reset routing, and physical-device smoke coverage. |

## Runbooks Created

_None._

## Deferred / Not Captured

- Markdown export format — explicitly deferred to Phase 16.
- Birthday surfaces — explicitly remain owned by earlier dashboard and notification phases.
- Top-inset UAT polish finding — a non-architectural owner taste decision, not a Phase-15 KB artifact.

## Phase Stats

- **Plans in phase:** 6
- **Decisions captured:** 2 ADRs
- **Systems touched:** Digest, Notifications, Persistence core, App shell, Dashboard
- **New gotchas added:** 7
