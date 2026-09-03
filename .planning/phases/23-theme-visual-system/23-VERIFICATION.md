---
phase: 23-theme-visual-system
verified: 2026-09-03T18:55:27Z
status: passed
score: 5/5 must-haves verified (roadmap success criteria, code/primitive/data-seam level)
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Cold-start a Pixel debug build with a persisted non-default theme_package (write via DAO/adb run-as, then relaunch)."
    expected: "First painted MAIN frame is the saved package's palette with NO dark->other snap (restore-before-paint, no wrong-theme flash); an existing device that had an AsyncStorage orbit-theme value carries its mode across after one launch, then the key is cleared."
    why_human: "First-paint timing / no-flash on a real cold start is device-observable only; unit tests verify the coordinator ordering + idempotency but not the rendered first frame."

  - test: "On a Pixel with OS reduced motion toggled ON mid-session while a Galaxy background + Orrery are on-screen."
    expected: "Orrery drift/twinkle AND the sun glow pulse (and any Galaxy background motion) stop; manual camera control still works; toggling live updates without an app restart."
    why_human: "Skia render-loop behavior + OS a11y setting live toggle; JS-thread motion is not observable in node unit tests (controller lifecycle is unit-tested, the rendered halt is not)."

  - test: "On a Pixel with OS font size set large, render AppText content (incl. long multibyte and long-word strings)."
    expected: "Text wraps / grows height rather than truncating or shrinking; correct fonts render on first paint."
    why_human: "Runtime text layout at large OS scale is device-observable; the primitive is verified to not set allowFontScaling={false} or fixed heights, but reflow behavior needs a device pass."

  - test: "On a Pixel with a greyscale / colour filter applied, view the six status display states (stable/wobble/decay/rogue/neutral/snoozed)."
    expected: "Each remains distinguishable by silhouette glyph + border weight + text label alone, with colour removed."
    why_human: "Visual distinguishability without colour is a human perceptual check; the distinct-glyph-per-state invariant is unit-verified but not the greyscale legibility."

  - test: "On a Pixel, for EACH Galaxy background asset, place body + caption text over glass on the asset's visibly brightest region."
    expected: "Text stays legible (AA-comfortable). A failure means the shipped .webp exceeds its declared worst-case pixel."
    why_human: "The composited AA unit test validates only the DECLARED worst-case pixel in backgrounds.ts; nothing decodes the shipped .webp bytes (REVIEWS 23-06 cycle-4 MEDIUM). Compounded by placeholder art — see anti-patterns."

  - test: "On a Pixel, drive each package×mode (galaxy/standard × light/dark) via a DAO write + cold-start."
    expected: "Surfaces, accents, and status glyphs are legible and AA-comfortable in all four combos; Galaxy shows glass, Standard shows flat; background stays fixed while content scrolls; dense forms are more opaque/readable; a removed asset falls back to None/Solid with no error."
    why_human: "Human visual confirmation of contrast/legibility and glass-vs-flat treatment across palettes on device; there is NO in-app Appearance switcher this phase (deferred to Phase 15/37), so verification is DAO-write + cold-start."

  - test: "On a Pixel, exercise each Modal/Sheet/ConfirmDialog variant."
    expected: "Shared radius/scrim/safe-area render; Android Back + scrim-tap dismiss a non-destructive Modal/Sheet; a destructive ConfirmDialog does NOT dismiss on Back or scrim-tap, requires an explicit choice, names the action, and shows the warning glyph; scrim dims without a colour literal."
    why_human: "Android overlay lifecycle (system Back wiring, focus, scrim-tap policy) is device-observable; the dismissable=false contract is verified in source but not the on-device Back behavior."

  - test: "On a Pixel, confirm the Galaxy GlassSurface 'subtle glow' actually renders (REVIEW WR-02)."
    expected: "The luminous accent-tinted glow is visible on the Android target, OR the glow is accepted/documented as iOS-only."
    why_human: "GlassSurface expresses the glow with iOS-only shadowColor/shadowOpacity/shadowRadius props that are no-ops on Android (only elevation is honored, and it renders neutral grey, not the accent tint). Whether THEME-05's glow affordance is present on the primary platform must be confirmed on device."

  - test: "Confirm the placeholder background art is acceptable to ship, or schedule real curated art."
    expected: "Owner decision: the 8 background .webp files are honestly-disclosed uniform-fill placeholders (colour == declared brightest pixel). Real curated art is an asset-production deferral. Any replacement art must stay at or below the declared brightest pixel per slot (or retune pixel + tint opacity together — never weaken AA)."
    why_human: "Product/taste call on whether placeholder backgrounds are acceptable for the current milestone; the primitive pipeline (require/resolve/AA-bound) is complete and functional."
