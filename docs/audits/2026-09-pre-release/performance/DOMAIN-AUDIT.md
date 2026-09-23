# Performance and Resource Management Audit

## Audit Metadata

- **Date:** 2026-09-22 (America/Chicago).
- **Repository:** `orbit-app`.
- **Audited HEAD:** `0e04c27e1d82bc3b5069bbf5adfc72281155df69` — `docs(kb): record phase 38.1 extraction`.
- **Working tree at start:** untracked `docs/audits/2026-09-pre-release/`, containing other domain packets; no tracked modifications reported. Those packets were left untouched.
- **Domain code:** `PERF`.
- **Mode:** deep domain audit using the global `repo-audit` skill.
- **Output:** `docs/audits/2026-09-pre-release/performance/DOMAIN-AUDIT.md`.
- **Mutation boundary:** this report only. No application, test, migration, dependency, configuration, generated-graph, or other documentation changes; no commits, pushes, worktrees, or device operations.

## Executive Summary

Four findings merit remediation consideration: obsolete Orrery geometry/resources survive settlement; Dashboard refresh ownership causes redundant and background reads; rejected photo responses lack transfer cleanup; and bounded Your Week queries scan lifetime history. Three are S2 Moderate and one is S3 Minor. No S0/S1 finding was established.

The strongest visualization evidence is a deterministic reproduction: after 20 completed switches between distinct one-contact Systems, the production sampler and projector still process 20 bodies and 2,560 ring vertices, although only one body is visible. A separate missing cleanup branch retains old scene snapshots and image-owning components after same-System membership changes.

The app already has substantial performance safeguards: UI-thread camera/animation work, a single unmountable ambient clock, virtualized Dashboard renderers, batched knowledge reads, debounced scoped search, bounded photo derivatives, coalesced foreground sweeps, and request cleanup in AI generation. No general memoization, caching, virtualization, or architecture rewrite is recommended.

This audit establishes excess work and resource-lifecycle defects. It does **not** establish physical-device frame rates, battery drain, peak native memory, or production startup latency. Explicit Phase 40 performance deferrals and accepted coherent-snapshot/security tradeoffs remain in force.

## Scope

Included startup/readiness and foreground work; React refresh dependencies and subscriptions; derived data; Dashboard lists/search; Profile/history and Digest computation; SQL access paths and growth with interactions; Orrery scenes, transitions, projection, gestures, labels, images and lifecycle; photo acquisition/derivatives; backup/export serialization; import processing; AI cancellation; widget and notification refresh coordination.

Excluded implementation, product redesign, exhaustive security/data-integrity review, network-provider performance, production-device profiling, and generated/vendor code as an authored-code audit target. Installed framework source was inspected where necessary to establish actual fetch and focus-effect behavior. Historical decision records were used to interpret intent, not as evidence of current implementation.

## Repository Context Reviewed

- `HANDOFF.md`: local-first/offline reads, tens-of-contacts intent, no React state per animation frame, and focus/background animation shutdown. Small contact count does not bound accumulated interaction history.
- React 19.2.3, React Native 0.86.2, Expo 57, Skia 2.6.2, Reanimated 4.5.1, Zustand 5, SQLite schema through migration 030.
- `App.tsx`, `src/db/database.ts`, migration runner, transaction/mutex primitives, launch-sweep registry, notification scheduling, widget refresh, and shell refresh store.
- Current subsystem documentation for Orrery, app shell, photos, persistence, and backup/restore; track-specific Dashboard/history/Digest context.
- ADR-077 supersedes ADR-048's dual-view/morph behavior while retaining the single lifecycle-owned ambient renderer. The historical HANDOFF description is not treated as a reason to reinstate continuous contact motion or a second visualization.
- ADR-094 accepts eligible-set TypeScript search and rejects FTS5/new search indexes. ADR-148 requires canonical, group-deduplicated Your Week aggregation and rejects persisted Digest snapshots/cache.
- `docs/systems/orrery.md:115–142` explicitly leaves native contention, high-count/GPU performance and camera/density calibration to Phase 40. Snapshot ordering is already proven; that is not latency evidence.
- `src/db/transaction.ts` explicitly documents coherent export holding the shared mutex, including photo reads. `src/services/backup/encryption.ts:9–20` records the owner-approved Pixel release KDF benchmark; reducing security parameters is not an audit recommendation.

