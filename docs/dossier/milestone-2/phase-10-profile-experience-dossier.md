# Dossier — Profile Experience

**Status:** complete · Interrogated through 2026-08-31 · Profile presentation, customization, template, relationship-overview, remembered-information, action, and phase-boundary decisions settled.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope

This dossier defines Orbit's release-quality **Contact Profile Experience**.

It covers Profile's presentation-first identity hierarchy, fixed Hero/header treatment, Profile backgrounds, modular Profile sections, layout templates and inheritance, Category/contact assignments, persistent collapsed state, Relationship Overview tiles, Orbit Status, Gravity, Intensity, contact methods, Things to Remember presentation, compact remembered-information cards, hidden-item recovery, Interaction History's Profile seam, Profile administration, accessibility, and responsive constraints.

It intentionally does **not** redefine the Contact Knowledge storage model, Status calculation algorithm, Gravity domain algorithm, detailed Interaction History/Insights experience, Add Contact / Log Contact / Update Contact forms, Messaging / AI Compose behavior, general Category CRUD, AI provider configuration, onboarding, or final release-hardening.

---

## A. Product Role

**[DECIDED]** Contact Profile is Orbit's **presentation-first read surface** for one relationship.

**[DECIDED]** Profile should feel substantially richer and more personal than Dashboard List/Card renderers while remaining faster to scan than a form or database record.

**[DECIDED]** Profile should not become the owner of every business workflow that can be launched from it.

**[DECIDED]** Profile consumes the semantic Contact Knowledge abstraction rather than duplicating storage-specific read logic.

**[DERIVED]** Profile composition should be modular enough that later phases can replace or deepen individual section internals without restructuring the whole Profile screen.

---

## B. Fixed Hero / Identity Header

**[DECIDED]** Profile uses a strong **hero-style identity treatment**.

The fixed Hero includes:
- large circular avatar/photo,
- prominently displayed contact name,
- Category shown beneath/near the name,
- Favorite state/control,
- Message action,
- Call action,
- Profile overflow / administration entry,
- optional Profile background treatment.

**[DECIDED]** Hero structure remains consistent across Profile layouts and templates.

**[DECIDED]** Users cannot reorder the Hero beneath other Profile sections.

**[DECIDED]** Profile layout templates do not control Hero structure.

**[DERIVED]** The Hero is the stable identity anchor while the modular Profile environment begins below it.

---

## C. Hero Direct Actions

**[DECIDED]** Profile-native direct actions are initially:
- Message
- Call

**[DECIDED]** Quick Log, Log Contact, Update Contact, and Memory / add remembered information remain primarily exposed through the universal FAB rather than duplicated as large Profile buttons.

**[DECIDED]** Message and Call keep stable Hero geometry.

**[DECIDED]** If an action is unavailable because the contact lacks a usable contact method, the control remains present but disabled with an accessible explanation rather than disappearing and shifting Hero layout.

**[DERIVED]** AI Draft is not restored as a separate Profile action; later Messaging / AI Compose owns AI-assisted composition behavior behind Message (ADR-052 superseded 2026-09-01: AI is reached via Message → Draft with AI, two taps).

---

## D. Profile Background System

**[DECIDED]** Profiles may use a dedicated Hero/Profile background independent of the ordinary app background.

**[DECIDED]** Galaxy may use a starfield/space background by default; Standard may use an appropriate calmer theme default.

**[DECIDED]** Users may create reusable Profile background templates/presets using custom images.

**[DECIDED]** Custom background editing supports familiar **drag/reposition + pinch crop** behavior.

**[DECIDED]** Orbit handles theme-aware readability treatment such as gradient/scrim automatically rather than requiring advanced image-effect controls.

**[DECIDED]** Layout templates and background templates are separate systems and may be combined freely.

**[DECIDED]** Background assignment supports:
- global/default assignment,
- Category assignment,
- contact-specific override.

**[DECIDED]** Category is the only initial group-level assignment mechanism for Profile backgrounds.

**[DECIDED]** Applying a background to a Category does not overwrite explicit contact-specific overrides.

**[DECIDED]** If a contact changes Category:
- inherited background changes to the new Category assignment,
- explicit contact-level background override remains.

**[DERIVED]** Background resolution uses nearest explicit assignment: `contact override → Category assignment → global/theme default`.

**[DERIVED]** User images should be copied into app-owned storage and resized/downscaled to an appropriate screen-class derivative rather than repeatedly decoding full-resolution camera images.

