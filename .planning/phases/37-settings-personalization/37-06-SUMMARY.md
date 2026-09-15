---
phase: 37-settings-personalization
plan: 06
subsystem: ui
tags: [settings, orrery, ai-hub, shared-preference-source, zustand, react-navigation, h-section, j-section, tdd]

# Dependency graph
requires:
  - phase: 37-settings-personalization
    plan: 01
    provides: SettingsHubScreen at the preserved Settings route, transitional SettingsMore monolith, SETTINGS_REGISTERED_ROUTES contract + source-scan test, settings-hub-model.ts
  - phase: 37-settings-personalization
    plan: 05
    provides: migrated-category leaf-shell pattern (ShellAppBar variant=child + onBack), fresh-on-focus reload idiom, monolith-slimming precedent
provides:
  - SettingsOrreryScreen (§H) at the registered SettingsOrrery route — Display (density + Relationship Satellites) bound to the CANONICAL useOrreryPreferencesStore (committed read / save write, hydrate-on-focus, saving/saveError/hydration + retry) + a Systems section routing to SystemsManagement; lastSystem never surfaced (§C/§H)
  - orrery-preferences-store.cross-surface.test.ts — store-level proof that a Settings-style save publishes committed observed cross-surface through exactly one serialized adapter write, with lastSystem untouched
  - SettingsAIScreen (§J) at the registered SettingsAI route — routes into the canonical Phase 36 AI hierarchy (AIConnection/AIModelPicker/AIPersonalization/AIPermissions/AIPreview) + the AI-Off escape hatch; master toggle flips ai_enabled only (buildAiEnabledPatch); derives hub state from the migrated fresh-on-focus availability hydration pipeline
  - loadAiHubAvailability(exec, deps) — injectable pipeline helper in settings-ai-hub-logic.ts porting reloadAiAvailability (hydrate → resolve connection → credential presence → cached OpenRouter catalog → computeAiHubAvailability); read-path only, no network
  - SettingsOrrery + SettingsAI routes registered (SettingsStackParamList + <Stack.Screen> + SETTINGS_REGISTERED_ROUTES) and hub rows at §A indices 4 and 6
  - Settings monolith slimmed — the Orrery/Systems row and the entire AI group + its availability hydration pipeline removed
affects: [37-07, 37-08]

actuals:
  tokens: 14500
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Settings Orrery Display controls bind to the CANONICAL useOrreryPreferencesStore EXACTLY as OrreryViewOptions does — read preferences.committed, write via preferences.save(getExecutor(), intent), hydrate-on-focus, surface saving/saveError/hydration + retry — so Settings and the Orrery agree through ONE serialized writer (§H, no forked updateAppSettings writer, no duplicate preference model)"
    - "The availability PRODUCER is extracted as an injectable loadAiHubAvailability(exec, deps) helper (deps = hydrateAiConfig/getAiConfig/resolveActiveAiConnection/readCredentialPresence/loadCachedOpenRouterCatalog/getKey), so the AI screen derives deriveAiHubState from a POPULATED availability rather than a default — and the pipeline is unit-testable with mocked deps and NO real AI provider network call"
    - "loadCachedOpenRouterCatalog is injected as a storage-bound thunk so the pure logic module (settings-ai-hub-logic.ts) never imports expo-file-system; the screen owns the on-disk cache-file storage and the picker still owns refresh writes"
    - "The AI master toggle persists ai_enabled ONLY (buildAiEnabledPatch) then re-runs the hydration pipeline, whose hydrateAiConfig re-syncs the store's reactive aiEnabled; AiService.ts is untouched (no egress widening)"

