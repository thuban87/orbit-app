---
phase: 37
cycle: 3
reviewers: [codex, claude]
reviewed_at: 2026-09-15T00:29:14Z
plans_reviewed: [37-01-PLAN.md, 37-02-PLAN.md, 37-03-PLAN.md, 37-04-PLAN.md, 37-05-PLAN.md, 37-06-PLAN.md, 37-07-PLAN.md, 37-08-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "orchestrator-source-grounded"
cycle_summary:
  current_high: 0
  current_actionable: 3
lane_provenance:
  codex: "gsd-review codex lane via `gsd_run query review-lane invoke --slug codex` (which spawned `codex exec --ephemeral -c model_reasoning_effort=low`). Ran cleanly: exit 0, non-stubbed, 293-line source-grounded review with file:line citations. Model banner confirmed gpt-5.6-sol, reasoning=low (the review lane runs LOW effort, not high/terra-high). Result JSON: {ok:true, stubbed:false}."
  claude: "The built-in `claude -p` lane self-skips inside Claude Code (SELF_CLI=claude) and carries the known Write-permission gap in this repo. Per the run directive, the Claude lane was performed by the orchestrator as a read-only, source-grounded pass over all 8 plans + every cited source file/line on disk (app-settings-dao.ts, SettingsScreen.tsx, assist-store.ts, app-settings-dao.test.ts, profile-presentation-dao.ts, ShellAppBar.tsx, BackupScreen.tsx, Restore*Screen.tsx, package.json/package-lock.json). Its findings were verified against code on disk, not plan text."
escalation_triggers: []
---

# Cross-AI Plan Review — Phase 37 (Settings & Personalization) — CYCLE 3 (FINAL)

## Consensus Summary

Two independent source-grounded reviewers — Codex `gpt-5.6-sol` (reasoning=low) and Claude
`opus-4-8` (read the code on disk) — reviewed all 8 replanned plans against the current
repository. Both lanes independently confirm the same result: **the cycle-2 HIGH (ADR-070/D-10)
and all 5 cycle-2 actionable non-HIGH findings are genuinely resolved on disk, not merely
asserted in plan text.** There are **no HIGH-severity blockers** and **no recorded-decision
reversals** this cycle. Overall risk: **MEDIUM** — driven by execution scale (decomposing a
stateful 2,168-line screen across 8 sequential plans), not by unsound design.

### Cycle-3 verification focus — both lanes agree: ALL VERIFIED on disk

1. **HIGH (ADR-070 / D-10) — Interaction Assist path: VERIFIED.** Plan 37-01's migration matrix
   (row `Interaction Assist toggle`) and Task 2 route the migrated toggle through the canonical
   `setInteractionAssistEnabled(exec, on ? 1 : 0, localDateTime())`
   (`src/db/app-settings-dao.ts:1443` — one `inWriteTransaction` that, on `enabled === 0`, runs
   `UPDATE interaction_assists SET status='expired' … WHERE status='pending'`, verified at
   `app-settings-dao.ts:1455-1462`) followed by `getAppSettings` re-read and
   `await useAssistBanner.getState().refresh()`, mirroring the shipped handler at
   `SettingsScreen.tsx:596-606` (verified verbatim on disk). The generic
   `persist()`/`updateAppSettings` path is explicitly forbidden for this toggle. ADR-070/D-10 are
   cited across the objective, must_haves, and Task 2 (read_first/behavior/action/AC). The
   queue-clear-on-opt-off test exists at `app-settings-dao.test.ts:638-671` (opt-off expires all
   pending; opt-on does not resurrect), and Task 2 adds a handler-routing test. **This is decision
   ENFORCEMENT, not a reversal** — the rejected "leave pending assists prompting" alternative is
   NOT reintroduced. `threat_model` T-37-04 tags it HIGH/mitigate.
2. **Plan 37-06 — AI availability HYDRATION migrated: VERIFIED.** Task 2 extracts an injectable
   `loadAiHubAvailability(exec, deps)` porting the full producer chain from
   `SettingsScreen.tsx:397-445` (`hydrateAiConfig` → `resolveActiveAiConnection` →
   `readCredentialPresence` → cached OpenRouter catalog read → `computeAiHubAvailability`), runs it
   fresh on focus, feeds the populated availability to `deriveAiHubState`, and carries the
   `setAiHubError` path — not merely `deriveAiHubState` (which only consumes,
   `settings-ai-hub-logic.ts:54`). Read-path only; no real provider network call; `AiService.ts`
   untouched.
3. **Plan 37-05 — persistNotificationSettings returns/publishes the fresh read: VERIFIED.** The
   helper is specified to RETURN the fresh `AppSettings` from its `getAppSettings` re-read and the
   screen publishes it (must_haves line 29, behavior line 89, AC lines 107-108), mirroring the
   monolith's `setSettings(next)` at `SettingsScreen.tsx:504-506` (verified: persist path at
   501-520 does update → re-read → setSettings → `void reconcileSchedule` + `void
   reconcileDigestSchedule`).
