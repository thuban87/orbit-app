# Dossier — Orrery Systems

**Status:** complete · Interrogated through 2026-08-31 · Custom System authoring, management, switching, persistence, preview, and safeguards settled.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope

This dossier defines Orbit's **Orrery Systems** product: named, dynamically resolved subsets of contacts that can be switched in the Orrery and authored/managed by the user.

It covers:
- custom System membership semantics,
- rule-based and manually curated membership,
- built-in/category-derived System overrides,
- System creation/editing HUD,
- rule accordion interaction,
- Manage Members multi-select,
- full-canvas preview,
- Systems Management CRUD/reordering/visibility,
- category-deletion fallout,
- System switching and transition semantics,
- persistence,
- empty/broken states,
- deletion/duplication,
- backup/restore,
- accessibility and reduced-motion behavior.

It intentionally does **not** redefine the Phase 8 Orrery camera, 2.5D projection, high-contact-count renderer, relationship-health layout, focus/cluster-focus mechanics, or Relationship Satellite rendering. It consumes those capabilities.

---

# A. Product Concept

**[DECIDED]** A **System** is a named Orrery view whose membership is resolved from current/live Orbit contact data.

**[DECIDED]** Systems are not static snapshots of contact IDs unless the System is intentionally manual-only.

**[DECIDED]** Systems are Orrery concepts, not app-wide generic saved searches.

**[DECIDED]** The canonical built-in `All Contacts` System remains the default/factory Orrery System.

**[DECIDED]** The last active System persists across app relaunch.

**[DEFERRED]** A separate configurable startup/default System. Last-active persistence is sufficient initially.

---

# B. System Membership Model

**[DECIDED]** Custom Systems support one unified hybrid membership model with:
1. dynamic rule-based membership,
2. explicit manual inclusions,
3. explicit exclusions of contacts currently produced by the rules.

**[DECIDED]** Manual-only Systems are fully valid and require no rule definition.

**[DECIDED]** Users are not forced to choose a System “type” such as Rule-Based vs Manual vs Hybrid before authoring.

**[DERIVED]** The persisted System definition should separately represent rules, manual inclusions, and currently relevant exclusions.

---

# C. Rule Combination Semantics

**[DECIDED]** System rules reuse the Dashboard mental model where semantics match:
- OR within one rule/filter family,
- AND across different rule/filter families.

Example:

`(Family OR Friends) AND (High Gravity OR Very High Gravity) AND Needs Attention`

**[DECIDED]** Do not expose arbitrary boolean-query programming in the initial System builder.

**[DECIDED]** Systems do not initially reference/nest other Systems.

**[DERIVED]** Reuse shared predicate/domain logic rather than sharing Dashboard UI/query state directly.

**[DEFERRED]** System-to-System composition/nesting.

---

# D. Initial Custom-System Rule Families

**[DECIDED]** Initial rule vocabulary may include:
- Category
- Favorite
- Relationship Status / Needs Attention
- Gravity / Closeness
- Social Battery
- Contact Frequency
- Not Contacted
- Snoozed

**[DECIDED]** Birthday is omitted from the initial custom-System rule builder.

**[DERIVED]** Rule evaluation must consume canonical shared domain semantics rather than reimplementing equivalent predicates inside Orrery Systems.

---

# E. Manual Inclusion and Exclusion Semantics

**[DECIDED]** Explicit manual inclusion overrides the ordinary rule result.

A contact may therefore belong to a System even when the contact does not satisfy the System rules.

**[DECIDED]** Exclusions apply to contacts currently produced by the System's dynamic rules.

**[DECIDED]** Rule-derived Systems are **dynamic buckets, not ledgers**.

If a contact was explicitly excluded while matching the System rules and later stops satisfying those rules, the exclusion is no longer meaningful and is discarded.

If that contact later satisfies the rules again, the contact is included normally unless excluded again.

**[DECIDED]** Durable manual inclusions remain explicit user-authored membership until the user removes them, subject to ordinary contact lifecycle eligibility.

**[DERIVED]** Do not accumulate invisible stale exclusions for contacts no longer eligible under the base rule set.

**[DECIDED]** `Reset Membership Overrides` removes manual includes/excludes while preserving the System's rule definition.

