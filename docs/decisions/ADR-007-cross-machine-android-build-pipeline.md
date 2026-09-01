# ADR-007: Cross-Machine Android Build Pipeline & Physical-Pixel FND-01 Proof

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 01-project-scaffold-portable-code
**Source decisions:** SKELETON.md "Deployment / build target"; 01-05-SUMMARY (FND-01 proof)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

This Linux development box cannot compile Android APKs by hardware (a 2012 Ivy Bridge CPU that also cannot run a modern Android x86_64 emulator). Orbit is Android-first and needs a repeatable way to build the app and prove it launches on a real device, under the global constraint that agents never `git push` (the owner pushes).

## Decision

Android builds run on the owner's Windows desktop **`droid`** over SSH/Tailscale: source is transported by **tar-over-ssh / scp** (rsync is absent on droid), never `git push`; droid runs `npm ci` + `expo prebuild` + Gradle itself and the APK is pulled back and `adb install`-ed. The **physical Pixel 6 Pro is the required FND-01 proof** — the one-time proof uses a standalone `assembleRelease` APK (JS bundle embedded, no Metro), while day-to-day iteration uses `assembleDebug` + Metro-on-this-box + `adb reverse tcp:8081`. The desktop emulator is a launch-only smoke test that **does not close FND-01**. The full procedure lives in `docs/runbooks/desktop-build-pipeline.md`.

## Alternatives Considered

- **Build locally on this box** — Rejected. The 2012 CPU cannot compile the APK and cannot run a modern Android emulator (guest kernel panics). A CPU upgrade would reopen this.
- **`git push` to move source to the build host** — Rejected. `git push` is globally denied (agents never push; the owner pushes); transport is rsync/scp/tar-over-ssh, which the repo's `settings.local.json` allows.
- **Close FND-01 on the desktop emulator** — Rejected. Emulator frame timing and render path are not the app's, and it is a weaker smoke test; FND-01 requires the physical Pixel.

## Consequences

### Positive

- Every later phase has a proven, documented build/install loop and a clear split between the standalone release proof and the debug + Metro iteration loop.
- Two latent scaffold bugs that only surface at the first real Metro bundle were found and fixed while proving FND-01 (see Key files) and are documented so they do not recur.

### Negative

- Builds depend on the owner's desktop being reachable over Tailscale, and the release APK is not `run-as`-debuggable — on-device data inspection in later phases must use the debug APK.

### Risks

- The release APK is signed by the prebuild-generated debug keystore; production signing is a separate, later concern. SSH to droid is trust-on-first-use over authenticated Tailscale to the owner's own machine (accepted at bring-up).

## Implementation

**Key files:**
- `app.config.ts` — install-locked `android.package` `com.bwales.orbit` and a display name sourced from JSON, with no `tsx/cjs` runtime hook (which broke the embedded release bundle).
- `src/constants/app-name.json` — the single-source display name, loadable natively by Node/Expo, Metro, and tsc.
- `src/constants/app.ts` — the typed `APP_NAME` re-export consumed by the app.
- `package.json` — declares `babel-preset-expo` as a direct devDependency so it hoists and Metro's embedded bundle resolves it from the project root.
- `docs/runbooks/desktop-build-pipeline.md` — the proven commit → tar-over-ssh → droid build → pull → `adb install` procedure (release proof + debug/Metro iteration).

**Depends on:** None
**Required by:** None

---
