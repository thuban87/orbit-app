---
phase: 29-orrery-camera-scale-exploration
review_path: .planning/phases/29-orrery-camera-scale-exploration/29-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 29: Code Review Fix Report

All five findings have local fixes. Orchestrator checked commit contents and current source. Independent data re-review confirmed CR-04 resolved with 109 passing tests. Independent native code re-review confirmed CR-01, CR-02, CR-03 and WR-01 resolved on 2026-09-07, with full current implementation and regression reads plus 4 targeted files / 16 tests passing. The compiled worklet boundary, installed mapper registry and measured-group harness represent their respective fixes; adapted native layout/scheduling remains explicitly limited. Device acceptance remains pending separately. The latest 29-REVIEW.md has zero open findings and retains the resolved audit trail.

Final combined checks after all five fixes: **278 test files / 2,595 tests passed**, `npx tsc --noEmit` exit 0, color-token check exit 0, and whitespace check exit 0. Full-suite log: `/tmp/orbit-29-review-final-tests.log`. No push or device operation performed.

# Phase 29: Native Code Review Fix Report

Four assigned findings fixed in place on main. No worktree, branch switch, push, device action, dependency installation, or unrelated file change. CR-04 belongs to the separate data fixer. 

## Fixed Issues

### CR-01: Camera lifecycle calls an ordinary JS helper on the UI runtime

**Status:** fixed
**Commit:** d9cb8ad
**Files modified:** `src/components/orrery/use-orrery-camera.ts`, `src/components/orrery/orrery-worklet-boundary.test.ts` (new regression file).

Changed `initialSamples` to a worklet block function. The test executes the actual production Babel-emitted lifecycle code in a VM that rejects synchronous calls to ordinary closure functions. Disabled setup and cleanup both failed before the fix with `Synchronous remote function call`; both pass afterward, including cleared frame/reorder, cancelled input, reset samples and stopped motion. This is a transform/runtime-boundary test, not an identity runOnUI mock or a physical-device crash claim.

### CR-02: Reorder pointer crosses the projection horizon

**Status:** fixed: requires human verification
**Commit:** 6a8382d
**Files modified:** `src/logic/orrery-camera-logic.ts`, `src/logic/orrery-reorder-logic.ts`, `src/logic/orrery-reorder-logic.test.ts`, `src/components/orrery/use-orrery-camera.ts`.

Added guarded nullable inverse projection for gesture samples, preserving the strict inverse's denominator exception. Capture rejects unreachable/nonfinite samples; movement explicitly cancels the entire hold on an unreachable sample. The registered callback clears the drag and cancels its owner. Returning to reachable ground and successfully releasing cannot revive or commit it. Existing DAO guards are unchanged.

Independently reproduced the reported 400×700 / zoom 0.25 / tilt 60° geometry: capture at (250,350), movement to (250,0) threw before the fix. Regression also exercises a real registered hold's changed-rank preview, horizon crossing, return, successful end and finalize with zero commits, plus nonfinite pointer values.

### CR-03: Group opening frames before panel measurement

**Status:** fixed: requires human verification
**Commit:** 1428942
**Files modified:** `src/screens/OrreryScreen.tsx`, `src/screens/orrery-screen-framing.test.ts` (new regression file).

Group actions stop motion and defer framing until the panel obstacle exists. The screen's geometry effect includes group identity/generation and recomputes group framing on measured viewport changes, replacing interrupted recovery. Clearing a measurement invalidates the remembered frame key, including when a font reflow returns exactly the same rectangle. Nonmodal canvas, measured exclusions, current target validation and stale animation-generation rejection remain intact.

The regression executes production-transformed screen and camera-hook modules with deterministic React effect/state adapters, a native animation completion adapter, actual camera/focus logic, and actual obstacle store/measurement generation controller. It fails before the fix because group opening immediately starts recovery against the old viewport. It passes open → delayed measurement → interrupted recovery → changed-size or same-size remeasurement → settled body hit bounds inside the usable rectangle → close → rejected late measurement. Child rendering/native font measurement is adapted; this does not assert device font-layout correctness.

### WR-01: Published frame feeds its producing mapper

**Status:** fixed: requires human verification
**Commit:** c8138d5
**Files modified:** `src/components/orrery/OrreryWorld.tsx`, `src/components/orrery/orrery-frame-mapper.test.ts` (new regression file).

The projection updater captures the reorder SharedValue directly instead of the entire controller containing its published output. The same projected frame remains the rendering/hit/focus authority and is still published to `camera.frame`.

