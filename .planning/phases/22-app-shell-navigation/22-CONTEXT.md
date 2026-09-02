# Phase 22: App Shell & Navigation - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Establish the permanent application shell inherited by every later UI/UX phase: top-level navigation, per-tab stacks, Back behavior, persistent bottom navigation, focused-workflow exceptions, the universal capture FAB, the shared contact picker, safe areas, keyboard behavior, app bars, motion, haptics, and shell-level accessibility. It owns exposure and routing only — not the forms or business rules behind the actions it launches.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships NO SQLite migration; do not add schema. It is a pure navigation refactor and can be planned independently of the milestone's migration chain.

### Phase-specific constraints
- **D-04:** Plan the **four-tab bottom-nav root shell** (Dashboard, Orrery, Backup/Restore, Settings), each with its own stack. This supersedes ADR-019's stack-root shell via ADR-080 (owner-ratified 2026-09-01). ADR-018's archive-before-purge gate is untouched — do not treat the shell change as licence to alter archive/purge behavior.
- **D-05:** The FAB speed dial has **exactly six actions in fixed order**: Add Contact, Quick Log, Log Contact, Group Log, Update Contact, Memory. Any five-action text anywhere is stale (AF-03 auto-fix); Group Log sits at position 4 and opens its canonical focused workflow directly, with no shell-level contact pre-picker.
- **D-06 (R-18 REPLAN):** The tab navigator and origin-aware Back are **unbuilt** — a single `createNativeStackNavigator` exists with no bottom-tabs dependency. Profile Back is already a plain `goBack()`, so origin-awareness is partly free. Plan against the code as it actually is on disk, not against an assumed shell.
- **D-07 (R-18 trip-wire):** The three forced-Dashboard-reset flows — Compose Back, notification taps, widget deep links — are **requirements that must survive** the tab refactor, not legacy to delete. Removing the external-entry → Dashboard fallback reverses ADR-044 → stop and ask.
- **D-08 (R-18 trip-wire):** Before writing the navigator, enumerate **every** `navigation.reset` call site and state its post-refactor behavior in the plan. Re-verify that inventory against the files on disk at plan time.
- **D-09:** Archived Contacts becomes reachable from Dashboard overflow (E-07); the Settings row may remain as a second entry point routing to the same screen. Group Events is a prominent Dashboard header destination plus a redundant overflow entry — **not** a fifth bottom-nav tab, and the Dashboard tab is **not** a radial launcher (both rejected for this milestone).
- **D-10:** Predictive back is currently disabled in app config — note its state in the plan rather than silently flipping it.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-01-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-080-four-tab-bottom-navigation-shell-with-per-tab-stacks.md` — ratifies the four-tab bottom-nav root shell with per-tab stacks, superseding ADR-019's stack-root shell; this is the shell this phase builds.

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Explicitly do-not-build here: **Group Events as a fifth bottom-nav destination** and **converting the Dashboard tab into a radial/menu launcher** (both rejected for this milestone), plus the "Mission Control" dashboard redesign and any bottom-nav restructuring. Group Event persistence and participant management belong to Phase 12; the detailed Add Contact / Log Contact / Update Contact forms belong to the Rapid Capture phase.
</deferred>

---
*Phase: 22-app-shell-navigation*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
