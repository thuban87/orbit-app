# Phase KB Manifest: 01

**Phase:** 01-project-scaffold-portable-code
**Processed:** 2026-08-31
**Decision-source tier:** context-prose — no dossier (governed by HANDOFF §4 + `01-CONTEXT.md`, `FND-01…06` requirement IDs), overlaid by `SKELETON.md` and the five PLAN/SUMMARY pairs.
**Source docs consumed:** 10 files — `01-CONTEXT.md`, `SKELETON.md`, `01-VERIFICATION.md`, `01-REVIEW.md`, `01-01-SUMMARY.md`, `01-02-SUMMARY.md`, `01-03-SUMMARY.md`, `01-04-SUMMARY.md`, `01-05-SUMMARY.md`, `docs/runbooks/desktop-build-pipeline.md` (pre-existing in-phase artifact).

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-004 | Flat single-app repository | SKELETON "Repo shape"/"Data layer"; 01-01-SUMMARY |
| ADR-005 | AiService port omits the local/LAN (Ollama) provider | 01-CONTEXT `<decisions>` (owner, 2026-08-14); 01-04-SUMMARY |
| ADR-006 | Theme-token architecture | SKELETON "Theme"; 01-03-SUMMARY; 01-REVIEW WR-01 |
| ADR-007 | Cross-machine Android build pipeline & physical-Pixel FND-01 proof | SKELETON "Deployment"; 01-05-SUMMARY |

## System Docs Updated

_None._

## System Docs Created

_None._ — `persistence-core.md` (routing-table anchor 01) is **deferred to phase 02**: no persistence code exists on disk in phase 01 (`db/database.ts`, `db/transaction.ts`, `db/mutex.ts`, `db/uid.ts`, `db/queries.ts`, `db/migrations/` all land in Phase 2). Phase 01 only registers `expo-sqlite` as a config plugin and creates the empty `db/` folder. Recommend nudging the README routing anchor to 02 when phase 02 is extracted. The theme system doc is intentionally left to milestone-2's theme phase (no M1 routing row).

## Runbooks Updated

_None._

## Runbooks Created

_None by this extraction._ — `docs/runbooks/desktop-build-pipeline.md` already exists, authored in-phase (plan 01-05, commit `c474690`); complete and accurate for phase 01. Referenced by ADR-007.

## ADRs Superseded

_None._

## Deferred / Not Captured

- **Review findings IN-01 (`parseDate` ISO rollover) and IN-02 (stale photo-field URL copy)** — recorded in `01-REVIEW.md`, deferred by the review to their owning phases (import/contacts hardening; Phase 5 photos). Will become gotchas when those subsystem docs are created.
- **Colour-gate robustness (WR-01)** — folded into ADR-006 Risks (accepted for phase 01, fix documented).
- **Ambient stack conventions** (Expo SDK 57 / New Arch, Zustand+persist, Biome, Vitest, `@/*` alias, portrait lock) — pinned by PROJECT.md, ambient in CLAUDE.md; not ADR-worthy.
- **Legacy-compat carryovers** (`SchemaDef.output.path`; `OrbitContact` precomputed status/daysSince/daysUntilDue) — labelled by phase 01 for replacement in Phase 2/3; those are the later phases' decisions.

## Phase Stats

- **Plans in phase:** 5 (01-01 … 01-05)
- **Decisions captured:** 4 as 4 ADRs
- **Systems touched:** scaffold/repo shape, AI provider layer (dormant), theme tokens, build pipeline — none map to a created M1 system doc this phase
- **New gotchas added:** 0 (no system doc created; WR-01 captured in ADR-006 Risks)

---
