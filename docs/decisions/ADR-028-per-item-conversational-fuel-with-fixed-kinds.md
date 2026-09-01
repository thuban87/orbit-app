# ADR-028: Per-Item Conversational Fuel with Fixed Kinds

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 07-conversational-fuel
**Source decisions:** dossier `03-fuel` Clusters A and C
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Conversational notes need individual provenance, age, privacy treatment, and a link without a parser over a contact-level text blob. A custom field cannot safely support notification, AI, importer, and glanceable-read requirements, while the existing migration-1 table was intentionally shipped empty for this phase to activate.

## Decision

The system uses one `fuel` row per item, with fixed `recent`, `topic`, `fact`, `gift`, and `off_limits` kinds plus optional label, text, and separately stored URL. Fuel facts are sayable conversational hooks; sortable or filterable one-value data remains a custom field.

## Alternatives Considered

- **One text blob per contact** — rejected because rows could not be ranked, filtered, or withheld without fragile parsing.
- **A custom `textarea` field** — rejected because notifications, prompts, and import need a fixed, independently queryable structure.
- **User-named buckets or no grouping** — rejected because closed kinds make disclosure and ranking testable while labels preserve optional grouping.
- **Images or a URL embedded in text** — rejected because image capture is out of scope and an embedded URL forecloses structured link handling.

## Consequences

### Positive

- Profile editing can add, patch-edit, and delete durable individual rows with a stable creation time.
- Each item can be classified, ranked, searched, and later routed without parsing user prose.

### Negative

- The user curates multiple rows and the kind vocabulary is application-owned rather than freely named.

### Risks

- Row updates must stay scoped by both fuel id and contact id; a full stale-row update can overwrite another field edit.

## Implementation

**Key files:**
- `src/db/migrations/001-initial.ts` — defines the durable nine-column `fuel` table activated by this phase.
- `src/db/fuel-dao.ts` — owns bound, mutexed fuel writes and patch-scoped edits.
- `src/db/fuel-read.ts` — supplies the editor's complete per-contact fuel list.
- `src/components/FuelEditor.tsx` — edits the fixed kinds and optional label, text, and URL.
- `src/screens/ContactProfileScreen.tsx` — mounts the conversational-fuel editor on a contact profile.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract); ADR-013 (Runtime Two-Table Custom Fields with Whitelist-Constructed DDL)
**Required by:** ADR-029 (In-Query Fuel Eligibility and a Shared Ranked Projection); ADR-030 (Explicit Confirmation of AI-Proposed Fuel); ADR-038 (Contact-Owned Share Capture Fuel)
