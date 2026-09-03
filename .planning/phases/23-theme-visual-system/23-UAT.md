---
status: testing
phase: 23-theme-visual-system
source: [23-VERIFICATION.md]
started: 2026-09-03T18:56:00Z
updated: 2026-09-03T18:56:00Z
---

## Current Test

number: 1
name: Restore-before-paint cold start (no wrong-theme flash) + legacy orbit-theme carry-across
expected: |
  First painted MAIN frame is the saved package's palette with NO dark->other snap
  (restore-before-paint, no flash); a device that had an AsyncStorage orbit-theme value
  carries its mode across after one launch, then the key is cleared.
awaiting: user response

## Tests

### 1. Restore-before-paint cold start + legacy orbit-theme carry-across
expected: First painted MAIN frame is the saved package's palette with NO dark->other snap (restore-before-paint, no wrong-theme flash); an existing device that had an AsyncStorage orbit-theme value carries its mode across after one launch, then the key is cleared. (Write a persisted non-default theme_package via DAO/adb run-as, then relaunch.)
result: [pending]

### 2. Reduced-motion live toggle halts all Galaxy/Orrery motion
expected: With OS reduced motion toggled ON mid-session while a Galaxy background + Orrery are on-screen — Orrery drift/twinkle AND the sun glow pulse (and any Galaxy background motion) stop; manual camera control still works; toggling updates live without an app restart.
result: [pending]

### 3. Large-font reflow through AppText
expected: With OS font size set large, AppText content (incl. long multibyte and long-word strings) wraps / grows height rather than truncating or shrinking; correct fonts render on first paint.
result: [pending]

### 4. Greyscale status distinguishability
expected: With a greyscale / colour filter applied, each of the six status display states (stable/wobble/decay/rogue/neutral/snoozed) remains distinguishable by silhouette glyph + border weight + text label alone, with colour removed.
result: [pending]

### 5. Glass-over-background AA on shipped .webp bytes
expected: For EACH Galaxy background asset, body + caption text over glass on the asset's visibly brightest region stays legible (AA-comfortable). A failure means the shipped .webp exceeds its declared worst-case pixel.
result: [pending]

### 6. Four package×mode combos via DAO write + cold-start
expected: Surfaces, accents, and status glyphs are legible and AA-comfortable in all four combos (galaxy/standard × light/dark); Galaxy shows glass, Standard shows flat; background stays fixed while content scrolls; dense forms are more opaque/readable; a removed asset falls back to None/Solid with no error.
result: [pending]

### 7. Modal/Sheet/ConfirmDialog variants + Android Back lifecycle
expected: Shared radius/scrim/safe-area render; Android Back + scrim-tap dismiss a non-destructive Modal/Sheet; a destructive ConfirmDialog does NOT dismiss on Back or scrim-tap, requires an explicit choice, names the action, and shows the warning glyph; scrim dims without a colour literal.
result: [pending]

### 8. Galaxy GlassSurface "subtle glow" on Android (REVIEW WR-02)
expected: The luminous accent-tinted glow is visible on the Android target, OR the glow is accepted/documented as iOS-only. (GlassSurface currently expresses the glow with iOS-only shadowColor/shadowOpacity/shadowRadius props that are no-ops on Android — only elevation is honored, rendering neutral grey, not the accent tint.)
result: [pending]

### 9. Placeholder background art — ship-or-schedule owner decision
expected: Owner decision — the 8 background .webp files are honestly-disclosed uniform-fill placeholders (colour == declared brightest pixel). Real curated art is an asset-production deferral. Any replacement art must stay at or below the declared brightest pixel per slot (or retune pixel + tint opacity together — never weaken AA).
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