---

# F. Contact Lifecycle and Eligibility

**[DECIDED]** `Add People` searches eligible active contacts rather than silently including Archived or Unbound contacts.

**[DECIDED]** If a manually included contact later becomes Archived, the manual inclusion remains in the System definition but the contact is temporarily ineligible and not rendered.

**[DECIDED]** The editor may show such a contact as unavailable/Archived where relevant.

**[DERIVED]** Restoring the contact to an eligible lifecycle state causes the manual inclusion to take effect again without requiring the user to recreate it.

---

# G. Built-In Systems

**[DECIDED]** Phase 8 provides the initial built-in/automatic Systems; Phase 9 manages them.

Initial built-ins include:
- All Contacts
- Favorites
- Needs Attention
- Not Contacted
- Snoozed
- Chargers
- automatically generated one-per-Category Systems

**[DECIDED]** Built-in base definitions are immutable.

**[DECIDED]** Users may layer manual inclusion/exclusion overrides on top of built-in base definitions.

**[DECIDED]** Built-ins cannot be renamed.

**[DECIDED]** Built-ins may be hidden from the Orrery switcher except `All Contacts`, which remains visible and pinned.

**[DECIDED]** Customized built-ins visibly indicate that membership overrides exist.

**[DECIDED]** Built-ins can be duplicated into ordinary custom Systems, at which point the equivalent predicate becomes editable.

---

# H. Category-Derived Systems

**[DECIDED]** One automatic Orrery System exists for each user Category.

**[DECIDED]** Category-derived Systems behave similarly to built-ins:
- generated automatically,
- cannot be independently deleted,
- may be hidden,
- may carry manual membership overrides,
- may be duplicated into a fully custom System.

**[DECIDED]** Renaming a Category automatically renames its generated System.

**[DECIDED]** Deleting a Category removes the generated Category System.

**[DERIVED]** Category administration must warn when deleting a Category whose generated System has membership overrides or whose Category predicate is used by custom Systems.

---

# I. Broken Rule Semantics

**[DECIDED]** If a saved rule references something that later ceases to exist, Orbit does not silently delete or rewrite the rule.

Example: custom System references Category `Coworkers`, then the Category is deleted.

**[DECIDED]** The now-unavailable rule remains visible in the System definition as needing attention.

**[DECIDED]** Remaining valid rules and manual inclusions continue resolving normally.

**[DECIDED]** Category deletion does not require a separate multi-System reconciliation wizard.

Category deletion confirmation may explain that affected Systems will retain unavailable rules requiring later attention.

**[DECIDED]** Users repair affected Systems through their ordinary System editors.

---

# J. Empty vs Broken Systems

**[DECIDED]** A valid System with zero current members remains a valid selectable System.

**[DECIDED]** A System with unavailable/broken rules also remains selectable and continues resolving whatever valid definition remains.

**[DECIDED]** Empty and broken conditions use different visual severity.

Direction:
- Empty but valid → mild caution/empty indicator, e.g. yellow-triangle family.
- Broken/needs attention → stronger error/configuration indicator, e.g. red-stop/error family.

Exact icon artwork/colors resolve through the semantic icon/theme system.

**[DECIDED]** The System dropdown exposes these state indicators.

**[DECIDED]** Broken Systems may also show a small nonblocking `needs attention` affordance in the Orrery.

**[DECIDED]** Empty-System presentation is intentionally more lively than a generic blank screen.

Direction:
- empty Orrery canvas,
- concise empty-state copy,
- a restrained comet crossing the scene as decorative feedback,
- no constant distracting loop.

**[DERIVED]** Reduced Motion replaces/removes the comet motion with a static or simpler treatment.

---

# K. New/Edit System Surface

**[DECIDED]** System creation/editing uses a specialized **floating Orrery HUD wizard** rather than a conventional modal form.

**[DECIDED]** The builder appears over a fresh/canonical Orrery canvas.

**[DECIDED]** This HUD is intentionally allowed to differ visually from Orbit's ordinary modal/sheet language as an Orrery-specific experimental control surface.

**[DECIDED]** The builder uses multiple internal pages/states rather than forcing all configuration into one flat form.

---

# L. Builder — Definition Page

