---
phase: 31
slug: profile-experience
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-09
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, Node environment |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <changed-test-file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | Measure during Wave 0 and record before implementation waves |

---

## Sampling Rate

- **After every task commit:** Run the targeted changed-file Vitest command and `npm run check` when TypeScript or UI files change
- **After every plan wave:** Run `npm test && npm run check`
- **Before `$gsd-verify-work`:** Full suite, migration chain tests, and required physical-device UAT must be green
- **Max feedback latency:** Record the measured full-suite baseline during Wave 0; no three consecutive implementation tasks may pass without automated feedback

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-W0-01 | TBD | 0 | PROF-02/03/05/07/08 | T-31-01 | Closed parser rejects malformed/tampered layout documents and falls back safely | unit | `npx vitest run src/profile/presentation-schema.test.ts src/profile/resolve-presentation.test.ts` | ❌ W0 | ⬜ pending |
| 31-W0-02 | TBD | 0 | PROF-03/04/05/07 | T-31-02 | Migration and CRUD preserve FK integrity; reset/delete affect presentation only | integration | `npx vitest run src/db/migrations/024-profile-presentation.test.ts src/db/profile-presentation-dao.test.ts` | ❌ W0 | ⬜ pending |
| 31-W0-03 | TBD | 0 | PROF-09/20 | T-31-03 | Packing is deterministic and accessible reorder actions match drag behavior | unit | `npx vitest run src/profile/pack-overview.test.ts src/profile/layout-editor-reducer.test.ts` | ❌ W0 | ⬜ pending |
| 31-W0-04 | TBD | 0 | PROF-10/11 | — | Metrics retain existing semantics and use the shared calendar-month fallback | unit | `npx vitest run src/services/profile-metrics.test.ts` | ❌ W0 | ⬜ pending |
| 31-W0-05 | TBD | 0 | PROF-12 | T-31-04 | Frequency and snooze writes compose atomically without nested transactions | integration | `npx vitest run src/db/profile-relationship-actions.test.ts` | ❌ W0 | ⬜ pending |
| 31-W0-06 | TBD | 0 | PROF-13 | T-31-05 | Complete method sets remain readable; malformed values never become actionable | unit/integration | `npx vitest run src/db/contact-methods-read.test.ts` | ✅ extend | ⬜ pending |
| 31-W0-07 | TBD | 0 | PROF-14/15/16/17 | T-31-06 | Source boundaries, hidden/pinned rules, grouping, caps, and Off Limits isolation are preserved | unit/integration | `npx vitest run src/db/profile-knowledge-read.test.ts src/profile/knowledge-presentation.test.ts` | ❌ W0 | ⬜ pending |
| 31-W0-08 | TBD | 0 | PROF-18 | — | Interim history projection is bounded and renderer lookup remains replaceable | unit/integration | `npx vitest run src/db/profile-history-read.test.ts src/profile/module-registry.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/profile/presentation-schema.test.ts` — closed/versioned persisted document
- [ ] `src/profile/resolve-presentation.test.ts` — hierarchy and fallout matrix
- [ ] `src/db/migrations/024-profile-presentation.test.ts` — fresh and 023→024 chains
- [ ] `src/db/profile-presentation-dao.test.ts` — atomic CRUD/reset/template deletion
- [ ] `src/profile/pack-overview.test.ts` — supported variants and no avoidable holes
- [ ] `src/profile/layout-editor-reducer.test.ts` — drag and accessible action parity
- [ ] `src/services/profile-metrics.test.ts` — truthful status and shared Unbound month fallback
- [ ] `src/db/profile-knowledge-read.test.ts` — source boundaries, hidden/pinned rules, grouping, caps, and Off Limits
- [ ] `src/profile/knowledge-presentation.test.ts` — card ordering, truncation, and visibility model
- [ ] `src/db/profile-history-read.test.ts` — bounded interim projection
- [ ] `src/profile/module-registry.test.ts` — stable renderer seam for Phase 32

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fixed Hero geometry, disabled action explanations, and overflow ordering | PROF-01/19/20 | Native layout and accessibility semantics are not proven by render-free Node tests | On the physical Android target, inspect populated and missing-method contacts in both themes; verify screen-reader labels and disabled explanations |
| Background crop and template assignment | PROF-04 | Crop gestures, native image decode, and final visual composition require device observation | On the physical target, crop portrait and landscape images, save/cancel, switch assignments, restart, and confirm persistence and density scrim behavior |
| Deliberate layout edit mode and live preview | PROF-06/20 | Drag, focus, dismissal, large-text, and accessible action parity are native interactions | Enter edit mode from overflow, exercise drag and textual alternatives, test Save/Cancel/dirty dismissal, then repeat with large text and screen reader enabled |
| Things to Remember detail and long-press actions | PROF-15/16 | Gesture recognition, focused sheet behavior, truncation, and navigation are UI-observable | Verify tap-to-detail, long-press Edit/Pin/Hide, View All, Show hidden, and Off Limits caution styling without changing sparkle semantics |
| Origin-aware navigation and final Profile composition | PROF-01/18/19 | Navigation stack behavior and the renderer seam require end-to-end app execution | Open Profile from each supported origin, exercise Hero and section actions, return, and confirm the correct destination and state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency baseline measured and accepted
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