## Methodology and Coverage

Four investigative tracks covered startup/shared infrastructure, Orrery rendering, screen/query behavior, and resource ownership. Investigators read current files and related subsystem code rather than restricting review to a diff. The final findings were checked against the actual files, relevant installed dependency behavior, repository state, and counterevidence. No writer-owned data invariant is inferred from a reader or graph edge; the SQL finding concerns executed query access paths in the actual migrated schema.

Graphify was queried through `npm run graph:ask -- governs <file>`, including Home, Orrery renderer/runtime, photo pipeline, backup, AI, and launch sweep. Returned Key-files associations were **INFERRED**, not assertions made by code. Supersession notices were followed to current ADRs. Missing runtime/sweep edges were not interpreted as absence of governing decisions. No graph was rebuilt.

Verification performed:

- Production Orrery pure functions executed through `node --import tsx` on stdin; repeated settled switches reproduced retained-body growth. The final adjudicator independently reproduced the counts.
- Every migration registered in `src/db/database.ts` was applied to an ephemeral Node SQLite database through the real migration runner. Actual Your Week DAO SQL was inspected with `EXPLAIN QUERY PLAN` and measured against fixed-contact, growing-history fixtures. The adjudicator reproduced both access plans and scaling.
- Five targeted suites passed: launch sweep, notification schedule, digest schedule, URL-image acquisition, and Your Week reads: **68 tests**. Invocation: `npm test -- --no-cache src/services/launch-sweep.test.ts src/services/notifications/notification-schedule.test.ts src/services/notifications/digest-schedule.test.ts src/services/photos/url-image.test.ts src/db/your-week-read.test.ts`.
- Four Orrery suites passed: switch runtime, switch choreography, frame, and worklet boundary: **26 tests**. Invocation: `npm test -- --no-cache src/components/orrery/orrery-switch-runtime.test.ts src/logic/orrery-switch-choreography.test.ts src/logic/orrery-frame.test.ts src/components/orrery/orrery-worklet-boundary.test.ts`.
- These tests check substantial functional behavior, but passing them does not disprove the missing resource/cardinality/cancellation checks described below. They are Node tests, not native rendering tests.

Coverage is strongest for Orrery ownership, Dashboard refresh dispatch, Your Week SQL, and photo response cleanup. Profile/history, import and backup were traced for cost and lifecycle, without exhaustive measurements or a claim that every screen/editor was reviewed.

## Findings Summary

**Primary findings:** 4 OPEN, 0 INVESTIGATE. **Severity:** S0 0; S1 0; S2 3; S3 1; S4 0. **Confidence:** C3 3; C2 1. Accepted/deferred/rejected observations are recorded separately and excluded from these counts.

| ID | Finding | Severity | Confidence | Scope | Disposition |
|---|---|---|---|---|---|
| AUD-PERF-001 | Orrery retains obsolete geometry and scene resources after settlement | S2 | C3 | Multi-area | OPEN |
| AUD-PERF-002 | Dashboard schedules redundant and background refresh bundles | S2 | C3 | Multi-area | OPEN |
| AUD-PERF-003 | Rejected photo responses continue consuming transfer resources | S2 | C2 | Local | OPEN |
| AUD-PERF-004 | Your Week scans lifetime history for bounded period reads | S3 | C3 | Multi-area | OPEN |

## Findings

### AUD-PERF-001 — Orrery retains obsolete geometry and scene resources after settlement

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PERF, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Transition-only state is not consistently retired. Completed System switches retain departed geometry in subsequent projection inputs. Same-System refreshes have the complementary problem: they reset geometry but retain removed React resources and their old scene snapshots.

#### Expected Behavior / Invariant

Departing bodies may remain while necessary for interruption-safe transition animation. After settlement, retained world/media/scene resources should correspond to the current scene. The constrained canonical Orrery of ADR-077 should not accumulate work according to previously visited membership.

#### Observed Behavior

The completion callback prunes React resources but leaves the full choreography entry set intact. Sampling at progress 1 produces transparent departed bodies; later switches reuse them as source entries. Camera updates continue projecting them before visibility filtering.

