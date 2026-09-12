---
phase: 32-interaction-history-insights
plan: 07
subsystem: interaction-history
tags: [react-native, history, detail-sheet, hard-delete, allow-ai, lifecycle-events, group-seam, tdd]

requires:
  - phase: 32-interaction-history-insights
    plan: 02
    provides: "bind/unbind immutable lifecycle events (EventType union) the Detail Sheet renders read-only"
  - phase: 32-interaction-history-insights
    plan: 03
    provides: "history-read canonical projection (interactions/lifecycle/knowledge-change families + isGroupLinked inert seam predicate)"
  - phase: 32-interaction-history-insights
    plan: 04
    provides: "canonical EditInteraction route the detail's Edit affordance links to"
provides:
  - "src/components/history/interaction-detail-logic.ts — pure buildDetailRows (present-only fields, no blanks), showSparkle (strict allow_ai===1), buildGroupContext (dormant, keyed on isGroupLinked)"
  - "src/components/history/DateDetailSheet.tsx — shared Sheet('detail') interleaving three record families chronologically by semantic icon; knowledge rows emit onOpenKnowledgeChange(fieldKey)"
  - "src/components/history/InteractionDetail.tsx — present-only inspection + Allow-AI sparkle + hard-delete (ConfirmDialog destructive → deleteTouchpoint) + Edit-scope gating"
  - "src/components/history/GroupScopePrompt.tsx — dormant scope-prompt seam (individual vs Group Event), never reached in Phase 32"
  - "EVENT_LABELS exported from TimelineRow.tsx, extended with bind→'Bound'/unbind→'Unbound', consumed by DateDetailSheet's own lifecycle renderer"
affects: [phase-33-group-logging]

actuals:
  tokens: 7100
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Correctness-critical presentation logic (present-only projection, sparkle gate, group-context shape) extracted to a pure node-tested module the .tsx cannot exercise under vitest"
    - "Hard-delete routed through the single recency writer (deleteTouchpoint) from the component via getExecutor()/localDateTime() — the established HomeScreen/UniversalFab idiom, no inline SQL"
    - "Inert seam gated on a predicate keyed on a not-yet-existing column (isGroupLinked / groupLinked) — structurally present, hard-false, references no group-event schema (D-12)"
    - "Shared label map exported from an unmounted component and consumed by the live sheet keeps the edit exercised rather than dead code"

key-files:
  created:
    - src/components/history/interaction-detail-logic.ts
    - src/components/history/interaction-detail-logic.test.ts
    - src/components/history/DateDetailSheet.tsx
    - src/components/history/InteractionDetail.tsx
    - src/components/history/GroupScopePrompt.tsx
  modified:
    - src/components/TimelineRow.tsx

key-decisions:
  - "Delete is called directly from InteractionDetail via deleteTouchpoint(getExecutor(), …) — the same DAO-through-a-component pattern HomeScreen/UniversalFab already use (CLAUDE.md bans inline SQL in components, not calling a DAO). Failure preserves the row + metrics, closes the confirm, re-enables the control, and surfaces an inline error (no optimistic vanish)."
  - "InteractionDetail owns its own Sheet('detail') and the ConfirmDialog + GroupScopePrompt; the parent controls only visibility + the onEdit/onDeleted/onOpenInteraction callbacks."
  - "buildGroupContext keys on history-read's isGroupLinked({ groupEventId }) predicate; every real Phase-32 record has no groupEventId so it returns null. A synthetic test input forces it true to prove the group note stays DISTINCT from the participant note for Phase 33. No group-event column is referenced anywhere."
  - "Connected state is always surfaced textually ('Connected' / 'No reply') — a known boolean, never blank; the three omittable fields (duration/Tone/note) are the ones the no-blank-fields test pins."
  - "Reused formatDurationLabel (touchpoint-refine-logic) for the duration row value rather than authoring a second formatter."

requirements-completed: [HIST-10, HIST-13, HIST-16, HIST-17]

duration: 12min
completed: 2026-09-11
status: complete
---

