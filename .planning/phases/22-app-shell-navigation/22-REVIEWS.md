---
phase: 22
reviewers: [codex, cursor, claude]
reviewed_at: 2026-09-02T18:26:55Z
convergence_cycle: 3
plans_reviewed: [22-01-PLAN.md, 22-02-PLAN.md, 22-03-PLAN.md, 22-04-PLAN.md, 22-05-PLAN.md, 22-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  cursor: "unknown"
  claude: "unknown"
model_sources:
  codex: "banner"
  cursor: "unknown"
  claude: "subagent (read-only Claude lane; built-in claude -p self-skips inside Claude Code)"
---

# Cross-AI Plan Review — Phase 22 (App Shell & Navigation), Convergence Cycle 3

Three independent lanes reviewed the CURRENT plans on disk (HEAD `f4f7aad`): **codex** and **cursor** (external CLIs) and **claude** (a read-only Claude subagent — the built-in `claude -p` lane self-skips inside Claude Code and has a known Write-permission gap). Every lane was instructed to review the code, not the diff, and to ground each finding in `file:line` evidence. The orchestrator independently re-verified all load-bearing citations against disk.

## Consensus Summary

The cycle-3 revision is high quality and the **three cycle-2 HIGHs are RESOLVED** — unanimous across all three lanes and confirmed against the code:

- **HIGH #1 (ImportReview `replace("Profile")` crash, N18/N19):** RESOLVED. `ImportReviewScreen` is `RootStackScreenProps<"ImportReview">` (a SettingsStack screen, :74); `replace("Profile")` is real at :215 (`importAsNew`) and :289 (`linkToExisting`); `:239`/`:310` `replace("ImportComplete")` is intra-SettingsStack and correctly left alone. Plan 03 reshapes both to `navigationRef.reset(resetToDashboardWith({name:"Profile",…}))` — a route that IS in DashboardStack, type-safe under the retyped ref — and mandates a LITERAL grep re-audit as an executor step rather than another restated completeness claim.
- **HIGH #2 (photo/Discard false promise):** RESOLVED. Verified in `EditContactScreen.tsx`: the photo is separate screen state committed IMMEDIATELY by its own `setContactPhoto`/`clearContactPhoto` DAO (:170-177), re-read on focus (:227-247), never part of Save (`navigate("Profile")` at :451 fires while dirty). Plan 03 excludes the photo from the dirty delta, forbids claiming Discard reverts it, and flags the "stage until Save" alternative for the owner. Truthful-minimal fix + correct escalation.
- **HIGH #3 (Plan 04 missing dependency):** RESOLVED. `22-04-PLAN.md` is `wave: 3`, `depends_on: [22-01, 22-02]`; ShellAppBar's child Back is a real compile-time import of Plan 02's `back-intent`. Wave order `01 → {02,03} → 04 → 05 → 06` is consistent across the roadmap and every plan's front-matter.

Data-layer premises are accurate against disk (all three lanes + orchestrator): `RecordTouchpointInput.uid` is required with no DAO default (recency-dao.ts:62); `recordTouchpoint` bumps the data revision (:240) but `deleteTouchpoint` (:313-358) does NOT — the exact asymmetry finding B relies on, so the shell-refresh mechanism is genuinely needed for Undo; `doLogContact` (ContactProfileScreen.tsx:332-349) is mirrored exactly; the `favourite_rank ASC` reads that ADR-075 governs are live at capture-read.ts:66 / dashboard-read.ts:245,:333 / sun-picker-read.ts:45, and the new `picker-read` correctly uses a `(favourite_rank IS NULL)` membership band instead. Local-first is preserved (no network on any read path). The two owner-flagged deferrals (ManageFavourites route retention for the `orbit://favourites` widget deep-link; photo "stage until Save") are correct posture, not defects.

### Agreed Strengths (2+ lanes)
- The two headline crash fixes (N18/N19 ImportReview, N10 merge-completion) are grounded in real, verified crash sites and reshaped with the correct completion semantics (codex, cursor, claude).
- The photo-truthfulness correction is accurate against the shipped immediate-commit behavior; the owner escalation is the right call (codex, cursor, claude).
- The Plan 04 dependency/wave fix is verified correct (codex, cursor, claude).
- ADR-075 posture — no new `favourite_rank ASC` read, both user-facing entries removed, route retained-for-widget flagged to the owner — is correct (codex, cursor, claude).
- The `{id, dismiss}` transient-store callback model correctly answers the earlier "an id can't close local-React-state visibility" concern; the child-Back deferral now carries the VERIFIED scrim-interception rationale (cursor, claude).

### Agreed Concerns (2+ lanes)
- **The D-08 grep re-audit scope (Plan 03 Task 1) is too narrow** — it searches only `src/screens src/components` and misses service-layer navigate pass-throughs, concretely `src/services/import/import-acquire.ts:172-174` (`navigate("ImportReview"|"BulkImportSetup")`). Currently safe (called from SettingsStack), but the omission falsifies the "COMPLETE audit" claim and is exactly how the next site gets missed (codex + cursor; orchestrator-verified the sites exist).
- **SHELL-03 is only partially delivered this phase** — child-screen visible Back controls are not routed through back-intent; the deferral is documented and safe-under-scrim, but the dossier success criterion says "every screen" (cursor, claude note; accepted deferral).

### Divergent Views
- **Plan 01's typing strategy (registering `RootStackScreenProps<T>`-typed screens in narrower per-tab navigators):** codex rates this **HIGH — "will not compile as written"** (Task 1's file scope excludes the consumer screens while promising `tsc` green). cursor rates it **LOW** ("preserves tsc-blindness for component props … fragile but compiles"); claude did not flag it as a compile blocker (implying it compiles and stays tsc-blind, with Plan 03's grep as the backstop). Two of three lanes judge it compiles. The orchestrator treats this as an **actionable** contingency (add a compile-safety note + scope fallback), not a confirmed HIGH — see below.

### New HIGH concerns raised this cycle (unresolved in the current plans)
1. **Unlisted cross-tab crash — `SettingsScreen → PhotoSourcePicker → navigate("CropPhoto")`** (claude; orchestrator-verified). `SettingsScreen.tsx:1351` mounts `<PhotoSourcePicker target={{kind:"profile"}}>` ("Your photo"); `PhotoSourcePicker.tsx:111` types navigation as `NativeStackNavigationProp<RootStackParamList>` and calls `navigate("CropPhoto")` at :143 (library pick) and :213 (URL). Per the Plan 01 route→tab map, `CropPhoto` is registered only in DashboardStack (+ OrreryStack via the Profile family), **not SettingsStack** → route-not-found crash on "Settings → Your photo → pick / add by URL". It is the SAME class as N18/N19/N10 and is still absent from the thrice-"complete" D-08 inventory. It hides because `PhotoSourcePicker` is a shared component mounted in EditContactScreen (Dashboard/Orrery — safe), PhotoFieldWidget (Edit/Create — safe), AND SettingsScreen (Settings — crashes). **Fix:** register `CropPhoto` in SettingsStack (one component, multi-registered like the Profile family; after crop it does `setContactPhoto` then `goBack()`, so Back is origin-aware to Settings), add an inventory row (N20) + update the route→tab map, and make Plan 03's re-audit enumerate every MOUNT SCREEN of each shared navigating component (not just the first mount / the owning stack).
2. **Shell-mounted `UniversalFab` calls `useBottomTabBarHeight()` from a NavigationContainer sibling** (codex; orchestrator-verified). Plan 05 mounts `<UniversalFab/>` "at shell level … as a sibling of the tab navigator" (App.tsx:310 renders such siblings) yet derives its bottom offset from `useBottomTabBarHeight()` (finding C). That hook is context-bound to a descendant of a bottom-tab navigator and throws ("Couldn't find the bottom tab bar height…") outside it — so the FAB, the shell's main capture control, would crash on mount / fail to place. `useBottomClearance`'s use of the same hook is fine because it runs INSIDE tab screens (HomeScreen etc.); the FAB's shell-sibling mount is the problem. **Fix (planner call):** either mount the FAB inside a tab-screen context / a custom measured tab bar, or source the tab-bar height without the context hook (e.g. a measured value published to a store) so the shell-level FAB and the in-screen clearance stay single-sourced without calling the context hook from outside the tab tree.

### Actionable non-HIGH concerns remaining (not yet incorporated or deferred in PLAN.md)
- **Widen Plan 03 Task 1's grep re-audit beyond `src/screens src/components`** to include `src/services/` (and note `import-acquire.ts:172-174` in the D-08 inventory as intra-SettingsStack). Otherwise the "complete audit" claim stays falsifiable and service-layer navigate pass-throughs are invisible to the audit. [codex + cursor, MEDIUM]
- **Correct Plan 04's child-chrome deferral rationale** (22-04-PLAN.md Task 1, ~line 105): it says the deferral is safe "since shell transients are hidden on child screens" — the FALSE rationale Plan 02 explicitly corrected (the FAB is VISIBLE on browse child surfaces). Replace it with the verified full-screen-scrim-interception reasoning already in Plan 02. [codex, MEDIUM]
- **Make `useBottomClearance`'s safe-area inset contract explicit** (22-04-PLAN.md Task 2): the must_have says "`useBottomTabBarHeight()` + safe-area insets" but the action describes only tab height + FAB geometry. State whether `useBottomTabBarHeight()` already includes the bottom inset — adding it blindly double-pads; omitting it can under-clear — and pin it down for both gesture-nav and three-button configs. [codex, MEDIUM]
- **Add a compile-safety contingency to Plan 01's typing strategy:** state that if per-tab registration of `RootStackScreenProps<T>`-typed screens fails `tsc`, the affected consumer screens (EditContactScreen, RestoreResultScreen, …) enter Plan 01's scope via composite/tab props — so the executor is not forced into an out-of-scope migration to reach the plan's own `tsc`-green acceptance criterion. [codex HIGH / cursor LOW — divergent; recorded as actionable]

Minor / non-counted (fold into execution, no PLAN change required to converge): the OrreryScreen `useShellRefresh` data-path wiring and the EditContactScreen `:451` no-replay pop behavior are already verify-on-execution steps in Plans 06/03 (open questions, not defects); the inventory labels `CreateContactScreen:187` a `navigate` where it is `replace` (harmless — intra-DashboardStack, and the grep regex covers `replace`); restore bulk-upserts `interactions` directly (restore-apply.ts:160) — a legitimate exception worth a one-line note in the data-layer inventory; add `CropPhoto` + the four FAB placeholders to the focused-route classification test.

---

## Codex Review

## Summary

Cycle-2’s three HIGH findings are substantively addressed: Plan 03 now covers both stranded `ImportReviewScreen` Profile completions; the Edit photo behavior is correctly described as immediate persistence rather than discardable form state; and Plan 04 now waits for Plan 02. The plans are much stronger on nested reset shape, external-entry preservation, and Quick Log write truthfulness. Two implementation-level gaps remain: the proposed screen typing migration is not executable as scoped, and the shell-level FAB cannot directly consume the bottom-tab-height hook from outside the tab subtree.

## Strengths

- **Plan 01:** Correctly identifies the real flat root navigator and preserves the migration gate. The existing app mounts `RootNavigator` only after readiness inside the `NavigationContainer` at [App.tsx](/home/bwales/projects/orbit-app/App.tsx:309), while the current root is a single 32-route native stack at [RootNavigator.tsx](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:72). The planned nested reset changes address actual flat resets and ref navigations at [linking.ts](/home/bwales/projects/orbit-app/src/navigation/linking.ts:36), [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:274), and [notification-gate.tsx](/home/bwales/projects/orbit-app/src/navigation/notification-gate.tsx:136).

- **Plan 01 / Plan 03:** The two cycle-2 import crashes are correctly found and assigned. `ImportReviewScreen` is currently typed with the broad root props and calls `replace("Profile")` after both a new import and a duplicate link at [ImportReviewScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ImportReviewScreen.tsx:215) and [ImportReviewScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ImportReviewScreen.tsx:289). Once it is in SettingsStack while Profile is not, both would fail at runtime. Plan 03’s Dashboard nested reset is the right completion semantics.

- **Plan 01:** The external fallback handling is carefully preserved. The widget resolver’s strict digit-only parsing and positive-safe-integer guard exist at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:103), and the missing-contact flow currently alerts and resets at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:265). Restricting the change to dispatch shape protects that behavior.