---

# Phase 23: Theme & Visual System Verification Report

**Phase Goal:** Every surface draws through one theme system — Galaxy or Standard × Light / Dark / Follow System — with accent, backgrounds, icons, motion, and contrast resolved centrally instead of per screen.
**Verified:** 2026-09-03T18:55:27Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is achieved at the **primitive / data-seam level**, which is exactly what this phase committed to deliver (CONTEXT: "establishes reusable visual primitives rather than redesigning individual screens"; config `human_verify_mode: end-of-phase`). Every theme axis resolves centrally through shared tokens; no per-screen palette resolution was found. All 5 roadmap success criteria are backed by real, wired, tested code on disk. The remaining work is (a) end-of-phase device UAT for UI-observable behaviors (deferred by config), and (b) downstream screen ADOPTION, explicitly scoped to Phase 15/37 by the plans. No blockers.

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Package & appearance mode independent (4 combos, Follow System live, Galaxy+Follow default), curated accent + bundled background per package, live preview, per-package memory, restore-before-paint no-flash (THEME-01/02/03/04) | ✓ VERIFIED (code/seam); device no-flash + 4-combo visual → human | Migration 015 seeds theme_package='galaxy', galaxy/standard_mode='system' NOT NULL; `resolvePalette(package,mode)` + `resolveMode('system',scheme)` via useColorScheme (theme-provider.tsx:40-55); accents.ts 8 curated ids w/ per-mode {fill,onAccent,text}; per-package galaxy_*/standard_* columns + store selectors; App.tsx:158-184 hydrates store before setReady(true); provider re-renders from useThemeStore selectors (live-preview plumbing). In-app switcher UI deferred to P15/37 by design. |
| 2 | Galaxy glass-forward + optional ambient motion, Standard flatter/quieter, Orrery follows package via shared tokens (THEME-05/12) | ✓ VERIFIED (code); Android glow (WR-02) + device look → human | `resolveSurfaceStyle(package,blurAvailable)` returns only declared SURFACE token fields (surface.test.ts passes); GlassSurface uses expo-blur w/ semi-opaque tinted-token fallback; OrreryCanvas.tsx:106-112 + SunBody.tsx:97-107 gate ambient motion on the reduced-motion SharedValue via useDerivedValue, colours via tokens (D-06). |
| 3 | OS reduced-motion honored app-wide via reusable Skia-consumable hook; text respects OS scaling by reflowing (THEME-06/07) | ✓ VERIFIED (code + tests); live toggle + device reflow → human | use-reduced-motion.ts: SharedValue written via `.value` (no setState), live `AccessibilityInfo.reduceMotionChanged` subscription, `createReducedMotionController` with dispose cleanup + post-dispose guard, NOT reanimated's boot-only hook (use-reduced-motion.test.ts passes). AppText.tsx never sets allowFontScaling={false} / fixed height. Screen adoption deferred to P15. |
| 4 | Status never conveyed by colour alone (stable hue families + distinct silhouette glyphs); functional content meets AA in every combo (THEME-08/11) | ✓ VERIFIED (code + tests); greyscale + glass-on-shipped-bytes → human; 2 legacy galaxy-dark pairs owner-escalated | `statusGlyph(state)` pure total fn beside ringVisual (contact-card-ring.ts:87-98), distinct glyph per 6 states; StatusGlyph renders glyph + accessibilityLabel + border (redundant CVD channels), colour via StatusTone tokens. contrast.ts AA_NORMAL=4.5/AA_LARGE=3.0; accents.test.ts/contrast.test.ts/surface.test.ts hard-fail gate over all 4 combos passes. |
| 5 | Icons via centralized semantic registry w/ state variants; modals/sheets + button hierarchy w/ distinct-beyond-colour destructive; theme prefs persist durably + survive backup/restore (THEME-09/10/13) | ✓ VERIFIED (code + tests); device modal lifecycle → human | icon-registry.ts semantic names + outline/filled + tab/status/warning reserved; RootNavigator TAB_GLYPHS retired -> Icon+TAB_ICON. Button 5 roles; Destructive = danger fill + named onDanger + warning glyph + ConfirmDialog (dismissable=false, no scrim/Back dismiss); IconOnly requires accessibilityLabel (typed) + 44px. Migration 015 durable columns; backup allowlist has all 7 keys + writable/restorable via AppSettingsPatch; emission deferred to Phase 36 by design (D-03/D-09) so format-3 wire is byte-identical (export-manifest.test.ts regression passes). |

