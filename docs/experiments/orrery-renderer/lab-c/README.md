# Orrery Lab C — TRUE 3D (research package)

**Goal.** Test the hypothesis that a *real* GPU 3D renderer (perspective camera, depth buffer, lit
geometry, fog, instancing) makes the Orrery feel like a polished space-strategy star-system map, while
keeping Orbit's product semantics (Gravity, Frequency, Systems, sun, contacts and photos, satellites,
focus, semantic labels, switching, reduced motion, themes, lifecycle). The rules are in
`docs/orrery-investigation/ORRERY-EXPERIMENT-CONTRACT.md`.

**Status.** Done as an R&D prototype on 2026-10-01. It runs in the real app on a Pixel 6 Pro, in debug
and arm64 release builds. It is **not for merging**: the branch is disposable, and the ideas worth
keeping are in [HARVEST.md](HARVEST.md). The verdict is in [RECOMMENDATIONS.md](RECOMMENDATIONS.md).

| | |
|---|---|
| Branch | `experiment/orrery-3d` (local only, never pushed) |
| Worktree | `/home/bwales/projects/orbit-orrery-lab-c` |
| Renderer | three.js `0.186.1` `WebGPURenderer` on `react-native-webgpu` `0.10.4` (Dawn to Vulkan, Mali-G78) |
| App identity | `com.bwales.orbit.labc`, launcher name "Orbit Lab C", scheme `orbitlabc`. Installs beside the real app |
| Switch | `LAB_C_TRUE_3D = true` in `src/screens/OrreryScreen.tsx` (`World = LAB_C_TRUE_3D ? OrreryWorld3D : OrreryWorld`) |

## Package

| Doc | What it holds |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Renderer, data flow, dependencies and native consequences, lifecycle, animation model |
| [VISUAL-DESIGN.md](VISUAL-DESIGN.md) | Visual language, tunables, and how 3D compares with the Skia 2.5D Orrery (better and worse) |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Files, functions, TSL shaders and algorithms, with commits |
| [INTERACTIONS.md](INTERACTIONS.md) | Camera, gestures, focus, zoom, switching, reduced motion |
| [PERFORMANCE.md](PERFORMANCE.md) | Summary table (debug vs release, thermal state), then every measurement taken |
| [ASSET-MANIFEST.md](ASSET-MANIFEST.md) | Every generated texture and atlas. No external assets, Codex not used |
| [DECISIONS.md](DECISIONS.md) | Chronological log of what changed and why |
| [DEAD-ENDS.md](DEAD-ENDS.md) | Ideas that were rejected or reverted |
| [HARVEST.md](HARVEST.md) | Ideas worth keeping, each with verdict, location, evidence, and what V2 should preserve |
| [PRODUCTIONIZATION.md](PRODUCTIONIZATION.md) | What it would take to ship |
| [RECOMMENDATIONS.md](RECOMMENDATIONS.md) | Verdict, carry-forward and reject lists, and what to do with one more day |
| [RUNBOOK-LAB-C.md](RUNBOOK-LAB-C.md) | Exact build, sync, install, seed, log and release steps |
| [RENDERER-DECISION.md](RENDERER-DECISION.md) | Renderer survey and the choice of three.js WebGPU over the alternatives |
| [research/CURRENT-ORRERY.md](research/CURRENT-ORRERY.md) | Brief on the production Skia Orrery that the lab replaced at one seam |
| [_notes/A11Y.md](_notes/A11Y.md) | Accessibility check on the release build |

## Key commits (chronological, `git log --oneline main..HEAD`)

