---
phase: 21-interaction-assist-reach-out
plan: 06
subsystem: interaction-assist-device-uat
tags: [device-uat, sqlite, run-as, migration-014, native-handoff, sign-off]
requires:
  - phase: 21-interaction-assist-reach-out
    provides: assist data spine, Reach Out router + handoff, endpoint selector + Compose seam, settings toggle + sweep, merge/purge/widget wiring
provides:
  - Read-path consolidation to a single getAppSettings().interactionAssistEnabled source
  - Full-suite node gate + on-device (Pixel) DB-verified UAT of the whole phase
  - Owner sign-off (release gate for irreversible migration 014)
affects: [phase-21-close-out, milestone-v1.0]
actuals:
  tokens: 0
  tasks: 3
  commits: 1
tech-stack:
  added: []
  patterns: [metro-fast-refresh-on-existing-debug-apk, debug-constant-time-travel, wal-aware-sqlite3-cli-read]
key-files:
  created:
    - .planning/phases/21-interaction-assist-reach-out/21-UAT.md
  modified:
    - src/screens/ContactProfileScreen.tsx
    - src/screens/ComposeScreen.tsx
key-decisions:
  - "Skipped the droid release/debug rebuild: phase 21 is JS-only (git-diff-verified — no native/config/package changes), so Metro fast-refresh on the already-installed DEBUG APK delivers migration 014 + all phase-21 JS — the proven run-as UAT pattern."
  - "R14 24h-expiry exercised via a temporary orchestrator-owned DEBUG-lowered EXPIRE_AFTER_HOURS=30s (git-reverted after the row); the agent's own device DB writes stay classifier-blocked, so a handoff_at backdate was not used."
  - "R11-R13 native-handoff-failure are device-gated (a real Pixel always has a dialer/Messages/mail); owner ruled to accept them as covered by the unit-tested markAssistFailed+Alert path and signed off."
patterns-established:
  - "Device UAT driven by a subagent (heavy adb/uiautomator output kept out of the orchestrator context); orchestrator independently re-verifies the sign-off invariants from a WAL-applied DB read before recording approval."
requirements-completed: [IAS-01, IAS-02, IAS-03, IAS-04]
coverage:
  - id: D1
    description: "Single read path to the Assist toggle; full node suite green across the phase."
    requirement: IAS-02
    verification:
      - kind: integration
        ref: "npm test (191 files / 1,812 tests) && npx tsc --noEmit && npm run check:colors"
        status: pass
    human_judgment: false
  - id: D2
    description: "Whole-phase behavior proven on the physical Pixel with WAL-aware run-as DB evidence and owner sign-off."
    requirement: IAS-01
    verification:
      - kind: manual
        ref: "21-UAT.md scoreboard R01-R20 (device) + owner APPROVED R21"
        status: pass
    human_judgment: true
    rationale: "Native intents, Hermes runtime, RemoteViews/deep-link, AppState banner timing, and reboot durability are only verifiable on-device; owner accepted the device-gated R11-R13 disposition."
duration: 1
completed: 2026-08-31
status: complete
---

# Phase 21 Plan 06: Read Consolidation + Pixel Device UAT + Sign-off

**The whole Interaction Assist & Reach Out phase proven end-to-end on the real Pixel 6 Pro — DB-verified handoff-time logging through the sole recency writer — with owner sign-off on the irreversible migration 014.**

## Tasks

