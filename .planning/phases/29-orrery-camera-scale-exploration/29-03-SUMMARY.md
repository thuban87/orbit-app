---
phase: 29-orrery-camera-scale-exploration
plan: "03"
subsystem: ui
tags: [orrery, sqlite, systems, zustand, neutral, tdd]
requires:
  - phase: 29-01
    provides: Canonical scene, snapshot readers and guarded camera intents
  - phase: 29-02
    provides: Durable last-System preference and serialized preference writer
provides:
  - Closed builtin/category UID System predicates and transaction-composable membership authority
  - Coherent catalog, global sun, members and complete contacted reorder fingerprints
  - Generation-guarded System store and reachable scrolling selector with recovery
affects: [29-04, 29-08, 29-09, 29-10, 29-11, 29-12, 37]
tech-stack:
  added: []
  patterns: [explicit neutral population widening, read-only core composition, requested versus successful identity]
key-files:
  created:
    - src/logic/orrery-system-logic.ts
    - src/db/orrery-system-read.ts
    - src/db/orrery-system-read.test.ts
    - src/stores/orrery-system-store.ts
    - src/stores/orrery-system-store.test.ts
    - src/components/orrery/OrrerySystemSelector.tsx
    - src/components/orrery/orrery-controls-logic.ts
    - src/components/orrery/orrery-controls-logic.test.ts
  modified:
    - src/services/orrery-scene.ts
    - src/screens/OrreryScreen.tsx
    - src/components/orrery/OrreryWorld.tsx
    - src/components/orrery/OrreryViewOptions.tsx
    - src/stores/orrery-preferences-store.ts
    - src/stores/orrery-preferences-store.test.ts
    - src/db/lifecycle-consumer-ledger.test.ts
key-decisions:
  - Successful System membership stays usable when last-System persistence fails; only the newest read generation may publish or initiate persistence.
  - Global sun identity remains separate from member and satellite-parent eligibility; complete contacted rank eligibility never includes neutral rows.
requirements-completed: []
requirements-progressed: [ORRC-11, ORRC-12, ORRC-15]
coverage:
  - id: D1
    description: Explicit System membership, truthful null health, sun partition and transaction-composable rank inputs
    verification:
      - kind: integration
        ref: src/db/orrery-system-read.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Generation guards, stale versus failed switch, saved preference retry and ID/UID navigation validation
    verification:
      - kind: unit
        ref: src/stores/orrery-system-store.test.ts
        status: pass
      - kind: unit
        ref: src/stores/orrery-preferences-store.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Stable selector order, complete accessibility label and latest-callback dismissal
    verification:
      - kind: unit
        ref: src/components/orrery/orrery-controls-logic.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Native dropdown interaction, neutral Skia appearance, TalkBack focus return and scaled-text reflow
    verification: []
    human_judgment: true
    rationale: Node tests establish data/controller behavior, not native visual or assistive-technology evidence; deferred to approved end-of-phase device session.
duration: 16min
completed: 2026-09-07
status: complete
actuals:
  tokens: 17700
  tasks: 3
  commits: 7
---

# Phase 29 Plan 03: Live System Selection Summary

**All Contacts, Favorites, Needs Attention, Not Contacted, Snoozed, Chargers and live Categories now select coherent local membership with neutral never-contacted bodies and race-safe recovery.**

## Performance

- Completed 2026-09-07T08:25:00Z; approximately 16 minutes.
- Three tasks; sixteen implementation/test/ledger files changed.
- Actuals use ceil(70,799 realized diff characters / 4), excluding this closeout metadata. Seven commits include six RED/GREEN task commits and the metadata commit.

## Accomplishments