# Phase 32 Plan 07: Shared Detail Sheet, Interaction Detail, hard-delete + group seam Summary

**The shared period/date Detail Sheet interleaves interactions, read-only lifecycle events (incl. the new Bound/Unbound labels), and history-aware knowledge changes chronologically by semantic icon; the canonical Interaction Detail renders complete, blank-field-free records with the privacy sparkle shown strictly when Allow AI is ON, hard-delete runs behind the destructive ConfirmDialog through the single recency writer, and the group-linked scope prompt / group context are dormant predicate-gated seam code that never fires in Phase 32.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (Task 1 `tdd="true"` RED→GREEN)
- **Commits:** 4 task commits + this docs commit
- **Files:** 5 created + 1 modified

## Accomplishments

- **Task 1 — interaction-detail-logic.ts (+ test), TDD.** Pure projection behind the detail surface: `buildDetailRows` emits ONLY present fields (unspecified channel, null direction, null Tone, null/zero duration, blank note all produce no row — no blank fields, HIST-11), ordered channel→when→direction→connected→tone→duration→note. `showSparkle` is strictly `allow_ai === 1` (0/undefined → false; D-04). `buildGroupContext` is dormant seam code keyed on history-read's `isGroupLinked` predicate: null for every real Phase-32 record (no `groupEventId`), and a synthetic forced-true input proves the group note stays DISTINCT from the participant note for Phase 33 — with no group-event column referenced. 12 node tests green; `grep group_event_id` returns nothing.
- **Task 2 — DateDetailSheet + InteractionDetail + shared EVENT_LABELS.** `EVENT_LABELS` is now EXPORTED from TimelineRow.tsx and extended with `bind→'Bound'`, `unbind→'Unbound'`; DateDetailSheet's OWN semantic-icon lifecycle renderer imports and consumes it (TimelineRow the component stays unmounted, so the sheet is the live consumer — the label edit is exercised, not dead code). `DateDetailSheet` (Sheet variant `detail`) interleaves the three families chronologically by semantic icon (interaction channel icon / lifecycle icon / `edit` icon for knowledge), interaction rows tap → `onOpenInteraction(id)`, knowledge rows emit `onOpenKnowledgeChange(fieldKey)` (a callback, no hardcoded nav target). `InteractionDetail` renders the present-only rows, the restrained sparkle only under `showSparkle`, Edit/Delete, and a dormant group block.
- **Task 3 — hard-delete confirmation + dormant scope prompt.** Delete opens the `ConfirmDialog` destructive variant with the exact §X copy (title `Delete this interaction?`, body naming Status/Gravity/Intensity, actions Cancel / `Delete interaction`) and on confirm calls `deleteTouchpoint(getExecutor(), …)` — the single recency writer (tombstone in-txn + recompute); a failure keeps the interaction + derived metrics, closes the confirm, re-enables the control, and surfaces an inline error (no optimistic vanish). Edit routing is gated on `interaction.groupLinked`: standalone → `onEdit` (EditInteraction) directly; group-linked → the new `GroupScopePrompt` (dormant — never reached this phase). `GroupScopePrompt` presents `Edit interaction` with `Edit individual interaction` / `Edit Group Event`; it references no group-event column.

## Task Commits

1. **Task 1 RED** — `test(32-07): failing interaction-detail projection/sparkle/group-seam specs`
2. **Task 1 GREEN** — `feat(32-07): pure interaction-detail projection, sparkle gate, dormant group seam`
3. **Task 2** — `feat(32-07): shared DateDetailSheet + InteractionDetail + bind/unbind labels`
4. **Task 3** — `feat(32-07): hard-delete confirmation + dormant group scope prompt`

## TDD Gate Compliance

