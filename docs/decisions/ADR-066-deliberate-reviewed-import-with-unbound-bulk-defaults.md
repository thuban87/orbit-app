# ADR-066: Deliberate Reviewed Import with Unbound Bulk Defaults

**Status:** Accepted
**Date:** 2026-08-26
**Phase:** 19-system-contact-import
**Source decisions:** dossier `19-system-contact-import` clusters D–E, L, N–Q; 19-CONTEXT.md; 19-03, 19-04, 19-06, and 19-08 summaries
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

System Contacts is a deliberate source for selected relationships, not an address-book ingestion authority. A single selected record needs full relationship configuration before it becomes an Orbit contact, while a bulk flow must remain usable at larger volumes without silently importing unsafe or ambiguous data.

## Decision

The system requires a detailed review before single-contact creation or linking. Bulk import accepts the picker selection with shared Unbound and Uncategorized defaults, permits only a batch category override, processes records incrementally through per-record atomic writes, and reports imported, already-linked, needs-review, and failed/skipped outcomes with a bridge to Unbound contacts.

## Alternatives Considered

- **Write a single pick immediately** — Rejected because the user must configure relationship-specific lifecycle, category, methods, birthday, and photo before creation.
- **Render per-person bulk controls after picker selection** — Rejected because that duplicates selection work and becomes unusable at scale.
- **Use one batch-wide transaction** — Rejected because safe records must survive isolated import failures.

## Consequences

### Positive

- Intentional review and Unbound defaults avoid turning imported people into unsolicited active cadence obligations.
- A determinate, durable completion report tells the user exactly what happened.

### Negative

- Bulk configuration is intentionally less granular than single-review configuration.

### Risks

- Import writers must share the canonical contact-create and validation seams so imported records do not bypass lifecycle, method, or birthday invariants.

## Implementation

**Key files:**
- `src/db/contacts-dao.ts` — exposes the composed contact-create core shared by normal and imported creation.
- `src/db/imported-contact-dao.ts` — atomically creates or links a contact while resolving its import row.
- `src/services/import/import-acquire.ts` — accepts snapshots and routes single versus bulk import.
- `src/services/import/import-driver.ts` — performs incremental per-row bulk classification and import.
- `src/screens/ImportReviewScreen.tsx` — provides the single-contact review before a write.
- `src/screens/BulkImportSetupScreen.tsx` — persists shared bulk defaults and category override.
- `src/screens/ImportCompleteScreen.tsx` — renders durable outcome counts and next actions.

**Depends on:** ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance); ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-065 (Durable Resumable Contact-Import Sessions with Failure-Isolated Photos)
**Required by:** ADR-067 (Conservative Advisory Identity Matching and Explicit Source Consolidation).
