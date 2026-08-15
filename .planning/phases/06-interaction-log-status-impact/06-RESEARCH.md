# Phase 6: Interaction Log, Status & Impact - Research

**Researched:** 2026-08-15
**Domain:** On-device SQLite touchpoint model + query-time derived quantities (status/gravity/intensity/rogue) + profile read surfaces (React Native / Expo)
**Confidence:** HIGH (write layer, status engine, schema all read on disk and already built; math design CITED from the authoritative dossier; only the tunable-constant *values* are ASSUMED)

## Summary

Phase 6 is **mostly a consumer, not a builder, of the write layer.** The single-writer recency DAO shipped in Phase 2 (`src/db/recency-dao.ts`) already implements `recordTouchpoint`, `editTouchpoint`, `deleteTouchpoint`, and `createContactWithInteraction` — each routing through the one `recomputeLastContact` MAX behind the shared mutex + hand-rolled transaction, and the **filtered-MAX for "Rarely responds" is already in the SQL** (`contacts.rarely_responds = 0 OR i.connected = 1`). The query-time status engine (`src/db/status.ts`) already emits `rogue` as a 4th threshold (`ROGUE_K = 3`) plus the rarely_responds non-time path. The schema (`interactions`, `events`, every un-backfillable column, the recency index) shipped in migration 1. **Phase 6 needs no migration and must not add a second `last_contact` writer.**

What Phase 6 actually builds: (1) the **UI + call-sites** for one-tap log and the refine flow; (2) a **touchpoint metadata editor** for the non-recency fields (channel/direction/quality/note) that the current `editTouchpoint` does not cover; (3) **future-`occurred_at` rejection** on the record/edit paths (present on `updateContactFull` but *absent* on `recordTouchpoint`/`editTouchpoint`); (4) the **rogue `reason`** expression (the engine returns `'rogue'` today with no reason); (5) **gravity and intensity** — brand-new derived-never-stored math with no existing code; (6) the **profile timeline** read (interleaved touchpoints + events, newest-first); and (7) the profile UI for all of the above, conforming to the existing design system.

The correctness landmines are concentrated in the math and the write-path contract, all of which are pure/`node:sqlite`-testable via the repo's vitest + `__testkit__/node-sqlite.ts` harness.

**Primary recommendation:** Treat Phase 2's `recency-dao.ts` as the immutable write spine. Add ONE new composition (`editTouchpointFull`) that updates every editable column and *always* calls `recomputeLastContactCore` inside its transaction (recompute is idempotent — one edit path, no second writer). Extract all of gravity/intensity/rogue-reason/period math into pure `*-logic.ts` modules with `.test.ts` coverage. Put every tunable at the top of a single `src/services/impact.ts` (or similar) service file. Resolve the events-writer tension (below) with the owner before planning the timeline.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Touchpoint insert/edit/delete + recency recompute | Database / DAO (`recency-dao.ts`) | — | Already the single writer of `last_contact`; every route funnels here |
| Future-date / interval validation | Pure logic (`*-logic.ts`) + DAO reject | UI (inline error) | Chokepoint guard before any transaction opens (mirrors `updateContactFull` GUARD 2) |
| Status / rogue / rogue-reason bucketing | Database (SQL constants in `status.ts`) | — | Derived-never-stored; computed in the SELECT at local midnight |
| Gravity / intensity math | Service (pure `-logic.ts`) | Database (row read) | Derived-never-stored; profile-only; reads rows, computes in TS |
| Timeline (touchpoints ⋈ events) | Database (read SQL) | Screen (render) | Read-only interleave; ordered `occurred_at DESC, id DESC` |
| Log / refine / edit / delete UI | Screen (`ContactProfileScreen` + new components) | Theme tokens | Portrait, all colour via `useTheme()` |
| Two-dialog date+time entry | Screen (`@react-native-community/datetimepicker`) | Pure carry-state logic | Android has no combined picker (F7); chaining state is node-testable |

## Standard Stack

This phase installs **nothing new**. Everything required is already a dependency.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | 57.0.1 | On-device store; the only persistence | Project-wide, local-first [VERIFIED: package.json] |
| `@react-native-community/datetimepicker` | 9.1.0 | Date + time correction in refine flow | Already installed; the only RN Android date/time picker [VERIFIED: node_modules …/datetimepicker@9.1.0] |
| `vitest` | (devDep) | Test runner (`npm test` → `vitest run`) | Repo convention; drives `node:sqlite` adapter [VERIFIED: package.json scripts] |
| `node:sqlite` (`DatabaseSync`) | Node built-in | In-memory DB for DAO/behaviour tests | `src/db/__testkit__/node-sqlite.ts` [VERIFIED: __testkit__/node-sqlite.ts] |

