---
phase: 23-theme-visual-system
reviewed: 2026-09-03T13:40:00Z
depth: standard
files_reviewed: 55
files_reviewed_list:
  - App.tsx
  - package.json
  - scripts/check-colors.sh
  - src/backup/backup-schema.ts
  - src/components/contact-card-ring.ts
  - src/components/icons/Icon.tsx
  - src/components/icons/StatusGlyph.tsx
  - src/components/icons/icon-registry.ts
  - src/components/orrery/OrreryCanvas.tsx
  - src/components/orrery/SunBody.tsx
  - src/components/ui/AppText.tsx
  - src/components/ui/BackgroundHost.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/ConfirmDialog.tsx
  - src/components/ui/GlassSurface.tsx
  - src/components/ui/Modal.tsx
  - src/components/ui/Sheet.tsx
  - src/components/ui/__dev__/ThemePreviewScreen.tsx
  - src/components/ui/button-roles.ts
  - src/components/ui/index.ts
  - src/components/ui/overlay-base.tsx
  - src/db/app-settings-dao.ts
  - src/db/database.ts
  - src/db/migrations/015-theme-settings.ts
  - src/navigation/RootNavigator.tsx
  - src/stores/theme-store.ts
  - src/theme/accents.ts
  - src/theme/backgrounds.ts
  - src/theme/contrast.ts
  - src/theme/fonts.ts
  - src/theme/hydrate-theme-at-boot.ts
  - src/theme/orbit-theme-migration.ts
  - src/theme/theme-option-ids.ts
  - src/theme/theme-presets.ts
  - src/theme/theme-provider.tsx
  - src/theme/theme-types.ts
  - src/theme/tokens/icon-size.ts
  - src/theme/tokens/motion.ts
  - src/theme/tokens/radii.ts
  - src/theme/tokens/spacing.ts
  - src/theme/tokens/surface.ts
  - src/theme/tokens/typography.ts
  - src/theme/use-reduced-motion.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-09-03T13:40:00Z
**Depth:** standard
**Files Reviewed:** 55 (source + test siblings read for cross-check)
**Status:** issues_found

## Summary

Adversarial subsystem-level review of the Phase 23 theme/visual system, with
extra scrutiny on the data layer per CLAUDE.md ("review the code, not the diff").
I read the full migration 015, the complete `app-settings-dao` DAO, and grepped
**every** SQL writer of `app_settings` across `src/db` and `src/backup`
(`data-revision-dao`, `app-settings-dao` ×3, `purge-dao`, `merge-dao`,
`restore-apply`, and the migration files) rather than trusting the diff. I also
traced the boot hydrate/import coordinator, the legacy-envelope mapper, the
reduced-motion SharedValue wiring in both Skia consumers, and the contrast/AA
logic.

**The data layer is sound.** Migration 015 is strictly additive
(seven `ADD COLUMN`), forward-only, ships no colour hex (option-IDs only), and
its `CHECK`/`NOT NULL DEFAULT` shape lands a v0→v15 device fully seeded with no
code branch. The backup allowlist correctly accepts-but-does-not-emit the theme
keys (emission deferred to Phase 36; `BACKUP_FORMAT_VERSION` stays 3), and every
write path (`updateAppSettings`, `updateAppSettingsCore` via restore) validates
theme values through the shared `assert*` validators, so a tampered slot/accent
id is rejected before the UPDATE opens. The compare-before-write idempotency in
`hydrateThemeAtBoot` is correct (diff, not patch-emptiness, gates the write). The
reduced-motion signal is read as a Reanimated `SharedValue` inside
`useDerivedValue` in BOTH `OrreryCanvas` and `SunBody` — no per-frame `setState`
(D-07 satisfied). The AA gate is genuinely enforced, not merely commented: I ran
`accents.test.ts` / `contrast.test.ts` / `surface.test.ts` /
`015-theme-settings.test.ts` — **123 tests pass**, covering all 8 accents × 2
packages × 2 modes and the migration CHECK-rejection paths. `check:colors` is
clean across the reviewed non-`/theme/` files. The two known galaxy-dark AA
misses (owner-escalated) were excluded from findings per directive.

No blockers. Two warnings (both in the dev-only preview harness / an
Android-platform rendering gap) and two low-severity notes.

## Warnings

### WR-01: ThemePreviewScreen mode-cycle reads the RESOLVED mode to advance the STORED mode — cannot cycle cleanly through light/dark/system

