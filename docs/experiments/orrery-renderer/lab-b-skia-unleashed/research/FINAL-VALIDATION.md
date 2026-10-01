# Lab B — final validation (emulator, release build, preset "Lab B best")

2026-10-01, after R3. Source = HEAD `883b84ed` (R3 code `13c706ad`, `1c339064`, `23bedb9c`).
Build: droid busy-probe IDLE → `tools/r2-release.sh final` → `assembleRelease` x86_64
(BUILD SUCCESSFUL, 31 tasks executed) → `install -r` over the seeded app
(`flags` without `DEBUGGABLE`). Target: the desktop **emulator** (`emulator-5554`, 1280×2856,
port 5039). Nothing here is a phone or absolute-performance claim. The **Pixel phone pass is
still pending: the Pixel is in use by Lab A.**

Preset everywhere unless a row says otherwise: `preset=best` (= registry defaults). Theme
Galaxy Dark unless noted. Evidence root: `evidence/13-final/`. Screenshots are JPEG (q85).
The reduced-motion proof is PNG because the pixel diff is the point.

## 1. Polaris tap (R3 open item 1) — RESOLVED, no code change

**Intended behaviour.** Dossier phase 08 §O (`D-08-069`, LOCKED): *tapping Polaris resets
yaw/north orientation only*, without resetting pan/zoom/tilt. `docs/systems/orrery.md`: "Reset
north changes yaw only". Code: `OrreryWorld` `onNorth` → `hitPolaris(...)` →
`camera.recover(northTarget(pose.value))` (`northTarget` = `{...pose, yaw: 0}`). This handler
is shared by both renderers. Lab B only adds the flare side-stamp (`fxTap`, C-20), placed
after the recovery call.

**Test (same build, same session, Lab B Inner Circle).** Recentre, then `yaw=0.75` by deep
link, then a single `input tap` on Polaris. The tap point was offset away from the satellite
pair that sits next to Polaris, because `hitPolaris` refuses a tap that also hits a body.
- **Legacy preset:** the camera rotates back to north and Polaris returns to the top
  (`01-polaris/legacy-vs-best-before-after.jpg`, panels 1–2).
- **Lab B best:** identical. North recovery + flare (panels 3–4, and
  `01-polaris/best-polaris-tap-sequence.jpg` = frames 13–20 at 10 fps of
  `best-polaris-tap-north.mp4`. The rotation completes in about 0.3–0.5 s while the flare
  travels with Polaris).

**Why R3 saw "no rotation".** Two capture artifacts:
1. The recovery takes `RECOVERY_MIN_MS`–`RECOVERY_MAX_MS` = 180–850 ms. R3 started
   `screenrecord` in the same shell *after* the tap, and screenrecord takes about 1 s to start,
   so every clip began after the rotation had finished.
2. Before/after stills that only show the end state look the same if the camera was already
   at north.

This time the recording started 1.5 s *before* the tap, and the rotation is visible. Lab B
did not break anything. The behaviour matches legacy and the dossier.

## 2. Exercise list (contract "Real app + device iteration")

