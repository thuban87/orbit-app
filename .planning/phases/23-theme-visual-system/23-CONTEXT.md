# Phase 23: Theme & Visual System - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Define and build Orbit's cross-app visual constitution for the release-quality milestone: theme packages (Galaxy / Standard) and appearance modes as independent axes, accent and background personalization, surface/glass treatment, typography, geometry, spacing, status semantics, the icon system, modal/button hierarchy, visual accessibility, ambient motion, and theme persistence. It establishes reusable visual primitives rather than redesigning individual screens.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04 (E-09, resolved):** App-wide preset backgrounds behind text-heavy screens **supersede** `HANDOFF.md` §7's starfield-placement rule (owner ratified 2026-09-01; a supersession note was added to §7). Plan against the dossier, not §7's original text. HANDOFF's tap-to-freeze and live creeping-motion behaviors were already superseded by ADR-048 — do not reinstate them.
- **D-05 (R-17 REPLAN):** Status glyphs, the semantic icon registry, and reduced-motion support have **no existing foundation** — status today is colour + border weight only, there is no icon registry anywhere in `src/`, and there are zero usages of `isReduceMotionEnabled`/`useReducedMotion`. Phases 2/8/9/11 (now 23 and the renderer phases) all assume all three. This phase must deliver them as first-class deliverables **before** the renderer phases plan against them; never fork a second icon source.
- **D-06 (R-17 trip-wire):** Every colour resolves through theme tokens, **including inside Skia draw calls**. Status glyphs and the icon registry must not hardcode colour.
- **D-07 (R-17 trip-wire):** Animation is never driven from React state. The reduced-motion hook must be readable from the Skia render loop without per-frame `setState`.
- **D-08 (R-16 REPLAN):** Theme preferences are new durable settings. Today's AsyncStorage `orbit-theme` key holds only mode + presetId, there is exactly one preset (`space-dark`) and **no light palette**, and AsyncStorage prefs are not in the backup. Owner resolution: theme package, appearance mode, accent, background, and per-package memory all become `app_settings` columns; migrating the existing `orbit-theme` value into them is this phase's job (read-once-then-clear vs. one-time import is the plan's call).
- **D-09 (R-16 trip-wire):** Every new key must be added to `PORTABLE_SETTINGS_KEYS` so the Phase 16/backup format bump carries them.
- **D-10:** Theme package and appearance mode are **independent axes** yielding all four combinations; Follow System ships from the start and tracks the OS setting live; first launch defaults to Galaxy + Follow System; theme-critical preferences restore before the main UI renders so no wrong-theme flash is visible.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry — including exact font families, token values, animation timings, background assets, and the accent palette.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-02-theme-visual-system-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-02-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- No new ADR governs this phase. Its single audit resolution (E-09) was applied as a supersession note in `HANDOFF.md` §7 on 2026-09-01, ratifying app-wide preset backgrounds behind text-heavy screens over §7's "dashboard/orbit screens only" rule — read §7 with its supersession note, and treat ADR-048 (tap-to-freeze / creeping motion already superseded) as in force.

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Explicitly do-not-build here: a **fully custom Orbit icon family** (only the registry that enables a later swap is required) and **user-uploaded custom backgrounds** (preset library only this milestone). Also out: downloadable/remote theme or background packs and any CDN/backend appearance delivery, a full illustration library, user-controlled density, and an unrestricted accent picker.
</deferred>

---
*Phase: 23-theme-visual-system*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
