---
phase: 12
reviewers: [codex]
reviewed_at: 2026-08-17T06:45:49Z
plans_reviewed: [12-01-PLAN.md, 12-02-PLAN.md, 12-03-PLAN.md, 12-04-PLAN.md, 12-05-PLAN.md, 12-06-PLAN.md, 12-07-PLAN.md, 12-08-PLAN.md]
review_cycle: 2
---

# Cross-AI Plan Review — Phase 12 (Home Screen Widget)

Cycle-2 review of the revised plans (commit cca05d9). Codex re-reviewed all 8 revised
PLAN.md files independently, source-grounded against the live working tree.

## Codex Review

## Summary

The plan is well researched and correctly reuses the right primitives: the favourites dashboard projection, the single-writer touchpoint DAO, the existing navigation-reset model, and the launch-sweep registry. The main release blocker is WDG-03 freshness: Plan 12-07 misses several real widget-visible writes, and its reorder hook is placed after a `load()` that only runs on failure. Fix that coverage before execution; otherwise the widget will visibly stale after normal edits.

## Plan-by-plan review

### 12-01 — Palette and ContactCard

**Strengths**

- Correctly replaces the current opacity-only status signal: the card currently uses `textSecondary` except for rogue and differentiates stable/wobble/decay only by opacity. [`ContactCard.tsx:102`](</home/bwales/projects/orbit-app/src/components/ContactCard.tsx:102>)
- The proposed tokens belong on the flat `ThemePalette`, alongside the existing `rogue` token. [`theme-types.ts:29`](</home/bwales/projects/orbit-app/src/theme/theme-types.ts:29>) [`theme-types.ts:66`](</home/bwales/projects/orbit-app/src/theme/theme-types.ts:66>)

**Concerns**

- **MEDIUM:** The specified helper type is invalid: `ThemePalette["colors"]`. `ThemePalette` is itself the colour object; only `ResolvedTheme` has `.colors`. This would fail typecheck if implemented literally. [`theme-types.ts:29`](</home/bwales/projects/orbit-app/src/theme/theme-types.ts:29>) [`theme-provider.tsx:33`](</home/bwales/projects/orbit-app/src/theme/theme-provider.tsx:33>)

**Suggestion**

- Specify `colors: ThemePalette` (or `ResolvedTheme["colors"]`), and import it type-only.

### 12-02 — Native dependency/config

**Strengths**

- The human install checkpoint is appropriate.
- It correctly follows the existing plugin-name dedupe pattern rather than appending a duplicate bare-string plugin. [`app.config.ts:57`](</home/bwales/projects/orbit-app/app.config.ts:57>)

**Concerns**

- **LOW:** The package is not currently installed, so its config-property names cannot be verified from this checkout; `package.json` has no widget dependency. [`package.json:5`](</home/bwales/projects/orbit-app/package.json:5>)

**Suggestion**

- Keep the existing “inspect installed types before writing config” step, and add a post-install assertion that the plugin export itself is resolvable before downstream plans begin.

### 12-03 — Thumbnail and headless colours

**Strengths**

- Reuses the correct photo storage boundary: persisted photos are relative paths resolved to `file://` only locally. [`photo-storage.ts:125`](</home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:125>)
- The chosen manipulator API is the same chainable API used by the shipped photo pipeline. [`photo-pipeline.ts:83`](</home/bwales/projects/orbit-app/src/services/photos/photo-pipeline.ts:83>)

**Concerns**

- **MEDIUM:** `saveAsync({ base64: true })` is typed as returning `base64?: string`; the plan assumes it is always present. A malformed native result would produce a `data:image/jpeg;base64,undefined` URI rather than the intended initials fallback. [`ImageManipulator.types.d.ts:18`](</home/bwales/projects/orbit-app/node_modules/expo-image-manipulator/build/ImageManipulator.types.d.ts:18>)

**Suggestion**

- Guard `typeof result.base64 === "string" && result.base64.length > 0`; log and return `null` otherwise. Add that case to `widget-photo.test.ts`.

