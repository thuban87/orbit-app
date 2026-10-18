# Orrery

**Last updated:** 2026-10-18

**Updated by phase:** 38.12-lifecycle-import-settings-ux

**Evidence:** automated implementation/SQLite/controller tests plus physical-Pixel authoring, management, accessibility and switch-choreography acceptance recorded in [30-UAT](../../.planning/phases/30-orrery-systems/30-UAT.md) and [30-12-DEVICE](../../.planning/phases/30-orrery-systems/30-12-DEVICE.md). V2 (38.7): release measurements against the Day-1 baseline in [38.7-DEVICE-PASS](../../.planning/phases/38.7-orrery-v2/38.7-DEVICE-PASS.md) and [38.7-PHASE-END-REPORT](../../.planning/phases/38.7-orrery-v2/38.7-PHASE-END-REPORT.md).

## Purpose and governing decisions

One canonical relationship-health world lets the user inspect local contacts through a bounded camera. Dashboard remains the daily working surface. A tap on an isolated contact focuses it (Profile opens only from the focus card, 38.7 D-60); ambiguous touch targets open a conventional contact group. The accessible companion represents exactly the selected live System.

ADR-077 partially supersedes ADR-048: the Status/Relationship toggle and relationship morph are gone. Timestamp placement, status treatments, keyed media and the single unmountable ambient clock remain. ADR-077's historical claim that SegmentedControl had only the Orrery consumer is stale: HomeScreen now uses the shared Dashboard view control. Retain that component.

ADR-104 defines the durable preference boundary and live System scope. ADR-105 limits relationship satellites to optional context for current System-member parents. ADR-106 partially supersedes ADR-027 only for modest derived Gravity body mass and named companion context; it leaves every other Gravity and Intensity policy intact.

Settings duplicates only the user-configurable density and satellite controls through `useOrreryPreferencesStore`; it does not expose last active System as a setting or create a second writer.

## Architecture and ownership

| Owner | Contract |
|---|---|
| `src/db/orrery-system-read.ts` | `readOrrerySystemSnapshot(exec, system)` owns one coherent read transaction; `readOrrerySystemSnapshotCore(ro, system)` composes settings, profile/sun, categories, members, complete contacted order and ID/UID fingerprints. |
| `src/db/systems-dao.ts` | Sole transactional writer for custom definitions, rule rows, manual overrides, visibility/order preferences, duplication, deletion and UID-stable Undo. |
| `src/logic/system-rule-resolver.ts` | Resolves custom rules with canonical Dashboard predicates, a post-query Gravity pass and dynamic include/exclude overrides; invalid rows remain identifiable broken rules. |
| `src/db/systems-catalog-read.ts`, `src/db/systems-members-read.ts` | Read the ordered visible catalog, bounded live counts and member-editor populations. |
| `src/logic/orrery-system-logic.ts` | `buildOrrerySystemWhere(system)` supplies closed, bound predicates shared by member reads and the narrow action probe. Category identity is UID, never name. Dashboard predicate semantics are reused without its store/query state. |
| `src/db/orrery-impact-read.ts` | `readOrreryImpactInputsCore(ro, ids)` reads complete history in deduplicated chunks of 256 inside the scene snapshot. No nested mutex, writes or per-contact query loop. |
| `src/services/orrery-scene.ts` | `loadOrreryScene(exec, generation = 0, system = ALL_CONTACTS_SYSTEM)` computes canonical Gravity and world geometry after the snapshot releases. Returns preferences, System snapshot, contacts, world, extent, Gravity and sun presentation. |
| `src/logic/orrery-world-logic.ts` | `deriveOrreryWorld` owns dense ring spacing, timestamp/neutral placement, stable UID nudges and modest Gravity mass. Every contact sits exactly on its ring (38.7 D-12: no drift). Positions do not depend on camera. |
| `src/logic/orrery-camera-logic.ts`, `orrery-frame.ts` | Bounded projection/inverse, readable Home and arbitrary body framing; one sampled/interpolated frame feeds rings, billboards, labels, hit targets and reorder preview. |
| `src/components/orrery/use-orrery-camera.ts` | Screen-owned shared pose/input/recovery controller and production gesture builders. Only discrete intents cross to JS. |
| `src/components/orrery/OrreryWorld.tsx` | Keyed resources, transitions, semantic visibility and the current projected frame (one UI-thread frame for every layer). It publishes immutable body, label and overlay specs to the V2 canvas; it renders no per-body components (38.7). |
| `src/components/orrery/v2/` | The V2 renderer: `OrreryV2Canvas` (fixed picture tree, the sole ambient clock owner), `render-host`, `ambient-clock`, `base-bake`, `nebula-bake`, `draw-*`, `cover-gate`, `focus-fx`, `scene-specs`, `visual-tunables`. See "V2 renderer, camera and switch". |
| `src/components/orrery/resources/` | `orrery-photo-cache`, `orrery-text-service`, `orrery-warm-cache` and `orrery-generation-ledger`: the bounded resource caches and the per-layer generation ledger that gates disposal. |
| `src/components/orrery/orrery-obstacle-logic.ts` | `framingViewport`: the map's framing viewport from persistent chrome only (38.7 D-79). |
| `src/components/orrery/use-orrery-switch-runtime.ts` | Screen-owned SharedValue runtime that preserves the displayed switch sample across canvas unmount, lifecycle pause and transition re-targeting. |
| `src/db/orrery-action-read.ts`, `src/logic/orrery-focus-logic.ts` | `readOrreryContactTargetValidation(exec, system, target)` freshly validates ID/UID/member/global-sun under one snapshot; `createOrreryFocusController` checks action and scene generations around each await. |
| `src/stores/orrery-system-store.ts` | Requested versus successful System identity, A→B→A generations, inert retained refresh errors, typed missing-category result, retry and successful-selection persistence. |
| `src/stores/orrery-preferences-store.ts` | Serialized commit-before-publish choices, failed-read protection, no-op saves and retry intent. |
| `src/screens/SettingsOrreryScreen.tsx` | Exposes the same density and satellite preferences plus Systems management routing without a Settings-only preference model. |
| `src/stores/orrery-session-store.ts`, `src/logic/orrery-session-logic.ts` | Memory-only route-key-aware Profile Back/background capture and valid-focus restoration. Fresh visits reset Home. |
| `src/db/ring-seq-dao.ts` | `commitRingReorder(exec, request, now, isCurrent?)` validates lock-time population/order/sun/identities, merges only visible slots, then preserves uniqueness/count/scoped-update guards. |
| `src/db/orrery-satellites-read.ts`, `src/logic/orrery-satellite-logic.ts` | Current unlinked visible relationship rows belonging to selected System members (visibility through `resolveRelationshipVisibility`, which shows every row while Hide from Profile is switched off, ADR-218); subordinate moon placement and discriminated context-only actions. |
| `src/screens/OrreryScreen.tsx` | Local reloads, measured viewport/obstacles, action cancellation, modal versus nonmodal controls, session departure and clock-subtree mounting. |
| `src/screens/SystemBuilderScreen.tsx`, `src/screens/SystemsManagementScreen.tsx` | Own the focused custom-System authoring HUD and the conventional cross-stack management surface. |

