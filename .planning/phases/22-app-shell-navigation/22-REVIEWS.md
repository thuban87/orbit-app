---
phase: 22
reviewers: [codex, cursor, claude]
reviewed_at: 2026-09-02T19:19:55Z
convergence_cycle: 4
plans_reviewed: [22-01-PLAN.md, 22-02-PLAN.md, 22-03-PLAN.md, 22-04-PLAN.md, 22-05-PLAN.md, 22-06-PLAN.md]
models:
  codex: "gpt-5-codex (reasoning=high)"
  cursor: "unknown"
  claude: "claude-opus-4-8 (read-only subagent)"
model_sources:
  codex: "invocation"
  cursor: "unknown"
  claude: "orchestrator"
---

# Cross-AI Plan Review — Phase 22 (App Shell & Navigation) — Convergence Cycle 4

Three independent lanes reviewed the CURRENT six plans on disk against the actual codebase and (for the decisive question) the installed React Navigation v7 source in `node_modules`: **codex** (external CLI, high reasoning), **cursor** (external CLI, ask/read-only mode), and **claude** (read-only subagent — the built-in `claude -p` self-skips inside Claude Code and hits the Write-permission gap). The orchestrator additionally ran a grep-authority source-grounding pass and the advisory drift-guard pass (both recorded below).

## Consensus Summary

The cycle-3 fixes and the cycle-4 hardening are **genuinely present and correct** in the current plans, each re-verifiable against code on disk. All three lanes independently confirmed: (a) CropPhoto tri-registered in SettingsStack closes the N20 PhotoSourcePicker→CropPhoto cross-tab crash (`PhotoSourcePicker.tsx:143/:213`, `SettingsScreen.tsx:1351`); (b) the measured `tab-bar-layout-store` + `useMeasuredTabBarHeight()` correctly replaces the context-bound `useBottomTabBarHeight()` for the shell-sibling FAB (premise verified at `App.tsx:309-338`); (c) Plan 03 Task 1's reset-inclusive, services-inclusive exhaustive re-audit structurally closes the cross-tab crash class; and (d) the SHELL-03 child-Back deferral's full-screen-scrim safety argument is TRUE on disk (`add-speed-dial-fab-logic.ts:23`, `AddSpeedDialFab.tsx:75/:133`). The crash-site inventory (N10 `MergeImpactSummary.tsx:17`, N18/N19 `ImportReviewScreen.tsx:215/:289`, N8/N9/C1 `ImportCompleteScreen.tsx`) matches disk exactly. The `interactions` writer audit is correct: the three sanctioned writers (single-writer `recency-dao.ts`, bulk `restore-apply.ts:170`, delete `purge-dao.ts:78`) are the only production writers and Quick Log adds none.

**Decisive divergence, adjudicated on disk.** codex (2× HIGH) and cursor (1× MEDIUM) judged the component-level `navigation.reset(resetToDashboardRoot())` sites (A1 Compose `22-01:320`; C1/C2 `22-03:146`) to be a level-mismatch crash — a root-tab reset dispatched through a child stack that has no `DashboardTab` route. claude traced React Navigation v7 in `node_modules` and concluded it is **SAFE via RESET action bubbling**. The orchestrator independently verified the installed source and confirms **claude is correct, codex/cursor are refuted**: a screen's `navigation.dispatch` attaches only `source: route.key`, never `target` (`useNavigationCache.js:83-85`); `BaseRouter` RESET returns `null` for foreign route names (`BaseRouter.js:31`); an un-targeted null-result action bubbles to the parent (`useOnAction.js:56,93-96`), where the Tab navigator (whose routeNames include `DashboardTab`) handles it. Likewise codex's Discard `beforeRemove` re-trigger HIGH is **refuted on disk**: `e.data.action` carries a `VISITED_ROUTE_KEYS` set (`useOnPreventRemove.js`), so re-dispatching it — the exact pattern the plan specifies ("dispatches the pending remove action") — skips re-emitting `beforeRemove` for the already-visited screen. **Net: no unresolved HIGH.** No lane found a decision reversal; the two owner-flagged deferrals (ADR-075 full route retirement; photo "stage until Save") remain correctly flagged and are not re-counted.

### Agreed Strengths
- N20 CropPhoto tri-registration fix is correct and complete (codex, cursor, claude — verified `PhotoSourcePicker.tsx:143/:213`, `CropPhotoScreen.tsx:277/:285/:296`).
- Measured tab-bar-height store rests on a true sibling-mount premise (codex, cursor, claude — `App.tsx:309-338`).
- Exhaustive `reset(`-inclusive, `src/services`-inclusive re-audit is an executable procedure, not a restated completeness claim (codex, cursor, claude — `22-03:110-115`).
- Commit-truthful Quick Log reuses the canonical `recordTouchpoint`/`deleteTouchpoint` writers; ADR-075-compliant picker ordering (membership band, never `favourite_rank ASC`) (codex, cursor, claude — `recency-dao.ts:217/:313`, `22-06:110-120`).
- SHELL-03 child-Back scrim deferral verified safe on disk; not a reversal (codex, cursor, claude).

### Agreed Concerns
- The A1/C1/C2 component-level resets, while SAFE at runtime via bubbling, are **counter-intuitive**: two of three lanes read them as crashes, and Plan 03 Task 1 Step 4's literal audit rule ("call-site stack × target route not registered = crash") would itself re-flag them. The plans need an explicit bubbling-exemption + rationale so the mandated audit and future maintainers do not "fix" a correct site or stall (claude actionable; preempts codex/cursor).

### Divergent Views
- **Reset dispatch (A1/C1/C2):** codex HIGH ("dispatches root reset to the wrong navigator") + cursor MEDIUM ("should use navigationRef like N10") vs claude RESOLVED/SAFE (bubbling). **Orchestrator ruling: claude correct, verified in `node_modules`.** Not a defect; the residual is a plan-clarity/audit-exemption item (see actionable list).
- **Discard `beforeRemove` loop:** codex HIGH vs claude (implicitly safe). **Orchestrator ruling: refuted on disk** via `VISITED_ROUTE_KEYS`; the plan already specifies the safe `e.data.action` dispatch.


## Codex Review

# Phase 22 convergence review — cycle 4

Overall: the cycle-3 fixes are correctly represented in the plans, but three HIGH execution blockers remain. Two are nested-reset dispatch errors: a root-tab reset is being sent through child-stack navigation objects. The third is the Discard action re-triggering its own `beforeRemove` guard. No new decision reversal was found.

## 22-01 — Tab shell and external resets

Summary: Strong route-partitioning work, including the CropPhoto fix, but Compose Back cannot use a child-stack `navigation.reset()` to reset the root tab navigator.

Strengths

