# Orrery Lab B — "Skia Unleashed" (Deep Field Cartography)

**Goal.** Find the practical visual ceiling of React Native Skia for Orbit's Orrery. The work
stays inside the real app, uses the real scene/world/frame pipeline and keeps the product
semantics (Gravity, Frequency, Systems, sun, photos and initials, satellites, focus, semantic
zoom, labels, switching, reorder, reduced motion, themes, high counts, lifecycle). Visual
discovery came first. Every effect is sorted into one of four buckets: worth shipping, worth
simplifying, beautiful but too costly, or failed. Every production compromise is written
down.

**Status (2026-10-01).** Everything is complete:

- M1 and M2;
- R1 (performance and legibility);
- R2 (art direction and hero experiments);
- R3 (integration polish, presets);
- a final validation run on a release build (emulator);
- the **Pixel 6 Pro phone pass** (release, arm64; `research/PHONE-PASS-RESULTS.md`).

**The phone pass overturns the main performance verdict.** Lab B best runs at **3–9 fps** at
Dense 120 on the Pixel. The cause is the R2 tilted Home: the orbit rings and wakes are
stroked under a perspective matrix, which costs 100–350 ms of GPU per frame on Mali-G78 and
blocks the UI thread. With the tilt off, the same effects run at **92–99 fps**.

The tilt idea is still worth keeping, but V2 must draw the rings differently (analytic
ellipses or one ring shader). Every other number in this package before §9 of
`PERFORMANCE.md` is emulator-relative.

**Branch.** `experiment/orrery-skia-unleashed`. Worktree:
`/home/bwales/projects/orbit-orrery-lab-b`. Base: `34920925`. Package:
`com.bwales.orbit.labb` (launcher "Orrery Lab B"). This branch is never merged wholesale. V2
harvests from it (see `HARVEST.md`).

## Read in this order

| Doc | What it answers |
|---|---|
| `OWNER-REVIEW.md` | **Every owner decision**, in plain language, with a recommendation, a short code and the image to look at. |
| `RECOMMENDATIONS.md` | Best and worst experiments, what V2 should steal, the carry-forward/reject list, and "one more day". |
| `HARVEST.md` | Every successful idea: verdict, value, readiness, location, commit, cost, evidence, what to preserve. It includes **shared-code fixes that help the current production Orrery today**. |
| `PERFORMANCE.md` | The envelope (12 → 940 bodies), bottlenecks and risks. Emulator-relative, except §9 (the Pixel phone pass). |
| `ARCHITECTURE.md` / `IMPLEMENTATION.md` | How the renderer is built and where everything lives. |
| `VISUAL-DESIGN.md` / `INTERACTIONS.md` | The look and the motion/camera/focus/switch behaviour. |
| `DECISIONS.md` / `DEAD-ENDS.md` | The chronological story and the rejected ideas. |
| `PRODUCTIONIZATION.md` | What shipping any of this would take. |
| `ASSET-MANIFEST.md` | Every added asset (16 test portraits, all procedural otherwise). |
| `research/` | Raw working logs: 01–03 research, DECISIONS-LOG, COMPROMISES-LOG (C-01…C-73), DEAD-ENDS-LOG, PERF-LOG, M1-CRITIQUE, SWITCH-STALL-INVESTIGATION, R1-REPORT, R2-REPORT, R3-REPORT, FINAL-VALIDATION, PHONE-PASS-SCRIPT, PHONE-PASS-RESULTS. These are the source of truth the package summarises. |
| `RUNBOOK-LAB-B.md`, `AGENT-RULES.md` | How to build, run and test. Rules for every agent. |

## Key commits (chronological)

| Milestone | Commits |
|---|---|
| Setup | `9ca24ae8` (separate package, marker, dev seed), `8b770dea` (runbook, busy probe, baseline evidence), `8c7df728` (research 01–03) |
| WP-1.0 shell + panel + HUD | `c8a82eaf` |
| WP-1.1 environment | `54188b10`, `79cc89eb`, `f2b1d02b` |
| WP-1.2 lit worlds | `469440db`, `0922d223`, `0f888524` |
| WP-1.3 instrument orbits + HUD labels | `ff7ddbdd`, `387b20c8` (dead end `eb860615` reverted by `41495969`), `20f9f31e` |
| WP-1.4 M1 checkpoint (release) | `83e8b4b3` (portraits), `80a9650b`, `7c464176` |
| WP-2.1 switch showcase | `30026fda`, `413d6999`, `6e6fd2a3` |
| Switch-stall fix (shared + lab) | `ea137306` (fix 1, shared model half), `038a8d97` (layer pictures), `3c0f691b` (memo), `dba6430b` (write-up) |
| WP-2.2 focus + feedback | `11c21745`, `0acdc848`, `3422d06c` |
| R1 performance + legibility | `bba4cf5b`, `83c9033a`, `2d043162`, `89c2f1dd`, `80852701`, `5547b519`, `7c3ec0e6`, `df04d0bd` |
| R2 art direction + hero experiments | `ff90df99`, `bfc8f36c` |
| Research package | `cc30d7fc` |
| R3 integration polish | `13c706ad` (presets, near-size clamp, immersive chrome, HUD rail), `1c339064` (crash fix: `moonShader` + layer pictures), `23bedb9c` (Home tilt lab-only), `883b84ed` (R3 report + evidence) |
| Final validation | `adeb4576` (FINAL-VALIDATION + `evidence/13-final`), plus the doc-sync commit that follows it |
| Phone pass (Pixel 6 Pro) | `25f82cdf` (evidence `12-phone` + SurfaceFlinger tooling), plus the results/doc commit that follows it |

