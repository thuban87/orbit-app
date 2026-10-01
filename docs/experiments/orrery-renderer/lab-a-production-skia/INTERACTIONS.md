# Lab A: Interactions (final build, HEAD `978643c9`)

**Rule of the lab:** Lab A changes *presentation*, not interaction semantics. Gestures, hit testing, label allocation, focus intents, semantic levels, switching choreography and reorder all run through the unchanged production code paths, reading the same single sampled `frame`. The interaction-relevant changes are listed in §2, and each one is marked as either a lab experiment or a main-line fix.

## 1. Interaction model in the final build

| Area | Behaviour at HEAD | Owner of the logic | Lab-specific presentation |
|---|---|---|---|
| **Camera / gestures** | `createOrreryGestures` (`use-orrery-camera.ts`, **unchanged**) is `Race(tap, Race(reorder hold, Simultaneous(1-finger pan, pinch, rotation→yaw, 2-finger vertical pan→tilt)))`. Pan, zoom, tilt and yaw are clamped by `clampCameraPose`, with coast and recovery. | production | The plane, the sky parallax (pan, yaw, tilt, zoom per layer) and the contact shadows (gated by tilt) make camera motion visible as 3D. |
| **Home / Recenter** | `deriveHomePose` now carries **`LAB_HOME_TILT_DEG = 45`** (`src/logic/orrery-camera-logic.ts`). The fit divides by the near-side perspective scale and by `cos(tilt)`. Recenter, Home and every switch destination use it. Focus keeps the current tilt. | **experiment constant (owner decision K)** | It applies to **both** renderers in this build. Set it to 0 to restore the recorded top-down Home (phase-08 §C/§P, 29-UI-SPEC ORRC-04/05). |
| **Hit testing** | Taps are resolved from `frame` + `allocations` (`resolveSatelliteTap`, Profile-vs-Focus unchanged). Hit radius is ≥ 22 dp (`MIN_HIT_RADIUS`). | production | The drawn disc is ≤ 21 dp at overview (`BODY_VISUAL_MIN_RADIUS`), so the visible disc sits inside the tap target. The canvas is not in the a11y tree. |
| **Focus** | A body tap → focus intent → `frameBodies` centres the body in the usable rect (camera framing unchanged). | production | The UI-thread reticle (lock-on 760 ms, scan arc), focused-ring emphasis, a 22 % dim on other bodies (320 ms fade) and the focus card placement (§2). |
| **Zoom / semantic levels** | `semanticLevel` hysteresis is unchanged: overview < identity (enter 2, exit 1.85) < detail (enter 3, exit 2.8). Labels are allocated by `allocateLabels`. | production | Labels are drawn as instrument plates (border, status tick, leader). Moons are hidden at overview, as in production. Context lines show at detail zoom. |
| **System switch** | `useOrrerySwitchRuntime` + choreography are unchanged (2.1 s normal, RM crossfade). | production, plus 2 main-line fixes (§2) | The "jump": trails, ink-in from the sun outward, glints, capture ripples, bezel swing, sky kick and warp, sun flare. Arrival ghosts cover bodies whose components have not mounted yet. |
| **Reduced motion** (live, `transition_animation_scale = 0` on Android) | The switch is a crossfade (production). | production | `switchFx` is idle; the reticle is pre-locked with a static scan; corona and granulation sit at a fixed phase; fades, emphasis and the nebula fade are instant. The idle canvas does **0** presents in release. |
| **Reorder** | The reorder hold, `previewReorder` in the frame and commit are unchanged. | production | `drawReorderGhost` draws the held ring plus a circle in accent. Lab frames have no `ringPath`, so the ring is projected on demand from the homography (128-gon), and only while dragging. |
| **Recovery / north** | A Polaris tap → `camera.recover(northTarget)`; "Reset north" and "Recenter" are unchanged. | production | Polaris is drawn imperatively (`drawPolaris`). |
| **Accessibility** | The canvas exposes no a11y nodes, as before. The companion sheet "Contacts in this System" and the RN overlays (pills, FAB, focus card, View options) carry the a11y labels, and these are unchanged. The A/B row has `accessibilityLabel="Lab A renderer (experiment)"`. | production | Font scale 1.3 was verified for plates and the card (pass 3). Status stays redundant across hue, width (2/3/4 dp) and solid/dashed (CVD channel preserved). |
| **Lifecycle** | The canvas unmounts on blur and background; the single clock dies with it. | production | The base texture is disposed on unmount; photos get a 1.5 s custody grace; the nebula stays cached across remounts (no re-bake pop). |

## 2. What changed vs `main` (interaction-visible)