The earlier `listOrbitingContacts` read stays Bound/contacted/live and sun-excluded. Its dense read order continues to support guarded persistence; explicit All/Not widening occurs in the System reader, never by changing that default.

## Membership, global sun and health

All Contacts includes live Bound contacts, including never-contacted rows. Not Contacted explicitly selects the null-recency subset. Favorites, Needs Attention, Snoozed, Chargers and UID Categories retain active contacted semantics through the shared predicates. Categories order by display_order then UID; built-ins have fixed order. A renamed Category retains its identity; removal produces a missing-category result and Show All Contacts recovery.

Never-contacted status and progress remain null, with fixed neutral north placement and “Not contacted yet” copy. No fabricated interval progress, Stable state or decay is assigned. Existing status SQL remains the authority for all contacted health and snooze/local-day thresholds.

The globally configured contact sun is resolved independently of selected membership using ADR-047's live Bound fallback. A missing, archived or Unbound saved occupant renders self without deleting the saved setting; requalification restores it. Merge retargets the saved sun to the surviving contact; purge clears it. A qualifying contact sun appears once in members/companion and once as the central body, never as another orbiting body.

A sun excluded by Favorites or Category still has global contact focus/Profile actions. Ordinary member actions require fresh membership; contact-sun actions require the same fresh resolved global ID/UID. Mixed ambiguity preserves System order and appends a nonmember sun once. That sun never adds a companion row. Under owner ruling D-11, it also receives no Orrery satellite moons or relationship context until it qualifies as a member again; satellite On/semantic rules then apply normally.

## Custom Systems and membership

A custom System is a live Orrery-only view, not a frozen contact list or Dashboard query-state snapshot. Migration 022 stores custom definitions in `systems`, one closed rule value per `system_rules` row, ref-keyed manual membership in `system_overrides`, and cross-kind order/visibility state in `system_prefs`. Built-in and Category bases remain generated and immutable; their user-authored overrides and preferences use the same stable `system_ref` representation as custom Systems.

Rules use OR within a family and AND across families. Category, Favourite, Needs Attention, Social Battery, Contact Frequency, Not Contacted and Snoozed reuse canonical Dashboard predicate semantics (an indefinite snooze, `9999-12-31`, counts as Snoozed with no reader change, ADR-234); Gravity remains a post-query TypeScript filter. Manual inclusions add eligible active contacts outside the rule result. Exclusions suppress current rule matches and become semantically inert once a contact stops matching; an intentional definition save prunes those stale rows so a nominal read never writes.

