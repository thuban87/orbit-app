# Phase 7 — Dashboard Card/Grid View
## Group Interaction Logging Amendment Brief + Paste-Ready Session Prompt

## Why this brief exists
Phase 7 originally allowed multi-contact Quick Log but explicitly rejected detailed bulk interaction logging.

That decision has now been superseded by a newly inserted and fully interrogated **Phase 12 — Group Interaction Logging**.

The Dashboard still does not own detailed logging form logic. It now routes into a shared canonical Group Log workflow.

## Required Phase 7 amendment

### Superseded decision
Old Phase 7 direction:
- `Bulk Log Interaction with a detailed form is not offered.`

This is no longer authoritative.

### New settled behavior
**Quick Log remains a distinct multi-select action.** It keeps its immediate/current-time semantics.

**Detailed Log Interaction is now also available in Grid multi-select.**
- **1 selected** → canonical individual detailed Log Interaction
- **2+ selected** → canonical Group Log with selected contacts preloaded as participants

### Ownership boundary
Phase 7 owns exposing the action from Grid multi-select, routing based on selected-contact count, and preserving selection-mode UX.

Phase 7 does **not** own Group Event persistence, Group Event fields, shared/default inheritance, participant override editing, participant lifecycle, Group Event Detail/Edit, Group Event browse page, or Group Event backup behavior.

### Dashboard discovery amendment
Phase 12 also decided Group Events receives:
- a prominent **Dashboard header icon + label entry**,
- a redundant Dashboard overflow entry.

Exact header composition belongs to the Dashboard shell/control surface rather than the Card renderer, but Phase 7 should not conflict with it.

## Paste-ready prompt for the Phase 7 session

We need to amend the completed Phase 7 Dashboard Card/Grid View dossier because a later planning correction supersedes one of its decisions.

A new **Phase 12 — Group Interaction Logging** subsystem has now been fully interrogated.

Please update Phase 7 with the following authoritative changes:

1. Supersede the old decision that detailed bulk Log Interaction is not offered.

2. **Quick Log remains a separate Grid multi-select action** with its existing immediate/current-time semantics.

3. Add detailed **Log Interaction** routing from Grid multi-select:
   - 1 selected contact → canonical individual detailed Log Interaction
   - 2+ selected contacts → canonical Phase 12 Group Log, preloaded with selected contacts

4. Grid/Card View owns only the selection-mode action and routing. Do not add Group Event form/domain logic to Phase 7.

5. Phase 12 owns Group Event persistence, title/date/shared defaults, Tone, Group Note, participant overrides, participant add/remove/detach/delete, Group Event Detail/Edit, browse/management, atomicity, and backup.

6. Group Events also now have a prominent Dashboard header icon+label entry plus Dashboard overflow entry. This is mainly a Dashboard Control Surface amendment, but Phase 7 should remain compatible with it.

Please revise the Phase 7 dossier in-place with a short amendment/supersession section rather than rewriting unrelated settled Grid decisions. Preserve the rest of the dossier.
