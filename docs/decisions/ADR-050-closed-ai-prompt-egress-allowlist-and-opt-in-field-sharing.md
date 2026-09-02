# ADR-050: Closed AI Prompt Egress Allowlist and Opt-In Field Sharing

**Status:** Accepted
**Date:** 2026-08-18
**Phase:** 14-ai-message-suggestions
**Source decisions:** dossier `13-ai.md` cluster B; 14-CONTEXT.md `<decisions>`; 14-03/04 summaries
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-078 (partial — Off Limits and permitted interaction notes)

## Context

An AI request sends contact-derived material to a selected third party. Existing broad contact and interaction readers cannot provide an auditable disclosure boundary, and custom fields need an explicit user-controlled opt-in.

## Decision

The system constructs every AI request from one closed `PromptContext` allowlist and one immutable, bounded resolved prompt. It includes ranked eligible fuel, derived interaction aggregates, and only live custom-field values whose definition has `share_with_ai=1`; it never selects interaction or event prose, off-limits fuel, unconfirmed AI fuel, or unapproved fields.

## Alternatives Considered

- **A broad contact or editor read** — rejected because it can silently widen outbound data.
- **All custom fields** — rejected because arbitrary user fields require explicit consent before egress.
- **No custom fields** — rejected because opted-in facts can meaningfully improve a suggestion.

## Consequences

### Positive

- The same frozen prompt bytes drive inspection, acknowledgement, and provider payloads.

### Negative

- Unknown, quarantined, dropped, blank, or unapproved values resolve to less context rather than a fallback query.

### Risks

- Contact-derived values are untrusted; the resolver treats them as delimited data and bounds them to resist prompt injection.

## Implementation

**Key files:**
- `src/db/ai-context-read.ts` — owns the narrow AI-context projection.
- `src/ai/prompt-types.ts` — defines the closed outbound `PromptContext` contract.
- `src/ai/prompt-template.ts` — produces the immutable, bounded prompt and inspection payload.
- `src/db/field-defs-dao.ts` — persists the definition-level sharing flag.
- `src/components/FieldDefForm.tsx` — exposes the default-off sharing control.

**Depends on:** ADR-013 (Runtime Two-Table Custom Fields with Whitelist-Constructed DDL)
**Required by:** None
