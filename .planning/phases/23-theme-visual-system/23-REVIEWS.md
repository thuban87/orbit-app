---
phase: 23
reviewers: [codex, claude]
reviewed_at: 2026-09-03T09:11:22Z
convergence_cycle: 2
plans_reviewed: [23-01-PLAN.md, 23-02-PLAN.md, 23-03-PLAN.md, 23-04-PLAN.md, 23-05-PLAN.md, 23-06-PLAN.md, 23-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "self-identified"
---

# Cross-AI Plan Review — Phase 23 (Theme & Visual System)

Convergence cycle 2. The seven plans were revised to incorporate cycle-1 review feedback; both cycle-1 HIGH findings ([23-01] backup wire-shape, [23-03] accent AA) were re-reviewed against the live codebase this cycle.

## Consensus Summary

Both reviewers (codex `gpt-5.6-terra`, claude `claude-opus-4-8`) ran source-grounded against the repository and agree the phase is well-architected: every irreversible/shared-file edit is front-loaded into Plan 01's gated tracer, and waves 2–4 fan out additive, non-overlapping work with a clean dependency graph. **Both reviewers independently verified the two cycle-1 HIGHs against the actual backup pipeline, DAO validators, restore path, palette types, and Orrery clock consumers, and both find them FULLY RESOLVED with no decision reversed.**

- **[23-01] backup wire-shape HIGH — FULLY RESOLVED (both).** Allowlist-now / emit-later is byte-safe: the 7 theme keys are added to `PORTABLE_SETTINGS_KEYS`, declared OPTIONAL in `PortableSettingsSnapshot`, and deliberately NOT emitted from `getPortableSettingsSnapshot`; `BACKUP_FORMAT_VERSION` stays 3 and no `FORWARD_MIGRATIONS` entry is added. Verified: `export-manifest.ts:63,74` spreads `...portable` unconditionally (so non-emission is the only wire-safe route), `types.ts:14` = 3, `FORWARD_MIGRATIONS` holds only entries 1/2, and the restore patch path (`restore-apply.ts:272` → `updateAppSettingsCore` → `validateAppSettingsPatch`, keyed by `COLUMN_OF`) is already able to write the keys the moment Phase 36 emits them. D-03/D-09 preserved.
- **[23-03] accent AA HIGH — FULLY RESOLVED (both).** `palette.accent` is a single `string` today (`theme-types.ts:33-34`), which genuinely cannot be AA-4.5:1 as a text-link on both galaxy-dark and a near-white light surface; the per-mode `{fill, onAccent, text}` triple is a real fix, not scope creep. The split gate (hard-fail for curated accents + newly-authored palettes; flag-for-owner/stop-and-ask for legacy owner-approved galaxy-dark hues) keeps `AA_NORMAL=4.5`/`AA_LARGE=3.0` intact and never auto-edits an owner hue. AA was NOT weakened.

One NEW HIGH was raised (codex) and stands after verification: **Plan 01's idempotency guarantee for a failed AsyncStorage clear is unsatisfiable with the cited API.** Remaining findings are MEDIUM/LOW polish items concentrated in Plans 01, 04, and 06.

### Agreed Strengths

- Backup deferral is mechanically sound and byte-safe against the format-3 wire, not hand-waved (both reviewers traced the actual `export-manifest.ts` spread and `backup-schema.ts` allowlist/reject).
- Migration 015 is correctly head+1 (`TARGET_VERSION = 14`, latest on-disk migration `014-interaction-assists.ts`) — verified on disk, not assumed.
- The per-mode accent triple is a substantive, necessary correction to the single-`accent`-string limitation, and the AA thresholds are preserved.
- `check:colors` exemption reasoning is accurate (`^[^:]*/theme/` only; migrations are scanned, `accents.ts`/`backgrounds.ts` are exempt).

### Agreed Concerns

- Plan 06's AA guarantee for glass surfaces is only validated against the semi-opaque fallback tint token; the live translucent composite over bright imagery is not bounded by the gate (Claude MEDIUM; codex touches adjacent Plan 06 asset/test gaps). Highest-value non-HIGH item.
- Plan 06 under-specifies concrete execution artifacts (codex: bundled asset paths + provenance README missing from `files_modified`; image-render-failure runtime test seam unspecified).

### Divergent Views

- **Codex raised a HIGH that Claude did not:** Plan 01's "repeat import after a failed clear is a no-op that does NOT re-bump `modified_at`/`data_revision`." Codex is correct on the code: `updateAppSettings` (`app-settings-dao.ts:606-617`) always bumps `modified_at` and `data_revision`, and its own docstring (`:598-604`) states an empty patch still bumps. The mapped legacy blob is always a non-empty patch, so the plan's only stated guard ("if the patch is non-empty, `updateAppSettings`") does not prevent the re-bump. The guarantee needs an explicit compare-before-write (diff) step the plan does not currently specify. **Verified on disk; this HIGH stands.**
- **Claude raised the glass-over-imagery AA MEDIUM that codex did not**, and both surfaced non-overlapping Plan 06 gaps — complementary, not contradictory.
- Overall risk rating: codex MEDIUM, claude LOW–MEDIUM. The delta is entirely the Plan 01 idempotency HIGH; both agree the architecture and decision-integrity are strong.

---

## Codex Review

## Summary

The phase is well-sequenced around the right irreversible seams: Plan 01 establishes durable settings and boot hydration before later visual primitives build on them; Plans 03–06 correctly isolate palette/accessibility, motion, icon/status, and surface work. The cycle-1 backup and accent-AA resolutions are coherent with the current codebase. Two implementation details still need tightening before execution: legacy-theme import idempotency/error handling, and the reduced-motion controller API/lifecycle.

## Strengths

- Plan 01 correctly addresses the backup wire-shape hazard. `readManifest()` spreads the portable snapshot directly into `appSettings` at [src/backup/export-manifest.ts:63-74](/home/bwales/projects/orbit-app/src/backup/export-manifest.ts:63), so deferring the seven keys from `getPortableSettingsSnapshot()` while allowlisting them is the right compatibility boundary. The current allowlist rejection confirms why this matters: [src/backup/backup-schema.ts:106-135](/home/bwales/projects/orbit-app/src/backup/backup-schema.ts:106).

- Making the new snapshot fields optional is a sound TypeScript mechanism. `AppSettingsPatch` is derived from `PortableSettingsSnapshot` at [src/db/app-settings-dao.ts:160-163](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:160), while export takes the snapshot return value verbatim. Optional, non-emitted fields therefore remain writable/restorable without silently changing format 3.

- Plan 01’s migration sequencing matches the repository’s real migration model: `TARGET_VERSION` is currently 14 and registration is centralized in [src/db/database.ts:49-66](/home/bwales/projects/orbit-app/src/db/database.ts:49); each migration is atomic with its `user_version` bump in [src/db/migrations/runner.ts:46-67](/home/bwales/projects/orbit-app/src/db/migrations/runner.ts:46).

- Plan 03’s per-mode accent triple is a substantive correction. The provider currently exposes only one `palette.accent` value at [src/theme/theme-provider.tsx:33-39](/home/bwales/projects/orbit-app/src/theme/theme-provider.tsx:33); separate fill/on-fill/link tones are necessary to make text contrast feasible across dark and light surfaces.

- Plan 04 properly avoids relying on Reanimated’s boot-time reduced-motion hook, and its planned Skia bridge fits existing architecture. The Orrery already drives animated values with `useClock()` and `useDerivedValue()` at [src/components/orrery/OrreryCanvas.tsx:93-101](/home/bwales/projects/orbit-app/src/components/orrery/OrreryCanvas.tsx:93).

- Plan 05 correctly identifies snooze as independent of `ProfileStatus`: the actual union contains only four states at [src/db/contact-status-read.ts:19-20](/home/bwales/projects/orbit-app/src/db/contact-status-read.ts:19), while the current ring helper accepts that status-or-null shape at [src/components/contact-card-ring.ts:44-60](/home/bwales/projects/orbit-app/src/components/contact-card-ring.ts:44).

- Plan 06 correctly expands reduced-motion coverage to `SunBody`; it currently derives a separate pulse directly from the shared clock at [src/components/orrery/SunBody.tsx:86-100](/home/bwales/projects/orbit-app/src/components/orrery/SunBody.tsx:86), so gating only canvas twinkle would be incomplete.

## Concerns

- **HIGH — Plan 01’s “clear failed, repeat import is a no-op” guarantee is not implementable from the stated action without an explicit equality guard.** `updateAppSettings()` always enters a transaction and bumps `data_revision` after the update at [src/db/app-settings-dao.ts:606-617](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:606); its own contract even says an empty patch advances `modified_at` at [src/db/app-settings-dao.ts:598-604](/home/bwales/projects/orbit-app/src/db/app-settings-dao.ts:598). If AsyncStorage removal fails, merely remapping the same legacy blob and calling `updateAppSettings(patch)` on next boot will repeatedly mutate timestamps/revisions. The plan requires no re-bump, but its action needs a compare-before-write step.

- **MEDIUM — Plan 01 does not define failure isolation for AsyncStorage I/O.** The existing boot chain catches any rejection and enters startup error state at [App.tsx:147-156](/home/bwales/projects/orbit-app/App.tsx:147). The new `getItem`, JSON decode, and `removeItem` calls must be individually nonfatal (except perhaps an actual DB write failure), otherwise a corrupt/unavailable legacy cache can block startup even though migration 015 and the seeded database settings are valid.

- **MEDIUM — Plan 04’s controller interface is underspecified.** It calls for `createReducedMotionController(accessibilityInfo)` while saying it forwards values through an `emit` callback, but does not establish whether `emit` is an argument, a `start(emit)` method, or a subscription API. This matters because both hooks need a clean effect lifecycle. Define one concrete interface before implementation, e.g. `createReducedMotionController(accessibilityInfo, emit): { dispose(): void }`.

- **MEDIUM — Plan 06 declares new bundled background assets and provenance but does not own their paths in `files_modified`.** The repository currently has only general assets and a font asset ([assets listing](/home/bwales/projects/orbit-app/assets/Inter-SemiBold.ttf)); Plan 06 should explicitly list the exact image files plus a provenance README/manifest. Otherwise the required local-asset and licensing deliverables can disappear from execution scope.

- **LOW — Plan 02 should include `package-lock.json` in its modified-files contract.** The repository uses npm and has a lockfile, while the plan installs three runtime dependencies. Omitting it risks an unreviewed lockfile change or a non-reproducible dependency update.

- **LOW — Plan 06’s “image render failure” test needs a concrete test seam.** Existing image error handling is component-state based, e.g. [src/components/PhotoChoice.tsx:61](/home/bwales/projects/orbit-app/src/components/PhotoChoice.tsx:61). The plan should specify an injected/resolvable image renderer or a component test strategy; a pure manifest test cannot prove the `onError → None/Solid` runtime behavior.

## Suggestions

- In Plan 01, after migration and legacy-blob mapping, read `getAppSettings()`, calculate only differing fields, and call `updateAppSettings()` only if that diff is non-empty. Attempt legacy-key removal afterward; if removal fails, log a nonfatal warning. Test unchanged-column retry behavior explicitly.

- Wrap legacy `AsyncStorage.getItem`, parse, and removal in localized `try/catch` blocks. Treat read/parse/removal failure as “no import this launch,” retain the seeded/database settings, and continue to hydrate the store.

- Specify the Plan 04 controller API and test it as a single-start/single-dispose resource. Also state whether simultaneous use of both hooks is allowed to create separate native listeners or whether a shared subscription is required.

- Add explicit background asset filenames and an `assets/backgrounds/README.md` (or equivalent manifest) to Plan 06’s `files_modified`.

- Add `package-lock.json` to Plan 02 and verify dependency additions with `npm ci` or the project’s normal lockfile validation.

- Add a component-level test or an extracted `resolveRenderableBackground` state reducer for Plan 06’s image-error fallback.

## Risk Assessment

**MEDIUM.** The architecture and dependency ordering are strong, and the two cycle-1 HIGH findings are genuinely resolved rather than papered over. The remaining high-risk item is narrowly scoped to boot migration retry behavior; without a compare-before-write guard, a failed AsyncStorage clear causes persistent unnecessary settings revisions. Once that and the stated medium implementation seams are clarified, the plans are suitable for execution.

---

## Claude Review

**Reviewer:** Claude (claude-opus-4-8), independent cross-AI peer reviewer (run as a read-only source-grounded subagent; the in-CLI `claude -p` lane is skipped for independence and has a known Write-permission gap in this environment).

## Summary

The seven plans are coherent, well-sequenced, and — unusually — their load-bearing claims hold up against the actual code on disk. The architecture front-loads every irreversible/shared-file edit (migration 015, the `app_settings` writer contract, the backup allowlist, the boot gate, the package re-key) into Plan 01's gated tracer, then fans out additive, non-overlapping work across waves 2–4. I verified the two cycle-1 HIGHs against the real backup pipeline, DAO validators, restore path, palette types, and Orrery clock consumers: **both are FULLY RESOLVED and neither reverses a recorded decision.** The backup deferral is genuinely byte-safe against the format-3 wire (`export-manifest.ts` spread + `validateAppSettingsPatch` reuse in `updateAppSettingsCore` both confirmed), and the AA split gate preserves 4.5:1 while correctly firewalling owner-approved hues. Remaining issues are minor: a mis-citation of which galaxy-dark tokens are owner-dated, one real accessibility edge in the glass-over-imagery AA guarantee, and the honest fact that this phase ships primitives, not visible app-wide theming (an intentional, recorded scope boundary).

## Strengths

- **Backup HIGH deferral is mechanically sound, not hand-waved.** `export-manifest.ts:63,74` does spread `...portable` unconditionally into `manifest.appSettings`, so not-emitting from `getPortableSettingsSnapshot` (`app-settings-dao.ts:387-458`) is indeed the only way to keep the 7 keys off the wire. `BACKUP_FORMAT_VERSION = 3` (`types.ts:14`) and `FORWARD_MIGRATIONS` has only entries `1` and `2` (`backup-schema.ts:19-79`) — the plan correctly touches neither. The regression test (format-3 export omits the 7 keys) is the right and only guard, since `assertNoLocalOnlyKeys` uses a blocklist (`export-manifest.ts:12-14`) that wouldn't otherwise catch accidental emission.
- **The forward-restore path is real.** `restore-apply.ts:272` builds the settings patch from `manifest.appSettings` and writes via `updateAppSettingsCore`, which repeats `validateAppSettingsPatch` (`app-settings-dao.ts:658`) and only writes keys present in `COLUMN_OF`. So the plan's claim that Phase 36 can begin emitting with "the allowlist + patch path already in place" is accurate, and tampered theme values in a hand-crafted backup would be validated by the new `assertTheme*` validators before write (T-23-03 grounded).
- **`phoneRegionOverride` precedent caution is correct.** It is now REQUIRED (`app-settings-dao.ts:154`) and EMITTED (`:444`) — Plan 01 correctly warns *not* to copy that shape and instead use optional-field + no-SELECT/return, which keeps `tsc` green while omitting the keys.
- **Migration head+1 verified.** `TARGET_VERSION = 14` (`database.ts:49`), latest migration on disk is `014-interaction-assists.ts` — so `015` is correct, not assumed.
- **AA split gate does not weaken 4.5:1.** `palette.accent` is a single `string` today (`theme-types.ts:34`); one hex genuinely cannot be AA as a text-link on both galaxy-dark and a light surface, so the `{fill, onAccent, text}` per-mode triple is a real fix, not scope creep. The hard-fail/flag-for-owner partition keeps `AA_NORMAL`/`AA_LARGE` intact.
- **Orrery HIGH (23-06) correctly identifies the second clock consumer.** `SunBody.tsx:86` reads `useOrreryClock()` and drives `pulseGlowRadius`/`pulseGlowOpacity` (`:87-100`), independent of `OrreryCanvas.tsx:94`'s `useClock()` twinkle (`:98-101`). There are exactly two clock consumers (grep confirms), so gating only `OrreryCanvas` would leave the sun pulsing — the plan's scoping of SunBody is exactly right.
- **`check:colors` exemption claim is accurate.** `scripts/check-colors.sh` filters `^[^:]*/theme/` only, so migrations under `src/db/migrations/` are scanned (hex-default prohibition grounded) and `accents.ts`/`backgrounds.ts` under `src/theme/` are exempt.
- **`ProfileStatus`/snooze distinction verified.** `contact-status-read.ts:19` is `stable|wobble|decay|rogue` with no `snoozed`; the new `StatusDisplayState = ProfileStatus | 'snoozed' | null` correctly leaves `ringVisual`'s `ProfileStatus | null` (`contact-card-ring.ts:44-45`) untouched.
- **Tooling claims check out:** `postinstall: patch-package` only (`package.json:69`); the three new deps are absent (so `expo install` is real); `react-test-renderer`/`@testing-library` absent with `vitest` present, justifying Plan 04's node-testable controller extraction.

## Concerns

- **[LOW] 23-03 mis-cites which galaxy-dark tokens are "owner-approved 2026-08-16."** Plan 03 lists `textPrimary/textSecondary` (and `rogue`) as owner-approved-dated at `theme-types.ts:78-108`. In fact only `statusStable/statusWobble/statusDecay` carry the `2026-08-16` annotation (`:77-108`); `rogue` is dated `2026-08-15` (`:67-73`); and `textPrimary/textSecondary` (`:34-35`) carry **no** owner-approval date at all. The flag-for-owner partition is defined by this citation. Mechanism: an executor mapping "legacy owner-approved" strictly to the dated tokens might wrongly treat `textPrimary/textSecondary` as new/tunable and auto-retune them. They *are* legacy space-dark tokens, so flagging them is still the safe call — but the citation should be corrected so the partition boundary is unambiguous.
- **[MEDIUM] Glass-over-imagery AA is only guaranteed against the fallback tint token, not the live translucent composite.** Plan 06 checks text/status foregrounds against the *semi-opaque tinted fallback surface token* (the blur-unavailable path), and Plan 03 hands the translucent pairs to Plan 06. But when `expo-blur` IS available, `GlassSurface` renders a translucent tint over the selected background image, and the exact tint opacity/blur radius are explicitly "discretion defaults" (Plan 06 flagged edge). Nothing in the plans requires the *live* glass tint opacity to be ≥ the fallback token's opacity used in the AA gate. Mechanism: over a bright bundled background, a more-translucent-than-fallback glass tint can drop text below 4.5:1 even though the gate (checking the more-opaque fallback) passes. Suggest an explicit invariant: the live glass tint must be at least as opaque as the AA-checked fallback token, or the AA check must run against the actual minimum-opacity composite.
- **[LOW] `theme-provider.tsx` and the palette files are edited by both Plan 01 (wave 1, package re-key) and Plan 03 (wave 2, accent overlay).** Also `theme-presets.ts`/`theme-types.ts`/`theme-presets.test.ts`. This is correctly serialized by wave ordering (no in-wave overlap), so it is not a merge hazard — but Plan 03's provider overlay assumes Plan 01 has already repointed `resolvePalette(presetId,…)` (`theme-provider.tsx:36`) to the package axis. If Plan 01 slips, Plan 03 breaks. Worth an explicit dependency note in 03 beyond `depends_on: ["23-01"]` (which is present, so this is a soft note).
- **[LOW] Plan 02 font asset paths are inconsistent.** The two new fonts land at `assets/Inter-Regular.ttf` / `assets/SpaceGrotesk-SemiBold.ttf` (assets root, matching existing `assets/Inter-SemiBold.ttf`), but the provenance README is `assets/fonts/README.md` (a subdirectory that otherwise holds no fonts). Harmless, but the README documenting fonts that live one directory up is mildly confusing.
- **[LOW/informational] The phase delivers infrastructure, not a visibly themed app.** Every plan defers screen adoption to Phase 15 (and the Appearance settings UI to Phase 36/37), per `planning-notes:78-81`. This is a recorded, defensible boundary — but a reader expecting "the app now has themes" should note that after Phase 23 no existing screen renders through `BackgroundHost`/`AppText`/`Button`, no settings UI drives the columns, and THEME-04/05/07/08/09/10 are verified at the primitive level only. The phase goal ("the theme system exists and is proven") is met; the milestone goal ("the app is themed") is not, by design.

## Suggestions

- Correct the 23-03 token citation: split "owner-approved status hues (`:77-108`, 2026-08-16)" from "pre-existing space-dark `textPrimary`/`textSecondary` (`:34-35`, undated)" and state that *all* pre-existing galaxy(=space-dark) required tokens are flag-for-owner regardless of an inline date.
- Add an explicit AA invariant to Plan 06: the live `GlassSurface` tint opacity must be ≥ the fallback tint token's opacity that the AA gate validates, so the gate's guarantee actually bounds the rendered composite (closes the glass-over-imagery gap).
- In Plan 06, consider asserting (test or device-UAT) that at least the densest surface step keeps AA over the *brightest* bundled background, not only over the fallback token.
- Move the font provenance README to `assets/README.md` (or move the `.ttf`s under `assets/fonts/`) so the record sits with the files it documents.
- Optional: add a `tsc`/grep guard in Plan 01's acceptance that `getPortableSettingsSnapshot`'s return object literal contains none of the 7 theme keys, complementing the runtime export regression test (belt-and-suspenders against re-emission).

## Risk Assessment

**Overall: LOW–MEDIUM.**

Justification: The irreversible surface (migration 015) is isolated to one gated decision in Plan 01, the backup wire-shape is provably unchanged (verified against the real spread and validators), and no plan reverses a `[DECIDED]`/`[REJECTED]` item — the two most dangerous decision-reversals (format-4 bump; weakening AA / editing owner hues) are explicitly firewalled to owner escalation. The dependency graph is clean (no in-wave file collisions). Residual risk is concentrated in two places: (a) the boot-gate rewrite in Plan 01, which replaces a one-line `.then(setReady)` with a multi-step import/hydrate sequence — well-specified with import-order tests but genuinely the highest-execution-risk edit (the plan's own "confidence: low" is appropriate); and (b) the glass-over-imagery AA guarantee (MEDIUM), which is bounded only against the fallback token and could under-protect the live translucent path. Neither threatens data integrity or the local-first/no-network commitment (backgrounds/fonts are all bundled `require()`, verified no CDN path in the plans).

**Cycle-1 HIGH status:**
- **[23-01] backup wire-shape — FULLY RESOLVED.** Allowlist-now/emit-later is coherent and byte-safe: keys optional in `PortableSettingsSnapshot`, added to `PORTABLE_SETTINGS_KEYS`, not emitted, no version bump, no `FORWARD_MIGRATIONS` entry, restore path already able to write them via `COLUMN_OF`+validators. D-03/D-09 preserved.
- **[23-03] accessibility AA — FULLY RESOLVED.** Per-mode `{fill,onAccent,text}` triple is a real necessity (single `accent: string` confirmed), the split gate does not lower `AA_NORMAL`/`AA_LARGE`, and legacy owner-approved galaxy-dark hues are flag-for-owner, not auto-edited. (Fix the token citation per Concerns, but the resolution logic is sound.)

---

## Planner Notes (aggregation)

- **Cycle-1 HIGHs [23-01] and [23-03]: FULLY RESOLVED** — both reviewers verified against live code; neither reverses a recorded decision (D-03/D-09 and the AA 4.5:1 invariant both preserved). Excluded from the unresolved count.
- **NEW HIGH (unresolved this cycle) — Plan 01 idempotent-re-import guarantee.** `updateAppSettings` (`app-settings-dao.ts:606-617`, docstring `:598-604`) always bumps `modified_at`/`data_revision`; the plan's "repeat import is a no-op that does NOT re-bump" (must_have + acceptance line ~199) needs an explicit compare-before-write (diff) step that the plan does not specify. Verified on disk. → owner/planner action required (this is an internal plan/code inconsistency, not a decision reversal).
- Actionable MEDIUM/LOW not yet incorporated into a PLAN.md task/acceptance/`files_modified`: (1) Plan 06 live-glass AA invariant vs fallback token [MED]; (2) Plan 01 read-side AsyncStorage I/O failure isolation [MED]; (3) Plan 06 bundled asset paths + provenance README in `files_modified` [MED]; (4) Plan 04 controller `emit` interface signature [MED]; (5) Plan 02 `package-lock.json` in `files_modified` [LOW]; (6) Plan 06 image-render-failure runtime test seam [LOW]; (7) Plan 03 owner-approved token citation fix [LOW]; (8) Plan 02 font provenance README path [LOW].

To incorporate feedback into planning:
  /gsd-plan-phase 23 --reviews