4. **Plan 37-03 — clear-to-NULL ("Default/None") for global profile defaults: VERIFIED.** Task 3
   adds a "Default / None" choice to both the layout and background controls that writes `null`,
   renders the current selection (incl. "Default / None" when null), and adds a null-clear
   round-trip test. Both keys are nullable on disk (`app-settings-dao.ts:310-311` / `461-463`);
   the narrow writers accept `templateUid: string | null` (`profile-presentation-dao.ts:268,289`).
5. **Plan 37-07 — host-aware Backup app-bar chrome: VERIFIED.** Task 2 adds a
   `backupAppBarVariant(host)` pure helper (`"child"`/Back for `host="settings"`, `"root"`
   unchanged for `host="backup-tab"`) applied at `BackupScreen.tsx:290`, with a test. Verified on
   disk: `ShellAppBar` renders the Back affordance only for `variant="child"`
   (`ShellAppBar.tsx:107-117`), and BackupScreen currently ships `variant="root"` (no Back).
6. **Plan 37-02 — per-package patch-key test: VERIFIED.** Task 2 factors
   `backgroundPatchForPackage(pkg, slot)` → `{ galaxyBackground: slot }` for galaxy /
   `{ standardBackground: slot }` for standard, mirroring `onSelectBackground` at
   `SettingsScreen.tsx:522-531` (verified), and adds the patch-key assertion (the still-missing
   half of the cycle-1 choices test).

### Recorded-decision check — no reversals (both lanes)

- **ADR-070 / D-10:** Enforced (queue-clears on opt-off), not reversed. Enforcing an Accepted,
  one-way ADR is a planner call — correct.
- **D-06:** No migration added; `TARGET_VERSION === 29` and `BACKUP_FORMAT_VERSION === 5` unchanged
  (grounded at `database.ts:64`, `029-ai-configuration.ts:15`, `backup/types.ts:13`).
- **D-03:** Category Management remains reserved, typed-but-unregistered, invisible, no CRUD.
- **D-02 / ADR-047:** Only the self-star colour is configurable; no per-contact center-colour
  mechanism introduced.
- **Theme-merge / ADR-087:** Remains PARKED; Appearance built on the current per-package model.
- **DEFAULT_BACKUP_HOST="backup-tab":** Addressed-with-rationale product/risk-posture call reserved
  to the owner; per directive NOT re-raised as HIGH (codex explicitly does not, line 278 of its
  review).

### Agreed Strengths (both lanes)

- ADR-070 is now enforced through the specialized writer with the atomic pending-queue clear +
  banner refresh; the DAO-level privacy invariant is already test-covered.
- Plan 37-06 migrates the true availability PRODUCER chain, not just the consumer.
- Plan 37-05 preserves the reconcile-on-write coupling (both reconcilers fired) AND now returns +
  publishes the fresh read.
- Plan 37-07's explicit `host` prop (fail-closed default) is materially safer than the removed
  nav-state inference; all reset sites are enumerated and host-aware.
- The runtime `SETTINGS_REGISTERED_ROUTES` constant + source-scan test give a real (source-level)
  registration contract that every later plan extends, and correctly excludes `CategoryManagement`.

### Agreed Concerns (raised or corroborated by both lanes) — all non-HIGH, all execution-quality

- **[MEDIUM] Plan 37-02 — failed-write recovery is under-specified AND untested.** must_haves +
  AC require reconciling the live theme store with the durable value on a persist failure, but the
  action prose permits a weaker "just show it wasn't saved" variant (which leaves the Zustand
  selection diverged from SQLite), and the verify block schedules NO failed-write recovery test
  (only the background choices/patch-key test). Codex: lock the behavior to catch → `getAppSettings`
  → `themeSelectionFromSettings` → `useThemeStore.getState().hydrate(...)` → inline error, factor
  it into an injectable helper, and test the failure ordering. (Claude confirmed on disk: Plan 02
  verify block runs only `settings-appearance-background.test.ts` + hub/routes tests.)
- **[MEDIUM] Plan 37-05 — the "screen reflects a successful write" test is promised but no artifact
  delivers it, and helper failure-ownership is ambiguous.** AC line 108 asserts "a test asserts the
  screen reflects a successful write," but the only scheduled test is the logic helper test
  (`settings-notifications-logic.test.ts`), which cannot prove the SCREEN publishes the returned
  value. Also, behavior line 91 has the helper CATCH/log a failed write — so the screen cannot
  distinguish failure from success. Fix: make `persistNotificationSettings` REJECT on failure (screen
  renders the error), and either add a component/controller test or soften the AC to source-inspection
  + helper-return coverage.
