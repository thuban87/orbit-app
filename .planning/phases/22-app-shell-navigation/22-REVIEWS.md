---
phase: 22
reviewers: [codex, cursor, claude]
reviewed_at: 2026-09-02T19:37:23Z
cycle: 5
cycle_note: "Final convergence cycle. Cycle 4 = 0 HIGH + 7 actionables; all 7 addressed inline in commit f19f65f and verified present on disk this cycle."
plans_reviewed: [22-01-PLAN.md, 22-02-PLAN.md, 22-03-PLAN.md, 22-04-PLAN.md, 22-05-PLAN.md, 22-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  cursor: "composer-2.5"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  cursor: "config-default"
  claude: "harness"
review_method: "codex + cursor as external CLIs (read-only/source-grounded); claude as a read-only subagent (built-in claude -p self-skips inside Claude Code + Write-permission gap, per project convention)"
---

# Cross-AI Plan Review — Phase 22 (App Shell & Navigation)

Convergence cycle 5 (FINAL). Every reviewer was instructed to review the code on disk, not the plan text, and to cite `file:line` evidence. All three lanes report repo access and cite grounded evidence.

## Consensus Summary

All three reviewers independently verified the plans against the code on disk and converge on the same bottom line: **the six plans are well-grounded and ready to execute, with zero unresolved HIGH concerns after applying the counting rules.** All seven cycle-4 inline fixes are confirmed present in the current plans (RESOLVED). The `interactions` single-writer invariant is provably intact — the phase adds no fourth writer and reuses only `recordTouchpoint`/`deleteTouchpoint`; `restore-apply.ts:170` (bulk) and `purge-dao.ts:78` (delete) are untouched. The deep-link acceptance predicate (`widget-linking.ts:103-119`) is byte-for-byte preserved; only the emitted reset *shape* changes. The three standing deferrals (ADR-075 full route retirement; photo "stage until Save"; SHELL-03 child-screen Back) are correctly owner-flagged/accepted and are not re-escalated.

The one contested finding is codex's HIGH on component-level reset typing (`navigation.reset(resetToDashboardRoot())` at A1/C1/C2). This is the SAME "will not compile as written" concern codex raised in cycle 4, and Plan 01 **explicitly incorporates it** as a named compile-safety contingency (`22-01-PLAN.md:229`) with `tsc --noEmit` green as the binding acceptance bar (`:291`, `:333`) and a pre-authorized in-scope remedy (composite-prop migration / a `TabParamList`-typed `navigationRef` dispatcher). Per the convergence counting rules (findings incorporated into PLAN.md acceptance criteria are excluded), it is **not counted as an unresolved HIGH** — the acceptance gate cannot pass while it is unresolved. It is folded into the actionable/divergent notes below as a prescription-tightening opportunity.

### Agreed Strengths (2+ reviewers)

- **Baseline matches disk.** Flat `createNativeStackNavigator` with ~35 sibling routes (`RootNavigator.tsx:57-118`), no `@react-navigation/bottom-tabs` dependency, migration gate before the container (`App.tsx:290-322`). (codex, cursor, claude)
- **`interactions` single-writer invariant provably intact.** Quick Log reuses `recordTouchpoint` (INSERT `recency-dao.ts:195`) + `deleteTouchpoint` (DELETE `recency-dao.ts:336`); the other production writers `restore-apply.ts:170` (bulk upsert) and `purge-dao.ts:78` (delete) are distinct and untouched. No fourth writer added. (codex, cursor, claude — independently grep-verified)
- **Quick Log / Undo write contract faithful to the canonical `doLogContact`** (`ContactProfileScreen.tsx:339-349`): `uid: newUid()`, single `stamp`, `direction:"outbound"`, `connected:1`, `source:"manual"`; `RecordTouchpointInput.uid` is required with no DAO default. (codex, cursor, claude)
- **Finding-B freshness mechanism rests on a verified gap:** `deleteTouchpoint` does NOT call `bumpDataRevisionCore` (unlike `recordTouchpoint:240`), and `HomeScreen` deliberately does not subscribe to the connection-scoped notification (DASH-07) — so the in-process `shell-refresh-store` bump is genuinely required and does not reverse DASH-07. (cursor, claude)
- **Crash fixes tied to real call sites with correct mechanisms:** N10 (`MergeImpactSummary.tsx:17`), N18/N19 (`ImportReviewScreen.tsx:215/:289`), N20 Settings→CropPhoto (`PhotoSourcePicker.tsx:143` mounted at `SettingsScreen.tsx:1351`). (codex, cursor, claude)
- **Deep-link acceptance predicate preserved** (`widget-linking.ts:103-119`, `Number.isSafeInteger`/`>0`); only reset shape changes at `:274/:287`. (cursor, claude)
- **ADR-075 handled at the planner/owner boundary:** new `picker-read.ts` bans `favourite_rank ASC` (membership band only); the two named user-facing entries (`HomeScreen.tsx:319`, `SettingsScreen.tsx:2008`) are removed; full route retirement + `orbit://favourites` retarget is owner-flagged, not silently taken. (codex, cursor, claude)
- **All cycle-4 fixes confirmed present on disk (RESOLVED):** P03 `*Tab`-target reset exemption; P06 Undo await/resolve-gated/reject-error; P05 `getRootState()` null-guard + reactive visibility + cold-start deferral; P04 `useMeasuredTabBarHeight()` + cold-start note; P01 reset-inclusive audit grep + ADR-075 residual list extended with `merge-candidate-read.ts:29` and `capture-read.ts:65-66`. (codex, cursor, claude)

### Agreed Concerns (2+ reviewers)

- **Component-level reset typing (codex HIGH; cursor implicitly LOW via its "compiles, stays tsc-blind" cycle-4 position; claude converges on the navigationRef remedy).** `navigation.reset(resetToDashboardRoot())` at A1 (`ComposeScreen.tsx:267`), C1 (`ImportCompleteScreen.tsx:300`), C2 (`ReconcileCompleteScreen.tsx:47`) dispatches a `TabParamList`-shaped state through a component `navigation` prop typed for `RootStackParamList`. Codex argues this fails `tsc` (or forces an unsafe cast) and that the correct route is the `TabParamList`-typed `navigationRef.reset(...)` — the same dispatcher N10/N18/N19 already use. **Disposition:** incorporated into Plan 01's compile-safety contingency with `tsc`-green as the acceptance bar (see Divergent Views); not counted as an unresolved HIGH, surfaced as an actionable-refinement note.
- **Execution complexity / wave ordering is the dominant residual risk, not plan correctness** — Wave 1 touches the whole route tree; dual/tri-registration must stay synchronized; the functional shell (FAB/picker/snackbar) only completes in Waves 4–5, so phase-level UAT of SHELL-08/10/11 must wait for Plan 06. All documented in-plan. (cursor, claude, codex risk sections)

### Divergent Views

- **Severity of the component-level reset typing.** Codex rates it HIGH ("will not compile as written"); cursor's cycle-4 position was LOW ("compiles but stays tsc-blind"); claude did not raise it as HIGH. Two of three lanes judge it compiles or is non-blocking. Plan 01 already records this three-way split verbatim (`22-01-PLAN.md:229`) and resolves it structurally: `tsc --noEmit` green is the Plan 01 acceptance bar (`:291`, `:333`), and if any reset/registration site fails `tsc` the affected screens enter Plan 01's scope for composite-prop retyping (NOT an unsafe cast, NOT relaxing acceptance). **Recommended tightening (advisory, outcome already bound by the contingency):** pin A1/C1/C2 to `navigationRef.reset(resetToDashboardRoot())` — matching the N10/N18/N19 precedent — so the mechanism, not just the outcome, is unambiguous.
- **Whether `useNavigationState` is a valid FAB-visibility mechanism.** Claude alone caught that Plan 05 lists `useNavigationState(s => …)` first/co-equal for FAB visibility, but the FAB mounts as a NavigationContainer direct child (sibling of the tab navigator) where `useNavigation`-family hooks throw (`linking.ts:17` documents exactly this; `grep` finds no `useNavigationState` anywhere in `src/`; every existing container-child uses `navigationRef`). The working mechanism (`navigationRef.addListener('state', …)`) is already listed as the parenthetical alternative — this is a prescription-tightening actionable, not a structural gap.
- **Quick Log double-press.** Codex alone flagged that Plan 06 mirrors `doLogContact`'s write payload but not its in-flight `logging` latch (`ContactProfileScreen.tsx:332-338`), so a fast double-tap could commit two interactions. Not caught by cursor/claude; grep of Plan 06 confirms no latch/pending/disable guard is specified.

---

## Codex Review

<!-- model: gpt-5.6-terra (reasoning=high); source-grounded, read-only sandbox -->

# Summary

The six plans are well grounded in the current flat-stack app and cover the known cross-tab crash sites, external-entry resets, shell accessibility, and canonical interaction-write path. One implementation-blocking type mismatch remains in component-level Dashboard resets; otherwise the final-cycle fixes are present. No decided behavior is reversed.

# Strengths

## 22-01

- Correctly starts from the actual architecture: one flat native stack registers all routes, including Home, Orrery, Backup, Settings, import, and reconcile screens. `src/navigation/RootNavigator.tsx:57` `:71`
- Preserves the critical migration gate: `NavigationContainer` and its entry gates mount only after readiness. `App.tsx:298` `:309`
- The nested-reset work targets real, currently flat external paths: share intent navigation, notification resets/navigates, widget resets, and Compose's forced Dashboard return. `src/navigation/linking.ts:61` `src/navigation/notification-gate.tsx:131` `src/navigation/widget-linking.ts:265` `src/screens/ComposeScreen.tsx:261`
- It correctly includes the Settings-origin CropPhoto crash path: Settings mounts `PhotoSourcePicker`, which emits a local `navigate("CropPhoto")`. `src/screens/SettingsScreen.tsx:1351` `src/components/PhotoSourcePicker.tsx:143`

## 22-02

- The transient registry solves a real issue with the current FAB: its visibility is component-local React state while its scrim remains mounted. A callback-based dismissal registry is the right mechanism. `src/components/AddSpeedDialFab.tsx:27` `:71`
- Its constrained Back interception is sensible: Compose already owns a focused hardware-back handler for its Dashboard-reset contract, so the shell should only consume Back for transient dismissal. `src/screens/ComposeScreen.tsx:400`

## 22-03

- Correctly repairs real post-split route failures: `ImportReview` currently replaces to Profile on two success paths, and merge completion also replaces to Profile. `src/screens/ImportReviewScreen.tsx:203` `:269` `src/components/MergeImpactSummary.tsx:17`
- The plan correctly recognizes that Edit currently navigates to Profile on save, leaving Edit replayable in the stack. `src/screens/EditContactScreen.tsx:451`
- The dirty-state design correctly excludes photo changes: photo writes are already immediate and deliberately outside the form save flow. `src/screens/EditContactScreen.tsx:171` `:227`

## 22-04

- Targets genuine shell gaps: the current overflow modal lacks modal accessibility isolation and focus restoration. `src/components/OverflowMenu.tsx:46`
- Correctly relocates Dashboard destinations that are presently bare flat-stack navigations, including Backup, Orrery, and Archived. `src/screens/HomeScreen.tsx:403` `:532`
- Correctly removes the two user-facing Manage Favourites entries while retaining the route for the widget deep link. `src/screens/HomeScreen.tsx:314` `src/screens/SettingsScreen.tsx:2004` `src/navigation/widget-linking.ts:132`

## 22-05

- Correctly replaces the actual two-action, Dashboard-local FAB with the required shell-level six-action model. The existing implementation only exposes Import and Create. `src/components/AddSpeedDialFab.tsx:50` `:95`
- The final-cycle measured-tab-bar fix is appropriate: the current FAB uses fixed `bottom: 28`, which would collide with a bottom tab bar. `src/components/AddSpeedDialFab.tsx:131`
- The reactive route-state requirement resolves the prior one-shot snapshot problem.

## 22-06

- Correctly uses the sanctioned interaction writers. `recordTouchpoint` inserts, recomputes recency, and bumps the revision inside one transaction; `deleteTouchpoint` scopes deletion by both interaction and contact, tombstones it, and recomputes recency. `src/db/recency-dao.ts:216` `:232` `:313`
- The planned input mirrors the established profile one-tap log defaults, including required `uid`, local timestamp, outbound direction, and manual source. `src/screens/ContactProfileScreen.tsx:332`
- The refresh mechanism is necessary: Dashboard deliberately does not subscribe to the connection-scoped DB notification, and Orrery currently reloads only on focus. `src/screens/HomeScreen.tsx:9` `src/screens/OrreryScreen.tsx:213`

# Concerns

- **HIGH — 22-01 / 22-03: component-level `navigation.reset(resetToDashboardRoot())` is not type-compatible as specified.** The plan retains `RootStackParamList` as the merged child-route alias, while the proposed helper is typed for `TabParamList` and returns a top-level `DashboardTab` route. Existing Compose, ImportComplete, and ReconcileComplete all receive `RootStackScreenProps`, whose `reset` accepts only that navigation state. `src/screens/ComposeScreen.tsx:126` `src/screens/ImportCompleteScreen.tsx:24` `src/navigation/types.ts:147` React Navigation's `reset` is constrained to the receiver's `State`; it is not an untyped parent action. `node_modules/@react-navigation/core/lib/typescript/src/types.d.ts:349` This will either fail `tsc` or force an unsafe cast, defeating the stated type-safety goal.
  - _Planner adjudication (cycle 5): incorporated, not counted._ This is codex's cycle-4 concern verbatim; Plan 01 records it (`22-01-PLAN.md:229`) and binds it to `tsc --noEmit`-green acceptance (`:291`, `:333`) with an in-scope composite-prop / navigationRef-dispatcher remedy. Surfaced below as an actionable-refinement (pin A1/C1/C2 to `navigationRef.reset`).

- **MEDIUM — 22-06: Quick Log lacks an in-flight latch/single-flight rule.** The plan mints a new UID per invocation and the DAO performs a normal insert, so a double press can produce two committed interactions. `src/db/recency-dao.ts:195` The established Profile logging path explicitly guards against this with `logging`. `src/screens/ContactProfileScreen.tsx:332` The shell implementation should disable action dispatch while its write or Undo is pending.

- **LOW — 22-06: archived-search eligibility should normalize whitespace.** The plan uses `term.length > 0` to include archived rows. A whitespace-only query should be normalized before deciding whether archived contacts may enter the SQL result; otherwise it risks treating an effectively empty search as explicit archived discovery. Existing picker-style reads exclude archived by default. `src/db/capture-read.ts:45`

# Suggestions

- Route component-origin Dashboard resets through a correctly typed root-tab dispatcher: for example, expose a `resetToDashboard…` dispatcher backed by the `TabParamList`-typed `navigationRef`, or dispatch a deliberately typed parent action after resolving the tab parent. Do not widen `RootStackParamList`; its current all-flat shape is precisely what masks wrong-stack routing. `src/navigation/linking.ts:36`
- Add a `quickLogPending` latch in `UniversalFab`, clear it only in both promise terminal paths, and make Undo single-flight as well.
- Use `const query = term.trim()` consistently for SQL inclusion and filtering, then test blank and whitespace-only input.

# Risk Assessment

**HIGH until the component-level reset typing is resolved.** The route split, external fallback preservation, writer discipline, and cycle-4 fixes are otherwise strong, but the planned reset calls are central to Compose Back and completion flows and currently conflict with the actual navigation prop types. After that correction, the remaining risk is **MEDIUM**, centered on duplicate Quick Log submissions and device-level validation of nested navigation behavior.

---

## Cursor Review

<!-- model: composer-2.5; source-grounded, --force non-interactive -->

# Cross-AI Plan Review — Phase 22 App Shell & Navigation (Cycle 5, Final)

## Summary

After verifying claims against the repo on disk, these plans are **ready to execute**. The baseline diagnosis is accurate: the app still uses a single flat `createNativeStackNavigator` with ~35 sibling routes (`src/navigation/RootNavigator.tsx:57-118`), no `@react-navigation/bottom-tabs` in `package.json`, and a dashboard-local two-action `AddSpeedDialFab` (`src/components/AddSpeedDialFab.tsx:22-69`, mounted at `src/screens/HomeScreen.tsx:653`) rather than the dossier's universal six-action dial. The D-08 reset inventory matches reality — nine `reset(` dispatch sites (`ComposeScreen.tsx:267`, `ReconcileCompleteScreen.tsx:47`, `ImportCompleteScreen.tsx:300`, `RestorePreviewScreen.tsx:99/:123`, `RestoreResultScreen.tsx:18`, `widget-linking.ts:274/:287`, `notification-gate.tsx:136`) — and the three crash classes found in prior cycles (merge completion, import review completion, Settings→CropPhoto) are real on disk (`MergeImpactSummary.tsx:17`, `ImportReviewScreen.tsx:215/:289`, `PhotoSourcePicker.tsx:143/:213` from `SettingsScreen.tsx:1351`). Cycle 4's seven actionables are all present in the current plan text (nested-reset `*Tab` exemption, Undo-await, reactive FAB visibility, measured tab-bar cold-start, reset-inclusive audit grep, ADR-075 residual list extension). Residual risk is execution complexity (dual/tri-registration, wave ordering, device UAT surface), not plan correctness.

## Strengths

- **Baseline matches disk.** Flat stack, no tabs dep, migration gate before navigator: `RootNavigator.tsx:71-118`, `package.json:9-10` (no bottom-tabs), `App.tsx:290-322` (`if (!ready)` spinner then `NavigationContainer` only after migration; error branch at `:272-287` prevents mount on failure).
- **D-08 reset inventory is complete and verified.** Nine reset sites enumerated above; external-entry paths and completion resets correctly classified. Backup-local resets stay in Backup stack (`RestorePreviewScreen.tsx:99/:123`, `RestoreResultScreen.tsx:18`).
- **Crash fixes are tied to real call sites with correct mechanisms.** N10/N18/N19 `replace("Profile")` from SettingsStack origins; N20 Settings→CropPhoto (`PhotoSourcePicker.tsx:143` mounted at `SettingsScreen.tsx:1351`); N7 Orrery→Profile (`OrreryScreen.tsx:433/:441`). Fixes (tri-registration + `resetToDashboardWith`) match the failure mode.
- **Origin-aware Profile Back claim is grounded.** `ContactProfileScreen.tsx:762` uses plain `navigation.goBack()`; per-tab stacks make Orrery→Profile→Back=Orrery viable once Profile is registered in `OrreryStack` (Plan 01).
- **Quick Log / Undo data-layer claims are correct.** `recordTouchpoint` returns `{ interactionId }` inside `inWriteTransaction` (`recency-dao.ts:217-242`); `deleteTouchpoint` exists as the Undo path (`recency-dao.ts:313-338`); canonical write shape in `ContactProfileScreen.tsx:338-349` matches Plan 06. Plan 06's interactions-writer audit is accurate: Quick Log uses recency-dao only; bulk restore touches `interactions` via `restore-apply.ts:49-65`; purge deletes via `purge-dao.ts:78`.
- **Security / deep-link guards preserved.** Digit-anchored regexes + `Number.isSafeInteger`/`>0` guards at `widget-linking.ts:103-118`; missing-contact fail-safe at `widget-linking.ts:266-278` (Alert + reset to Home). Plans reshape reset *shape* only, not acceptance logic.
- **ADR-075 handling is disciplined.** Plan 06 picker read explicitly bans `favourite_rank ASC` (contrast `capture-read.ts:66`, `merge-candidate-read.ts:29`, `dashboard-read.ts:245/:333` still rank-ordered on disk). Manage-favourites *entries* removed in Plan 04; *route* retained for `orbit://favourites` (`widget-linking.ts:91-136`) — correctly owner-flagged, not silently dropped.
- **Cycle 4 fixes are present in current plans (resolved):** P03 Step 4 `*Tab`-target reset exemption; P06 Undo **awaits** `deleteTouchpoint`, error snackbar on reject (`22-06-PLAN.md:174`); P05 `getRootState()` null guard + **reactive** route subscription (`22-05-PLAN.md:131-133`); P04 `useMeasuredTabBarHeight()` cold-start deferral (`22-04-PLAN.md:32`); P01 reset-inclusive audit grep + `merge-candidate-read.ts:29` / `capture-read.ts:65-66` in ADR-075 residual list (`22-01-PLAN.md:86-92`).
- **Wave dependencies are coherent.** Plan 04 depends on Plan 02; Plan 05 depends on Plan 04; Plan 06 depends on Plans 02+05. Matches `depends_on` fields.
- **Accepted deferrals documented with verified rationale (not silent gaps).** SHELL-03 child Back deferral safe via full-screen scrim (`AddSpeedDialFab.tsx:73-76`); photo immediate-commit exclusion (`EditContactScreen.tsx:451` save while dirty, photo excluded per Plan 03 Task 3).

## Concerns

### HIGH

*None new.* Prior HIGH findings (N18/N19/N20, birthday container navigate, measured tab-bar for shell FAB, Edit no-replay, compile-safety contingency) are addressed in-plan. Owner-flagged items (ManageFavourites route, photo staging, SHELL-03 child Back) are correctly **not** re-escalated per review rules.

### MEDIUM

1. **Transient N21 crash window between Waves 2 and 4.** After Plan 01 splits stacks, `AddSpeedDialFab` still threads Dashboard `navigation.navigate` into import helpers (`AddSpeedDialFab.tsx:55-61` → `start-contact-import.ts`) until Plan 05 deletes it. Plan 03 documents this (`22-03-PLAN.md:128`) but mid-phase builds between waves 2–4 can crash on dashboard import. **Mitigation:** treat Plan 05 as blocking for any import-from-dashboard UAT, or temporarily disable the FAB import action if intermediate builds are required.
2. **Wave 1 compile-safety contingency may expand scope.** Registering `RootStackScreenProps`-typed screens into narrower per-tab navigators may force composite prop migration for many files in Plan 01 alone (`22-01-PLAN.md:229`). Contingency is documented but Wave 1 remains the highest blast-radius commit.
3. **Dual/tri-registration drift risk.** Profile family (Dashboard + Orrery), CropPhoto (+ Settings), merge cluster (tri), Archived (dual) — same components, multiple stacks. Exhaustive audit in Plan 03 closes the *known* class; future shared components can reintroduce crashes unless the audit is re-run when adding navigators.
4. **SHELL-13 partially delivered until later passes.** Plan 04 applies `ShellAppBar` to tab roots only; existing child screens keep bespoke Back chrome (`22-04-PLAN.md:111`). Acceptable scope boundary, but success criterion "child/focused show Back+title" is only fully met after broader migration.
5. **Functional shell incomplete until Wave 5.** Universal FAB (Wave 4) routes Quick Log to a seam; commit-truthful snackbar + picker land Wave 5. Phase-level UAT of SHELL-08/10/11 must not be signed off before Plan 06.
6. **Edit save still pushes Profile today — fix is plan-critical.** `EditContactScreen.tsx:451` uses `navigation.navigate("Profile", { contactId })`. Plan 03 Task 2 targets this; executor must not skip the no-replay change.
7. **Birthday notification still uses bare container navigate today.** `notification-gate.tsx:137-138`. Plan 01 A2b reshapes to nested reset — must land in the same wave as the tab split.

### LOW

1. **Documentation wave count mismatch.** `STATE.md:17` says "4 waves"; plans use `wave: 5` for 22-06. Cosmetic. _(Advisory STATE-refresh note; not counted.)_
2. **Line-reference drift in Plan 06 writer audit.** Cites `restore-apply.ts:170`; mechanism correct, exact line may be slightly stale. _(Advisory; planner note: on-disk grep this cycle confirms the `interactions` upsert IS at `restore-apply.ts:170`.)_
3. **`picker-read.ts` has no dedicated test file.** Ordering logic is node-tested via `contact-picker-order.test.ts`; SQL read relies on integration/UAT. Acceptable given `capture-read` precedent, but a thin DAO test would reduce regression risk.
4. **App gate wording vs code.** Plans say `ready && !error`; `App.tsx` implements separate `if (error)` and `if (!ready)` returns. Semantically equivalent; executor should not "fix" this.
5. **Redundant Dashboard header shortcuts post-tabs.** `HomeScreen.tsx:536/:554/:572` navigate to Backup/Orrery/Settings. Plan 04 converts to tab switches (N14–N16) rather than removing — intentional owner visual decision, flagged.

## Suggestions

1. Execute Wave 1 as a hard gate (`tsc` green, `reset-intents.test.ts` green, on-device four-tab smoke).
2. Run Plan 03 Task 1 audit grep at execution time and attach the matrix to `22-03-SUMMARY.md`.
3. Block intermediate UAT on dashboard import until Plan 05 removes `AddSpeedDialFab`.
4. Plan 06: add a minimal `picker-read.test.ts` mirroring `capture-read.test.ts` posture.
5. End-of-phase Pixel checklist (active-tab retap, transient dismiss before pop, keyboard hides nav/FAB, Quick Log commit-truth + Undo await, import/merge completion lands Dashboard Profile without crash, Discard/Keep with photo exclusion).
6. Post-phase owner decisions to schedule separately: full ADR-075 retirement, optional photo staging until Save.

## Risk Assessment

**Overall: MEDIUM.** Architectural direction is ratified (ADR-080), plans are internally consistent, and prior review cycles closed real crash classes with executable verification procedures. Risk is concentrated in execution ordering and surface area — Wave 1 touches the entire route tree; dual registration must stay synchronized; several requirements complete only in Waves 4–5. No new decision reversals or data-layer violations were found; `TARGET_VERSION = 14` confirmed, no migration planned. With Wave 1 as a tracer gate, exhaustive Plan 03 audit at execution, and end-of-phase device UAT on the physical Pixel, the phase should achieve SHELL-01–15 as specified.

### Per-plan snapshot

| Plan | Verdict | Key evidence |
|------|---------|--------------|
| 22-01 | Ready | Flat stack `RootNavigator.tsx:57`; 9 resets verified; external paths + tri-registration fixes grounded |
| 22-02 | Ready | Transient store + back-intent design; focused-route list includes CropPhoto + placeholders; SHELL-03 deferral reasoned |
| 22-03 | Ready | Stranded navigates verified on disk; exhaustive audit; Edit no-replay + Discard/Keep grounded |
| 22-04 | Ready | Measured tab-bar store resolves shell-sibling FAB issue; Group Events/Archived entries match `HomeScreen.tsx:319/:407` |
| 22-05 | Ready | Six-action FAB; nested targets; reactive visibility; deletes `AddSpeedDialFab` |
| 22-06 | Ready | Picker ADR-075 compliant ordering; commit-truthful Quick Log mirrors `doLogContact`; Undo awaits `deleteTouchpoint`; shell-refresh addresses DASH-07 gap |

---

## Claude Review

<!-- model: claude-opus-4-8; read-only subagent, source-grounded (~40 file:line claims spot-checked on disk) -->

## Summary

These six plans are unusually well-grounded: ~40 file:line claims were spot-checked against the code on disk and every one verified exactly (the only drift is a cosmetic one-line offset on the birthday branch — `notification-gate.tsx:138`, not `:137`). The interactions single-writer invariant is intact — the phase adds no fourth writer and only reuses `recordTouchpoint`/`deleteTouchpoint`; `restore-apply.ts:170` and `purge-dao.ts:78` are untouched. All five cycle-4 actionables are present in the current plans on disk (RESOLVED). The three standing deferrals are correctly owner-flagged/accepted and are not new. **Zero unresolved HIGH concerns** and **one genuinely new, low-severity actionable** (Plan 05's FAB-visibility mechanism), which the plan already contains a correct remedy for. Overall risk is LOW.

## Strengths (verified against disk)

- **Interactions single-writer invariant provably intact.** `grep` of all INSERT/UPDATE/DELETE on `interactions` returns exactly `recency-dao.ts:195/281/336`, `restore-apply.ts:170` (bulk `ON CONFLICT`), `purge-dao.ts:78` — the three sanctioned writers plus test files. Plan 06 Task 3 reuses `recordTouchpoint`/`deleteTouchpoint` only; the writer-audit note is accurate, including the corrected path `src/backup/restore-apply.ts` (not `src/services/backup/`).
- **Commit-truthful Quick Log write contract faithful to the canonical analog.** `ContactProfileScreen.tsx:339-349` `doLogContact` matches Plan 06's mirror exactly. `RecordTouchpointInput.uid` confirmed REQUIRED with no DAO default (`recency-dao.ts:59-61`).
- **Finding-B freshness mechanism rests on a verified gap.** `deleteTouchpoint` (`recency-dao.ts:313-345`) ends at `recomputeLastContact` and does not call `bumpDataRevisionCore` (unlike `recordTouchpoint:240`); `HomeScreen.tsx:9-15` documents the deliberate DASH-07 non-subscription. The shell-refresh store as an in-process app-level event (not the connection-scoped notification) is correct and does not reverse DASH-07.
- **`deleteTouchpoint` rejects on absent/mismatched target** (`recency-dao.ts:326/340` throw) — so Plan 06's cycle-4 fix (Undo awaits, dismisses/bumps only on resolve, retryable error on reject) is soundly built on real DAO behavior. RESOLVED.
- **N20 crash class real and correctly diagnosed.** `PhotoSourcePicker.tsx:143/213` `navigate("CropPhoto",…)` mounted at `SettingsScreen.tsx:1351`. Tri-registration is the right fix.
- **Deep-link acceptance predicate genuinely untouched** (`widget-linking.ts:103-119`, `:258-264`); Plan 01 reshapes only the emitted reset shape at `:274/:287`.
- **SHELL-03 child-Back deferral safety verified, not asserted.** `speedDialScrimPointerEvents` returns `"auto"` when open (`add-speed-dial-fab-logic.ts:23`) over a `StyleSheet.absoluteFill` scrim (`AddSpeedDialFab.tsx:75/133`). Cycle-2 correction (FAB visible on browse child surfaces) honored; scrim-coverage caveat carried into Plans 02 and 04.
- **All five cycle-4 items confirmed present** (P03 `*Tab` exemption; P06 Undo await/resolve-gated/reject-error; P05 null-guard + reactive visibility + cold-start; P04 `useMeasuredTabBarHeight()` + cold-start; P01 reset-inclusive sweep + ADR-075 list extended with `merge-candidate-read.ts:29` and `capture-read.ts:65-66`, both verified `favourite_rank ASC` on disk).
- **ADR-075 handled correctly at the planner/owner boundary** (new path bans `favourite_rank ASC`; two named entries removed; full retirement + `orbit://favourites` retarget flagged, not silently taken).

## Concerns

- **[LOW → borderline MEDIUM] Plan 05 presents `useNavigationState` as a co-equal (and first-named) mechanism for FAB visibility, but it will throw at the shell-sibling mount.** Plan 05 Task 2 says derive `currentRoute` "from a REACTIVE subscription — `useNavigationState(s => …)` (or a `navigationRef.addListener('state', …)` that setStates)". The FAB is mounted "as a sibling of the tab navigator" — a direct child of `NavigationContainer`, outside any navigator. `src/navigation/linking.ts:17` states `navigationRef` exists precisely so container-children can navigate without a `useNavigation` hook (only available inside a navigator); `useNavigationState` calls `useNavigation()` internally and would throw there. Corroboration: every existing container-child (`ShareIntentGate`, `NotificationResponseGate`, `WidgetLinkingGate` in `App.tsx:310-320`) uses `navigationRef` exclusively, and `grep` finds no `useNavigationState` anywhere in `src/`. **Mitigation already in-plan:** the parenthetical `navigationRef.addListener('state', …)` is the correct, idiomatic mechanism and does work at that mount. Fix: make `navigationRef.addListener('state', …)` the sole prescribed path for FAB visibility and drop `useNavigationState`, so an executor doesn't reach for the first-named option and crash the shell's main capture control. Not a decision reversal and not a data-layer issue.

No HIGH or clear MEDIUM concerns. No decision-reversal beyond the three standing (accepted) deferrals.

## Suggestions

- **Plan 05, Task 2:** demote `useNavigationState` — prescribe `navigationRef.addListener('state', …)` as the mechanism and note explicitly (citing `linking.ts:17`) that `useNavigation`-family hooks are unavailable at the container-child mount.
- **Plan 03, Task 2 (minor, already covered):** the no-replay premise is correct — `EditContactScreen.tsx:451` is a `navigate` (not pop/replace). react-navigation's `navigate` to a `Profile` already beneath `Edit` with matching params pops back to it (no replay); a push occurs when params differ or Profile isn't beneath. The plan's "verify, then pop/replace only if it pushes" instruction handles both — worth stating the `navigate`-dedup nuance so the executor doesn't "fix" a case that already pops.
- **Non-blocking note (already documented in-plan):** merge/import completion now resets to `Dashboard→[Home,Profile]` (Back=Dashboard) from every origin, a deliberate change from the old in-place `replace("Profile")` for the Profile-origin merge. No `[DECIDED]` Back rule covers merge/import completion; the plans state this as "a completion, like import/reconcile Done" — acceptable planner discretion, flagged for owner visibility.

## Risk Assessment: **LOW**

The architecture is ratified (ADR-080), the phase ships no migration (confirmed `TARGET_VERSION` unchanged, no new `src/db/migrations/` file), the interactions single-writer invariant is provably preserved, the deep-link acceptance predicate is byte-for-byte untouched, and the class of cross-tab route-not-found crashes that recurred in cycles 1–3 is now closed structurally by an executable, reset-inclusive re-audit (Plan 03 Task 1). The one new finding is low-severity with its remedy already inside the plan. The heaviest residual risk is inherent execution complexity (tri-registration typing + exhaustive re-audit), front-loaded into the Wave-1 tracer and gated on `tsc`.

## Explicit Verdict

- **Unresolved HIGH concerns: 0.**
- **Cycle-4 actionables (7): all present on disk → RESOLVED.**
- **Actionable MEDIUM/LOW not yet cleanly incorporated (excluding the 3 standing deferrals): 1** — Plan 05's FAB-visibility mechanism should prescribe `navigationRef.addListener('state', …)` as the sole path and drop `useNavigationState`. Rated LOW because the plan already lists the working mechanism as an alternative; a wording/prescription tightening, not a structural change. No blockers to proceeding.

---

## Verification coverage (source-grounding pass)

The planner independently resolved the load-bearing cited symbols against the repo via ripgrep/Read (excluding "Artifacts this phase produces" — the new files the phase creates). Result: **all checked existing-code citations VERIFIED.**

| Citation | Status | Note |
|----------|--------|------|
| `interactions` production writers (all) | VERIFIED | Exactly `recency-dao.ts:195` (INSERT) / `:281` (UPDATE) / `:336` (DELETE) = Quick Log single-writer; `restore-apply.ts:170` (bulk upsert); `purge-dao.ts:78` (delete). All other hits are `.test.ts`/`benchmark.ts` fixtures. No fourth production writer. |
| `restore-apply.ts:170` (bulk interactions upsert) | VERIFIED | `if (entity === "interactions") … INSERT INTO interactions … ON CONFLICT(uid) DO UPDATE`. |
| `purge-dao.ts:78` (interactions delete) | VERIFIED | `deleteSql: "DELETE FROM interactions WHERE contact_id = ?"`. |
| `recency-dao.ts:240` `bumpDataRevisionCore` in `recordTouchpoint` | VERIFIED | Confirms the finding-B claim that `deleteTouchpoint` (`:313-345`) does NOT bump — Undo must explicitly `bumpShellRefresh`. |
| `recency-dao.ts:326/:340` `deleteTouchpoint` rejects on 0/mismatched changes | VERIFIED | Throws with "no interaction matched id=…". Underpins Plan 06 Undo reject→retryable-error. |
| `ContactProfileScreen.tsx:339-349` `doLogContact` write shape | VERIFIED | Matches Plan 06 payload (`uid:newUid()`, `direction:"outbound"`, `connected:1`, `source:"manual"`); `logging` in-flight guard present at `:332-338` (relevant to the codex latch finding). |
| `ContactProfileScreen.tsx:762` Profile Back = plain `goBack()` | VERIFIED | Supports origin-aware Back claim. |
| `OverflowMenu.tsx:47` Modal without `accessibilityViewIsModal` | VERIFIED | The SHELL-14 gap Plan 04 upgrades. |
| `HomeScreen.tsx:319` `navigate("ManageFavourites")`; `:44`/`:653` `AddSpeedDialFab` import + mount | VERIFIED | ADR-075 entry removal + FAB migration targets. |
| `SettingsScreen.tsx:2008` Manage-favourites row | VERIFIED | ADR-075 entry removal target. |
| `merge-candidate-read.ts:29` `favourite_rank ASC` | VERIFIED | ADR-075 residual (cycle-4 addition) — real on disk. |
| `capture-read.ts:65-66` `favourite_rank ASC` | VERIFIED | ADR-075 residual (cycle-4 addition) — real on disk. |
| `PhotoSourcePicker.tsx:143` `navigate("CropPhoto")` mounted at `SettingsScreen.tsx:1351` | VERIFIED (by 3 lanes) | N20 crash class. |
| Cited NEW files (UniversalFab, DashboardStack, reset-intents, shell-transient-store, tab-bar-layout-store, picker-read, ContactPicker, Snackbar, ShellAppBar, use-bottom-clearance, App.tsx, etc.) | UNCHECKABLE (artifacts this phase produces) | Correctly excluded from grounding; these are created by the phase. |

Minor citation drift noted (advisory, not a finding): claude observed the birthday branch at `notification-gate.tsx:138` vs a `:137` reference; cursor noted a possible stale line on `restore-apply.ts:170` (planner re-grep confirms `:170` is correct on disk). Mechanisms correct in both cases.

## Advisory passes (contribute to NEITHER count)

- **Drift-guard** (`drift-guard phase-status --phase 22`): verdict `uncheckable` (not `drifted`) — STATE.md and ROADMAP both authority-consistent for a planned phase; no contradiction. STATE.md "4 waves" vs the plans' 5 waves is an advisory STATE-refresh note, not a review finding.
- **Fact-drift:** no cross-artifact contradiction found.
