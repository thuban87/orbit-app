# Dossier — Dashboard Control Surface

**Status:** complete · Interrogated through 2026-08-30 · Amended 2026-09-01 for Phase 12 Group Interaction Logging integration · Dashboard control-shell product decisions settled. List/Card renderer details remain for later phases.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Amendment / Supersession — Phase 12 Group Interaction Logging

**Status:** targeted Dashboard-control amendment based on the later, fully settled **Phase 12 — Group Interaction Logging** subsystem.

This amendment preserves all existing Phase 5 decisions except where the older Dashboard-header and overflow wording is explicitly extended or superseded below. Phase 5 owns Dashboard discovery/entry affordances only; Phase 12 remains authoritative for Group Event domain behavior and Group Event page contents.

### [DECIDED] Group Events becomes a first-class Dashboard-header destination

The Dashboard header exposes **Group Events** at the same high-level discoverability tier as **Your Week**.

Both Dashboard-owned destinations should use:
- semantic icon + short label when available space safely permits,
- icon-only fallback when responsive constraints make both labels impractical,
- semantic icon-registry lookup rather than one-off icon imports,
- clear accessible names independent of whether the visible label is present.

The Group Events action routes to the canonical **Phase 12 Group Events browse/management page**.

### [DECIDED] Your Week + Group Events share the Dashboard header

The prior Phase 5 header contract giving **Your Week** the only first-class Dashboard-owned destination is superseded.

The header now accommodates two high-priority Dashboard-owned destinations:
1. **Your Week**
2. **Group Events**

**[DERIVED]** Header composition may adapt spacing, label visibility, or compactness to keep both actions usable without displacing the established Dashboard controls below.

**[DERIVED]** If both short labels cannot remain readable and accessible at the supported width/text scale, fall back to icon-only actions rather than wrapping the header, shrinking text below supported sizing, or pushing Population / Filters / Sort / Search downward.

### [DECIDED] Group Events remains in Dashboard overflow as redundant discovery/management access

Dashboard overflow now includes **Group Events** in addition to its existing management destinations.

The amended initial overflow set is therefore:
- Group Events
- Unbound Contacts
- Archived Contacts
- Select Contacts
- Reset Dashboard View

This redundant path is intentional even though Group Events also has a prominent header affordance.

### [DECIDED] Group Events is not a permanent Dashboard content module

Do **not** add a Group Events feed, recent-event cards, event analytics, participant summaries, or other permanent Group Event content between the Dashboard controls and contact collection during this milestone.

The existing Phase 5 principle that the Dashboard remains visually lean and contact-content-first remains authoritative.

### [DECIDED] Navigation boundary remains unchanged

For this milestone:
- Group Events does **not** receive a permanent bottom-navigation destination.
- The Dashboard bottom-nav tab remains an ordinary Dashboard tab and does **not** become a radial/menu launcher.
- The current Dashboard is not renamed or rebuilt into a broader **Mission Control** surface.

These broader shell/IA concepts remain deferred.

### [BOUNDARY] Phase 5 owns entry affordances, not Group Event behavior

Phase 5 owns only:
- Dashboard-header discovery/entry for Group Events,
- responsive coexistence of Your Week + Group Events,
- redundant Dashboard-overflow access,
- routing from those affordances into the canonical Group Events page.

**Phase 12 owns**:
- Group Event persistence and parent/child Interaction semantics,
- Group Log workflow behavior,
- participant selection and participant overrides/inheritance,
- Group Event Detail and Edit Group Event,
- Group Events browse/management page contents,
- Group Event lifecycle/conversion/dissolve/delete semantics,
- atomic fan-out mutation behavior,
- backup/restore behavior.

Do not duplicate those contracts in Phase 5.

### [DEFERRED] Larger Dashboard / shell concepts

Explicitly deferred beyond this milestone:
- Mission Control / broader multi-feature Dashboard redesign,
- renaming the current Dashboard contact-browser concept,
- Dashboard-tab radial/menu launcher,
- permanent Group Events bottom-nav destination,
- broader bottom-nav restructuring.

### Supersession Map

