# ADR-110: Coherent Local Profile Snapshot and Source-Owned Knowledge Projection

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 31-profile-experience
**Source decisions:** dossier `phase-10-profile-experience-dossier.md` §§A, V–AI, AO; 31-CONTEXT.md D-08, D-11, D-12; 31-04, 31-06, and 31-10 summaries
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Profile combines identity, methods, relationship facts, knowledge, presentation, and recent history owned by separate subsystems. Independent component reads can mix database revisions, duplicate filtering rules, and make a read-focused screen accidentally acquire write or network authority.

## Decision

Profile loads one renderer-neutral aggregate inside a single local SQLite read snapshot. Existing readers accept the narrowed read executor where necessary, while write cores retain their transaction-capable executor. The aggregate keeps Memories, relationships, current state, custom fields and history, imported notes, methods, and legacy fuel as typed source projections rather than flattening them into one generic record.

Profile-only adapters shape compact presentation and source-owner action targets. They do not duplicate writers, ranking rules, or AI eligibility. Off Limits uses a narrow owner-facing read that leaves ranked, search, and AI exclusions unchanged and never invents a permission field. Interaction history is capped to the latest few entries behind its replaceable semantic renderer. No Profile read performs network work.

## Alternatives Considered

- **Let each section query independently** — Rejected because sections could represent different committed revisions and duplicate loading/error behavior.
- **Flatten every remembered fact into generic Memory text** — Rejected because typed ownership, history, formatting, and mutation semantics would be lost.
- **Reuse ranked fuel as the owner-facing Off Limits source** — Rejected because ranked projections deliberately exclude negative constraints.
- **Infer AI permission from visibility, kind, source, or location** — Rejected because none is an explicit durable permission.
- **Build an unbounded final history read** — Rejected because Phase 32 owns the complete History experience.

## Consequences

### Positive

- A rendered Profile is coherent at one SQLite revision and remains fully offline.
- Each subsystem retains its data model, writer, and permission semantics.
- Phase 32 can replace History rendering without changing layout persistence.

### Negative

- Reader signatures must distinguish read-only snapshot composition from transaction-composed writers.
- Optional section failures require explicit classification inside the aggregate rather than broad empty fallbacks.

### Risks

- Catching schema or invariant failures as empty content can hide corruption.
- A new component-owned query can reintroduce mixed revisions and bypass source filtering.
- An owner-facing Off Limits projection reused for AI would violate the local-only boundary.

## Implementation

**Key files:**
- `src/db/profile-read.ts` — composes one coherent renderer-neutral Profile snapshot.
- `src/db/profile-knowledge-read.ts` — projects typed knowledge and narrow owner-facing Off Limits content.
- `src/db/profile-history-read.ts` — returns the bounded interim interaction history.
- `src/db/contact-methods-read.ts` — supplies normalized display and action capability inside the shared snapshot.
- `src/db/memories-read.ts` — supplies typed Memory visibility and explicit AI eligibility without conflation.
- `src/db/relationships-read.ts` — supplies linked and unlinked relationship facts.
- `src/db/value-history-dao.ts` — exposes retained custom-field history through a read-only-compatible export while preserving writer executors.
- `src/db/impact-read.ts` — supplies derived relationship inputs inside the same snapshot.
- `src/profile/knowledge-presentation.ts` — shapes compact, capped, hidden-aware source projections.
- `src/components/profile/ThingsToRemember.tsx` — renders source-owned knowledge and management targets.

**Depends on:** ADR-088 (Additive Contact-Knowledge Schema and Application-Owned Memory Registry); ADR-090 (Additive Custom-Field Value History and Deferred Contact Scope)
**Required by:** None