- **[MEDIUM] Plan 37-08 — `expo-constants` is used as a direct import but is not a declared
  dependency.** Verified on disk: `expo-constants` is NOT in `package.json`
  dependencies/devDependencies, only present transitively (14 refs in `package-lock.json`). Plan 08
  reads `Constants.expoConfig?.version` from it ("a core Expo module … no install required").
  Importing a transitively-installed module directly is brittle across dependency pruning / SDK
  changes. Fix (planner bucket): declare `expo-constants` directly (Expo-compatible install path),
  OR read the version from a project-owned config module, OR explicitly defer the direct-declaration
  to the release-hardening phase in PLAN.md (Plan 08 already flags Phase-40 legal/release
  follow-ups — this fits there).

### Divergent Views

- **Route-registration "runtime proof" (codex LOW).** Codex notes the `SETTINGS_REGISTERED_ROUTES`
  source-scan test is a source-consistency check, not a true runtime navigation test, and suggests
  renaming the claim to "source-level registration contract." Claude's read: the plans already treat
  the on-device navigation smoke test as the actual runtime proof and the source-scan closes the
  erased-`SettingsStackParamList` false positive that cycle-1 flagged — this is a wording nit, not a
  mechanism gap, and Plan 01/04 already introduced the runtime constant codex's P04 note asks for.
  Not counted actionable.
- **Plan 37-03 global-template writer choice (codex LOW).** Codex prefers the narrow
  `assignGlobalProfileLayoutTemplate`/`assignGlobalProfileBackgroundTemplate` writers over the
  generic `updateAppSettings` PREF path to better communicate the one-axis invariant. Plan 03
  read_first (line 136) already documents BOTH as acceptable and instructs "do NOT reconstruct the
  other axis"; the generic patch updates only the supplied key. Safe either way — a taste preference,
  not counted actionable.

---

## Codex Review

**Lane:** codex `gpt-5.6-sol` (reasoning=low), gsd-review codex lane, exit 0, non-stubbed,
source-grounded with file:line citations. Full verbatim output follows.


## Summary

The replanned eight-plan sequence is coherent, implementation-ready, and substantially stronger than the earlier cycles. All six cycle-3 convergence items are genuinely addressed in the plans and match the mechanisms currently on disk. In particular, Plan 37-01 now preserves ADR-070’s atomic opt-out behavior instead of routing Interaction Assist through the generic settings writer. I found no reversal or weakening of ADR-070, ADR-047, D-02, D-03, D-06, or D-10.

The remaining concerns are execution-quality gaps rather than architectural blockers: two plans promise screen-state behavior without scheduling a screen-level test, the theme write-failure rollback needs a more concrete implementation prescription, and the About plan imports a transitively installed Expo module without declaring it directly. Overall risk is **MEDIUM**, primarily because this is a large sequential decomposition of a stateful 2,168-line screen, not because the design is unsound.

> Status note: Phase 37 has not been executed yet. “VERIFIED” below means the revised plan explicitly specifies the correct mechanism and that mechanism has been verified against current source on disk—not that the planned new files already exist.

---

# Cycle-3 Verification Focus

