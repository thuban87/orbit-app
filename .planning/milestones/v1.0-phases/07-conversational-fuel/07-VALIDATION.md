---
phase: 7
slug: conversational-fuel
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
updated: 2026-08-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 7 is
> correctness-critical and highly node-testable: the ranked projection, the off_limits +
> unconfirmed-AI in-query exclusions, the kind-priority ranking, the age math, the search
> predicate, and the confirm-flip are ALL pure/SQL seams that run under `node:sqlite`. The
> `.tsx` screens are thin renderers verified on the Pixel (the repo's -logic.ts convention).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed since Phase 1) |
| **Config file** | present (repo runs `src/**/*.test.ts`) |
| **Node DB harness** | `src/db/__testkit__/node-sqlite.ts` (`openTestDb` + `nodeSqliteExecutor`, real migration-1 fixture) — VERIFIED on disk |
| **Quick run command** | `npx vitest run src/db/fuel-dao.test.ts src/db/fuel-read.test.ts src/services/fuel-ranking.test.ts src/services/fuel-age.test.ts` |
| **Full suite command** | `npx vitest run` |
| **UI static gate** | `npx tsc --noEmit && npm run check:colors && npx biome check` |
| **Estimated runtime** | fuel suites < 5 s; full suite ~ tens of seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (the fuel suites) — < 5 s.
- **After every plan wave:** Run the full suite (`npx vitest run`) + `npx tsc --noEmit` + `npm run check:colors` + `npx biome check`.
- **Before `/gsd-verify-work`:** Full suite green, then on-device UAT on the Pixel (build+drive per docs/runbooks/desktop-build-pipeline.md).
- **Max feedback latency:** < 5 s per task.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | FUEL-01 | T-07-01 | All fuel writes `?`-bound; scoped (id, contact_id) + assertOneChange | unit | `npx vitest run src/db/fuel-dao.test.ts` | ❌ tdd (task creates RED-first) | ⬜ pending |
| 07-01-02 | 01 | 1 | FUEL-02 | T-07-01 | Editor read is the ONLY off_limits-surfacing read; contact_id bound | unit | `npx vitest run src/db/fuel-read.test.ts` | ❌ tdd | ⬜ pending |
| 07-01-03 | 01 | 1 | FUEL-01, FUEL-02 | T-07-01 | Controlled editor (no DB); off_limits marked; no net-new token | device-UAT + static | `npx tsc --noEmit && npm run check:colors && npx biome check src/components/FuelEditor.tsx src/screens/ContactProfileScreen.tsx` | screen | ⬜ pending |
| 07-02-01 | 02 | 2 | FUEL-03, FUEL-04 | — | Pure comparator + age (no DB/RN import); local wall-clock parse | unit | `npx vitest run src/services/fuel-ranking.test.ts src/services/fuel-age.test.ts` | ❌ tdd | ⬜ pending |
| 07-02-02 | 02 | 2 | FUEL-03, FUEL-02, FUEL-06 | T-07-02, T-07-03 | getRankedFuel excludes off_limits AND source='ai' in-query; CASE from constant; SQL==comparator parity | unit | `npx vitest run src/db/fuel-read.test.ts` | ❌ tdd | ⬜ pending |
| 07-02-03 | 02 | 2 | FUEL-03, FUEL-04 | — | Surface-agnostic ranked strip; age drives ranking never hides; no net-new token | device-UAT + static | `npx tsc --noEmit && npm run check:colors && npx biome check src/components/RankedFuelLine.tsx src/components/FuelEditor.tsx src/screens/ContactProfileScreen.tsx` | screen | ⬜ pending |
| 07-03-01 | 03 | 3 | FUEL-06 | T-07-03, T-07-01 | Confirm = one scoped UPDATE source='manual' (no migration/column) | unit | `npx vitest run src/db/fuel-dao.test.ts` | ❌ tdd | ⬜ pending |
| 07-03-02 | 03 | 3 | FUEL-06 | T-07-03 | AI-unconfirmed distinct render; excluded from prompt-facing read until confirmed; existing tokens only | device-UAT + static | `npx tsc --noEmit && npm run check:colors && npx biome check src/components/FuelEditor.tsx src/screens/ContactProfileScreen.tsx` | screen | ⬜ pending |
| 07-04-01 | 04 | 3 | FUEL-05 | T-07-04, T-07-02 | searchFuel `?`-bound LIKE; off_limits + archived excluded in-query | unit | `npx vitest run src/db/fuel-read.test.ts` | ❌ tdd | ⬜ pending |
| 07-04-02 | 04 | 3 | FUEL-05 | T-07-04 | Reusable result row + minimal screen; tap→Profile; no net-new token | device-UAT + static | `npx tsc --noEmit && npm run check:colors && npx biome check src/components/FuelSearchResultRow.tsx src/screens/FuelSearch.tsx` | screen | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Prime node-test targets (per the downstream consumer):** the ranked projection ordering, the off_limits + unconfirmed-AI in-query exclusion (every kind-population combo), the age math boundaries, the search predicate (off_limits-never-matches + archived-excluded + literal-%), and the confirm-flip.

---

## Wave 0 Requirements

Framework + harness already present (Phases 1–6): vitest + `src/db/__testkit__/node-sqlite.ts` (`openTestDb`/`nodeSqliteExecutor`), no install needed. Each correctness-critical seam is a `tdd` task that creates its own test file RED-first inside the task — no separate Wave 0 plan is required. The test files created:

- [ ] `src/db/fuel-dao.test.ts` — FUEL-01 writer proof + FUEL-06 confirm-flip (mirror `events-dao.test.ts`) — created in 07-01-01, extended in 07-03-01.
- [ ] `src/db/fuel-read.test.ts` — FUEL-02 editor read (07-01-02), FUEL-03/02/06 exclusion+parity (07-02-02), FUEL-05 search (07-04-01).
- [ ] `src/services/fuel-ranking.test.ts` — FUEL-03 pure comparator (07-02-01).
- [ ] `src/services/fuel-age.test.ts` — FUEL-04 age math (07-02-01).
- [ ] Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Add/edit/delete fuel on a profile across the 5 kinds; off_limits editable + marked | FUEL-01, FUEL-02 | `.tsx` render + interaction not loadable under node:vitest (RN); correctness proven in the DAO/read node tests | On the Pixel (release APK via desktop pipeline): open a contact → Conversational Fuel → add one of each kind, edit, delete; confirm off_limits shows the "Off-limits · private" marker and is editable |
| The promoted ranked line + per-row age render | FUEL-03, FUEL-04 | RN Skia/text render, device-only | Confirm the top line is the highest-priority item; add a newer `recent` and confirm it changes; confirm an off_limits item never becomes the line; confirm ages read "N days/months ago" |
| AI-unconfirmed distinct render + Confirm/Dismiss | FUEL-06 | RN render; no AI producer yet (Phase 14) | Seed a `source='ai'` row (adb `run-as` sqlite or a temporary add) → confirm the "Suggested by AI" pill; tap Confirm → it joins the ranked line; tap Dismiss on another → removed |
| FuelSearch screen (name + fuel text) | FUEL-05 | RN screen navigation, device-only | Settings → Search → type a name and a fuel word; both return the contact; an off_limits-only term returns no match; an archived contact never appears; tap a result → Profile |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (node suite for logic/DAO; tsc/check:colors/biome for `.tsx`) or are tdd tasks creating their own test
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all MISSING references (framework present; test files created RED-first in-task)
- [x] No watch-mode flags (all `vitest run`, not `vitest`)
- [x] Feedback latency < 5s (fuel suites)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-15