1. **Task 1 (auto) — read consolidation + node gate.** Committed earlier as `a84a3d8`: both `ContactProfileScreen` and `ComposeScreen` now read the Assist toggle via `getAppSettings().interactionAssistEnabled` (one canonical path; review finding #4), and the full node gate is green (**191 files / 1,812 tests**, `tsc` clean, `check:colors` clean — re-confirmed green this session). `21-UAT.md` scaffolded with device-gated rows pre-marked BLOCKED.
2. **Task 2 (blocking-human) — owner checkpoint.** Cleared: the owner directed continuation into the device UAT.
3. **Task 3 (auto + human-check) — Pixel device UAT + sign-off.** Full matrix driven on the physical Pixel against a DEBUG build with WAL-aware `run-as` DB reads; owner sign-off recorded.

## Device UAT result (21-UAT.md)

- **R01–R10, R14–R20: PASS** with a screenshot + on-device DB read each. Migration 014 applied on-device (`user_version` 13 → 14).
- **R11–R13 (native handoff failure): device-gated, owner-accepted.** Un-producible on a Pixel (always has a dialer/Messages/mail); the `performReachOut` catch → `markAssistFailed` + Alert path is unit-tested. Owner ruled to accept.
- **R21: APPROVED (owner, 2026-08-31).**

**Sign-off invariants (independently re-verified by the orchestrator via a WAL-applied `sqlite3` read, not just the subagent's word):**
- All **7** assist-sourced interactions have `occurred_at === their logged assist's handoff_at`, `direction=outbound`, `source=assist`, and the correct `connected` (Call Yes=1, Call No-answer=0, Text/Email Yes=1).
- `contacts.last_contact` advanced **only** via `recomputeLastContactCore` (dismissed/expired assists left it null — no bespoke writer).
- Queue integrity: 0 pending at rest; status dist logged=7 / dismissed=8 / expired=3; the 5-pending cap prunes the oldest; Assist OFF clears the queue with no resurrection; purge cascade-deletes; merge reparents; a purged deep-link target shows "This contact is no longer available." → Dashboard while an archived target is silently dropped; the widget deep-link is consumed exactly once.

## Deviations from Plan

1. **Skipped the desktop APK rebuild (efficiency, no behavior change).** The plan's Task 3 describes building a DEBUG APK on `droid`. Phase 21 is **JS-only** (verified via `git diff` — no `app.config.ts`/`package.json`/native-module/`android/` changes), so the already-installed DEBUG APK's native layer is compatible and Metro fast-refresh on host `:8082` delivers migration 014 + all phase-21 JS. This is the same run-as UAT pattern used in phases 18.1/20. Orbit Metro on `:8082`, device reverse `8081→8082`; quest-board's `:8081` left untouched.
2. **R14 24h-expiry time-travel via a temporary DEBUG constant.** The agent's device DB writes are classifier-blocked, so instead of backdating `handoff_at`, the orchestrator temporarily set `EXPIRE_AFTER_HOURS = 30/3600` in `src/logic/assist-eligibility.ts`, drove the row (pending id=20 → no banner after a real 35s wait → launch sweep flipped it to `expired`), then reverted the edit with `git checkout` (constant back to `24`, working tree clean).
3. **Caught + corrected a false evidence citation.** The subagent's initial R10 row cited a note "UAT-R10-note" on interaction id=8; independent DB re-verification showed id=8 is R19's Compose text (`note=null`) and no such note exists. The R10 requirement is genuinely satisfied (Don't-log wrote zero interactions; note-persistence proven by interaction id=9's 121-char note through the identical `markAssistLogged(note)` path). The citation was corrected in 21-UAT.md rather than signed off over.

## Integrity

- **Zero product-code changes in Task 3.** The only committed code change in Plan 06 was Task 1's read consolidation (`a84a3d8`). The R14 time-travel edit was temporary and reverted; `git status` shows no `src/` changes. HEAD unchanged at `5b6e05e`. No commits/pushes/worktrees by any agent in Task 3.
- Device left clean (0 pending assists, Assist ON, app healthy).

## User Setup Required

None.

## Next Phase Readiness

Phase 21 is functionally complete and owner-signed-off. Remaining close-out: phase aggregation/verification, KB extraction, and STATE/ROADMAP updates. All phase-21 commits remain **local on `main`, NOT pushed** (owner pushes).

## Self-Check: PASSED

- `21-UAT.md` scoreboard complete (R01–R21) with owner sign-off recorded.
- Sign-off invariants independently DB-verified by the orchestrator.
- Node gate green; migration 014 live on-device; working tree clean of source edits.