Regression extracts the actual production Babel-emitted updater and its closure inputs, runs real projection functions, and registers producer/publication edges in the installed Reanimated `createMapperRegistry` implementation (transpiled in memory; dependency files untouched). Before the fix five idle passes produced five projections. After the fix five idle passes produce one projection/publication; changing pose causes exactly one additional projection/publication, and the published object is the produced frame.

## Verification

All checks ran in the **main checkout** at `/home/bwales/projects/orbit-app`; worktrees are disabled. Modified sections were reread before commits.

| Finding | Targeted automated checks | Result |
|---|---|---|
| CR-01 | `npm test -- src/components/orrery/orrery-worklet-boundary.test.ts src/logic/orrery-session-logic.test.ts` | Exit 0; 2 files, 7 tests |
| CR-02 | `npm test -- src/logic/orrery-reorder-logic.test.ts src/logic/orrery-camera-logic.test.ts src/logic/orrery-gesture-logic.test.ts` | Exit 0; 3 files, 24 tests |
| CR-03 | `npm test -- src/screens/orrery-screen-framing.test.ts src/components/orrery/orrery-controls-render.test.tsx src/components/orrery/orrery-overlay-logic.test.ts src/logic/orrery-session-logic.test.ts` | Exit 0; 4 files, 22 tests |
| WR-01 | `npm test -- src/components/orrery/orrery-frame-mapper.test.ts src/components/orrery/orrery-render.test.tsx src/logic/orrery-frame.test.ts` | Exit 0; 3 files, 13 tests |

`npx tsc --noEmit` passed after each finding (exit 0). Targeted Biome checks passed for changed source/tests. Final `npm run check:colors` passed (exit 0). The regression development runs intentionally failed before fixes as described above; final runs passed. Root owns the final complete suite, so it was not repeated here.

Native gesture arbitration, font layout, lifecycle behavior and device rendering remain subject to the phase's existing human checklist. No phone performance or frame-rate claim is made. All four assigned findings were attempted; none skipped. Baseline phase24.1 artifacts, tsconfig dirt, phase27 verification and native module build directories were preserved.

# Phase 29: Data Review Fix Report

## CR-04: Merge restore leaves retained contacts' recency stale

**Status:** fixed: requires human verification
**Commit:** `f44648a` — `fix(29): CR-04 recompute retained contact recency after restore`
**Files modified:** `src/backup/restore-apply.ts`, `src/backup/restore-apply.test.ts`

Restore now gathers contact UIDs for all contact writes and interaction insert/update/delete actions inside its existing transaction. It captures old interaction parents before mutation, adds incoming parents, and recomputes surviving contacts after all child writes. The existing `recomputeLastContactCore` remains the sole recency writer; it receives each surviving row's winning `modified_at` explicitly. Reconciliation precedence, tombstones, photo staging, and transaction boundaries remain intact. Qualification-flag changes remain covered by contact writes.

Eight real SQLite regression cases cover insertion into retained metadata; lowering the newest interaction with a remaining older maximum; disconnecting a rarely-responds interaction; tombstone deletion; reparenting across surviving contacts; a changed contact qualification flag with retained history; reparenting while the old parent is deleted; and rollback of history, recency, and tombstones on a later write failure. The original reproduction and mutation cases query the actual `readOrrerySystemSnapshot` Not Contacted System. Restore tests now migrate through version 21. No new source/test file was created.

## Verification

All verification ran in the **main checkout**, with worktrees disabled. Native photo and schedule adapters retain the suite's existing stubs; migrations, SQLite, export/validation, reconciliation, restore, recency, and System queries execute production code.

- Before source fix: `npx vitest run src/backup/restore-apply.test.ts` exited **1**, with five new regressions failing on the expected stale values and 21 tests passing.
- After the fix and all eight regression cases: `npx vitest run src/backup/restore-apply.test.ts src/backup/reconciliation.test.ts src/db/recency-dao.test.ts src/backup/phase-17-integration.test.ts src/backup/phase-17-runtime-integration.test.ts` exited **0**: **5 suites, 76 tests passed**.
- `npx tsc --noEmit` exited **0**.
- Modified sections were reread; `git diff --check` passed. `git show --stat f44648a` confirms exactly the two owned backup files; both are clean after commit.

Graph discovery reported governing restore ADR edges as **INFERRED**, including ADR-060's partial supersession by ADR-063. The governing recency/restore decisions and actual SQL writers were read before implementation. No decision reversal or network/device work occurred. Root orchestrator owns the final whole-suite run and report consolidation. Unrelated existing changes were preserved.
