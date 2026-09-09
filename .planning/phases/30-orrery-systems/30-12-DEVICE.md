# Phase 30 Plan 12 — Physical Pixel evidence

Date: 2026-09-09 (America/Chicago)

## Candidate and topology

- Source baseline: `7bdf2a2` plus the Task-2 persistence-publication fix committed with this evidence.
- Device selected from live SDK-adb output: serial `1A071FDEE002BU`, `model:Pixel_6_Pro`, product/device `raven`; exactly one authorized physical device was present.
- ADB client: `~/.local/bin/adb` (SDK client, never Debian adb).
- Orbit Metro: tmux `orbit:1.0`, local `http://127.0.0.1:8082/status` returned `packager-status:running`.
- During debug testing the effective device-to-host mapping was `UsbFfs tcp:8081 tcp:8082`. The plan's literal `8082>8082` mapping does not serve a standard React Native debug client, which requests device port 8081; the initial literal attempt produced the expected connection failure and was replaced with the working 8081-to-8082 mapping.
- Final restored reverse: `UsbFfs tcp:8081 tcp:8081`.
- Android animation settings were restored to `animator_duration_scale=1`, `transition_animation_scale=1`, and `window_animation_scale=1`.

## Build and install

The marker check for `C:\Users\bwales\projects\orbit-app\HANDOFF.md` returned `MARKER_OK`. Current source was transported with tar-over-SSH excluding `.git`, `.planning`, `node_modules`, `android`, `ios`, and `.expo`.

- Final debug build: `gradlew.bat assembleDebug --console=plain`, `BUILD SUCCESSFUL`, 847 tasks; copied to `/tmp/orbit-30-12-app-debug-final.apk` (332 MiB) and installed with `adb install -r` (`Success`).
- Final release build: `gradlew.bat assembleRelease --console=plain`, `BUILD SUCCESSFUL in 1m 9s`, 1070 tasks.
- Release retained on droid: `C:\Users\bwales\projects\orbit-app\android\app\build\outputs\apk\release\app-release.apk`
- Release size/time: 193,581,167 bytes; 2026-09-09 00:35 local.
- Release SHA-256: `170a84eda17d119317bf5a21ed4142eb21f943a4dc5183fd44a6d8e668710df2`.

## Fixture preparation

The attached debug database originally had six tracked active contacts, two favorites, and no category assignments, so it could not exercise the requested membership matrix. Before fixture edits, the exact database trio was saved locally as:

- `/tmp/orbit-30-12-original.db`
- `/tmp/orbit-30-12-original.db-wal`
- `/tmp/orbit-30-12-original.db-shm`

The device-only UAT fixture used existing contacts and produced:

| System | IDs | Count |
| --- | --- | ---: |
| All Contacts | 1, 2, 3, 4, 5, 18, 19, 20, 21 | 9 |
| Favorites | 1, 2, 3, 4, 5, 18, 19, 20 | 8 |
| Family | 1, 2, 3 | 3 |
| Work | 4, 5, 18 | 3 |
| Friends | 19, 20, 21 | 3 |

IDs 3, 4, and 5 were made tracked/active and category assignments were added only in the debug database. The fixture was intentionally left in place for the owner's release check; the exact pre-test database remains recoverable from the paths above.

## Runtime defect found and repaired

The first physical recordings reproduced the reported two-or-three-step result even though the UI-thread driver was configured for 2100 ms. The store subscription in `OrreryScreen` treated Zustand's persistence-only `saving` and `saved` publications as new scene publications. The first ready publication started the full choreography, then the next persistence publication immediately replaced it with a settled runtime because it carried no switch-source IDs.

`shouldPublishSwitchScene` now filters publications by status, generation, and snapshot identity before the screen publishes into the UI-thread runtime. A regression proves persistence-only changes cannot reset a running switch while real loading/generation/snapshot changes still publish. No per-frame React state was introduced.

Diagnostic pre-fix recordings:

- `/tmp/orbit-30-12-evidence/normal-3-to-9.mp4`
- `/tmp/orbit-30-12-evidence/normal-9-to-3.mp4`

## Normal-motion results

Normal duration is 2100 ms. Phase boundaries remain accelerate 0–0.20; shed 0.18–0.58; capture 0.44–0.82; settle from 0.72. Radial displacement is 52–170 px, stagger window 0.035, and destination input becomes authoritative at capture completion (0.82).

