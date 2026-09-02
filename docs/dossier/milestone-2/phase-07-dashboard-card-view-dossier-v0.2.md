# Dossier — Dashboard Card View

**Status:** complete · Interrogated through 2026-08-30 · Amended 2026-09-01 for Phase 12 Group Interaction Logging integration · Grid/Card renderer product decisions settled.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope
This dossier defines the Dashboard Card View as Orbit's compact, avatar-first grid renderer over the shared Dashboard query/result/state model and Dashboard control surface.

It covers the normal grid composition, avatar/status treatment, adaptive context rules, search-match rendering, favorite behavior, long-press actions, multi-select/bulk-management behavior, sensitive bulk operations, loading/empty/error-state presentation, accessibility, and responsive behavior.

It intentionally does **not** redefine Dashboard populations, filters, sort, search scope, persistence, shared query logic, logging-form business rules, contact import, or the global theme/icon system.

## Amendment — Phase 12 Group Interaction Logging Integration (2026-09-01)

**[SUPERSEDED]** The earlier Phase 7 decision that detailed bulk Log Interaction is not offered is no longer authoritative. Phase 12 — Group Interaction Logging now owns the canonical multi-contact detailed logging subsystem.

**[DECIDED]** Grid multi-select retains **Quick Log** as a distinct immediate/current-time bulk action.

**[DECIDED]** Grid multi-select also exposes detailed **Log Interaction** routing based on selected-contact count:
- **1 selected contact** → canonical individual detailed Log Interaction workflow.
- **2+ selected contacts** → canonical Phase 12 **Group Log** workflow with the selected contacts preloaded as participants.

**[DECIDED]** Phase 7 owns only the selection-mode action, selected-contact-count routing, and preservation of Grid multi-select UX while launching the canonical workflow.

**[DERIVED]** Phase 7 must not implement or duplicate Group Event persistence, Group Event fields, shared/default inheritance, participant override editing, participant lifecycle, Group Event Detail/Edit, Group Event browsing/management, atomic fan-out mutation behavior, or Group Event backup/restore semantics. Those are authoritative Phase 12 responsibilities.

**[DECIDED]** Phase 12 adds a prominent **Group Events** Dashboard header icon + label entry and a redundant Dashboard overflow entry. Exact placement/composition belongs to Dashboard Control Surface/App Shell rather than the Card/Grid renderer; Phase 7 must remain layout-compatible with those entries.

**[DERIVED]** Existing Phase 7 references to `Bulk Log Interaction with a detailed form is not offered` are superseded by this amendment wherever they conflict. All unrelated Phase 7 decisions remain authoritative.

## Amendment — audit resolutions 2026-09-01

Targeted resolutions from the milestone-2 cross-dossier audit. Each item names the finding it resolves; all other Phase 7 decisions remain authoritative.

- **E-01 — binary favourites ratified.** The owner ratified binary favourite membership; the drag-reorder "Manage favourites" screen and its rank are retired (ADR-033 superseded 2026-09-01). §H is annotated accordingly.

---

## A. Product Role
**[DECIDED]** Card View is primarily a **browse-and-recognize** presentation of the same Dashboard contacts shown in List View.

**[DECIDED]** The difference between List and Card is primarily visual/presentational, not a different functional information architecture.

**[DECIDED]** Card View is a compact grid, not a one-card-per-row rich feed.

**[DERIVED]** Do not make Card View functionally richer merely because it has a different visual treatment. Shared Dashboard information remains conceptually consistent across renderers.

## B. Grid Layout
**[DECIDED]** Normal portrait-phone target is **3 columns**.

**[DECIDED]** Cards are compact enough that roughly **9 contacts may be visible** in a typical portrait viewport, subject to device height and system text size.

**[DECIDED]** Three columns are the normal-phone target, not an absolute invariant.

**[DERIVED]** Very narrow devices and large accessibility text may fall back to 2 columns.

**[DERIVED]** Wider devices/tablets/landscape should increase column count responsively rather than producing overly wide cards.

