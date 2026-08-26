---
phase: 18
slug: contact-data-normalization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` |
| **Config file** | None — source-adjacent `*.test.ts` / `*.test.tsx` is the established convention. |
| **Quick run command** | `npm test -- src/db/migrations/009-contact-data-normalization.test.ts src/db/contact-methods-dao.test.ts` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run check:colors` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant targeted Vitest command and `npx tsc --noEmit` for DAO/type changes.
- **After every plan wave:** Run `npm test && npx tsc --noEmit && npm run check:colors`.
- **Before `$gsd-verify-work`:** The full suite must be green, followed by owner-gated Android release UAT for migration-on-device, method UI, Bound/Unbound transitions, widget, and notifications.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | TBD | 0 | CDN-01 | T-18-01 | Migration copies scalar methods once as primary, preserves malformed values, and retires scalar authority. | Node SQLite migration + DAO unit | `npm test -- src/db/migrations/009-contact-data-normalization.test.ts src/db/contact-methods-dao.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-02 | TBD | 0 | CDN-02 | T-18-02 | Lifecycle transitions preserve history, require cadence for Bound, and never clear assigned cadence. | Node SQLite DAO/constraint | `npm test -- src/db/contact-lifecycle-dao.test.ts src/db/migrations/009-contact-data-normalization.test.ts` | ❌ W0 | ⬜ pending |
| 18-02-01 | TBD | 1 | CDN-03 | T-18-03 | Bound-only projections exclude Unbound; gravity remains available and no unbound contact reaches a cadence-status projection. | Read/logic unit | `npm test -- src/db/dashboard-read.test.ts src/db/orrery-read.test.ts src/db/notification-read.test.ts src/db/impact-read.test.ts` | Existing files extended | ⬜ pending |
| 18-03-01 | TBD | 2 | CDN-04 | T-18-04 | Backup/restore retains methods, links, provenance, lifecycle state, cadence, and tombstones without destructive source semantics. | Backup integration | `npm test -- src/backup/export-manifest.test.ts src/backup/restore-apply.test.ts src/backup/backup-schema.test.ts` | Existing files extended | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/migrations/009-contact-data-normalization.test.ts` — a real v8 fixture proving scalar/method/lifecycle migration cases.
- [ ] `src/db/contact-methods-dao.test.ts` — same-contact canonical collapse, primary promotion, cross-contact sharing, invalid storage, ordering, and provenance.
- [ ] `src/db/contact-lifecycle-dao.test.ts` — lifecycle matrix and SQL-trigger rollback.
- [ ] Extend `src/backup/export-manifest.test.ts`, `src/backup/restore-apply.test.ts`, and `src/backup/backup-schema.test.ts` before backup wire-format changes.
- [ ] Extend every query-owner test in the verification map, including the invariant that Unbound never reaches derived status SQL.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installed phone parser legitimacy | CDN-01 | The research audit marked the current `libphonenumber-js` release as suspicious solely because it is newly published. | Human verifies the package/release provenance before installation; record approval at the install checkpoint. |
| Android migration and contact-method UI | CDN-01, CDN-02, CDN-03 | Requires a device build and platform handoff/widget/notification refresh behavior. | Upgrade a v8 fixture on-device; create, bind, unbind, and rebind contacts; confirm Unbound is absent from proactive surfaces but retained in explicit views. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency < 90 seconds.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
