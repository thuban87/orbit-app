# Group Interaction Logging — Cross-Phase Amendment Prompts

This document contains paste-ready prompts for reopening the completed **Phase 1 — App Shell & Navigation** and **Phase 11 — Interaction History & Insights** planning sessions.

# Phase 1 — App Shell & Navigation Amendment

## Paste-ready Phase 1 prompt

We need a targeted amendment to the completed Phase 1 — App Shell & Navigation dossier based on a newer, fully settled Phase 12 — Group Interaction Logging subsystem.

Please preserve all existing Phase 1 shell decisions except where explicitly superseded below.

### Required amendments

1. Universal FAB action set expands from five actions to six:
   - Add Contact
   - Quick Log
   - Log Contact / canonical individual detailed logging action
   - **Group Log**
   - Update Contact
   - Memory / remembered-information action

2. **Group Log is a distinct first-class FAB action**, not hidden behind Log Contact.

3. Group Log uses a dedicated semantic internal route and remains independently routable/deep-link-ready under the same future-widget/dispatcher principles as other capture workflows.

4. Group Log opens directly into its canonical focused workflow. Participant selection is handled inside that workflow; the shell does not require a pre-picker.

5. The Dashboard now has a first-class **Group Events** destination exposed as an icon+label entry in the Dashboard header, plus a redundant Dashboard overflow entry. It remains Dashboard-owned for this milestone rather than receiving a new permanent bottom-nav destination.

6. Do **not** convert the Dashboard bottom-nav tab into a radial/menu launcher in this milestone.

7. Do **not** pull Group Event form/domain behavior into Phase 1. Phase 12 owns Group Event persistence, shared/default inheritance, participant overrides, Group Event Detail/Edit, lifecycle, browsing, and backup.

### Deferred shell ideas to note, not implement
- future Mission Control / real Dashboard concept,
- possible rename of current Dashboard contact browser,
- future bottom-nav restructuring,
- possible radial/menu launcher,
- possible future dedicated Group Events bottom-nav destination.

Please add a concise amendment/supersession section to the Phase 1 dossier and keep the rest of its shell contract intact.

# Phase 11 — Interaction History & Insights Amendment

## Paste-ready Phase 11 prompt

We need a targeted amendment to the completed Phase 11 — Interaction History & Insights dossier based on the newly settled Phase 12 — Group Interaction Logging subsystem.

Please preserve Phase 11's existing History/Heatmap/Intensity/Interaction contracts except where extended below.

### Core model to consume
- Group Event is a parent authoring/history-context record.
- Every participant still has one ordinary canonical child Interaction.
- The Group Event parent is **not** an extra interaction and must never double-count History, Heatmap, Intensity, Last Interaction, Status, Gravity, etc.
- One Group Event can validly have zero participants.

### Required Interaction Detail amendments
1. If an Interaction belongs to a Group Event, Interaction Detail should expose meaningful Group Event context.
2. Use a restrained **Group event** badge/label where appropriate.
3. Interaction Detail may show Group Event title, shared **Group Note**, the participant's ordinary note separately, and a `View Group Event` route/action.
4. Group Note and participant note remain distinct; do not concatenate them into one stored/editable note.

### Required edit-routing amendment
When Edit is invoked on a group-linked Interaction, ask which scope the user intends:
- **Edit individual interaction**
- **Edit Group Event**

Individual scope routes to the participant override editor and exposes only participant-overridable fields.

Group scope routes to canonical Edit Group Event.

Do not create a hybrid editor where scope is implicit.

### Required deletion amendment
Deleting a group-linked child Interaction:
- permanently deletes that Interaction using existing Phase 11 hard-delete semantics,
- removes only that participant from the Group Event,
- does not delete other participant Interactions,
- may leave the Group Event with zero participants.

No Group-specific Interaction trash is added.

### History / Heatmap contract
A Group Event appears in one contact's history exactly once through that contact's child Interaction.

The parent Group Event does not become a second history row, does not affect Heatmap counts, does not affect Intensity counts, and does not independently affect Last Interaction.

Group Event affiliation is contextual metadata on the child Interaction.

### Date/time
Group Event date/time is shared and non-overridable. Editing the event date/time updates all linked child Interaction timestamps, and Phase 11's normal derived consumers refresh accordingly.

### Conversion seam
Ordinary Interaction Detail overflow may expose:
`Add participants / Make this a group interaction`

This routes into Phase 12 conversion while preserving the original Interaction identity/UID.

Please add a concise amendment/supersession section to the Phase 11 dossier and avoid redesigning unrelated History surfaces.