- **Plan 03:** The photo correction is accurate. Edit explicitly documents that its photo DAO writes immediately, independently of metadata Save, at [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:170), and it re-reads photo state on focus without reseeding the form at [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:227). The DAO implementations confirm separate committed transactions at [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:647) and [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:660). Excluding photo from the discard delta is truthful; the documented owner deferral is appropriate.

- **Plan 03:** The existing Edit completion is correctly targeted for no-replay work. It presently uses `navigation.navigate("Profile")` at [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:451), so the executor must verify native-stack behavior rather than assume the completed Edit disappears.

- **Plan 04:** The dependency correction is valid. It now explicitly depends on 22-02, whose back-intent module is required by ShellAppBar. This resolves the former parallel compile-order problem.

- **Plan 05 / Plan 06:** Quick Log is grounded in the canonical DAO and existing one-tap call. `recordTouchpoint` writes and recomputes recency transactionally at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217); the Profile’s canonical call supplies `newUid()`, one local timestamp, outbound/manual/unspecified defaults at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:339). Undo correctly reuses the guarded two-key delete and recency recomputation at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:313).

- **Plan 06:** The ADR-075 guard is specific and sound for the new picker query. Existing user-visible reads still order by rank, including [dashboard-read.ts](/home/bwales/projects/orbit-app/src/db/dashboard-read.ts:245) and [capture-read.ts](/home/bwales/projects/orbit-app/src/db/capture-read.ts:65); the proposed membership-band plus recency ordering avoids creating another violating read. Retaining the `ManageFavourites` route for `orbit://favourites` is correctly owner-flagged, not a defect.

## Concerns

- **HIGH — Plan 01’s typing strategy is under-scoped and likely will not compile as written.** The plan retains all existing `RootStackScreenProps<T>` consumers while each new stack is typed with a narrower tab param list. Current screen components require root-stack navigation props, e.g. [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:145) and [RestoreResultScreen.tsx](/home/bwales/projects/orbit-app/src/screens/RestoreResultScreen.tsx:5). A `DashboardStack` cannot supply a navigation object typed for routes from Backup/Settings, so passing these components directly to a narrower `Stack.Screen` is not type-safe. Plan 01 explicitly promises no consumer migration at [22-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/22-app-shell-navigation/22-01-PLAN.md:218), but its Task 1 file list does not include the many affected screens. `tsc` is an acceptance criterion, not a migration mechanism.

- **HIGH — The shell-mounted FAB is planned outside the tab navigator but directly calls `useBottomTabBarHeight()`.** The current container renders its siblings alongside `RootNavigator` at [App.tsx](/home/bwales/projects/orbit-app/App.tsx:309). Plan 05 similarly places `UniversalFab` as a `NavigationContainer` sibling while requiring `useBottomTabBarHeight()` in that component. The hook is only valid beneath bottom-tab context; a sibling is not a tab screen descendant. This risks a runtime “bottom tab bar height unavailable” failure and blocks the promised cross-tab FAB placement.

- **MEDIUM — The literal re-audit is still not repo-wide.** Plan 03 searches only `src/screens src/components` at [22-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/22-app-shell-navigation/22-03-PLAN.md:107). There is a production navigation helper outside those directories: [import-acquire.ts](/home/bwales/projects/orbit-app/src/services/import/import-acquire.ts:156) navigates to `ImportReview` and `BulkImportSetup` at lines 172–174, invoked from Settings at [SettingsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:157). These are currently intra-Settings and safe under the proposed assignment, but their omission disproves the claimed complete audit mechanism and invites the next missed site.

- **MEDIUM — Plan 04 repeats the previously rejected rationale about child screens.** Plan 02 correctly says the FAB remains visible on Profile, Archived, Never Contacted, and Unbound Contacts, relying instead on full-screen scrim interception. But Plan 04 says its child-chrome deferral is safe because shell transients are “hidden on child screens” at [22-04-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/22-app-shell-navigation/22-04-PLAN.md:105). The current FAB is indeed an absolute full-screen overlay, not inherently root-only, at [AddSpeedDialFab.tsx](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:72) and [AddSpeedDialFab.tsx](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:132). This should be corrected so the phase does not retain contradictory safety reasoning.

- **MEDIUM — `useBottomClearance`’s stated safe-area behavior is not fully specified.** Plan 04 promises a hook based on tab height and safe-area insets, but its action describes only tab height plus FAB geometry. Whether tab height already incorporates the bottom inset must be explicitly verified; adding the inset blindly can double-pad, while omitting it can under-clear on devices where the custom tab bar does not include it.

- **LOW — The phase’s interaction-writer inventory should record restore as an intentional exception.** Quick Log and Undo use the canonical DAO correctly, but the shared `interactions` table is also directly upserted by backup restore at [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:160). That is legitimate bulk restoration, not a reason to change Quick Log, but documenting it would make the claimed data-layer review complete.

## Suggestions

- Amend Plan 01 with an explicit compile-safe route typing approach: migrate each registered screen to its owning stack/composite props, or use typed route wrappers that adapt navigation. Include every required affected screen in the plan’s file scope.

