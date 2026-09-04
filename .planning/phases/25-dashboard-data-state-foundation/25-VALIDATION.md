---
phase: 25
slug: dashboard-data-state-foundation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-04
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node-side); co-located `*.test.ts` beside every DAO/logic module |
| **Config file** | present (project uses vitest; every `src/db/*.ts` has a `.test.ts` sibling) |
| **Quick run command** | `npx vitest run <touched module>.test.ts` |
| **Full suite command** | `npx vitest run` (+ `npm run check` for biome/tsc, `npm run check:colors`) |
| **Estimated runtime** | quick ~a few s; full suite tens of s |

---

## Sampling Rate

- **After every task commit:** Run the quick run for the touched module + `npm run check` (biome + tsc)
- **After every plan wave:** Run `npx vitest run` (full suite) + `npm run check:colors`
- **Before `/gsd-verify-work`:** Full suite green + on-device UAT on the Pixel (search relevance + Dashboard→Profile→Back restore + retirement smoke)
- **Max feedback latency:** quick run under ~10s

*Note: search perf and the Gravity filter mechanism are assessable only on the physical Pixel, never the absent emulator.*

---

## Per-Task Verification Map

> Seeded from RESEARCH.md → Phase-Requirements test map. Task IDs are filled by validate-phase once PLAN.md task decomposition is final; the requirement → command mapping below is authoritative for coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DASHQ-01/02/03 | — | OR-union populations, dedupe, All Contacts = Active ∪ NotContacted, archived/unbound excluded | unit | `npx vitest run src/db/dashboard-read.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | DASHQ-04/05 | — | Favorites binary membership; Snoozed in Active but out of Needs-Attention | unit | `npx vitest run src/db/dashboard-read.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | DASHQ-06/07 | — | OR-within/AND-across filters; Default population-aware; explicit sort survives | unit | `npx vitest run src/logic/dashboard-query-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DASHQ-08/09/10 | — | Scoped search, relevance-primary, ≤3 snippets + "+N more", identity priority, name doesn't suppress secondary | unit | `npx vitest run src/services/knowledge-search.test.ts src/logic/dashboard-search-match.test.ts` | ⚠️ scorer ✅ / descriptor ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DASHQ-11 | — | Durable prefs round-trip through `app_settings`; search/scroll NOT persisted | unit | `npx vitest run src/db/app-settings-dao.test.ts src/db/migrations/019-*.test.ts` | ❌ W0 (new migration) | ⬜ pending |
| TBD | TBD | TBD | DASHQ-12 | — | Ephemeral session restore on Dashboard→Profile→Back | unit (store) + on-device UAT | `npx vitest run src/stores/dashboard-session-store.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DASHQ-13 | — | Reset restores 4 axes, preserves List/Card preference | unit | `npx vitest run src/logic/dashboard-query-logic.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DASHQ-14 | — | Birthday banner gone; Birthdays population remains | unit + on-device UAT | migration/consumer tests | partial | ⬜ pending |
| TBD | TBD | TBD | — (chain integrity) | — | Migration chain integrity to v19 | unit | `npx vitest run src/db/migrations/full-chain.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/logic/dashboard-query-logic.test.ts` — populations/filters/sort predicate model + Reset (DASHQ-06/07/13)
- [ ] `src/logic/dashboard-search-match.test.ts` — descriptor priority, ≤3 + "+N more", relevance-vs-sort tie-break (DASHQ-10)
- [ ] `src/db/migrations/019-*.test.ts` — ALTER + defaults + v18→v19 jump (DASHQ-11)
- [ ] `src/stores/dashboard-session-store.test.ts` — ephemeral restore/clear semantics (DASHQ-12)
- [ ] Extend `src/db/dashboard-read.test.ts`, `src/db/app-settings-dao.test.ts`, `src/db/migrations/full-chain.test.ts`

*Exact new-file paths are the planner's to finalize; adjust to match PLAN.md task decomposition.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Search relevance quality on real corpus | DASHQ-08/09/10 | Perceived relevance/snippet ordering needs a human read on the physical Pixel | Drive Dashboard search on the Pixel; confirm identity matches rank first, ≤3 snippets + "+N more", no archived/unbound leakage |
| Dashboard→Profile→Back full-state restore | DASHQ-12 | Navigation + scroll restoration is UI-observable timing behavior | On the Pixel: set population/filters/sort/search/scroll, open a Profile, press Back; confirm all restore |
| Gravity filter behavior + perf | DASHQ-06 | Gravity is TS-derived over the interaction log; perf only real on hardware | On the Pixel: apply a Gravity/Closeness filter over a populated fixture set; confirm correct membership and no jank |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
