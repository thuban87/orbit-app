---
phase: 23
reviewers: [codex, claude]
reviewed_at: 2026-09-03T08:24:37Z
plans_reviewed: [23-01-PLAN.md, 23-02-PLAN.md, 23-03-PLAN.md, 23-04-PLAN.md, 23-05-PLAN.md, 23-06-PLAN.md, 23-07-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus (read-only subagent)"
model_sources:
  codex: "banner"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 23 (Theme & Visual System)

Two independent source-grounded reviewers ran: **Codex** (via the review-lane machinery,
model `gpt-5.6-terra`) and **Claude** (run as a read-only subagent rather than the `claude -p`
lane, per the known Write-permission gap in that lane). Both verified claims against the actual
code on disk — migrations, DAOs, the theme layer, the backup layer, boot, the dossier, HANDOFF,
and ADRs — and both read beyond the changed-files lists (shared-table/shared-surface consumers)
per the "review the code, not the diff" rule. The orchestrator independently re-verified every
load-bearing claim below against source before recording it (migration number, backup
export/spread, SunBody clock consumer, `ProfileStatus` union, `postinstall`, test harness).

## Consensus Summary

The phase's **architecture is sound and both reviewers agree on it**: Plan 01 correctly
front-loads the one-way-door migration-015 schema, the whole `app_settings` writer contract, the
theme re-key, the `orbit-theme` one-time import, and the restore-before-paint boot gate into a
single gated tracer; later waves fan out as additive pure data, primitives, and renderer edits.
The migration number (015 = head+1, `database.ts:49` `TARGET_VERSION=14`, latest migration 014)
is correct on disk. **No decision reversals, no local-first/network violations, and no
hardcoded-colour or animation-from-React-state violations were found in the plans** — the plans
in fact *enforce* the recorded decisions (D-04's supersession of HANDOFF §7, ADR-048's rejection
of tap-to-freeze, D-06/D-07 trip-wires).

Two substantive issues rise to the top (both reviewers, both verified), and one important
**divergence** on how much "adoption" this phase owes.

### Agreed Strengths

- **Migration 015 = correct head+1, verified on disk** by both reviewers (`database.ts:49`
  `TARGET_VERSION=14`; latest registered migration `014-interaction-assists.ts`). The additive
  `ALTER TABLE app_settings ADD COLUMN … NOT NULL DEFAULT` idiom is copied faithfully from 014.
- **The tracer correctly front-loads the irreversible schema + all shared-file edits** and folds
  restore-before-paint into the *existing* `openAndMigrate` ready gate (`App.tsx:147-161`), so the
  first non-splash frame carries the saved palette (both reviewers).
- **Accent/background stored as id / slot-id (never a hex), resolved at render** — a good durable-
  data boundary matching the verified `self_sun_colour` precedent (nullable TEXT, validated on
  write, NULL passed through, resolved to a palette hex at render) (both reviewers).
- **Reduced-motion hook uses the `AccessibilityInfo` subscription bridge** as a Reanimated
  `SharedValue<boolean>` (live), explicitly *not* Reanimated's boot-only `useReducedMotion()`, and
  writes `.value` with no per-frame setState — satisfies D-07 (both reviewers).
- **Status glyphs extend the single `ringVisual` source rather than forking** (`contact-card-ring.ts:44-61`),
  and the ad-hoc `TAB_GLYPHS` fork (`RootNavigator.tsx:42-47`) is retired through the registry
  (both reviewers).
- **Backgrounds/fonts are local `require()` / bundled assets — no network on any read path**
  (both reviewers); `resolveMode`'s live Follow-System path is correct (both reviewers).

### Agreed Concerns

1. **[HIGH — 23-01] Backup wire-shape change ships silently under format-3.** Both reviewers,
   verified. `export-manifest.ts:26,37` spreads `...portable` from `getPortableSettingsSnapshot`
   unconditionally into `manifest.appSettings`, so the moment Plan 01 adds the 7 theme fields to
   that snapshot, every export emits them while `BACKUP_FORMAT_VERSION` stays `3`
   (`src/backup/types.ts:14`). Consequences: a wire-shape change with no format bump and no
   `FORWARD_MIGRATIONS` entry (contrary to the backup-schema's own contract,
   `backup-schema.ts:14-19`); and a format-3 backup made by this build, restored on a pre-Phase-23
   build (also format 3, allowlist lacking the keys), is **hard-rejected** by `assertPortableSettings`
   ("appSettings contains a local-only or secret member", `backup-schema.ts:129-135`) rather than
   getting the friendly update-first message. Neither `export-manifest.ts` nor `restore-apply.ts`
   is in Plan 01's `files_modified`/`read_first`, and no existing test catches it. **This
   intersects a DECIDED sequencing item** — planning-notes:73-74 ("the new settings keys must
   exist before the format-4 plan serializes them") and CONTEXT D-03/D-09 place the format-4 bump
   in a later phase while requiring the allowlist entry now — so the *resolution* is an owner/planner
   escalation, not an autonomous fix. Codex rated this HIGH; Claude rated it MEDIUM (noting the
   broken direction is new-backup→old-app, i.e. an app downgrade) but agrees it must be settled
   before execution. (Severity divergence noted; carried as HIGH given the one-way-door phase.)

2. **[HIGH — 23-03] The per-combo AA gate is under-defined at the accent data model and can be
   forced to silently retune owner-approved colours.** Two complementary angles, both verified:
   - *Codex:* a single `{id, hex, onAccent}` accent tested as text/link on **every** dark **and**
     light background cannot pass 4.5:1 in all four combos — a foreground light enough on Galaxy
     Dark cannot also be dark enough on a near-white light surface (`theme-provider.tsx:33-39`
     exposes one `palette.accent` string). As written, the plan's own acceptance gate may be
     mathematically unsatisfiable → blocks execution or pressures weakening AA (a prohibited
     reversal). Fix direction: palette-specific accent tones (`AccentDefinition[package][mode]`) or
     distinct `accentFill`/`accentText`/`onAccent`.
   - *Claude:* the gate also runs over **existing owner-approved** galaxy-dark status/text hues
     (`theme-types.ts:78-108`, "owner-approved 2026-08-16"), but the only stated remedy ("drop the
     accent") cannot apply to required tokens — retuning an owner-approved hue is an owner visual
     decision. If the gate hard-fails on a legacy token, the "fix" is a silent visual reversal. Fix
     direction: hard-fail for curated accents; **flag-for-owner (stop-and-ask)** for any required
     status/text/surface token that misses AA in the legacy palette.

### Divergent Views

- **How much screen "adoption" Phase 23 owes (the central divergence).** **Codex** rated four
  plans HIGH on the same theme — a primitive is created but not wired into existing consumers, so
  the user-observable requirement is "only scaffolding": `AppText` (THEME-07) with raw `<Text>`
  still on screens (`UnboundContactsScreen.tsx:128`), `StatusGlyph` (THEME-08) unconsumed by
  ContactCard/profile/Orrery, `BackgroundHost` (THEME-04) not mounted at any root, and the button/
  ConfirmDialog primitives (THEME-10) not adopted by existing destructive flows. **Claude**, having
  read the dossier and planning-notes, treats this as **by-design deferral, not a defect**: the
  phase CONTEXT domain says it "establishes reusable visual primitives rather than redesigning
  individual screens," and planning-notes:78-81 assigns the Appearance/settings UI (and thus
  adoption of these primitives) to **Phase 15** ("Phase 2 builds the engine and the persisted
  state; Phase 15 builds the settings UI"). **Orchestrator resolution:** the deferral is a recorded
  scope boundary, so this is **not a HIGH blocker** — but the plans should make the deferral and
  the success-criteria *verification scope* explicit (see Actionable MEDIUM below), because several
  ROADMAP success criteria are worded as user-observable outcomes that cannot be demonstrated this
  phase without either adoption or a debug harness. Recorded as an actionable scoping item rather
  than adopted as codex's four HIGHs.
- **Backup severity:** HIGH (Codex) vs MEDIUM (Claude) — same finding, see Agreed Concern 1.

---

## Codex Review

# Phase 23 Plan Review

Overall, the plan decomposition is strong: Plan 01 correctly front-loads the irreversible schema/boot seam, and later plans generally isolate pure data, primitives, and renderer changes. However, several plans currently create primitives without integrating them into existing consumers, and two requirements are not achievable as written without changing their data model or sequencing.

## 23-01 — Persistence, package axis, restore-before-paint

**Summary:** Good tracer and correct migration target: the repository is currently at schema version 14 with migration 014 last, so 015 is valid (`src/db/database.ts:38-67`, `src/db/migrations/014-interaction-assists.ts:4-27`). The DAO and boot gate are the right seams.

**Strengths**
- The planned migration follows the repository's atomic per-version migration runner, which wraps DDL and `PRAGMA user_version` in a single transaction (`src/db/migrations/runner.ts:47-67`).
- It correctly recognizes that durable settings require changes in both the DAO projection and the backup allowlist. The existing portable snapshot is an explicit select/projection, not a generic serialization (`src/db/app-settings-dao.ts:387-457`).
- Folding hydration into `AppShell`'s existing `ready` gate is the appropriate way to prevent the current asynchronous Zustand/AsyncStorage rehydration flash (`src/stores/theme-store.ts:25-48`, `App.tsx:144-161`).

**Concerns**
- **HIGH — backup wire-shape sequencing is unsafe.** Adding the seven fields to `PORTABLE_SETTINGS_KEYS` now means the v3 exporter will emit them, but `BACKUP_FORMAT_VERSION` remains 3 (`src/backup/types.ts:13-15`). A prior v3 build will accept the format version and then reject the new keys because its allowlist is closed (`src/backup/backup-schema.ts:106-135`). This conflicts with the milestone decision that the backup format-4 bump belongs to Phase 36.
- **HIGH — the legacy import order is underspecified and can hydrate stale values.** The plan says to read settings, import `orbit-theme`, hydrate, and clear. If hydration uses the first read rather than a post-import read or the exact validated patch, the provider will render old defaults until another state update. The current `ready` effect only calls `openAndMigrate()` then `setReady(true)` (`App.tsx:147-157`).
- **MEDIUM — one-time import is not transactionally specified.** The DB update must complete before `AsyncStorage.removeItem`; otherwise clearing first loses the legacy selection. If removal fails after a successful update, a repeated import should be harmless and must not repeatedly bump `modified_at`/`data_revision`.
- **LOW — the plan says "all colour literals" stay in `theme-presets.ts`, but Plan 03 intentionally puts accent literals in `accents.ts`; this should be corrected to "under `src/theme/`."**

**Suggestions**
- Keep the columns and DAO fields in Plan 01, but do not add them to the exported portable wire projection/allowlist until Phase 36's atomic format-4 migration. Alternatively, move the backup format bump into this plan; do not ship a changed v3 wire shape.
- Specify the boot transaction precisely: migrate → read legacy blob → validate/map → `updateAppSettings` → clear blob only after successful DB commit → read settings again (or hydrate from the committed patch) → hydrate store → set ready.
- Add tests for clear failure, write failure, and repeated legacy blobs.

**Risk Assessment:** **HIGH** until backup-version sequencing and import ordering are fixed.

## 23-02 — Fonts, tokens, AppText

**Summary:** The token definitions are appropriately scoped and pure, but a new `AppText` component alone does not satisfy app-wide text scaling because existing screens continue to render raw `<Text>` with truncation.

**Strengths**
- The planned token values and semantic role split are sensible, and pure `src/theme/tokens/*` modules match the project's node-testable pattern.
- Separating React Native font loading from Skia font loading is correct. Skia currently loads only Inter through its own provider (`src/screens/OrreryScreen.tsx:176`).

**Concerns**
- **HIGH — THEME-07 is not achieved without adoption.** No existing screens/components are modified, yet many current text surfaces use raw `<Text>` and clamps, such as `src/screens/UnboundContactsScreen.tsx:128-134`. `AppText` cannot change their accessibility behavior unless they are migrated or a targeted adoption plan is explicitly deferred.
- **MEDIUM — the failure behavior conflicts with the plan's threat model.** Awaiting a font load in the same boot promise means a rejected load reaches AppShell's catch and blocks the app in its startup error state (`App.tsx:147-157`). The stated "degrade to system font rather than crashing boot" requires catching font-load failures separately.
- **MEDIUM — "confirm no postinstall scripts ran" is false for this repository.** `package.json` declares `"postinstall": "patch-package"` (`package.json:54-70`); package installation may run it.
- **LOW — provenance/license recording has no declared output file.** Binary assets alone do not provide an in-project license record.

**Suggestions**
- Add a defined adoption boundary: migrate all shared primitives and high-traffic screens this phase, or create a tracked follow-up plan that enumerates each raw/clamped text surface.
- Treat font failures as nonfatal: log, continue with system fonts, and still hydrate theme/database.
- Add an `assets/fonts/README` or equivalent license/provenance file, and revise the postinstall assertion to verify the known root script rather than claiming none ran.

**Risk Assessment:** **MEDIUM-HIGH** because the central accessibility requirement is otherwise only scaffolding.

## 23-03 — Four palettes, accents, contrast

**Summary:** The pure contrast module and making light palettes required are good. The planned contrast gate, however, is mathematically incompatible with a single accent hex being AA-normal text on both light and dark backgrounds.

**Strengths**
- `resolveMode` already supports live Follow System correctly through `useColorScheme`, including its intentional non-light → dark fallback (`src/theme/theme-presets.ts:114-123`).
- The existing palette shape already carries status, star, and surface tokens, so extending all four complete palettes is the right approach (`src/theme/theme-types.ts:28-157`).
- Accent IDs in SQLite rather than hex values are a good durable-data boundary.

**Concerns**
- **HIGH — a single `{ id, hex, onAccent }` accent cannot meet the proposed AA test.** The plan requires every accent to pass as text/link on every dark and light background. A foreground light enough for 4.5:1 on Galaxy dark cannot also be dark enough for 4.5:1 on a near-white light surface. The provider currently exposes one `palette.accent` string (`src/theme/theme-provider.tsx:33-39`). This will either make the required gate impossible or pressure the team to weaken AA.
- **MEDIUM — the test must validate actual compositing pairs.** "Status/text on surface" is insufficient if components draw status over `background`, `surfaceElevated`, translucent glass, or image-backed surfaces. Current theme tokens include only opaque strings, while Plan 06 introduces translucent surfaces.
- **LOW — "theme-presets.ts is the sole hex-literal file" contradicts the intended `accents.ts`; the repository's actual enforcement allows any `/theme/` path (`scripts/check-colors.sh:37-47`).**

**Suggestions**
- Store an accent ID but resolve it to a palette-specific tone, e.g. `AccentDefinition[package][resolvedMode]`, or distinguish `accentFill`, `accentText`, and `onAccent`.
- Define the exact tested foreground/background pairs from actual component usage, including translucent surface composition; do not call a palette-only check a complete accessibility gate.
- Add an explicit test proving unknown stored IDs fall back safely.

**Risk Assessment:** **HIGH** until the accent representation and AA contract are reconciled.

## 23-04 — Reduced motion

**Summary:** The intended `AccessibilityInfo` subscription plus `SharedValue` bridge is the correct architecture, but the plan's hook test and export coverage need tightening.

**Strengths**
- It correctly avoids Reanimated's boot-time-only hook and avoids React-state-driven Skia animation.
- The current Orrery already has the appropriate worklet seam: `useClock()` and `useDerivedValue()` in the canvas (`src/components/orrery/OrreryCanvas.tsx:93-101`).

**Concerns**
- **MEDIUM — the proposed hook tests have no stated React hook test harness.** The repository's dev dependencies include Vitest but no React test renderer/testing-library package (`package.json:44-52`). A normal node Vitest test cannot mount/unmount these hooks and assert subscription cleanup.
- **LOW — the plan says the hooks are exported from `src/theme/index.ts`, but omits that file from `files_modified`; the current barrel only exports presets, provider, and types (`src/theme/index.ts:7-10`).**

**Suggestions**
- Either add a supported hook-rendering test dependency or extract/test a non-React subscription controller and keep one device-level hook assertion.
- Include the theme barrel in the plan or have consumers import the direct module deliberately.

**Risk Assessment:** **MEDIUM**.

## 23-05 — Icon registry and status glyphs

**Summary:** Centralizing the tab icons is good, but the plan currently builds an unused status-glyph primitive and has type/registry gaps.

**Strengths**
- Replacing `TAB_GLYPHS` is a real high-visibility consolidation: the current tab bar directly renders raw Unicode glyphs (`src/navigation/RootNavigator.tsx:42-47`, `src/navigation/RootNavigator.tsx:159-169`).
- Extending `ringVisual` is the correct source-of-truth location: it already maps status to theme token, opacity, and weight without hardcoded colors (`src/components/contact-card-ring.ts:44-60`).

**Concerns**
- **HIGH — THEME-08 is not delivered if `StatusGlyph` is never consumed.** Plan files do not include ContactCard, profile, Orrery, or widget consumers. Current rendering remains color plus ring weight; adding an unused mapping does not make relationship state readable without color.
- **HIGH — `snoozed` is not part of the planned function's declared input type.** `ringVisual` takes `ProfileStatus | null`, and `ProfileStatus` is only stable/wobble/decay/rogue (`src/db/contact-status-read.ts:19-20`). Snooze is currently a separate UI/filter condition, not a query-time status (`src/db/dashboard-read.ts:63-90`). The plan needs a separate display-state union or explicit `snoozed` input.
- **MEDIUM — registry completeness is not specified.** StatusGlyph needs six semantic glyph names, while Plan 07 also needs a warning glyph. Plan 05's registry action does not explicitly add either set, so typed lookup can fail or invite bypasses.

**Suggestions**
- Modify at least the current ContactCard and profile status presentation in this plan. Define exactly how Orrery and the headless widget consume equivalent glyph semantics; do not claim widget integration while prohibiting widget changes.
- Introduce a `StatusDisplayState` union that combines computed relationship status with independent snooze/never-contacted state.
- Explicitly reserve and test all registry names required by `StatusGlyph` and `Button`.

**Risk Assessment:** **HIGH** due to missing adoption and the snoozed type mismatch.

## 23-06 — Backgrounds, surfaces, Orrery

**Summary:** The fixed-background and fallback designs are directionally sound, but the app-wide requirement and reduced-motion coverage are incomplete in the listed file set.

**Strengths**
- The plan properly keeps backgrounds local and uses static bundled assets rather than a network path.
- It preserves the existing token boundary in Orrery: current canvas colors are supplied as props from theme values rather than literals (`src/components/orrery/OrreryCanvas.tsx:85-101`, `src/screens/OrreryScreen.tsx:650-690`).

**Concerns**
- **HIGH — `BackgroundHost` is not integrated anywhere.** No root navigator, AppShell, or screen file is modified. The current navigator mounts tab stacks directly (`src/navigation/RootNavigator.tsx:154-205`), so merely creating the host cannot provide app-wide fixed backgrounds behind text-heavy screens.
- **HIGH — changing only `OrreryCanvas` cannot stop all Orrery ambient motion.** `SunBody` independently derives a glow pulse directly from the shared clock (`src/components/orrery/SunBody.tsx:82-100`). It is not in the plan's files, so reduced motion would stop star twinkle while the sun continues pulsing.
- **MEDIUM — "Galaxy animated background" is asserted but no animation implementation or consumer contract is defined.** BackgroundHost's listed work does not establish a Reanimated/Skia animation path to consume the shared value.
- **MEDIUM — asset-failure fallback requires a real observable failure path.** Static Metro `require()` failures usually fail during bundle resolution, not as a recoverable component error. The plan needs to define what runtime failure can be caught and tested.

**Suggestions**
- Wire `BackgroundHost` at a defined app-shell/root-screen boundary and state how per-screen density is passed.
- Include `SunBody` and any other clock consumers in the reduced-motion audit; preferably provide reduced-motion through an Orrery context so every worklet uses the same value.
- Make background assets static and bundle-time validated; use runtime fallback only for image rendering failure, not unavailable modules.

**Risk Assessment:** **HIGH**.

## 23-07 — Buttons and overlay primitives

**Summary:** The primitive API is useful and aligns with the central icon/theme seams, but it needs concrete lifecycle/API definitions and adoption expectations.

**Strengths**
- The existing theme has `accent`, `danger`, background/surface, and text tokens available for semantic variants (`src/theme/theme-types.ts:28-46`).
- Requiring an accessible label and 44px target for icon-only controls is a solid contract.

**Concerns**
- **MEDIUM — the primitives are not adopted by existing destructive actions or modals.** No existing screen is modified, so destructive flows continue to use their current presentation. A new `ConfirmDialog` does not retroactively make actions distinct beyond color.
- **MEDIUM — Android modal lifecycle is underspecified.** The shared modal API needs `visible`, `onRequestClose`, focus handling, and a clear back/scrim-dismiss policy. Without these, a reusable modal can trap Android Back or accidentally dismiss destructive confirmation.
- **LOW — the plan depends on a registry warning glyph not explicitly guaranteed by Plan 05.**

**Suggestions**
- Add at least one existing destructive flow as a vertical-slice consumer and enumerate the later migrations for remaining flows.
- Define modal/sheet props and dismissal semantics, especially whether destructive confirmation permits scrim/back dismissal.
- Add component-level accessibility tests or a device test that verifies focus and Back behavior.

**Risk Assessment:** **MEDIUM**.

## Cross-plan recommendation

Do not begin execution unchanged. Resolve these four items first:
1. Keep backup format changes atomic with the format-4 bump.
2. Make palette-specific accent tones compatible with the AA requirement.
3. Add real consumer adoption for `AppText`, `StatusGlyph`, `BackgroundHost`, and destructive primitives.
4. Audit every Orrery clock consumer, not just `OrreryCanvas`, for reduced-motion gating.

---

## Claude Review

# Phase 23 (Theme & Visual System) — Cross-AI Peer Review (Claude)

**Method:** Every claim below was checked against the actual source on disk (migrations, DAOs, theme layer, backup layer, boot, dossier, HANDOFF, ADRs), not against plan text in isolation. Shared-table/shared-surface consumers were read beyond the changed-files list per the "review the code, not the diff" rule.

**Headline:** No decision reversals. No local-first / network violations. No hardcoded-colour or animation-from-React-state violations in the plans. The migration number, storage model, and restore-before-paint integration are all correct against disk. The one finding that a diff-scoped review would miss is a **backup wire-shape change** (Plan 01 → `export-manifest.ts`) that is not called out in any plan and that the plans' own tests will not catch — rated MEDIUM. Overall phase risk: **MEDIUM**.

### Cross-Cutting Verification (facts established once)

- **Migration number is correct.** `src/db/database.ts:49` `TARGET_VERSION = 14`; latest registered migration is `migration014`. head+1 = **015**. ✔
- **Additive ALTER idiom is real.** `014-interaction-assists.ts:25-26` is an `ALTER TABLE app_settings ADD COLUMN ... NOT NULL DEFAULT`. ✔
- **`self_sun_colour` precedent is real and matches the accent/background design.** Nullable TEXT, validated on write (`app-settings-dao.ts:494`, `:512`), NULL passed straight through in `getAppSettings` (`:348-349`), resolved at render. ✔
- **check:colors scans migrations and exempts only `/theme/`.** `scripts/check-colors.sh` recurses `src`, filters `grep -vE '^[^:]*/theme/'`. A hex default in migration 015 would trip the gate; the WR-01 substring hazard (ADR-006) is already hardened (path-anchored). ✔
- **D-04 is ENFORCED, not reversed.** HANDOFF §7 carries the 2026-09-01 supersession note (`HANDOFF.md:175`); ADR-048 lists tap-to-freeze as a rejected alternative. Plan 06 correctly enforces both. No HIGH escalation. ✔
- **No network on any read path.** Fonts and backgrounds are local `require()`/bundled assets. ✔
- **Theme-store blast radius is small.** The only non-test consumer of `useThemeStore` is `theme-provider.tsx` (both in Plan 01's file list). ✔

### 23-01 — Migration 015 + DAO/backup plumbing + package-axis tracer

**Summary.** The most consequential plan and correctly treated as such. The technical spine is sound and every load-bearing file:line it cites is accurate. Its one real gap is a shared consumer it doesn't name (`export-manifest.ts`), which turns an intended "allowlist now, serialize later" edit into an immediate wire-shape change.

**Strengths**
- Restore-before-paint folded into the *existing* gate correctly (`App.tsx:147-161`); `AppShell` already calls `useTheme()` (`App.tsx:130`) for the pre-ready splash.
- DAO contract citations are exact: `COLUMN_OF` (`:278-300`), validators + `*_FIELDS` + patch loop (`:479-596`), `getAppSettings` NULL passthrough (`:316-349`), `PortableSettingsSnapshot` (`:134-158`).
- `orbit-theme` treated as untrusted (validate against enums, unknown → seeded defaults, `space-dark`→`galaxy`, absent → no-op) — correct given `theme-store.ts:34` persists exactly `{mode, presetId}` under key `orbit-theme`.
- Additive/forward-only/re-runnable framing correct; migrations 001-014 untouched; v0→v15 lands fully seeded.

**Concerns**
- **[MEDIUM] Adding theme keys to `getPortableSettingsSnapshot` silently serializes them into a format-3 backup — before the deferred format bump — and the plan never names the export/restore consumers.** `src/backup/export-manifest.ts:63,74` destructures the snapshot and spreads `...portable` **unconditionally** into `manifest.appSettings`; `restore-apply.ts:249` also consumes the snapshot. So the moment Plan 01 adds the 7 theme fields, every export emits them while `BACKUP_FORMAT_VERSION` is still `3` (`src/backup/types.ts:14`). Consequences: (a) a wire-shape change with no format bump and no forward-migration entry — contrary to the backup-schema's own contract (`backup-schema.ts:15-19`); (b) a format-3 backup made by this build, restored on a pre-Phase-23 build, is hard-rejected by `assertPortableSettings` (`backup-schema.ts:129-135`) — the older app never reaches the friendly update-first message because that gate only trips on a *higher* format number; (c) it contradicts planning-notes:73-74. Neither `export-manifest.ts` nor `restore-apply.ts` is in Plan 01's file lists, and no existing test catches this.
  - *Mechanism of the fix:* land columns + DAO validators + `COLUMN_OF` + the `PORTABLE_SETTINGS_KEYS` allowlist entry **now** (so a future backup that carries the keys is accepted and restore-reconciled), but **defer adding the theme fields to the emitted `getPortableSettingsSnapshot` object (and thus to the export)** until the format-4 bump owns them. Bumping the format early instead is a milestone-sequencing decision — **stop-and-ask**.
- **[MEDIUM] Unlisted ADR-042 consumer: `src/services/widget/widget-colors.ts`.** It imports `DEFAULT_PRESET_ID` + `resolvePalette` and calls `resolvePalette(DEFAULT_PRESET_ID, "dark")` (`widget-colors.ts:18,32`); its test asserts "resolves the space-dark dark palette" (`widget-colors.test.ts:47`). Re-keying `space-dark`→`galaxy` is value-safe by design and backstopped by tsc + that test — but the plan never names the file. The widget is a headless renderer tied to ADR-042's shared-palette contract and cannot be device-verified, so Plan 01 should explicitly confirm `widget-colors.ts` still compiles and its test passes after the re-key.

**Suggestions**
- Add `src/backup/export-manifest.ts` and `src/backup/restore-apply.ts` to `read_first`; state explicitly whether theme keys are emitted now or deferred, and add a test asserting a format-3 export does **not** contain theme keys (if deferring).
- Add `widget-colors.ts` + its test to the tracer's acceptance.

**Risk:** MEDIUM.

### 23-02 — Fonts, typography/spacing/radii tokens, AppText

**Summary.** Clean, low-risk foundation plan. Deps are first-party Expo via `npx expo install`; fonts bundled locally; tokens are pure node-testable data with colour *token names* only; AppText preserves OS text reflow.

**Strengths**
- No `allowFontScaling={false}` / no fixed heights on reflowable text (THEME-07) stated as a prohibition and an acceptance grep.
- Token files RN-free and colour-literal-free under `src/theme/tokens/**`.
- Correctly keeps these RN fonts out of the Skia `useFonts` map (Pitfall 5).

**Concerns**
- **[LOW] Font-load failure path is asserted only by device UAT.** The threat register (T-23-05) says a failed font degrades to system font, but there is no automated check that a missing/failed font in the ready gate is non-fatal. Given it's inside the boot gate, a small unit assertion (or an explicit try/degrade in `fonts.ts`) would be cheap insurance.

**Suggestions**
- Have `fonts.ts`'s load helper swallow/log a load failure and resolve, so the ready gate can never hang on a font error; assert it.

**Risk:** LOW.

### 23-03 — Four palettes, curated accents, WCAG contrast gate

**Summary.** Sound structure: a pure WCAG module, `ThemePreset.light` made required, a curated accent set separate from `starPalette`, and a per-combo AA gate. The one substantive issue is that the AA gate is described as also covering **existing owner-approved status/text tokens**, whose only stated remedy on failure ("drop the accent") does not apply to required tokens.

**Strengths**
- Accent stored as id, resolved to hex at render in the provider overlay — never a hex in the DAO/migration. Keeps accent distinct from `starPalette` (dossier §C).
- `contrast.ts` is pure/RN-free with symmetry, identity=1.0-fails, malformed-input rejection.
- Correctly makes `light` required so `resolvePalette(package,'light')` stops falling back to dark (`theme-presets.ts:137`).

**Concerns**
- **[MEDIUM] The AA gate runs over owner-approved status/text hues, but the plan's only failure remedy fits accents.** Galaxy Dark == the former `space-dark` palette, whose `statusStable/statusWobble/statusDecay/rogue` and `textPrimary/textSecondary` are owner-approved seeds (`theme-types.ts:78-108`, "owner-approved 2026-08-16"; `theme-presets.ts:62-64`). If an owner-approved status/text token fails AA in a combo, you cannot "drop" it — it's required — and retuning an owner-approved hue is a visual/taste decision (owner bucket). The plan does not say whether the status/text portion of the gate is hard-fail or advisory.
  - *Mechanism:* if the gate is hard-fail and a legacy status token misses AA, the build fails and the "fix" silently edits an owner-approved colour — a quiet visual reversal.

**Suggestions**
- Split the gate: **hard-fail for curated accents** (drop on miss) and **flag-for-owner** for any *required* status/text/surface token that misses AA in the legacy galaxy-dark palette. Do not auto-retune an owner-approved hue.
- State explicitly that new palettes may be tuned to pass AA (agent discretion) while galaxy-dark legacy tokens may not without owner sign-off.

**Risk:** MEDIUM.

### 23-04 — Reduced-motion hook + motion tokens

**Summary.** The highest-risk *integration* per the dossier (D-05/D-07), and the plan gets the hard part right: `AccessibilityInfo` subscription bridge (live) as a Reanimated `SharedValue<boolean>` readable from worklets, plus a React boolean twin — explicitly **not** Reanimated's boot-only `useReducedMotion()`.

**Strengths**
- Correct API choice and the correct rejection of `react-native-reanimated`'s `useReducedMotion` (names Pitfall 1).
- The SharedValue path writes `.value` (no setState) → satisfies D-07; the boolean twin's setState is confined to React-tree consumers.
- Subscription lifecycle (seed once, subscribe once, unmount cleanup, guarded post-unmount seed) is an explicit tested invariant.

**Concerns**
- **[LOW] Motion tokens' "ambient" value is under-specified for its consumer.** Plan 06 gates ambient Orrery/background motion on the SharedValue; ensure the token shape `motion.ts` exports is what Plan 06 multiplies into the `useDerivedValue` worklet (e.g. a speed constant, not a duration) so the two plans don't mismatch at the seam.

**Suggestions**
- Name the exact `ambient` token shape the Orrery worklet consumes and reference it from Plan 06's read_first.

**Risk:** LOW.

### 23-05 — Icon registry + status glyphs

**Summary.** Delivers the two D-05 seams as first-class, extending single sources rather than forking.

**Strengths**
- Extends the single status source: `ringVisual` at `contact-card-ring.ts:44-61` is real and the plan adds `statusGlyph()` beside it (not a second source), matching ADR-042's one-source contract. `null → neutral` mirrors `ringVisual`'s default branch.
- `TAB_GLYPHS` fork is real (`RootNavigator.tsx:42-47`) and correctly retired through the registry.
- Respects the widget boundary: explicitly does **not** wire icons/glyphs into `widget-colors.ts` (headless, no theme provider).
- `IconName` as a `keyof` union so an unregistered name fails `tsc`; colour via `useTheme()`, size via `ICON_SIZE`, no literals.

**Concerns**
- **[LOW] Registry must cover the four tab identities, not just the enumerated generic set.** The tab bar needs semantic names for Dashboard/Orrery/Backup/Settings (`TabParamList`). Ensure `ICON_REGISTRY` includes those four; the acceptance test "every registry name resolves outline+filled" won't catch a *missing* tab name. Add an assertion that every `TabParamList` key maps to a registered icon.

**Suggestions**
- Add a test that each of the four tab routes resolves a registered `<Icon>` name, so retiring `TAB_GLYPHS` can't leave a tab glyph-less.

**Risk:** LOW.

*(Orchestrator note: Codex additionally rated 23-05 HIGH on two points — `StatusGlyph` not consumed by any renderer, and `snoozed` not being part of `ProfileStatus`. The orchestrator verified `ProfileStatus = "stable"|"wobble"|"decay"|"rogue"` (`contact-status-read.ts:19`) has no `snoozed` member — codex's type finding is valid and is carried as an actionable MEDIUM. The "not consumed" point is the adoption divergence — see Divergent Views.)*

### 23-06 — Backgrounds, surface/glass, Orrery reduced-motion gating

**Summary.** Implements D-04 (app-wide fixed backgrounds + None/Solid + opacity-by-density), THEME-05 (per-package glass/flat with graceful blur fallback), and THEME-12 (Orrery follows the package, tokenized, honors live reduced motion). The decision framing *enforces* D-04/ADR-048 rather than reversing them.

**Strengths**
- Correctly identifies the real gating site: `OrreryCanvas.tsx:93-101` is the `useClock` + `useDerivedValue` twinkle/drift loop; gating it by reading the SharedValue *inside* the worklet satisfies D-06/D-07. Pause-on-blur unmount behavior left intact.
- Backgrounds local `require()` only, asset-fail → None/Solid, blur → semi-opaque tinted token — all no-network, all token-resolved.
- `resolveBackground(package, slotId|null)` mirrors the NULL-resolve-at-render idiom, consistent with `assertBackgroundId` from Plan 01.

**Concerns**
- **[LOW] "Glass-forward vs flatter" blur/opacity/glow values are agent-discretion but visually load-bearing.** The plan flags this "for verify," within Claude's discretion per CONTEXT. Ensure the device-UAT compares Galaxy(glass) vs Standard(flat) on the Pixel (the emulator can't assess Skia/blur cost).
- **[LOW] Task 3 runs the full `npm test` inside a single task's verify.** Harmless but heavy; the wave-merge verification already runs `npm test`.

**Suggestions**
- Confirm `motion.ts`'s ambient token is consumed by the worklet as intended.
- Record background-asset provenance/license in-project as the plan states.

**Risk:** LOW-MEDIUM (Skia perf claims are device-only; the logic is sound).

*(Orchestrator note: Codex rated 23-06 HIGH on two points Claude did not raise — `BackgroundHost` not mounted at any root (the adoption divergence), and `SunBody.tsx:82-100` independently deriving a glow pulse from the ambient clock via `useOrreryClock()`, which Plan 06 does not touch. The orchestrator verified SunBody is a genuine second clock consumer, so gating only `OrreryCanvas` leaves the sun pulsing under reduced motion — codex's finding is valid and is carried as an actionable MEDIUM: Plan 06 must include `SunBody.tsx` and audit all clock consumers.)*

### 23-07 — Button hierarchy + Modal/Sheet/ConfirmDialog

**Summary.** Reusable action/overlay primitives: five-role Button with destructive-beyond-colour, and compact/detail/full/confirm overlays sharing radius/scrim/safe-area. Token-driven, a11y-aware (44×44, required labels).

**Strengths**
- Destructive-beyond-colour is enforced by construction (danger token + warning glyph via registry + explicit ConfirmDialog naming the action).
- Scrim resolved from `colors.background` at opacity, never a hex; icon-only requires `accessibilityLabel` and 44×44.
- Correctly uses the icon registry for the warning glyph rather than a third-party icon name (D-05).

**Concerns**
- **[LOW] "Exactly one Primary per surface" is a convention, not enforced.** The plan flags this (backstop) and expresses it via the `role` prop — noting it only so it isn't later mistaken for a runtime guarantee.
- **[LOW] Modal/Sheet a11y (focus trap / back-button dismissal / scrim tap) isn't in the acceptance.** For release quality, add that Android system Back dismisses the overlay and the scrim is tappable-to-dismiss where appropriate.

**Suggestions**
- Add an acceptance line for back-button/scrim dismissal on the overlay variants.

**Risk:** LOW.

### Phase-Level Assessment (Claude)

**Overall risk: MEDIUM.** The architecture is well-sequenced, the decision citations are accurate and *enforce* rather than reverse recorded decisions (D-04/ADR-048/HANDOFF §7 verified), and the guardrails are respected throughout. What keeps it at MEDIUM: (1) the silent backup wire-shape change on a one-way-door phase; and (2) an AA gate that can be forced to silently retune owner-approved colours.

**Scope note (not a defect):** No appearance-picker UI ships in Phase 23 — correctly deferred to Phase 15 per planning-notes:78-81. Consequence: the 23-VALIDATION device-UATs that say "cycle Galaxy/Standard × Light/Dark" and "preview immediately / restore on switch" (THEME-01/02/03/04) can only be exercised this phase via DAO writes + cold-start, not through the real UI. Recommend either a throwaway debug toggle for the device pass or explicitly marking those combo/preview UATs as Phase-15 gates.

**HIGH-severity concerns (Claude):** None — no plan deletes, weakens, or inverts a `[DECIDED]`/`[REJECTED]` HANDOFF item or an Accepted ADR.