**[DEFERRED]** Advanced user-exposed image effects such as blur, brightness, overlay strength, filters, or arbitrary visual compositing.

---

## E. Customizable Profile Environment

**[DECIDED]** The Profile body below the Hero is a **modular customizable surface**.

**[DECIDED]** Users can:
- reorder supported top-level sections,
- hide/show supported sections,
- configure default expanded/collapsed state,
- customize eligible second-level child sections within their parent section,
- configure supported Relationship Overview tile sizes.

**[DECIDED]** Profile customization is not an unrestricted page builder.

**[DECIDED]** Only one customizable nesting level is supported:
- top-level Profile sections,
- child sections/modules inside a defined parent.

**[DECIDED]** Child sections cannot be moved outside their owning parent.

Example: Relationships may reorder within Things to Remember, but cannot be moved between Contact Methods and Interaction History.

**[DECIDED]** No third-level customizable nesting in this milestone.

**[DECIDED]** Individual Memory/data items are not manually ordered through the Profile layout editor.

**[DERIVED]** Pinning, type priority, current/history semantics, and domain metadata remain responsible for item ordering within child sections.

---

## F. Profile Layout Templates

**[DECIDED]** Orbit supports reusable **Profile layout templates**.

**[DECIDED]** The user has one editable global/default Profile layout.

**[DECIDED]** Users may create reusable named layout templates.

**[DECIDED]** Layout templates may be assigned to:
- global/default Profile layout,
- a Category,
- an individual contact.

**[DECIDED]** Category is the only initial group-level layout assignment mechanism.

**[DECIDED]** Applying a template to a Category does not overwrite explicit contact-specific overrides.

**[DECIDED]** A contact may:
- inherit the global layout,
- inherit a Category layout,
- explicitly use a saved layout template,
- use a unique freeform contact-specific layout override.

**[DECIDED]** If a reusable template itself changes, Profiles actively assigned to that template update automatically.

**[DECIDED]** A freeform contact-specific layout override is not silently rewritten when a reusable template changes.

**[DECIDED]** If a contact changes Category:
- a purely inherited Profile switches to the new Category's assigned layout,
- an explicit contact-level template/override remains.

**[DECIDED]** Explicit contact-level customization outranks Category assignment.

**[DECIDED]** Editing a contact-specific freeform layout should offer a natural path to save the result as a reusable template.

**[DECIDED]** Users may later explicitly choose `Save as Template`; they are not limited to a one-time save prompt.

**[DERIVED]** Layout definitions and layout assignments must be represented separately so editing a reusable template can update all inheriting Profiles without duplicating layout data into every contact.

---

## G. Layout Editing Flow

**[DECIDED]** Profile layout editing is entered deliberately from Profile overflow / administration.

**[DECIDED]** Entry flow: `Profile overflow → Profile Layout → choose/switch template OR Edit Layout`.

**[DECIDED]** Once Edit Layout begins:
- ordinary Profile interactions are disabled,
- section drag/reorder controls appear,
- hide/show controls appear,
- supported size/variant controls appear,
- nested configurable sections become available,
- all eligible sections appear regardless of current data population,
- bottom nav/FAB may hide as appropriate for the focused workflow,
- Save / Cancel is explicit.

**[DECIDED]** Layout changes require **Save** rather than auto-saving on every drag.

**[DECIDED]** Meaningful unsaved changes inherit the shell's Discard changes / Keep editing behavior.

**[DECIDED]** A template editor should provide a live Profile preview.

**[DECIDED]** When launched from a real contact, use that contact as the preview context where practical.

**[DECIDED]** When launched from centralized management, use a representative/sample contact or allow choosing a preview contact.

---

## H. Profile Layout Assignment and Reset

**[DECIDED]** Explicitly switching a contact to another Profile layout/template clears that contact's previous per-contact expanded/collapsed presentation overrides.

**[DECIDED]** New per-contact presentation overrides then accumulate against the newly chosen template.

**[DECIDED]** `Reset Profile Presentation` clears only contact-specific presentation overrides.

It may clear:
- contact-specific layout/template override,
- per-contact expanded/collapsed overrides,
- contact-specific background override.

**[DECIDED]** Reset falls back to the applicable Category assignment, then global/default configuration.

**[DECIDED]** Reset does not modify underlying contact data, Favorite state, Snooze state, AI permissions, or knowledge-item data.

**[DERIVED]** UI may provide separate Layout and Background reset actions if a single combined reset proves too broad in implementation/device testing.

---

## I. Persistent Expanded / Collapsed State

