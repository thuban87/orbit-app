---
phase: 02-data-foundation-status-engine
plan: 06
subsystem: data
tags: [benchmark, data-07, on-device, localtime-probe, allowbackup, pii-at-rest, release-apk, tdd]

# Dependency graph
requires:
  - phase: 02-data-foundation-status-engine
    plan: 02
    provides: "openAndMigrate() bootstrap + expoExecutor adapter shape + localDateTime()/BUSY_TIMEOUT_MS (mirrored for the throwaway bench DB)"
  - phase: 02-data-foundation-status-engine
    plan: 04
    provides: "single-writer recency DAO (DATA-04) — the invariant the throwaway-DB benchmark preserves by never writing the live orbit.db"
  - phase: 02-data-foundation-status-engine
    plan: 05
    provides: "App.tsx AppShell migrate-gated render — the temporary benchmark wiring hung off openAndMigrate().then()"
provides:
  - "src/db/benchmark.ts — seedBenchmarkData() + runBenchmark() reusable harness that times the real STATUS_SCAN / NEWEST_PER_CONTACT constants and runs the date('now','localtime') probe over an injected SqlExecutor"
  - "DATA-07 device evidence: STATUS_SCAN 24.07ms + NEWEST_PER_CONTACT 47.51ms at 150 contacts × 20 interactions on the physical Pixel 6 Pro, both under the 100ms budget"
  - "P6 closed: date('now','localtime') = 2026-08-14 on Android/bionic, matching the device wall-clock local date"
  - "android:allowBackup=false in the generated release manifest (T-02-13 PII-at-rest mitigation, dossier cluster G)"
