# Phase 21 — Execution Handoff

**Status:** PLANNED, converged (cross-AI plan review: 0 HIGH / 0 actionable after 5 cycles). Ready to execute.
**Entry point:** `/gsd-execute-phase 21`

## Plans & waves (tracer-first)

| Wave | Plan | What it delivers | Autonomous? |
|---|---|---|---|
| 1 | 21-01 | TRACER: migration 014 (`interaction_assists` + `interaction_assist_enabled`) + assist DAO (composes non-mutexed recency cores, status-guarded, in-txn full-row re-read, LOG-06 guard) + eligible-queue read (joins `contacts` for the banner name) + pure eligibility | yes |
| 2 | 21-02 | Reach Out router + native Call/Text/Email handoff (`performReachOut`, `canonical_value`) + app-global banner + confirmation + profile entry | yes |
| 3 | 21-03 | Endpoint selector + Compose Send→assist seam (shared `performReachOut`) | yes |
| 3 | 21-04 | Settings toggle (off-clears-queue + store refresh) + launch-sweep prune | yes |
| 3 | 21-05 | Merge reparent + purge cascade + widget Message→Contact + `orbit://reach` allow-list (typed guard) | yes |
| 4 | 21-06 | Read-consolidation + full node gate → **[checkpoint]** → Pixel device UAT + sign-off | **no** |

Waves 1–3 (Plans 01–05) run fully autonomously. Wave 3's three plans are file-disjoint (safe to parallelize).

## The one human gate — Plan 06

Plan 06 runs in three tasks:

1. **Task 1 (auto):** retire the two transitional raw `interaction_assist_enabled` reads onto `getAppSettings().interactionAssistEnabled`; run the full node gate (`npm test`, `npx tsc --noEmit`, `npm run check:colors`); scaffold `21-UAT.md`. **No device interaction.**
2. **Task 2 (`checkpoint:human-action`, `gate="blocking-human"`):** **HARD STOP before the APK build.** Never auto-approved, even in auto/chain mode. The owner checks remaining usage and decides whether the same agent continues into Task 3 or a fresh agent is switched in. Resume with `continue` / re-invoke `/gsd-execute-phase 21`.
3. **Task 3 (auto + human-check):** build the DEBUG APK (`ssh droid`), install on the Pixel, drive + DB-verify (run-as, WAL-aware) the full matrix, using the time-travel technique for the 15s/24h rows.

### Conditional sign-off pre-approval (owner, 2026-08-31)
- **Migration 014 + UAT sign-off are pre-approved ON CONDITION** that the node gates and **every** matrix row pass with DB-verified evidence and **zero deviations** → the executing agent records approval on the owner's behalf **plus a plain-language DB-state recommendation** in `21-UAT.md` (the owner cannot inspect on-device DB state directly).
- **Any** row failure/deviation, an unproducible handoff-failure row, or **unauthorized USB** → the agent does **not** self-approve; it STOPS and surfaces the specific rows to the owner.

### Device caveats (from CLAUDE.md / project memory)
- DEBUG build required for `run-as` DB reads; `install -r` preserves data. Build on the desktop (`ssh droid`), run orbit Metro + `adb reverse`.
- Resolve the adb serial from `adb devices` (never hardcode). If the Pixel shows `unauthorized`, only the owner can accept the on-device prompt.
- Use the correct adb input method per control (project memory: adb tap false-negatives on small RN Pressables) — verify against code before recording a failure.

## Provenance
Plans were converged via `/gsd-plan-review-convergence 21 --codex --cursor --claude` (5 cycles; unresolved 12→6→5→2→1→0). Review history: `21-REVIEWS.md`. Final finding (banner `{name}` data source) fixed inline in Plans 01/02.
