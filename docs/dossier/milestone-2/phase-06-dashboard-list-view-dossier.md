# Dossier — Dashboard List View

**Status:** complete · Interrogated through 2026-08-30 · List View product decisions settled. Card View remains a sibling renderer over the same Dashboard foundations.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope
This dossier defines Orbit's Dashboard **List View** renderer over the shared Dashboard Data & State Foundation and Dashboard Control Surface.

It covers List View's product role, row/card anatomy, density, identity hierarchy, category/recency treatment, adaptive context, favorite affordance, relationship-status treatment, snooze presentation, search-result presentation, swipe actions, gesture behavior, accessibility, loading/result transitions, and empty/error presentation.

It intentionally does **not** redefine Dashboard Population / Filters / Sort / Search semantics, persistent Dashboard state, control-surface layout, contact-domain behavior, Quick Log business rules, detailed Log Contact form behavior, final status-icon artwork, exact spacing/token values, exact gesture thresholds, or virtualization tuning.

## A. List View Product Role

**[DECIDED]** List View is the Dashboard's **scan-first** renderer.

Its primary value is allowing the user to visually process many contacts quickly while still surfacing enough relationship/context information to make each row useful.

**[DECIDED]** List View should remain meaningfully denser than Card View rather than becoming a mini-profile layout.

**[DERIVED]** Richer presentation belongs to Card View and Profile; List View should resist accumulating secondary modules or large blocks of metadata.

## B. Row / Card Anatomy

**[DECIDED]** Each List result is presented as a full-width compact card/row with a relatively large circular profile avatar on the left.

**[DECIDED]** The remaining row width contains a three-line information stack:
1. Contact name
2. Recency + category
3. Adaptive contextual information

**[DECIDED]** The upper-right corner contains an always-visible Favorite star.

**[DECIDED]** The lower-right corner contains a non-interactive relationship-status icon when applicable.

**[DECIDED]** A thin border surrounds the entire row/card and carries relationship-status color in ordinary unsnoozed states.

**[DERIVED]** The avatar, text block, and two corner indicators should retain a stable geometry so the list remains easy to scan.

## C. Density & Avatar Scale

**[DECIDED]** Normal phone density is **medium-compact**.

**[DECIDED]** A typical phone should show approximately **5–6 complete List rows** when space permits; five visible rows is an acceptable design target with the chosen three-line composition.

**[DECIDED]** The avatar should feel visually prominent, roughly in the 64–72 logical-pixel class, with exact dimensions resolved by the design system and device testing.

**[DECIDED]** Accessibility text scaling may increase row height and reduce the number of simultaneously visible rows.

**[DERIVED]** The normal-density row-count target is not an accessibility invariant.

## D. Identity & Category Presentation

**[DECIDED]** Contact name is the primary identity line.

**[DECIDED]** The second line shows contact recency plus the contact's category/group.

Working pattern:
- `18d ago · Friend`
- `Today · Family`
- `Yesterday · Work`

**[DECIDED]** Current product behavior is treated as a single displayed category/group per contact. This phase does not introduce multi-category or primary-category semantics.

**[DECIDED]** For contacts with no recorded interactions, recency uses the neutral phrase **`No interactions yet`**.

## E. Recency Product Intent

**[DECIDED]** List View displays time since most recent interaction.

**[DECIDED]** Contact-frequency goals are **not** displayed beside recency in List View.

The intent is to surface a concrete relationship fact without turning the row into a progress/game-style comparison against a required cadence.

**[DERIVED]** Relationship health/status remains a separate semantic interpretation rather than being rendered as an explicit `actual vs target` score.

## F. Adaptive Context Line

**[DECIDED]** The third line is an adaptive but deterministic piece of useful contact context.

**[DECIDED]** Initial priority direction:
1. imminent / time-sensitive remembered information
2. pinned or high-value remembered context
3. other useful contact knowledge
4. empty-contact completeness prompt

**[DECIDED]** Birthdays are **not** used for the adaptive line because birthday/upcoming information already has dedicated representation elsewhere in Orbit.

**[DECIDED]** The adaptive line consumes existing structured/user-authored contact knowledge and does not generate AI prose in this phase.

**[DECIDED]** A small leading semantic icon may be shown where the adaptive item's type has a meaningful icon. This should be tested visually and may remain plain text when no useful semantic icon exists.

**[DECIDED]** The adaptive line is not independently tappable. The row remains Profile-first.