**[DECIDED]** Expanded/collapsed state persists **per contact**.

**[DECIDED]** Templates also define default expanded/collapsed state.

**[DECIDED]** Contact-specific expanded/collapsed state overrides the template default for that contact.

**[DECIDED]** Expanded/collapsed state exists at both:
- top-level section level,
- eligible child-section level.

**[DECIDED]** Relationship Overview tiles themselves do not individually collapse; they are shown/hidden and sized.

**[DERIVED]** Persisted contact presentation state is separate from the reusable template definition.

---

## J. Default Top-Level Profile Layout

**[DECIDED]** Factory Profile order below the fixed Hero is:

1. Relationship Overview
2. Things to Remember
3. Contact Methods
4. Interaction History

**[DECIDED]** This is only the factory/default composition; users may change supported ordering through Profile customization.

**[DECIDED]** Interaction History is a standalone top-level section, not a child of Relationship Overview.

**[DECIDED]** Interaction History defaults to the bottom of the Profile.

---

## K. Enabled Empty Sections

**[DECIDED]** In Profile layout/edit mode, all eligible sections appear regardless of whether the current contact has data for them.

**[DECIDED]** In ordinary Profile viewing, an enabled section with no data remains represented but **collapsed**, not silently invisible.

**[DECIDED]** Collapsed empty sections should use concise useful summaries such as `Relationships · Nothing added yet`, `Contact Methods · None`, or `Memories · Nothing saved yet`.

**[DERIVED]** Opening an empty section may expose an appropriate route or add affordance where owned by an existing/future workflow.

---

## L. Relationship Overview Product Role

**[DECIDED]** Relationship Overview is the Profile's deliberately **stats-oriented modular section**.

**[DECIDED]** It is visually distinct from the mostly list/card-based sections elsewhere on Profile.

**[DECIDED]** Relationship Overview uses compact tile/grid presentation.

**[DECIDED]** Its modules may support reorder, hide/show, and a small set of supported size variants.

**[DECIDED]** Relationship Overview is not an unrestricted dashboard builder.

**[DERIVED]** Each module declares which sizes/variants it supports; the editor exposes only those valid variants.

---

## M. Relationship Overview Grid Layout

**[DECIDED]** Relationship tiles support limited size variants such as compact `1×1` and wider/larger `2×1` where meaningful.

**[DECIDED]** Users may choose module sizes individually where multiple variants are designed.

**[DECIDED]** Orbit automatically repacks the grid from module order, module size, and available width.

**[DECIDED]** Users do not manually place modules at arbitrary x/y coordinates.

**[DERIVED]** Layout should avoid permanent empty holes where an automatic clean packing is possible.

**[DERIVED]** Wider devices may naturally produce more tile columns; narrow/accessibility layouts may reduce columns.

---

## N. Initial Relationship Overview Modules

**[DECIDED] Initial modules:**
- Orbit Status
- Gravity
- Intensity
- Last Interaction
- Contact Frequency
- Snooze

**[DECIDED]** Category lives beneath the name in the fixed Hero rather than in the factory Relationship Overview.

---

## O. Orbit Status

**[DECIDED]** Profile uses the existing **Orbit Status** model:
- Stable
- Wobbly
- Decaying
- Rogue

**[DECIDED]** No separate `Health` metric is introduced.

**[DECIDED]** Profile shows the literal Status label prominently.

**[DECIDED]** Status continues to derive from the existing relationship-status logic based on last contacted / interaction recency and configured Contact Frequency.

**[DECIDED]** Phase 10 does not add additional factors to Status calculation.

**[DECIDED]** Status is not user-editable.

**[DECIDED]** Factory Status module uses a larger/wide tile where appropriate.

**[DECIDED]** A compact Status tile variant may also be available.

**[DECIDED]** Tapping Status may show a lightweight explanation using the actual factors the calculation uses, such as last interaction and target Contact Frequency, plus a route toward Interaction Insights where useful.

**[DECIDED]** Do not expose user-tunable Status weighting.

**[DERIVED]** Status explanation must not invent factors that the current algorithm does not use.

---

## P. Gravity

**[DECIDED]** Gravity remains a derived-never-stored relationship concept.

**[DECIDED]** Profile presents Gravity using a named tier plus a visual sphere whose apparent size communicates Gravity strength.

**[DECIDED]** Gravity size is bounded for layout safety but the range should be deliberately wide enough to communicate **tiny-to-huge** differences clearly.

**[DECIDED]** Galaxy may render the Gravity sphere as a luminous/celestial body; Standard may render a calmer clean shaded sphere/circle.

