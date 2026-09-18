# ADR-125: Three-Field Live Inheritance with Separate Local-Only Group Notes

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 33-group-interaction-logging
**Source decisions:** dossier §§G–H, L, W; amendment E-05; 33-CONTEXT D-04
**Reversibility:** one-way
**Migration:** 026
**Supersedes:** None
**Superseded by:** None

## Context

Participants share encounter details but need independent refinements. Shared social prose concerns multiple people and must not become a participant-owned AI-eligible note.

## Decision

The system uses live Follow event state for exactly Channel, Tone (quality), and Duration, while materializing resolved values on ordinary child rows. Explicit overrides remain detached even if equal to the parent; clearing an override restores live inheritance. Direction, Connected, and participant note remain directly child-owned. Event date/time fans out to every child and cannot be overridden. Group Note is stored once on the parent, displayed distinctly, never copied into participant notes, and never transmitted to AI under any child permission. Atomic participant Save composes one full-edit core with membership-scoped follow-flag changes and preserves the child Allow-AI value.

## Alternatives Considered

- **One-time copies of shared defaults** — rejected because later event edits must reach followers.
- **Infer follow state from value equality** — rejected because an explicit equal-valued override must stay detached.
- **Direction/Connected inheritance** — excluded by the owner-approved schema; only three shared fields have follow flags.
- **Concatenate or duplicate Group Note into child notes** — rejected because ownership, edits, detachment, and AI permission differ.
- **Allow-AI control for Group Note** — rejected by the absolute owner egress ban; child consent cannot authorize shared text.

## Consequences

### Positive

- Existing reads see resolved values while authoring retains independent overrides and shared context.

### Negative

- Each shared-field edit needs selective fan-out, and inheritance state must travel with resolved values.

### Risks

- Value and follow-flag changes cannot commit separately; note exposure must stay within local presentation, with no AI-context join to the parent.

## Implementation

**Key files:**
- `src/logic/group-inheritance.ts` — pure follow-versus-override resolution.
- `src/db/group-events-dao.ts` — atomic selective fan-out and composite participant Save.
- `src/db/migrations/026-group-events-schema.ts` — exactly three durable follow columns.
- `src/components/group/ParticipantOverrideEditor.tsx` — restricted child fields and explicit Follow event affordances.
- `src/db/history-read.ts` — distinct local Group Note projection.
- `src/db/ai-context-read.ts` — closed AI context projection without Group Event access.

**Depends on:** ADR-124 (Group Event Parents with Canonical Per-Contact Children); ADR-078 (Negative-Constraint Off Limits and Gated Recent-Interaction AI Context); ADR-117 (Per-Interaction Allow-AI Consent Gate)
**Required by:** None
