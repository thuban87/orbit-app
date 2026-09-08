---
phase: 30-orrery-systems
plan: 07
subsystem: ui
tags: [react-native, sqlite, orrery, membership, contact-picker]
requires:
  - phase: 30-02
    provides: ResolvedMembership candidateIds for rule-derived membership seeding
  - phase: 30-03
    provides: setSystemOverride replacement operation for persisted override intents
provides:
  - Controlled virtualized Manage Members avatar grid
  - Bound active-contact pool and arbitrary-id display-row read source
  - Pure membership override derivation and picker-row search adapter
affects: [30-08-system-builder, orrery-systems]
actuals:
  tokens: 6826
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns:
    - Controlled override-intent UI backed by a resolver candidate-id seed
    - Active Add-People source plus unrestricted candidate/override display union
key-files:
  created:
    - src/components/orrery/ManageMembersGrid.tsx
    - src/components/orrery/manage-members-logic.ts
    - src/db/systems-members-read.ts
  modified:
    - src/components/orrery/manage-members-logic.test.ts
    - src/db/systems-members-read.test.ts
    - src/db/lifecycle-consumer-ledger.test.ts
    - .planning/milestones/v1.0-phases/18.2-bound-unbound-lifecycle/18.2-VALIDATION.md
key-decisions:
  - "ManageMembersGrid receives the caller-built candidate/override/active-row union and never re-derives rule membership."
  - "The picker adapter leaves durable local photos on SystemMemberRow and always maps photoThumbUri to null."
  - "Add People uses DASHBOARD_POPULATION_SCOPE_WHERE, admitting active never-contacted contacts while excluding Archived and Unbound contacts."
requirements-completed: [ORRS-02, ORRS-06]
coverage:
  - id: D1
    description: Pure rule-membership states, override deltas, counts, and picker search adapter
    requirement: ORRS-06
    verification:
      - kind: unit
        ref: npx vitest run src/components/orrery/manage-members-logic.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Active Add-People source and arbitrary candidate/override display-row reads
    requirement: ORRS-02
    verification:
      - kind: unit
        ref: npx vitest run src/db/systems-members-read.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Large-membership responsiveness and largest-text card reflow
    requirement: ORRS-06
    verification: []
    human_judgment: true
    rationale: Device-scale rendering and OS text-scale layout require physical-device verification at end of phase.
duration: 8min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 07: Manage Members Summary

**A controlled, virtualized System-member grid with rule-seeded exclusions, active manual additions, and durable local-avatar rows.**

## Performance

- **Duration:** 8min
- **Started:** 2026-09-08T20:47:00Z
- **Completed:** 2026-09-08T20:55:26Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Added pure member-card derivation that preserves a deselected rule match as an in-place Excluded card, removes manual additions through a null override, and counts selected/added/excluded cards.
- Added bound SQLite reads: the Add People pool reuses the shared active population scope, while arbitrary IDs preserve never-contacted candidates and unavailable archived inclusions for display.
- Added a searchable, two-column FlatList grid with local-path Avatar rendering, accessible checkbox state, Added/Excluded states, and the `Searches your active contacts.` affordance.

## ManageMembersGrid Contract for Plan 08

`ManageMembersGrid` receives `candidateIds` from plan 02's `ResolvedMembership.candidateIds`, current `includeIds`/`excludeIds`, and `rows`: the explicit union of `readMemberRowsByIds(candidateIds ∪ includeIds ∪ excludeIds)` and `listActiveMemberRows`.

It calls `onChange({ contactId, mode })`, where `mode` is `"exclude"` for deselecting a rule match, `"include"` for adding an eligible active non-match, and `null` for undoing an existing override. Plan 08 persists each delta through systems-dao's `setSystemOverride(ref, contactId, mode | null)` replacement operation.

`toPickerRow(SystemMemberRow)` adapts `id` to `lookupKey`, applies the `Unnamed contact` display fallback, uses the first search method as `primaryMethod`, and always sets `photoThumbUri: null`; `SystemMemberRow.photo` remains the durable local path used by `Avatar`.

## Task Commits

1. **Task 1: Pure member/override logic** — `289b560` (`feat`)
2. **Task 2: Active-contact read source for the grid** — `bc27b87` (`feat`)
3. **Task 3: The virtualized multi-select grid component** — `80a09cb` (`feat`)
4. **Lifecycle predicate registration (deviation)** — `d28685a` (`fix`)

## Files Created/Modified

- `src/components/orrery/ManageMembersGrid.tsx` — controlled FlatList avatar grid and Add People panel.
- `src/components/orrery/manage-members-logic.ts` — pure state, count, override, and picker-adapter logic.
- `src/db/systems-members-read.ts` — local-photo active and arbitrary-ID member reads.
- `src/db/lifecycle-consumer-ledger.test.ts` — registers the new Bound predicate consumer.

## Decisions Made

- The editor owns only presentation and override intent; candidate membership stays the resolver's responsibility.
- Search is client-side over `ContactPickerRow` adapters, with no user search term crossing into SQLite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Registered the new active-members lifecycle predicate.**

- **Found during:** Plan-level suite after Task 3.
- **Issue:** The lifecycle ledger correctly rejected the new `tracking_enabled = 1` reader because every Bound/Unbound predicate consumer must declare its owner.
- **Fix:** Added the 30-07 member-read contract to the enforced ledger and its human-readable validation matrix.
- **Files modified:** `src/db/lifecycle-consumer-ledger.test.ts`, `.planning/milestones/v1.0-phases/18.2-bound-unbound-lifecycle/18.2-VALIDATION.md`
- **Verification:** `npx vitest run src/db/lifecycle-consumer-ledger.test.ts` (11 passed).
- **Committed in:** `d28685a`

**Total deviations:** 1 auto-fixed (Rule 2).

## Verification

- Passed: `npx vitest run src/components/orrery/manage-members-logic.test.ts` (5 tests).
- Passed: `npx vitest run src/db/systems-members-read.test.ts` (2 tests).
- Passed: `npx vitest run src/db/lifecycle-consumer-ledger.test.ts` (11 tests).
- Passed: `npx tsc --noEmit`, `npm run check:colors`, and Biome checks for changed source/tests.
- `npm test`: 2,593 tests passed; the only failures are the pre-existing Flow-parser imports in `src/backup/restore-apply.test.ts` and `src/stores/orrery-system-store.test.ts` (`react-native/index.js` Flow unsupported by Rolldown/Vite). No plan-created failures remain.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 08 can embed the grid using the stated union-row and `onChange` contracts, then persist the emitted intents atomically through systems-dao. Device-scale grid responsiveness and largest-text reflow remain end-of-phase verification items.

## Self-Check: PASSED

Verified all five shipped source/test files exist and commits `289b560`, `bc27b87`, `80a09cb`, and `d28685a` are present in git history.

---
*Phase: 30-orrery-systems*
*Completed: 2026-09-08*