This amendment extends or supersedes the following older Phase 5 text without otherwise reopening the dossier:

- **Section B — Header & Your Week:** Your Week is no longer the only first-class Dashboard-owned header destination; Group Events joins it.
- **Section M — Dashboard Overflow:** add Group Events as a redundant entry.
- **Section R — Cross-Phase Constraints:** add Phase 12 ownership boundary and canonical Group Events routing.
- **Phase Success Criterion 7:** read as Your Week **and Group Events** are discoverable from the Dashboard header without becoming permanent content modules.
- **Phase Success Criterion 8:** read as Dashboard overflow additionally exposes **Group Events**.

All Population / Filters / Sort, anchored-panel, Search, List/Card-toggle, reset, and unrelated Dashboard control decisions remain authoritative and are not reopened by this amendment.

---

## Amendment — audit resolutions 2026-09-01

Targeted resolutions from the milestone-2 cross-dossier audit. Each item names the finding it resolves; all other Phase 5 decisions remain authoritative.

- **E-07 — Archived/Unbound entry points.** Archived Contacts keeps both its Dashboard-overflow entry and its existing Settings row, routing to one screen; ADR-019's stack-root shell is superseded by Phase 1's tab shell (new ADR, 2026-09-01).
- **E-04 — birthday presentation relocation.** ADR-034 is superseded 2026-09-01 by ADR-076; a deferred-planning **Your Week** phase after Phase 16 will own the relocated birthday presentation. Dashboard still hosts no permanent birthday module.
- **E-02 — "All Contacts" population row.** The Population panel gains an **All Contacts** selectable row (Active Contacts stays implicit and unlisted). Semantics are owned by Phase 4 §D.
- **E-01 — binary favourites ratified.** **Manage Favorites** is removed from Dashboard overflow with nothing put in its place: the drag-reorder screen and its rank are retired (ADR-033 superseded 2026-09-01 by ADR-075) and favourites are binary membership only.
- **AF-08 — no deferred compact renderer.** The deferred `compact Card/Grid renderer` is superseded: Card View *is* the compact 3-column avatar-first grid (Phase 7 v0.2, roadmap v1.0). Nothing separate remains deferred here.
- **AF-02 — Dashboard-overflow bulk entry.** The overflow entry is named **Select Contacts** and enters Phase 7's Card/Grid multi-select bulk-management mode. The earlier `Bulk / Contact Management` naming, and its claim that the entry "supports the existing/current import" capabilities, are superseded: contact import belongs to Backup/Restore (Phase 7 §O, roadmap §7), not to this entry.

---

## Scope
This dossier defines the Dashboard's visible control shell over the shared Dashboard Data & State Foundation.

It covers top-of-screen hierarchy, Your Week affordance, Population/Filters/Sort controls, anchored floating panels, live-apply behavior, panel dismissal/switching, summary/active states, search placement, List/Card toggle placement, Dashboard overflow/management access, refactoring of existing management routes, and the architecture needed to replace anchored panels with a more branded HUD later without rewriting Dashboard behavior.

It intentionally does **not** define Population/filter/sort/search query semantics themselves; those are owned by the Dashboard Data & State Foundation dossier. It also does not define final List/Card row/card composition.

## A. Dashboard Top-Level Composition
**[DECIDED]** Dashboard remains visually lean so contact content appears early.

**[DECIDED]** Dashboard does not contain a permanent birthday/upcoming module between controls and contacts.

Birthdays are available through the Birthday population. Richer upcoming birthday content belongs to Your Week. (ADR-034 superseded 2026-09-01 by ADR-076; a deferred-planning “Your Week” phase after Phase 16 will own the relocated birthday presentation.)

**[DECIDED] Working top hierarchy:**
1. Dashboard header / branded root
2. Population / Filters / Sort control row
3. Search affordance + List/Card toggle row
4. Contact collection

Exact spacing is implementation/design work governed by the Theme system.

## B. Header & Your Week
**[DECIDED]** Your Week remains a first-class Dashboard-owned destination.

**[DECIDED]** Your Week appears in the Dashboard header as **icon + short label** when space permits.