### Supporting (all already present)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@shopify/react-native-skia` | installed | Not needed in P6 (orrery is P13) | Do NOT introduce Skia here — profile bars are plain RN Views |
| `react-native-reanimated` | installed | Gesture/animation | Only if an animated bar is wanted; not required |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-native-community/datetimepicker` two dialogs | `@expo/ui` datetime | REJECTED by dossier F7: `@expo/ui@57` Android falls back to date-only, silently collects no time |
| new `async-mutex` dep | existing `src/db/mutex.ts` | Mutex already exists (4-line promise chain); adding a dep is explicitly rejected [VERIFIED: mutex.ts header] |

**Installation:** none — no `npm install` for this phase.

## Package Legitimacy Audit

Not applicable — Phase 6 installs no external packages. All libraries it uses (`expo-sqlite`, `@react-native-community/datetimepicker`, `vitest`) are already in `package.json` and were verified present on disk this session.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
  ONE-TAP (in-app)       │  ContactProfileScreen / new log components   │
  "mark contacted" ─────▶│  (portrait, colour via useTheme tokens)      │
                         └───────────────┬─────────────────────────────┘
                                         │ occurredAt/now = localDateTime()
       REFINE / EDIT / DELETE            │ (LOCAL wall-clock, never toISOString)
       (channel,direction,connected, ────┤
        quality,note,date+time)          │
                                         ▼
                    ┌───────────────────────────────────────┐
                    │  PRE-TX GUARDS (pure -logic.ts)        │
                    │   • intervalDays > 0                   │
                    │   • occurred_at <= now  (reject future)│
                    └───────────────┬───────────────────────┘
                                    │ pass
                                    ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  recency-dao.ts  — THE SINGLE last_contact WRITER (Phase 2)   │
        │  withMutex → BEGIN → insert/edit/delete → recomputeLastContact│
        │  recompute = MAX(occurred_at) WHERE                           │
        │     (rarely_responds=0 OR connected=1)   → COMMIT             │
        │  NEW in P6: editTouchpointFull (all cols, always recompute)   │
        └───────────────┬──────────────────────────────────────────────┘
                        │ writes interactions row(s) + contacts.last_contact
                        ▼
        ┌──────────────────────────────┐        ┌────────────────────────────┐
        │  interactions  (+ events)    │        │  contacts.last_contact      │
        │  editable rows, stable uid   │        │  (stored-but-derived)       │
        └───────────────┬──────────────┘        └───────────────┬────────────┘
                        │  READ (no transaction)                 │
        ┌───────────────▼────────────────────────────────────────▼──────────┐
        │  DERIVED-NEVER-STORED, computed at query/read time                  │
        │   • status + rogue + REASON  (SQL: status.ts, PROGRESS_SQL)         │
        │   • gravity  (age-decayed weighted sum → tiers)   pure -logic.ts    │
        │   • intensity (period rate + trailing cadence)    pure -logic.ts    │
        │   • timeline (touchpoints ⋈ events, occurred_at DESC, id DESC)      │
        └───────────────┬────────────────────────────────────────────────────┘
                        ▼
              Profile-only render (gravity bar + tier, intensity line,
              rogue label + reason, "Rarely responds" label, timeline)
              Aggregates also feed AI prompt (Phase 14) — names/ints only
```

### Recommended Project Structure (net-new files)
```
src/
├── db/
│   ├── recency-dao.ts          # EXTEND: add editTouchpointFull (reuse recomputeLastContactCore)
│   ├── status.ts               # EXTEND: add REASON_SQL (rogue reason); keep ROGUE_K here (shared constant)
│   ├── timeline-read.ts        # NEW: interleaved touchpoints ⋈ events read (occurred_at DESC, id DESC)
│   └── log-guards.ts           # NEW (pure): rejectFutureOccurredAt(), shared with DAO reject path
├── services/
│   ├── impact.ts               # NEW: gravity + intensity tunables at top-of-file + orchestration
│   ├── gravity-logic.ts        # NEW (pure, node-testable): age-decayed weighted sum → tier
│   └── intensity-logic.ts      # NEW (pure, node-testable): period rate + trailing cadence
├── components/
│   ├── GravityBar.tsx          # NEW: tiers + bar, colour via tokens
│   ├── IntensityLine.tsx       # NEW: neutral rate + trailing average
│   ├── TimelineRow.tsx         # NEW: touchpoint (editable) / event (read-only, distinct)
│   └── TouchpointRefineForm.tsx# NEW: channel/direction/connected/quality/note/date+time
└── screens/
    └── ContactProfileScreen.tsx# EXTEND: replace timeline stub; add one-tap, gravity/intensity, rogue label
```

