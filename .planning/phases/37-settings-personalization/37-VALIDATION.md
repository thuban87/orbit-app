---
phase: 37
slug: settings-personalization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-14
updated: 2026-09-14
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by plan-phase.
> Phase 37 is a consolidation/relocation phase: automated coverage comes from **pure logic modules**
> (`settings-hub-model`, `settings-interactions-logic`, `settings-contacts-model`, `backup-dualhome-logic`),
> the **DAO suites** (`profile-dao`, `app-settings-dao`), the **type gate** (`tsc --noEmit` proves every
> route registration), and the **colour gate** (`check:colors`). On-device RN navigation/rendering has NO
> component-test harness in this repo (no react-native-testing-library — verified in package.json) and is
> covered by **device UAT** (Manual-Only), with the automated logic-module + tsc portion satisfying Nyquist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node env; DAOs proven against `node:sqlite`) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run <changed test path>` |
| **Full suite command** | `npm test` (= `vitest run`; ~3391 tests green as of Phase 36) |
| **Type gate** | `npx tsc --noEmit` (NOT run by vitest — run explicitly; memory tsc-in-post-merge-gate) |
| **Colour gate** | `npm run check:colors` |
| **Estimated runtime** | quick suites < 10s each; full `npm test` ≈ the prior 3391-test runtime |

---

## Sampling Rate

- **After every task commit:** `npx vitest run` on the touched logic/DAO suite + `npx tsc --noEmit`.
- **After every plan wave:** `npm test` + `npm run check:colors` + `npx tsc --noEmit`.
- **Before `/gsd-verify-work`:** full `npm test` green + `tsc --noEmit` clean + `check:colors` clean, then device UAT on the Pixel.
- **Max feedback latency:** quick suite < 10s.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-T1 | 01 | 1 | D-09, D-01 | T-37-01 | hub at preserved `Settings` route; nothing unreachable | type + colour | `npx tsc --noEmit` · `npm run check:colors` | ❌ Wave 0 (hub/model new) | ⬜ pending |
| 37-01-T2 | 01 | 1 | D-04a, D-04c | T-37-01 | prefs via validated DAO `persist()`, no inline SQL | unit + type | `npx vitest run src/screens/settings-interactions-logic.test.ts src/db/app-settings-dao.test.ts` · `npx tsc --noEmit` | ❌ logic test Wave 0 | ⬜ pending |
| 37-01-T3 | 01 | 1 | D-09 (§K) | T-37-01 | hub rows target only registered routes | unit | `npx vitest run src/screens/settings-hub-model.test.ts` | ❌ Wave 0 | ⬜ pending |
| 37-02-T1 | 02 | 2 | D-07, D-01 | T-37-01 | live restyle + durable persist preserved | type + colour + unit | `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/screens/settings-hub-model.test.ts` | ⚠️ new screen | ⬜ pending |
| 37-02-T2 | 02 | 2 | D-07 | T-37-04 | one-line active-package guard, no store/schema change | type + colour | `npx tsc --noEmit` · `npm run check:colors` | ⚠️ | ⬜ pending |
| 37-03-T1 | 03 | 3 | D-04b | T-37-01 | `setProfileName` on `profile` id=1, `changes===1`, name validated | unit + type | `npx vitest run src/db/profile-dao.test.ts` · `npx tsc --noEmit` | ✅ profile-dao.test.ts (add name case) | ⬜ pending |
| 37-03-T2 | 03 | 3 | D-02 | T-37-04 | self-star only; ADR-047 enforced, no contact-centre colour | type + colour | `npx tsc --noEmit` · `npm run check:colors` | ⚠️ | ⬜ pending |
| 37-03-T3 | 03 | 3 | D-05, D-04b | T-37-01 | global default via `updateAppSettings`; per-contact managers not linked | unit + type + colour | `npx vitest run src/db/profile-dao.test.ts src/db/app-settings-dao.test.ts` · `npx tsc --noEmit` · `npm run check:colors` | ✅/⚠️ | ⬜ pending |
| 37-04-T1 | 04 | 4 | D-01 (§E) | T-37-01 | managers reused-by-navigation; phone-region via DAO | type + colour + unit | `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/screens/settings-hub-model.test.ts` | ⚠️ new screen/model | ⬜ pending |
| 37-04-T2 | 04 | 4 | D-03 (§K) | T-37-05 | Categories route reserved, NO rendered row, NO CRUD | type | `npx tsc --noEmit` · `npx vitest run src/screens/settings-contacts-model.test.ts` | ❌ model test Wave 0 | ⬜ pending |
| 37-04-T3 | 04 | 4 | D-03 | T-37-05 | inert-reservation regression guard | unit | `npx vitest run src/screens/settings-contacts-model.test.ts` | ❌ Wave 0 | ⬜ pending |
| 37-05-T1 | 05 | 5 | D-01 (§G) | T-37-06 | reconcileSchedule + reconcileDigestSchedule on EVERY write (Pitfall 5) | type + colour + unit | `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/screens/settings-hub-model.test.ts` | ⚠️ new screen | ⬜ pending |
| 37-05-T2 | 05 | 5 | D-01 (§G) | T-37-01 | permission handoff; controls visible when blocked | type + colour | `npx tsc --noEmit` · `npm run check:colors` | ⚠️ | ⬜ pending |
| 37-06-T1 | 06 | 6 | D-01 (§H) | T-37-01 | Orrery prefs = same `app_settings` source; last-System excluded | type + colour + unit | `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/db/app-settings-dao.test.ts` | ✅/⚠️ | ⬜ pending |
| 37-06-T2 | 06 | 6 | D-01 (§J) | T-37-03 | flips `ai_enabled` only; `AiService.ts` untouched (no egress widening) | type + colour | `npx tsc --noEmit` · `npm run check:colors` | ⚠️ | ⬜ pending |
| 37-06-T3 | 06 | 6 | D-01 (§A) | T-37-01 | hub §A order for Orrery+AI | unit | `npx vitest run src/screens/settings-hub-model.test.ts` | ✅ (extend) | ⬜ pending |
| 37-07-T1 | 07 | 7 | D-08 (§I) | T-37-02 | one canonical Backup tree, two entry points; tab preserved | type + colour + unit | `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/screens/settings-hub-model.test.ts` | ⚠️ | ⬜ pending |
| 37-07-T2 | 07 | 7 | D-08 | T-37-02, T-37-07 | tab-scoped consume (no double-drain); origin-aware return; tab flow unchanged | unit + type | `npx vitest run src/screens/backup-dualhome-logic.test.ts` · `npx tsc --noEmit` | ❌ dual-home test Wave 0 | ⬜ pending |
| 37-08-T1 | 08 | 8 | D-01 (§K) | T-37-01 | About real info only, no dead rows | type + colour + unit | `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/screens/settings-hub-model.test.ts` | ⚠️ | ⬜ pending |
| 37-08-T2 | 08 | 8 | D-01 (§L) | T-37-01 | widget utility row reuses `requestPinWidget` | type + colour | `npx tsc --noEmit` · `npm run check:colors` | ⚠️ | ⬜ pending |
| 37-08-T3 | 08 | 8 | D-06 (§A) | T-37-08 | monolith retired; full §A order; TARGET_VERSION 29 + FORMAT 5 unchanged | full + type + colour + unit | `npm test` · `npx tsc --noEmit` · `npm run check:colors` · `npx vitest run src/screens/settings-hub-model.test.ts` | ✅ (format/version asserts exist) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files to create before/inside their plan (all in existing vitest infra — no framework install):

- [ ] `src/screens/settings-hub-model.test.ts` (Plan 01 T3) — route validity + §A ordering + transitional-row guard (inverted to absent in Plan 08).
- [ ] `src/screens/settings-interactions-logic.test.ts` (Plan 01 T2) — message-mode/right-swipe/channel option models + patch shape.
- [ ] `src/db/profile-dao.test.ts` name case (Plan 03 T1) — add `setProfileName` round-trip + input-validation cases to the existing file.
- [ ] `src/screens/settings-contacts-model.test.ts` (Plan 04 T3) — §E section shape + Categories-reservation inertness guard (D-03).
- [ ] `src/screens/backup-dualhome-logic.test.ts` (Plan 07 T2) — `restoreReturnRouteName` + `shouldConsumeSharedBackup` (no double-drain, origin-aware return).

---

## Manual-Only Verifications (device UAT — Pixel, per memory verify-ui-on-pixel-yourself)

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Navigation-first Settings directory renders + every category route reachable, no behaviour lost vs. the retired monolith | D-09/§A | RN navigation / on-device UI (no component-test harness) | Drive Settings hub → each category → confirm each control reads/writes as the old monolith did |
| Theme controls restyle live + survive relaunch; Galaxy-only control conditional | D-07/§D | live theme + relaunch durability | Change package/mode/accent/background; relaunch; toggle Galaxy vs Standard |
| Self-name persists in `profile` id=1 | D-04b | DB-invariant, run-as (memory device-uat-runas-pattern) | Edit self name; run-as read of `profile` row on a debug build |
| Notifications re-arm the OS schedule immediately | §G/Pitfall 5 | OS scheduler | Toggle a notification setting; confirm schedule re-armed (not next launch) |
| Backup tree renders identically from Backup tab and Settings → Data & Backup; no double-drain; origin-aware return | D-08 | cross-entry-point UI + native singleton (memory saf-grant-reconnect-cycle) | Reach Backup from both; restore from Settings → returns to hub; restore from tab → returns to Backup; shared backup consumed once |
| AI category routes into the Phase 36 hub | §J | on-device nav; DO NOT trigger a real AI call (memory no-ai-api-calls-without-clearing) | Open Connection/Model/Personalization/Permissions/Preview; toggle AI enabled only |

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify (logic-module test / DAO test / tsc / check:colors) or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (5 new/extended test files listed above)
- [x] No watch-mode flags (all `vitest run` / `tsc --noEmit`)
- [x] Feedback latency < 10s for quick suites
- [x] `nyquist_compliant: true` set in frontmatter (automated logic + type + colour gates on every task; RN nav rendering is device-UAT by repo constraint)

**Approval:** filled by plan-phase 2026-09-14; validate-phase confirms after execution.