- Explicit All/Not widening preserves the existing contacted-only `listOrbitingContacts` contract. Bound/archive scope is retained throughout; neutral health/progress stays null, with the fixed north resting angle and existing neutral theme treatment.
- A single read lock supplies settings, profile/global sun, actual UID-bearing category catalog, members, sun-excluded orbiting bodies, complete contacted order, ID/UID fingerprints and eligible contacted visible IDs. There are no per-member Gravity reads.
- Category selection uses bound UID predicates and distinguishes deleted categories from empty results and database failures. Equal names remain distinct identities.
- The store distinguishes initial/loading/ready/stale/error/missing-category, invalidates cancelled and out-of-order requests, and separates destination identity from successful snapshot identity. Same-System failure retains inert stale content; switching clears old members. Successful selection persists through the existing serialized writer and remains usable on save failure.
- The screen restores the saved System after successful preference hydration, reacts to focus/shell refresh and discrete presentation changes, validates current System plus contact UID before navigation, and clears selection highlights on System changes.
- The selector has all six built-ins plus live categories, one explicit selected state, busy destination, ellipsized trigger with full accessible name, wrapping rows, scrolling bounds, unique transient identity and trigger-focus restoration. Both Orrery popups dismiss each other. Empty and failure feedback uses themed scrollable surfaces; Add Contact routes through the shell's Dashboard Create destination.

## Task Commits

1. 29-03-01 RED — `88e7098` tests for membership matrix, threshold/snooze semantics, category injection/identity, neutral placement and sun partition.
2. 29-03-01 GREEN — `ca7673c` coherent System readers and explicit neutral scene.
3. 29-03-02 RED — `fa92a90` race/failure/identity contracts.
4. 29-03-02 GREEN — `1d4bbe0` System store, screen lifecycle, navigation identity checks and successful-System preference correction.
5. 29-03-03 RED — `915cc3a` selector ordering, labels, transient callbacks and empty-state contracts.
6. 29-03-03 GREEN — `1484b9f` reachable selector/recovery, popup coexistence and lifecycle-consumer ledger registration.

All commits are local on main. No tracked file deletion, migration, dependency, device access or push occurred. Baseline unrelated files remain untouched.

## Exported Contracts

- `OrrerySystemRef`: `{ kind: "builtin", id: OrreryBuiltinId } | { kind: "category", uid: string }`. `parseSystemRef(unknown)` returns a validated ref or null; `systemRefId(ref)` returns the durable token. `SystemDescriptor` carries `ref`, durable `id`, and display `name`. Built-in names/order come from `BUILTIN_SYSTEMS`.
- `buildOrrerySystemWhere(ref): PopulationWhere` is the shared closed SQL/params authority for member reads and Plan 08's narrow target probe. It imports Dashboard predicate semantics, not Dashboard state.
- `readOrrerySystemMembersCore(ro, ref)` is composable inside an already-open read or write transaction. Result has `status: ready | missing-category`, `system`, and canonically ordered `members`; every member includes `id`, `uid`, nullable `last_contact`, `progress`, `status`, and presentation fields.
- `readOrrerySystemSnapshot(exec, ref = ALL_CONTACTS_SYSTEM)` opens the one read transaction. `readOrrerySystemSnapshotCore(ro, ref)` exposes its body for Plan 04's batch Gravity extension. Snapshot includes `categories`, `members`, `orbiting`, `settings`, `profile`, `header`, `occupant`, `savedSunContactId`, `resolvedSunIdentity`, `completeContactedOrder: number[]`, `contactIdentities: {id,uid}[]`, and `eligibleContactedVisibleIds: number[]`.
- `members` is the companion and satellite-parent authority, including a qualifying contact sun exactly once. `resolvedSunIdentity` is independent global sun identity, including when that sun does not qualify as a member. `contactIdentities` includes complete-order contacts plus any existing saved-sun row, including archived/neutral/Unbound fallback cases.
- `loadOrreryScene(exec, generation = 0, system = ALL_CONTACTS_SYSTEM)` now carries `system` and `systemSnapshot`; `contacts` means nullable-health orbiting members. A missing category throws typed `MissingOrreryCategoryError` carrying the explicit snapshot/catalog result for store handling.
- `createOrrerySystemStore({load, persist})` creates a screen-owned Zustand store. `select(ref,name?)`, `reload()`, `cancel()`, `current()`, and `retryPersistence()` drive its state. `current()` is null outside the latest successful actionable generation. Injected persistence returns boolean and routes through the shared preference writer in production.
- `OrrerySystemSelector({state,availableHeight,enabled})` consumes the current store state; `buildSystemChoices` and `systemEmptyCopy` are conventional-control helpers. Category CRUD remains Phase 37.