## C. Visual Form / Floating Avatar Cards
**[DECIDED]** Card View should feel less like a conventional boxed-card grid and more like **floating avatar bubbles** with an opaque/translucent scrim/surface underneath that preserves readable card-like text layout.

**[DECIDED]** The avatar/photo is the dominant visual element.

**[DECIDED]** Avatar remains circular.

**[DERIVED]** Theme resolution may make Galaxy feel more luminous/glass-like and Standard calmer/flatter while preserving identical information hierarchy.

## D. Normal Card Information Hierarchy
**[DECIDED]** Default card text hierarchy is three rows:
1. Contact name
2. Recency
3. One adaptive context item

**[DECIDED]** Category/group is omitted from Card View to protect compactness.

**[DECIDED]** Visible relationship-status text is omitted from the normal grid.

**[DERIVED]** Relationship status remains available to accessibility semantics even when no literal status label is shown.

## E. Recency
**[DECIDED]** Recency remains visible in normal browsing.

**[DECIDED]** Recency follows the same general human-readable conventions settled for List View, such as `Today`, `Yesterday`, and compact `Nd ago` forms.

**[DECIDED]** Contacts with no interactions use a neutral `No interactions yet` equivalent adapted to available width.

## F. Status Treatment
**[DECIDED]** Relationship status is communicated primarily through a **thin status-colored ring around the avatar/photo**.

**[DECIDED]** Card View also uses a small distinct status glyph/badge associated with the avatar so status meaning is not color-only.

**[DECIDED]** The status glyph should visually attach to/overlap the avatar edge rather than occupy one of the three text rows.

**[DECIDED]** Distinct Stable/Wobbly/Decaying/Rogue silhouettes follow the shared celestial/status icon system.

## G. Snooze Treatment
**[DECIDED]** Snooze overrides visible relationship-health treatment.

While snoozed:
- status ring becomes neutral/theme-resolved,
- relationship-status glyph is replaced by the snooze glyph,
- literal underlying status remains visually suppressed.

**[DERIVED]** Snooze presentation means “do not ask the user to evaluate this relationship-health state right now,” consistent with Dashboard query semantics.

## H. Favorite Interaction
**[DECIDED]** Favorite star is always visible in the top-right of the card/scrim.

**[DECIDED]** The star is directly tappable.

**[DECIDED]** Favorite/unfavorite gives immediate visual feedback and restrained haptic feedback.

**[DERIVED]** Favorite mutation should reuse/extract existing favorite-domain plumbing rather than create a new Card-specific mutation path.

**[DERIVED]** Product semantics remain binary favorite membership; legacy/internal rank storage must not leak into Card View UX (ADR-033 superseded 2026-09-01).

## I. Adaptive Context
**[DECIDED]** Card View shows **one** adaptive context item.

**[DECIDED]** Card View draws from the same semantic knowledge pool as other Dashboard renderers but applies a renderer-specific **compactness bias**.

**[DECIDED]** Prefer context that is naturally short and recognizable, including concise first-class/custom values, relationship/person names, counts/names such as children or pets, short pinned Memories, and other compact remembered facts.

**[DECIDED]** Longer useful items remain eligible as fallback and truncate to one line at normal text sizes.

**[DECIDED]** Compactness is a ranking bonus, not the sole relevance criterion; a trivial short fact should not automatically displace much more useful context.

**[DECIDED]** Birthdays are excluded from Card View adaptive ranking because birthday information is already intentionally surfaced elsewhere in Orbit.

**[DECIDED]** A small leading semantic icon may accompany the adaptive context when the source/type has a meaningful icon.

**[DECIDED]** The adaptive row is not separately tappable; normal card tap remains Profile navigation.

## J. Blank / Sparse Contact Prompt
**[DECIDED]** When no useful adaptive context exists, Card View uses the same blank-contact prompt system as List View with shorter Grid-biased variants.