**[DECIDED]** Theme changes visual character but not Gravity meaning or tier boundaries.

**[DECIDED]** Gravity may open a minimal explanation/detail surface.

**[DECIDED]** Gravity is never editable from Profile.

**[DERIVED]** Exact sphere diameter mapping and tier thresholds are implementation/domain tuning.

---

## Q. Intensity

**[DECIDED]** Intensity remains a separate but subordinate relationship metric.

**[DECIDED]** Intensity represents recent interaction activity relative to the contact's cadence rather than relationship quality itself.

**[DECIDED]** Profile visualizes Intensity using a compact **bar/histogram** treatment.

**[DECIDED]** The histogram interval should resolve dynamically based on Contact Frequency so the visualization remains meaningful across high- and low-cadence relationships.

**[DECIDED]** Intensity may include a named tier such as Low / Moderate / High.

**[DECIDED]** Tapping Intensity may show a slightly larger histogram plus a concise explanation of the current time interval.

**[DERIVED]** Exact bin counts, interval functions, and tier thresholds are implementation/domain tuning.

---

## R. Last Interaction

**[DECIDED]** Last Interaction remains its own Relationship Overview module even though Status also references interaction recency.

**[DECIDED]** Last Interaction is a concrete fact; Status is an interpretation.

**[DECIDED]** Compact Last Interaction may show only relative recency.

**[DECIDED]** Expanded/wide Last Interaction may show relative or absolute date, interaction type, and a short note/context preview.

**[DERIVED]** Detailed interaction history/editing remains Phase 11 scope.

---

## S. Contact Frequency

**[DECIDED]** Contact Frequency is directly adjustable from its Relationship Overview module.

**[DECIDED]** Editing uses a compact menu/selector rather than a dedicated full-screen workflow.

**[DECIDED]** Frequency selection applies immediately; no separate Save/Done action is required.

**[DECIDED]** Status updates automatically after Contact Frequency changes.

**[DERIVED]** Reuse the existing canonical Contact Frequency values/domain behavior rather than inventing Profile-only frequency semantics.

---

## T. Snooze

**[DECIDED]** Snooze is available as an optional Relationship Overview module.

**[DECIDED]** Factory presentation may keep Snooze visually quiet/compact when inactive and prominent when active.

**[DECIDED]** Active Snooze shows useful state such as `Snoozed until …`.

**[DECIDED]** Tapping Snooze opens a lightweight menu supporting existing preset durations, changing a snooze, Unsnooze, and a custom duration/date path.

**[DECIDED]** Orbit needs a new narrowly scoped route/surface for **custom snooze duration/date** because the current app only supports preset values.

**[DERIVED]** The custom Snooze route owns selecting the snooze end point only; it should not expand into a general snooze-management subsystem.

---

## U. Contact Methods

**[DECIDED]** Contact Methods is a top-level Profile section and comes after Things to Remember in the factory layout.

**[DECIDED]** Ordinary-sized phone/email collections show all methods directly.

**[DECIDED]** Collapse only genuinely long contact-method sets rather than hiding a second phone/email by default.

**[DECIDED]** Valid methods are actionable where appropriate.

**[DECIDED]** Malformed/unusable imported methods remain readable with an explanatory disabled/unavailable state rather than disappearing.

**[DERIVED]** Reuse existing normalized phone/email read models, labels, primary state, and validation plumbing where compatible.

---

## V. Things to Remember Product Role

**[DECIDED]** Things to Remember remains one broad Profile concept over first-class fields, Custom Fields, Relationships, and typed Memories.

**[DECIDED]** Things to Remember uses a **one-column list/section presentation**, not a tile dashboard.

**[DECIDED]** Child sections may reorder within Things to Remember, hide/show, and persist expanded/collapsed state.

**[DECIDED]** Child sections cannot leave Things to Remember.

**[DECIDED] Factory Things to Remember child order:**
1. Pinned / Featured
2. Last Talked About
3. Key People / Relationships
4. Current Location
5. Memories
6. Custom Fields
7. Off Limits
8. Imported Contact Notes

---

## W. Compact Remembered-Information Card Principle

**[DECIDED]** Profile summary cards prioritize **fast information retrieval** over showing every available field.

**[DECIDED]** Blank metadata does not consume layout space.

**[DECIDED]** Secondary metadata uses small text, badges, or semantic icons rather than full form-like rows.

**[DECIDED]** Long content truncates before summary cards become oversized.