key-files:
  created:
    - src/screens/SettingsOrreryScreen.tsx
    - src/stores/orrery-preferences-store.cross-surface.test.ts
    - src/screens/SettingsAIScreen.tsx
  modified:
    - src/screens/settings-ai-hub-logic.ts
    - src/screens/settings-ai-hub-logic.test.ts
    - src/screens/settings-hub-model.ts
    - src/screens/settings-hub-model.test.ts
    - src/navigation/types.ts
    - src/navigation/tabs/SettingsStack.tsx
    - src/navigation/settings-routes.ts
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Settings Orrery Display prefs route through useOrreryPreferencesStore (the single serialized writer whose save() writes SQLite + publishes committed), NOT a direct updateAppSettings call — resolving the cycle-1 HIGH (a second unsynchronized writer forks §H's canonical preference source). A cross-surface store test replaces the DAO round-trip that could not observe cross-surface agreement (Codex MEDIUM)."
  - "The AI screen migrates the availability HYDRATION pipeline (cycle-2 MEDIUM #1), not just deriveAiHubState: loadAiHubAvailability PRODUCES the populated availability that deriveAiHubState consumes. Extracted as an injectable helper so the producer is provable without a network call; settings-ai-hub-logic.test.ts extended with populated/ready, missing-credential/needs-attention, non-openrouter-skips-catalog, and failure-propagation cases."
  - "lastSystem (remembered/session Orrery state) is NEVER surfaced as a Setting and never passed to save from the Settings surface (§C/§H — persistence alone does not make it a Setting); asserted by the cross-surface test."
  - "No SQLite migration added; TARGET_VERSION stays 29, BACKUP_FORMAT_VERSION stays 5 (D-06). AiService.ts untouched (no egress widening); the migrated hydration reads only the local cached OpenRouter catalog file."

requirements-completed: []

coverage:
  - id: T1
    description: "A Settings-style save on useOrreryPreferencesStore publishes committed observed by any consumer through exactly one serialized adapter write, and never writes lastSystem"
    verification:
      - kind: unit
        ref: "src/stores/orrery-preferences-store.cross-surface.test.ts"
        status: pass
    human_judgment: false
  - id: T2
    description: "loadAiHubAvailability derives a populated (ready) availability from a complete snapshot, needs-attention for a missing credential, skips the catalog read for a non-openrouter lane, and propagates a collaborator failure to the caller's error path — all with mocked deps, no network"
    verification:
      - kind: unit
        ref: "src/screens/settings-ai-hub-logic.test.ts"
        status: pass
    human_judgment: false
  - id: T3
    description: "SettingsOrrery + SettingsAI are in SETTINGS_REGISTERED_ROUTES + SettingsStackParamList, registered as <Stack.Screen>s, and the hub rows sit at §A indices 4 (Orrery) and 6 (AI) in canonical §A order"
    verification:
      - kind: unit
        ref: "src/screens/settings-hub-model.test.ts + src/navigation/settings-routes.test.ts"
        status: pass
    human_judgment: false
  - id: T4
    description: "Source: SettingsOrreryScreen reads committed + writes via preferences.save (no updateAppSettings for orrery_density/orrery_satellites_enabled, no lastSystem) and routes to SystemsManagement; SettingsAIScreen imports deriveAiHubState/buildAiEnabledPatch/loadAiHubAvailability, runs the pipeline fresh on focus, master toggle writes ai_enabled only; AiService.ts unmodified; monolith Systems row + AI group + pipeline removed"
    verification:
      - kind: source-inspection
        ref: "src/screens/SettingsOrreryScreen.tsx + src/screens/SettingsAIScreen.tsx + src/screens/SettingsScreen.tsx"
        status: pass
    human_judgment: false
  - id: UAT
    description: "Device UAT: changing density/satellites in Settings is reflected on the Orrery and vice versa through the one store; AI category routes into Connection/Model/Personalization/Permissions/Preview, master toggle flips AI on/off, hub reflects real availability (needs-attention when a credential is missing)"
    verification: []
    human_judgment: true
    rationale: "Cross-surface single-source agreement and the AI hub's real-availability rendering are UI-observable and OS/config-dependent; deferred to end-of-phase Pixel UAT (verify-ui-on-pixel-yourself). Per memory no-ai-api-calls-without-clearing, do NOT trigger a real AI suggestion API call during UAT without clearing with the owner."

duration: 12min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 06: Orrery (§H) + AI (§J) Categories Summary

**The Orrery and AI categories migrate out of the SettingsMore monolith: SettingsOrreryScreen surfaces the Display prefs (density + Relationship Satellites) bound to the CANONICAL `useOrreryPreferencesStore` — read via `committed`, written via `save()`, hydrated on focus, with `saving`/`saveError`/`hydration` + retry — exactly as OrreryViewOptions does, so Settings and the Orrery agree through one serialized writer with no forked writer and no `lastSystem` leak (§H); SettingsAIScreen routes into the existing Phase 36 AI hierarchy + AI-Off escape hatch, flips `ai_enabled` only (`buildAiEnabledPatch`), and derives its hub state from a migrated, injectable, fresh-on-focus availability HYDRATION pipeline (`loadAiHubAvailability`) that reads only the local cached OpenRouter catalog — no egress widened, `AiService.ts` untouched — with no schema or backup-format change (D-06).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files:** 11 (3 created, 8 modified)
- **Task commits:** 4 (TDD test + 2 feat + 1 hub-model test)

## Accomplishments

- **Cross-surface shared-source test (Task 1, RED).** `orrery-preferences-store.cross-surface.test.ts` builds a store via `createOrreryPreferencesStore(io)` with a mock adapter and proves a Settings-style `save({ density })` / `save({ satellitesEnabled })` publishes `committed` that a foreign (Orrery-side) `subscribe` observer sees, through exactly ONE adapter `write`, and that NO Settings-style save ever carries `lastSystem`. A fourth case shows the single source both ways (a Settings Display write and an Orrery-origin `lastSystem` write both land in the one `committed`). This replaces the DAO round-trip that could not observe cross-surface agreement (review cycle-1 HIGH + Codex MEDIUM). Committed as a `test(...)` commit before the screen.
- **SettingsOrreryScreen (§H, Task 1, GREEN).** A leaf category screen (`ShellAppBar variant="child"` + `onBack`). Its **Display** section binds to the canonical `useOrreryPreferencesStore` EXACTLY as `OrreryViewOptions.tsx` does: density radios and the Relationship Satellites switch read `preferences.committed`, write via `preferences.save(getExecutor(), …)`, hydrate the store fresh on focus (stable-identity `hydrate` selector, generation-guarded so it cannot clobber an in-flight save), and surface `saving`/`hydration` as busy/disabled plus a `saveError`/`hydration === "error"` inline notice with a `retry(getExecutor())` affordance. It does NOT call `updateAppSettings` for `orrery_density`/`orrery_satellites_enabled` (no forked writer, review HIGH) and never passes `lastSystem` (§C/§H). A **Systems** section routes to the canonical `SystemsManagement`.
- **SettingsAIScreen (§J, Task 2).** A leaf category screen that reuses `settings-ai-hub-logic.ts` to render the AI hub: the AI Enabled master toggle (persisting `buildAiEnabledPatch` → `ai_enabled` only), the `deriveAiHubState` sections navigating to the existing AI leaf routes, the AI-Off "Manage saved connections" escape hatch, the focus-load error notice, and the first-use disclosure. JSX + testIDs carried verbatim from the monolith into the child-leaf shell.
- **Migrated availability HYDRATION pipeline (Task 2, review cycle-2 MEDIUM #1).** Extracted `loadAiHubAvailability(exec, deps)` into `settings-ai-hub-logic.ts` — porting the monolith's `reloadAiAvailability`: hydrate config → `resolveActiveAiConnection` → `readCredentialPresence` → load the cached OpenRouter catalog ONLY when the active lane is `openrouter` → `computeAiHubAvailability`. `loadCachedOpenRouterCatalog` is injected as a storage-bound thunk so the pure logic module never imports `expo-file-system`; the screen owns the on-disk cache-file storage. The screen runs the helper fresh on focus, feeds the POPULATED availability to `deriveAiHubState`, and carries the `setAiHubError("Couldn't load AI settings…")` path. `settings-ai-hub-logic.test.ts` extended with mocked-deps cases: populated/ready (→ 6 hub sections), missing-credential/needs-attention, non-openrouter-lane skips the catalog read, and a thrown collaborator rejects out so the caller can surface its error path — all with NO real AI provider network call.
- **Hub-model coverage (Task 3).** `settings-hub-model.test.ts` extended to assert the `Orrery` (§A index 4) and `AI` (§A index 6) `kind:"route"` rows are present, in §A order (Orrery precedes AI), and target the registered `SettingsOrrery`/`SettingsAI` routes; the source-scan `settings-routes.test.ts` proves both are registered `<Stack.Screen>`s.
- **Route registration + monolith slimming.** `SettingsOrrery`/`SettingsAI` added to `SettingsStackParamList`, `*Route` wrappers + `<Stack.Screen>`s registered in `SettingsStack.tsx`, both appended to `SETTINGS_REGISTERED_ROUTES`, hub rows inserted at §A indices 4 and 6. The Orrery/Systems row and the entire AI group + its `reloadAiAvailability` pipeline (and all now-orphaned AI imports/state) were removed from `SettingsScreen.tsx`, which now hosts only the "Add Orbit widget" utility (Plan 08's home).
- No migration added; `TARGET_VERSION` stays 29, `BACKUP_FORMAT_VERSION` stays 5 (D-06). `AiService.ts` untouched (no egress widening).

## Task Commits

1. **Task 1 (RED):** cross-surface shared-source test for Orrery preferences (§H) — `592f804` (test)
2. **Task 1 (GREEN):** Orrery category (§H) — Display bound to shared preference store + Systems routing — `5a298d5` (feat)
3. **Task 2:** AI category (§J) — routes into Phase 36 hub, migrated availability hydration, `ai_enabled` only — `c4ec31c` (feat)
4. **Task 3:** hub-model coverage for Orrery (§A 4) + AI (§A 6) rows — `ca5d957` (test)

## Files

- **Created:** `src/screens/SettingsOrreryScreen.tsx`, `src/stores/orrery-preferences-store.cross-surface.test.ts`, `src/screens/SettingsAIScreen.tsx`
- **Modified:** `src/screens/settings-ai-hub-logic.ts` (new `loadAiHubAvailability` helper), `src/screens/settings-ai-hub-logic.test.ts` (pipeline tests), `src/screens/settings-hub-model.ts` (Orrery + AI rows), `src/screens/settings-hub-model.test.ts` (ordering coverage), `src/navigation/types.ts`, `src/navigation/tabs/SettingsStack.tsx`, `src/navigation/settings-routes.ts`, `src/screens/SettingsScreen.tsx` (Orrery/Systems + AI group + pipeline removed)

## Deviations from Plan

**1. [Rule 3 - Stale plan reference] Monolith line ranges cited in the plan were stale from the pre-decomposition 2,168-line monolith.**
- **Found during:** Task 1 + Task 2 read-first.
- **Issue:** The PLAN's `read_first`/`action` cite `SettingsScreen.tsx` line ranges (Systems row 1945–1958, AI group 1730–1874, `reloadAiAvailability` 397–445) from the original monolith. Plans 01–05 had already slimmed the file to 446 lines, so on disk the Systems row lived at ~365–378, the AI group at ~155–309, and the hydration pipeline at ~75–121 (the same stale-line situation 37-05 documented).
- **Fix:** Migrated by CONTENT (the Systems row; the full AI group + `reloadAiAvailability`), not by the stale line numbers. Behaviour carried verbatim.
- **Files:** `src/screens/SettingsOrreryScreen.tsx`, `src/screens/SettingsAIScreen.tsx`, `src/screens/SettingsScreen.tsx`
- **Commits:** `5a298d5`, `c4ec31c`

**2. [Note — not a deviation] TDD test was green on arrival.**
- The Task 1 cross-surface test characterizes/guards the PRE-EXISTING single-serialized-writer shared-source invariant of `useOrreryPreferencesStore` that the new screen depends on — it is not test-driving new store code (the new code is the screen). Per the TDD fail-fast rule I investigated: the store already implements the shared-source contract by design, so the test passing immediately is expected and correct (it is a guard the screen builds against). Committed as a `test(...)` commit before the `feat(...)` screen commit, preserving the RED→GREEN commit sequence.

## Known Stubs

None. Every rendered Orrery Display control drives a live `useOrreryPreferencesStore.save`; every AI hub row navigates to a real registered leaf route; the AI availability is computed from a live on-disk read. No placeholder/empty-data rendering.

## Threat Flags

None new. Orrery pref writes route through `useOrreryPreferencesStore.save` — the single serialized writer whose adapter uses the validated `updateAppSettings` path; no forked writer, no inline SQL, one shared source (T-37-01 mitigated, §H). The AI category flips `ai_enabled` only via `buildAiEnabledPatch`; `AiService.ts` is untouched, credentials stay SecureStore-only, and the migrated hydration reads only the LOCAL cached OpenRouter catalog file — no new egress, no network on a read path (T-37-03 mitigated). No data leaves the device.

## User Setup Required

None for automated verification. Device UAT (see coverage UAT) on the owner's Pixel: confirm changing density/satellites in Settings is reflected on the Orrery and vice versa (single source); the AI category routes into Connection/Model/Personalization/Permissions/Preview, the master toggle flips AI on/off, and the hub reflects real availability (e.g. needs-attention when a credential is missing). Per memory no-ai-api-calls-without-clearing: do NOT trigger a real AI suggestion API call during UAT without clearing with the owner. Deferred to end-of-phase Pixel UAT (verify-ui-on-pixel-yourself), alongside the still-owed 37-03/37-04/37-05 device checks.

## Verification

- `npx vitest run src/stores/orrery-preferences-store.cross-surface.test.ts` — 4/4 pass.
- `npx vitest run src/screens/settings-ai-hub-logic.test.ts` — pass (existing + 4 new pipeline cases).
- `npx vitest run src/screens/settings-hub-model.test.ts src/navigation/settings-routes.test.ts src/db/app-settings-dao.test.ts` — green.
- `npx tsc --noEmit` — clean (project-wide).
- `npm run check:colors` — clean.
- Full suite: 3587 tests pass across 377 files; 1 pre-existing unrelated transform failure (`src/components/orrery/orrery-controls-render.test.tsx`, Phase 29 `Unexpected token 'typeof'`, 0 tests run) — out of scope, not caused by this plan (and a DIFFERENT file from the passing `orrery-preferences-store.cross-surface.test.ts` this plan adds).
- `AiService.ts` NOT modified (no egress widening); `TARGET_VERSION === 29`, `BACKUP_FORMAT_VERSION === 5` unchanged (D-06).

## Self-Check: PASSED

All three created files present on disk; all eight modified files present; all four task commits (`592f804`, `5a298d5`, `c4ec31c`, `ca5d957`) exist in git history.