- Move FAB geometry ownership to `RootNavigator` through a measured custom tab bar/store, or render the FAB beneath an actual tab-screen context. Do not call `useBottomTabBarHeight()` from the `NavigationContainer` sibling.

- Change Plan 03’s audit command to a repository-wide navigation sweep, including `src/services`, `src/navigation`, and `App.tsx`; record `routePickedImport` as Settings-local.

- Replace Plan 04’s “hidden on child screens” language with the verified full-screen-scrim reasoning already captured in Plan 02.

- Make the clearance hook’s inset contract explicit and test it on gesture-navigation and three-button Android configurations.

## Risk Assessment

**MEDIUM-HIGH.** The cycle-2 HIGHs are resolved in plan intent, including the ImportReview crash and photo/Discard truthfulness. However, the unresolved navigator prop typing approach can block Plan 01’s compilation, and the shell-sibling FAB/tab-height context issue can produce a runtime failure across the main capture control. These should be repaired before execution; the remaining route and data-path mechanisms are well traced.

---

## Cursor Review

# Cross-AI Plan Review — Phase 22 (Convergence Cycle 3)

## Executive Summary

The cycle-3 revisions materially address the three cycle-2 HIGH findings: ImportReview `replace("Profile")` crashes (N18/N19), EditContact photo/Discard truthfulness, and Plan 04’s compile-time dependency on Plan 02. Verification against on-disk code confirms the crash sites exist exactly where the plans claim (`ImportReviewScreen.tsx:215/:289`, `MergeImpactSummary.tsx:17`), the photo is immediately persisted outside the Save path (`EditContactScreen.tsx:171-176/:227-247`), and Plan 04 is now wave 3 with `depends_on: [22-01, 22-02]`.

The plans are unusually well grounded in actual navigation call sites, ADR constraints, and DAO behavior. The D-08 inventory is substantially improved (N18/N19 added; literal grep re-audit mandated). Remaining gaps are mostly boundary/deferral items: partial SHELL-03 coverage on child-screen visible Back, a grep re-audit scope that omits `src/services/`, and ADR-075 enforcement that is correctly split between planner enforcement and owner-flagged deferrals.

**Overall risk: MEDIUM** — architecture and crash fixes look sound; execution risk concentrates in cross-tab navigation completeness, shell Back parity on browse child screens when no transient is open, and the shell-refresh freshness wiring for Orrery.

---

## Cycle-2 HIGH Resolution

| # | Finding | Resolved in plans? | Evidence |
|---|---------|-------------------|----------|
| 1 | ImportReview `replace("Profile")` post-split crash | **Yes** | On disk: `ImportReviewScreen.tsx:215`, `:289`. Plan 03 Task 1 reshapes both to `navigationRef.reset(resetToDashboardWith({ name: "Profile", params: { contactId } }))`. `:239 replace("ImportComplete")` correctly left intra-SettingsStack. |
| 2 | Photo/Discard false promise | **Yes** | On disk: photo is separate state, committed via `setContactPhoto`/`clearContactPhoto`, re-read on focus (`EditContactScreen.tsx:171-176/:227-247`). Plan 03 Task 3 excludes photo from `hasUnsavedChanges` and owner-flags “stage until Save” alternative. |
| 3 | Plan 04 missing Plan 02 dependency | **Yes** | `22-04-PLAN.md:5-6` — wave 3, `depends_on: [22-01, 22-02]`. Objective note explains ShellAppBar Back imports `back-intent.ts` from Plan 02. Wave order: 01 → {02,03} → 04 → 05 → 06. |

---

## Plan 22-01 — Four-Tab Shell + Nested Resets

### Summary
Strong tracer plan. Correctly reads the current flat `RootNavigator.tsx` (32-route single stack) and partitions routes against real launch sites (Settings-owned import/reconcile, not BackupStack). External-entry reshaping via `reset-intents.ts` and `navigationRef` retype to `TabParamList` closes the tsc-blind container-nav hole visible today in `linking.ts:36-37` (`NavigationContainerRef<RootStackParamList>`) and `linking.ts:64/:67` (bare `navigate("Backup")` / `navigate("Capture")`).

### Strengths
- **D-08 inventory is evidence-backed.** Verified crash class: `ImportReviewScreen.tsx:215/:289`, `MergeImpactSummary.tsx:17`. Verified external resets: `ComposeScreen.tsx:267`, `notification-gate.tsx:136/:138`, `widget-linking.ts:274/:287`.
- **Birthday notification gap correctly identified.** `notification-nav.ts:101-105` returns `{ type: "navigate", name: "Profile" }`; container-level post-split this is route-not-found. Plan reshapes to reset intent (A2b).
- **Widget reshape strategy is safe.** Keeps flat `WidgetNavIntent` / resolver (`widget-linking.ts:127-152`) and reshapes only at dispatch (`:274/:287`), preserving `pending.routes[1]` / `openReachOut` reads.
- **ADR-075 posture is correct.** Enforces no new `favourite_rank ASC` reads; removes UI entries; owner-flags route retirement because `orbit://favourites` still resets to `[Home, ManageFavourites]` (`widget-linking.ts:132-137`).
- **Orrery→Profile origin fix is real.** `OrreryScreen.tsx:433/:441` navigates to Profile; dual-registration in OrreryStack is the right mechanism given `ContactProfileScreen.tsx:762` uses plain `goBack()`.

### Concerns
- **MEDIUM — D-08 inventory still incomplete for service-layer navigators.** `routePickedImport` in `import-acquire.ts:172-174` calls `navigation.navigate("ImportReview"|"BulkImportSetup")`. Not listed in D-08. Currently safe because callers are SettingsStack screens (`SettingsScreen.tsx:160-168`, `LegacyContactPickerScreen.tsx`), but the inventory’s “COMPLETE” history warrants listing service-layer navigate pass-throughs explicitly.
- **LOW — Capture in OrreryStack deferred to execution.** Plan 01 Task 1: “Confirm at execution whether an Orrery-origin Profile reaches Capture.” Acceptable, but a miss would strand Capture from Orrery-origin Profile→Compose paths.
- **LOW — `RootStackParamList` back-compat alias preserves tsc-blindness for component props.** Plan acknowledges this; Plan 03’s literal grep is the backstop. Correct posture, but fragile for new call sites.

### Suggestions
- Add D-08 rows for `import-acquire.ts:172-174` and `start-contact-import.ts:34` (`LegacyContactPicker`), marked intra-SettingsStack when called from Settings/import cluster.
- Extend Plan 03 grep re-audit to `src/services/` and `src/navigation/` (excluding Plan-01-owned files) so “COMPLETE” claims are harder to falsify.

### Risk Assessment
**MEDIUM** — Foundational; a wrong tab partition is costly, but the plan’s route map matches on-disk launch sites and external-entry sites are enumerated with tests.

---

## Plan 22-02 — Transient Store, Back Intent, Nav Visibility

### Summary
Delivers the behavioral core for SHELL-02/03/06. The `{id, dismiss}` callback model in `shell-transient-store` correctly addresses the AddSpeedDialFab pattern where local React state owns visibility (`AddSpeedDialFab.tsx:30-35`; `add-speed-dial-fab-logic.ts:23` returns `"auto"` when open). The cycle-2 correction about FAB visibility on browse child screens (Profile, Archived, etc.) is verified and properly replaces the false “FAB hidden on child screens” rationale.

### Strengths
- **Scrim-interception rationale is verified.** `AddSpeedDialFab.tsx:72-77` uses `absoluteFill` scrim with `speedDialScrimPointerEvents(open)`.
- **Focused-workflow allow-list is explicit** and includes import/reconcile/merge form routes plus future FAB placeholders — drives SHELL-06 nav hide correctly.
- **Origin-aware Back preserved.** Resolver only intercepts transients; ordinary back pops focused tab stack.
- **Deferral documented with caveat.** Plan 02 Task 3 documents that safety depends on full-screen scrim coverage; future non-full-screen overlays require child Back migration.

### Concerns
- **MEDIUM — Partial SHELL-03 on visible Back vs dossier literal.** Dossier success criterion: “Android system Back and the visible Back control behave identically on **every screen**.” Plan defers child-screen visible Back controls (`DigestScreen:128`, `ArchivedContactsScreen:181`, `NeverContactedScreen:87`, `UnboundContactsScreen:55`, `BackupScreen:288`) and focused-workflow handlers (`ComposeScreen.tsx:404`, `CaptureScreen.tsx:216`). Deferral is **safe when no transient is open** (child `goBack()` equals default), but **not identical when a transient is open** unless scrim blocks child Back — documented, not silent.
- **MEDIUM — Compose/Capture consume hardware Back before shell handler.** `ComposeScreen.tsx:404-406` and `CaptureScreen.tsx:216-224` return `true` from focused `BackHandler`. This is intentional (ADR-044 Compose exit, Capture cancel), but means shell transient dismissal does not apply while those screens are focused — acceptable because FAB/nav are hidden via `isFocusedWorkflow`.
- **LOW — `getFocusedStackNav` referenced but pattern depends on RESEARCH.** Execution must match bottom-tabs v7 nested navigation APIs.