Examples of the intended tone:
- `Add a detail about Sarah`
- `Remember something about Sarah`
- `Add some context`

**[DECIDED]** These prompts are unobtrusive completeness cues, not warnings, scores, or gamified profile-completion metrics.

**[DERIVED]** Prompt choice should remain stable/deterministic enough not to visibly change on arbitrary re-renders.

## K. Search Rendering
**[DECIDED]** Search preserves the three-row card geometry.

While search is active:
1. Name remains row 1.
2. Recency is replaced by the matched semantic field/type label on row 2.
3. Adaptive context is replaced by the strongest highlighted matching snippet/value on row 3.

Examples:
- `Sarah Chen`
- `Pet`
- `Luna`

or
- `Sarah Chen`
- `Memory`
- `...loves kayaking on Lake Michigan...`

**[DECIDED]** Card View does not add a separate interaction for additional matches.

**[DERIVED]** Additional match count may be shown only if it fits cleanly without disrupting the compact layout.

**[DERIVED]** Card View consumes the shared Dashboard match-descriptor/result contract rather than implementing its own search semantics.

## L. Primary Card Interaction
**[DECIDED]** Tapping a normal card opens the contact Profile.

**[DECIDED]** Card View does **not** mirror List View swipe gestures.

**[DECIDED]** Card View's power interactions are long-press context menu and multi-select instead.

## M. Long-Press Context Menu
**[DECIDED]** Long-press on a normal card opens a per-contact context menu.

**[DECIDED] Initial context-menu order:**
1. View Profile
2. Quick Log
3. Log Interaction
4. Message
5. Edit Contact
6. Favorite / Unfavorite
7. Snooze / Unsnooze
8. Select

**[DECIDED]** Context menu intentionally exposes substantial per-contact power; it need not be artificially sparse.

**[DECIDED]** Delete, Archive, and other high-impact bulk operations are not placed in the ordinary long-press menu.

**[DERIVED]** Quick Log uses the existing immediate-write contract; Log Interaction routes directly into the detailed pre-targeted form; Message/Edit reuse their canonical routable flows.

## N. Multi-Select as Bulk Management
**[DECIDED]** Card/Grid multi-select is Orbit's actual Dashboard **bulk/contact-management surface**.

**[DECIDED]** A separate dedicated bulk-management screen should not be created solely because earlier planning language implied one.

**[DECIDED]** Dashboard overflow should expose a discoverable **Select Contacts** / bulk-management entry that switches to Card/Grid View if needed and enters multi-select mode.

**[DECIDED]** Long-press context menu also exposes `Select` as a fast entry path.

**[DERIVED]** Earlier Dashboard Control Surface wording around `Bulk / Contact Management` should resolve to entering this mode rather than routing to a nonexistent standalone screen.

## O. Contact Import Boundary
**[DECIDED]** Contact import is not part of Card/Grid multi-select bulk management.

**[DECIDED]** Contact import belongs conceptually with Backup/Restore / contact data-management flows.

**[DERIVED]** Do not pull import UI or import semantics into Phase 7 merely because both concern multiple contacts.

## P. Entering Multi-Select
**[DECIDED]** Multi-select can be entered through:
- long-press context menu → Select
- Dashboard overflow → Select Contacts / bulk management

**[DECIDED]** Normal Grid View does not permanently display selection controls before selection mode starts.

## Q. Multi-Select Visual State
**[DECIDED]** Once multi-select starts, every card shows a selection control at the **top-left**.

**[DECIDED]** Unselected cards show an empty circle; selected cards show the selected/check state in that same control.

**[DECIDED]** Tapping anywhere on a card toggles its selection state.

**[DECIDED]** Favorite stars remain visually readable but become non-interactive during multi-select.

**[DECIDED]** Selection mode clearly displays selected-contact count.

## R. Multi-Select Control-Surface Replacement
**[DECIDED]** Dashboard query controls are locked while multi-select is active.

**[DECIDED]** Population / Filters / Sort and Search cease to function during selection mode.

