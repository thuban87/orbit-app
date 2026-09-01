# Phase KB Manifest: 05

**Phase:** 05-photos
**Processed:** 2026-09-01
**Decision-source tier:** dossier — `docs/dossier/07-photos.md` was the sole decision source.
**Source docs consumed:** 25 files (420,151 bytes): mapped dossier; 8 plans; 8 summaries; research; patterns; UI spec; validation; verification; code review; reviews; deferred-items.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-020 | Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download | dossier `07-photos` Cluster A |
| ADR-021 | Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup | dossier `07-photos` Cluster B; `[photos → data/crud/fields]` |
| ADR-022 | Tokenized Deterministic Initials Avatars | dossier `07-photos` Cluster C |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/contacts.md` | Added dedicated contact/self photo references, avatar reads, and lifecycle integration. |
| `docs/systems/custom-fields.md` | Replaced the photo placeholder with the shared pipeline and staged-file handling. |
| `docs/systems/app-shell.md` | Added crop navigation, self-photo settings, avatar tokens, and reconciliation registration. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/photos.md` | Local image acquisition, crop, persistence, rendering, and cleanup. |

## Runbooks Updated

_None._

## Runbooks Created

_None._

## Deferred / Not Captured

- Export/restore base64 photo payload — backup-domain implementation is deferred to its owning phase.
- Widget, orrery, and notification photo integrations — deferred to their owning phases.
- Remaining custom-field cancel-path and cache edge cases — retained as system-doc gotchas; they do not change the accepted architecture.

## Phase Stats

- **Plans in phase:** 8
- **Decisions captured:** 3 as 3 ADRs
- **Systems touched:** Photos, Contacts, Custom Fields, App Shell
- **New gotchas added:** 9
