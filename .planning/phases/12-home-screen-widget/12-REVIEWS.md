---
phase: 12
reviewers: [codex]
reviewed_at: 2026-08-17T05:52:02Z
plans_reviewed: [12-01-PLAN.md, 12-02-PLAN.md, 12-03-PLAN.md, 12-04-PLAN.md, 12-05-PLAN.md, 12-06-PLAN.md, 12-07-PLAN.md, 12-08-PLAN.md]
---

# Cross-AI Plan Review — Phase 12

## Codex Review

## Summary

The plan is well-researched and correctly reuses the strongest existing seams: dashboard projection, DAO-only recency writes, launch-sweep gating, and notification-style navigation. However, three gaps currently prevent it from fully achieving WDG-03 and the preferred responsive-widget design: no event-push publishers are planned, resize is neither configured nor rendered by size, and the native boot-receiver implementation is underspecified.

## 12-01 — Status palette / ContactCard

**Summary:** Sound, low-risk foundation work that upgrades an explicitly temporary implementation.

**Strengths**

- It correctly replaces the existing opacity-only ring at [ContactCard.tsx](/home/bwales/projects/orbit-app/src/components/ContactCard.tsx:102) while preserving the existing status label and test ID at [ContactCard.tsx](/home/bwales/projects/orbit-app/src/components/ContactCard.tsx:139).
- The palette extension matches the current token model: `rogue` is a flat palette field at [theme-types.ts](/home/bwales/projects/orbit-app/src/theme/theme-types.ts:66), and colour literals are already centralized in [theme-presets.ts](/home/bwales/projects/orbit-app/src/theme/theme-presets.ts:35).

**Concerns**

- **MEDIUM:** There is no ContactCard test today, and the proposed command masks test failures: `vitest … || tsc` succeeds if Vitest fails but TypeScript passes. `rg` finds theme tests but no ContactCard coverage.

**Suggestions**

- Add a pure `ringVisual(status, colors)` helper with unit coverage for colour, opacity, and width; update [theme-presets.test.ts](/home/bwales/projects/orbit-app/src/theme/theme-presets.test.ts:91) to assert the three new tokens.

**Risk assessment:** LOW after fixing the test command.

## 12-02 — Dependency and config plugin

**Summary:** The human legitimacy gate and tuple-aware plugin insertion are appropriate, but the configuration does not actually guarantee a resizable widget.

**Strengths**

- The plan correctly respects the existing name-based tuple handling in [app.config.ts](/home/bwales/projects/orbit-app/app.config.ts:57).
- The dependency is genuinely new; it is absent from [package.json](/home/bwales/projects/orbit-app/package.json:5), so the approval checkpoint is justified.

**Concerns**

- **HIGH:** The plan runs `npx expo install react-native-android-widget` without pinning `0.22.0`. A later release can change the API validated by the research.
- **HIGH:** `widgetConfig` has min dimensions but no `resizeMode`, `maxResizeWidth`, or `maxResizeHeight`. The library’s verified resize contract requires these manifest bounds, and resize events supply the dimensions needed to choose a layout ([platform-library.md](/home/bwales/projects/orbit-app/docs/dossier/workpapers/12-widget/platform-library.md:56)).

**Suggestions**

- Install the reviewed artifact explicitly: `npx expo install react-native-android-widget@0.22.0`.
- Define the resize bounds/mode in this plan, even if the exact breakpoint is tuned on Pixel later.

**Risk assessment:** HIGH until responsive configuration and version pinning are added.

## 12-03 — Thumbnail encoder and headless colours

**Summary:** The architecture is correct: square masters, base64-only output, and palette resolution without a provider.

**Strengths**

- The encoder properly builds on the chainable image API already used by [photo-pipeline.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-pipeline.ts:83).
- Resolving the stored path through [resolvePhotoUri](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:130) preserves the existing safe-relative-path boundary.
- The status source is consistent with the database’s derived bands at [status.ts](/home/bwales/projects/orbit-app/src/db/status.ts:67).

**Concerns**

- **MEDIUM:** The proposed test only mocks `expo-image-manipulator`; importing `resolvePhotoUri` also loads native `expo-file-system`. Existing tests explicitly mock that dependency, e.g. [photo-storage.test.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.test.ts:26).

**Suggestions**

- Mock `@/services/photos/photo-storage` in `widget-photo.test.ts`, not just the manipulator.
- Make thumbnail encode failures recoverable in the renderer, not fatal to the entire widget.

**Risk assessment:** LOW.

## 12-04 — Tile data and widget linking

**Summary:** The data shaping is strong, but the favourites deep link violates the stated Back-to-dashboard contract.

**Strengths**

