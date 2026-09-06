# Phase KB Manifest: 27-dashboard-list-view

**Phase:** Dashboard List View
**Processed:** 2026-09-06
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-06-dashboard-list-view-dossier.md`
**Source docs consumed:** 27 files — mapped dossier; `27-CONTEXT.md`, `27-PATTERNS.md`, `27-RESEARCH.md`, `27-REVIEW.md`, `27-REVIEWS.md`, `27-UAT.md`, `27-UI-SPEC.md`, `27-VALIDATION.md`, `27-VERIFICATION.md`, `deferred-items.md`; plans and summaries 01–08.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-098 | Scan-First, Accessible Dashboard List Rows | dossier §§A–N, Q–T; D-04, D-06–D-11 |
| ADR-099 | Durable Global Dashboard Right-Swipe Action | dossier §O; D-03, D-09 |
| ADR-100 | Relevance-First, Visibility-Safe Dashboard List Search | dossier §§L, R–S; D-12 |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/dashboard.md` | Documented List rendering, favourites, swipes, and List search. |
| `docs/systems/persistence-core.md` | Recorded migration 020 and schema target 20. |
| `docs/systems/backup-restore.md` | Recorded deferred-wire allowlisting for the swipe preference. |
| `docs/systems/contact-knowledge.md` | Documented bounded visible List candidates and search boundaries. |
| `docs/systems/interaction-log.md` | Documented List reuse of the shared Quick Log command. |
| `docs/systems/app-shell.md` | Documented shared Quick Log and Dashboard route reuse. |

## System Docs Created

_None._

## Runbooks Updated

_None._

## Runbooks Created

_None._

## Deferred / Not Captured

- Final status artwork, exact density/gesture/motion values, Card View, and onboarding — explicitly deferred by the dossier.
- Device-only List UAT evidence and the pre-existing `expo-web-browser` launch dependency — verification work, not KB decisions.

## Phase Stats

- **Plans in phase:** 8
- **Decisions captured:** 10 as 3 ADRs
- **Systems touched:** Dashboard, Persistence core, Backup & Restore, Contact Knowledge, Interaction Log, App Shell
- **New gotchas added:** 7