**[DECIDED]** The first builder page contains:
- Back/Cancel
- System name
- dynamic rule configuration
- current match count
- `Manage Members`
- Save where appropriate

**[DECIDED]** Rule families appear as vertically stacked collapsible/accordion sections.

**[DECIDED]** Collapsed accordion headers summarize active values using meaningful labels, not only numeric counts.

Examples:
- `Category · Friends, Community`
- `Gravity · Close +1`
- `Social Battery · Chargers`

**[DECIDED]** `Manage Members` remains available even when no rules are selected, enabling manual-only Systems.

---

# M. Builder — Manage Members

**[DECIDED]** Manage Members reuses the existing canonical picker/selection foundation rather than inventing an unrelated contact selection system.

**[DECIDED]** The System specialization uses a simple multi-select grid with:
- contact photo/avatar,
- contact name,
- selection state.

**[DECIDED]** Rule-derived matching contacts enter Manage Members already selected.

**[DECIDED]** Selecting/deselecting a rule-derived member expresses an explicit exclusion without immediately removing that contact card from the current Manage Members result.

**[DECIDED]** Excluded rule-derived members remain visible while still matching the rules, visually greyed/de-emphasized with a subtle Excluded state.

**[DECIDED]** `Add People` allows manual inclusion of otherwise nonmatching eligible active contacts.

**[DECIDED]** Manually altered members receive enough presentation to make the override understandable when the builder is reopened.

**[DECIDED]** Manage Members exposes useful counts, e.g. total members plus added/excluded override counts.

**[DERIVED]** The full resolved member set remains inspectable through a virtualized/searchable grid; do not arbitrarily truncate membership presentation.

---

# N. Builder — Preview

**[DECIDED]** Preview is full-canvas rather than a tiny preview box inside the HUD.

**[DECIDED]** Entering Preview collapses the large builder HUD into a small floating Preview/Edit bar while the Orrery canvas displays the provisional System.

**[DECIDED]** Preview uses the real Phase 8 layout/scale model with simplified rendering.

Expected preview rendering:
- sun,
- orbital rails,
- simple body markers,
- approximate real body sizing/layout,
- no requirement for final photos/labels/decorative effects.

**[DECIDED]** Preview answers both membership and scale questions before Save.

**[DECIDED]** Preview supports pan and zoom.

**[DECIDED]** Preview does not initially expose tilt/yaw.

**[DECIDED]** Preview planet interaction may identify/focus a body but does not open Profile because the user is inside an unsaved focused workflow.

**[DECIDED]** Save is available without forcing Preview, and may also be available from Preview so a satisfied user need not reopen the full HUD merely to save.

**[DECIDED]** `Edit` restores the full HUD at the prior builder state.

---

# O. Builder Membership Feedback

**[DECIDED]** The builder provides detailed membership feedback, not only a count.

**[DECIDED]** Users can inspect actual member names/photos through Manage Members.

**[DECIDED]** Preview visually communicates expected Orrery scale/density for large System memberships.

**[DERIVED]** The live membership query may update while the builder is open, but the production Orrery behind the builder does not repeatedly rebuild on every rule toggle.

---

# P. Save Behavior

**[DECIDED]** Saving a newly created System switches the Orrery to that new System.

**[DECIDED]** Editing the currently active System keeps it active and updates its resolved membership.

**[DECIDED]** Editing a non-active System returns to management without unexpectedly changing the user's active System.

**[DECIDED]** Meaningful unsaved changes inherit the existing `Discard changes` / `Keep editing` focused-workflow contract.

---

# Q. Systems Management Screen

**[DECIDED]** Systems have a conventional flat Systems Management screen separate from the Orrery switch dropdown.

**[DECIDED]** Entry points:
- Orrery System dropdown → Manage Systems
- Settings may route into the same canonical Systems Management screen

**[DECIDED]** The management page owns administration rather than turning the Orrery dropdown into a CRUD surface.

**[DECIDED]** Management supports:
- create custom System,
- edit custom System,
- rename custom System,
- delete custom System,
- duplicate System,
- reorder visible Systems,
- hide/show built-in and category-derived Systems,
- edit/reset built-in/category-derived membership overrides.

**[DECIDED]** `Create New System` is available from the management page.

