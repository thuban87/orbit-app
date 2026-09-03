---
phase: 23
reviewers: [codex, claude]
reviewed_at: 2026-09-03T04:40:00Z
convergence_cycle: 3
plans_reviewed: [23-01-PLAN.md, 23-02-PLAN.md, 23-03-PLAN.md, 23-04-PLAN.md, 23-05-PLAN.md, 23-06-PLAN.md, 23-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus-4-8"
model_sources:
  codex: "banner"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 23 (Theme & Visual System), Convergence Cycle 3

> Reviewer lanes: **codex** (gpt-5.6-terra, source-grounded, read-only) and **claude**
> (claude-opus-4-8, run as an independent read-only source-grounded subagent — the headless
> `claude -p` lane is skipped when the orchestrator itself runs inside Claude Code, and has a
> known Write-permission gap, so an independent read-only subagent stands in for it). Both lanes
> verified plan claims against the actual code on disk (src/db, src/backup, src/theme,
> src/components, App.tsx) and against HANDOFF/ADR decisions and the cycle-2 resolutions.

## Consensus Summary

Both reviewers independently conclude the seven plans are coherent, correctly wave-ordered, and
that the **cycle-2 HIGHs are genuinely resolved on disk** — verified, not asserted:

- **Migration 015 is head+1** — `TARGET_VERSION = 14` (`src/db/database.ts:49`), latest on-disk
  migration is `014-interaction-assists.ts`; a new additive 015 is correct and safe. (both)
- **Backup allowlist-now / emit-later is byte-safe against the format-3 wire.**
  `export-manifest.ts:74` builds `appSettings: { ...portable, sunContactUid }`, spreading the
  snapshot verbatim, so *not emitting* the 7 theme keys from `getPortableSettingsSnapshot` is the
  only wire-safe route; `BACKUP_FORMAT_VERSION = 3` (`src/backup/types.ts:14`); `FORWARD_MIGRATIONS`
  holds only keys 1/2 (`backup-schema.ts:20,62`). No format bump, no forward-migration entry —
  D-03/D-09 preserved. (both)
- **Import idempotency (cycle-2 HIGH) is correctly closed** by compare-before-write.
  `updateAppSettings` (`app-settings-dao.ts:606-617`) unconditionally opens a txn and bumps
  `data_revision`; its docstring (`:598-604`) confirms even an empty patch bumps `modified_at`.
  The mapped blob is always non-empty, so gating on "patch non-empty" would not work — the
  mapped-vs-stored diff gate is the right and only mechanism. (both)
- **Per-mode accent triple is a real fix, not scope creep**, for the single `accent: string`
  (`theme-types.ts:33`); AA 4.5:1 is preserved and the gate splits hard-fail vs owner-escalation.
  (both)
- **Local-first intact** — fonts and backgrounds are all local `assets/` `require()` bundles; no
  network on any read path. No `[DECIDED]`/`[REJECTED]` reversal; the two owner-firewalled items
  (format-4 bump, AA weakening / owner-hue edits) are intact. (both)

Neither reviewer found a HIGH-severity blocker: **0 HIGH.** Residual risk is concentrated in one
concrete correctness defect in Plan 01's legacy-import path (claude MEDIUM) and glass-over-imagery
AA validation strength in Plan 06 (codex MEDIUM), plus LOW polish.

### Agreed Strengths

- Migration 015 head+1, additive-only, isolated to Plan 01's gated tracer (both).
- Backup deferral mechanically sound against the format-3 wire (both).
- Compare-before-write idempotency guard grounded in the real DAO bump behavior (both).
- Reduced-motion scoping is complete — both Skia clock consumers gated: `OrreryCanvas.tsx:93-98`
  (twinkle `useDerivedValue`) and `SunBody.tsx:86` (sun pulse); animation is worklet-driven, not
  React-state, and the existing focus/foreground conditional mount still halts the loop (both).

### Agreed Concerns

- Both raise a **MEDIUM**, though on different seams (see Divergent Views): claude on Plan 01's
  legacy-import blob shape, codex on Plan 06's glass AA proof strength. Both agree overall risk is
  LOW / LOW–MEDIUM and neither threatens data integrity or the no-network commitment.
- Both touch the **color gate being a location policy** (`scripts/check-colors.sh` exempts
  `src/**/theme/**`): it cannot by itself stop a new theme component using an ad-hoc literal instead
  of a named token — semantic assurance must come from unit tests / provider wiring (codex LOW;
  claude notes the same exemption as a verified strength but relies on the tests).

### Divergent Views

- **Glass-over-imagery AA (Plan 06).** codex raises this as a **MEDIUM**: the planned
  `liveGlassTintOpacity >= fallbackTintTokenOpacity` invariant is alpha-ordering only and does not
  universally prove every status/text foreground retains AA after compositing over every bundled
  image (contrast depends on tint colour, foreground colour, and actual background pixels;
  `OrreryCanvas.tsx:44`, `SunBody.tsx:46`). claude considers this **already mitigated** by that same
  live-tint ≥ fallback-tint invariant and deliberately did **not** re-raise it. → Planner/owner
  call: is the opacity invariant sufficient, or should Plan 06 add an actual composited
  foreground/background AA test against a declared worst-case (brightest representative) pixel per
  bundled asset?

---

## Codex Review

## Summary

The seven plans are coherent, correctly staged, and address the cycle-2 issues with concrete
mechanisms. The migration/backup deferral, per-mode accent contrast, import idempotency, and all
current Orrery clock consumers are now explicitly covered. I found no HIGH-severity blocker.

## Strengths

- Migration 015 is correctly head+1: the current target is 14 and registration ends at migration
  014, so adding a new additive 015 is safe and appropriately scoped. `src/db/database.ts:49,52`
- The plan respects the migration runner's atomic, forward-only contract: each migration is
  transactionally paired with its `user_version` update, preserving rollback safety for interrupted
  upgrades. `src/db/migrations/runner.ts:56`
- The backup-wire resolution is sound. Export unconditionally spreads `getPortableSettingsSnapshot()`
  into `appSettings`, so keeping theme fields out of that projection until the format-4 owner phase
  is the correct way to avoid silently changing format 3. `src/backup/export-manifest.ts:41,63,74`
- The compare-before-write import guard correctly accounts for the DAO's otherwise surprising
  behavior: even an empty settings patch advances `modified_at` and data revision. The planned
  zero-diff guard therefore genuinely prevents repeat legacy imports from perturbing restore
  conflict ordering. `src/db/app-settings-dao.ts:598,606`
- Reduced-motion design matches the current Skia architecture. Existing twinkle and sun pulse are
  `useDerivedValue` worklets driven by one Skia clock, not React-state animation; Plan 06 correctly
  scopes both consumers. `src/components/orrery/OrreryCanvas.tsx:93,98`, `src/components/orrery/SunBody.tsx:86`
- The existing Orrery design already relies on mounting only while focused/foregrounded to halt the
  render loop; the new reduced-motion gating complements rather than replaces that lifecycle control.
  `src/components/orrery/OrreryCanvas.tsx:2`
- The color gate has the intended scope: literals are rejected outside `src/**/theme/**`, including
  direct file targets, supporting the planned token-only components and Skia inputs.
  `scripts/check-colors.sh:35,43`

## Concerns

- **MEDIUM — live-glass contrast proof needs a real compositing calculation, not only an opacity
  ordering assertion.** The planned `liveGlassTintOpacity >= fallbackTintTokenOpacity` test is a
  useful invariant, but alpha ordering alone does not universally prove every status/text foreground
  retains AA after compositing over every bundled image. Contrast depends on tint color, foreground
  color, and actual background pixels. This is especially relevant because Orrery and other Skia
  surfaces consume token colors dynamically. `src/components/orrery/OrreryCanvas.tsx:44`,
  `src/components/orrery/SunBody.tsx:46`
- **LOW — the color gate is a location policy, not semantic token verification.** It deliberately
  exempts all of `/theme/`, so it cannot by itself prevent a new theme component from bypassing a
  named token with an ad-hoc literal. The planned unit tests and provider wiring should carry that
  semantic assurance. `scripts/check-colors.sh:37`

## Suggestions

- In Plan 06, test the actual alpha-composited foreground/background pairs against the brightest
  representative pixels or a declared worst-case background color for every bundled asset. Keep the
  opacity invariant as an additional regression guard.
- Add a small test asserting `GlassSurface` reads only declared surface-token fields, so the
  `/theme/` exemption does not become an escape hatch for component-local colors.
- Preserve the existing focus/foreground conditional mount while integrating reduced motion; verify
  it explicitly in the Plan 06 device-UAT checklist.

## Risk Assessment

**Overall: LOW.** The prior high-risk concerns are genuinely resolved with appropriate ownership
boundaries and testable mechanisms. Remaining risk is mainly visual/compositing validation and
device UAT, not schema safety, backup compatibility, local-first privacy, or JS-thread animation
behavior.

---

## Claude Review

**Reviewer:** Claude (claude-opus-4-8), independent read-only source-grounded peer reviewer.
**Scope:** 23-01 … 23-07 PLAN.md, verified against actual code on disk (src/db, src/backup,
src/theme, src/components, App.tsx), HANDOFF/ADR decisions, and the cycle-2 resolutions.

### 1. Summary

The seven plans remain coherent, cleanly wave-ordered, and — re-verified this cycle against the
live code — their load-bearing claims hold. Every irreversible/shared edit (migration 015, the
`app_settings` writer contract, the backup allowlist, the boot gate, the package re-key) is
front-loaded into Plan 01's gated tracer; waves 2–4 fan out additive, non-overlapping work with no
in-wave file collisions. The three cycle-2/cycle-3 resolutions are coherent on disk: (a) backup
allowlist-now/emit-later is byte-safe against the format-3 wire; (b) the per-mode accent triple is
a genuine fix for the single `accent: string` limitation with AA 4.5:1 preserved; (c) the
compare-before-write idempotency guard correctly addresses the real `updateAppSettings`
always-bumps behavior. No plan reverses a `[DECIDED]`/`[REJECTED]` item — ADR-048/§7 supersession
(D-04), AA thresholds, owner-approved hues, and the format-4 deferral are all explicitly firewalled
to owner escalation. **One new, concrete MEDIUM emerged: the one-time `orbit-theme` import reads
the wrong blob shape** — the key is written by zustand's `persist` middleware as a `{state,version}`
envelope, but the mapper is specified to read a flat `{mode,presetId}`, so the migration silently
no-ops on real upgraded devices while its unit test (which uses the flat shape) passes green.
Everything else is LOW polish.

Findings: **0 HIGH, 1 MEDIUM, 3 LOW.**

### 2. Strengths (verified on disk)

- **Migration head+1 is real, not assumed.** `TARGET_VERSION = 14` (`src/db/database.ts:49`),
  latest on-disk migration is `014-interaction-assists.ts` (no 015 present) → migration 015 is correct.
- **Backup wire-shape deferral is mechanically sound.** `export-manifest.ts:74` builds
  `appSettings: { ...portable, sunContactUid }` spreading the snapshot verbatim, so *not emitting*
  the 7 keys from `getPortableSettingsSnapshot` is the only wire-safe route. `BACKUP_FORMAT_VERSION
  = 3` (`src/backup/types.ts:14`); `FORWARD_MIGRATIONS` has only keys `1` and `2`
  (`src/backup/backup-schema.ts:20,62`); `PORTABLE_SETTINGS_KEYS` (`backup-schema.ts:106-114`) does
  not yet contain any theme key and `assertPortableSettings` (`:129-135`) hard-rejects any
  non-allowlisted key — so the allowlist addition is required and the deferral test is the right guard.
- **The forward-restore path genuinely already writes these keys.** `restore-apply.ts:272` builds
  the patch via `Object.fromEntries(...filter(key !== modifiedAt/sunContactUid))` →
  `updateAppSettingsCore`, which re-runs `validateAppSettingsPatch` and writes only `COLUMN_OF`
  keys — so once Phase 36 emits, the new `assertTheme*` validators + allowlist gate tampered values
  with no further data-model change. Plan 01's claim is accurate.
- **The idempotency HIGH from cycle-2 is correctly resolved.** `updateAppSettings`
  (`app-settings-dao.ts:606-617`) unconditionally opens a transaction and calls
  `bumpDataRevisionCore`, and its docstring (`:598-604`) states an empty patch still bumps
  `modified_at`. Plan 01's compare-before-write diff is the right and only mechanism; gating on
  "patch non-empty" would not work because the mapped blob is always non-empty.
- **`phoneRegionOverride` precedent caution is correct.** It is REQUIRED
  (`app-settings-dao.ts:154`, `string | null`) and EMITTED (`:444`); Plan 01 correctly warns
  against copying that shape and specifies optional-field + no-SELECT/return instead.
- **Per-mode accent triple is justified, not scope creep.** `theme-provider.tsx:36` resolves a
  single `resolvePalette(presetId, resolved)` and `theme-types.ts:33` declares `accent: string` —
  one hex cannot be AA-4.5:1 as link text on both galaxy-dark and a near-white surface. The split
  gate keeps `AA_NORMAL`/`AA_LARGE` intact and flags (never edits) owner hues.
- **The cycle-2 token-citation LOW is fully fixed.** `statusStable/statusWobble/statusDecay` carry
  "owner-approved 2026-08-16", `rogue` carries "2026-08-15" (`theme-types.ts:67`), and
  `textPrimary/textSecondary` (`:34-35`) carry **no** date. Plan 03 now states exactly this and
  treats all pre-existing space-dark tokens as flag-for-owner regardless of date.
- **Orrery reduced-motion scoping is complete.** Grep confirms exactly two clock consumers:
  `OrreryCanvas.tsx:94` (`useClock()` → twinkle `useDerivedValue`) and `SunBody.tsx:86`
  (`useOrreryClock()` → `pulseGlowRadius`/`pulseGlowOpacity`). Plan 06 gates both.
- **`ProfileStatus`/snooze distinction verified.** `contact-status-read.ts:19` is
  `stable|wobble|decay|rogue` (no `snoozed`); `ringVisual` (`contact-card-ring.ts:49`) keeps its
  `ProfileStatus | null` signature; the new `StatusDisplayState` union is the correct place to add `snoozed`.
- **check:colors reasoning accurate.** `scripts/check-colors.sh:47` filters `^[^:]*/theme/` only,
  so migrations under `src/db/migrations/` are scanned and `accents.ts`/`backgrounds.ts` are exempt.
- **Dependency graph is clean.** Wave 1: 23-01. Wave 2: 23-02/03/04 (all `depends_on: 23-01`), no
  shared files. Wave 3: 23-05 / 23-06, no shared files. Wave 4: 23-07. App.tsx is touched only by
  23-01 then 23-02, serialized. Verified against every `files_modified` list.
- **No network on any read path.** Fonts and backgrounds are all local `assets/` `require()`
  bundles. Local-first commitment intact.

### 3. Concerns

- **[MEDIUM] Plan 01's `orbit-theme` one-time import reads the wrong blob shape — the migration
  silently no-ops on real devices while its unit test passes.**
  Evidence: `src/stores/theme-store.ts:24-49` persists via zustand `persist` +
  `createJSONStorage(() => AsyncStorage)` under `name: "orbit-theme"` (`:34`), zustand `^5.0.15`
  (`package.json`). zustand v5's JSON storage writes the value as
  `JSON.stringify({ state: { mode, presetId }, version: 1 })` — an envelope, **not** a flat object.
  But Plan 01 specifies the mapper as a pure `{mode, presetId} | null` → column-patch mapper and the
  App.tsx step as `JSON.parse` + validate/map via `orbit-theme-migration`
  (23-01-PLAN.md:174,184,186); the acceptance test asserts `{mode:'dark',presetId:'space-dark'}`
  → patch (`:174,198`). Passing the parsed envelope `{state:{...},version:1}` to a mapper that looks
  for top-level `.mode`/`.presetId` yields `undefined` on both → the "unknown/malformed → seeded
  defaults / no-op" branch fires every time.
  Impact: an upgrading plugin user with `mode:'dark', presetId:'space-dark'` does **not** get
  galaxy+dark carried across; the import no-ops to the seeded default (galaxy + Follow-System),
  which looks fine at night but flips to galaxy-*light* in daytime — a real regression of an
  explicit user choice, directly failing Plan 01's own device-UAT acceptance (`:192`). The node test
  uses the flat shape, so CI is **false-green** and only device-UAT would catch it. Safe degrade to
  a valid default, hence MEDIUM not HIGH. Fix: the mapper (or the App.tsx read step) must unwrap
  `parsed.state` (tolerating the zustand `version` field), and the unit test must feed the real
  envelope shape `{state:{mode,presetId},version:1}`.
- **[LOW] The `danger` token is not covered by Plan 03's opaque-pair AA gate, yet it is
  functional/destructive content authored anew in three palettes.** Plan 03's enumerated pairs
  (23-03-PLAN.md:34,163) are only `textPrimary/textSecondary` vs backgrounds, status hues vs
  surfaces, and accent `text`/`onAccent` — `danger` appears in none. `danger` exists as an
  owner-approved token (`theme-types.ts` ~:37, galaxy-dark) and Plan 03 authors galaxy-light +
  standard dark/light where `danger` is brand-new; Plan 07's Destructive `Button`/`ConfirmDialog`
  render on it (23-07-PLAN.md:93). THEME-11 requires functional content to meet AA in every combo.
  Suggest adding `danger` (fill vs its foreground, and/or danger-as-text vs surface) to the opaque
  compositing pairs for the three new palettes (galaxy-dark `danger` stays flag-for-owner).
- **[LOW] Plan 05 tab-name vocabulary does not match the actual `TabParamList` keys.** Plan 05 names
  the tabs "dashboard/orrery/backup/settings" (23-05-PLAN.md:31,99,104), but the real keys are
  `DashboardTab`/`OrreryTab`/`BackupTab`/`SettingsTab` (`RootNavigator.tsx:43-47`). The acceptance
  test ("each of the four `TabParamList` keys resolves a registered icon") will drive the executor to
  the real keys, so this is cosmetic — but the registry's semantic names (`dashboard`) must be
  explicitly mapped to route keys (`DashboardTab`) so the mapping seam isn't lost.
- **[LOW] Fresh-install default appearance mode changes from `dark` to `system` — intended, but
  worth an explicit call-out.** The current store seeds `mode: "dark"` (`theme-store.ts:29`);
  migration 015 seeds `galaxy_mode/standard_mode` NOT NULL DEFAULT `'system'`. This is exactly what
  THEME-01 mandates (first launch Galaxy + Follow System), so it is correct — flagged only because
  it is a behavioral change to every fresh install that is easy to miss when reviewing the migration
  in isolation. (Not actionable — correct as designed.)

### 4. Suggestions

- Correct the `orbit-theme` import to unwrap the zustand persist envelope
  (`parsed.state.mode` / `parsed.state.presetId`, tolerating a `version` field), and change the Plan
  01 unit test fixture to the real `{state:{mode,presetId},version:1}` shape so the test actually
  exercises the migration path.
- Add `danger` to Plan 03's opaque-pair AA gate for the three newly-authored palettes (or explicitly
  record that destructive-token contrast is validated in Plan 07 — but Plan 07 has no contrast gate
  today, so Plan 03 is the right home).