### 12-04 — Tile shaping and deep links

**Strengths**

- Correctly selects `listDashboard({ filter: "favourites" })`, whose favourites branch includes archived filtering, status/fuel projection, and static `favourite_rank` ordering. [`dashboard-read.ts:226`](</home/bwales/projects/orbit-app/src/db/dashboard-read.ts:226>)
- The reset-based navigation aligns with the established notification pattern. [`notification-nav.ts:49`](</home/bwales/projects/orbit-app/src/services/notifications/notification-nav.ts:49>)

**Concerns**

- **MEDIUM:** “A sane bound” for contact IDs is unspecified. Without an explicit constant and tests at `max`/`max + 1`, the strict-parser claim is not reproducible.
- **LOW:** The default grid-capacity constant and size-bucket capacities risk becoming two competing tuning sources.

**Suggestion**

- Define `MAX_WIDGET_CONTACT_ID = Number.MAX_SAFE_INTEGER` (or a documented tighter product bound) and test it.
- Make `pickLayout()` the sole owner of capacity, or have it consume a named capacity map from `widget-data.ts`.

### 12-05 — Mark seam and render tree

**Strengths**

- The mark seam correctly delegates to `recordTouchpoint`, which writes the interaction and recomputes `last_contact` inside the shared transaction path. [`recency-dao.ts:215`](</home/bwales/projects/orbit-app/src/db/recency-dao.ts:215>)
- New UUIDs are appropriate for genuine repeated taps; `newUid()` is explicitly designed to produce a fresh UUID per call. [`uid.ts:14`](</home/bwales/projects/orbit-app/src/db/uid.ts:14>)
- Per-tile image fallback is a sound containment boundary.

**Concerns**

- **HIGH:** The plan treats the 30-second mark budget as “one SQLite write,” but the handler then re-renders every placed widget and re-encodes thumbnails. The library evidence says the handler has a hard 30-second budget and that each render is an off-screen bitmap operation. [`platform-library.md:72`](</home/bwales/projects/orbit-app/docs/dossier/workpapers/12-widget/platform-library.md:72>) [`platform-library.md:121`](</home/bwales/projects/orbit-app/docs/dossier/workpapers/12-widget/platform-library.md:121>)
- **MEDIUM:** The physical UAT covers favourite capacity but not multiple simultaneously placed widget instances, which is the multiplier for this render cost.

**Suggestion**

- Add a headless timing budget: render the tapped widget directly with the supplied `renderWidget`, then make any all-instance refresh best-effort/coalesced.
- Add a device UAT with two placed widget instances and photo-bearing favourites; record elapsed tap-to-update time.

### 12-06 — Handler and refresh wrapper

**Strengths**

- Correctly recognizes that a failing sweep hook would abort the unisolated hook loop. [`launch-sweep.ts:71`](</home/bwales/projects/orbit-app/src/services/launch-sweep.ts:71>)
- `openAndMigrate()` must precede `getExecutor()` in headless code; the latter throws before initialization. [`database.ts:95`](</home/bwales/projects/orbit-app/src/db/database.ts:95>) [`database.ts:136`](</home/bwales/projects/orbit-app/src/db/database.ts:136>)

**Concerns**

- **MEDIUM:** `Number.isInteger(contactId)` alone accepts negative and unsafe integer IDs. The URI plan is stricter, but the widget-click path should enforce the same positive/safe-ID boundary before opening SQLite.
- **MEDIUM:** `notifyWidgetDataChanged()` has no coalescing. Rapid reorder/fuel actions can queue expensive global renders and allow an older render to land after a newer write.

**Suggestion**

- Require `Number.isSafeInteger(id) && id > 0`.
- Implement a single-flight refresh with one pending rerun, matching the launch-sweep’s established re-entrancy approach. [`launch-sweep.ts:49`](</home/bwales/projects/orbit-app/src/services/launch-sweep.ts:49>)

### 12-07 — App wiring and event freshness

**Strengths**

