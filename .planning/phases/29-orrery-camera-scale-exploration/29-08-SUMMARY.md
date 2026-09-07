---
phase: 29-orrery-camera-scale-exploration
plan: "08"
subsystem: ui
tags: [orrery, focus, sqlite, accessibility, tdd]
requires:
  - phase: 29-07
    provides: Shared camera motion and authoritative projected frame
provides:
  - Narrow current member/global-sun validation with logical queued-action cancellation
  - Inclusive current-frame contact ambiguity and nonmodal floating group access
  - Exact-System companion media/health/Gravity and lightweight single-focus controls
affects: [29-09, 29-10, 29-11, 29-12]
tech-stack:
  added: []
  patterns: [discriminated contact targets, fresh bounded validation, shared projected-frame focus positioning]
key-files:
  created:
    - src/db/orrery-action-read.ts
    - src/logic/orrery-focus-logic.ts
    - src/logic/orrery-focus-logic.test.ts
    - src/components/orrery/OrreryClusterPanel.tsx
    - src/components/orrery/orrery-overlay-logic.ts
    - src/components/orrery/orrery-overlay-logic.test.ts
    - src/components/orrery/OrreryFocusContext.tsx
    - src/components/orrery/orrery-companion-logic.ts
    - src/components/orrery/orrery-companion-logic.test.ts
  modified:
    - src/logic/orrery-camera-logic.ts
    - src/components/orrery/use-orrery-camera.ts
    - src/components/orrery/OrreryWorld.tsx
    - src/components/orrery/OrreryContactsSheet.tsx
    - src/components/orrery/orrery-controls-render.test.tsx
    - src/screens/OrreryScreen.tsx
key-decisions:
  - Actual allocated name visibility determines inspected tap intent; target roles preserve global-sun eligibility independently of companion membership.
  - The cluster transient does not disable the world; modal transients still isolate it. Panel placement excludes its own measurement to avoid feedback.
  - The camera exposes the World-owned interpolated frame for native animated focus-context positioning without per-frame React updates.
requirements-completed: []
requirements-progressed: [ORRC-06, ORRC-07, ORRC-15]
coverage:
  - id: D1
    description: Fresh bounded SQL validation and cancellation of queued contact actions
    verification:
      - kind: integration
        ref: src/logic/orrery-focus-logic.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Exact target groups and companion membership, component identity and action contracts
    verification:
      - kind: unit
        ref: src/components/orrery/orrery-overlay-logic.test.ts
        status: pass
      - kind: unit
        ref: src/components/orrery/orrery-companion-logic.test.ts
        status: pass
      - kind: integration
        ref: src/components/orrery/orrery-controls-render.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Native TalkBack focus restoration, scaled text, modal isolation and floating group/world coexistence
    verification: []
    human_judgment: true
    rationale: Node component mocks do not run Android native layout, focus timing, TalkBack or gesture arbitration. Plan 12 owns this evidence.
duration: 22min
completed: 2026-09-07
status: complete
actuals:
  tokens: 16249
  tasks: 3
  commits: 9
---

# Phase 29 Plan 08: Focus and Accessible Exploration Summary

**Current-frame contact taps now validate live identity and member/global-sun eligibility before focus or Profile; ambiguous groups and exact-System companion rows provide conventional access.**

## Accomplishments

