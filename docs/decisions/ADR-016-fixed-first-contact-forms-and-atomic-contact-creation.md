# ADR-016: Fixed-First Contact Forms and Atomic Contact Creation

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 04-contact-crud-lifecycle
**Source decisions:** dossier `06-crud` Cluster A and exported data constraints; 04-CONTEXT Areas 2–3
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Creating a contact must be quick without starving the decay-to-SMS loop of the phone and recency data it needs. The mobile form spans fixed contact columns and custom-value rows, while `last_contact` remains a derived summary with one allowed writer.

## Decision

The system uses a lean, fixed-first create form followed by eligible custom fields, and creates all submitted contact, optional first-interaction, and custom-value records in one transaction. A normal create defaults last-spoke to today; “Not yet” creates no interaction and leaves the contact genuinely never-contacted.

## Alternatives Considered

- **Minimal create form without phone** — Rejected because it leaves the notify loop without the reach data users will otherwise forget to add.
- **Rich create form** — Rejected because asking for every fixed detail up front conflicts with the low-friction create goal.
- **Interleave fixed and custom fields** — Rejected because it couples unrelated display ordering and obscures the two distinct data sources.
- **Inline custom-field creation** — Rejected because routine contact save would gain a second untrusted DDL producer.

## Consequences

### Positive

- Contact creation remains concise while preserving one atomic and recoverable write boundary.
- The first interaction follows the single-writer recency invariant with `source='manual'` and no invented direction.

### Negative

- Form submission composes non-mutexed cores and must never nest the shared write transaction.

### Risks

- A partial composition or a future `occurred_at` could misrepresent recency; pre-transaction validation and rollback tests guard both paths.

## Implementation

**Key files:**
- `src/db/contacts-dao.ts` — composes the contact, first interaction, and custom-value writes in one transaction.
- `src/db/recency-dao.ts` — supplies the non-mutexed interaction and recency cores.
- `src/db/field-values-dao.ts` — supplies the transaction-composable custom-value UPSERT core.
- `src/screens/CreateContactScreen.tsx` — renders the fixed-first create flow and last-spoke choices.
- `src/components/FrequencyPicker.tsx` — maps presets and a validated custom interval to `interval_days`.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-013 (Runtime Two-Table Custom Fields with Whitelist-Constructed DDL).
**Required by:** None.