- Mounting the widget gate under the existing `navReady` state is consistent with both current gates. [`App.tsx:205`](</home/bwales/projects/orbit-app/App.tsx:205>)
- Registering the sweep before `installSweepTrigger()` is necessary because the trigger starts the cold-start sweep immediately. [`App.tsx:120`](</home/bwales/projects/orbit-app/App.tsx:120>) [`launch-sweep.ts:102`](</home/bwales/projects/orbit-app/src/services/launch-sweep.ts:102>)

**Concerns**

- **HIGH:** The planned successful reorder refresh is wired to the wrong location. `ManageFavouritesScreen.persist()` calls `rewriteFavouriteRanks()` on success, but `await load()` at line 152 is inside the `catch`; there is no success-side reload/publisher point. [`ManageFavouritesScreen.tsx:140`](</home/bwales/projects/orbit-app/src/screens/ManageFavouritesScreen.tsx:140>)
- **HIGH:** The listed mutation coverage is incomplete for widget-visible fields:
  - Editing or confirming fuel changes the ranked widget line but is omitted. [`ContactProfileScreen.tsx:497`](</home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:497>) [`ContactProfileScreen.tsx:520`](</home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:520>)
  - Editing/deleting a touchpoint changes status and `last_contact` but is omitted. [`ContactProfileScreen.tsx:392`](</home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:392>) [`ContactProfileScreen.tsx:420`](</home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:420>)
  - Contact edits can change name, interval, rarely-responds, and photo-related state, but the save flow has no planned publisher. [`EditContactScreen.tsx:320`](</home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:320>)
  - Photo set/clear updates `contacts.photo`, yet the photo path only refreshes its local UI. [`CropPhotoScreen.tsx:267`](</home/bwales/projects/orbit-app/src/screens/CropPhotoScreen.tsx:267>) [`PhotoSourcePicker.tsx:156`](</home/bwales/projects/orbit-app/src/components/PhotoSourcePicker.tsx:156>)
  - Archive/restore changes whether a favourite belongs in the widget, but neither is covered. [`contacts-dao.ts:420`](</home/bwales/projects/orbit-app/src/db/contacts-dao.ts:420>) [`ArchivedContactsScreen.tsx:110`](</home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:110>)
  - Share capture can add or edit fuel for a favourite and is also omitted. [`CaptureScreen.tsx:251`](</home/bwales/projects/orbit-app/src/screens/CaptureScreen.tsx:251>) [`CaptureScreen.tsx:410`](</home/bwales/projects/orbit-app/src/screens/CaptureScreen.tsx:410>)

**Suggestion**

- Move the reorder publisher immediately after successful `rewriteFavouriteRanks()`.
- Expand the plan’s mutation inventory and wire post-commit notifications for every widget-projected change: contact metadata/photo/archive/restore, all touchpoint changes, all fuel changes including capture, favourite changes, and rank reorder.
- Add focused tests or a checklist that proves each listed mutation causes exactly one coalesced widget refresh.

### 12-08 — Boot receiver and device UAT

**Strengths**

- It correctly treats native generation as necessary; a JS config plugin can generate a receiver but cannot itself receive Android broadcasts.
- Manifest-hardening checks protect the existing `allowBackup: false` configuration. [`app.config.ts:31`](</home/bwales/projects/orbit-app/app.config.ts:31>)
- The split between reboot recovery and force-stop/manual-launch recovery is well scoped.

**Concerns**

- **MEDIUM:** The proposed custom receiver is `exported="true"` and its described `onReceive` invokes the update unconditionally. That unnecessarily permits explicit third-party broadcasts to wake/render the app. The library’s own widget receiver was verified as non-exported. [`platform-onetap-write.md:269`](</home/bwales/projects/orbit-app/docs/dossier/workpapers/04-log/platform-onetap-write.md:269>)
- **LOW:** The local verification only checks that the plugin file exists; it does not load the plugin or validate its generated manifest/source until the desktop prebuild.

**Suggestion**

