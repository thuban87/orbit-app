---
phase: 04-contact-crud-lifecycle
plan: 02
subsystem: data-layer / contacts DAO
tags: [crud, dao, atomicity, single-writer, tdd]
status: complete
requires:
  - "src/db/transaction.ts (inWriteTransaction — the one shared non-reentrant mutex)"
  - "src/db/recency-dao.ts (recompute + insertInteraction cores)"
  - "src/db/field-values-dao.ts (upsertValue core)"
  - "src/db/migrations/001-initial.ts (contacts / interactions / contact_custom_values / categories schema)"
provides:
  - "createContactFull — atomic contact + first interaction + custom values in ONE transaction (CRUD-01/02)"
  - "isDuplicateName / listCategories / getContactHeader — the shared reads the create/edit forms + Profile scaffold call (Plans 03/04)"
  - "recomputeLastContactCore / insertInteractionCore / upsertValueCore — non-mutexed composition primitives for future multi-op DAOs"
affects:
  - "Plans 03/04 (create-form UI wires createContactFull + isDuplicateName + listCategories)"
  - "Plan 04 Profile scaffold (getContactHeader)"
tech-stack:
  added: []
  patterns:
    - "core/wrapper split — extract a non-mutexed transaction-body core, compose inside ONE outer inWriteTransaction (never nest the non-reentrant mutex; RESEARCH Pattern 2 / Pitfall 1)"
    - "pre-transaction reject-guards (return Promise.reject before any BEGIN) for interval>0 and future-date"
    - "always-mint per-contact values-row uid resolved non-null before the write loop"
key-files:
  created:
    - "src/db/contacts-dao.ts"
    - "src/db/contacts-dao.test.ts"
    - "src/db/contact-read.ts"
    - "src/db/contact-read.test.ts"
  modified:
    - "src/db/recency-dao.ts (alias core exports + non-reentrancy warning)"
    - "src/db/field-values-dao.ts (extract upsertValueCore; upsertValue re-wraps it)"
decisions:
  - "createContactFull enters the shared non-reentrant mutex EXACTLY once and calls only the *Core variants — never the wrapped createContactWithInteraction / upsertValue (each opens its own inWriteTransaction → nesting = permanent hang)."
  - "phone is in the create INSERT (CRUD-01 fix); email/social_battery/birthday stay edit-only by design."
  - "Future firstInteraction.occurredAt rejected at the DAO chokepoint (CRUD-02) via a lexical > on local wall-clock strings — defence-in-depth behind the UI."
  - "Cores alias-exported (not renamed) so the four internal recency callers stay untouched."
metrics:
  duration_min: 3
  completed: 2026-08-15
  tasks: 3
  files_created: 4
  files_modified: 2
---

# Phase 4 Plan 02: Composed Atomic-Create DAO + Shared Reads Summary

`createContactFull` atomically writes a contact + (for the Today/Pick-date path) its first interaction through the single-writer recompute + any `show_on_new` custom values in ONE `inWriteTransaction`, composing the non-mutexed cores extracted from the recency and field-values DAOs — never nesting the non-reentrant mutex; plus `isDuplicateName` (COLLATE NOCASE) / `listCategories` / `getContactHeader` to back the create/edit forms.

## What was built

- **`src/db/contacts-dao.ts` — `createContactFull(exec, input)`**: one `inWriteTransaction` that INSERTs the contacts row (lean CRUD-01 set incl. `phone`), then — when `firstInteraction` is present — `insertInteractionCore` + `recomputeLastContactCore` (single-writer `last_contact`), then writes each custom value via `upsertValueCore` under ONE per-contact values-row uid (`input.rowUid ?? newUid()`, resolved non-null before the loop). Two pre-transaction reject-guards: interval must be a positive integer (WR-02); a future `occurredAt` is rejected before any BEGIN (CRUD-02). A throw anywhere rolls the whole composition back.
- **`src/db/contact-read.ts`**: `isDuplicateName` (`name = ? COLLATE NOCASE AND archived_at IS NULL AND id != ?`, `excludeId ?? -1`), `listCategories` (seeded categories in `display_order`), `getContactHeader` (by-id light seek, intentionally NOT archived-filtered — documented).
- **`src/db/recency-dao.ts`**: alias exports `recomputeLastContactCore` / `insertInteractionCore` (internal callers untouched) + a non-reentrancy warning on `recomputeLastContact`'s doc.
- **`src/db/field-values-dao.ts`**: extracted `upsertValueCore` (the UPSERT minus its mutex wrapper); `upsertValue` re-implemented to wrap the core — its existing suite stays green.

## Tests

TDD across three commits — RED (`test(04-02)` a8961b5) then GREEN (`feat(04-02)` a9bc6e9, 44e36d8):

- `contacts-dao.test.ts` (7 cases + parametrized): Today compose (source='manual', direction=null, last_contact=occurred_at), phone round-trip + NULL, not-yet path, **Pitfall-1 no-hang custom values** (both values under one uid), interval guard (0/-1/1.5), **future-date rejection** + equal-to-now boundary, and the **mid-composition ROLLBACK** (custom-value column that does not exist → INSERT throws after the contact+interaction inserts → 0 rows in all three tables; a two-transaction impl would fail this).
- `contact-read.test.ts` (9 cases): duplicate / case-insensitive / archived-excluded / self-exclusion / no-match; category order; header fields + archived-loadable + missing-id null.
- The RED gate is the real `! npx vitest run …` (not `|| true`): verified it exits 0 only because the suites run and fail on the missing modules.

## Verification

- `npm test`: **251 passed (23 files)** — new suites green, recency + field-values suites unregressed.
- `npx tsc --noEmit`: clean (strict TS — `upsertValueCore`'s non-null string uid contract holds).
- `npm run check:colors`: clean (no colour surface in this data-layer plan).

## Invariants upheld

- Non-reentrant mutex entered exactly once; only `*Core` variants called inside (T-04-03).
- `last_contact` written solely via `recomputeLastContactCore` (DATA-04 single-writer).
- First interaction `source='manual'`, `direction=null` — never outbound (T-04-04).
- Every runtime value `?`-bound; the only interpolated identifier is a custom `col_name`, guarded inside `upsertValueCore` (T-04-02) — no new interpolation site.
- No `toISOString`; the DAO performs no date math (local wall-clock strings passed verbatim; DATA-05).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- Files: FOUND src/db/contacts-dao.ts, contacts-dao.test.ts, contact-read.ts, contact-read.test.ts
- Commits: FOUND a8961b5 (test), a9bc6e9 (feat), 44e36d8 (feat)