**[DECIDED]** Profile should not reproduce the current oversized Conversation Fuel cards that display many empty/secondary fields at all times.

**[DECIDED]** Card summary layout may vary by semantic Memory/data type.

**[DERIVED]** Use a shared compact card shell plus type-specific summary presentation hints/strategies supplied by the semantic type registry.

---

## X. Conversation Fuel / Similar Compact Card Example

**[DECIDED]** Conversation Fuel-style items should follow a compact presentation pattern:
- Topic → small badge near upper-right.
- `What's worth saying` / primary content → main body text, wrapping naturally and occupying most of the card.
- Optional Label → small free text near lower-right.
- Link → small semantic link icon rather than permanently displaying a long URL.
- Blank optional fields → omitted.
- Additional notes/metadata → detail surface rather than summary-card expansion.

**[DERIVED]** Other Memory types should follow the same principle: expose the most semantically useful compact summary, not a generic exhaustive field dump.

---

## Y. Pinned / Featured

**[DECIDED]** Pinned / Featured appears near the top of Things to Remember.

**[DECIDED]** It references the same underlying items rather than creating duplicate data.

**[DECIDED]** Factory direction is a restrained highlighted presentation rather than an ordinary undifferentiated list.

**[DECIDED]** Use a small number of visible featured items, generally around three, then `View all` where needed.

**[DERIVED]** Pinning affects presentation priority but not Profile visibility.

---

## Z. Last Talked About

**[DECIDED]** Profile shows the latest Last Talked About entry as the current primary value.

**[DECIDED]** Expanded presentation may show latest topic, optional meaningful date, and optional short note/context.

**[DECIDED]** If historical entries exist, expose a `View history` path.

**[DECIDED]** Historical entries live on a conventional child history surface rather than expanding the Profile summary card indefinitely.

---

## AA. Key People / Relationships

**[DECIDED]** Key People / Relationships receives a visually distinct child-section label and treatment within Things to Remember.

**[DECIDED]** Linked Orbit contacts show avatar/photo, name, relation, and navigation affordance to that person's Profile.

**[DECIDED]** Unlinked relationships show initials/avatar placeholder where useful, name, relation, and no fake Profile route.

**[DECIDED]** Relationship linking/unlinking is not performed inline from Profile.

**[DECIDED]** Substantive relationship edits route through Update/Edit Contact or the appropriate owning workflow.

**[DERIVED]** Preserve the distinction between linked Orbit contacts and unlinked lightweight relationship records used elsewhere such as Orrery Relationship Satellites.

---

## AB. Current Location

**[DECIDED]** Current Location shows the current value first.

**[DECIDED]** Tapping/drilling in may expose Location History.

**[DECIDED]** Location History is a conventional child surface showing current and prior locations.

**[DECIDED]** Editing remains outside the read-focused Profile summary.

---

## AC. Memories

**[DECIDED]** Expanded Profile Memories shows a **soft initial cap of approximately three visible items**.

**[DECIDED]** Additional items use `View all N memories`.

**[DECIDED]** Profile Memory summary cards may show title/value, up to approximately two lines of useful note/body preview, and minimal relevant metadata.

**[DECIDED]** Full long-form content belongs in item detail.

**[DERIVED]** Repeatable child sections may use section-specific caps, with approximately three as the common default rather than one hardcoded universal rule.

---

## AD. View All Surfaces

**[DECIDED]** Repeatable sections may expose `View all` when the compact Profile cap is exceeded.

**[DECIDED]** `View all` keeps the same semantic summary style but may use denser spacing to show more items efficiently.

**[DECIDED]** `View all` remains a read/management list, not a form.

**[DERIVED]** Search/filter behavior inside large `View all` surfaces may be added only where actual volume justifies it.

---

## AE. Memory / Knowledge Item Detail and Context Menu

**[DECIDED]** Tapping a compact remembered-information card opens a detail surface showing its complete information.

**[DECIDED]** Compact cards do not permanently display edit/delete controls.

**[DECIDED]** Long-press on a card opens a lightweight context menu with at least:
- Edit
- Pin / Unpin
- Hide from Profile

**[DERIVED]** Delete may be available where the owning knowledge item type/lifecycle already supports deletion, but summary presentation should not make destructive actions visually dominant.

---

## AF. Hidden Profile Items

**[DECIDED]** Hidden-from-Profile is presentation state only.

**[DECIDED]** Hidden items remain absent from normal Profile rendering even if their parent section is expanded.

**[DECIDED]** Profile visibility outranks Pinning. A hidden item does not reappear merely because it is pinned.

