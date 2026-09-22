# Orrery

**Last updated:** 2026-09-17

**Updated by phase:** 30-orrery-systems

**Evidence:** automated implementation/SQLite/controller tests plus physical-Pixel authoring, management, accessibility and switch-choreography acceptance recorded in [30-UAT](../../.planning/phases/30-orrery-systems/30-UAT.md) and [30-12-DEVICE](../../.planning/phases/30-orrery-systems/30-12-DEVICE.md).

## Purpose and governing decisions

One canonical relationship-health world lets the user inspect local contacts through a bounded camera. Dashboard remains the daily working surface. Distant isolated contacts focus to visible identity; inspected contacts open Profile; ambiguous touch targets open a conventional contact group. The accessible companion represents exactly the selected live System.

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
| `src/logic/orrery-world-logic.ts` | `deriveOrreryWorld` owns dense ring spacing, timestamp/neutral placement, bounded drift, stable UID nudges and modest Gravity mass. Positions do not depend on camera. |
| `src/logic/orrery-camera-logic.ts`, `orrery-frame.ts` | Bounded projection/inverse, readable Home and arbitrary body framing; one sampled/interpolated frame feeds rings, billboards, labels, hit targets and reorder preview. |
| `src/components/orrery/use-orrery-camera.ts` | Screen-owned shared pose/input/recovery controller and production gesture builders. Only discrete intents cross to JS. |
| `src/components/orrery/OrreryWorld.tsx` | Keyed resources, transitions, semantic visibility and the current projected frame. Sun/contact body root Groups are consecutive native siblings using animated depth and paint-valued opacity layers. No wrapper separates the depth batch. |
| `src/components/orrery/use-orrery-switch-runtime.ts` | Screen-owned SharedValue runtime that preserves the displayed switch sample across canvas unmount, lifecycle pause and transition re-targeting. |
| `src/db/orrery-action-read.ts`, `src/logic/orrery-focus-logic.ts` | `readOrreryContactTargetValidation(exec, system, target)` freshly validates ID/UID/member/global-sun under one snapshot; `createOrreryFocusController` checks action and scene generations around each await. |
| `src/stores/orrery-system-store.ts` | Requested versus successful System identity, A→B→A generations, inert retained refresh errors, typed missing-category result, retry and successful-selection persistence. |
| `src/stores/orrery-preferences-store.ts` | Serialized commit-before-publish choices, failed-read protection, no-op saves and retry intent. |
| `src/screens/SettingsOrreryScreen.tsx` | Exposes the same density and satellite preferences plus Systems management routing without a Settings-only preference model. |
| `src/stores/orrery-session-store.ts`, `src/logic/orrery-session-logic.ts` | Memory-only route-key-aware Profile Back/background capture and valid-focus restoration. Fresh visits reset Home. |
| `src/db/ring-seq-dao.ts` | `commitRingReorder(exec, request, now, isCurrent?)` validates lock-time population/order/sun/identities, merges only visible slots, then preserves uniqueness/count/scoped-update guards. |
| `src/db/orrery-satellites-read.ts`, `src/logic/orrery-satellite-logic.ts` | Current unlinked visible relationship rows belonging to selected System members; subordinate moon placement and discriminated context-only actions. |
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

Rules use OR within a family and AND across families. Category, Favourite, Needs Attention, Social Battery, Contact Frequency, Not Contacted and Snoozed reuse canonical Dashboard predicate semantics; Gravity remains a post-query TypeScript filter. Manual inclusions add eligible active contacts outside the rule result. Exclusions suppress current rule matches and become semantically inert once a contact stops matching; an intentional definition save prunes those stale rows so a nominal read never writes.

A missing Category UID stays stored as a broken rule. The resolver omits that predicate, continues resolving every valid rule and manual inclusion, and exposes a stable needs-attention diagnostic. A missing custom-System reference is distinct from a valid empty System and safely falls back to All Contacts.

`SystemBuilderScreen` authors rules and overrides over its own inert decorative canvas. Manage Members uses a searchable virtualized grid, while Preview expands unsaved member IDs through a coherent local snapshot and the canonical world derivation without production photos or labels. `SystemsManagementScreen` provides create/edit/duplicate, guarded rename, reorder, built-in/Category visibility, override reset, and contact-safe custom deletion with a short-lived UID-stable Undo.

## World, camera and interaction

Density changes spacing only: Spacious ring gap 44, Balanced 34, Compact 32 world units. World extent grows with population; Home fits until minimum useful body size would fail, then permits outer rings offscreen. Six generous and roughly ten comfortable contacts are calibration goals, not count caps. Gravity tier modulation is 0.9–1.1 of nominal body radius. Stable collision corrections are bounded by one degree and four world units, independent of camera and selected density; neutral angles are not nudged.

Camera pose contains pan x/y, zoom, tilt, yaw and focal distance. Zoom is currently 0.25–4 and tilt 0–60 degrees. Projection and inverse share the bounded perspective denominator; photos remain circular and labels horizontal. Native sibling zIndex controls body/sun occlusion; it never chooses a contact action. All plausible inclusive touch targets survive ambiguity.

One finger pans; pinch zooms; two-finger rotation yaws; deliberate two-finger vertical travel activates tilt. An 850ms stationary hold with 8-point slop arms contacted-only reorder, acknowledged by a highlight/ghost and haptic. Pre-activation movement pans; multi-touch, lifecycle change or failed release cancels. A no-op release writes nothing. Native recognition and tuning require the checklist.