- **RESOLVED — CropPhoto cross-tab crash.** The plan explicitly registers `CropPhoto` in `SettingsStack` alongside Dashboard/Orrery (`22-01-PLAN.md:220`). This matches the actual unsafe mount: `SettingsScreen` renders `PhotoSourcePicker` at `src/screens/SettingsScreen.tsx:1351`, and that component invokes `navigation.navigate("CropPhoto")` at `src/components/PhotoSourcePicker.tsx:143` and `:213`.

- **RESOLVED — external resets have a single shape owner.** `resetToDashboardRoot` / `resetToDashboardWith` are specified centrally (`22-01-PLAN.md:316`), while widget resolver shapes remain flat until dispatch (`22-01-PLAN.md:323`). That preserves the current widget gate’s reads of `pending.routes[1]` at `src/navigation/widget-linking.ts:260`.

- **RESOLVED — migration gate remains ahead of navigation.** The plan preserves `NavigationContainer` in the DB-ready branch; current code confirms the gate contains the navigator and its gates at `App.tsx:298-338`.

Concerns

- **HIGH — NEW: Compose Back dispatches a root reset to the wrong navigator.** Plan 01 directs `ComposeScreen` to call `navigation.reset(resetToDashboardRoot())` (`22-01-PLAN.md:320`). But `ComposeScreen` receives a screen/stack navigation prop and currently calls its local `navigation.reset(...)` at `src/screens/ComposeScreen.tsx:266-268`. After the split, that navigator is `DashboardStack` or `OrreryStack`, where `DashboardTab` is not a route. The nested state is correct only when dispatched through `navigationRef.current.reset(...)`, as the widget path already does at `src/navigation/widget-linking.ts:274` and `:287`.

Suggestions

- Change Compose Back to `navigationRef.current?.reset(resetToDashboardRoot())`; test the actual dispatch path, not only the pure reset-builder shape.

Risk: **HIGH** until the dispatcher is corrected; this otherwise preserves the required ADR-044 Dashboard fallback.

## 22-02 — Retap, transient registry, and Back

Summary: This plan correctly resolves the cycle-3 transient-close issue and documents the accepted child-Back deferral with the real scrim-interception mechanism.

Strengths

- **RESOLVED — transient dismissal closes real UI.** The store requires `{ id, dismiss }` callbacks and tests that `dismissTop()` invokes the callback (`22-02-PLAN.md:94-100`), rather than merely removing an ID.

- **RESOLVED — the Back-deferral rationale is now accurate.** The plan grounds safety in the full-screen scrim (`22-02-PLAN.md:152`), which is supported by the existing `StyleSheet.absoluteFill` scrim at `src/components/AddSpeedDialFab.tsx:72-76` and the `open ? "auto" : "none"` helper at `src/components/add-speed-dial-fab-logic.ts:23-24`.

Concerns

- **RESOLVED / accepted deferral — not a new finding.** Existing child Back controls still call `goBack()` directly; for example Profile does so at `src/screens/ContactProfileScreen.tsx:757-763`. The plan’s full-screen modal scrim reasoning is sound for shell-owned overlays, provided that geometry remains full-screen.

Suggestions

- Add a regression test/UAT assertion that a shell overlay still occupies the full window after any future visual refactor.

Risk: **LOW**. The plan does not reopen the accepted child-screen Back deferral.

## 22-03 — In-app reconciliation and Discard/Keep

Summary: The exhaustive audit is materially improved, including `reset(` and service pass-throughs, but both Dashboard completion resets and the Discard action are currently specified incorrectly.

Strengths

- **RESOLVED — exhaustive audit scope is materially stronger.** The audit now includes `navigate`, `replace`, `push`, and `reset`, across screens, components, services, and navigation (`22-03-PLAN.md:110-115`). This addresses the prior shared-component blind spot.

- **RESOLVED — ImportReview and merge completion crashes are correctly redirected through the container ref.** The plan moves both ImportReview completion sites and merge completion to `navigationRef.current?.reset(...)` (`22-03-PLAN.md:106-107`). The need is real: current ImportReview calls `replace("Profile")` at `src/screens/ImportReviewScreen.tsx:215` and `:289`, and merge does the same at `src/components/MergeImpactSummary.tsx:17`.

- **RESOLVED — photo truthfulness is correct.** The plan excludes photos from unsaved-change state (`22-03-PLAN.md:183`), consistent with current immediate persistence at `src/screens/EditContactScreen.tsx:171-176` and crop-return refresh at `:227-247`. The owner-flagged “stage until Save” deferral is appropriately not re-counted.

Concerns

- **HIGH — NEW: Import/Reconcile Done repeat the child-stack reset error.** Plan 03 changes `ImportCompleteScreen` and `ReconcileCompleteScreen` to `navigation.reset(resetToDashboardRoot())` (`22-03-PLAN.md:146`). Both current screens own local stack navigation—current flat resets are at `src/screens/ImportCompleteScreen.tsx:295-301` and `src/screens/ReconcileCompleteScreen.tsx:46-47`. Post-split, they run in `SettingsStack`; it cannot reset to `DashboardTab`. These must dispatch through `navigationRef.current?.reset(...)`.

- **HIGH — NEW: Discard will be trapped by the same `beforeRemove` listener.** The proposed guard prevents removal whenever dirty, then its Discard button dispatches the intercepted action (`22-03-PLAN.md:175`). Since `hasUnsavedChanges` remains true, that dispatched action triggers `beforeRemove` again and reopens the dialog. The existing restore guard avoids this class with `allowNavigationRef` at `src/screens/RestorePreviewScreen.tsx:87` and `:94-96`; the new guard needs an equivalent one-shot discard bypass.

Suggestions

- Use `navigationRef.current?.reset(resetToDashboardRoot())` for C1/C2.
- Add `allowDiscardRef`; set it immediately before `navigation.dispatch(event.data.action)`, consume/reset it in the next listener invocation, and unit-test that Discard removes the screen exactly once.

Risk: **HIGH**. Both issues break explicit SHELL-05/SHELL-07 behavior.

## 22-04 — Chrome, overflow, clearance

Summary: The measured-height solution correctly fixes the shell-FAB context-hook crash and the overflow accessibility work maps to an actual gap.

Strengths

- **RESOLVED — tab-bar-height context crash.** The plan uses a measured `BottomTabBar` wrapper and Zustand layout store (`22-04-PLAN.md:138-142`) rather than calling `useBottomTabBarHeight()` from the shell sibling. This is compatible with the actual sibling layout in `App.tsx:309-338`.

- **RESOLVED — shared geometry prevents FAB/clearance drift.** `FAB_SIZE` and `FAB_EDGE_GAP` are explicitly shared between clearance and the later FAB (`22-04-PLAN.md:142`).

