---
phase: 26
slug: dashboard-control-surface
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 26-RESEARCH.md § Validation Architecture. **Critical constraint:** vitest runs
> `environment: "node"` (render-free, Hermes-like) — component rendering, animation, a11y focus,
> blur, and gesture behavior are **on-device UAT only** (Pixel, per the repo's verify-UI-on-the-Pixel
> rule). Only pure logic is unit-testable.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (`environment: node`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/control-surface` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Static gates** | `npm run check:colors` (no colour literals) + `tsc --noEmit` (icon glyph validation) |
| **Estimated runtime** | ~quick per-dir; full suite per repo baseline |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched dir>` + `npm run check:colors` + `tsc --noEmit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green **and** on-device UAT pass on the Pixel
- **Max feedback latency:** quick per-dir run (< ~30s target)

---

## Per-Task Verification Map

> Seeded requirement→test map (RESEARCH § Phase Requirements → Test Map). The planner fills exact
> task IDs / plan / wave. Rendering/animation/a11y-focus/gesture behaviors are on-device UAT only.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DASHC-03 | `+N` summary collapse | unit (pure) | `npx vitest run src/components/control-surface/control-summary.test.ts` | ❌ W0 | ⬜ pending |
| DASHC-04 | anchor rect → clamped position | unit (pure) | `npx vitest run src/components/control-surface/anchor-position.test.ts` | ❌ W0 | ⬜ pending |
| DASHC-06 | population/filter/sort defaults + reset | unit | `npx vitest run src/stores/dashboard-query-store.test.ts` | ✅ | ⬜ pending |
| DASHC-10 | reset → Active/none/Default/cleared, viewMode preserved | unit | `npx vitest run src/logic/dashboard-query-logic.test.ts` | ✅ | ⬜ pending |
| DASHC-08 | overflow set (5 rows, disabled Select) | unit (pure array) | pure overflow-actions builder + test | ❌ W0 | ⬜ pending |
| DASHC-09 | Unbound name-search filter | unit (pure) | `npx vitest run src/screens/unbound-list-logic.test.ts` | ✅ | ⬜ pending |
| D-12 | population-aware search read (A3 scope semantics) | unit | new composed search read test (Wave 0) | ❌ W0 | ⬜ pending |
| DASHC-04/05 | panel open/switch/live-apply/inert | on-device UAT | Pixel: `uiautomator dump` + TalkBack | manual | ⬜ pending |
| DASHC-05 | background a11y-hidden + Back dismiss | on-device UAT (TalkBack) | Pixel | manual | ⬜ pending |
| DASHC-02 | icon-only header fallback at large font scale | on-device UAT | Pixel at 200% scale | manual | ⬜ pending |
| DASHC-07 | search collapse honours reduced motion | on-device UAT | Pixel | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/control-surface/control-summary.test.ts` — DASHC-03 `+N` logic
- [ ] `src/components/control-surface/anchor-position.test.ts` — DASHC-04 clamped positioning
- [ ] Pure overflow-actions builder + test — DASHC-08 (extract from `HomeScreen`)
- [ ] Extend `unbound-list-logic.test.ts` — DASHC-09 Unbound name filter
- [ ] New composed population-aware search read + test — D-12 (A3 search-scope semantics)
- [ ] Extend `dashboard-query-store.test.ts` — panel setter/hydrate coverage if new branches added

*Existing infra covers the store/logic; the new pure helpers + composed search read are the genuinely new test targets.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Panel open/switch/live-apply/inert background | DASHC-04/05 | vitest is render-free (node env) — no component/animation/a11y | Pixel: open each control, switch directly, confirm live-apply + inert background via `uiautomator dump` |
| Background removed from a11y focus + Back dismiss | DASHC-05 | TalkBack focus behavior not observable in node | Pixel with TalkBack: confirm only panel+scrim focusable, Back dismisses |
| Icon-only header fallback | DASHC-02 | Layout under OS font scaling | Pixel at 200% font scale: both destinations icon-only, control row position invariant |
| Search collapse reduced-motion | DASHC-07 | Animation/motion pref | Pixel with reduce-motion on: collapse is instant |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < ~30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
