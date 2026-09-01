# Dossier — Group Interaction Logging

**Status:** complete · Interrogated 2026-09-01 · Product/domain contract, canonical workflow, lifecycle, management, and cross-phase seams settled.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope
This dossier defines Orbit's first-class **Group Interaction Logging** subsystem.

It covers Group Event domain identity and persistence, parent ↔ child Interaction relationships, event-owned versus participant-owned fields, shared/default values and participant overrides, zero-participant event-first capture, the canonical Group Log workflow, participant selection/editing, Group Event Detail/Edit surfaces, participant lifecycle, conversion of ordinary Interactions into Group Events, Group Event browsing/management, routing seams, atomicity, backup/restore, accessibility, and responsive constraints.

It intentionally does **not** redesign ordinary single-contact logging, Add Contact, Update Contact, Messaging/AI Compose, Dashboard renderers, Profile layout, general Settings IA, category administration, future social analytics, future event planning, or calendar synchronization.

## A. Product Role
**[DECIDED]** Group Interaction Logging is a first-class Orbit subsystem for recording one real-world social encounter involving multiple Orbit contacts without forcing the user to separately author the same details for each contact.

**[DECIDED]** Group Events are not merely a Dashboard bulk-action convenience. They are durable social-event records with their own presentation, editing, browsing, and management surfaces.

**[DECIDED]** The subsystem supports both event-first capture and multi-contact interaction authoring.

**[DERIVED]** Orbit should treat Group Events as a hallmark relationship-history feature while preserving contact-centric Interaction semantics.

## B. Core Domain Model
**[DECIDED]** Orbit retains the existing one-contact-per-Interaction model.

**[DECIDED]** A new **Group Event** parent represents the common real-world encounter.

**[DECIDED]** Each participating contact receives one ordinary canonical child Interaction row.

**[DECIDED]** Child Interaction rows may carry a nullable Group Event reference.

**[DECIDED]** Existing standalone Interactions remain unchanged and have no Group Event reference.

```text
Group Event
"Jamie's Birthday"
Aug 29, 2026 · 8:00 PM
In Person
Positive tone
3h
Group Note
        │
        ├── Interaction → Sarah
        ├── Interaction → Mike
        └── Interaction → Jordan
```

**[DECIDED]** The Group Event parent is not itself a contact interaction and must never be counted as an additional interaction.

**[DERIVED]** Last Interaction, Status, Gravity, Intensity, Heatmap, and contact History continue operating over child Interaction rows only.

## C. Group Event Identity
**[DECIDED]** Group Event title is **required**.

**[DECIDED]** Date/time is required.

**[DECIDED]** Participants are optional.

**[DECIDED]** Channel, Tone, duration, and Group Note are optional.

**[DECIDED]** A zero-participant Group Event is valid.

**[DECIDED]** A zero-participant event creates no child Interactions and therefore does not affect contact-level history or derived metrics until participants are added.

## D. Event-Owned Fields
**[DECIDED]** Group Event owns:
- required title,
- required date/time,
- shared/default Channel,
- shared/default Tone,
- shared/default Duration,
- Group Note,
- created/modified metadata.

**[DECIDED]** Group Event date/time is authoritative for all linked participants and cannot be overridden per participant.

**[DECIDED]** Group Event title is event-only and cannot be overridden per participant.

**[DECIDED]** Group Note is one true shared note owned by the Group Event.

**[DERIVED]** Child Interaction rows retain the resolved canonical values needed by existing contact-centric consumers, while override/inheritance state preserves the authoring relationship to the parent.

## E. Child Interaction Fields
**[DECIDED]** Each child Interaction owns contact identity, participant-specific note, per-participant override state, and the resolved canonical Interaction values required by existing consumers.

**[DECIDED]** Participant-overridable fields initially include:
- Channel,
- Tone,
- Duration,
- Direction where relevant,
- Connected state where relevant.

**[DECIDED]** Date/time is not participant-overridable.

**[DECIDED]** Title is not participant-overridable.

**[DECIDED]** A contact may appear at most once in one Group Event.

**[DERIVED]** Persistence should enforce uniqueness of participant membership for a given Group Event.

## F. Tone Terminology and Defaults
**[DECIDED]** Canonical product term is **Tone**.

**[DECIDED]** New Group Events begin with Tone unset/null.

**[DECIDED]** Tone may be set once at Group Event level and inherited by participants.

**[DECIDED]** Any participant may override Tone independently.

**[DECIDED]** An explicit participant override may equal the current Group Event Tone while remaining intentionally detached from future event-level Tone changes.

