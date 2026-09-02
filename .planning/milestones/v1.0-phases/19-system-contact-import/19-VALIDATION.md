---
phase: 19
slug: system-contact-import
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `19-RESEARCH.md` § Validation Architecture. Scope: **Android-only** (owner ruling — iOS deferred).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`vitest run`) — node harness [VERIFIED: package.json] |
| **Config file** | vitest (project convention: pure `.ts` logic + `node:sqlite` DAO tests; `.tsx`/native = device-UAT) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test` (~1,510 tests green per 18.1 close-out) |
| **Estimated runtime** | full suite ~tens of seconds; single-file quick run ~1–3s |
| **Colour gate** | `npm run check:colors` (bash scripts/check-colors.sh) [VERIFIED: package.json] |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched file>` + `npm run check:colors`
- **After every plan wave:** Run `npm test` (full suite green)
- **Before `/gsd-verify-work`:** Full suite green + tsc + biome + **Android 17 device UAT** (picker happy path, unsupported-state on a pre-17 device, process-death resume)
- **Max feedback latency:** < 5 seconds for the per-task quick run

---

## Phase Requirements → Test Map (from research; planner assigns final task IDs)

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| IMP-01 | `isContactPickerAvailable` gate hides entry on SDK<37 | unit (pure) | `npx vitest run src/logic/picked-contact-map.test.ts` | ❌ Wave 0 |
| IMP-02 | `createContactFull(trackingEnabled=false, intervalDays=null)` writes Unbound + methods; batch category applied | node:sqlite | `npx vitest run src/db/imported-contact-dao.test.ts` | ❌ Wave 0 |
| IMP-02 | Chunked driver processes N incrementally, emits progress | unit (pure) | `npx vitest run src/services/import/import-driver.test.ts` | ❌ Wave 0 |
| IMP-03 | Deterministic bypass on active `external_contact_links`; advisory ladder; no name-only auto-link; no correlated double-count | node:sqlite + unit | `npx vitest run src/services/import/duplicate-evidence.test.ts` | ❌ Wave 0 |
| IMP-04 | Migration 012 up from v11 preserves rows; session survives simulated process death; partial commit stands; photo-fail keeps contact | migration + node:sqlite | `npx vitest run src/db/migrations/012-import-sessions.test.ts` | ❌ Wave 0 |
| IMP-04 | Resume/Discard sweep offers pending session; discard clears only unresolved state | node:sqlite | `npx vitest run src/services/import/contact-import-resume-sweep.test.ts` | ❌ Wave 0 |

---

## Per-Task Verification Map

*Seeded as draft — validate-phase fills this after the planner assigns task IDs and after execution.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | IMP-04 | T-19-05 / — | migration 012 preserves rows, forward-only | migration | `npx vitest run src/db/migrations/012-import-sessions.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/migrations/012-import-sessions.ts` + `.test.ts` — v11→v12, `import_sessions` + `import_session_rows`; register in `MIGRATIONS`, bump `TARGET_VERSION = 12` [VERIFIED: src/db/database.ts:46,49-61]
- [ ] `src/db/imported-contact-dao.ts` (+test) — composed create/link + external link + provenance, one transaction
- [ ] `src/services/import/duplicate-evidence.ts` (+test) — deterministic bypass + advisory ladder
- [ ] `src/services/import/import-driver.ts` (+test) — chunked partial-failure driver
- [ ] `src/logic/picked-contact-map.ts` (+test) — `PickedContact` → `CreateContactFullInput` + birthday mapping
- [ ] Native module (`ACTION_PICK_CONTACTS` Expo module) has **no node test** — device-UAT only (repo convention for native/`.tsx`)

*Framework install: none needed (Vitest present).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Android 17 Contact Picker happy path (name + methods import) | IMP-01/IMP-02 | Native intent + real system picker; no node harness for native | On an Android 17 device: Add flow → import → pick 1 contact → review → create → verify Unbound contact with normalized methods |
| Unsupported-state on pre-17 device | IMP-01 | Requires a real pre-17 device/OS | On a pre-17 device: confirm import entry is hidden/disabled and Orbit stays otherwise usable |
| Process-death resume | IMP-04 | Requires killing the app mid-session on device | Start a session, force-stop app, relaunch, confirm Resume/Discard sweep offers the pending session from the snapshot (not a re-query of the expired grant) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
