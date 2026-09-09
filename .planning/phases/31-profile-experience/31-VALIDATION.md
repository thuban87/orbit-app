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
| 31-01-T2 | 31-01 Task 2 | 1 | baseline | — | Full pre-change suite/check runtime is measured before implementation | regression | `npm test && npm run check` | ✅ command | ⬜ pending |
| 31-01-T3 | 31-01 Task 3 (TDD tracer) | 1 | PROF-01/07/08/10 | T-31-01/02 | Migration chain and clickable collapse tap→write→readback/relaunch path start red, then pass | integration | `npx vitest run src/db/migrations/024-profile-presentation.test.ts src/db/profile-presentation-dao.test.ts src/screens/contact-profile-logic.test.ts` | ❌ create first | ⬜ pending |
| 31-02-T1 | 31-02 Task 1 (TDD) | 2 | PROF-02/03/05/07/08 | T-31-01 | Closed parser/resolver tests are authored red before contracts | unit | `npx vitest run src/profile/presentation-schema.test.ts src/profile/resolve-presentation.test.ts src/db/app-settings-dao.test.ts` | ❌ create first | ⬜ pending |
| 31-02-T2 | 31-02 Task 2 (TDD) | 2 | PROF-03/05/07 | T-31-04/06 | Read/fallthrough/usage fixtures extend the DAO test red before reader implementation | integration | `npx vitest run src/db/profile-presentation-dao.test.ts` | ❌ extend 31-01-T3 test first | ⬜ pending |
| 31-02-T3 | 31-02 Task 3 (TDD) | 2 | PROF-03/04/05/07 | T-31-04/05/06 | DAO reset/delete/collapse tests are extended red before implementation | integration | `npx vitest run src/db/profile-presentation-dao.test.ts` | ❌ extend first | ⬜ pending |
| 31-03-T1 | 31-03 Task 1 (TDD) | 3 | PROF-10/11 | T-31-07 | Metrics tests precede shared calendar-month implementation | unit | `npx vitest run src/services/profile-metrics.test.ts` | ❌ create first | ⬜ pending |
| 31-03-T2 | 31-03 Task 2 (TDD) | 3 | PROF-12 | T-31-08 | Frequency/snooze rollback/event tests precede writers | integration | `npx vitest run src/db/profile-relationship-actions.test.ts` | ❌ create first | ⬜ pending |
| 31-04-T1 | 31-04 Task 1 (TDD) | 4 | PROF-13/14/15/16/17 | T-31-09/10/11 | Method/knowledge/Off-Limits no-sparkle boundary tests precede readers | unit/integration | `npx vitest run src/db/profile-knowledge-read.test.ts src/db/contact-methods-read.test.ts` | ❌ create/extend first | ⬜ pending |
| 31-04-T2 | 31-04 Task 2 (TDD) | 4 | PROF-18 | — | Bounded history tests precede reader | integration | `npx vitest run src/db/profile-history-read.test.ts` | ❌ create first | ⬜ pending |
| 31-04-T3 | 31-04 Task 3 (TDD) | 4 | PROF-01/08/10/11/13/14/16/17/18 | T-31-09/10/11 | Aggregate snapshot cases extend the precise 31-04-T1/T2 read tests red before composition | integration | `npx vitest run src/db/profile-knowledge-read.test.ts src/db/profile-history-read.test.ts` | ❌ extend 31-04-T1/T2 tests first | ⬜ pending |
| 31-05-T1 | 31-05 Task 1 (TDD) | 5 | PROF-09/18/20 | T-31-13 | Packing/renderer tests precede algorithms | unit | `npx vitest run src/profile/pack-overview.test.ts src/profile/module-registry.test.ts` | ❌ create first | ⬜ pending |
| 31-05-T2 | 31-05 Task 2 (TDD contract) | 5 | PROF-10/11/12/20 | T-31-12/14 | Explanation/frequency/snooze contract tests precede sheets | unit | `npx vitest run src/profile/relationship-sheet-model.test.ts` | ❌ create first | ⬜ pending |
| 31-05-T3 | 31-05 Task 3 | 5 | PROF-07/08/18/20 | T-31-12 | Collapse readback/relaunch/failure tests extend tracer before host expansion | integration | `npx vitest run src/db/profile-presentation-dao.test.ts src/screens/contact-profile-logic.test.ts` | ❌ extend first | ⬜ pending |
| 31-06-T1 | 31-06 Task 1 (TDD) | 6 | PROF-14/15/16/17 | T-31-15/16 | Ten-type exhaustive presentation/no-sparkle tests precede adapters | unit | `npx vitest run src/profile/knowledge-presentation.test.ts` | ❌ create first | ⬜ pending |
| 31-06-T2 | 31-06 Task 2 | 6 | PROF-13/14/15/16/17/20 | T-31-15/16 | Renderer UI consumes the semantic cases owned by 31-06-T1 and method cases owned by 31-04-T1 | contract/check | `npx vitest run src/profile/knowledge-presentation.test.ts src/db/contact-methods-read.test.ts && npm run check` | ✅ consumes 31-06-T1 + 31-04-T1 | ⬜ pending |
| 31-07-T1 | 31-07 Task 1 (TDD) | 7 | PROF-02/06/09/20 | T-31-17/18 | Reducer parity tests precede editor reducer | unit | `npx vitest run src/profile/layout-editor-reducer.test.ts` | ❌ create first | ⬜ pending |
| 31-07-T2 | 31-07 Task 2 | 7 | PROF-02/06/07/09/20 | T-31-17/18 | Editor UI consumes reducer cases owned by 31-07-T1 and parser cases owned by 31-02-T1 | contract/check | `npx vitest run src/profile/layout-editor-reducer.test.ts src/profile/presentation-schema.test.ts && npm run check` | ✅ consumes 31-07-T1 + 31-02-T1 | ⬜ pending |
| 31-08-T1 | 31-08 Task 1 | 8 | PROF-03/05/06/07/19/20 | T-31-19/20 | Manager UI consumes DAO mutation cases owned by 31-02-T3 and parser cases owned by 31-02-T1 | contract/check | `npx vitest run src/db/profile-presentation-dao.test.ts src/profile/presentation-schema.test.ts && npm run check` | ✅ consumes 31-02-T3 + 31-02-T1 | ⬜ pending |
| 31-08-T2 | 31-08 Task 2 | 8 | PROF-03/05/06/07/19/20 | T-31-19/20 | Assignment UI consumes hierarchy cases owned by 31-02-T1 and mutation cases owned by 31-02-T3 | contract/check | `npx vitest run src/db/profile-presentation-dao.test.ts src/profile/resolve-presentation.test.ts && npm run check` | ✅ consumes 31-02-T1 + 31-02-T3 | ⬜ pending |
| 31-09-T1 | 31-09 Task 1 (TDD) | 9 | PROF-04/20 | T-31-21/22 | Crop geometry tests are authored red before implementation | unit | `npx vitest run src/services/photos/background-crop-geometry.test.ts` | ❌ create first | ⬜ pending |
| 31-09-T2 | 31-09 Task 2 (TDD) | 9 | PROF-04/05/07 | T-31-21/22/23 | Storage/pipeline crash and path tests are authored red before implementation | unit/integration | `npx vitest run src/services/photos/background-storage.test.ts src/services/photos/background-pipeline.test.ts` | ❌ create first | ⬜ pending |
| 31-09-T3 | 31-09 Task 3 | 9 | PROF-01/04/05/07/20 | T-31-21/22/23 | Background manager consumes geometry/storage/pipeline tests owned by 31-09-T1/T2 and DAO cases owned by 31-02-T3 | contract/check | `npx vitest run src/services/photos/background-crop-geometry.test.ts src/services/photos/background-storage.test.ts src/services/photos/background-pipeline.test.ts src/db/profile-presentation-dao.test.ts && npm run check` | ✅ consumes 31-09-T1/T2 + 31-02-T3 | ⬜ pending |
| 31-10-T1 | 31-10 Task 1 (TDD) | 10 | PROF-01/02/03/04/05/06/07/08/09/10/11/12/13/14/15/16/17/18/19/20 | T-31-24/25/26 | Integrated controller cases extend contact-profile-logic red before host replacement and consume all named subsystem owners | integration | `npx vitest run src/screens/contact-profile-logic.test.ts src/profile/resolve-presentation.test.ts src/db/profile-relationship-actions.test.ts src/profile/knowledge-presentation.test.ts src/profile/module-registry.test.ts` | ❌ extend 31-01-T3/31-05-T3 test first | ⬜ pending |
| 31-10-T2 | 31-10 Task 2 | 10 | PROF-01/02/03/04/05/06/07/08/09/10/11/12/13/14/15/16/17/18/19/20 | T-31-24/25/26 | Documentation/checklist consumes every prior automated owner and executes the full regression boundary | regression/docs | `npm test && npm run check` | ✅ consumes 31-01-T3 through 31-10-T1 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Test Ownership / Pre-implementation State

There is no detached implementation-free Wave 0 plan. `31-01 Task 2` is the executable baseline gate before production edits; every missing test is created RED as the first move of its named `tdd="true"` owner task. `wave_0_complete` remains `false` until the baseline task has run and recorded its measurement.

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
| Things to Remember detail and long-press actions | PROF-15/16/17 | Gesture recognition, focused sheet behavior, truncation, and navigation are UI-observable | Verify tap-to-detail, long-press Edit/Pin/Hide, View All, Show hidden, and Off Limits caution styling with no sparkle or inferred permission |
| Relationship explanations and selectors | PROF-10/11/12/20 | Native sheet focus, dismissal, selected states, and pending/error feedback require device observation | Open Status/Gravity/Intensity explanations; follow Status to current History; exercise every Frequency choice and Snooze preset/custom duration/date, including failure/Retry and Back/scrim dismissal |
| Durable top-level and child collapse | PROF-07/08/20 | Relaunch persistence and native accessibility announcements require end-to-end execution | Toggle one top-level and one eligible Things-to-Remember child, restart, verify readback; induce/observe failure retention and Retry; verify expanded/collapsed announcements |
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
