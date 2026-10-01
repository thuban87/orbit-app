# Lab A final evidence set: index

**Build:** RELEASE APK of `6ad5a307` (`com.bwales.orbit.laba`, not debuggable, embedded JS).
**Device:** Pixel 6 Pro, 120 Hz.
**Renderer:** Lab A, unless a file says otherwise.
**Data:** seeded Lab data. All Contacts has 40 contacts; Lab Dense has 32; Lab Inner Circle has 3. Satellites are on.
**Default palette:** Galaxy, dark.

The DEV Lab marker is hidden in release. That is expected.

Performance write-up: [`PERF-RESULTS.md`](PERF-RESULTS.md).

## Stills

| File | Caption |
|---|---|
| `01-overview-all-contacts-galaxy-dark.jpg` | All Contacts home view (Recenter), Galaxy dark. |
| `02-overview-all-contacts-galaxy-light.jpg` | The same view, Galaxy light. |
| `03-overview-all-contacts-standard-dark.jpg` | The same view, Standard dark. |
| `04-overview-all-contacts-standard-light.jpg` | The same view, Standard light. |
| `10-focus-photo-contact-ben-okafor.jpg` | Focus on a photo contact (Ben Okafor): reticle, label plate, narrow card beside the controls. Ada Park's moons are visible. |
| `11-focus-moon-tom-satellite-of-clara.jpg` | Focus on a satellite (moon "Tom", Clara Ruiz's spouse): moon reticle and moon card. The card covers Clara's disc and runs under the FAB column. |
| `12-identity-zoom-via-focus-clara-ruiz.jpg` | Identity zoom reached through focus (Clara Ruiz): name plates on neighbours, lit ring, reticle, card with the relationship row. |
| `20-system-lab-dense.jpg` | Lab Dense (32) settled. The home framing does not fit the whole sky, so outer bodies are off-screen. |
| `21-system-lab-inner-circle.jpg` | Lab Inner Circle (3) settled, with the dial ring and photos/initials resolved. |
| `40-side-by-side-overview-legacy-vs-lab-a.jpg` | The same overview, same camera and same release process: legacy flat renderer (left) and Lab A (right). |
| `41-side-by-side-focus-clara-legacy-vs-lab-a.jpg` | Focus on Clara Ruiz: legacy (left) and Lab A (right). |

## Screen recordings (720×1560, each ≤ 10 s) and their tap-relative contact sheets

| File | Caption |
|---|---|
| `30-switch-all-to-lab-dense.mp4` | All → Lab Dense. The sheet closes at +0.17 s; the choreography settles at ≈+2.6 s, at about 3–4 visible fps. |
| `30-switch-all-to-lab-dense-sheet.jpg` | Frames at tap+0 … +7 s, labelled. |
| `31-switch-lab-dense-to-inner-circle.mp4` | Lab Dense → Inner Circle. The motion settles at ≈+2.5 s with **arrival ghosts**. Real discs, photos and the dial ring only resolve at **≈+8.7 s**: the late-identity residual, still present in release. |
| `31-switch-lab-dense-to-inner-circle-sheet.jpg` | Frames at tap+0 … +8.85 s, labelled; ghosts until +8.6 s, then identity. |
| `32-focus-lock-on-clara.mp4` | Focus tap on Clara Ruiz. Nothing changes for ≈3 s, then the camera lands in 2–3 frames, the card appears at +3.0–3.2 s, the reticle locks on at ≈+3.45 s and labels arrive at ≈+3.8 s. |
| `32-focus-lock-on-clara-sheet.jpg` | Frames at tap+0 … +8 s, labelled. |
| `33-reduced-motion-switch-all-to-lab-dense.mp4` | With `transition_animation_scale=0`: Clara is still focused in All Contacts → Lab Dense. The scene cuts to the settled destination within ≈0.5–0.75 s, with no flight. |
| `33-reduced-motion-switch-sheet.jpg` | Frames at tap+0 … +6.8 s, labelled. |

## Performance data (`perf/`)

| Path | Contents |
|---|---|
| `perf/raw/idle-{legacy,lab}-{1,2,3}.*` | 10 s idle on the overview: `gfx.txt` (gfxinfo), `fs.txt` (framestats), `json` (parsed). |
| `perf/raw/pan-{legacy,lab}-{1,2,3}.*` | 10 s scripted pan; same three files. |
| `perf/raw/rm-idle-{legacy,lab}-{1,2,3}.*` | 10 s idle under reduced motion. Legacy produced 0 frames. |
| `perf/raw/sw-{legacy,lab}-{a2d,d2i,i2a}-{1,2,3}.*` | System switches (All→Dense, Dense→Inner, Inner→All): gfxinfo and framestats over each 12 s recording, plus the device-clock tap stamp (`tap.txt`) and the screenrecord log (`rec.txt`). |
| `perf/raw/fo-{legacy,lab}-{1..6}.*` | Focus-tap runs: gfxinfo, framestats, tap stamp; logcat for runs 4–6. |
| `perf/raw/switch-timelines.jsonl`, `focus-timelines.jsonl` | Tap-relative content-change timelines, derived from the mp4s (which are not committed). |
| `perf/raw/mem-*.meminfo.txt` | `dumpsys meminfo` after load and after 10, 20 and 30 switches, both renderers. |
| `perf/raw/soak-*.{thermal,battery}.txt`, `soak-lab.*` | Thermal service, battery and gfxinfo before and after the 2-minute Lab A soak. |
| `perf/tools/` | `gfxparse.py` (gfxinfo/framestats → JSON), `vfps.py` (video frame/change counter), `swan.py` / `swsum.py` (tap-relative timeline and switch summary), `lib.sh` (the drivers used), `pf.cfg` (the Perfetto config). |
| `perf/trace-lab-switch-all-to-dense.pftrace` | Perfetto system trace of one Lab A All → Lab Dense switch. **Not analysed:** trace_processor does not run on this box's CPU. Open it at ui.perfetto.dev. |
