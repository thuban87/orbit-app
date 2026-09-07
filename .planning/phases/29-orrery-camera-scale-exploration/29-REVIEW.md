---
phase: 29-orrery-camera-scale-exploration
reviewed: 2026-09-07T18:34:20Z
re_reviewed: 2026-09-07T18:49:25Z
depth: deep
files_reviewed: 116
files_reviewed_list:
  - src/components/orrery/orrery-worklet-boundary.test.ts
  - src/components/orrery/orrery-frame-mapper.test.ts
  - src/screens/orrery-screen-framing.test.ts
  - src/backup/export-manifest.ts
  - src/backup/orrery-preferences-portability.test.ts
  - src/backup/reconciliation.ts
  - src/backup/restore-apply.ts
  - src/components/UniversalFab.tsx
  - src/components/icons/icon-registry.ts
  - src/components/orrery/OrbitBody.tsx
  - src/components/orrery/OrreryCanvas.tsx
  - src/components/orrery/OrreryClusterPanel.tsx
  - src/components/orrery/OrreryContactsSheet.tsx
  - src/components/orrery/OrreryControls.tsx
  - src/components/orrery/OrreryFeedback.tsx
  - src/components/orrery/OrreryFocusContext.tsx
  - src/components/orrery/OrreryLabel.tsx
  - src/components/orrery/OrreryObstacle.tsx
  - src/components/orrery/OrrerySystemSelector.tsx
  - src/components/orrery/OrreryViewOptions.tsx
  - src/components/orrery/OrreryWorld.tsx
  - src/components/orrery/Polaris.tsx
  - src/components/orrery/ProjectedOrbitRing.tsx
  - src/components/orrery/SatelliteBody.tsx
  - src/components/orrery/SunBody.tsx
  - src/components/orrery/orrery-clock-context.ts
  - src/components/orrery/orrery-companion-logic.ts
  - src/components/orrery/orrery-controls-logic.ts
  - src/components/orrery/orrery-controls-render.test.tsx
  - src/components/orrery/orrery-feedback-logic.ts
  - src/components/orrery/orrery-obstacle-logic.ts
  - src/components/orrery/orrery-overlay-logic.ts
  - src/components/orrery/orrery-render.test.tsx
  - src/components/orrery/orrery-satellite-context.ts
  - src/components/orrery/use-orrery-camera.ts
  - src/db/__testkit__/node-sqlite.ts
  - src/db/app-settings-dao.ts
  - src/db/bulk-actions-dao.ts
  - src/db/bulk-review-dao.ts
  - src/db/contact-lifecycle-dao.ts
  - src/db/contact-read.ts
  - src/db/contact-status-read.ts
  - src/db/contacts-dao.ts
  - src/db/data-revision-dao.ts
  - src/db/favourites-dao.ts
  - src/db/impact-read.ts
  - src/db/imported-contact-dao.ts
  - src/db/merge-dao.ts
  - src/db/migrations/001-initial.ts
  - src/db/migrations/002-app-settings.ts
  - src/db/migrations/003-orrery-settings.ts
  - src/db/migrations/011-contact-lifecycle-schema.ts
  - src/db/migrations/016-contact-knowledge.ts
  - src/db/migrations/021-orrery-preferences.ts
  - src/db/migrations/runner.ts
  - src/db/orrery-action-read.ts
  - src/db/orrery-impact-read.test.ts
  - src/db/orrery-impact-read.ts
  - src/db/orrery-preferences.test.ts
  - src/db/orrery-read.test.ts
  - src/db/orrery-read.ts
  - src/db/orrery-satellites-read.test.ts
  - src/db/orrery-satellites-read.ts
  - src/db/orrery-system-read.test.ts
  - src/db/orrery-system-read.ts
  - src/db/profile-dao.ts
  - src/db/purge-dao.ts
  - src/db/recency-dao.ts
  - src/db/relationships-dao.ts
  - src/db/relationships-read.ts
  - src/db/ring-seq-dao.test.ts
  - src/db/ring-seq-dao.ts
  - src/db/snooze-dao.ts
  - src/db/status.ts
  - src/db/transaction.ts
  - src/logic/orrery-camera-logic.test.ts
  - src/logic/orrery-camera-logic.ts
  - src/logic/orrery-focus-logic.ts
  - src/logic/orrery-frame.test.ts
  - src/logic/orrery-frame.ts
  - src/logic/orrery-geometry-logic.ts
  - src/logic/orrery-gesture-logic.test.ts
  - src/logic/orrery-gesture-logic.ts
  - src/logic/orrery-label-logic.ts
  - src/logic/orrery-recovery-logic.test.ts
  - src/logic/orrery-recovery-logic.ts
  - src/logic/orrery-reorder-logic.test.ts
  - src/logic/orrery-reorder-logic.ts
  - src/logic/orrery-satellite-logic.test.ts
  - src/logic/orrery-satellite-logic.ts
  - src/logic/orrery-session-logic.test.ts
  - src/logic/orrery-session-logic.ts
  - src/logic/orrery-system-logic.ts
  - src/logic/orrery-world-logic.test.ts
  - src/logic/orrery-world-logic.ts
  - src/logic/ring-reorder-logic.ts
  - src/logic/sun-occupant-logic.ts
  - src/navigation/RootNavigator.tsx
  - src/navigation/tabs/OrreryStack.tsx
  - src/navigation/use-window-measurement.ts
  - src/screens/OrreryScreen.tsx
  - src/services/impact.ts
  - src/services/import/source-consolidation.ts
  - src/services/orrery-exploration.integration.test.ts
  - src/services/orrery-scene.test.ts
  - src/services/orrery-scene.ts
  - src/services/widget/widget-mark.ts
  - src/stores/orrery-preferences-store.test.ts
  - src/stores/orrery-preferences-store.ts
  - src/stores/orrery-session-store.ts
  - src/stores/orrery-system-store.test.ts
  - src/stores/orrery-system-store.ts
  - src/stores/shell-obstacle-store.ts
  - src/stores/shell-refresh-store.ts
  - src/stores/shell-transient-store.ts
  - src/theme/use-reduced-motion.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
