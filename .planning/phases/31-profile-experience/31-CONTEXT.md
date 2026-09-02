# Phase 31: Profile Experience - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Make the Contact Profile Orbit's release-quality, presentation-first read surface for one relationship — richer and more personal than the Dashboard renderers, yet faster to scan than a form. It delivers a fixed identity Hero over a modular, user-customizable body with reusable layout and background templates, a stats-oriented Relationship Overview, compact remembered-information cards, and stable seams that later phases can deepen without restructuring the screen.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text — this dossier has no standalone amendment block; the resolutions were folded inline, so read the amended §C and §D text as authoritative. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** The Profile "AI draft" entry (`src/screens/ContactProfileScreen.tsx:1075`) is **removed** (E-06 resolved). Drafting stays reachable in two taps via Message → Draft with AI. **ADR-079 supersedes ADR-052** on this point; do not restore a separate Profile AI action.
- **D-05:** An unguarded cadence read on an Unbound profile is an **ADR-062 violation**, not a cosmetic gap (trip-wire): `interval_days` is nullable, `computeContactIntensity` returns `{available:false}`, and Unbound profiles are reachable. Every cadence consumer on this screen — Intensity, Contact Frequency, Status explanation — must guard it.
- **D-06:** The Cycles heatmap and cadence-relative Intensity are **undefined for contacts with no cadence** (R-15). Define the fallback (hide the lens, or a fixed 7 Days / Month window) and decide it **once**, jointly with Phase 32's identical R-15 — not twice, differently.
- **D-07:** Layout/background templates, assignments, per-contact overrides, and expanded/collapsed persistence are **entirely unbuilt** (R-06). The existing single-row `profile` table is the *self record*, not a per-contact layout store — nothing there is reusable. Decide explicitly whether collapsed state is durable and whether it belongs in the backup. Custom snooze end date needs **no schema** (`snooze_until` is already a date; UI + DAO only).
- **D-08:** Phase 24's Contact Knowledge model gates every knowledge section (R-01). Do not plan against Memory types, pinning, visibility, relationships, Last Talked About, or Current Location as if they exist; verify on disk.
- **D-09:** Profile/Hero backgrounds are permitted: the `HANDOFF.md` §7 restriction against backgrounds behind text-heavy screens is **superseded** (owner-approved 2026-09-01). Readability comes from Phase 23's opacity-by-density surface rule, not from restricting placement. Background image-memory cost is a flagged hand-off to release hardening.
- **D-10:** Category assignments for layouts and backgrounds inherit **Category deletion fallout** (trip-wire) — Phase 37 owns Category CRUD, but the fallout behavior for layout/background assignment must be planned here. `Reset Profile Presentation` clears only contact-specific layout/collapse/background overrides — never contact data, Favorite, Snooze, AI permissions, or knowledge items.
- **D-11:** Interaction History is a minimal interim section behind a **replaceable renderer seam** that Phase 32 upgrades without touching layout persistence. Do not build the final heatmap/timeline/drill-down here.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-10-profile-experience-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-10-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-079-on-demand-ai-transparency-and-compose-only-three-suggestion-invocation.md` — AI is invoked from Compose only; supersedes ADR-052 and removes the Profile AI-draft entry
- `docs/decisions/ADR-062-bound-unbound-lifecycle-and-one-way-cadence-assignment.md` — Unbound contacts have no cadence; every cadence consumer must guard the nullable read

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: unrestricted page-builder behavior — arbitrary x/y tile placement, arbitrary resizable tiles, a third nesting level, or manual drag ordering of individual memories; the final Interaction History heatmap/timeline/drill-down UX (Phase 32 owns it); new Status algorithm factors, user-tunable Status weighting, or a separate `Health` metric (explicitly rejected); and advanced background effects (blur/brightness/overlay/filters) or downloadable background packs.
</deferred>

---
*Phase: 31-profile-experience*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
