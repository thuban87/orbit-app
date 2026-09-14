---
phase: 37
slug: settings-personalization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-14
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node:sqlite for DAO tests) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --run <changed test>` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~TBD seconds (planner to fill from current suite) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched area
- **After every plan wave:** Run the full suite
- **Before `/gsd-verify-work`:** Full suite must be green + `tsc --noEmit` clean
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Consolidation phase — existing vitest infrastructure covers DAO/round-trip assertions. Planner confirms whether any new test file (e.g. Backup dual-home render parity, preference round-trip) is a Wave 0 stub.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Navigation-first Settings directory renders + every category route reachable | — | RN navigation / on-device UI | Drive app on Pixel: open Settings hub, tap each category route, confirm no behaviour lost vs. old monolith |
| Backup tree renders identically from Backup tab and Settings → Data & Backup | — | Cross-entry-point UI parity + native singleton | Reach Backup from both entry points; confirm no double-drain of `consumeSharedBackup`, correct return semantics |

*Planner refines against RESEARCH.md `## Validation Architecture`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