- **RESOLVED — OverflowMenu accessibility improvement targets a real gap.** The existing modal has no modal-accessibility flag or focus restore at `src/components/OverflowMenu.tsx:46-95`; Plan 04 adds both (`22-04-PLAN.md:108`).

Concerns

- **LOW — NEW: initial measurement can momentarily place the FAB at the window bottom.** The store initializes height to `0` (`22-04-PLAN.md:138`), while Plan 05 positions the FAB from measured height plus a gap. Until `onLayout` fires, it can overlap the new bar for a frame.

Suggestions

- Hide/defer FAB rendering until the first non-zero tab-bar measurement, or provide a safe initial position and verify cold launch visually.

Risk: **LOW**.

## 22-05 — Universal FAB

Summary: The plan correctly avoids the context-bound tab-height hook and preserves the inert collapsed scrim, but its stated navigation-ref call will not compile.

Strengths

- **RESOLVED — FAB placement fix.** It reads the measured layout store, not `useBottomTabBarHeight()` (`22-05-PLAN.md:131`). This directly addresses the shell-sibling context issue.

- **RESOLVED — scrim behavior is retained.** It reuses `speedDialScrimPointerEvents`, which current code proves is required because the scrim remains mounted at opacity zero (`src/components/AddSpeedDialFab.tsx:72-76`; `src/components/add-speed-dial-fab-logic.ts:6-24`).

Concerns

- **HIGH — NEW: the specified navigation-ref state read is invalid.** The plan calls `navigationRef.getRootState()` (`22-05-PLAN.md:131`), but the actual ref is a React ref created with `createRef<NavigationContainerRef<...>>()` at `src/navigation/linking.ts:36-37`. The method is on `navigationRef.current`, not on the ref object. This must be `navigationRef.current?.getRootState()` with a null fallback; dispatch likewise needs `navigationRef.current?.navigate(...)`.

Suggestions

- Make the FAB use only `navigationRef.current`, guard absent state as global/no-contact context, and add a TypeScript assertion/test around both state reading and nested dispatch.

Risk: **HIGH** as written because this blocks `tsc`.

## 22-06 — Picker and truthful Quick Log

Summary: The plan is well grounded in the actual DAO contract and correctly recognizes all sanctioned `interactions` writers. Undo failure handling remains incomplete.

Strengths

- **RESOLVED — Quick Log uses the correct canonical writer.** `recordTouchpoint` returns only after its transaction commits at `src/db/recency-dao.ts:217-242`; Plan 06 waits for that result before success UI (`22-06-PLAN.md:174`).

- **RESOLVED — Undo reuses the correct guarded delete path.** `deleteTouchpoint` scopes by both interaction and contact IDs, creates a tombstone, deletes, and recomputes recency in one transaction at `src/db/recency-dao.ts:313-345`. The plan correctly identifies restore upsert (`src/backup/restore-apply.ts:170`) and purge (`src/db/purge-dao.ts:78`) as the other sanctioned writers (`22-06-PLAN.md:61`).

- **RESOLVED — ADR-075 ordering discipline.** The proposed picker SQL uses membership band, `last_contact`, then name—and specifically excludes rank ordering (`22-06-PLAN.md:110-120`).

Concerns

- **MEDIUM — NEW: Undo has no specified failure path.** The plan says Undo deletes then silently dismisses (`22-06-PLAN.md:174`), but `deleteTouchpoint` deliberately rejects if the target is absent or mismatched (`src/db/recency-dao.ts:321-344`). Dismissing/refreshing on rejection would imply the undo succeeded when it did not.

Suggestions

- Await deletion; dismiss and refresh only on success. On failure, retain or replace the snackbar with a retryable “Couldn’t undo” state and log the error. Add a rejected-delete test.

Risk: **MEDIUM**, contingent on Plan 05’s navigation-ref fix.

## Final assessment

**Overall risk: HIGH.** The cycle-3 fixes are genuinely present and correct:

- CropPhoto is registered for the Settings-mounted `PhotoSourcePicker`.
- FAB geometry avoids the invalid tab-screen context hook.
- The audit is now structurally broader, including `reset(`.
- The shell-scrim Back deferral is documented with a correct safety argument.

However, Plan 01/03 still dispatch root reset state through child navigators, Plan 03’s Discard cannot complete without a one-shot bypass, and Plan 05 calls a method on the wrong ref object. Fixing those three items should unblock convergence without reversing ADR-044, ADR-075, or the accepted photo/child-Back deferrals.

---

## Cursor Review

# Cross-AI Plan Review — Phase 22 (App Shell & Navigation) — Convergence Cycle 4

Reviewed all six plans on disk against the **current codebase** (still a flat `createNativeStackNavigator` at `src/navigation/RootNavigator.tsx:71-76`; no `src/navigation/tabs/`, no `@react-navigation/bottom-tabs` in `package.json`). Cycle-3/4 fixes are judged against **plan text + on-disk crash sites**, not implemented navigation yet.

---

## Cycle-3 Fix Verification (explicit)

| Cycle-3 finding | Status in current plans | On-disk evidence |
|---|---|---|
| **HIGH #1 — N18/N19 `ImportReviewScreen` → `replace("Profile")`** | **RESOLVED in plans** | Real crash sites: `ImportReviewScreen.tsx:215`, `:289`. Plan 03 reshapes both to `navigationRef.reset(resetToDashboardWith(...))`. `:239`/`:310` `replace("ImportComplete")` correctly left intra-Settings. |
| **HIGH #2 — Photo excluded from Discard/Keep** | **RESOLVED in plans** | Verified: photo is immediate DAO state, not Save (`EditContactScreen.tsx:171-176`, focus re-read `:227-247`; save still `navigate("Profile")` at `:451` while dirty). Plan 03 excludes photo from dirty delta and owner-flags "stage until Save." |
| **HIGH #3 — Plan 04 wave/dependency** | **RESOLVED in plans** | `22-04-PLAN.md`: `wave: 3`, `depends_on: [22-01, 22-02]`. ShellAppBar → `back-intent` import is real. |
| **NEW cycle-3 HIGH #1 — N20 `PhotoSourcePicker` → `CropPhoto` from Settings** | **RESOLVED in plans (cycle-4)** | Crash path verified: `SettingsScreen.tsx:1351` mounts `PhotoSourcePicker`; `PhotoSourcePicker.tsx:143`/`:213` `navigate("CropPhoto")` with `RootStackParamList` typing (`:110-111`). Plan 01 tri-registers `CropPhoto` in `SettingsStack` + acceptance grep. |
| **NEW cycle-3 HIGH #2 — Shell FAB `useBottomTabBarHeight()` crash** | **RESOLVED in plans (cycle-4)** | Plan 04 adds `tab-bar-layout-store.ts` + measured `tabBar`; Plan 05 uses `useMeasuredTabBarHeight()` with grep gates banning `useBottomTabBarHeight`. Legacy collision confirmed: `HomeScreen.tsx:653` mounts `AddSpeedDialFab`; styles use `bottom: 28` (`:665`). |
| **Actionable — widen grep audit to `src/services/` + `reset(`** | **RESOLVED in plans (cycle-4)** | Plan 03 Task 1 Step 1 now sweeps `src/services/` and `src/navigation/` with `reset(` + object-arg tail. `import-acquire.ts:172`/`:174` is inventoried as N21. |
| **Actionable — Plan 04 false child-Back rationale** | **RESOLVED in plans (cycle-4)** | Plan 04 Task 1 now uses the verified full-screen scrim rationale (`AddSpeedDialFab.tsx:75`/`:133`, `add-speed-dial-fab-logic.ts:23`). |
| **Actionable — inset contract for clearance** | **RESOLVED in plans (cycle-4)** | Plan 04 Task 2: measured height already includes bottom inset; no double `useSafeAreaInsets().bottom`. |
| **Actionable — compile-safety contingency** | **RESOLVED in plans (cycle-4)** | Plan 01 phase-anchor "Compile-safety contingency" block: retype flagged screens in Plan 01 scope if `tsc` fails. |