A missing Category UID stays stored as a broken rule. The resolver omits that predicate, continues resolving every valid rule and manual inclusion, and exposes a stable needs-attention diagnostic. A missing custom-System reference is distinct from a valid empty System and safely falls back to All Contacts.

`SystemBuilderScreen` authors rules and overrides over its own inert decorative canvas. Manage Members uses a searchable virtualized grid, while Preview expands unsaved member IDs through a coherent local snapshot and the canonical world derivation without production photos or labels. `SystemsManagementScreen` provides create/edit/duplicate, guarded rename, reorder, built-in/Category visibility, override reset, and contact-safe custom deletion with a short-lived UID-stable Undo.

## World, camera and interaction

Density changes spacing only: Spacious ring gap 44, Balanced 34, Compact 32 world units. World extent grows with population; Home fits until minimum useful body size would fail, then permits outer rings offscreen. Six generous and roughly ten comfortable contacts are calibration goals, not count caps. Gravity tier modulation is 0.9–1.1 of nominal body radius. Stable collision corrections are bounded by one degree and four world units, independent of camera and selected density; neutral angles are not nudged.

Camera pose contains pan x/y, zoom, tilt, yaw, focal distance and lens shift. Zoom is 0.25–4 (`MIN_ZOOM`/`MAX_ZOOM`); focus framing may zoom past the identity level (D-47). User tilt is capped at `MAX_USER_TILT` 68°. Projection and inverse share the bounded perspective denominator; points beyond the horizon are culled, never thrown on. Photos remain circular and labels horizontal. Bodies are drawn in projected-depth order around the sun inside the V2 pictures; draw order never chooses a contact action. All plausible inclusive touch targets survive ambiguity.

One finger pans, keeping the touched ground point under the finger (horizon fallback, per-update step cap; a fling coasts 260 ms / 48 pt); pinch zooms; two-finger rotation yaws; deliberate two-finger vertical travel activates tilt. An 850ms stationary hold with 8-point slop arms contacted-only reorder, acknowledged by a highlight/ghost and haptic. Pre-activation movement pans; multi-touch, lifecycle change or failed release cancels. A no-op release writes nothing. Native recognition and tuning require the checklist.

Semantic levels are `overview`, `identity`, `detail`, with entry/exit hysteresis, chosen from on-screen magnification (the median of the visible contacts, 38.7 D-47), not from the camera zoom. Name allocation prioritizes focus, group, Favorites, fitting isolated labels, then remaining identities; optional context never displaces a fitted name. Native Paragraph measurement handles full Unicode; conventional rows retain the original full name and wrapping actions.

A tap on a person always focuses; tapping the focused person keeps focus; Profile opens only from the focus card's Open Profile (38.7 D-60). Polaris is a projected world north landmark, drawn in the overlay picture. Reset north changes yaw only; Recenter clears focus/group and restores all Home axes. Recovery is continuous, distance-adaptive and bounded; new input cancels it. Tiny pan/yaw continuation has bounded distance; zoom/tilt do not coast. Live Reduced Motion drops inertia and uses a short direct recovery while retaining manual gestures.

## Durable versus session state

Migration 021 adds `app_settings.orrery_density` (balanced), `orrery_satellites_enabled` (0), and `orrery_last_system` (builtin:all-contacts). Existing `sun_contact_id`, `self_sun_colour` and `contacts.ring_seq` remain. Density accepts only spacious/balanced/compact; satellite toggle exactly 0/1; System tokens are closed built-ins or `category:` plus 1–256 non-whitespace/non-control UID characters. Category existence is resolved on read rather than a settings FK.

`AppSettings` requires the three preferences; `PortableSettingsSnapshot` and backup acceptance allow them optionally. Current `getPortableSettingsSnapshot`/format-4 exports intentionally do not emit them. Both restore modes preserve an existing preference when the incoming key is omitted. Phase 36 owns coordinated emission/version changes. No camera, pose or focus is stored in SQLite, AsyncStorage or export.

Migration 023 adds `app_settings.orrery_system_selection_revision`. Explicit selections advance it, including a deliberate re-selection of All Contacts. Delete records the fallback revision, and Undo restores the prior active custom System only if both the fallback token and revision remain current; a newer user selection always wins.

Profile departure captures the settled UI-thread pose once. Genuine Profile Back restores bounded pose and surviving ID/UID focus for the same System; the dismissed group panel does not reopen. Background alone preserves the session. Fresh tab/route visit clears it. Generations reject stale scene, satellite, target and departure completions; cancellation prevents later publication/navigation without aborting another transaction.

## Guarded rank persistence