## Run / build / test

Follow `RUNBOOK-LAB-B.md` **exactly**, and read `AGENT-RULES.md` first. In short:

- **Target.** The emulator on droid, reached through a private adb tunnel on **port 5039**
  (`adb -P 5039 -s emulator-5554`). Metro runs on **8084** (tmux `orbit-lab-b`, `CI=1`). Never
  touch 5037/8081–8083 (Lab A). Never run `emu-connect` except `status`.
- **Build.** Sync the source to droid (tar over ssh, RUNBOOK §4). Then, once
  `tools/droid-busy.sh` reports idle, run `assembleDebug` / `assembleRelease
  -PreactNativeArchitectures=x86_64` (RUNBOOK §5, §6, §10). `tools/r2-release.sh <tag>` does
  busy-check → sync → release build → `install -r` → launch in one step. A reinstall lands
  on the Digest tab: tap Orrery (≈ 896,2690) before firing deep links.
- **Seed data.** Use a debug build only (RUNBOOK §7, §12). It creates 140 contacts plus the
  Systems "Lab B Dense" (120), "Lab B Inner Circle" (12), "Lab B Work" (30) and "Lab B Stress
  400" / "Lab B Stress 800" (+800 contacts, All Contacts = 940). To keep the data, install the release APK over the seeded debug one
  with `install -r` (same debug keystore).
- **Lab panel.** Long-press the "LAB B" marker (bottom-left) to open it. The first row holds
  the presets (**Lab B best** = defaults, **Ship-safe**, **Everything**, **Legacy**; deep link
  `preset=best|shipSafe|everything|legacy`). It also has the renderer
  A/B (lab ↔ legacy), every effect flag, intensity, reduced-motion override, camera presets,
  quick System switch and slow-mo. It is also scriptable through
  `orbit://labb?preset=…&flags=…&system=…&slowmo=…&rm=…&focus=…&theme=…&zoom=…&yaw=…`
  (RUNBOOK §11–§13). A deep link remounts the Orrery, so press Recentre (≈ 1150,2140) to get
  Home.
- **Gates.**
  - `npx tsc --noEmit`
  - `npx vitest run src/components/orrery src/logic/orrery- src/services/orrery-scene.test.ts src/screens/orrery-screen-framing.test.ts src/theme/accent-foreground-role-contract.test.ts src/theme/art-treatment-scope-contract.test.ts`
  - `npm run check:colors`
  - Biome on the touched files

  Latest results: full suite **554 files / 6 254 tests green** after the last code commit
  (R3-REPORT §8). At HEAD after the final validation, `tsc` is clean, the gate set above
  passes **49 files / 426 tests**, and `check:colors` exits 0 (FINAL-VALIDATION §4).
- **Perf harness.** `tools/r1-matrix.sh`, `r1-perf.sh`, `r1-idle.sh`, `r2-perf.sh`. For
  legibility: `tools/r1-legibility.sh` / `r3-legibility.sh` + `r1-contrast.py`. For art
  captures: `tools/r2-*.sh`. For path checks (north, cluster, far focus, reorder, background
  mid-switch, reduced-motion static): `tools/r3-paths.sh`.

## Evidence

The evidence lives in `evidence/00-baseline` … `evidence/11-r3` and `evidence/13-final`,
about 323 MB, mostly emulator captures at 1280×2856. `evidence/12-phone/` (47 MB) holds the
Pixel 6 Pro pass: the matrix, Perfetto traces (gzipped), the soak and phone screenshots.

- **Best single images:**
  - `evidence/10-r2/before-after-overview.jpg` and `evidence/10-r2/06-final/02-overview-dense.jpg` (the look);
  - `evidence/10-r2/final-switch.jpg` and `evidence/06-wp2.1-switch/27-sheet-dense-to-inner-slowmo20-pass2.jpg` (the switch);
  - `evidence/07-switch-stall/05-sheet-inner-to-dense-before-vs-after-normal-speed.jpg` (the stall fix);
  - `evidence/05-m1-checkpoint/28c-ab-legacy-left-vs-lab-right.png` (legacy vs lab).
  - `evidence/11-r3/05-final/presets-02-overview-dense.jpg` and `presets-05-focus-cleo.jpg`
    (best / ship-safe / everything / legacy side by side);
  - `evidence/13-final/02-shots/sheet-a.jpg`, `sheet-c.jpg` (final release, preset best,
    all four themes).
