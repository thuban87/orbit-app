# Dossier — Dashboard Control Surface

**Status:** complete · Interrogated through 2026-08-30 · Dashboard control-shell product decisions settled. List/Card renderer details remain for later phases.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope
This dossier defines the Dashboard's visible control shell over the shared Dashboard Data & State Foundation.

It covers top-of-screen hierarchy, Your Week affordance, Population/Filters/Sort controls, anchored floating panels, live-apply behavior, panel dismissal/switching, summary/active states, search placement, List/Card toggle placement, Dashboard overflow/management access, refactoring of existing management routes, and the architecture needed to replace anchored panels with a more branded HUD later without rewriting Dashboard behavior.

It intentionally does **not** define Population/filter/sort/search query semantics themselves; those are owned by the Dashboard Data & State Foundation dossier. It also does not define final List/Card row/card composition.

## A. Dashboard Top-Level Composition
**[DECIDED]** Dashboard remains visually lean so contact content appears early.

**[DECIDED]** Dashboard does not contain a permanent birthday/upcoming module between controls and contacts.

Birthdays are available through the Birthday population. Richer upcoming birthday content belongs to Your Week.

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
- Manage Favorites
- Bulk / Contact Management
- Reset Dashboard View

**[DECIDED]** Your Week is not buried in overflow because it has a first-class header affordance.

**[DECIDED]** Bulk/contact-management receives a Dashboard-overflow home now rather than being deferred.

This supports the existing/current import and bulk-management capabilities.

## N. Existing Management Screens
**[DECIDED]** Archived and Unbound destinations are not greenfield reimplementations.

Existing screens/routes should be **refactored/re-presented** inside the new navigation model.

**[DECIDED]** They open as Dashboard child/browse routes rather than becoming Dashboard populations.

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
- **Import/Bulk Management:** existing/current bulk workflows receive a discoverable Dashboard-overflow entry point.
- **Archived/Unbound:** dedicated child routes, not Dashboard populations.

## Explicitly Deferred
- custom Orbit HUD control surface
- full-screen combined Manage View modal
- bottom-sheet versions of Population/Filters/Sort
- checkbox-style population selection chrome
- fourth top-row presentation-mode button
- permanent birthday/upcoming Dashboard module
- compact Card/Grid renderer
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
8. Dashboard overflow exposes Unbound, Archived, Manage Favorites, Bulk/Contact Management, and Reset Dashboard View.
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