**[DECIDED]** Hidden items remain recoverable and manageable.

Recovery paths include:
- Edit Profile Layout / Profile content administration showing hidden items in a dimmed/unchecked state with a Show control,
- appropriate `View all` surfaces exposing a `Show hidden` filter/toggle when hidden items exist.

**[DECIDED]** Hiding never makes underlying information inaccessible to the user.

**[DERIVED]** Hidden state must not be conflated with privacy, deletion, soft-delete, AI permission, or Off Limits.

---

## AG. Custom Fields

**[DECIDED]** Profile follows the Contact Knowledge model for Custom Fields.

**[DECIDED]** Custom Fields remain structured typed data rather than being flattened into generic Memory text.

**[DECIDED]** Profile honors configured Custom Field categories/groups inside the Custom Fields child section.

**[DECIDED]** Those groups are data grouping, not a third Profile-layout customization level.

**[DECIDED]** Users reorder/show/hide the Custom Fields child section, not arbitrary nested Custom Field groups via the Profile layout editor.

**[DERIVED]** Exact card/row variants for every Custom Field value type may be finalized during implementation rather than pre-planning every type in Phase 10.

---

## AH. Off Limits

**[DECIDED]** Off Limits is enabled and fully visible in the factory Profile.

**[DECIDED]** It is not hidden/collapsed by default merely because the content may be sensitive or awkward.

**[DECIDED]** Off Limits receives distinct but non-error presentation: semantic caution/avoid icon, heading `Off Limits`, clear topic presentation, and concise explanation such as `Avoid bringing these up`.

**[DECIDED]** Off Limits remains separate from AI permission.

**[DECIDED]** If an Off Limits item is AI-enabled, show the ordinary AI/sparkle indicator without changing its `avoid mentioning` meaning.

**[DERIVED]** Detailed AI permission management remains on item detail/edit surfaces and the later central AI configuration/review surface.

---

## AI. Imported Contact Notes

**[DECIDED]** Imported Contact Notes / Imported from Contacts App content is available in Things to Remember.

**[DECIDED]** It is enabled in the factory layout but **collapsed by default**.

**[DECIDED]** When expanded, use the same compact-card principles as other remembered information.

**[DERIVED]** Imported information remains AI-off by default according to Contact Knowledge rules.

---

## AJ. Interaction History Profile Seam

**[DECIDED]** Interaction History is a standalone top-level Profile section and defaults to the bottom of the Profile.

**[DECIDED]** Phase 10 keeps Interaction History intentionally minimal to avoid duplicate work before the dedicated Interaction History & Insights phase.

Initial Phase 10 presentation may include:
- latest few interactions,
- last-contact summary,
- `View all history` entry.

**[DECIDED]** Profile does not implement the final heatmap-first, date drill-down, rich timeline, or full interaction detail/editing experience.

**[DECIDED]** Profile layout/template system owns History section position, show/hide, and default expanded/collapsed state.

**[DECIDED]** Phase 11 owns History section internals and deeper routes.

**[DERIVED]** Build History as a replaceable Profile section renderer/slot so Phase 11 can upgrade its content without modifying Profile layout persistence or composition architecture.

---

## AK. Profile Overflow / Administration

**[DECIDED]** Profile overflow is the primary Profile/contact administration menu.

**[DECIDED]** Actual contact actions appear before presentation-management actions.

Initial conceptual ordering:
1. Edit Contact
2. Snooze / Unsnooze
3. Archive
4. Edit Profile Layout
5. Switch Contact Layout
6. Background
7. Save Current Layout as Template, when relevant
8. Reset Profile Presentation

**[DECIDED]** Favorite remains directly available in the Hero and need not be duplicated in overflow.

**[DECIDED]** Quick Log, Log Contact, Update Contact, and Memory remain with the universal FAB rather than being duplicated here.

**[DERIVED]** Exact wording/group separators may be tuned during implementation.

---

## AL. Template and Background Management

**[DECIDED]** Profile layout templates and background templates require canonical management routes/screens.

**[DECIDED]** Those managers are owned by the Profile feature rather than being implemented twice.

**[DECIDED]** Later Settings & Personalization may link into the same canonical management routes.

**[DECIDED]** Template/background management may expose create, rename, edit, preview, global assignment, Category assignment, contact assignment, remove/reset assignment, and approximate assignment usage where useful.

**[DERIVED]** General Category creation/rename/reorder/delete remains Settings/Contacts Administration scope; Profile management only consumes available Categories as assignment targets.

---