- In Plan 05, state the `dashboard→DashboardTab` (etc.) mapping explicitly so retiring `TAB_GLYPHS`
  cannot leave a route without an icon.
- Optional belt-and-suspenders (carried from cycle-2): add a static grep/tsc guard in Plan 01
  acceptance that `getPortableSettingsSnapshot`'s returned object literal contains none of the 7
  theme keys, complementing the runtime export regression test.

### 5. Risk Assessment

**Overall: LOW–MEDIUM.** The irreversible surface (migration 015) is isolated to one gated
decision; additive-only, correctly head+1, its writer/backup/restore plumbing verified against the
real DAO, allowlist, and restore patch path. The two most dangerous decision-reversals (format-4
bump; weakening AA / editing owner hues) are explicitly owner-firewalled, and no
`[DECIDED]`/`[REJECTED]` item is reversed. The cycle-2 HIGH (idempotent re-import) is genuinely
closed by compare-before-write. Local-first/no-network is intact. Residual risk concentrates in
(a) the Plan 01 boot-gate rewrite, which now carries the **MEDIUM blob-shape defect** making its
legacy-import path a no-op on real devices (safe degrade, but a false-green test and a missed
carry-across requirement); and (b) the glass-over-imagery AA path (tracked in Plan 06 via the
live-tint ≥ fallback-tint invariant). Neither threatens data integrity or the no-network
commitment. Fixing the blob-shape read (and its test) before execution would drop this to LOW.