| Item | Status | Evidence |
|---|---|---|
| 1. ADR-070 / D-10 Interaction Assist path | **VERIFIED** | The existing specialized writer validates the toggle and updates both `app_settings` and every pending assist inside one transaction, then bumps the revision ([app-settings-dao.ts:1437](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1437), [app-settings-dao.ts:1449](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1449), [app-settings-dao.ts:1455](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1455)). The current UI then rereads settings and refreshes the banner ([SettingsScreen.tsx:596](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:596)). Plan 37-01’s matrix and Task 2 explicitly require that exact specialized path, forbid generic `persist()`, cite ADR-070/D-10, retain the existing DAO queue-clear test, and add a handler-routing test. The DAO test proves opt-off expires pending rows and opt-on does not resurrect them ([app-settings-dao.test.ts:638](/home/bwales/projects/orbit-app/src/db/app-settings-dao.test.ts:638), [app-settings-dao.test.ts:652](/home/bwales/projects/orbit-app/src/db/app-settings-dao.test.ts:652), [app-settings-dao.test.ts:663](/home/bwales/projects/orbit-app/src/db/app-settings-dao.test.ts:663)). |
| 2. Plan 37-06 AI availability hydration | **VERIFIED** | `deriveAiHubState` only consumes an availability value ([settings-ai-hub-logic.ts:54](/home/bwales/projects/orbit-app/src/screens/settings-ai-hub-logic.ts:54)); the actual current producer hydrates config, resolves the connection, reads credential presence, loads the local cached OpenRouter catalog, and calls `computeAiHubAvailability` ([SettingsScreen.tsx:397](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:397), [SettingsScreen.tsx:401](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:401), [SettingsScreen.tsx:410](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:410), [SettingsScreen.tsx:426](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:426)). Plan 37-06 now explicitly extracts and migrates this full chain into `loadAiHubAvailability`, including focus-error handling and mocked-dependency coverage. |
| 3. Plan 37-05 fresh notification state | **VERIFIED** | The current write path rereads settings and publishes them before firing both reconcilers ([SettingsScreen.tsx:501](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:501), [SettingsScreen.tsx:504](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:504), [SettingsScreen.tsx:507](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:507), [SettingsScreen.tsx:516](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:516)). Plan 37-05 now requires `persistNotificationSettings` to return the fresh read and the screen to publish it. |
| 4. Plan 37-03 clear-to-NULL profile defaults | **VERIFIED** | Both specialized global-template writers accept `string | null` and update only their respective axis ([profile-presentation-dao.ts:268](/home/bwales/projects/orbit-app/src/db/profile-presentation-dao.ts:268), [profile-presentation-dao.ts:289](/home/bwales/projects/orbit-app/src/db/profile-presentation-dao.ts:289)); the generic settings mapping also targets the existing nullable columns ([app-settings-dao.ts:728](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:728)). Plan 37-03 now requires “Default / None” for both axes and null-clear round-trip tests. |
| 5. Plan 37-07 host-aware Backup chrome | **VERIFIED** | Backup currently uses a root app bar with no Back affordance ([BackupScreen.tsx:288](/home/bwales/projects/orbit-app/src/screens/BackupScreen.tsx:288)). `ShellAppBar` renders Back only for `variant="child"` and calls `navigation.goBack()` ([ShellAppBar.tsx:76](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:76), [ShellAppBar.tsx:107](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:107)). Plan 37-07 now adds and tests `backupAppBarVariant(host)`, selecting `child` for Settings and preserving `root` for the tab. |
| 6. Plan 37-02 per-package background patch key | **VERIFIED** | The current handler writes `galaxyBackground` or `standardBackground` according to the active package ([SettingsScreen.tsx:522](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:522), [SettingsScreen.tsx:526](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:526)). The DAO treats those as distinct validated fields ([app-settings-dao.ts:720](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:720), [app-settings-dao.ts:1142](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1142)). Plan 37-02 now factors and tests `backgroundPatchForPackage`. |

---

# Plan 37-01 — Hub Tracer and Interactions

## Summary

A strong vertical tracer. It preserves reachability through `SettingsMore`, exercises a real preference write before broad decomposition, and now handles Interaction Assist through its decision-governed specialized writer.

## Strengths

- The preserved `Settings` route is consistent with the current stack’s initial route and mounting pattern ([SettingsStack.tsx:95](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:95), [SettingsStack.tsx:101](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:101)).
- The transitional monolith route makes every commit independently usable.
- Interaction Assist correctly preserves the current specialized handler sequence: atomic DAO operation, settings reread, then banner refresh ([SettingsScreen.tsx:596](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:596)).
- The existing DAO test already covers the underlying privacy invariant, including non-resurrection ([app-settings-dao.test.ts:638](/home/bwales/projects/orbit-app/src/db/app-settings-dao.test.ts:638)).
- The discriminated route/action hub model anticipates the later widget row cleanly.

## Concerns

- **LOW — “Runtime route-registration proof” is overstated.** Reading `SettingsStack.tsx` and matching source text is a static source-consistency test, not a runtime navigation test. It cannot prove that React Navigation successfully mounts the component or that wrapper behavior is valid.
- **LOW — The proposed route constant is not literally the single source of registration.** The stack still manually repeats `<Stack.Screen name="…">`; the test detects drift, but registration is not generated from the constant.

## Suggestions

- Rename the claim to “source-level registration contract.”
- Keep the device navigation smoke test as the actual runtime proof.
- Have the source-scan test parse conservatively or clearly document its expected JSX formatting so harmless formatting changes do not cause false failures.

## Risk Assessment

**LOW–MEDIUM.** The architecture is sound; residual risk is mainly in the large amount of UI relocation following the tracer.

---

# Plan 37-02 — Appearance Theme

## Summary

The plan correctly retains live Zustand-driven restyling and durable SQLite persistence, and it now tests both active-package choices and the package-sensitive persistence key.

## Strengths

- The live theme store is explicitly in-memory while SQLite remains authoritative ([theme-store.ts:13](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:13), [theme-store.ts:22](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:22)).
- Theme setters update the active package immediately ([theme-store.ts:50](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:50), [theme-store.ts:51](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:51), [theme-store.ts:63](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:63)).
- The per-package patch helper exactly models the existing persisted behavior ([SettingsScreen.tsx:522](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:522)).
- DAO validation already distinguishes and validates both background columns ([app-settings-dao.ts:1142](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1142), [app-settings-dao.ts:1181](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1181)).
- The plan explicitly avoids the parked theme-model reversal.

