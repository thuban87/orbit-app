---
phase: 38
slug: digest-navigation-restructure
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-18
updated: 2026-09-19
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated during the `--reviews` replan (was a template). Wave-0 test files are
> created by their owning task; all Wave-0 files now exist and the automated
> phase gate is green. Device UAT remains pending behind its owner-confirmation gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment) — pervasive `*.test.ts` / `*.test.tsx` across `src/` |
| **Config file** | present (repo `vitest` config; pure-logic + DAO modules are node-testable by design) |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npx vitest run` |
| **Type gate** | `npx tsc --noEmit` (NOT covered by vitest — vitest green ≠ tsc clean; run in the post-merge/phase gate) |
| **Colour gate** | `npm run check:colors` |
| **Estimated runtime** | full suite ~minutes; per-file quick runs seconds |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched module>` + `npx tsc --noEmit` on the touched surface
- **After every plan wave:** `npx vitest run` (full) + `npx tsc --noEmit` + `npm run check:colors` (post-merge gate)
- **Before `/gsd-verify-work`:** full suite + tsc + check:colors green, then the on-device §S.15 UAT (Plan 07)
- **Max feedback latency:** seconds (quick) / minutes (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | S-01,S-02,S-14 | T-38-01 | Tab route identity preserved; no read-path network | unit (render-free) | `npx vitest run src/navigation` + `npm run check:colors` | ✅ | ✅ green |
| 38-01-02 | 01 | 1 | S-02,S-04,S-05 | T-38-01 | Origin-aware Profile Back; every Profile-reachable route registered | unit (render-free) | `npx vitest run src/navigation` | ✅ | ✅ green |
| 38-01-03 | 01 | 1 | S-14 | — | Reselect-to-root; no dangling nav to removed roots | unit (render-free) | `npx vitest run src/navigation` | ✅ (extends nav suite) | ✅ green |
| 38-02-01 | 02 | 1 | S-10 | T-38-SQLI | Locale week window; firstWeekday−1 conversion | unit (pure) | `npx vitest run src/services/history/week-window.test.ts` | ✅ | ✅ green |
| 38-02-02 | 02 | 1 | S-12 | T-38-DB | Migration 030 additive/forward-only; v1→v30 via full runner | unit + migration | `npx vitest run src/db/migrations/030-your-week-period.test.ts src/db/app-settings-dao.test.ts src/db/migrations/full-chain.test.ts` | ✅ | ✅ green |
| 38-02-03 | 02 | 1 | S-12 | T-38-FMT | yourWeekPeriod portable; BACKUP_FORMAT_VERSION 7; v6→v7 forward migration + round-trip | unit | `npx vitest run src/backup/backup-schema.test.ts src/backup/export-manifest.test.ts src/db/app-settings-dao.test.ts` | ✅ (extends backup suites) | ✅ green |
| 38-02-04 | 02 | 1 | S-11 | T-38-DEDUP | App-wide metrics + group-deduped activity-unit date-count (N-participant→1) | unit (DAO) | `npx vitest run src/db/your-week-read.test.ts` | ✅ | ✅ green |
| 38-03-01 | 03 | 1 | S-06 | T-38-SQLI | Up Next attention floor (progress≥STABLE_MAX) + snooze exclusion; all-stable→empty | unit (DAO) | `npx vitest run src/db/up-next-read.test.ts` | ✅ | ✅ green |
| 38-03-02 | 03 | 1 | S-07,S-08 | T-38-DEDUP | Cap-3, Up Next↔Horizon dedup, 7-day birthdays w/ deterministic tie | unit (pure) | `npx vitest run src/logic/digest-composition.test.ts` | ✅ | ✅ green |
| 38-04-01 | 04 | 2 | S-13 | T-38-SPOOF | Digest notification → Digest tab root; concurrency guard preserved | unit | `npx vitest run src/services/notifications/notification-nav.test.ts src/navigation/notification-gate.test.tsx` | ✅ (extends) | ✅ green |
| 38-04-02 | 04 | 2 | S-05 | — | Contacts header shortcuts removed; no clutter | unit (render-free) | `npx vitest run src/screens` + `npm run check:colors` | ✅ | ✅ green |
| 38-04-03 | 04 | 2 | S-03 | T-38-FAB | FAB visible on Digest; getFocusedContactContext recognizes new tabs | unit | `npx vitest run src/components/universal-fab-logic.test.ts` | ✅ (extends) | ✅ green |
| 38-04-04 | 04 | 2 | S-04 | — | Overflow Group Events action repointed; stale param-list entries removed | unit | `npx vitest run src/navigation src/screens` | ✅ | ✅ green |
| 38-05-01 | 05 | 2 | S-09 | T-38-DEDUP | Period-scoped heatmap reuses helpers; structural day selection | unit (render-free) | `npx vitest run src/components/digest/YourWeekHeatmap.test.tsx` + `npm run check:colors` | ✅ | ✅ green |
| 38-05-02 | 05 | 2 | S-11 | T-38-DEDUP | Inline app-wide day detail; group event = one record | unit (render-free) | `npx vitest run src/components/digest/DigestDayDetail.test.tsx` | ✅ | ✅ green |
| 38-05-03 | 05 | 2 | S-09,S-12 | T-38-WRITE | Period toggle drives all three; Map built direct (not buckets); write-failure rollback | unit (render-free) | `npx vitest run src/components/digest/YourWeekSection.test.tsx` + `npm run check:colors` | ✅ | ✅ green |
| 38-05-04 | 05 | 2 | S-12 | T-38-WRITE | Settings row shares the yourWeekPeriod key (D-09, single source of truth) | unit (render-free) | `npx vitest run src/screens/SettingsInteractionsScreen.test.tsx` | ✅ (extends) | ✅ green |
| 38-06-01 | 06 | 3 | S-06 | T-38-EGRESS | Up Next ≤3, status ring via ContactCard, empty state | unit (render-free) | `npx vitest run src/components/digest/UpNextSection.test.tsx` + `npm run check:colors` | ✅ | ✅ green |
| 38-06-02 | 06 | 3 | S-07,S-08 | T-38-DEDUP | Horizon subgroups; Never-Contacted preview via listDashboardPopulation; store-mutating drill-through | unit (render-free) | `npx vitest run src/components/digest/HorizonSection.test.tsx` | ✅ | ✅ green |
| 38-06-03 | 06 | 3 | S-02 | T-38-NOSCHEMA | DigestScreen composes 3 modules; no Back; no navigate("Home"); derive-only | unit (render-free) | `npx vitest run src/screens/DigestScreen.test.tsx` + `npm run check:colors` | ✅ | ✅ green |
| 38-07-01 | 07 | 4 | S-02,S-14 | — | Render-free shell-contract descriptor regression (TAB_ORDER/INITIAL_TAB + TAB_ICON parity + pure notification resolver; NO navigator mount — the repo has no react-test-renderer and vitest is render-free); full gate | unit (render-free) + gate | `npx vitest run` + `npx tsc --noEmit` + `npm run check:colors` | ✅ | ✅ green |
| 38-07-02 | 07 | 4 | S-15 | T-38-EGRESS | Physical Pixel UAT (both themes); PASS/FAIL/BLOCKED + fixtures | device (human-check) | manual — Pixel debug build + `uiautomator`/screencap | N/A device | ❌ item 3 Events/Profile; ⚠️ items 5, 7 blocked — see `evidence/38-07/UAT-RESULTS.md` |
| 38-08-01 | 08 | 5 | S-02,S-15 | — | Pure close-then-navigate helper proves participant contactId and ordering; shell contract proves Events Profile registration | unit (render-free) | `npx vitest run src/screens/group-event-detail-logic.test.ts src/navigation/shell-contract.test.ts` + `npx tsc --noEmit` + `npm run check:colors` | ✅ (extends) | ⬜ pending |
| 38-08-02 | 08 | 5 | S-07,S-13,S-15 | T-38-08-STATE,T-38-08-SPOOF | DEV-only canonical Never Contacted toggle plus delayed Digest probe and exact-id cleanup, both isolated from production schedule | unit + integration | `npx vitest run src/services/notifications/__dev__/phase38-uat.test.ts src/services/notifications/digest-schedule.test.ts src/services/notifications/notification-nav.test.ts src/stores/dashboard-query-store.test.ts` + `npx tsc --noEmit` + `npm run check:colors` | ❌ Wave 0 | ⬜ pending |
| 38-08-03 | 08 | 5 | S-02,S-07,S-13,S-15 | T-38-08-STATE,T-38-08-EGRESS | Focused physical-Pixel rerun of only items 3/5/7; value restoration, monotonic metadata drift, and probe cleanup recorded | device (human-check) + gate | `npx vitest run` + `npx tsc --noEmit` + `npm run check:colors`; manual Pixel `uiautomator`/screencap | N/A device | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files to create in the owning task (all Vitest; existing infra covers status/birthday/window/bucket helpers):

- [x] `src/navigation` shell descriptor + DigestStack/EventsStack route coverage + Profile→RecentlyDeleted traversal (Plan 01)
- [x] `src/services/history/week-window.test.ts` — Rolling-7 vs locale Calendar Week, firstWeekday=2→Monday (Plan 02)
- [x] `src/db/migrations/030-your-week-period.test.ts` — additive column + default + v1→v30 full-chain (Plan 02)
- [x] `src/db/your-week-read.test.ts` — metrics + group-deduped date-count (N→1) + archived-excluded (Plan 02)
- [x] `src/db/up-next-read.test.ts` — attention floor, all-stable→empty, snoozed-excluded (Plan 03)
- [x] `src/logic/digest-composition.test.ts` — cap-3, dedup, 7-day birthdays w/ tie (Plan 03)
- [x] `src/components/digest/YourWeekHeatmap.test.tsx`, `DigestDayDetail.test.tsx`, `YourWeekSection.test.tsx` (Plan 05)
- [x] `src/components/digest/UpNextSection.test.tsx`, `HorizonSection.test.tsx`, `src/screens/DigestScreen.test.tsx` (Plan 06)
- [x] `src/navigation/shell-contract.test.ts` — render-free shell-contract regression, extending Plan 01's descriptor test (Plan 07; NO navigator mount)

Extended existing suites (not Wave 0): `app-settings-dao.test.ts`, `backup-schema.test.ts`, `export-manifest.test.ts`, `notification-nav.test.ts`, `notification-gate.test.tsx`, `universal-fab-logic.test.ts`, `SettingsInteractionsScreen.test.tsx`, `full-chain.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh-launch-to-Digest, resume preserves tab, five-tab switching, origin-aware Back, FAB on Digest, Horizon drill-through, Your Week toggle + inline heatmap day detail, Digest notification routing, Standard/Galaxy parity, colour-independent selection, long-text backstop | S-15 | UI-observable on real hardware; Skia/render-loop + theme parity + font-scale can't be asserted in node | Plan 07 Task 2 — Pixel debug build (desktop-build-pipeline runbook), drive via `adb`/`uiautomator`, record PASS/FAIL/BLOCKED per §S.15 with a disposable fixture for non-empty states |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (S-15 is device-only by nature, per §S.15)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test references
- [x] No watch-mode flags (all `vitest run`)
- [x] Feedback latency: seconds (quick) / minutes (full)
- [ ] `nyquist_compliant: true` re-affirmed by validate-phase after execution

**Approval:** pending (validate-phase sets `status: validated` at phase close)