### Suggestions
- Add acceptance criterion: on Profile with speed dial open, **visible Back is not tappable** (scrim intercept) and system Back dismisses dial — proves deferral safety on a browse child surface where FAB is visible.
- List `ComposeScreen` / `CaptureScreen` in focused-route classification (already planned) and cross-reference their custom BackHandler in Plan 02 Task 3 comments.

### Risk Assessment
**MEDIUM** — Core behavior is well-designed; residual risk is maintainer drift if scrim geometry changes.

---

## Plan 22-03 — In-App Navigate Reconciliation, No-Replay, Discard/Keep

### Summary
The strongest cycle-3 improvement. Directly fixes verified post-split crash sites and adds the reusable Discard/Keep primitive with accurate photo semantics. Completion resets and Backup-local resets are correctly distinguished.

### Strengths
- **N18/N19 fix matches on-disk crash sites.** `ImportReviewScreen.tsx:215/:289` confirmed; fix via `resetToDashboardWith` is consistent with N9/N10 treatment.
- **Merge completion fix verified.** `MergeImpactSummary.tsx:17` — `navigation.replace("Profile", { contactId: survivorId })` crashes from SettingsStack reconcile origin.
- **Photo truthfulness verified against code.** `EditContactScreen.tsx:171-176` documents immediate DAO commit; `:227-247` focus re-read without reseeding form. Excluding photo from dirty delta is the honest fix.
- **Confirmed-save bypass addresses real bug.** Save navigates at `:451` while form still dirty; `bypassRef` before navigate is necessary.
- **No-replay likely already correct.** `ContactProfileScreen.tsx:310-314` documents that `navigation.navigate("Profile")` from Edit pops to existing Profile instance; Plan 03 Task 2 correctly says verify before changing.
- **Backup-local resets verified.** `RestorePreviewScreen.tsx:99/:123`, `RestoreResultScreen.tsx:18` reset to `{ name: "Backup" }` — correct if Backup is BackupStack root (Plan 01 assigns it).
- **Literal grep re-audit mandated** after two false “COMPLETE” claims — appropriate.

### Concerns
- **MEDIUM — Grep re-audit scope too narrow.** Plan 03 Task 1 specifies `grep ... src/screens src/components` only. Misses `src/services/import/import-acquire.ts:172-174`, `src/navigation/linking.ts`, `notification-gate.tsx`, etc. Plan 01 owns some of these, but service-layer navigate pass-throughs should be in scope.
- **MEDIUM — Partial-save baseline reset is subtle.** Plan requires resetting `seedInputRef`/`committedValuesRef` after `reseedMetadataAfterPartialSave` (`EditContactScreen.tsx:422-430`) while keeping links dirty. Correct design; high regression risk if executor skips reset points.
- **LOW — Custom-field dirty tracking allows coarse boolean.** Plan permits `customFieldsDirty` toggle if per-field diff is impractical — acceptable with explicit reset points.

### Suggestions
- Widen grep re-audit to `src/` excluding test files, or split: Plan 01 verifies container/external sites; Plan 03 verifies all component + service navigate pass-throughs.
- Add SUMMARY assertion that `EditContactScreen.tsx:451` uses `navigate("Profile")` (pop-to-existing) not push — document no-replay without unnecessary code change.

### Risk Assessment
**MEDIUM** — Highest-value plan for crash prevention; execution discipline on grep audit and discard baselines is the main risk.

---

## Plan 22-04 — Shell Chrome, Clearance, Dashboard Entries

### Summary
Correctly unblocked by Plan 02 dependency fix. Delivers SHELL-12/13/14 chrome layer with shared FAB geometry constants (finding C) and ADR-075 entry removals at verified sites (`HomeScreen.tsx:319`, `SettingsScreen.tsx:2008`).

### Strengths
- **Dependency fix resolves cycle-2 HIGH #3.** `depends_on: [22-01, 22-02]`; ShellAppBar Back wires to `back-intent.ts` (Task 1 read_first `:99`).
- **Finding C (FAB geometry single-sourcing) is concrete.** `FAB_SIZE` / `FAB_EDGE_GAP` exported from `use-bottom-clearance.ts` for Plan 05 — prevents legacy `bottom:28` collision with tab bar.
- **OverflowMenu a11y gap verified.** `OverflowMenu.tsx:46-51` — Modal lacks `accessibilityViewIsModal`; upgrade specified.
- **Header cross-tab reconciliation verified.** `HomeScreen.tsx:536/:554/:572` bare navigates to Backup/Orrery/Settings — post-split failures; conversion to `*Tab` switches is correct. `:517 Digest` correctly left intra-DashboardStack.
- **D-09 Archived routing.** Removes footer `:407`; overflow + Settings row remain as two entry points. Dual-registration in Plan 01 preserves origin-aware Back.

### Concerns
- **MEDIUM — SHELL-13 partial for child screens.** ShellAppBar applied to four tab roots only; existing child chrome unchanged until later pass. Matches stated boundary, but success criterion #5 (“shell chrome behaves contextually”) is only partially met this phase.
- **LOW — Redundant header shortcuts retained.** Backup/Orrery/Settings header icons duplicate bottom tabs — correctly owner-flagged, not silently removed.
- **LOW — GroupEvents placeholder only on DashboardStack.** Correct per dossier (not fifth tab); Phase 33 seam is clear.

### Suggestions
- In Task 2, explicitly note whether `OrreryScreen` scrolls; if not, document skip in SUMMARY (plan already allows this).
- Add source assertion that removed `HomeScreen.tsx:407` footer does not remove Settings `:2038` Archived entry (second D-09 entry point).

### Risk Assessment
**LOW–MEDIUM** — Mostly presentational; dependency ordering is now correct; main risk is incomplete app-bar rollout across child screens.

---

## Plan 22-05 — Universal FAB

### Summary
Solid expansion from two-action `AddSpeedDialFab` to six-action shell-level `UniversalFab`. Correctly addresses shell-level nested routing (finding D: `getFocusedContactContext`) and transient registration with real dismiss callbacks.

### Strengths
- **Shell-level nested routing is necessary.** Current `AddSpeedDialFab.tsx:98` uses bare `navigation.navigate("Create")` — fails from shell-level mount post-split. Plan 05’s `{ tab, screen, params }` intents fix this (same class as Plan 03).
- **D-05 six-action set enforced** with frozen ordered array and node tests.
- **Group Log direct, no pre-picker** — matches dossier.
- **Reanimated/shared-value discipline** retained from AddSpeedDialFab; pointerEvents gated on React `open` state only.
- **Import-from-contacts removal is intentional.** Old FAB had import (`AddSpeedDialFab.tsx:50-68`); six-action set does not include it. Import remains on Settings (`SettingsScreen.tsx:157-168`) — not a silent product reversal.
- **Depends on Plan 04 geometry constants** — wave order correct (`depends_on: [22-02, 22-04]`).

### Concerns
- **MEDIUM — Shell-level navigation typing.** Plan says use retyped `navigationRef` or tab-typed navigation; must compile against `TabParamList`. Executor must not pass Dashboard-scoped `useNavigation` hook from a shell sibling.
- **LOW — `getFocusedContactContext` must handle tri-registered Profile in DashboardTab and OrreryTab** — plan covers both; tests require four cases.
- **LOW — Deleting `AddSpeedDialFab.tsx` removes dashboard-only import entry.** Acceptable per D-05; worth noting in UAT that import is Settings-only now.

### Suggestions
- Add acceptance test that FAB Add Contact from OrreryTab dispatches `navigate("DashboardTab", { screen: "Create" })` — proves cross-tab shell routing.
- Confirm UniversalFab hides on `ManageFavourites` (browse route in allow-list false) — widget deep-link landing surface.

### Risk Assessment
**MEDIUM** — Shell mount + nested routing is easy to get wrong; plan’s pure helpers and tests mitigate.

---

## Plan 22-06 — Picker + Commit-Truthful Quick Log

### Summary
Closes the capture loop with ADR-075-compliant picker ordering, truthful snackbar, and a concrete freshness mechanism (`shell-refresh-store`) that addresses a real stale-data gap verified on disk.

