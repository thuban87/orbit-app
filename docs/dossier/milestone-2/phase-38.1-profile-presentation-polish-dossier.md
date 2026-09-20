# Dossier --- Phase 38.1: Profile & Presentation Polish

**Status:** ready for planning · Interrogated through 2026-09-19 · Product contract settled against the post-Phase-38 Milestone 2 repository.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.
- **[PLANNING NOTE]** repository finding to verify at execution time.

## Scope
Phase 38.1 is an inserted polish phase between completed Phase 38 and Phase 39 Onboarding. It corrects presentation regressions and interaction friction across Orrery, Contact Profile, Interaction History, and Contacts before onboarding is designed around those surfaces.

This is not a generic cleanup phase. It establishes durable presentation rules, makes existing profile knowledge genuinely editable, fixes layout behavior, and performs a bounded audit for the same defect classes. It does not add new relationship-domain concepts or broadly redesign Profile, Contacts, Orrery, or History.

# A. Phase Boundary
**[DECIDED]** Complete 38.1 before Phase 39 Onboarding.

**[DERIVED]** Onboarding should describe the cleaned-up product rather than UI already known to be changing.

**[DECIDED]** Reusable components may be repaired where necessary, but adjacent feature expansion is out of scope.

**[DECIDED]** Newly discovered feature ideas not required by this dossier are deferred.

**[DECIDED]** A closing audit may search for the same defect classes established here; it is not an unbounded polish pass.

# B. Orrery Surface Semantics
**[DECIDED]** Orrery floating cards/panels must be translucent rather than effectively transparent.

**[DECIDED]** They should still reveal that the Orrery continues behind them while remaining opaque enough for effortless control/text readability.

**[DECIDED]** Orrery floating UI receives its own semantic surface treatment rather than inheriting ordinary dashboard/profile card opacity.

**[DERIVED]** Future changes to ordinary content-card translucency must not unintentionally change Orrery overlay readability.

**[DECIDED]** Apply this treatment consistently to applicable Orrery controls, system selector, focus/context surfaces, cluster panels, view options, and comparable overlays.

**[DERIVED]** Prefer one reusable Orrery overlay/control-surface contract over individually tuning every panel.

# C. Orrery Navigation Controls
**[DECIDED]** Replace the current combined card containing Contacts, Recenter, and Center-North with three independent control cards/buttons.

**[DECIDED]** Remove visible button copy; retain the current icons.

**[DECIDED]** Keep the three controls tightly grouped with a small consistent gap.

**[DECIDED]** All three controls use the same square dimensions.

**[DECIDED]** Size means icon plus appropriate padding/touch target, not a tiny intrinsic-icon box.

**[DECIDED]** Use the new Orrery-specific translucent surface treatment.

**[DECIDED]** Preserve current icons unless label removal reveals a genuine comprehension problem during UAT.

**[DECIDED]** Provide explicit accessibility labels for Contacts, Recenter, and Center North.

# D. Contact Profile Heading Ownership
**[DECIDED]** Every semantic section/subsection receives at most one visible heading.

**[DECIDED]** Parent containers own section headings; nested renderers must not repeat headings already supplied by their container.

**[DECIDED]** Meaningful subsections retain distinct headings. Do not flatten Profile hierarchy.

**[DECIDED]** Section headings are identifiers only. Remove current values, metadata, inferred state, and empty-state copy from headings.

For example, `Things to Remember — Nothing added yet` becomes simply `Things to Remember`. Content state belongs inside the section body.

**[PLANNING NOTE]** The owner has observed incorrect heading metadata claiming nothing is saved when content exists. Do not merely make that inference smarter; remove this class of heading metadata.

**[DERIVED]** Fix heading/content ownership systematically rather than hiding individual duplicates.

# E. Profile Content Semantics
**[DECIDED]** Classify Profile modules by their underlying semantics instead of forcing one generic presentation template.

Planning should distinguish at least:
- single/current value;
- latest value plus historical values;
- ordinary collection;
- relationship collection;
- purpose-built activity/history presentation.