- Generate the boot receiver as `android:exported="false"` and guard `onReceive` with an exact `BOOT_COMPLETED` action check.
- Add a local Node smoke test that imports the config plugin and validates its manifest transform before the remote build.

## Risk assessment

**HIGH until Plan 12-07 is corrected.** The architecture and device-validation strategy are strong, but the currently planned event-push wiring does not meet the decided “open, edit, favourite change, mark-contacted” freshness model and has a concrete success-path error for reorder. After expanding mutation coverage, coalescing refreshes, fixing the `ThemePalette` type, and bounding the headless render cost, the remaining risk is appropriately device-gated rather than structural.

---

## Consensus Summary

Single external reviewer this cycle (Codex, source-grounded). Overall verdict: the
architecture is sound and reuses the correct existing primitives, but the phase is
**HIGH risk until Plan 12-07 is corrected** — the event-freshness wiring does not yet
deliver the decided freshness model.

### Agreed Strengths
- Correct reuse of shipped primitives: favourites dashboard projection (`dashboard-read.ts:226`), single-writer touchpoint DAO (`recency-dao.ts:215`), navigation-reset pattern (`notification-nav.ts:49`), and the launch-sweep registry.
- Headless DB ordering (`openAndMigrate()` before `getExecutor()`) and sweep-registration ordering are correct.

### Agreed Concerns (highest priority)
- **12-07 (HIGH):** Reorder refresh is wired into the failure-only `catch` path — no success-side publisher after `rewriteFavouriteRanks()`.
- **12-07 (HIGH):** Mutation coverage is incomplete — fuel edits, touchpoint edit/delete, contact edits, photo set/clear, archive/restore, and share-capture fuel all mutate widget-visible fields but publish no refresh.
- **12-05 (HIGH):** The 30-second headless budget is treated as a single SQLite write, ignoring the per-instance off-screen bitmap render + thumbnail re-encode cost.

### Divergent Views
- None (single reviewer).


---

## Cycle 2 Reviews (CLEAN)

> Codex re-run WITHOUT `--dangerously-bypass-hook-trust` (exit 0, source-grounded), run manually to avoid the safety-classifier block the flag triggers. Supersedes the earlier codex section committed at 552fa0a. Claude reviewer ran as an independent in-session subagent.

### Codex Review — cycle 2 (clean)

## Summary

Not approval-ready. The revisions correctly preserve the mutexed single-writer mark path and separate the foreground sweep from headless work, but two blockers remain: WDG-03 event freshness is still incomplete, and the required exactly-once device UAT cannot run with the planned release APK.

## Strengths

- The widget mark correctly delegates to `recordTouchpoint`; that function enters the shared transaction/mutex and recomputes recency, so no raw `last_contact` write or nested transaction is needed. [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:215), [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:45), [mutex.ts](/home/bwales/projects/orbit-app/src/db/mutex.ts:32)
- The headless-sweep constraint is sound: importing the sweep registry has no side effect, and the plan’s handler does not call the runner. [launch-sweep.ts](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:10)
- Reusing `listDashboard(...favourites...)` preserves manual rank and the existing derived status/fuel projection. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:201), [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:228)
- The revised URI design correctly uses reset intents for every accepted target, which is the right mechanism for Back → dashboard.

## Concerns