**[DECIDED]** Rather than adding a new bottom bulk-action bar, multi-select **reuses/replaces the existing Dashboard control area** with selection actions and selection-state controls.

**[DECIDED]** Search is included in the area that is replaced/disabled during selection mode.

**[DERIVED]** This avoids ambiguous selection surviving a changing Population/Filter/Search result set and efficiently reuses otherwise-defunct screen real estate.

## S. Select All Semantics
**[DECIDED]** Multi-select includes Select All.

**[DECIDED]** Select All means all contacts in the **current eligible Dashboard result universe**, respecting the Population/Filters/Search state that existed when selection mode began.

**[DERIVED]** Query controls remain frozen until selection mode exits.

## T. Normal Bulk Actions
**[DECIDED] Initial ordinary multi-select actions include:**
- Quick Log
- Log Interaction
- Add to Favorites / Remove from Favorites
- Snooze / Unsnooze
- Set Category
- Archive
- More / Sensitive Operations entry

**[DECIDED]** Bulk Edit is not offered.

**[SUPERSEDED]** The prior prohibition on detailed bulk Log Interaction is superseded by the Phase 12 amendment above.

**[DECIDED]** Multi-contact Quick Log writes one generic/current interaction for each selected contact.

**[DECIDED]** Detailed Log Interaction uses count-aware canonical routing: one selected contact opens the ordinary individual detailed Log Interaction flow; two or more selected contacts open Phase 12 Group Log with the selected contacts preloaded.

**[DECIDED]** Multi-recipient Message is not part of the initial bulk action set.

## U. Explicit Mixed-State Actions
**[DECIDED]** Bulk favorite and snooze actions are explicit rather than generic toggles.

For mixed selections, provide clear operations such as:
- Add to Favorites
- Remove from Favorites
- Snooze
- Unsnooze

**[DECIDED]** Avoid ambiguous “toggle all” semantics.

## V. Bulk Quick Log Safeguards
**[DECIDED]** Quick Log remains immediate for small selections and supports Undo/error feedback according to the existing fast-action contract.

**[DECIDED]** Large selections require confirmation before creating many interaction rows.

**[DERIVED]** Exact numeric threshold is an implementation/product-tuning detail; initial guidance is roughly immediate for small groups and confirmation for materially larger groups.

## W. Bulk Category
**[DECIDED]** Bulk category applies one chosen category to all selected contacts.

**[DECIDED]** This follows the current single-category contact model.

**[DEFERRED]** Multi-category membership semantics if the contact model later evolves to support multiple categories.

## X. Archive
**[DECIDED]** Archive is directly available in multi-select.

**[DECIDED]** Archiving multiple contacts requires an appropriate confirmation because archived contacts leave the Dashboard result universe.

**[DECIDED]** Archive remains outside Sensitive Operations because it is a normal reversible/managed lifecycle operation rather than permanent destruction.

## Y. Sensitive Operations
**[DECIDED]** Multi-select includes a distinct **Sensitive Operations** menu/subsurface for higher-impact batch changes.

**[DECIDED] Initial Sensitive Operations:**
- Change Contact Frequency
- Delete Contacts

**[DECIDED]** Gravity is **not** an action because Gravity is a derived-never-stored statistic computed from interaction history/impact inputs.

**[DERIVED]** Other future high-impact operations may join this menu only when they represent genuine mutable contact state.

## Z. Bulk Contact Frequency
**[DECIDED]** Bulk frequency applies one chosen contact-frequency value to all selected contacts.

**[DECIDED]** Frequency change requires confirmation summarizing the affected contact count/value because it changes downstream relationship-state calculations.

## AA. Bulk Delete / Quarantine
**[DECIDED]** Delete does not immediately hard-delete contacts.

**[DECIDED]** Current delete behavior sends contacts into a **30-day quarantine** where users can restore them, purge them manually, or allow automatic pruning after the quarantine expires.

