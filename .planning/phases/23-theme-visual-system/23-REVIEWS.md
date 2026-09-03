---
phase: 23
reviewers: [codex, claude]
reviewed_at: 2026-09-03T10:53:05Z
convergence_cycle: 5
convergence_cycle_note: FINAL cycle — plans revised to incorporate cycle-4 feedback.
plans_reviewed: [23-01-PLAN.md, 23-02-PLAN.md, 23-03-PLAN.md, 23-04-PLAN.md, 23-05-PLAN.md, 23-06-PLAN.md, 23-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "unknown"
model_sources:
  codex: "banner"
  claude: "unknown"
# NOTE: the claude lane ran as a read-only Claude Code subagent (the `claude -p` review
# lane has a Write-permission gap on this host — see MEMORY "Claude reviewer via subagent").
# Both lanes reviewed the CODE ON DISK, not just plan text: every load-bearing file:line
# claim was opened and verified, and both traced the app_settings write/read/export/restore
# path and the persisted Zustand stores per the project's "review the code, not the diff" rule.
# The orchestrator independently re-verified on disk: BACKUP_FORMAT_VERSION=3 (not bumped),
# theme keys absent from PORTABLE_SETTINGS_KEYS (allowlist-now correct), TARGET_VERSION=14
# (migration 015 = head+1), phoneRegionOverride required+emitted, and that all five cycle-4
# actionable resolutions (single-source theme-option-ids, onDanger token, IconTone string-only
# union, brightest-pixel device-UAT, SunBody direct useReducedMotionShared) are present in the
# cycle-5 plans.
---

# Cross-AI Plan Review — Phase 23 (Theme & Visual System) — Convergence Cycle 5 (FINAL)

Two independent reviewers (Codex `gpt-5.6-terra`, and a read-only Claude subagent) reviewed all
7 plans against the actual source. This is cycle 5 — the final convergence cycle; plans have been
revised across 4 prior cycles (unresolved concerns went 14 → 9 → 5 → 4). Every prior-cycle
resolution was re-verified on disk this cycle and confirmed intact:

- Backup **allowlist-now / emit-later** with no `BACKUP_FORMAT_VERSION` bump (`types.ts:14` still
  `3`); format-4 emission deferred to Phase 36. `phoneRegionOverride` correctly identified as
  required+emitted (not the deferred-emission precedent to copy).
- **Single-source `theme-option-ids`** (`ACCENT_IDS` / `BACKGROUND_SLOT_IDS` authored once in
  Plan 01; Plans 03/06 import, never re-declare; drift tests both directions).
- Named **`onDanger`** destructive foreground token added to `ThemePalette` in Plan 03 and
  consumed by Plan 07's Destructive Button; danger+onDanger AA pair tested.
- **`IconTone`** string-only union (excludes the three `readonly string[]` palette members) with a
  `@ts-expect-error` type-level assertion.
- **Composited-glass AA + brightest-pixel device-UAT** (the per-asset device check is the plan's
  own stated sole enforcement against the shipped `.webp` bytes).
- **SunBody** gates reduced motion via a direct `useReducedMotionShared()` call inside its worklet
  (keeps the fix inside `files_modified`).
- Tab route-key mapping (`DashboardTab`/`OrreryTab`/`BackupTab`/`SettingsTab`).
- AA 4.5:1 threshold never weakened; owner-approved galaxy-dark hues never auto-retuned
  (flag-for-owner firewall).

**Neither reviewer found a decision reversal** — no plan deletes, weakens, or inverts a
`[DECIDED]` / `[REJECTED]` item in `HANDOFF.md` or an ADR. The galaxy-dark
`danger`(~4.03:1)/`onDanger`(~3.9:1) contrast is correctly routed to flag-for-owner (a by-design
owner taste decision surfacing at execution, already represented in Plan 03) — not a plan defect.

## Consensus Summary

Both reviewers independently confirm the plan set is exceptionally rigorous after four cycles, its
`file:line` citations are accurate, its owner-bucket firewalls are correctly placed, and every
data-layer and animation guardrail is honored on disk. **Zero HIGH concerns; no decision
reversal.**

The reviewers diverge on residual verification-seam findings. **Codex raised two MEDIUM concerns**,
both about the *executability* of tests/UATs the plans themselves require; **Claude raised none**
(rating the phase LOW risk and recommending execution). The orchestrator verified both Codex
findings on disk and judges them **actionable** — they name concrete, execution-relevant gaps in
the current plans (a required test/UAT with no allocated host), not polish and not prior items.

### Agreed Strengths

- **Migration 015 = head+1, verified not assumed** — `src/db/database.ts:49` `TARGET_VERSION = 14`;
  latest file `014-interaction-assists.ts`. (Both.)
- **Backup forward-safety grounded in the real mechanism** — unconditional `...portable` spread
  (`export-manifest.ts:63,74`), the key allowlist (`backup-schema.ts:106`), no format bump
  (`types.ts:14` = `3`). Allowlist-now / emit-later is the only wire-safe sequencing. (Both.)
- **Compare-before-write idempotency is provably required** — `updateAppSettings` bumps
  `modified_at` AND `data_revision` even on an empty patch (`app-settings-dao.ts:~598-618`), so a
  value-diff guard (not "patch non-empty") is materially necessary. (Both.)
- **Zustand-envelope unwrap justified** — `orbit-theme` persists `{"state":{mode,presetId},"version":1}`
  (`theme-store.ts`), so reading top-level fields would silently no-op on every real device. (Both.)
- **Both Orrery clock consumers audited** — `OrreryCanvas.tsx:93` twinkle/drift AND `SunBody.tsx:86-100`
  glow pulse are the only two consumers; gating both is necessary and the plan does so. (Both.)
- **Plan 04 reduced-motion bridge** correctly rejects Reanimated's boot-time-only `useReducedMotion`
  for the live `AccessibilityInfo` subscription, node-testable via `createReducedMotionController`.
  (Both.)
- **Plan 05** distinguishes snooze from computed status (`ProfileStatus` has no `snoozed`,
  `contact-status-read.ts:20`) and retires the `TAB_GLYPHS` fork through real route keys. (Both.)
- **Owner-approved galaxy-dark hues protected** — flag-for-owner partition scoped to all
  pre-existing galaxy-dark required tokens regardless of inline date. (Both.)

### Agreed Concerns

- None raised by both reviewers. (Codex's two MEDIUM verification-seam findings were not
  independently raised by Claude; see Divergent Views.)

### Divergent Views

- **[23-01, Codex MEDIUM — actionable] Boot-order guarantees have no allocated automated test
  seam.** The boot import logic is folded inline into `App.tsx`'s `openAndMigrate` ready gate
  (23-01 Task 2), and `files_modified` lists `App.tsx` but **no `App.test.tsx` and no extracted
  boot coordinator** — while the repo has no react-test-renderer. Yet the plan's acceptance
  criteria (23-01-PLAN.md:207; tests named at :176-177) explicitly require asserting a second
  import performs **zero writes** (`updateAppSettings` NOT called; `data_revision`/`modified_at`
  unchanged), that `getItem`/`JSON.parse`/`removeItem` failures are each non-fatal, and that the
  store never hydrates pre-import values. Those call-level/sequencing assertions cannot be written
  against inline `App.tsx` logic with no host. Claude did not raise this. On the merits it is a
  real gap: the plan discourages editing files outside `files_modified` (Plan 06 Task 3 does so
  explicitly), so a faithful executor has nowhere to put the required tests. **Plan change:** name
  an extracted `hydrateThemeAtBoot(deps)` coordinator (DB/store/AsyncStorage/logger injected) + its
  test file in 23-01 `files_modified`, OR restate the idempotency AC as a pure value-diff-function
  test in `orbit-theme-migration.test.ts` (assert empty diff → zero-length patch) rather than a
  "not called" assertion.
- **[23-06, Codex MEDIUM — actionable] The device-UAT has no in-scope mount point.** Plan 06
  creates `BackgroundHost.tsx` + `GlassSurface.tsx` (Task 2) but explicitly **defers mounting them**
  app-wide to Phase 15/37 and names no demo route, preview harness, or mounted consumer in
  `files_modified`. Yet its `<human-check>` device-UATs (23-06-PLAN.md:156,184) require rendering
  text over glass over each background on a Pixel — including the **per-asset brightest-region AA**
  check, which the plan itself declares (23-06-PLAN.md:49) is the *sole enforcement against the
  shipped `.webp` bytes* (the cycle-4 resolution). With nothing mounted, that resolution is not
  executable in-phase. Claude did not raise this (it treated "a primitive device render" as
  sufficient). On the merits, "a primitive device render" (line 55) is asserted but no surface is
  allocated. **Plan change:** add a named in-scope dev/preview harness to 23-06 `files_modified` — a
  minimal mounted consumer with a real scroll surface presenting body+caption text over
  `GlassSurface` over each background — so the fixed-behind-scroll, `onError`→None/Solid, blur
  fallback, and brightest-region AA human-checks are actually runnable.

## Actionable items for planning (this cycle)

1. **[23-01, MEDIUM]** Allocate a test host for the boot-order guarantees (extract
   `hydrateThemeAtBoot(deps)` + test file, or move the idempotency assertion to a pure diff-function
   test) so 23-01's stated boot idempotency/error-isolation acceptance criteria are actually
   automatable. (Codex.)
2. **[23-06, MEDIUM]** Add a named in-scope preview/harness mount for `BackgroundHost`/`GlassSurface`
   so the per-asset brightest-region device-UAT (the plan's sole check against shipped asset bytes)
   and the fixed-behind-scroll / onError / blur-fallback human-checks are executable in-phase.
   (Codex.)

### Non-counted notes (covered, by-design, or polish)

- **[Codex LOW, non-actionable]** The visual system is intentionally non-adopted in existing
  text-heavy screens (e.g. `UnboundContactsScreen.tsx:129`) — a documented scope boundary (screen
  adoption is Phase 15/37), not a plan flaw. Suggest tracking as a named Phase 37/40 hardening gate.
- **[Claude LOW, non-actionable]** Stale doc-comment in `widget-colors.ts:27-28` references the
  retired light→dark fallback; the code (`:32` passes `"dark"` explicitly) is unaffected. Refresh
  the comment only if `widget-colors.ts` is touched.
- **[Claude LOW, non-actionable]** Minor line-number drift in a few citations
  (`textPrimary/textSecondary` ~`:35-36` not `:34-35`; `<SunBody` JSX ~`:705` not `:685-700`);
  symbols/behavior correct and executors grep by name.
- **[Claude LOW, non-actionable]** Plan 06 Task 3's "architecturally impossible" (for the prop
  route) is slightly overstated; the chosen direct-hook approach is nonetheless the right call.
  Phrasing only.
- The galaxy-dark `danger`/`onDanger` sub-AA pair is by-design flag-for-owner (owner taste
  decision surfacing at execution), already represented in Plan 03 — not a plan defect.

---

## Codex Review

*(gpt-5.6-terra, reasoning=low — reviewed all 7 plans against the checkout; traced the
app_settings write/read/export/restore path and the persisted Zustand stores.)*

## Summary

The plans are unusually mature and align with the repo's actual seams: migration head is 14, theme storage is currently AsyncStorage-backed, the backup exporter spreads the portable snapshot directly, and both Orrery clock consumers exist. I found no new HIGH-severity defect. Two MEDIUM execution gaps remain around testability and device verification.

## Strengths

- Plan 01 correctly targets migration 015: the actual head is `TARGET_VERSION = 14` in `src/db/database.ts:49`, and migrations are centrally registered immediately below it. The existing theme store really is Zustand persisted under `orbit-theme` with `{mode, presetId}` partialization, supporting the plan's envelope-import treatment. `src/stores/theme-store.ts:25`

- The backup-wire deferral is sound. `export-manifest.ts` unconditionally spreads the portable settings projection into `appSettings`, so withholding new keys from that projection is necessary to preserve format-3 shape. `src/backup/export-manifest.ts:63` The plan's allowlist-now/emit-later approach correctly matches the parser's key allowlist mechanism. `src/backup/backup-schema.ts:106`

- Plan 03 correctly replaces the current single-preset/fallback model. The current contract has only `"space-dark"` and optional light palettes. `src/theme/theme-types.ts:160` The plan's four-palette and required-light conversion directly removes the present dark fallback. `src/theme/theme-presets.ts:125`

- Plan 04's reduced-motion seam is correctly scoped to existing Skia animation sites. The canvas twinkle is driven from `useClock()` in a derived value. `src/components/orrery/OrreryCanvas.tsx:93` The sun pulse independently consumes the shared clock. `src/components/orrery/SunBody.tsx:86` Gating both is necessary and the plan does so.

- Plan 05 accurately distinguishes snooze from query-time relationship status: `ProfileStatus` only includes stable/wobble/decay/rogue. `src/db/contact-status-read.ts:20` The proposed display union is therefore the right boundary.

- Plan 05's route mapping is grounded in the actual navigation keys and correctly retires the existing Unicode tab-glyph fork. `src/navigation/RootNavigator.tsx:42` `src/navigation/types.ts:188`

- The deliberate engine-versus-settings-UI split is consistent with the planning appendix: Phase 23 owns the engine and persisted state; the Appearance UI is explicitly allocated to Phase 37. `docs/dossier/milestone-2/planning-notes/phase-02-planning-notes.md:78`

## Concerns

- **MEDIUM — Plan 01 does not allocate a concrete automated test seam for its most important boot-order guarantees.** The current boot logic is inline in `AppShell`'s effect and transitions directly from `openAndMigrate()` to `setReady(true)`. `App.tsx:147` The plan requires tests for import order, DB-write failure, failed AsyncStorage clear, no-op reimport, and store hydration after import, but its modified-file list has no `App.test.tsx` nor a new extracted boot coordinator. The pure mapper tests cannot prove those sequencing properties.

- **MEDIUM — Plan 06's manual validation is not executable from the stated implementation scope.** It explicitly defers mounting `BackgroundHost` and `GlassSurface` across the app, but no demo route, test screen, or existing consumer is listed. Consequently, claims such as fixed-behind-scroll behavior, actual image `onError` fallback, blur fallback, and per-asset live-glass readability cannot be device-tested without an unplanned mount point. This matters because the current app root contains `ThemeProvider` and `AppShell`, but no background/surface host. `App.tsx:369`

- **LOW — The visual system remains intentionally non-adopted in existing text-heavy screens.** This is a documented scope boundary rather than a plan flaw, but it means THEME-07's primitive-level validation will not change currently clamped text such as `UnboundContactsScreen`'s one-line content. `src/screens/UnboundContactsScreen.tsx:129` Track this explicitly as Phase 37/40 acceptance work.

## Suggestions

1. In Plan 01, extract a small boot function—e.g. `hydrateThemeAtBoot(deps)`—and unit-test it with injected DB, store, AsyncStorage, and logger dependencies. Have `AppShell` call it. This makes the listed idempotency/error-order acceptance criteria genuinely automatable.

2. In Plan 06, add one deliberate in-scope primitive preview harness or a narrowly scoped mounted consumer. It need not become app-wide adoption; it only needs a real scroll surface that mounts `BackgroundHost` and `GlassSurface`, enabling the listed Pixel UAT and image-error fallback checks.

3. Keep the deferred existing-screen text adoption as a named release-hardening gate, not merely a plan note.

## Risk Assessment

**Medium-low overall.** The data/backup/migration and Skia-motion design is well grounded in the current codebase. The remaining risk is verification: two core behaviors are specified strongly but lack a concrete executable harness in the current file/task allocation.

---

## Claude Review

*(read-only Claude Code subagent — all 7 PLAN.md read in full; every load-bearing file:line
claim verified against source on disk; prior-cycle-resolved items re-checked and not re-litigated.)*

## 1. Summary

I reviewed all seven Phase 23 plans and verified their load-bearing claims against the actual source on disk (migrations, `app-settings-dao.ts`, backup layer, `theme-types.ts`, `theme-provider.tsx`, `contact-status-read.ts`, `RootNavigator.tsx`, `contact-card-ring.ts`, `OrreryCanvas.tsx`, `SunBody.tsx`, `orrery-clock-context.ts`, `App.tsx`, `theme-store.ts`, `widget-colors.ts`, `check-colors.sh`, `package.json`). Every substantive on-disk assertion the plans make is accurate: migration 015 is genuinely head+1 (`TARGET_VERSION=14`, latest file `014`); `BACKUP_FORMAT_VERSION=3` and `export-manifest.ts:63/74` spreads `...portable` unconditionally; `phoneRegionOverride` is required-and-emitted (correctly identified as *not* the deferred-emission precedent to copy); `theme-store` persists the zustand envelope `{"state":{...},"version":1}`; `updateAppSettings` bumps `modified_at`+`data_revision` even on an empty patch (validating the compare-before-write mechanism); `ThemePalette` has `danger` but no `onDanger` and three `readonly string[]` members; `ProfileStatus` has no `snoozed`; `TAB_GLYPHS` is keyed by the `*Tab` route keys; and both Orrery clock consumers (`OrreryCanvas` twinkle/drift, `SunBody` glow pulse) exist and are currently ungated. After four prior cycles (14→9→5→4 findings), these plans are exceptionally rigorous, decision-aware, and internally consistent. I found no new actionable defect and no decision reversal.

## 2. Strengths

- **Migration 015 head+1 is verified, not assumed.** `src/db/database.ts:49` = `TARGET_VERSION = 14`, latest migration file is `014-interaction-assists.ts`; Plan 01's `015` is correct and the plan explicitly re-verifies rather than doing head+1 arithmetic.
- **The backup allowlist-now/emit-later firewall is correctly grounded.** `src/backup/types.ts:14` = `BACKUP_FORMAT_VERSION = 3`; `src/backup/export-manifest.ts:63,74` spreads `...portable` into `manifest.appSettings` unconditionally. Plan 01's resolution (allowlist + optional TYPE field, defer emission; a format-3 negative regression test) is the only wire-safe path and correctly escalates the format-4 bump to Phase 36.
- **The `phoneRegionOverride` precedent trap is caught.** `app-settings-dao.ts:154` (required) and `:350/:444` (emitted) confirm it is *no longer* a deferred-emission example; Plan 01 correctly directs copying the optional-field-no-SELECT shape instead.
- **Compare-before-write is justified by real code.** `updateAppSettings` docstring (`app-settings-dao.ts:~598-605`) states even an empty patch bumps `modified_at`, and the body bumps `data_revision` too — so Plan 01's insistence on a value-diff guard (not "patch non-empty") is materially necessary to avoid corrupting backup last-writer-wins.
- **The zustand-envelope unwrap is real.** `theme-store.ts` persists via `persist`+`createJSONStorage(AsyncStorage)`, `name:'orbit-theme'`, `partialize -> {mode,presetId}` — so the payload is the `{state,version}` envelope, exactly as Plan 01's migration mapper and fixture require.
- **Single-source id constants mirror an existing idiom.** `assertAiProvider` (`app-settings-dao.ts:26-30, 531-542`) validates via `.includes()` over an imported `AI_PROVIDER_IDS`; Plans 01/03/06 reuse this precisely for `ACCENT_IDS`/`BACKGROUND_SLOT_IDS`, with drift tests both directions.
- **The owner-hue firewall is scoped to the right tokens.** `theme-types.ts` confirms `danger` (`#E5484D`, owner-approved 2026-08-14), `rogue` (2026-08-15), `statusStable/Wobble/Decay` (2026-08-16), and undated `textPrimary/textSecondary` — Plan 03 correctly treats *all* pre-existing galaxy-dark required tokens as flag-for-owner regardless of inline date, and routes the galaxy-dark `danger`/`onDanger` pair to escalation by design.
- **The `IconTone` array-member hazard is verified.** `avatarSwatches`/`gravityTiers`/`starPalette` are genuinely `readonly string[]` in `ThemePalette`, so Plan 05's string-only `IconTone` union + `@ts-expect-error` assertion addresses a real `colors[tone] : string | readonly string[]` bug.
- **All Orrery clock consumers are audited, not just the obvious one.** `SunBody.tsx:86` calls `useOrreryClock()` and derives `pulseGlowRadius`/`pulseGlowOpacity` (`:87-100`) with no reduced-motion gate today; `orrery-clock-context.ts` carries only the clock. Plan 06's direct-hook gating of `SunBody` (avoiding a context/prop edit outside `files_modified`) is the correct, self-contained fix for what would otherwise be a sun that keeps pulsing under reduced motion.
- **No hidden Plan 03 scope gap from the new required `onDanger`.** The only other palette-shaped fixtures (`widget-colors.test.ts:19-24`, `ContactCard.test.tsx:20-25`) use `as unknown as ThemePalette` double-casts, so adding a required member does not break them — Plan 03's `files_modified` is complete.

## 3. Concerns

- **[LOW / non-actionable — polish] Stale doc-comment in `widget-colors.ts` after the dark-fallback retirement.** `src/services/widget/widget-colors.ts:27-28` comments "resolvePalette falls back to the dark palette for `light` today...". Plan 03 makes `ThemePreset.light` required and removes that fallback. The *code* stays correct (`widget-colors.ts:32` calls `resolvePalette(DEFAULT_PRESET_ID, "dark")` explicitly and never relied on the light→dark fallback), so behavior is unchanged; only the comment drifts. Not actionable.
- **[LOW / non-actionable] Minor line-number drift in a few citations.** `textPrimary/textSecondary` cited as `theme-types.ts:34-35` but sit at ~`:35-36`; `SunBody` instantiation cited as `OrreryScreen.tsx:685-700` but the `<SunBody` JSX is at ~`:705`. The referenced symbols and behavior are all correct and every plan directs the executor to grep by name, so these drifts are immaterial.
- **[LOW / non-actionable] "Architecturally impossible" is slightly overstated in Plan 06 Task 3.** Strictly, `OrreryScreen` *could* call `useReducedMotionShared()` and pass a prop. But the chosen direct-hook approach is idiomatic, keeps the change inside `SunBody.tsx` (already in `files_modified`), and avoids editing `orrery-clock-context.ts`/`OrreryScreen.tsx` — the right call. Phrasing only; no execution impact.

No HIGH or MEDIUM concerns. The previously-resolved items (backup allowlist/emit-later, AA 4.5:1 + owner-hue firewall, compare-before-write, zustand envelope, composited-glass AA + brightest-pixel device-UAT, `danger`+`onDanger` AA pairs, `IconTone` string-only union, single-source option-ids, `SunBody` direct gating, tab route-key mapping) are all correctly represented and verified against disk; none has regressed. The galaxy-dark `danger`(~4.03:1)/`onDanger`(~3.9:1) escalation is correctly by-design flag-for-owner, not a defect.

## 4. Suggestions

- If touching `widget-colors.ts` at all during Plan 01's re-key, refresh the `:27-28` comment so it no longer references a retired fallback. Optional, one line.
- In Plan 06 Task 3, soften "architecturally impossible" to "avoided by design (keeps the change within `SunBody.tsx` / `files_modified`)". Optional.
- Consider adding, as a single acceptance line in Plan 03, an explicit `npx tsc --noEmit` note that the new required `onDanger` is satisfied by the four authored palettes and that the only other palette fixtures are `as unknown as` casts. Optional documentation nicety.

## 5. Risk Assessment

**Overall: LOW.** The phase is well-sequenced (irreversible migration + shared-file spine front-loaded into the Plan 01 tracer; additive/parallel primitives after), and every guardrail that matters here is honored and verified on disk: local-first (fonts and backgrounds bundled, no network on any path), forward-only additive migration with seeded NOT-NULL/CHECK defaults, no silent format-3 wire-shape change, AA never weakened, owner-approved hues never auto-retuned, no colour literal outside `src/**/theme/**`, and Skia animation driven only through a SharedValue read via `useDerivedValue`, never React state. The one-way-door (migration 015) is gated behind an explicit human checkpoint. The residual risks are the inherent ones the plans already name and mitigate — the declared-vs-decoded brightest-pixel gap closed by a per-asset device-UAT, and the galaxy-dark destructive-contrast owner decision Plan 03 is expected to pause on. After four convergence cycles the plans are genuinely solid; I recommend proceeding to execution without further replanning.