## G. Shared Defaults and Live Inheritance
**[DECIDED]** Shared/default values use true inheritance semantics rather than one-time copying.

Example:
```text
Event Tone: Positive
Event Duration: 2h

Sarah: Tone override = Negative
Mike: Duration override = 45m
Jordan: no overrides
```

If the event later changes to `Tone = Neutral` and `Duration = 3h`:
- Sarah remains Negative and inherits Duration = 3h.
- Mike inherits Tone = Neutral and remains 45m.
- Jordan becomes Neutral / 3h.

**[DECIDED]** A participant field may later reconnect to live inheritance.

**[DECIDED]** User-facing wording is **Follow event tone** for Tone and equivalent `Follow event ...` wording for other inheritable fields where appropriate.

**[DERIVED]** Clearing an override removes override state; it is not a one-time copy of the current event value.

**[DEFERRED]** Live `applies to N of M participants` helper counts while editing shared values.

## H. Group Note and Participant Note
**[DECIDED]** Group Note and participant note are distinct but semantically tied through the child Interaction's Group Event relationship.

**[DECIDED]** Participant note remains the ordinary note associated with that contact's child Interaction.

**[DECIDED]** Group Note remains one shared event-level record and is not duplicated into every child.

**[DECIDED]** Editing Group Note updates the shared context visible from every linked participant Interaction.

**[DECIDED]** Participant notes remain untouched by Group Note edits.

**[DECIDED]** Shared text should be explicitly labeled **Group Note** when shown with a participant Interaction; the participant note needs no special label.

**[DERIVED]** Contact-level consumers can show both notes together without concatenating them into one storage field.

## I. Canonical Group Log Workflow
**[DECIDED]** Group Log is one canonical reusable focused workflow.

**[DECIDED]** Global entry opens directly into the Group Log form:

```text
FAB → Group Log → Group Log form
```

**[DECIDED]** Participant selection is not required before entering the form.

**[DECIDED]** The workflow supports event-first capture so the user can record title/date/time and other fuzzy details before remembering or selecting participants.

**[DECIDED]** Participants can be added and managed from within the Group Log form.

**[DERIVED]** The form should expose an embedded participant-management affordance that invokes the shared multi-select picker foundation.

## J. Group Log Initial Defaults
**[DECIDED]** Group Log defaults Channel to **In Person**.

**[DECIDED]** Group Log is explicitly exempt from the ordinary single-interaction global Channel-default preference.

The ordinary logging preference established elsewhere uses Message, Call, In Person, and Remember last choice, with **Remember last choice** as factory default.

**[DECIDED]** Group Log continues to default specifically to In Person unless changed by a later product decision.

**[DECIDED]** Tone defaults to null/unset.

**[DECIDED]** Duration defaults to unset.

**[DECIDED]** Historical/backdated Group Events are supported.

**[DECIDED]** Future completed Group Events are not allowed in this phase.

## K. Participant Picker
**[DECIDED]** Group Logging reuses the shared canonical contact-picker foundation in multi-select mode rather than creating an unrelated picker system.

**[DECIDED]** Multi-select picker supports search, selected count, clear selection state, Done/Continue, archived contacts through explicit search with an Archived marker, and snoozed contacts as selectable with a Snoozed marker.

**[DECIDED]** Archived contacts may be deliberately added to a Group Event without restoring them.

**[DECIDED]** No artificial product-level participant cap is imposed.

**[DERIVED]** Large participant sets should use virtualized/searchable selection and rendering.

## L. Participant Edit Details
**[DECIDED]** Main Group Log / Edit Group Event surfaces list participants and expose participant-edit access.

**[DECIDED]** Participant editing exposes only participant-relevant overridable fields: Channel, Tone, Duration, Direction where relevant, Connected state where relevant, and participant-specific note.

**[DECIDED]** Event title and event date/time do not appear as participant-editable fields.

**[DECIDED]** Participant editing supports explicit `Follow event ...` semantics to remove overrides and resume inheritance.

**[DERIVED]** Participant editor should reuse existing canonical Interaction field controls/domain behavior where compatible without becoming a duplicate standalone Edit Interaction implementation.

## M. Adding Participants
**[DECIDED]** Participants may be added before or after initial Group Event save.

**[DECIDED]** A participant added later receives the Group Event's **current** shared/default values and begins in inherited state unless immediately customized.

**[DECIDED]** The child Interaction timestamp is the Group Event date/time, not the time the participant was added to Orbit.

**[DERIVED]** Adding a participant to a historical event creates a historically dated child Interaction and refreshes normal contact-level derived consumers.

