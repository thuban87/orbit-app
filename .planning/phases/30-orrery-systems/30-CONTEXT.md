# Phase 30: Orrery Systems - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Deliver named, dynamically resolved subsets of contacts ("Systems") that the user can author, manage, switch between, and persist in the Orrery. A System is a live view over current contact data — not a static snapshot — with a dedicated authoring HUD, a management screen, and safeguards for empty, broken, and large memberships. It consumes Phase 29's camera/projection/renderer rather than redefining them.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask. This dossier carries **no** dated 2026-09-01 amendment block and no auto-fixes; all body decisions stand as originally written, and no escalation routed here — read `phase-08-planning-notes.md` first for the E-02/E-03 constraints this phase inherits.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** Systems persistence is **entirely unbuilt** (R-05). Today the only orrery persistence is `sun_contact_id` + `self_sun_colour` (`003-orrery-settings.ts:38-48`) and `contacts.ring_seq`; no systems/rules/include-exclude/order/visibility state exists. This phase creates the Systems table set (definitions, rule rows, explicit inclusion/exclusion rows, with ordering and visibility as definition columns). Verify all of this against the files on disk before asserting it.
- **D-05:** The last-active System is a **preference**, not a Systems-table row — it belongs in `app_settings` (possibly sharing Phase 29's orrery-prefs migration). Per-System camera position and per-System density are out of scope.
- **D-06:** Systems must be serializable by the backup bump (R-09). Backup format 3 (`src/backup/export-manifest.ts:45-81`) has no Systems; the v4 bump is Phase 36's final plan, so this phase **only declares its entity shape plus validation and orphan-repair expectations** — it does not bump the format itself.
- **D-07:** Category deletion fallout is real and is owned here (trip-wire): deleting a Category removes its generated System, and a custom-System rule referencing a deleted Category stays visible as *needing attention* rather than being silently deleted or rewritten — other valid rules and manual inclusions keep resolving. Category CRUD itself is Phase 37 and calls this handling; build no Category/System reconciliation wizard.
- **D-08:** The knowledge graph **cannot enumerate SQL writers** (trip-wire). Before asserting any invariant about the tables this phase adds, read every writer of them by hand.
- **D-09:** Reduced motion consumes Phase 23's hook (R-17), which does not exist yet — the Reduced Motion System-switch path (simpler crossfade/reposition instead of spin + shedding/capture) depends on it landing first. Do not plan against an assumed hook.
- **D-10:** Consume Phase 29 rather than redefining it: camera, Home framing, projection, density, focus/cluster focus, high-count rendering, the switcher, and the built-in Systems. Phase 29's E-02 (never-contacted population membership) and E-03 (single canonical view) outcomes constrain what Systems may render. No arbitrary product cap on System membership — scale is solved with culling/LOD/virtualization.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-09-orrery-systems-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-09-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- No new ADR is minted by this phase. It inherits Phase 29's ADR-077 (single canonical Orrery) and ADR-011 (never-contacted segregation) as constraints on what a System may render; see `docs/decisions/ADR-077-single-canonical-orrery-with-a-constrained-inspection-camera.md` and `docs/decisions/ADR-011-query-time-status-and-never-contacted-segregation.md`.

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: System-to-System composition/nesting or an arbitrary boolean-query expression builder; static-snapshot, AI-generated, or shared Systems; System folders/tags, a Recent Systems section, or a separate startup/default System preference (last-active persistence is sufficient); and general Category CRUD (Phase 37 owns it — this phase owns only the deletion fallout).
</deferred>

---
*Phase: 30-orrery-systems*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
