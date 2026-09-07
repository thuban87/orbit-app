---
phase: 29-orrery-camera-scale-exploration
plan: "05"
subsystem: ui
tags: [orrery, skia, projection, labels, unicode, tdd]
requires:
  - phase: 29-04
    provides: Growing canonical world, Gravity mass and bounded perspective
provides:
  - Shared interrupted-transition world and projected drawing/hit frame
  - Consecutive native sun/contact root Group depth batch
  - Native-measured semantic labels with hysteresis, priorities and exclusions
affects: [29-06, 29-07, 29-08, 29-09, 29-10, 29-11, 29-12, 40]
tech-stack:
  added: []
  patterns: [native paint-valued body layers, keyed resource retirement, screen-space measured labels]
key-files:
  created:
    - src/logic/orrery-frame.ts
    - src/logic/orrery-frame.test.ts
    - src/logic/orrery-label-logic.ts
    - src/logic/orrery-label-logic.test.ts
    - src/components/orrery/ProjectedOrbitRing.tsx
    - src/components/orrery/OrreryLabel.tsx
    - src/components/orrery/orrery-render.test.tsx
  modified:
    - src/components/orrery/OrbitBody.tsx
    - src/components/orrery/SunBody.tsx
    - src/components/orrery/OrreryWorld.tsx
    - src/logic/orrery-camera-logic.ts
    - src/screens/OrreryScreen.tsx
    - src/db/orrery-impact-read.test.ts
key-decisions:
  - Native body root Groups use shared SkPaint values because JSX Paint layers introduce an intervening skLayer wrapper.
  - Label identity gets first refusal; optional context never removes a fitted name, and fixed below/above anchors allow only eight-unit horizontal nudges.
  - Snapshot generations no longer remount OrreryWorld; keyed media survive retained membership and retire after decorative exits.
requirements-completed: []
requirements-progressed: [ORRC-03, ORRC-06, ORRC-07]
coverage:
  - id: D1
    description: Shared quarter-step/interrupted geometry, inert departures and live entry hit centers
    verification:
      - kind: unit
        ref: src/logic/orrery-frame.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Actual installed Group topology, shared depth reversal and native paragraph preparation contract
    verification:
      - kind: integration
        ref: src/components/orrery/orrery-render.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Semantic hysteresis, priority allocation, measured exclusions and original Unicode identity
    verification:
      - kind: unit
        ref: src/logic/orrery-label-logic.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Native circular media, sun occlusion, glyph shaping, label fit and touch behavior
    verification: []
    human_judgment: true
    rationale: Node execution of the installed Group component verifies topology and props, not Skia native playback, shaping, gestures or TalkBack. Plan 12 owns device evidence.
duration: 18min
completed: 2026-09-07
status: complete
actuals:
  tokens: 15314
  tasks: 2
  commits: 7
---

# Phase 29 Plan 05: Shared Billboard Frame and Semantic Labels Summary

**Sun and contact billboards now share a native depth batch, while interrupted world transitions and prioritized native-measured labels consume the same projected frame.**

## Performance

- Started approximately 2026-09-07T08:46:00Z; completed approximately 2026-09-07T09:04:00Z.
- Two tasks; thirteen source/test files changed.
- Actuals: ceil(61,253 realized task-diff characters / 4) = 15,314; five task/fix commits plus summary and state commits. This is diff scale, not harness-token usage.

## Accomplishments

