---
phase: 17
slug: backup-export-restore
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-25
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- src/backup/reconciliation.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~60 seconds |

## Sampling Rate

- **After every task commit:** Run the focused Vitest file(s), `npx tsc --noEmit`, and `npm run check:colors` for screen work.
- **After every plan wave:** Run `npm test -- --run`.
- **Before `$gsd-verify-work`:** Full suite, typecheck, and colour check must be green.
- **Max feedback latency:** 60 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-W0-01 | TBD | 0 | BKP-01 | T-17-01 | Full manifest excludes API keys, encryption material, and `field_history`; includes rows, photos, and tombstones. | unit/integration | `npm test -- src/backup/export-manifest.test.ts src/backup/backup-schema.test.ts` | ❌ W0 | ⬜ pending |
| 17-W0-02 | TBD | 0 | BKP-02 | T-17-02 | A successful, verified automatic SAF write precedes pruning and is the only source of health success. | unit | `npm test -- src/backup/auto-backup-policy.test.ts` | ❌ W0 | ⬜ pending |
| 17-W0-03 | TBD | 0 | BKP-03 | T-17-03 | AES-256-GCM envelope rejects tampering/wrong passphrases and never logs or persists plaintext passphrases outside SecureStore. | unit + Android smoke | `npm test -- src/backup/encryption.test.ts` | ❌ W0 | ⬜ pending |
| 17-W0-04 | TBD | 0 | BKP-04 | T-17-04 | Parse and graph validation completes before writes; merge honors UID/LWW/tombstones and replace rebuilds derived state. | unit/integration | `npm test -- src/backup/reconciliation.test.ts src/backup/restore-apply.test.ts` | ❌ W0 | ⬜ pending |
| 17-W0-05 | TBD | 0 | BKP-04 | T-17-05 | Migration 007 preserves each mergeable hard-delete UID as an indefinitely retained tombstone in the deletion transaction. | unit | `npm test -- src/db/migrations/007-tombstones.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] `src/db/migrations/007-tombstones.test.ts` — additive upgrade and unique logical tombstone coverage.
- [ ] `src/backup/reconciliation.test.ts` — pure winner/deletion/UID-parent policy.
- [ ] `src/backup/backup-schema.test.ts` — strict parse, forward migration, and input-graph validation.
- [ ] `src/backup/restore-apply.test.ts` — outer transaction, normalized-pair integrity, and derived rebuild.
- [ ] `src/backup/auto-backup-policy.test.ts` — due/change/rotation and health semantics.
- [ ] `src/backup/encryption.test.ts` — parameterized envelope vectors and fake-backed lifecycle coverage.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Persisted SAF folder write and folder-loss state | BKP-02 | Requires a real Android document provider and retained grant. | Select a SAF folder, relaunch to verify an automatic snapshot, revoke/remove the folder, relaunch, and verify the calm lost-folder state without a false healthy result. |
| Manual share export and encrypted restore | BKP-01, BKP-03, BKP-04 | Requires system share sheet, native crypto, and real file selection. | On a release build, share plaintext and encrypted exports, select each through the system picker, verify wrong-passphrase/corrupt-file errors retain local state, then complete Merge and Replace-all with disposable data. |
| Encryption parameter benchmark | BKP-03 | PBKDF2 iteration cost must be confirmed on the target Pixel before the envelope default is frozen. | Measure setup/decrypt duration on a physical Pixel; record the selected versioned KDF parameters and confirm the experience is usable. |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency < 60s.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