## Concerns

- **MEDIUM — Failed-write reconciliation is not concrete enough.** The plan permits either “reload durable state” or merely “show that the change was not saved.” An error notice alone leaves the live Zustand selection diverged from SQLite. The store already exposes a whole-selection `hydrate` operation suitable for restoring the durable projection ([theme-store.ts:27](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:27), [theme-store.ts:49](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:49), [theme-store.ts:77](/home/bwales/projects/orbit-app/src/stores/theme-store.ts:77)).
- **MEDIUM — No automated test covers the failed-write recovery.** The only new test targets background selection and patch keys, not the review-driven durability fix.

## Suggestions

- Lock the behavior to: catch persistence failure → `getAppSettings()` → `themeSelectionFromSettings()` → `useThemeStore.getState().hydrate(...)` → publish the inline error.
- Factor that orchestration into an injectable helper and test the failure ordering.

## Risk Assessment

**MEDIUM.** Happy-path behavior is well covered; failure consistency remains underspecified.

---

# Plan 37-03 — Appearance Identity and Profile Defaults

## Summary

The plan correctly distinguishes the single-row `profile` record from contacts, preserves ADR-047, and adds explicit nullable clearing for both global presentation defaults.

## Strengths

- The new name writer mirrors the existing transaction pattern used for profile photo.
- The plan correctly targets the `profile` table rather than `contacts`; the current DAO already treats the self profile as a separate record.
- Nullable global layout/background writes match the existing narrow writer contracts ([profile-presentation-dao.ts:268](/home/bwales/projects/orbit-app/src/db/profile-presentation-dao.ts:268), [profile-presentation-dao.ts:289](/home/bwales/projects/orbit-app/src/db/profile-presentation-dao.ts:289)).
- The “Default / None” option closes the prior one-way-selection gap.
- The self-star color remains separately validated as six-digit hex and does not create a contact-center color preference ([app-settings-dao.ts:1065](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1065), [app-settings-dao.ts:1078](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:1078)).
- The plan retains the existing “Me” synthetic center option ([SettingsScreen.tsx:488](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:488), [SettingsScreen.tsx:493](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:493)).

## Concerns

- **LOW — UI failure behavior for self-name saves is not specified.** DAO validation and tests are good, but the screen task does not say how rejected input or a failed database write is surfaced.
- **LOW — The plan allows either generic or specialized global-template writes conceptually, but the task selects generic `updateAppSettings`.** This is safe because the patch updates only the supplied key; nevertheless, using the existing narrow writers would better communicate the “one axis only” invariant documented at [profile-presentation-dao.ts:264](/home/bwales/projects/orbit-app/src/db/profile-presentation-dao.ts:264).

## Suggestions

- Add an inline error and retain the unsaved name text after failure.
- Prefer the narrow `assignGlobalProfileLayoutTemplate` and `assignGlobalProfileBackgroundTemplate` writers, or explicitly document why generic patches are chosen.

## Risk Assessment

**LOW–MEDIUM.** Storage and decision boundaries are correct; UI error handling is the main residual gap.

---

# Plan 37-04 — Contacts & Relationships

## Summary

The plan respects D-03 and properly reuses existing contact-management destinations. The reserved Category route remains typed but intentionally unregistered and invisible.

## Strengths

- Existing Settings stack routes already host Custom Fields, Archived, import, merge, and reconciliation flows ([SettingsStack.tsx:113](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:113), [SettingsStack.tsx:118](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:118), [SettingsStack.tsx:145](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:145), [SettingsStack.tsx:154](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:154)).
- The plan reuses the existing fresh permission-read and system-settings handoff rather than creating a second permission flow.
- D-03 is correctly enforced: no visible Categories row, no screen registration, and no CRUD writer.
- It preserves the stable future route name without pretending the manager exists.

## Concerns

- **LOW — “Every active row targets a registered `SettingsStackParamList` route” cannot be proven at runtime from a TypeScript type.** Types are erased. The test needs a runtime route registry or explicit model-level route set.
- **LOW — The “file ownership” no-CRUD assertion is procedural, not automated.** That is acceptable for this phase but should not be described as a test-enforced database invariant.

## Suggestions

- Validate active rows against the runtime registration constant, not `SettingsStackParamList`.
- In the summary, record the manual table-writer audit separately from automated tests.

## Risk Assessment

**LOW.** The plan is largely relocation and navigation reuse, with D-03 carefully guarded.

---

# Plan 37-05 — Notifications

## Summary

The corrected design preserves the most important runtime coupling: every settings write causes a fresh settings read and immediately triggers both scheduler reconcilers.

## Strengths