**[DECIDED]** Icon-only is the fallback when the header cannot safely fit the label.

**[DERIVED]** The semantic icon registry owns the Your Week icon.

**[DERIVED]** Your Week navigation inherits origin-aware shell behavior.

## C. Population / Filters / Sort Control Row
**[DECIDED]** Population, Filters, and Sort appear as three equal conceptual controls in one row.

**[DECIDED]** They remain visually and functionally separate because they represent different query axes.

**[DECIDED]** Do not combine them into one Manage View modal/screen.

**[DECIDED]** Each control shows its current state inside/under the control label.

Examples:
- Population → `Active Contacts`, `Favorites`, `Favorites, Birthdays`
- Filters → `Family, Friends +2`
- Sort → `Default`, `Least recent`

**[DECIDED]** Summary text shows meaningful names while they fit, then collapses overflow to `+N`.

**[DECIDED]** Non-default state receives a restrained additional active visual treatment.

Exact accent/border/fill treatment is theme-resolved.

## D. Anchored Floating Panel Pattern
**[DECIDED]** Population, Filters, and Sort use **anchored floating panels**, not full-screen modals or bottom sheets.

**[DECIDED]** The three controls share one interaction family but may use different appropriate panel sizes:
- Population → medium/large
- Filters → largest
- Sort → compact

**[DECIDED]** Panels visually anchor to the invoking control.

**[DERIVED]** Implement one reusable floating-control-surface primitive with size/placement variants rather than three unrelated popovers.

## E. Live Apply
**[DECIDED]** Population, Filter, and Sort changes apply immediately while their panel is open.

There is no Apply/Done confirmation step.

**[DECIDED]** Dashboard results remain visible and visibly update behind the panel.

**[DECIDED]** Underlying contact content is interaction-inert while a panel is open.

**[DERIVED]** Live visual feedback should not permit accidental navigation into a contact while the user is manipulating controls.

## F. Floating Panel Dismissal & Switching
**[DECIDED]** Tapping the currently active top control again closes its panel.

**[DECIDED]** Tapping outside the panel dismisses it.

**[DECIDED]** Android/system Back dismisses the panel before route navigation.

**[DECIDED]** If one panel is open and the user taps another top control, the UI switches directly to the new panel in one interaction.

**[DECIDED]** Only one Dashboard floating control panel may be open at a time.

**[DECIDED]** Reopened panels begin at their top rather than restoring transient panel scroll position.

**[DECIDED]** A live selection producing zero results does not auto-close the panel.

## G. Floating Panel Background Treatment
**[DECIDED]** Background separation is theme-dependent, not a single hardcoded scrim.

Galaxy may use subtle dimming with stronger glass/blur character.

Standard may use a quieter light scrim and flatter surface treatment.

**[DECIDED]** Dashboard content remains readable enough to perceive live result changes.

**[DERIVED]** Panels inherit Theme dossier rules for contrast, translucency, blur-performance fallback, reduced motion, and semantic tokens.

**[DERIVED]** Use one semantic panel API across Galaxy and Standard rather than parallel theme-specific component families.

## H. Population Panel Interaction
**[DECIDED]** Population options toggle by tapping the option row/control itself.

**[DECIDED]** Conventional checkbox visuals are not required in the initial design.

**[DERIVED]** Selection state still requires a clear accessible visual/semantic treatment.

**[DECIDED]** Active Contacts is not shown as an explicit selectable population inside the panel.

**[DECIDED — amended 2026-09-01]** **All Contacts** *is* shown as an ordinary selectable population row in the panel. Active Contacts remains the implicit, unlisted default universe.

**[DECIDED]** Deselecting the final explicit special population immediately returns to Active Contacts.

## I. Filter Panel Interaction
**[DECIDED]** Filters receive their own floating panel.

**[DECIDED]** Filters apply live as options are toggled.

**[DECIDED]** Filter state remains summarized in the top control after the panel closes.

**[DECIDED]** Filters can be cleared from within their own surface.

Detailed filter semantics are owned by Dashboard Data & State Foundation.

