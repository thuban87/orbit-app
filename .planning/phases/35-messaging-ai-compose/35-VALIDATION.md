---
phase: 35
slug: messaging-ai-compose
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-13
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from 35-RESEARCH.md §Validation Architecture; validate-phase completes the per-task map once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node env; RN modules injected/mocked — project convention) |
| **Config file** | repo Vitest config (project default) |
| **Quick run command** | `npx vitest run <touched-path>` |
| **Full suite command** | `npm test` then `npx tsc --noEmit` then `npm run check:colors` |
| **Estimated runtime** | ~ full suite (3200+ tests) — quick per-module runs are seconds |

> Memory `tsc-in-post-merge-gate`: a passing Vitest suite is NOT a clean typecheck — `tsc --noEmit` is not in a commit hook. Run it (and `check:colors`) at every wave merge and before phase close.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched-path>` + `npx tsc --noEmit`
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit` + `npm run check:colors`
- **Before `/gsd-verify-work`:** Full suite green + device UAT on the Pixel (memory `verify-ui-on-pixel-yourself`)
- **Max feedback latency:** seconds (per-module) / full suite at wave merge

---

## Per-Task Verification Map

*Seeded — validate-phase completes this once PLAN.md task IDs exist. Representative mapping from research:*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | 0 | COMP-02 | — | mode default + remembered-on-Copy/Transmit | unit | `npx vitest run src/logic/compose-*` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | migration 028 | — | additive columns, head+1, portable-allowlisted (not emitted) | unit | `npx vitest run src/db/migrations/028-* full-chain.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 1 | COMP-03 | — | primary resolve + mode fallback + no-destination Transmit-unavailable | unit | `npx vitest run src/logic/compose-logic.test.ts` | ⚠ extend | ⬜ pending |
| TBD | — | 1 | COMP-05/06 | T-35 (egress/handoff) | confirm logs at handoff_at; Not yet keeps session; Copy no-trigger; banner/sheet coexist | unit | `npx vitest run src/db/interaction-assist-dao.test.ts` | ✅ extend | ⬜ pending |
| TBD | — | 1 | COMP-07 | — | session survives nav/background, not relaunch | unit | `npx vitest run src/stores/compose-session-store.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 1 | COMP-10 | T-35 (egress) | egress excludes off_limits/Group Notes; note gated on allow_ai; shapes carried only | unit | `npx vitest run src/db/ai-context-read.test.ts fuel-read.test.ts` | ✅ extend | ⬜ pending |
| TBD | — | 1 | COMP-12/13 | — | three suggestions; non-destructive; cancel/timeout/stale; no ack gate | unit | `npx vitest run src/logic/ai-suggestion-logic.test.ts` | ✅ reshape | ⬜ pending |
| TBD | — | 2 | COMP-14 | — | origin-aware return, no finished route in Back | manual/device | Pixel UAT (desktop-build-pipeline) | 🧪 device | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/migrations/028-*.test.ts` + `full-chain.test.ts` update — migration 028 additive columns
- [ ] `src/stores/compose-session-store.test.ts` — session state (survives nav/background, not relaunch)
- [ ] `ai-suggestion-logic.test.ts` extension — three suggestions, no ack gate, Try Again replaces set
- [ ] `compose-logic` Text/Email + no-destination matrix — extend existing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Origin-aware return + no finished Compose route in Back history | COMP-14 | Navigation/Back-stack behavior is device-observable, not unit-checkable | Pixel UAT: launch Compose from Profile, Transmit-confirm, verify return to Profile and Back does not resurrect the finished draft |
| External SMS/email handoff opens the right composer with recipient/subject/body | COMP-04/05 | OS intent handoff crosses the app boundary | Pixel UAT: Transmit in Text and Email modes; verify composer opens pre-filled; Orbit never claims delivery |
| adb tap taxonomy on small controls | COMP-09/12 | `adb input tap` false-negatives on small RN Pressables (memory `adb-input-source-taxonomy`) | Verify control wiring against code before declaring broken; use correct input method per control |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (per-module seconds; full suite at wave merge)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