Semantic levels are `overview`, `identity`, `detail`, with entry/exit hysteresis. Name allocation prioritizes focus, group, Favorites, fitting isolated labels, then remaining identities; optional context never displaces a fitted name. Native Paragraph measurement handles full Unicode; conventional rows retain the original full name and wrapping actions.

Polaris is a projected world north landmark. Reset north changes yaw only; Recenter clears focus/group and restores all Home axes. Recovery is continuous, distance-adaptive and bounded; new input cancels it. Tiny pan/yaw continuation has bounded distance; zoom/tilt do not coast. Live Reduced Motion drops inertia and uses a short direct recovery while retaining manual gestures.

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

The modal Contacts in this System sheet provides photo/fallback, health, named Gravity and separate Focus in Orrery/Open Profile actions in exact member order, plus qualifying parent relationship context. The floating Contacts here group remains nonmodal and keeps the world and Recenter available. Measured shell tabs/FAB/HUD/feedback are shared framing exclusions. Dropdown/sheet dismissal restores trigger focus; Back/tab-retap consumes the top transient before navigation.

Initial loading, empty membership, read failure, retained refresh failure, missing Category, preference failure, reorder failure and satellite failure have separate treatments. A failed optional relationship read does not erase contact identity. `OrreryCanvas` remains the only ambient Skia clock owner; blur/background unmounts its subtree. Every ambient consumer reads live Reduced Motion on the render loop. React state is used for discrete data/UI updates, never animation frames.

## System switching

The selector presents exactly three disclosure groups—Built-in, Categories, and Custom Systems—and recreates expansion state on every open from the selected System. Category rows and category rules use stable UIDs, so rename changes labels without changing identity. System Builder searches the complete category catalog without discarding hidden draft selections. A proven runtime category deletion removes only that UID's rule and ref-keyed customization; unrelated historical missing-category rules remain visible diagnostics. If the deleted Category System is already open, the store follows the normal durable selection channel back to All Contacts.

The ordered switcher pins All Contacts, omits hidden Systems, and shows progressively resolved live counts. Empty and broken Systems remain selectable and use different icon shapes, visible text and accessibility labels; customized generated Systems also expose a non-severity overrides indicator.

A genuine System change sends the destination to canonical Home framing while retaining a focused contact that survives in both memberships. The screen-owned runtime classifies retained, leaving and entering bodies by stable key, then samples accelerate, shed, capture and settle stages on the Reanimated/Skia path. Membership turnover controls whole-turn impulse and radial displacement. One sampled world remains authoritative for rings, bodies, labels, visibility and hit targets, and re-targeting starts from the exact displayed sample rather than stale source geometry.

Blur or backgrounding holds the current progress and unmounts the canvas consumer; remount resumes from that sample. Reduced Motion replaces rotational peel/capture with a short direct reposition treatment. Persistence-only Zustand publications are not scene changes and cannot prematurely settle an active transition.

## Snapshot contention and Phase 40 handoff

`buildExportManifest` retains the shared FIFO snapshot mutex while reading photos. Scene loads and mandatory fresh target probes queue behind it; a coherent full-history scene can in turn delay Quick Log/write transactions. Bounded statement counts do not bound wait time. Computation/layout/image work stays outside the scene lock, and logical cancellation invalidates results even though queued SQL still runs.

The real SQLite integration proves production-written `avatars/profile.jpg` enters its injected photo reader exactly once while the barrier is held, before scene/action enqueue, for both cancelled and fresh controls. It also pauses an actual scene read before queuing the recency writer and proves pre-write snapshot versus subsequent committed recency. No transaction owner is mocked or bypassed. This is ordering/coherence evidence, not native responsiveness or performance.

**Unmeasured:** native backup/tap overlap, long-history/photo-library wait/hold timing, frame timing and GPU behavior. The checklist requires normal automatic-backup tap-to-focus/Profile and cancellation observations, plus scene refresh concurrent with normal Quick Log. Record contact/history/photo scale, target type and whether overlap was actually observed. If overlap is unconfirmed, keep the case pending. Phase 40 owns measured contention optimization and final density/neighbor/large-System calibration. No timeout, priority, busy treatment, additional connection or control bypass is authorized by this handoff. Wall-clock tap delay is not JS/Skia frame time; only physical-phone evidence can support performance claims.

## Decisions

- **ADR-046:** Query-Time Orrery Placement and Transactional Ring Ordering — keeps placement derived and rank writes guarded; Phase 29 narrows a reorder to validated visible System slots while preserving the complete order.
- **ADR-047:** App-Level Assignable Sun and Themed Self Identity — keeps global sun identity independent of System membership.
- **ADR-077:** Single Canonical Orrery with a Constrained Inspection Camera — supplies the single status world and bounded camera model.
- **ADR-104:** Durable Orrery Preferences and Live System Scope — adds validated migration-021 preferences and coherent live System snapshots.
- **ADR-105:** Scoped Relationship Satellites for System-Member Context — renders unlinked relationship moons only as optional, subordinate member context.
- **ADR-106:** Derived Orrery Gravity Visual Mass and Accessible Context — permits bounded derived Gravity body mass and companion context while partially superseding ADR-027's display restriction.
- **ADR-140:** Navigation-First Settings Directory and Canonical Sub-Routes — makes the Settings Orrery entry reuse the existing preference source and Systems manager.
- **ADR-143:** Lock-Time-Revalidated Atomic Category Deletion and System Fallout — removes only the deleted category's System state and routes active selection to All Contacts.
- **ADR-144:** Complete Category Selection and Grouped Orrery System Discovery — defines UID-backed Category rule selection and the constrained three-group System selector.

## Deferred seams and evidence limits

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
