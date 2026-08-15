# Phase 6: Interaction Log, Status & Impact - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 13 (6 new, 3 extend, 4 new components) + 1 test-pattern reference
**Analogs found:** 13 / 13 (every net-new file has a strong on-disk analog; this phase CONSUMES an existing spine)

> **Framing (read first).** Phase 6 is ~70% consumer, not builder. The write spine
> (`recency-dao.ts`), the status engine (`status.ts`), the schema (`001-initial.ts`), the
> transaction/mutex primitives, the pure-`-logic.ts`+node-test convention, the profile scaffold,
> the theme-token discipline and the local-wall-clock date helpers ALL already ship. The planner's
> job is to have each new file COPY the cited analog, not reinvent it. The single most dangerous
> failure mode is introducing a **second `contacts.last_contact` writer** — every touchpoint route
> must funnel through `recency-dao.ts`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/recency-dao.ts` (EXTEND: `editTouchpointFull`, future-date reject on record/edit) | dao | CRUD / single-writer | itself — `editTouchpoint` / `recordTouchpoint` / `createContactWithInteraction` | exact (extend in place) |
| `src/db/status.ts` (EXTEND: `REASON_SQL`) | dao (SQL const) | transform / query-time | itself — `STATUS_SQL` | exact (extend in place) |
| `src/db/log-guards.ts` (NEW, pure) | utility (pure guard) | transform / validation | `contacts-dao.ts` `updateContactFull` GUARD 2 (:292-300) | role+flow match |
| `src/db/timeline-read.ts` (NEW) | dao (read SQL) | read / request-response | `queries.ts` `NEWEST_PER_CONTACT` (:37-42) + `contact-read.ts` | exact (read-SQL-const pattern) |
| `src/services/impact.ts` (NEW, tunables + orchestration) | service | transform / read-compute | `src/services/launch-sweep.ts` (tunables/consts at top-of-file) | role match |
| `src/services/gravity-logic.ts` (NEW, pure) | utility (pure math) | transform / batch | `src/services/photos/crop-geometry.ts` + `create-contact-logic.ts` | exact (pure `-logic.ts`) |
| `src/services/intensity-logic.ts` (NEW, pure) | utility (pure math) | transform / batch | same as gravity-logic | exact (pure `-logic.ts`) |
| `src/screens/ContactProfileScreen.tsx` (EXTEND: timeline/gravity/intensity/rogue/one-tap) | screen | request-response / read | itself (the stub it declares) | exact (replace declared stubs) |
| `src/components/TouchpointRefineForm.tsx` (NEW) | component | request-response / form-I/O | `FrequencyPicker.tsx`+`frequency-picker-logic.ts` split; `TriStateLastSpoke` | role match (form + pure-logic split) |
| `src/components/TimelineRow.tsx` (NEW) | component | render | `ContactProfileScreen.tsx` section/row styling | role match |
| `src/components/GravityBar.tsx` (NEW) | component | render | `ContactProfileScreen.tsx` token-driven View styling | role match |
| `src/components/IntensityLine.tsx` (NEW) | component | render | same | role match |
| DAO/logic tests (`*.test.ts`) | test | — | `crop-geometry.test.ts` (pure) + `recency-dao.test.ts` (node:sqlite) | exact |

**No migration this phase.** `interactions`, `events`, every un-backfillable column and the recency
index all ship in `001-initial.ts` (see Shared Patterns). Confirm and do not add one.

---

## Pattern Assignments

### `src/db/recency-dao.ts` — EXTEND (dao, single-writer CRUD)

**Analog:** itself. This is the immutable write spine — extend in place, never fork a second writer.

**The single-writer recompute to REUSE (never re-implement)** — `recency-dao.ts:145-162`. Note the
filtered-MAX (`rarely_responds = 0 OR i.connected = 1`) is already in the SQL; this is LOG-04:
```
UPDATE contacts
    SET last_contact = (
          SELECT MAX(i.occurred_at) FROM interactions i
           WHERE i.contact_id = contacts.id
             AND (contacts.rarely_responds = 0 OR i.connected = 1)
        ),
        modified_at = ?
  WHERE id = ?
