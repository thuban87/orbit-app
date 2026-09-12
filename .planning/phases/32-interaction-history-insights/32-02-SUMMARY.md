---
phase: 32-interaction-history-insights
plan: 02
subsystem: backup-restore
tags: [sqlite, events, lifecycle, backup, restore, interaction-vocabulary, ai-consent, react-native]

requires:
  - phase: 32-interaction-history-insights
    provides: "Plan 01 migration 025 (interactions.allow_ai DEFAULT 0, duration) + src/db/interaction-vocabulary.ts shared remapLegacyQuality/remapLegacyChannel"
provides:
  - "EventType union extended with 'bind' and 'unbind' (CHECK-less TEXT, no migration) — the two lifecycle moments the Detail Sheet (Plan 07) renders read-only"
  - "bindContact/unbindContact emit exactly one immutable insert-only lifecycle event inside their existing write transaction (recordEventCore before bumpDataRevisionCore)"
  - "restore-apply interactions writer remaps legacy quality/channel on ingest via Plan 01's shared map (D-06 backdoor closed)"
  - "restore-apply interactions ON CONFLICT(uid) DO UPDATE arm forces allow_ai=0 — merge-path fail-closed consent (D-04)"
affects: [phase-32-plan-07-detail-sheet, phase-36-backup-format-bump]

actuals:
  tokens: 5800
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Insert-only lifecycle-event producer composed inside an already-open transaction via the non-mutexed *Core primitive (mirrors snooze/archive producers)"
    - "Restore-side writer consumes the single shared vocabulary map — restore and migration can never diverge (single source of truth)"
    - "Fail-closed consent on BOTH restore write paths: fresh INSERT via column DEFAULT 0, merge/update via an explicit allow_ai=0 in the SET arm"

key-files:
  created: []
  modified:
    - src/db/events-dao.ts
    - src/db/contact-lifecycle-dao.ts
    - src/db/contact-lifecycle-dao.test.ts
    - src/backup/restore-apply.ts
    - src/backup/restore-apply.test.ts
    - src/backup/export-manifest.test.ts

key-decisions:
  - "events.type is CHECK-less TEXT so bind/unbind is a TS union change only — no migration (D-08)"
  - "bind/unbind occurredAt = the lifecycle moment `now` (not invented from another field); events are immutable/insert-only (ADR-025)"
  - "remap applied at the bound VALUES so excluded.quality/excluded.channel carry the migrated value on BOTH the INSERT and the ON CONFLICT UPDATE paths"
  - "allow_ai=0 added to the merge/update SET arm; INSERT column list / wire payload unchanged and BACKUP_FORMAT_VERSION NOT bumped (Phase 36 owns serialization + the format bump)"
  - "duration deliberately left OUT of the SET arm — the reviewers' duration=NULL rider is a deferred non-blocking merge-policy taste call, not a consent/correctness gap"

patterns-established:
  - "A restore-side table writer that the schema migration does not cover must consume the same shared remap the migration used, or the restore backdoor re-opens the corruption the migration closed"

requirements-advanced: [HIST-10]

duration: 6min
completed: 2026-09-11
status: complete
---

# Phase 32 Plan 02: Bind/Unbind lifecycle events + restore backdoor closure Summary

**Bind and Unbind now leave immutable, insert-only lifecycle events written inside their existing write transaction, and the restore-apply writer of `interactions` — a separate writer migration 025 never touched — now remaps legacy Tone/channel vocabulary on ingest and forces `allow_ai=0` on its merge/update arm, so no restored backup can re-open the AI-context/digest miscount or silently keep an interaction AI-permissive.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 3 (all autonomous; TDD RED→GREEN on Tasks 1 and 3)
- **Files modified:** 6 across 5 task commits + 1 docs commit

## Accomplishments

