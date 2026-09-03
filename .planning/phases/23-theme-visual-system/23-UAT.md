---
status: complete
phase: 23-theme-visual-system
source: [23-VERIFICATION.md]
started: 2026-09-03T18:56:00Z
updated: 2026-09-03T21:20:00Z
---

## Current Test

[testing complete — 9/9 pass; see Findings for caveats + the one owner-view item (T8)]

## Tests

### 1. Restore-before-paint cold start + legacy orbit-theme carry-across
expected: First painted MAIN frame is the saved package's palette with NO dark->other snap (restore-before-paint, no wrong-theme flash); an existing device that had an AsyncStorage orbit-theme value carries its mode across after one launch, then the key is cleared. (Write a persisted non-default theme_package via DAO/adb run-as, then relaunch.)
result: pass
source: device (Pixel 6 Pro, dev-client via Metro 8082)
evidence: |
  DAO-wrote a non-default theme (standard/light) via run-as sqlite3 + cold-start.
  Settled frame rendered standard/light app-wide (vs galaxy/dark on the prior launch)
  — theme restored on cold start, whole app re-themed. Burst-captured earliest frames
  showed only the OS splash window (#303030, theme-independent) then the restored light
  theme; no galaxy-dark->standard-light theme snap observed. Sub-100ms first-JS-frame
  is below screencap timing resolution; restore-before-paint (App.tsx ready gate holds
  until hydrateThemeAtBoot resolves) is code+unit verified. Legacy orbit-theme
  AsyncStorage carry-across NOT exercised on-device (unit-tested: orbit-theme-migration).

### 2. Reduced-motion live toggle halts all Galaxy/Orrery motion
expected: With OS reduced motion toggled ON mid-session while a Galaxy background + Orrery are on-screen — Orrery drift/twinkle AND the sun glow pulse (and any Galaxy background motion) stop; manual camera control still works; toggling updates live without an app restart.
result: pass
source: device (Orrery screen, frame-diff)
evidence: |
  On the Orrery, frame-diff of consecutive frames: reduced-motion OFF = ~86,000 changed
  px/frame (twinkle/drift/sun-pulse active); after toggling OS reduced-motion ON LIVE
  (animation scales -> 0, NO app restart) = 0.0000 mean diff / 0 changed px — all ambient
  Skia motion halted instantly via the live reduceMotionChanged subscription. Manual
  camera: an adb pan swipe showed no scene translation — this pre-Phase-29 Orrery has no
  free-pan/zoom camera (bounded camera is Phase 29), so that secondary clause is N/A here;
  the ambient-motion halt (the substantive requirement) passed cleanly.

### 3. Large-font reflow through AppText
expected: With OS font size set large, AppText content (incl. long multibyte and long-word strings) wraps / grows height rather than truncating or shrinking; correct fonts render on first paint.
result: pass
source: device (ThemePreviewScreen harness, font_scale 1.5)
evidence: |
  Set OS font_scale 1.5. AppText heading/body/caption grew and reflowed — body paragraph
  wrapped to more lines, GlassSurface cards grew in height to fit, caption wrapped mid-word
  boundary; no truncation, clipping, or shrink. Correct bundled fonts rendered on first
  paint. (Long-multibyte/long-word specimens not in the harness copy; the reflow contract
  — no allowFontScaling=false, no fixed heights — held on the representative copy.)

### 4. Greyscale status distinguishability
expected: With a greyscale / colour filter applied, each of the six status display states (stable/wobble/decay/rogue/neutral/snoozed) remains distinguishable by silhouette glyph + border weight + text label alone, with colour removed.
result: pass
source: device (StatusGlyph strip in harness, pixels desaturated to true greyscale)
evidence: |
  Rendered all six StatusGlyph states and desaturated the screenshot to true greyscale.
  Each remained unambiguous by distinct silhouette + label with colour fully removed:
  stable=check-in-circle, wobble=clock, decay=warning-triangle, rogue=minus-in-circle,
  snoozed=crescent, null/neutral=empty-circle. snoozed/null use the muted 'border' tone
  (fainter in greyscale) but stay distinct by shape + label. Border-weight (the third
  redundant channel) lives on the card ring, adopted in a later renderer phase; glyph +
  label alone already distinguish all six.

### 5. Glass-over-background AA on shipped .webp bytes
expected: For EACH Galaxy background asset, body + caption text over glass on the asset's visibly brightest region stays legible (AA-comfortable). A failure means the shipped .webp exceeds its declared worst-case pixel.
result: pass
source: objective (decoded shipped .webp bytes + recomputed composited-AA against actual pixels)
evidence: |
  Decoded all 8 shipped .webp (PIL) and recomputed the surface.test composited-AA
  proof against the ACTUAL brightest pixel instead of the declared one. Live glass
  tint (surface token @ 0.88) over the decoded pixel, all text FGs @ AA 4.5 + status
  FGs @ AA 3.0, galaxy dark+light. Byte drift tightens contrast by <=0.044 ratio
  units; worst-case AA margin over decoded bytes = +0.747 (all FGs still pass).
  Standard assets flat @ 0.97 (pixel contributes 3%) => negligible. AA does NOT break.
  CAVEAT (not a gap): lossy VP8 pushed the decoded brightest pixel a few RGB units
  ABOVE the declared bound on some slots (literal "must not exceed" invariant nit) —
  AA holds regardless. Owner may re-tighten declared pixels or re-master when real art lands.

### 6. Four package×mode combos via DAO write + cold-start
expected: Surfaces, accents, and status glyphs are legible and AA-comfortable in all four combos (galaxy/standard × light/dark); Galaxy shows glass, Standard shows flat; background stays fixed while content scrolls; dense forms are more opaque/readable; a removed asset falls back to None/Solid with no error.
result: pass
source: device (DAO-write + cold-start per combo; ThemePreviewScreen harness)
evidence: |
  All four combos captured via DAO-write theme columns + cold-start:
  galaxy/dark, galaxy/light, standard/dark, standard/light — surfaces, accents, and text
  legible and AA-comfortable in every combo. Glass-vs-flat visibly distinct: Galaxy shows
  a translucent surface with a luminous accent glow around cards; Standard is opaque/flat
  with a plain border and no glow. Density cycles presentation->comfortable->dense (opacity
  monotonic). onError toggle -> None/Solid fallback with no error.
  CAVEAT: real backdrop blur was NOT exercised — the installed dev-client binary predates
  expo-blur (Phase-23 native dep: ExpoBlurView ViewManager absent), so glass was shown via
  the design's tinted-token FALLBACK path (blur is decorative/graceful-degrade). Testing
  real blur needs a fresh dev-client build. Not a code defect.

### 7. Modal/Sheet/ConfirmDialog variants + Android Back lifecycle
expected: Shared radius/scrim/safe-area render; Android Back + scrim-tap dismiss a non-destructive Modal/Sheet; a destructive ConfirmDialog does NOT dismiss on Back or scrim-tap, requires an explicit choice, names the action, and shows the warning glyph; scrim dims without a colour literal.
result: pass
source: device (ConfirmDialog primitive exercised via harness)
evidence: |
  Destructive ConfirmDialog ("Delete contact?"): red warning-triangle glyph heads the
  dialog; title NAMES the action; confirm button is danger-red fill WITH its own warning
  glyph + white onDanger label (destructive beyond colour); Cancel is secondary. Android
  Back -> STAYS; scrim-tap -> STAYS; only explicit Cancel/Delete dismisses. Non-destructive
  ConfirmDialog ("Discard changes?"): Android Back -> dismisses. Scrim dims (token, no
  colour literal). Source-verified: overlay-base dismissable=!destructive gates scrim
  onPress + Back no-op. NOTE: the Settings "Remove photo" alert is a legacy/native
  cancelable dialog (dismisses on Back, no glyph), NOT the Phase-23 ConfirmDialog primitive.

### 8. Galaxy GlassSurface "subtle glow" on Android (REVIEW WR-02)
expected: The luminous accent-tinted glow is visible on the Android target, OR the glow is accepted/documented as iOS-only. (GlassSurface currently expresses the glow with iOS-only shadowColor/shadowOpacity/shadowRadius props that are no-ops on Android — only elevation is honored, rendering neutral grey, not the accent tint.)
result: pass
source: device (galaxy/dark vs standard/dark comparison on Pixel 6 Pro, Android 14/API34)
evidence: |
  FINDING — REVIEW WR-02's premise is OUTDATED for modern Android. The accent-tinted glow
  IS visible on the Pixel: galaxy/dark GlassSurface cards show a distinct blue accent glow
  (clearest on the 2nd card); standard/dark (glowTokenKey null) shows NO glow. Android
  API 31+ honors shadowColor on elevation shadows (setOutline*ShadowColor), so RN's
  shadowColor+elevation renders the accent tint, not neutral grey. Expected condition
  ("glow visible on Android") is SATISFIED. Owner had asked to view before deciding —
  screenshots sent; disposition = accept (renders as designed), no fix needed.

### 9. Placeholder background art — ship-or-schedule owner decision
expected: Owner decision — the 8 background .webp files are honestly-disclosed uniform-fill placeholders (colour == declared brightest pixel). Real curated art is an asset-production deferral. Any replacement art must stay at or below the declared brightest pixel per slot (or retune pixel + tint opacity together — never weaken AA).
result: pass
source: owner-decision
reported: "Ship placeholders this milestone; real curated art is a scheduled asset-production deferral."

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — all 9 pass]

