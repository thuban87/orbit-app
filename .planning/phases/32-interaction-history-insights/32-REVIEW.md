---
status: issues-found
phase: 32-interaction-history-insights
depth: deep
reviewers: 2 (data-layer subsystem audit; services+UI+nav+theme subsystem audit)
method: subsystem-level, full-file reads + every-writer trace of shared tables (per CLAUDE.md "review the code, not the diff")
reviewed: 2026-09-11
---

# Phase 32 — Code Review (deep)

Two read-only reviewers audited all 48 changed source files at subsystem depth: one on the correctness-critical data/migration/backup layer (tracing every writer of `interactions`/`events`/`app_settings`, including files outside the diff), one on services + UI + navigation + theme (opening each consumed DAO/service to check contract use). Full suite: **3074 tests pass**; no BLOCKER/Critical defect survived verification.

## Findings

### Warnings

1. **[WARNING] IntensityChart caption misreports intended cadence** — `src/components/history/IntensityChart.tsx:76` (with `src/services/history/intensity-window.ts:69`, `src/components/IntensityLine.tsx:37,88`). `intensityWindow` sets `IntensityResult.periodDays` to the *window day-span* (7 / 30–31 / 365 / cycles-span) and hardcodes `intendedPerPeriod = 1`; `IntensityChart` feeds that straight into `IntensityLine`, whose `intendedLabel(periodDays)` interprets `periodDays` as the contact's frequency interval. Result: a weekly-cadence contact viewed in the Month lens renders "Monthly intended"; in the 7-Days lens any contact renders "every 7 days intended"; the caption reads as a statement about the contact's cadence but describes the window. **Disposition: OWNER DECISION (product/visual copy)** — the mechanical bug is real, but the correct window-scoped caption is a taste/product call. Surfaced to owner; not auto-fixed.

2. **[WARNING] Rolodex Year wheel has no lower-year clamp** — `src/components/history/rolodex-logic.ts:126-128`, `src/components/history/RolodexBrowser.tsx:126-132,177`. `clampToToday` bounds the upper year but nothing bounds the lower; `rollDate` can drive `selected.year < minYear (= today.year - 30)` while `yearItems` only spans `[minYear, today.year]`, so `selectedIndex` goes negative and the strip positions onto a nonexistent row — the centred slot no longer matches the drawer's year. **Disposition: FIXED (my bucket — implementation bug).**

3. **[WARNING] `isEmptyHistory` ignores knowledge-change history** — `src/components/history/history-section-logic.ts:47-52` (consumed at `HistorySection.tsx:295`). Predicate checks only `interactions.length` and `hasLifecycleRecords`; a contact with knowledge-field history but zero interactions and zero lifecycle events resolves "empty," so `HistorySection` renders "No history yet" and never mounts the surfaces — making the knowledge-change rows (the DateDetailSheet's third record family) unreachable. Contradicts dossier item #13 + "preserve the three record families (interactions, lifecycle, history-aware knowledge changes)". **Disposition: FIXED (my bucket — enforces the recorded dossier decision).**

4. **[WARNING] Stale channel-vocabulary in the recency write-chokepoint doc comments** — `src/db/recency-dao.ts:67,96`. `RecordTouchpointInput.channel` and `EditTouchpointFullInput.channel` are documented with the *retired* pre-D-06 vocabulary (`call|text|in-person|email|…`) while the sibling `quality` comments were updated to the Tone vocabulary. Latent (all current callers pass the new vocabulary or `unspecified`; `channel` has no CHECK), but it is a partial rename left at the exact spot D-06 flags as most dangerous. **Disposition: FIXED (my bucket — doc correctness).** Reviewer also suggested a shared `assertInteractionChannel`/`assertInteractionTone` write-time guard to make the invariant enforced rather than documentary — recorded as a follow-up enhancement (not applied this phase).

### Info (recorded, non-blocking — not fixed)

5. **[INFO] `today` computed once at mount** — `src/components/history/HistorySection.tsx:146` (`useMemo(…, [])`). Stale across local midnight if the section stays mounted (today-as-max clamp / cycle end / future-cell blocking key off yesterday). Low impact — profile re-entry remounts. Candidate for a focus-time refresh if the section can persist.
6. **[INFO] "1 interactions" not pluralized** — `src/components/history/HeatmapContextCard.tsx:68`. Matches UI-SPEC verbatim copy but inconsistent with `formatDrawerSummary`, which pluralizes. Left as spec-verbatim.
7. **[INFO] Dormant group card "View Group Event" wired to `onEdit`** — `src/components/history/InteractionDetail.tsx:178`. Never renders in Phase 32 (group seam inert per D-12); wrong target for Phase 33 to correct rather than adopt.
8. **[INFO] restore `ON CONFLICT` leaves local `duration` on a merge-winning row** — `src/backup/restore-apply.ts:201`. Benign (duration is descriptive, not consent-sensitive; `allow_ai` is correctly forced to 0). Flagged so the asymmetry with `allow_ai` is a conscious record.
9. **[INFO] `LastInteractionType` retains retired channel vocabulary** — `src/types.ts:47-52,89`. Verified dead (no path populates `Contact.lastInteraction` from `interactions.channel`); already `@deprecated`. No runtime impact.

## Verified clean (data layer)

Migration 025 additive/forward-only/order-independent, survives v1→v25, `quality`/`channel` column names preserved, `allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(0,1)`, no rebuild/DROP/`note` rewrite/`group_event_id`; frozen CASE arms test-pinned equal to the shared helper and not imported at runtime; single vocabulary source of truth; D-06 restore backdoor closed on both INSERT and ON CONFLICT paths with `allow_ai=0`; recency spine single-chokepoint contract preserved; bind/unbind insert-only inside existing transaction; portable-settings declare-only (Phase 36 owns emission + format bump); no network on read paths; no `toISOString().split`.