**[DECIDED]** Bulk-delete confirmation must accurately explain this recoverable quarantine behavior rather than falsely describing immediate permanent deletion.

**[DERIVED]** Exact quarantine-management UI belongs to the existing contact lifecycle/data-management surfaces rather than Phase 7.

## AB. After Bulk Operations
**[DECIDED]** Successful ordinary bulk operations generally preserve selection mode and selected contacts so users may perform multiple cleanup actions without reselecting.

Expected behavior:
- Quick Log → stay selected; show Undo/error feedback.
- Favorite/Snooze/Category/Frequency → stay selected.
- Archive → archived cards disappear; any remaining eligible selections stay selected.
- Delete/quarantine → removed cards disappear; any remaining eligible selections stay selected.

**[DECIDED]** User explicitly exits selection mode when finished.

## AC. Selection Exit / Navigation
**[DECIDED]** Back exits multi-select before normal route navigation.

**[DECIDED]** Selection mode owns card taps; Profile navigation does not occur while selection mode is active.

**[DERIVED]** Entering/leaving multi-select should preserve the pre-selection Dashboard query state so normal browsing resumes exactly where appropriate.

## AD. Loading / Result Transitions
**[DECIDED]** Ordinary fast local Dashboard re-querying should not flash loading skeletons unnecessarily.

**[DECIDED]** Existing cards remain visible during normal fast Population/Filter/Sort/Search updates when possible.

**[DECIDED]** Initial or meaningfully delayed loading may use compact renderer-appropriate placeholders.

**[DECIDED]** Result appearance/disappearance/reordering may use short restrained transitions.

**[DERIVED]** Reduced-motion preference simplifies/removes nonessential transitions.

## AE. Empty / Error States
**[DECIDED]** Card View shares the same semantic/cause-aware Dashboard empty and error states as List View.

Examples include:
- no contacts yet
- no search results
- active Population/Filters produce zero results
- database/load error

**[DECIDED]** Content/copy is mostly shared; layout is renderer-specific.

**[DERIVED]** Routine states use restrained icon + concise copy + appropriate CTA rather than elaborate renderer-specific illustration systems.

## AF. Accessibility
**[DECIDED]** Card View remains understandable without status color.

**[DECIDED]** Accessibility semantics include contact identity, recency, relationship status/snooze state, favorite state, adaptive/search context as appropriate, and selection state.

**[DECIDED]** Large system text may increase card height and/or reduce column count; normal density targets are not accessibility invariants.

**[DECIDED]** Context-menu and selection actions must be reachable without relying exclusively on long-press dexterity.

**[DERIVED]** Selection mode exposes appropriate accessibility roles/states/actions and clear announcements for selection count and bulk-operation outcomes.

## AG. Cross-Phase Constraints
- **Dashboard Data & State Foundation:** Card View consumes the shared query/result/search-match model and does not recreate Dashboard semantics.
- **Dashboard Control Surface:** normal controls remain unchanged outside multi-select; multi-select temporarily replaces/locks that control area.
- **Dashboard List View:** List and Card show mostly the same semantic contact information with renderer-specific presentation; List owns swipe accelerators, Card owns long-press + bulk multi-select.
- **Group Interaction Logging (Phase 12):** owns Group Event domain/persistence, Group Log form, participant inheritance/overrides, Group Event Detail/Edit/management, lifecycle, atomicity, and backup. Card/Grid only launches canonical individual vs Group Log workflows based on selected-contact count.
- **Contact Knowledge:** adaptive/search content comes from the semantic knowledge abstraction; Card applies only a compactness/presentation bias.
- **App Shell / Rapid Capture:** Quick Log, detailed Log Interaction, Message, Edit, and Profile use canonical routable flows rather than Card-specific forms.
- **Theme & Visual System:** avatar rings, status/snooze glyphs, scrims, favorite state, selection state, transitions, and accessibility resolve through semantic tokens/components.
- **Backup/Restore / data management:** contact import belongs there conceptually, not in Dashboard bulk-management mode.
- **Contact lifecycle:** bulk delete respects the existing 30-day quarantine/restore/purge lifecycle.
- **Gravity:** derived-never-stored; never expose bulk gravity mutation.