The request captures System, expected complete contacted order, saved sun, eligible visible IDs and ID/UID fingerprints. Under the existing shared write lock the DAO re-reads all of them, including current System predicates evaluated against SQLite's local day. It rejects changed filtered membership even if full order/sun are unchanged, changed UID behind reused numeric ID, cancelled generations and clock-only membership changes without a revision bump. It permutes visible slots within the complete order, retains hidden slots, then applies the original uniqueness, exact-count and scoped-one-row-update guards. Recency is not assigned by reorder.

`src/db/__testkit__/sqlite-local-day.ts` is test-only: it overrides exactly `date('now','localtime')` on one fixture connection and delegates every other date call to a separate unmodified native SQLite connection; both close together. Production APIs do not accept an injected day. Unmodified-clock predicate/action parity remains a separate control.

## Relationships, accessibility and lifecycle

Only unlinked, nondeleted, visible structured Relationships on current member parents qualify. Hidden/link/delete changes remove moons; restore/unlink or parent requalification can restore eligibility. Moons carry relationship UID and parent ID/UID, with name/relation context only. They have no health, Gravity, cadence, rank, logging, Profile, independent membership or children. Missing relation uses “A key person for {parentName}”; no relationship is inferred.

The modal Contacts in this System sheet provides photo/fallback, health, named Gravity and separate Focus in Orrery/Open Profile actions in exact member order, plus qualifying parent relationship context. The floating Contacts here group remains nonmodal and keeps the world and Recenter available. The map's framing (projection centre, Home, Recenter, focus and cluster framing) uses persistent chrome only. That means the measured shell tabs and FAB, a full-width band down to the title and the HUD triggers, and the camera controls' resting column (`framingViewport`). Dropdown panels, the Contacts here group, the focus card and feedback notices never move the map; they keep their own layout, the occlusion dim and the label exclusion (38.7-16, CONTEXT D-79; this replaces the earlier rule that feedback is a framing exclusion). A cluster is framed in the area its open panel leaves uncovered. Dropdown/sheet dismissal restores trigger focus; Back/tab-retap consumes the top transient before navigation.

Initial loading, empty membership, read failure, retained refresh failure, missing Category, preference failure, reorder failure and satellite failure have separate treatments. A failed optional relationship read does not erase contact identity. `OrreryV2Canvas` is the only ambient Skia clock owner (the 38.7 renderer replaced `OrreryCanvas`); blur/background unmounts its subtree, while the bounded warm cache survives an ordinary tab blur (see "V2 renderer, camera and switch"). Every ambient consumer reads live Reduced Motion on the render loop. React state is used for discrete data/UI updates, never animation frames.

## System switching

The selector presents exactly three disclosure groups—Built-in, Categories, and Custom Systems—and recreates expansion state on every open from the selected System. Category rows and category rules use stable UIDs, so rename changes labels without changing identity. System Builder searches the complete category catalog without discarding hidden draft selections. A proven runtime category deletion removes only that UID's rule and ref-keyed customization; unrelated historical missing-category rules remain visible diagnostics. If the deleted Category System is already open, the store follows the normal durable selection channel back to All Contacts.

The ordered switcher pins All Contacts, omits hidden Systems, and shows progressively resolved live counts. Empty and broken Systems remain selectable and use different icon shapes, visible text and accessibility labels; customized generated Systems also expose a non-severity overrides indicator.

A genuine System change sends the destination to canonical Home framing while retaining a focused contact that survives in both memberships. The screen-owned runtime classifies retained, leaving and entering bodies by stable key, then samples accelerate, shed, capture and settle stages on the Reanimated/Skia path. Membership turnover controls whole-turn impulse and radial displacement. One sampled world remains authoritative for rings, bodies, labels, visibility and hit targets, and re-targeting starts from the exact displayed sample rather than stale source geometry.

Blur or backgrounding holds the current progress and unmounts the canvas consumer; remount resumes from that sample. Reduced Motion replaces rotational peel/capture with a short direct reposition treatment. Persistence-only Zustand publications are not scene changes and cannot prematurely settle an active transition.

**Settled resource retirement (RG-027, `performance/AUD-PERF-001`, 38.4).** A switch only carries its departed bodies while it is running. When the driver completes, the generation-checked `finish` worklet replaces the UI-thread `transition` with `settleSwitchChoreography(transition)` — the destination bodies only — so invisible departures are no longer projected every frame; sampling the compacted choreography at progress 1 renders the same visible world, and generation and Reduced Motion are preserved. The React resource list follows the same rule through `nextOrreryResources`: a running switch unions departures with the destination (interruption continuity), then the generation-checked prune (`pruneOrreryResources`) drops them on completion; every settled (non-switch) publication — same-System refreshes, removals, and a refresh after an interrupted switch — replaces the list with the current scene outright. Keys are stable, so a body present on both sides keeps its keyed media. Reduced-motion completion flows through the same `finish`; there is no second compaction site. Cardinality after completed, interrupted, removal and reduced-motion paths is pinned in `orrery-switch-runtime.test.ts`. Frame-time and memory consequences are physical-phone evidence only and belong to the 38.4 device leg.