## N. Removing Participants
**[DECIDED]** Removing an already-saved participant asks which intent applies:
1. **Delete interaction**
2. **Keep as individual interaction**
3. Cancel

**[DECIDED]** `Delete interaction` permanently deletes that participant's child Interaction.

**[DECIDED]** `Keep as individual interaction` detaches the child from the Group Event while preserving it as a standalone Interaction.

**[DECIDED]** Removing an unsaved participant from a draft simply removes them from the draft.

**[DECIDED]** A Group Event may remain valid with zero participants.

## O. Detaching a Participant
**[DECIDED]** Detaching a participant materializes the participant's currently resolved structured values into the standalone Interaction.

**[DECIDED]** Participant note remains the standalone Interaction note.

**[DECIDED]** Group Event reference is cleared.

**[DECIDED]** Group Note is **not** copied into the participant note.

**[DECIDED]** Orbit does not offer a special `include Group Note` detachment option.

## P. Converting an Existing Interaction into a Group Event
**[DECIDED]** An existing ordinary Interaction may later be expanded into a Group Event.

Intended flow:
```text
Interaction Detail
→ overflow
→ Add participants / Make this a group interaction
→ create Group Event around existing Interaction
→ add participants
```

**[DECIDED]** The original Interaction keeps its identity/UID rather than being deleted and recreated.

**[DECIDED]** The original Interaction's values seed the initial Group Event shared/default state where semantically appropriate.

## Q. Editing from a Child Interaction
**[DECIDED]** Editing a group-linked Interaction asks which scope the user intends:
- **Edit individual interaction**
- **Edit Group Event**

**[DECIDED]** Individual scope routes to the participant override editor.

**[DECIDED]** Group scope routes to Edit Group Event.

**[DERIVED]** Do not place the user into a hybrid editor where field scope is implicit.

## R. Group Event Presentation vs Editing
**[DECIDED]** Group Events use two canonical surfaces:
1. **Group Event Detail** — presentation/read surface.
2. **Edit Group Event** — focused editing form.

**[DECIDED]** Group Event Detail follows the same high-level presentation-first philosophy as Contact Profile: read first, deliberate edit workflow second.

**[DECIDED]** Group Event Detail includes title, date/time, Channel, Tone, Duration, Group Note, participant list, Edit Group Event, Add Participant, and lifecycle actions through overflow as appropriate.

## S. Participant Cards on Group Event Detail
**[DECIDED]** Participants appear as compact list cards/rows with avatar/photo, contact name, concise override/custom-detail indicator or summary, and participant overflow menu.

**[DECIDED]** Tapping the participant card opens that participant's child Interaction Detail.

**[DECIDED]** Participant overflow includes:
- **Edit participant record**
- **Remove from group**

**[DECIDED]** Participant rows remain compact rather than expanding into stacked mini Interaction Detail cards.

## T. Group Event Browse / Management Surface
**[DECIDED]** Group Events have a dedicated canonical browse/management page.

**[DECIDED]** Initial page remains lean: reverse-chronological event list plus simple search by event title and participant name.

**[DECIDED]** Group Events receives a prominent **Dashboard header icon + label entry**.

**[DECIDED]** Group Events is also available through Dashboard overflow as a redundant management/discovery path.

**[DECIDED]** Group Events does not receive a new permanent bottom-navigation tab in this milestone.

**[DECIDED]** The existing Dashboard bottom-nav destination does not become a radial/menu launcher in this milestone.

## U. Universal FAB
**[DECIDED]** Universal FAB action set expands from five to six actions by adding **Group Log**.

**[DECIDED]** Group Log is a distinct visible user intent rather than being hidden behind individual Log Contact.

**[DERIVED]** Phase 1's five-action FAB contract requires targeted amendment.

## V. Dashboard Grid / Multi-Select
**[DECIDED]** Phase 7's prior prohibition on detailed multi-contact logging is superseded.

**[DECIDED]** Dashboard Grid multi-select retains **Quick Log** as a distinct immediate bulk action.

**[DECIDED]** Dashboard Grid also exposes detailed **Log Interaction** routing:
- 1 selected → canonical individual detailed Log Interaction,
- 2+ selected → canonical Group Log preloaded with selected participants.

**[DECIDED]** Dashboard does not own Group Log form/business logic.

## W. Editing Shared Event Values
**[DECIDED]** Editing Group Event date/time updates all linked child Interaction timestamps because date/time is non-overridable.

**[DECIDED]** Editing Group Note updates one shared note.

**[DECIDED]** Editing shared/default inheritable fields affects only participants still following the event value for that field.