- `readOrreryContactTargetValidation` owns one `inReadSnapshot`, passes only its read executor through two SELECTs (three for Category), binds ID/UID and category values, reuses `buildOrrerySystemWhere`, and resolves the current global sun through `sunOccupantIsSelf`. It returns only the requested identity, membership truth, resolved sun identity and missing-category result. It does not load history, Gravity, order or the full scene. Invalid System values and database failure remain distinct from missing-category results. Scoped ADR-011/047/093/077 source comments explain the existing decisions.
- Ordinary targets carry `{kind:member,id,uid}`; canvas sun targets carry `{kind:contact-sun,id,uid}`. Member actions require current membership; sun actions require the same current global live sun irrespective of the System predicate. Candidate deduplication prefers the sun role and preserves System member order, appending a nonmember sun. Self has no contact action. The companion always uses member targets, including a qualifying sun.
- World taps use its actual interpolated frame and allocated visible name keys. Inclusive circular targets retain the minimum 44-unit diameter and collect every plausible contact irrespective of depth. No hit clears selection; a named isolated hit opens Profile, while a distant hit frames/highlights at the identity ceiling. Existing tracer defaults remain available for old callers; the production World supplies the new resolver.
- The action controller rechecks action generation and current route/System generation after every awaited probe. Superseding dispatch, Clear focus, empty/outside dismissal, Recenter, System request, blur, background and disposal invalidate pending intents. Blur/background callbacks cancel synchronously as well as through React cleanup, and the current adapter checks route liveness and AppState. Loaded identity and controls stay available without a new busy overlay.
- The floating Contacts here panel retains zero/one/many semantics, singular/plural count, wrapping names, separate Focus/Open Profile and Close contact group. It registers `orrery-cluster` with a stable callback. The world and Recenter remain enabled for that nonmodal transient; other modal transients block them. Panel geometry comes from available measured bounds, caps its scrolling height, registers its actual obstacle and allows `frameBodies` to reserve the remaining region. Rows are derived only from existing candidate identities and the loaded scene.
- The companion keeps exact snapshot ordering and membership, local Avatar photo/initials, readable health and available Gravity. Rows use vertical wrapping actions; focus/Profile close the sheet before validated dispatch. Existing Sheet modal, shell transient and trigger-focus restoration paths remain. A nonmember sun receives no companion row.
- `OrreryFocusContext` renders wrapping identity, Clear focus and Open Profile near the selected body through the same projected frame and native animated style. Its bounded scrolling context yields to measured controls. Optional parent relationship content/loading/error slots do not suppress identity. Snapshot reconciliation clears removed/reused identities, and offscreen loss uses a tested 44-unit margin beyond the effective target. Ordinary camera movement within that margin retains focus.

## Task Commits

1. Task 29-08-01 RED: `c0378c4` — fresh target and queued-cancellation specifications.
2. Task 29-08-01 GREEN: `95fad58` — DAO, target/controller logic, current-frame World and screen integration.
3. Task 29-08-01 fixture correction: `88fd5a4` — detach category before deletion, respecting the existing FK.
4. Task 29-08-02 RED: `ba29503` — group ordering, bounded placement and close-before-action.
5. Task 29-08-02 GREEN: `efd3cc2` — floating panel and nonmodal shell/camera integration.
6. Task 29-08-03 RED: `723196a` — exact companion membership and member-discriminated actions.
7. Task 29-08-03 GREEN: `5ee00ed` — companion context/media and single-focus surface.

Seven source/test commits plus summary and state metadata commits. All local on main with normal hooks; no tracked deletions, pushes, worktrees, branch switches, device operations, installs or schema changes. Unrelated dirty baseline files remain untouched.

## Exported Contracts

- `readOrreryContactTargetValidation(exec:SqlExecutor, system:OrrerySystemRef, target:OrreryContactTarget): Promise<OrreryTargetValidation>`; result is `{status:"ready"|"missing-category",identity:ContactIdentity|null,isMember:boolean,resolvedSunIdentity:ContactIdentity|null}`.
- `OrreryContactTarget = ContactIdentity & {kind:"member"|"contact-sun"}`; `OrreryIntent` adds optional `targets` while retaining legacy ids/generation. New production dispatch requires targets.
- `resolveOrreryTap(frame,x,y,identities,visibleNames,members):OrreryIntent`, `orderContactTargets`, `sameContact`, `validateOrreryContactTarget`, `reconcileFocus`, and worklet `focusEffectivelyOffscreen(frame,id)`.
- `createOrreryFocusController({current,validate,focus,group,clear,openProfile,reject})` returns `dispatch(intent):Promise<void>` and `cancel(reason)`. Cancellation is logical only; it does not remove pending work from the FIFO or abort another transaction. Rejection reasons are removed/missing-category/error.
- Camera controller adds shared `active` motion and `frame:SharedValue<ProjectedFrame|null>`. World copies its authoritative interpolated frame to that cell on the UI thread. `createOrreryGestures` accepts optional `resolveTap`; World adds optional `onFocusLost`.
- `clusterRows(targets,members,sun)`, `clusterCount`, `clusterRegion(viewport)`, `closeBeforeAction(close,action)`; `CLUSTER_OBSTACLE="orrery-cluster-panel"`. The panel receives loaded targets/scene and current viewport, stale/blocked flags and callbacks.
- `companionRows(scene|null)` returns `{member,context}` rows. `companionAction(scene,kind,id)` returns the exact member intent or null. `OrreryContactsSheet` adds optional `relationshipContextById` for Plan 10.
- `OrreryFocusContext` receives target/name/shared frame, blocked flag, Clear/Profile callbacks and optional relationshipContext/contextState/onReloadContext. Plan 10 must provide relationship content only for qualifying member parents; no relationship query or nonmember-sun context is introduced here.

