# ADR-091: Imported Contact Notes as AI-Off Typed Memories

**Status:** Accepted
**Date:** 2026-09-03
**Phase:** 24.2-contact-knowledge-egress-search-types
**Source decisions:** milestone-2 dossier `phase-03-contact-knowledge-foundation` §P; 24.2 CONTEXT D-08; Plan 06 owner resolution
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

An Android contact's freeform Note is user-authored relationship information that must survive a selected-contact import. It is neither generic provider metadata nor safe for implicit AI disclosure, and accepted picker payloads must remain durable after their temporary provider grant expires.

## Decision

The system reads Android Note MIME data and carries the first non-blank note through the accepted import-session payload. Every new-contact import path writes the raw text as an `imported`, import-provenance Memory whose registry default and stored `allow_ai` value are off; re-importing onto an already-linked contact deliberately does not append a note.

## Alternatives Considered

- **Discard freeform provider notes** — rejected because it loses imported contact knowledge.
- **Classify or enable imported notes for AI automatically** — rejected because imported information remains AI-off unless the user explicitly opts in.
- **Append notes during every already-linked re-import** — rejected because repeated imports could duplicate or backfill content onto an existing contact.

## Consequences

### Positive

- Import preserves the raw note through bulk, single-review, and consolidated-cluster creation paths.
- The Memory registry keeps imported notes searchable while the SQL egress gate fails closed.

### Negative

- The native picker bridge, durable JSON payload allowlist, and each import creator must stay in sync.

### Risks

- TypeScript cannot compile the Android Note MIME implementation; a desktop Gradle build and Pixel import test remain the native verification boundary.

## Implementation

**Key files:**
- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` — reads Note MIME rows across selected-contact acquisition paths.
- `modules/orbit-contact-picker/index.ts` — exposes the optional `PickedContact.note` bridge contract.
- `src/services/import/import-acquire.ts` — persists note text in the durable accepted-session payload and threads it through single import.
- `src/services/import/import-driver.ts` — maps session notes into bulk new-contact imports.
- `src/services/import/source-consolidation.ts` — selects the first non-blank note for a consolidated new contact.
- `src/db/imported-contact-dao.ts` — writes an imported, AI-off Memory in the contact-create transaction.
- `src/db/memory-registry.ts` — defines the searchable, default-AI-off imported Memory type.

**Depends on:** ADR-081 (Retire AI-Proposed Fuel for Explicit Per-Item Permission); ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos)
**Required by:** _None._