### Strengths
- **Quick Log write contract verified against canonical path.** `ContactProfileScreen.tsx:339-349` — `uid: newUid()`, `localDateTime()` for both timestamps, explicit direction/channel/connected. Plan 06 mirrors exactly.
- **`deleteTouchpoint` reuse verified.** `recency-dao.ts:313-345` — delete-by-both-keys, tombstone, recompute; **does not** call `bumpDataRevisionCore` (unlike `recordTouchpoint` at `:240`). Shell-refresh + `notifyWidgetDataChanged` after Undo is necessary and correctly specified.
- **ADR-075 picker read is correct.** Plan forbids `favourite_rank ASC` (present in `capture-read.ts:66`, `dashboard-read.ts:245`, `sun-picker-read.ts:45`); uses `(favourite_rank IS NULL)` membership band instead.
- **Local-first read path.** `picker-read.ts` mirrors capture-read posture: static SQL, `getAllAsync`, no network — aligns with `HomeScreen.tsx:17-21` local-first reads.
- **DASH-07 non-reversal explicit.** `HomeScreen.tsx:9-15` deliberately avoids connection-scoped SQLite notification; `shell-refresh-store` is in-process app event — plan documents this distinction correctly.
- **Failure haptic correction (finding G).** No error haptic on `.catch` — consistent with dossier §M taxonomy.

### Concerns
- **MEDIUM — Orrery freshness path left conditional.** Plan 06 Task 3: “VERIFY OrreryScreen data path on disk; wire `useShellRefresh` or document why skipped.” Skia/orrery re-query path must be verified at execution or Quick Log from Orrery won’t update orbit positions until refocus.
- **MEDIUM — Snoozed marker logic depends on `snooze_until` semantics.** Plan defines “in the future” — executor must use same wall-clock helper as rest of app (`localDateTime` / existing snooze reads), not raw string compare bugs.
- **LOW — Coarse `customFieldsDirty` not in this plan** (Plan 03 territory) — no issue here.
- **LOW — Retry re-invokes same `recordTouchpoint` path** — could double-write if first call partially succeeded; `recordTouchpoint` is transactional so Retry after true failure is safe.

### Suggestions
- Require SUMMARY to state Orrery refresh mechanism explicitly (which function re-reads recency-derived positions).
- Add node test in `contact-picker-order.test.ts` for snoozed = `snooze_until` in future per app’s date comparison utility.

### Risk Assessment
**MEDIUM** — SHELL-11 truthfulness design is strong; freshness wiring and Orrery re-query are the main execution risks.

---

## Cross-Cutting Assessment

### SHELL requirement coverage (SHELL-01..15)

| Req | Coverage | Notes |
|-----|----------|-------|
| SHELL-01/15 | Plan 01 | Four tabs, crossfade, per-tab stacks, migration gate preserved |
| SHELL-02 | Plan 02 | Active-tab retap with transient dismiss |
| SHELL-03 | Plans 02, 03 | **Partial** on child visible Back (deferred, documented) |
| SHELL-04 | Plans 01, 02, 03 | Dual/tri-registration + crash fixes |
| SHELL-05 | Plans 01, 03 | External + completion resets; missing-contact Alert preserved |
| SHELL-06 | Plans 02, 05 | Nav + FAB hide on focused/keyboard |
| SHELL-07 | Plan 03 | Discard/Keep with photo exclusion |
| SHELL-08/09 | Plans 05, 06 | Six-action FAB + picker/preselect |
| SHELL-10 | Plan 06 | ADR-075-compliant picker ordering |
| SHELL-11 | Plan 06 | Commit-truthful Quick Log |
| SHELL-12 | Plan 04 | Group Events + Archived Dashboard reachability |
| SHELL-13/14 | Plans 04, 05, 06 | App bar, clearance, a11y, haptics |

### Local-first commitment
No plan introduces network on read paths. Quick Log write is on-device SQLite via existing DAOs. Picker read is static SQL. **No concern.**

### Decision-reversal escalation
No silent reversals detected. Owner-flagged deferrals are correctly posture:
- (a) `ManageFavourites` route retained for `orbit://favourites` (`widget-linking.ts:132-137`)
- (b) Photo staging alternative owner-flagged (`EditContactScreen.tsx:171-176`)
- ADR-044 external→Dashboard fallback preserved (reshaped, not removed)
- ADR-018 archive gate untouched

### Scope creep
Plans stay within shell/routing exposure. Placeholder routes for unbuilt FAB actions and GroupEvents are explicit seams — not creep.

---

## Overall Risk Assessment

**MEDIUM**

**Justification:** Cycle-2 HIGHs are substantively resolved with file-backed evidence. The architecture (tab partition, reset-intents single owner, transient dismiss callbacks, photo truthfulness) matches on-disk reality. Remaining risk is execution-shaped: navigation call-site completeness (grep scope, service-layer pass-throughs), partial SHELL-03 on child visible Back (accepted deferral with documented scrim dependency), and Orrery/shell-refresh wiring in Plan 06. None of these appear to reverse recorded decisions; the highest-impact crash fixes (ImportReview, merge completion, container external navigates) are correctly owned and specified.

---

## Priority Actions Before Execution

1. **Widen Plan 03 grep re-audit** to include `src/services/` navigate pass-throughs; add `import-acquire.ts:172-174` to D-08 inventory.
2. **Verify Orrery refresh path** during Plan 06 — do not leave as optional prose.
3. **UAT on Pixel** for the three cycle-2 HIGH paths: ImportReview single-import + duplicate-link → Profile on Dashboard tab; Edit photo-only Back (no prompt, photo persists); merge from reconcile flow → survivor Profile.
4. **UAT transient + visible Back on Profile** with speed dial open — proves Plan 02 deferral safety on a browse child surface.

---

## Claude Review (read-only subagent lane)

# Phase 22 — Cross-AI Plan Review (Claude lane), Convergence Cycle 3

Scope: the 6 plans at `.planning/phases/22-app-shell-navigation/22-0{1..6}-PLAN.md`, `22-CONTEXT.md`, and `ROADMAP.md` §Phase 22, verified against the code on disk at `/home/bwales/projects/orbit-app` (HEAD `f4f7aad`). Every `file:line` below was opened and confirmed; where I could not confirm, I say so.

---

## Plan 22-01 — Four-tab shell + nested-reset owner + navigationRef retype

**1. Summary.** Converts the single flat `createNativeStackNavigator` into the ADR-080 four-tab shell, retypes `navigationRef` to `NavigationContainerRef<TabParamList>`, and creates `reset-intents.ts` as the single nested-reset owner. This is the phase anchor and carries the D-08 inventory. The architecture and the on-disk premises are accurate; the inventory is materially complete but has one remaining miss (see the overall HIGH).

**2. Strengths (verified).**
- D-06 premise correct: `src/navigation/RootNavigator.tsx:57` is a single `createNativeStackNavigator<RootStackParamList>()` with 32 `Stack.Screen` blocks; `@react-navigation/bottom-tabs` is NOT in `package.json` (both as the plan states).
- `docs/decisions/ADR-080-*.md` and `docs/decisions/ADR-075-*.md` both exist on disk.
- ADR-075 premises all verified: `favourite_rank ASC` reads live at `dashboard-read.ts:245` + `:333`, `sun-picker-read.ts:45`, `capture-read.ts:66`; there is NO `is_favourite` boolean column (grep empty) — so membership is `favourite_rank IS NOT NULL`, exactly as the compliance block asserts. Keeping the `ManageFavourites` route registered (widget deep-link) and deferring full retirement to the owner is the correct posture.
- `navigationRef` is presently typed `NavigationContainerRef<RootStackParamList>` (linking.ts, the `createRef` after the ShareIntent doc-block) — the exact tsc-blind hole the retype closes. ShareIntent `navigationRef.current?.navigate("Backup")`/`("Capture")` confirmed in `ShareIntentGate` (N1/N2).
- `widget-linking.ts` verified: id guard `Number.isSafeInteger(id) || id <= 0` at :115; `pending.routes[1]` read at :260; the two reset dispatches at :274 (missing-contact) and :287 (success); the `ManageFavourites` branch at :91/:136. The plan's "reshape at the dispatch only, keep resolver flat" instruction matches the code structure.
- `notification-nav.ts` verified: birthday intent is `{ type: "navigate", name: "Profile" }` at :103-104 (A2b); decay/digest are `type: "reset"` intents at :80/:92 — so the A2b reshape-to-reset is a real, needed change, correctly scoped.
- Profile Back is a plain `navigation.goBack()` (`ContactProfileScreen.tsx:762`), so the origin-aware claim holds by construction with dual-registration; OrreryScreen taps `navigate("Profile",{contactId})` at :433/:441 (N7) — real, so dual-registering the Profile family in OrreryStack is required, not optional.