resolved_findings:
  critical: 4
  warning: 1
  total: 5
status: clean
---

# Phase 29: Code Review Report

## Narrative Findings (AI reviewer)

All five original findings are resolved after the bounded fix re-review. No open BLOCKER or WARNING remains within that review scope. The original evidence below is retained as a historical audit trail; its line references describe the pre-fix revision and are not current defect locations. CR-04 was a pre-existing shared restore defect exposed by the subsystem audit. Reviewers changed only review artifacts and performed no device operations.

### Fix re-review — 2026-09-07

The native reviewer reread the full current camera hook, camera/reorder logic, world renderer, screen, recovery logic, cluster/obstacle measurement chain, and all four targeted regression files. Commit contents and current source were checked for d9cb8ad, 6a8382d, 1428942, and c8138d5. The previously established graph/ADR authority and original coverage limits still apply; this is a bounded repair recheck, not a new claim of exhaustive repository coverage.

| Historical finding | Resolution and independently checked evidence |
|---|---|
| CR-01 — BLOCKER, resolved | d9cb8ad makes the reset helper a worklet. The actual production Babel lifecycle worklets execute in the boundary harness for disabled setup and enabled/disabled cleanup; reset, cancellation, cleared frame/reorder and motion stopping are asserted. |
| CR-02 — BLOCKER, resolved | 6a8382d adds nullable guarded inverse sampling while preserving the strict projection exception. Capture rejects invalid samples; crossing the horizon cancels the registered hold's drag and input owner. Returning to ground cannot revive the changed-rank preview or commit it. |
| CR-03 — BLOCKER, resolved | 1428942 defers group framing until the panel obstacle is measured, includes group generation/identity in the framing key, and replaces recovery on measurement changes. The screen/camera harness covers delayed measurement, changed-size and same-size remeasurement, stale completion rejection, settled hit bounds, and close/late-measurement rejection. Actual child layout is adapted, so this does not certify native font layout. |
| CR-04 — BLOCKER, resolved | f44648a was independently re-reviewed by the data reviewer, with full restore source/tests and 109 passing targeted tests. The orchestrator verified source and commit contents: affected old/new interaction parents are recomputed transactionally through the existing core while preserving winning metadata timestamps. |
| WR-01 — WARNING, resolved | c8138d5 captures only the reorder SharedValue. The actual production-emitted updater and installed native mapper registry now settle after one idle projection/publication; a pose change produces exactly one further projection and preserves published-frame identity. |