- World transitions retain source key order, interpolate retained positions/radii/rails and fade membership. Exiting bodies are immediately noninteractive; entering bodies become hittable only when visible. Interrupted transitions start from sampled displayed world state. One projection supplies body centers, ring paths, billboard radii, depth and touch bounds.
- World resource owners survive generation refreshes. A discrete snapshot adjustment adds new owners; one completion callback removes departed owners. No per-frame React sorting/state, image decoding or paragraph measurement. Blur/background still unmount the clock-owning subtree, and the live Reduced Motion signal selects direct world positions while the existing sun/twinkle gates remain intact.
- Rails form an independent layer behind the body layer. Every comparable native child in the body layer is an actual root Group, including the sun; transform and zIndex live on those roots. Roots use shared native SkPaint values to apply alpha to initials as well as images. Source order deterministically breaks equal-depth ties. Labels and backplates remain in their own screen-space layer outside that batch.
- Semantic identity enters at zoom 2 and exits below 1.85; detail enters at 3 and exits below 2.8. Focused, cluster and favorite identities precede isolated fitting names and remaining candidates, with stable identity ties. Inclusive rectangle collisions reject even touching edges/corners. Name allocation precedes optional context allocation, respecting viewport/usable-region, measured obstacles and projected body rectangles.
- Names use native one-line Paragraph ellipsis with original strings, bundled Inter weight 600, OS-scaled 14-unit label typography and measured dimensions. Caption uses Inter 400 and the existing secondary-text role. Text does not scale or rotate with the camera. Label alpha is applied by a supported paint layer, rather than unsupported inherited Paragraph opacity.
- Fixed below/above body anchors plus eight-unit horizontal nudges avoid the inner sun hiding a contact's identity. Existing health and named Gravity are optional deeper context; missing metadata creates no placeholder. Nonmember global sun retains its identity/health/Gravity, while D-11 excludes its relationship context. Future focus/moon owners can pass already-filtered relation text.
- Orrery avatar initials use grapheme segmentation when available. Runtimes without Intl.Segmenter pass the full original name to the native one-line avatar paragraph rather than slicing UTF-16 or manufacturing partial emoji. No shared/global avatar policy was changed.

## Task Commits

1. Task 29-05-01 RED — `8db3298`: transition, hit, depth and culling specifications.
2. Task 29-05-01 GREEN — `fc038cb`: shared world frame, root billboard depth batch and projected rings.
3. Task 29-05-02 RED — `76a8e80`: semantic threshold, priority, exclusion and Unicode contracts.
4. Task 29-05-02 GREEN — `7adf5e8`: native measured labels, font roles, priority wiring and production-tree regression.
5. Prior-wave verification fix — `371eb08`: typed delegating query spy preserves generic executor behavior.

All commits are local on main with hooks enabled. No tracked deletions, dependencies, device actions, schema changes, push or worktrees. Unrelated baseline work was preserved.

## Exported Contracts

- `orrery-frame.ts`: `AnimatedWorldBody extends WorldBody { opacity, interactive }`, `WorldTransition { generation, from, to }`, `AnimatedFrame` with projected `opacity`, `interactive`, `visible` bodies; `bodyKey(body)` uses kind/id; `beginWorldTransition(from,world,generation)`, `sampleWorldTransition(transition,fraction)`, `projectAnimatedFrame(transition,fraction,pose,viewport)` are worklet-compatible.
- `BillboardPose { x,y,scale,depth,opacity }`; `billboardPose(frame,key,nominalRadius)` drives media roots. `OrbitBody`/`SunBody` add optional `projection: SharedValue<BillboardPose>` and `focusColor`; all comparable transforms/zIndex stay on their actual Group roots.
- `ProjectedBody.interactive?: boolean` is backward-compatible. `collectHitCandidates` excludes explicit false, so decorative exits cannot act while older pure consumers retain their behavior.
- `ProjectedOrbitRing({identity, frame: SharedValue<AnimatedFrame>, style: OrreryRingStyle})` draws sampled rails with existing status line treatment.
- `orrery-label-logic.ts`: `SemanticLevel = overview | identity | detail`; `semanticLevel(zoom,previous)`, `rectanglesTouch(a,b)`, `allocateLabels(candidates,level,viewport,bodyExclusions?)`, `labelContext(status,gravity,focusedRelation?)`, `orreryInitials(name)`.
- `LabelCandidate` carries full `name`, stable `id`, native measured size, screen x/y, optional fixed `alternateY`, opacity, focus/cluster/favorite and optional context dimensions. `LabelAllocation` returns full name, fitted rect, opacity and optional contextRect. All text identity remains unchanged outside native ellipsis.
- `prepareOrreryText(text, role: label | caption, fontScale, maxWidth, fontProvider, colors): PreparedOrreryText | null` owns paragraph construction/measurement on the resource path. `PreparedOrreryText` retains original text, paragraph and measured width/height.
- `OrreryLabel({identity,text,allocations,colors,context?})` draws measured screen-facing text/backplate with supported layer alpha.
- `OrreryWorld` retains existing props and adds optional `clusterIds` and `focusedRelationById`. Multiple legacy focusedIds default to cluster priority. Relation text must already be filtered by its owning domain; the world additionally suppresses nonmember sun relation context. Scene paragraphs/Gravity Map never cross into frame worklets; only plain measured data and world arrays do.
- `OrreryScreen` removes only the generation key and expands its existing font provider to Inter Regular/SemiBold and Space Grotesk SemiBold. Later Plans 06/08/10/11 retain their measured HUD, companion, satellite and lifecycle ownership.