affects: [dashboard-read-path, status-engine, security-posture, 03, 04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-SqlExecutor benchmark harness: the same seed/measure code runs node-side (in-memory node:sqlite, correctness) and on-device (throwaway expo DB, perf) — perf is a device-only claim per CLAUDE.md"
    - "Throwaway ephemeral DB for the on-device run: openDatabaseAsync('orbit-bench.db') → same PRAGMA order as the live bootstrap → runMigrations → seed → runBenchmark → deleteDatabaseAsync; never getDb()/orbit.db (preserves the DATA-04 single-writer invariant, T-02-14)"
    - "On-screen result rendering as the device-observable evidence channel for a RELEASE build — release Hermes does NOT forward console.log to logcat, so the benchmark result is rendered as themed Text and read via uiautomator dump / screencap"
    - "android.allowBackup in app.config.ts (zero-dependency) maps to android:allowBackup on the generated <application> — no @expo/config-plugins fallback needed"

key-files:
  created:
    - src/db/benchmark.ts
    - src/db/benchmark.test.ts
  modified:
    - app.config.ts

key-decisions:
  - "Benchmark runs against a THROWAWAY orbit-bench.db, never the live orbit.db (fixes review HIGH 'benchmark writes to the live datastore' AND preserves the DATA-04 single-writer invariant — the harness is not a second writer of contacts.last_contact)"
  - "Evidence channel changed from logcat to on-screen UI: a release Hermes APK does not forward console.log to the ReactNativeJS logcat tag (empirically confirmed — 'Running main' appears but no console.log does), so the plan's Logger.debug→logcat channel could not surface the result. The result is rendered on screen and read via uiautomator (deviation, Rule 3)"
  - "allowBackup=false via the zero-dependency app.config.ts key; Expo honored it on the generated release manifest so the inline @expo/config-plugins fallback was unnecessary"
  - "ACCEPTABLE_MS = 100 (conservative per-query budget for the launch/read path at tens-to-low-hundreds of contacts); both measured queries came in well under it"

requirements-completed: [DATA-07]

coverage:
  - id: S1
    description: "seedBenchmarkData inserts exactly `contacts` contacts and `contacts × perContact` interactions, each contact non-null last_contact"
    requirement: "DATA-07"
    verification:
      - kind: unit
        ref: "src/db/benchmark.test.ts#inserts exactly `contacts` contacts and `contacts × perContact` interactions"
        status: pass
      - kind: unit
        ref: "src/db/benchmark.test.ts#gives every seeded contact a non-null last_contact"
        status: pass
    human_judgment: false
  - id: S2
    description: "runBenchmark times STATUS_SCAN + NEWEST_PER_CONTACT (correct row counts) and runs the localtime probe"
    requirement: "DATA-07"
    verification:
      - kind: unit
        ref: "src/db/benchmark.test.ts#times STATUS_SCAN and returns one row per non-archived, contacted contact"
        status: pass
      - kind: unit
        ref: "src/db/benchmark.test.ts#runs the date('now','localtime') probe and returns a YYYY-MM-DD string"
        status: pass
    human_judgment: false
  - id: S3
    description: "On the physical Pixel both queries complete under ACCEPTABLE_MS at 150×20"
    requirement: "DATA-07"
    verification:
      - kind: on-device
        ref: "Pixel 6 Pro (1A071FDEE002BU) release APK — STATUS_SCAN 24.07ms, NEWEST_PER_CONTACT 47.51ms, WITHIN_BUDGET true"
        status: pass
    human_judgment: true
  - id: S4
    description: "date('now','localtime') on Android/bionic matches the device wall-clock local date (P6)"
    requirement: "DATA-07"
    verification:
      - kind: on-device
        ref: "BENCH_LOCALTIME 2026-08-14 == device date 2026-08-14 (America/Chicago, -0500)"
        status: pass
    human_judgment: true
  - id: S5
    description: "android:allowBackup=false in the generated release AndroidManifest"
    requirement: "DATA-07"
    verification:
      - kind: on-device
        ref: "generated android/app/src/main/AndroidManifest.xml <application ... android:allowBackup=\"false\">"
        status: pass
    human_judgment: true

# Metrics
duration: 45min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 06: DATA-07 On-Device Benchmark + PII-at-Rest Summary

**A reusable `src/db/benchmark.ts` harness (seed + time the real STATUS_SCAN / NEWEST_PER_CONTACT + a `date('now','localtime')` probe over an injected SqlExecutor) proven correct node-side and RUN on the physical Pixel 6 Pro against a throwaway ephemeral DB — STATUS_SCAN 24.07ms and NEWEST_PER_CONTACT 47.51ms at 150 contacts × 20 interactions (both under the 100ms budget), localtime = 2026-08-14 matching the device wall clock — plus `android:allowBackup=false` asserted in the generated release manifest.**

## Performance

- **Duration:** ~45 min (dominated by device build/install iteration)
- **Tasks:** 3 (Task 1 TDD: RED → GREEN; Task 2 config; Task 3 device run + revert)
- **Files:** 2 created, 1 modified (App.tsx temporarily wired then reverted net-zero)

## DATA-07 Device Evidence (binding)

Physical Pixel 6 Pro (serial `1A071FDEE002BU`, model raven), **standalone release APK** (embedded JS bundle, no Metro), package `com.bwales.orbit`. Seed: `BENCH_CONTACTS=150` × `BENCH_PER_CONTACT=20` (3,000 interaction rows) in a throwaway `orbit-bench.db`. Read on screen via `uiautomator dump` + `screencap`:

| Metric | Value | Budget | Verdict |
|--------|-------|--------|---------|
| STATUS_SCAN | **24.07 ms** | 100 ms | PASS |
| STATUS_SCAN rows | 150 | (one per non-archived contacted contact) | correct |
| NEWEST_PER_CONTACT | **47.51 ms** | 100 ms | PASS |
| NEWEST_PER_CONTACT rows | 150 | (exactly one per contact) | correct |
| `date('now','localtime')` | **2026-08-14** | device wall clock 2026-08-14 (America/Chicago, -0500) | MATCH — P6 closed |
| WITHIN_BUDGET | true | — | PASS |

The owed P6 probe (localtime verified on glibc/Node but not yet on Android/bionic) is now closed: the device's `date('now','localtime')` returned the correct local calendar day, so the status engine will not flip buckets a day early/late on-device.

## Accomplishments
- `src/db/benchmark.ts`: top-of-file tunables `BENCH_CONTACTS` / `BENCH_PER_CONTACT` / `ACCEPTABLE_MS`; `seedBenchmarkData()` bulk-inserts contacts + interactions via parameterized INSERTs inside one BEGIN/COMMIT (each contact non-null `last_contact` so STATUS_SCAN counts it); `runBenchmark()` wall-clock-times the real `STATUS_SCAN` and `NEWEST_PER_CONTACT` constants from `queries.ts`, runs the `SELECT date('now','localtime')` probe, and emits one structured `Logger.debug` line. Operates on the injected `SqlExecutor`.
- `src/db/benchmark.test.ts`: 7 node-side correctness tests (seed row counts, non-null last_contact, distinct-uid no-collision, STATUS_SCAN/NEWEST row counts, localtime probe shape, budget reporting) over the real migration-1 fixture.
- `app.config.ts`: `android.allowBackup=false` (zero-dependency; T-02-13).
- Built the release APK via the proven `docs/runbooks/desktop-build-pipeline.md` loop (tar-over-ssh → `npm ci` → `expo prebuild --clean` (CI=1) → `gradlew assembleRelease`), asserted `android:allowBackup="false"` on the generated `<application>`, installed on the Pixel, and captured the benchmark result on screen. App.tsx wiring reverted to a net-zero diff.

## Task Commits

1. **Task 1: Benchmark harness (TDD)** — `ae02eae` (test RED) → `c0ae188` (feat GREEN)
2. **Task 2: android allowBackup=false** — `08b15aa` (feat)
3. **Task 3: On-device run + manifest assert + revert** — no source commit (the temporary App.tsx wiring was reverted to a net-zero diff by design; the deliverable is the recorded device run + the manifest assertion). `benchmark.ts` remains as a reusable harness.

_Task 1 followed RED→GREEN; no refactor commit needed (only a biome formatting autofix applied pre-commit)._

## Files Created/Modified
- `src/db/benchmark.ts` — seed/measure harness + localtime probe over an injected SqlExecutor.
- `src/db/benchmark.test.ts` — 7 node-side correctness tests.
- `app.config.ts` — `android.allowBackup=false` (net change; committed).
- `App.tsx` — temporarily wired for the device run, then reverted (net-zero, uncommitted).

## Decisions Made
- **Throwaway ephemeral DB, never the live orbit.db.** The on-device wiring opened `orbit-bench.db`, set the same PRAGMAs, migrated + seeded it, ran the benchmark, then `deleteDatabaseAsync`'d it. This addresses the review HIGH "benchmark writes to the live datastore" AND keeps the benchmark from becoming a second writer of `contacts.last_contact` (preserving the DATA-04 single-writer invariant, T-02-14). The live orbit.db is untouched — verified by the harness design (code review; on-device app-private inspection is impossible on a release APK, per runbook caveat #1).
- **allowBackup via the zero-dependency app.config.ts key.** `tsc` accepted `android.allowBackup` and the generated release manifest carried `android:allowBackup="false"`, so the bundled `@expo/config-plugins` inline-plugin fallback was not needed. No new dependency.
- **ACCEPTABLE_MS = 100.** A conservative per-query budget for the launch/read path; both queries came in comfortably under it, so no owner escalation was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Evidence channel changed from logcat to on-screen UI**
- **Found during:** Task 3 (first device run)
- **Issue:** The plan's observability mechanism (raise `Logger.setLevel('debug')` so timings + probe print to the ReactNativeJS logcat channel) does not work in a **release** Hermes build — release does not forward `console.log` to logcat. Confirmed empirically: the app's native `Running "main"` line appeared on ReactNativeJS but no `console.log`/`Logger.debug` output ever did, across multiple builds. The plan requires a release APK (embedded bundle, standalone, legit perf claim per CLAUDE.md), so switching to a debug+Metro build was not an option.
- **Fix:** In the temporary App.tsx wiring, `runBenchmark`'s result is set into React state and rendered as themed `Text` (`BENCH_STATUS_SCAN_MS`, `BENCH_NEWEST_MS`, `BENCH_LOCALTIME`, …), then read off-device via `uiautomator dump` + `screencap`. `runBenchmark` was made to return its `BenchmarkResult` (it already computed it). This is a device-observable channel that works in a release build.
- **Files modified:** App.tsx (temporary, reverted net-zero); `src/db/benchmark.ts` `runBenchmark` returns the result (kept — a useful signature).
- **Commit:** none (App.tsx reverted; benchmark.ts change was part of `c0ae188` — `runBenchmark` already returned the result).

## Threat Model Coverage
- **T-02-13 (third-party PII at rest, `mitigate`)** — mitigated: `android:allowBackup="false"` asserted on the generated release `<application>` element, keeping the app-private SQLite of notes-about-others out of OS auto-backup / `adb backup`. Local-first is otherwise intact (no network on any read path).
- **T-02-14 (benchmark seed writes, `mitigate`)** — mitigated: seeds via parameterized INSERTs into the throwaway `orbit-bench.db`, deleted after the run; never the live orbit.db, so the harness is not a second writer of `contacts.last_contact`. The harness is a dev tool and ships unwired (App.tsx reverted).
- **T-02-SC (supply chain, `accept`)** — no installs; zero new dependencies (allowBackup used the app.config key; the benchmark uses only existing modules).

## Issues Encountered
- **Release console.log not in logcat** — see Deviation 1.
- **On-device install wedged mid-plan.** Repeated `adb install -r` / `pm install -r` calls hung on commit (the device was intermittently Dozing, and orphaned PackageInstaller sessions with `mStageDirInUse=true` accumulated and would not clear via `pm install-abandon`). Resolved by: keeping the device awake (`KEYCODE_WAKEUP` + `svc power stayon usb`), transferring via `adb push` (fast: ~83 MB/s) then installing from the on-device file, and finally using the manual streaming session path (`pm install-create` → `install-write` → `install-commit`) which committed cleanly. The clean app (post-revert) was reinstalled and verified to render the real home shell ("Orbit" / "Your people, in orbit."); `svc power stayon` was reset and the pushed APKs removed from `/data/local/tmp`.
- **Bundle grep vs Hermes bytecode** — the release `index.android.bundle` is Hermes bytecode (v98); plain text-grep for source strings fails, but `strings` finds the packed string table (used to confirm the harness code was actually bundled before each install).

## User Setup Required
None. `git push` remains the owner's to run — three source commits (`ae02eae`, `c0ae188`, `08b15aa`) plus the docs commit are local.

## Next Phase Readiness
- The irreversible Phase-2 foundation is proven fast (both read queries well under budget) and correct (localtime behaves on Android/bionic) on the device it ships to; the datastore is protected at rest with allowBackup=false.
- `src/db/benchmark.ts` remains a reusable harness for re-benchmarking after future schema/query changes (run node-side for correctness; wire to a throwaway DB for a device perf pass).
- No new runtime dependencies.

## Self-Check: PASSED
- FOUND: src/db/benchmark.ts, src/db/benchmark.test.ts, app.config.ts (allowBackup:false)
- FOUND commits: ae02eae, c0ae188, 08b15aa
- Full suite: 127 passed (12 files); tsc + biome clean; App.tsx net-zero (no diff vs HEAD).
- Device: release APK on Pixel 6 Pro rendered STATUS_SCAN 24.07ms / NEWEST 47.51ms / localtime 2026-08-14 / WITHIN_BUDGET true; generated manifest allowBackup="false"; clean app reinstalled and home shell verified.

---
*Phase: 02-data-foundation-status-engine*
*Completed: 2026-08-14*