Independent native re-review command: `npm test -- src/components/orrery/orrery-worklet-boundary.test.ts src/components/orrery/orrery-frame-mapper.test.ts src/screens/orrery-screen-framing.test.ts src/logic/orrery-reorder-logic.test.ts` — **4 files / 16 tests passed**, exit 0. The tests were read to distinguish real production transform/mapper/geometry execution from adapted React/native scheduling and measurement. No open code defect was found in these fixes.

The orchestrator additionally reports final combined checks of **278 test files / 2,595 tests passing**, TypeScript, color-token and whitespace checks exiting 0 (`/tmp/orbit-29-review-final-tests.log`). Native gesture arbitration, actual lifecycle transitions, photo decoding, font-scale/accessibility layout and physical-device rendering remain acceptance work; they are not represented as completed by this code-review status.

### CR-01 — BLOCKER, RESOLVED: Camera lifecycle invokes an ordinary JavaScript function on the UI runtime

**File:** `/home/bwales/projects/orbit-app/src/components/orrery/use-orrery-camera.ts:59`  
**Call sites:** lines 141 and 152.

`initialSamples` is an ordinary expression-bodied function without a worklet directive. Both lifecycle worklets call it synchronously. The initial screen has no measured canvas and disables the camera, so the disabled setup already reaches this call. Subsequent blur, overlay changes, viewport changes, and cleanup reach it again. The exception precedes cancellation and stopping motion.

**Evidence/reproduction:** Transform the actual file through its production Babel configuration and inspect `initialSamples` and the generated worklet `code` properties. The helper remains ordinary JS while both generated lifecycle worklets capture it in `this.__closure` and invoke it. The installed `react-native-worklets/src/memory/remoteFunctionUnpacker.native.ts:12` rejects synchronous remote-function invocation. This is a demonstrated transform/runtime incompatibility; a physical-device crash was not observed in this review.

```sh
node -e 'const b=require("@babel/core"),tr=require("@babel/traverse").default;const r=b.transformFileSync("src/components/orrery/use-orrery-camera.ts",{envName:"production",compact:false,ast:true});tr(r.ast,{VariableDeclarator(p){if(p.node.id.name==="initialSamples")console.log(require("@babel/generator").default(p.node).code)},ObjectProperty(p){if(p.node.key.name==="code"&&typeof p.node.value.value==="string"&&p.node.value.value.includes("initialSamples"))console.log(p.node.value.value)}})'
```

**Preserving-control fix:** Give the helper a block body with a `"worklet"` directive, or inline its literal in the lifecycle worklets. Preserve UI-side cancellation, generation invalidation, blur/background stopping, and overlay gating. Add a production-transform boundary regression; identity `runOnUI` mocks in `src/logic/orrery-session-logic.test.ts` cannot exercise this failure.

### CR-02 — BLOCKER, RESOLVED: A valid reorder drag throws when its pointer crosses the projection horizon

**File:** `/home/bwales/projects/orbit-app/src/logic/orrery-reorder-logic.ts:83`  
**Caller:** `src/components/orrery/use-orrery-camera.ts:504`.

Reorder unconditionally inverse-projects the pointer. At permitted high tilt and low zoom, part of the visible viewport lies beyond the inverse ground-plane domain. The inverse correctly throws there, but the actual gesture callback neither checks that domain nor cancels the drag. Capture also inverse-projects the pointer without a domain check at line 58.