## Verification

- RED gates failed for missing frame/label modules before implementation.
- Task 1 `npm test -- src/logic/orrery-frame.test.ts src/services/orrery-scene.test.ts`: **18 tests passed**.
- Final targeted frame/label/render/Gravity/scene suites: **5 files / 39 tests passed**, `/tmp/orbit-29-05-targeted-final.log`.
- Full final `npm test`: **262 files / 2,456 tests passed**, 22.43 seconds, `/tmp/orbit-29-05-tests-final.log`. No test skipped or omitted.
- `npx tsc --noEmit`: passed, `/tmp/orbit-29-05-types-final.log` is empty. Color check, targeted Biome on all thirteen source/test files and `git diff --check`: passed.
- Native-tree regression renders real application bodies against the installed Skia compiled Group implementation; it asserts consecutive skGroup children, native paint-valued layers, sun/contact depth reversal and semantic Paragraph layer alpha at overview/identity. Native paragraph measurement itself is mocked, so Unicode glyph shaping/ellipsis correctness remains device evidence.
- Context7 tools/CLI unavailable. Read installed Skia Common.ts, Group.tsx, paragraph interfaces and RNRecorder.h; checked official [Group](https://shopify.github.io/react-native-skia/docs/group/) and [Paragraph](https://shopify.github.io/react-native-skia/docs/text/paragraph/) documentation. Installed RNRecorder flushes sorting on non-Group commands, and Group's JSX layer path introduces skLayer. The implemented distinction is tested.

## Deviations from Plan

1. **[Rule 2 — Critical integration] Shared transition implementation.** Added `orrery-frame.ts` and the backward-compatible interactive flag in camera logic because the plan named a frame test but omitted the production owner required to make transition drawing and action geometry agree.
2. **[Rule 2 — Critical integration] Screen resource continuity and fonts.** Removed the screen's generation key, which otherwise remounted all media and prevented membership transitions; expanded its existing local font provider so caption and label weights resolve correctly.
3. **[Rule 1 — Bug] Native group/Paragraph treatment.** Direct native SkPaint body layers avoid the extra JSX skLayer wrapper that would invalidate consecutive Group sorting; independent label JSX layers correctly handle Paragraph alpha. The added production-tree test imports installed compiled Group.js and its declarations, avoiding internal source-only JSX typing failures.
4. **[Rule 1 — Bug] Inner-ring label obstruction.** The tree regression exposed the sun covering a normally placed identity label. Added a fixed above-body fallback with the same small horizontal nudge budget; this changes label placement only, not world geometry or membership.
5. **[Rule 3 — Blocking validation, orchestrator-authorized] Prior-wave generic mock typing.** The real typecheck exposed `orrery-impact-read.test.ts:91` assigning vi.fn's Promise<unknown[]> implementation to generic Promise<T[]>. A generic wrapper now delegates to the real executor and records calls in a separate spy; assertions/runtime behavior remain unchanged. Targeted and full suites plus typecheck pass.

## Remaining Cross-Plan and Native Evidence

- ORRC-03/06/07 remain pending at requirement level. COVERAGE assigns E1 completion across Plans 01/05/11; companion wrapping/full accessibility identity belongs to Plan 08, measured shell/control exclusions to Plan 06, focused/satellite relation sources to Plans 08/10, and integrated/native evidence to Plan 12. This plan supplies the renderer and exported seams, not a claim those later UI surfaces already exist.
- Native circular media and real sun occlusion, native grapheme shaping, theme/scaled-text readability, touch behavior and TalkBack remain pending. WINDOWS entry **49** records the obligation. No native performance claim is made.
- Ordinary System switches currently clear the old scene through the existing store; the new continuity applies to retained mounted same-System snapshots/density refreshes. Later lifecycle integration owns final transitions and stale/loading behavior.
- No placeholder/mock source data or skipped tests were introduced. Empty optional context, empty overview labels and absent font resources have explicit omission/loading semantics. No new network, authentication, file-access or schema boundary was introduced.

## Self-Check: PASSED

All seven created source/test files exist, all five task/fix commits exist, no implementation edits remain unstaged, and final automated checks pass. Summary is written on disk before progress advances.
