# Orbit Milestone 2 — Group Interaction Logging Planning Brief

**Status:** provisional planning correction discovered after Phase 7 and while Phase 12 Rapid Capture interrogation was underway.

## Why this exists
A real-world use case exposed a missing workflow: after attending an event with several Orbit contacts, logging essentially the same shared encounter separately into each contact profile is too much friction. The prior Phase 7 decision allowed multi-contact Quick Log but explicitly rejected detailed bulk interaction logging. That decision is now reopened.

The feature has grown beyond a Dashboard-only action. It appears to require a dedicated subsystem spanning persistence/domain modeling, shared interaction logic, detailed logging UX, history/edit semantics, routing, and multiple entry points. The current planning direction is to insert a new **Phase 12 — Group Interaction Logging** and shift the existing **Rapid Capture & Update Flows** work to **Phase 13**, with later provisional phases moving back accordingly.

## Working domain direction
Do **not** replace Orbit's existing one-contact-per-interaction model.

Preferred architecture is a hybrid:

- A new **Group Interaction Event** parent represents the shared real-world encounter.
- Each participating contact still receives an ordinary canonical per-contact Interaction row.
- Child Interaction rows optionally reference the Group Event.
- Existing single-contact interactions remain unchanged and have no Group Event reference.

Conceptually:

```text
Group Interaction Event
"Jamie's birthday party"
Aug 29, 2026 · 8:00 PM
In Person
shared/default details
        │
        ├── Interaction → Sarah
        │      participant-specific quality/duration/note/etc.
        ├── Interaction → Mike
        │      participant-specific quality/duration/note/etc.
        └── Interaction → Jordan
               participant-specific quality/duration/note/etc.
```

This preserves existing contact-centric History, recency, Status, Gravity, Intensity, Heatmap, backup, and other derived consumers because every participant still has a normal Interaction row. The Group Event acts as an authoring/editing relationship among those rows rather than replacing them.

## Product direction already agreed in principle
- Each selected participant independently counts as contacted.
- Canonical interaction channels are currently **Message, Call, In Person**; group logging reuses these rather than inventing a `Group` channel.
- Group logging should support a shared/default layer plus robust participant-specific overrides.
- Shared/general notes plus optional per-contact notes are desirable.
- Quality/impact should support a group default with per-contact overrides.
- Duration should support a general/default value plus per-person override capability; participant-specific detail editing should be robust.
- Main Group Log form should list participants with an **Edit details** affordance that opens a contact-specific sheet/surface for overrides.
- Users should be able to add/remove participants from the Group Log flow.
- Group logging must be a canonical reusable workflow with multiple entry points, not a Dashboard-specific form fork.
- Dashboard Grid multi-select should expose `Log Interaction`; one selected contact routes to normal individual logging, multiple selected contacts route to Group Log.
- A universal-FAB entry for group logging (exact label/shape still to interrogate) is desired.
- A central Group Event tracking/browsing/management surface is desired in principle.
- Editing later should support both shared-event edits and participant-specific edits; exact semantics still need interrogation.

## Important unresolved questions for the new phase
The new Group Interaction Logging phase should interrogate at least:

1. Group Event naming/title behavior and whether titles are optional/derived.
2. Exact persisted fields on the Group Event versus child Interaction rows.
3. Which values are truly shared, which are defaults copied to children, and which can be overridden per participant.
4. Participant-specific `Edit details` UX and supported fields.
5. Adding/removing participants before and after initial save.
6. Shared edit vs participant-only edit semantics.
7. Group Event Detail screen contents and navigation.
8. Group Event browsing/management location and lifecycle.
9. Delete Group Event vs remove/delete one participant interaction.
10. Whether an ordinary existing Interaction can later be expanded into a Group Event / have participants added.
11. FAB entry and canonical participant-selection flow.
12. Atomicity/failure behavior when creating or updating multiple child interactions.
13. Undo behavior for creation and participant changes.
14. Backfill/date behavior for historical group events.
15. Backup/restore implications for Group Events and links.
16. History presentation of group-linked interactions and how Group Event context is surfaced from a contact's Interaction Detail.
17. Accessibility, large participant counts, and performance limits.

## Phase ownership direction
### New Phase 12 — Group Interaction Logging
Should own the coherent new subsystem:
- Group Event domain/persistence contract.
- Parent ↔ child Interaction relationship.
- Shared/default/per-participant semantics.
- Group Log form and participant detail editing.
- Add/remove participant behavior.
- Group Event detail/edit lifecycle and central management/browsing surface.
- Canonical reusable routing/API for group logging.
- Cross-contact transactional/atomic behavior.

### Shifted Phase 13 — Rapid Capture & Update Flows
Should consume the Group Interaction contract rather than invent it. It continues to own:
- Add Contact.
- existing single-contact Quick Log behavior.
- single-contact detailed Log Contact UX.
- Update Contact.
- focused form ergonomics, validation, save/cancel, keyboard behavior.

It may expose or integrate the new Group Log route where relevant, but should not redefine Group Event domain semantics.

### Phase 11 — Interaction History & Insights
Likely needs a targeted amendment after Phase 12 is settled:
- Interaction Detail must recognize when an Interaction belongs to a Group Event.
- It should expose Group Event context/participants appropriately.
- Edit Interaction semantics must distinguish participant-only changes from shared-event changes where applicable.
- Heatmap/Intensity remain based on ordinary child Interaction rows and should not double-count the parent Group Event.

### Phase 7 — Dashboard Card/Grid View
Will need a targeted dossier revision after Phase 12 settles:
- Reverse the old prohibition on detailed bulk logging.
- Grid multi-select `Log Interaction` should route intelligently: 1 selected → individual Log Interaction; 2+ → Group Log.
- Group Log remains a shared canonical workflow, not Phase 7-owned form logic.

### Phase 1 — App Shell & Navigation
Likely needs a small amendment if the universal FAB gains a distinct Group Log action or if `Log Contact` becomes multi-select capable. Existing routing principles already support canonical reusable routes and deep-link/widget-ready workflows.

### Backup/Restore / data management
Must eventually preserve Group Event records, child links, and any shared/default state. Do not let this become a Dashboard-import concern.

## Planning order recommendation
1. **New Phase 12 Group Interaction Logging** — settle domain/data model and canonical workflow semantics first.
2. **Phase 13 Rapid Capture & Update Flows** — finish interrogation using the settled Group Interaction contract.
3. **Amend Phase 11 History/Edit contracts** as required by the settled Group Event edit model.
4. **Return to Phase 7** and revise the Dashboard Grid dossier to expose the canonical Group Log route correctly.
5. Make small cross-phase amendments to Phase 1 / Backup-Restore / roadmap / master handoff as needed.

This order is essentially **domain/data → shared behavior/workflows → consuming UI surfaces**.

## Roadmap warning
The currently uploaded working roadmap/master handoff are stale for phase numbering after Phase 11. Until the planning artifacts are regenerated:
- treat Phases 1–11 as already completed/interrogated,
- provisionally insert **Group Interaction Logging as Phase 12**,
- shift existing Rapid Capture & Update Flows to **Phase 13**,
- shift later provisional phase numbers by +1,
- do not rely on the old post-11 numbering as authoritative.

The final GSD `new-milestone` workflow remains responsible for canonical requirements and phase numbering later.