| Fixture | Delta / intensity | Pixel observation | Recording |
| --- | --- | --- | --- |
| Family 3 -> All 9 | overlap 3, enter 6, leave 0; 0.50; 2 turns | Retained bodies rotate continuously; entering contacts stream/capture; camera expands and settles exactly | `/tmp/orbit-30-12-evidence/normal-3-to-9-fixed.mp4` |
| All 9 -> Family 3 | overlap 3, enter 0, leave 6; 0.50; 2 turns | Leaving bodies peel outward and fade while retained bodies continue; exact three-body Home settle | `/tmp/orbit-30-12-evidence/normal-9-to-3-fixed.mp4` |
| All 9 -> Favorites 8 | overlap 8, enter 0, leave 1; 0.0588; 1 turn | Restrained single departure and visibly lower drama than the turnover fixtures | `/tmp/orbit-30-12-evidence/high-overlap.mp4` |
| Family 3 -> Friends 3 | overlap 0, enter 3, leave 3; 1.0; 3 turns | Strongest rotational impulse; all old bodies shed and all new bodies stream/capture | `/tmp/orbit-30-12-evidence/near-disjoint-family-friends.mp4` |
| Favorites non-Home -> Family Home | arbitrary panned camera -> canonical destination | First animated sample retains the displaced projection; camera and bodies move continuously into exact Family Home without a completion snap | `/tmp/orbit-30-12-evidence/nonhome-to-home.mp4` |
| Friends -> Favorites with ID 20 focused | retained focus | ID 20 remained focused with the blue focus ring/card after the switch | `/tmp/orbit-30-12-evidence/retained-focus-after.png` |

All recordings above were inspected at normal speed. Supporting cadence sheets were generated only to locate phase boundaries. The fixed paths show continuous per-frame movement, not React publication steps, and no constant tuning beyond the Plan-11/12 values was needed after repairing the reset.

## Re-target and lifecycle

- Rapid Family -> All -> Friends interaction completed at Friends without a geometry snap or stale departing focus/hit state. Device capture: `/tmp/orbit-30-12-evidence/rapid-retarget.mp4`. Deterministic runtime coverage additionally asserts that C starts from B's displayed sample.
- Blur/remount: switching to Family, navigating to Dashboard, then remounting Orrery retained the displayed sample and resumed to exact Family Home. Capture: `/tmp/orbit-30-12-evidence/blur-resume.mp4`.
- Background/remount: Home/background and launcher resume returned to the same displayed All sample and settled without a remount snap. Capture: `/tmp/orbit-30-12-evidence/background-resume.mp4`.
- Destination input and stale-hit authority were exercised by focusing destination ID 20 after settle; departing bodies were not focusable during shed. Deterministic tests cover immediate departure inertness and the 0.82 destination interaction threshold.

## Reduced Motion note

The Reduced Motion branch is 180 ms and the deterministic renderer/runtime tests prove non-rotational crossfade/reposition with the same exact lifecycle and Home boundaries. Four physical automation attempts set `animator_duration_scale=0` and cold-started the app. On this debug build, opening the System selector succeeded but adb-injected presses on its scroll rows did not activate until animator scale was restored, so `/tmp/orbit-30-12-evidence/reduced-motion.mp4` is retained as diagnostic input evidence and is **not** represented as a successful motion recording. The setting was restored to 1. This remains an explicit owner check in Task 3 rather than a fabricated executor pass.

## Automated validation

- Focused choreography/frame/runtime/mapper/camera/session/store suite: 8 files, 55 tests passed.
- `npx tsc --noEmit --pretty false`: passed.
- Biome on the three Task-2-touched source/test files: passed.
- `npm run check:colors`: passed.
- Full suite: 292 files / 2694 tests; 290 files and 2690 tests passed. Three pre-existing `orrery-preferences.test.ts` assertions still expect migration target 22 while source is 23. One concurrent-load timeout in `orrery-screen-framing.test.ts` passed immediately when rerun alone (2/2), confirming it was a full-suite load flake rather than a Task-2 regression.

ORRS-13 and Phase 30 remain incomplete pending explicit owner approval at Task 3.