## Verification

- RED gates failed as expected before implementation for all three tasks. The additional failed-save reversal regression also failed before correction.
- Task 1: 23 tests / 3 files passed (`orrery-system-read orrery-read orrery-scene`).
- Task 2: 26 tests / 3 files passed (`orrery-system-store orrery-preferences-store orrery-scene`).
- Final targeted controls/System/lifecycle gate: 27 tests / 4 files passed.
- Final full suite: **256 files, 2,409 tests passed**. Evidence: `/tmp/orbit-29-03-tests-final.log` (03:23:55 local, 21.79s).
- `npx tsc --noEmit` passed; evidence `/tmp/orbit-29-03-types-final.log`. Color check, targeted Biome for fourteen implementation/test files, and `git diff --check` passed. The legacy ledger received additive ownership rows without unrelated reformatting.

## Deviations from Plan

1. **[Rule 1 — Bug] Successful return to a saved System after a failed destination save.** Integration exposed that the preference store's generic no-op guard retained the failed destination intent when the user selected the durable System again. Added a `lastSystem`-specific allowance plus a regression test in `orrery-preferences-store.test.ts`, preserving the existing density retry contract. Included in `1d4bbe0`.
2. **[Rule 2 — Missing critical integration] Popup coexistence.** Limited the View options trigger to its half of the HUD and mutually dismissed the two Orrery popups, preventing the new selector from covering conflicting actions. Included in `1484b9f`.
3. **[Rule 3 — Blocking verification] Lifecycle ledger registration.** First full run passed 255 files/2,408 tests but failed the enforced consumer inventory because the new System DAO was unregistered. Added its Bound/status ownership and mirrored `.planning/milestones/v1.0-phases/18.2-bound-unbound-lifecycle/18.2-VALIDATION.md`; targeted and full reruns passed. Included in `1484b9f`.
4. Requirement bookkeeping remains conservative: ORRC-11/12/15 progress here; later integration, companion/context and native verification still belong to remaining plans. No multi-plan requirement is marked complete early.
5. The SDK again counted `29-PLAN-CHECK.md` as an executable thirteenth plan. Corrected generated ROADMAP counters/list to 3/12; STATE advances to Plan 4 of 12. `state.update-progress` skipped its global prose update because phase scope is truncated, so no false phase-completion claim was added.

## Known Stubs and Native Verification

No placeholder data or TODO implementation was introduced. Empty arrays represent actual initial/no-member states, not mock sources. The companion UI, batch Gravity, narrow target DAO, guarded reorder, satellites and session restoration remain explicitly assigned to later plans.

Native System selector, Skia neutral bodies, TalkBack focus return and scaled-text layout await the approved end-of-phase device session. Recorded as WINDOWS entry **46**. Automated tests do not establish native gesture recognition, visual fit or phone performance.

## Self-Check: PASSED

All eight created source/test files exist, all six task commits exist in local history, final targeted/full verification passed, and the working tree contains no uncommitted implementation from this plan. No new network, auth, file-access or schema trust boundary was introduced.

## Next Plan Readiness

Plan 29-04 can extend `readOrrerySystemSnapshotCore` inside its existing read lock with full-history batch Gravity inputs and replace the temporary fixed-world geometry. Plan 08 reuses `buildOrrerySystemWhere`; Plan 09 calls `readOrrerySystemMembersCore` under its own write lock. The global nonmember sun is not a member/context parent. No later plan was executed.