**Worklet order guard.** `src/components/orrery/orrery-worklet-order.test.ts` resolves every call made inside a worklet with the TypeScript checker and fails when a same-file worklet callee is declared after the statement that creates the calling worklet — the Hermes forward-reference crash class vitest cannot observe at runtime. It covers the switch choreography and runtime plus every other `src/logic/orrery-*.ts` and `src/components/orrery/` module.

## V2 renderer, camera and switch (38.7)

Phase 38.7 replaced the declarative Skia renderer with Orrery V2. The data, Systems, preferences and persistence above are unchanged. Owner rulings are CONTEXT D-01..D-81 and the dossier `docs/dossier/milestone-2/phase-38.7-orrery-v2-dossier.md`; the decisions are ADR-186 (renderer and host), ADR-187 (camera, Home, bodies on rings), ADR-188 (focus and framing), ADR-189 (sky and pulses), ADR-190 (bodies, sun, moons), ADR-191 (switch) and ADR-192 (warm cache).

**Renderer and host.** `OrreryV2Canvas` draws a small, fixed list of `<Picture>` layers for any System size: the sky, the base (rings and the plane grid), stars, orbit pulses, the switch effects, bodies behind the sun, the sun, bodies in front, labels, and the overlay (Polaris, reorder outline, focus reticle). Each picture is recorded on the UI thread from SharedValue specs that JS publishes (`scene-specs.ts`); React state never carries a frame. Rings are drawn in world space under the camera's exact plane homography by an analytic SkSL line on cached annulus strips, never stroked under perspective. Bodies are lit status shaders (sun-lit faces, Lab B rim and glow, decay/rogue wash-out); the sun is always Lab A's star, never the occupant's photo. Far zoom shows a moon bump that splits into moons on the frame's own zoom; stack pips sit opposite it. `render-host.ts` holds the platform choices behind one seam (`resolveOrreryRenderHost`). Android uses an opaque SurfaceView canvas, the frame-clock ambient driver, a GPU-offscreen base bake and world-plane rings (D-64). iOS and web have seam values but no build (D-46).

**Resources.** Photos (`orrery-photo-cache`, one decode per key, hard image/byte caps counted before a decode) and Paragraphs (`orrery-text-service`, one builder per font provider, admission before shaping) are the only paths for those objects. `orrery-generation-ledger` disposes an object only after every picture layer that recorded it has acknowledged a newer generation. Initials are Hermes-safe (first grapheme per word, no `Intl.Segmenter`).

**Camera.** `HOME_PROFILES` has a 62° `tilted` strategy-map profile (lens shift 0.62, strategy fit) and a `flat` 0° whole-disc profile; `ACTIVE_HOME_PROFILE` is `tilted` (D-03, D-78). The focal length is a dolly (`DOLLY_FOCAL_PX` 720 / zoom). One `projectedBodyRadius` sets drawn, tappable and labelled size together (near-side cap knee 0.6, asymptote 0.12; minimum on-screen size). A tiny System opens zoomed in, up to `HOME_STRATEGY_MAX_ZOOM` 4.

**Ambient clock and frame-rate vote.** `ambient-clock.ts` turns the frame clock into one quantised `AMBIENT_HZ` 30 value; it is −1 (still) under reduced motion. Stars, sky drift, pulses (`PULSE_BUDGET` 40) and the sun read it. While the camera is still, the base is blitted from the GPU bake instead of re-recording rings. The Orrery SurfaceView sends a native `Surface.setFrameRate` vote (patched `@shopify/react-native-skia` 2.6.2, D-65). It votes `AMBIENT_HZ` 30 at idle, `MOTION_VOTE_HZ` 120 while a switch, gesture or camera motion runs (SurfaceFlinger picks the nearest supported rate), and withdraws the vote (0) under reduced motion (38.7-16 FV-1, D-79). On the Pixel 6 Pro release, the idle panel leaves 120 Hz (60 Hz mode, rendering at 30).

**Warm cache (D-58).** Ordinary tab blur keeps CPU-backed objects warm: decoded photo derivatives, Paragraphs and CPU-baked sky/nebula images, never GPU-texture-backed images. The budget is `ORRERY_WARM_MAX_BYTES` 64 MiB, `ORRERY_WARM_MAX_PARAGRAPHS` 128 and `ORRERY_WARM_MAX_SKY_IMAGES` 4, with LRU eviction (`orrery-warm-cache.ts`). It is released on app background, after `ORRERY_WARM_IDLE_TIMEOUT_MS` (5 min) without a visit, and on a memory warning. The canvas, ambient clock and GPU surfaces still release on blur, and ADR-170's settled-switch retirement still applies. A warm tab return mounts on the retained snapshot with the Home pose already applied; Profile Back and background keep the session-restore path. The System Preview does not clear the warm entries.

