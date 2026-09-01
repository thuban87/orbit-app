# ADR-059: Normalized Contact Methods, Canonical Actionability, and Local Provenance

**Status:** Accepted
**Date:** 2026-08-27
**Phase:** 18.1-contact-method-normalization
**Source decisions:** dossier `18-contact-data-normalization` clusters A–E, O, and P; 18.1-01 through 18.1-03 summaries
**Reversibility:** one-way
**Migration:** 009, 010
**Supersedes:** ADR-008 (partial)
**Superseded by:** None

## Context

The scalar `contacts.phone` and `contacts.email` columns could not represent ordered, labelled, independently mergeable endpoints or source provenance. They also mixed human presentation with matching and actionability, while the contacts rebuild had to retain every existing relationship and foreign-key child.

## Decision

The system uses UID-bearing `contact_methods`, external-link, and provenance rows as the sole phone/email authority. It preserves nonblank invalid values as non-actionable, records canonical E.164 phones with their canonicalization region, uses conservative email equality, and keeps external identity as stale-tolerant local evidence rather than Orbit identity.

## Alternatives Considered

- **JSON arrays or retained scalar endpoint columns** — Rejected because independent UIDs, ordering, provenance, tombstones, and one authoritative write path require child rows.
- **Custom phone canonicalization** — Rejected because regional prefixes, extensions, and validity semantics are unsafe to recreate.
- **Reject malformed values or make canonical values globally unique** — Rejected because useful relationship data must be retained and a shared endpoint is evidence, not identity proof.

## Consequences

### Positive

- Create, edit, migration, and later import paths share one normalization and actionability boundary.
- The v9 rebuild preserves relationship data while leaving future explicit canonical re-derivation possible.

### Negative

- Method writes, reads, backup, and endpoint consumers must use the child model rather than scalar compatibility fields.

### Risks

- A one-shot device-region migration can canonicalize a number under a wrong region; `canonical_region` records that provenance without auto-rewriting identity.

## Implementation

**Key files:**
- `src/db/migrations/009-contact-method-normalization.ts` — rebuilds the contacts graph and creates normalized method, link, and provenance rows.
- `src/db/migrations/010-contact-method-label.ts` — adds nullable durable method labels without rewriting migration 009.
- `src/logic/contact-method-normalization.ts` — owns phone/email canonicalization and actionability outcomes.
- `src/db/contact-methods-dao.ts` — applies transactional ordered method diffs and primary promotion.
- `src/db/contact-methods-read.ts` — returns ordered groups and actionable effective primaries.
- `src/db/contacts-dao.ts` — composes method drafts into atomic contact creates and edits.
- `src/db/contact-read.ts` — retires scalar method projections from contact reads.
- `src/db/app-settings-dao.ts` — persists and validates the post-migration phone-region override.
- `src/services/device-region.ts` — supplies the device region to every possible first-open migration path.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract); ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** ADR-061 (DAO-Selected Actionable Primary SMS Handoff); ADR-064 (Permissionless Android 17 System-Contact Snapshot Acquisition); ADR-066 (Deliberate Reviewed Import with Unbound Bulk Defaults); ADR-067 (Conservative Advisory Identity Matching and Explicit Source Consolidation)