For a same-System refresh, publication merges old resources with new resources, keeping absent old keys. The immediate settled branch never calls the pruning callback. Removed contacts therefore keep resource references even though their geometry is no longer present.

#### Evidence

- `src/components/orrery/use-orrery-switch-runtime.ts:170–180`: `mergeResources` retains old entries absent from the new scene. Each resource holds the entire `scene` (`:36–40`, `:166–167`).
- `use-orrery-switch-runtime.ts:215–233`: `prune` filters React resources; `finish` invokes it but does not compact `transition.value`.
- `use-orrery-switch-runtime.ts:262–281`: all publications merge resources; the non-switch branch settles and returns without pruning.
- `use-orrery-switch-runtime.ts:283–296`: a subsequent switch samples the old transition and uses its whole world as the next source.
- `src/logic/orrery-switch-choreography.ts:359–366,425–436`: the source/destination key union preserves departed keys; completion still returns source-only bodies with opacity zero.
- `src/screens/OrreryScreen.tsx:303–337`: same-System reloads are classified as non-switch publications.
- `src/components/orrery/OrreryWorld.tsx:236–273,529–560`: the sampled world reaches projection; the resource list separately mounts rings and bodies. `src/components/orrery/OrbitBody.tsx:80` owns the image hook even when its projection is transparent.
- `src/logic/orrery-camera-logic.ts:490–536`: `projectFrame` produces 128 ring vertices for each positive-radius ring before `src/logic/orrery-frame.ts` applies visibility. Opacity zero does not avoid that work.
- `src/services/orrery-scene.ts` returns `systemSnapshot`; `src/db/orrery-system-read.ts:302–305` includes complete batched `impactInputs`. Retaining an old resource can retain the old history-bearing snapshot, not merely a small body descriptor.

Reproduction used unchanged `beginSwitchChoreography`, `sampleSwitchChoreography` and `projectFrame`. Start with an empty source, successively switch to one contact with a new ID, sample each transition at 1, then use that sample as the next source, matching the runtime's completed-switch behavior. After 20 destinations:

```text
destinationBodies: 1
transitionEntries: 20
sampledBodies: 20
opaqueBodies: 1
projectedRingVertices: 2560
```

A settled destination needs one contact ring, or 128 vertices in this fixture. The shared sun was omitted to isolate the contact counts; adding it does not remove the retained departures.

#### Impact

Projection work grows with the union of visited System bodies rather than current membership. Same-System removals can retain different old scene generations, their interaction arrays, and image-owning components. Transparent rendering conceals this excess work from visual correctness checks. Native frame degradation and retained byte counts were not measured.

#### Trigger / Preconditions

Repeated switches between Systems with differing members, or removal of members followed by same-System refresh. Blur unmounts the canvas, but the screen-owned resource collection can survive blur. A subsequent non-switch publication resets choreography; a completed animated switch prunes React resources. These are partial relief paths, not correct retirement on every settlement.

#### Remediation Direction

Retire obsolete geometry and resource references at every settled publication while retaining only the temporary state needed for an active or paused transition. Preserve rapid interruption continuity, keyed media, hit authority and pause/resume semantics.

#### Verification

Assert settled entry/resource cardinality after A→B→C completed switches, repeated same-System removals, interrupted switches followed by refresh, and reduced-motion completion. Check that removed resource entries no longer retain old scenes. Retain existing switch/gesture tests. Use a physical phone to quantify native memory and camera-frame consequences.

#### Related Findings

None required. This is distinct from accepted snapshot contention and general large-System calibration.

#### Planning Notes

Two owners need coordinated lifecycle treatment: the UI-thread choreography and the React resource collection. No schema change or relaxation of scene coherence is implied. Do not discard departure state during a live transition merely to reduce counts.

### AUD-PERF-002 — Dashboard schedules redundant and background refresh bundles

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PERF  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Animation-state dependencies inadvertently schedule data reloads, and bulk actions independently request both direct and shell-published refreshes. The cancellation guard discards results only after the reads and derived work complete.

#### Expected Behavior / Invariant

Focus, foreground return, query changes, pull-to-refresh and committed writes must keep Dashboard data fresh. One event should not schedule duplicate full read bundles, and animation-only state changes should not initiate hidden-screen data work.