## X. Group Event Lifecycle
**[DECIDED]** Group Event management supports two distinct operations:

### Dissolve Group Event
- remove the grouping relationship,
- keep all participant Interactions as standalone records,
- materialize resolved structured values,
- preserve participant notes,
- do not copy Group Note into participant notes.

### Delete Group Event & Interactions
- permanently delete the Group Event,
- permanently delete all linked child Interactions,
- require explicit destructive confirmation.

**[DECIDED]** Group Events do not initially have Favorite, Pin, Archive, or Trash states.

**[DECIDED]** A Group Event remains valid even if all participant Interactions are later removed/deleted.

## Y. Child Interaction Deletion
**[DECIDED]** Deleting one child Interaction directly removes only that participant's interaction record.

**[DECIDED]** Other Group Event participants remain unaffected.

**[DECIDED]** The Group Event may remain as a zero-participant event.

**[DECIDED]** Interaction deletion retains Phase 11's irreversible hard-delete semantics; no Group-specific Interaction trash is introduced.

## Z. Undo and Confirmation
**[DECIDED]** Complex Group Event creation does not require snackbar Undo.

**[DECIDED]** Ordinary field edits do not require Undo.

**[DECIDED]** Participant additions/removals may use local Undo where simple and safely reversible.

**[DECIDED]** Dissolve Group Event and Delete Group Event & Interactions require explicit confirmation.

## AA. Atomicity and Failure
**[DECIDED]** Group Event saves/updates involving multiple child rows behave atomically from the user's perspective.

**[DERIVED]** Group Event + child Interaction create/update/delete fan-out should run inside one transactional boundary where applicable.

**[DERIVED]** The operation commits completely or rolls back completely; partial-success event states must not be exposed.

**[DECIDED]** If Save fails, the focused form remains open with unsaved user input intact.

## AB. Historical / Backdated Events
**[DECIDED]** Group Log supports historical/backdated entry through now.

**[DECIDED]** Future Group Events are not supported as planned social events in this phase.

## AC. Backup / Restore
**[DECIDED]** Group Events are first-class backed-up entities.

Backup/restore preserves:
- stable Group Event identity,
- title,
- date/time,
- shared/default Channel,
- shared/default Tone,
- shared/default Duration,
- Group Note,
- created/modified metadata,
- child Interaction → Group Event references,
- participant override/inheritance state,
- ordinary child Interaction data.

**[DECIDED]** Restore preserves Group Event relationships rather than flattening linked children into unrelated standalone Interactions.

**[DERIVED]** Backup validation should reject structurally invalid relationship graphs before commit where practical.

**[DERIVED]** Recovery/migration logic should prefer preserving a valid child Interaction as standalone over losing contact history if orphan repair is ever necessary.

## AD. Contact History / Interaction Presentation Contract
**[DECIDED]** A Group Event appears in one contact's history exactly once, through that contact's child Interaction.

**[DECIDED]** The Group Event parent does not become a second history record.

**[DECIDED]** Group-linked Interactions expose meaningful Group Event context where sufficient space exists.

**[DECIDED]** A restrained **Group event** badge/label is appropriate.

**[DECIDED]** Interaction Detail may show Group Event title/context, Group Note, participant note, and a View Group Event action.

## AE. Accessibility & Responsive Behavior
**[DERIVED]** Participant cards expose identity, custom-detail/override state, and action semantics through accessible text, not color/icon alone.

**[DERIVED]** Large text may increase participant-card height rather than truncating critical semantics.

**[DERIVED]** Shared multi-select picker remains accessible to screen readers and non-gesture interaction.

**[DERIVED]** Large participant sets use virtualized/searchable rendering.

**[DERIVED]** Group Log/Edit inherits shell safe-area, keyboard-aware, discard-change, focus, and focused-workflow behavior.

**[DERIVED]** No bespoke landscape/tablet Group Event redesign is required in this phase; later release hardening audits responsive presentation.

## AF. Cross-Phase Amendments Required
### Phase 1 — App Shell & Navigation
- universal FAB expands from five to six actions,
- add **Group Log**,
- preserve canonical routable/deep-link-ready Group Log entry,
- Dashboard header gains first-class Group Events destination.

### Phase 7 — Dashboard Card/Grid View
- supersede `Bulk Log Interaction with detailed form is not offered`,
- Quick Log remains separate,
- detailed Log Interaction routes 1 selected → individual, 2+ → Group Log,
- Dashboard does not own Group Log form/domain logic.