- The plan mirrors the current sequence: write, reread and publish, then fire both reconcilers ([SettingsScreen.tsx:501](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:501), [SettingsScreen.tsx:504](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:504), [SettingsScreen.tsx:507](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:507)).
- It correctly distinguishes raw OS permission state from the derived “master enabled but blocked” condition.
- The helper’s injected dependencies make ordering, failure, and reconcile invocation testable without native scheduling.
- Birthday notification controls remain separate from birthday presentation, respecting ADR-076.

## Concerns

- **MEDIUM — The plan promises a screen-state assertion without adding a screen test artifact.** `settings-notifications-logic.test.ts` can prove the helper returns fresh settings, but it cannot prove `SettingsNotificationsScreen` publishes that value unless screen rendering is tested or publication is factored into a separately testable controller.
- **LOW — Failure ownership is ambiguous.** The behavior says a failing write “is caught/logged,” but it is unclear whether the helper catches it or rejects for the screen to handle. That affects whether the screen can show an error and whether callers can distinguish failure from success.

## Suggestions

- Make `persistNotificationSettings` reject on failure; catch and render the error in the screen.
- Either add a component test or soften the acceptance criterion to source inspection plus helper return-value coverage.
- If component infrastructure is undesirable, factor “await helper → setSettings(returned)” into a small injected controller and test that.

## Risk Assessment

**MEDIUM.** The core scheduling mechanism is correct, but one acceptance claim currently exceeds the planned automated coverage.

---

# Plan 37-06 — Orrery and AI

## Summary

This plan now uses the correct shared Orrery state source and migrates the full AI availability producer chain rather than only its final derivation.

## Strengths

- The Orrery currently renders from the shared store’s committed state ([OrreryScreen.tsx:218](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:218)); routing Settings through that same store avoids an unsynchronized second writer.
- The store owns both hydration and durable selection projection, consistent with the plan’s shared-source design.
- `lastSystem` is appropriately excluded from Settings.
- The AI plan migrates the full existing hydration pipeline, including credential presence and local cached catalog loading ([SettingsScreen.tsx:397](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:397), [SettingsScreen.tsx:410](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:410)).
- Cached catalog loading is read-only and degrades to `null` without throwing ([openrouter-catalog.ts:152](/home/bwales/projects/orbit-app/src/ai/openrouter-catalog.ts:152)).
- `buildAiEnabledPatch` mutates only `aiEnabled` ([settings-ai-hub-logic.ts:75](/home/bwales/projects/orbit-app/src/screens/settings-ai-hub-logic.ts:75)).

## Concerns

- **LOW — AI focus-error behavior is only partly testable through the helper.** A helper rejection proves propagation, but not that the screen publishes the prescribed message.
- **LOW — Cross-surface agreement test proves store semantics, not mounted UI behavior.** Device UAT remains necessary, as the plan recognizes.

## Suggestions

- Keep the test wording scoped to “helper rejects” unless a screen/controller test is added.
- Ensure the helper’s `getKey` dependency preserves the current custom-endpoint argument behavior shown at [SettingsScreen.tsx:402](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:402).

## Risk Assessment

**LOW–MEDIUM.** The important architectural corrections are complete and match current source.

---

# Plan 37-07 — Data & Backup Dual-Home

## Summary

The explicit host-prop design is materially safer than navigation-state inference. It handles both known dual-home hazards and now also handles the Settings-hosted app bar correctly.

## Strengths

- The existing Backup tree is cleanly isolated in its own stack with four canonical screens ([BackupStack.tsx:10](/home/bwales/projects/orbit-app/src/navigation/tabs/BackupStack.tsx:10), [BackupStack.tsx:13](/home/bwales/projects/orbit-app/src/navigation/tabs/BackupStack.tsx:13)).
- The plan enumerates both reset sites that matter: result return and successful preview completion ([RestoreResultScreen.tsx:18](/home/bwales/projects/orbit-app/src/screens/RestoreResultScreen.tsx:18), [RestorePreviewScreen.tsx:123](/home/bwales/projects/orbit-app/src/screens/RestorePreviewScreen.tsx:123)).
- It correctly leaves file reselection targeting `Backup` within the current host stack ([RestorePreviewScreen.tsx:98](/home/bwales/projects/orbit-app/src/screens/RestorePreviewScreen.tsx:98)).
- It gates the current focus-time singleton drain ([BackupScreen.tsx:259](/home/bwales/projects/orbit-app/src/screens/BackupScreen.tsx:259)); the share-intent router already targets the Backup tab ([linking.ts:56](/home/bwales/projects/orbit-app/src/navigation/linking.ts:56), [linking.ts:67](/home/bwales/projects/orbit-app/src/navigation/linking.ts:67)).
- Host-aware app-bar treatment precisely matches `ShellAppBar` behavior ([ShellAppBar.tsx:107](/home/bwales/projects/orbit-app/src/components/ShellAppBar.tsx:107)).
- The in-memory restore cache is shared module state keyed by a serializable token, so the plan correctly avoids inventing a serialization problem ([backup-restore-logic.ts:31](/home/bwales/projects/orbit-app/src/screens/backup-restore-logic.ts:31), [backup-restore-logic.ts:51](/home/bwales/projects/orbit-app/src/screens/backup-restore-logic.ts:51)).

