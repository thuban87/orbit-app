# Phase 26: Dashboard Control Surface - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Define and build the Dashboard's visible control shell over the shared Dashboard Data & State Foundation: top-of-screen hierarchy, header destinations, Population/Filters/Sort controls in anchored floating panels with live apply, search + List/Card toggle placement, Dashboard overflow/management access, and refactoring of existing management routes. The architecture must allow a later branded HUD to replace anchored-panel presentation without rewriting Dashboard behavior.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships **no migration of its own** — it is a control surface over the Dashboard Data phase's state and the Card View phase's bulk capability. Retiring the `include_unbound_never_contacted` setting and the Manage-favourites row touches `app_settings` / `PORTABLE_SETTINGS_KEYS`: coordinate key removal with the backup format bump (Phase 36's final plan) rather than dropping keys ad hoc. If any migration proves unavoidable, number it head+1 verified against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time — never assume a number.

### Phase-specific constraints
- **D-04 (Group Events amendment):** **Your Week is no longer the sole first-class header destination** — Group Events joins it at the same discoverability tier (§B superseded), routing to the canonical Group Events page owned by the Group Interaction Logging phase. When the header cannot fit both labels the fallback is **icon-only**, never header wrap and never displacing the control row. Dashboard overflow gains a redundant Group Events entry (§M extended). This phase owns entry affordances only — no Group Event domain behavior.
- **D-05 (E-07, ADR-080):** ADR-019's stack-root shell assumption is superseded by the four-tab shell (ADR-080, 2026-09-01). **Archived Contacts keeps both the overflow entry and the Settings row**, routing to one screen; Unbound and Archived open as Dashboard child routes with origin-aware return (Dashboard → Archived → Profile → Back → Archived).
- **D-06 (E-01, ADR-075):** **Manage Favorites is removed from overflow with nothing in its place** — favourites are binary membership; the drag-reorder screen and the rank behind it are retired (ADR-033 superseded by ADR-075). Do not reintroduce a ranked-favourites affordance.
- **D-07 (E-02, ADR-076/E-04):** The Population panel gains an **All Contacts** selectable row; Active Contacts remains the implicit unlisted default and deselecting the last explicit population returns to it. A permanent birthday/upcoming Dashboard module stays out — relocated to the deferred Your Week phase (ADR-034 superseded by ADR-076).
- **D-08 (R-11 REPLAN + trip-wire, ADR-062):** `UnboundContactsScreen` has no search, and Dashboard search currently returns Unbound as neutral rows. Give the Unbound child route its own search (or confirm the shell picker covers it), coordinated **once** with the Dashboard Data phase's R-11. **Removing Unbound from Dashboard search without a replacement retrieval path weakens ADR-062 → stop and ask.**
- **D-09 (R-19 REPLAN + trip-wires):** The amended overflow routes to bulk mutations that **do not exist yet** — bulk Quick Log, favourites, snooze, category, archive, and frequency are Card View phase work. Sequence the **Select Contacts** entry behind that phase or ship it disabled; it enters Card/Grid multi-select (switching to Card View if needed), never a standalone screen. Trip-wires that survive into that work: bulk archive must compose N per-contact lifecycle-event writes (ADR-025), and bulk Quick Log must compose the recency cores — never a bulk `INSERT INTO interactions`.
- **D-10 (AF-02):** The overflow entry is named **Select Contacts**, and its earlier claim of supporting "existing/current import" is removed — contact import belongs to Backup/Restore, not Dashboard bulk management.
- **D-11 (architecture):** Population, Filters, and Sort are three separate equal controls opening **anchored floating panels** (not modals, not bottom sheets), one at a time, applying immediately with no Apply/Done step and visibly updating results behind the panel; underlying content is interaction-inert and removed from accessibility focus while a panel is open. Presentation must stay swappable so a later branded HUD can replace anchored panels without rewriting Dashboard behavior.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry — including exact panel pixel dimensions/offsets and final microanimation timings.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-05-dashboard-control-surface-dossier-amended-group-events.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-05-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-075-binary-favourite-membership-without-a-user-facing-order.md` — favourites are binary; the Manage Favorites overflow entry is removed with no replacement (supersedes ADR-033).
- `docs/decisions/ADR-076-population-reached-birthdays-without-a-dashboard-banner.md` — no permanent birthday module on the Dashboard; richer presentation relocates to Your Week (supersedes ADR-034).
- `docs/decisions/ADR-080-four-tab-bottom-navigation-shell-with-per-tab-stacks.md` — the four-tab shell this control surface sits inside; supersedes ADR-019's stack-root assumption and makes Archived/Unbound Dashboard child routes.

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Explicitly do-not-build here: a **custom Orbit HUD control surface** or full-screen combined Manage View (the anchored-panel architecture only has to *allow* a later HUD swap — do not build the HUD now) and **Group Events as a permanent Dashboard content module** (feed, event cards, analytics — the Dashboard stays contact-content-first). Also out: bottom-sheet control variants, a fourth top-row presentation-mode button, a Group Events bottom-nav destination, a Dashboard-tab radial launcher, and any greenfield reimplementation of Archived/Unbound management logic (refactor and reuse).
</deferred>

---
*Phase: 26-dashboard-control-surface*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