## G. Empty / Sparse Contact Prompting

**[DECIDED]** If a contact lacks useful adaptive context, List View uses one of approximately ten lightweight completeness prompts rather than leaving the third line visually empty.

Direction/examples:
- `Add something to remember about {contact_name}`
- `What should you remember about {contact_name}?`
- `Add a detail about {contact_name}`
- `Fill in a little more about {contact_name}`
- `What's useful to know about {contact_name}?`
- `Add some context about {contact_name}`
- `Save something worth remembering about {contact_name}`
- `Add a note, detail, or memory about {contact_name}`
- `Tell Orbit a little more about {contact_name}`
- `Nothing remembered about {contact_name} yet`

**[DECIDED]** This is a gentle completeness cue, not a profile-completeness score, warning, gamification system, or dedicated data-quality subsystem.

**[DERIVED]** Prompt selection should remain stable/deterministic for a given contact rather than changing randomly on every render.

## H. Favorite Affordance

**[DECIDED]** The Favorite star is always visible in the top-right corner.

**[DECIDED]** The star is directly tappable from List View.

**[DECIDED]** Toggling Favorite provides immediate visual fill/unfill feedback plus restrained light haptic feedback.

**[DECIDED]** Successful Favorite changes do not require a success snackbar.

**[DERIVED]** On persistence failure, revert the optimistic visual state and present an error notification/snackbar.

**[DERIVED]** Reuse/extract the existing favorite mutation plumbing rather than creating a List-only favorite concept.

**[DERIVED]** Legacy/internal favorite ranking must not surface as ranked-Favorites UX; product semantics remain binary membership.

## I. Relationship Status Presentation

**[DECIDED]** Ordinary unsnoozed relationship states use two redundant visual channels:
- thin status-colored border around the entire row/card
- distinct lower-right status icon

**[DECIDED]** All ordinary status borders use the **same border weight**. Severity does not increase border thickness.

**[DECIDED]** Status icons are informational only and not tappable.

**[DECIDED]** Status meaning is intentionally restrained in List View; literal status text is not permanently displayed.

**[DECIDED]** Final status icon direction is astronomical/celestial, with distinct silhouettes rather than generic health/severity symbols.

Concept direction:
- Stable → complete/clean orbit
- Wobbly → eccentric or visibly unstable orbit
- Decaying → inward/decaying orbit or spiral
- Rogue → body breaking away from/opening its orbit

**[DEFERRED]** Final production status-icon artwork.

## J. Neutral / Never-Contacted Status

**[DECIDED]** Contacts with no relationship-status evaluation / no interactions use a neutral theme border and **no relationship-status icon**.

**[DECIDED]** Orbit does not invent a fifth `Unknown` relationship status solely for List View.

## K. Snoozed Presentation

**[DECIDED]** Snooze acts as a visible presentation override for relationship health in List View.

**[DECIDED]** While snoozed:
- relationship-status border treatment is suppressed and replaced with a neutral/theme border
- relationship-status icon is replaced by a snooze icon

The visual intent is effectively: **do not make the user worry about this relationship while it is snoozed.**

**[DERIVED]** The underlying relationship status remains domain state; this is a renderer-level presentation override, not data loss or status mutation.

## L. Search Result Presentation

**[DECIDED]** Search keeps the contact name fixed as line 1.

**[DECIDED]** While search is active, normal lines 2 and 3 are replaced by search explanation/context.

Working direction:
- line 2 → compact match explanation such as `3 matches · Memory, Relationship`
- line 3 → strongest highlighted contextual snippet

**[DECIDED]** Matched text is highlighted.

**[DECIDED]** List View surfaces the strongest inline match plus match count rather than expanding to show all possible match snippets.

**[DECIDED]** `+N more` / multiple-match information has no separate inline action in List View.

**[DERIVED]** The underlying shared Dashboard result model may retain up to three prioritized match descriptors plus total match count; List View chooses a compact rendering of that shared semantic result.

## M. Primary Row Interaction

**[DECIDED]** Tapping the normal closed row opens Contact Profile.

**[DECIDED]** The adaptive context/status indicator do not introduce competing inline tap destinations.

**[DECIDED]** If a row is partially swiped/revealed, tapping first closes the swipe state rather than navigating to Profile.

## N. Swipe Actions

**[DECIDED]** List View supports one swipe action per direction.

- **Swipe right** → Log Interaction action
- **Swipe left** → Edit Contact