#### Observed Behavior

`appActive` changes the identity of `reload`, which is a dependency of the focus effect. When Home remains navigation-focused during backgrounding, that effect reruns the full read bundle. Foreground return invokes the explicit AppState reload as well as the callback-dependency reload. The foreground listener also runs while Home is mounted under another route/tab.

Bulk commit handlers call `bumpShellRefresh()` and `reload()`. Home subscribes to that same shell revision and consequently reloads again.

#### Evidence

- `src/screens/HomeScreen.tsx:625–630`: AppState updates `appActive`; `:815–822` includes it, focus and reduced-motion state in `reload` dependencies to select the result animation state.
- `HomeScreen.tsx:830–835`: the focus effect calls `reload` and depends on its identity. Installed `node_modules/@react-navigation/core/src/useFocusEffect.tsx:75–80,112` explicitly runs on dependency changes while `navigation.isFocused()` remains true; app backgrounding is not its gate.
- `HomeScreen.tsx:839–852`: the independent AppState listener calls `reload` on every `active` event, without a route-focus check.
- `HomeScreen.tsx:917–935`: `commitBulkOutcome` publishes the shell revision (`:922`) and directly reloads (`:933`). `performBulkQuickLog` repeats the combination at `:946,967`.
- `HomeScreen.tsx:827` and `src/stores/shell-refresh-store.ts:16–25`: Home consumes its own revision publication and invokes the reload callback.
- `HomeScreen.tsx:719–779`: a non-search List reload requests the population and eight counts, then line-3 candidate work. `src/db/dashboard-knowledge-read.ts`, `readLine3Candidates`, composes three batched source queries for a nonempty ID set. The common nonempty List path therefore executes at least 12 SELECTs per bundle, or at least 24 for two bundles, before any extra filter-specific reads.
- `HomeScreen.tsx:781`: the cancellation check occurs after those operations. Cleanup prevents stale publication, not duplicate I/O or scoring.

#### Impact

Ordinary lifecycle changes and bulk actions perform duplicate SQLite reads and JS projection/selection work. Cost increases with eligible contacts and associated knowledge, including search scoring when a term is active. Work may begin while the app is backgrounding or Home is hidden. No device latency or battery percentage is claimed.

#### Trigger / Preconditions

Home is mounted; either a background/foreground transition occurs or a bulk action completes. The callback-dependency path requires Home to remain navigation-focused; the explicit active-event listener does not.

#### Remediation Direction

Give necessary refresh events unambiguous ownership and preserve one current-data refresh for each relevant event. Separate result-animation state from the dependencies that initiate reads. Preserve foreground freshness after headless writes and all explicit query/pull refresh behavior.

#### Verification

Count DAO calls for one bulk commit, bulk Undo, background/foreground cycle, tab switch and animation-preference change. Verify no background-entry read bundle and no duplicate bundle for one commit. Verify returning after a headless interaction still shows fresh data. Test stale-result suppression independently from scheduling/coalescing.

#### Related Findings

None; the Dashboard and Your Week SQL findings have different ownership and triggers.

#### Planning Notes

Keep selection-session fences and the shell revision's other consumers intact. This finding does not request a new cache or connection-wide SQLite subscription.

### AUD-PERF-003 — Rejected photo responses continue consuming transfer resources

**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Local  
**Type:** PERF, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

URL-image validation can reject a response before taking ownership of its stream, without aborting the request or canceling the body. The installed Android Expo fetch implementation continues pumping and buffering such an unread response.

#### Expected Behavior / Invariant

A terminal acquisition rejection must release its transfer resources. The image-download path's advertised memory bound must not be bypassed by rejecting headers before bounded consumption begins.

#### Observed Behavior

Final-URL, HTTP-status and MIME rejection all throw before reader acquisition. Cache-directory preparation failure behaves similarly. There is no request AbortController or enclosing failure cleanup. The UI reports an error and permits retry while the native response can remain active.

#### Evidence

