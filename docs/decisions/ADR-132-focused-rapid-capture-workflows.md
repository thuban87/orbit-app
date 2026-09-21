# ADR-132: Focused Rapid Capture Workflows

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 34-rapid-capture-update-flows
**Source decisions:** dossier `phase-13-rapid-capture-update-flows` §§A–B, H–I, M–W, X–AA, AC–AI; 34-CONTEXT D-04, D-06–D-08, D-11
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-082 (partial — the visible “Log Contact” action name and its placeholder workflow)
**Superseded by:** None

## Context

Orbit needs distinct low-friction paths for an immediate interaction, a detailed ordinary interaction, and a compact relationship-information update without rebuilding Group Event semantics or overloading the complete Edit Contact form. These paths must preserve the recency spine, the migrated interaction vocabulary, default-off interaction-note consent, and typed History backfill routing.

## Decision

The visible action and canonical detailed form are named **Log Interaction**. Quick Log remains an immediate current-time write with truthful Undo and can subsequently save exactly one Interaction Note or basic Memory. Detailed Log Interaction uses Message, Call, or In Person with contextual Direction/Connected defaults, optional unset Tone, default-off Allow AI beside Note, and Duration behind More Options. Update Contact is a registry-driven, preselectable chooser of focused editors that returns to the same targeted chooser after each successful save until Done; it exposes applicable named custom fields and a generic Custom Fields path, never Category. These ordinary single-contact flows do not create a second Group Log form.

## Alternatives Considered

- **Merge Quick Log, detailed logging, Update Contact, and Edit Contact into one form** — rejected because their different capture intents would make the everyday path heavy.
- **Collect a Quick Log note before the interaction writes** — rejected because Quick Log must remain an immediate current-time action.
- **Create a second multi-contact detailed form** — rejected because Group Event semantics remain owned by canonical Group Log.

## Consequences

### Positive

- Every entry point reaches one local, typed workflow while preserving a quick path and complete-edit boundary.

### Negative

- Shared controls need additive, scoped configuration so legacy interaction editing and Group Log remain representable.

### Risks

- A default-on Allow AI value or a Group Note routed through the toggle would widen AI egress; interaction consent stays default off and Group Notes remain ineligible.

## Implementation

**Key files:**
- `src/screens/LogInteractionScreen.tsx` — composes the detailed ordinary interaction workflow and typed prefill route.
- `src/screens/log-interaction-logic.ts` — resolves channel defaults, input shaping, and post-save remembered-channel eligibility.
- `src/services/quick-log-command.ts` — preserves immediate Quick Log and binds its Add Note action to the committed interaction.
- `src/components/PostLogNoteEditor.tsx` — saves either an interaction note or a basic Memory after Quick Log.
- `src/screens/UpdateContactScreen.tsx` — provides the focused repeated-update chooser and editors.
- `src/screens/MemoryScreen.tsx` — provides full Memory creation and in-place editing from Update Contact.
- `src/components/TouchpointRefineForm.tsx` — scopes ordinary channel choices, More Options, and Allow-AI caption without changing other consumers.
- `src/components/universal-fab-logic.ts` — supplies the final visible “Log Interaction” action label.

**Depends on:** ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log); ADR-116 (Value-Remapped Interaction Vocabulary and Optional Descriptive Duration); ADR-117 (Per-Interaction Allow-AI Consent Gate, Default-Off and Fail-Closed on Restore); ADR-123 (Profile History Section Replacing the Vertical Timeline, with Detailed-Log Backfill Routing)
**Required by:** _None._