### Pattern 1: One edit path — always recompute (idempotent)
**What:** A single `editTouchpointFull` that updates *every* editable column and unconditionally calls `recomputeLastContactCore` inside its transaction.
**When to use:** The refine flow edits fields that DON'T move recency (channel/direction/quality/note) as well as ones that DO (occurred_at/connected). Two edit paths = two places to forget the recompute.
**Why safe:** `recomputeLastContact` is a MAX over current rows — idempotent. Running it after a note-only edit is a cheap no-op that keeps `last_contact` provably correct.
```typescript
// Source: pattern extends src/db/recency-dao.ts editTouchpoint (VERIFIED on disk)
// Scope by BOTH keys (WR-04 pattern already in editTouchpoint), assert changes===1,
// then recomputeLastContactCore inside the SAME inWriteTransaction.
export function editTouchpointFull(exec, input): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const r = await exec.runAsync(
      `UPDATE interactions SET occurred_at=?, channel=?, direction=?,
              connected=?, quality=?, note=?, modified_at=?
        WHERE id=? AND contact_id=?`,
      [input.occurredAt, input.channel, input.direction, input.connected,
       input.quality, input.note, input.now, input.interactionId, input.contactId]);
    if (r.changes !== 1) throw new Error("editTouchpointFull: no matching row");
    await recomputeLastContactCore(exec, input.contactId, input.now); // single writer
  });
}
```

### Pattern 2: Rogue reason mirrors STATUS_SQL branch order
**What:** A SQL CASE that returns the *cause* of rogue, ordered identically to `STATUS_SQL` so status and reason never disagree.
```sql
-- Source: extends src/db/status.ts STATUS_SQL (VERIFIED on disk)
CASE
  WHEN rarely_responds = 1 AND (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'unresponsive'
  WHEN (${PROGRESS_SQL}) >= ${ROGUE_K}                            THEN 'overdue'
  ELSE NULL
END
```
`'unresponsive'` = the "Rarely responds" path; `'overdue'` = beyond-decay time path. Precedence matches STATUS_SQL (rarely_responds branch first). NULL when not rogue.

### Pattern 3: Pure derived math + `node:sqlite` behaviour tests
**What:** Gravity/intensity are pure functions over an array of interaction rows; the DAO recency invariants are proven against an in-memory `node:sqlite` DB.
```typescript
// Source: mirrors src/db/recency-dao.test.ts (VERIFIED) — vitest + __testkit__/node-sqlite
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
// gravity-logic.ts is react-native-free → import and test directly, no DB needed.
```

