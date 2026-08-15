---
phase: 05-photos
plan: 07
subsystem: database
tags: [photos, purge, custom-fields, expo-file-system, sqlite, post-commit-hook]

# Dependency graph
requires:
  - phase: 05-02
    provides: "photo-storage chokepoint — contactPhotoRelPath / customFieldPhotoRelPath / deletePhoto (contactId-derivable filename scheme)"
  - phase: 04
    provides: "purgeContact + PurgeOptions.onPurgeExtensions post-commit hook contract"
provides:
  - "buildPhotoPurgeCleanup(exec) — the onPurgeExtensions adapter that deletes a purged contact's main + custom photo-field files, derived from contactId post-commit"
  - "Archived-list purge now registers the adapter — photo files no longer leak on purge (PHOTO-05 purge half closed)"
affects: [photos, purge, custom-fields, notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-commit OS cleanup rebuilds filenames from contactId alone (rows already deleted); never reads the purged rows"
    - "Surviving-global-defs read (listDefs includeQuarantined:true) enumerates cv- files; quarantined defs INCLUDED to avoid a quarantine-window leak"

key-files:
  created:
    - src/services/photos/purge-photo-cleanup.ts
    - src/services/photos/purge-photo-cleanup.test.ts
  modified:
    - src/screens/ArchivedContactsScreen.tsx

key-decisions:
  - "listDefs(exec, { includeQuarantined: true }) is REQUIRED, not optional: a contact purged during a photo field's quarantine window still owns its cv- file on disk; excluding quarantined defs would leak it (PHOTO-05)"
  - "Filenames are rederived from contactId (never read from DB) because the adapter fires POST-COMMIT, after the contacts/contact_custom_values rows are deleted"
  - "Adapter is internally error-resilient (per-path try/catch + logging) on top of purgeContact's outer best-effort try/catch — one failed delete never aborts the rest"

patterns-established:
  - "onPurgeExtensions adapter pattern: buildX(exec) returns an (contactId) => Promise<void> registered at the purge call site"

requirements-completed: [PHOTO-05]

coverage:
  - id: D1
    description: "Purging a contact deletes its main photo file and every custom photo-field file, derived from contactId post-commit"
    requirement: "PHOTO-05"
    verification:
      - kind: unit
        ref: "src/services/photos/purge-photo-cleanup.test.ts#deletes the main photo and every surviving photo-field file, quarantined INCLUDED, ignoring non-photo defs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A photo field QUARANTINED-but-not-yet-expired at purge time still has its cv- file deleted (includeQuarantined:true closes the quarantine-window leak)"
    requirement: "PHOTO-05"
    verification:
      - kind: unit
        ref: "src/services/photos/purge-photo-cleanup.test.ts#deletes the main photo and every surviving photo-field file, quarantined INCLUDED, ignoring non-photo defs"
        status: pass
    human_judgment: false
  - id: D3
    description: "The adapter is idempotent and internally error-resilient — one failing delete does not abort the rest"
    requirement: "PHOTO-05"
    verification:
      - kind: unit
        ref: "src/services/photos/purge-photo-cleanup.test.ts#is internally error-resilient — one failing delete does not abort the rest"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Archived-list purge registers the cleanup adapter so photo files no longer leak on purge (two-stage guard untouched)"
    requirement: "PHOTO-05"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (wiring type-checks; purgeContact called with { onPurgeExtensions: buildPhotoPurgeCleanup(exec) })"
        status: pass
    human_judgment: true
    rationale: "On-device UAT (per plan Task 2): actual file removal from avatars/ after a real purge is only observable on the device via run-as file listing; not asserted by a node test."

# Metrics
duration: 6 min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 7: Photo purge cleanup Summary

**Post-commit `onPurgeExtensions` adapter that rebuilds a purged contact's photo filenames from contactId alone — deleting the main `contact-<id>.jpg` plus one `cv-<id>-<col>.jpg` per surviving photo def (quarantined defs included) — wired into the Archived-list purge.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-15T09:29:00Z
- **Completed:** 2026-08-15T09:31:30Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `buildPhotoPurgeCleanup(exec)` derives + deletes every photo file for a purged contact from `contactId` + surviving `type='photo'` defs, POST-COMMIT, idempotently.
- Closes the quarantine-window leak: `listDefs(exec, { includeQuarantined: true })` ensures a contact purged while a photo field is quarantined-but-not-yet-expired still has its `cv-` file deleted (PHOTO-05).
- Registered the adapter at the Archived-list purge (`purgeContact(exec, id, { onPurgeExtensions: buildPhotoPurgeCleanup(exec) })`) without touching the impact-summary confirm or the two-stage archive→purge guard.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing test for post-commit photo purge cleanup** - `d9619da` (test)
2. **Task 1 (GREEN): derive + delete a purged contact's photo files post-commit** - `125abdc` (feat)
3. **Task 2: register photo purge cleanup at the Archived-list purge** - `2b59e0b` (feat)

_TDD task 1 has two commits (test → feat)._

## Files Created/Modified
- `src/services/photos/purge-photo-cleanup.ts` - The `onPurgeExtensions` adapter: `buildPhotoPurgeCleanup(exec)` deletes `avatars/contact-<id>.jpg` + one `avatars/cv-<id>-<col>.jpg` per surviving photo def (via `listDefs` with `includeQuarantined: true`), best-effort and error-resilient.
- `src/services/photos/purge-photo-cleanup.test.ts` - node proof: derives the exact main + cv- paths from contactId for BOTH a live AND a quarantined photo def, ignores non-photo defs, and survives a single failing delete. Real defs read via migration-1 fixture; `deletePhoto` mocked.
- `src/screens/ArchivedContactsScreen.tsx` - `doPurge` now passes the adapter to `purgeContact`; imported `buildPhotoPurgeCleanup`.

## Decisions Made
- **`includeQuarantined: true` is load-bearing, not incidental.** A photo field in its quarantine window still owns its physical column and `cv-` file; the defs read must include quarantined defs or the file leaks — directly violating PHOTO-05 ("purge really means gone").
- **Filenames rederived, never read.** The adapter runs post-commit, after the owning rows are deleted, so it reconstructs paths from `contactId` via the `photo-storage` builders (which enforce positive-int id + `isSafeColName` — no raw user text, no traversal; T-05-02).
- **Defensive double resilience.** Per-path try/catch inside the adapter on top of `purgeContact`'s outer best-effort try/catch, so one bad def or one failed delete never aborts the rest.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PHOTO-05 purge half is code-complete and node-proven. The write half (persist) shipped in 05-02.
- **On-device UAT still owed (deferred, per plan Task 2 / coverage D4):** purge an archived contact that had a main photo and a custom photo-field value, then confirm both files are gone from `avatars/` via `run-as` file listing on the Pixel. Node tests cannot observe native FS.
- No blockers.

## Self-Check: PASSED

---
*Phase: 05-photos*
*Completed: 2026-08-15*
