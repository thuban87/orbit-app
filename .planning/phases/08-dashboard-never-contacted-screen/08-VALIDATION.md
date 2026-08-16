---
phase: 8
slug: dashboard-never-contacted-screen
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-15
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `08-RESEARCH.md` § Validation Architecture. Task IDs are assigned by the planner — the per-requirement map below is the source of truth the planner maps tasks onto.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (node environment) — the harness the repo's `src/db/*.test.ts` and `*-logic.test.ts` already run under |
| **Config file** | project-standard Vitest (existing `.test.ts` suites run today) |
| **Quick run command** | `npx vitest run src/db/dashboard-read.test.ts src/logic/birthday-logic.test.ts` (scoped) |
| **Full suite command** | `npm test` (`vitest run`) + `npx tsc --noEmit` + `npm run check:colors` + Biome |
| **Estimated runtime** | ~a few seconds (node unit suites) |

---

## Sampling Rate

- **After every task commit:** the scoped quick-run for the module touched + `npx tsc --noEmit` + `npm run check:colors`
- **After every plan wave:** `npm test` (full suite)
- **Before `/gsd-verify-work`:** full suite green + on-device UAT on the Pixel (build+install+drive dashboard, never-contacted, manage-favourites, birthday banner, search)
- **Max feedback latency:** < 15 seconds for the node suites (device-UAT is out-of-band)

---

## Per-Task Verification Map

> Task IDs (`08-PP-TT`) are filled by the planner; the requirement→behavior→command rows below are fixed by RESEARCH.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DASH-01 | Default predicate excludes never-contacted/archived/currently-snoozed; each sort (status/name/least-recent/most-recent) orders correctly incl. tiebreak | unit (SQL over `node:sqlite` fixture, mirroring `queries.test.ts`) | `npx vitest run src/db/dashboard-read.test.ts` | ❌ W0 | ⬜ pending |
| DASH-02 | Each filter/segment predicate (needs-attention/category/battery/favourites/snoozed) selects the right population; search matches name AND fuel, excludes `off_limits` + unconfirmed `ai` | unit | `npx vitest run src/db/dashboard-read.test.ts` | ❌ W0 | ⬜ pending |
| DASH-02 | Ranked-fuel column parity with `getRankedFuel` (no drift between the card line and the projection) | unit (parity, like `fuel-read.test.ts`) | `npx vitest run src/db/dashboard-read.test.ts` | ❌ W0 | ⬜ pending |
| DASH-03 | Card content contract present (avatar/status ring/name/fuel/category/favourite); nothing log-derived | device-UAT (uiautomator on Pixel) | manual (desktop-build-pipeline) | n/a | ⬜ pending |
| DASH-05 | `daysUntilBirthday`: today→0 at multiple times-of-day; Feb-29 in a non-leap year; `MM-DD` & `YYYY-MM-DD` inputs; past date rolls to next year; >7 days excluded | unit | `npx vitest run src/logic/birthday-logic.test.ts` | ❌ W0 | ⬜ pending |
| DASH-06 | Reorder logic (from/to → new id array); rank rewrite writes `0..n-1` in ONE transaction; star toggle sets/clears `favourite_rank` | unit | `npx vitest run src/db/favourites-dao.test.ts src/logic/*reorder*.test.ts` | ❌ W0 | ⬜ pending |
| DASH-07 | Freshness (focus/AppState/pull) refresh + cause-aware empty states | device-UAT | manual | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/dashboard-read.test.ts` — DASH-01/02 predicates, sorts, search, fuel-parity
- [ ] `src/logic/birthday-logic.test.ts` — DASH-05 parser (both bugs + both `MM-DD`/`YYYY-MM-DD` formats)
- [ ] `src/db/favourites-dao.test.ts` — DASH-06 toggle + reorder transactionality
- [ ] `src/logic/*reorder*-logic.test.ts` — pure drag→order computation
- [ ] Framework already present — no install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card renders full content contract; status ring/rogue visual | DASH-03 | `.tsx` render + Skia/theme visuals are device-observable only | Build release APK (desktop pipeline), install on Pixel, `uiautomator dump` the dashboard, assert testIDs + fuel line + category + favourite marker |
| Freshness (focus/AppState/pull) + empty states | DASH-07 | Cross-context refresh + AppState transitions are device-observable | Drive dashboard → background → foreground; pull-to-refresh; first-run + hidden-population empty states |
| Birthday banner overrides snooze/never-contacted, excludes archived | DASH-05 | End-to-end banner render | Seed a snoozed + a never-contacted contact with a birthday in ≤7 days; confirm both appear; archived does not |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
