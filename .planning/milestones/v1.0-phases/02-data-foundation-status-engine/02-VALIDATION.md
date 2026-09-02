---
phase: 2
slug: data-foundation-status-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract. Populated from `02-RESEARCH.md` §Validation Architecture (two-tier:
> node-side DB tests + on-device benchmark).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.x` (already installed) for pure logic; **`node:sqlite`** (Node built-in, bundles SQLite 3.51.2 — no new dependency) for migration-runner / DAO / status DB tests. RN-runtime + on-device work is verified by the DATA-07 device benchmark, not jest-expo. |
| **Config file** | `vitest.config.ts` (from Phase 1) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx tsc --noEmit && npx biome check . && npx vitest run` |
| **Estimated runtime** | ~20 seconds (pure logic + in-memory `node:sqlite` migration/DAO/status tests) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit && npx biome check <changed>`
- **After every plan wave:** `npx tsc --noEmit && npx biome check . && npx vitest run`
- **Before `/gsd-verify-work`:** full suite green **and** the DATA-07 on-device benchmark run on the Pixel
- **Max feedback latency:** ~20 seconds (automated); the device benchmark is out-of-band

---

## Per-Task Verification Map

Node-side (`node:sqlite`, in-memory) verifies the irreversible-correctness invariants deterministically:

| Requirement | What is verified | Test Type | Command |
|-------------|------------------|-----------|---------|
| DATA-01 | `user_version` runner is forward-only, per-step transaction-wrapped, PRAGMAs (`foreign_keys=ON`, WAL, busy_timeout) set BEFORE any transaction; a mid-migration throw rolls back cleanly and does NOT advance `user_version` (crash-safety) | unit | `npx vitest run src/db/**/migrate.test.ts` |
| DATA-02/03 | Migration 1 creates all tables incl. the fuel + custom-fields tables, with every un-backfillable column; seeded categories + self record present | unit | `npx vitest run src/db/**/migration-01.test.ts` |
| DATA-04 | The single-writer DAO recomputes `last_contact` as MAX over current interaction rows (connected-only for "Rarely responds") in a transaction; concurrent writes through the shared mutex serialize | unit | `npx vitest run src/db/**/last-contact.test.ts` |
| DATA-05 | Query-time status = elapsed÷interval, 80%/100% buckets, `date('now','localtime')` midnight resolution; never stored | unit | `npx vitest run src/**/status.test.ts` |
| DATA-06 | Launch sweep runs once per real foreground launch (AppState background→active), NOT on module import or a headless tap; hook registry invoked | unit | `npx vitest run src/**/sweep.test.ts` |
| DATA-07 | Newest-interaction-per-contact query + status scan benchmark acceptably | manual (device) | on-device via the proven pipeline (`gradlew assembleRelease` → Pixel) |

---

## Wave 0 Requirements

- [ ] `src/db/` migration-runner + migration-1 module (the crash-safe `user_version` pattern)
- [ ] `node:sqlite` test harness helper (in-memory DB per test)
- [ ] Migration/DAO/status test files above
- [ ] Vitest already installed (Phase 1) — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Newest-per-contact query + status scan are fast on real hardware; `localtime` behaves on Android/bionic | DATA-07 | Perf + `date('now','localtime')` behaviour are device-specific (emulator invalid for perf per CLAUDE.md) | Build release APK → `adb install` on the Pixel → run the in-app benchmark harness → record timings + a one-line `localtime` probe |

---

## Validation Sign-Off

- [x] Every DATA-01..06 invariant has an automated `node:sqlite`/Vitest check; DATA-07 is the device benchmark
- [x] Crash-safety of the migration runner is explicitly tested (mid-migration throw → no version advance)
- [x] No watch-mode flags (single-run commands)
- [x] `nyquist_compliant: true`

**Approval:** pending (completes after Wave 0 lands green + the DATA-07 device benchmark runs)