- `src/services/photos/url-image.ts:66` sets an 8 MiB cap. `:292` invokes `fetch(url)` without a signal.
- `url-image.ts:304–329` rejects final URL, status or MIME; `:340–344` rejects cache preparation failure. None cancels the response. Reader acquisition starts only at `:352`; the byte cap is enforced later in `readCappedStream`.
- `src/components/PhotoSourcePicker.tsx:225–267` awaits the helper, displays failure, and clears `submittingUrl`; no transfer-cancellation handle is owned by the caller.
- `node_modules/expo/src/winter/runtime.native.ts:41–53` installs Expo fetch by default. No repository `EXPO_PUBLIC_USE_RN_FETCH` override was found. The analysis therefore does not assume the legacy React Native fetch implementation.
- `node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:140–160` starts pumping the response body after headers arrive and closes it after pumping. At `:194–215`, state `RESPONSE_RECEIVED` appends body bytes to the sink until consumption/state changes or completion.
- `node_modules/expo/android/src/main/java/expo/modules/fetch/ResponseSink.kt:8–16` stores byte arrays in an unbounded list. Throwing from application validation does not transition the native response into a canceled state.
- Existing `src/services/photos/url-image.test.ts` tests rejection and the consumed-stream size limit with fake responses; it does not model continuing native delivery after early rejection or assert cleanup on those branches.

#### Impact

A large non-image response or large HTTP error body can keep consuming bandwidth and native memory after the operation has reported failure, bypassing the application byte cap. Repeated retries can overlap. Memory pressure is credible; process termination and exact retained bytes were not demonstrated on hardware, hence C2 for the end-to-end consequence.

#### Trigger / Preconditions

User explicitly submits an HTTPS photo URL whose response is rejected before stream consumption, especially a large or slow body. This is a user-invoked acquisition path, not a background network read of contact data.

#### Remediation Direction

Ensure each early terminal failure stops the acquisition's owned transfer and releases its body resources. Preserve final-URL, HTTPS and raster-MIME checks and the byte limit. Also establish ownership when the initiating UI leaves before acquisition finishes.

#### Verification

Add failure-orchestration checks that observe cancellation for invalid final URL, non-2xx, invalid MIME and cache-preparation failure. On physical Android, use a controlled throttled large response and verify that rejection promptly stops transfer and memory growth; repeat after navigation away. A rejection alert alone is insufficient evidence.

#### Related Findings

None within this domain packet. Other campaign domains may independently discuss URL policy; synthesis should distinguish transfer cleanup from policy correctness.

#### Planning Notes

No relaxation of security controls or increased download allowance is implied. Framework source establishes why cleanup matters, but native behavior must be retested with the shipped dependency version.

### AUD-PERF-004 — Your Week scans lifetime history for bounded period reads

**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** PERF  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

The week and selected-day queries repeatedly scan lifetime interactions and Group Events, including when the requested period contains no activity. Current predicates and indexes do not provide a bounded-period access path.

#### Expected Behavior / Invariant

A bounded weekly/day reader should be able to exclude unrelated historical rows without repeatedly scanning the full retained history. Results must remain derived from canonical data with the local-date and group-deduplication semantics required by ADR-148.

#### Observed Behavior

All three readers filter through `date(occurred_at)`. The interaction recency index begins with `contact_id`, while these are app-wide period reads; Group Events has only its UID index. Actual query plans scan lifetime history for each request.

#### Evidence

- `src/db/your-week-read.ts`, full `readYourWeekMetrics`, `readYourWeekDateCounts` and `readYourWeekDay` implementations: date-wrapped week/day predicates over `interactions` and `group_events`.
- `src/components/digest/YourWeekSection.tsx`, `loadPeriod`, focus callback, `onPeriodChange` and `onSelectDay`: metrics/counts reload on focus and period changes, with a separate day query on selection.
- Actual schema produced by registered migrations 001–030: `idx_interactions_recency(contact_id, occurred_at DESC)`, interaction UID and partial group-member uniqueness; Group Events UID uniqueness. The relevant declarations are in migrations 001/009/011 and 026; no subsequent migration supplies a period access path.
- `EXPLAIN QUERY PLAN` on the SQL issued by the real readers: metrics scans `idx_interactions_recency` twice and scans `group_events`; date counts and day detail scan `interactions` and `group_events`. Grouping/ordering also uses temporary B-trees.

An ephemeral Node SQLite experiment held **50 contacts** and the requested empty September 2026 period constant. All interactions were standalone rows dated `2020-01-01 12:00:00`. Each reader ran once for warmup and ten times for measurement; the sorted sample at index 5 is reported below. Databases were memory-only, foreign keys enabled, and all registered migrations applied. No app data was used.