## Explicitly Deferred
- fully custom final status icon artwork
- exact card dimensions, gaps, avatar diameter, and grid breakpoint numbers
- exact animation timings/easing
- exact multi-select confirmation threshold for bulk Quick Log
- multi-category membership model / category-additive bulk semantics
- bulk Edit Contact
- multi-recipient messaging
- new standalone bulk-management screen
- contact import inside Dashboard/Card View
- hard-delete lifecycle redesign
- custom per-contact Card layout

## Phase Success Criteria
1. Card View presents Dashboard contacts as a compact avatar-first grid targeting three columns on normal portrait phones.
2. Each normal card clearly exposes name, recency, one compact adaptive context item, favorite state, and accessible relationship status/snooze semantics.
3. Status is represented by an avatar ring plus distinct glyph; snooze neutralizes/replaces visible status treatment.
4. Search preserves the three-row geometry while showing matched field/type plus strongest highlighted match context.
5. Tapping opens Profile; long-press exposes the decided per-contact power menu; List-only swipe behavior is not duplicated.
6. Grid multi-select serves as Orbit's Dashboard bulk-management surface and can be entered from long-press or Dashboard overflow.
7. Multi-select replaces/locks normal Dashboard query controls, exposes clear top-left selection circles, supports Select All over the frozen current result universe, and keeps card taps selection-only.
8. Ordinary bulk actions keep Quick Log distinct while also exposing count-aware detailed Log Interaction routing: one selected contact opens the canonical individual flow and two or more open Phase 12 Group Log; favorite/snooze, category assignment, and archive remain available, while bulk Edit remains excluded.
9. Sensitive Operations cleanly separates bulk frequency change and recoverable delete/quarantine behavior from routine bulk actions.
10. Gravity is never presented as mutable bulk state because it remains derived-never-stored.
11. Bulk operations generally preserve selection mode for repeated cleanup and accurately remove archived/quarantined contacts from the visible result set.
12. Empty/error/loading/transition behavior remains consistent with shared Dashboard semantics, renderer-appropriate layout, reduced motion, and accessibility.
13. Responsive behavior gracefully moves away from three columns when device width or accessibility text makes three columns unusable.

## Notes for GSD / Roadmapper
- Treat this as the sibling renderer phase after Dashboard List View.
- Do not reinterpret Card View as a richer mini-profile feed; the product difference is primarily visual/presentational.
- Normal target is a 3-column avatar-first grid.
- Do not duplicate List swipe gestures in Card View.
- Long-press context menu is intentionally powerful.
- Grid multi-select is the actual Dashboard bulk/contact-management capability; do not invent a separate greenfield bulk-management screen.
- The former prohibition on detailed multi-contact Log Interaction is superseded: keep Quick Log distinct, and route detailed Log Interaction by selection count into the canonical individual or Phase 12 Group Log workflow.
- Do not pull Group Event persistence, participant overrides, Group Event Detail/Edit, lifecycle, atomicity, or backup semantics into this renderer phase.
- Update/interpret the earlier Dashboard Control Surface `Bulk / Contact Management` entry as `Select Contacts` / entry into this mode.
- Contact import is not owned by this phase; route that concern toward Backup/Restore/data-management planning.
- Multi-select temporarily replaces/locks Population/Filters/Sort/Search controls rather than allowing result-universe mutations underneath active selections.
- Keep normal bulk actions and Sensitive Operations separate.
- Delete copy must reflect the current 30-day quarantine/restore/purge lifecycle, not permanent immediate destruction.
- Gravity is derived-never-stored and must not become an editable field merely because bulk operations exist.
- Exact gesture/menu mechanics, layout pixels, breakpoints, transition timings, and confirmation thresholds are implementation/tuning work unless device testing exposes a genuine product contradiction.