## Concerns

- **LOW — Pure helper tests do not prove wrapper wiring.** Source assertions plus device UAT cover this, but the unit test alone cannot prove each stack passed the intended host.
- **LOW — The Settings restore success stack becomes `[Settings, RestoreResult]`, bypassing the intermediate Backup screen.** This is consistent with the stated return-to-hub behavior, but should be explicitly checked in device UAT for expected Android Back behavior.

## Suggestions

- Add source-level assertions for both stack wrappers’ literal host props.
- Include Android hardware Back from `RestoreResult`, not just the on-screen return button, in UAT.

## Risk Assessment

**MEDIUM.** The design is correct, but shared screens and navigation resets make this inherently one of the higher-risk plans.

---

# Plan 37-08 — About, Widget, and Monolith Retirement

## Summary

The closeout plan is disciplined: it omits unavailable About rows, models the widget as an action, and requires a full migration-matrix walk before deleting the monolith.

## Strengths

- It avoids displaying the current scaffold identity and explicitly raises package/build identity as an owner/release-hardening decision.
- It correctly omits a build number because no source currently exists.
- The widget remains an OS action rather than being forced into the route model.
- The final matrix walk is appropriate because `tsc` cannot catch deleted behavior.
- Full-suite, type, and color gates are proportionate for the deletion step.
- D-06 is grounded: backup format is currently 5 ([types.ts:13](/home/bwales/projects/orbit-app/src/backup/types.ts:13)); schema target points at migration 29 ([database.ts:64](/home/bwales/projects/orbit-app/src/db/database.ts:64), [029-ai-configuration.ts:15](/home/bwales/projects/orbit-app/src/db/migrations/029-ai-configuration.ts:15)).

## Concerns

- **MEDIUM — `expo-constants` is available transitively but is not declared as a direct dependency.** It appears in `package-lock.json` under the Expo dependency graph, but not in `package.json`. Importing a transitive module directly is brittle across dependency pruning or SDK changes.
- **LOW — The hardcoded semantic-version fallback `"1.0.0"` can become stale.** If runtime config is unavailable in a release mode, About may display the wrong version.
- **LOW — The matrix gate remains a manual process.** This is unavoidable for behavioral relocation, but the plan should not imply the full matrix is machine-enforced.

## Suggestions

- Prefer importing app metadata from a project-owned configuration module or declare `expo-constants` directly using the Expo-compatible installation path during the release-hardening phase.
- Use a neutral fallback such as `"Unknown"` instead of duplicating the version string.
- Record every migration-matrix row and destination in the summary as a checked table.

## Risk Assessment

**MEDIUM.** Deleting the monolith is mechanically reversible, but behavioral omission is the phase’s principal integration risk.

---

# Recorded-Decision Check

- **ADR-070 / D-10:** Enforced correctly. No reversal.
- **D-06:** All plans explicitly prohibit schema or format changes; current values are `TARGET_VERSION = 29` and `BACKUP_FORMAT_VERSION = 5`.
- **D-03:** Category Management remains reserved, invisible, unregistered, and without CRUD.
- **D-02 / ADR-047:** Only self-star color remains configurable; no per-contact center-color mechanism is introduced.
- **Backup default host:** Addressed with rationale as requested; not re-raised as a blocking finding.
- **Theme merge:** Remains deferred; no ADR-087 reversal.

# Overall Risk Assessment

**MEDIUM**

The architecture and recorded-decision handling are now converged. There are no HIGH-severity blockers in cycle 3. The remaining risk comes from execution scale: a large monolith is being split across eight sequential plans while preserving focus effects, native permission state, scheduler reconciliation, shared Zustand state, and dual-host navigation.

Before execution, I would make three small plan edits:

1. Require deterministic rollback to durable theme state after a failed Appearance write.
2. Align Plan 37-05’s screen-state acceptance criterion with an actual component/controller test.
3. Resolve the undeclared direct use of `expo-constants` or choose a project-owned version source.

With those tightened, the plans are ready to execute.

---

## Claude Review

**Lane:** claude `opus-4-8`, performed by the orchestrator as a read-only, source-grounded pass
(the `claude -p` lane self-skips inside Claude Code and has a known Write-permission gap in this
repo). Every claim below was checked against the code on disk, per CLAUDE.md "review the code, not
the diff." Given the code-on-disk primacy directive, this lane's role this cycle was to
independently re-derive the 6 verification items and to verify (not merely accept) codex's findings
against source.