**[DECIDED]** `All Contacts` remains pinned first, visible, and nondeletable.

---

# R. Hiding / Deleting

**[DECIDED]**
- Built-in/category-derived Systems may be Hidden/Shown.
- Custom Systems do not need a separate Hide/Archive state; users may delete them.

**[DECIDED]** Deleting a custom System uses a simple confirmation.

**[DECIDED]** Deleting a System never deletes or modifies contact data.

**[DECIDED]** If the active System is deleted, Orrery falls back to All Contacts.

**[DECIDED]** Successful System deletion offers a short-lived Undo snackbar.

**[DECIDED]** System deletion does not use the 30-day contact quarantine lifecycle.

---

# S. Duplication

**[DECIDED]** Custom, built-in, and category-derived Systems may be duplicated.

**[DECIDED]** Duplicating a built-in/category System converts its base predicate into an ordinary editable custom-System rule.

**[DECIDED]** Duplicate naming is deterministic and uniqueness-aware.

Pattern:
- `Inner Circle Copy`
- `Inner Circle Copy 2`
- `Inner Circle Copy 3`

**[DECIDED]** The generated duplicate name is immediately editable in the builder.

---

# T. Naming

**[DECIDED]** System names are unique case-insensitively.

**[DECIDED]** Built-in names are protected enough to avoid indistinguishable custom-name collisions.

**[DECIDED]** There is no artificial product cap on the number of custom Systems.

**[DEFERRED]** System folders/tags.

---

# U. Ordering and Switcher

**[DECIDED]** Orrery uses a compact dropdown/current-System control for switching.

Working presentation:
`All Contacts ▾`

**[DECIDED]** The switcher is for switching, not full management.

**[DECIDED]** Dropdown order follows Systems Management order.

**[DECIDED]** `All Contacts` remains pinned first.

**[DECIDED]** Hidden Systems are omitted.

**[DECIDED]** The switcher displays dynamic member counts.

Examples:
- `All Contacts — 64`
- `Family — 12`
- `Inner Circle — 7`

**[DECIDED]** Zero-member Systems remain visible and selectable.

**[DECIDED]** Empty and broken Systems expose their distinct state indicators in the dropdown.

**[DEFERRED]** A separate Recent Systems section.

---

# V. System Switching Camera Behavior

**[DECIDED]** Switching Systems sends the destination System to its canonical Phase 8 Home framing rather than preserving arbitrary pan/zoom/tilt from the prior System.

**[DECIDED]** If the currently focused contact exists in both source and destination Systems, initial implementation should attempt to preserve that focus through the transition.

**[DECIDED]** If the focused contact does not exist in the destination, focus clears as the contact leaves.

**[DERIVED]** This behavior should be device-tested and may be simplified only if focus preservation proves disorienting.

---

# W. System Switch Animation

**[DECIDED]** Polished System switching uses a **spin + shedding/capture** visual model.

Narrowing:
- solar system gains rotational impulse,
- contacts not in the destination shed/peel away,
- retained contacts persist,
- destination geometry settles.

Expanding:
- new contacts stream/capture inward,
- retained contacts provide visual continuity,
- geometry settles.

**[DECIDED]** Transition intensity is adaptive to the **membership delta**, not simply raw source/destination member counts.

Systems with large membership overlap receive subtle transitions; large entering/leaving deltas receive more dramatic transitions.

**[DECIDED]** The animation must not unnecessarily lock out interaction; interaction resumes as soon as destination geometry is stable enough.

**[DECIDED]** Phase 8 may use a simpler functional System-switch transition; Phase 9 owns the polished spin/shedding/capture behavior.

**[DERIVED]** Exact spin count, velocity curves, particle/light-streak effects, timings, and easing are implementation/device-tuning work.

---

# X. Reduced Motion

**[DECIDED]** Reduced Motion is supported and is **not** the default.

**[DECIDED]** With OS Reduced Motion enabled, System switching replaces rotational sweep/shedding/capture with a simpler crossfade/reposition treatment.

**[DECIDED]** Reduced Motion is OS/shared-app derived rather than a System-specific setting.

---

# Y. Accessibility

**[DECIDED]** The specialized HUD remains fully operable without interacting with the Orrery canvas behind it.