- **HIGH — WDG-03 freshness remains materially incomplete.** The plan explicitly limits publishers to five mutations and says photo/archive/edit can be added “later,” which conflicts with the requirement that *all* widget-visible mutation sites push refreshes. [12-07-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-07-PLAN.md:101) The widget projection visibly depends on `name`, `photo`, `fuelText`, status, and being unarchived. [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:201), [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:228) Missing immediate publishers include contact metadata/first-contact edits ([EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:324)), photo set/clear ([CropPhotoScreen.tsx](/home/bwales/projects/orbit-app/src/screens/CropPhotoScreen.tsx:276), [PhotoSourcePicker.tsx](/home/bwales/projects/orbit-app/src/components/PhotoSourcePicker.tsx:167)), archive/restore ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:267), [ArchivedContactsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:110)), touchpoint edit/delete ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:394), [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:433)), fuel edit/confirm/capture ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:500), [CaptureScreen.tsx](/home/bwales/projects/orbit-app/src/screens/CaptureScreen.tsx:272)), and notification-originated marks ([notification-actions.ts](/home/bwales/projects/orbit-app/src/services/notifications/notification-actions.ts:129)). Also, the plan’s proposed reorder insertion point does not exist on success: `load()` is called only in the failure catch. [ManageFavouritesScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ManageFavouritesScreen.tsx:140) Add an exhaustive mutation inventory and publish after every successful commit; move reorder publishing immediately after `rewriteFavouriteRanks`, not after the catch-only reload.

- **HIGH — the required killed-app exactly-once check is impossible using the plan’s declared build.** Plan 12-08 builds `assembleRelease` then requires `run-as … sqlite3` to count rows. [12-08-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-08-PLAN.md:81), [12-08-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-08-PLAN.md:94) The project runbook explicitly says the release APK is not `run-as`-debuggable and DB inspection requires an `assembleDebug` + Metro build. [desktop-build-pipeline.md](/home/bwales/projects/orbit-app/docs/runbooks/desktop-build-pipeline.md:193) Consequently, the M4 double-write gate and deferred Phase-11 proof cannot be closed as written. Split the UAT: use release for standalone/widget-host proof and a debuggable build for row-count/recency inspection, or provide an equally trustworthy debug-only in-app assertion surface.

- **MEDIUM — the base64 encoder must reject a missing payload, not stringify it.** `ImageResult.base64` is optional even when requested. [ImageManipulator.types.d.ts](/home/bwales/projects/orbit-app/node_modules/expo-image-manipulator/build/ImageManipulator.types.d.ts:19) The planned interpolation can produce `data:image/jpeg;base64,undefined`, which meets neither a usable-avatar nor fallback guarantee. [12-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-03-PLAN.md:75) Require a non-empty string check, log, and return `null`; test that branch.

- **MEDIUM — “Log” remains an unresolved product decision while downstream plans hard-code Profile.** The plan acknowledges that a control labelled Log opens a read-only Profile, pending owner ratification. [12-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-05-PLAN.md:100) There is no `Log` route in the current navigation contract ([types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:20)), while the actual log operation is a profile-side write. [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:235) Make this a blocking owner decision before executing the autonomous URI/render plans; otherwise the delivered action may not satisfy “Log contact.”

- **MEDIUM — the 30-second headless budget is asserted but not verified against the real click path.** A click awaits `pushWidgetUpdate` after the write ([12-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-06-PLAN.md:82)); rendering opens SQLite and serially encodes tile images. [12-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-05-PLAN.md:86) The device checklist records capacity and row count but no cold-start/worst-capacity elapsed time. [12-08-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/12-home-screen-widget/12-08-PLAN.md:93) Add timing instrumentation/UAT acceptance below 30 seconds and make refresh failure/timeouts non-fatal to the already-committed mark.

## Risk Assessment

The data-write architecture is solid, and the no-sweep/base64-only/theme-token direction is sound. The primary risk is stale or incorrect widget content after normal app mutations; the secondary risk is falsely closing the most important headless-write invariant without a viable inspection build. Address the two HIGH items before execution.

HIGH=2 ACTIONABLE_NONHIGH=3


### Claude Review — cycle 2 (summary)

**0 HIGH, 1 actionable.** Confirmed all six cycle-1 HIGH fixes genuinely sound (source-grounded). One catch: 12-07 wires the reorder refresh at `ManageFavouritesScreen.tsx:152`, which is inside the **catch/error path** — the success path (`rewriteFavouriteRanks` :143-147) has no publisher, so a *successful* reorder never refreshes the widget. (Subsumed by codex cycle-2 HIGH #1.) Two LOW nits (stale line-ref in 12-01 note; requestPinWidget boolean coercion) — non-actionable.