## J. Sort Panel Interaction
**[DECIDED]** Sort receives a compact floating panel.

**[DECIDED]** Sort includes an explicit `Default` choice/reset path.

**[DECIDED]** Sort state remains summarized in the top control after the panel closes.

Detailed sort semantics/default resolution are owned by Dashboard Data & State Foundation.

## K. Search Affordance
**[DECIDED]** Search sits below the Population / Filters / Sort row.

Its location makes it read as scoped to the selected Dashboard universe rather than global app search.

**[DECIDED]** Search is collapsible/expandable rather than permanently consuming maximum vertical space.

**[DERIVED]** Search expansion/collapse uses restrained branded motion and respects reduced-motion preferences.

**[DERIVED]** Do not introduce an additional permanent results-heading row solely to host utilities.

## L. List / Card Toggle Placement
**[DECIDED]** List/Card selection lives on the **same row as Search**, aligned to the right.

**[DECIDED]** Do not add a fourth Population/Filters/Sort-style top-row control for presentation mode.

**[DECIDED]** Search receives most of the row width; List/Card retains a real accessible touch target rather than tiny icons.

The exact width split is responsive/derived rather than fixed to a literal percentage.

**[DERIVED]** Toggle icons use the semantic icon registry and expose selected state accessibly.

## M. Dashboard Overflow
**[DECIDED] Dashboard overflow initially contains:**
- Unbound Contacts
- Archived Contacts
- Select Contacts
- Reset Dashboard View

**[DECIDED]** Your Week is not buried in overflow because it has a first-class header affordance.

**[DECIDED]** Bulk/contact-management receives a Dashboard-overflow home now rather than being deferred.

**[DECIDED]** The overflow entry is named **Select Contacts**. It enters the Phase 7 Card/Grid multi-select bulk-management mode (switching to Card View if needed) rather than routing to a standalone bulk-management screen.

**[DECIDED]** Contact import is **not** reachable from this entry. Import belongs to Backup/Restore / contact data-management flows (Phase 7 §O, roadmap §7).

## N. Existing Management Screens
**[DECIDED]** Archived and Unbound destinations are not greenfield reimplementations.

Existing screens/routes should be **refactored/re-presented** inside the new navigation model.

**[DECIDED]** They open as Dashboard child/browse routes rather than becoming Dashboard populations.

**[DECIDED — amended 2026-09-01]** **Archived Contacts** is reachable from the Dashboard overflow entry **and** the existing Settings row. Both route to the same screen; the redundant entry point is intentional and the Settings row is not removed. **Unbound Contacts** likewise remains in Dashboard overflow as written above.

**[DERIVED]** ADR-019's stack-root shell assumption for these management routes is superseded by Phase 1's tab shell (new ADR, 2026-09-01). Origin-aware return behavior is expressed inside the tab shell rather than through a stack root.

**[DERIVED]** Preserve origin-aware behavior such as:

`Dashboard → Archived Contacts → Profile → Back → Archived Contacts`

**[DERIVED]** Reuse compatible underlying management logic rather than duplicating it.

## O. Dashboard-Wide Reset
**[DECIDED]** Dashboard overflow exposes **Reset Dashboard View**.

The Data & State dossier owns its state contract:
- Active Contacts
- no Filters
- Sort = Default
- search cleared
- List/Card preference preserved

**[DERIVED]** Reset remains discoverable without occupying permanent main-Dashboard space.

## P. Future HUD Migration
**[DECIDED]** Anchored floating panels are the initial release-quality surface because they provide the desired interaction with substantially lower design cost than a custom HUD.

**[DEFERRED]** Branded Orbit HUD overlay/control surface.

**[DERIVED]** Separate three layers:
1. Dashboard query/state logic
2. Population/Filter/Sort option-content components
3. transient control-surface container/presentation

Current:

```text
Top Control
    ↓
Anchored Floating Panel
    ↓
Option Content
    ↓
Dashboard State
```

Future:

```text
Top Control
    ↓
Orbit HUD Overlay
    ↓
Option Content
    ↓
Dashboard State
```