**File:** `src/components/ui/__dev__/ThemePreviewScreen.tsx:82-85` (with the masking cast at `:83`)
**Issue:** `cycleMode` computes the next mode from `mode` returned by
`useTheme()`, which is a `ResolvedMode` (`"light" | "dark"` only — `system` is
already resolved away by `resolveMode`). It then writes that into the store via
`setModeForActivePackage`, whose domain is `ThemeMode` (`light | dark | system`).
The `mode as ThemeMode` cast at line 83 silences the type mismatch. Concretely:
with stored mode `system` and OS = dark, `mode` is `"dark"` →
`MODES.indexOf("dark")` = 1 → next = `"system"` → stored becomes `system` →
resolves back to `"dark"` → pressing again re-selects `"system"`. The control
gets stuck and never reaches an explicit `light`/`dark`, defeating the purpose of
this harness (its stated job is exercising appearance mode on the Pixel during
the Plan 23-06 device-UAT). Dev-only, so no production impact, but it degrades
the reliability of the UAT tool this file exists for.
**Fix:** Track the stored mode locally and cycle off it, not off the resolved
value, e.g.:
```tsx
const galaxyMode = useThemeStore((s) => s.galaxyMode);
const standardMode = useThemeStore((s) => s.standardMode);
const storedMode = themePackage === "galaxy" ? galaxyMode : standardMode;
const cycleMode = () => {
  const next = MODES[(MODES.indexOf(storedMode) + 1) % MODES.length];
  setModeForActivePackage(next);
};
```
This also removes the `as ThemeMode` cast, letting tsc catch the class of bug.

### WR-02: GlassSurface "subtle glow" uses iOS-only shadow props on an Android-first app with a transparent, overflow-hidden container

**File:** `src/components/ui/GlassSurface.tsx:73-85` (glow), `:112-121` (container styles)
**Issue:** The galaxy glow is expressed with `shadowColor`/`shadowOpacity`/
`shadowRadius`/`shadowOffset` plus `elevation: 6`. On Android (the primary target
per CLAUDE.md) `shadowColor`/`shadowOpacity`/`shadowRadius` are no-ops — only
`elevation` is honored, and elevation shadows are the platform's neutral grey,
not the accent-tinted glow the token (`glowTokenKey: "accent"`) intends.
Additionally the container has `overflow: "hidden"` and no opaque
`backgroundColor` (the tint is a child `absoluteFill`), so an Android elevation
shadow is unreliable-to-absent for this view. Net effect: the documented THEME-05
"luminous accent glow" for Galaxy likely renders as either nothing or a plain
grey elevation on device — a silent loss of the differentiating glass affordance
on the target platform. Not a crash and not data-affecting, hence WARNING, but it
should be confirmed on the Pixel rather than assumed working.
**Fix:** Verify on device; if the tinted glow is required on Android, render it
with a real drawn layer (e.g. a Skia/gradient halo or an inner accent-tinted
border/blur ring) instead of RN shadow props, or accept and document that the
glow is iOS-only. At minimum drop the dead iOS-only shadow props on Android via
`Platform.select` so the intent isn't misleading.

## Info

### IN-01: overlay-base accessibility focus may fire before the Modal content is laid out

**File:** `src/components/ui/overlay-base.tsx:80-84`
**Issue:** The `useEffect` calls `AccessibilityInfo.setAccessibilityFocus(handle)`
in the same tick that `visible` flips true. RN's `Modal` mounts/animates its
content asynchronously, so `findNodeHandle(contentRef.current)` can resolve to a
node that is not yet on screen, and the focus request can be dropped — the
screen reader may briefly stay on the content behind the scrim (the exact thing
this block exists to prevent). Low impact (a11y polish), unproven without a
device screen-reader pass.
**Fix:** Move the focus call behind the modal's `onShow` callback, or defer it
(`requestAnimationFrame` / a short `InteractionManager.runAfterInteractions`)
so the content is mounted before focus is requested.

### IN-02: StatusGlyph tone/label maps are `Record<string, …>`, dropping exhaustiveness against the display-state union

**File:** `src/components/icons/StatusGlyph.tsx:27-44`
**Issue:** `STATUS_TONE` and `STATUS_LABEL` are typed `Record<string, …>` and
keyed by a stringified state. This works today (all six `StatusDisplayState`
values are covered), but the `string` index type means adding a future display
state would compile with `tone`/`label` silently `undefined` (Icon would fall
back to `textPrimary`, label to `undefined`) rather than failing the build.
Purely a maintainability/robustness note.
**Fix:** Type the maps as `Record<Exclude<StatusDisplayState, null> | "null", …>`
(or switch on the state like `statusGlyph` already does) so a new state is a
compile error until it is mapped.

---

_Reviewed: 2026-09-03T13:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
