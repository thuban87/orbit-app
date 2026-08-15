---
phase: 6
reviewers: [codex, claude]
reviewed_at: 2026-08-15
plans_reviewed: [06-01-PLAN.md, 06-02-PLAN.md, 06-03-PLAN.md, 06-04-PLAN.md, 06-05-PLAN.md, 06-06-PLAN.md]
cycle: 2
---

# Cross-AI Plan Review — Phase 6 (Interaction Log, Status & Impact)

Two reviewers, both source-grounded against the code on disk: **codex** (gpt-5.6-terra, codex-cli
0.144.1, ran in-repo) and **claude** (this session, read-only). Findings are ordered most-severe
first, each labelled with reviewer + severity + `file:line` + a concrete fix.

The three documented owner-assumptions are NOT findings: (a) LOG-02 events are intentionally empty
in v1 (read surface built, writer deferred — confirmed: no `INSERT INTO events` anywhere in `src/`
except tests); (b) status/gravity render with existing theme tokens (no new token set); (c)
gravity/intensity tunable values + the ROGUE_K multiple are owner-deferred placeholders.

---

## Findings (most-severe first)

### 1. [codex HIGH] · [claude: MEDIUM] — Legacy `editTouchpoint` has no future-date guard
`06-03-PLAN.md:104` · `src/db/recency-dao.ts:224-257`

Plan 03 explicitly says "leave the existing `editTouchpoint` untouched" and adds the guarded
`editTouchpointFull`. The Phase-2 `editTouchpoint` opens a transaction and updates `occurred_at`
with **no** `rejectFutureOccurredAt` call — so an edit path that writes recency-relevant time can
still accept a future timestamp, which the phase invariant says both record AND edit must reject.

**Claude verification / severity downgrade:** `grep` shows `editTouchpoint` has **no production
caller** — only its own definition and `recency-dao.test.ts` reference it (the Phase-6 refine UI
routes exclusively through the guarded `editTouchpointFull`). The invariant is therefore satisfied
for every in-use edit path; the exposure is a latent, uncalled export. Hence MEDIUM, not HIGH — but
still worth closing cheaply.

**Fix:** either add `rejectFutureOccurredAt(input.occurredAt, input.now)` as the same
pre-transaction reject to `editTouchpoint` (+ a no-write/no-recompute test), or mark it superseded
by `editTouchpointFull` and remove it. Do not leave an unguarded, exported edit path.

### 2. [codex MEDIUM] · [claude: agree] — Timeline testID / React-key collision across tables (and same-timestamp+same-id order)
`06-02-PLAN.md:100-104,129` · `src/db/migrations/001-initial.ts:96-125`

`interactions.id` and `events.id` are independent PK sequences (verified in migration 1), so the
proposed `timeline-row-{id}` root **collides** when a touchpoint and an event share the same numeric
id — a real bug for React keys and test IDs (not merely the cosmetic ordering tie the plan already
acknowledges). `ORDER BY occurred_at DESC, id DESC` across the `UNION ALL` is also not fully
deterministic for an equal-timestamp + equal-id cross-table pair.

**Fix:** key rows by `${kind}-${id}` (React key + testID). Project a static `kind_order`
discriminator and order `occurred_at DESC, id DESC, kind_order DESC` for a deterministic tiebreak.
Seed an equal-timestamp, equal-id cross-table pair in `timeline-read.test.ts`.

### 3. [codex MEDIUM] · [claude: agree] — Same-day test assertion is wrong: `last_contact` is a full timestamp, MAX advances within a day
`06-01-PLAN.md:107-108` · `src/db/recency-dao.ts:151-162`

The plan's behavior/test says "last_contact unchanged after the second [same-day] tap." That is only
true when the two taps share an identical `occurred_at` second. `recomputeLastContact` sets
`last_contact = MAX(occurred_at)` over the **full** `YYYY-MM-DD HH:MM:SS` value, so two same-date
taps at different local times DO advance `last_contact` to the later timestamp. (Day-granular
*status* is unaffected — `date(last_contact)` — but the stored value changes.) As written the test
encodes incorrect expected behavior.

**Fix:** split the assertion — (a) two same-date, **different-time** rows → `last_contact` becomes
the later timestamp; (b) two rows with **identical** `occurred_at` → two distinct rows, `last_contact`
equals that timestamp. Keep the "same-day still two distinct rows" claim (that part is correct).

### 4. [codex MEDIUM] · [claude: agree] — Intensity trailing cadence can compute negative gaps (input is newest-first)
`06-05-PLAN.md:93,99` · `06-06-PLAN.md:91-99`