| Historical interaction rows | Metrics (ms) | Date counts (ms) | Day detail (ms) |
|---:|---:|---:|---:|
| 1,000 | 0.362 | 0.222 | 0.224 |
| 10,000 | 2.818 | 1.700 | 1.926 |
| 100,000 | 32.364 | 22.656 | 22.760 |

Every result remained zero/empty. This demonstrates irrelevant-history scaling, **not Android latency**. The 100,000-row case is a diagnostic stress fixture, not an assertion about normal contact usage. Group-event scanning was established by plans; its growth was not separately benchmarked.

#### Impact

Opening the default Digest tab, changing its period or inspecting a day becomes more expensive as lifetime history grows, even if the visible week remains empty. Severity is S3 because excess scanning is proven but noticeable latency at the recorded normal scale is not; no release-blocking performance claim is made.

#### Trigger / Preconditions

Accumulated interaction/event history and a Your Week read. A large address book is unnecessary: the fixture keeps contact count fixed.

#### Remediation Direction

Provide an access path that excludes unrelated historical rows for bounded-period reads, preserving canonical aggregation, local date boundaries, archived-contact behavior and parent/child counting rules. Do not introduce the persisted Digest cache rejected by ADR-148.

#### Verification

Repeat fixed-result, growing-history fixtures and inspect query plans for actual bounded access. Preserve existing archived-participant, standalone-interaction and group-parent correctness tests. Measure the default Digest path on physical Android before claiming user-visible latency improvement.

#### Related Findings

None required; this reader is independent of the Dashboard refresh duplication.

#### Planning Notes

Any schema/index addition must be a new forward-only migration; never edit shipped migrations. A change from date-wrapped predicates must preserve actual supported timestamp semantics rather than assume equivalence without boundary tests.

## Cross-Finding Patterns

- **Publication correctness and resource completion are separate.** Transparent departed bodies, canceled result publication and a rejected photo promise can all look correct to the user while retaining work/resources. Verification should inspect ownership and work counts as well as displayed output.
- **Growth has more than one dimension.** Current contact count is small by intent, but visited System membership and lifetime interactions can accumulate independently. The findings isolate those dimensions rather than assuming thousands of visible contacts.
- **Existing functional tests miss cost invariants.** The relevant suites pass. The absent checks concern settled cardinality, one-refresh-per-event scheduling, rejected-transfer cleanup and bounded query access.

## Reviewed Areas With No Material Findings

- **Startup/readiness:** migrations run before read screens mount; already-current schemas do not rerun data migrations. Concurrent open calls share an opening promise. Theme and fonts load in parallel after migration; background reconciliation before first main paint has an explicit restore-recovery purpose. No network was found on this reviewed startup read path.
- **Foreground maintenance:** launch sweeps and notification/digest reconciliation use defer-one coordination. Notification schedules diff desired requests rather than blindly rescheduling every contact, and scheduled volume has a horizon/cap. Widgets are event-pushed, not polled; image rendering is capped to the selected tile capacity. Backup scheduling checks both revision and interval.
- **Orrery animation method:** one `useClock` owner under the focus/foreground-gated Canvas; camera/gesture updates use worklets and SharedValues. Ambient motion does not drive per-frame React state. Camera stop/unmount handling, preview gating and AppState subscription cleanup were traced. Label paragraph preparation lives on the React resource path, not the projection frame path. Satellite derivation exits in overview; impact inputs are batched in ID chunks rather than queried per body.
- **Lists and search:** Dashboard List and CardGrid already use FlatList. Non-search line-3 knowledge retrieval is batched and capped per contact before selection. Search is debounced and constrained to eligible IDs. No evidence justifies replacing these renderers or adding blanket memoization.
- **Profile/history:** shared impact inputs intentionally feed gravity/cadence. ActivityHeatmap uses static bounded cells. Rolodex wheels have bounded month/day/year item sets, use SharedValues, and commit React state on gestures/steps rather than every animation frame. Browser lifecycle removes listeners and gates the interactive wheel subtree.
- **Images:** photo masters are normalized to 512×512 JPEG; widget thumbnails are 88px. Avatar subscribes to its own photo revision and renders local files. Crop transforms use SharedValues; decode-fallback timers are cleared. The background pipeline releases its prepared resource in `finally`, and its per-path queue removes settled entries. Galaxy app backgrounds are static assets; no app-wide particle loop was found.
- **AI/request lifecycle:** generation owns an AbortController, timeout and stale-generation checks; sibling failures cancel work. Compose focus cleanup disposes the controller. Custom fetch removes abort listeners in `finally`; OAuth cleans up listeners and its loopback attempt. Copy/snackbar timers have cleanup/replacement handling.
- **Import and backup:** import processing is sequential per row and yields after chunks of ten; photo failure is isolated after durable import. Full manifest validation, embedded-photo reads and backup read-back verification have explicit durability purposes. Their presence alone is not an unnecessary-serialization finding.