**First frame and cover gate.** The first frame is the theme's sky, never black. A cover in the sky colour sits over the opaque canvas until `cover-gate.ts` lifts it. Once the content is recorded, the canvas arms a native "presented" probe. The cover lifts on composite evidence: a non-black buffer, then the window's next frame commit plus a vsync on API 29+. It is bounded by `COVER_PRESENT_TIMEOUT_MS` 3000 after arming and `COVER_HARD_MAX_MS` 6000 after mount, so it can never stick.

**System switch.** A switch starts on the tap: a lead-in moves the camera on the retained scene while the destination loads, then hands off continuously to the switch choreography, which lands exactly on Home. The camera is copied from Lab C (D-77). It uses a raw linear yaw return (`SWITCH_YAW_PATH` "lab-c") plus a breath of `SWITCH_BREATH_PULLBACK` 0.24, `SWITCH_BREATH_YAW` 0.38 rad and `SWITCH_BREATH_TILT` −0.1, scaled by sin²(πp). The sky's own stars warp (`WARP_STRENGTH` 1) and planets streak along their orbits (`TRAIL_STRENGTH` 0.5); the per-System sky tint crossfades at draw time, with no sky bake inside a switch. Reduced motion uses a plain short crossfade. All Contacts is untinted; every other System takes its hue from its `systemRefId`.

**Focus and framing.** A focused person is framed large and centred above a focus card docked at the canvas bottom (Lab C), zoomed past the old identity cap (D-19, D-47). Lab A's reticle locks on, and everything but the sun and the focused parent's moons dims (D-18, D-21). Text surfaces get an occlusion dim, 0.7 in every theme from theme tokens; contrast is proven at 4.5:1 in all four themes (D-28, ADR-169 method). The map's framing uses persistent chrome only (`framingViewport`, D-79): transient panels, the cluster panel, the focus card and notices never move the map, and nothing holds or adopts a viewport through a switch. A cluster tap zooms until its members separate, framed in the area its panel leaves uncovered. Stacking: the focus card sits at zIndex/elevation 13, above the camera controls (12) and below the title (20). The controls' root is `box-none`, so only their plates take touches, and a hidden card moves off-screen.

**Gotchas.**
- **Never drive a V2 frame from React state or capture scene objects in a worklet.** The capture allowlist test and the worklet forward-reference guard both apply to `src/components/orrery/v2/`.
- **A V2 perf claim needs a physical phone and a release build** (`docs/runbooks/orrery-perf-measurement.md`). DEBUG numbers are context only. Graphics/GL memory is higher than the pre-V2 renderer (opaque canvas buffers plus the base bake; owner-accepted, D-79), while total PSS is lower.
- **Idle cost with animations on is high** (about two thirds of one core on the 6 Pro release; pulses, the lit shader and the sky are the suspects). The owner sent it to a profiling todo (D-80 CPU-1, `.planning/todos/pending/2026-10-05-orrery-idle-cpu-animations-on.md`); it is not a gate.
- **Emoji words win the initials pick.** "Mia 🌸 Nguyễn" draws "M…": `orreryInitials` takes the first grapheme of the first two words, and the emoji is wider than the disc. Open todo (D-80 EMO-1): skip non-letter words.
- **Never add a transient surface to `framingViewport`.** Panels, the cluster group, the focus card and notices are deliberately not framing obstacles (ADR-188); adding one back brings back the map jump.

## Snapshot contention and Phase 40 handoff

`buildExportManifest` retains the shared FIFO snapshot mutex while reading photos. Scene loads and mandatory fresh target probes queue behind it; a coherent full-history scene can in turn delay Quick Log/write transactions. Bounded statement counts do not bound wait time. Computation/layout/image work stays outside the scene lock, and logical cancellation invalidates results even though queued SQL still runs.

The real SQLite integration proves production-written `avatars/profile.jpg` enters its injected photo reader exactly once while the barrier is held, before scene/action enqueue, for both cancelled and fresh controls. It also pauses an actual scene read before queuing the recency writer and proves pre-write snapshot versus subsequent committed recency. No transaction owner is mocked or bypassed. This is ordering/coherence evidence, not native responsiveness or performance.

**Unmeasured:** native backup/tap overlap, long-history/photo-library wait/hold timing, frame timing and GPU behavior. The checklist requires normal automatic-backup tap-to-focus/Profile and cancellation observations, plus scene refresh concurrent with normal Quick Log. Record contact/history/photo scale, target type and whether overlap was actually observed. If overlap is unconfirmed, keep the case pending. Phase 40 owns measured contention optimization and final density/neighbor/large-System calibration. No timeout, priority, busy treatment, additional connection or control bypass is authorized by this handoff. Wall-clock tap delay is not JS/Skia frame time; only physical-phone evidence can support performance claims.