### Anti-Patterns to Avoid
- **A second `last_contact` writer.** Every touchpoint route MUST call through `recency-dao`. Never `UPDATE contacts SET last_contact` anywhere else. [CITED: CLAUDE.md; ROADMAP cross-phase]
- **Storing gravity/intensity/status.** All derived-never-stored — a stored score rots because nothing fires on the clock advancing. [CITED: 04-log.md decision #9]
- **`toISOString().split('T')[0]`.** Use `localDateTime()` / `formatLocalDate()` — UTC off-by-one at night. [VERIFIED: src/utils/dates.ts, database.ts]
- **Re-running `date(last_contact,'localtime')`.** The stored value is ALREADY local; double-conversion shifts late rows a day. [VERIFIED: status.ts comment lines 44-59]
- **`withTransactionAsync` / `withExclusiveTransactionAsync`.** They deferred-BEGIN on the shared connection (capture headless writes) and mask the original error. Use `inWriteTransaction`. [VERIFIED: transaction.ts; 04-log.md F8]
- **Nesting `inWriteTransaction`.** The mutex is non-reentrant → permanent hang. Compose via `*Core` functions inside one outer transaction. [VERIFIED: transaction.ts lines 11-29]
- **Redefining the rogue constant.** `ROGUE_K` lives in `status.ts`; orrery(13)/notify(11)/digest(15) import it. One value, one place. [VERIFIED: status.ts:42; ROADMAP:62-63]
- **Inventing an events `type` vocabulary.** No writer exists yet (see Open Questions). Do not fabricate one silently. [VERIFIED: contacts-dao.ts:382-386]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recompute `last_contact` after a touchpoint mutation | A custom UPDATE in the screen/DAO | `recency-dao` functions / `recomputeLastContactCore` | Single-writer invariant; correlated-subquery MAX already handles non-newest edits/deletes + rarely_responds filter [VERIFIED: recency-dao.ts:145-162] |
| Serialize headless + foreground writes | Per-caller mutex or `async-mutex` | `src/db/mutex.ts withMutex` | One shared chain already imported by both contexts [VERIFIED: mutex.ts] |
| Write transaction with correct rollback + error preservation | expo wrappers or ad-hoc BEGIN | `inWriteTransaction` | Hand-rolled, non-capturing, preserves original error [VERIFIED: transaction.ts] |
| Status / rogue bucketing | New JS status function | `status.ts` SQL constants (`STATUS_SQL`, `PROGRESS_SQL`, `ROGUE_K`) | Already computes at local midnight, derived-never-stored [VERIFIED: status.ts] |
| Newest interaction per contact + tiebreak | Ad-hoc ORDER BY | `queries.ts NEWEST_FOR_CONTACT / NEWEST_PER_CONTACT` | `occurred_at DESC, id DESC` tiebreak already defined [VERIFIED: queries.ts:31-54] |
| Local wall-clock timestamp | `new Date().toISOString()` | `localDateTime()` / `formatLocalDate()` | Avoids UTC off-by-one [VERIFIED: database.ts:45, dates.ts:17] |
| Future-date rejection | Silent clamp | pre-transaction string compare `occurredAt > now` | Pattern proven in `updateContactFull` GUARD 2 [VERIFIED: contacts-dao.ts:292-300] |

**Key insight:** ~70% of this phase's data-layer correctness already shipped in Phase 2 and is covered by `recency-dao.test.ts`. The risk is *re-implementing* it (introducing a second writer) rather than *composing* it.

## Runtime State Inventory

Not a rename/refactor/migration phase — greenfield feature work on an existing schema. No stored-data renames, no OS-registered state, no secret/env changes, no build-artifact churn. **Nothing to inventory in any category — verified: Phase 6 adds no columns, no migration, no renamed keys** (interactions/events/all columns exist from migration 1; gravity/intensity/rogue/reason are all derived-never-stored).

## Common Pitfalls

### Pitfall 1: `recordTouchpoint` / `editTouchpoint` do NOT reject future dates
**What goes wrong:** LOG-06 requires a future `occurred_at` be rejected at entry. `updateContactFull` guards it (line 294), but `recordTouchpoint` and `editTouchpoint` in `recency-dao.ts` do **not** — they will happily insert/edit a future date. A future `occurred_at` makes `PROGRESS_SQL` negative → the contact buckets `stable` forever and drops off every reminder (dossier F2 / D-cluster).
**Why it happens:** The guard was only wired into the create/edit-contact composition, not the general touchpoint paths.
**How to avoid:** Add a shared `rejectFutureOccurredAt(occurredAt, now)` pure guard (`log-guards.ts`) and call it in the `recordTouchpoint`/`editTouchpointFull` pre-transaction reject path (mirror `updateContactFull`'s `Promise.reject` shape so no transaction opens). Local wall-clock strings sort chronologically, so `occurredAt > now` is a valid comparison.
**Warning signs:** A contact logged "in the future" shows green and never notifies.

### Pitfall 2: One-tap must explicitly write `direction='outbound'`
**What goes wrong:** Cluster G **revised** Cluster A: one-tap routes now write `direction='outbound'`, not null — gravity depends on knowing *you* reached out. But `insertInteraction` defaults `direction ?? null` (line 191). If the one-tap caller relies on the default, it writes null and starves gravity.
**How to avoid:** The in-app one-tap call site must pass `direction:'outbound'` explicitly (with `channel:'unspecified'`, `connected:1`, `quality:null`, `source:'manual'`). Only the full flow sets a real direction. [CITED: 04-log.md Cluster G / decision-without-you #1]
**Warning signs:** Intensity's "am I over-contacting" signal misfires or reads null direction.

### Pitfall 3: `editTouchpoint` only updates occurred_at + connected
**What goes wrong:** The refine flow edits channel/direction/quality/note too. The Phase-2 `editTouchpoint` UPDATE SET list is `occurred_at, connected, modified_at` only (lines 236-249) — it silently ignores the other fields.
**How to avoid:** Add `editTouchpointFull` (Pattern 1) covering all editable columns; route the refine/edit UI through it. Keep the always-recompute so there's one edit path.

### Pitfall 4: Timeline "read-only events" have no writer
**What goes wrong:** Success criterion 2 says the timeline interleaves touchpoints and read-only events. But `contacts-dao.ts:382-386` records that archive/restore deliberately do NOT write events, and no event `type` vocabulary exists — the `events` table is empty in the running app. A timeline that unions `events` renders nothing for them.
**How to avoid:** Resolve scope with the owner before planning (see Open Questions). Build the interleaved read correctly regardless; do not invent a type vocabulary to fill it.

### Pitfall 5: The legacy `OrbitStatus` type excludes `rogue`
**What goes wrong:** `src/types.ts` `OrbitStatus = "stable"|"wobble"|"decay"|"snoozed"` and `calculateStatus()` are the **plugin-ported** legacy (Date-based, returns `decay` for never-contacted). They are NOT the query-time engine and do NOT include `rogue`. Consuming `calculateStatus()` or typing a query result as `OrbitStatus` will drop/mistype `rogue`.
**How to avoid:** Read status from the SQL engine (`status.ts STATUS_SQL`) and define a status type that includes `rogue` for query-time results. Treat `src/types.ts calculateStatus` as legacy — do not extend it. [VERIFIED: src/types.ts:30, 98-123]
**Warning signs:** A `rogue` contact rendered as `decay` on the profile.

### Pitfall 6: Deletes are unrecoverable — confirm, then recompute
**What goes wrong:** Owner declined `field_history`-style snapshots for interactions; a deleted touchpoint is gone (no server, no backup). Deleting the newest connected row must move `last_contact` back.
**How to avoid:** Wrap delete in an `Alert.alert` confirm; call `deleteTouchpoint` (which already recomputes, scoped by both keys, asserting exactly one row). [VERIFIED: recency-dao.ts:260-279; CITED: 04-log.md Cluster C]

### Pitfall 7: Intensity must match the recency filter for rarely_responds
**What goes wrong:** If intensity counts non-connected rows for a "Rarely responds" contact while recency ignores them, the metric and the orbit disagree.
**How to avoid:** Intensity ignores non-connected rows for rarely_responds contacts — same filter as recency. [CITED: 04-log.md decision-without-you #8]

## Code Examples

### Filtered-MAX recency recompute (already shipped — reuse, don't rebuild)
```typescript
// Source: src/db/recency-dao.ts:145-162 (VERIFIED on disk)
`UPDATE contacts
    SET last_contact = (
          SELECT MAX(i.occurred_at) FROM interactions i
           WHERE i.contact_id = contacts.id
             AND (contacts.rarely_responds = 0 OR i.connected = 1)
        ),
        modified_at = ?
  WHERE id = ?`
```

### Recommended gravity formula (shape CITED; constants ASSUMED)
```typescript
// Source shape: 04-log.md Cluster G "decays with age, toward a floor" (CITED)
// Per-interaction weight decays toward a floor fraction, never to zero.
// Sum over the contact's rows → raw gravity → mapped to a named tier.
const HALF_LIFE_DAYS = 365;   // [ASSUMED] owner-taste, deferred to discussion
const FLOOR_W = 0.15;         // [ASSUMED] weight an ancient interaction still carries
function weight(ageDays: number): number {
  const decayed = Math.exp(-Math.LN2 * ageDays / HALF_LIFE_DAYS);
  return FLOOR_W + (1 - FLOOR_W) * decayed;   // asymptotes to FLOOR_W, not 0
}
// gravityRaw = Σ weight(ageDays(occurred_at))   (optionally down-weight !connected)
// tier = firstTierWhoseThresholdRawExceeds(gravityRaw)  // coarse tiers, not a raw number
```

### Recommended intensity (period rate + trailing cadence)
```typescript
// Source: 04-log.md Cluster G — neutral rate, no judgement; absorbs the cadence stat
const PERIOD_DAYS = (c) => c.interval_days;  // [ASSUMED] "one interval-length" per deferred note
// currentRate  = count(connected rows in last PERIOD_DAYS) ; intended = 1 per period
//   → "5× this period vs Monthly intended"
// trailingAvgGapDays = mean gap between consecutive (connected) occurred_at
//   → "Monthly intended · 47-day average · 2× this month"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plugin `appendToInteractionLog` (1 writer, 0 readers, note-gated) | SQLite `interactions` rows via single-writer DAO, full read surfaces | Phase 2 + this phase | Timeline is net-new product surface, not a port [CITED: 04-log.md F1] |
| Plugin silent `channel='call'` default | First-class `unspecified` channel | migration 1 | One-tap no longer lies about channel [VERIFIED: 001-initial.ts:103] |
| Plugin `OrbitStatus` = 3 buckets, Date math | Query-time SQL `PROGRESS_SQL`/`STATUS_SQL` + `rogue` | Phase 2 | Continuous progress, derived-never-stored [VERIFIED: status.ts] |

**Deprecated/outdated:**
- `src/types.ts calculateStatus()` / `OrbitStatus` — legacy plugin port; NOT the authority. Do not extend for `rogue`.
- `import` value in `source` enums — dropped (domain 5 cut). Interaction `source` is `manual|widget|notification|ai`. [CITED: 04-log.md Cluster F]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gravity half-life = 365d, floor weight = 0.15 | Code Examples | Owner-taste; wrong feel, but single-number edit at top of `impact.ts` |
| A2 | Gravity tier count/boundaries/names (thin/building/solid/deep placeholders) | Standard Stack/Impact | Deferred to discussion; needs owner sign-off before shipping copy |
| A3 | Intensity period = one interval-length per contact | Code Examples | Dossier calls this "probably right"; a Yearly contact has no meaningful "week" |
| A4 | Rogue reason values `'unresponsive'` / `'overdue'` | Pattern 2 | Naming/UI copy; the *logic* (branch order) is CITED and firm |
| A5 | In-app one-tap uses `source='manual'` | Pitfall 2 | widget/notification sources are Phase 11/12; in-app is manual |
| A6 | `editTouchpointFull` always-recompute is acceptable cost | Pattern 1 | Recompute is O(rows-per-contact) MAX on an indexed table — negligible at HANDOFF §10 scale |

**Rogue threshold value (`ROGUE_K`)** is *already set to 3× interval* in `status.ts` [VERIFIED]. The dossier deferred "what multiple" to phase discussion; the code picked 3. **Flag to owner:** confirm 3× is the intended rogue multiple (and whether user-tunable) — it is currently a hardcoded shared constant, not user-facing.

## Open Questions

1. **Does Phase 6 establish the events writer, or is the timeline touchpoints-only-in-practice?**
   - What we know: The dossier DECIDED events render in the timeline in v1 (Cluster F). The code DEFERRED the events writer — archive/restore (shipped) write no event rows, snooze is Phase 11, and no event `type` vocabulary exists. [VERIFIED: contacts-dao.ts:382-386]
   - What's unclear: With no writer, the "read-only events" half of criterion 2 has nothing to display. Options: (a) retrofit archive/restore to write events + define the `type` vocabulary now (low cost, touches shipped code), (b) build the interleaved read but ship it effectively touchpoints-only until Phase 11 lands snooze events, (c) define vocabulary + writer only for snooze in Phase 11.
   - Recommendation: **Owner/planner scoping call before planning.** Build the interleaved timeline read correctly regardless (union `events`, order `occurred_at DESC, id DESC`). Recommend defining the event `type` vocabulary in this phase (so the read is honest) and retrofitting archive/restore event-writes as a small P6 task, since the criterion explicitly wants events visible. Do NOT invent the vocabulary silently.

2. **Rogue multiple confirmation.** `ROGUE_K=3` is hardcoded. Confirm value + whether user-tunable (dossier left this open). If tunable, it needs a settings surface (likely out of P6 scope → keep constant).

3. **Where do the AI aggregates live?** `[log → ai]` requires aggregates-only (counts/cadence/quality summary/gravity tier/intensity) with no note text. Phase 6 owns the log; Phase 14 owns the prompt. Recommend Phase 6 expose pure aggregate functions (reusing gravity/intensity-logic) so Phase 14 consumes them — but confirm whether that surface is built now or in Phase 14.

4. **Profile status colour.** The theme palette has NO status-ring colours (only base tokens + `danger` + `avatarSwatches`) [VERIFIED: theme-types.ts]. The status ring lives on the Phase-8 card, not the P6 profile. Confirm the P6 profile needs no status-colour tokens (rogue label can use `danger`/`textSecondary`; gravity bar uses `accent`/`border`). Adding status-colour tokens is an owner taste decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-sqlite` | All data | ✓ | 57.0.1 | — |
| `@react-native-community/datetimepicker` | Refine date+time | ✓ | 9.1.0 | — |
| `node:sqlite` | DAO tests | ✓ | Node built-in (SQLite 3.51.2) | — |
| `vitest` | Test runner | ✓ | devDep | — |
| On-device Pixel | UAT of one-tap/timeline/perf | ✓ (per MEMORY) | — | desktop emulator (NOT for perf) |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (`npm test` → `vitest run`) [VERIFIED: package.json] |
| Config file | vitest (present; alias `@/` → `src/`) |
| DB harness | `src/db/__testkit__/node-sqlite.ts` (`DatabaseSync` in-memory + `SqlExecutor` adapter) [VERIFIED] |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOG-01 | One-tap defaults (unspecified/outbound/connected/manual) insert one row + recompute | unit (node:sqlite) | `npx vitest run src/db/recency-dao.test.ts` (extend) | ⚠ extend |
| LOG-01 | Refine edit updates all editable cols + recomputes | unit | `npx vitest run src/db/recency-dao.test.ts` | ❌ Wave 0 (`editTouchpointFull`) |
| LOG-02 | Timeline interleave order `occurred_at DESC, id DESC` | unit | `npx vitest run src/db/timeline-read.test.ts` | ❌ Wave 0 |
| LOG-02 | Delete removes row + recomputes (recency moves back) | unit | `npx vitest run src/db/recency-dao.test.ts` | ✅ (delete covered; assert recompute-back) |
| LOG-03 | Gravity: age-decay toward floor, monotone in recency, tier mapping | unit (pure) | `npx vitest run src/services/gravity-logic.test.ts` | ❌ Wave 0 |
| LOG-03 | Intensity: period rate + trailing cadence; ignores !connected for rarely_responds | unit (pure) | `npx vitest run src/services/intensity-logic.test.ts` | ❌ Wave 0 |
| LOG-04 | MAX over connected rows only for rarely_responds; non-connecting attempt doesn't move orbit | unit (node:sqlite) | `npx vitest run src/db/recency-dao.test.ts` | ✅ (already asserted; keep) |
| LOG-05 | Rogue at `ROGUE_K` and via rarely_responds; reason = overdue/unresponsive | unit (node:sqlite) | `npx vitest run src/db/status.test.ts` (extend REASON_SQL) | ⚠ extend |
| LOG-06 | Same-day repeat taps → DISTINCT rows | unit (node:sqlite) | `npx vitest run src/db/recency-dao.test.ts` | ✅ (verify present) |
| LOG-06 | Future occurred_at REJECTED on record + edit paths | unit (pure + node:sqlite) | `npx vitest run src/db/log-guards.test.ts` | ❌ Wave 0 |
| LOG-06 | Evening occurred_at round-trips byte-identical (local wall-clock) | unit | `npx vitest run src/db/recency-dao.test.ts` | ✅ (already asserted) |

### Sampling Rate
- **Per task commit:** `npx vitest run <the touched module's test>`
- **Per wave merge:** `npm test` (full suite green)
- **Phase gate:** full suite green + on-device Pixel UAT (build+drive per desktop-build-pipeline runbook; UI phases are not defaulted to human_needed per MEMORY) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/log-guards.ts` + `.test.ts` — future-date rejection (LOG-06)
- [ ] `src/db/timeline-read.ts` + `.test.ts` — interleaved read (LOG-02)
- [ ] `src/services/gravity-logic.ts` + `.test.ts` — gravity math (LOG-03)
- [ ] `src/services/intensity-logic.ts` + `.test.ts` — intensity math (LOG-03)
- [ ] Extend `src/db/status.test.ts` — REASON_SQL for rogue reason (LOG-05)
- [ ] Extend `src/db/recency-dao.test.ts` — `editTouchpointFull`, future-date reject on record/edit, one-tap defaults (LOG-01/06)
- [ ] Component tests are UI-observable on-device (timeline/gravity bar/refine form) — not node-unit; verify on Pixel

## Security Domain

`security_enforcement` is enabled (no explicit `false` found). This phase is local-only, no network on any read path, no auth/session/access-control surface, no new secrets.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in a local-first app |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-user device DB |
| V5 Input Validation | yes | Interval > 0 + future-date reject (pure guards); all DB values `?`-bound |
| V6 Cryptography | no | No crypto here (keys are Phase 14) |
| V7/V9 Data & Comms | yes | No network on read path; AI aggregates carry NO note text ([log → ai]) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Every value `?`-bound; only code-constants (`ROGUE_K` etc.) interpolated into SQL — verified pattern across `status.ts`/`queries.ts`/`recency-dao.ts` |
| Note-text egress to AI provider | Information disclosure | Aggregates-only to prompt; note text never transmitted (no `off_limits` analogue on interactions) [CITED: 04-log.md Cluster D] |
| Recency corruption via second writer | Tampering | Single-writer DAO + mutex + transaction; no other module writes `last_contact` |
| Data loss on delete | Repudiation/loss | Confirm dialog; owner-accepted unrecoverable (blast radius one row) [CITED: 04-log.md Cluster C] |

## Project Constraints (from CLAUDE.md)
- ONE DAO writes `contacts.last_contact`; every touchpoint route goes through Phase-2 `recency-dao` behind the mutex + transaction. Reversing/weakening this is an owner decision, not a bug fix.
- No hardcoded colour (incl. Skia) — all colour via `src/theme` tokens; `npm run check:colors` gate.
- No network on any read path; local-first is a product commitment.
- Portrait-locked; animation never driven from React state (N/A here — no Skia loop in P6).
- Use `formatLocalDate()` / `localDateTime()` / `date('now','localtime')` — never `toISOString().split`.
- Tunable constants at top of their service file (gravity half-life/floor/tiers, intensity period, `ROGUE_K`) — single-number edits.
- SQLite migrations forward-only, never edit shipped; irreversible on unreachable devices. **This phase needs no migration — confirm and do not add one.**
- Review the code, not the diff: read every writer of `interactions`/`contacts` before asserting invariants (the graph cannot enumerate SQL writers — manual grep).
- Git worktrees disabled; never `git worktree`; never `git push` (owner pushes).

## Sources

### Primary (HIGH confidence)
- `docs/dossier/04-log.md` (812 lines, authoritative decisions) — all Cluster A–G decisions, F1–F9 findings
- `docs/dossier/INDEX.md` — `[log → *]` / `[data → log]` cross-domain constraint rows
- `src/db/recency-dao.ts` — single-writer DAO, filtered-MAX, mutex/transaction contract, `*Core` exports
- `src/db/status.ts` — `PROGRESS_SQL`, `STATUS_SQL`, `ROGUE_K`, rogue thresholds, timezone contract
- `src/db/transaction.ts`, `src/db/mutex.ts` — non-reentrancy + shared serialization
- `src/db/migrations/001-initial.ts` — `interactions`/`events` DDL, recency index, all un-backfillable columns
- `src/db/queries.ts` — `NEWEST_FOR_CONTACT`, `NEWEST_PER_CONTACT`, `statusOrder`
- `src/db/contacts-dao.ts` — `updateContactFull` GUARD 2 (future-date), rarely_responds recompute, events-writer deferral
- `src/db/contact-read.ts`, `src/screens/ContactProfileScreen.tsx` — profile scaffold + timeline stub
- `src/utils/dates.ts`, `src/db/database.ts` — `formatLocalDate` / `localDateTime`
- `src/theme/theme-types.ts`, `.planning/phases/05-UI-SPEC.md` — design system tokens + de-facto spacing/typography scale
- `.planning/ROADMAP.md` (cross-phase constraints + Phase 6 goal/criteria), `.planning/REQUIREMENTS.md` (LOG-01…06)

### Secondary (MEDIUM confidence)
- none required — all findings verified against on-disk code or the authoritative dossier.

### Tertiary (LOW confidence)
- Tunable-constant *values* (A1–A5) — training-informed defaults, owner-taste, deferred to discussion.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing new to install; all deps verified on disk
- Write layer / status engine: HIGH — read line-by-line; already built + tested in Phase 2
- Rogue/reason: HIGH (logic), MEDIUM (reason value naming)
- Gravity/intensity: HIGH (design shape from dossier), LOW (constant values — owner-taste, deferred)
- Timeline/events: MEDIUM — a genuine decision-vs-code tension the planner must resolve with the owner
- Pitfalls: HIGH — each traced to a specific file:line or dossier decision

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 (stable internal codebase; re-verify if `recency-dao.ts`/`status.ts` change)