Task 1 followed RED (failing `test(...)` commit, module missing) → GREEN (`feat(...)` commit, 12 tests pass). Tasks 2–3 are `.tsx`/wiring tasks verified by tsc + check:colors + grep gates per the plan (component render tests are not part of this repo's reliable harness — the pre-existing orrery-controls-render load failure predates this phase).

## Verification

- `interaction-detail-logic.test.ts`: 12 pass (no blank fields; duration/Tone/note omission; connected textual; sparkle strictly on allow_ai===1; group context null for standalone, shaped + distinct group/participant notes for a synthetic true predicate).
- `npx tsc --noEmit`: clean (exit 0).
- `npm run check:colors`: clean (exit 0) — every colour resolves through tokens; sparkle uses `accentText`.
- Task 1 grep: `group_event_id` returns nothing.
- Task 2 greps: `bind`/`unbind` present in TimelineRow EVENT_LABELS; `EVENT_LABELS` referenced in DateDetailSheet.
- Task 3 grep: `deleteTouchpoint` present in InteractionDetail; NO `DELETE FROM interactions`, NO `group_event_id` in the three components.
- Full suite: **3062 tests pass**; only the pre-existing, unrelated `src/components/orrery/orrery-controls-render.test.tsx` load failure remains (documented in 32-01..04; imports none of this plan's files).

## Prohibitions honoured

- Delete is a true hard delete via `deleteTouchpoint` — no soft/trash/quarantine tier (D-11); the destructive ConfirmDialog guard and copy are intact (no scrim-dismiss).
- The sparkle renders only when `allow_ai === 1`, nothing when OFF (D-04); tested strictly.
- The dormant group note is a distinct field, never concatenated into the participant note (ADR-078 / D-04); no Allow-AI toggle on it.
- No component references, queries, or assumes a `group_event_id` column and no group-parent fixture is constructed (D-12); the group-link predicate stays hard-false.
- No colour-only distinction between families and no colour literal in any component (tokens only).

## Group seam status (HIST-16 / HIST-17 — structural, D-12)

HIST-16 and HIST-17 are satisfied STRUCTURALLY this phase: the group context (badge/title/distinct Group Note/View Group Event), `GroupScopePrompt`, and Edit-scope routing are present but gated on the `isGroupLinked` predicate, which is hard-false for every Phase-32 interaction (no `group_event_id` column until Phase 33's migration 026+). Rows come from history-read's `interactions`-only records, so a Group Event parent can never be a second row and never double-counts. The standalone Edit→EditInteraction / delete→deleteTouchpoint path is the only one exercised. Phase 33 makes the seam live.

## Known Stubs

None. The group-context block, `GroupScopePrompt`, and the Edit-scope branch are intentional **inert seam** code per D-12 (predicate hard-false until Phase 33), not stubs — documented in-file and covered by the synthetic-predicate unit test. The `onEditGroup` handler is a documented Phase-33 placeholder target (unreachable this phase because the prompt never opens).

## Deviations from Plan

**None — plan executed exactly as written.** Reused the existing `formatDurationLabel` for the duration row value and `notifyWidgetDataChanged()` post-delete refresh (established idioms), both anticipated by the plan's read-first context.

## Issues Encountered

Pre-existing, out-of-scope: `src/components/orrery/orrery-controls-render.test.tsx` still fails to LOAD (`SyntaxError` under the Vite loader, a `vi.mock` generic issue predating this phase). It imports none of this plan's files. Not fixed.

## Device UAT deferred to the phase gate

Per the plan's backstop items and the phase's end-of-phase human-verify gate: (1) long-note reflow in Interaction Detail + one-line preview clamp in the sheet row across large-text settings; (2) the delete-failure path leaving the interaction + metrics intact with the control re-enabled; (3) interleaved icons + Bound/Unbound labels rendering in a live date sheet. Node tests + tsc + check:colors cover the pure logic and source discipline; the .tsx rendering is device-UAT.

## Self-Check: PASSED

- Created files verified on disk: interaction-detail-logic.ts (+ .test.ts), DateDetailSheet.tsx, InteractionDetail.tsx, GroupScopePrompt.tsx; modified TimelineRow.tsx.
- Commits verified in git log (see Task Commits).

---
*Phase: 32-interaction-history-insights*
*Completed: 2026-09-11*