**[DECIDED]** Do not impose latest/history treatment where recency is not meaningful.

**[DECIDED]** Outer section headings contain no duplicate content metadata. Values belong inside content/subsection presentation.

**[DERIVED]** The fix must address repeated values as well as repeated headings.

# F. Temporal Knowledge: Most Recent & Previous
**[DECIDED]** Where a module naturally represents a latest item plus history, explicitly present **Most Recent** and **Previous**.

Example:

```text
Last Talked About

MOST RECENT
GPT Astra release
September 18

PREVIOUS
New job
September 10

Vacation plans
August 28
```

**[DECIDED]** Label the latest subsection `Most Recent` for now.

**[DECIDED]** Label older entries `Previous`.

**[DECIDED]** With one record, show Most Recent and omit Previous.

**[DECIDED]** With no records, use the appropriate neutral empty state rather than empty subsection shells.

**[DECIDED]** Cap the visible Previous preview on Profile at **five items**.

**[DECIDED]** The dedicated collection/editor screen contains the complete history.

**[DERIVED]** The Most Recent item must not be repeated in Previous.

# G. Profile Editing
**[DECIDED]** Remove applicable full-width/row-level `Manage` affordances.

**[DECIDED]** Add an edit icon beside the relevant subsection/row heading.

**[DECIDED]** Separate open/view and edit behavior: tapping content uses its normal view/detail behavior; tapping the edit icon enters editing.

**[DECIDED]** A subsection edit icon manages the whole collection, not only the displayed/latest item.

**[DECIDED]** Editing remains on dedicated screens rather than expanding full editors inline on Profile.

**[DECIDED]** Editors expose all currently supported editable data the existing model legitimately allows users to change.

**[DECIDED]** Where supported, editors provide meaningful add/edit/delete operations.

**[DECIDED]** Meaningful destructive record deletion uses normal confirmation where appropriate; ordinary edits do not require unnecessary confirmation.

**[DECIDED]** Do not invent new fields, tags, importance/source metadata, or other knowledge concepts for this phase.

**[DERIVED]** Existing generic/bare management routing should carry enough intent/context to reach a genuinely editable collection/item experience.

# H. Contact Binding Lifecycle
**[DECIDED]** Remove the prominent `Unbind Contact` button from the main Profile body.

**[DECIDED]** Move Unbind Contact into the Profile overflow menu.

**[DECIDED]** Preserve existing confirmation and lifecycle behavior.

**[DECIDED]** Present Unbind as a lifecycle/destructive-style menu action without equating it with deletion.

**[DECIDED]** For an already Unbound contact, retain the meaningful Bind experience on Profile because binding requires configuration and communicates lifecycle state.

# I. Relationship Overview Packing
**[DECIDED]** Preserve the user's configured module order.

**[DECIDED]** Full-width modules remain full-width.

**[DECIDED]** Half-width modules pair when possible in configured sequence.

**[DECIDED]** If a half-width module would be orphaned, stretch its container to full width rather than leaving an empty half-row.

**[DECIDED]** Do not pull later half-width modules upward across intervening full-width modules to fill holes.

**[DECIDED]** Do not add Half/Full labels or manual width controls to the layout editor.

**[DECIDED]** Orphan stretching changes occupied width, not the semantic design of the card.

**[DECIDED]** Center the contents of **all Relationship Overview/Relationship Status cards at all times**, whether occupying half or full width.

**[PLANNING NOTE]** Verify responsive and large-font behavior so centered content and stretching do not create clipping.

# J. Interaction History Year Heatmap
**[DECIDED]** Year heatmap progression becomes vertical rather than horizontal.

**[DECIDED]** Preserve the week/day heatmap concept rather than replacing it.

**[DECIDED]** Month and Year follow the same broad mobile convention: vertical page scrolling, no horizontal heatmap scrolling, interactive cells where supported, day interaction access, and existing lens switching.

