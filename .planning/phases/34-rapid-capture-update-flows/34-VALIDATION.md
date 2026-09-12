---
phase: 34
slug: rapid-capture-update-flows
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-12
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `34-RESEARCH.md` § Validation Architecture; validate-phase / gsd-add-tests fills the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.10 (package.json:55) — node env; RN `.tsx` screens are NOT loadable, test pure `*-logic.ts` modules |
| **Config file** | vitest (node env) |
| **Quick run command** | `npx vitest run <path/to/file.test.ts>` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Colour gate** | `npm run check:colors` — blocks hex/named colour literals in `src/` |
| **Estimated runtime** | ~30s per touched module; full suite per wave |

---

## Sampling Rate

- **After every task commit:** Run the touched module's `*.test.ts` via `npx vitest run <file>` (< 30s)
- **After every plan wave:** Run `npm test` + `npm run check:colors`
- **Before `/gsd-verify-work`:** Full suite green + on-device UAT of the four flows on the Pixel
- **Max feedback latency:** ~30 seconds per task

---

## Per-Task Verification Map

*Seeded from RESEARCH § Phase Requirements → Test Map; validate-phase fills task IDs after plans exist.*

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| CAPT-01/02/03 | Name-only save gate; tri-state → firstInteraction; Unbound-on-no-cadence | unit | `npx vitest run src/screens/create-contact-logic.test.ts` | ✅ (extend) | ⬜ pending |
| CAPT-05 | Quick Log immediate + Undo/Retry; single-flight; Add-Note→Note-or-Memory | unit | `npx vitest run src/services/quick-log-command.test.ts` | ✅ (extend) | ⬜ pending |
| CAPT-07/08 | Channel-sensitive Direction/Connected defaulting; backdate guard | unit | `npx vitest run src/screens/log-interaction-logic.test.ts` | ❌ W0 | ⬜ pending |
| CAPT-07 | Duration parse/label; date+time combine; future-datetime reject | unit | `npx vitest run src/components/touchpoint-refine-logic.test.ts` | ✅ | ⬜ pending |
| CAPT-09/10 | Tone null-not-Neutral; allowAi coerce OFF; edit round-trip | unit | `npx vitest run src/db/recency-dao.test.ts` + `interaction-edit-read.test.ts` | ✅ (assert) | ⬜ pending |
| CAPT-11 | Default Channel pref read/write; remembered updates only on save; migration 027 | unit | `npx vitest run src/db/app-settings-dao.test.ts` + `src/db/migrations/027-*.test.ts` | ❌ W0 | ⬜ pending |
| CAPT-15 | No straggler legacy vocab; consumers use Tone literals (satisfied-by-dependency, VERIFY not re-migrate) | regression | `npx vitest run src/db/ai-context-read.test.ts src/db/digest-read.test.ts` + grep audit | ✅ (verify) | ⬜ pending |
| CAPT-12/13/14 | Update Contact loop; preselect; failure preserves state | unit | new `update-contact-*-logic.test.ts` | ❌ W0 | ⬜ pending |
| all UI flows | on-device behavior | manual UAT | build debug APK on droid, run on Pixel | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/screens/log-interaction-logic.ts` (+test) — channel-sensitive Direction/Connected defaulting (CAPT-08), backdate handling (CAPT-07)
- [ ] `src/db/migrations/027-<name>.ts` (+test) — Default Interaction Channel `app_settings` columns
- [ ] Update-Contact chooser + post-log-note pure logic modules (+tests)
- [ ] Extend `app-settings-dao.test.ts`, `create-contact-logic.test.ts`, `quick-log-command.test.ts`, `backup-schema.test.ts`
- [ ] `check:colors` must stay green — no new colour literals (compose theme tokens)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Four capture flows render + behave correctly across 4 resolved palettes | CAPT-01..14 | RN `.tsx` screens not vitest-loadable; UI-observable behavior | Build debug APK on droid, install on Pixel, drive each flow (Add Contact, Quick Log + Add Note, Log Interaction, Update Contact loop) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
