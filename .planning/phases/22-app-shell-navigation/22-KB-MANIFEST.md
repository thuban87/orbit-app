# Phase KB Manifest: 22

**Phase:** 22-app-shell-navigation
**Processed:** 2026-09-06
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md`, designated by the phase CONTEXT shim
**Source docs consumed:** 26 files (the mapped-in-context dossier plus 25 Phase-22 artifacts)

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-082 | Universal Capture FAB, Canonical Picker, and Truthful Quick Log | Dossier amendment; §§F–H |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/app-shell.md` | Four-tab shell, nested reset, chrome, and universal capture contract. |
| `docs/systems/dashboard.md` | Dashboard tab-root and universal-FAB integration. |
| `docs/systems/contacts.md` | Canonical local action-picker read and ordering. |
| `docs/systems/interaction-log.md` | Commit-truthful shell Quick Log and Undo consumer. |
| `docs/systems/notifications.md` | Nested Dashboard-tab notification routing. |
| `docs/systems/widget.md` | Nested Dashboard-tab widget-link routing. |
| `docs/systems/orrery.md` | Post-Quick-Log local re-query boundary. |

## System Docs Created

_None._

## Runbooks Updated / Created

_None._

## Deferred / Not Captured

- Phase-dossier map omission for Phase 22 — CONTEXT identifies the authoritative dossier, but map-process metadata was outside the approved output plan.
- Pre-existing ComposeScreen Biome findings — unrelated to shell extraction.
- Later workflow forms and Group Event persistence — semantic placeholder routes only; those phases own domain behavior.

## Phase Stats

- **Plans in phase:** 6
- **Decisions captured:** 3 as 1 ADR
- **Systems touched:** App shell, Dashboard, Contacts, Interaction log, Notifications, Widget, Orrery
- **New gotchas added:** 9