### Phase 11 — Interaction History & Insights
- Interaction Detail recognizes Group Event membership,
- show `Group event` context/badge where appropriate,
- expose Group Event title/Group Note context,
- Edit asks individual vs Group Event scope,
- child delete removes that participant only,
- parent never double-counts Heatmap/History/Intensity.

### Shifted Phase 13 — Rapid Capture & Update Flows
- Group Log is its own canonical Phase 12 workflow,
- ordinary logging does not redefine Group Event semantics,
- ordinary Channel-default preference does not govern Group Log,
- Group Log defaults Channel to In Person,
- Tone terminology is canonical and new logging Tone defaults null.

### Later Settings & Personalization
- logging Channel-default setting explicitly applies to ordinary single-contact logging,
- Group Log is exempt and initially defaults to In Person.

### Backup / Restore
- Group Event records, links, override state, and Group Notes are durable backup state.

## AG. Phase Boundaries
**[DECIDED] Phase 12 owns:** Group Event domain/persistence model, zero-participant event-first state, parent/child relationship, inheritance/override semantics, Group Note/participant note relationship, canonical Group Log, participant management, participant override editing, Group Event Detail/Edit, Group Event browse/management, Interaction → Group Event conversion, dissolve/delete/detach semantics, atomic multi-row behavior, backup/restore contract, and reusable Group Log routing.

**[DECIDED] Phase 12 does not own:** ordinary Add Contact redesign, ordinary single-contact logging redesign, Update Contact taxonomy, Messaging/AI Compose, Dashboard renderer design, Contact Profile layout, general Settings IA, future social analytics, calendar sync, future planned events, or Mission Control.

## Explicitly Deferred
- Mission Control / true multi-feature Dashboard concept.
- Renaming the current Dashboard contact browser to Catalogue / Address Book / another product name.
- Bottom-navigation restructure around Mission Control / Contacts / Group Events.
- Dashboard-tab radial/menu launcher.
- Permanent Group Events bottom-nav destination.
- Advanced Group Events filters/sorting.
- Group Event pin/favorite/archive lifecycle.
- Planned/future Group Events.
- In-app social calendar.
- Google Calendar integration/import/synchronization.
- Calendar-based event import from past events.
- Group Event analytics and aggregate social-life analytics.
- Host/owner participant role and other participant roles.
- Affected-participant counts while editing shared defaults.
- User-facing restore/orphan repair tools.
- Group Event trash/quarantine.
- Arbitrary participant cap.
- Rich event attachments/media.

## Phase Success Criteria
1. Orbit can persist a titled, dated Group Event with zero or more participants.
2. Every participant receives exactly one canonical child Interaction and the Group Event parent never double-counts contact history.
3. Shared Channel/Tone/Duration values inherit live unless explicitly overridden.
4. Participant overrides can be removed through clear `Follow event ...` semantics.
5. Group Note and participant note remain distinct but linked and can be presented together.
6. Group Log supports event-first capture, historical logging, adding/removing participants, and participant-specific editing.
7. Group Event Detail and Edit Group Event are separate canonical read/edit surfaces.
8. Participant cards expose child Interaction detail, edit, removal, and override/custom-detail state.
9. Existing ordinary Interactions can be converted into Group Events without replacing their identity.
10. Group Events have a lean chronological/searchable browse page reachable prominently from the Dashboard header and redundantly from Dashboard overflow.
11. Universal FAB exposes Group Log as a sixth action.
12. Dashboard Grid detailed logging routes one selected contact to individual logging and multiple selected contacts to Group Log while preserving Quick Log as a separate action.
13. Shared edits, participant changes, dissolve/delete operations, and multi-child persistence avoid partial visible state.
14. Group Event data, child links, shared notes, and override state survive backup/restore.
15. Group-linked Interactions integrate with Phase 11 Interaction Detail/History without double-counting.
16. Accessibility and responsive behavior inherit Orbit's shared shell/design-system contracts and remain usable for large participant sets.

## Notes for GSD / Roadmapper
- Treat Group Interaction Logging as a coherent subsystem before shifted Rapid Capture & Update Flows.
- Do not replace the existing one-contact-per-Interaction model with a many-to-many Interaction record.
- The Group Event parent is an authoring/history context object, not an extra contact interaction.
- Preserve ordinary child Interaction compatibility with existing Status/Gravity/Intensity/Heatmap/History consumers.
- Persist explicit per-field override/inheritance state; current-value equality is not enough to infer inheritance.
- Do not require participants before event capture; zero-participant titled events are valid.
- Do not pull future calendar/event-planning or Mission Control concepts into this phase.
- Use one reusable Group Log route and shared picker foundation across FAB, Dashboard, History, and future entry points.