**[DECIDED]** Rule accordions expose conventional accessible expanded/collapsed and selected state.

**[DECIDED]** Manage Members grid exposes clear multi-selection semantics.

**[DECIDED]** Preview provides a textual membership alternative/summary rather than making visual Orrery interpretation mandatory.

**[DECIDED]** When the full HUD is open, background Orrery interaction is removed from accessibility focus.

**[DECIDED]** Entering Preview moves focus appropriately to Preview controls; returning to Edit restores meaningful focus.

**[DERIVED]** Empty/broken state icons must have distinct textual semantics and cannot rely on hue alone.

---

# Z. Large-System Scale / Performance Contract

**[DECIDED]** Orbit does not impose an arbitrary product-level maximum System membership such as 100 or 300 contacts.

**[DECIDED]** Large Systems remain logically valid and inspectable.

**[DERIVED]** The production Orrery must not interpret this as a requirement to mount/render every contact at full photo/label/detail cost simultaneously.

**[DERIVED]** Phase 8 high-contact-count architecture should support viewport-aware culling and/or semantic level-of-detail so offscreen or very distant bodies do not carry unnecessary full rendering cost.

**[DERIVED]** Contact photos and rich labels should be loaded/rendered according to visibility/inspection need rather than assuming all System members require equivalent expensive presentation at once.

**[DERIVED]** The Phase 9 full-canvas builder Preview intentionally uses simplified body rendering, so even very large membership counts can communicate geometry/scale without loading full production decorations.

**[DERIVED]** Manage Members uses virtualization/search so hundreds of member cards remain inspectable without eagerly mounting the entire list.

**[DERIVED]** Concrete maximum tested counts and device-performance budgets belong to implementation/UAT and final release-hardening; failure to remain usable at realistically large local contact counts is a release-quality issue rather than a reason to impose an arbitrary saved-System cap.

---

# AA. Backup / Restore

**[DECIDED]** Backup/Restore preserves user-authored System state.

This includes:
- custom System definitions,
- rule definitions,
- manual inclusions,
- relevant persisted overrides,
- System ordering,
- built-in/category visibility state,
- built-in/category membership overrides,
- last active System preference,
- other persisted System configuration.

**[DERIVED]** Built-in definitions themselves need not be serialized as user data; their user-specific customization does.

---

# AB. Category Administration Gap

**[DERIVED / CROSS-PHASE WATCH]** Current Orbit Category values are durable data but require user-facing administration.

The milestone needs a later owning phase—most naturally Settings / Contacts Administration—to provide appropriate create/rename/reorder/delete Category management.

**[DERIVED]** Systems consume Category definitions but Phase 9 does not own general Category CRUD.

**[DERIVED]** Category deletion UX must account for:
- generated Category System disappearance,
- membership overrides attached to that generated System,
- custom System rules referencing the deleted Category.

Do not create a dedicated Systems-reconciliation wizard solely for Category deletion.

---

# AC. Cross-Phase Constraints

- **Phase 8 — Orrery Camera & Scale:** authoritative for camera, Home framing, 2.5D projection, density, focus/cluster focus, high-count rendering architecture, basic System switcher, built-in System availability, and Relationship Satellites.
- **Dashboard Data & State Foundation:** provides predicate semantics where reused; Orrery Systems does not share Dashboard's live UI state.
- **Dashboard Card/Grid:** selection concepts may be reused, but System member selection is a focused builder flow rather than navigation into Dashboard.
- **Contact Knowledge Foundation:** structured contact knowledge remains canonical; Systems select contacts and do not redefine their contact state.
- **App Shell:** builder is a focused workflow; unsaved-change protection and back behavior follow shell contracts.
- **Theme & Visual System:** specialized Orrery HUD may be visually distinctive but must remain tokenized/accessibility-compliant.
- **Settings / Contact Administration:** owns general Category administration and may link to canonical Systems Management.
- **Backup/Restore:** preserves System definitions/configuration.
- **Responsive/Release Hardening:** validates large-System performance, accessibility, responsive HUD behavior, and device transition performance.

---

# Explicitly Deferred

