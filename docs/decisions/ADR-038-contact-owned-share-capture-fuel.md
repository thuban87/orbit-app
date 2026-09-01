# ADR-038: Contact-Owned Share Capture Fuel

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 10-share-sheet-capture
**Source decisions:** dossier `10-capture` Clusters 1–3; `10-CONTEXT.md` binding and owner-confirmed decisions
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Shared text and links must become useful, durable conversational fuel without corrupting the contact-status signal or losing the link inside editable prose. The existing fuel schema already supplies a non-null contact owner, separate URL, provenance, and composable writer cores; capture must preserve those boundaries instead of creating a new inbox or touchpoint path.

## Decision

The system writes share capture immediately as contact-owned `topic` fuel with `source='share'`: the canonical first URL stays in `fuel.url`, while editable display text uses the best title or prose and may be recomposed as `note — base`. Capture is never a touchpoint; multi-attach creates one atomic independent row per contact, and inline creation remains name-only and never-contacted.

## Alternatives Considered

- **A capture inbox with nullable `contact_id`** — rejected because every fuel query and purge path expects an owner, while inline creation already covers a new person.
- **Raw text or a single editable field for every share** — rejected because prose-with-URL shares would lose the canonical link needed for later link handling.
- **Marking a contact as contacted on capture** — rejected because sharing or reading is not interaction and would corrupt status and recency.
- **Always-multi-select or dropping multi-attach** — rejected because the common case must remain one tap while every selected contact needs its own fuel row.
- **A system contact picker** — rejected because backgrounding Orbit can discard the pending payload.

## Consequences

### Positive

- Capture preserves source provenance, canonical URLs, status integrity, and existing fuel purge semantics.
- The picker can include never-contacted people, and inline creation immediately gives a share a durable owner.

### Negative

- A user must choose or create a contact during capture; unassigned captured material is intentionally unsupported.
- Multi-attach and note application require composed transaction cores rather than generic screen-side writes.

### Risks

- The shared payload is third-party text, so it must remain bound data and never be opened during capture.
- A blank display value is excluded by the ranked projection; the resolver normalizes it to `NULL` at the write boundary.

## Implementation

**Key files:**
- `src/logic/capture-logic.ts` — resolves canonical URL, display text, and optional note composition without I/O.
- `src/db/capture-read.ts` — lists non-archived contacts as favourites, capture-MRU, then the remaining names.
- `src/db/capture-dao.ts` — atomically fans out fuel inserts and multi-row text-only note patches.
- `src/db/fuel-dao.ts` — supplies the bound fuel writer cores and single-row wrappers used by capture.
- `src/screens/CaptureScreen.tsx` — writes on contact selection, supports multi-select and inline name-only creation, and never writes recency.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-028 (Per-Item Conversational Fuel with Fixed Kinds)
**Required by:** None
