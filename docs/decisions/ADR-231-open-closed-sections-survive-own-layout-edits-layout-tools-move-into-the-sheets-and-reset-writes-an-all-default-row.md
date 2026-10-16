# ADR-231: Open/Closed Sections Survive Own-Layout Edits, Layout Tools Move into the Sheets, and Reset Writes an All-Default Row

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-60, D-83, D-65, D-90, D-89, D-29 (38.11-CONTEXT.md; ledger Q-11, Q-12, Q-26, convergence cycle 1 O-2; phase code review WR-02/IN-02 and the 38.11-13 deferred item); device-pass decision L4
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-108 (partial — "Reset deletes only contact presentation overrides" now means writing an all-default contact presentation row stamped now, not deleting it; Reset stays presentation-only, the axes stay independent, and switching layouts still clears collapse overrides); ADR-217 (partial — any `profile_contact_presentation` row blocking share Undo dies: an all-default row no longer blocks; every other row, and the rest of the guard, survive)
**Superseded by:** None

## Context

Saving any change to a person's own layout cleared every section they had opened or closed by hand. The layout editor's open/closed toggle read like an action, and it nested a virtualized list inside a scroll view. Save as template and Reset sat in the crowded ⋯, and Reset showed whenever any section was folded. The phase code review also found that deleting the presentation row on Reset let a merge restore of an older backup bring the old layout back.

## Decision

Saving a person's own layout keeps their open/closed choices, except for the sections whose "Open by default" changed in that save (D-60, D-83). The editor passes those ids (`changedDefaultExpandedIds`) to `setContactFreeformLayout` as `clearCollapseFor`. Switching to a template still clears all of them (ADR-108). The editor's control is a labelled "Open by default" switch, a setting rather than an action. Its nested reorderable lists have their own scrolling turned off, which removes the warning, and Save stays reachable in a fixed footer (D-29).

"Save as template" is a button in Profile Layout. "Reset to default" is a button in Profile Layout, behind a confirm, that clears the layout and open/closed state and keeps the background. It is also a button in Background, where it acts at once with Undo. Neither stays in ⋯ (D-65). Editing a template's layout from the Templates sheet opens the editor directly, so the contact-specific first page never shows for a template (D-89). The Templates Assign page says "{name} currently uses {layout}." from live props (L4).

Reset writes an all-default contact presentation row stamped now (`resetContactLayoutPresentation`, `resetProfilePresentation`), so its newer `modified_at` wins a merge restore's last-writer-wins (D-90). Share Undo's ownership rule for `profile_contact_presentation` is `blocks-unless-default`: an all-default row (no layout, no freeform layout, no background, collapse `{}`) does not block removing a share-created contact. A tombstone was not used, because presentation has no tombstone entity and adding one would change the backup format.

## Alternatives Considered

- **Keep choices except for moved or hidden sections, or no change** — rejected for keeping them (Q-11).
- **Keep all own choices even when a default changes** — refined to clearing only the changed ones (D-83).
- **Cut Reset, or move only Save as template** — rejected for moving both into the sheets (Q-26).
- **Delete the row on Reset, or add a presentation tombstone** — rejected; resurrection on merge restore, or a backup-format change (D-90).

## Consequences

### Positive

- Hand-set open/closed state is durable; Reset survives a merge restore.

### Negative

- A Reset leaves a row behind; readers and share Undo treat the all-default row as nothing.

### Risks

- Any new presentation column must be added to the all-default test, or share Undo will start blocking on a reset row.
- After "Save template" the page stays on an empty create form (F-07, pre-existing, routed to 38.12).

## Implementation

**Key files:**
- `src/profile/layout-editor-reducer.ts` — `changedDefaultExpandedIds`.
- `src/db/profile-presentation-dao.ts` — `setContactFreeformLayout` `clearCollapseFor`, `resetContactLayoutPresentation`, `resetProfilePresentation`.
- `src/components/profile/ProfileLayoutEditor.tsx` — the Open by default switch, Save as template, Reset, `startInEditor`, nested lists without their own scrolling.
- `src/components/profile/ProfileTemplateManager.tsx` — opens the editor directly for a template.
- `src/profile/template-manager-model.ts` — `describeCurrentLayout`.
- `src/components/profile/ProfileBackgroundManager.tsx` — the background Reset with Undo.
- `src/profile/background-manager-model.ts` — `resetContactBackground`.
- `src/db/capture-dao.ts` — share Undo's `blocks-unless-default` ownership rule.
- `src/screens/ContactProfileScreen.tsx` — wires Save as template and the resets.

**Depends on:** ADR-108 (Durable Independent-Axis Profile Presentation and Inheritance); ADR-217 (Share Undo Also Removes a Contact the Share Created — a Narrow Exception to Archive-Before-Purge); ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors)
**Required by:** None
