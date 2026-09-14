# Phase 37: Settings & Personalization — Discussion Log

**Date:** 2026-09-14
**Mode:** discuss (dossier-grounding + collision check + missing-decision sweep)
**For human reference only** — not consumed by downstream agents.

## Framing

The Phase 37 dossier was authored externally without the milestone-2 cross-dossier collision
audit the earlier dossiers received. This discuss ran that check: (1) ground the dossier's
intended changes against the post-Phase-36 repo and flag issues; (2) sweep for missing decisions
and settle them with the owner.

## Grounding check — findings (no decision needed)

- Phase 36 is COMPLETE (STATE) → the dossier's "Phase 36 in flight, revisit at planning time"
  notes (§I, §J, §S) are now immediately actionable.
- Backup format is v5 on disk (Phase 36 bumped it). The prior 37-CONTEXT shim was stale
  ("no dossier exists", "format v4") — replaced by this discuss.
- Galaxy-conditional appearance controls are trivial (one-line guard), not the risk §D feared.
- Data & Backup dual-home (§I) is feasible — Backup screens are not tab-bound.
- Settings is a monolithic 2,168-line screen with no category routes; §A/§M require decomposition.
- §G birthday *notification* settings (ADR-041) vs Phase 38 birthday *presentation* (ADR-076) —
  distinct; no collision. Live "birthday alerts for unbound" toggle correctly kept.
- ADR-080 Backup tab: removal deferred; Phase 37 only adds an entry point — no reversal.

## Decisions settled with owner

| # | Area | Options presented | Owner choice |
|---|------|-------------------|--------------|
| Q1 | Sun color (§D vs ADR-047) | Self-star only (matches ADR) / Any center gets a chosen color (reverses ADR-047) | **Self-star only** → D-02 |
| Q2 | Category CRUD (stub vs §P; none exists) | Own phase + reserve route / Build full CRUD here / Minimal CRUD + defer cascade | **Own phase; reserve route** → D-03 |
| Q3 | Dropped stub seams (multi) | Compose default mode / Self-name editor / Dashboard right-swipe | **All three** → D-04 |
| Q4 | Profile managers (per-contact; stub route dropped) | Leave contact-scoped / Expose global default template/background | **Expose global default** → D-05 |

## Deferred / redirected

- Category Management (CRUD + cascade) → own future phase; roadmap row owed (D-03).
- Theme-merge (Galaxy/Standard → Dark/Light) → PARKED separate phase; Appearance built on current
  package model, accepts later rework.
- Backup tab removal, Settings search/reset/General/Advanced/deep-links → deferred per §R.