| # | Item | Result | Evidence (`evidence/13-final/…`) | Notes |
|---|---|---|---|---|
| 1 | Overview: Inner 12 / Dense 120 / All Contacts 940 | PASS | `02-shots/01-overview-inner.jpg`, `02-overview-dense.jpg`, `09-overview-all-contacts.jpg`, `sheet-a.jpg` | Home tilt, light pool, rim rings, immersive header. All Contacts and Dense frame the same inner rings at Home (the same top-ordered contacts). |
| 2 | Far zoom (0.4) | PASS | `03-interactions/02-far-zoom-0.4.jpg` | Density fade, rings intact |
| 3 | Identity / detail / max zoom | PASS | `02-shots/03-identity-dense.jpg`, `04-detail-dense.jpg`, `03-interactions/03-near-zoom-max.jpg` | Near-size clamp (C-71) holds; the sun fills the view at max zoom, as expected for a centre zoom |
| 4 | Focus, initials body | PASS | `02-shots/05-focus-cleo.jpg` | Reticle, lock glow, card ("Clear focus / Open Profile"), neighbour labels |
| 5 | Focus, photo body | PASS | `03-interactions/01-focus-photo-dev-grant.jpg` | Card lists the satellite "Sky — Parent of Dev Grant" |
| 6 | Satellites | PASS | `03-interactions/01-focus-photo-dev-grant.jpg`, `01-polaris/*` (satellite pair beside Polaris), `07-satellites-identity-inner.jpg` | Satellites render and appear in the card list |
| 7 | Labels (semantic zoom) | PASS | `02-shots/03-identity-dense.jpg`, `05-focus-cleo.jpg`, all 4 themes in `sheet-c.jpg` | Plates readable in all themes |
| 8 | Gestures / camera: swipe pan | PASS | `03-interactions/04-pan-before.jpg` → `05-…up-right` → `06-…down-left` | Pan + bounded coast. **Pinch, twist-yaw and two-finger tilt cannot be injected with adb** (single pointer). Zoom/yaw were driven through the panel's `recover` path (`zoom=`, `yaw=` links) instead; real multi-touch is a phone-pass item. |
| 9 | Polaris / Reset north / Recentre | PASS | `01-polaris/*`; Recentre used before every scene | See §1 |
| 10 | Cluster (overlapping JD/EN) | PASS | `07-paths/cluster-0-before.jpg`, `cluster-1-panel.jpg` | Group panel "Contacts here, 2 contacts", a reticle per member |
| 11 | Switch small → dense | PASS | `04-switching/switch-inner-to-dense.mp4` (12 s), `-sequence.jpg`, `-settled.jpg` | Departure, streaks, arrival, settle |
| 12 | Switch dense → small | PASS | `04-switching/switch-dense-to-inner.mp4`, `-sequence.jpg` | Selector label changes first; the scene follows about 1 s later |
| 13 | Switch into Stress 400 | PASS (latency noted) | `04-switching/switch-inner-to-stress400.mp4`, `-sequence.jpg`, `stress400-later.jpg` | The label reads "Lab B Stress 400" ~2 s before the choreography starts (snapshot load for 400 on the emulator); then a full streak transition and a clean settle |
| 14 | Dense Systems at rest | PASS | `02-shots/02-overview-dense.jpg`, `04-switching/stress400-later.jpg` | |
| 15 | Reduced motion (static proof) | PASS | `05-reduced-motion/rm-best-a.png` vs `rm-best-b.png` = **0 changed pixels** below the status bar over 3 s (Dense overview); focused Cleo pair (`rm-best-focus-a/b.jpg`, diffed as PNG before conversion) = **0 changed pixels** | `rm=on` with preset best. R3 already proved "Everything" + RM = 0 px. |
| 16 | Themes: Galaxy Dark / Galaxy Light / Standard Dark / Standard Light | PASS | `02-shots/sheet-a.jpg` (GD), `sheet-c.jpg` (GL / SD / SL, overview + focus) | Standard Dark glass `textSecondary` stays 4.42 (model), the open owner item (C-02) |
| 17 | Background / foreground / refocus: rendering stops when inactive | PASS | `06-lifecycle/lifecycle-gfxinfo.txt`, `sheet.jpg` | 6 s gfxinfo windows (`opaqueCanvas:0` so gfxinfo sees canvas frames, `perfProbe:1`): Orrery foreground **118** frames / 3 probe lines → Digest tab **0 / 0** → back on Orrery **122 / 2** → HOME (backgrounded) **0 / 0** → relaunched **115 / 2**. Rendering and UI worklets stop when unfocused and when backgrounded, and resume on return. |
| 18 | Background during a big switch | PASS | `07-paths/bgswitch-0-resumed.jpg`, `bgswitch-1-settled.jpg` | Lands settled on Dense |
| 19 | Reorder (hold → drag → commit) | PASS | `07-paths/reorder-crops.jpg` (before / held / after), `reorder-0/1/2-*.jpg` | Hold on RB: held-ring glow on the tilted plane + reticle; the drag commits RB one slot inward. (The first attempt at the default coordinate missed a body and correctly became a pan.) |
| 20 | Crash buffer | PASS | — | `logcat -b crash` empty after the whole run |

## 3. Bugs found

| Bug | Scope | Status |
|---|---|---|
| **Selector shows "Unavailable System" after a cold start when the last System is a custom System** (`08-unavailable-system-cold-start.jpg`). `OrreryScreen` restores `preferences.lastSystem` with `select(system, undefined, false)` (main `OrreryScreen.tsx:466`, lab :494). `orrery-system-store` `select` only resolves a name for built-ins and categories (`currentName` is category-only), so a custom ref with no name falls back to `"Unavailable System"` and is never corrected once the load succeeds. The scene itself is correct. | **Pre-existing on `main`.** Store and screen code are identical; not a Lab B regression. | **Not fixed here (listed).** It belongs to production code, not this experiment. Likely fix: resolve the custom System's name in the load result (or from the custom-system DAO) and set `requested.name` on success, the same way categories do. Add a test for a cold restore of a custom System. |
| Stress 400 switch: ~2 s between the selector label changing and the choreography starting (emulator) | Known: snapshot build for 400 members, see `SWITCH-STALL-INVESTIGATION.md` / PERF-LOG | Phone pass to quantify |

No Lab B code changes were needed in this pass.

## 4. Gates (HEAD `883b84ed`, no code change in this pass)

- `npx tsc --noEmit`: clean.
- README gate set (`src/components/orrery src/logic/orrery- src/services/orrery-scene.test.ts
  src/screens/orrery-screen-framing.test.ts src/theme/accent-foreground-role-contract.test.ts
  src/theme/art-treatment-scope-contract.test.ts`): **49 files / 426 tests green**.
- `npm run check:colors`: exit 0.
- Full vitest: last recorded by R3 after the last code commit, 554 files / 6 254 tests green
  (R3-REPORT §8). Nothing in `src/` has changed since.

## 5. Tooling notes

- When the screen should show a Polaris recovery, start `screenrecord` first and then tap
  (`(screenrecord … &); sleep 1.5; input tap …`). Recoveries finish in under 850 ms.
- `tools/r2-release.sh` reinstalls and lands on the Digest tab. Tap the Orrery tab
  (896,2690) **before** any capture script: deep links fired while the Orrery is not mounted
  do not apply.
- `tools/r3-paths.sh reorder` needs `REORDER_BODY` aimed at a body (here `898 1020` = RB).
  Positions drift with the data clock, so check a screenshot first.
