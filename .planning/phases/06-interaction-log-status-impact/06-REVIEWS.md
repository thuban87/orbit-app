---
phase: 6
reviewers: [codex, claude]
reviewed_at: 2026-08-15
plans_reviewed: [06-01-PLAN.md, 06-02-PLAN.md, 06-03-PLAN.md, 06-04-PLAN.md, 06-05-PLAN.md, 06-06-PLAN.md]
cycle: 1
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
