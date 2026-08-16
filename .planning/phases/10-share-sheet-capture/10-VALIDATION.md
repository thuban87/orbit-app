---
phase: 10
slug: share-sheet-capture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-16
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 10-RESEARCH.md "## Validation Architecture"; the planner fills the
> Per-Task Verification Map, Wave 0, and Manual-Only tables against the produced PLAN.md tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node environment; `node:sqlite` harness for DAO/logic tests) |
| **Config file** | existing repo vitest config (`.test.ts` suites under `src/`) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run check:colors` |
| **Estimated runtime** | ~seconds (node suites); tsc/check:colors add a few more |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npx tsc --noEmit && npm run check:colors`
- **Before `/gsd-verify-work`:** Full suite + tsc + check:colors green
- **Max feedback latency:** node suites run in seconds

---

## Per-Task Verification Map

> Planner populates one row per task. Pure logic (capture-logic parsing, multi-attach row
> assembly, MRU ordering, payload→row mapping) MUST have node `<automated>` verify; the
> share-intent native wiring, the `finish()` bridge, cold-start-to-picker, and the on-device
> grid render are Pixel/API-36 manual UAT (see Manual-Only).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner fills_ | | | CAP-0x | — | | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Per RESEARCH: the phase's first tasks are three node-test files (capture-logic parsing,
> multi-attach transaction assembly, capture-MRU ordering) + the two installs
> (`expo-share-intent@8.0.1`, patch-package for `EXTRA_SUBJECT`). Planner lists exact files.

- [ ] `src/logic/capture-logic.test.ts` — payload→row mapping + `note — title` composition (CAP-02/03)
- [ ] capture write-path test — N-rows-one-`inWriteTransaction` multi-attach, no `last_contact` write (CAP-02)
- [ ] capture-MRU ordering test — favourites → capture-MRU → rest (CAP-01)

*Planner confirms/renames against produced PLAN.md.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Share `text/plain` from Chrome opens the grid-of-faces picker, keyboard closed | CAP-01 | Native intent + on-device render; needs release APK (new native dep) | `expo prebuild --clean` + release APK via desktop pipeline; share a link from Chrome; `uiautomator dump` asserts picker + closed keyboard |
| `EXTRA_SUBJECT` label appears (patched), bare-URL fallback otherwise | CAP-03 | Native patch behaviour | Share a Chrome link (has EXTRA_SUBJECT) vs a raw-URL share; assert display text |
| Toast → return to source app via `finish()` bridge | CAP-04 | Android 15/16 top-of-task finish semantics | After commit, assert Orbit finishes back to the sharing app (not home) |
| Cold-start-to-picker latency acceptable on physical Pixel | CAP-01 | Emulator can't assess; JS-thread bound | Cold-share on Pixel 6 Pro; time to interactive picker |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < a few seconds (node suites)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
