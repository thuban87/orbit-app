# Phase 28: Dashboard Card View - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Build the Dashboard Card View as Orbit's compact, avatar-first grid renderer over the shared Dashboard query/result/state model and control surface. It covers grid composition, avatar/status treatment, adaptive context, search-match rendering, favorite behavior, long-press actions, and multi-select — which *is* Orbit's Dashboard bulk/contact-management surface — plus sensitive bulk operations, empty/error/loading presentation, accessibility, and responsive behavior.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships **no migration of its own** — every bulk operation composes existing writers against the existing schema. Explicitly **not** implied: no quarantine column, no purge-deadline column, no launch-time auto-purge sweep (E-08). If any migration proves unavoidable, number it head+1 verified against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time — never assume a number; coordinate any portable-key change with the backup format bump (Phase 36's final plan).

### Phase-specific constraints
- **D-04 (R-19 REPLAN):** **No bulk mutation exists** for Quick Log, favourites, snooze, category, archive, or frequency. Build each as **N composed single-contact operations inside one transaction**, reusing the existing cores — never a set-based SQL update.
- **D-05 (R-19 trip-wire, ADR-010/024/071):** Bulk Quick Log must compose `insertInteractionCore` + `recomputeLastContactCore` inside one transaction. The write mutex is **non-reentrant** — compose the cores, never loop top-level writers. A bulk `INSERT INTO interactions` leaves `last_contact` wrong and bypasses the single recency writer. `rejectFutureOccurredAt` applies to every logged interaction, bulk included.
- **D-06 (R-19 trip-wire, ADR-025):** Bulk archive must compose **N immutable lifecycle-event writes**. A bare `UPDATE contacts SET archived_at=…` silently skips the event trail → do not do it.
- **D-07 (E-08, ADR-018):** **Bulk Delete is removed.** Bulk Archive is the recoverable removal (confirmation required, sits outside Sensitive Operations as a reversible lifecycle operation); permanent deletion stays a manual per-contact action on the Archived Contacts list. Sensitive Operations contains **Change Contact Frequency only**; Gravity is never offered as a bulk action.
- **D-08 (E-08 trip-wire):** **Do not build a contact quarantine state or a launch-time auto-purge sweep** — neither exists and neither will. Archive retention is indefinite with manual purge, and confirmation copy must describe **archiving**, not quarantine. (The earlier "30-day quarantine" description of contact deletion was factually wrong — that quarantine applies to custom-field *definitions*.)
- **D-09 (E-01, ADR-075):** Binary favourite membership — the top-right star toggles membership with immediate visual and restrained haptic feedback; in multi-select, stars become non-interactive. The drag-reorder Manage-favourites screen and its rank are retired (ADR-033 superseded by ADR-075); **rank must never leak into Card UX** (§H annotation). Bulk favourite and snooze actions are explicit (Add to / Remove from Favorites, Snooze / Unsnooze) — never an ambiguous "toggle all".
- **D-10 (Group Events amendment):** The prior prohibition on detailed bulk Log Interaction is **superseded**. Multi-select keeps Quick Log distinct and adds count-aware routing: **1 contact → the canonical individual detailed Log Interaction flow; 2+ → Group Log with the selected contacts preloaded as participants.** This phase owns only the action, the routing, and multi-select UX preservation — all Group Event domain behavior belongs to the Group Interaction Logging phase — and the layout must stay compatible with that phase's Dashboard header and overflow Group Events entries.
- **D-11 (R-17 REPLAN):** Status glyphs and the semantic icon registry do not exist (colour + border weight only, no registry, no reduced-motion hook). Consume the Theme phase's deliverables and **do not fork a second icon source**. Status is a thin status-coloured avatar ring **plus** a distinct glyph attached to the avatar edge, never colour-only; snoozed contacts get a neutral ring and a snooze glyph.
- **D-12 (multi-select model):** Multi-select **is** the bulk-management surface — no separate standalone screen. It **locks and replaces** the Dashboard control area (Population/Filters/Sort and Search cease to function) rather than adding a bottom bar; Select All operates over the **frozen** eligible result universe as it stood when selection mode began; after a successful ordinary bulk operation the selection and mode persist; Back exits multi-select before route navigation.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry — including final status-icon artwork, exact card dimensions, gaps, avatar diameter, breakpoints, animation timings, and the bulk Quick Log confirmation threshold.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-07-dashboard-card-view-dossier-v0.2.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-07-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-018-archive-gated-contact-purge-with-explicit-fan-out.md` — archive-then-manual-purge; bulk Archive is the recoverable removal and Bulk Delete is not offered.
- `docs/decisions/ADR-075-binary-favourite-membership-without-a-user-facing-order.md` — binary favourite membership; rank must never leak into Card UX (supersedes ADR-033).
- `docs/decisions/ADR-010-single-writer-interaction-recency-spine.md` — the single recency writer that bulk Quick Log must compose, never bypass.
- `docs/decisions/ADR-024-editable-touchpoint-history-and-recomputed-recency.md` — recency is recomputed, not hand-set; bulk logging must run the recompute core.
- `docs/decisions/ADR-071-user-attested-handoff-time-interaction-logging-through-the-sole-recency-writer.md` — all interaction logging, bulk included, goes through the sole recency writer.
- `docs/decisions/ADR-025-immutable-lifecycle-events-in-a-unified-timeline.md` — bulk archive must compose N immutable lifecycle-event writes.

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Explicitly do-not-build here: **Bulk Delete and any contact quarantine / launch-time auto-purge sweep** (removed and will not be built — archive is the recoverable removal, purge stays manual per-contact) and **a separate standalone bulk-management screen** (multi-select *is* the surface). Also out: contact import (belongs to Backup/Restore — the overflow entry is "Select Contacts", not an import surface), Bulk Edit Contact, multi-recipient messaging, custom per-contact card layout, multi-category membership, and Gravity as mutable state.
</deferred>

---
*Phase: 28-dashboard-card-view*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
