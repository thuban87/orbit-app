---
phase: 38-your-week
plan: 01
subsystem: navigation
tags: [react-navigation, bottom-tabs, native-stack, deep-linking, backup]

requires:
  - phase: 37-settings
    provides: Settings-hosted Backup & Restore tree
provides:
  - Five-tab Contacts · Events · Digest · Orrery · Settings shell with Digest as the initial tab
  - Independent descriptor-driven Digest and Events native stacks
  - Settings-only shared-backup restore routing and consumption
affects: [phase-38-digest, notifications, universal-fab, device-uat]

actuals:
  tokens: 8491
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: [pure runtime shell descriptor, descriptor-driven native stacks, canonical product labels]

key-files:
  created:
    - src/constants/product-labels.ts
    - src/navigation/shell-contract.ts
    - src/navigation/shell-contract.test.ts
    - src/navigation/tabs/DigestStack.tsx
    - src/navigation/tabs/EventsStack.tsx
  modified:
    - src/navigation/RootNavigator.tsx
    - src/navigation/types.ts
    - src/navigation/tabs/DashboardStack.tsx
    - src/navigation/linking.ts
    - src/screens/backup-dualhome-logic.ts
    - src/screens/GroupEventsScreen.tsx

key-decisions:
  - "Preserved DashboardTab as the Contacts tab's internal route id so existing FAB navigation remains valid."
  - "Made the Settings-hosted Backup screen the sole shared-backup consumer after removing BackupTab."

patterns-established:
  - "Shell shape and promoted-stack route sets live in a pure runtime descriptor consumed by production stacks and render-free tests."
  - "Promoted roots own independent stacks containing every route reachable from Profile."

requirements-completed: [S-01, S-02, S-04, S-05, S-14]

coverage:
  - id: D1
    description: "Five-tab shell order and Digest initial destination are encoded in the runtime shell contract."
    requirement: S-01
    verification:
      - kind: unit
        ref: "src/navigation/shell-contract.test.ts#defines the permanent five-tab order with Digest as the initial tab"
        status: pass
    human_judgment: false
  - id: D2
    description: "Digest and Events own independent stacks with the complete Profile-reachable route set."
    requirement: S-02
    verification:
      - kind: unit
        ref: "src/navigation/shell-contract.test.ts#registers Profile-reachable route"
        status: pass
      - kind: integration
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Origin-aware Back traversal requires physical-device navigation UAT in Plan 07."
  - id: D3
    description: "Shared .orbitbackup intents route to Settings and the surviving host consumes the staged singleton."
    requirement: S-04
    verification:
      - kind: unit
        ref: "src/screens/backup-dualhome-logic.test.ts#drains from the surviving Settings-hosted restore path"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Events root uses the canonical Events label and user-facing Events copy."
    requirement: S-05
    verification:
      - kind: integration
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Final copy and presentation are confirmed during physical-device UAT."
  - id: D5
    description: "All five tabs reselect through the shared pop-to-root handler while resume state remains navigator-owned."
    requirement: S-14
    verification:
      - kind: other
        ref: "source audit: six handleActiveTabPress occurrences (definition plus five listeners)"
        status: pass
    human_judgment: true
    rationale: "Reselect and background/resume behavior require physical-device UAT."

duration: 11min
completed: 2026-09-19
status: complete
---

# Phase 38 Plan 01: Five-Tab Digest Shell Summary

**A five-tab Digest-centered shell with independent origin-aware Digest and Events stacks, canonical labels, and a preserved Settings restore path**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-19T05:03:00Z
- **Completed:** 2026-09-19T05:13:41Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Replaced the four-tab shell with Contacts · Events · Digest · Orrery · Settings and made Digest the fresh-launch destination without renaming `DashboardTab`.
- Promoted Digest and Events to independent native stacks whose runtime descriptors include every Profile-reachable child route, including Recently Deleted.
- Removed the redundant Backup tab while preserving `.orbitbackup` share-intent restore through the Settings-hosted consumer.
- Relabelled the Events root and tab through canonical product-label constants.

## Task Commits

1. **Task 1: End-to-end five-tab shell** - `cb746dd` (feat)
2. **Task 2: Promote roots and complete origin-aware routes** - `774bb82` (feat)
3. **Task 3: Verify five-tab reselect contract** - `a7a7264` (test)

## Files Created/Modified

- `src/navigation/shell-contract.ts` - Pure runtime tab order, initial tab, and promoted-stack route descriptors.
- `src/navigation/tabs/DigestStack.tsx` - Independent descriptor-driven Digest stack.
- `src/navigation/tabs/EventsStack.tsx` - Independent descriptor-driven Events stack.
- `src/navigation/RootNavigator.tsx` - Five inline tabs with shared reselect-to-root listeners.
- `src/navigation/types.ts` - New promoted-stack param lists and five-tab container contract.
- `src/navigation/linking.ts` - Shared-backup intents now target Settings → Backup.
- `src/screens/backup-dualhome-logic.ts` - Settings is the sole live shared-backup consumer.
- `src/screens/GroupEventsScreen.tsx` - Canonical Events title and user-facing copy.

## Decisions Made

- Kept `DashboardTab` as the internal Contacts route id, enforcing the recorded FAB compatibility decision.
- Retained legacy `BackupStackParamList` in the root type intersection while removing only its bottom-tab exposure, as required by the plan.
- Used typed component registries plus runtime route arrays; narrow casts at the React Navigation map boundary are necessary because TypeScript cannot correlate union route names with their matching component prop types inside `map`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's literal grep count for `Digest: undefined` / `GroupEvents: undefined` cannot distinguish retained Dashboard entries from the same required root entries in the new promoted param lists. The intended invariant was verified directly: the Dashboard entries remain, and typecheck plus descriptor tests pass.
- `BackupScreen.tsx` has pre-existing whole-file Biome formatting drift. The plan-required gates pass; unrelated mechanical reformatting was not included.
- `requirements.mark-complete` found no checkbox IDs for the dossier-derived `S-01`, `S-02`, `S-04`, `S-05`, or `S-14`; REQUIREMENTS.md tracks Phase 38 as the aggregate `S-01…S-15` contract, so no requirement checkbox was changed.

## Verification

- `npx tsc --noEmit` — passed.
- `npx vitest run src/navigation src/components/icons src/screens/backup-dualhome-logic.test.ts` — 11 files / 186 tests passed.
- `npm run check:colors` — passed.
- All five `Tab.Screen` entries call `handleActiveTabPress`; a scoped audit found no promoted-root navigation calls in remaining DashboardStack-hosted screens outside `HomeScreen`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The permanent shell and promoted root stacks are ready for the remaining Phase 38 Digest composition and semantic-routing plans. Physical Android navigation/UAT remains assigned to Plan 07.

## Self-Check: PASSED

- All five created files exist.
- Task commits `cb746dd`, `774bb82`, and `a7a7264` exist in git history.
- Working tree contained only this uncommitted Summary before metadata/state updates.

---
*Phase: 38-your-week*
*Completed: 2026-09-19*