- System-to-System composition/nesting
- arbitrary boolean-query expression builder
- System folders/tags
- separate startup/default System preference
- Recent Systems section
- Birthdays as initial custom-System predicate
- System-level sorting
- static snapshots as a distinct System product type
- automatic AI-generated Systems
- remotely shared/collaborative Systems
- per-System camera-position persistence
- per-System density preference
- generic app-wide saved-search framework
- dedicated Category/System deletion reconciliation wizard
- full graph-aware Systems from future Social Graph work

---

# Future Milestone — Social Graph / Satellite Orrery

**[DEFERRED]** The larger social-graph direction identified during Phase 8 remains explicitly preserved for a future milestone.

Potential scope includes:
- first-/second-level contact semantics,
- contact-to-contact graph edges,
- linked real contacts orbiting other real contacts,
- primary/satellite hierarchy,
- multi-parent/contact relationships,
- graph traversal,
- graph-aware Focus Zoom,
- social-cluster exploration,
- real-contact “moons,”
- satellite promotion/demotion,
- moons-of-moons policy,
- graph-aware Systems,
- Profile graph presentation,
- relationship editing and reconciliation,
- graph layout rules distinct from the current sun-centered status Orrery.

Phase 8 Relationship Satellites are intentionally **not** this graph model; they are lightweight visualization of existing unlinked person-like relationship records.

---

# Phase Success Criteria

1. Users can create named custom Systems using dynamic rules, explicit manual members, or both without choosing a separate System type.
2. Rules use understandable OR-within-family / AND-across-family semantics and shared canonical predicates.
3. Manual inclusions remain durable; exclusions behave as temporary exceptions to currently rule-derived membership rather than invisible long-lived ledgers.
4. Built-in and Category Systems preserve immutable base meaning while allowing visibility control and manual membership overrides.
5. The System builder uses an Orrery-specific multi-page floating HUD with accordion rule configuration, live match feedback, Manage Members, and full-canvas Preview.
6. Manage Members exposes the real resolved contact membership through a searchable/virtualized avatar-name grid and allows direct include/exclude adjustment.
7. Preview uses the real Phase 8 geometry/scale model with simplified rendering and supports pan/zoom without permitting unsaved Profile navigation.
8. Systems Management provides the settled CRUD, duplicate, ordering, hide/show, and override-management behavior without bloating the Orrery switcher.
9. Category rename/delete changes interact predictably with generated Systems and dependent custom rules without silently rewriting user definitions or requiring a separate reconciliation workflow.
10. Empty and broken Systems remain selectable, are clearly distinguished, and receive useful Orrery state treatment including the restrained empty-state comet concept.
11. The last active System persists; System switching starts the destination at canonical Home and may preserve focused contacts when membership overlaps.
12. Normal System switches use membership-delta-adaptive spin/shedding/capture presentation; Reduced Motion uses a simpler non-rotational alternative.
13. Large Systems remain valid without an arbitrary product cap, while renderer/list architecture scales using culling, level-of-detail, simplified preview rendering, and virtualization rather than mounting every expensive visual at once.
14. System state and customization survive Backup/Restore.
15. The specialized HUD and System management remain operable accessibly without requiring precision interaction with the Orrery canvas.

---

# Notes for GSD / Roadmapper

- Treat this as the dedicated sibling phase immediately following Phase 8 Orrery Camera & Scale.
- Do not pull the full System builder into Phase 8 merely because Phase 8 provides built-in Systems and the switcher.
- Reuse domain predicates, contact-selection foundations, and Phase 8 layout calculations rather than duplicating them.
- Do not model custom Systems as static member snapshots by default.
- Do not persist stale exclusions after contacts cease to satisfy their rule-derived membership.
- Do not expose arbitrary boolean programming or nested Systems initially.
- The specialized HUD is an intentional Orrery UX experiment, not a requirement to redesign all Orbit modals.
- The full-canvas preview should share actual layout calculations while simplifying rendering.
- Do not impose a made-up contact-count ceiling solely to avoid renderer engineering; large-System rendering must use appropriate culling/LOD/virtualization.
- Keep empty and broken states semantically distinct.
- Category CRUD belongs to a later contact-administration owner; preserve the integration gap explicitly.
- Preserve the future Social Graph / Satellite Orrery concept in deferred planning; do not expand Phase 9 into graph modeling.
