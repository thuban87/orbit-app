---
phase: 10
slug: share-sheet-capture
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-16
reconciled: 2026-08-16
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

Reconciled to the 6 converged plans. Node-tested plans (10-02/10-03) carry the correctness-critical
logic + write-atomicity; the native/screen plans (10-01/04/05/06) pair static `<automated>` checks
(tsc / biome / `check:colors` / `expo config` eval / lockfile) with **manual Pixel UAT** for on-device
behavior. Plan-checker confirmed every task has an `<automated>` verify or is a Wave-0 node-test.

| Plan | Wave | Requirement | Primary verification | Test Type | Automated Command |
|------|------|-------------|----------------------|-----------|-------------------|
| 10-02 (capture-logic resolver) | 1 | CAP-02, CAP-03 | payload→display/url + `note — base` composition (all 4 payload types × note) | unit (pure, node) | `npm test` |
| 10-03 (capture-read + capture-dao) | 1 | CAP-01, CAP-02, CAP-04 | favourites→MRU→rest read; `captureMultiAttach` (N rows, one txn, returns ids) + `captureMultiNote` (editFuelCore×N, one txn, mid-loop rollback); **no-touchpoint** (last_contact NULL) | unit (node:sqlite) | `npm test` |
| 10-01 (native foundation) | 1 | CAP-01, CAP-03, CAP-04 | `text/plain`+scheme plugin exactly-once (`expo config` eval); lockfile committed; patch applied | static + **Pixel UAT** | `npm test` · `tsc` · `expo config --type prebuild --json` |
| 10-04 (nav wiring / ShareIntentGate) | 2 | CAP-01, CAP-04 | single-owner reactive cold-start routing (onReady + hasShareIntent) | static + **Pixel UAT** (killed-app cold-start) | `tsc` · `check:colors` |
| 10-05 (single-tap screen) | 3 | CAP-01, CAP-02, CAP-03 | tap→one row→confirm→return; in-flight guard; writtenRows id threading | static + **Pixel UAT** | `tsc` · `check:colors` |
| 10-06 (multi-select / note / inline-create) | 4 | CAP-02, CAP-04 | long-press multi-select (N rows + N-note atomic via DAO); Back handler; empty-name guard; N>0 guard | static + **Pixel UAT** | `tsc` · `check:colors` |

*Status tracked during execution: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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
