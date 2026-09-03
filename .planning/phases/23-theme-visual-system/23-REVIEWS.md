---
phase: 23
reviewers: [codex, claude]
reviewed_at: 2026-09-03T10:19:49Z
convergence_cycle: 4
plans_reviewed: [23-01-PLAN.md, 23-02-PLAN.md, 23-03-PLAN.md, 23-04-PLAN.md, 23-05-PLAN.md, 23-06-PLAN.md, 23-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  claude: "unknown"
model_sources:
  codex: "banner"
  claude: "unknown"
# NOTE: the claude lane ran as a read-only Claude Code subagent (the `claude -p` review
# lane has a Write-permission gap on this host — see MEMORY "Claude reviewer via subagent").
# Both lanes reviewed the CODE ON DISK, not just plan text: every load-bearing file:line
# claim was opened and verified, and both traced every writer/consumer of app_settings +
# the backup export/restore path per the project's "review the code, not the diff" rule.
---

# Cross-AI Plan Review — Phase 23 (Theme & Visual System) — Convergence Cycle 4

Two independent reviewers (Codex `gpt-5.6-terra` at high reasoning, and a read-only Claude
subagent) reviewed all 7 plans against the actual source. This is cycle 4 — plans revised
across 3 prior cycles. Prior-cycle-resolved items (backup allowlist-now/emit-later with no
format bump and OPTIONAL snapshot keys; per-mode `{fill,onAccent,text}` accent tones + split
AA gate with 4.5:1 intact; compare-before-write idempotency; zustand-envelope unwrap;
composited worst-case-pixel glass AA + opacity-ordering guard; SunBody gating;
semantic→route-key tab mapping) were re-verified on disk and are confirmed resolved.

## Consensus Summary

Both reviewers independently confirm the plan set is unusually rigorous, its file:line
citations are accurate, and its owner-bucket firewalls are correctly placed. **Neither
reviewer found a decision reversal** — no plan deletes, weakens, or inverts a `[DECIDED]` /
`[REJECTED]` item in `HANDOFF.md` or an ADR (Codex: "No plan reverses or weakens a
[DECIDED]/[REJECTED] decision"; Claude: "zero HIGH concerns … every project guardrail is
honored"). All prior-cycle HIGH resolutions are correctly and verifiably reflected in the
code and plans on disk.

The reviewers **diverge on severity** of two items Codex rated HIGH; Claude, doing the same
disk verification, rated both non-HIGH with explicit reasoning (see Divergent Views). On the
merits, neither is an unresolved defect or a decision reversal: the underlying resolutions
agreed in cycle 3 are present, and the residuals are verification-precision refinements
addressable as MEDIUM/LOW plan edits.

### Agreed Strengths

- **Migration 015 head+1 is verified on disk, not assumed** — `src/db/database.ts:49`
  `TARGET_VERSION = 14`, latest migration file is `014-interaction-assists.ts`, MIGRATIONS
  ends at `migration014`. Matches the D-03 renumber discipline. (Both reviewers.)
- **Backup forward-safety is grounded in the real mechanism** — the unconditional
  `...portable` spread (`export-manifest.ts:63,74`), the hard-reject
  (`backup-schema.ts:129-135`), and the restore-apply patch path
  (`restore-apply.ts:272`). Allowlist-now / emit-later with NO `BACKUP_FORMAT_VERSION` bump
  (`types.ts:14` still `3`) is the correct sequencing; `phoneRegionOverride` is correctly
  identified as REQUIRED+EMITTED now (not a live deferred-emission precedent). (Both.)
- **compare-before-write idempotency is provably required** — `updateAppSettings`
  unconditionally bumps `modified_at` AND `data_revision` even on an empty patch
  (`app-settings-dao.ts:606-618`), so gating on "mapped blob non-empty" would corrupt backup
  last-writer-wins after a failed AsyncStorage clear. (Both.)
- **Zustand-envelope unwrap justified** — the `orbit-theme` payload is
  `{"state":{mode,presetId},"version":1}` (`theme-store.ts:26-40`); reading top-level
  `.mode/.presetId` would silently no-op on every real device. (Both.)
- **SunBody is a genuine second reduced-motion consumer** — `OrreryCanvas.tsx:94` is the sole
  `useClock`, but `SunBody.tsx:82-100` pulses off the shared clock via `useOrreryClock()`;
  gating only OrreryCanvas would leave the sun pulsing under reduced motion. Claude confirmed
  these are the ONLY two clock consumers, so "audit every consumer" is complete. (Both.)
- **Reduced-motion bridge correctly rejects Reanimated's boot-time-only `useReducedMotion`**
  in favor of the live `AccessibilityInfo` subscription; the node-testable
  `createReducedMotionController` is the right design given the repo has no
  react-test-renderer. (Both.)
- **Owner-approved galaxy-dark hues are protected** — the flag-for-owner partition's
  provenance citations are exact, including the correctly-identified UNDATED
  textPrimary/textSecondary that must still be treated as owner-bucket. (Both.)

### Agreed Concerns (actionable, both reviewers)

- **[23-06] The declared "worst-case brightest pixel" is not enforced against the committed
  asset bytes.** The composited per-asset AA node test proves AA only under the *declared*
  pixel in `backgrounds.ts`; nothing decodes the shipped `.webp`, so a too-bright asset could
  drop text below AA on-device while all tests stay green (THEME-11 is a hard a11y
  requirement). Plan acknowledges it as "a design CONSTRAINT the shipped asset must not
  exceed." **Plan change:** add a per-asset device-UAT step (place body+caption text over
  each Galaxy asset's brightest region and confirm legibility); optionally add a build-time
  image-luminance gate (candidate Phase 15). Evidence: `scripts/check-colors.sh` scans TS/TSX
  text only; the test compares the declaration, not the bytes.

### Divergent Views

- **[23-03] Galaxy-dark `danger` (#E5484D over surfaceElevated ≈ 4.03:1) already misses AA.**
  Codex rates HIGH (an `autonomous:true` plan cannot reach green because the flag-for-owner
  test fails loudly). Claude rates LOW ("the intended firewall behavior, not a flaw"). On the
  merits: the split gate's flag-for-owner path is the sanctioned cycle-3 resolution and
  handles this correctly (stop-and-ask, never edit the owner hue, never weaken AA). This is
  NOT an unresolved defect and NOT a decision reversal — it is the firewall working. It is,
  however, a real **owner-bucket decision** that will surface during execution: retune the
  owner-approved galaxy-dark danger hue (owner taste) or accept the sub-AA pair. Both
  reviewers suggest the flag-for-owner SUMMARY record a *proposed* AA-passing hue + the
  measured ratio so the owner's call is a yes/no rather than an open design task.
- **[23-06] SunBody reduced-motion propagation mechanism.** Codex folds this into a HIGH: the
  plan's Task-3 `files_modified` lists only `OrreryCanvas.tsx` + `SunBody.tsx`, while the plan
  text says "pass the SharedValue down (e.g. via the existing OrreryClock context or a prop)"
  — context/prop routes would touch `orrery-clock-context.ts` / `OrreryScreen.tsx`, which are
  not listed. Claude did not flag it (it verified the gating is complete). On the merits: the
  in-scope, file-owned path (`SunBody` calls `useReducedMotionShared()` directly) is available
  and obvious, so the gating outcome is sound; the only refinement is pinning the mechanism to
  that direct call to avoid an executor editing an unlisted file. Non-HIGH.

## Actionable items for planning (MEDIUM / LOW)

1. **[23-01, MEDIUM] Single canonical accent/background ID source.** Plan 01 adds
   `assertAccentId (null-or-known-id)` / `assertBackgroundId (null-or-known-slot)` with
   "exported constants" in Wave 1, but the accent tone data (`accents.ts`, Plan 03) and the
   background slot manifest (`backgrounds.ts`, Plan 06) are authored in later waves. Pin
   Plans 03/06 to CONSUME Plan 01's exported id constants as the single source (not redefine
   parallel lists), with a test asserting the DAO validator and each resolver accept exactly
   the same IDs — otherwise the lists can drift. Evidence: `app-settings-dao.ts:555-596`;
   Plan 01:180,247. (Codex.)
2. **[23-03 + 23-07, MEDIUM] Named destructive foreground token.** Current `ThemePalette` has
   `accent`/`danger` but no `onDanger` foreground (`theme-types.ts:29-46`). Plan 03 tests
   "danger-as-fill vs its foreground (the near-white/onAccent glyph)"; Plan 07's Destructive
   Button specifies only a `danger` fill with no named foreground for its label + warning
   glyph. Add and AA-validate an explicit `onDanger` (or an explicitly-named shared)
   foreground token in Plan 03, and require Plan 07 to consume it for the destructive label
   and glyph. Evidence: Plan 07:88,93; `.planning/.../23-UI-SPEC.md:260-264`. (Codex.)
3. **[23-05, MEDIUM] Restrict `Icon.tone` to string-valued color tokens.** Plan mandates
   `useTheme().colors[tone]` but leaves the `tone` type unspecified; `keyof ThemePalette`
   includes array-valued members (`avatarSwatches`, `gravityTiers`, `starPalette`,
   `theme-types.ts:48-65,110-132`), so `colors[tone]` yields `string | readonly string[]`,
   which cannot feed Ionicons' `color` prop. Specify a string-valued `ColorToken`/`IconTone`
   union (and a narrower one for `StatusGlyph`). tsc will catch the hole, but the intended
   union should be pinned so the executor narrows it correctly. (Codex.)
4. **[23-06, MEDIUM] Enforce brightest-pixel AA (Agreed Concern above)** — device-UAT step
   per asset and/or a build-time luminance gate. (Both.)

### Non-counted notes (covered, minor, or handled-by-executor)

- [23-06] SunBody propagation mechanism — gating is planned and `SunBody.tsx` is in
  `files_modified`; recommend pinning to a direct `useReducedMotionShared()` call (see
  Divergent Views). (Codex — non-blocking precision.)
- [23-04, LOW] Add a controller test for a rejected `isReduceMotionEnabled()` promise (treat
  as the documented static-default state). Natural part of the controller's TDD suite. (Both.)
- [23-01, LOW] Before reworking `theme-store`, grep `dashboard-prefs-store.ts` /
  `ai-model-prefs-store.ts` for `useThemeStore` selector usage (they matched a `theme-store`
  grep; almost certainly persist-idiom references, not selection state). (Claude.)
- [23-01, LOW] Device-UAT the restore-before-paint with a **Standard-Light** saved value (max
  deviation from the Galaxy-dark default splash) — the "no wrong-theme flash" guarantee is a
  neutral-splash-then-saved-content-frame by design (`App.tsx:80,292`), acceptable per
  D-10/THEME-03 but worth an explicit non-default device confirmation. (Claude.)
- [23-06] Background asset provenance/licensing must be genuine and redistributable (product
  is distribution-bound); owner spot-check the `assets/backgrounds/README.md` rows. (Claude.)
- [23-03] When the flag-for-owner path fires, record the proposed AA-passing hue + ratio in
  the SUMMARY for a yes/no owner decision. (Both — see Divergent Views.)
- Requirements THEME-04/05/07/08/09/10 are delivered at the PRIMITIVE level this phase; screen
  adoption is Phase 15/37 (planning-notes:78-81) — a deliberate, recorded scope boundary
  consistent across Plans 02/05/06/07. Verifiers should score these "primitive delivered," not
  "in-app satisfied." (Both.)

---

## Codex Review

*(gpt-5.6-terra, reasoning=high — reviewed all 7 plans against the checkout; traced the full
app_settings write/read/export/restore path and the persisted Zustand stores.)*

I reviewed all seven supplied plans against the current checkout. I also traced the full `app_settings` write/read/export/restore path and the persisted Zustand stores. The previously resolved backup wire-shape, envelope, AA-tone, live-glass, and tab-route findings remain resolved and are not re-raised below.

## Plan 01 — Persistence tracer, package axis, and boot migration

### Summary

This is a strong vertical tracer: it correctly puts the irreversible schema change at migration 015, replaces the only relevant persisted Zustand store, and keeps the format-3 export wire shape unchanged. The remaining problem is dependency ordering for validation of IDs whose canonical data does not exist until downstream plans.

### Strengths

- The migration number is verified rather than assumed: the checkout is at `TARGET_VERSION = 14` and registers migrations through 014 only in `src/db/database.ts:49-67`.
- The legacy payload treatment is accurate. `orbit-theme` is a Zustand `persist` envelope with `state.mode` and `state.presetId`, not a flat object (`src/stores/theme-store.ts:25-41`), so the planned unwrapping and post-write clearing are appropriate.
- The no-wire-shape-change design traces through the real export and restore mechanisms: the snapshot has an explicit SQL projection (`src/db/app-settings-dao.ts:381-457`), export unconditionally spreads it into `appSettings` (`src/backup/export-manifest.ts:61-74`), and restore already filters manifest fields into `updateAppSettingsCore` (`src/backup/restore-apply.ts:261-273`). Allowlisting without emitting is therefore the correct sequencing.
- The compare-before-write guard is necessary: empty patches still update `modified_at` and the public wrapper also bumps `data_revision` (`src/db/app-settings-dao.ts:598-617`).
- Folding hydration into the existing ready gate is compatible with the current mount boundary: the navigator does not mount until `ready` (`App.tsx:144-161`, `App.tsx:292-312`).

### Concerns

- **[MEDIUM] The Plan 01 DAO validation contract depends on canonical accent/background ID sets that are not produced until Plans 03 and 06, both downstream of Plan 01.** `updateAppSettingsCore` validates synchronously before SQL (`src/db/app-settings-dao.ts:555-596`, `src/db/app-settings-dao.ts:653-691`), while the current theme data has only the palette preset (`src/theme/theme-presets.ts:18-98`) and there is no background manifest/assets yet. Thus `assertAccentId` / `assertBackgroundId` cannot both reject unknown IDs and use the later single sources without a forward import, duplicated lists, or a wave violation.

### Suggestions

- Add a Plan-01-owned pure `theme-option-ids` contract (or move the DAO validator additions into a dependent plan) and make `accents.ts` / `backgrounds.ts` consume that one source. Test that the DAO and each resolver accept exactly the same IDs.

### Risk Assessment

**MEDIUM.** The persistence and backup approach is sound, but the validator/data ownership seam must be fixed before the migration is implemented.

## Plan 02 — Fonts, layout tokens, and AppText

### Summary

The plan is appropriately scoped to reusable primitives and correctly distinguishes the RN font pipeline from the existing Skia pipeline.

### Strengths

- It preserves the established asset convention: the Orrery currently loads `assets/Inter-SemiBold.ttf` through Skia's separate `useFonts` path (`src/screens/OrreryScreen.tsx:173-177`), so keeping new `expo-font` loading out of that map is correct.
- It explicitly makes font failure non-fatal while using the same pre-navigation boot gate (`App.tsx:144-161`, `App.tsx:292-312`).
- The plan correctly accounts for the repository-level postinstall: `package.json:54-70` declares `patch-package`, so it does not make the false claim that an install has no postinstall activity.

### Concerns

- None found.

### Suggestions

- Keep the font-loader test fully node-isolated by mocking the Expo font module; the repository's current tests already use module mocking for native dependencies (`src/db/migrations/full-chain.test.ts:1-6`).

### Risk Assessment

**LOW.** Native dependency/build validation and large-font device UAT remain necessary, but the plan has a safe fallback and bounded scope.

## Plan 03 — Four palettes, accents, and AA gate

### Summary

The per-mode accent triple and split protected-token gate are materially stronger than a single accent hex. However, the protected legacy palette already contains a measurable AA miss for a planned real compositing pair, so this plan has an intentional but real owner-blocking outcome.

### Strengths

- The plan builds on the actual resolver boundary: `system` already resolves live at the provider through `useColorScheme()` and `resolveMode` (`src/theme/theme-provider.tsx:28-39`), while the pure resolver defaults any non-light system value to dark (`src/theme/theme-presets.ts:103-137`).
- It preserves the separate owner/star setting: the DAO stores `selfSunColour` independently and deliberately leaves NULL resolution to rendering (`src/db/app-settings-dao.ts:65-73`, `src/db/app-settings-dao.ts:346-350`).
- The planned hard-fail / owner-escalation split avoids silently changing approved Galaxy-dark hues, whose provenance is recorded in the live type contract (`src/theme/theme-types.ts:38-46`, `src/theme/theme-types.ts:77-108`).

### Concerns

- **[MEDIUM] The legacy Galaxy-dark danger token already fails the plan's stated `danger`-against-`surfaceElevated` opaque-pair check: `#E5484D` over `#1D2235` is approximately 4.03:1.** Those literal values are current production data (`src/theme/theme-presets.ts:23-31`). The plan rightly says not to retune it autonomously, but a failing test that merely records an owner request leaves this autonomous plan unable to reach green without an explicit blocking owner checkpoint.
- **[MEDIUM] The destructive foreground contract is underspecified.** Current `ThemePalette` has `accent` and `danger`, but no `onDanger` foreground token (`src/theme/theme-types.ts:29-46`); the plan adds `onAccent`, whose values are selected for configurable accent fills, not necessarily danger fills. Plan 07 needs legible destructive label/glyph foregrounds, and its AA test cannot verify “danger-as-fill versus its foreground” until that foreground is a named token/contract.

### Suggestions

- Turn the known Galaxy-dark danger result into an explicit blocking owner checkpoint before executing the gate; record the exact pair and ratio rather than leaving a generic “halt” path.
- Add an `onDanger` token (or explicitly define and test the permitted shared foreground) in the resolved palette, then require Plan 07 to consume it.

### Risk Assessment

**HIGH.** Four-palette accessibility cannot be declared complete until the existing protected danger pair receives an owner decision and the destructive foreground is specified.

## Plan 04 — Reduced-motion bridge and motion tokens

### Summary

This is a sound, narrowly scoped solution to the highest-risk animation seam.

### Strengths

- The proposed event source is supported by the installed React Native types: `isReduceMotionEnabled()` exists and `reduceMotionChanged` is a boolean event (`node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.d.ts:13-28`, `node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.d.ts:68-71`).
- Rejecting Reanimated's `useReducedMotion` is correct because its own declaration says it captures the startup value and does not rerender on changes (`node_modules/react-native-reanimated/lib/typescript/hook/useReducedMotion.d.ts:1-9`).
- The proposed shared-value path matches the current Skia architecture: the canvas uses a clock inside `useDerivedValue` (`src/components/orrery/OrreryCanvas.tsx:93-101`), and the clock context is already a `SharedValue` (`src/components/orrery/orrery-clock-context.ts:17-27`).

### Concerns

- None found.

### Suggestions

- Add an explicit test for a rejected `isReduceMotionEnabled()` promise, treating it as the documented static-default state, in addition to the planned post-dispose-resolve test.

### Risk Assessment

**LOW.** The controller signature, cleanup, and worklet-safe bridge are sufficiently explicit; only device validation of the OS event remains.

## Plan 05 — Semantic icons and status glyphs

### Summary

The plan correctly consolidates the highest-visibility tab glyph fork and uses the right source module for the status mapping. Its `Icon` API needs a type-safe definition of which theme tokens may be used as colors.

### Strengths

- It correctly maps real navigation keys: the tab routes are `DashboardTab`, `OrreryTab`, `BackupTab`, and `SettingsTab` (`src/navigation/types.ts:186-192`), and the current raw `TAB_GLYPHS` map uses those same keys (`src/navigation/RootNavigator.tsx:42-47`, `src/navigation/RootNavigator.tsx:159-169`).
- It correctly separates computed status from snooze: `ProfileStatus` is only stable/wobble/decay/rogue (`src/db/contact-status-read.ts:19-20`), while the snoozed dashboard population is independently selected from `contacts.snooze_until` (`src/db/dashboard-read.ts:241-249`).
- Extending `ringVisual` keeps the existing hue and border-weight source in one place (`src/components/contact-card-ring.ts:44-60`).

### Concerns

- **[MEDIUM] The planned `Icon` prop `tone` needs a string-token-only type, not an unconstrained `keyof ThemePalette`.** `ThemePalette` includes array-valued members such as `avatarSwatches`, `gravityTiers`, and `starPalette` (`src/theme/theme-types.ts:48-65`, `src/theme/theme-types.ts:110-132`). Indexing `colors[tone]` with all keys produces `string | readonly string[]`, which cannot safely feed Ionicons' `color` prop and permits semantically invalid callers.

### Suggestions

- Export a `ColorToken`/`IconTone` union of string-valued color roles (or a semantic icon-tone union) and type `Icon` against it. Keep `StatusGlyph` narrower still: only its neutral/status roles.

### Risk Assessment

**MEDIUM.** The architecture is correct, but the public primitive must not expose a type hole that either breaks compilation or permits array tokens as icon colors.

## Plan 06 — Backgrounds, surfaces, and Orrery consumption

### Summary

The plan closes the previously missed SunBody consumer and provides thoughtful fallback/AA contracts. Two implementation details still prevent its tests from proving what they claim: actual-image bounds and reduced-motion value propagation to the child Skia tree.

### Strengths

- It correctly identifies all current ambient clock consumers: the canvas twinkles from its clock (`src/components/orrery/OrreryCanvas.tsx:93-101`) and `SunBody` independently pulses radius and opacity from the shared clock (`src/components/orrery/SunBody.tsx:82-100`).
- The plan preserves the intentional single-clock/unmount behavior: the context documentation says the canvas is the only `useClock` owner and that unmounting it stops the frame callback (`src/components/orrery/orrery-clock-context.ts:1-15`).
- The local-only asset direction is consistent with the existing repository policy: the current color gate explicitly scans source and exempts only paths under `/theme/` (`scripts/check-colors.sh:31-39`), so the plan's additional token-only selector test is a useful defense beyond that location-based check.

### Concerns

- **[MEDIUM] A manually declared “brightest representative pixel” does not verify the committed image bytes, so the proposed per-asset AA test can pass while an asset contains a brighter rendered pixel.** No current background assets exist, and the proposed test compares only the declaration rather than decoding the image; the repository's present color gate scans only TypeScript/TSX text (`scripts/check-colors.sh:31-39`). This is not a proof of the runtime composite required by THEME-11.
- **[MEDIUM] The plan does not choose a viable, file-owned propagation mechanism for the reduced-motion SharedValue from `OrreryCanvas` to `SunBody`.** `SunBody` is instantiated by `OrreryScreen` before being passed as `OrreryCanvas` children (`src/screens/OrreryScreen.tsx:685-700`), while the existing context carries only the clock (`src/components/orrery/orrery-clock-context.ts:20-27`). The listed modified files omit that context. A prop cannot originate in the child canvas and reach already-constructed children; a context expansion must modify the context module, or `SunBody` must create its own hook/controller explicitly.

### Suggestions

- Make the assets testable against the actual bundled bytes: add a build/test-time decoder or generated, committed pixel-bound metadata derived from the exact asset hash, and fail when the asset changes without regenerating the bound.
- Pick one reduced-motion design before execution: extend `orrery-clock-context.ts` to carry `{ clock, reducedMotion }` and list it in `files_modified`, or have `SunBody` call `useReducedMotionShared()` itself and explicitly accept the additional subscription.

### Risk Assessment

**HIGH.** The functional intent is good, but the AA claim and live SunBody gating need concrete mechanisms before they can be trusted.

## Plan 07 — Button hierarchy and overlays

### Summary

The plan has the right role set and an explicit Android dismissal policy. It depends on the unresolved destructive foreground contract from Plan 03.

### Strengths

- The five role/variant requirements align with the UI contract, including the 44px icon-only target and non-color destructive cue (`.planning/phases/23-theme-visual-system/23-UI-SPEC.md:256-264`).
- It acknowledges the actual platform seam: existing React Native overlays already use `onRequestClose` (for example, `src/components/ResumeReconcilePrompt.tsx:37-49`), so standardizing that API rather than treating Android Back as implicit is appropriate.
- It correctly relies on Plan 05 for tab/icon semantics instead of retaining the current raw-glyph tab implementation (`src/navigation/RootNavigator.tsx:159-169`).

### Concerns

- **[MEDIUM] The Destructive Button cannot guarantee readable label and warning-glyph contrast because the plan specifies only a `danger` fill, not its foreground token.** The underlying current palette has no `onDanger` member (`src/theme/theme-types.ts:29-46`), while the UI contract requires a destructive `danger` fill/border with warning glyph and confirmation (`.planning/phases/23-theme-visual-system/23-UI-SPEC.md:260-264`). This is the downstream manifestation of Plan 03's missing foreground contract.

### Suggestions

- Depend on Plan 03 exporting `onDanger` (or a clearly named validated alternative), make `Button` use it for both destructive label and warning glyph, and test that pair at AA before testing the role mapping.

### Risk Assessment

**MEDIUM.** Overlay behavior is well specified; destructive visual accessibility needs the upstream token contract.

## Overall actionable findings

### HIGH

- **Plan 03:** Protected Galaxy-dark `danger` already measures about 4.03:1 on `surfaceElevated`; require an owner checkpoint before declaring the AA gate green. Evidence: `src/theme/theme-presets.ts:23-31`.
- **Plan 06:** The current image-bound AA test proposal is declarative rather than byte-derived, and its SunBody reduced-motion propagation mechanism is not owned by the listed files. Evidence: `scripts/check-colors.sh:31-39`; `src/screens/OrreryScreen.tsx:685-700`; `src/components/orrery/orrery-clock-context.ts:20-27`.

### MEDIUM

- **Plan 01:** Establish one pre-Plan-01 canonical source for valid accent/background IDs, or move their DAO validators after the manifests exist. Evidence: `src/db/app-settings-dao.ts:555-596`.
- **Plans 03 and 07:** Add and validate an `onDanger` (or explicitly equivalent) foreground token. Evidence: `src/theme/theme-types.ts:29-46`; `.planning/phases/23-theme-visual-system/23-UI-SPEC.md:260-264`.
- **Plan 05:** Restrict `Icon.tone` to string-valued color tokens. Evidence: `src/theme/theme-types.ts:48-65`, `src/theme/theme-types.ts:110-132`.

### LOW

- **Plan 04:** Include rejected initial accessibility-query behavior in the controller test. Evidence: `node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.d.ts:68-71`.

No plan reverses or weakens a `[DECIDED]`/`[REJECTED]` decision, so no owner-escalation finding of that category is present.

---

## Claude Review

*(read-only Claude Code subagent — all 7 PLAN.md read in full, every load-bearing file:line
claim verified against source; prior-cycle-resolved items re-checked on disk.)*

**Reviewer:** Independent cross-AI plan reviewer (read-only)
**Method:** All 7 PLAN.md files read in full, then every load-bearing file:line claim verified against the actual source in `/home/bwales/projects/orbit-app`. Prior-cycle-resolved items were re-checked on disk and are NOT re-litigated unless a genuine new defect remains.

### Verification summary (what was confirmed on disk)

| Claim | Evidence | Verdict |
|---|---|---|
| Migration 015 = head+1 | `src/db/database.ts:49` `TARGET_VERSION = 14`; latest file is `014-interaction-assists.ts`; MIGRATIONS ends at `migration014` (:66) | correct |
| No backup format bump | `src/backup/types.ts:14` `BACKUP_FORMAT_VERSION = 3` | preserved |
| Unconditional `...portable` spread | `src/backup/export-manifest.ts:63,74` | exact |
| `phoneRegionOverride` is REQUIRED + EMITTED (not a deferred-emission precedent) | dao `:154` (required), SELECT `:419`, return `:444`; stale comment `:153` | plan correctly warns against copying its current shape |
| `updateAppSettings` always bumps `modified_at` AND `data_revision` even for empty patch | dao `:606-618` (`:687` + unconditional `bumpDataRevisionCore` at `:616`) | compare-before-write genuinely required |
| `restore-apply` writes allowlisted patch keys | `src/backup/restore-apply.ts:272` → `updateAppSettingsCore` | emit-later path is real |
| `assertPortableSettings` rejects non-allowlisted keys | `backup-schema.ts:129-135`; `PORTABLE_SETTINGS_KEYS` `:106` lacks 7 theme keys today | allowlist-now required |
| theme-store persists a zustand envelope | `src/stores/theme-store.ts:26-40` (`name:"orbit-theme"`, `version:1`, `partialize→{mode,presetId}`) | envelope unwrap justified |
| `resolveMode` maps any non-`"light"` scheme → `"dark"` | `theme-presets.ts:114-123` | confirmed |
| light palette fallback currently load-bearing | `theme-presets.ts:136-137` `?? preset.dark` | confirmed |
| owner-approved galaxy-dark token provenance | danger ~37-46 (2026-08-14), rogue 67-75 (2026-08-15), statusStable/Wobble/Decay 77-108 (2026-08-16), textPrimary/textSecondary 34-35 (undated) | citations accurate |
| provider exposes single `palette.accent`, reads store | `theme-provider.tsx:29-30,36` | confirmed |
| TAB_GLYPHS + real route keys | `RootNavigator.tsx:42-47,167`; `types.ts:187-191` (`*Tab`-suffixed) | mapping correct |
| `ProfileStatus` has no `snoozed` | `contact-status-read.ts:20` | confirmed |
| SunBody is a second clock consumer | `OrreryCanvas.tsx:94` (sole `useClock`), `SunBody.tsx:86-98`; only these two consumers exist | HIGH is real and complete |
| check-colors exempts only `/theme/`, scans migrations | `scripts/check-colors.sh:47` `grep -vE '^[^:]*/theme/'` | confirmed |
| only theme-store touches `orbit-theme` key | grep across `src/` + `App.tsx` | safe to clear |

No decision reversals were found in any plan. Every project guardrail (no backup-format bump, AA thresholds intact, owner-approved hues protected, no AsyncStorage for new prefs, no Skia-from-React-state, single icon source, ADR-048/HANDOFF §7 supersession respected) is honored. **Zero HIGH concerns.**

### Plan 23-01 (TRACER — migration 015 + DAO/backup/provider/boot spine)

**Summary.** The riskiest plan in the phase and the most carefully written. Front-loads the entire irreversible schema, the `app_settings` writer contract, the backup allowlist, the theme-layer re-key onto a package axis, the legacy `orbit-theme` import, and the restore-before-paint boot gate into one gated tracer. Every irreversibility, forward-safety, and idempotency claim checks out against real code.

**Strengths.** Head+1 verified against disk (D-03 discipline). Emit-later firewall grounded in the real spread (`export-manifest.ts:63,74`) and reject (`backup-schema.ts:132-133`); correctly identifies `phoneRegionOverride` is no longer a deferred-emission example and instructs copying its *former* optional shape. compare-before-write provably necessary (`:606-618`). Envelope unwrap verified against `theme-store.ts:26-40`; the mandated real-envelope fixture closes a genuine false-green. Only `theme-store.ts` reads `orbit-theme`, so read-once-then-clear is safe.

**Concerns.**
- **LOW** — wrong-theme-flash is a default-palette splash, not a saved-palette first paint. `App.tsx:80` keeps `AppShell` inside `ThemeProvider`; the pre-`ready` splash (`:292`) renders before hydration. A Standard-Light device shows a Galaxy-dark splash, then the first *content* frame carries the saved palette. The plan deems a neutral/default splash acceptable and only forbids a wrong *saved* palette flash — a defensible reading of D-10/THEME-03, covered by device UAT, but satisfied by definition rather than mechanism.
- **LOW** — theme-store rework blast radius not fully enumerated. `dashboard-prefs-store.ts` / `ai-model-prefs-store.ts` matched a `theme-store`/`useThemeStore` grep and are not in `read_first`/`files_modified`; almost certainly persist-idiom references, but confirm neither imports a removed selector.
- **LOW** — estimate/scope mismatch: `tasks: 2`, `confidence: low`, yet 16 files incl. an irreversible migration + full DAO contract + backup + theme re-key + boot gate. Gated Task-1 checkpoint mitigates; still the phase's single biggest schedule risk (mid-execution context exhaustion).

**Suggestions.** Add a `read_first` grep of `dashboard-prefs-store.ts`/`ai-model-prefs-store.ts` for `useThemeStore` usage. Device-UAT cold-start with a **Standard-Light** saved value specifically.

**Risk: MEDIUM.** Irreversible schema + broadest shared-file surface; risk inherent to being the tracer and mitigated as well as practical. No correctness defect found.

### Plan 23-02 (fonts, deps, typography/spacing/radii tokens, AppText)

**Summary.** Installs three first-party Expo deps, bundles two OFL fonts locally, defines pure token modules, ships an `AppText` reflow primitive with a non-fatal font-load gate. All claims verified; low complexity.

**Strengths.** Non-fatal `loadAppFonts()` resolve-on-failure (node-asserted) prevents a font error reaching `AppShell`'s boot catch (`App.tsx:155`). Correctly separates the RN `<Text>` font pipeline from the Skia `useFonts` pipeline (`OrreryScreen.tsx:175-176`) and does not touch the Skia map. Honest about the `patch-package` postinstall (`package.json:69`).

**Concerns.** LOW — THEME-07 delivered at the primitive level only; no screen migrated to `AppText` (adoption deferred to Phase 15). Documented boundary, not a gap.

**Risk: LOW.** Additive, well-scoped, no file overlap with sibling wave-2 plans 03/04.

### Plan 23-03 (four palettes, per-mode accent tones, split AA gate)

**Summary.** Authors the three new palettes, makes `ThemePreset.light` required (retiring the dark fallback), builds the curated per-mode `{fill,onAccent,text}` accent system, runs the split AA gate (hard-fail for new tokens/accents, flag-for-owner for legacy galaxy-dark hues). Owner-bucket firewall correctly constructed; citations exact.

**Strengths.** Per-mode tone triple genuinely necessary (`theme-provider.tsx:36` resolves one `palette.accent` string; one hex cannot be AA-4.5:1 as link-text on both a deep-space dark bg and a near-white light surface). Flag-for-owner partition precise with verified provenance, incl. the correctly-identified UNDATED textPrimary/textSecondary (34-35) still treated as owner-bucket. Never weakens `AA_NORMAL`/`AA_LARGE`.

**Concerns.**
- LOW — the AA gate proves opaque pairs only; glass is explicitly handed to Plan 06 (declared dependency, sequencing note not a defect).
- LOW — a legacy galaxy-dark AA miss halts the plan (intended firewall behavior); flagging so the owner is aware the batched-decision surface could include a galaxy-dark retune request.

**Suggestions.** When the flag-for-owner path fires, record the *proposed* AA-passing hue alongside the measured ratio so the owner's decision is yes/no — but keep the retune owner-approved.

**Risk: LOW-MEDIUM.** Pure data + pure functions, no schema/boot surface. Only real-world risk is a legacy-token AA miss forcing an owner escalation mid-phase (by design).

### Plan 23-04 (reduced-motion hook + motion tokens)

**Summary.** Delivers the highest-*architectural*-risk item — a live OS reduced-motion signal as a Reanimated SharedValue readable from the Skia loop — via an `AccessibilityInfo` subscription bridge, a node-testable plain controller, two thin hook wrappers, and motion tokens.

**Strengths.** Correctly rejects Reanimated's boot-time-only `useReducedMotion()` and mandates the `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` bridge (satisfies the live D-07 requirement the obvious API silently fails). Extracted `createReducedMotionController(accessibilityInfo, emit)` with a pinned signature is node-testable without a renderer — genuinely good design driven by a real tooling constraint. `ambient` token specified as a per-second speed constant (the shape Plan 06's Orrery worklet multiplies) — closes a real Plan-04↔06 unit-mismatch seam.

**Concerns.** LOW — each hook instantiates its own controller (one listener per mounted hook); `AccessibilityInfo` listeners are cheap, acceptable. LOW — hook wiring itself only device-verified, not node-verified (inherent to no-renderer; the plan is honest).

**Risk: LOW.** The architectural risk is real but resolved correctly; its two files overlap nothing else in wave 2. Cleanest plan in the phase.

### Plan 23-05 (icon registry + status glyphs; retire TAB_GLYPHS)

**Summary.** Builds the centralized semantic icon registry with state variants, retires the ad-hoc `TAB_GLYPHS` fork through the registry, extends `ringVisual`'s module with a `statusGlyph` over a new `StatusDisplayState` union. All route-key and status-union claims verified.

**Strengths.** semantic→route-key mapping verified exact (`RootNavigator.tsx:42-47,167`; `types.ts:187-191`); the test asserting every `TabParamList` key resolves prevents a tab losing its icon on fork retirement. `StatusDisplayState = ProfileStatus | 'snoozed' | null` correctly motivated (`contact-status-read.ts:20` shows `ProfileStatus` has no `snoozed`); keeps `ringVisual`'s `ProfileStatus | null` signature unchanged (extend-not-fork, D-05). Reserves the `warning` glyph Plan 07 needs + six status-glyph names, tested.

**Concerns.** LOW — StatusGlyph adoption deferred to Phase 15 (primitive + single source ship; ContactCard/Profile/Orrery not wired). LOW — in-form raw `✕` conversions left to consuming phases (explicit scope call; the highest-visibility fork TAB_GLYPHS is retired in-phase).

**Suggestions.** Optionally add a grep-based guard asserting no *screen* imports an `@expo/vector-icons` name directly, to make "semantic names only" enforceable as adoption proceeds.

**Risk: LOW.** Extends verified single sources; the one behavioral change (tab bar through the registry) is covered by a route-key resolution test.

### Plan 23-06 (backgrounds, surface/glass, Orrery reduced-motion gating)

**Summary.** The most content-heavy plan: background slot manifest + 8 bundled assets, per-package surface tokens with a two-guard live-glass AA proof, `BackgroundHost`/`GlassSurface` with graceful fallbacks, and — critically — gating **both** Orrery clock consumers on the reduced-motion SharedValue. The SunBody HIGH from prior cycles is verified as a real bug the plan now fixes.

**Strengths.** SunBody gating is a genuine, disk-verified correctness fix; confirmed `OrreryCanvas.tsx:94` and `SunBody.tsx:86-98` are the ONLY two clock consumers, so "audit every consumer" is complete. Two-guard live-glass AA model is sound (opacity-ordering alone can't prove per-asset AA; the composited worst-case-pixel check is correctly the primary proof). `resolveRenderableBackground(package, slotId, renderFailed)` pure reducer makes the onError→None/Solid fallback node-testable without a renderer, and correctly distinguishes a runtime render failure (recoverable) from a bundle-missing `require()` (Metro-resolution, not recoverable). `resolveSurfaceStyle` token-only selector + node test closes the real `check:colors` /theme/-location escape hatch.

**Concerns.**
- **LOW–MEDIUM** — the declared "worst-case brightest pixel" is a manual design constraint not enforced against the committed asset. The composited AA test proves AA only if each shipped `.webp`'s brightest region does not exceed the declared value; nothing decodes the image, so a too-bright asset could drop text below AA on-device while tests stay green. THEME-11 is a hard a11y requirement — executor should visually spot-check text-over-glass on the brightest region of each asset on-device, not rely on the green test.
- **LOW** — 8 new bundled assets carry provenance/licensing burden; the plan mandates a README row per asset but cannot mandate its truthfulness. Owner spot-check that shipped background provenance is genuine and redistributable (product is distribution-bound).
- **LOW** — BackgroundHost/GlassSurface adoption (app-shell mounting across text-heavy screens) deferred to Phase 15/37; in-phase the only real consumers wired are OrreryCanvas + SunBody. Documented boundary.

**Suggestions.** Add a device-UAT step: for each Galaxy background, place body + caption text over glass on the brightest region and confirm legibility. Consider (optional, possibly Phase 15) a build-time asset-luminance check that decodes each `.webp` and asserts brightest region ≤ the declared pixel.

**Risk: MEDIUM.** Correctly fixes a real reduced-motion bug and has a rigorous AA model, but the accessibility guarantee ultimately rests on an un-enforced asset constraint + device UAT; highest-surface-area wave-3 plan.

### Plan 23-07 (Button hierarchy + Modal/Sheet/ConfirmDialog)

**Summary.** Ships the five-role Button hierarchy with destructive-beyond-colour, and the shared overlay variants with an explicit Android Back / scrim dismissal contract. Depends correctly on Plans 02/03/05.

**Strengths.** Destructive-beyond-colour is real (danger token + `warning` registry glyph reserved+tested in Plan 05 + explicit ConfirmDialog naming the action). Android overlay lifecycle contract (`visible` + `onRequestClose` wired to system Back; ConfirmDialog refuses scrim-tap/Back for destructive) addresses a real Android trap. Button colour roles map to the per-mode accent tones from Plan 03, not a raw hex.

**Concerns.** LOW — "exactly one Primary per surface" is convention, not enforced (expressed via the role prop). LOW — THEME-10 delivered at the primitive level; existing destructive flows/modals migrated in Phase 15.

**Suggestions.** The Button test should assert the Destructive role cannot be constructed without both the `warning` glyph and a confirmation affordance, so "distinct beyond colour" is structural rather than convention.

**Risk: LOW.** Presentational primitives, dependencies all declared and verified; the Android lifecycle contract is the main substance and is well-specified.

### OVERALL (Claude)

**HIGH concerns: None.** No decision reversal, no weakening of a `[DECIDED]`/`[REJECTED]` item, no ADR/HANDOFF inversion in any of the 7 plans. All prior-cycle HIGH resolutions are correctly and verifiably reflected in the code and plans on disk.

**Actionable MEDIUM/LOW:** (1) [23-06] brightest-pixel AA not enforced against the committed asset — add per-asset device-UAT + optional build-time luminance gate; (2) [23-06] background asset provenance/licensing integrity — owner spot-check; (3) [23-01] restore-before-paint is a default splash then saved-palette content frame — confirm on-device with Standard-Light; (4) [23-01] confirm theme-store rework blast radius (grep dashboard-prefs-store/ai-model-prefs-store); (5) [23-03] record the proposed AA-passing hue + ratio when flag-for-owner fires; (6) THEME-04/05/07/08/09/10 delivered at primitive level only, screen adoption is Phase 15 — score as "primitive delivered," not "in-app satisfied."

**Cross-plan integrity.** Dependency graph coherent: Wave 1 (01) front-loads all shared-file/irreversible edits; wave-2 plans 02/03/04 share NO files (parallel-safe); 05 dep 01/02; 06 dep 01/02/03/04; 07 dep 02/03/05 — all declared+satisfied. No intermediate CI-red state (at end of wave 1 `ThemePreset.light` is optional with the dark fallback intact, so tsc/tests are green before Plan 03 makes light required; Standard's placeholder palette is never user-reachable this phase). `widget-colors.ts` (ADR-042 headless consumer) survives the re-key (`resolvePalette(DEFAULT_PRESET_ID,"dark")` stays valid once `DEFAULT_PRESET_ID` → `'galaxy'`).

**Overall phase risk: MEDIUM**, concentrated in Plan 01 (irreversible schema, broadest surface) and Plan 06 (asset-dependent accessibility + the reduced-motion fix). Both risks inherent, well-understood, mitigated. Ready to execute subject to the LOW/MEDIUM device-verification items above.
