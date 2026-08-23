---
phase: 15
status: approved
reviewed_at: 2026-08-23
reviewer: claude (fresh read-only subagent — code review of the implementation, not the plans)
verdict: APPROVE
counts: { high: 0, medium: 0, low: 2 }
---

# Phase 15 (Weekly Digest) — Code Review (implementation)

Scope: the 23 changed source files (`src/**`, `__mocks__/**`) in commits `799a1b6..aa42dd6` (+2463/−53),
reviewed against the actual code on disk per CLAUDE.md "review the code, not the diff".

## Verdict: APPROVE — 0 HIGH, 0 MEDIUM, 2 LOW

Verified correct against the code on disk:
- **Migration 005** — byte-faithful to the additive `004-ai-settings` pattern: single `ALTER TABLE app_settings
  ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1`, constant default (start-state-independent), edits no shipped
  migration, `TARGET_VERSION`→5, runner + every current-schema test harness bumped; v0→v5 and v4→v5 both tested.
- **The three digest reads** — retrospective window math uses `date('now','localtime','-6 days')` + bare
  `date(stored)` (no UTC off-by-one, no `toISOString`), true 7-day inclusive, all touchpoints (no connected/direction
  predicate), archived excluded. Overlooked queries `STATUS_SQL='rogue'` directly, OMITS the mute filter (muted-rogue
  test proves it appears), guards `last_contact IS NOT NULL`, excludes archived, splits Drifting/Gone-quiet by REASON.
  No injection surface (static SQL + code-constants + integer-guarded window modifier + `?`-binds).
- **Schedule coordinator** — defer-one guard re-reads state at the top of each pass so a stale trailing pass cancels
  rather than re-arms (deterministic barrier test); genuinely separate from `reconcileSchedule`; `digest:weekly` outside
  the `decay:`/`birthday:` prefixes; non-clobber regression proves the decay/birthday sweep never cancels it.
- **H1** — master toggle + delivery-hour + digest toggle all route through the shared `persist` → `reconcileDigestSchedule`.
  **H3** — `notification-nav.ts` pre-checks `kind:"digest"` before the numeric-contactId narrowing and returns the
  `[Home, Digest]` reset (forged contactId ignored).
- **Local-first / security** — no `fetch` on any read path; `digest-v1` channel LOW/PRIVATE; frozen copy names no one.
- **Error handling** — cancelled-flag guard, null-vs-loaded sentinel (no "all quiet" flash), calm error sentinel;
  divide-by-zero guarded.

## Findings (both LOW, non-blocking)

- **LOW-1 — `EFFORTFUL_WINDOW_DAYS` comment off-by-one** (`src/logic/digest-logic.ts`). `14` yields a 15-day inclusive
  window but the comment said "14 days." Runtime effect: none (conservative wider window, tunable).
  **FIXED** — comment corrected to mirror the retrospective's precise style ("`14` yields a 15-day INCLUSIVE window
  (today + the 14 prior days)"); the value 14 (tested behavior + "deliberately wider" intent) unchanged. Commit below.

- **LOW-2 — `dayTag` runs in render, outside the load try/catch** (`DigestScreen.tsx` → `digest-logic.ts`). A malformed
  `last_reached` would throw during render → white-screen instead of the calm error sentinel. **UNREACHABLE in practice**
  (`last_reached = MAX(occurred_at)`, `occurred_at` NOT NULL + always `formatLocalDate`-written, JOIN guarantees ≥1 row).
  Left as-is (defensive-only; touching device-UAT render code for an unreachable case is not worth the risk). Recorded
  here so a future contributor can add a defensive guard if desired.

Remaining risk is confined to the device-UAT surface (screen render + real WEEKLY-trigger firing), covered by 15-06.