## Decisions

- **ADR-149:** Orrery-Specific Translucent Overlay Treatment and Icon Controls — gives floating Orrery surfaces an AA-proven semantic `GlassSurface` treatment and separates Contacts, Recenter, and Center North into accessible icon controls.

- **ADR-046:** Query-Time Orrery Placement and Transactional Ring Ordering — keeps placement derived and rank writes guarded; Phase 29 narrows a reorder to validated visible System slots while preserving the complete order. Its read-time drift is superseded by ADR-187 (partial).
- **ADR-047:** App-Level Assignable Sun and Themed Self Identity — keeps global sun identity independent of System membership.
- **ADR-048:** Status-Default Static Orrery with a Single-Canvas Morph — historical; superseded in part by ADR-077 (dual view) and ADR-189 (sole ambient animation).
- **ADR-077:** Single Canonical Orrery with a Constrained Inspection Camera — supplies the single status world, bounded camera model and the one unmountable ambient clock; its "sole ambient animation" clause is superseded by ADR-189 (partial).
- **ADR-085:** Live Reduced-Motion Signal for Skia Ambient Animation — every V2 ambient motion reads the live SharedValue and stops under it.
- **ADR-104:** Durable Orrery Preferences and Live System Scope — adds validated migration-021 preferences and coherent live System snapshots.
- **ADR-105:** Scoped Relationship Satellites for System-Member Context — renders unlinked relationship moons only as optional, subordinate member context.
- **ADR-106:** Derived Orrery Gravity Visual Mass and Accessible Context — permits bounded derived Gravity body mass and companion context while partially superseding ADR-027's display restriction.
- **ADR-140:** Navigation-First Settings Directory and Canonical Sub-Routes — makes the Settings Orrery entry reuse the existing preference source and Systems manager.
- **ADR-143:** Lock-Time-Revalidated Atomic Category Deletion and System Fallout — removes only the deleted category's System state and routes active selection to All Contacts.
- **ADR-144:** Complete Category Selection and Grouped Orrery System Discovery — defines UID-backed Category rule selection and the constrained three-group System selector.
- **ADR-170:** Bounded Your Week Reads and Settled Orrery Resource Retirement — range-bounded `occurred_at` predicates on migration-031 indexes; settled Orrery switches drop departed resources.
- **ADR-175:** Header-Only Back and a Shared Root Header on Every Tab Root and Settings Child — one header Back per child screen; every tab root uses `ShellAppBar variant="root"`.
- **ADR-181:** One Square WebP Master up to 1024 px with Bounded Orrery Textures from Cache Copies — the Orrery never decodes a master larger than 512 px. Its photo textures stay within the 5 % memory gate measured against the 512 JPEG baseline (D-11).
- **ADR-186:** Orrery V2 Imperative Picture Renderer Behind a Platform Render Host — fixed picture tree, world-plane rings, `render-host` seam, one text/photo path with ledger disposal, 30 Hz ambient clock and the native frame-rate vote.
- **ADR-187:** Tilted Strategy-Map Home, Dolly Camera, One Projected Size, and Bodies on Their Rings — 62° Home with flat one word away, dolly focal, one `projectedBodyRadius`, no drift.
- **ADR-188:** Reticle Focus, Docked Card, Cluster Zoom-In, Tap-Only Focus, and Persistent-Chrome Framing — a tap only focuses; framing comes from persistent chrome only.
- **ADR-189:** Painted Per-System Sky and Ambient Orbit Pulses as Permitted Non-Data Motion — painted sky with a `systemRefId` tint, Lab B rings and pulses, the `orrery*` token sub-palette.
- **ADR-190:** Lit Status Bodies, Star Sun, Moon Bumps, Stack Pips, and Hermes-Safe Initials — status from rim, glow and wash-out; moon bump splits on zoom.
- **ADR-191:** Star-Warp System Switch Starting on the Tap, with Lab C's Camera — warp and streaks over the production choreography; lead-in from the tap.
- **ADR-192:** Bounded Warm Resource Cache Across Tab Blur — CPU-backed warm cache with caps and release triggers; clarifies ADR-170.

- **ADR-218:** Things to Remember on the Profile — while `HIDE_FROM_PROFILE_ENABLED` is false, key people stored as hidden appear as satellites; ADR-105's hidden exclusion returns when the switch does.
- **ADR-212:** One Delete Pattern — key people are hard-deleted, so a deleted relationship never lingers as a satellite.
- **ADR-234:** Per-Person Mute Becomes an Indefinite Snooze — the Snoozed System and the snoozed look include indefinite snoozes.
- **ADR-246:** One Settings Row and Section Card — Systems management rows use the drag + ⋯ pattern; "Manage Members" opens the builder on Members; one "Reset Membership Changes" label; the builder's decorative circles are gone.