## Verification

- Three RED gates failed on their absent production modules before implementation.
- Task 1 initial integrated focus/render/scene/lifecycle-ledger run: **4 files / 35 tests passed**. The added large-population category fixture initially failed on an existing FK after that run; corrected in `88fd5a4`, then the owning suite passed **13 tests**. The production commit preceded this fixture correction; the final tree has no failing test.
- Final targeted owning/component suite: **4 files / 28 tests passed**, exit 0, `/tmp/orbit-29-08-targeted-final.log`.
- Final complete `npm test`: **269 files / 2,502 tests passed**, exit 0, 23.01 seconds, `/tmp/orbit-29-08-tests-final.log`. Baseline: 266 files / 2,482 tests. No skipped tests; no source changes followed the full run.
- `npx tsc --noEmit`: exit 0, `/tmp/orbit-29-08-types3-final.log` empty. `npm run check:colors`: exit 0, `/tmp/orbit-29-08-colors-final.log`. Fifteen-file targeted Biome: exit 0, `/tmp/orbit-29-08-biome-final.log`. `git diff --check` passed.
- SQL tests compare all six builtins and Category against actual snapshots, with contacted/neutral, Favorites, snooze and current status inputs. They cover category rename/removal, sun reassignment, archive/Unbinding/changed UID, a 121-contact population, two/three statement bounds and one BEGIN/COMMIT. Deferred mutex holders exercise all named cancellation reasons and a rejected holder control. These are controller/SQL tests; native event delivery is not claimed.
- Context7/ctx7 unavailable. Used existing installed integration patterns and official Reanimated 4.x [useAnimatedStyle documentation](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedStyle/) for shared-value native styling. No dependency changes.

## Deviations from Plan

1. **[Rule 2 — Critical integration] Expanded existing screen and intent contracts during Task 1.** The production dispatch owner was in OrreryScreen, so it was replaced there rather than leaving the new DAO unused. Added optional target payload to camera intent and shared frame exposure for actual focus positioning. Existing tracer exports remain compatible.
2. **[Rule 1 — Test fixture] Category deletion requires detachment.** The test initially tried to delete a referenced Category. Corrected only the test fixture; no FK or stored-data behavior was changed.
3. **[Rule 2 — Critical integration] Synchronous lifecycle cancellation.** Native blur/background callbacks invalidate pending intent before React effect processing; current action checks additionally require live route/AppState.
4. Requirements ORRC-06/07/15 remain pending because COVERAGE assigns later integration/native and satellite responsibilities. No premature requirement completion.

## Cross-Plan and Native Limitations

- Plan 12 must retain native TalkBack names/action ordering, trigger-focus restoration, modal isolation, large-font wrapping, native focus positioning and group/world coexistence checks. WINDOWS entry **52** records this unrun human verification. Node tests cannot prove native layout or gesture arbitration.
- The two/three-SELECT probe still queues behind automatic backup snapshots, scene reads and app writes on the existing shared FIFO mutex. Loaded UI stays available and cancelled actions never publish after lock release; wait/hold latency is unmeasured. Preserve this note in Plan 12; Phase 40 owns measured contention optimization. No mutex priority, timeout or atomicity change was made.
- Satellite relationship content/semantics remain Plan 10; session restoration/fresh-visit refinements remain Plan 11. Slots are optional content seams, not fabricated data. No later plan was executed.
- No placeholder source data, skipped tests, new network/auth/schema/file-access boundary or unrun automated plan command was introduced. The new DAO reads existing on-device tables only.

## Performance

Approximately 16:45–17:07 UTC on 2026-09-07; three tasks and fifteen source/test files. Estimate-scale actual: ceil(64,993 realized source/test diff characters / 4) = **16,249**, not harness tokens.

## Self-Check: PASSED

All nine new source/test files exist, all seven task/fix commits exist, no tracked files were deleted, all required automated checks passed and source changes are committed. Summary is on disk before state advancement.