**3. Concerns.**
- **HIGH (shared with overall):** the D-08 inventory, re-swept and re-declared complete in cycle 3, STILL omits a live route-not-found site — `SettingsScreen.tsx:1350` mounts `<PhotoSourcePicker target={{kind:"profile"}}>` ("Your photo"), and `PhotoSourcePicker.tsx:143`/`:213` calls `navigation.navigate("CropPhoto", …)` typed `NativeStackNavigationProp<RootStackParamList>`. Per the route→tab map (Plan 01 line 206) `CropPhoto` is registered only in DashboardStack (+ OrreryStack via the Profile family) — NOT SettingsStack. See the overall section for full mechanism and fix.
- **LOW (doc accuracy, not a defect):** the inventory calls `CreateContactScreen:187` a `navigate("Profile")` site; on disk it is `navigation.replace("Profile", { contactId })`. Harmless (intra-DashboardStack either way, and the Plan 03 grep regex includes `replace`), but the label is imprecise.

**4. Suggestions.** Add `CropPhoto` to the SettingsStack registration set (one `CropPhotoScreen` component, dual/tri-registered like the Profile family — Pitfall 6 permits; after crop it does `setContactPhoto` then `goBack()`, so origin-aware Back to Settings works). Add the row to the inventory (call it N20) and update the route→tab map line 206/207/209. Fix the CreateContactScreen `replace`-vs-`navigate` label.

**5. Risk Assessment: MEDIUM.** The architecture is sound and every premise verified, but the anchor's own inventory — the artifact the whole phase leans on — still misses a crash site after three "complete" passes.

---

## Plan 22-02 — Transient store, back-intent, focused-route classification, retap, nav visibility

**1. Summary.** Adds the shell behavior contract: an ordered `shell-transient-store` holding `{id, dismiss}` entries, a pure `back-intent` resolver, a pure `isFocusedWorkflow` allow-list, tabPress retap, and focused/keyboard nav-bar visibility. Pure-module + node-test posture is correct and matches the repo idiom.

**2. Strengths.**
- The `{id, dismiss}` registry with `dismissTop()` invoking the real close callback correctly answers the earlier HIGH #5a ("an id in a set can't close a component whose visibility is local React state") — the FAB's `setExpanded(false)` and the picker's `onDismiss` are the registered callbacks (consumed by Plans 05/06).
- The child-Back deferral rationale is the VERIFIED one: I confirmed `speedDialScrimPointerEvents` returns `"auto"` when open and the scrim is `StyleSheet.absoluteFill` (the plan cites `AddSpeedDialFab.tsx:75/:133` + `add-speed-dial-fab-logic.ts:23`), so a full-screen scrim physically intercepts a child Back while a transient is open. The plan explicitly records the false earlier rationale ("FAB hidden on child screens") as wrong and keeps the correct scrim-coverage caveat — good.

**3. Concerns.**
- **LOW:** `isFocusedWorkflow` is a static allow-list; a route added later (e.g. a future FAB form) that is not added to the set silently shows the nav bar. Plan already puts it in a top-of-file constant and tests unknown→documented default, so this is acceptable, not a defect.

**4. Suggestions.** In the focused-route test, assert the four placeholder routes (LogContact/GroupLog/UpdateContact/Memory) AND `CropPhoto` explicitly resolve to `true`, since those are the routes most likely to be forgotten later.

**5. Risk Assessment: LOW.** Pure modules, node-tested, no data layer, correct dismissal semantics.

---

## Plan 22-03 — Cross-tab reshape, completion resets, no-replay, Discard/Keep

**1. Summary.** Reshapes the stranded component-nav sites (Resume prompts N3/N4, ImportComplete N8/N9, Profile→ReconcileDetail N6), fixes the merge-completion crash (N10) and the two ImportReview crashes (N18/N19) via `navigationRef.reset(resetToDashboardWith(...))`, routes completion resets through `resetToDashboardRoot()`, and adds the Discard/Keep guard with a truthful photo exclusion. This plan carries both HIGH #1 and HIGH #2 fixes; both are correctly grounded in the code.

**2. Strengths (all verified against source).**
- HIGH #1: `ImportReviewScreen` is `RootStackScreenProps<"ImportReview">` (`:74`, a SettingsStack screen). `navigation.replace("Profile", {contactId})` at `:215` (`importAsNew`) and `:289` (`linkToExisting`) — both real, both route-not-found post-split. `navigation.replace("ImportComplete", …)` at `:239` (and `:310` in `skipDuplicate`) is intra-SettingsStack and correctly left unchanged. The N18/N19 reshape to `navigationRef.reset(resetToDashboardWith({name:"Profile",…}))` is the same treatment as N9/N10 and lands on a route (`Profile`) that IS in DashboardStack — type-safe under the retyped ref.
- N10: `MergeImpactSummary.tsx:17` is `navigation.replace("Profile", {contactId: survivorId})` inside the merge-success `.then(...)`, typed `RootStackScreenProps<"MergeImpactSummary">` (`:12`) — crashes from the reconcile (SettingsStack) origin. The reshape is correct.
- HIGH #2 (photo truthfulness): verified in `EditContactScreen.tsx` — photo is separate screen state (`:177`), explicitly documented as written IMMEDIATELY by its own `setContactPhoto`/`clearContactPhoto` DAO and NOT via Save (`:171-176`); the focus effect re-reads only the photo (`:227-247`); `committedValuesRef` at `:185`; `seededLinks` at `:156`; the save navigate `navigation.navigate("Profile",{contactId})` at `:451` fires while the form is still dirty; the partial-save `reseedMetadataAfterPartialSave()` at `:428` keeps `linksDraft` and stays on the form. Excluding the photo from the dirty delta is therefore truthful, and flagging "stage until Save" for the owner is the correct CLAUDE.md posture (it would reverse the shipped immediate-commit behavior + the orphan-cleanup invariant at `:249-257`).
- The Backup-local resets (B1/B2/B3) at `RestorePreviewScreen.tsx:99`/`:123` and `RestoreResultScreen.tsx:18` are confirmed flat `reset({routes:[{name:"Backup"}...]})`, correctly kept tab-local.
- The literal grep re-audit as an EXECUTOR step (not a restated claim) is the right corrective for an inventory that has been wrong twice.

**3. Concerns.**
- **MEDIUM:** the save-completion navigate is `navigation.navigate("Profile", {contactId})` at `:451`. Task 2's no-replay step is written conditionally ("if it PUSHES Profile … change it; if it already pops/replaces, assert"). With native-stack, `navigate("Profile", …)` to a Profile already below Edit pops back to that instance (no replay) ONLY when the existing Profile's params match; if the resolver instead pushes a second Profile, Back would replay Edit. The executor must actually verify the runtime pop behavior on device, not assume it. This is flagged, not a defect — the plan already makes it a verify-on-disk step.
- **LOW:** N18's reset fires inside `importAsNew`, which is reached from three callers (`onImport`→`:245`, the duplicate-modal "Import as New"→`:322`, and directly). All three are genuine completions, so landing Dashboard/Profile is consistent — but note `importAsNew` does not itself call `finalizeSessionIfTerminal` (pre-existing; `commitSingleImport` may finalize). Out of scope (DAO writes untouched), noted for awareness only.

**4. Suggestions.** In the re-audit output, require the executor to record, for each shared COMPONENT (not just screen) that navigates, every screen it is mounted in and the owning stack of each mount — that is the exact discipline that would have caught the PhotoSourcePicker/CropPhoto miss.

**5. Risk Assessment: MEDIUM.** The two carried HIGHs are correctly fixed and verified; residual risk is the shared-component mount blind spot the re-audit must actively close, and the conditional no-replay behavior.

---

## Plan 22-04 — Shell chrome: app bar, clearance, Group Events/Archived, ADR-075 removals

**1. Summary.** Adds `ShellAppBar`, `useBottomClearance` (single-sourcing `FAB_SIZE`/`FAB_EDGE_GAP`), the GroupEvents placeholder, the Dashboard Group Events header + overflow + Archived overflow, the OverflowMenu a11y upgrade, the ADR-075 entry removals, and the header cross-tab reconciliation (N14/N15/N16). Now correctly at wave 3 / `depends_on: [22-01, 22-02]`.

**2. Strengths.**
- HIGH #3 dependency fix verified: front-matter is `wave: 3`, `depends_on: [22-01, 22-02]`, and ROADMAP shows "Wave 3 (blocked on Wave 2 … 04 depends on 02's back-intent)". ShellAppBar's child Back importing `back-intent` (Plan 02) is a real compile-time dependency, so wave 3 is correct.
- N11/N12/N14/N15/N16/N17 all confirmed on disk: `HomeScreen.tsx:319` `navigate("ManageFavourites")`, `:407` `navigate("Archived")` (footer), `:536` `navigate("Backup")`, `:554` `navigate("Orrery")`, `:572` `navigate("Settings")`; `SettingsScreen.tsx:2008` `navigate("ManageFavourites")`. The removals/conversions match ADR-075 + the route→tab map.
- The `FAB_SIZE`/`FAB_EDGE_GAP` single-sourcing (finding C) is a clean fix for FAB/tab-bar collision and is consumed by Plan 05 as stated.