- **Task 1 — bind/unbind lifecycle events (D-08, ADR-025).** Extended `EventType` to `archive|restore|snooze|unsnooze|bind|unbind` (CHECK-less TEXT — no migration). `bindContact`/`unbindContact` now compose `recordEventCore` inside their ALREADY-OPEN `inWriteTransaction` (never a nested transaction — the write mutex is non-reentrant), before `bumpDataRevisionCore`, with `occurredAt` = the bind/unbind moment `now`. Tests prove exactly one event of the right type at `occurred_at === now`, and that a later unbind never mutates the earlier bind event (insert-only immutability).
- **Task 2 — restore round-trip proof (T-32-07).** A grep of `src/` confirmed **no reader switches exhaustively on `EventType`** — the type is referenced only in `events-dao.ts` (union + interface field), and `backup-schema.ts` validates only `contactUid` on events, not `type`. restore-apply inserts `type` verbatim. Added a round-trip test that backs up a contact carrying `bind` + `unbind` (+ `archive`) events and asserts they restore with type strings intact and no throw.
- **Task 3 — D-06 + D-04 restore backdoors closed.** Wrapped the interactions INSERT's `quality`/`channel` bindings with Plan 01's shared `remapLegacyQuality`/`remapLegacyChannel` (no duplicate map), so a pre-Phase-32 (format-4) backup carrying `good`/`hard`/`text`/`email` lands as `Positive`/`Negative`/`Message` on a v25 device; already-migrated rows pass through unchanged. Separately added `allow_ai=0` to the `ON CONFLICT(uid) DO UPDATE SET` arm so a field-less backup row winning reconciliation drives an existing `allow_ai=1` interaction to OFF (SQLite's `DEFAULT 0` fires only on fresh INSERT). Added an export guard proving a post-migration DB serializes `Positive`/`Message` with no export-manifest source change and no format bump.

## Task Commits

1. **Task 1 RED** — `043ecd3` (test) — failing bind/unbind lifecycle-event assertions
2. **Task 1 GREEN** — `f0c73e1` (feat) — EventType union + in-transaction bind/unbind producers
3. **Task 2** — `d91902f` (test) — bind/unbind restore round-trip guard (no exhaustive-switch reader exists)
4. **Task 3 RED** — `5cff367` (test) — failing restore-vocab-remap + merge-consent regressions
5. **Task 3 GREEN** — `9fd9498` (feat) — restore-apply remap-on-ingest + merge-path `allow_ai=0`

## Verification

- `src/db/contact-lifecycle-dao.test.ts` — 8 pass (one `bind`, one `unbind`, immutable, in-transaction).
- `src/backup/restore-apply.test.ts` — 31 pass (bind/unbind round-trip; legacy `good`/`hard`/`text`/`email` remap; already-migrated passthrough; merge-mode `allow_ai=1`→0 regression).
- `src/backup/export-manifest.test.ts` — pass (post-migration export emits `Positive`/`Message`; `BACKUP_FORMAT_VERSION` still 4).
- Broader safety run: `src/backup` + `events-dao` + `contacts-dao` + `snooze-dao` + `contact-lifecycle-dao` = 169 pass. `tsc --noEmit` clean.
- Source asserts: `remapLegacyQuality`/`remapLegacyChannel` imported from `@/db/interaction-vocabulary` (no duplicate map); `allow_ai=0` present in the interactions ON CONFLICT UPDATE arm; INSERT column tuple and `BACKUP_FORMAT_VERSION` unchanged in the diff.

## Requirement note (HIST-10)

HIST-10 (the shared period/date **Detail Sheet** interleaving Interactions + read-only lifecycle events incl. Bind/Unbind) is **advanced, not completed, by this plan.** This plan delivers the two missing lifecycle-event types the sheet will render read-only; the Detail Sheet itself is Plan 07. HIST-10 is left unchecked in REQUIREMENTS.md to avoid a false completion — it closes when Plan 07 renders the sheet.

## Deviations from Plan

**None — plan executed exactly as written.**

One read_first note in Task 3 was already satisfied by Plan 01: the `db()` helper in `restore-apply.test.ts` already runs `migration025` at target version 25 (added by 32-01), so the `allow_ai` column existed for the merge-mode regression with no further test-harness change needed.

## Phase-36 hand-off (recorded per plan)

Phase 36 owns the wire serialization of `duration`/`allow_ai` and the coordinated `BACKUP_FORMAT_VERSION` bump (v4→v5). When it serializes `allow_ai`, it MUST preserve the two-path "restore never falsely appears more-permissive" guarantee proven here: fail-closed on BOTH the fresh INSERT (column DEFAULT 0) and the merge/update arm (`allow_ai=0` in the SET list). The reviewers' optional `duration = NULL` rider on the same merge arm was deliberately NOT applied this phase (descriptive-only field, non-blocking merge-policy taste call — D-12/A); it stays for Phase 36 or a future explicit owner decision.

## Known Stubs

None. No hardcoded/placeholder values introduced; the bind/unbind events are real writes with real tests, and the restore remap consumes the live shared map.

## Pre-existing / Out-of-scope (not fixed — logged)

- `src/backup/restore-apply.ts` and `src/db/events-dao.ts` carry pre-existing Biome findings (`lint/style/noNonNullAssertion` throughout restore-apply; `assist/source/organizeImports` on the pre-existing import blocks). Verified present before this plan (unchanged lines) and NOT introduced by these edits; `src/db/contact-lifecycle-dao.ts` is Biome-clean. Left as-is per the scope boundary — the project's commit gate does not block on these.
- `src/components/orrery/orrery-controls-render.test.tsx` still fails to LOAD (pre-existing `vi.mock` generic tooling issue from before this phase; touches none of this plan's files).

## User Setup Required

None — data-layer/backup code only; no external configuration. Physical Pixel not required for this plan (verified per success criteria: data-layer/backup, no device UI).

## Self-Check: PASSED

- Modified files verified on disk (all 6 present with the described changes).
- Commits verified in `git log`: `043ecd3`, `f0c73e1`, `d91902f`, `5cff367`, `9fd9498`.

---
*Phase: 32-interaction-history-insights*
*Completed: 2026-09-11*