| Change | Where | Kind | Verified |
|---|---|---|---|
| **Tilted Home (45°)** | `orrery-camera-logic.ts` `LAB_HOME_TILT_DEG`, `deriveHomePose` | **Owner decision K: testing only.** It reverses the recorded top-down Home. | Device: taps exact at 45° (pass 1); 28° was too weak to read. |
| **Focus card placement.** Main clamped the card *up* over the focused body and reticle. The Lab card clears the drawn body, reticle and label plate, flips above when needed, slips a narrower (≥ 168 dp) card beside a blocking obstacle (the 200×173 dp controls block), or caps its height so its content scrolls. | `lab/focus-card.ts`, `OrreryFocusContext.tsx` (Lab-gated) | Lab presentation; framing and the usable rect are unchanged | Device, all 4 palettes, font scale 1.3 (pass 3). A moon's card can still cover its parent's label (residual). |
| **Focus card natural height.** Main measured the card's height from layout and stayed at the 180 dp default, which clipped late relationship rows. It is now measured from a content wrapper's `onLayout`. | `OrreryFocusContext.tsx` (`0c0b18b`) | **main-line bug** (fixed only on the Lab path here) | Device, pass 3 (probed `height 180` before). |
| **Stale-camera fix.** A switch started from the *previous switch's* target instead of the live pose after any pan, zoom or recenter, or after a cold-start Home, so the first frame snapped. | `use-orrery-switch-runtime.ts` `displayedSwitchCamera` (`20538bd`) | **main-line bug**, fixed for both renderers | 3 tests (2 fail on the old code); device recordings. |
| **Switch/focus freeze removed.** A 3–5 s main-thread block on large-System switches and 0.7–1.4 s Daveys on focus. | `842f1f3`, `ba3cef6` | **main-line bug** (main has the same frame worklet and runtime) | Device, debug-native + production JS (PERF-PASS). |
| **Reticle** replaces the production accent focus ring. It is screen-dp around the *drawn* disc, axis-aligned once locked, and lands in the same frame the camera starts (UI-thread `focusState` written in render). | `reticle-draw.ts`, `LabScene.tsx` | Lab presentation (adds ambient motion: scan arc; the owner decides on ambient motion) | Device: lock-on recording (`evidence/pass-3/20`), RM static (`21`). |
| **Focus latency.** Tap → response was 3.6–8.9 s in release with the declarative Lab tree (legacy: 0.43–6.7 s). It is now 0.005–0.045 s, settling in ≈0.63 s. | `fd7f09c` (imperative renderer), `dc7f866` | architecture | Release device runs (`evidence/camera-perf/release/`). |
| **Initials on Hermes.** Main draws the full name into the disc ("C…"). | `orreryInitials` | **main-line bug** | Device + test. |
| **Entering identity at settle.** Release `6ad5a307` resolved entering photos, initials and status 1.2–6.8 s after the switch settled; ghosts covered the gap. After the imperative renderer they resolve at settle. | `fd7f09c` | architecture | Release (`evidence/arch-perf/release/switch-identity-at-settle-sheet.jpg`). |
| **Co-angular stacks.** A keyline cuts the farther disc, and pips mark hidden bodies. | `body-stack.ts`, `BODY_SKSL` | Lab presentation; ambiguous taps still resolve to the existing group panel | Device stills; the group-panel tap path was **not** re-exercised. |

## 3. Device-verified vs not

| Verified on device (Pixel 6 Pro) | Not verified / not automatable |
|---|---|
| Tap-to-focus on contacts, moons and the sun, and Profile-vs-Focus on a labelled body (pass 1 `02b`) | **Pinch zoom and two-finger tilt/yaw.** `adb input` has no multitouch, and `sendevent` is denied. There is no tilt UI control. |
| One-finger pan (scripted swipes; injection-limited to ≈60 updates/s) | **Real-finger pan smoothness.** Renderer capacity was inferred from the Recenter animation (82–92 presents/s). |
| Recenter / Reset north animation | **Detail-zoom context lines**, which need a zoom past the focus framing. |
| System switches All ↔ Lab Dense ↔ Lab Inner Circle, incl. reduced motion (`evidence/final/33`) | **Max-tilt** rendering on device (only Home 45° and focus framings were seen). |
| Focus reticle lock-on and RM static reticle | Stack-pip **tap** disambiguation (group panel) |
| Focus card in 4 palettes, font scale 1.3, moon card | Photo *edits* while the custody hand-off is live |
| A/B toggle flipping renderers live, incl. release | Screen-transition animations with the SurfaceView, frame by frame |
| Overlays (sheets, pills, FAB, card) above the SurfaceView canvas (camera-perf parity sheets) | The photo-sun path (the test self-sun has no photo) |

## 4. Known interaction residuals

1. **Focus camera framing.** When a near-sun body is focused, the sun sits partly under the header pills (usable-rect centring; unchanged by design).
2. **A moon's focus card can cover its parent's label plate.** Only the focused body's own label is cleared.
3. **The Lab Dense Home does not fit 32 bodies.** This follows the recorded "fit until readability fails" rule; the 45° tilt helps but does not fix it. A low-count Home sits high and small (usable-rect centre, zoom ≤ 1).
4. **At font scale 1.3 a nudged label plate can touch the reticle's bottom-left bracket.**
5. **Baseline bugs observed, not fixed here:**
   - after a cold start with a custom System, the selector reads "Unavailable System" (`evidence/baseline/15-…`);
   - a custom System selection was sometimes not restored after a force-stop (PASS-3 item 4 side note; uninvestigated).
6. **The visual extent exceeds the culling reach.** Up to 1.6r disc × 1.5 halo, and a corona of 2.7r against a 2r sun reach, so bodies and the corona can pop at the screen edge (accepted).