```
Exported as `recomputeLastContactCore` (`:350-353`) for composition inside ONE outer transaction.

**Transaction + WR-04 both-keys + `changes===1` pattern to COPY for `editTouchpointFull`** —
`editTouchpoint` at `:224-257`. New `editTouchpointFull` extends the SET list to every editable
column (`channel, direction, quality, note` in addition to `occurred_at, connected`) and ALWAYS
calls `recomputeLastContactCore` inside the same `inWriteTransaction` (recompute is an idempotent
MAX, so a note-only edit is a cheap no-op — one edit path, no forgotten recompute). Keep the
`WHERE id = ? AND contact_id = ?` scoping and the `if (result.changes !== 1) throw` guard verbatim.

**Insert defaults to be aware of for the one-tap call site** — `insertInteraction` at `:164-200`.
Defaults: `channel ?? 'unspecified'` (`DEFAULT_CHANNEL`, `:126`), `direction ?? null` (`:191`),
`connected ?? 1` (`DEFAULT_CONNECTED`), `source ?? 'manual'` (`DEFAULT_SOURCE`). **Pitfall (LOG/Cluster
G revision):** `direction` defaults to `null`, but one-tap routes MUST write `direction='outbound'`
explicitly or gravity is starved — the in-app one-tap caller passes `{channel:'unspecified',
direction:'outbound', connected:1, quality:null, source:'manual'}` explicitly, NOT the defaults.

**Future-date reject pattern to ADD to `recordTouchpoint`/`editTouchpointFull`** — copy the
pre-transaction `Promise.reject` shape from `createContactWithInteraction` (`:297-306`) and
`updateContactFull` GUARD 2 (see below). Reject BEFORE `inWriteTransaction` opens, via the shared
`log-guards.ts` guard, so no transaction is ever started (LOG-06).

---

### `src/db/status.ts` — EXTEND (dao, query-time transform)

**Analog:** itself. Add `REASON_SQL`; do NOT touch the model, do NOT redefine `ROGUE_K`.

**Constants to REUSE, never re-declare** — `status.ts:40-42`: `STABLE_MAX=0.8`, `WOBBLE_MAX=1.0`,
`ROGUE_K=3`. `ROGUE_K` is the shared rogue threshold that orrery(13)/notify(11)/digest(15) import —
one value, one place. `PROGRESS_SQL` at `:59` (day-granular; do NOT re-run `last_contact` through
`'localtime'` — it is already local, `:44-59`).

**`STATUS_SQL` branch order to MIRROR** — `status.ts:67-73`. The rarely_responds branch is FIRST:
```
CASE
    WHEN rarely_responds = 1 AND (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${ROGUE_K}    THEN 'rogue'
    WHEN (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'decay'
    WHEN (${PROGRESS_SQL}) >= ${STABLE_MAX} THEN 'wobble'
    ELSE 'stable'
  END
```

**New `REASON_SQL` (LOG-05)** — same branch order so status and reason never disagree; NULL when not
rogue. Only code CONSTANTS interpolated (never user input), matching the existing injection posture:
```
CASE
    WHEN rarely_responds = 1 AND (${PROGRESS_SQL}) >= ${WOBBLE_MAX} THEN 'unresponsive'
    WHEN (${PROGRESS_SQL}) >= ${ROGUE_K}                            THEN 'overdue'
    ELSE NULL
  END
```
`'unresponsive'` = "Rarely responds" path; `'overdue'` = beyond-decay time path. (Reason value
NAMING is A4-assumed; the branch order/logic is CITED and firm.)

**Type caveat (Pitfall 5):** do NOT type query-time results as `src/types.ts OrbitStatus`
(`stable|wobble|decay|snoozed`, plugin-legacy, excludes `rogue`) and do NOT call `calculateStatus()`.
Read status from `STATUS_SQL`; define a query-time status type that includes `rogue`.

---

### `src/db/log-guards.ts` — NEW (pure utility, validation)

**Analog:** `contacts-dao.ts:292-300` `updateContactFull` GUARD 2 (VERIFIED on disk):
```typescript
// GUARD 2 (CRUD-02): reject a FUTURE first-interaction occurredAt BEFORE any
// transaction opens. Local wall-clock strings sort chronologically.
if (input.firstInteraction && input.firstInteraction.occurredAt > input.now) {
  return Promise.reject(
    new Error(
      `firstInteraction.occurredAt is in the future (${input.firstInteraction.occurredAt} > ${input.now})`,
    ),
  );
}
```
Extract a pure `rejectFutureOccurredAt(occurredAt, now)` (string `>` compare — local wall-clock
strings sort chronologically) that `recordTouchpoint`/`editTouchpointFull` call in their pre-tx
reject path, and that the refine-form UI can call inline. Pure → node-testable directly, no DB.

---

### `src/db/timeline-read.ts` — NEW (dao, read SQL)

**Analog for read-SQL-const style + tiebreak:** `queries.ts:37-54` (`NEWEST_PER_CONTACT`,
`NEWEST_FOR_CONTACT`). The canonical newest-first order + same-day tiebreak is **`occurred_at DESC,
id DESC`** (decision-without-you #7) — reuse it verbatim:
```
ORDER BY occurred_at DESC, id DESC
```
**Analog for the read-fn signature (pure, `?`-bound, no transaction):** `contact-read.ts`
(`getContactHeader` `:65-94`, header shape + by-id seek). Timeline interleaves `interactions`
(editable) and `events` (read-only) — a UNION ordered `occurred_at DESC, id DESC` (LOG-02).
**Open question the planner must resolve with the owner BEFORE building the events half:** the
`events` table exists but has NO writer and NO `type` vocabulary yet (see `contacts-dao.ts:382-386`
DEFERRAL note) — build the interleaved read correctly regardless, do NOT invent a `type` vocabulary
silently.

---

### `src/services/gravity-logic.ts` & `src/services/intensity-logic.ts` — NEW (pure math)

**Analog:** `src/services/photos/crop-geometry.ts` (pure, react-native-free, node-testable) and
`src/screens/create-contact-logic.ts` (pure builder extracted from a RN screen). The convention:
a `*-logic.ts` that imports NO react-native, exports pure functions over plain inputs, paired with a
`*.test.ts` running under vitest.

**File-header convention to copy** — see `create-contact-logic.ts:1-22`: doc-comment states WHY it
was extracted (the screen imports react-native/native pickers and can't load in node) and what rules
it owns. Mirror it.

**Derived-never-stored (decision #9):** both are pure functions over an array of interaction rows,
computed at read time — never a stored column (a stored score rots; nothing fires on the clock
advancing). Gravity: age-decayed weighted sum toward a FLOOR (never zero) → coarse named tiers (not
a raw number — raw would be gameable like a streak). Intensity: period rate + trailing cadence
average, and **ignores non-connected rows for `rarely_responds` contacts** (decision #8 — same
filter as recency, so the metric never disagrees with the orbit).

**Tunables live at top-of-file (CLAUDE.md single-number-edit rule)** — the half-life, floor weight,
tier boundaries/names (gravity) and period length (intensity) sit at the top of `impact.ts` (or the
respective logic module). Values are A1–A3 ASSUMED / deferred to owner discussion; the SHAPE is
CITED from dossier Cluster G.

---

### `src/services/impact.ts` — NEW (service, tunables + orchestration)

**Analog:** `src/services/launch-sweep.ts` (module-level consts/state at top; service orchestration
role). Holds the tunable constants block and orchestrates the pure logic modules over a DB row read.
Keep tunables as top-of-file `const`s per CLAUDE.md.

---

### `src/screens/ContactProfileScreen.tsx` — EXTEND (screen)

**Analog:** itself. The scaffold at `:162-176` already declares a `contact-profile-timeline-stub`
"Coming in a later phase" — Phase 6 replaces that stub with the real timeline + gravity/intensity +
rogue label, and adds the one-tap "mark contacted" affordance.

**Patterns to copy from the existing file:**
- Data load on focus (not mount): `useFocusEffect(useCallback(...))` `:78-82` — saving via Edit pops
  back to this instance, so an on-mount effect would leave stale data.
- Every colour via `useTheme().colors.*` (`:58`, `:100`, `:109`, `:111`, `:125`, `:144`, `:157`,
  `:167`) — NO hardcoded colour (`npm run check:colors` gate). Rogue label → `colors.danger` /
  `colors.textSecondary`; gravity bar → `colors.accent`/`colors.border` (see theme note below).
- The "Rarely responds" label already renders at `:141-148`
  (`"Rarely responds · attempts don't reset the orbit"`) — reuse; do not duplicate.
- Section-stub styling (`sectionStub`/`sectionHeading`/`sectionBody`, `:214-228`) is the visual
  template the real timeline/gravity/intensity sections mount into.
- `localDateTime()` from `@/db/database` (`:35`, `:89`) is the local-wall-clock `now` the one-tap and
  refine call sites pass to the DAO — NEVER `toISOString()`.

---

### `src/components/TouchpointRefineForm.tsx` — NEW (component, form)

**Analog:** the `FrequencyPicker.tsx` + `frequency-picker-logic.ts` split, and `TriStateLastSpoke`.
Convention: RN component owns controlled state + native pickers; a pure `*-logic.ts` sibling owns the
validation/assembly so it is node-testable. Date+time correction uses
`@react-native-community/datetimepicker@9.1.0` as TWO sequential dialogs (Android has no combined
picker — dossier F7); the carry-state chaining between the date dialog and the time dialog is pure and
belongs in the logic sibling. Refine writes route through `editTouchpointFull`.

---

### Test files — NEW/EXTEND (test)

**Pure-logic test analog:** `src/services/photos/crop-geometry.test.ts:1-40` — `import { describe,
expect, it } from "vitest"`, a fixture builder, direct calls, `expect(...).toEqual<...>()`. Use for
`gravity-logic.test.ts`, `intensity-logic.test.ts`, `log-guards.test.ts`.

**DAO behaviour test analog:** `src/db/recency-dao.test.ts` via `@/db/__testkit__/node-sqlite`
(`nodeSqliteExecutor`, `openTestDb`) — `DatabaseSync` in-memory. Use for `editTouchpointFull`,
future-date reject on record/edit, one-tap defaults, `timeline-read`, and the `status.ts` REASON_SQL
extension.

---

## Shared Patterns

### Single-writer transaction primitive
**Source:** `src/db/transaction.ts:42-57` (`inWriteTransaction`) + `src/db/mutex.ts` (`withMutex`).
**Apply to:** every new/edited write path in `recency-dao.ts`.
- Hand-rolled `BEGIN`/`COMMIT`/best-effort `ROLLBACK` + re-throw of the ORIGINAL error.
- **NEVER** use expo `withTransactionAsync` / `withExclusiveTransactionAsync` (deferred BEGIN captures
  headless writes; masks the original error — dossier F8).
- **NON-REENTRANT** (`transaction.ts:11-29`): never nest `inWriteTransaction`. Compose via `*Core`
  functions (`recomputeLastContactCore`, `insertInteractionCore`) inside ONE outer transaction — a
  nested call is a PERMANENT hang.

### Local wall-clock timestamps
**Source:** `src/db/database.ts:45-50` (`localDateTime()` → `YYYY-MM-DD HH:MM:SS`) and
`src/utils/dates.ts:17-22` (`formatLocalDate()` → `YYYY-MM-DD`).
**Apply to:** every `occurred_at` / `now` the screen or DAO produces.
- NEVER `toISOString().split('T')[0]` (UTC evening off-by-one, already fixed once in the plugin).
- The DAO stores strings verbatim and copies via SQL MAX — no date math (recency-dao.ts:36-50
  contract). Status reads treat `last_contact` as already-local (do not double-`localtime` it).

### Positive-integer + future-date pre-transaction guards
**Source:** `contacts-dao.ts:284-300` (GUARD 1 interval > 0; GUARD 2 future occurred_at) and
`recency-dao.ts:297-306`. **Apply to:** `log-guards.ts` + the record/edit reject paths. Reject via
`Promise.reject(new Error(...))` BEFORE `inWriteTransaction` opens.

### SQL injection posture
**Source:** every DAO/query module. **Apply to:** all new SQL. Every runtime value is `?`-bound; only
code CONSTANTS (`ROGUE_K`, thresholds) are interpolated into SQL fragments (`status.ts`/`queries.ts`).

### Theme tokens (no hardcoded colour)
**Source:** `src/theme/theme-types.ts:29-66` (`ThemePalette` — 11 base tokens + `danger` + avatar
tokens) and `theme-presets.ts:31,38` (`danger: "#E5484D"`, `avatarSwatches: [...]` — the ONLY
colour-literal file). **Apply to:** GravityBar / IntensityLine / TimelineRow / rogue label.
**Note (RESEARCH Open Q4):** the palette has NO status-ring colour tokens (status ring is the Phase-8
card, not the P6 profile). The profile can render with existing tokens — rogue label via
`danger`/`textSecondary`, gravity bar via `accent`/`border`. **Adding new status/gravity-tier colour
tokens is an owner taste decision** (mirror how `danger`/`avatarSwatches` were added in Phase 4 with
an owner-approval note in the doc-comment `:38-46`), not a planner call.

---

## Schema Reference (no migration this phase — READ, don't write)

**Source:** `src/db/migrations/001-initial.ts` (already shipped, irreversible).
- `interactions` (`:96-110`): `id, uid, contact_id, occurred_at, recorded_at, channel DEFAULT
  'unspecified', direction, connected DEFAULT 1, quality, note, source, modified_at`.
- Recency index (`:112-113`): `idx_interactions_recency ON interactions (contact_id, occurred_at
  DESC)` — the seek `timeline-read` / `NEWEST_FOR_CONTACT` ride.
- `events` (`:115-125`): `id, uid, contact_id, type, occurred_at, detail, recorded_at, modified_at`
  — table exists, no writer/vocabulary yet.
- `contacts.rarely_responds` (`:78`) and `last_contact` (`:73`) already present.

---

## No Analog Found

None. Every net-new Phase-6 file maps to a strong on-disk analog. The only genuine gaps are:
- **Tunable VALUES** (gravity half-life/floor/tiers, intensity period) — owner-taste, deferred to
  phase discussion; the math SHAPE is CITED from dossier Cluster G.
- **Events writer/`type` vocabulary** — a decision-vs-code tension (dossier DECIDED events render;
  code DEFERRED the writer). Planner must resolve scope with the owner before building the events
  half of the timeline. Not a missing analog — a missing DECISION.

## Metadata

**Analog search scope:** `src/db/`, `src/services/`, `src/services/photos/`, `src/components/`,
`src/screens/`, `src/theme/`, `src/utils/`.
**Files read on disk (file:line cited):** `recency-dao.ts`, `status.ts`, `queries.ts`,
`transaction.ts`, `migrations/001-initial.ts`, `contacts-dao.ts` (280-395), `contact-read.ts`,
`create-contact-logic.ts`, `crop-geometry.test.ts`, `ContactProfileScreen.tsx`, `theme-types.ts`,
`dates.ts`, `database.ts` (45-50), dossier `04-log.md`, `06-RESEARCH.md`.
**Pattern extraction date:** 2026-08-15
</content>
</invoke>