| Commit | What |
|---|---|
| `1ea58dd0` | Shared experiment contract |
| `167bbcaa` | Renderer decision note, current-Orrery brief, droid busy probe |
| `38616b7c` | Lab app identity (`com.bwales.orbit.labc` / "Orbit Lab C" / `orbitlabc`). Pins `react-native-webgpu 0.10.4`, `three 0.186.1`, `@types/three 0.186.0` |
| `c830da0a` | Dev-only synthetic seed through real write paths (200 contacts; Systems Lab C Core 40 / Inner 17 / Dense 120; satellites) |
| `205c1462` | First true-3D `OrreryWorld3D` on three WebGPU, plus the minSdk-26 plugin. Camera matched the 2.5D view pixel for pixel ("parity camera"). **Dead end:** it looked 2.5D |
| `fff81462` | WIP remount/device-lost bisect state. Superseded |
| `da5433a9` | Real perspective camera (F = 720 px, dolly F/zoom, tilt about 62°) and depth cues (lit spheres, fog, ring falloff, star sphere, corona) |
| `c0fc5882` | Strategy-map camera: one finger orbits with inertia, two fingers pan |
| `823bd69f` | Centred 3D framing, hero contacts (×1.9), label tiers re-derived for the perspective camera |
| `0219e4a8` | Strategy-map composition (lens shift), granulated star with occupant medallion, orbital-plane grid |
| `ca131870` | Strategy-camera tests. Root cause of the "Unavailable System" bug documented |
| `f608d35d` | "Unavailable System" fix (**lab only**; the bug exists on main too) |
| `64858959` | 3D System switch: departing bodies fall away, arriving bodies streak in with a ring flare, camera "breath" |
| `ba48c76c` | Sun medallion: shaded plate with initials or a person glyph |
| `c5533857` | Performance: baked plane and star noise, lighter geometry, DPR cap 2.0 |
| `84f5d646` → `9ae99523` | Whole-disc Home fit for large Systems, then reverted (**dead end**). Ring density fade kept |
| `7dd23580` | Dense legibility: core framing, minimum on-screen body size, top-inset fade, stronger ring fade |
| `20ae3596` | Satellites as 3D moons on tilted orbits. Lift-aware hit projection |
| `cc2ec75e` | Lifecycle pass: Hermes external memory climbs per mount (recorded) |
| `f1d9b310` | Per-tile atlas snapshot. Leak diagnosis: mostly GC-pending Paragraph pressure, PSS about flat |
| `e4d9e842` | Shared ParagraphBuilder plus Paragraph cache: external memory 1569 → 297 MB at mount |
| `97d94229` | Satellite focus framing, lit moons with face tiles, padded label exclusions. Moon tap verified |
| `eb94bd45` | Reduced motion verified on device |
| `4ece2978`, `7d558d87` | Focus card docked at the canvas bottom, system framed above it. Card clears the FAB column, moon readability |
| `2ca56317` | Light-theme profile (fog, blending, ambient, ring floor) |
| `467b973b` | 2.5D-camera tests rewritten for the 3D dolly camera |
| `1d052ca2` | E.1 re-measure: releasing buffers at dispose does not move the per-mount floor |
| `c7fcbe80` | F.1 release build: APK and WebGPU library sizes |
| `334a561e` | F.2 release performance |
| `567c120d` | F.3 accessibility on release |
| `4a82ae85` | Fix: lab tilt presets re-capture the home zoom after a System switch |
| `5abe6016`, `6c1d3c68` | F.4 final release evidence and its README |
| *(this package)* | Research package docs |

## Run / build / test

Everything is in [RUNBOOK-LAB-C.md](RUNBOOK-LAB-C.md). Do not improvise. In short:

1. **Metro** on port 8085 in tmux session `orbit-lab-c` (`CI=1`), then `adb reverse tcp:8081 tcp:8085` (§1).
2. **Sync source to droid** with tar over ssh, because droid has no rsync. Exclude `node_modules`, `android`,
   `ios`, `.git`, `.expo`, `.planning` and `docs` (§2). Target dir: `C:\Users\bwales\projects\orbit-lab-c`.
