# Phase 6 — Code Review (Interaction Log, Status & Impact)

**Date:** 2026-08-15
**Reviewers:** codex (codex-cli 0.144.1, external CLI) + claude (read-only, in-session)
**Scope:** Full files on disk for every Phase-6-touched module plus the shared data-layer subsystem (single-`last_contact`-writer chain, events immutability, status/reason SQL, impact derivation, theme tokens) — not diff-scoped.

## Verdict

**No BLOCKER or HIGH findings from either reviewer.** 3 findings total: 2 MEDIUM, 1 LOW. None reverses a recorded ADR/HANDOFF decision; none is a planner-vs-owner escalation. All are defense-in-depth hardening on already-guarded paths.

Gate checks: `npx tsc --noEmit` → clean (exit 0). 175 Phase-6 tests pass (`vitest run` over the 13 phase-6 suites, in-session — codex's own vitest run failed only because a read-only sandbox can't create vitest's `/tmp/.../ssr` dir; not a code defect). `npm run check:colors` → pass.

## Invariants verified (both reviewers, against real file:line)

- **Single `last_contact` writer (DATA-04):** the ONLY `SET last_contact` in the codebase is `recency-dao.ts:163-172` (`recomputeLastContact`). Every touchpoint route — `recordTouchpoint`, `editTouchpointFull`, `deleteTouchpoint`, `createContactFull`, and `updateContactFull` — recomputes through it (or its `recomputeLastContactCore` alias inside one transaction); the archive/restore retrofit and photo writers leave `last_contact` untouched (SET lists carry only `archived_at`/`photo` + `modified_at`). `editTouchpoint` (the unguarded Phase-2 edit) is removed.
- **Events immutability (LOG-02):** no executable `UPDATE events` anywhere (only the prohibition comment in events-dao.ts:11). `recordEventCore` composes inside archive/restore's ONE existing `inWriteTransaction` (contacts-dao.ts:437, :473) — no nested non-reentrant mutex, no second transaction.
- **C2-#1 archived-state guard:** archive `... WHERE id=? AND archived_at IS NULL` (contacts-dao.ts:427); restore `... WHERE id=? AND archived_at IS NOT NULL` (:463). A wrong-state/no-op transition matches 0 rows → `changes!==1` throws → rollback → NO spurious event. Corroborated by contacts-dao.test.ts (no-op re-archive / no-op restore write zero events).
- **Future `occurred_at` rejected pre-transaction:** `recordTouchpoint` (recency-dao.ts:225-229) and `editTouchpointFull` (:264-268) call `rejectFutureOccurredAt` before opening any transaction; `createContactFull`/`updateContactFull` re-check inline (contacts-dao.ts:121, :295). Same-day touchpoints insert distinct rows; recency is `MAX(occurred_at)`. All timestamps are local wall-clock — no `toISOString()` on any write path (grep confirms only doc-comment mentions).
- **REASON_SQL matches STATUS_SQL branch order (status.ts:67-99):** both put the `rarely_responds=1 AND progress>=WOBBLE_MAX` branch first, then `progress>=ROGUE_K`. Status and reason can never disagree (status='rogue' ⟺ reason non-null). `getContactStatus` guards `last_contact IS NULL` → forces status/reason/progress null so a never-contacted contact is never mislabelled 'stable' (contact-status-read.ts:72-80).
- **Gravity/intensity derived-never-stored:** no INSERT/UPDATE/ALTER in impact.ts, impact-read.ts, gravity-logic.ts, intensity-logic.ts. Profile-only (GravityBar/IntensityLine are presentational, no DAO import). Intensity sorts ascending before differencing gaps (intensity-logic.ts:140-142). Tunables at top-of-file (impact.ts:39-60, :110).
- **Theme / DAO / migration hygiene:** no hardcoded colour literals in any Phase-6 component/screen (all through `useTheme().colors.*`); the only literals are in theme-presets.ts (`rogue`, 4-entry `gravityTiers` matching the 4 `GRAVITY_TIERS`). No inline SQL in components/screens; all queries in `src/db`. No new migration added. All SQL binds runtime values with `?`.

---

## Findings (most severe first)

### MEDIUM — [claude + codex] `src/db/log-guards.ts:25` — future guard is lexical-only; malformed/empty `occurredAt` slips through

`rejectFutureOccurredAt` does a bare string `occurredAt > now`. It correctly rejects a real future datetime, but performs **no format/validity check**: an empty string `""` (sorts before any date → not "future"), a non-zero-padded value (`"2026-8-1 ..."`), or otherwise malformed input passes the guard and can be persisted by `recordTouchpoint`/`editTouchpointFull`, leaving `last_contact` unparsable and day-granular status math wrong. This is the module's stated defense-in-depth chokepoint, so validity belongs here.

Exploitability today is low (production callers mint `occurredAt` via `localDateTime()` or the refine form's validated `combineDateAndTime`, and `parseLocalDateTime` throws on malformed refine input), but the guard advertises itself as the single enforcement point and the create/edit first-interaction guards duplicate the lexical `>` comparison rather than reusing a validator.

**Fix:** validate both arguments against a strict `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$` (with calendar sanity) before comparing; throw on a non-conforming value. Reuse the same validator in `createContactFull`/`updateContactFull`'s inline first-interaction future checks so all three paths share one rule.

### MEDIUM — [codex] `src/db/impact-read.ts:42-66` — `getImpactInputs` reads contact policy and interactions in two un-transactioned statements

`getImpactInputs` issues a `SELECT interval_days, rarely_responds` then a separate `SELECT ... FROM interactions` with no enclosing read transaction/snapshot. A concurrent write (e.g. `updateContactFull` flipping `rarely_responds`, or a touchpoint insert) committing between the two statements yields an inconsistent input set → gravity/intensity computed against a mixed state until the next refresh.

**claude assessment — lower impact than the label suggests:** this is a read-only display path. Any inconsistency is transient and self-corrects on the next `load()` (focus, log, edit, delete all re-read); nothing is persisted and no invariant is corrupted. Reads are also serialized on the single expo-sqlite connection. Worth fixing for cleanliness, not urgent.

**Fix:** fetch both shapes in one statement — a `LEFT JOIN` of `contacts` to `interactions` (or a single wrapping read) — and build `ImpactInputs` from that one snapshot.

### LOW — [codex] `src/services/intensity-logic.ts:129-131` — period filter has a lower bound but no `<= now` upper bound

`currentCount` counts qualifying rows with `parseLocalMs(i.occurredAt) >= periodStartMs` but does not exclude rows *after* `now`. Write guards forbid a future `occurred_at`, but a device-clock rollback or a legacy/corrupt row could produce a future-dated interaction that then inflates "this period" and the trailing cadence. `gravity-logic.ts:114` already defends the symmetric case with `Math.max(0, ...)` age-clamping; intensity should match that posture.

**Fix:** parse `occurredAt` once and exclude rows with `occurredAt > nowMs` before both the current-period count and the trailing-gap calculation.

---

## Notes

- codex could not execute its vitest run (read-only sandbox `ENOENT .../ssr`); claude ran the 13 phase-6 suites in-session — **175 tests pass**. codex's `tsc --noEmit` and `check:colors` both passed, matching claude's in-session runs.
- None of the three findings touches an ADR/HANDOFF `[DECIDED]`/`[REJECTED]` item; all are additive hardening the owner/planner may schedule or defer at will.
