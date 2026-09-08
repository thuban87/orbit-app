---
phase: 30
slug: orrery-systems
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-08
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded by plan-phase from 30-RESEARCH.md's `## Validation Architecture`; the planner fills the Per-Task Verification Map and Wave 0 requirements.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node:sqlite in-memory for DB/DAO invariants; see RESEARCH §Validation Architecture) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm run test -- <changed spec>` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~ (planner to fill) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <changed spec>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** (planner to fill) seconds

---

## Per-Task Verification Map

*Planner fills this from PLAN.md tasks. DB-invariant classes to cover (from RESEARCH §Validation Architecture): unique case-insensitive System names; All Contacts pinned first + nondeletable/nonrenamable; ON DELETE CASCADE of rule/inclusion/exclusion rows on System delete; rule resolution (OR-within-family / AND-across-family); manual-exclusion-discarded-when-stops-matching; broken-rule detection for deleted Category refs; forward-only migration 022 run from any prior version.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Planner to confirm. Existing vitest infrastructure is present (Phase 29 shipped DB/DAO specs); Wave 0 likely adds new spec files for the Systems DAO + rule resolver rather than installing a framework.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skia Preview render (simplified bodies/rails) | ORRS-07 | Skia render loop; not assertable in vitest | Device UAT — open Preview over a real System |
| System-switch animation (spin + shedding/capture, delta-adaptive) | ORRS-13 | Skia/Reanimated render loop on JS+UI thread | Device UAT on the Pixel (emulator cannot assess) |
| Reduced Motion crossfade path | ORRS-13 | OS Reduced Motion setting | Device UAT with Reduced Motion on |
| Large-System scale / culling / LOD (§Z) | ORRS-05/07 | Performance is device-bound | Device UAT on the Pixel with a large fixture set |
| Canonical Home framing + focus preservation across switch | ORRS-12 | Camera geometry, visual | Device UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < (planner) s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