**[DECIDED]** Only one List row may remain swipe-revealed/open at a time.

**[DECIDED]** Swiping/opening another row closes any previously open swipe row.

**[DECIDED]** Destructive actions such as Delete are not exposed through these primary swipe gestures.

## O. Configurable Right-Swipe Logging Behavior

**[DECIDED]** The right-swipe Log Interaction behavior is globally configurable between:
- Quick Log
- Log Contact

**[DECIDED]** Default is **Quick Log**.

**[DECIDED]** First-run onboarding exposes an early choice/override.

**[DECIDED]** A persistent global setting in Settings allows later changes.

**[DECIDED]** Dashboard overflow does not host this preference.

**[DECIDED]** Configuration is global rather than per-contact.

**[DECIDED]** Both logging variants execute when the swipe crosses the committed action threshold; neither requires a second tap on a revealed button.

Behavior:
- Quick Log → executes the immediate Quick Log workflow
- Log Contact → routes immediately into the detailed Log Contact form pre-targeted to that contact

**[DERIVED]** Quick Log retains the shell-defined truthful success/error/Undo behavior.

**[DERIVED]** Log Contact reuses the milestone's routable fast-entry/form architecture rather than creating a List-specific form entry path.

## P. Swipe Visual Feedback & Discoverability

**[DECIDED]** Swipe actions are hidden before the user begins the gesture, then progressively reveal familiar action feedback as the row moves.

Expected interaction language includes:
- row translates with the user's finger
- action background/surface appears behind it
- semantic action icon becomes visible
- short action label may appear
- threshold/resistance communicates commitment
- sub-threshold release returns the row

**[DECIDED]** Gesture education belongs in the later onboarding phase rather than introducing a permanent List-only tutorial.

**[DERIVED]** Onboarding should teach the Dashboard row gestures and the tappable Favorite star.

## Q. Accessibility

**[DECIDED]** Relationship status cannot rely on border color alone; the status icon provides the second visible channel, while accessible semantics expose the state textually.

**[DECIDED]** Snoozed state similarly receives semantic accessibility labeling.

**[DECIDED]** Assistive-technology row actions expose the same primary commands available through gestures, including Log Interaction and Edit Contact.

**[DECIDED]** Large accessibility text may reflow/increase row height rather than shrinking below supported readable sizes.

**[DERIVED]** A row's accessible description should include useful identity/state context such as contact name, category, recency, favorite state, relationship/snooze state, and relevant action semantics without requiring the user to infer color or iconography.

## R. Loading & Live Query Updates

**[DECIDED]** Ordinary fast local Population / Filter / Sort / Search updates should keep current content visible and update naturally rather than flashing skeleton loaders on every query change.

**[DECIDED]** Skeleton/loading rows are reserved for initial or meaningfully delayed loading situations.

**[DERIVED]** This preserves the Dashboard Control Surface's live-apply interaction model and prevents filter/sort changes from feeling unstable.

## S. Result Transitions & Motion

**[DECIDED]** Rows may use short restrained transitions when results move, appear, or disappear due to query changes.

Examples: brief position changes and fades.

**[DECIDED]** Motion should remain functional and understated rather than orbital/cinematic.

**[DECIDED]** Reduced-motion preferences simplify or remove these transitions.

## T. Empty & Error States

**[DECIDED]** List View and Card View should mostly share the same semantic empty/error-state content.

Relevant causes include:
- no contacts yet
- no search matches
- selected Population / Filters produce zero results
- load/database error

**[DECIDED]** Renderer-specific layout/presentation is allowed while the underlying message/cause semantics remain shared.

**[DECIDED]** Routine List empty states remain restrained: icon + concise copy + appropriate CTA where useful, rather than large bespoke illustration systems.

## U. Derived Implementation Boundaries

**[DERIVED]** List View consumes the shared Dashboard query/result model and does not implement its own Population / Filter / Sort / Search logic.

**[DERIVED]** Existing contact-avatar recycling/cache correctness should be preserved for virtualized row reuse.

**[DERIVED]** Use existing platform-appropriate virtualized list primitives unless performance testing demonstrates a genuine need for a new dependency.

**[DERIVED]** Favorite mutation, Quick Log, detailed Log Contact routing, Edit Contact routing, semantic icon lookup, theme tokens, and accessibility primitives should be shared/reused rather than reimplemented inside the renderer.

**[DERIVED]** Exact row dimensions, icon sizes, gesture thresholds, animation durations, truncation limits, and list-performance tuning are implementation details governed by the design system and device testing.