## AM. Accessibility

**[DECIDED]** Profile customization must remain operable without precise drag-only interaction.

**[DERIVED]** Reorder operations require accessible alternatives such as Move Up / Move Down or equivalent actions.

**[DECIDED]** Status meaning is exposed textually; users are not required to interpret colors or celestial iconography.

**[DECIDED]** Disabled Message/Call controls expose why the action is unavailable.

**[DECIDED]** Gravity's visual sphere-size meaning is accompanied by a named tier.

**[DECIDED]** Intensity's histogram is accompanied by textual semantics/tier/context.

**[DECIDED]** Linked/unlinked Relationships expose names and relation semantics without depending on avatar recognition.

**[DECIDED]** Hidden/visible, expanded/collapsed, selected template, assignment, and edit-mode state are exposed accessibly.

**[DERIVED]** Large text may increase card/tile height and force narrower tile grids rather than shrinking text below accessible sizes.

---

## AN. Responsive Behavior

**[DERIVED]** Hero and ordinary list/card sections should reflow conventionally on wider/narrower devices.

**[DERIVED]** Relationship Overview tile grid should derive column count and packing from available width.

**[DERIVED]** Large accessibility text may reduce the effective grid column count.

**[DERIVED]** Profile customization architecture must not encode portrait-only absolute positions.

**[DEFERRED]** Final tablet/landscape polish and cross-device performance budgets belong to Responsive & Release Hardening.

---

## AO. Derived Profile Architecture

**[DERIVED]** Use a central Profile section/module registry rather than hardcoding layout behavior directly into one monolithic Profile component.

Conceptually, registry metadata may describe:
- section/module ID,
- display name,
- parent section,
- default visibility,
- default order,
- default expanded/collapsed state,
- supported size variants,
- whether hide/show is allowed,
- whether it is fixed,
- renderer/component,
- accessibility metadata,
- preview behavior.

**[DERIVED]** Separate:
1. semantic contact/Profile data,
2. reusable Profile layout definitions,
3. layout/background assignments,
4. contact-specific presentation overrides,
5. section/module renderers.

**[DERIVED]** Later phases should replace or deepen section renderers without rewriting the layout engine.

**[DERIVED]** Profile templates should reference semantic module IDs rather than component names or storage-specific implementation details.

---

## AP. Cross-Phase Constraints

- **App Shell & Navigation:** Profile remains a browse/read destination with origin-aware Back, persistent bottom nav/FAB, and focused-workflow exceptions for layout editing and child workflows.
- **Theme & Visual System:** Profile uses semantic tokens; Galaxy/Standard may differ aesthetically but not structurally. Cards should remain restrained and purposeful rather than wrapping every field in oversized containers.
- **Contact Knowledge Foundation:** authoritative for first-class fields, typed Memories, history-aware values, structured Relationships, Custom Fields, Profile visibility, pinning, AI permission, Off Limits semantics, imported notes, and semantic type metadata.
- **Dashboard:** Profile does not redefine Dashboard status/search/favorite semantics.
- **Orrery:** Orbit Status and Gravity presentation must remain semantically consistent with Orrery even when visually different.
- **Orrery Systems / Categories:** Profile may consume Categories for template/background assignment; it does not use Systems as Profile-layout groups.
- **Interaction History & Insights:** owns final heatmap/timeline/date drill-down/detail/edit experience; Profile owns only the section seam and minimal interim summary.
- **Rapid Capture & Update Flows:** owns Add Contact, detailed Log Contact, Update Contact, and substantive edit workflows. Profile links/routes into them.
- **Messaging & AI Compose:** owns Message composition, AI invocation, contextual prompting, Copy/Send/Cancel, and messaging error behavior.
- **Settings & Personalization:** later links to canonical Profile layout/background managers and owns general Category administration.
- **AI Configuration & Prompting:** owns central AI permission/configuration review; Profile only reflects item-level AI-enabled state where appropriate.
- **Onboarding:** may introduce Profile customization/background capability if useful but does not redefine the feature.
- **Responsive & Release Hardening:** audits Profile accessibility, landscape/tablet behavior, large-text reflow, tile packing, image-memory behavior, and final device performance.

---

## Explicitly Deferred

