---
phase: 37
cycle: 2
reviewers: [codex, claude]
reviewed_at: 2026-09-14T00:00:00Z
plans_reviewed: [37-01-PLAN.md, 37-02-PLAN.md, 37-03-PLAN.md, 37-04-PLAN.md, 37-05-PLAN.md, 37-06-PLAN.md, 37-07-PLAN.md, 37-08-PLAN.md]
models:
  codex: "gpt-5.6-sol (reasoning=high)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "orchestrator-subagent"
cycle_summary:
  current_high: 1
  current_actionable: 5
lane_provenance:
  codex: "gsd-review codex lane, invoked directly (`codex exec --sandbox workspace-write -c model_reasoning_effort=high`) with the cycle-2 source-grounded resolution-verification prompt; ran cleanly (exit 0, ~125-line review). Model banner confirmed gpt-5.6-sol, reasoning=high."
  claude: "The built-in `claude -p` lane self-skips inside Claude Code (SELF_CLI=claude) and carries the known Write-permission gap in this repo. Per the run directive, the Claude lane was obtained as a read-only, source-grounded subagent pass over all 8 plans + cited source. Its findings were then re-verified against code on disk by the orchestrator — including the codex-only HIGH, which the Claude lane MISSED."
escalation_triggers:
  - "OWNER-ESCALATION (confirmed on disk): Plan 01 reverses accepted, one-way ADR-070 by name. It routes the migrated Interaction Assist toggle through the generic `persist()`/`updateAppSettings` path instead of the specialized `setInteractionAssistEnabled()` writer, dropping the atomic pending-assist expiry and the assist-banner refresh. ADR-070's owner ruling (2026-08-31) — 'off means off, clear at once' — is in its rejected-alternatives list. A cross-AI reviewer (codex) flagged it BY NAME; per CLAUDE.md this is an escalation trigger, not a finding to close."
---

# Cross-AI Plan Review — Phase 37 (Settings & Personalization) — CYCLE 2

## Consensus Summary

Two independent reviewers (Codex `gpt-5.6-sol` @high, Claude `opus-4-8`) reviewed all 8 replanned
plans against the code on disk, verifying each cycle-1 finding is genuinely resolved and grounded.

**Both lanes agree the three cycle-1 HIGHs are genuinely resolved and grounded in source, and all
12 cycle-1 actionable findings are addressed in a PLAN.md task/AC (or deferred):**
- **HIGH-1 (Plan 06 Orrery §H): RESOLVED.** The Settings Orrery Display controls now route through the
  canonical `useOrreryPreferencesStore` (`committed`/`save`/`hydrate`/`retry`), mirroring
  `OrreryViewOptions.tsx`; the direct `updateAppSettings` orrery writer is removed. The store's actual
  exported API (`src/stores/orrery-preferences-store.ts:26-42,69,199`) matches the plan 1:1
  (orchestrator-verified).
- **HIGH-2 (Plan 07 backup singleton): RESOLVED (codex: partially).** An explicit `host` prop threaded
  through per-stack wrappers replaces nav-state inference; a fail-closed `DEFAULT_BACKUP_HOST="backup-tab"`;
  all reset sites enumerated (`RestoreResultScreen.tsx:18`, `RestorePreviewScreen.tsx:99,123`); consume
  gated on `shouldConsumeSharedBackup(host)`, single-drain-per-host tested. Codex's residual points
  (the pure-predicate test does not simulate two mounted screens; `"backup-tab"` is not *semantically*
  fail-closed) are recorded below as a MEDIUM refinement, not a remaining HIGH.
- **HIGH-3 (Plan 08 About §K): RESOLVED.** Narrowed to a real product-name constant (`"Orbit"`, never
  the scaffold name) + semantic version via `expo-constants` (confirmed present in `node_modules`,
  v57.0.11, importable with no install); build number + licenses omitted per §K and deferred to
  owner flags **F-1 / F-2**. A legitimate §K omit-unavailable fix, not a quiet contract drop
  (orchestrator-verified against `app.json` / `package.json` / `node_modules`).

**The lanes DIVERGE on the phase verdict, and the divergence is decisive:**
- **Claude lane: READY TO EXECUTE / MEDIUM risk, 0 new HIGH.**
- **Codex lane: NEEDS REVISION / HIGH risk** — it raised a **new HIGH** the Claude lane missed.

**The orchestrator verified the codex HIGH against code on disk and it is real** (exactly the
subsystem-level, every-writer read CLAUDE.md prioritizes over diff/plan-text review):

