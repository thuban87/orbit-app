---
phase: 29-orrery-camera-scale-exploration
plan: "10"
subsystem: ui
tags: [orrery, relationships, sqlite, satellites, tdd]
requires:
  - phase: 29-09
    provides: Coherent System membership, authoritative projected frames and guarded reorder
provides:
  - Batched live unlinked relationship projection restricted to current System parent identities
  - Independently cancelled optional context loading and accessible parent relationship descriptions
  - Semantic subordinate moons with distinct relationship targets and contact-safe ambiguity
affects: [29-11, 29-12]
tech-stack:
  added: []
  patterns: [optional read generations, sampled-parent moon layout, discriminated relationship targets]
key-files:
  created:
    - src/db/orrery-satellites-read.ts
    - src/db/orrery-satellites-read.test.ts
    - src/components/orrery/orrery-satellite-context.ts
    - src/logic/orrery-satellite-logic.ts
    - src/logic/orrery-satellite-logic.test.ts
    - src/components/orrery/SatelliteBody.tsx
  modified:
    - src/services/orrery-scene.ts
    - src/screens/OrreryScreen.tsx
    - src/components/orrery/OrreryContactsSheet.tsx
    - src/components/orrery/OrreryFocusContext.tsx
    - src/components/orrery/OrreryWorld.tsx
    - src/logic/orrery-camera-logic.ts
    - src/logic/orrery-frame.ts
    - src/logic/orrery-focus-logic.ts
    - src/logic/orrery-reorder-logic.ts
    - src/components/orrery/orrery-controls-render.test.tsx
    - src/components/orrery/orrery-render.test.tsx
key-decisions:
  - Satellite queries recheck the shared live System predicate and supplied parent ID/UID inside one read snapshot; a global sun has no exception.
  - Moon positions derive from sampled parent world positions before the existing single projection; their native root Groups remain in the contact/sun depth batch.
  - Mixed moon/contact hits use the contact group and accessible parent path; any plausible moon hit prevents contact reorder capture.
requirements-completed: []
requirements-progressed: [ORRC-14, ORRC-15]
coverage:
  - id: D1
    description: Live visibility, link/delete/restore/purge/merge, parent identity and System membership govern optional satellites
    verification:
      - kind: integration
        ref: src/db/orrery-satellites-read.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Semantic moon layout, current-frame hits, distinct focus commands and mixed-hit reorder suppression
    verification:
      - kind: unit
        ref: src/logic/orrery-satellite-logic.test.ts
        status: pass
      - kind: integration
        ref: src/components/orrery/orrery-render.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Full Unicode parent context, failure retry, dismissal and relationship-only focus controls
    verification:
      - kind: integration
        ref: src/components/orrery/orrery-controls-render.test.tsx
        status: pass
    human_judgment: false
  - id: D4
    description: Native moon artwork/readability, TalkBack reachability, mixed-target gestures and depth/occlusion
    verification: []
    human_judgment: true
    rationale: Node tests inspect the installed Skia Group tree and callbacks but cannot prove Android drawing, accessibility or native gesture behavior. Plan 12 owns native evidence.
duration: 16min
completed: 2026-09-07
status: complete
actuals:
  tokens: 14901
  tasks: 2
  commits: 6
---

# Phase 29 Plan 10: Relationship Satellites Summary

**Eligible unlinked relationships now appear as optional semantic moons and accessible parent context, with live System membership and relationship-only interaction boundaries.**

## Accomplishments

- Read existing migration-016 relationships, visibility registry, relationship writers, merge, purge and restore application. Graph-first relationship discovery returned an INFERRED ADR-088 edge; the actual ADR and source confirm the structured model. No relationship inference, schema, storage or writer behavior changed.
- The read selects only relationship UID, parent ID/UID, person name, relation type and visibility. It excludes linked and deleted rows in SQL, resolves nullable visibility through the shared helper, deduplicates supplied parents, bounds IDs to 256 per query and filters parent UID before publication. The shared System predicate enforces live Bound/archive/population/Category membership at read time. Empty parents perform no queries; read failures remain errors. One outer read snapshot keeps batches coherent without nested mutex calls.
- Optional read generations are independent of the core scene. System loading/cancellation synchronously invalidates pending optional publication through the subscription. Preferences and scene generation gate all context/World props. Turning Off removes moons and context; successful membership changes reconcile the eligible rows. A nonmember contact sun remains a valid focus/Profile target but receives neither moons nor parent relationship content. Failed optional reads leave contacts/identity intact and expose the approved Reload satellites copy in conventional surfaces.
- Moon positions are deterministic UID-based offsets around the current sampled parent, with subordinate radius and no rails. They join the same projection as contacts, including transition/reorder positions. Their actual native root Groups are contiguous with contact/sun Groups, preserving comparable depth ordering. Overview suppresses them; identity/detail permits them. Frame loss/offscreen loss clears satellite focus via a discrete callback, with no per-frame React state.
- Satellite intent has its own identity payload and no contact IDs or command targets. Screen validation rechecks live rows and route/System/action generation before focus; it never navigates or writes relationships. Focus shows wrapping name/relation and Clear focus, without Profile. Mixed ambiguity groups actual contacts and satellite parents rather than guessing. Any plausible moon hit blocks reorder capture.
- Companion rows expose full original Unicode relationship text beneath matching parent identities without a precision canvas tap. Missing relation uses `A key person for {parentName}`; relation text uses `{relationType} of {parentName}`. No note, inferred relationship type, status, Gravity, cadence, membership, logging or children are attached to a moon.