---

## Overall Summary

These plans are **substantially convergence-ready**. Cycle-3 HIGHs are addressed in plan text with accurate on-disk citations; cycle-4 closes the two new HIGHs (N20 CropPhoto tri-registration, measured tab-bar store for the shell FAB) and structurally hardens the cross-tab audit (Plan 03 Step 1 including `reset(` and services). The architecture core — nested external resets via `reset-intents.ts`, per-tab stacks, ADR-044 preservation, commit-truthful Quick Log — is well-grounded in real code (`widget-linking.ts:274`/`:287`, `notification-nav.ts:90-106`, `recency-dao.ts:217-309`, `deleteTouchpoint` at `:313`). Remaining risk is **execution mechanics** (typing migration, one ambiguous Compose reset dispatch, a documented N21 window before Plan 05 deletes `AddSpeedDialFab`), not missing requirements or decision reversals.

---

## Plan 22-01 — TRACER (Four-tab shell + nested resets)

### Summary
Strong phase anchor: route→tab map follows real launch sites; D-08 inventory is the most complete yet; N20/N7 dual-registration fixes match verified crash classes.

### Strengths
- **Flat stack baseline is accurate** — single stack, migration gate preserved (`App.tsx:309-322` mounts `RootNavigator` only after readiness).
- **External-entry inventory matches disk** — A1/A4 Compose/widget flat `Home` resets (`ComposeScreen.tsx:267`, `widget-linking.ts:274`); A2/A2b notification paths (`notification-gate.tsx:135-138`, birthday `navigate("Profile")` at `notification-nav.ts:102-105`).
- **N20 fix is correct and verified** — Settings "Your photo" → CropPhoto crash class documented with mount enumeration.
- **ADR-075 enforcement is disciplined** — no new `favourite_rank ASC` in Plan 06 picker; user-facing Manage entries removed in Plan 04; route retained for `orbit://favourites` (owner-flagged, not a reversal).
- **Compile-safety contingency** — explicit fallback if per-tab registration breaks `tsc`.

### Concerns
- **MEDIUM — NEW: Compose `goHome` dispatch shape may need `navigationRef`** (PRIOR class, partially addressed). Plan 01 Task 2 sets A1 to `navigation.reset(resetToDashboardRoot())` on the **component** navigator (`ComposeScreen.tsx:267`). `resetToDashboardRoot()` returns **tab-level** `{ DashboardTab → Home }` state. Compose is dual-registered in OrreryStack **without** `Home` (`OrreryScreen.tsx:433` → Profile → Compose path). Plan 03 audit says classify `ComposeScreen.tsx:267` against stack registration, but the fix still uses component `navigation.reset`, unlike N10/N18 which correctly use `navigationRef`. Merge/import completions use `navigationRef`; Compose should too for consistency and to guarantee cross-tab Dashboard landing (especially from Orrery-origin Compose). Compose also owns hardware Back (`ComposeScreen.tsx:404-406`) — that path must hit the same nested reset.
- **LOW — PRIOR unresolved doc nit**: Plan 01 phase-anchor sweep example at line ~169 still shows the **old** grep (no `reset(`, no object-arg tail) while Plan 03 has the corrected pattern. Executor should follow Plan 03 Step 1, not the stale snippet.
- **MEDIUM — accepted contingency**: `RootStackParamList` back-compat keeps component-level navigates tsc-blind (`PhotoSourcePicker.tsx:110-111`); mitigated by Plan 03 exhaustive audit + `navigationRef` retype, not eliminated.

### Suggestions
- Change A1 to `navigationRef.current?.reset(resetToDashboardRoot())` (mirror N10) or document/test that `navigation.reset(tabState)` bubbles from OrreryStack to the tab navigator.
- Align the phase-anchor grep example with Plan 03 Step 1 regex.

### Risk Assessment
**MEDIUM** — architectural spine is sound; Compose reset dispatch is the main correctness question before execution.

---

## Plan 22-02 — Navigator behavior (transient store, back-intent, retap)

### Summary
Solid behavior contract. Transient store `{id, dismiss}` model fixes cycle-2 HIGH #5a. SHELL-03 deferral is honestly scoped with the **correct** scrim rationale.

### Strengths
- **`dismissTop()` invokes real close callbacks** — matches `AddSpeedDialFab` local React state pattern; tested in Plan 02 Task 1.
- **Focused-route allow-list includes CropPhoto + FAB placeholders** — Plan 02 Task 1 acceptance explicitly tests these (important after N20 tri-registration).
- **SHELL-03 deferral is verified safe** — full-screen scrim (`add-speed-dial-fab-logic.ts:23`: collapsed → `"none"`, open → `"auto"`); child Back on browse surfaces (`ContactProfileScreen.tsx:762` `goBack()`) equals default when no transient open.
- **Compose/Capture self-owned BackHandlers acknowledged** — `ComposeScreen.tsx:404`, `CaptureScreen` (plan cites `:216`); avoids fighting focused workflows.

### Concerns
- **NOTE — PRIOR, accepted deferral**: SHELL-03 "system Back == visible Back on **every** screen" is only partial this phase (child chrome not routed through `back-intent`). Documented with scrim caveat — not a new finding.
- **LOW — NEW**: Shell `BackHandler` in Plan 02 Task 3 runs alongside Compose's focused `BackHandler` (`ComposeScreen.tsx:404`). Both call equivalent "go Dashboard" intent — verify no double-handling once A1 uses nested reset.