## Cross-Phase Constraints

- **Dashboard Data & State Foundation:** authoritative for result universe, Population, Filters, Sort, Search, persistence, match descriptors, and cause-aware result state.
- **Dashboard Control Surface:** remains above the renderer; List View does not relocate/reinvent controls.
- **Dashboard Card View:** sibling renderer over the same shared result model; may display richer context but should not redefine shared semantics.
- **Theme & Visual System:** owns semantic colors, rounded geometry, type scale, motion, icon registry, theme variants, contrast, and reduced-motion behavior.
- **App Shell & Navigation:** owns Profile/Edit/Quick Log/Log Contact navigation semantics and the immediate Quick Log contract.
- **Contact Knowledge:** adaptive context and search snippets consume semantic contact knowledge rather than storage-specific assumptions.
- **Rapid Capture & Update Flows:** owns detailed form/business behavior behind Log Contact and Edit/Update flows.
- **Settings:** owns the persistent Quick Log vs Log Contact swipe preference.
- **Onboarding:** teaches List gestures and provides the early right-swipe logging preference choice.
- **Orrery:** remains the more explicit relationship-health/attention-centric visualization; List status presentation stays restrained.
- **Responsive & Release Hardening:** audits landscape/tablet behavior, accessibility, device-specific gesture behavior, performance, and final density tuning.

## Explicitly Deferred

- final production artwork for Stable / Wobbly / Decaying / Rogue icons
- fully custom Orbit icon family
- exact row height / avatar size / spacing token values
- exact gesture velocity/distance thresholds and spring curves
- exact animation timings
- per-contact swipe-action configuration
- additional swipe actions or multi-button swipe drawers
- destructive swipe actions
- profile-completeness scoring/gamification
- AI-generated adaptive row copy
- birthdays in adaptive List context
- multi-category/primary-category product model
- custom List-specific search semantics
- user-controlled density
- permanent in-List gesture tutorial

## Phase Success Criteria

1. Dashboard List View provides a scan-first full-width contact browser with a prominent avatar and stable three-line information hierarchy.
2. Ordinary rows show name, recency + category, and deterministic adaptive contact context, with useful lightweight prompting when a contact lacks remembered information.
3. Favorite is directly toggleable from the row with immediate visual/haptic feedback and graceful error rollback.
4. Unsnoozed relationship state uses a same-weight semantic border plus distinct non-color status icon; neutral contacts do not receive a fabricated status.
5. Snoozed contacts suppress visible relationship-health treatment in favor of a neutral border plus snooze icon.
6. Search keeps identity stable while replacing the two secondary lines with compact match explanation and highlighted best-match context from the shared search result model.
7. Tapping a closed row opens Profile; swipe right executes the configured logging behavior and swipe left routes to Edit Contact, with only one swipe row open at a time.
8. Quick Log is the default right-swipe behavior, can be overridden during onboarding and later in Settings, and executes immediately when the gesture commits; detailed Log Contact routes directly to its form on gesture commitment.
9. Gesture equivalents are available accessibly, large text may reflow rows, and status meaning does not depend on color alone.
10. Fast query changes update rows without unnecessary loading flashes, with short restrained transitions and reduced-motion compliance.
11. List and Card share semantic empty/error-state causes while List uses an appropriately compact renderer-specific presentation.
12. List View reuses shared Dashboard, navigation, logging, favorite, knowledge, theme, and icon contracts rather than duplicating domain behavior.

## Notes for GSD / Roadmapper

- Treat this as a renderer phase after Dashboard Data & State Foundation and Dashboard Control Surface.
- Do not pull detailed Quick Log / Log Contact / Edit Contact business rules into this phase; List View owns gesture exposure/routing only.
- Do not introduce a new favorite ranking product concept; the visible star is binary Favorite membership.
- Do not invent multi-category semantics because current product behavior exposes one category per contact.
- Preserve the three-line scan-first geometry at normal text sizes, but accessibility reflow takes precedence over density.
- Snooze is intentionally a presentation override that suppresses relationship-health signaling while snoozed.
- Do not add birthdays back into adaptive List context merely because the knowledge exists; they are deliberately represented elsewhere.
- Do not turn sparse-contact prompts into a scoring/completion subsystem.
- Final icon artwork, exact dimensions, gestures, animation values, and virtualization/performance tuning are implementation details unless device testing exposes a product-level conflict.
