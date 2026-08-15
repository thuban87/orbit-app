---
phase: 4
slug: contact-crud-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Per-task rows are
> populated by the planner as PLAN.md files are written (each task's `<automated>` verify maps here).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (+ tsx) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test` (`vitest run`) — optionally scoped: `npx vitest run src/db` |
| **Full suite command** | `npm test && npm run check:colors` |
| **Estimated runtime** | ~5–15 seconds (in-memory `node:sqlite`, no device) |

DB tests drive the REAL migration runner against a fresh in-memory `node:sqlite` DB via
`@/db/__testkit__/node-sqlite` (`nodeSqliteExecutor`, `openTestDb`). `check:colors` enforces the
theme-token gate (the new `danger` token must be added to the palette, never inlined as a hex).

---

## Sampling Rate

- **After every task commit:** Run `npm test` (or a path-scoped `npx vitest run <dir>`).
- **After every plan wave:** Run `npm test && npm run check:colors`.
- **Before `/gsd-verify-work`:** Full suite green + `check:colors` green.
- **Max feedback latency:** ~15 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _populated by planner_ | — | — | CRUD-01…06 | — | — | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. The planner fills one row per task; DAO-layer
tasks (atomic create, edit split, purge fan-out, rarely_responds recompute) must each carry a
node:sqlite `<automated>` verify — these are the data-corruption-risk surfaces.*

---

## Wave 0 Requirements

- [ ] DAO/service unit tests (atomic create contact+interaction, edit two-writer split, purge
      fan-out delete list, archive/restore filter, `rarely_responds`→`last_contact` recompute) —
      node:sqlite, driven through the real writers.
- [ ] Existing `vitest` + `node:sqlite` testkit already covers infrastructure — no framework install.

*Test files are authored per-plan during execution; this section is the planner's Wave-0 checklist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Form rendering / native pickers / navigation transitions | CRUD-01…05 | UI + native modules (date/category pickers, react-navigation) can't run headless on this box | Desktop build → Pixel install → drive via `adb`/`uiautomator` (per runbook) |
| Purge deletes the photo FILE + scheduled notifications | CRUD-06 | Photo (Phase 5) / notifications (Phase 11) subsystems not built yet | Extension points wired now, verified when those phases land |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest` watch)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
