# Phase 29: Orrery Camera, Scale & Exploration - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Deliver Orbit's release-quality Orrery exploration model over the existing Orrery visualization and relationship-health semantics: one canonical status visualization with a constrained 2.5D inspection camera (pan/pinch/tilt/yaw), perspective and semantic zoom, focus and cluster-focus behavior, recentering and canonical north, scalable high-count geometry, density presets, built-in Systems and their switcher, lightweight relationship satellites, and accessible alternatives. Custom System authoring is split into the later sibling Orrery Systems phase.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; coordinated new-preference wire emission/versioning remains Phase 36's final plan. Baseline correction 2026-09-07: backup format 4 already shipped; this phase keeps current emission unchanged. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** One canonical Orrery view (E-03). The Status / Relationship mode split, its mode toggle, and the relationship-morph behavior are simplified *away*, not preserved because code exists — ADR-048 is superseded by ADR-077. Do not introduce a second Orrery mode to replace the removed one.
- **D-05:** Never-contacted bodies enter the All Contacts and Not Contacted Systems by **widening the read explicitly and by population** (E-02) — never by deleting the never-contacted exclusion from the default orrery read, or they leak into every view. They are placed at a fixed neutral resting angle with neutral styling and **no fabricated interval progress**; ADR-011 still forbids presenting a never-contacted contact as decaying.
- **D-06:** Orrery persistence today is only `sun_contact_id`, `self_sun_colour`, and `contacts.ring_seq` (R-05). Density preset, satellites toggle, and last-active System are new durable `app_settings` columns (portable via the backup manifest). This migration may be merged with Phase 30's Systems migration — decide the split once, explicitly.
- **D-07:** Camera state gets **no schema and no persistence** (R-05 trip-wire). It is restored only across `Orrery → Profile → Back` within a navigation session and returns to canonical Home on fresh launch or fresh Orrery visit.
- **D-08:** Consume Phase 23's existing live Reduced Motion hook, read it *from the Skia render loop* — never drive animation from React state — and pause on `useIsFocused === false` and `AppState` background. User-controlled pan/zoom/tilt/yaw stay available under Reduced Motion. Baseline correction 2026-09-07: R-17's historical absence is superseded by `src/theme/use-reduced-motion.ts` and its current canvas/sun consumers; the consumption and lifecycle decisions are unchanged.
- **D-09:** Relationship Satellites depend on the Phase 24 relationships model (R-01/R-05 trip-wire). Do not plan them against an assumed table; verify the model exists on disk. Satellites get no status, Gravity, frequency, rails, System/Dashboard membership, logging, Profile, or satellites of their own.
- **D-10:** Do not hardcode Category names — Category CRUD and its deletion fallout are a STUB-CONTRACT to Phase 37. Performance claims for this phase cannot be made on the desktop emulator (Skia render loop); measure on the phone, and route density/neighbor tuning and large-System perf to the Phase 18-equivalent hardening phase.
- **D-11 (owner ruling, 2026-09-07):** When the globally configured contact sun is excluded from the selected System, hide its relationship satellite moons and their Orrery relationship context. The sun itself remains visible and actionable under the existing global-sun identity/lifecycle policy; it does not become a System or companion member. Its satellites/context may appear again when the parent qualifies in the selected System and the existing enabled/semantic-visibility rules permit. Asked whether that excluded sun's moons should remain visible, the owner replied: “I would say hide them for now”. This resolves the dossier's unspecified parent-membership case; it does not defer Phase 29's satellite capability.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-08-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-077-single-canonical-orrery-with-a-constrained-inspection-camera.md` — one canonical status Orrery with a bounded inspection camera; supersedes the status/relationship mode split
- `docs/decisions/ADR-011-query-time-status-and-never-contacted-segregation.md` — never-contacted contacts are segregated at query time and never rendered as decaying

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: custom System authoring (create/rename/edit/delete, predicates, manual membership, previews) — that is the sibling Orrery Systems phase; the polished spin/shedding/capture System-switch animation (a simple functional transition suffices here); unrestricted true-3D/free-flight or below-plane camera movement; and any contact-to-contact social-graph or speculative graph schema (`contact_level`, graph-parent, moon-owner).
</deferred>

---
*Phase: 29-orrery-camera-scale-exploration*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