**[DERIVED]** Remove the horizontally scrolling Year heatmap requirement while preserving intensity/selection/accessibility semantics.

# K. Timestamp Precision
**[DECIDED]** Explicit user-facing timestamps display precision through the **minute**, not the second, unless seconds are genuinely meaningful to the feature.

Preferred: `Sep 19, 2026, 7:14 PM` rather than `Sep 19, 2026, 7:14:37 PM`.

**[DECIDED]** This is an application-wide presentation rule, not only a Relationship Status fix.

**[DECIDED]** Stored/internal timestamp precision remains unchanged.

**[DECIDED]** Relative language such as `2 hours ago`, `Yesterday`, or `5 days ago` is unaffected.

**[DERIVED]** Prefer shared formatting behavior where practical so seconds do not reappear through one-off formatters.

**[PLANNING NOTE]** Relationship Status/Profile is a known visible offender and must be explicitly verified.

# L. Contacts Grid Density
**[DECIDED]** Normal Contacts Grid cards show two textual information rows: contact name and last-contact/recency information.

**[DECIDED]** Remove the ordinary profile excerpt/third line from Grid cards.

**[DECIDED]** Contacts List view retains its existing third-line excerpt behavior.

**[DECIDED]** During search, Grid may temporarily use a third line when it explains why the contact matched.

**[DERIVED]** Search-match context is semantically different from the routinely truncated normal excerpt.

# M. Accessibility & Themes
**[DECIDED]** Standard and Galaxy retain identical information architecture and interaction semantics.

**[DERIVED]** Orrery translucency must remain readable against the actual visualization.

**[DERIVED]** Icon-only Orrery controls and Profile edit icons require accessible names and adequate hit targets.

**[DERIVED]** Heatmap selection semantics must survive the orientation change.

**[DERIVED]** Relationship Overview packing/centering must remain usable with large fonts.

# N. UAT Matrix
**[DECIDED]** Profile UAT must deliberately cover:
- no relevant data;
- exactly one item;
- multiple items;
- history exceeding the five-item Profile preview;
- Bound contact;
- Unbound contact;
- multiple full/half Relationship Overview arrangements, including orphan cards;
- Standard and Galaxy presentation where relevant.

**[DERIVED]** UAT should verify:
- no duplicate headings or repeated latest metadata;
- no false heading copy such as `Nothing added yet`;
- Most Recent is excluded from Previous;
- Previous caps at five Profile items;
- edit icons reach genuinely editable screens;
- Unbind is absent from the Profile body and present in overflow;
- Relationship Overview content stays centered;
- Year heatmap requires no horizontal scrolling;
- visible explicit timestamps omit seconds;
- normal Grid cards omit excerpts while List cards retain them;
- search Grid cards may still explain matches;
- Orrery controls are readable, uniform, grouped, and accessible.

# O. Bounded Cross-App Audit
**[DECIDED]** After primary implementation, audit for the same rules established by this phase:
- visible explicit timestamp formatters exposing unnecessary seconds;
- Contact Profile layers repeating semantic headings/values;
- applicable Orrery overlays still coupled to ordinary content-card opacity;
- targeted Profile editing affordances still leading to bare/non-functional destinations.

**[DECIDED]** This does not authorize unrelated cleanup, broad navigation changes, new features, or repository-wide refactoring.

# P. Explicit Deferrals
**[DEFERRED]** New Profile modules or broad Profile redesign.

**[DEFERRED]** New knowledge fields/data concepts.

**[DEFERRED]** Tags, importance/source metadata, or richer taxonomy added solely for the editors.

**[DEFERRED]** Broad Contacts redesign beyond Grid-card density.

**[DEFERRED]** Relationship Overview manual width controls or layout-editor annotations.

**[DEFERRED]** New heatmap visualization paradigms or long-range history redesign.

**[DEFERRED]** User-configurable Orrery overlay opacity.

**[DEFERRED]** Orrery icon redesign unless label removal exposes a real comprehension issue.

**[DEFERRED]** Generic app-wide polish beyond the named defect classes.

