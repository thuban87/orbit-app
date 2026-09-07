---
phase: 29-orrery-camera-scale-exploration
plan: "01"
subsystem: ui
tags: [orrery, sqlite, skia, reanimated, camera, tdd]
requires:
  - phase: 23-theme-visual-system
    provides: Theme primitives and live reduced-motion signal
  - phase: 24.2-contact-knowledge
    provides: Current local contact lifecycle and schema
provides:
  - Read-only snapshot composition for all five scene readers
  - Canonical timestamp world and current projected draw/hit frame
  - Reachable pan and generation-validated focus/Profile tracer
affects: [29-02, 29-03, 29-04, 29-05, 29-07, 29-08, 29-09, 29-11, 29-12]
tech-stack:
  added: []
  patterns: [read-only snapshot, UI-thread projected frame, discrete intent bridge, generation-guarded publication]
key-files:
  created:
    - src/services/orrery-scene.ts
    - src/services/orrery-scene.test.ts
    - src/logic/orrery-camera-logic.ts
    - src/components/orrery/OrreryWorld.tsx
  modified:
    - src/db/app-settings-dao.ts
    - src/db/contact-read.ts
    - src/db/contact-status-read.ts
    - src/db/profile-dao.ts
    - src/db/orrery-read.ts
    - src/screens/OrreryScreen.tsx
    - src/components/orrery/OrbitBody.tsx
    - src/logic/orrery-geometry-logic.ts
    - src/logic/orrery-geometry-logic.test.ts
key-decisions:
  - Camera and current projected frame stay on the UI thread; only discrete IDs/intents cross to JS.
  - Scene readers compose through the snapshot callback ro; existing SQL and full writer contracts remain intact.
  - Ordinary drag owns only transient camera movement; prolonged-hold rank reordering returns in Plan 29-09.
requirements-completed: [ORRC-01]
requirements-progressed: [ORRC-02, ORRC-07]
coverage:
  - id: D1
    description: Coherent SQLite scene, registered pan callbacks, current-frame hits and guarded navigation intents
    verification:
      - kind: integration
        ref: src/services/orrery-scene.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Canonical placement and removal of relationship-mode contracts
    requirement: ORRC-01
    verification:
      - kind: unit
        ref: src/logic/orrery-geometry-logic.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Native moved-body tap, visible identity focus, and Profile navigation
    verification: []
    human_judgment: true
    rationale: Node adapters do not prove native Skia rendering, gesture recognition or route reachability; scheduled for end-of-phase.
duration: 17min
completed: 2026-09-07
status: complete
actuals:
  tokens: 20899
  tasks: 3
  commits: 7
---

# Phase 29 Plan 01: Canonical World Tracer Summary

**Real local contacts now render and hit-test through one UI-thread camera frame, with ordinary pan and generation-validated focus/Profile intents.**

## Performance

- Started: 2026-09-07T07:33:00Z
- Completed: 2026-09-07T07:50:00Z
- Tasks: 3; implementation/test files: 13.
- Actual tokens are ceil(83,595 realized source-diff characters / 4), not harness usage. Commit count includes five task commits and two closeout commits.

## Accomplishments

- All five named readers accept `ReadOnlyExecutor`; only imports/parameter types changed. Every loader read receives the callback's `ro`, without casts or nested transactions.
- `OrreryScreen` consumes the actual local loader and keyed `OrreryWorld`. A measured/focus/foreground gate mounts the clock-owning canvas. Camera motion never updates React state per frame.
- Pan is the only ordinary drag recognizer. The old radial gesture, rank write import/bridge, shared drag mirrors and ghost preview were removed. Existing rank DAO guards and reorder logic remain available to Plan 09.
- Successful isolated overview taps focus to zoom 2 with a horizontal name label; identity-scale taps dispatch Profile. Failed taps, removed IDs, stale generations, cancelled reads and late validation results cannot navigate. Multiple hits produce a group intent with all candidate identities.
- Initial load and retained-data refresh errors are distinct and expose Reload System. No read failure becomes a fabricated empty scene.
- Removed all body angle/color morph props/worklets and mode-only geometry exports. Canonical progress, rogue cold outline/fill, neutral sun and local photo/initials fallback remain.

## Task Commits

1. 29-01-00 — `5109a25` refactor: five snapshot reader signatures.
2. 29-01-01 RED — `4bbb549` test: real SQLite camera interaction tracer (expected missing module failure).
3. 29-01-01 GREEN — `c9a31cc` feat: loader, controller, projection, keyed world and reachable screen.
4. 29-01-02 RED — `7cd0762` test: canonical contract rejects mode-only exports (1 expected failure).
5. 29-01-02 GREEN — `3f3310a` refactor: body and geometry mode contract retirement.

No tracked files were deleted. All commits are local on the existing main branch; unrelated working-tree changes were preserved.

## Exported Contracts

`src/services/orrery-scene.ts`:

