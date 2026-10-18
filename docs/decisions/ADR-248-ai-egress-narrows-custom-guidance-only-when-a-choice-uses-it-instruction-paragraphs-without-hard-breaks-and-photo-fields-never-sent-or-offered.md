# ADR-248: AI Egress Narrows — Custom Guidance Only When a Choice Uses It, Instruction Paragraphs Without Hard Breaks, and Photo Fields Never Sent or Offered

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-127, D-128, D-129 (AI and Research half), D-138 (38.12-CONTEXT.md; ledger Q-28, Q-29, Q-30, mid-execution ruling Q1); carried D-27
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-050 (partial — opt-in custom-field sharing dies for photo-type fields only: a photo field can never be marked Allow AI or sent; the closed allowlist and opt-in sharing for every other field type survive)
**Superseded by:** None

## Context

Every AI request sent the custom Writing Style guidance text, or "None available", even when no style choice used custom guidance. Orbit's own instruction paragraphs carried hard line breaks, so the byte-exact preview read as broken lines (ADR-079: the preview never drifts from what is sent). Text left in a photo-type custom field, or a stored photo path, appeared in Compose Research. If the field allowed AI, it was sent to the provider. CLAUDE.md makes any change to what the AI feature sends the owner's call.

## Decision

The custom guidance line is sent only while at least one Writing Style choice (tone, length or directness) uses custom guidance; otherwise no guidance line is sent (D-127). Unsent guidance is not read into the prompt at all, so an over-long guidance text no longer produces a truncation notice when no choice is custom. The guidance box shows only while a choice uses custom, and stored text is kept.

Orbit's built-in instruction paragraphs (`STATIC_INSTRUCTION`, `DEFAULT_STYLE_NOTE` and similar) lose their hard line breaks inside paragraphs. They are written source-wrapped through `instructionParagraph(...lines)` and sent as one line per paragraph. Paragraph breaks and DATA blocks are unchanged (D-128). This is a whitespace-only change to what is sent. The preview stays byte-identical to the payload.

Photo-type custom fields are never AI data (D-129). They are left out at every read that feeds the payload or Message Focus: `readSharedFields` drops photo definitions before any value is queried, and `readPopulatedCustomFields` excludes them in SQL with a type re-check in Compose Research. The Profile still shows them. Photo fields have no Allow AI control anywhere: the AI Permissions list leaves them out and the field form has no switch for them (D-138). `share_with_ai` is clamped to 0 for a photo field on create, on update, on a type change to photo and on backup restore.

Data still goes only to the user's own provider, on explicit invoke (D-27).

## Alternatives Considered

- **Keep sending the guidance**, or **clear it when unused** — rejected for send-only-when-used, keeping the text (Q-28 B, C).
- **Leave the line breaks**, or **wrap only the preview** — rejected; a preview-only wrap would drift from the bytes sent (Q-29 B, C).
- **Leave photo fields in Research and AI** — rejected (Q-30 B).

## Consequences

### Positive

- Every change sends less, never more.
- The preview reads as prose and is still exactly what is sent.

### Negative

- A user who stored text in a photo field can no longer share it with AI; it must move to a text field.

### Risks

- A new read that feeds the AI payload must apply the same photo-type exclusion.

## Implementation

**Key files:**
- `src/ai/prompt-template.ts` — the guidance gate, `instructionParagraph`, unwrapped instruction constants.
- `src/db/ai-context-read.ts` — `readSharedFields` drops photo definitions.
- `src/db/profile-knowledge-read.ts` — `readPopulatedCustomFields` excludes photo fields.
- `src/db/compose-research-read.ts` — the type re-check in Research.
- `src/db/ai-permissions-dao.ts` — photo fields left out of AI permissions.
- `src/db/field-defs-dao.ts` — the Allow AI clamp on update.
- `src/db/field-type-change.ts` — a type change to photo turns Allow AI off.
- `src/db/field-ddl.ts` — the Allow AI clamp on create.
- `src/backup/restore-apply.ts` — the clamp on restore.
- `src/components/FieldDefForm.tsx` — no Allow AI switch for a photo field.
- `src/screens/settings-ai-logic.test.ts` — preview byte-identical to the payload.

**Depends on:** ADR-050 (Closed AI Prompt Egress Allowlist and Opt-In Field Sharing); ADR-079 (On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation); ADR-136 (Permission-Bounded Prompt Assembly and AI Transparency); ADR-137 (Structured Personalization and Explicit Context Capacity)
**Required by:** ADR-249 (AI Settings Tell the Truth — a Connected Lane Shows Connected, the Hub Shows Current Values, and One "Style and Context" Row Replaces Two)