`getImpactInputs` returns interactions ordered `occurred_at DESC, id DESC` (newest-first). Plan 06's
`computeIntensity` defines `trailingAvgGapDays` as the mean gap between consecutive rows but does not
require re-sorting ascending. An implementation iterating the supplied (descending) order yields
negative gaps / a wrong average.

**Fix:** have `computeIntensity` filter to qualifying rows then **sort ascending** by local
timestamp before computing `later - earlier`; add a descending-input test asserting a known positive
average.

### 5. [codex MEDIUM] · [claude: agree] — No strict local datetime parser to seed the refine picker from a stored string
`06-03-PLAN.md:137` · `src/utils/dates.ts:17-21` · `src/types.ts:163-177`

`combineDateAndTime` takes `Date | string`, but seeding the edit form from an existing row's
`occurred_at` (`YYYY-MM-DD HH:MM:SS`) has no safe local parser: `formatLocalDate()` only *formats*,
and `parseDate()` (verified at `types.ts:163-177`) matches only `YYYY-MM-DD` and constructs the Date
with **no** hour/minute/second — it discards the time. Seeding through `parseDate` silently loses the
time-of-day; falling back to `new Date(str)` risks a wall-clock/UTC shift.

**Fix:** add a pure strict local datetime parser that extracts all six components and builds
`new Date(y, m-1, d, H, M, S)` (or keeps structured parts), used to seed both dialogs. Test a
persisted evening timestamp through seed → date/time correction → recombination, byte-for-byte.

### 6. [claude LOW] — Ensure every mutation handler calls the single unified `load()` so derived surfaces refresh in place
`06-03-PLAN.md:163` · `06-01-PLAN.md:143` · `src/screens/ContactProfileScreen.tsx:62-82`

`ContactProfileScreen` has one `load` callback driven by `useFocusEffect`. Plans 02/04/05/06 each
"add their read to `load`"; Plans 01/03 reload after a mutation. But an in-place log/edit/delete does
NOT re-fire `useFocusEffect` (the screen stays focused), so a mutation handler that reloads only a
subset leaves status/rogue/gravity/intensity stale until the user leaves and returns — a UI-observable
gap against Success Criterion 1 ("edits change status"). Plan 03 Task 3's wording ("reload the
timeline + header") is narrower than Plan 01's ("re-run the existing `load`").

Strict-wave sequencing makes this mostly self-correcting (Plan 03's `load()` auto-picks-up reads
Plans 04-06 later fold into the *same* callback) — hence LOW. **Fix:** state explicitly in Plans
01/03 that every mutation handler calls the single unified `load()`, and in Plans 04/05/06 that each
new read is folded into that same `load` (not a separate loader), so all derived surfaces refresh
together after a mutation without a re-focus.

---

## What both reviewers confirmed is correct (verified on disk)

- **Single `last_contact` writer preserved.** The only `SET last_contact` in `src/` is
  `recency-dao.ts:152` (`recomputeLastContact`); `contacts-dao.ts` explicitly omits it
  (`:192`, `:316`). Every Phase-6 plan extends the DAO in place — none forks a second writer.