- `loadOrreryScene(exec: SqlExecutor, generation = 0): Promise<OrrerySceneSnapshot>`.
- `OrrerySceneSnapshot`: generation, dataRevision, contacted `contacts`, canonical `world`, finite world `extent`, and raw sun settings/self/header/status projection.
- `createOrrerySceneController(load, publish)`: `reload(): Promise<void>`, `cancel(): void`, `current(): OrrerySceneSnapshot | null`. Publication uses `OrreryLoadState { status: loading | ready | error; snapshot }`; old retained data is nonactionable while refresh is pending/failed.
- `createOrreryIntentDispatcher({ current, validate, focus, group, clear, openProfile })`: async discrete-intent dispatcher with fresh-read and before/after-await generation checks.

`src/logic/orrery-camera-logic.ts`:

- `WorldPoint { x, y }`; `CameraPose { x, y, zoom }`; `CameraViewport { width, height }`.
- `WorldBody`: numeric id, contact/sun kind, point, radius and ringRadius. Self uses reserved id 0 and has no Profile action.
- `ProjectedFrame`: generation, current pose/viewport, projected bodies with hitRadius, projected world center.
- `projectWorldPoint(point, pose, viewport): WorldPoint` and `unprojectToWorldPlane(point, pose, viewport): WorldPoint`.
- `projectFrame(world, pose, viewport, generation): ProjectedFrame`; `collectHitCandidates(frame, x, y): number[]`.
- `tapIntent(frame, x, y, success): OrreryIntent`; intent kinds none/clear/focus/profile/group.
- `constrainCamera(pose, extent)` and `panCamera(start, dx, dy, extent)` keep transient pose finite/bounded.

`src/components/orrery/OrreryWorld.tsx`:

- `OrreryWorld({ scene, pose, viewport, colors, fontProvider, onIntent, focusedIds })` owns the derived frame and keyed resource adapters.
- `createOrreryGestures({ pose, frame, panStart, extent, send, stop })` registers the exact tap/pan callbacks exercised by the tracer's native adapter mocks.

## Verification

- `npx tsc --noEmit` — passed after reader changes, tracer implementation, mandatory tracer gate repeat and final body contract removal.
- `npm test -- src/db/app-settings-dao.test.ts src/db/contact-read.test.ts src/db/contact-status-read.test.ts src/db/profile-dao.test.ts src/db/orrery-read.test.ts` — 119 tests passed.
- `npm test -- src/services/orrery-scene.test.ts` — 8 tests passed; tracer gate passed before task 02 expansion.
- `npm test -- orrery-geometry orrery-ring sun-occupant orrery-scene` — 67 tests passed.
- Final combined run of the above nine files — **186 tests passed, 9 files**.
- `npm run check:colors` — passed.
- Targeted `npx biome check` on scene/service test, camera, screen, world, body and geometry/test — 8 files clean, no warnings.
- Production source scan confirms no `MORPH_MS`, `evenSpreadAngle`, `mutedFill`, body morph prop, legacy gesture commit bridge or screen rank-write import remains.
- Existing Vite native-config advisory and Node experimental SQLite notice appeared; neither is a new failure.

## Decisions Made

Followed ADR-077's approved transition. The tracer camera is deliberately top-down pan/identity zoom; later plans extend this same contract with tilt/yaw, readable Home, Systems, depth/semantic labels, full cluster panel, accessible companion and session restoration.

## Deviations from Plan

- Requirement bookkeeping is conservative: ORRC-01 is implemented here; ORRC-02 and ORRC-07 remain in progress because their full tilt/yaw/pinch and cluster-panel acceptance belongs to later plans. No phase-wide completion is claimed by this tracer.
- No runtime/domain scope deviations. A compile-time integration adjustment uses a `CameraPose` type alias compatible with installed Reanimated animatable objects and an injected worklet stop callback for the native gesture test adapter.

## Known Stubs and Later-Plan Boundaries

No empty/mock source feeds the production world and no placeholder/TODO implementation was introduced. The default DAO remains contacted-only as required; explicit All/Not widening belongs to Plan 03. Group intent currently highlights/centers its candidate set; the complete floating group panel belongs to Plan 08. Legacy viewport helpers remain for reuse/testing until Plan 04 replaces their geometry role. Deliberate rank editing is intentionally disconnected during this unreleased sequence and must return in Plan 09 before phase completion.

## Native Verification Pending

Native tracer pan-to-moved-body focus-to-Profile, Skia rendering and gesture arbitration remain pending the approved end-of-phase device session. Recorded as WINDOWS entry **45**. No device was accessed. Confirm package/Metro session before the future device run; Node adapters do not establish visual or native navigation success. Full phase native/TalkBack/performance checks stay with Plan 12.

## Threat Surface

No new network, schema, file-access or auth boundary. Planned snapshot consistency, successful live target validation and finite/measured projection checks are implemented. Later narrow ID/UID action probes remain Plan 08's contract.

## Self-Check: PASSED

All four created files exist; all five task commits exist in local git history. Required automated checks passed. Source inspection confirms the screen→loader→world→frame and gesture→intent→Profile chains. Native evidence is explicitly pending rather than counted as a pass.

## Next Plan Readiness

Plan 29-02 can add durable Orrery preferences against the unchanged migration head. Subsequent executors can consume the concrete contracts above; no later plan was executed here.