## Accepted / Deferred / Rejected Candidates

| Candidate | Disposition | Reason |
|---|---|---|
| Coherent export/scene reads queue behind the shared mutex, with full photo/history work | ACCEPTED / DEFERRED | `src/db/transaction.ts` documents the correctness tradeoff; `docs/systems/orrery.md:115–142` assigns measured contention optimization to Phase 40. No control bypass, extra connection or timeout is authorized by that handoff. |
| General high-count projection/label cost and camera density | DEFERRED | Phase 40 explicitly owns high-count/GPU/camera calibration. Repeated viewport calculations per ring vertex and quadratic lookups are profiling targets, not an additional established defect. AUD-PERF-001 instead proves needless retained inputs. |
| Scoped TypeScript search grows with eligible knowledge | ACCEPTED | ADR-094 explicitly accepts this cost and rejects FTS5/new search indexes. This audit does not reverse that decision. |
| Synchronous backup KDF | ACCEPTED | Owner-approved parameters and a recorded physical Pixel release median of 53 ms at 600,000 iterations exist in `encryption.ts`. That historical benchmark was read, not rerun; no blanket crypto rewrite or weakening is warranted. |
| Global fetch buffers every valid photo, then necessarily downloads it a second time | FALSE-POSITIVE | Installed Expo 57 replaces global fetch with its streaming implementation by default. The legacy non-stream fallback cannot be assumed to describe the shipped path. The early-rejection cleanup problem in AUD-PERF-003 remains independently supported. |
| Full history reads are inherently wrong | FALSE-POSITIVE | Lifetime history is a deliberate input to gravity/cadence and coherent scenes. Truncation would change semantics. The bounded Your Week reader has a distinct access-path issue. |
| Missing explicit release in an older image adapter proves a permanent native leak | FALSE-POSITIVE | Shared-object reclamation must be considered. Missing a manual release call alone does not establish a leak. |

## Coverage Limitations / Follow-up Investigation

- No device was driven. The repository requires confirming app package and Metro session before first device use, and this source audit did not need that setup. There are no emulator-derived performance claims. Physical-phone traces are needed for JS/UI/GPU frame costs, decoded-image memory, battery and startup latency.
- Node SQLite timings establish a scaling relationship, not mobile execution speed. Expo bridge scheduling, on-device storage and native runtime overhead are outside that experiment.
- React lifecycle duplication is established from current application and installed focus-hook code; native mount/query-count instrumentation was not available in the render-free test harness.
- `HistorySection.tsx` creates a fresh non-cycle window object during render, invalidating dependent bucket/intensity memoization; intensity reparses interaction timestamps. Profile a long-history contact while opening a card/sheet before deciding whether this deserves remediation. No additional primary memoization finding is admitted.
- Bulk-import duplicate scoring rereads/tokenizes contact names per candidate, giving roughly batch-size × contact-count work. With the recorded tens-contact intent and no demonstrated device regression, this remains a measurement target rather than an optimization prescription.
- Backup peak heap, large-import wall time, native image reclamation and full migration-upgrade timing were not measured. Whole-manifest serialization and coherent photo-inclusive snapshots remain accepted until evidence establishes a separate problem.
- This is a domain packet, not cross-domain synthesis. Other pre-existing campaign reports were preserved; duplicate/conflicting findings should be reconciled during synthesis, retaining this packet's evidence and IDs.