- **Future-date reject pre-transaction on the in-use record + full-edit paths** (Plan 01
  `recordTouchpoint`, Plan 03 `editTouchpointFull`), mirroring `contacts-dao.ts:294-300`'s
  `Promise.reject`-before-`inWriteTransaction` shape. (Gap only on the uncalled legacy path — #1.)
- **One-tap log passes `direction='outbound'` explicitly** (Plan 01 — the DAO default is `null`;
  Cluster-G revision honored).
- **`REASON_SQL` mirrors `STATUS_SQL` branch order and reuses `ROGUE_K`** (Plan 04): the
  rarely_responds branch is first in both, so status and reason cannot disagree; no new engine, and
  results are typed as a new query-time `ProfileStatus`/`RogueReason`, not legacy `OrbitStatus`.
- **Single by-id status read guards `last_contact IS NULL` in TS** (Plan 04) — the load-bearing
  `STATUS_SCAN` NULL pre-filter (`queries.ts:28`) is absent on a by-id seek, and Plan 04 forces
  `status/reason/progress = null` for a never-contacted contact rather than mislabelling 'stable'.
- **Non-reentrant transaction composition** (Plan 03): `editTouchpointFull` calls
  `recomputeLastContactCore` inside one `inWriteTransaction`, never nesting the non-reentrant mutex.
- **gravity/intensity/rogue are derived-never-stored, profile-only**; no new migration; DAOs live in
  `src/db`; every colour resolves through `useTheme().colors.*`.
- **Rarely-responds recency filter is consistent** across recency (`rarely_responds=0 OR
  connected=1`), rogue path, and intensity (connected-only for rarely_responds).
- **Wave/dependency order is clean:** every plan is its own strictly-sequential wave (1→6) with
  `depends_on` the prior; ContactProfileScreen and impact.ts are touched in multiple plans but never
  in the *same* wave — no same-wave `files_modified` overlap.

## Consensus summary

Both reviewers independently verified the load-bearing premises against disk (single writer, schema,
status branch order) and found the plans **fundamentally sound** — the hard invariants are all
honored. No data-corruption or reversed-decision findings. Every concern is a bounded correctness or
test-spec refinement:

- **Agreed actionable (codex-originated, claude-confirmed):** unguarded legacy `editTouchpoint` (#1,
  latent), timeline testID/key collision (#2), incorrect same-day `last_contact` test assertion (#3),
  intensity gap-sort direction (#4), missing strict local datetime parser for picker seeding (#5).
- **Claude-only:** unified-`load()` refresh discipline after in-place mutations (#6, low).
- **Divergence:** only on the severity of #1 — codex HIGH (invariant-level: edit must reject future),
  claude MEDIUM (the requirement is met for every in-use edit path; the legacy path has no caller).

**Overall risk: MEDIUM.** No blockers to planning-convergence; all six items are cheap PLAN.md /
test-spec edits.

---

# Cross-AI Plan Review — Phase 6 · Cycle 2

Re-review after (a) cycle-1's 6 findings were incorporated and (b) three OWNER decisions were folded
in: events **writer** built this phase (archive/restore emit immutable events), gravity/intensity
tunables + `ROGUE_K=3` **owner-approved**, and new `rogue` + `gravityTiers` colour tokens added.
Two reviewers, both source-grounded against the code on disk: **codex** (gpt-5.6-terra, codex-cli
0.144.1, ran in-repo) and **claude** (this session, read-only). The three resolved owner decisions
were NOT re-litigated.

## Cycle-1 findings — all RESOLVED in the plan text (re-verified on disk)

- **#1 unguarded legacy `editTouchpoint`** → **RESOLVED.** Plan 03 retires it (Task 1, `06-03-PLAN.md:65-80,119,130`).
  Confirmed uncalled: `grep editTouchpoint\b src/ | grep -v test` returns only its own definition +
  doc-comment in `recency-dao.ts` — no production caller. (One stale artifacts line survives — see C2-#2.)
- **#2 timeline testID/key + cross-table id collision** → **RESOLVED.** Plan 02 keys rows `${kind}-${id}`
  and orders `occurred_at DESC, id DESC, kind_order DESC` (`06-02-PLAN.md:28-30,204,212,216`); the two
  independent PK sequences are confirmed at `001-initial.ts:98` (interactions) and `:117` (events).
- **#3 same-day `last_contact` MAX test** → **RESOLVED.** Plan 01 now splits the assertion
  (different-time → advances; identical-timestamp → unchanged) at `06-01-PLAN.md:107-108,118,126`; matches
  `recomputeLastContact`'s MAX-over-full-datetime at `recency-dao.ts:150-162`.
- **#4 intensity negative-gap on newest-first input** → **RESOLVED.** Plan 06 requires an ascending
  sort before cadence + a descending-input regression test (`06-06-PLAN.md:91,99,107`).
- **#5 strict local datetime parser for picker seeding** → **RESOLVED (with a residual — see C2-#3).**
  Plan 03 adds `parseLocalDateTime` and seeds both dialogs through it, never `types.ts parseDate`
  (`06-03-PLAN.md:150,155,190`). `dates.ts` confirmed format-only (no parser) at `dates.ts:17-22`.
- **#6 unified `load()` after in-place mutations** → **RESOLVED.** Every plan states each mutation
  handler + each new read routes through the single `load` useCallback (`ContactProfileScreen.tsx:62-70`
  confirmed as the one focus-effect callback). Plans 01/02/03/04/05/06 all say "single unified `load()`".

## What both reviewers confirmed correct in the NEW owner-decision scope (verified on disk)

- **Events writer is immutable + insert-only.** Plan 02 exposes only `recordEvent`/`recordEventCore`/
  `EventType`, no update path (`06-02-PLAN.md:132,136,144`). `EventType = archive|restore|snooze|unsnooze`
  matches the dossier; snooze/unsnooze reserved, no producer this phase. No `INSERT INTO events` exists in
  `src/` today (grep, non-test) — genuinely net-new.
- **Retrofit composes inside the ONE transaction.** archive/restore call `recordEventCore` inside their
  existing `inWriteTransaction` (`06-02-PLAN.md:53-54,171`); `newUid` already imported (`contacts-dao.ts:60`);
  `recomputeLastContactCore` already composed the same way (`contacts-dao.ts:360`). No nested mutex, no
  second transaction, no `last_contact` write added (T-06-11).
- **Purge deletes + surfaces events.** `DELETE FROM events` confirmed at `purge-dao.ts:183`; Plan 02 keeps
  the explicit delete (cascade decorative, FKs off in-txn) and adds the events line to `impactSummaryLines`
  (currently omitted, `purge-dao.ts:131,136-152`).
- **Tokens exist before consumption.** Plan 04 adds `rogue` + `gravityTiers` to `ThemePalette`
  (`theme-types.ts`, currently absent — verified) and seeds them in `theme-presets.ts` only (the sole
  colour-literal file), mirroring `danger`/`avatarSwatches` exactly; test extended like the avatar-swatch
  block (`theme-presets.test.ts:63-89`). Added wave 4, consumed waves 4/5.
- **Tunables owner-approved, no stale flags.** `HALF_LIFE_DAYS=365`, `FLOOR_W=0.15`, the 4 `GRAVITY_TIERS`,
  `INTENSITY_PERIOD_DAYS=interval_days`, and `ROGUE_K=3` are all labelled OWNER-APPROVED 2026-08-15
  (`06-05-PLAN.md:131,162`; `06-06-PLAN.md:89,97,129`; `06-04-PLAN.md:78`). No "ASSUMED/surface-to-owner"
  flag remains for them.
- **Invariants intact:** single `last_contact` writer preserved (`recency-dao.ts:150-162` the only `SET
  last_contact`); gravity/intensity derived-never-stored (no write statement); `REASON_SQL` mirrors
  `STATUS_SQL` branch order (`status.ts:67-73`, rarely_responds branch first) so status/reason cannot
  disagree; no new migration; waves 1→6 each own their wave with `depends_on` the prior → no same-wave
  `files_modified` overlap.

## Cycle-2 findings (most-severe first)

### C2-#1 [codex MEDIUM · claude MEDIUM] — archive/restore can emit a spurious event on a wrong-state call
`06-02-PLAN.md:164-171` · `src/db/contacts-dao.ts:411,435`

`archiveContact`/`restoreContact` scope only by `id` and assert `changes===1` — they do NOT gate on the
current archived state. SQLite counts a matched row as changed even when the written value equals the
stored one, so `restoreContact` on a LIVE contact (`archived_at` already NULL → set NULL) passes
`changes===1`, and post-retrofit would emit a spurious `'restore'` event; likewise a double-`archive`
emits a second `'archive'`. Reachability is UI-gated today (archive only from a live profile, restore only
from the Archived list), so this is **latent** — but the events log is the new "record of what the app
did", a no-op "Restored" row is dishonest, and the project's own convention is structural guards, not UI
routing (cf. `purge-dao.ts:10-14` "structural, not merely UI routing").

**Fix (planner call — it touches shipped Phase-4 DAO behavior, so decide explicitly):** either add
`AND archived_at IS NULL` to archive / `AND archived_at IS NOT NULL` to restore (turning a wrong-state
call into a 0-row loud rollback → no event) with a "no-op transition emits no event" test; OR state in
Plan 02 that UI routing makes the wrong-state call unreachable and the spurious event is accepted, with
that rationale recorded. Do not leave it unaddressed.

### C2-#2 [codex LOW · claude agree] — Plan 03 artifacts line contradicts its own retirement task
`06-03-PLAN.md:227` (vs `:25,65-80,119,130`)

The artifacts summary still reads "existing editTouchpoint **untouched**", directly contradicting Task 1,
which REMOVES `editTouchpoint`. A confused executor could read the artifacts line as license to keep the
unguarded path. **Fix:** rewrite `:227` to "editTouchpoint **removed** (the retired unguarded edit path);
or guarded in place if a production caller is discovered" to match Task 1.

### C2-#3 [codex LOW · claude LOW] — gravityTiers test asserts `length >=` but the contract says "MUST equal"
`06-04-PLAN.md:152` (contract) vs `:156` (test spec)

The token contract says `gravityTiers` length MUST equal the 4 `GRAVITY_TIERS`, but the planned test
asserts only `length >= tier count`. `>=` is *safe* for the `gravityTiers[tierIndex]` indexing contract
(an extra token is harmless, index stays in range), so this is not a correctness bug — but the test is
looser than the stated one-colour-per-tier parity. **Fix (cheap):** assert `toHaveLength(GRAVITY_TIERS.length)`
so an accidental extra/missing token is caught. Keep asserting shape/presence (not exact hex) so a retune
doesn't break the test.

### C2-#4 [codex MEDIUM · claude LOW — downgraded] — picker parser strictness is defensive-only here
`06-03-PLAN.md:155` · `src/db/migrations/001-initial.ts:101`

Codex notes `parseLocalDateTime` builds `new Date(y, m-1, d, H, M, S)`, and JS silently normalizes
out-of-range components (month 13 → next Jan) while `occurred_at` is unconstrained `TEXT`. **Claude
downgrade:** the parser only ever seeds the picker FROM a stored `occurred_at`, and every writer of that
column routes through the single writer with app-generated `localDateTime()`/`combineDateAndTime` output —
it never sees user free-text. Strict anchoring is a reasonable belt-and-suspenders (add an anchored
six-component regex + bounds/round-trip check + a malformed-input test) but is **not required** for any
reachable input. Optional; no plan change strictly needed.

## Suggestions (non-blocking, no plan change required)

- **Naming (codex):** `INTENSITY_PERIOD_DAYS` is described as a top-of-file tunable but is really derived
  per-contact from `inputs.intervalDays` (`06-06-PLAN.md:97`). A resolver name (`getIntensityPeriodDays(intervalDays)`)
  would read truer. Cosmetic.
- **Doc drift (claude):** `theme-types.ts:28` reads "The 11 base dynamic tokens"; adding `rogue` +
  `gravityTiers` makes 13. Trivial, executor-catchable while editing the interface — worth a one-word
  touch, not a plan change.
- **Housekeeping (codex):** older RESEARCH/PATTERNS notes still describe the writer/tokens/tunables as
  deferred/open; refreshing them would prevent execution-time confusion.

## Consensus summary

Both reviewers independently re-verified every load-bearing premise against disk and agree the cycle-1
fixes landed and the new owner-decision scope (events writer, tokens, tunables) is **soundly planned and
matches the code**. No HIGH findings, no data-corruption or reversed-decision findings. The only agreed
substantive item is **C2-#1** (latent spurious lifecycle event — a planner decision that touches shipped
Phase-4 DAO behavior); the rest are two cheap intra-plan doc/test-spec alignments (C2-#2, C2-#3) plus one
optional defensive hardening (C2-#4) and three non-blocking suggestions.

**Overall risk: LOW.** No blockers to planning-convergence. C2-#1 needs an explicit planner disposition
(guard vs. accept-with-rationale); C2-#2 and C2-#3 are one-line PLAN.md edits.

---

## Cycle 2 — resolution (2026-08-15)

The codex+claude cycle-2 review above returned **0 HIGH + 3 actionable** (C2-#1 MEDIUM, C2-#2/#3 LOW).
All three are now incorporated in the plans (`06-02`/`06-03`/`06-04`):

- **C2-#1 (MEDIUM) — archive/restore spurious lifecycle event → RESOLVED (with owner disposition flagged).**
  Plan 02 Task 2 now archived-state-guards each UPDATE (`AND archived_at IS NULL` / `IS NOT NULL`) so a
  no-op/wrong-state transition matches 0 rows → the `changes===1` guard throws → NO spurious event is
  written; a no-op-emits-no-event test is added. This tightens shipped Phase-4 archive/restore semantics
  (a redundant archive/restore now throws instead of silently re-stamping), so it is surfaced to the owner
  at the pre-execution pause as the default (fallback documented in-plan: gate the event on a pre-read of
  the prior `archived_at` instead of throwing).
- **C2-#2 (LOW) — 06-03 artifacts line contradicted the retirement task → RESOLVED** (line rewritten to say
  `editTouchpoint` is removed).
- **C2-#3 (LOW) — gravityTiers test asserted `length >=` → RESOLVED** (changed to `toHaveLength(GRAVITY_TIERS.length)`,
  matching the one-colour-per-tier contract).

Cycle-1's six findings remain incorporated (verified). No unresolved HIGH; no unresolved actionable (all 3
folded in). The single-`last_contact`-writer invariant, derived-never-stored, local wall-clock,
no-new-migration, and the acyclic one-plan-per-wave graph all hold. **Phase 6 plans converged** —
pending the owner's C2-#1 disposition at the pre-execution pause.

CYCLE_SUMMARY: current_high=0 current_actionable=0  (0 HIGH; the 3 cycle-2 actionable are all incorporated)
