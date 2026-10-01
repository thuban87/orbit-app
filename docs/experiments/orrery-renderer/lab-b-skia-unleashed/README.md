# Orrery Lab B — "Skia Unleashed" (Deep Field Cartography)

**Goal.** Find the practical visual ceiling of React Native Skia for Orbit's Orrery. The work
stays inside the real app, uses the real scene/world/frame pipeline and keeps the product
semantics (Gravity, Frequency, Systems, sun, photos and initials, satellites, focus, semantic
zoom, labels, switching, reorder, reduced motion, themes, high counts, lifecycle). Visual
discovery came first. Every effect is sorted into one of four buckets: worth shipping, worth
simplifying, beautiful but too costly, or failed. Every production compromise is written
down.

**Status (2026-10-01).** M1, M2, R1 (performance and legibility) and R2 (art direction and
hero experiments) are complete on the **desktop emulator only**. Two things are still open:

- **R3 polish pass — PENDING.** Another agent is running it now (see the placeholder below).
- **Physical Pixel phone pass — PENDING.** Lab A held the phone for the whole lab, so every
  performance number in this package is *emulator-relative*. The script is ready:
  `research/PHONE-PASS-SCRIPT.md`.

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
| `PERFORMANCE.md` | The envelope (12 → 940 bodies), bottlenecks and risks. Emulator-relative only. |
| `ARCHITECTURE.md` / `IMPLEMENTATION.md` | How the renderer is built and where everything lives. |
| `VISUAL-DESIGN.md` / `INTERACTIONS.md` | The look and the motion/camera/focus/switch behaviour. |
| `DECISIONS.md` / `DEAD-ENDS.md` | The chronological story and the rejected ideas. |
| `PRODUCTIONIZATION.md` | What shipping any of this would take. |
| `ASSET-MANIFEST.md` | Every added asset (16 test portraits, all procedural otherwise). |
| `research/` | Raw working logs: 01–03 research, DECISIONS-LOG, COMPROMISES-LOG (C-01…C-70), DEAD-ENDS-LOG, PERF-LOG, M1-CRITIQUE, SWITCH-STALL-INVESTIGATION, R1-REPORT, R2-REPORT, PHONE-PASS-SCRIPT. These are the source of truth the package summarises. |
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
| R3 polish | **PENDING (placeholder, see below)** |
| Research package (this) | the commit that adds this file |

## Run / build / test

Follow `RUNBOOK-LAB-B.md` **exactly**, and read `AGENT-RULES.md` first. In short:

- **Target.** The emulator on droid, reached through a private adb tunnel on **port 5039**
  (`adb -P 5039 -s emulator-5554`). Metro runs on **8084** (tmux `orbit-lab-b`, `CI=1`). Never
  touch 5037/8081–8083 (Lab A). Never run `emu-connect` except `status`.
- **Build.** On droid, after `tools/droid-busy.sh` reports idle, run
  `assembleDebug` / `assembleRelease -PreactNativeArchitectures=x86_64` (RUNBOOK §4–§6, §10).
- **Seed data.** Use a debug build only (RUNBOOK §7, §12). It creates 140 contacts plus the
  Systems "Lab B Dense" (120), "Inner Circle" (12), "Work" (30) and "Stress 400"/"Stress 800"
  (All Contacts = 940). To keep the data, install the release APK over the seeded debug one
  with `install -r` (same debug keystore).
- **Lab panel.** Long-press the "LAB B" marker (bottom-left) to open it. It has the renderer
  A/B (lab ↔ legacy), every effect flag, intensity, reduced-motion override, camera presets,
  quick System switch and slow-mo. It is also scriptable through
  `orbit://labb?flags=…&system=…&slowmo=…&rm=…&focus=…&theme=…` (RUNBOOK §11–§13).
- **Gates.**
  - `npx tsc --noEmit`
  - `npx vitest run src/components/orrery src/logic/orrery- src/services/orrery-scene.test.ts src/screens/orrery-screen-framing.test.ts src/theme/accent-foreground-role-contract.test.ts src/theme/art-treatment-scope-contract.test.ts`
  - `npm run check:colors`
  - Biome on the touched files

  The last full-suite result recorded is at R1: 551 files / 6 237 tests green, `tsc` clean
  (R1-REPORT §2). R2 did not record its gate results.
- **Perf harness.** `tools/r1-matrix.sh`, `r1-perf.sh`, `r1-idle.sh`, `r2-perf.sh`. For
  legibility: `tools/r1-legibility.sh` + `r1-contrast.py`. For art captures: `tools/r2-*.sh`.

## Evidence

The evidence lives in `evidence/00-baseline` … `evidence/10-r2`, about 259 MB, mostly
emulator captures at 1280×2856.

- **Best single images:**
  - `evidence/10-r2/before-after-overview.jpg` and `evidence/10-r2/06-final/02-overview-dense.jpg` (the look);
  - `evidence/10-r2/final-switch.jpg` and `evidence/06-wp2.1-switch/27-sheet-dense-to-inner-slowmo20-pass2.jpg` (the switch);
  - `evidence/07-switch-stall/05-sheet-inner-to-dense-before-vs-after-normal-speed.jpg` (the stall fix);
  - `evidence/05-m1-checkpoint/28c-ab-legacy-left-vs-lab-right.png` (legacy vs lab).
- **Best clips:**
  - `evidence/06-wp2.1-switch/01-first-switch-after-cold-launch-work-to-inner-normal-speed.mp4`;
  - `evidence/07-switch-stall/03-AFTER-3c0f691b-inner-to-dense-normal-speed.mp4`;
  - `evidence/08-wp2.2-focus/10-release-focus-flyin-lock-ripple-ping.mp4`;
  - `evidence/09-r1/shots/06-release-switch-inner-to-stress800-opaque.mp4`.

---

## PLACEHOLDER — R3 polish pass (to be filled by the R3 agent)

> **Status: PENDING.** R3 is editing `src/components/orrery/labb/` concurrently with this
> package. Fill in once it lands:
> - commits: _TBD_
> - what changed (flags/defaults/tunables): _TBD_
> - evidence folder: `evidence/11-r3/` (_TBD_)
> - gate results (tsc / vitest / check:colors / Biome): _TBD_
> - effect on HARVEST verdicts, OWNER-REVIEW items, PERFORMANCE: _TBD_
>
> Nothing in this package describes R3 work. Where R3 changes a default, a tunable or a
> verdict, the affected section must be updated rather than appended to.

## PLACEHOLDER — Pixel phone pass (to be filled after the owner releases the phone)

> **Status: PENDING.** Script: `research/PHONE-PASS-SCRIPT.md`. It needs arm64 builds, the
> local adb server (5037) **only after Lab A is done**, Perfetto, framestats, SurfaceFlinger
> latency, meminfo and a 10-min thermal/battery soak.
>
> Results go in `evidence/10-phone/` (the script's path; consider renaming it to avoid
> confusion with `10-r2`) and in `PERFORMANCE.md` §9.
>
> The script does **not yet** cover the R2 stage flags: add rows for `planeLight`/`planeGrid`
> off and for `bloom` on (see PERFORMANCE.md §9).
