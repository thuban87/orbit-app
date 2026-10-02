# Orrery Lab C — interactions

The pose owner is unchanged: there is one UI-thread `CameraPose` (ADR-077, `use-orrery-camera.ts`), and every
gesture composes into it in worklets. What changed is the **camera model** (a real perspective dolly) and the
**gesture mapping** (`createOrreryGestures({ strategyCamera: true })`, used only by the 3D world).

## Camera model

| Parameter | Value | Where |
|---|---|---|
| Focal length | `LAB_FOCAL_PX = 720` logical px (≈ 50° vertical FOV on the Pixel 6 Pro) | `orrery-camera-logic.ts` L75 |
| Zoom | a **dolly**: distance `720/zoom` from the pivot (`labFocalDistance`); `MIN_ZOOM 0.08`, `MAX_ZOOM 4` | L78, L138–139 |
| Tilt | Home 1.08 rad (~62° from vertical); max `MAX_TILT 1.32` (~76°); min 0 (top-down) | L77, L140 |
| Yaw | orbits the pivot | — |
| Projection centre | `viewport.camera`: canvas minus full-width bars, height ×0.62. This lens shift puts the pivot at ~31% of the camera rect | `OrreryScreen.tsx` viewport memo |
| Home | small Systems: strategy composition (far rim under the camera-rect top, half-width ≤ 0.6 viewport); > 24 contacts: populated-core framing at tilt 0.85 | `deriveHomePose` L357 |
| Near safety | points at or behind the camera no longer throw; frame-lite culls bodies inside 12% of the dolly distance | `perspectiveScale`, `orrery-frame-lite.ts` |

## Gestures (strategy map)

| Gesture | Effect | Device-verified? |
|---|---|---|
| One-finger drag | **Orbit**: `yaw -= dx·0.0076` (full-width drag ≈ 180°), `tilt -= dy·0.0052`, clamped `[0, MAX_TILT]` | Yes (adb swipe; `03-checkpoint-b/01→02`, `08-final/rec-02`) |
| Release after drag | Orbit inertia: velocity × 0.32 s, capped ±1.2 rad yaw / ±0.35 rad tilt, 900 ms quintic ease-out coast; any touch stops it; disabled under reduced motion | Partly (adb flings are unreliable) |
| Two-finger drag | **Pan** the pivot, bounded to ±extent so the system cannot be lost | **No**: adb has no multi-touch. Owner checklist |
| Pinch | Dolly | **No**: owner checklist |
| Two-finger twist | Yaw (unchanged) | **No** |
| Tap | Hit test on the published UI-thread frame: focus contact / sun / moon (`resolveSatelliteTap`) | Yes, including after an orbit (`03-checkpoint-b/03`) and on a moving moon (`07-checkpoint-e/s2-moon-tap-*`) |
| Long-press | Reorder (production logic; the hold fails on movement > HOLD_SLOP before orbit claims) | Not exercised on device in 3D; the reorder ghost is **not drawn** in 3D |
| Recenter button | `deriveHomePose` via `camera.recover` | Yes (`03-checkpoint-b/07`) |
| Reset north | `northTarget` (dolly-consistent, rewritten test in 467b973b) | Labelled in a11y dump; not separately shot |
| Lab badge tap | Cycles 4 presets `[tilt, yaw, zoom×]`: `[1.08,0,1]`, `[1.0,0.7,2.2]`, `[0.9,2.2,3.4]`, `[1.2,3.8,1]`. The home zoom is re-captured when leaving preset 0 (fix 4a82ae85) | Lab-only tool |

## Focus

- Tap or "Focus in Orrery" flies the pivot to the contact (`OrreryScreen.focus`). For a single target, the
  camera dollies so the contact's **system radius** (hero body, plus moon orbit and moon when it has moons;
  `orreryFocusSystemRadius`) projects at `min(0.7 × half the free height, 0.30 × canvas width with moons /
  0.15 without)`. It then shifts the pivot (3 fixed-point project/unproject steps) so the system centres
  between the selector row and the docked card. The `IDENTITY_ZOOM` cap is **not** applied to this dolly in
  Lab C; `MAX_ZOOM` still clamps.
- **Docked focus card**: bottom of the canvas, left of the controls/FAB column (`FOCUS_CARD_SIDE_RESERVE 92`).
  The same rect is reserved as a label exclusion. Trade-off: if the user pans the focused body down, the card
  can cover it (focus-lost fires only when the body is off-screen).
- Focused parents' moons revolve; moons are tappable and focus the satellite person (card "Dana · Sibling of …").
- Focus recovery uses the shared camera motion; under reduced motion it is the 100 ms linear path.
- **Tab return**: in release, focus was cleared after leaving the Orrery tab and returning. This was **not
  compared against debug or production**, so it is unknown whether the lab caused it (`08-final/README.md`).

## Zoom and semantic labels

The production thresholds (`semanticLevel`: identity 2, detail 3, with hysteresis) are kept. Their input is
`effectiveLabelZoom`: the median on-screen magnification of visible contacts relative to their un-heroed
radius. Overview: focused and cluster labels only. Identity: names. Detail: names + context. Moons have
no canvas label; their relationship appears in the focus card rows. Dense overview therefore shows faces only.

## System switching

The production choreography (`sampleSwitchChoreography`: roles retained / leaving / entering / anchor; SHED
0.18–0.58, CAPTURE 0.44–0.82, SETTLE 0.72; stagger 0.035; 2100 ms; 180 ms reduced crossfade) still owns x/y,
radius, opacity and interactivity. The 3D world **adds**:

- departing bodies fall `0.42·extent·shed²` below the plane into the fog while they spiral out;
- arriving bodies streak in from `0.55·extent·(1−capture)²` above and land; they become interactive at 0.82,
  when their lift is ≈ 0, so drawn == tappable holds;
- retained bodies stay on the plane;
- capture flare: ring alpha ×(1+1.4f), width ×(1+2f), plus an accent halo (pool 24);
- camera breath: dolly out ≤ 24%, yaw +0.38, tilt −0.1, sin² envelope, zero at both ends.

Evidence: `08-final/rec-01-system-switch-inner-to-dense-12s.mp4`, `04-checkpoint-c/03-switch-dense-to-inner.mp4`.
Log example (Dense → Inner): retained 10, leaving 110, entering 7, intensity 0.85. Known issues: a 1.4–2.5 s
scene read before any motion (pre-existing load latency); a one-frame black upper canvas when the selector
closes; a camera step before the choreography starts (neither chased).

## Reduced motion

Source: the app's live OS signal (`useReducedMotion` / ADR-085), driven by Android "Remove animations".
Verified in debug (`07-checkpoint-e/s4-*`): `reducedMotion=true` reaches the world; the switch takes the
180 ms path with no lift, flare or breath; moon revolution, twinkle and pulse stop (frames 5 s apart are
pixel-identical); orbit, pan and yaw coasts are disabled. Not re-shot in release (same JS path, not
`__DEV__`-gated).

## Accessibility

Unchanged from production by design. The canvas is not the accessible path, and there are no per-body
overlay nodes in Lab C or production. The companion controls are present and labelled in release
(`_notes/A11Y.md`). TalkBack swipe-nav was **not exercised**: injected swipes orbit the camera. Owner
checklist.
