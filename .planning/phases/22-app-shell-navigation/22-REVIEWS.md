---
phase: 22
reviewers: [codex, cursor, claude]
reviewed_at: 2026-09-02T17:46:00Z
cycle: 2
plans_reviewed: [22-01-PLAN.md, 22-02-PLAN.md, 22-03-PLAN.md, 22-04-PLAN.md, 22-05-PLAN.md, 22-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  cursor: "unknown"
  claude: "claude-opus-4-8 (read-only subagent lane)"
model_sources:
  codex: "banner"
  cursor: "unknown"
  claude: "orchestrator"
gates:
  source_grounding: true          # authority=grep
  cross_artifact_fact_drift: advisory
---

# Cross-AI Plan Review — Phase 22 (App Shell & Navigation) — Convergence Cycle 2

Three independent reviewers (Codex, Cursor, and a read-only Claude subagent lane) re-reviewed the
6 revised plans on disk after commit `5ed789e`. Every file:line claim carried by a reviewer was
re-verified by the orchestrator against the actual code on disk (CLAUDE.md "review the code, not the
diff"); the disposition column below reflects that verification, which in two cases changed a
reviewer's severity.

## Consensus Summary

Cycle 2 is a **material improvement** over cycle 1 — all three reviewers independently rate overall
phase risk **MEDIUM**, down from cycle 1's HIGH. Four of cycle 1's five HIGHs are fully or
correctly resolved: the merge-completion `replace("Profile")` crash is now owned (Plan 03), the
`navigationRef` retype closes the container-level tsc-blindness, the transient store now holds real
dismiss callbacks, and the ADR-075 posture (enforce the planner half, remove the two named
user-facing entries, flag the full `ManageFavourites`/`orbit://favourites` retirement for the owner)
is the correct escalation — **not** a defect.

**The single most important finding is new this cycle:** the Claude lane's repo-wide sweep found an
**unowned cross-tab crash the "COMPLETE" D-08 inventory still misses** —
`ImportReviewScreen.tsx:215/:289 replace("Profile")`. The orchestrator verified it: `ImportReview`
is a SettingsStack screen typed `RootStackScreenProps<"ImportReview">`, `Profile` lives only in
DashboardStack/OrreryStack, so both sites are route-not-found post-split — the exact N9/N10 crash
class the plans already caught, on two real import paths, in no plan's `files_modified`.

Two reviewer HIGHs were **downgraded after orchestrator verification against source**: (a) Codex's
"system Back ≠ visible Back on browse child screens" — the FAB scrim is `StyleSheet.absoluteFill`
with `pointerEvents:"auto"` when open (`AddSpeedDialFab.tsx:75,133`), so the visible Back is
physically un-tappable while a transient is open; the deferral is genuinely safe (the Claude lane
reached the same conclusion), but Plan 02's *stated* rationale ("FAB hidden on child screens") is
factually wrong and should be corrected to the scrim-interception argument. (b) The picker
`openTransient` callback omission (Codex/Cursor HIGH) is real but tsc-bounded per the Claude lane —
kept as an actionable plan-text fix.

### Agreed Strengths (2+ reviewers, verified on disk)

- **D-06 fidelity + external-entry preservation** — plans are written against the real flat stack
  (`RootNavigator.tsx`, Profile Back `goBack()` at `ContactProfileScreen.tsx:762`), and every
  ADR-044/D-07 external reset (Compose `:267`, notification `:136`, widget `:274/:287`, ShareIntent
  `linking.ts:64/:67`) is reshaped, never removed. (codex, cursor, claude)
- **ADR-075 handling is exemplary** — enforces the new picker path (membership band, no
  `favourite_rank ASC`), removes `HomeScreen.tsx:319` + `SettingsScreen.tsx:2008`, and flags the
  route/widget retirement for the owner; `capture-read.ts:65-66` still carries the `favourite_rank
  ASC` idiom Plan 06 must not copy. (codex, cursor, claude)
- **Quick Log data-layer correctness** — mirrors canonical `doLogContact`
  (`ContactProfileScreen.tsx:339-349`) exactly, `uid` required (`recency-dao.ts:59-61`), Undo reuses
  `deleteTouchpoint` (`:313`), and the freshness reasoning (deleteTouchpoint does NOT call
  `bumpDataRevisionCore` at `:240`) is correct. (codex, cursor, claude)
- **Merge-completion + birthday-notification crashes owned**; widget reshape correctly scoped to the
  gate dispatch only (resolver/tests stay flat). (codex, cursor, claude)
- **Transient store dismiss-callback design** fixes the cycle-1 "id-in-a-set can't close local React
  state" defect. (codex, cursor, claude)

### Agreed Concerns (2+ reviewers)

- **Picker `openTransient` inconsistency** — Plan 06 Task 2 says `openTransient("contact-picker")`
  with no dismiss callback, contradicting Plan 02's contract/must_have. (codex HIGH, cursor HIGH,
  claude LOW — tsc-bounded)
- **Post-Quick-Log browse-surface refresh has no named mechanism** — "refresh the currently focused
  data surface" is asserted; `HomeScreen` reloads only on focus/AppState/pull, does not subscribe to
  the data revision. Widget path is covered; on-Home/Orrery staleness is a real gap. (codex MEDIUM,
  cursor MEDIUM)
- **SHELL-03 scope vs literal success criterion** — identical system/visible Back is delivered for
  shell-owned transients + default nested back, not for existing child Back controls; UAT must not
  claim full SHELL-03. (codex, cursor, claude — see downgrade note above)

### Divergent Views (resolved by orchestrator verification)

- **"system Back == visible Back" on browse child screens** — Codex rated HIGH (FAB visible on
  Archived/NeverContacted/UnboundContacts/Digest; their own Back controls call `goBack()` directly).
  Cursor MEDIUM; Claude LOW. **Resolution: LOW.** Verified the shell transient's scrim is
  full-screen absoluteFill and intercepts the tap while open, so the visible Back cannot fire during
  an open transient — no real divergence. Fix is to correct Plan 02's stated rationale, not the
  behavior.
- **Picker callback severity** — Codex/Cursor HIGH vs Claude LOW. **Resolution: actionable
  non-HIGH** — a real cross-plan contradiction to fix in Plan 06 text, but tsc catches the runtime
  defect when `dismiss` is a required parameter.

---

## Codex Review

_Model: gpt-5.6-terra (reasoning=low)_

# Phase 22 plan review — convergence cycle 2

## Overall summary

The plans are substantially improved: they correctly trace the flat-stack split, retain the external Dashboard fallback, cover the widget resolver boundary, fix the merge-completion crash, and explicitly avoid introducing new `favourite_rank ASC` ordering. However, three implementation gaps still prevent the phase from fully meeting its decided Back/Discard contracts.

## 22-01 — Four-tab shell

**Summary:** Strong architectural tracer. The route-to-tab partition and external nested-reset approach correctly reflect the current flat root stack.

**Strengths**

- Correctly starts from the actual single-stack navigator at [RootNavigator.tsx](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:57), rather than assuming tabs already exist.
- Correctly preserves the migration gate: the `NavigationContainer` remains inside the ready branch at [App.tsx](/home/bwales/projects/orbit-app/App.tsx:298).
- Correctly identifies the Orrery Profile requirement: planet/sun taps use `navigate("Profile")` at [OrreryScreen.tsx](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:433), so dual registration is necessary.
- Correctly preserves strict widget URI validation at [widget-linking.ts](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:103).

**Concerns**

- **MEDIUM — the retained merged `RootStackScreenProps` is not enough to prove per-tab screen registration will type-check.** Existing screens are explicitly typed against the full root list, e.g. [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:142) and [MergeImpactSummary.tsx](/home/bwales/projects/orbit-app/src/components/MergeImpactSummary.tsx:12). Registering those components in narrower `DashboardStackParamList`/`OrreryStackParamList` navigators may be structurally incompatible under React Navigation’s screen-prop variance. The plan says consumers “keep compiling,” but has no compile-spike or fallback wrapper strategy.

**Suggestions**

- Add an explicit first-task compile checkpoint after registering one existing `RootStackScreenProps` component in a tab stack. If it fails, migrate screen props to the per-tab composite helper or add typed route wrappers; do not defer discovery until the whole navigator rewrite is complete.

**Risk:** **MEDIUM.** The architectural direction is right, but typing compatibility is an early blocker risk.

## 22-02 — Back, retap, transient overlays

**Summary:** The ordered callback-based transient store is a real improvement, but the stated deferral for visible Back controls contradicts the intended FAB visibility.

**Strengths**

- The callback-based store fixes the real local-state problem: the current dial’s visibility is local state in [AddSpeedDialFab.tsx](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:27), so removing only an ID would not close it.
- The plan correctly keeps ordinary Back delegated to React Navigation instead of inventing a global stack walker.
- Its visible/browse classification matches the dossier: Profile, Archived, and ordinary child pages are supposed to keep shell chrome visible. The decision record explicitly lists these at [phase dossier](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md:137).

**Concerns**

- **HIGH — “system Back == visible Back” remains unachieved on browse child screens.** Plan 02 says existing child Back controls are safe to defer because the FAB/picker are hidden on “focused + child screens,” but the same plan classifies `Archived`, `NeverContacted`, `UnboundContacts`, and `Digest` as visible browse routes. These controls directly call `navigation.goBack()` at [ArchivedContactsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:181), [NeverContactedScreen.tsx](/home/bwales/projects/orbit-app/src/screens/NeverContactedScreen.tsx:87), [UnboundContactsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:55), and [DigestScreen.tsx](/home/bwales/projects/orbit-app/src/screens/DigestScreen.tsx:128). Plan 05 makes the universal FAB visible on browse/read surfaces. Therefore an open dial/picker plus visible Back pops the screen, while system Back dismisses the transient—violating the decided identical-results rule at [phase dossier](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md:153).
- **MEDIUM — the plan’s acceptance test only validates a future app-bar Back, not the existing Back controls that remain in use.** It does not prove the actual user-visible Back behavior across visible child surfaces.

**Suggestions**

- Either route every visible Back control through one shared `handleBackIntent(navigation)` primitive in this phase, or hide/unmount FAB and picker on every screen whose Back control is not migrated. The former better matches the dossier’s “visible Back equals system Back” decision.
- Add a render/device test for `Archived → open FAB → Back`: it must close the FAB and remain on Archived.

**Risk:** **HIGH.** This is a direct failure of a decided phase behavior.

## 22-03 — Reconciliation, no-replay, Discard/Keep

**Summary:** Navigation reconciliation is careful and correctly addresses real stranded route sites, but the proposed discard guard is unsafe for the current Edit screen’s persistence model.

**Strengths**

- Correctly addresses the current merge crash: merge completion uses `navigation.replace("Profile")` at [MergeImpactSummary.tsx](/home/bwales/projects/orbit-app/src/components/MergeImpactSummary.tsx:17), which cannot resolve from Settings after the split.
- Correctly identifies import completion’s root reset at [ImportCompleteScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ImportCompleteScreen.tsx:295) and reconcile completion reset at [ReconcileCompleteScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ReconcileCompleteScreen.tsx:45).
- Correctly catches the edit replay source: save currently pushes/navigates to Profile at [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:451).

**Concerns**

- **HIGH — the proposed “Discard changes” behavior cannot discard photos in the current Edit implementation.** Edit explicitly persists photo updates immediately through a dedicated DAO, outside the form save transaction: [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:171). A `beforeRemove` dialog can prevent navigation, but choosing Discard cannot undo an already-written photo. The plan’s acceptance criterion promises photo edits are protected by Discard, which would be materially false and conflicts with the dossier’s explicit abandonment confirmation requirement at [phase dossier](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md:143).
- **MEDIUM — the planned dirty comparison is underspecified for the current separate state model.** Links are maintained separately at [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:154), and custom-field committed values are independently tracked at [EditContactScreen.tsx](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:179). “Track a coarse dirty boolean if impractical” risks never resetting it after a partial failure/reseed path.

**Suggestions**

- Do not claim photo changes are discardable unless this plan also stages them until Save or records the pre-change photo and reliably restores it on Discard.
- Define explicit baselines and reset points for form, links, custom fields, and photo; add tests for successful save, partial link-save failure, and discard after a photo update.

**Risk:** **HIGH.** “Discard” must not leave a user-visible edit committed.

## 22-04 — Shell chrome and dashboard entries

**Summary:** Good coverage of Group Events, Archived, ADR-075 entry removal, and the existing cross-tab header shortcuts.

**Strengths**

- Correctly removes the two visible Manage Favourites entries currently present in [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:314) and [SettingsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:2004), while retaining the route for the existing widget deep link.
- Correctly converts currently bare cross-tab dashboard routes at [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:532).
- Correctly preserves one Archived screen/DAO surface while adding Dashboard reachability; current Archived Back is conventional at [ArchivedContactsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:181).

**Concerns**

- **MEDIUM — the “shared clearance geometry constant” seam is not actually specified.** Plan 04’s hook describes locally adding FAB dimensions and a gap; Plan 05 says its FAB must consume “the shared geometry constant.” Neither plan defines the exported constant/module contract, so the two measurements can drift despite the stated invariant.
- **LOW — the plan promises child Back/title chrome while explicitly leaving existing child chrome unchanged.** This is especially problematic given the Back inconsistency noted under Plan 02.

**Suggestions**

- Export named geometry constants from `use-bottom-clearance.ts` (or a dedicated shell geometry module) and make both the hook and FAB import them.
- Make the child app-bar migration decision explicit: migrate all visible child Back controls now, or scope the success criterion to root app bars only.

**Risk:** **MEDIUM.** Core routes are sound; consistency and safe-area reuse need a firmer implementation contract.

## 22-05 — Universal FAB

**Summary:** Strong fixed-action mapping, nested navigation, and Reanimated approach. It appropriately retains the current pointer-events helper, whose need is demonstrated by [AddSpeedDialFab.tsx](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:72).

**Strengths**

- Correctly replaces the legacy two-action dial and preserves `speedDialScrimPointerEvents`, which returns `"none"` while collapsed at [add-speed-dial-fab-logic.ts](/home/bwales/projects/orbit-app/src/components/add-speed-dial-fab-logic.ts:23).
- Correctly requires shell-level nested tab targets rather than calling a bare `navigate("Create")`.
- Correctly makes Group Log direct and keeps action order explicit.

**Concerns**

- **MEDIUM — current-route/contact-context extraction is not defined robustly enough for nested state.** The shell FAB must distinguish Dashboard/Profile and Orrery/Profile routes, including the nested params; the plan says to use `getFocusedRouteNameFromRoute` plus nested params but does not specify a pure walker or tests for Dashboard Profile, Orrery Profile, root tabs, and stale/unavailable nested state.
- **LOW — warning haptics for Quick Log failure do not match the dossier’s stated haptic vocabulary.** The dossier specifies warning feedback for destructive confirmation at [phase dossier](/home/bwales/projects/orbit-app/docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md:353), while Plan 06 assigns warning feedback to an ordinary write error.

**Suggestions**

- Add a pure `getFocusedContactContext(navigationState)` helper with tests for both Profile-owning stacks and non-Profile routes.
- Use no haptic or a separately ratified error haptic for Quick Log failures.

**Risk:** **MEDIUM.** The routing design is good; context extraction needs concrete, testable mechanics.

## 22-06 — Picker and Quick Log

**Summary:** The local-only query posture, ADR-075 ordering correction, and commit-only success path are all well designed. One direct store-API mismatch and the refresh strategy remain unresolved.

**Strengths**

- Correctly uses interaction recency rather than capture recency; existing capture ordering is rank-based at [capture-read.ts](/home/bwales/projects/orbit-app/src/db/capture-read.ts:64), so copying it would violate ADR-075.
- Correctly mirrors the canonical one-tap write at [ContactProfileScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:338), including local timestamps and required UID.
- Correctly reuses `deleteTouchpoint`, which scopes deletion by both interaction and contact at [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:313).

**Concerns**

- **HIGH — ContactPicker’s planned transient registration does not supply the required dismiss callback.** Plan 02 defines `openTransient(id, dismiss)` and explicitly requires the picker to register `onDismiss`; Plan 06 Task 2 instead says only `openTransient("contact-picker")`. This either fails TypeScript or registers no actual close behavior, so Back/retap cannot reliably dismiss the picker.
- **MEDIUM — “refresh the currently focused data surface” has no implementation mechanism.** `notifyWidgetDataChanged()` only updates the Android widget at [widget-refresh.ts](/home/bwales/projects/orbit-app/src/services/widget/widget-refresh.ts:74). Home deliberately refreshes only on focus, foregrounding, or pull-to-refresh at [HomeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:9); it has no shell refresh subscription. The plan must introduce a concrete refresh event/store or invoke a registered focused-screen callback.
- **LOW — the pure ordering helper’s responsibility is ambiguous.** The SQL orders rows, but the proposed `filterPicker` description does not say it sorts; its tests nevertheless claim to prove ordering. Either test the SQL with a SQLite fixture or have the pure helper own sorting.

**Suggestions**

- Change the picker contract to `openTransient("contact-picker", onDismiss)` and ensure every dismissal path calls `closeTransient`.
- Define a small shell refresh registry/event with lifecycle cleanup, or explicitly refresh the known focused screen through a stable callback. Test Quick Log and Undo freshness separately.
- Make ordering ownership explicit and test it at the layer that implements it.

**Risk:** **HIGH.** The picker dismissal bug is a direct blocker for SHELL-02/03, and freshness is currently aspirational.

## Final assessment

The plans now cover most of the difficult navigation refactor correctly, especially external entries and cross-tab crash paths. Before execution, I would resolve these blockers:

1. Make all visible Back controls use the same transient-first back path.
2. Make Discard truthful for immediately persisted photo edits.
3. Pass a real picker dismissal callback to the transient store.
4. Specify the post-Quick-Log focused-surface refresh mechanism.

---

## Cursor Review

_Model: unknown_

# Cross-AI Plan Review — Phase 22: App Shell & Navigation (Convergence Cycle 2)

**Reviewed against:** `/home/bwales/projects/orbit-app` on disk (2026-09-02)  
**Plans:** 22-01 through 22-06  
**Prior cycle:** Cycle 1 flagged ADR-075 reversal, incomplete D-08 inventory, `tsc` blindness, merge crash, FAB geometry/routing, transient dismiss, Quick Log contract gaps. Cycle 2 plans substantially address those. Remaining issues are narrower and mostly cross-plan seams.

---

## Executive Summary

Cycle 2 is a **material improvement** over cycle 1. The phase anchor (Plan 01) now carries a complete, source-verified D-08 inventory, the correct ADR-075 posture (enforce new paths + remove named entries + flag route/widget retirement for the owner), Orrery→Profile origin-aware dual registration, and `navigationRef` retyping to close container-level `tsc` blindness. Plans 03, 05, and 06 close the merge-completion crash, shell-level FAB nested routing, Quick Log write contract, and widget freshness gaps that cycle 1 identified.

The plans are **executable with two HIGH fixes** (Plan 04→02 dependency; Plan 06 picker dismiss callback) and a few MEDIUM implementation clarifications. Overall phase risk drops from cycle 1’s **HIGH** to **MEDIUM** — direction and decision fidelity are sound; remaining risk is execution-order and a handful of underspecified cross-surface refresh behaviors.

---

## Plan 01 — Four-tab shell + nested external resets

### Summary
Strong tracer plan. Correctly reads the actual flat stack (`RootNavigator.tsx:57`, 32 `Stack.Screen` routes), preserves the migration gate (`App.tsx:298-322`), and reshapes external-entry resets without touching deep-link acceptance (`widget-linking.ts:132-137`, `:274-279`, digit guards at `:103-119`). The D-08 table matches on-disk call sites verified via grep.

### Strengths
- **D-06 fidelity:** Flat `createNativeStackNavigator`, no `@react-navigation/bottom-tabs` in `package.json:9-10`, Profile Back is plain `goBack()` (`ContactProfileScreen.tsx:762`).
- **ADR-044/D-07 preserved:** Compose reset (`ComposeScreen.tsx:267`), notification reset (`notification-gate.tsx:136`), widget resets (`widget-linking.ts:274/:287`), ShareIntent navigates (`linking.ts:64/:67`) all owned with nested shape via `reset-intents.ts`.
- **ADR-075 escalation done correctly:** Enforces no rank ordering in new picker path; removes `HomeScreen.tsx:319` / `SettingsScreen.tsx:2008` entries; flags `ManageFavourites` route retention for `orbit://favourites` (`widget-linking.ts:132-137`) — not a silent reversal.
- **Orrery→Profile fix:** Dual-register Profile family in `OrreryStack` addresses real tap sites (`OrreryScreen.tsx:433/:441`) without editing OrreryScreen.
- **Birthday notification fix (A2b):** Container `navigate("Profile")` (`notification-nav.ts:101-105` → `notification-gate.tsx:138`) would fail post-split; reset intent is correct.

### Concerns
- **MEDIUM — Inter-wave runtime window:** Plan 01 retypes `navigationRef` but component-level cross-tab sites (`ImportCompleteScreen.tsx:267/:283`, `ContactProfileScreen.tsx:827`, `MergeImpactSummary.tsx:17`) remain until Plan 03. `RootStackParamList` back-compat alias still lets bare route names compile on component `navigation` props. Mitigation: execute Plan 03 immediately after Plan 01 within Wave 2; do not UAT between 01 and 03 alone.
- **LOW — `Capture` in OrreryStack:** “Confirm at execution” is fine; grep shows no Profile→Capture path (`navigate("Capture")` only in `linking.ts:67` ShareIntent → DashboardTab). Likely omit from OrreryStack.

### Suggestions
- Add explicit Wave-2 ordering note: **01 → 03 before device UAT**; 02 and 04 can parallelize only after 03 lands (or 04 waits for 02 — see Plan 04).
- In D-08 table, add explicit “no change (intra-SettingsStack)” rows for `SettingsScreen.tsx:181` `navigate("ReconcileGrid")` and `import-acquire.ts:172-174` to prevent future re-audit churn.

### Risk Assessment
**MEDIUM** — Architecture and external-entry paths are well specified; interim state between 01 and 03 is the main hazard.

---

## Plan 02 — Transient store, back-intent, tab behavior

### Summary
Solid behavior contract. The dismiss-callback store design (`openTransient(id, dismiss)`) correctly fixes cycle 1’s “id-only store can’t close local React state” finding (`AddSpeedDialFab.tsx` uses local `setExpanded`).

### Strengths
- **Transient dismiss mechanism:** `dismissTop()` invokes registered close callbacks — required for FAB (`Plan 05`) and picker (`Plan 06`).
- **Focused-workflow hide:** Explicit allow-list in `focused-route-classification.ts` aligns with dossier §B routes.
- **Documented SHELL-03 deferral:** Child screens with own Back (`DigestScreen`, `ArchivedContactsScreen`, etc.) and focused handlers (`ComposeScreen.tsx:404`, `CaptureScreen.tsx:216`) explicitly deferred — reasoning is sound because FAB/picker are hidden on those routes.

### Concerns
- **MEDIUM — Success criterion vs deferral:** Roadmap SHELL-03 says system Back and visible Back behave identically on **every screen**. Plans deliver that for shell-owned transients + default nested back, but **not** for existing child Back controls until a later chrome pass. Documented deferral is honest; UAT checklist should not claim full SHELL-03 until child chrome migrates or success criteria are scoped.
- **LOW — `popToTop` retap:** Must use nested stack navigator reference correctly; RESEARCH Pattern 2 dependency is appropriate.

### Suggestions
- Add acceptance assertion that `shell-transient-store.test.ts` covers **double-registration replacement** (mentioned in action text but not in acceptance criteria).
- Cross-link Plan 06: picker **must** register `openTransient("contact-picker", () => closePicker())` — see Plan 06 concern below.

### Risk Assessment
**LOW–MEDIUM** — Core logic is clean; gap is scope vs literal success criteria wording.

---

## Plan 03 — Cross-tab navigates, completion resets, Discard/Keep

### Summary
Closes the cycle-1 HIGH merge crash and stranded navigate cluster. `MergeImpactSummary.tsx:17` `replace("Profile")` is a confirmed crash from SettingsStack reconcile origin (Profile not registered there).

### Strengths
- **N10 crash fix owned:** Plan includes `MergeImpactSummary.tsx` in `files_modified`; routes through `navigationRef.reset(resetToDashboardWith(...))`.
- **Completion resets:** C1/C2 (`ImportCompleteScreen.tsx:300`, `ReconcileCompleteScreen.tsx:47`) → `resetToDashboardRoot()` preserves historical Dashboard landing.
- **Backup-local resets verified:** B1–B3 keep flat `{name:"Backup"}` shape (`RestorePreviewScreen.tsx:99/:123`, `RestoreResultScreen.tsx:18`) — correct if Backup is BackupStack root.
- **Discard/Keep:** `beforeRemove` idiom exists (`RestorePreviewScreen.tsx:94-96`); bypass ref before save navigate addresses real dirty-state at `EditContactScreen.tsx:451`.

### Concerns
- **LOW — Edit no-replay:** `EditContactScreen.tsx:451` uses `navigation.navigate("Profile", { contactId })`. `ContactProfileScreen.tsx:310-313` documents this pops to the existing Profile instance (does not push a duplicate). Plan’s “read and verify” approach is correct; likely no change needed.
- **LOW — Merge completion lands Dashboard, not origin:** Intentional completion reset (like import Done). Orrery-origin merge → Dashboard Profile is a product tradeoff, explicitly chosen.

### Suggestions
- Task 2 acceptance: if Edit already pops correctly, require SUMMARY to cite `ContactProfileScreen.tsx:310-313` as evidence (avoid unnecessary navigation change).
- Task 3: specify whether custom-field dirty tracking uses coarse `onChange` flags or diff — plan allows either but executor should pick one and test photo + custom field paths in UAT.

### Risk Assessment
**LOW** — Well-scoped call-site reshaping with strong file:line grounding.

---

## Plan 04 — Shell chrome, Group Events, clearance

### Summary
Good SHELL-12/13 delivery. OverflowMenu gap is real: Modal at `OverflowMenu.tsx:46-51` lacks `accessibilityViewIsModal` and focus restore. ADR-075 entry removals and header cross-tab fixes match on-disk sites.

### Strengths
- **Group Events placement:** Header + redundant overflow, not fifth tab — matches D-09.
- **Archived dual entry:** Dashboard overflow + Settings row (`SettingsScreen.tsx:2038`) → one `ArchivedContactsScreen`, ADR-018 untouched.
- **`useBottomClearance`:** Correctly forbids hardcoded padding; derives from `useBottomTabBarHeight()`.
- **Header reconciliation:** `HomeScreen.tsx:536/:554/:572` bare cross-tab navigates confirmed; conversion to `*Tab` switches is necessary.

### Concerns
- **HIGH — Missing dependency on Plan 02:** `depends_on: [22-01]` only, but Task 1 requires wiring ShellAppBar Back to `back-intent.ts` (Plan 02). Wave 2 allows 02 and 04 in parallel — **04 Task 1 will fail if 02 hasn’t landed**. Add `depends_on: [22-01, 22-02]` or defer ShellAppBar Back wiring to a 04 Task 1 follow-up after 02.
- **MEDIUM — Partial ShellAppBar rollout:** Only four tab roots get ShellAppBar; most child screens keep legacy Back through end of phase. Consistent with Plan 02 deferral but limits SHELL-13 “child = Back + title” coverage in this phase.

### Suggestions
- Split Task 1: OverflowMenu upgrade can run on `[22-01]`; ShellAppBar **child Back → back-intent** subtask gates on `[22-02]`.
- Flag header Backup/Orrery/Settings shortcuts as owner visual decision (plan already flags — good).

### Risk Assessment
**MEDIUM** (would be **HIGH** if 04 executes parallel to 02 without ordering guard).

---

## Plan 05 — Universal six-action FAB

### Summary
Addresses cycle-1 FAB geometry and cross-tab routing gaps. Correctly supersedes `AddSpeedDialFab.tsx:98` bare `navigate("Create")` with nested tab targets from shell level.

### Strengths
- **D-05 six actions, fixed order:** Enforced in pure logic + tests.
- **Group Log direct:** No pre-picker — matches dossier.
- **Reanimated compliance:** Shared value for animation; React `open` state only for `pointerEvents` — matches CLAUDE.md.
- **Geometry:** Derives bottom offset from `useBottomTabBarHeight()` + insets, shares constant with `useBottomClearance` — fixes collision with new tab bar (legacy `bottom:28` in AddSpeedDialFab).
- **Transient registration:** `openTransient("fab-speed-dial", () => setExpanded(false))` — aligns with Plan 02.

### Concerns
- **LOW — Shell-level navigation typing:** Plan correctly requires tab-typed navigation / `navigationRef` for nested dispatch; executor must not use a screen-scoped hook from App-level mount.
- **LOW — Placeholder routes:** Four themed placeholders are appropriate seam for Phases 24/33/34.

### Suggestions
- Task 2: when walking navigation state for `originContactId`, document handling when focused route is nested (e.g. DashboardTab → Profile params) — acceptance UAT covers Profile preselect.

### Risk Assessment
**LOW** — Thorough, cycle-1 findings addressed.

---

## Plan 06 — Contact picker + commit-truthful Quick Log

### Summary
Strong data-layer plan. Correctly reuses `recordTouchpoint` / `deleteTouchpoint` (`recency-dao.ts:217-242`, `:313-345`), mirrors canonical `doLogContact` (`ContactProfileScreen.tsx:339-349`), and enforces ADR-075-compliant picker ordering (membership band, not `favourite_rank ASC` — contrast `capture-read.ts:65-66`, `dashboard-read.ts:245`).

### Strengths
- **SHELL-11 commit truth:** Success only in `.then(({ interactionId }))`; no optimistic snackbar.
- **Undo path:** Reuses existing guarded delete — no new SQL writer.
- **ADR-075 in new read:** `(favourite_rank IS NULL)` band + `last_contact DESC` + alpha; explicit test that rank does not decide order among favourites.
- **Widget freshness:** `notifyWidgetDataChanged()` after commit and Undo — addresses `deleteTouchpoint` not calling `bumpDataRevisionCore` (unlike `recordTouchpoint` at `:240`).
- **Local-first:** Static SQL `getAllAsync`, no network on read path.

### Concerns
- **HIGH — Picker transient registration inconsistent with Plan 02:** Task 2 says `openTransient("contact-picker")` without a dismiss callback (`22-06-PLAN.md` action text). Plan 02 requires `{id, dismiss}` and `dismissTop()` **invokes** `dismiss()`. Without `() => setVisible(false)`, system Back / active-tab retap will pop the store entry but leave the Modal open — breaks SHELL-02/03. Plan 02 must_haves explicitly say picker registers a real close callback.
- **MEDIUM — Dashboard/Orrery refresh mechanism underspecified:** UAT requires status/recency update “without a manual refocus” (`22-06-PLAN.md` acceptance). `HomeScreen.tsx:178-184` reloads on focus/AppState/pull only — not on data revision. `recordTouchpoint` bumps revision (`recency-dao.ts:240`) but Dashboard doesn’t subscribe. Plan says “refresh the currently focused data surface” without naming a mechanism (event bus, shared reload hook, navigation focus trick, etc.). Widget path is covered; **browse-surface staleness after Quick Log while staying on Home/Orrery is a real gap**.
- **LOW — `deleteTouchpoint` Undo staleness:** Plan correctly adds `notifyWidgetDataChanged` for Undo; dashboard still needs explicit reload for full SHELL-11 UAT.

### Suggestions
- Fix Task 2 action to: `openTransient("contact-picker", () => setOpen(false))` (or equivalent) and add acceptance grep for dismiss callback arity.
- Task 3: specify refresh mechanism — e.g. extract a small `useShellDataRefresh()` subscribed from Home/Orrery focus hooks, invoked from UniversalFab after commit/Undo; or call existing screen reload via a lightweight Zustand “tick” store. Without this, on-device UAT will fail.
- Consider calling `bumpDataRevisionCore` inside Undo wrapper (or document why `notifyWidgetDataChanged` + explicit reload suffices).

### Risk Assessment
**MEDIUM** — Data write path is excellent; transient dismiss + browse refresh are the blockers.

---

## Phase-Level Assessment

### Decision fidelity (verified on disk)
| Decision | Status in plans |
|----------|-----------------|
| ADR-080 four-tab shell | ✅ Plan 01 |
| ADR-044 external → Dashboard | ✅ Plans 01, 03 |
| ADR-018 single Archived surface | ✅ Dual-register, one component |
| ADR-075 | ✅ Enforce + flag (correct posture) |
| D-03 no migration (`TARGET_VERSION = 14`, `database.ts:49`) | ✅ |
| D-10 predictive back disabled (`app.config.ts`) | ✅ noted, not flipped |
| Migration gate before navigator (`App.tsx:298-322`) | ✅ |

No **new** decision reversals identified beyond the owner-flagged ADR-075 residual (ManageFavourites route + rank reads in legacy paths).

### Dependency / wave ordering
```
Wave 1: 01
Wave 2: 02, 03, 04 — recommend 01→03 first; 04 Task 1 (Back wiring) after 02
Wave 3: 05 (needs 02+04)
Wave 4: 06 (needs 05; implicitly needs 02 store)
```

### Security / local-first
Deep-link guards unchanged; no network on picker read; reset targets are compile-time route names. Threat models in plans are proportionate.

### Performance
FAB uses Reanimated shared values (not per-frame `setState`). Orrery Skia loop untouched this phase — appropriate.

---

## Overall Risk Assessment

**MEDIUM**

**Justification:** Cycle 2 resolves cycle 1’s architectural and inventory failures with unusually accurate file:line grounding (verified: flat stack, reset sites, merge crash, widget guards, `deleteTouchpoint`/`recordTouchpoint`, favourites rank reads, OverflowMenu a11y gap). Remaining HIGH items are **fixable plan edits**, not direction reversals: Plan 04→02 dependency and Plan 06 picker dismiss callback. MEDIUM items (browse-surface refresh after Quick Log, SHELL-03 scope vs deferral) need specification before UAT can certify SHELL-11/03 literally.

**Recommendation:** Patch the two HIGH seams, add explicit Wave-2 execution order (01→03→02→04), then execute. Schedule owner decision on full ADR-075 retirement (`orbit://favourites` target) as a separate tracked task — plans already flag it correctly.

---

## Claude Review

_Model: claude-opus-4-8 (read-only subagent lane — the built-in `claude -p` lane self-skips inside Claude Code and has a Write-permission gap in this repo)_

# Cross-AI Plan Review — Phase 22 (App Shell & Navigation), Convergence Cycle 2 — Claude lane

**Verdict: MEDIUM risk (down from cycle-1 HIGH).** The revisions are strong and largely faithful. Four of the five cycle-1 HIGHs are fully resolved. **One HIGH remains: the D-08 cross-tab inventory still claims completeness but still misses a runtime crash site** — `ImportReviewScreen.tsx:215` and `:289` `replace("Profile")` — the exact same crash class the plans caught for merge-completion (N10) and ImportComplete (N9), but from the import-review completion paths, and it is unowned by any plan and invisible to `tsc`.

All file:line claims below were verified against the code on disk.

## Cycle-1 HIGH findings — resolution status

| # | Cycle-1 HIGH | Status | Evidence |
|---|---|---|---|
| 1 | Cross-tab navigate inventory incomplete | **PARTIALLY RESOLVED** | The D-08 table now enumerates N1–N17, F1, A2b, B1–B3, C1–C2 and captures every site the cycle-1 reviewers named (Home 536/554/572, Orrery 433/441, ImportComplete 267/283, Profile 827, birthday, merge). **But my own repo-wide `navigate(`/`replace(`/`reset(` sweep found `ImportReviewScreen.tsx:215` and `:289` `replace("Profile", {contactId})` — a SettingsStack screen (`RootStackScreenProps<"ImportReview">`, registered in the import cluster) targeting `Profile`, which lives only in DashboardStack/OrreryStack. Post-split this is route-not-found. Not in the inventory, not in any plan's `files_modified`.** See below. |
| 2 | merge-completion `replace("Profile")` crashes from reconcile origin, unowned | **FULLY RESOLVED** | `MergeImpactSummary.tsx` is now in Plan 03 `files_modified` (line 12); Task 1 (N10) replaces `replace("Profile")` with `navigationRef.current?.reset(resetToDashboardWith({name:"Profile",...}))`. Verified the current crash site exists at `MergeImpactSummary.tsx:17`. Ownership seam closed. |
| 3 | `tsc` blind via merged `RootStackParamList` alias | **PARTIALLY RESOLVED (by design)** | Plan 01 retypes `navigationRef` (currently `NavigationContainerRef<RootStackParamList>`, linking.ts:37) to `NavigationContainerRef<TabParamList>`, and migrates the specific stranded component consumers (Plan 03) to composite/tab typing. **The merged alias is deliberately retained for ~38 intra-stack consumers**, so component-level `navigation` props typed `RootStackScreenProps<T>` remain `tsc`-blind to cross-tab route names — which is exactly why the ImportReview miss type-checks cleanly. Reasonable churn-minimizing tradeoff, but the residual blindness is real and the miss proves it still bites. |
| 4 | ADR-075 reversal | **RESOLVED — correct escalation posture** | Plan 01's `## ADR-075 compliance` block enforces the planner-bucket parts (Plan 06 membership band, no `favourite_rank ASC`; Plan 04 removes HomeScreen:319 + SettingsScreen:2008) and flags the full `ManageFavourites` route retirement for the owner because it would break the shipped `orbit://favourites` widget deep-link. Per this repo's rules, this documented owner-flagged deferral is the correct posture, not a defect. Verified `capture-read.ts:65-66` still carries `favourite_rank ASC`. |
| 5 | Plan 02 `dismissTop()` can't close local-state overlays | **FULLY RESOLVED** | shell-transient-store now holds `{id, dismiss}` entries; `dismissTop()` invokes the topmost `dismiss()` callback. Plan 05 FAB registers `openTransient("fab-speed-dial", () => setExpanded(false))`. A dedicated store test asserts the callback is invoked. |

Two cycle-1 divergent HIGHs (Codex): **"system Back == visible Back" deferral** is now explicitly documented and argued as SAFE (Plan 02 Task 3) — see LOW finding below on the reasoning's accuracy. **FAB `bottom:28` geometry + shell-level nested navigate** are fully resolved (Plan 05 derives the offset from `useBottomTabBarHeight()` and returns nested `{tab,screen,params}` targets; verified the legacy `bottom:28` at `AddSpeedDialFab.tsx:135`).

## Concerns

### HIGH — the "complete" D-08 inventory still misses `ImportReviewScreen.tsx:215/:289 replace("Profile")` (unowned cross-tab crash)

Plan 01 asserts (line 164) that *"the cross-tab navigate/reset call-site inventory is COMPLETE."* My repo-wide sweep shows it is not:

- `src/screens/ImportReviewScreen.tsx:215` — `navigation.replace("Profile", { contactId })` (single-import completion, `onImport` path).
- `src/screens/ImportReviewScreen.tsx:289` — `navigation.replace("Profile", { contactId: choice.contactId })` (duplicate-link completion path).

`ImportReviewScreen` is typed `RootStackScreenProps<"ImportReview">` (line 74) and `ImportReview` is assigned to **SettingsStack** (Plan 01 route map). `Profile` is registered only in DashboardStack and OrreryStack. **Mechanism:** post-split, `navigation.replace("Profile", …)` from within SettingsStack resolves to no route → route-not-found crash on two real user paths (import a single Android contact → commit; link a duplicate during import). Byte-for-byte the same crash class as N9 and N10 that the plans *did* catch — but these two sites appear in no plan's `files_modified` and in no inventory row. Because `ImportReviewScreen` keeps `RootStackParamList` typing, `tsc --noEmit` passes.

**Fix:** add `ImportReviewScreen.tsx` to Plan 03 Task 1 with the N9/N10 treatment. And the executor instruction to grep every `navigate(`/`replace(`/`reset(` against the post-split route→tab map should be a literal Plan 01/03 step, not a claim — the claim was made in cycle 1 too and still missed this.

### MEDIUM — Plan 04 header cross-tab conversion under-specifies the navigation retyping it requires

Plan 04 Task 3 converts `HomeScreen.tsx:536/:554/:572` to `navigate("BackupTab"|"OrreryTab"|"SettingsTab")` but does not say how those tab names type-check. HomeScreen's navigation is typed against the per-tab/`RootStackParamList` surface, which does not contain the `*Tab` names (those live in `TabParamList`). The executor must retype HomeScreen's `useNavigation`/props to the composite helper or route via `navigationRef` — unstated. `tsc` will force a resolution (so this won't ship broken), but mirror Plans 03/05's specificity here.

### LOW — Plan 06 picker `openTransient` omits the dismiss callback in Task 2's action text

Plan 02's contract and the cycle-1 HIGH #5 fix require `openTransient(id, dismiss)`. Plan 06 Task 2 action (line 129) and acceptance (line 136) say only `openTransient("contact-picker")` — the dismiss argument is dropped, reintroducing the "id-in-a-set can't close the component" defect for the picker. If Plan 02 makes `dismiss` a required parameter, `tsc` catches the omission (hence LOW), but the plan text should match Plan 02's truth (line 30/92).

### LOW — Plan 02 Task 3's deferral safety *reasoning* is inaccurate (conclusion still holds)

Plan 02 justifies not migrating existing child/browse Back controls by asserting *"the FAB and picker are hidden/unmounted on focused + child screens."* That premise is false for `Archived`, `NeverContacted`, `UnboundContacts`, and `Profile` — Plan 02's own `isFocusedWorkflow` classifies these as browse surfaces where the FAB is **visible**. The deferral is nonetheless genuinely safe, but for a *different* reason I verified: every shell transient's scrim/Modal is `StyleSheet.absoluteFill` and, when open, `pointerEvents:"auto"` (confirmed `AddSpeedDialFab.tsx` scrim absoluteFill; `speedDialScrimPointerEvents` returns `"auto"` when open; `OverflowMenu`/`ContactPicker` use full-screen `Modal`s) — so the header's visible Back is physically un-tappable while a transient is open, and when nothing is open `goBack()` equals the back-intent "default" branch. Recommend correcting the stated rationale to the scrim-interception argument, so a future maintainer who changes scrim coverage doesn't unknowingly open a real system-Back≠visible-Back divergence.

## Strengths (verified on disk)

- **Data-layer correctness for Quick Log is right.** `recordTouchpoint` requires `uid` (recency-dao.ts:59-61), returns `{interactionId}`, rejects a future `occurred_at`, calls `bumpDataRevisionCore` (:240). `deleteTouchpoint` (:313) is delete-by-both-keys + tombstone + `recomputeLastContact` in one txn and does not call `bumpDataRevisionCore` — confirming Plan 06's freshness claim. Plan 06 mirrors canonical `doLogContact` (ContactProfileScreen.tsx:339-349) exactly.
- **ADR-075 handling is exemplary** — enforces the planner half, escalates the owner half by name, avoids the `favourite_rank ASC` pattern still at `capture-read.ts:65-66`.
- **Merge-completion and birthday-notification crashes are now owned** (Plan 03 for N10; Plan 01 Task 2 converts the birthday intent from `navigate("Profile")` to a reset).
- **Widget reshape correctly scoped to the gate dispatch only** — verified the gate reads `pending.routes[1]` and `target.params.openReachOut` (widget-linking.ts:260-264) and dispatches at :274/:287; keeping resolver + tests flat avoids breaking those reads.
- Migration gate, D-03 (no migration), D-10 (predictive-back), ADR-018/044/080 all preserved.

## Risk Assessment

**Overall: MEDIUM.** Direction is sound and the revisions closed four of five cycle-1 HIGHs cleanly. The one remaining HIGH (`ImportReviewScreen:215/:289`) is a definite runtime crash on real import paths, but a small, well-understood fix identical to the N9/N10 pattern the plans already apply — a localized completeness gap, not an architectural problem. It must be assigned an owner (Plan 03) before execution, and the "grep every navigate/replace/reset against the route→tab map" step should be executed as a literal task. With that site owned and the two LOW/MEDIUM spec tightenings applied, this phase drops to LOW-MEDIUM.

---

## Orchestrator adjudication (verified against source on disk)

### Unresolved HIGH (3)

1. **Unowned cross-tab crash: `ImportReviewScreen.tsx:215/:289 replace("Profile")`** (Claude lane;
   orchestrator-verified). `ImportReview` is typed `RootStackScreenProps<"ImportReview">`
   (`:74`) and is assigned to SettingsStack; `Profile` is DashboardStack/OrreryStack only →
   route-not-found on the single-import-commit and duplicate-link import paths. Not in the D-08
   inventory, not in any plan's `files_modified`, and tsc-blind because the screen keeps
   `RootStackParamList` typing. **Fix:** add `ImportReviewScreen.tsx` to Plan 03 Task 1 with the
   N9/N10 treatment (`navigationRef.current?.reset(resetToDashboardWith({name:"Profile",params:{contactId}}))`),
   and make "grep every navigate/replace/reset against the post-split route→tab map" a literal
   executor step (the COMPLETE claim missed a site in both cycles). Orchestrator also verified the
   remaining `navigate("Profile")` sites (CreateContactScreen:187, Digest:120, UnboundContacts:113,
   NeverContacted:167/216, Home:221, ContactProfile:312) all resolve intra-DashboardStack — not
   misses.

2. **Discard/Keep guard makes a materially-false promise for immediately-persisted photos** (Codex;
   orchestrator-verified). `EditContactScreen.tsx:170-176` documents that the photo "is written
   IMMEDIATELY through its own dedicated setContactPhoto/clearContactPhoto DAO ... never through the
   metadata Save path." Plan 03 truth (line 35) and Task 3 acceptance (line 169) fold the photo into
   the dirty delta and claim "changing the photo ... then Back shows 'Discard changes?' ... Discard
   leaves" — but Discard cannot revert an already-committed photo, so the user is told they discarded
   a change that persists. **Fix (owner/planner decision):** either exclude the already-persisted
   photo from the Discard delta and correct the acceptance criterion, or stage the photo until Save.

3. **Plan 04 missing `depends_on: 22-02`** (Cursor; orchestrator-verified). Plan 04 frontmatter is
   `depends_on: [22-01]`, but ShellAppBar's child Back wires to `back-intent.ts` (Plan 02) and the
   component imports Plan 02's back-intent/transient-store — both plans are wave 2 and parallelizable,
   so Plan 04 fails if Plan 02 has not landed. **Fix:** add `22-02` to Plan 04 `depends_on` (or gate
   the ShellAppBar-Back subtask on 22-02) and record the Wave-2 order 01 → 03 → 02 → 04.

### Unresolved actionable non-HIGH (7)

- **A. Picker dismiss callback** — Plan 06 Task 2 action/acceptance must call
  `openTransient("contact-picker", onDismiss)` (matching Plan 02's contract) and assert the callback
  arity, so Back/retap actually close the Modal. (codex/cursor HIGH, claude LOW; tsc-bounded)
- **B. Quick Log browse-surface refresh mechanism** — name a concrete mechanism (a small shell
  refresh registry/event, or a Zustand "tick" the focused screen subscribes to) invoked after commit
  AND Undo; without it on-device SHELL-11 UAT ("update without a manual refocus") fails on Home/Orrery.
  (codex/cursor MEDIUM)
- **C. Shared FAB/clearance geometry constant** — export a named constant/module consumed by both
  Plan 04 `use-bottom-clearance.ts` and Plan 05 `UniversalFab`; the plans reference a "shared
  constant" that neither defines, so tab-bar clearance and FAB offset can drift. (codex MEDIUM)
- **D. FAB `originContactId` nested-state extraction** — add a pure `getFocusedContactContext`
  helper with tests for Dashboard-Profile, Orrery-Profile, root tabs, and stale/unavailable nested
  state; the plan describes `getFocusedRouteNameFromRoute` + nested params but ships no tested walker.
  (codex MEDIUM, cursor LOW)
- **E. Correct Plan 02 Task 3's deferral rationale** — replace the false "FAB/picker hidden on child
  screens" reasoning with the verified scrim-interception argument (full-screen absoluteFill scrim,
  `pointerEvents:"auto"` when open) so a future scrim-coverage change cannot silently open a real
  system-Back ≠ visible-Back divergence. (claude LOW; resolves codex's downgraded Back HIGH)
- **F. Edit dirty-delta reset points** — define explicit baselines/reset for form/links/custom-field
  values (and, per HIGH #2, the photo decision) and cover the partial-save-failure / reseed path so a
  coarse `dirty` flag cannot get stuck. (codex MEDIUM; Plan 03 already offers a coarse fallback but
  not the reset behavior)
- **G. Quick Log failure haptic** — the dossier reserves the warning haptic for destructive
  confirmation; use a ratified error haptic or none for an ordinary write error. (codex LOW)

Non-counted spec-clarity notes (tsc-bounded, so surfaced by the existing gate rather than invisible):
Plan 04 header `*Tab` conversion (`HomeScreen.tsx:536/554/572`) should spell out the composite/`navigationRef`
retyping the way Plans 03/05 do (claude MEDIUM); and Plan 01 should add an early compile checkpoint /
fallback-wrapper strategy for registering `RootStackScreenProps`-typed components in the narrower
per-tab navigators (codex MEDIUM). Both are forced to resolve by `npx tsc --noEmit` and will not ship
broken.

---

## Verification coverage (source-grounding pass, authority=grep)

All symbols cited by the 6 plans were resolved against source (symbols under each plan's "Artifacts
this phase produces" were excluded as this-phase creations). Verdicts:

**VERIFIED (quoted file:line):** OrreryScreen.tsx:433/:441 `navigate("Profile")`;
ContactProfileScreen.tsx:762 `goBack()`, :817 `SurvivorSelect`, :827 `ReconcileDetail`,
:312 `navigate("Profile")`, :339 `recordTouchpoint`/doLogContact; ComposeScreen.tsx:267 reset,
:404 hardwareBackPress; notification-nav.ts:101-106 birthday `{type:"navigate",name:"Profile"}`;
widget-linking.ts:132-136 `orbit://favourites`→ManageFavourites, :274 (A4), :287 (A3), :95
FAVOURITES_URI; linking.ts:36 navigationRef, :64 `navigate("Backup")`, :67 `navigate("Capture")`;
recency-dao.ts:313 deleteTouchpoint, :240 bumpDataRevisionCore, :59 RecordTouchpointInput;
dashboard-read.ts:245/:333 `favourite_rank ASC`; sun-picker-read.ts:45 `favourite_rank ASC`;
capture-read.ts:65-66 `favourite_rank ASC`; ImportCompleteScreen.tsx:267/:283/:300;
ReconcileCompleteScreen.tsx:47 reset; MergeImpactSummary.tsx:17 `replace("Profile")`;
RestorePreviewScreen.tsx:99/:123; RestoreResultScreen.tsx:18; HomeScreen.tsx:319/:407/:517/:536/:554/:572;
SettingsScreen.tsx:2008 ManageFavourites; EditContactScreen.tsx:451 `navigate("Profile")`,
:170-176 immediate photo write; OverflowMenu.tsx:47 Modal (no accessibilityViewIsModal);
recency-dao TARGET_VERSION context / database.ts:49 `TARGET_VERSION = 14` (D-03 no-migration);
DigestScreen:128/:132 goBack, ArchivedContactsScreen:181, NeverContactedScreen:87,
UnboundContactsScreen:55, BackupScreen:288, CaptureScreen:216 hardwareBackPress;
AddSpeedDialFab.tsx:98 `navigate("Create")`, :75/:133 absoluteFill scrim + pointerEvents;
widget-render.tsx:549 `orbit://favourites`, widget-quick-action-guard.ts:33 ManageFavourites;
package.json `@react-navigation/native@^7.3.16` + native-stack@^7.18.8 (bottom-tabs not yet present,
consistent with Plan 01 adding it).

**MISSING (grep can check this kind; absent from any plan / inventory) → needs-acknowledgement (not
a hard block):** `ImportReviewScreen.tsx:215/:289 replace("Profile")` — a cross-tab crash site
absent from the D-08 inventory and all `files_modified`. Escalated to HIGH #1 above (a real runtime
crash, not merely a grounding gap).

**Off-by-one / imprecise citation (INFO, mechanism accurate):** notification-gate.tsx birthday
navigate is at `:138` (plan cites `:137`, which is `} else {`); child-screen goBack citations point
at the Back `<Pressable>` opening tag with `goBack()` a few lines inside (e.g. Digest `:128`→`:132`);
notification-nav birthday return spans `:101-106` (plan cites `:101-105`). None affect the claim.

**UNCHECKABLE (grep cannot analyze — behavior/type/runtime):** all `.test.ts` assertion behavior
claims; React Navigation screen-prop variance ("consumers keep compiling" via the RootStackParamList
alias — only `tsc` at execution can confirm); the v7 bottom-tabs `animation` fade token value
(Assumption A1, deferred to execution per the plan); whether `openTransient`'s `dismiss` parameter is
required vs optional (determines the picker-callback runtime severity); on-device UAT items
(crossfade, haptics, TalkBack focus, content clearance).

**Skipped:** symbols under each plan's "Artifacts this phase produces" (reset-intents, back-intent,
focused-route-classification, shell-transient-store, universal-fab-logic, contact-picker-order,
picker-read, UniversalFab, ContactPicker, Snackbar, ShellAppBar, use-bottom-clearance,
discard-keep-guard, GroupEventsScreen, FabActionPlaceholders, the placeholder routes) — created by
this phase, correctly excluded.

## Cross-artifact fact-drift pass (advisory — never counts)

`node gsd-tools drift-guard phase-status --phase 22` → verdict **`uncheckable`** (STATE.md authority;
ranks null). Per the advisory rules only `drifted` is a finding — none reported. Judgment pairs
(ROADMAP Success Criteria ↔ PLAN must_haves.truths; ROADMAP Requirements ↔ PLAN requirement refs;
CONTEXT Decisions ↔ PLAN term usage) surfaced **no contradiction** — only plan-added detail and
single-source truths, which are excluded. No drift.

---

## How to use this feedback

    /gsd-plan-phase 22 --reviews

Priority order: assign HIGH #1 (ImportReview crash) to Plan 03, resolve HIGH #2 (photo Discard —
owner/planner decision) and HIGH #3 (Plan 04 dependency), then the 7 actionables. Schedule the full
ADR-075 retirement (`orbit://favourites` widget-tap target) as its own owner-owned task — the plans
already flag it correctly and it is NOT counted here.