- **Best clips:**
  - `evidence/06-wp2.1-switch/01-first-switch-after-cold-launch-work-to-inner-normal-speed.mp4`;
  - `evidence/07-switch-stall/03-AFTER-3c0f691b-inner-to-dense-normal-speed.mp4`;
  - `evidence/08-wp2.2-focus/10-release-focus-flyin-lock-ripple-ping.mp4`;
  - `evidence/09-r1/shots/06-release-switch-inner-to-stress800-opaque.mp4`.
  - `evidence/13-final/04-switching/switch-inner-to-stress400.mp4` (final, preset best);
  - `evidence/13-final/01-polaris/best-polaris-tap-north.mp4` (Polaris tap → north).

---

## R3 integration polish (done)

Detail: `research/R3-REPORT.md`. Evidence: `evidence/11-r3/`.

- **Commits:** `13c706ad`, `1c339064`, `23bedb9c`, `883b84ed`.
- **What changed:**
  - presets (Lab B best = registry defaults, Ship-safe, Everything, Legacy) in the panel and
    by deep link;
  - `nearSizeClamp` (default ON, C-71): drawn size knee'd at +6 % from perspective, soft cap
    at 8 % of the short side, applied to the frame so hits, labels and the reticle agree;
  - `immersiveChrome` (default ON, C-72): the map runs under a floating header on a token
    scrim, and the three controls become one HUD rail;
  - Home tilt is lab-renderer-only, so Legacy = production Home;
  - crash fix: `moonShader` + layer pictures.
- **Gates:** `tsc` clean; orrery vitest 722/722; full suite 554 files / 6 254 tests;
  `check:colors` 0; Biome clean on 23 touched files.
- **Effect on the package:** Ship-safe membership is a lab judgement (C-73). Legibility was
  re-measured with the R2 stage on, with no regression. Standard Dark glass `textSecondary`
  is 4.42 (model) and stays an owner gate (GLASS). New owner items: CLAMP, IMMERSE,
  SHIPSAFE (OWNER-REVIEW). Emulator cost: Ship-safe is the only preset that separates from
  noise (p50 18–20 ms vs 23–26 ms), because `ringFlow` re-records the rings picture on
  every tick.

## Final validation (done)

`research/FINAL-VALIDATION.md`, evidence `evidence/13-final/`, on a release build from HEAD
with preset **Lab B best**. Every item on the contract's exercise list passes on the
emulator. Pinch, twist and two-finger tilt cannot be injected through adb, so zoom and yaw
were driven through the `recover` path.

- **Polaris:** R3's open item ("tap fires the flare but the camera does not turn") was a
  capture artifact. The recovery finishes in under 0.85 s, before a screenrecord started
  after the tap could begin. Legacy and lab both rotate to north, as the dossier requires
  (tap = yaw only).
- **Lifecycle:** frames drop to 0 on another tab and in the background, and resume on
  return.
- **New bug, pre-existing on `main`, not fixed here:** after a cold start, the System
  selector reads "Unavailable System" when the last System is a custom one.

## Pixel phone pass (2026-10-01)

Done on the owner's Pixel 6 Pro (Mali-G78, 120 Hz). The build was release arm64 from HEAD,
with the opaque canvas, and frames were counted from SurfaceFlinger presents.

- Full report: `research/PHONE-PASS-RESULTS.md`.
- Tables: `PERFORMANCE.md` §9.
- Evidence: `evidence/12-phone/`.

Presented fps at Dense 120, idle / pan:

| Configuration | Idle | Pan |
|---|---|---|
| Lab B best | 3.2 | 8.4 |
| Ship-safe | 26 | 20 |
| Everything | 23 | 24 |
| **best − Home tilt** | **99** | **81** |
| Legacy (production renderer) | 5.0 | 3.5 |

At 400 bodies: best 18 fps, untilted 95 fps, and Legacy **ANRs**.

**The cause.** The orbit rings and progress wakes are stroked as world circles under the
tilted plane's perspective matrix. The GPU sits at 99.7 %, and the UI thread waits about
150 ms per frame in `eglSwapBuffers`.

**What still held:**

- every RuntimeEffect compiled on Mali;
- no shader artefacts;
- the opaque canvas composites correctly and beats TextureView;
- reduced motion gives 0 presents and 0 changed pixels;
- lifecycle gives 0 frames on another tab or in the background;
- no native crash at 800;
- the Hermes `Intl.Segmenter` initials gap reproduces (legacy "El…").

**Thermal and power** (5 min, best, Dense):

- thermal status 1, skin 40.9 → 42.3 °C;
- net battery drain even on USB;
- about 36 mAh / 5 min (estimate, almost all GPU);
- PSS 1.44 GB.

**Not covered:** real multi-touch (adb is single-pointer) and the physical OLED look (owner
glance).
