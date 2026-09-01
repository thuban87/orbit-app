# Dossier — Contact Knowledge Foundation

**Status:** complete · Interrogated through 2026-08-29.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope
Defines Orbit's durable contact-knowledge model for later Profile, Search, Update Contact, AI Compose, Import, Backup/Restore, and future Sync.

## A. Core Model
**[DECIDED]** Things to Remember is one unified product surface over multiple underlying data structures.

**[DECIDED]** Preserve a stable first-class contact schema for true profile/state properties such as Birthday, Current Location, Social Battery, Contact Frequency, Gravity/Closeness, category/group, and similar stable relationship properties.

**[DERIVED]** Search, Profile, AI, and Update Contact should consume a semantic knowledge abstraction rather than care which table owns a value.

## B. Memory Types
**[DECIDED]** Memory items are typed and support an optional custom label.

**[DECIDED]** Built-in Memory types are centrally defined in a Memory-type registry containing behavior such as display name, icon semantic, cardinality, history behavior, searchability, AI defaults, presentation hints, and value shape.

**[DECIDED]** Users get flexibility through a generic Custom type with a user-defined label.

**[DECIDED]** Cardinality is type-defined.

## C. Last Talked About
**[DECIDED]** Full history is retained.

**[DECIDED]** Profile shows only the most recent entry as the primary card/value; tapping in shows the complete backlist.

**[DECIDED]** Historical entries remain editable.

**[DEFERRED]** Automatic derivation from interaction notes.

## D. Relationships / Key People
**[DECIDED]** Relationships are structured repeatable records with person/name, relation type, and optional linked Orbit contact.

**[DECIDED]** Linking to an Orbit contact is optional.

## E. Current-State Fields & History
**[DECIDED]** History-aware current-state fields preserve previous values when superseded.

**[DECIDED]** History behavior is centrally defined by field/type metadata.

**[DECIDED]** Some historical values may be promoted back to current when appropriate.

**[DECIDED]** Historical entries are editable.

## F. Location
**[DECIDED]** Current Location is a first-class field with retained historical locations underneath.

## G. Things to Remember Presentation
**[DECIDED]** First-class fields, custom fields, structured relationships, and Memory items appear inside one broader Things to Remember surface.

**[DECIDED]** The surface is visually grouped, not a single feed.

**[DECIDED]** Featured/current information comes first, then grouped detail.

**[DECIDED]** Types/groups can have Profile visibility defaults and individual items can override them.

**[DECIDED]** Hidden-from-Profile is presentation-only, not a privacy rule.

## H. Search
**[DECIDED]** Dashboard search may search contact name, Memory labels/values, relationship names, and appropriate custom-field content.

**[DECIDED]** Internal metadata is not searched.

## I. Lifecycle
**[DECIDED]** Memories can be marked outdated/inactive without deletion.

**[DECIDED]** Memory deletion is soft-delete.

**[DECIDED]** Users can restore deleted Memories from Recently Deleted/Trash.

## J. Pinning & Priority
**[DECIDED]** Individual repeatable Memory items can be pinned.

**[DECIDED]** Types/groups may also have priority/order.

**[DEFERRED]** Full freeform ordering of every Memory.

## K. Memory Content
**[DECIDED]** Memory items support optional notes.

**[DECIDED]** Links/URLs are supported.

**[DECIDED]** Memory items may have an optional meaningful date.

**[DEFERRED]** Rich attachments such as images/files/screenshots/documents.

## L. Source / Provenance
**[DECIDED]** Source metadata is lightweight, structured, optional, and primarily shown in detail/edit views.

**[DEFERRED]** Full immutable provenance/audit history.

## M. AI Privacy
**[DECIDED]** AI use is privacy-first and opt-in at the information level.

**[DECIDED]** AI use has at least two gates: AI globally enabled, then specific field/item permission.

**[DECIDED]** Per-field/per-item AI permission defaults OFF.

**[DECIDED]** AI inclusion is manageable both locally and in a central AI review/manage surface.

**[DECIDED]** Type-level defaults plus per-item overrides are supported.

**[DECIDED]** Changing a type-level default affects newly created items only, not old data.

**[DECIDED]** AI-enabled items/fields show the generic sparkle/AI icon.

**[DERIVED]** AI context assembly must preserve semantic type meaning.

## N. Off Limits
**[DECIDED]** Off Limits means conversation topics that should not be brought up with that contact.

**[DECIDED]** It is not a hidden-data, privacy, or system-suppression flag.

