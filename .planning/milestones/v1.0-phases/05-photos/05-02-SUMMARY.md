---
phase: 05-photos
plan: 02
subsystem: database
tags: [expo-file-system, sqlite, photos, avatars, crash-safe-io, launch-sweep]

# Dependency graph
requires:
  - phase: 02-foundation
    provides: "registerSweepHook launch-sweep registry + installSweepTrigger (App.tsx ready-gated effect)"
  - phase: 04-crud
    provides: "single-column DAO writer shape (archiveContact) + node:sqlite test harness + onPurgeExtensions post-commit hook"
provides:
  - "photo-storage.ts — the single expo-file-system chokepoint: contactId-derivable filename scheme, pure rel<->file:// resolve seam, generic assertSafeRelative boundary guard, crash-safe copy-to-.tmp->.bak-swap persistMaster (never pre-deletes the master), idempotent deletePhoto, pure reconcilePhotoDir + reconcilePhotoWrites"
  - "setContactPhoto/clearContactPhoto atomic single-column writers (contacts.photo)"
  - "profile-dao.ts (net-new) — setProfilePhoto/clearProfilePhoto/getProfilePhoto/getProfile for the id=1 self record"
  - "launch-time photo-write reconciliation sweep registered on the Phase-2 registry (no background timer)"
affects: [05-photos remaining plans (pipeline, crop screen, Avatar, PhotoSourcePicker, purge adapter), backup, widget]

# Tech tracking
tech-stack:
  added: [expo-file-system class API (File/Directory/Paths @57.0.4)]
  patterns:
    - "Single FS chokepoint: all relative<->file:// mapping + filename derivation observable in one file"
    - "Crash-safe replace via copy-to-.tmp -> move-master-aside-to-.bak -> move-.tmp-to-dest -> delete-.bak (never pre-delete the sole master)"
    - "Pure/FS split: pure planners (reconcilePhotoDir, resolvePhotoUriFromDocumentUri, builders) node-tested; thin FS wrappers mocked via vi.mock"
    - "Two-layer path safety: positive-int/isSafeColName builder throws + generic assertSafeRelative allowlist at raw-string FS entry points"

key-files:
  created:
    - src/services/photos/photo-storage.ts
    - src/services/photos/photo-storage.test.ts
    - src/services/photos/photo-reconcile-sweep.ts
    - src/db/profile-dao.ts
    - src/db/photo-dao.test.ts
  modified:
    - src/db/contacts-dao.ts
    - App.tsx

key-decisions:
  - "persistMaster is UNCONDITIONALLY the .bak swap (no native-atomicity .d.ts gate) — expo-file-system@57.0.4 Android File.move is delete-then-rename, verified; a .d.ts cannot reveal atomicity"
  - "Fresh File instances per relocation — File.move mutates the moved instance's uri, so reusing a dest File after moving it aside to .bak would target the wrong path"
  - "assertSafeRelative is a single allowlist regex (avatars/[A-Za-z0-9_-]+.(jpg|jpeg|png|webp)) that rejects traversal/absolute/backslash/null-byte/bad-ext by construction"
  - "reconcile actions carry .tmp/.bak relative paths (not allowlist-valid) and bypass assertSafeRelative — they derive from our own dir listing, never caller input"

patterns-established:
  - "Pattern: photo master persistence is crash-safe and launch-reconciled, never timer-driven"
  - "Pattern: dedicated atomic photo DAO writers decoupled from updateContactMetadataCore (which excludes photo)"

requirements-completed: [PHOTO-03, PHOTO-05]

coverage:
  - id: D1
    description: "contactId-derivable filename scheme with by-construction validation (positive-int contactId, isSafeColName colName)"
    requirement: "PHOTO-03"
    verification:
      - kind: unit
        ref: "src/services/photos/photo-storage.test.ts#filename builders — contactId-derivable, validated by construction"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure rel<->file:// resolve seam + generic assertSafeRelative boundary guard rejecting traversal/absolute/backslash/bad-ext"
    requirement: "PHOTO-03"
    verification:
      - kind: unit
        ref: "src/services/photos/photo-storage.test.ts#assertSafeRelative — generic boundary guard at the FS entry points"
        status: pass
    human_judgment: false
  - id: D3
    description: "Crash-safe persistMaster: copy-to-.tmp then .bak swap, never pre-deletes the master; failure paths leave prior master intact/recoverable"
    requirement: "PHOTO-03"
    verification:
      - kind: unit
        ref: "src/services/photos/photo-storage.test.ts#persistMaster — crash-safe, never pre-deletes the master"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pure reconcilePhotoDir orphan tmp/bak planner (delete stale tmp; delete completed-swap bak; restore interrupted-swap bak)"
    requirement: "PHOTO-03"
    verification:
      - kind: unit
        ref: "src/services/photos/photo-storage.test.ts#reconcilePhotoDir — pure orphan tmp/bak reconciliation"
        status: pass
    human_judgment: false
  - id: D5
    description: "Atomic single-column photo DAO writers for contacts + net-new profile-dao (self record id=1), with changes===1 guard"
    requirement: "PHOTO-05"
    verification:
      - kind: unit
        ref: "src/db/photo-dao.test.ts#setContactPhoto / clearContactPhoto (PHOTO-03/05)"
        status: pass
      - kind: unit
        ref: "src/db/photo-dao.test.ts#profile-dao — self record writers/readers (PHOTO-03/05)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Launch-time photo-write reconciliation sweep registered on the Phase-2 registry, wired in App.tsx under the ready-gated one-shot guard (no timer)"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (types) + npm run check:colors (App.tsx, photo-reconcile-sweep.ts)"
        status: pass
    human_judgment: true
    rationale: "The pure reconcile logic is node-tested (D4), but the on-device behavior — an orphaned avatars/*.tmp is removed and a *.bak with a missing dest is restored after a real relaunch — is native FS + real launch-sweep firing, only observable via on-device UAT (run-as seed + relaunch)."