- It correctly uses `listDashboard`, whose favourite branch preserves manual rank and includes never-contacted/snoozed favourites ([dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:166)).
- It preserves `status` rather than re-deriving it; the row type explicitly permits `null` for never-contacted contacts ([dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:73).
- A pure strict resolver mirrors the existing notification resolver pattern at [notification-nav.ts](/home/bwales/projects/orbit-app/src/services/notifications/notification-nav.ts:27).

**Concerns**

- **HIGH:** The plan says every accepted URI resets onto `[Home, target]`, but `orbit://favourites` returns `navigate("ManageFavourites")`. Under the existing `singleTask` concern, this can leave Back returning to an arbitrary prior route rather than Home. The notification implementation uses `reset` specifically to prevent that ([notification-gate.tsx](/home/bwales/projects/orbit-app/src/navigation/notification-gate.tsx:82).
- **LOW:** The resolver is typed `url: string` while its security contract promises to reject non-strings. Accept `unknown` if that guard is meant to be real and testable.

**Suggestions**

- Make the favourites result a reset: `[Home, ManageFavourites]`, index `1`.
- Add query/fragment, port, encoded-path, negative-ID, and oversized-ID cases to the resolver tests.

**Risk assessment:** MEDIUM; HIGH for the empty-widget navigation path until reset is fixed.

## 12-05 — Mark seam and RemoteViews tree

**Summary:** The DAO seam is excellent; the rendering plan lacks size selection and per-avatar fault isolation.

**Strengths**

- It uses the only correct write path: [recordTouchpoint](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:215) performs the interaction insert and recency recomputation in one transaction.
- New UIDs are appropriate: `interactions.uid` is unique ([001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:96)), so genuine repeated taps remain distinct.
- It correctly keeps widget status data on the existing dashboard projection rather than issuing a second status query.

**Concerns**

- **HIGH:** It creates small and large layouts but `renderFavourites()` accepts no `widgetInfo`/size argument. The verified library contract provides width/height on `WIDGET_RESIZED` specifically so the handler can choose a tree ([platform-library.md](/home/bwales/projects/orbit-app/docs/dossier/workpapers/12-widget/platform-library.md:56)). As planned, one layout will be dead or all sizes will render identically.
- **MEDIUM:** A single missing/corrupt photo makes `encodeWidgetThumb()` reject, which can fail the entire render instead of using initials. Existing photo code deliberately treats manipulation failure as a typed error ([photo-pipeline.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-pipeline.ts:45)).

**Suggestions**

- Pass a size bucket from the task handler to `renderFavourites`, and select both capacity and small/large layout there.
- Catch thumbnail failures per tile, log them, and render the themed initials fallback.

**Risk assessment:** HIGH until resize routing is implemented.

## 12-06 — Headless handler and refresh wrapper

**Summary:** The headless DB bootstrap and sweep isolation are correctly designed, but freshness is only a helper—not a wired feature.

**Strengths**

- The ordering `openAndMigrate()` before `getExecutor()` matches the current hard requirement: `getExecutor()` throws before open ([database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:120).
- The plan correctly avoids executing the sweep in headless code; importing the sweep module is inert by design ([launch-sweep.ts](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:10).
- The launch hook follows the current registry model ([launch-sweep.ts](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:45).

**Concerns**

- **HIGH:** Nothing calls `pushWidgetUpdate()` after ordinary foreground mutations. For example, manual logging only calls `load()` after `recordTouchpoint` ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:235)); favourite changes only call `load()` ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:285)); fuel mutations likewise only reload the screen ([ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:464)). This fails WDG-03’s event-push requirement.

**Suggestions**

- Add a dedicated freshness task/plan that defines all publishers: create/edit/archive/restore/purge, photo changes, favourite toggle/reorder, fuel mutations, foreground mark, capture, and widget mark.
- Prefer a centralized post-commit notification seam over manually remembering every screen call site; use fire-and-forget logging so a widget-render failure never rolls back a successful user write.

**Risk assessment:** HIGH until event publishers are planned and tested.

## 12-07 — App mounting and Settings CTA

**Summary:** Integration follows established gates, but it inherits the unresolved freshness and favourites-back-stack issues.

**Strengths**

- Mounting beside the existing gates is appropriate: the navigation container already uses a reactive `navReady` flag ([App.tsx](/home/bwales/projects/orbit-app/App.tsx:205)).
- Registering the sweep before `installSweepTrigger` is correct; current hooks are registered in exactly that order ([App.tsx](/home/bwales/projects/orbit-app/App.tsx:115)).
- The Settings screen already has themed row conventions and error logging to reuse ([SettingsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:70)).

**Concerns**

- **MEDIUM:** The plan has only static checks for the CTA and gate mount. It does not test a rejected `requestPinWidget`, initial URI delivery, or the queued pre-ready navigation path.
- **MEDIUM:** It depends on 12-04’s `navigate` result for favourites, so the empty widget can still break the Back-to-dashboard promise.

**Suggestions**

- Add focused tests for the pure CTA result handler and the resolver’s reset intent.
- Add a JS-level smoke test or explicit UAT script for cold-start `orbit://` delivery.

**Risk assessment:** MEDIUM.

## 12-08 — Native boot path and device UAT

**Summary:** Correctly reserves device-only claims for Pixel UAT, but the native receiver is not specified enough to implement safely.

**Strengths**

- Manifest hardening checks are essential because [app.config.ts](/home/bwales/projects/orbit-app/app.config.ts:23) currently sets `allowBackup: false`.
- The plan correctly treats the killed-app path as device-only; Phase 11 likewise records it as unverified on-device ([11-VERIFICATION.md](/home/bwales/projects/orbit-app/.planning/phases/11-actionable-notifications/11-VERIFICATION.md:15).

**Concerns**

- **HIGH:** A JavaScript Expo config plugin can modify the manifest, but it cannot itself be an Android `BroadcastReceiver`. The plan must explicitly generate or add a Kotlin/Java receiver class, register it, and ensure `RECEIVE_BOOT_COMPLETED` is present. Neither exists in the current repository.
- **MEDIUM:** The UAT conflates device boot with force-stop recovery. Android 15 disables widget PendingIntents on force-stop and re-enables widgets only after the user launches the app; `BOOT_COMPLETED` then gives the app a chance to re-register work. Test cold boot and force-stop→manual-launch as separate cases. [Android’s Android-15 behavior documentation](https://developer.android.com/about/versions/15/behavior-changes-all) confirms this distinction.
- **MEDIUM:** The plan should verify the custom receiver does not duplicate a receiver already installed by the widget library before adding another manifest entry.

**Suggestions**

- Resolve the native mechanism in 12-02/12-08 Task 1 with a prebuild assertion: receiver class, action filter, exported/enabled flags, permission, and invocation of `RNWidgetJsCommunication.requestWidgetUpdate`.
- Make the Pixel gate record two separate results: reboot receiver refresh; force-stop gray state followed by manual-launch re-arm.

**Risk assessment:** HIGH until the receiver implementation is concrete.

## Overall risk assessment: HIGH

The phase has a strong reuse strategy and a good device-validation posture, but it is not yet complete enough to guarantee the three core promises: responsive small/large layouts, event-driven freshness, and reliable native recovery. Fix the five HIGH findings before execution; the remaining work is then a manageable device-integration risk.

---

## Consensus Summary

Only one external reviewer (Codex) was invoked for this cycle; a separate Claude reviewer runs elsewhere in the convergence loop. Codex's verdict is source-grounded (166K tokens, file:line citations traced against the live working tree). Its plan-level consensus stands on its own until the Claude review is folded in.

**Overall risk: HIGH.** The phase has a strong reuse strategy (dashboard projection, DAO-only recency writes, launch-sweep gating, notification-style navigation) and a sound device-validation posture, but three core promises are not yet guaranteed by the plans as written: responsive small/large layouts, event-driven freshness (WDG-03), and reliable native boot/force-stop recovery.

### Agreed Strengths
- Correct reuse of the strongest existing seams: `listDashboard` projection, `recordTouchpoint` single-transaction write path, launch-sweep import isolation, and the notification `reset`-navigation pattern.
- `openAndMigrate()`-before-`getExecutor()` ordering in the headless handler matches the current hard requirement in `database.ts`.
- Device-only claims (killed-app / boot) correctly reserved for on-device Pixel UAT, consistent with Phase 11.

### Agreed Concerns (HIGH — fix before execution)
1. **12-02** — `react-native-android-widget` installed without pinning `0.22.0`; a later release can break the researched API contract.
2. **12-02** — `widgetConfig` declares min dimensions but no `resizeMode` / `maxResizeWidth` / `maxResizeHeight`; the library's resize contract needs these manifest bounds for a resizable widget.
3. **12-04** — `orbit://favourites` returns `navigate("ManageFavourites")` instead of a `reset` onto `[Home, ManageFavourites]`, violating the stated Back-to-dashboard contract under `singleTask`.
4. **12-05** — `renderFavourites()` takes no `widgetInfo`/size argument, so small vs large layouts cannot be selected; one layout ends up dead or all sizes render identically.
5. **12-06** — No `pushWidgetUpdate()` publishers are wired after foreground mutations (manual log, favourite toggle, fuel edits all only call `load()`); this fails WDG-03's event-push requirement.
6. **12-08** — A JS Expo config plugin cannot itself be an Android `BroadcastReceiver`; the plan must generate/register a concrete Kotlin/Java receiver with `RECEIVE_BOOT_COMPLETED`. Neither exists in the repo.

### Divergent Views
None — single reviewer this cycle.

---

## Claude Review (independent in-session subagent — cycle 1)

**Reviewer:** Claude (read-only in-session subagent, second independent perspective; codex is the CLI reviewer above)
**Verdict:** 0 HIGH, 7 actionable non-HIGH. All ~25 cited `file:line`/behavior claims verified TRUE against source on disk — zero hallucinated references. Hard invariants all correctly planned (single-writer mark, no-sweep-in-headless, base64-only, no schema, token-only render, native-dep behind blocking-human checkpoint, manifest hardening). Owner-approved status hexes used (not the declined `#F07A3D`). No DECIDED/REJECTED reversals.

### Concerns

**MEDIUM**
- **M1 — Plan 01 Task 3 verify masks test failures.** `npm run check:colors && npx tsc --noEmit && npx vitest run src/components 2>/dev/null || npx tsc --noEmit` parses as `((A && B && C) || D)` — if the vitest run (C) fails, `D=tsc` runs and the whole command exits 0. A ContactCard test broken by retiring the OD-1 opacity encoding would pass the gate. **Fix:** `npm run check:colors && npx tsc --noEmit && npx vitest run src/components` (no `|| tsc` fallback, no `2>/dev/null`).
- **M2 — One bad photo blanks the entire grid.** Plan 03 `encodeWidgetThumb` throws (PhotoPipelineError convention) on decode failure; Plan 05 render calls it per tile with NO per-tile catch → an evicted/corrupt master rejects `renderFavourites` and the whole grid fails instead of falling back to the initials swatch. **Fix:** `encodeWidgetThumb` returns `null` on decode failure (or Plan 05 wraps each encode in try/catch → initials).
- **M3 — `pushWidgetUpdate` is an unguarded launch-sweep hook.** `runLaunchSweep` (launch-sweep.ts:82) awaits hooks with NO per-hook isolation — a rejecting hook rejects the fire-and-forget sweep (unhandled rejection; may skip later hooks). **Fix:** wrap `pushWidgetUpdate` body in try/catch + `Logger.error` so it always resolves (matches notification-actions/headless-task guard discipline).
- **M4 — WIDGET_CLICK double-delivery backstop deferred but not gated.** Plan 05 uses `newUid()` (distinct rows, LOG-06) on assumption A1 (OS delivers click once); 12-08 Task 3 asserts "exactly one row" but nothing REQUIRES the deterministic-uid backstop if the spike shows >1. **Fix:** 12-08 Task 3 — make the deterministic-uid backstop a required, gated follow-up if the killed-app UAT yields >1 interactions row.
- **M5 — "Log contact" → Profile is a silent product decision (OWNER'S BUCKET).** WDG-02 lists the larger tile's "Log contact"; Plan 05 maps Log (✎) → `orbit://contact/{id}` → the read-only Profile screen because no Log route exists (A2). RESEARCH Open Q1 flagged this "→ Profile recommended; confirm with owner." A button labeled "Log" that opens Profile (not a logging flow) is a UX call. **Fix:** surface as an owner decision/checkpoint, or record in Plan 05 as an explicitly accepted owner decision with rationale — not an implicit planner call.

**LOW**
- **L1 — `WIDGET_ADDED`/`WIDGET_DELETED` enum values unverified** against the installed library (RESEARCH only verified WIDGET_CLICK/UPDATE/RESIZED). Likely correct; confirm against `node_modules/react-native-android-widget` during 12-06 execution.
- **L2 — Boot-receiver class `RNWidgetJsCommunication#requestWidgetUpdate` + 30s budget are inherited (dossier workpaper), unverified this session.** Plan 08 already hedges; just verify the exact class against `node_modules` at prebuild.
- **L3 (optional hygiene, not counted) — headless handler transitively imports `launch-sweep`.** Safe (launch-sweep has zero module-scope side effects, :10-14; handler never calls runLaunchSweep), but Plan 06's grep checks only the handler file, not the transitive graph. Optional: split `pushWidgetUpdate` from `registerWidgetSweep`, or note the invariant rests on launch-sweep import-purity.

### Current HIGH Concerns
None.

### Current Actionable Non-HIGH Concerns
- M1: Plan 01 — drop the `|| tsc` fallback + `2>/dev/null` so a broken ContactCard test fails the task.
- M2: Plan 03/05 — graceful per-tile photo fallback (encode returns null / render catches → initials).
- M3: Plan 06 — wrap `pushWidgetUpdate` in try/catch so a render failure can't reject the launch-sweep hook.
- M4: Plan 08 — deterministic-uid backstop required if killed-app UAT yields >1 interactions row.
- M5: Plan 05 — surface Log→Profile (owner's bucket) as an owner decision/checkpoint or record accepted rationale.
- L1: Plan 06 — confirm `WIDGET_ADDED`/`WIDGET_DELETED` enum values against the installed library.
- L2: Plan 08 — verify `RNWidgetJsCommunication#requestWidgetUpdate` against `node_modules` at prebuild.