**3. Concerns.**
- **LOW:** `SettingsScreen.tsx` is in this plan's `files_modified` (for the ManageFavourites row removal). This is the same file that carries the unlisted `PhotoSourcePicker`→CropPhoto crash (overall HIGH). If the CropPhoto fix ends up needing a SettingsStack registration, it belongs in Plan 01, not here — but this plan's executor will be in SettingsScreen and should be told the crash exists.

**4. Suggestions.** Keep the `dashboard-archived-entry` testID-based removal assertion; also add an assertion that the header `navigate("BackupTab"|"OrreryTab"|"SettingsTab")` names type-check via the Dashboard composite helper (the plan says so — make it a grep gate).

**5. Risk Assessment: LOW-MEDIUM.** Chrome + additive routing; the only real risk is proximity to the SettingsScreen CropPhoto miss.

---

## Plan 22-05 — Universal six-action FAB (shell-mounted) + placeholders + haptics

**1. Summary.** Replaces `AddSpeedDialFab` with a shell-mounted six-action `UniversalFab`, adds `universal-fab-logic` (pure, with `getFocusedContactContext` route-walker, finding D), the four placeholder routes, and `expo-haptics`. Correctly at wave 4 / `depends_on: [22-02, 22-04]`.

**2. Strengths.**
- The nested-target insight is correct and verified against the same crash class: a shell-level mount cannot `navigate("Create")` bare (Create ∈ DashboardStack only — `AddSpeedDialFab.tsx:98` currently does exactly `navigate("Create")`, which is why F1 needs reshaping). Returning `{tab:"DashboardTab",screen,params}` is right.
- `getFocusedContactContext` as a pure, node-tested route-walker (finding D) with a defensive null on malformed/stale state is the correct replacement for an inline walk, and its four test cases are well specified.
- The CLAUDE.md animation rule is respected (shared value for open/close; React state only for pointerEvents) and the transient-store registration passes the real close callback.

**3. Concerns.**
- **LOW:** `getFocusedContactContext(navigationRef.getRootState())` depends on the retyped `navigationRef` and the tab/route names being stable strings ("DashboardTab"/"OrreryTab"/"Profile"). These are compile-time constants, but the helper types its argument structurally — a route-name typo would pass tsc and silently return null (picker instead of preselect). The test cases mitigate this; keep the exact route-name literals asserted.

**4. Suggestions.** Assert in the test that a `SettingsTab`/`BackupTab` focus with a Profile-shaped route (defensive) still returns null — only DashboardTab/OrreryTab Profiles preselect.

**5. Risk Assessment: LOW.** Pure logic tested; the component reuses proven Reanimated/scrim patterns and the single-sourced geometry.

---

## Plan 22-06 — Shared contact picker + commit-truthful Quick Log + shell-refresh

**1. Summary.** Adds `picker-read` (ADR-075-safe ordering), `contact-picker-order` (pure), `ContactPicker`, `Snackbar` + store, `shell-refresh-store` (finding B), and wires Quick Log through `recordTouchpoint` with Undo via the existing `deleteTouchpoint`. Correctly at wave 5 / `depends_on: [22-02, 22-05]`.

**2. Strengths (data-layer claims verified).**
- `RecordTouchpointInput.uid` is REQUIRED with no DAO default (`recency-dao.ts:59-61`) — so minting `uid: newUid()` is mandatory, as the plan states.
- `recordTouchpoint` calls `bumpDataRevisionCore(exec)` at `:240`; `deleteTouchpoint` (`:313-345`) does delete-by-both-keys + tombstone + `recomputeLastContact` but does NOT call `bumpDataRevisionCore`. This is the exact asymmetry finding B is built on — so the shell-refresh mechanism is genuinely required for Undo (and for HomeScreen, which per its `:9-15` DASH-07 comment deliberately does not subscribe to the connection-scoped SQLite notification). The design is coherent and explicitly does NOT reverse DASH-07 (an in-process app event, not the connection notification).
- The canonical `doLogContact` (`ContactProfileScreen.tsx:339-349`) is exactly as the plan says: one `stamp = localDateTime()` for both `occurredAt` and `now`, `channel:"unspecified"`, `direction:"outbound"`, `connected:1`, `quality:null`, `source:"manual"`, `uid:newUid()`. The "mirror exactly" instruction is accurate.
- finding G (no haptic on write failure) is consistent with the dossier §M taxonomy the plan quotes; correcting the earlier "warning haptic on failure" is right.
- ADR-075 enforcement in the NEW `picker-read` path is correct: order by `(favourite_rank IS NULL)` membership band → `last_contact DESC` → `name COLLATE NOCASE`, explicitly NOT `favourite_rank ASC` (which `capture-read.ts:66` still does). Local-first respected — static SQL, single `getAllAsync`, no network.

**3. Concerns.**
- **LOW:** the OrreryScreen `useShellRefresh` wiring is left as "verify the data path on disk; if it already re-derives from a live store, note that and skip." I did not verify OrreryScreen's data source in this pass, so I flag it as an OPEN QUESTION rather than a defect: confirm at execution that a Quick Log affecting an orbiting contact actually re-reads without driving the Skia loop from React state.

**4. Suggestions.** Add an explicit test that `filterPicker` returns archived rows ONLY under a non-empty matching term (the plan describes it; make it a named test), and that two favourites sort by recency not rank (the plan already specifies this — keep it, it is the ADR-075 regression guard).

**5. Risk Assessment: LOW-MEDIUM.** The data-layer reasoning is correct and verified; residual risk is the unverified OrreryScreen refresh path and the general correctness of a new write-on-tap surface (mitigated by mirroring the canonical writer exactly and reusing `deleteTouchpoint`).

---

## Overall

The revision is high quality: the three cycle-2 HIGHs are genuinely fixed and every load-bearing premise I checked (route typings, `replace("Profile")` sites, photo immediate-commit, `uid` requirement, the `recordTouchpoint`/`deleteTouchpoint` revision-bump asymmetry, the `favourite_rank ASC` reads, the wave/dependency graph) is accurate against the code on disk. Local-first is respected (no network on any read path introduced). Dependency ordering is correct: `01 → {02,03} → 04 → 05 → 06`, and the Plan 04 `depends_on:[22-01,22-02]` at wave 3 matches its real compile-time import of Plan 02's back-intent.

My own repo-wide sweep — `grep -rnE 'navigation(Ref)?(\.current)?\??\.(navigate|replace|reset)\(' src/screens src/components` — cross-checked against the Plan 01 route→tab map confirms every site in `src/screens`/`src/components` is accounted for by the inventory **except one**, and the `src/navigation` + `src/services/notifications` sites (linking, widget-linking, notification-gate/nav) are all owned by Plan 01 and verified.

### NEW HIGH — unlisted cross-tab crash: SettingsScreen "Your photo" → CropPhoto

- **Evidence.** `SettingsScreen.tsx:1350` renders `<PhotoSourcePicker target={{ kind: "profile" }} …/>` (the "Your photo" row, testID `settings-your-photo-row`). `PhotoSourcePicker` gets `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` (`PhotoSourcePicker.tsx:110-111`) and calls `navigation.navigate("CropPhoto", {…})` at `:143` (library pick) and `:213` (URL path).
- **Mechanism.** Post-split, `SettingsScreen` is a SettingsStack screen. `CropPhoto` is registered only in DashboardStack (route→tab map, Plan 01 line 206) and dual-registered in OrreryStack via the Profile family — it is NOT in SettingsStack. So "Settings → Your photo → pick from library / add by URL" fires `navigate("CropPhoto")` into a stack that has no such route → **route-not-found crash**. It is tsc-blind because `PhotoSourcePicker` keeps the merged `RootStackParamList` typing — the *exact* class as N18/N19/N10.
- **Why the inventory misses it.** `PhotoSourcePicker` is a shared COMPONENT mounted in `EditContactScreen` (Dashboard/Orrery, where CropPhoto resolves) AND `SettingsScreen` (Settings, where it does not). A disposition heuristic keyed on "the owning stack" is ambiguous for a multi-mount component; an executor confirming "CropPhoto ∈ DashboardStack ✓" for the EditContact mount will mark it resolved and never see the SettingsScreen mount. The route→tab map itself is incomplete for that mount.
- **Confirmed safe siblings:** the custom-field photo path (`PhotoFieldWidget`/`FieldValueInput`) is mounted only in `EditContactScreen`/`CreateContactScreen` (Dashboard/Orrery), so it is fine — the profile-photo mount in SettingsScreen is the only gap.
- **Fix (planner-bucket, low cost).** Register `CropPhoto` in SettingsStack too (one `CropPhotoScreen` component; Pitfall 6 permits multi-stack registration of the same component; CropPhoto does `setContactPhoto` then `goBack()`, so Back is origin-aware to Settings). Add it to the Plan 01 route→tab map and add an inventory row (N20). Alternatively route PhotoSourcePicker's CropPhoto navigation container-level — but plain SettingsStack registration is the minimal, pattern-consistent fix. Then Plan 03's literal re-audit must, for every shared component, enumerate all mount screens and their owning stacks (not just the first mount found).