## Exported Contracts

- `OrrerySatellite {uid, parentId, parentUid, personName, relationType}` and `readOrrerySatellites(exec, parents: readonly ContactIdentity[], system = ALL_CONTACTS_SYSTEM): Promise<OrrerySatellite[]>`.
- `OrrerySatelliteState {status: loading|ready|error, sceneGeneration: number|null, rows}` and `createOrrerySatelliteController(load, publish).reload(scene|null, enabled:boolean)`. `reload(null,false)` invalidates outstanding optional reads; the controller never writes core scene state.
- `satelliteContext(row, parentName): {name, relation}` keeps original text unchanged.
- `OrrerySatelliteTarget {kind:satellite, uid, parentId, parentUid}`; `OrreryIntent` adds `kind:satellite` with optional `satelliteTarget`. `WorldBody.kind` includes satellite and optional `satelliteTarget`; moon numerical IDs are negative sentinels and never contact identities. `bodyKey`/`satelliteKey` encode the complete parent-ID/UID and relationship-UID tuple.
- `deriveSatelliteBodies(world, rows, members, enabled, semanticLevel)` returns subordinate animated world bodies. `resolveSatelliteTap(frame,x,y,identities,visibleNames,members)` returns isolated satellite context intent or the existing contact/group intent.
- `OrreryWorld` accepts optional `satellites` and `focusedSatellite`; `OrreryFocusContext` accepts contact or satellite targets and omits Profile for satellites. `OrreryContactsSheet` accepts optional satellite state and retry callback. Screen owns their production wiring.

## Task Commits

1. Task 29-10-01 RED: `d900679` — eligible relationship/read cancellation specifications.
2. Task 29-10-01 GREEN: `d0670e4` — batched reader, optional controller, parent context and screen integration.
3. Task 29-10-02 RED: `91e692a` — semantic moon and distinct intent specifications.
4. Task 29-10-02 GREEN: `5f07da3` — projected moons, focus/ambiguity/reorder guards and integrated component/lifecycle coverage.

Four task commits, plus summary and tracking commits. All local on main with hooks. No tracked deletions. Unrelated baseline files and native build output were preserved.

## Verification

- RED gates failed on the missing new modules before their implementations. Both RED commits precede GREEN commits.
- Task 1 initial required SQLite/controller verification: **1 file / 6 tests passed**. Later additions cover Category D-11 contact-action parity, purge link clearing/ownership and out-of-order successful optional generations.
- Final targeted run: **5 files / 39 tests passed**, exit 0, `/tmp/orbit-29-10-targeted.log` (satellites SQL/pure logic, native-tree mock, conventional render and reorder suites).
- Final full regression: **272 files / 2,556 tests passed**, exit 0, **28.49 seconds**, `/tmp/orbit-29-10-tests-final.log`. Baseline was 270 files / 2,539 tests. No skips. No source changes followed this run.
- Final `npx tsc --noEmit`: exit 0; `/tmp/orbit-29-10-type-final.log` is empty. Seventeen-file Biome: exit 0, no warnings/fixes. `npm run check:colors` and `git diff --check`: exit 0.
- Native Android/Skia visuals, actual touch arbitration, TalkBack and performance remain unverified. No device operations were performed; Plan 12 retains the end-of-phase native evidence obligation.

## Deviations from Plan

1. **[Rule 2 — Required integration]** Modified OrreryScreen, camera/frame target contracts and contact/reorder guards in addition to the planned filenames. These are the existing production owners needed to connect optional context, preserve shared projection and prevent relationship identities or mixed moon hits from gaining contact command capability. Covered by the task-2 pure/render tests and complete regression. No architecture or owner decision was reversed.
2. Favorites and Category fixture parents require a last-contact value under the existing contacted-only System semantics. Corrected the test fixture rather than widening membership. Render assertions bound moon size instead of assuming the maximum, because real Gravity-scaled parent geometry can yield a smaller moon.

No new literal Bound/cadence predicate was introduced: the new DAO consumes the already registered `buildOrrerySystemWhere` predicate owner. The lifecycle consumer ledger passes in the full suite. No missing stub, skipped test or unrun automated verification remains. No new network, auth, filesystem or schema trust surface was introduced.

## Next Plan Readiness

Plan 11 should retain the satellite controller subscription and route/action invalidation while completing the full session lifecycle. Plan 12 should verify the combined D-11 matrix, optional failure/retry, mixed-hit behavior and native presentation. ORRC-14/15 remain unchecked at phase level because integrated and native evidence belongs to Plan 12.

Tracking SDK advanced to Plan 11 of 12 and recorded the execution metric/decision/session. Its progress recalculation declined the truncated milestone scope; the existing overall progress was retained. The roadmap SDK again counted `29-PLAN-CHECK.md` as a thirteenth plan; corrected the generated checklist/count to the twelve actual executable plans and ten summaries.

## Self-Check: PASSED

All six created source/test files exist on disk; all four task commit hashes exist. Targeted and full regression, typecheck, colors, formatting and whitespace checks passed. No push, worktree, branch switch, install or device action occurred.