**[DECIDED]** Off Limits information should remain visible where relevant.

**[DECIDED]** Off Limits and AI permission are separate controls.

**[DECIDED]** If an Off Limits item is sent to AI, the model must receive the semantic “avoid mentioning this topic,” not treat it as conversation fuel.

## O. Custom Fields
**[DECIDED]** Custom Fields remain structured rather than being collapsed entirely into generic Memory.

**[DECIDED]** They surface inside Things to Remember.

**[DECIDED]** Custom fields may be current-only or history-retained.

**[DECIDED]** Optional categories/groups are supported.

**[DECIDED]** Broad typed custom fields are supported: Text, Long Text, Number, Date, Yes/No, URL, Email, Phone, Choice/Select.

**[DECIDED]** Definitions may be global or one-off per contact.

**[DECIDED]** One-off fields can optionally be promoted to reusable definitions.

**[DEFERRED]** Tags.

## P. Imported Contact Data
**[DECIDED]** Imported contact data populates the local model normally.

**[DECIDED]** Imported data remains AI-off by default.

**[DECIDED]** Freeform phone-contact notes import as a dedicated Memory type, working name **Imported from Contacts App**.

**[DEFERRED]** Automatic AI classification of imported notes.

## Q. Backup / Restore
**[DECIDED]** Backup/restore preserves the full knowledge model: current values, history, Memories, custom fields, relationships, Profile visibility, pinning, AI permissions, provenance, soft-deleted records, and type references.

## Derived Architecture
**[DERIVED]** Use a unified semantic knowledge service/query layer for Profile, Search, AI, Update Contact, future widgets, and future Sync.

**[DERIVED]** Use a central built-in field/type registry.

**[DERIVED]** Generic Memory storage may be supplemented by structured metadata/linked records where needed.

**[DERIVED]** Privacy permissions must be explicit state, never inferred from type or storage location.

## Cross-Phase Constraints
- **Profile:** one Things to Remember surface; current/latest values lead; history opens on drill-in.
- **Dashboard Search:** search appropriate remembered content through the unified model.
- **Update Contact:** must edit both first-class fields and typed remembered information without requiring the full Edit Contact form.
- **AI Compose:** explicit opt-in, default off, and semantic preservation including Off Limits = avoid topic.
- **AI Settings:** central permission review/manage surface.
- **Import:** imported data stays local and AI-off; freeform notes become Imported from Contacts App Memories.
- **Backup/Restore:** preserve full knowledge/history/privacy fidelity.
- **Future Sync:** current values, history, soft deletion, permissions, provenance, custom fields, and relationships are real sync state.
- **Icon System:** AI-enabled state uses the semantic sparkle/AI icon.

## Explicitly Deferred
- automatic extraction of Memories from interaction notes
- AI classification of imported notes
- rich attachments
- arbitrary user-created Memory system types
- tags
- immutable audit/version history
- final Things to Remember layout/section names
- exact Update Contact UX
- exact Profile card appearance
- exact AI prompt payload
- widget UX
- sync conflict semantics

## Phase Success Criteria
1. Orbit preserves distinct first-class fields, custom fields, relationships, and typed Memories while presenting one Things to Remember concept.
2. Built-in knowledge types are governed by one central registry.
3. Current-state fields can retain history where configured.
4. Last Talked About retains history while surfacing the latest value.
5. Relationships support structured relation semantics and optional Orbit-contact links.
6. Memories support labels, values, optional notes, dates, links, source metadata, pinning, visibility, soft deletion, and restoration as appropriate.
7. Dashboard search can search appropriate remembered knowledge without depending on storage details.
8. AI permissions default off, are manageable locally and centrally, and survive backup/restore.
9. Off Limits is modeled as “avoid this conversation topic,” not hidden/private system content.
10. Custom fields remain typed, structured, optionally historical, categorizable, and visible within Things to Remember.
11. Imported phone-contact notes are preserved as Imported from Contacts App Memories and remain AI-off.
12. Backup/restore preserves the full knowledge model.

## Notes for GSD / Roadmapper
- This phase is a prerequisite for Profile, Update Contact, AI Compose, and future widget work.
- Do not flatten all knowledge into one generic text table merely because the UI is unified.
- Do not infer AI eligibility from storage location or Memory type.
- Privacy posture is explicit opt-in, default off.
- Do not misinterpret Off Limits as a hidden/private-content control.
- Import and Backup/Restore may need migrations/compatibility updates because this phase expands durable local state.
