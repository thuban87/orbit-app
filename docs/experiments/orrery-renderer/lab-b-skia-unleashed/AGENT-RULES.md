# Lab B — rules for every agent (read before doing anything)

Worktree: `/home/bwales/projects/orbit-orrery-lab-b`, branch `experiment/orrery-skia-unleashed`.

## Git / filesystem
- NEVER run any `git worktree` command (a hook blocks it; do not route around it).
- Never push, never use anything that pushes. Commit locally, on this branch, coherent messages, NO AI attribution trailers.
- Never touch `/home/bwales/projects/orbit-app` (primary checkout) or Lab A's directories (`orbit-orrery-lab-a*`) on this box or on droid.
- Before committing, verify `pwd` and `git branch --show-current` == `experiment/orrery-skia-unleashed`.
- Never use bare `git stash`.

## Device / build
- Follow `RUNBOOK-LAB-B.md` in this folder exactly.
- adb ONLY via `~/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554`. Never touch the default port 5037 (Lab A owns it with the Pixel). Never run `emu-connect` (other than `emu-connect status`). Never kill/restart any adb server or Metro you did not start. Never `apt install adb`.
- If `adb -P 5039 devices` shows anything other than `emulator-5554`, STOP and report.
- Lab B Metro = port 8084, tmux session `orbit-lab-b`. Lab A uses 8081–8083 — hands off.
- Before ANY droid build step run `tools/droid-busy.sh`; if busy, wait and poll. Never kill another build/daemon. Build in Lab B's own droid dir only.
- Package `com.bwales.orbit.labb` only. No Google Drive uploads. No real AI API calls. Synthetic data on the emulator is fine.
- Emulator frame timings are NOT phone performance — never make an absolute perf claim from them; relative A/B on the same emulator only, labelled as such.

## Code
- Read `CLAUDE.md`. Review the code, not the diff: read full files plus the subsystem you touch.
- Never drive per-frame animation with React state. All animation stops when the Orrery is inactive (existing unmount behaviour) and honours reduced motion.
- Hermes worklet ordering: a worklet must never call another worklet defined LATER in the same file (undefined on device; vitest can't catch it). Define helpers above callers. Ensure `orrery-worklet-order.test.ts` scans every new folder.
- `globalThis.crypto` is undefined on Hermes — deterministic seeds only.
- `RuntimeEffect.Make` returns null on failure: always fall back. Create shaders lazily (tests mock Skia as `{}`), cache at module level after first creation.
- Colours: through theme tokens (pass as uniforms). New colours = clearly-labelled lab tokens. Run `npm run check:colors`.
- Gates per package: `npx tsc --noEmit`, focused orrery vitest, `npm run check:colors`, Biome on touched files. Don't delete test coverage blindly; retarget or document obsolete renderer-shape tests.
- No network in any render/read path. Local-first is absolute.
- Document every intentional production compromise (append to `research/COMPROMISES-LOG.md`).

## Reporting
- Return a SHORT summary (<300 words): what changed, commit SHAs, gates results, evidence paths, open problems. Put detail in files, not in the return.