**Reproduction:** Build a frame with viewport 400×700, pose `{x:0,y:0,zoom:0.25,tilt:Math.PI/3,yaw:0}`, extent 300, a Sun at (0,0), and eligible contacts at (200,0) and (-250,0), radii 16, ring radii 200 and 250. Use the All Contacts System, matching generation and full/eligible order [1,2]. Contact 1 projects to (250,350). Capture at that center succeeds with a unique hit; moving the captured drag to (250,0) throws `Point outside inverse Orrery camera plane`. This was reproduced directly with the production projection/capture/move functions. It is a normal in-viewport finger movement, not malformed external input.

**Preserving-control fix:** Check the inverse domain and finite values before capture and movement; cancel the drag or ignore an unreachable sample according to one explicit policy. Ensure a cancelled drag cannot commit on release. Keep the projection denominator checks and the DAO's System, generation, identity, and eligible-slot checks. Extend `src/logic/orrery-reorder-logic.test.ts` to cover both sides of the horizon and the registered gesture's cancellation/release path.

### CR-03 — BLOCKER, RESOLVED: Opening a cluster fits against the old viewport, then interrupts recovery without refitting

**Files:** `/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:504`, `src/screens/OrreryScreen.tsx:475`, `src/screens/OrreryScreen.tsx:680`.

The group action opens the panel and immediately frames selected bodies using the viewport captured before the panel has been measured. The panel subsequently registers its obstacle. That viewport change replaces the camera motion dependency and stops recovery during cleanup. The same-System/density branch then only stops and clamps the pose; it returns before focused-body framing. Selected bodies can remain behind the panel or offscreen.

**Reproduction:** Production `frameBodies`, `clusterRegion`, and `projectFrame` demonstrate the geometry without a device. Start with a 400×600 viewport and controls obstacle `{x:184,y:400,width:200,height:180}`. Frame two radius-16 contacts at (0,-58) and (0,-92), extent 120. The old usable rectangle is 400×400 and the target is y=-75, zoom=4. The cluster region is `{x:0,y:200,width:400,height:200}`; registering it leaves a 400×200 usable rectangle. Reprojecting that target yields body vertical extents 104..232 and -32..96. Neither the group callback nor the obstacle-change branch supplies a replacement fitting target. Asynchronous measurement can also interrupt the animation before its old target is reached.

**Preserving-control fix:** Coordinate group framing with the panel's actual measured obstacle, and recompute focused-body framing when that obstacle changes. Preserve the nonmodal canvas, obstacle avoidance, arbitrary-body framing, and cancellation of stale generations. Add an open → delayed measurement → settled framing regression in the screen/control integration harness; also cover closing the panel and font-size-driven measurement changes.

### CR-04 — BLOCKER, RESOLVED: Merge restore leaves recency stale for retained contacts whose history changes

**File:** `/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:291`  
**Classification:** Pre-existing shared-subsystem defect; last source change predates Phase 29 (`9fa16d5`).

After applying child writes, restore recomputes recency only for inserted/updated contacts. Reconciliation can retain newer local contact metadata while inserting, updating, deleting, or reparenting its interactions. Those retained contacts are skipped, so persisted `contacts.last_contact` diverges from the accepted interaction history. Orrery's Not Contacted membership and progress then become incorrect.

**Reproduction verified independently by both reviewers:** Open two in-memory SQLite databases and apply production migrations 1–21. On source, create UID `same-contact` at 2026-08-01 12:00:00 and record a touchpoint at 2026-08-20 12:00:00. On destination, create the same UID with newer metadata at 2026-08-21 12:00:00 and no interaction. Export source using `buildExportManifest` and merge through `applyRestore`. The actual result inserts one interaction and retains the contact:

```json
{"inserted":1,"updated":0,"retained":6,"contacts":[{"name":"Newer local name","last_contact":null}],"interactions":[{"occurred_at":"2026-08-20 12:00:00"}],"notContacted":[{"name":"Newer local name","progress":null}]}
```

The final `notContacted` value comes from production `readOrrerySystemSnapshot` with `{kind:"builtin",id:"not-contacted"}`, not an emulated membership calculation. Only unavailable native photo, schedule, and UUID adapters were stubbed; schema, reconciliation, SQLite, recency writes, export, restore, and System reads were real.