- **HIGH (NEW) — Plan 01 reverses accepted ADR-070 by name (OWNER-ESCALATION).** The phase-wide
  migration matrix (`37-01-PLAN.md:96`) records the Interaction Assist toggle as a generic `persist()`
  write, and Task 2 (`37-01-PLAN.md:176`) migrates the toggle "writing through the same local
  `persist()`" — the generic `updateAppSettings` path copied from `SettingsScreen.tsx:498-520`. But the
  shipped monolith deliberately calls the specialized `setInteractionAssistEnabled()`
  (`src/db/app-settings-dao.ts:1443`) and then `useAssistBanner.getState().refresh()`
  (`src/screens/SettingsScreen.tsx:596-601`). That specialized writer, in one transaction, updates the
  preference AND, on opt-out, `UPDATE interaction_assists SET status='expired' … WHERE status='pending'`
  — the ADR-070 "off means off" privacy boundary. **ADR-070 is Accepted, one-way, and its rejected
  alternatives include, by owner ruling (2026-08-31), "*Toggle off leaves already-pending assists to keep
  prompting* — rejected: off means off, clear at once."** Routing the toggle through the generic
  `persist()` drops both the atomic pending-queue expiry and the banner refresh, reversing a recorded
  decision. **Per CLAUDE.md this is an owner-escalation trigger flagged by name, not a finding to
  close.** Required fix: Plan 01 must migrate the toggle through `setInteractionAssistEnabled()` +
  `useAssistBanner.refresh()` (NOT the generic `persist()`), correct the migration-matrix row, and test
  the migrated handler's opt-out queue-clear. (Enforcing ADR-070 is a planner fix; *changing* ADR-070
  would be the owner's call.)

**Escalation-trigger check (recorded-decision removal):** the four named hard constraints are intact —
verified on disk by both lanes and the orchestrator: **D-06** no migration (head `029`,
`TARGET_VERSION=29`, `src/db/database.ts:67`), backup format stays 5 (`src/backup/types.ts:14`);
**D-03** Category CRUD out, `categories` read-only (its only three writers — `001-initial.ts:220` seed,
`007-tombstones.ts:105` uid rewrite, `backup/restore-apply.ts:531` restore upsert — unchanged;
`CategoryManagement` typed-but-unregistered); **D-02 / ADR-047** only `self_sun_colour`/`sunContactId`
configurable; **local-first** no new egress. **BUT** the ADR-070 reversal above is a *fifth* recorded
decision the plan set weakens — outside those four checks — and it is the reason this cycle is not clean.

### Agreed Strengths (both lanes)
- All three cycle-1 HIGHs resolved with source-accurate mechanisms; the store/host/About API names and
  version constants the plans depend on all exist as claimed.
- The runtime `SETTINGS_REGISTERED_ROUTES` + source-scan test (`37-01-PLAN.md:127,210`) is a genuine
  registration proof (reads `SettingsStack.tsx` from disk) that closes the erased-type false positive,
  including the deliberately-unregistered `CategoryManagement` (D-03) case.
- The phase-wide monolith migration matrix + Plan-08 fail-on-unaccounted gate is the right
  behavior-parity mechanism (its Interaction Assist row is the exception — see the HIGH).
- Hard-constraint discipline (D-06/D-03/D-02/local-first) verified on disk.

### Agreed Concerns (actionable, both/either lane, orchestrator-verified — NOT in any PLAN.md)
1. **MEDIUM — Plan 06 does not concretely migrate the AI availability hydration.** Task/AC reference
   `deriveAiHubState`/`buildAiEnabledPatch` but not `computeAiHubAvailability`
   (`src/screens/settings-ai-hub-logic.ts:81`) nor the `reloadAiAvailability` pipeline
   (`hydrateAiConfig` → `resolveActiveAiConnection` → `readCredentialPresence` → OpenRouter catalog →
   focus-load error path, `SettingsScreen.tsx:397-445`) that FEEDS `deriveAiHubState` its availability.
   As written the migrated AI screen may derive hub state from an unpopulated availability.
2. **MEDIUM — Plan 05's `persistNotificationSettings` helper re-reads but discards the fresh settings.**
   The contract (`37-05-PLAN.md:85`) calls `getAppSettings` after the write but neither returns it nor
   publishes it to screen state; the monolith does `setSettings(next)` (`SettingsScreen.tsx:504`). As
   specified, controls can show stale values after a successful write. Require the helper to return the
   fresh `AppSettings` (or take a publication callback) and test that the screen reflects the write.
3. **MEDIUM — Plan 03 global profile defaults have no clear-to-NULL choice.** The writers accept
   `templateUid: string | null` (`src/db/profile-presentation-dao.ts:270,291`) and both keys are
   nullable, but Plan 03 sources choices only from the template lists and writes selected UIDs — no
   "Default / None" option, so a user cannot return to inherited/factory behavior. (Self-*name*
   clear-to-NULL IS handled; the global-template control is the gap.)
4. **MEDIUM — Settings-hosted Backup lacks host-aware navigation chrome.** `BackupScreen` renders
   `<ShellAppBar variant="root" title="Backup & Restore" />` (`src/screens/BackupScreen.tsx:290`) — no
   Back affordance. Reused unchanged in the Settings stack (Plan 07 Task 1), the Settings copy has no
   visible Back, while §M requires preserving shell/back-stack behavior. Make the chrome host-aware.
