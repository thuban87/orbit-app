---
phase: 17-backup-export-restore
plan: "07"
subsystem: backup-encryption
tags: [rnqc, pbkdf2, aes-gcm, secure-store, pixel-release]
requires:
  - phase: 17-01
    provides: RNQC native dependency and Expo config-plugin wiring
  - phase: 17-06
    provides: verified SAF automatic snapshot service
provides:
  - Approved version-1 PBKDF2/AES-GCM encrypted-backup envelope contract
  - Typed SecureStore passphrase cache and fail-closed automatic-write gate
affects: [17-09-backup-ui, 17-10-restore, 17-11-release-uat]
actuals:
  tokens: 15367
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns: [injected native crypto boundary, typed SecureStore availability, serialized backup lifecycle]
key-files:
  created: [src/services/backup/encryption.ts, src/services/backup/passphrase-store.ts, src/services/backup/encryption-benchmark.ts]
  modified: [src/backup/types.ts, src/services/backup/backup-service.ts, App.tsx]
key-decisions:
  - "Version 1 uses PBKDF2-HMAC-SHA256 at 600,000 iterations, a 32-byte key, 16-byte salt, 12-byte IV, AES-256-GCM, and an 8 MiB ciphertext cap."
  - "The profile was selected from a Pixel 6 Pro release build, where its five post-warmup samples had a 53 ms median."
requirements-completed: [BKP-03]
coverage:
  - id: D1
    description: "Authenticated, reject-unknown encrypted envelope with a fixed approved profile."
    requirement: BKP-03
    verification:
      - kind: unit
        ref: "src/services/backup/encryption.test.ts"
        status: pass
      - kind: manual_procedural
        ref: "Pixel 6 Pro release benchmark APK SHA-256 87af511c210aeae56df76df9b4300f18e216dbdcd3a2ad39db947b98625baffb"
        status: pass
    human_judgment: false
  - id: D2
    description: "SecureStore availability remains distinct from an intentionally absent passphrase and blocks enabled automatic writes."
    requirement: BKP-03
    verification:
      - kind: unit
        ref: "src/services/backup/passphrase-store.test.ts; src/services/backup/backup-service.test.ts"
        status: pass
    human_judgment: false
duration: 2h 40m
completed: 2026-08-25
status: complete
---

# Phase 17 Plan 07: Backup encryption profile and lifecycle summary

**A Pixel-release-measured PBKDF2/AES-GCM backup envelope with typed SecureStore availability and fail-closed automatic writes.**

## Accomplishments

- Added a strict encrypted envelope with canonical technical AAD, reject-unknown public schema, and pre-KDF hostile-header validation.
- Measured RNQC PBKDF2 on the Pixel 6 Pro release APK, then froze the owner-approved version-1 600,000-iteration profile.
- Added a namespaced passphrase store, ordered enable/disable sagas, a shared service lock, and zero-write blocking when enabled encryption lacks a usable passphrase.

## Owner-approved release evidence

The selected profile is `{ formatVersion: 1, cipher: AES-256-GCM, kdf: PBKDF2-HMAC-SHA256/600000/32, saltLength: 16, ivLength: 12, maxCiphertextBytes: 8388608 }`.

It was measured through the committed release-only RNQC timing harness on a Pixel 6 Pro (`raven`, serial `1A071FDEE002BU`) using a release APK built on `droid` with RNQC 1.1.7. APK SHA-256: `87af511c210aeae56df76df9b4300f18e216dbdcd3a2ad39db947b98625baffb`.

After one warmup, the five 600,000-iteration samples were **53, 53, 54, 53, 54 ms** (median **53 ms**). The unselected candidates measured 300,000: 29/27/27/27/26 ms (median 27 ms), and 900,000: 80/80/79/80/80 ms (median 80 ms).

## Task Commits

1. Task 1 RED — `9c333d4` test vectors
2. Task 1 GREEN — `61d2817` parameterized envelope
3. Task 2 harness — `24f9144` release-only Pixel benchmark harness
4. Task 3 RED — `9fed72a` passphrase/profile tests
5. Task 3 GREEN — `1535874` approved profile and typed SecureStore repository
6. Task 3 lifecycle — `32d06ae` fail-closed automatic-write gate and lifecycle lock

## Verification

- `npm test -- src/services/backup/passphrase-store.test.ts src/services/backup/encryption.test.ts` — 7 passed
- `npm test -- src/services/backup/backup-service.test.ts` — 9 passed
- `npx tsc --noEmit` — passed
- Release APK installed and benchmark harness rendered on the physical Pixel.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking build issue] Retried the identical release build after a stale CMake log deletion failure.**
- **Found during:** Task 2 Pixel release benchmark.
- **Fix:** Confirmed no competing build process and re-ran the documented release command without changing the build route or dependencies.
- **Verification:** `assembleRelease` completed successfully in 9m41s.

## Next Phase Readiness

Plans 17-09 through 17-11 can consume the exact approved profile and the three-state passphrase result. The benchmark harness is build-flag-gated and never mounts in ordinary product builds.

## Self-Check: PASSED

- Encryption, passphrase, and automatic-write regression suites pass.
- All six implementation/test commits are present in Git history.
