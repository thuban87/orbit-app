# Phase 33: Group Interaction Logging - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Deliver a first-class Group Interaction Logging subsystem that records one real-world social encounter involving multiple Orbit contacts without forcing the user to author the same details separately for each contact. Group Events are durable social-event records with their own presentation, editing, browsing, and management surfaces — not a Dashboard bulk-action convenience.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** A **Group Note is never transmitted to AI**, under any participant's Allow AI state (amended decision, ADR-078). Build Group Note storage so the AI context read *cannot reach it*: AI context today reads only `channel, quality, connected` and never a note — preserve that property for group rows. Only a participant's own interaction note is ever eligible, gated by that child Interaction's per-interaction **Allow AI** toggle, which defaults **OFF** (authored in Phase 34, defaults owned by Phase 36). Routing a Group Note through that toggle reverses an owner decision — stop and ask.
- **D-05:** Every child row must be created, updated, and deleted through `insertInteractionCore` / `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore` inside **one transaction**, composing the cores — the write mutex is non-reentrant, so never a bulk INSERT (R-02 constraint 1; ADR-010 / ADR-024 / ADR-071). **Trip-wire:** any set-based write to `interactions` that bypasses the recency cores is a correctness bug, not an optimization. Read every writer of `interactions` and `contacts.last_contact` before asserting an invariant — the graph cannot enumerate SQL writers.
- **D-06:** The Group Event parent never counts as an additional interaction in history, Status, Gravity, Intensity, or Heatmap; each participant receives exactly one ordinary child Interaction. A zero-participant event is valid and creates no children.
- **D-07:** Archived contacts may be participants: `insertInteractionCore` has no archived guard, so their `last_contact` advances — **owner-accepted**, no restore prompt, they stay archived (R-02 constraint 2). Do not add a guard that reverses this.
- **D-08:** Event-level date edits fan out to N `occurred_at` updates and N recency recomputes, each subject to `rejectFutureOccurredAt` (R-02 constraint 3). Plan it as one transaction and bound the cost. Saves, updates, participant changes, and dissolve/delete commit completely or roll back completely — no partial visible state; a failed Save leaves the form open with user input intact.
- **D-09:** Group Log defaults Channel to **In Person**, Tone unset, Duration unset, and is **exempt** from the ordinary Default Interaction Channel preference (R-03 constraint) — Phase 37's settings copy must say so. The shared Tone/channel vocabulary migration is owned jointly with Phases 32/34 as one strictly ordered `interactions` sequence, never competing edits.
- **D-10:** Group Events must be serializable with validation and orphan repair (R-09). This phase **carries the validation/orphan-repair rules and hands over the entity shape**; the format-4 bump is Phase 36's final plan. A restored child interaction whose parent Group Event is missing must have a **decided outcome** (repair or orphan-drop) — decided here, executed by Phase 36's restore path.
- **D-11:** Editing a group-linked Interaction always asks Edit individual interaction vs Edit Group Event — never a hybrid implicit-scope editor. Deleting one child removes only that participant's record. Removing a saved participant prompts Delete interaction / Keep as individual interaction / Cancel; "Keep as individual" preserves the resolved values and participant note and never copies the Group Note in. Converting an ordinary Interaction into a Group Event preserves its identity/UID.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-12-group-interaction-logging-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-12-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-078-negative-constraint-off-limits-and-gated-recent-interaction-ai-context.md` — the AI context boundary: gated recent-interaction context, and the context in which the Group Note egress ban sits
- `docs/decisions/ADR-010-single-writer-interaction-recency-spine.md` — every child interaction write goes through the single recency spine
- `docs/decisions/ADR-024-editable-touchpoint-history-and-recomputed-recency.md` — edits and deletes recompute recency rather than mutating it
- `docs/decisions/ADR-071-user-attested-handoff-time-interaction-logging-through-the-sole-recency-writer.md` — the sole recency writer is the only logging path
- `docs/decisions/ADR-025-immutable-lifecycle-events-in-a-unified-timeline.md` — lifecycle events are immutable; Group Events are not lifecycle events and must not be modeled as them

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: planned/future Group Events, an in-app social calendar, or Google Calendar integration; Group Event pin/favorite/archive/trash lifecycle states; host/owner or other participant roles; Group Event or aggregate social-life analytics; user-facing restore/orphan-repair tools; and the Mission Control Dashboard concept or any bottom-nav restructure.
</deferred>

---
*Phase: 33-group-interaction-logging*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