- unrestricted page-builder behavior
- arbitrary x/y tile placement
- arbitrary user-resizable tile dimensions
- third-level customizable Profile nesting
- individual Memory drag ordering
- Systems/Favorites/Status/Gravity-rule-based Profile assignment groups
- overlapping dynamic-group inheritance rules
- layout-template control of Hero structure
- advanced Profile background effects/editor
- remote/downloadable Profile background packs
- exhaustive type-specific card artwork for every Memory/custom-field type
- final Interaction History heatmap/timeline/detail UX
- new Status algorithm factors or user-tunable Status weighting
- new Health metric separate from Orbit Status
- Gravity editing
- final Gravity size mapping values
- final Intensity bin/tier formulas
- general Category CRUD
- full AI permission management
- full Messaging / AI Compose UX
- final responsive/tablet/landscape polish
- exact animation timings and microinteraction curves

---

## Phase Success Criteria

1. Profile presents a strong fixed Hero with large avatar, clear identity, Category, Favorite, Message, Call, overflow, and optional theme/user Profile background.
2. The Profile body is modular: supported top-level sections can reorder/hide/show, supported child sections can reorder within their parent, and expanded/collapsed state can persist per contact.
3. Reusable Profile layout templates support global, Category, and contact assignment with deterministic override/inheritance semantics.
4. Reusable Profile background templates independently support global, Category, and contact assignment with contact overrides protected from Category changes.
5. Layout editing is a focused Save/Cancel workflow with accessible reordering, all eligible sections visible, live preview, and template creation/switching.
6. The factory Profile order is Relationship Overview → Things to Remember → Contact Methods → Interaction History below the fixed Hero.
7. Relationship Overview uses a compact automatically packed tile grid with supported size variants rather than a fixed list or unrestricted dashboard builder.
8. Existing Orbit Status is prominently presented and transparently explained using current recency + Contact Frequency semantics without inventing a new Health metric or tunable weighting.
9. Gravity uses a named tier plus a wide-range size-coded sphere; Intensity uses a cadence-aware bar/histogram; both remain understandable without relying solely on graphics.
10. Last Interaction, Contact Frequency, and Snooze function as modular relationship tiles, with immediate Frequency updates and a lightweight custom Snooze duration/date path.
11. Contact Methods show useful ordinary-sized method sets directly, preserve malformed/imported values visibly, and expose valid actions appropriately.
12. Things to Remember presents one-column configurable child sections using compact semantic cards that omit blank metadata and avoid oversized form-like summaries.
13. Pinned/Featured, Last Talked About, Relationships, Location, Memories, Custom Fields, Off Limits, and Imported Notes follow the settled current-first/compact/drill-in presentation rules.
14. Memory and knowledge cards support tap-to-detail and long-press Edit / Pin / Hide behavior without permanent inline management clutter.
15. Hidden Profile content remains recoverable from Profile administration and appropriate View All surfaces, and hiding never changes privacy/deletion/AI semantics.
16. Off Limits is clearly and visibly presented by default as `avoid bringing these up`, distinct from error state and distinct from AI permission.
17. Interaction History exists as a configurable bottom Profile section with minimal interim content and a stable renderer seam for Phase 11 replacement.
18. Profile overflow prioritizes Edit/Snooze/Archive before presentation-management actions and does not duplicate universal FAB mutation workflows.
19. Profile layout/background managers are canonical reusable feature routes that Settings can link into later.
20. Profile remains accessible under large text, reduced precision/motor interaction, screen readers, theme changes, and responsive width changes.

---

## Notes for GSD / Roadmapper

- Treat this as the Profile composition/presentation phase after Orrery Systems.
- Do not delay the entire Profile phase until Interaction History, Rapid Capture, or Messaging are implemented. Build stable section/route seams and let later phases replace section internals.
- Do not pull Phase 11's full heatmap/timeline/detail editing into Profile.
- Do not pull Phase 13's (Rapid Capture & Update Flows) forms/business workflows into Profile merely because Profile links to Edit/Log/Update.
- Do not pull Phase 14's Message/AI Compose implementation into the Profile Hero action itself.
- Do not pull general Category CRUD into Profile. Profile consumes Category definitions for presentation assignment.
- Keep layout templates and background templates independent.
- Initial presentation-assignment scopes are global/default, Category, and contact only.
- Do not use Orrery Systems, Favorites, Status buckets, Gravity ranges, or arbitrary dynamic rules as Profile-template assignment groups in this milestone.
- Keep the Hero structurally fixed; customization begins below it.
- Relationship Overview is the intentional stats/tile exception. Most other Profile content should remain compact one-column reading surfaces.
- Memory cards must not regress into exhaustive form-like cards with blank rows.
- Build Profile composition through semantic section/module IDs and a registry so later section upgrades do not require layout-state migrations or monolithic screen rewrites.
