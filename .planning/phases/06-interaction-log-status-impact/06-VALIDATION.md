---
phase: 6
slug: interaction-log-status-impact
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (`npm test` → `vitest run`) |
| **Config file** | vitest (present; alias `@/` → `src/`) |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (full suite) |

DB behaviour tests drive Node's built-in `node:sqlite` (`DatabaseSync`, in-memory) through the
REAL migration-1 fixture via `src/db/__testkit__/node-sqlite.ts` (`nodeSqliteExecutor`,
`openTestDb`). Pure `-logic.ts` modules are react-native-free and import/test directly.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the touched module's test>`
- **After every plan wave:** Run `npm test` (full suite green) + `npx tsc --noEmit` + `npm run check:colors` + `npx biome check`
- **Before `/gsd-verify-work`:** Full suite green + on-device Pixel UAT (build+drive per `docs/runbooks/desktop-build-pipeline.md`)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | LOG-01, LOG-06 | T-06-01 / T-06-02 | Future `occurred_at` rejected pre-transaction; every value `?`-bound; one-tap writes explicit `direction='outbound'` | unit (pure + node:sqlite) | `npx vitest run src/db/log-guards.test.ts src/db/recency-dao.test.ts` | ❌ W0 (log-guards) / ⚠ extend (recency-dao) | ⬜ pending |
| 06-01-02 | 01 | 1 | LOG-01 | T-06-03 | One-tap routes writes through the single writer only | manual (on-device) | on-device UAT | N/A | ⬜ pending |
| 06-02-01 | 02 | 2 | LOG-02 | T-06-04 | Read-only interleave; `occurred_at DESC, id DESC`; `?`-bound | unit (node:sqlite) | `npx vitest run src/db/timeline-read.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | LOG-02 | — | Colour via tokens only | manual (on-device) | on-device UAT + `npm run check:colors` | N/A | ⬜ pending |
| 06-03-01 | 03 | 3 | LOG-01, LOG-02, LOG-04, LOG-06 | T-06-01 / T-06-03 | `editTouchpointFull` scopes by both keys, asserts changes===1, always recomputes; future reject on edit | unit (node:sqlite) | `npx vitest run src/db/recency-dao.test.ts` | ⚠ extend | ⬜ pending |
| 06-03-02 | 03 | 3 | LOG-01, LOG-06 | T-06-01 | Two-dialog date+time carry-state; future reject inline | unit (pure) | `npx vitest run src/components/touchpoint-refine-logic.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 3 | LOG-02 | T-06-05 | Delete confirmed; `deleteTouchpoint` asserts one row + recompute | manual (on-device) | on-device UAT | N/A | ⬜ pending |
| 06-04-01 | 04 | 4 | LOG-05, LOG-04 | T-06-06 | `REASON_SQL` mirrors STATUS_SQL branch order; only code constants interpolated | unit (node:sqlite) | `npx vitest run src/db/status.test.ts src/db/contact-status-read.test.ts` | ⚠ extend / ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 4 | LOG-05 | — | Rogue label in-app only; colour via tokens | manual (on-device) | on-device UAT + `npm run check:colors` | N/A | ⬜ pending |
| 06-05-01 | 05 | 5 | LOG-03 | T-06-07 | Gravity derived-never-stored (no write statement); tunables top-of-file | unit (pure + node:sqlite) | `npx vitest run src/services/gravity-logic.test.ts src/db/impact-read.test.ts` | ❌ W0 | ⬜ pending |
| 06-05-02 | 05 | 5 | LOG-03 | — | Bar renders tier; colour via tokens | manual (on-device) | on-device UAT + `npm run check:colors` | N/A | ⬜ pending |
| 06-06-01 | 06 | 6 | LOG-03 | T-06-07 | Intensity derived-never-stored; ignores non-connected for rarely_responds; connected-filter matches recency | unit (pure) | `npx vitest run src/services/intensity-logic.test.ts` | ❌ W0 | ⬜ pending |
| 06-06-02 | 06 | 6 | LOG-03 | — | Neutral rate phrasing; colour via tokens | manual (on-device) | on-device UAT + `npm run check:colors` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/log-guards.ts` + `src/db/log-guards.test.ts` — `rejectFutureOccurredAt` (LOG-06) [Plan 01]
- [ ] Extend `src/db/recency-dao.test.ts` — future reject on record, one-tap explicit-outbound defaults, same-day distinct rows, evening round-trip (LOG-01/06); `editTouchpointFull` all-cols/note-only/lower-newest/connected-flip/future-reject (LOG-01/02/04/06) [Plans 01, 03]
- [ ] `src/db/timeline-read.ts` + `src/db/timeline-read.test.ts` — interleaved touchpoints ⋈ events, `occurred_at DESC, id DESC` (LOG-02) [Plan 02]
- [ ] `src/components/touchpoint-refine-logic.test.ts` — two-dialog date+time carry-state + validity (LOG-01/06) [Plan 03]
- [ ] Extend `src/db/status.test.ts` — `REASON_SQL` (overdue / unresponsive / NULL) mirrors STATUS_SQL branch order (LOG-05) [Plan 04]
- [ ] `src/db/contact-status-read.test.ts` — single-contact query-time status+reason, NULL last_contact handling (LOG-05/04) [Plan 04]
- [ ] `src/services/gravity-logic.test.ts` — age-decay toward floor, monotone in recency, tier mapping (LOG-03) [Plan 05]
- [ ] `src/db/impact-read.test.ts` — impact inputs read (interval_days, rarely_responds, interaction rows) (LOG-03) [Plan 05]
- [ ] `src/services/intensity-logic.test.ts` — period rate + trailing cadence; non-connected ignored for rarely_responds (LOG-03) [Plan 06]

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One-tap "Log contact" writes a row and it appears on the timeline | LOG-01 | UI-observable; Skia-free RN render on device | Build+install release APK (desktop pipeline); open a contact profile, tap "Log contact", confirm a touchpoint row appears newest-first |
| Refine form's two sequential date→time dialogs correct a row's date+time | LOG-01 | Android native pickers only render on device | Open a touchpoint's "Add detail", set channel/direction/connected/quality/note, pick a past date then time, save; confirm the row updates and status changes if date crossed a bucket |
| Delete confirm is unrecoverable and moves recency back when deleting the newest row | LOG-02 | Native Alert + UI-observable recency | Delete the newest touchpoint via confirm; confirm the row is gone and the status reflects the next-newest row |
| Rogue label + reason renders in-app (never a notification) | LOG-05 | UI-observable | Drive a contact past the rogue threshold (or set Rarely responds + overdue); confirm the rogue label + reason shows on the profile |
| Gravity bar/tier and intensity line render profile-only with themed colour | LOG-03 | UI-observable; `check:colors` catches literals but not layout | Open a contact with several touchpoints; confirm gravity tier+bar and intensity line render; confirm no gravity/intensity on the dashboard card |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