5. **LOW/MEDIUM — Plan 02 patch-key test is absent (partial resolution of cycle-1 #3).** Plan 02 adds
   `backgroundChoicesForPackage(pkg)` and a choices test, but not the requested assertion that the
   correct per-package key is persisted (`galaxyBackground` vs `standardBackground`,
   `SettingsScreen.tsx:522-531`). Add a patch-key test.

### Divergent Views
- **The phase verdict itself.** Claude → READY/MEDIUM (missed the ADR-070 regression). Codex →
  NEEDS REVISION/HIGH (caught it). The orchestrator verified codex's HIGH on disk and adopts
  NEEDS REVISION / HIGH. This is a textbook instance of CLAUDE.md's warning that plan-text / shallow
  review misses data-layer regressions a subsystem-level read catches.
- **Backup fail-closed default direction (codex, MEDIUM refinement — not counted as a remaining HIGH).**
  Codex argues `DEFAULT_BACKUP_HOST="backup-tab"` is not *semantically* fail-closed (an unanticipated
  mount that omits `host` becomes a second consumer; a truly fail-closed default would not drain). The
  planner chose `"backup-tab"` with explicit rationale (preserve the shipped single-consumer /
  reset-to-Backup behaviour; defaulting to non-consuming would instead risk a shared backup never being
  consumed). Genuinely contested direction; recorded as a divergent view, addressed-with-rationale in
  the plan, not counted as an open actionable.

---

## Codex Review

_Model: gpt-5.6-sol (reasoning=high). Source-grounded lane, ran cleanly (exit 0)._

## 1. Summary

Cycle 2 materially improves the plans: 12 of the 15 cycle-1 findings are resolved and 3 are partially resolved. The Orrery and About HIGHs are fixed, while Backup's explicit host wiring is sound for the two planned mounts but its claimed fail-closed default is not actually fail-closed. More importantly, Plan 01 introduces a new HIGH regression: it routes Interaction Assist through the generic settings writer, bypassing the canonical transactional opt-out that immediately expires pending assists. That weakens ADR-070's owner-decided "off means off" control.

**Verdict: NEEDS REVISION. Overall risk: HIGH.**

## 2. Cycle-1 resolution audit

### Cycle-1 HIGHs

1. **HIGH-1 — Orrery canonical preference source: RESOLVED**

   Plan 06 now explicitly reads `committed`, writes through `save()`, hydrates on mount, exposes `saving`/`saveError`/`hydration`, and invokes `retry()`; its acceptance criteria forbid direct `updateAppSettings` calls for the two Orrery preferences (`37-06-PLAN.md:27-28`, `37-06-PLAN.md:77-94`, `37-06-PLAN.md:107-112`).

   These names match the real store API: `committed`, `hydrated`, `hydration`, `saving`, `saveError`, `hydrate`, `save`, and `retry` are defined at `src/stores/orrery-preferences-store.ts:26-42`. The store serializes writes and publishes `committed` only after a successful adapter write (`src/stores/orrery-preferences-store.ts:66-116`), while its adapter is the sole production writer of `orreryDensity`/`orrerySatellitesEnabled` found in the source (`src/stores/orrery-preferences-store.ts:45-64`).

   The consumer behavior also matches: `OrreryViewOptions` reads `committed` and calls `save()`/`retry()` (`src/components/orrery/OrreryViewOptions.tsx:39-40`, `src/components/orrery/OrreryViewOptions.tsx:144-160`, `src/components/orrery/OrreryViewOptions.tsx:174-205`), and `OrreryScreen` renders from `committed` and hydrates on focus (`src/screens/OrreryScreen.tsx:218-225`, `src/screens/OrreryScreen.tsx:409-420`). Minor wording correction: `OrreryViewOptions` itself does not call `hydrate`; its parent `OrreryScreen` does.

2. **HIGH-2 — Backup dual-home singleton: PARTIALLY RESOLVED**

   The primary defect is fixed: Plan 07 requires explicit per-stack wrappers passing `host="backup-tab"` and `host="settings"` (`37-07-PLAN.md:88-100`), makes both restore completion resets origin-aware (`37-07-PLAN.md:128-134`), and gates `consumeSharedBackup()` with `shouldConsumeSharedBackup(host)` (`37-07-PLAN.md:134-145`). This is grounded in the current hazards: every focused `BackupScreen` presently consumes the singleton (`src/screens/BackupScreen.tsx:259-273`), restore success currently resets to `Backup` (`src/screens/RestorePreviewScreen.tsx:98-129`), and Restore Result does likewise (`src/screens/RestoreResultScreen.tsx:18`). Linking directs native backup shares specifically to `BackupTab › Backup` (`src/navigation/linking.ts:60-68`).

   For the two planned hosts, the helper contract leaves exactly one eligible consumer, and Plan 07 tests that predicate (`37-07-PLAN.md:119-123`, `37-07-PLAN.md:143-147`). However:

   - The test proves the pure predicate, not that two mounted/focused screens invoke the singleton only once.
   - `DEFAULT_BACKUP_HOST = "backup-tab"` is asserted and tested, but it is not semantically fail-closed: an unanticipated mount that omits `host` becomes another consumer. A true fail-closed default would not drain the singleton.

   The user-cited `src/services/backup/backup-restore-logic.ts` does not exist. The actual module is `src/screens/backup-restore-logic.ts`, whose process-local cache is at `src/screens/backup-restore-logic.ts:31-52`.

3. **HIGH-3 — About runtime sources and scope: RESOLVED**

   Plan 08 now limits the surface to the Orbit product name, icon, and semantic version; it explicitly omits build number, licenses, support, and legal rows (`37-08-PLAN.md:29`, `37-08-PLAN.md:79-106`). F-1 and F-2 are recorded as owner-deferred release/legal work (`37-08-PLAN.md:56-58`).

   The source claims check out:

   - `app.json` still contains the scaffold name and version `1.0.0`, supplies an icon, and has no Android `versionCode` (`app.json:3-7`, `app.json:12-20`).
   - The project/package identity is `orbit` (`package.json:2-3`), supporting the `"Orbit"` product constant.
   - `expo-constants` is installed and resolvable: Expo declares it as a dependency (`node_modules/expo/package.json:69-89`), and the package exports its runtime module (`node_modules/expo-constants/package.json:2-14`).

   Narrowing the surface is a legitimate §K-compliant fix, not a quiet contract deletion. §K says to show what genuinely exists and explicitly requires unavailable release/legal rows to be omitted (`docs/dossier/milestone-2/phase-37-settings-personalization-dossier.md:255-263`).

### Twelve actionable non-HIGH findings

1. **Runtime route-registration proof: RESOLVED**

   Plan 01 creates a runtime `SETTINGS_REGISTERED_ROUTES` constant and a source-scan test against actual `<Stack.Screen>` registrations, including a negative assertion for `CategoryManagement` (`37-01-PLAN.md:127-150`, `37-01-PLAN.md:197-220`). This closes the current type-erasure problem: `SettingsStackParamList` is only a type (`src/navigation/types.ts:229-300`), while actual registrations independently exist in `SettingsStack.tsx` (`src/navigation/tabs/SettingsStack.tsx:95-160`).

2. **Plan 01 tracer atomicity: RESOLVED**

   Task 1 now creates a real minimal `SettingsInteractionsScreen`, its logic test, and its route registration in the same task (`37-01-PLAN.md:115-155`). The current stack has only the monolithic `Settings` registration (`src/navigation/tabs/SettingsStack.tsx:95-102`), so the plan no longer relies on a screen that arrives in a later task.

3. **Plan 02 failed writes/background package behavior: PARTIALLY RESOLVED**

   Failed persistence must now produce an inline error and reconcile or clearly disclose the durable mismatch (`37-02-PLAN.md:30-31`, `37-02-PLAN.md:83-100`). The background UI is correctly narrowed to `BACKGROUND_ORDER[themePackage] + None`, with a package-switch test (`37-02-PLAN.md:110-128`). This matches the actual per-package store fields (`src/stores/theme-store.ts:39-68`) and corrects the monolith, which currently renders both packages (`src/screens/SettingsScreen.tsx:922-962`).

   The specifically requested **patch-key test remains absent**. The test only verifies returned choices (`37-02-PLAN.md:118-127`), while correct persistence requires package-sensitive keys such as `galaxyBackground` versus `standardBackground` (`src/screens/SettingsScreen.tsx:522-531`). Add a test asserting the patch key generated for each active package.

4. **Plan 03 self-name semantics: RESOLVED**

   The plan defines `string | null`, trimming, empty/whitespace-to-NULL, a length bound, control-character rejection, loud failure, and tests for every case (`37-03-PLAN.md:68-95`). That aligns with the nullable profile record and existing single-row DAO pattern (`src/db/profile-dao.ts:27-31`, `src/db/profile-dao.ts:38-60`) and the nullable schema column (`src/db/migrations/001-initial.ts:51-59`).

5. **Plan 03 global-template loading/error design: RESOLVED**

   Choices now come from `listProfileLayoutTemplates` and `listProfileBackgroundTemplates`, with explicit loading and inline error states (`37-03-PLAN.md:127-155`). Those are real asynchronous SQLite reads (`src/db/profile-presentation-read.ts:54-75`), and global defaults participate in effective presentation resolution (`src/db/profile-presentation-read.ts:149-170`, `src/db/profile-presentation-read.ts:196-204`).

6. **Plan 04 Contacts permission/status surface: RESOLVED**

   Plan 04 requires fresh-on-focus status, distinct handling for granted/denied/permanent/priming, and an Open system settings action using the existing service (`37-04-PLAN.md:74-107`). The cited API exists: fresh status resolution is at `src/services/contacts/use-read-contacts-permission.ts:78-94`, and `Linking.openSettings()` with fallback is at `src/services/contacts/use-read-contacts-permission.ts:147-158`.

7. **Plan 04 no-category-CRUD guard: RESOLVED**

   The plan replaces the broad grep with a concrete ownership assertion over the three known writers (`37-04-PLAN.md:113-134`). Those writers are verified at:

   - Initial seed: `src/db/migrations/001-initial.ts:217-223`
   - UID rewrite: `src/db/migrations/007-tombstones.ts:100-107`
   - Restore upsert: `src/backup/restore-apply.ts:523-533`

   The plan adds no category DAO or mutation surface and keeps `CategoryManagement` typed but unregistered (`37-04-PLAN.md:122-133`).

8. **Plan 05 shared notification persistence helper: RESOLVED**

   The wording is corrected to "immediately triggered," and the plan extracts an injectable helper with ordering, both-reconciler, and failed-write tests (`37-05-PLAN.md:27-29`, `37-05-PLAN.md:73-103`). This reflects the actual fire-and-forget calls (`src/screens/SettingsScreen.tsx:498-520`). See the new concern below about publishing the re-read settings back to the screen.

9. **Plan 05 raw OS notification state: RESOLVED**

   Plan 05 now tracks fresh OS status independently of the `degraded` state and provides a system-settings handoff (`37-05-PLAN.md:111-133`). That corrects the current behavior, where `degraded` is forcibly cleared whenever the master toggle is off (`src/screens/SettingsScreen.tsx:346-358`). The permission API supplies a fresh `{granted,status}` read on every call (`src/services/notifications/permission.ts:27-38`).

10. **Phase-wide monolith migration matrix: PARTIALLY RESOLVED**

    The matrix exists before decomposition (`37-01-PLAN.md:82-110`), and Plan 08 requires an entry-by-entry walk before deleting the monolith (`37-08-PLAN.md:134-166`). That is the requested mechanism.

    It is not yet reliable enough to close the finding because its Interaction Assist row records only a generic `persist()` write (`37-01-PLAN.md:96`). The real behavior includes the specialized transactional queue expiry and banner refresh (`src/screens/SettingsScreen.tsx:596-605`, `src/db/app-settings-dao.ts:1437-1464`). Consequently, Plan 08's matrix gate would approve the new HIGH regression described below.

11. **Hub route/action discriminated union: RESOLVED**

    Plan 01 defines `{kind:"route"} | {kind:"action"}` and constrains only the route arm to `SettingsRegisteredRoute` (`37-01-PLAN.md:129-150`). Plan 08 uses the action arm for widget pinning rather than navigation (`37-08-PLAN.md:109-129`). The current action being migrated is genuinely an OS request rather than a navigation destination (`src/screens/SettingsScreen.tsx:637-653`).

12. **Device-UAT package/target precondition: RESOLVED**

    Plan 01 explicitly prohibits any device command until the owner confirms the Orbit package name and active `emu-connect` target (`37-01-PLAN.md:114-116`). This is necessary because the current Expo config has no `android.package` and still carries the scaffold identity (`app.json:3-5`, `app.json:12-20`).

## 3. New concerns

- **HIGH — Plan 01 breaks Interaction Assist's canonical opt-out transaction.** The matrix calls it a generic `persist()` write, and Task 2 explicitly routes the toggle through that helper (`37-01-PLAN.md:96`, `37-01-PLAN.md:160-190`). Current code deliberately calls `setInteractionAssistEnabled()` and refreshes the banner (`src/screens/SettingsScreen.tsx:596-605`). The specialized DAO writer updates the preference and expires every pending assist inside one transaction (`src/db/app-settings-dao.ts:1437-1464`). ADR-070 requires immediate queue clearing and explicitly rejects leaving pending assists active after opt-out (`docs/decisions/ADR-070-durable-pending-interaction-assist-lifecycle-and-portable-opt-out.md:16-25`). Plan 01 must retain this writer, re-read settings, and refresh `useAssistBanner`; it should also test the migrated handler sequence.

- **MEDIUM — Plan 06 does not concretely migrate AI availability hydration.** Its task/AC require `deriveAiHubState` and `buildAiEnabledPatch`, but not `computeAiHubAvailability`, credential presence, cached OpenRouter catalog loading, or the focus-load error path (`37-06-PLAN.md:117-142`). The current surface performs all of those operations before deriving hub state (`src/screens/SettingsScreen.tsx:397-445`); `deriveAiHubState` merely consumes a precomputed availability value, while the real computation is a separate function (`src/screens/settings-ai-hub-logic.ts:53-97`). Add these behaviors and an AC/test explicitly.

- **MEDIUM — The notification helper discards its fresh settings read.** Plan 05 says the helper re-reads `getAppSettings`, but neither its contract nor AC returns the result or publishes it to screen state (`37-05-PLAN.md:84-103`). The current implementation calls `setSettings(next)` immediately after that read (`src/screens/SettingsScreen.tsx:501-507`), and the screen renders its controls from local `settings` (`src/screens/SettingsScreen.tsx:251-257`, `src/screens/SettingsScreen.tsx:572`). Require the helper to return the fresh `AppSettings` or accept a publication callback, then test that the screen reflects successful writes.

- **MEDIUM — Global profile defaults have no planned clear-to-NULL choice.** Plan 03 sources choices only from the template lists and writes selected UIDs (`37-03-PLAN.md:131-151`). Both settings are nullable (`src/db/app-settings-dao.ts:300-311`), and the existing narrow writers explicitly accept `templateUid: string | null` (`src/db/profile-presentation-dao.ts:264-303`). Without a "Default/None" choice and test, a user can assign a template but cannot return to inherited/factory behavior.

- **MEDIUM — Settings-hosted Backup lacks planned child navigation chrome.** Plan 07 reuses `BackupScreen` unchanged (`37-07-PLAN.md:88-102`), but that screen renders a root/title-only app bar (`src/screens/BackupScreen.tsx:288-290`). `ShellAppBar` documents that only `variant="child"` supplies Back (`src/components/ShellAppBar.tsx:33-36`, `src/components/ShellAppBar.tsx:107-117`), while §M requires preservation of shell/back-stack behavior (`docs/dossier/milestone-2/phase-37-settings-personalization-dossier.md:271-278`). Make the chrome host-aware so the Settings copy exposes Back while the tab root remains unchanged.

## 4. Escalation-trigger check

- **D-06:** No weakening found. Plans repeatedly prohibit migrations/format changes; the source baseline is `TARGET_VERSION = 29` (`src/db/database.ts:52-67`, `src/db/migrations/029-ai-configuration.ts:15-18`) and `BACKUP_FORMAT_VERSION = 5` (`src/backup/types.ts:13-14`).
- **D-03:** No weakening found. Category CRUD remains absent and `CategoryManagement` stays typed but unregistered (`37-04-PLAN.md:122-133`).
- **D-02 / ADR-047:** No weakening found. Plan 03 preserves self-only color configuration and status-derived contact glow (`37-03-PLAN.md:101-122`), matching ADR-047 (`docs/decisions/ADR-047-app-level-assignable-sun-and-themed-self-identity.md:16-24`).
- **Local-first:** No network read path or widened AI egress is planned; Plan 06 explicitly leaves `AiService.ts` untouched (`37-06-PLAN.md:128-140`).

**OWNER-ESCALATION trigger found outside those four named checks:** Plan 01 weakens accepted ADR-070 by bypassing its atomic "off means off" writer. It must not execute as written. Restoring `setInteractionAssistEnabled()` plus banner refresh enforces the recorded decision; replacing that behavior would require explicit owner approval.

## 5. Risk assessment

**Overall risk: HIGH.** The replanning successfully addresses most cycle-1 defects, but the new Interaction Assist regression would violate a one-way accepted ADR and observable privacy/behavioral guarantee. The remaining partials—Backup's unsafe default, missing theme patch-key test, and incomplete migration matrix—also leave gaps around singleton ownership and behavior-preserving monolith deletion. Once those are corrected, the remaining concerns are localized and testable.

---

## Claude Review

_Model: claude-opus-4-8. Obtained as a read-only source-grounded subagent pass (see `lane_provenance`). NOTE: this lane returned READY/MEDIUM and MISSED the ADR-070 Interaction Assist regression that the codex lane caught and the orchestrator confirmed on disk; weight the Consensus Summary's HIGH accordingly._

# Phase 37 Plan Review — Claude Lane, Cycle 2 (source-grounded)

## 1. Summary + Verdict

The 8-plan sequence for the Settings monolith decomposition was reviewed against the **code on disk**, not just the plan text. Every cycle-1 finding (3 HIGH + 12 actionable) was traced to both the current PLAN.md task/AC and the cited source file. **All three HIGHs are genuinely resolved and grounded**, and all 12 actionable findings are addressed in a plan task/AC (or, for the device-UAT item, as an explicit precondition). The API names, exported symbols, file:line anchors, and version constants the replanned plans depend on all exist as claimed.

- **Verdict: READY TO EXECUTE.**
- **Overall risk: MEDIUM** — not from any unresolved defect, but from the intrinsic surface area of decomposing a 2,168-line monolith across 8 serial waves (behavior-parity risk that only device UAT + the Plan-08 migration-matrix gate can fully retire). No plan-quality blocker remains.
- **Escalation-trigger check: NONE.** No plan deletes, weakens, or inverts D-06, D-03, D-02/ADR-047, or local-first. Verified on disk (see §4).

Cycle-1 HIGHs remaining unresolved/partial: **0**. Actionable findings remaining unaddressed: **0**. New HIGH concerns: **0** (three LOW notes in §3).

_(Orchestrator note: this "0 new HIGH" conclusion is superseded — the Claude lane did not read the Interaction-Assist DAO writer / ADR-070, which the codex lane did. See Consensus Summary.)_

---

## 2. Cycle-1 Resolution Audit

### HIGH-1 — Plan 06 forks the Orrery's canonical preference source (§H) — **RESOLVED**
- **Source grounding confirmed.** `src/stores/orrery-preferences-store.ts` exports exactly the API Plan 06 references: `useOrreryPreferencesStore` singleton (line 199), `createOrreryPreferencesStore(io)` factory (69), `committed` (26/119), `hydrate` (126), `save(exec, intent, origin?, forceLastSystemCommit?)` (151), `retry` (191), `saving`/`saveError`/`hydration` (30-33). `save()` writes SQLite via `io.write` then publishes `committed` through the single serialized `drain` (78-117). `OrreryScreen.tsx:218` renders `useOrreryPreferencesStore((store) => store.committed)` and re-hydrates on focus (`useFocusEffect` at 409, `hydratePreferences` at 416) — the cycle-1 nuance is accurate.
- **Plan now correct:** `37-06-PLAN.md:27,73,89-94,107` route Settings Orrery Display through `committed`/`save`/`hydrate`/`retry`, mirroring `OrreryViewOptions.tsx:39,144,160,184,205` exactly; the AC (`:107`) explicitly forbids a direct `updateAppSettings` write for `orrery_density`/`orrery_satellites_enabled` and forbids writing `lastSystem`. No direct-`updateAppSettings` orrery writer remains anywhere in the plan. Cross-surface store test added (`orrery-preferences-store.cross-surface.test.ts`, `:86,109`). The store API names in the plan match the code 1:1.

### HIGH-2 — Plan 07 backup dual-home singleton — **RESOLVED**
- **Source grounding confirmed.** `BackupScreen.tsx:259-273` drains `consumeSharedBackup()` in a `useFocusEffect` (the double-drain hazard). `RestoreResultScreen.tsx:18` resets to `{name:"Backup"}`. `RestorePreviewScreen.tsx:99` (`returnToSelection`) and `:123` (success reset base `[{name:"Backup"},{name:"RestoreResult"}]`) are the two other reset sites. `BackupStack.tsx:13-16` registers the four screens as bare `component={}`. `linking.ts:67` routes a shared backup to `navigationRef.current?.navigate("BackupTab",{screen:"Backup"})` — the tab copy is the intended single consumer. All four Backup param shapes exist in `types.ts:216-227`.
- **Plan now correct:** `37-07-PLAN.md:30,52` replace nav-state inference with an **explicit `host` prop** threaded through per-stack wrappers (`host="settings"` in SettingsStack, `host="backup-tab"` in BackupStack), `DEFAULT_BACKUP_HOST="backup-tab"` fail-closed (`:88,121`). Every reset site is enumerated and made origin-aware via `restoreReturnRouteName(host)` — `RestoreResultScreen:18` and `RestorePreviewScreen:123` routed; `:99` documented as staying `Backup` (`37-07-PLAN.md:128-132,144`). Consume gated on `shouldConsumeSharedBackup(host)` (true only for backup-tab), with a single-drain-per-host test (`:120,122,143`). Singleton is drained exactly once per topology; fail-closed default is specified and tested. `getParent`/`getState` inference removed entirely.

### HIGH-3 — Plan 08 About surface with no runtime source (§K) — **RESOLVED (legitimate §K narrowing, not a silent drop)**
- **Source grounding confirmed.** `app.json:3,5` = name/slug `"orbit-scaffold"`, version `"1.0.0"`, **no** `android.versionCode`. `package.json:5-49` lists neither `expo-constants` nor `expo-application` as a direct dep. **However**, both ARE present transitively in `node_modules` (`expo-constants@57.0.11` exporting `Constants.expoConfig?.version`; `expo-application@…` also present). So `expo-constants` is genuinely resolvable with no install, as the plan claims.
- **Plan now correct:** `37-08-PLAN.md:29,51,90-92,102` display a real product-name **constant** (`"Orbit"`, never the scaffold name), read the semantic version from `expo-constants` with a `"1.0.0"` module fallback, and **omit** build number (no `versionCode`) and licenses/acknowledgements (no generator). These omissions honor §K "omit unavailable rows," and both are recorded as owner-deferred **F-1** (product/build identity → Phase 40) and **F-2** (OSS attribution → Phase 40) at `:56-58`. This is a legitimate §K fix, not a quiet drop: the content that lacks a runtime source is deferred to the owner by name, and the scaffold-name display risk is eliminated. Judgment: narrowing is correct and honest.

### 12 Actionable Findings

1. **Runtime route-registration (Plans 01/04/08) — RESOLVED.** `37-01-PLAN.md:127,210` create `SETTINGS_REGISTERED_ROUTES` (runtime `as const`) as the single source, plus a source-scan test that reads `SettingsStack.tsx` from disk via `node:fs` and asserts each registered route has a real `<Stack.Screen>` AND that `CategoryManagement` is NOT registered — the exact D-03 typed-but-unregistered false-positive. Confirmed on disk that `CategoryManagement` is absent from `SettingsStack.tsx` and `types.ts` today. Plans 04/08 extend the same contract (`37-04-PLAN.md:53,131`; `37-08-PLAN.md:54,164`).
2. **Plan 01 tracer atomicity — RESOLVED.** `37-01-PLAN.md:76,114-140` — Task 1 ships a real minimal `SettingsInteractionsScreen` (message-mode write + DAO round-trip) wired end-to-end and independently green; Task 2 expands. `MESSAGE_MODES`/`assertMessageMode` confirmed exported (`app-settings-dao.ts:185,200`).
3. **Plan 02 live-vs-durable + background grid — RESOLVED.** `37-02-PLAN.md:31,85,100` add an inline save-error notice + durable reconcile on a failed `persist()`; `:30,118,127` render only `BACKGROUND_ORDER[themePackage]`+None via a tested `backgroundChoicesForPackage(pkg)` helper.
4. **Plan 03 self-name semantics — RESOLVED.** `37-03-PLAN.md:76-80,84` define `setProfileName(exec, name: string|null, now)`, trim, empty/whitespace→NULL, ≤100 chars, control-char reject, `changes===1` loud-fail. Grounded: `setProfilePhoto` (`profile-dao.ts:38-61`) is the exact analog, `getProfile` returns `{name,photo,modified_at}` (95-102), file header documents `name` nullable until this editor.
5. **Plan 03 global-template data/loading/error — RESOLVED.** `37-03-PLAN.md:46,139,151` source choices from `listProfileLayoutTemplates`/`listProfileBackgroundTemplates` (confirmed `profile-presentation-read.ts:54,65`) with explicit loading + error states; keys `profile_layout_template_uid`/`profile_background_template_uid` confirmed real PREFs (`app-settings-dao.ts:617-618,729-730`).
6. **Plan 04 contacts permission surface — RESOLVED.** `37-04-PLAN.md:28,90,103` reuse `getContactsPermissionState`+`openContactsSettings` — confirmed exported (`use-read-contacts-permission.ts:83,148`, `Linking.openSettings()`), verdicts `granted|permanent|denied|priming`. No new permission path.
7. **Plan 04 no-CRUD guard as file-ownership — RESOLVED.** `37-04-PLAN.md:52,124,133` assert no new category DAO/mutation function; the three known `categories` writers stay the only ones. Not a diff grep.
8. **Plan 05 persistNotificationSettings — RESOLVED.** `37-05-PLAN.md:28,51,85-86` extract a shared injectable `persistNotificationSettings(exec, patch, deps)` firing both reconcilers via `void` (fire-and-forget), tested for ordering + failure. "Synchronously" replaced with "immediately triggered." Word-accurate to the shipped `void` pattern.
9. **Plan 05 raw OS permission separate from degraded — RESOLVED.** `37-05-PLAN.md:29,52,122,129` read `getNotificationPermission()` (confirmed `permission.ts:32`, `{granted,status}`) fresh on focus in its own state, independent of the master toggle, with a `Linking.openSettings()` handoff.
10. **Phase-wide migration matrix — RESOLVED.** Lives in `37-01-PLAN.md:82-110` (`<monolith_migration_matrix>`) before decomposition; `37-08-PLAN.md:52,147,162` walk it entry-by-entry and fail on any unaccounted group. Matrix covers every group in the CONTEXT inventory incl. behaviors/error-states/focus effects. _(Orchestrator/codex correction: the matrix's Interaction Assist row records a generic `persist()` write, understating the ADR-070 transactional opt-out — this is the root of the new HIGH; this finding is PARTIALLY resolved.)_
11. **Discriminated union for widget row — RESOLVED.** `37-01-PLAN.md:77,129` define `{kind:"route"} | {kind:"action"}` from the outset; Plan 08 (`:30,53,119`) uses the `action` arm for the widget row.
12. **Device-UAT precondition — RESOLVED (as precondition).** `37-01-PLAN.md:79,116` require confirming the Orbit package name + `emu-connect` target with the owner before any device command (CLAUDE.md Android section is quest-board-derived).

---

## 3. New Concerns (all LOW — none blocking)

- **N1 (LOW) — `37-06-PLAN.md:86` cross-surface test proves the mechanism, not singleton-sharing.** The test builds a fresh store via `createOrreryPreferencesStore(io)`; it demonstrates that one `save` publishes `committed` to any reader of *that* instance. Cross-*surface* agreement in production actually rests on both screens importing the same `useOrreryPreferencesStore` singleton — which the source ACs (`:107`) do assert (Settings imports it; `OrreryScreen.tsx:218` already consumes it). Combined coverage is adequate; the test name slightly overstates the isolated store's proof. No change required.
- **N2 (LOW) — `37-07-PLAN.md:98` RestoreResult param shape must stay byte-identical across `BackupStackParamList` and `SettingsStackParamList`.** `RestoreResult` is defined inline in `types.ts:220-226`; since `RootStackParamList` is a type intersection (`types.ts:314-317`), any drift between the two declarations is caught by `tsc`. Executor should reference/reuse the existing shape rather than re-hand-type it. Self-correcting via the tsc gate.
- **N3 (LOW) — `37-08-PLAN.md:51` rationale for omitting build number is slightly imprecise.** It cites "expo-application not a direct dep," but `expo-application` IS resolvable transitively in `node_modules`. The *conclusion* (omit the build number) remains correct because `app.json` has no `android.versionCode`, so there is nothing meaningful to display. Cosmetic — the deferral to F-1/Phase 40 is the right call.

---

## 4. Escalation-Trigger Check — **NONE** (per this lane; superseded by the Consensus ADR-070 finding)

Verified on disk that no recorded decision is deleted, weakened, or inverted:
- **D-06 (no schema migration / no format bump):** migration head = `029-ai-configuration.ts`; `AI_CONFIGURATION_SCHEMA_VERSION = 29` → `TARGET_VERSION = 29` (`database.ts:67`); `BACKUP_FORMAT_VERSION = 5` (`backup/types.ts:14`). Every plan reuses existing columns / the existing `profile` record; no plan adds a migration file; Plan 08 (`:165`) re-asserts both constants at phase close. Intact.
- **D-03 (Category CRUD out, categories read-only, reserve route only):** Plan 04 (`:29,122,133`) reserves `CategoryManagement` as a typed-but-unregistered route name, renders no row, adds no CRUD writer; the source-scan test enforces non-registration. `categories` stays read-only. Intact.
- **D-02 / ADR-047 (only self_sun_colour / sunContactId configurable):** Plan 03 (`:23,109,119`) keeps only the self-star colour configurable, no user-chosen colour for a contact centre, ADR-047 enforced not reversed. Intact.
- **Local-first (no network egress on a read path):** no plan adds a `fetch` on any read path; Plan 06 (`:30,128,139`) flips only `ai_enabled` and leaves `AiService.ts` untouched (no egress widening). Intact.

## 5. Risk Assessment — MEDIUM (READY TO EXECUTE)

Hard constraints are respected and verified on disk. All three cycle-1 HIGHs are resolved with source-accurate mechanisms (Orrery store API, backup host prop + single-drain, About runtime sources), and all 12 actionable findings land in concrete tasks/ACs. The runtime `SETTINGS_REGISTERED_ROUTES` + source-scan contract is a genuine registration proof (reads the actual stack file), closing the erased-type false positive including the D-03 case. Residual risk is the ordinary behavior-parity exposure of relocating ~14 monolith groups across 8 serial waves — bounded by the Plan-01 migration matrix, the Plan-08 fail-on-unaccounted gate, the full `npm test` gate, and per-wave device UAT. No plan-quality blocker; no owner-escalation item arises from this review.