### Suggestions
- In 22-02-SUMMARY, record the standing scrim-geometry caveat (already mandated in plan notes).

### Risk Assessment
**LOW–MEDIUM** — pure modules are well-specified; integration risk is BackHandler ordering with Compose/Capture.

---

## Plan 22-03 — In-app navigate reconciliation + Discard/Keep

### Summary
Best-in-class cross-tab closure. Exhaustive re-audit procedure is the structural fix prior cycles lacked. Import/merge crash fixes match real sites on disk.

### Strengths
- **N18/N19 verified on disk** — `ImportReviewScreen.tsx:215`, `:289`.
- **N10 verified** — `MergeImpactSummary.tsx:17` `replace("Profile")`.
- **Exhaustive audit closes the class** — includes `reset(`, `src/services/`, mount enumeration for shared components (`PhotoSourcePicker`, `ResumeImportPrompt`, etc.).
- **Photo Discard truthfulness verified** — immediate photo commit (`EditContactScreen.tsx:171-176`); owner escalation for "stage until Save" is correct posture.
- **Edit no-replay likely already correct** — `ContactProfileScreen.tsx:310-314` documents that `navigate("Profile")` from Edit pops to existing Profile instance; Plan 03 verify-on-execution is appropriate.
- **Backup-local resets correctly scoped** — B1–B3 stay tab-local (`RestorePreviewScreen.tsx:99`/`:123`, `RestoreResultScreen.tsx:18`).

### Concerns
- **MEDIUM — PRIOR, documented window: N21** (`AddSpeedDialFab.tsx:55-61` threads Dashboard `navigation.navigate` into `import-acquire.ts:172`). Safe only after Plan 05 deletes the FAB. Plan 03 explicitly records this; **end-of-phase UAT before Plan 05 completes can still crash** on dashboard import — not a plan gap, but a real interim hazard.
- **LOW — NEW**: Plan 03 Step 1 says classify `ComposeScreen.tsx:267` component-level reset — ensure SUMMARY disposition is **`navigationRef.reset(resetToDashboardRoot())`**, not "SAFE intra-stack Home" (Home is not in OrreryStack).

### Suggestions
- Add explicit SUMMARY row for Compose A1: "component stack lacks Home → use container reset."
- Optional: add a Plan 03 acceptance grep that `ComposeScreen` does not call `reset({ routes: [{ name: "Home" }] })` post-refactor.

### Risk Assessment
**MEDIUM** — audit procedure is strong; interim N21 window and Compose reset disposition need executor discipline.

---

## Plan 22-04 — Shell chrome (app bars, clearance, Group Events)

### Summary
Cycle-4 HIGH #2 fix is present and well-specified. Wave dependency on Plan 02 is correct. Dashboard header/overflow work matches D-09.

### Strengths
- **`tab-bar-layout-store` + measured `tabBar`** — solves shell-sibling FAB/context-hook problem (`App.tsx:322` FAB will sit beside `RootNavigator`, not inside tab tree).
- **Finding C single-sourced** — exported `FAB_SIZE`/`FAB_EDGE_GAP` shared with Plan 05.
- **Inset contract explicit** — measured height includes safe area; no double-padding.
- **Plan 04 Task 1 deferral rationale corrected** — scrim interception, not "FAB hidden on child screens."
- **ADR-075 removals targeted** — `HomeScreen.tsx:319`, `SettingsScreen.tsx:2008` Manage entries; footer Archived `:407` removed per D-09.

### Concerns
- **LOW — NEW doc nit (cycle-4 incomplete)**: Plan 04 `prohibitions` still say clearance must derive from **`useBottomTabBarHeight()+insets`** (`22-04-PLAN.md:58`), contradicting Task 2's measured-store approach. Executor should follow Task 2/must_haves, not the stale prohibition line.
- **LOW — PRIOR**: Header Backup/Orrery/Settings shortcuts kept as tab switches (`HomeScreen.tsx:536`/`:554`/`:572`) — duplicates bottom tabs; correctly flagged as owner visual decision, not silently deleted.

### Suggestions
- Update prohibition line 58 to reference `useMeasuredTabBarHeight()` + shared FAB constants.

### Risk Assessment
**LOW** — chrome layer is coherent; one stale prohibition string.

---

## Plan 22-05 — Universal six-action FAB

### Summary
Cycle-4 FAB placement fix is fully incorporated. Six-action contract, nested shell routing, and transient registration are well-designed.

### Strengths
- **No `useBottomTabBarHeight` at shell mount** — explicit grep acceptance; uses Plan 04 measured store.
- **Nested `{ tab, screen, params }` routing** — fixes shell-level bare `navigate("Create")` class (`AddSpeedDialFab.tsx:98` today).
- **`getFocusedContactContext` pure helper** — testable Profile preselect from nested state (finding D).
- **Group Log direct, six fixed order** — matches D-05.
- **Reanimated + scrim pointer-events retained** — `speedDialScrimPointerEvents` (`add-speed-dial-fab-logic.ts:23`).

### Concerns
- **LOW — PRIOR**: Plan 05 deletes `AddSpeedDialFab` at wave 4 — until then N21 cross-tab import remains live (see Plan 03).
- **LOW — NEW**: `UniversalFab` must read **focused route name** for `isFocusedWorkflow` from root navigation state (shell sibling) — plan implies this via navigation state; executor should use the same state walk as `getFocusedContactContext`, not assume Dashboard tab.

### Suggestions
- Add one acceptance assertion that FAB visibility reads focused child route from container state (not `useRoute()` inside a screen).

### Risk Assessment
**LOW–MEDIUM** — depends on Plan 04 store landing first (`depends_on: [22-02, 22-04]` is correct).

---

## Plan 22-06 — Picker + commit-truthful Quick Log

### Summary
Strongest data-layer grounding in the phase. Correctly reuses existing writers; ADR-075-compliant picker ordering; shell-refresh mechanism addresses real stale-data gap.

### Strengths
- **`deleteTouchpoint` exists** — Plan corrects RESEARCH A5 (`recency-dao.ts:313-345`); Undo reuses canonical path.
- **Quick Log mirrors `doLogContact`** — `ContactProfileScreen.tsx:339-349` with required `uid: newUid()` (`recency-dao.ts:59-61`).
- **Shell-refresh addresses real asymmetry** — `recordTouchpoint` bumps revision (`:240`); `deleteTouchpoint` does not; HomeScreen deliberately avoids connection-scoped notifications (`HomeScreen.tsx:9-15`).
- **ADR-075 picker read** — `(favourite_rank IS NULL)` band, not `favourite_rank ASC`; rank-does-not-decide-order test mandated.
- **Interactions writer audit correct** — Quick Log uses single-writer path only; notes `restore-apply.ts` bulk upsert and `purge-dao.ts` delete as separate sanctioned writers (no new writer introduced).
- **Failure haptic corrected** — finding G: no haptic on write error (dossier §M taxonomy).