# Q. GSD / Planning Guardrails
**[DERIVED]** Do not create one plan per bullet. Group changes by coherent ownership.

A sensible planning shape is likely:

1. **Orrery surface semantics + navigation controls**
   - decouple overlay opacity;
   - apply reusable Orrery surfaces;
   - split navigation actions into uniform icon-only controls;
   - preserve accessibility/touch targets.

2. **Profile hierarchy + lifecycle cleanup**
   - establish heading ownership;
   - remove heading metadata/false empty-state copy;
   - classify module semantics;
   - move Unbind to overflow.

3. **Profile knowledge presentation + editing**
   - Most Recent/Previous;
   - five-item Previous preview;
   - replace Manage rows with edit icons;
   - make dedicated editors functional using the existing model.

4. **Relationship Overview packing**
   - preserve order;
   - pair half-width cards;
   - stretch orphans;
   - center all card content;
   - verify font/responsive behavior.

5. **History + timestamp presentation**
   - vertical Year heatmap;
   - eliminate horizontal Year scrolling;
   - establish no-seconds display formatting and audit offenders.

6. **Contacts Grid density + bounded regression/UAT**
   - remove normal Grid excerpt;
   - preserve List excerpt/search context;
   - execute bounded audit and physical-device UAT.

This is planning guidance, not a mandated plan count.

# R. Planning-Time Verification Checklist
Before GSD decomposes Phase 38.1 against the execution-time repository:

1. Inventory Orrery floating surfaces and identify their current shared opacity/surface dependency.
2. Verify all three Orrery navigation actions, icons, labels, and current placement.
3. Inventory Contact Profile heading ownership across parent sections and nested renderers.
4. Classify Profile modules by current-value, temporal-history, collection, relationship, or purpose-built history semantics.
5. Verify canonical ordering/identity for temporal knowledge so Most Recent and Previous cannot duplicate.
6. Verify the existing full-history destination and five-item Profile preview boundary.
7. Inventory current Manage/edit routes and determine which lack enough context or editing capability.
8. Verify existing model-supported fields and CRUD operations before expanding editor UI.
9. Verify Bound/Unbound lifecycle actions and existing Unbind confirmation before relocating it.
10. Inspect Relationship Overview width metadata and packing logic; test orphan arrangements without reordering.
11. Verify all Relationship Overview cards can center content at half and full width.
12. Inspect Year heatmap orientation/container behavior and preserve day-selection semantics.
13. Inventory explicit user-facing timestamp formatters, prioritizing Profile/Relationship Status.
14. Verify GridCard/ListRow separation and search-match snippet behavior.
15. Run the specified data-density/lifecycle/theme UAT matrix on physical Android hardware.

---

## Dossier Summary
Phase 38.1 is a focused post-Phase-38 polish pass that establishes cleaner presentation contracts before onboarding begins.

Orrery overlays become properly translucent and decoupled from ordinary content-card opacity, while its combined navigation card becomes three uniform icon-only glass controls. Contact Profile gains strict heading ownership: headings identify sections, while actual values and state live in content. Temporal knowledge uses an explicit Most Recent/Previous hierarchy, with up to five previous items previewed on Profile and complete management on dedicated screens.

Bare `Manage` rows are replaced by heading-level edit affordances that reach genuinely editable collection screens without expanding the data model. Unbind moves into Profile overflow. Relationship Overview preserves configured order, pairs half-width cards where possible, stretches orphan cards instead of leaving holes, and centers all card contents. Year heatmaps become vertically flowing, explicit timestamps lose unnecessary seconds application-wide, and normal Contacts Grid cards drop their truncated third-line excerpts while List and search-context behavior remain useful.

The phase closes with a bounded audit and deliberate UAT across empty, single-item, multi-item, long-history, Bound/Unbound, layout, theme, and accessibility states. The planning priority is not broad redesign; it is to make the existing Milestone 2 product coherent, editable, readable, and stable enough to serve as the baseline for Phase 39 Onboarding.
