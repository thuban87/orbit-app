# Phase KB Manifest: 08

**Phase:** 08-dashboard-never-contacted-screen
**Processed:** 2026-09-01
**Decision-source tier:** dossier + context-prose — `docs/dossier/08-dashboard.md` is the primary decision record; `08-CONTEXT.md` supplies implementation refinements.
**Source docs consumed:** 30 files — mapped dossier; 08-CONTEXT, RESEARCH, PATTERNS, UI-SPEC, 10 PLANs, 10 SUMMARYs, VERIFICATION, VALIDATION, REVIEWS, CODE-REVIEW, and HANDOFF-NEXT.

## ADRs Produced

| ADR | Title | Source Decisions |
|---|---|---|
| ADR-032 | Flat Dashboard Discovery and In-Query Contact Search | dossier Clusters A–B; CONTEXT Areas 3–4 |
| ADR-033 | Profile Marking and Shared Drag-Reordered Favourites | dossier Clusters C–D; CONTEXT Area 2 |
| ADR-034 | Birthday Banner and Re-query Dashboard Freshness | dossier Clusters E–F |

## ADRs Superseded

| Existing ADR | Superseded by | Scope |
|---|---|---|
| ADR-031 | ADR-032 | Partial: dashboard replaces the Settings-reached search surface; bound local search remains. |

## System Docs Updated

| System Doc | What Changed |
|---|---|
| `docs/systems/contacts.md` | Added guarded favourite marking and shared rank reordering. |
| `docs/systems/app-shell.md` | Documented dashboard Home, sibling routes, and search relocation. |
| `docs/systems/conversational-fuel.md` | Documented dashboard-owned local fuel search and shared SQL fragments. |

## System Docs Created

| System Doc | Covers |
|---|---|
| `docs/systems/dashboard.md` | Dashboard projections, controls, hidden populations, birthdays, and freshness. |

## Runbooks Updated

_None._

## Runbooks Created

_None._

## Deferred / Not Captured

- Status-ring and favourite-marker visual treatment — owner design decisions, not architecture records.
- Birthday notifications, digest, and the snooze writer — explicitly assigned to later phases.
- Pixel UAT evidence — verification activity rather than a KB artifact.

## Phase Stats

- **Plans in phase:** 10
- **Decisions captured:** 6 clusters as 3 ADRs
- **Systems touched:** Dashboard, Contacts, App Shell, Conversational Fuel
- **New gotchas added:** 7