### Summary

The cycle-3 replan is converged. I independently traced all six verification items to the actual
mechanisms on disk and confirm each is genuinely satisfied in the plans (not just asserted), and
that the plans preserve — never reverse — ADR-070, ADR-047 (D-02), D-03, D-06, and D-10. No
HIGH-severity concern remains. The residual concerns are execution-quality gaps in three plans,
each corroborated against source; none is a decision reversal, and none is an owner-bucket call
except the already-owner-reserved DEFAULT_BACKUP_HOST (not re-raised).

### Verification (code-on-disk)

1. **ADR-070 / D-10 (Plan 37-01): VERIFIED.** `setInteractionAssistEnabled`
   (`app-settings-dao.ts:1443`) expires all `pending` interaction_assists on `enabled===0` inside
   one transaction (`:1455-1462`); the shipped handler `onToggleInteractionAssist`
   (`SettingsScreen.tsx:596-606`) does writer → `getAppSettings` → `useAssistBanner.getState().refresh()`;
   `assist-store.ts` exports `useAssistBanner` with `refresh(): Promise<void>`; the DAO queue-clear
   test is at `app-settings-dao.test.ts:638-671`. Plan 37-01 requires exactly this path, forbids
   the generic path, cites ADR-070/D-10 throughout, and adds a handler-routing test. Enforcement,
   not reversal.
2. **AI hydration (Plan 37-06): VERIFIED.** Source chain confirmed at `SettingsScreen.tsx:397-445`
   (`reloadAiAvailability` → `hydrateAiConfig`/`resolveActiveAiConnection`/`readCredentialPresence`/
   cached catalog/`computeAiHubAvailability`). Plan 06 extracts `loadAiHubAvailability` porting the
   whole producer chain, not just `deriveAiHubState` (`settings-ai-hub-logic.ts:54`).
3. **persistNotificationSettings return (Plan 37-05): VERIFIED.** Monolith `persist`
   (`SettingsScreen.tsx:501-520`) does update → re-read → `setSettings(next)` → both reconcilers
   (`void`). Plan 05 makes the extracted helper RETURN the fresh read and the screen publish it.
4. **Clear-to-NULL (Plan 37-03): VERIFIED.** Keys nullable (`app-settings-dao.ts:310-311/461-463`);
   narrow writers accept `string | null` (`profile-presentation-dao.ts:268,289`). Plan 03 adds the
   "Default / None" clear + a null-clear round-trip test.
5. **Host-aware Backup chrome (Plan 37-07): VERIFIED.** `ShellAppBar` Back only for
   `variant="child"` (`ShellAppBar.tsx:107-117`); BackupScreen ships `variant="root"`
   (`BackupScreen.tsx:290`). Plan 07 adds/tests `backupAppBarVariant(host)`; reset sites at
   `RestoreResultScreen.tsx:18` and `RestorePreviewScreen.tsx:123` are made host-aware; `:99`
   `returnToSelection` stays `Backup` (documented); consume gated on `shouldConsumeSharedBackup(host)`.
6. **Per-package patch key (Plan 37-02): VERIFIED.** `onSelectBackground`
   (`SettingsScreen.tsx:522-531`) writes `galaxyBackground`/`standardBackground` per active package.
   Plan 02 factors + tests `backgroundPatchForPackage`.

### Concerns (non-HIGH; corroborated against disk)

- **[MEDIUM] Plan 37-02** — failed-write recovery: AC requires reconcile-to-durable, but the action
  prose permits a weaker option and the verify block schedules no failure-recovery test. Lock the
  hydrate-from-durable path and add a failure-ordering test. (Concur with codex.)
- **[MEDIUM] Plan 37-05** — AC promises a "screen reflects a successful write" test that no scheduled
  artifact delivers (only the logic helper test runs); helper failure-ownership is ambiguous (it
  catches, so the screen cannot surface the error). Make the helper reject; add a component/controller
  test or soften the AC. (Concur with codex.)
- **[MEDIUM] Plan 37-08** — `expo-constants` imported directly but undeclared in `package.json`
  (transitive-only; verified). Declare it directly, use a project-owned version source, or explicitly
  defer to release-hardening in PLAN.md. (Concur with codex; verified the dependency status on disk.)
- **[LOW]** Assorted wording/coverage nits (route-registration "runtime" label; self-name UI error
  path; narrow-vs-generic global writer; wrapper-wiring not unit-proven; Android hardware-Back UAT
  for the Settings→RestoreResult stack). Each is either already mitigated by an existing mechanism/AC
  or below the actionable bar (the plans already carry the mechanism); not counted actionable.

### Risk Assessment

**MEDIUM** — architecture and recorded-decision handling are converged; residual risk is execution
scale (large sequential decomposition of a stateful monolith). No HIGH blockers.