### Concerns
- **LOW — PRIOR verify-on-execution**: Orrery `useShellRefresh` wiring — plan correctly says verify Orrery data path on disk and don't drive Skia from React state.
- **LOW — NEW**: Picker + Snackbar mount as shell siblings in `App.tsx` (like FAB) — ensure z-order/stacking so Snackbar appears above FAB/scrim.

### Suggestions
- Document Snackbar z-index relative to UniversalFab scrim in Task 3.

### Risk Assessment
**LOW** — requirements SHELL-09/10/11 are traceable to verified DAO/UI contracts.

---

## Cross-Cutting: Wave Order & Dependencies

| Wave | Plans | Assessment |
|------|-------|------------|
| 1 | 22-01 | Correct tracer — must land before all else |
| 2 | 22-02 ∥ 22-03 | Valid parallel after 01; 03 depends on 01 reset-intents + ref retype |
| 3 | 22-04 | Correctly blocked on 02 (ShellAppBar → back-intent) |
| 4 | 22-05 | Correctly blocked on 02 + 04 (transient store + measured tab bar) |
| 5 | 22-06 | Correctly blocked on 02 + 05 (picker transient + FAB seam) |

**Known interim hazard (documented):** Waves 2–3 ship while `AddSpeedDialFab` still exists → N21 dashboard-origin import cross-tab crash until Plan 05.

---

## Decision-Reversal Check

**No new HIGH decision reversals found.**

Owner-flagged deferrals correctly handled (not counted as defects):
- ADR-075 full `ManageFavourites` route retirement (widget `orbit://favourites` still needs target)
- Photo "stage until Save" (immediate commit preserved; Discard excludes photo)

SHELL-03 child-screen Back deferral: scrim safety argument **verified on disk** — accepted deferral, not a reversal.

---

## Overall Risk Assessment: **MEDIUM**

**Justification:** Plan quality and cycle-3/4 fixes are strong and evidence-backed. Risk is execution-phase: (1) per-tab typing/`tsc` migration surface, (2) Compose nested reset should use `navigationRef` like other completion resets, (3) N21 interim window, (4) heavy on-device UAT for nested back/transient/FAB/insets. No structural phase-goal gaps or ADR/HANDOFF reversals detected.

---

## Convergence Recommendation

**Proceed to execution** with two planner nits before or during wave 1:
1. **Compose A1** — align with N10/N18: `navigationRef.current?.reset(resetToDashboardRoot())`.
2. **Plan 04 prohibition line 58** — replace stale `useBottomTabBarHeight()+insets` with measured-store wording.

Neither blocks convergence; both reduce executor ambiguity on paths already verified crash-prone on disk.

---

## Claude Review (read-only subagent)

## 1. Summary

These six plans are mature, unusually well-evidenced, and the three cycle-3 HIGH/actionable fixes are genuinely present and correct in the current plans, with each fix re-verifiable against code on disk. Verified the crash sites, the shared-component mounts, the DAO writer set, the scrim-interception safety argument, the FAB sibling-mount premise, and the RESET dispatch semantics directly in `src/` and `node_modules/`. The (a) CropPhoto→SettingsStack fix, (b) measured tab-bar-height store replacing the context hook, (c) reset-inclusive exhaustive re-audit, and (d) corrected scrim rationale are all real and grounded in the actual code. No new decision reversal and no unresolved HIGH. Remaining concerns are LOW. Recommendation: proceed to execution.

## 2. Strengths (file:line evidence)