# Metrics
duration: 15 min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 2: Photo Storage Chokepoint & Atomic DAO Writers Summary

**The single expo-file-system chokepoint (contactId-derivable filenames, pure rel<->file:// seam, allowlist boundary guard, crash-safe copy-to-.tmp->.bak-swap persist that never pre-deletes the master, launch-reconciled orphan tmp/bak) plus dedicated atomic photo DAO writers for contacts and the net-new self-record profile-dao.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-15
- **Tasks:** 3
- **Files created:** 5 / **modified:** 2

## Accomplishments
- `photo-storage.ts`: the ONLY relative<->`file://` mapping + `contactId`-derivable filename scheme (`avatars/contact-<id>.jpg`, `avatars/cv-<id>-<col>.jpg`, fixed `avatars/profile.jpg`), a pure node-testable resolve seam, a generic `assertSafeRelative` allowlist guard, and a crash-safe `persistMaster` that copies to `.tmp` FIRST, moves the prior master aside to `.bak`, moves `.tmp` into place, then deletes `.bak` — so no crash window ever loses the sole master (crash-safe even though the installed `expo-file-system@57.0.4` Android `File.move` is delete-then-rename, verified).
- Pure `reconcilePhotoDir` planner + `reconcilePhotoWrites` FS wrapper recovering interrupted replaces (delete stale `.tmp`; delete completed-swap `.bak`; restore interrupted-swap `.bak`).
- Atomic single-column DAO writers: `setContactPhoto`/`clearContactPhoto` (mirroring `archiveContact`) and net-new `profile-dao.ts` (`setProfilePhoto`/`clearProfilePhoto`/`getProfilePhoto`/`getProfile`) targeting the id=1 self record — all `?`-bound with the `changes===1` loud-failure guard, storing the RELATIVE filename, no FS side effect in the DAO.
- `registerPhotoReconcileSweep()` pushes ONE idempotent hook onto the existing Phase-2 `registerSweepHook` registry, wired into `App.tsx` beside `registerFieldSweep` under the `ready`-gated one-shot guard — no background timer.

## Task Commits

TDD tasks: RED (failing test) → GREEN (implementation).

1. **Task 1: photo-storage.ts** — `20f9d74` (test) → `7bb1797` (feat)
2. **Task 2: photo DAO writers + profile-dao** — `46b5290` (test) → `6132ac4` (feat)
3. **Task 3: launch reconcile sweep registration** — `d2d2a29` (feat)

## Files Created/Modified
- `src/services/photos/photo-storage.ts` - The single FS chokepoint (filename scheme, resolve seam, boundary guard, crash-safe persist, delete, reconcile).
- `src/services/photos/photo-storage.test.ts` - 20 node tests: pure helpers, generic-guard throws, persist failure paths (mocked FS), reconcile cases.
- `src/services/photos/photo-reconcile-sweep.ts` - `registerPhotoReconcileSweep` on the Phase-2 registry.
- `src/db/profile-dao.ts` - Net-new self-record photo writers/readers.
- `src/db/photo-dao.test.ts` - 8 tests against the real migration-1 node:sqlite fixture.
- `src/db/contacts-dao.ts` - Added `setContactPhoto`/`clearContactPhoto`.
- `App.tsx` - Registered the photo reconcile sweep under the ready-gated one-shot guard.

## Decisions Made
- **Unconditional `.bak` swap, no native-atomicity gate.** A `.d.ts` cannot reveal move atomicity, and the native source already proves delete-then-rename, so the swap ships unconditionally rather than gated on any capability check.
- **Fresh `File` instances per relocation.** `File.move` mutates the moved instance's `uri`; reusing a dest File after moving it aside to `.bak` would then target `.bak`, so each op constructs a fresh `new File(Paths.document, ...)`.
- **Reconcile actions bypass `assertSafeRelative`.** They carry `.tmp`/`.bak` paths (not allowlist-valid by design) and derive from our own `avatars/` dir listing, never caller input.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. All three verification gates green on first full run after implementation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The storage + write foundation is complete and node-proven; the remaining Phase-5 plans (photo-pipeline orchestration, Skia crop screen, Avatar + initials fallback, PhotoSourcePicker, purge cleanup adapter) can build on `persistMaster`/`resolvePhotoUri`/`relPathForTarget` and the DAO writers.
- **On-device UAT still owed (D6 + native FS):** after building the dev/release APK, seed an orphaned `avatars/*.tmp` (and a `*.bak` with a missing dest) via `run-as`, relaunch, and confirm the sweep removes the tmp and restores the bak. Native FS copy/move fidelity (real 512px master persistence) is also device-only.

## Self-Check: PASSED

- All 5 created files present on disk + SUMMARY.md.
- All 5 task commits present in git log (`20f9d74`, `7bb1797`, `46b5290`, `6132ac4`, `d2d2a29`).
- No unexpected file deletions across the task commits.
- Full suite: 374 tests pass (31 files). `npx tsc --noEmit` exit 0. `check:colors` exit 0 on all phase files.

---
*Phase: 05-photos*
*Completed: 2026-08-15*
