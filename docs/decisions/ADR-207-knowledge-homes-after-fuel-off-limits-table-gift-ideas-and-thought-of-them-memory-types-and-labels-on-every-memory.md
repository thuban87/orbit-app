# ADR-207: Knowledge Homes After Fuel — an Off Limits Table, Gift Ideas and Thought of Them Memory Types, and Labels on Every Memory

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-01, D-33, D-34, D-35, D-36, D-43, D-86, D-91, D-25 (38.10-CONTEXT.md; ledger Q-01, Q-02, Q-03a, Q-05, Q-31); carried D-09, D-11, D-15
**Reversibility:** one-way
**Migration:** 033
**Supersedes:** ADR-028 (Per-Item Conversational Fuel with Fixed Kinds); ADR-029 (In-Query Fuel Eligibility and a Shared Ranked Projection); ADR-088 (partial — the `custom` Memory type and labels only on `custom` items die; the additive knowledge schema and app-owned registry survive); ADR-131 (partial — the aggregate's "kind-scoped Off Limits" fuel writes die; the one-transaction, one-bump contact aggregate survives)
**Superseded by:** None

## Context

Conversational fuel was one invisible `fuel` table with five fixed kinds. Only shares and Add Contact's Off Limits box still wrote to it, it fed AI through a ranked projection without per-item consent, and Off Limits rode on the generic fuel editor (Add Contact even saved Off Limits as AI-eligible topic fuel, NEW-1). The owner asked to "rip fuel out of the app root and stem" (39-LEDGER Batch 10) and to give each kept kind its own home and Profile section.

## Decision

We will remove fuel entirely: no table, writer, reader or wording survives, enforced by `src/no-fuel-contract.test.ts` (D-01). Storage is hybrid (D-36):
- **Off Limits** gets its own `off_limits` table (`label`, `text`, `url`, share and Group-Note-copy markers) with **no AI permission column**, so its AI exclusion holds by structure (D-09). Every write stays scoped by `(id, contact_id)` with validated ids (D-11).
- **Gift Ideas** and **Thought of Them** (new, D-43) are app-defined memory types `gift_idea` and `thought_of_them` in `memories`, each its own Profile section; registry entries carry display names and `searchable: true` (D-34, D-91).
- **Last Talked About** (`current_state_entries`) and **Key People** (`relationships`) keep their tables.
- **Recent, Topic and Fact** are dropped as kinds with no sections: attributes belong in custom fields, one-off person-specific things in Memories (D-33).
- The **`custom` memory type is removed**; every memory gets an optional label (D-86).
- **Imported from Contacts App** leaves the user type picker; only the Contacts import writes it, and the editor keeps an entry's registered type and provenance on save (D-35, D-25 — fixes G-01, NEW-6). Types stay app-owned (D-15).

## Alternatives Considered

- **Everything in `memories`, with Off Limits a type forced AI-off** — rejected: the Off Limits guarantee would depend on a type check, which ADR-110/ADR-136 reject as inferred permission (Q-01).
- **A separate table per section** — rejected: about +3–4 plans for the same Profile result and duplicated lifecycle, privacy and UX plumbing (Q-01, counted ~25 memories wiring sites).
- **Keep Recent, Topic and Fact as sections** — rejected by the owner: Recent is covered by Last Talked About, Topic is nebulous, Fact is a custom field or a Memory (Q-02).
- **Keep a renamed `custom` type** — not chosen; the owner picked "remove the type, label on every memory" (Q-31 option a).
- **Keep Imported pickable** — rejected; it is tied to import provenance (ADR-091) (Q-05).

## Consequences

### Positive

- Off Limits cannot reach AI by any query, because there is no column to flip.
- Gift Ideas and Thought of Them share memories' delete, move, AI-permission, search and editor plumbing.

### Negative

- Rows left by earlier defects are not repaired (D-60): imported notes flipped to `general` and Off Limits saved as topic stay as they are.
- `src/no-fuel-contract.test.ts` keeps an exact-file allowlist (shipped migrations, 033, the legacy mapping and v7 converter) that must be maintained.

### Risks

- A future reader that joins Off Limits into a memory-shaped AI read would bypass the structural guarantee; Off Limits must stay out of every AI read by construction.

## Implementation

**Key files:**
- `src/db/off-limits-dao.ts` — scoped add, edit, delete and Undo cores for the `off_limits` table.
- `src/db/off-limits-read.ts` — `listOffLimitsForContact`, the owner-facing read.
- `src/db/memory-registry.ts` — `gift_idea` and `thought_of_them` types, `userPickable`, no `custom`.
- `src/db/memories-dao.ts` — labels on every type; `ImportedTypeProvenanceError`; registered type kept on save.
- `src/components/MemoryEditor.tsx` — label field for every type, type picker without Imported.
- `src/db/contacts-dao.ts` — Create/Edit Contact aggregates write `off_limits`, not fuel.
- `src/no-fuel-contract.test.ts` — the permanent no-fuel gate.
- `src/db/fuel-dao.ts` — deleted.
- `src/db/fuel-read.ts` — deleted.
- `src/services/fuel-ranking.ts` — deleted.
- `src/services/fuel-age.ts` — deleted.
- `src/services/fuel-kind-label.ts` — deleted.
- `src/components/RankedFuelLine.tsx` — deleted.
- `src/components/FuelEditor.tsx` — deleted.

**Depends on:** ADR-088 (Additive Contact-Knowledge Schema and Application-Owned Memory Registry); ADR-107 (Off Limits Excluded from All AI Egress)
**Required by:** None