No other NEW HIGHs. The two correctly owner-flagged deferrals (ManageFavourites route retention; photo "stage until Save") are correct posture and I do not report them as defects.

**Overall Risk Assessment: MEDIUM** — driven entirely by the one remaining inventory miss; absent that, the phase would be LOW. The miss matters because it is the same crash class the cycle-3 revision headlines as closed, and the anchor inventory was declared "complete" for a third time while still missing it.

---

## Cycle-3 verdict

**Cycle-2 HIGH #1 — ImportReviewScreen `replace("Profile")` post-split crash (N18 :215 / N19 :289): RESOLVED.** Verified: `ImportReviewScreen` is `RootStackScreenProps<"ImportReview">` (`:74`); `replace("Profile")` is real at `:215` and `:289`; `replace("ImportComplete")` at `:239`/`:310` is intra-SettingsStack and correctly untouched. Plan 01 adds rows N18/N19; Plan 03 Task 1 reshapes both to `navigationRef.reset(resetToDashboardWith({name:"Profile",…}))` (a route that IS in DashboardStack, type-safe under the retyped ref) and requires a LITERAL grep re-audit as an executor action rather than a restated completeness claim.

**Cycle-2 HIGH #2 — photo/Discard false promise: RESOLVED.** Verified against `EditContactScreen.tsx`: the photo is separate screen state committed immediately by its own DAO (`:171-177`), re-read on focus (`:227-247`), never part of Save (`:451` navigates while dirty). Plan 03 excludes the photo from the dirty delta, forbids claiming Discard reverts it, and flags the "stage until Save" alternative for the owner (a shipped-behavior change touching the CropPhoto contract + orphan-cleanup invariant at `:249-257`). Truthful-minimal fix + correct escalation.

**Cycle-2 HIGH #3 — Plan 04 missing dependency / wave order: RESOLVED.** Verified: `22-04-PLAN.md` front-matter is `wave: 3`, `depends_on: [22-01, 22-02]`; ROADMAP shows `01 → {02,03} → 04 → 05 → 06` with the "04 depends on 02's back-intent" annotation. Plans 05 (`[22-02,22-04]`, wave 4) and 06 (`[22-02,22-05]`, wave 5) are consistent with their real imports.

**New HIGH concerns:**
1. **Unlisted cross-tab crash — `SettingsScreen.tsx:1350` `PhotoSourcePicker(profile)` → `PhotoSourcePicker.tsx:143`/`:213` `navigate("CropPhoto")`, and CropPhoto is not registered in SettingsStack** (route→tab map, Plan 01 line 206). Same route-not-found class as N18/N19, still missing from the thrice-"complete" D-08 inventory. Fix: register CropPhoto in SettingsStack + add inventory row N20 + make Plan 03's re-audit enumerate every mount screen of each shared navigating component.

**Open questions (could not verify this pass, downgraded from findings):**
- OrreryScreen's data/refresh path for `useShellRefresh` (Plan 06) — confirm at execution it re-reads recency-derived orbit data without driving the Skia loop from React state.
- The EditContactScreen save `navigate("Profile")` at `:451` no-replay behavior — confirm on device that it pops (not pushes) so Back does not replay Edit (Plan 03 already makes this a verify step).

---

## Verification coverage (source-grounding pass, authority=grep)

The orchestrator enumerated the cited symbols across all six plans, EXCLUDED symbols under each plan's "Artifacts this phase produces" (new files/symbols/deps: reset-intents, back-intent, focused-route-classification, shell-transient-store, discard-keep-guard, ShellAppBar, use-bottom-clearance, GroupEventsScreen, universal-fab-logic, UniversalFab, FabActionPlaceholders, contact-picker-order, picker-read, ContactPicker, Snackbar, snackbar-store, shell-refresh-store, the placeholder routes, `@react-navigation/bottom-tabs`, `expo-haptics`), and resolved the remaining pre-existing citations against disk.

**Result: VERIFIED across the board — no MISSING, AMBIGUOUS, or UNCHECKABLE symbols of consequence.** Every load-bearing pre-existing citation was opened and confirmed:

| Citation | Kind | Status |
|---|---|---|
| ImportReviewScreen.tsx:215/:289 `replace("Profile")`; :239/:310 `replace("ImportComplete")`; :74 `RootStackScreenProps<"ImportReview">` | route site / typing | VERIFIED |
| MergeImpactSummary.tsx:17 `replace("Profile")`; :12 `RootStackScreenProps<"MergeImpactSummary">` | route site / typing | VERIFIED |
| EditContactScreen.tsx photo immediate-commit (:170-177), focus re-read (:227-247), save navigate (:451), reseedMetadataAfterPartialSave (:313/:428), seededLinks (:156), committedValuesRef (:185) | behavior/state | VERIFIED |
| recency-dao.ts recordTouchpoint (:217) + bumpDataRevisionCore (:240); deleteTouchpoint (:313-358) — NO bump; uid required (:62) | DAO | VERIFIED (deleteTouchpoint confirmed NOT to bump; the :409 bump is in createContactWithInteraction) |
| ContactProfileScreen.tsx doLogContact (:332-349), goBack (:762), navigate SurvivorSelect :817 / ReconcileDetail :827 | route/behavior | VERIFIED |
| linking.ts navigationRef (:36, currently `NavigationContainerRef<RootStackParamList>`); ShareIntent navigate("Backup")/("Capture") :64/:67 | typing/route | VERIFIED |
| widget-linking.ts id guard :115, routes[1] :260, resets :274/:287, ManageFavourites branch :91/:136 | resolver/route | VERIFIED |
| notification-nav.ts birthday `{type:"navigate",name:"Profile"}` :103-104; decay/digest reset :80/:92 | intent | VERIFIED |
| OrreryScreen.tsx navigate("Profile") :433/:441 | route | VERIFIED |
| HomeScreen.tsx :319 ManageFavourites, :407 Archived footer, :517 Digest, :536/:554/:572 Backup/Orrery/Settings, :221 Profile | route | VERIFIED |
| SettingsScreen.tsx:2008 ManageFavourites; :1351 PhotoSourcePicker mount | route/mount | VERIFIED |
| capture-read.ts:66 / dashboard-read.ts:245,:333 / sun-picker-read.ts:45 `favourite_rank ASC`; no `is_favourite` column | SQL read | VERIFIED |
| AddSpeedDialFab.tsx navigate("Create") :98, scrim absoluteFill :133; add-speed-dial-fab-logic.ts speedDialScrimPointerEvents :23 | component | VERIFIED |
| OverflowMenu.tsx Modal at :47 lacks accessibilityViewIsModal | a11y gap | VERIFIED |
| import-acquire.ts:172/:174 `navigate("ImportReview"/"BulkImportSetup")` (service-layer, outside D-08 + Plan 03 grep scope) | route | VERIFIED (exists; currently intra-SettingsStack) |
| PhotoSourcePicker.tsx:111 `RootStackParamList` typing, navigate("CropPhoto") :143/:213; CropPhoto registered only in root/Dashboard/Orrery, not SettingsStack | route site | VERIFIED — this is NEW HIGH #1 |
| App.tsx:310 tab-navigator + siblings inside NavigationContainer; `useBottomTabBarHeight` not yet used anywhere in repo | mount context | VERIFIED — grounds NEW HIGH #2 |

MISSING→needs-acknowledgement: none. AMBIGUOUS→MEDIUM: none. UNCHECKABLE→INFO: the on-device backstop truths (crossfade duration, large-font reflow, TalkBack focus) are signature/runtime assertions, correctly marked `backstop` in the plans and validated only on the Pixel.

## Cross-artifact fact-drift pass (ADVISORY — contributes to neither count)

`node gsd-tools drift-guard phase-status --phase 22` → verdict `uncheckable` (STATE.md authority; no rankable STATE↔ROADMAP status contradiction). One advisory observation from the judgment pairs: **STATE.md records "6 plans, 4 waves"** while the cycle-3 revision restructured to **5 waves** (`01 → {02,03} → 04 → 05 → 06`), which ROADMAP and every plan's front-matter now reflect. This is a stale STATE.md wave count, advisory only — it sets no hardBlock and is not counted in the HIGH or actionable totals. Recommend refreshing STATE.md's wave count on the next state edit. No ROADMAP-SuccessCriteria↔PLAN-truths or CONTEXT-Decisions↔PLAN-term contradictions found.

---

*To incorporate this feedback into planning: `/gsd-plan-phase 22 --reviews`*