## Findings (non-blocking; no code gaps)

- **Native drift — installed dev-client APK is pre-Phase-23.** The Pixel's installed
  `com.bwales.orbit` dev client predates `expo-blur` (Phase-23 dep) and bundled fonts, so
  real backdrop blur (ExpoBlurView) could not be exercised on-device (T6 shown via the
  tinted-token fallback, which is the design's graceful-degrade path). Fully validating
  real blur needs a fresh dev-client build on `droid`. NOT a code defect.
- **T8 glow renders on Android (WR-02 outdated).** Contrary to REVIEW WR-02, the accent
  glow IS visible on the Pixel (API 31+ honors shadowColor on elevation). Disposition:
  accept as-is. Owner had asked to view first — screenshots sent for confirmation.
- **Adoption deferral is real and on the roadmap.** GlassSurface / BackgroundHost /
  StatusGlyph have no production screen consumers yet; adoption lands in the rebuild
  phases (25/26 Dashboard, 29/30 Orrery, 31 Profile). These primitives were UAT'd via the
  dev-only ThemePreviewScreen harness (temporary dev route, reverted — not committed).
- **Metro port note (memory saved).** Orbit dev client requests :8081 (quest-board's);
  drove Orbit by remapping device:8081 -> host:8082. Restore `adb reverse tcp:8081 tcp:8081`
  to return the phone to quest-board.

## Deferred Follow-Ups

- test: 9
  idea: "Real curated background art (replace the 8 uniform-fill placeholder .webp). Must stay at or below the declared brightest pixel per slot, or retune declared pixel + tint opacity together — never weaken AA. Owner shipped placeholders for this milestone."
  deferred_at: 2026-09-03
