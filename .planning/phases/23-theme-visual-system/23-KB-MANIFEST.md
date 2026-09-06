# Phase KB Manifest: 23

**Phase:** 23-theme-visual-system
**Processed:** 2026-09-06
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-02-theme-visual-system-dossier.md` (overlayed by the Phase 23 corpus)
**Source docs consumed:** 27 files (5,233 lines)

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-083 | Durable Multi-Package Theme Configuration and Restore-Before-Paint | dossier §§A, C–D; CONTEXT D-03, D-08–D-10 |
| ADR-084 | Four Semantic Theme Palettes, Curated Accents, and Contrast Validation | dossier §§B–C, Q; CONTEXT D-06 |
| ADR-085 | Live Reduced-Motion Signal for Skia Ambient Animation | dossier §§G, R; CONTEXT D-05, D-07 |
| ADR-086 | Semantic Icons and Accessible Interaction Primitives | dossier §§H–M, O–P |
| ADR-087 | Bundled Background Presets and Package-Specific Surface Treatment | dossier §§E–F, Q; CONTEXT D-04, D-06 |

## ADRs Superseded

| Existing ADR | Superseded by | Scope |
|--------------|---------------|-------|
| ADR-006 | ADR-083 | partial — replaces AsyncStorage/single-preset selection; token architecture remains |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/app-shell.md` | Added theme boot, appearance controls, and shared interaction primitives. |
| `docs/systems/persistence-core.md` | Added migration-015 durable theme settings. |
| `docs/systems/backup-restore.md` | Documented allowlisted, un-emitted theme keys in format 3. |
| `docs/systems/orrery.md` | Documented live reduced-motion gating for ambient animation. |

## System Docs Created

_None._

## Runbooks Updated

_None._

## Runbooks Created

| Runbook | Process |
|---------|---------|
| `docs/runbooks/theme-visual-system-maintenance.md` | Maintains packages, option IDs, contrast, backgrounds, and migration-safe changes. |

## Deferred / Not Captured

- Final background artwork and production-screen adoption — intentionally deferred; phase ships bundled placeholders and infrastructure only.
- Galaxy Dark destructive contrast owner values — measured below AA but not auto-retuned.

## Phase Stats

- **Plans in phase:** 8
- **Decisions captured:** 5 as 5 ADRs
- **Systems touched:** app shell, persistence core, backup/restore, orrery
- **New gotchas added:** 5