**Preserving-control fix:** Collect every surviving contact affected by interaction insert/update/delete/reparenting, including the old parent captured before mutation, together with contacts whose recency qualification flags change. Recompute through the existing `recomputeLastContactCore` inside the same restore transaction. Preserve the winning contact metadata timestamp explicitly because this core also writes `modified_at`. Keep reconciliation precedence, tombstones, staged photo handling, single recency-writer discipline, and atomic restore. Add a regression beside the backup merge tests and assert actual Orrery System membership as well as `last_contact`.

### WR-01 — WARNING, RESOLVED: Publishing the projected frame feeds its own derived mapper indefinitely

**File:** `/home/bwales/projects/orbit-app/src/components/orrery/OrreryWorld.tsx:277`  
**Feedback write:** line 305; camera object construction is `src/components/orrery/use-orrery-camera.ts:159`.

The frame updater reads `camera.reorder.value`, causing the production Babel worklet to capture the whole plain `camera` object. That object also contains `camera.frame`. The installed `useDerivedValue` derives mapper inputs from closure values (`react-native-reanimated/src/hook/useDerivedValue.ts:45`), and `mappers.ts:173` recursively extracts SharedValues from plain objects. Consequently `camera.frame` becomes an input to the frame mapper. The reaction writes each fresh projected frame into that input, which dirties the frame mapper again even when camera, transition, and scene inputs are unchanged.

**Evidence:** Inspected the production-transformed closure and executed the installed `createMapperRegistry` implementation in a small in-memory harness with structural SharedValues, native scheduling flags, and the same two mapper edges. Five idle mapper passes produced five fresh projections and publications; each pass dirtied the next. The installed scheduler postpones this cycle to another frame rather than terminating it. This finding is a self-sustaining reactive loop, not a claim about measured device frame rate.

**Preserving-control fix:** Capture the reorder SharedValue directly in the updater instead of the whole controller, keeping the published frame out of that updater's input closure. Retain the single projected-frame authority used by rendering and focus/hit geometry. Verify the compiled closure and that an idle publication cannot dirty its producer.

## Initial-review coverage and limits

The frontmatter lists the full application/test files read by the rendering reviewer and the collaborating data reviewer. Review followed render/camera/gesture registration, focus/action validation, photos, labels, depth ordering, session recovery, snapshot ownership, preferences, rank persistence, shared contact/interaction writers, merge/purge/import/restore, and the listed schema owners. Finding line references were reopened, and the restore reproduction was independently repeated by the consolidating reviewer.

Graph discovery ran before code relationship searches. For `OrreryScreen.tsx`, governing ADR-048/077 edges were labelled **INFERRED**, not code-extracted assertions; ADR-048's partial supersession was respected. Missing edges for new files were not interpreted as absence of governing decisions. SQL-writer discovery was performed manually because graph extraction cannot see SQL edges. HANDOFF, AGENTS, governing ADR-011/046/047/048/077/085, Orrery system documentation, and Phase 29 context/UI/coverage/dossier material informed the review. The approved canonical view and Gravity expansion were not reopened.

Installed Skia recorder/visitor implementations and Reanimated/Worklets implementations were inspected as dependency evidence. Consecutive depth-batched root groups were traced through the actual Skia ordering implementation and were not reported as a defect.

This report does **not** certify an exhaustive repository audit: some bulk planning-document reads were truncated; unrelated portions of `backup-schema.ts` were only inspected around portable preference validation, and not every historical migration or entry-list test received a complete read. Those targeted/partial inspections are excluded from the full-file count. No structural-fallow substrate was supplied.

At the initial review, the previously reported 275 suites / 2,581 passing tests were not rerun and did not prove native execution. The subsequent fix-recheck results are recorded above. Native gesture arbitration, lifecycle transitions, photo decoding, accessibility/font-scale layout, and physical-device rendering remain pending verification. The historical worklet finding was backed by the actual transform and installed runtime implementation; no device crash or performance measurement is claimed. All fixes retain existing security/product controls.