**[DERIVED]** A future HUD requires new presentation/animation/focus/responsive styling work but should not require rewriting population/filter/sort behavior or persistence.

## Q. Accessibility & Interaction Constraints
**[DERIVED]** Floating controls require appropriate accessibility roles, names, state announcements, and focus behavior.

**[DERIVED]** Background content that is visually visible but inert must also be removed from active accessibility focus while the panel is open.

**[DERIVED]** Touch targets must satisfy shared accessibility sizing rules even where Dashboard is compact.

**[DERIVED]** Text scaling should reflow/truncate according to Theme rules rather than shrinking below accessible sizes.

**[DERIVED]** Back and active-tab behavior inherit the shell's topmost-transient-layer rule.

## R. Cross-Phase Constraints
- **Dashboard Data & State Foundation:** authoritative for Population/Filter/Sort/Search semantics and persistence.
- **Dashboard List View:** consumes this control shell and does not relocate/reinvent the query controls.
- **Dashboard Card View:** same control shell/state.
- **Theme & Visual System:** owns visual token resolution, glass/opacity/scrim/contrast behavior.
- **App Shell:** owns Back, active-tab transient dismissal, header architecture, safe areas, nav/FAB behavior.
- **Your Week:** richer birthday/upcoming content lives there, not as a permanent Dashboard block.
- **Bulk Management (Dashboard Card View):** the Dashboard-overflow **Select Contacts** entry enters the Phase 7 Grid multi-select bulk-management mode; contact import is not part of it.
- **Backup/Restore / contact data management:** owns contact import; Dashboard overflow does not expose an import entry point.
- **Archived/Unbound:** dedicated child routes, not Dashboard populations.

## Explicitly Deferred
- custom Orbit HUD control surface
- full-screen combined Manage View modal
- bottom-sheet versions of Population/Filters/Sort
- checkbox-style population selection chrome
- fourth top-row presentation-mode button
- permanent birthday/upcoming Dashboard module
- ~~compact Card/Grid renderer~~ — superseded 2026-09-01: Card View IS the compact 3-column avatar-first grid per Phase 7 v0.2 and roadmap v1.0; no separate compact renderer is deferred
- final List View presentation
- final Card View presentation
- exact anchored-panel pixel dimensions/offset algorithms
- final microanimation timings
- unnecessary new implementations of existing Archived/Unbound management logic

## Phase Success Criteria
1. Dashboard exposes a lean branded root whose primary contact collection appears early.
2. Population, Filters, and Sort appear as one clear three-control row with readable current-state summaries.
3. Each control opens an appropriately sized anchored floating panel from one reusable interaction family.
4. Panel changes apply live while the underlying Dashboard visibly updates but remains interaction-inert.
5. Panels dismiss/switch consistently through control taps, outside tap, Back, and direct control-to-control switching.
6. Search appears beneath the query-control row and shares its row with an accessible List/Card toggle.
7. Your Week is discoverable from the Dashboard header without becoming a permanent content module.
8. Dashboard overflow exposes Unbound, Archived, Select Contacts, and Reset Dashboard View.
9. Existing Archived/Unbound management surfaces are integrated/refactored into the new Dashboard navigation model rather than recreated unnecessarily.
10. The control architecture allows a future HUD container to replace anchored-panel presentation without rewriting Dashboard state/query behavior.

## Notes for GSD / Roadmapper
- Treat this as a distinct integer execution phase after Dashboard Data & State Foundation.
- Do not collapse Population/Filters/Sort into one full-screen Manage View surface.
- Prefer one reusable anchored floating-surface primitive with size variants.
- Live apply is intentional; do not add Apply/Done buttons unless device testing exposes a genuine usability/accessibility blocker.
- Underlying Dashboard content is visible but inert while a panel is open.
- Do not add a permanent birthday banner/module back to Dashboard.
- Do not create a new results-heading row just to house List/Card controls.
- Reuse/refactor existing Archived/Unbound/bulk-management routes and logic rather than assuming greenfield screens.
- Architect option content independently from the floating container so the deferred HUD remains a presentation swap rather than a behavior rewrite.