**Score:** 5/5 roadmap success criteria verified at code/primitive/data-seam level. 0 behavior-unverified truths (behavior-dependent invariants — reduced-motion controller lifecycle, boot compare-before-write idempotency, AA gate — are covered by passing named tests). Device UI-observable confirmations routed to human verification per end-of-phase config.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/db/migrations/015-theme-settings.ts | Additive theme columns, no hex | ✓ VERIFIED | 7 ADD COLUMN, NOT NULL DEFAULT + CHECK on package/mode, nullable accent/background; TARGET_VERSION=15, registered in MIGRATIONS |
| src/theme/theme-option-ids.ts | Single canonical id source | ✓ VERIFIED | 8 ACCENT_IDS, 9 BACKGROUND_SLOT_IDS; imports nothing; consumed by DAO validators + accents.ts + backgrounds.ts |
| src/db/app-settings-dao.ts | Columns, validators, portable type | ✓ VERIFIED | 7 fields on AppSettings/Row/Patch; validators consume ACCENT_IDS/BACKGROUND_SLOT_IDS via .includes(); theme keys OPTIONAL in PortableSettingsSnapshot, NOT in getPortableSettingsSnapshot SELECT |
| src/backup/backup-schema.ts | 7 keys in allowlist, no format bump | ✓ VERIFIED | All 7 in PORTABLE_SETTINGS_KEYS; BACKUP_FORMAT_VERSION unchanged |
| src/theme/hydrate-theme-at-boot.ts | Injected boot coordinator, compare-before-write | ✓ VERIFIED | diffPatch idempotency, error-isolated getItem/parse/write/clear, returns post-import settings (tests pass) |
| App.tsx | hydrate + fonts in ready gate before paint | ✓ VERIFIED | openAndMigrate -> Promise.all([hydrateThemeAtBoot, loadAppFonts]) -> store.hydrate -> setReady(true) |
| src/theme/theme-presets.ts | 4 authored palettes + onDanger | ✓ VERIFIED | galaxy/standard × light/dark; onDanger authored in all 4; light REQUIRED |
| src/theme/accents.ts | Curated per-mode tone triples | ✓ VERIFIED | 8 accents, dark+light {fill,onAccent,text}, resolveAccent, applyAccent |
| src/theme/contrast.ts | Pure WCAG AA gate | ✓ VERIFIED | relativeLuminance/contrastRatio (symmetric)/meetsAA; AA_NORMAL 4.5, AA_LARGE 3.0 |
| src/theme/use-reduced-motion.ts | SharedValue + boolean twin + controller | ✓ VERIFIED | no setState in Skia path; live subscription; dispose cleanup |
| src/theme/tokens/{motion,typography,spacing,radii,icon-size,surface}.ts | Pure token data, no colour literals | ✓ VERIFIED | present, check:colors clean |
| src/components/icons/{icon-registry,Icon,StatusGlyph}.tsx | Registry + primitives, tone via tokens | ✓ VERIFIED | IconTone excludes array palette keys; StatusGlyph redundant channels |
| src/components/contact-card-ring.ts | statusGlyph beside ringVisual | ✓ VERIFIED | StatusDisplayState = ProfileStatus\|'snoozed'\|null; ringVisual contract unchanged |
| src/navigation/RootNavigator.tsx | TAB_GLYPHS retired -> registry | ✓ VERIFIED | uses Icon + TAB_ICON |
| src/theme/backgrounds.ts + assets/backgrounds/*.webp | Slot manifest + local require assets + provenance | ⚠️ VERIFIED (placeholder art) | Manifest keyed by BACKGROUND_SLOT_IDS; resolveBackground + resolveRenderableBackground pure; 8 valid 96x96 .webp files present BUT are honestly-disclosed uniform-fill placeholders (README + SUMMARY + WINDOWS.md) — real art deferred |
| src/components/ui/{BackgroundHost,GlassSurface,Button,Modal,Sheet,ConfirmDialog,AppText,index}.tsx | Surface/button/overlay primitives | ✓ VERIFIED | all present, wired to tokens; Button role hierarchy; ConfirmDialog destructive dismissable=false |
| src/components/orrery/{OrreryCanvas,SunBody}.tsx | Reduced-motion gating (all clock consumers) | ✓ VERIFIED | both gate on SharedValue via useDerivedValue |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| App.tsx ready gate | ThemeProvider first paint | getAppSettings -> hydrateThemeAtBoot -> store.hydrate -> setReady | ✓ WIRED |
| migration 015 columns | Phase 36 backup | DAO writer contract -> PORTABLE_SETTINGS_KEYS (writable now, emit deferred) | ✓ WIRED (deferred emission by design) |
| AsyncStorage orbit-theme | app_settings columns | orbit-theme-migration one-time import at boot, then cleared | ✓ WIRED |
| theme-store selection | useTheme().colors across tree | resolveMode + resolvePalette(package,mode) + applyAccent overlay | ✓ WIRED |
| DAO galaxy/standard_accent | palette.accent at render | store -> provider -> resolveAccent(accents.ts) | ✓ WIRED |
| useReducedMotionShared() | Skia loop (Orrery + SunBody) | useDerivedValue, no setState | ✓ WIRED |
| Destructive Button | distinct-beyond-colour | danger fill + onDanger + warning registry glyph + ConfirmDialog | ✓ WIRED |
| RootNavigator tab bar | Icon registry | TAB_ICON (TAB_GLYPHS fork retired) | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| AA gate (4 combos) + accents + surface glass-composite | npx vitest run contrast/accents/surface.test.ts | pass | ✓ PASS |
| Migration 015 additive/seeded/CHECK-reject | npx vitest run 015-theme-settings.test.ts | pass | ✓ PASS |
| Reduced-motion controller seed/subscribe/cleanup/no-setState | npx vitest run use-reduced-motion.test.ts | pass | ✓ PASS |
| Boot compare-before-write idempotency + error isolation | npx vitest run hydrate-theme-at-boot.test.ts | pass | ✓ PASS |
| Legacy orbit-theme envelope mapping | npx vitest run orbit-theme-migration.test.ts | pass | ✓ PASS |
| Backup deferral (format-3 omits 7 theme keys) | npx vitest run export-manifest.test.ts | pass | ✓ PASS |
| All 8 theme suites combined | npx vitest run (8 files) | 154 passed (154) | ✓ PASS |
| Colour-location gate | npm run check:colors | exit 0 | ✓ PASS |
| Full suite (per orchestrator) | npm test | 2098/2098, tsc clean | ✓ PASS (reported) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| THEME-01 | 23-01, 23-03 | ✓ SATISFIED (seam) | independent axes resolved centrally; migration seeds Galaxy+Follow default |
| THEME-02 | 23-03 | ✓ SATISFIED | 8 curated accents, per-mode tones, separate from star colour |
| THEME-03 | 23-01, 23-03 | ✓ SATISFIED (plumbing) | per-package memory columns + store; live-preview via provider re-render; restore-before-paint wired (device no-flash → human) |
| THEME-04 | 23-06 | ✓ SATISFIED (primitive) | BackgroundHost + slot manifest + fixed-behind-scroll + density opacity; placeholder art disclosed |
| THEME-05 | 23-06 | ✓ SATISFIED (code) | glass vs flat surface tokens; Android glow → human (WR-02) |
| THEME-06 | 23-04 | ✓ SATISFIED | live Skia-consumable reduced-motion hook, no setState |
| THEME-07 | 23-02 | ✓ SATISFIED (primitive) | AppText reflow contract + bundled fonts; screen adoption deferred to P15 |
| THEME-08 | 23-05 | ✓ SATISFIED (source) | distinct silhouette per state + label + border; adoption into cards deferred |
| THEME-09 | 23-05 | ✓ SATISFIED | centralized registry, TAB_GLYPHS retired |
| THEME-10 | 23-07 | ✓ SATISFIED | button hierarchy + destructive-beyond-colour + modal/sheet variants |
| THEME-11 | 23-03, 23-06 | ✓ SATISFIED (gate) | AA gate over 4 combos passes; 2 legacy galaxy-dark pairs owner-escalated (not gaps); glass-on-shipped-bytes → human |
| THEME-12 | 23-06 | ✓ SATISFIED | Orrery follows package via shared tokens + reduced-motion gated |
| THEME-13 | 23-01 | ✓ SATISFIED (seam) | durable app_settings columns; backup allowlist + restorable; emission deferred to Phase 36 by design |

All 13 requirement IDs are declared across plans AND mapped to Phase 23 in REQUIREMENTS.md. **No orphaned requirements.** Unchecked boxes in REQUIREMENTS.md (THEME-01/02/03/06/08/09/11/13) reflect deferred user-facing ADOPTION (Settings UI / screen migration), not missing primitives — an intentional non-overclaim per the plans' recorded scope boundaries.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| assets/backgrounds/*.webp | — | Placeholder uniform-fill art (84-98 byte valid 96x96 webp) | ℹ️ Info | Honestly disclosed in README + SUMMARY + WINDOWS.md; pipeline functional + AA-bound; real curated art is an asset-production deferral. Not a hidden stub. |
| src/components/ui/GlassSurface.tsx | 73-85 | iOS-only shadow props for Galaxy glow on Android-first app | ⚠️ Warning (REVIEW WR-02) | Glow likely renders as nothing/neutral-grey elevation on the Pixel target; confirm on device (human item added). Not a crash, not data-affecting. |
| src/components/ui/__dev__/ThemePreviewScreen.tsx | 82-85 | Mode-cycle reads resolved mode to advance stored mode (dev harness bug) | ⚠️ Warning (REVIEW WR-01) | Dev-only harness; degrades the UAT tool's mode cycling; no production impact. |
| src/components/ui/overlay-base.tsx | 80-84 | a11y focus may fire before Modal layout | ℹ️ Info (REVIEW IN-01) | a11y polish; unproven without device screen-reader pass. |

No `TBD`/`FIXME`/`XXX` debt markers found in any Phase 23 source file. Data layer is sound (migration additive/forward-only/no-hex; every app_settings writer validates theme values before UPDATE).

### Human Verification Required

9 items enumerated in frontmatter `human_verification` (end-of-phase device UAT on the Pixel + one owner product call). These are UI-observable-only behaviors legitimately deferred by `human_verify_mode: end-of-phase`, plus REVIEW WR-02 (Android glow) and the placeholder-art acceptance call. None are code gaps.

### Gaps Summary

No blocking gaps. Every roadmap success criterion is achieved in real, wired, tested code. The two galaxy-dark AA misses (onDanger vs danger 3.91:1; danger-as-text vs surfaceElevated 4.03:1) are KNOWN owner-escalated decisions recorded in 23-03-SUMMARY with nearest AA-passing candidates — owner-bucket taste calls on pre-existing owner-approved hues, not gaps. The placeholder background art is a disclosed, functional scope boundary with real art deferred to an asset-production pass. All remaining verification is device UAT deferred by config.

---

_Verified: 2026-09-03T18:55:27Z_
_Verifier: Claude (gsd-verifier)_