3. **Build on droid** after the busy probe (`tools/droid-busy.sh`). Run `npm ci` only when dependencies change,
   `expo prebuild --clean` only when native config changes, then
   `gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (§3).
4. **Pull with scp, `install -r`, launch** (§4). A debug launch seeds the fixture automatically (§5).
5. **Release:** `assembleRelease` with the same signer, installed over the seeded debug app with `install -r` (§8).
   Release arm64 APK: 102.9 MB.
6. **Tests:** `npx vitest run src/logic src/components/orrery src/screens/orrery-screen-framing.test.ts` and
   `npx tsc --noEmit`. At df8479b6: tsc clean, 733/733 pass (the 2 framing-test failures from the
   lab-only "Unavailable System" effect reading `requested.ref.kind` were fixed with a `ref?.kind` guard).

## Evidence index (best shot or recording per aspect)

All paths are relative to `evidence/`. Shots in `08-final/` come from the **release** build. Earlier
folders come from debug builds. `01-m1/` is an untracked local folder from the M1 spike and is not
part of the package.

| Aspect | Best evidence |
|---|---|
| Overview, small System | `08-final/02-inner-overview.png` |
| Overview, dense System (120) | `08-final/01-dense-overview.png` (compare `04-checkpoint-c/07-dense-overview.png` before D.1) |
| Zoom tiers (near / close) | `08-final/03b-inner-near-x2.2.png`, `08-final/04b-inner-close-x3.4.png`; labels by tier `03-checkpoint-b/04…06-*.png` |
| Orbit camera, swung angle | `08-final/06-dense-orbit-swung-tilt1.2-yaw3.8.png`; motion `08-final/rec-02-orbit-drag-then-focus-fly-in-14s.mp4` |
| Focus fly-in, docked card | `08-final/05a-dense-focus-fly-in-ava-abara.png`, `rec-02-…mp4` |
| Satellites (moons) | `08-final/05b-dense-focus-chloe-with-moons-dana-cy.png`; moon tap `07-checkpoint-e/s2-moon-tap-attempt.png` + `s2-moon-tap-uiautomator.txt` |
| System switch (motion) | `08-final/rec-01-system-switch-inner-to-dense-12s.mp4`; debug `04-checkpoint-c/03-switch-dense-to-inner.mp4`; mid-frames `04-checkpoint-c/04-switch-mid-t*.png` |
| Sun / star medallion | `04-checkpoint-c/06-sun-occupant-glyph-close.png`, `03-checkpoint-b/11-visual-sun-granulated-star-medallion-close.png` |
| Light theme | before `07-checkpoint-e/s7-galaxy-light-overview.png`, after `08-final/07a-galaxy-light-dense-overview.png`, `07b-…focus…png` |
| Reduced motion | `07-checkpoint-e/s4-reduced-focus-moon-t0.png` / `-t5s.png` (pixel-identical), `s4-reduced-motion-log.txt` |
| Dense dead end (whole-disc fit) | `04-checkpoint-c/10-dense-overview-whole-disc-fit.png` |
| First real-camera build (da5433a9) vs lit v2 | `02-real-3d/01-overview-default.png` vs `02-real-3d/06-v2-overview-lit-spheres-corona.png`. No screenshot of the parity camera itself (205c1462) is committed: the M1 shots live only in the untracked `01-m1/` |
| "Unavailable System" bug (pre-existing on main) | before: `02-real-3d/01-overview-default.png` (selector reads "Unavailable Sy…"); after the lab fix: `04-checkpoint-c/01-system-name-restored-lab-c-inner.png` |
| Performance logs | `08-final/f2-release-perf-session-log.txt`, `f2b-…`, `f2-release-gfxinfo-meminfo.txt` |
| Memory / leak | `06-leak/mount-log-after.txt`, `07-checkpoint-e/s1-paragraph-cache-mount-log.txt`, `s2-focus-moon-mount-log.txt` |
| Accessibility | `08-final/a11y-*`, `_notes/A11Y.md` |

## Owner hands-on checklist (only what needs the owner)

These cannot be driven with adb, or they are a judgment only the owner can make. Use the **release**
build already installed on the Pixel 6 Pro (`com.bwales.orbit.labc`).

1. **Two-finger gestures.** Pinch to dolly in and out, two-finger drag to pan, two-finger twist to yaw. Do they
   feel right next to one-finger orbit? adb cannot inject multi-touch, so these were never exercised on device.
2. **TalkBack swipe navigation.** Turn on TalkBack and swipe through the Orrery's controls (selector, View options,
   Contacts, Recenter, Reset north, focus card). Injected swipes orbited the camera instead of moving TalkBack focus
   (`_notes/A11Y.md` §3).
3. **Overall feel.** Do overview, orbiting, focus fly-in and System switching feel like a better product than the
   Skia Orrery, and better enough to justify a new 20.6 MB native dependency? This is the call RECOMMENDATIONS.md
   needs from you.
