# ADR-214: AI Permission for the New Knowledge Homes, and Compose Research After Fuel

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-03, D-27, D-29, D-31, D-57, D-61, D-87, D-92, D-105, D-111, D-124, D-125, D-126, D-142 (38.10-CONTEXT.md; ledger Q-09, Q-30, Q-45; plan-phase A1; plan-check C5, cycle 2 Q3; execute-phase M1–M3); carried D-09, D-13, D-14
**Reversibility:** reversible
**Migration:** 033
**Supersedes:** ADR-050 (partial — "ranked eligible fuel" in the closed `PromptContext` dies; the closed allowlist and opt-in custom-field sharing survive); ADR-036 (partial — Compose rendering rows from the ranked-fuel read dies; the self-fetching route and Home-directed Back survive)
**Superseded by:** None

## Context

Fuel reached AI through a ranked projection with no per-item consent (a "Conversational fuel" prompt block), while memories already had an explicit `allow_ai` flag (ADR-081, ADR-136). The new homes (ADR-207) and linked notes (ADR-211) needed one permission story, and Compose Research's "Avoid" group, value formatting and grouping had audit findings (J-09, J-10, J-X01).

## Decision

We will remove the prompt's fuel block and the ranked reader, so AI egress only narrows (D-31). Memory-type sections are SQL-gated by `MEMORY_AI_ELIGIBILITY`: `allow_ai = 1`, live, not a Group Note copy, and if note-linked, only while the interaction allows AI and is not locked. Off Limits, Last Talked About and Current Location never reach AI (D-09). A share always starts with Allow AI off whatever the default; entries typed into Gift Ideas or Thought of Them follow their own default (D-03, D-57). Settings → AI gains "new items default to Allow AI" rows for Gift Ideas and Thought of Them, starting off on upgrade and fresh installs, travelling in the backup settings snapshot (D-61, D-92). Allow AI is part of the editor draft and saves with Save (D-27). Message Focus sends a memory's main text only, never its note (D-124); with Hide from Profile switched off, a previously hidden memory with Allow AI on is Message Focus eligible like any other (D-142). Compose Research groups by section with a first-seen map, uses the shared formatters, renames "Avoid" to "Off Limits" (the Profile helper "Avoid bringing these up" stays), shows an unlabeled Off Limits item's text once, reads "Every 30 days" and "Nothing to remember yet" (D-29, D-87, D-105, D-111, D-125, D-126).

## Alternatives Considered

- **Shares follow the memory default** — rejected (Q-09); precedent ADR-091/ADR-161 for imports.
- **New defaults copy the Memories default** — rejected (A1, "Start off").
- **Defaults for Last Talked About, Current Location or Off Limits** — rejected: they never reach AI, so a default would widen egress (Q-45).
- **Retire "Avoid" app-wide; new fallback wording for unlabeled Off Limits** — rejected (C5, cycle 2 Q3).

ADR-081 is amended, not superseded: migration 017's move stands as history, but new shares now land in their section AI-off. ADR-107/ADR-134 keep their rules; only the "Avoid" heading wording changed. ADR-136's "defaults apply only at creation" still holds; the share path is forced off like imports.

## Consequences

### Positive

- Every AI-reaching row carries an explicit, reviewable switch; nothing from the old fuel store reaches AI.

### Negative

- Users lose the implicit fuel context in prompts until they switch individual items on.

### Risks

- D-142 slightly widens what Message Focus can send (a few previously hidden test items; no shipped users).

## Implementation

**Key files:**
- `src/db/memories-read.ts` — `MEMORY_AI_ELIGIBILITY` and the derived note lock.
- `src/db/ai-context-read.ts` — no ranked list; the gated note projection.
- `src/ai/prompt-template.ts` — the fuel block removed.
- `src/ai/prompt-types.ts` — `PromptContext` without the ranked list.
- `src/ai/message-focus.ts` — main text only (D-124).
- `src/db/ai-permissions-dao.ts` — per-type defaults, lock clamps, partner sync.
- `src/db/app-settings-dao.ts` — the two new default settings.
- `src/screens/AIPermissionsScreen.tsx` — the two new default rows.
- `src/db/compose-research-read.ts` — section grouping, Off Limits heading, eligibility.
- `src/screens/ComposeResearchScreen.tsx` — research display and empty state.
- `src/screens/compose-research-logic.ts` — first-seen grouping and display values.
- `src/screens/ComposeScreen.tsx` — no ranked-fuel rows; prompt-item count for the failure diagnostic.

**Depends on:** ADR-207 (Knowledge Homes After Fuel); ADR-136 (Permission-Bounded Prompt Assembly and AI Transparency); ADR-134 (Read-Only Compose Research and Permission-Bounded Message Focus)
**Required by:** None