## Deferred seams and evidence limits

The `orrery-overlay` treatment is a controlled-canvas exception to ordinary card composition: it remains translucent in every package/mode combination, preserves the shared 0.92 visibility ceiling, and never changes `CARD_GLASS_OPACITY`. `OrreryContactsSheet` remains a modal `Sheet`, not a floating-overlay consumer.

- Phase 36 owns portable preference emission and coordinated backup compatibility/versioning.
- Phase 37 owns Category CRUD and deletion fallout; this consumer uses actual UID records and explicit missing-category recovery.
- Phase 40 owns final camera/density/neighbor, long-history/photo contention, device GPU, gesture and accessibility calibration. Rich social graphs remain deferred.
- Phase 30's authoring, management, largest-text and switch-choreography checks passed on the physical Pixel. Phase 40 still owns final high-count performance, camera/density and broader accessibility calibration.
- **System Undo has a narrow purge/merge race.** If an override contact is permanently purged or absorbed between System deletion and the six-second Undo action, the snapshotted local contact ID no longer satisfies the foreign key. Restore currently rolls back rather than restoring the definition with only surviving overrides; this remains an open review warning.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-17 | 13 | Created local two-view Skia Orrery, sun settings and guarded ordering. |
| 2026-08-27 | 18.2 | Made orbit/picker/reorder Bound-only and preserved saved Unbound sun fallback. |
| 2026-09-02 | 22 | Added post-Quick-Log projection refresh. |
| 2026-09-02 | 23 | Added live Reduced Motion for ambient consumers. |
| 2026-09-02 | 29 | Replaced dual-view rendering with canonical world/camera/Systems; added preferences, sessions, guarded filtered ordering, relationship moons, and ADR-104–106 decision records. |
| 2026-09-02 | 30 | Added migration-backed custom Systems, rule and override resolution, authoring/management/preview surfaces, revision-guarded selection, and owner-approved staged switching. |
| 2026-09-17 | 37.1 | Added complete UID-backed Category rule authoring, exact grouped selection, canonical Needs Attention, and deleted-category fallback through durable All Contacts selection. |
| 2026-09-02 | 37 | Added a Settings Orrery category bound to the existing preference store and Systems management routes. |
| 2026-09-19 | 38.1 | Added the semantic AA-proven floating-overlay treatment and three uniform icon-only navigation controls without changing the Orrery world or ordinary card opacity. |
| 2026-09-26 | 38.4 | Settled Orrery resource retirement (RG-027, performance/AUD-PERF-001): settled switches compact the UI-thread choreography to destination bodies and settled publications replace React resources; added the same-file worklet forward-reference guard test. |
| 2026-09-30 | 38.6 | Photo bodies draw through `useOrreryPhoto` (`src/components/orrery/use-orrery-photo.ts`). Masters of 512 px or less are drawn as decoded. Larger 1024 WebP masters are read from a ≤512 JPEG copy on disk (`src/services/photos/orrery-derivative-store.ts`, cache dir, keyed by size and mtime, discarded on every photo byte change, chunked launch sweep). An in-memory downsample cache (D-37) was not enough. With the copies (D-41), settled Graphics/GL at 20 s measured +2.9 % / +4.2 %, within the 5 % gate on the physical phone (ADR-181). Banner-time framing squeeze logged (D-42). |
| 2026-10-05 | 38.7 | Framing is persistent chrome only (owner-directed, CONTEXT D-79). Panels, the cluster group and notices no longer move the map, the switch viewport hold is removed, and the focus card stacks above the controls' touch column. The frame-rate vote is the panel's top rate during motion. |
| 2026-10-05 | 38.7 | Orrery V2 (phase close, Plan 16): added the V2 renderer, camera and switch section (fixed picture tree and render host, world-plane rings, 62° tilted Home with dolly focal and lens shift, ambient clock with the 30 Hz idle / 120 Hz motion / 0 reduced-motion frame-rate vote, warm cache, cover gate, Lab C switch camera with the tap lead-in, focus framing and card stacking). Corrected the pre-V2 statements: drift, tilt range, native-sibling occlusion, `OrreryCanvas` as clock owner, and tap-to-Profile. Release evidence and the owner's sign-off are in `38.7-PHASE-END-REPORT.md`. |
| 2026-10-15 | 38.10 | Relationship satellites follow the Hide from Profile switch (off: stored-hidden key people show) and hard-deleted key people (ADR-212, ADR-218). |
| 2026-10-18 | 38.12 | Indefinite snooze counts as Snoozed; Systems management on the drag + ⋯ list pattern, Manage Members opens the Members page, one reset label, no decorative builder circles (ADR-234, ADR-246). |
