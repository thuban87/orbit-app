---
phase: 15
slug: weekly-digest
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Full critical-property test map lives in `15-RESEARCH.md` §Validation Architecture — this file is the
> execution contract the plan-checker and executor verify against; per-task IDs are filled as plans land.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (`node:sqlite`-backed DAO tests; pure logic in `src/logic`; expo double for schedule) |
| **Config file** | package.json `"test": "vitest run"`; `check:colors`; `tsc --noEmit`; biome |
| **Quick run command** | `npx vitest run src/db/digest-read.test.ts src/logic/digest-logic.test.ts src/services/notifications/digest-schedule.test.ts` |
| **Full suite command** | `npm test` then `npx tsc --noEmit && npm run check:colors && npx biome check <touched>` |
| **Estimated runtime** | ~30–60 seconds (full suite ~1305 tests today) |

---

## Sampling Rate

- **After every task commit:** the quick run for the touched DAO/logic/schedule file + `tsc --noEmit`.
- **After every plan wave:** `npm test` (full) + `check:colors` + biome on touched files.
- **Before `/gsd-verify-work`:** full suite green.
- **Max feedback latency:** ~60 seconds (node tests). The device spike (weekly fire + reboot re-register on
  the physical Pixel) is the one owner-gated manual checkpoint and is release-blocking for DGST-01.

---

## Per-Task Verification Map

> Critical properties enumerated in `15-RESEARCH.md` §Validation Architecture "Phase Requirements → Test Map".
> Task IDs filled once plans are authored; each row below is a property the plans' `must_haves` must carry.

| Property | Req | Test Type | Automated Command | File | Status |
|----------|-----|-----------|-------------------|------|--------|
| Retrospective counts ALL touchpoints (no connected/direction predicate), archived excluded | DGST-02 | unit (node:sqlite) | `vitest run src/db/digest-read.test.ts -t retrospective` | ❌ W0 | ⬜ pending |
| Window boundary math — no UTC off-by-one (DST + late-evening), `formatLocalDate`/localtime | DGST-02 | unit | `vitest run src/db/digest-read.test.ts -t window` | ❌ W0 | ⬜ pending |
| Overlooked ignores mute (a muted rogue IS present) but excludes archived | DGST-02 | unit | `vitest run src/db/digest-read.test.ts -t overlooked` | ❌ W0 | ⬜ pending |
| Rogue read from `ROGUE_K`/`STATUS_SQL` (not recomputed); rarely_responds→"Gone quiet", time→"Drifting" | DGST-02 | unit | `vitest run src/db/digest-read.test.ts -t "drifting vs gone"` | ❌ W0 | ⬜ pending |
| Backlog count == `countNeverContacted()` parity | DGST-02 | unit | `vitest run src/db/digest-read.test.ts -t backlog` | ❌ W0 | ⬜ pending |
| Group cap ~6 + "+N more" overflow math | DGST-02 | unit | `vitest run src/logic/digest-logic.test.ts -t cap` | ❌ W0 | ⬜ pending |
| "Skews hard" conservative — one hard mark does NOT trigger; count- AND fraction-gated | DGST-03 | unit | `vitest run src/logic/digest-logic.test.ts -t effortful` | ❌ W0 | ⬜ pending |
| Idempotent WEEKLY re-registration — reconcile twice → exactly one `digest:weekly` | DGST-01 | unit (expo double) | `vitest run src/services/notifications/digest-schedule.test.ts -t idempotent` | ❌ W0 | ⬜ pending |
| Toggle OFF cancels; ON (master on) schedules; master OFF cancels | DGST-01 | unit | `vitest run ...digest-schedule.test.ts -t toggle` | ❌ W0 | ⬜ pending |
| Weekday/hour constant change → cancel + reschedule (drift diff) | DGST-01 | unit | `vitest run ...digest-schedule.test.ts -t drift` | ❌ W0 | ⬜ pending |
| decay/birthday reconcile still does NOT touch `digest:weekly` (regression, mirrors :505) | DGST-01 | unit | `vitest run src/services/notifications/notification-schedule.test.ts` | ✅ extend | ⬜ pending |
| `resolveNotificationNav({kind:"digest"})` → "Digest"; malformed → null | DGST-01 | unit | `vitest run src/services/notifications/notification-nav.test.ts -t digest` | ✅ extend | ⬜ pending |
| Empty week still opens → unified "all quiet" state | DGST-01 | unit + device | `vitest run src/logic/digest-logic.test.ts -t "all quiet"` | ❌ W0 | ⬜ pending |
| migration 005 `digest_enabled` — additive `ADD COLUMN NOT NULL DEFAULT 1`, node:sqlite v4→v5 | DGST-01 | unit (node:sqlite) | `vitest run src/db/migrations/005-digest-settings.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/digest-read.test.ts` — retrospective/overlooked/gentle-line queries (DGST-02/03), `node:sqlite` seed harness (reuse `src/db/__testkit__/node-sqlite.ts`).
- [ ] `src/logic/digest-logic.test.ts` — day-tag, cap/overflow, group split, "skews hard" threshold (DGST-02/03).
- [ ] `src/services/notifications/digest-schedule.test.ts` — idempotent WEEKLY register/cancel/drift vs the expo double (DGST-01).
- [ ] `src/db/migrations/005-digest-settings.test.ts` — v4→v5 additive column, mirroring `004-ai-settings.test.ts`.
- [ ] Extend `notification-nav.test.ts` + `notification-schedule.test.ts` — digest routing + `digest:weekly` non-clobber regression.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WEEKLY trigger fires exactly once/week + re-registers across reboot | DGST-01 | Skia/AlarmManager timing is device-only; emulator cannot verify weekly repeat (CLAUDE.md); pre-57 repeat bugs #34782/#30577 | Physical Pixel release build; owner-gated release-blocking checkpoint (desktop-build-pipeline runbook) |
| Digest screen renders (retrospective/overlooked/gentle line/"all quiet") | DGST-01/02/03 | `.tsx` render not node-tested (repo convention) | On-device UAT on the Pixel |
