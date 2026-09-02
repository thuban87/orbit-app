---
phase: 10-share-sheet-capture
plan: 03
subsystem: capture
tags: [sqlite, dao, node-sqlite, fuel, capture-mru, atomic-fan-out, no-touchpoint]

# Dependency graph
requires:
  - phase: 07-fuel
    provides: "fuel-dao addFuelCore/editFuelCore (non-mutexed cores) + inWriteTransaction non-reentrant mutex — the multi-attach/multi-note composition primitives"
  - phase: 01-schema
    provides: "migration 1 fuel table (uid/contact_id/kind/created_at/source columns) + contacts.favourite_rank/archived_at/last_contact — no new migration this plan"
provides:
  - "listCapturePickContacts() + CapturePickRow — the favourites → capture-MRU → rest picker read (archived-excluded, never-contacted-included, no new column)"
  - "captureMultiAttach() — N addFuelCore in ONE transaction returning ordered { id, contactId }[] (A1)"
  - "captureMultiNote() — atomic editFuelCore×N note apply, patch-scoped text only (B1)"
affects: [10-04, 10-05, 10-06, capture-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capture-MRU via a derived LEFT JOIN (SELECT contact_id, MAX(created_at) FROM fuel GROUP BY contact_id) — an existing-column read, never a stored/indexed rank (no migration)"
    - "Compose-the-core, wrap-once fan-out: N non-mutexed *Core calls inside ONE inWriteTransaction, accumulating results inside the transaction — never nesting the non-reentrant mutex"

key-files:
  created:
    - src/db/capture-read.ts
    - src/db/capture-read.test.ts
    - src/db/capture-dao.ts
    - src/db/capture-dao.test.ts
  modified: []

key-decisions:
  - "Picker scope is `archived_at IS NULL` ONLY — deliberately NOT dashboard-read's BASE_WHERE (which carries last_contact IS NOT NULL and would hide never-contacted people). Capture is the fast path for stashing a link onto someone never logged, so never-contacted MUST appear (CAP-01)."
  - "captureMultiAttach accumulates each addFuelCore lastInsertRowId INSIDE the one transaction and returns { id, contactId }[] in input order (A1) — 10-05/10-06 locate the just-written rows by id + contact_id (there is no uid-based fuel lookup)."
  - "The atomic multi-note apply lives in the DAO (captureMultiNote), not inline in the 10-06 .tsx (B1) — per CLAUDE.md 'queries go through DAOs, never inline in components'. The N=1 note path stays on the standalone editFuel wrapper."
  - "Capture path imports ONLY addFuelCore/editFuelCore — NO recency/interaction writer, NO last_contact write, NO interaction row (DATA-04 single-writer invariant; the LinkListener 'mention ⇒ contacted' hazard stays closed)."

patterns-established:
  - "MRU-derived ordering: `(favourite_rank IS NULL), favourite_rank ASC, (last_captured IS NULL), last_captured DESC, name COLLATE NOCASE ASC` — a deterministic three-band sort with a stable name tiebreak."

requirements-completed: [CAP-01, CAP-02, CAP-04]

coverage:
  - id: R1
    description: "Picker orders favourites → capture-MRU → rest, INCLUDES never-contacted, EXCLUDES archived; MRU derived from fuel.created_at with no new column; name COLLATE NOCASE tiebreak."
    requirement: "CAP-01"
    verification:
      - kind: unit
        ref: "src/db/capture-read.test.ts#listCapturePickContacts — favourites → capture-MRU → rest"
        status: pass
    human_judgment: false
  - id: R2
    description: "captureMultiAttach writes N atomic fuel rows (own uid, topic/share) in ONE transaction and returns the ordered { id, contactId }[] mapping to the persisted rows (A1); a mid-loop throw rolls back all N."
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/db/capture-dao.test.ts#captureMultiAttach — N atomic fuel rows, ordered ids returned (A1)"
        status: pass
    human_judgment: false
  - id: R3
    description: "captureMultiNote applies one composed note to N rows in ONE transaction (editFuelCore×N, patch-scoped text only) — url/created_at untouched, modified_at bumped; a mid-loop bad (id, contactId) pair rolls back all N (B1)."
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/db/capture-dao.test.ts#captureMultiNote — atomic note apply to N rows (B1)"
        status: pass
    human_judgment: false
  - id: R4
    description: "Capture is not a touchpoint — after a capture onto a never-contacted contact, last_contact stays NULL and the interactions table has zero rows; capture-dao imports no recency/interaction writer."
    requirement: "CAP-04"
    verification:
      - kind: unit
        ref: "src/db/capture-dao.test.ts#captureMultiAttach — capture is NOT a touchpoint (CAP-04)"
        status: pass
    human_judgment: false

# Metrics
duration: ~12min
completed: 2026-08-16
status: complete
---

# Phase 10 Plan 03: Capture Read + Write DAOs Summary

**Two node-tested DB modules — `capture-read.ts` (the favourites → capture-MRU → rest picker query, archived-excluded and never-contacted-included, MRU derived from existing `fuel.created_at` with no new column) and `capture-dao.ts` (`captureMultiAttach` fanning N `addFuelCore` inserts into one transaction and returning the ordered `{ id, contactId }[]`, plus `captureMultiNote` applying a composed note to N rows atomically) — with capture provably never a touchpoint: `last_contact` stays NULL and no interaction row is written.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-16T09:21Z
- **Completed:** 2026-08-16T09:24Z
- **Tasks:** 2 completed (TDD RED → GREEN each)
- **Files:** 4 created

## Accomplishments
- `listCapturePickContacts()` returns `CapturePickRow[]` from a single async `getAllAsync` (no transaction, no mutex — RESEARCH Q4 confirms this `contacts`/`fuel` read is safe concurrent with the launch sweep). Order is favourites (rank present) → capture-MRU DESC (via a derived `LEFT JOIN MAX(fuel.created_at)`) → the rest, stable by `name COLLATE NOCASE`. `WHERE c.archived_at IS NULL` ONLY — never-contacted included, archived excluded, no BASE_WHERE, no new column/migration/index.
- `captureMultiAttach(exec, rows)` composes `addFuelCore` N times inside ONE `inWriteTransaction`, accumulating each row's `lastInsertRowId` + `contactId` INSIDE the transaction and returning them in input order (A1). A mid-loop failure (e.g. a bad `contactId` → FK violation) rolls back all N (0 rows persist).
- `captureMultiNote(exec, rows, text, now)` composes the patch-scoped `editFuelCore` N times inside ONE `inWriteTransaction` — sets only `text` + `modified_at`, leaving `url`/`created_at` untouched, keyed by BOTH `id` AND `contactId` (B1). A mid-loop mismatched pair changes 0 rows → throws → rolls back all N (no partially-noted set).
- No-touchpoint invariant node-proven: capture onto a never-contacted contact leaves `last_contact` NULL and writes zero interaction rows; `capture-dao.ts` imports only `addFuelCore`/`editFuelCore` — no recency/interaction writer (DATA-04 single-writer intact).
- 12 new node tests green; full suite 707/707 green; `npx tsc --noEmit` clean; biome clean; `npm run check:colors` clean.

## Task Commits

Each task committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing capture-read picker ordering test** — `71a84cf` (test)
2. **Task 1 (GREEN): listCapturePickContacts + CapturePickRow** — `327e1ae` (feat)
3. **Task 2 (RED): failing fan-out + note + no-touchpoint tests** — `b58f3c0` (test)
4. **Task 2 (GREEN): captureMultiAttach + captureMultiNote** — `0302597` (feat)

## Files Created/Modified
- `src/db/capture-read.ts` (71 lines) — `CapturePickRow` interface + `listCapturePickContacts()`. Read-only single `getAllAsync`, `archived_at IS NULL` only, derived-MRU LEFT JOIN, no migration.
- `src/db/capture-read.test.ts` (150 lines) — 6 Vitest cases: favourites-first, MRU-DESC + name tiebreak, never-contacted included, archived excluded, full row shape, never-captured `last_captured` NULL.
- `src/db/capture-dao.ts` (85 lines) — `captureMultiAttach()` (ordered `{ id, contactId }[]`, A1) + `captureMultiNote()` (patch-scoped `editFuelCore`×N, B1). Imports only the fuel cores + `inWriteTransaction`.
- `src/db/capture-dao.test.ts` (209 lines) — 6 Vitest cases: N-rows-one-transaction + returned-id mapping, mid-loop rollback, N=1, no-touchpoint (last_contact NULL + zero interactions), multi-note apply (url untouched), multi-note mid-loop rollback.

## Decisions Made
- **Picker scope `archived_at IS NULL` only.** Reusing dashboard-read's BASE_WHERE would inherit `last_contact IS NOT NULL` and silently drop never-contacted people — exactly whom the capture fast path exists to serve. Enforced per the plan's D-CAP picker-scope decision; a dedicated test asserts a never-contacted row appears.
- **Return ids from inside the transaction (A1).** `addFuelCore` returns `lastInsertRowId`; these are accumulated into the results array before COMMIT (never re-queried after) so 10-05/10-06 can `editFuel`/`editFuelCore` the exact rows by `id + contact_id` — there is no uid-based fuel lookup anywhere in the codebase.
- **The atomic multi-note apply lives in the DAO (B1), not the 10-06 `.tsx`.** Per CLAUDE.md "queries go through DAOs, never inline in components." `captureMultiNote` is the N>1 apply; the single-row note path stays on the standalone `editFuel` wrapper as the plan directs.

## Deviations from Plan
None — plan executed exactly as written. No Rule 1–4 deviations. (Biome applied a safe import-ordering fixup to the two test files after authoring; folded into the Task-2 GREEN commit.)

## Threat Mitigations (from plan threat_model)
- **T-10-01 (Tampering/info-disclosure at the fuel INSERT):** every value reaches SQLite `?`-bound through `addFuelCore`/`editFuelCore` (fuel has fixed columns — no identifier interpolation). captureMultiAttach/Note add no new SQL string; they compose the existing `?`-bound cores.
- **T-10-06 (status corruption):** the no-touchpoint test proves the capture path writes no `last_contact` and no interaction row; `capture-dao.ts` imports no recency writer, so the DATA-04 single-writer invariant and the status engine stay uncorrupted by sharing habits.

## User Setup Required
None — pure data-layer modules, fully node-tested, no external services or device UAT.

## Scope Boundary (deferred to later plans, per plan)
- The picker read is safe only in tandem with 10-04's migration-`ready` gate (F-CAP-10 cold-start ordering) — 10-04 owns the navigation half.
- Inline-create-then-capture is the CONSUMER's job (10-06 composes existing `createContactFull` name-only + `addFuel`) — no fused create+fuel core added here (two transactions acceptable, RESEARCH Q5).
- The single-tap (N=1) capture uses the standalone `addFuel` wrapper; the N=1 note uses `editFuel` — this plan adds only the N>1 atomic fan-outs.

## Self-Check: PASSED
- FOUND: src/db/capture-read.ts
- FOUND: src/db/capture-read.test.ts
- FOUND: src/db/capture-dao.ts
- FOUND: src/db/capture-dao.test.ts
- FOUND commit: 71a84cf (test Task 1 RED)
- FOUND commit: 327e1ae (feat Task 1 GREEN)
- FOUND commit: b58f3c0 (test Task 2 RED)
- FOUND commit: 0302597 (feat Task 2 GREEN)
- Verification: `npx vitest run src/db/capture-read.test.ts src/db/capture-dao.test.ts` → 12/12 pass; full suite 707/707; `npx tsc --noEmit` clean; biome clean; `npm run check:colors` clean.