- **The N20 CropPhoto cross-tab crash fix is correct and complete.** `PhotoSourcePicker.tsx:143` (library pick) and `:213` (URL) both call `navigation.navigate("CropPhoto", …)` typed against `RootStackParamList` (tsc-blind), component is a shared non-screen `useNavigation` consumer. `CropPhotoScreen.tsx:277` (`setContactPhoto`)/`:285` (`setProfilePhoto`) then `:296 goBack()` — tri-registering the same screen in SettingsStack makes "Settings → Your photo → pick" resolve and return origin-aware to Settings.
- **The measured tab-bar-height store (HIGH #2) rests on a true premise.** `App.tsx:310-338` mounts `<RootNavigator/>`, `<AssistBanner/>`, Resume prompts as siblings inside `NavigationContainer` — a shell-mounted `<UniversalFab/>`/`<Snackbar/>` sits outside the tab-screen tree where `useBottomTabBarHeight()` genuinely throws. The measured-store single-source design (Plan 04 Task 2 + finding C) is right.
- **The cross-tab crash CLASS is closed structurally.** Plan 03 Task 1 Step 1 sweeps `navigation(Ref)?(\.current)?\??\.(navigate|replace|push|reset)\(\s*[{"]` across screens|components|services|navigation with the object-arg tail so component-level `reset({routes:…})` sites are enumerated; classifies each `reset(` by receiver and enumerates shared-component mount→stack. A genuine executable procedure.
- **The verified crash-site inventory is accurate.** `MergeImpactSummary.tsx:17` (N10); `ImportReviewScreen.tsx:215` (N18)/`:289` (N19), `:239 replace("ImportComplete")` correctly intra-Settings; `OrreryScreen.tsx:433/:441 navigate("Profile")` (N7); `linking.ts:64/:67` (N1/N2); `ImportCompleteScreen.tsx:267/:283/:300` (N8/N9/C1). Every cited file:line matches.
- **The SHELL-03 child-Back deferral rationale is TRUE on disk.** `add-speed-dial-fab-logic.ts:23 speedDialScrimPointerEvents(open)` = `"auto"` open / `"none"` collapsed; `AddSpeedDialFab.tsx:133 styles.scrim = StyleSheet.absoluteFill` applied with `pointerEvents` at `:75`. Full-screen scrim intercepts child Back while a transient is open; self-owned-hardwareBack screens (Compose/Capture) are focused workflows where the FAB is hidden.
- **The Quick Log write contract and DAO reuse are accurate.** `deleteTouchpoint` at `recency-dao.ts:313` (delete-by-both-keys + tombstone + recompute in one txn) does NOT call `bumpDataRevisionCore` (unlike `recordTouchpoint:240`) — exactly why finding B's explicit `notifyWidgetDataChanged()` + `bumpShellRefresh()` after Undo is required. `RecordTouchpointInput.uid` required, no default (`recency-dao.ts:59-61`); canonical `doLogContact` at `ContactProfileScreen.tsx:332-349` matches the mirror.
- **The `interactions` writer audit is complete and correct.** Three sanctioned writers only: single-writer `recency-dao.ts:195/281/336`, bulk `restore-apply.ts:170` (`upsertChildren`), delete `purge-dao.ts:78`. Quick Log adds none.
- **The new picker read is ADR-075-compliant.** Orders by `(favourite_rank IS NULL)` band → `last_contact DESC` → `name COLLATE NOCASE`, never `favourite_rank ASC`, with an acceptance grep — avoiding reintroducing the retired rank order still at `dashboard-read.ts:245/:333`, `sun-picker-read.ts:45`, `capture-read.ts:66`.

## 3. Concerns

- **[RESOLVED — investigated, not a defect] Component-nav reset of a container-shaped state (A1 `ComposeScreen.tsx:267`, C1 `ImportCompleteScreen.tsx:300`, C2 `ReconcileCompleteScreen.tsx:47`).** These reshape to `navigation.reset(resetToDashboardRoot())` via the screen's own stack navigation prop, where `resetToDashboardRoot()`'s top route is `DashboardTab` — not a route in the child stack. Flagged as a potential HIGH; verified against installed source: `@react-navigation/routers BaseRouter.js:31-33` returns `null` from the RESET handler when any payload route name is absent from the current navigator's `routeNames`; `useNavigationHelpers.js:43-56` dispatches `CommonActions.reset` with NO `target`; `useOnAction.js:51-56` lets the un-targeted, unhandled action bubble to the parent, where the Tab navigator (routeNames include `DashboardTab`) handles it. These resets correctly land the Dashboard tab root, entry-agnostically. NEW investigation; concludes SAFE. (Correct-but-implicit reliance — see Suggestions.)
- **[LOW — NEW] The owner-flagged ADR-075 `favourite_rank ASC` enumeration is incomplete.** Plan 01's ADR-075 block lists `dashboard-read.ts:245/:333`, `sun-picker-read.ts:45`, `capture-read.ts:65-66` but omits `merge-candidate-read.ts:29` (`ORDER BY (c.favourite_rank IS NULL), c.favourite_rank ASC, …`) and the `favourites-dao` rank machinery. Does not affect Phase 22 build scope; the flagged handoff to the owner's future retirement phase is missing a site.
- **[LOW — NEW] FAB visibility reactivity is under-specified.** Plan 05 hides the FAB when `isFocusedWorkflow(currentRoute)` and derives `originContactId` from `getFocusedContactContext(navigationRef.getRootState())`. `getRootState()` is a non-reactive snapshot; a shell-sibling component won't re-render on route changes unless it subscribes (`useNavigationState`, or `navigationRef.addListener('state', …)`). The plan doesn't name the reactive mechanism.
- **[LOW — NEW] The re-audit's "(call-site stack × target route not registered) = crash" rule can false-positive on intentional bubbling resets.** After Plan 01 rewrites Compose/import/reconcile completions to `resetToDashboardRoot()` (top route `DashboardTab`), a mechanical Step 4 would flag `DashboardTab` as "not registered in the caller's stack" — when it's resolved by RESET bubbling. The heuristic exempts `navigationRef` sites; it should also exempt tab-level route names on un-targeted component resets.
- **[LOW — NEW] `reset` typing across the level boundary is a possible (contingency-covered) tsc snag.** `resetToDashboardRoot()` is typed against `TabParamList`; passing it to a per-tab-stack `navigation.reset()` may or may not satisfy `PartialState<NavigationState<ThatStackParamList>>`. React Navigation's `reset` typing is loose (route `name: string`), so it likely compiles, and Plan 01's compile-safety contingency would surface it. No action beyond awareness.

## 4. Suggestions

- Add a one-line code comment at each component-level `reset(resetToDashboardRoot())` site (Compose:267, ImportComplete:300, ReconcileComplete:47) documenting that correctness depends on the un-targeted RESET bubbling from the per-tab stack to the Tab navigator. Prevents a maintainer from "fixing" it to a `navigationRef` call unnecessarily — or adding a `target` that would break the bubble.
- Extend Plan 03 Task 1 Step 4 with an explicit exemption: a component-level `reset` whose top-level target is a `*Tab` route name is resolved by bubbling and is not a crash (mirror the existing `navigationRef` exemption).
- Add `merge-candidate-read.ts:29` (and the `favourites-dao` rank writes) to the owner-flagged ADR-075 residual list.
- In Plan 05, name the reactive nav-state subscription the shell FAB uses for `isFocusedWorkflow` visibility (e.g. `useNavigationState`).

## 5. Risk Assessment

**LOW.** All three cycle-3 fixes and the cycle-4 rationale correction are present and verified correct against the actual code, not just the plan text. No decision reversal (the two owner-flagged deferrals remain correctly flagged; the SHELL-03 child-Back scrim-safety argument is TRUE on disk). The one candidate HIGH — component-nav container resets — was traced through installed React Navigation source and shown safe by action bubbling. Residual concerns are all LOW; none blocks execution. Primary residual risk is inherent to a six-plan/five-wave navigation refactor whose final correctness leans on the mandatory on-device Pixel UAT — which the plans specify comprehensively. Wave ordering is sound (01 → {02,03} → 04 → 05 → 06), HIGH #2 store created wave 3 before its wave-4 consumer, no parallel writers of `RootNavigator.tsx`/`App.tsx`/`UniversalFab.tsx` within a wave.


---

## Orchestrator Source-Grounding Pass (grep authority)

Every cited symbol referencing EXISTING code (phase-produced artifacts — the four `src/navigation/tabs/*Stack.tsx`, `reset-intents.ts`, `discard-keep-guard.ts`, `tab-bar-layout-store.ts`, `use-bottom-clearance.ts`, `UniversalFab.tsx`, the CropPhoto SettingsStack registration — are EXCLUDED per the source-grounding contract) was resolved via ripgrep/Read:

- **VERIFIED (file:line):** `ImportReviewScreen.tsx:215/:289` `replace("Profile")`, `:239/:310` `replace("ImportComplete")` (intra-Settings, unchanged); `MergeImpactSummary.tsx:17` merge-success `replace("Profile",{contactId:survivorId})`; `ImportCompleteScreen.tsx:267` `navigate("UnboundContacts")`, `:283` `navigate("Profile")`, `:300` `reset({routes:[{name:"Home"}]})`; `ReconcileCompleteScreen.tsx:47` reset; `ContactProfileScreen.tsx:817` SurvivorSelect, `:827` ReconcileDetail; `EditContactScreen.tsx:156` seededLinks, `:185` committedValuesRef, `:172` immediate-photo-commit comment, `:313/:428` reseedMetadataAfterPartialSave, `:451` `navigate("Profile")`; `PhotoSourcePicker` mounts at `SettingsScreen.tsx:1351` + `EditContactScreen.tsx:583` + `PhotoFieldWidget.tsx:84`; `import-acquire.ts:172/:174` navigate; `AddSpeedDialFab.tsx:55/:61` startContactImport passthrough; `ComposeScreen.tsx:267` reset + `:404` hardware-Back `goHome`; `RestorePreviewScreen.tsx:94` beforeRemove/`:99/:123` reset + `:87` allowNavigationRef; `RestoreResultScreen.tsx:18` reset; `widget-linking.ts:274/:287` `navigationRef.current?.reset`; `linking.ts:36` `navigationRef = createRef<NavigationContainerRef<...>>()`; `recency-dao.ts:217` recordTouchpoint, `:313` deleteTouchpoint (throws on 0/mismatched changes at `:326/:340`); `restore-apply.ts:170` interactions bulk upsert; `purge-dao.ts:78` interactions delete; `merge-candidate-read.ts:29` `favourite_rank ASC`.
- **React Navigation v7 internals VERIFIED (decisive adjudication):** `@react-navigation/routers .../BaseRouter.js:31` (RESET → null for foreign route names); `@react-navigation/core .../useNavigationCache.js:83-85` (`source: route.key`, no target); `.../useOnAction.js:56` (null-result + no target → not consumed) + `:93-96` (bubbles to parent); `.../useOnPreventRemove.js` (`VISITED_ROUTE_KEYS` skip on re-dispatch).
- **MISSING:** none (all non-phase-produced citations resolved).
- **AMBIGUOUS:** none.
- **UNCHECKABLE (any signature):** the runtime navigation-tree behavior (Orrery→Profile→Back origin-awareness, tab crossfade, cold-start FAB placement) is UI-observable only and correctly routed to the mandated on-device Pixel UAT — not statically decidable.

**Verification coverage:** 100% of cited existing-code symbols VERIFIED (0 MISSING / 0 AMBIGUOUS). The load-bearing cross-AI divergence was resolved by reading the installed library source, not by trusting any lane's assertion.

## Advisory Drift-Guard Pass (never counts toward findings)

`node <gsd-tools> drift-guard phase-status --phase 22` → verdict `uncheckable`; not `drifted`. **STATE-refresh note (advisory only):** STATE.md records "6 plans, 4 waves" while the plans/roadmap describe 5 waves — a STATE.md refresh item, NOT a counted review finding. No cross-artifact fact-drift (two artifacts contradicting on the same fact) detected.

## Orchestrator Adjudication & Actionable Items

**Unresolved HIGH: NONE.** Every HIGH raised this cycle (codex: Compose reset, C1/C2 reset, Discard loop, Plan-05 getRootState; cursor: reset MEDIUM) was resolved by on-disk verification — the reset and Discard mechanisms are correct via RESET bubbling and `VISITED_ROUTE_KEYS` respectively; the getRootState `.current` omission is tsc-caught (not silently shippable) and downgraded to an actionable plan-text fix.

**Actionable non-HIGH items not yet incorporated into PLAN.md** (ranked):
1. **[MEDIUM — claude, preempts codex/cursor] Plan 03 Task 1 Step 4 + A1/C1/C2 rationale.** Add an explicit exemption to the audit rule: a component-level `reset` whose top-level target is a `*Tab` route name is resolved by RESET bubbling to the Tab navigator and is NOT a crash (mirror the existing `navigationRef` exemption). Add a one-line rationale comment at `ComposeScreen.tsx:267` (Plan 01) and `ImportCompleteScreen.tsx:300`/`ReconcileCompleteScreen.tsx:47` (Plan 03) so the mandated exhaustive audit and future maintainers do not re-flag or "fix" these safe sites (two of three lanes read them as crashes).
2. **[MEDIUM — codex] Plan 06 Undo failure path.** `22-06:174` has Undo call `deleteTouchpoint` then `bumpShellRefresh()`/dismiss, but `deleteTouchpoint` rejects on absent/mismatched target (`recency-dao.ts:326/:340`). Specify: await the delete; bump/dismiss (implying success) ONLY on resolve; on reject show a retryable "Couldn't undo" state + log, do not imply success.
3. **[LOW — codex + claude] Plan 05 FAB nav-state read.** `22-05:131` writes `getFocusedContactContext(navigationRef.getRootState())` — `navigationRef` is a `RefObject` (`linking.ts:36`), so this must be `navigationRef.current?.getRootState()` with a null fallback (tsc-caught if copied verbatim). Separately, name the REACTIVE subscription (e.g. `useNavigationState`, or a `navigationRef` `'state'` listener) the shell-sibling FAB uses for `isFocusedWorkflow` visibility — `getRootState()` is a non-reactive snapshot and the FAB will not re-render on route changes without it.
4. **[LOW — cursor] Plan 04 stale `useBottomTabBarHeight()+insets` wording.** The prohibition (`22-04:58`) and key-file line (`22-04:47`) still say clearance must derive from `useBottomTabBarHeight()+insets`, directly contradicting the cycle-4 measured-store fix (Task 2/must_haves ban that hook AND adding `useSafeAreaInsets().bottom`, which double-pads). Update both to the `useMeasuredTabBarHeight()` + shared-FAB-constants + no-extra-inset contract.
5. **[LOW — cursor] Plan 01 stale grep snippet.** The phase-anchor sweep example (`22-01:169`) still shows the old `navigate|replace|push\(\s*"[A-Za-z]` regex (no `reset`, no object-arg tail) that Plan 03 Step 1 supersedes. Align it to Plan 03's reset-inclusive pattern so an executor following Plan 01's snippet does not run the structurally-blind sweep.
6. **[LOW — claude] ADR-075 residual list incomplete.** Plan 01's owner-flagged future-retirement enumeration (`22-01:90`) omits `merge-candidate-read.ts:29` (`ORDER BY (c.favourite_rank IS NULL), c.favourite_rank ASC, …`, verified) and the `favourites-dao` rank machinery (and `capture-read.ts:65-66`, named at `22-01:82` but dropped from the line-90 list). Does NOT affect Phase 22 build scope; add the sites so the future retirement phase inherits the full set.
7. **[LOW — codex] Plan 04 FAB cold-start frame.** `tab-bar-layout-store` initializes height to `0`; until the first `onLayout` fires, the measured-height-positioned FAB (Plan 05) can overlap the bar for a frame. Defer FAB render until the first non-zero measurement, or give a safe initial position and verify cold launch on the Pixel.

**Recommendation:** Proceed to execution. Items 1–2 are worth folding into the plans before wave 1/wave 5 respectively; items 3–7 are LOW doc/precision/polish fixes. No item blocks convergence and none reverses a recorded decision.

To incorporate: `/gsd-plan-phase 22 --reviews`
