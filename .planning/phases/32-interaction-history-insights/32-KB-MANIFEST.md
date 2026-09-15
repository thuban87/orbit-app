# Phase KB Manifest: 32-interaction-history-insights

**Phase:** 32 — Interaction History & Insights
**Processed:** 2026-09-15
**Decision-source tier:** dossier + context-shim — `docs/dossier/milestone-2/phase-11-interaction-history-insights-dossier-v0.2-group-events.md` (primary, incl. the 2026-09-01 group-events amendment) overlaid by `32-CONTEXT.md` (D-01…D-12 shim) and the binding `planning-notes/phase-11-planning-notes.md`. (M2 dossier numbering ≠ phase numbering; resolved via CONTEXT `canonical_refs`.)
**Source docs consumed:** 15 files — dossier, phase-11 planning-notes, 32-CONTEXT, the 8 plan SUMMARYs, 32-REVIEW, 32-VERIFICATION, 32-UAT, deferred-items.

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-116 | Value-Remapped Interaction Vocabulary and Optional Descriptive Duration | D-03, D-06, D-12; dossier §D-06, §Y |
| ADR-117 | Per-Interaction Allow-AI Consent Gate, Default-Off and Fail-Closed on Restore | D-04; dossier E-05, §V, §W |
| ADR-118 | Bind/Unbind Immutable Lifecycle Events Without a Migration | D-08; dossier §U, §R |
| ADR-119 | Reusable Count-Only History Aggregation and Canonical Single-Contact History Read | D-09, D-10, D-12; dossier §D, §M, §AB |
| ADR-120 | Shared-Window Heatmap and Intensity with Globally-Persisted Lenses | D-11, HIST-03; dossier §C, §E, §F, §G, §K, §N |
| ADR-121 | Rolodex Month/Day/Year History Browser (Reanimated, No Skia) | HIST-08/09/18; dossier §O–§S, §AA |
| ADR-122 | Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet Through the Sole Recency Writer | D-05, HIST-10/12/13; dossier §T, §U, §V, §W, §X |
| ADR-123 | Profile History Section Replacing the Vertical Timeline, with Detailed-Log Backfill Routing | HIST-01/15; dossier §A, §B, §Z |

## ADRs Superseded

| Existing ADR | Superseded by | Scope |
|---|---|---|
| ADR-023 | ADR-116 | partial — the stored channel/quality value vocabulary only; structured-touchpoint architecture, one-tap defaults, and `unspecified` channel remain |
| ADR-024 | ADR-123 | partial — the newest-first profile-timeline refinement surface only; recency-recompute, same-day-row, past/future, and permanent-deletion behavior remain |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/interaction-log.md` | Interactions Tone/channel value vocabulary, `duration`, `allow_ai`; bind/unbind events; vocabulary single-source; gotchas; ADR-116/117/118. |
| `docs/systems/backup-restore.md` | Restore vocabulary remap-on-ingest + `allow_ai` fail-closed both paths; declare-only history prefs; ADR-116/117; changelog. |
| `docs/systems/ai-suggestions.md` | Default-off per-interaction `allow_ai` gate as the note-transmission prerequisite (egress unchanged); ADR-117; gotcha. |
| `docs/systems/app-shell.md` | `EditInteraction`/`LogContact` route registration across Profile-hosting stacks; heatmap/marker theme tokens; ADR-120/122/123. |
| `docs/systems/profile.md` | `renderHistory()` now mounts the full History section; `onOpenKnowledgeChange`; ADR-123. |
| `docs/systems/contact-knowledge.md` | `getCurrentStateHistory` read-only widening; knowledge-change family surfaced in the Detail Sheet; ADR-119. |
| `docs/systems/digest.md` | Gentle-line lockstepped onto the `Negative` Tone value; ADR-116. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/interaction-history.md` | The new History & Insights subsystem: aggregation seam + canonical read, Heatmap/Intensity, Rolodex Browser, Detail Sheet/Interaction Detail/Edit route, and Profile section assembly. |

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `docs/runbooks/sqlite-migration-pipeline.md` | Added Pitfall #9: value-remap migrations need a single-source map, frozen test-pinned CASE arms, same-commit consumer lockstep, and remapping in separate writers (restore-apply). |

## Runbooks Created

_None._

## Index changes

- `docs/systems/README.md` — added the `Interaction history & insights` → `interaction-history.md` row, anchor phase 32.
- `CLAUDE.md` — _None_ (no per-doc KB index; no new top-level concept).

## Deferred / Not Captured

- Device-UAT-only tuning (wheel inertia/feel, dense-grid density, Galaxy wheel artwork) — dossier `[DERIVED]`/`[DEFERRED]` tuning, not decisions.
- IntensityChart caption fix (review WARNING #1, commit `84e4013`) — fixed live and confirmed in UAT; captured as a gotcha in `interaction-history.md`, not an ADR.
- Pre-existing `orrery-controls-render.test.tsx` load failure and uncommitted `tsconfig.json` (`deferred-items.md`) — not Phase-32-caused, out of scope.
- All dossier `[DEFERRED]` items (account analytics, Your Week, group-frequency semantics, historical-frequency reconstruction, etc.) — boundaries, not gaps.
- Group-linked routing (context, `GroupScopePrompt`, scope-gated Edit) — an inert Phase-33 seam (D-12); documented in ADR-119/122, not a standalone decision here.

## Phase Stats

- **Plans in phase:** 8
- **Decisions captured:** 8 ADRs (2 partial supersessions)
- **Systems touched:** interaction-history (new), interaction-log, backup-restore, ai-suggestions, app-shell, profile, contact-knowledge, digest
- **New gotchas added:** ~20 across the touched/created docs
