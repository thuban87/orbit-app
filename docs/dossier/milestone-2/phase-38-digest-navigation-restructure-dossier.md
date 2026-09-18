# Dossier --- Digest & Navigation Restructure

**Status:** ready for planning · Interrogated through 2026-09-18 · Phase 38 product contract settled against the current Milestone 2 roadmap, repository snapshot, and adjacent Phase 37/37.1 work.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.
- **[PLANNING NOTE]** repository finding to verify at execution time.

## Scope
Phase 38 replaces Orbit's current contact-browser-as-dashboard shell with a true Digest-centered home experience. Permanent navigation becomes **Contacts · Events · Digest · Orrery · Settings**. Digest is centered and becomes the default launch destination; Dashboard becomes Contacts; Group Events becomes user-facing Events; the redundant Backup bottom tab disappears because Backup & Restore already exists in Settings.

The existing Your Week/Digest experience becomes a modular Digest containing **Up Next**, **Horizon**, and **Your Week**. The phase consumes the previously deferred birthday, Group Event rollup, and history/aggregation obligations without expanding into a Contacts redesign, Events redesign, calendar system, configurable dashboard, or new relationship-domain model.

# A. Application Shell
**[DECIDED]** Bottom navigation order is Contacts, Events, Digest, Orrery, Settings.

**[DECIDED]** Digest is the center tab and default/root destination on a fresh app/navigation launch.

**[DECIDED]** Background/resume preserves current navigation state; returning to Orbit must not reset the user to Digest.

**[DECIDED]** Each tab owns an independent navigation stack. Switching tabs preserves other stacks during the active session.

**[DECIDED]** Reselecting the active tab returns that tab to its root.

**[DECIDED]** All five tabs are ordinary equal visual peers. Digest is not a raised/oversized special center button.

# B. Product Terminology
**[DECIDED]** The home surface is user-facing **Digest**.

**[DECIDED]** Digest's user-facing name should come from a lightweight canonical product-label constant/source where practical so it can be renamed later without hunting through presentation strings.

**[DERIVED]** This is not runtime configuration, localization work, or a general configurable-label framework.

**[DECIDED]** User-facing Dashboard terminology is retired in favor of **Contacts**.

**[DECIDED]** Group Events becomes **Events** everywhere user-facing where the shorter term is natural.

**[DERIVED]** Internal `GroupEvent`, historical ADR language, and existing implementation names need not be mechanically renamed unless clarity/correctness benefits.

# C. Digest Information Architecture
**[DECIDED]** Digest is modular but owner-curated. Major sections appear in fixed order:
1. **Up Next**
2. **Horizon**
3. **Your Week**

The semantic progression is **act → be aware/look ahead → look back**.

**[DECIDED]** Major sections remain visible when empty with neutral empty states. Empty Horizon subgroups disappear.

**[DEFERRED]** User module ordering, hiding, pinning, custom modules, or other dashboard-builder behavior.

# D. Up Next
**[DECIDED]** Up Next answers **Who should I reach out to next?**

**[DECIDED]** Show at most three contacts.

**[DECIDED]** Use canonical relationship/orbit attention semantics. Overdue/rogue contacts naturally outrank approaching contacts where existing status/progress logic says they should.

**[DERIVED]** Do not invent Digest-specific urgency classifications.

**[DECIDED]** Rows expose enough existing orbit/relationship context to explain why the person is present.

**[DECIDED]** Row tap opens Profile; Back returns to Digest.

**[DECIDED]** No inline Call/Message controls and no required View All affordance in Phase 38.

# E. Horizon
**[DECIDED]** Horizon answers **What should I be aware of?** It is awareness-oriented rather than an action queue.

**[DECIDED]** Phase 38 subgroups are **Birthdays**, **Overlooked**, and **Never Contacted**.

**[DECIDED]** Keep them as separate labeled groups rather than ranking unlike concepts in one feed.

**[DECIDED]** Up Next receives first claim on its three outreach-priority contacts. Horizon must not duplicate the same overlooked/rogue condition for those contacts.

**[DECIDED]** Overlooked may surface additional applicable contacts after that deduplication.

**[DERIVED]** Future informational notice types may fit Horizon, but Phase 38 must not invent them merely to populate it.

# F. Birthdays
**[DECIDED]** The inherited birthday obligation lives at Horizon → Birthdays.

**[DECIDED]** Birthdays look forward through the next seven days, independent of Your Week's retrospective period.

**[DECIDED]** Show all matches, soonest-first.

**[DECIDED]** Today's birthday receives lightweight temporal prominence such as Today; future entries may use Tomorrow or a formatted date.

**[DECIDED]** Birthday row tap opens Profile; Back returns to Digest.

**[DEFERRED]** Configurable birthday horizons or richer birthday-specific actions.

# G. Overlooked & Never Contacted
**[DECIDED]** These populations must scale without dumping arbitrarily large lists into Digest.

**[DECIDED]** Larger populations use compact preview/count behavior with drill-through to the appropriate Contacts population/filter where existing architecture supports it cleanly.

**[DECIDED]** Never Contacted is conditional, not a permanent dashboard statistic.

**[DERIVED]** Reuse canonical Contacts filtering/population behavior rather than creating Digest-only browsers.

# H. Your Week
**[DECIDED]** Your Week becomes a general retrospective summary rather than primarily a list of contacts.

**[DECIDED]** Keep the name **Your Week**.

**[DECIDED]** Initial metrics are **People reached**, **Interactions**, and **Events**.

**[DECIDED]** People reached is unique contacts represented in qualifying activity during the selected period; Interactions counts qualifying logged interactions; Events counts qualifying Group Events.

**[PLANNING NOTE]** Reconcile exact aggregation with execution-time canonical interaction, Group Event, and Phase 32 history/heatmap contracts rather than creating parallel definitions.

**[DECIDED]** Metrics are informational in Phase 38, not required buttons/filter controls.

**[DECIDED]** Inactive periods remain visible with neutral language; no guilt/streak mechanics.

# I. Your Week Period
**[DECIDED]** Support **Rolling 7 Days** and **Calendar Week**.

**[DECIDED]** Rolling 7 Days is default.

**[DECIDED]** Calendar Week honors device/locale first-day-of-week conventions; no Orbit-specific Sunday/Monday preference.

**[DECIDED]** The chosen period consistently controls metrics, heatmap, and day detail.

**[DECIDED]** Put the preference in Settings wherever it naturally fits at execution time.

**[DERIVED]** Use the existing settings/preferences persistence path; do not broadly restructure Settings or create relationship-domain schema.

**[DECIDED]** This preference does not affect Horizon's birthday window or Digest notification cadence.

# J. Your Week Heatmap
**[DECIDED]** Reuse the visual/interaction language of the Profile activity heatmap/history experience.

**[DECIDED]** Digest is scoped to the selected Your Week period.

**[DECIDED]** Selecting a day expands that day's activity **inline beneath the heatmap**.

**[DECIDED]** Do not add the Profile calendar rotary or equivalent long-range history navigation.

**[DERIVED]** Reuse Phase 32/history aggregation infrastructure and components/helpers where practical.

**[DECIDED]** Group Events participate in activity/day detail as one event record rather than fake per-participant interaction rows.

**[DERIVED]** Unique participating contacts may contribute to People reached according to canonical aggregation semantics.

# K. Contacts, Events & Backup
**[DECIDED]** Dashboard/Home becomes the Contacts root. Remove the Your Week and Group Events header shortcuts and do not add replacement clutter.

**[DECIDED]** Preserve existing Contacts browsing/search/filtering/sorting/list/grid/bulk behavior unless navigation adaptation is necessary.

**[DECIDED]** Existing Group Events becomes the Events root. Preserve current browse/create/detail/edit behavior.

**[DECIDED]** Phase 38 does not substantially redesign Contacts or Events.

**[DECIDED]** Remove Backup from bottom navigation. Do not relocate/rebuild Backup & Restore because the recent Settings work already provides its page.

**[DEFERRED]** Broad Contacts redesign; broad Events redesign; planned/future events; calendar semantics/sync.

# L. Profiles & Origin-Aware Navigation
**[DECIDED]** Profiles remain origin-aware rather than belonging only to Contacts.

Expected Back behavior includes:
- Digest → Profile → Back → Digest
- Contacts → Profile → Back → Contacts
- Orrery → Profile → Back → Orrery
- Events/detail context → Profile → Back → originating Events context

**[DERIVED]** Preserve the existing origin-aware navigation contract while restructuring root stacks.

# M. Global FAB
**[DECIDED]** The existing FAB remains a global shell affordance.

**[DECIDED]** Digest includes the FAB with the same actions currently available from Contacts.

**[DECIDED]** Do not invent Digest-specific FAB actions.

**[DERIVED]** Audit FAB mounting/visibility across the new shell so root promotion does not create inconsistent behavior.

# N. Notifications & Semantic Routing
**[DECIDED]** Existing Digest notification scheduling/settings semantics remain unless the navigation restructure directly requires a correctness fix.

**[DECIDED]** Activating the Digest notification opens/selects the new Digest root.

**[DECIDED]** Deep links/notifications should target current semantic destinations rather than recreate obsolete stack shapes.

**[DERIVED]** Audit current Dashboard → Digest and nested Group Events routing assumptions.

**[PLANNING NOTE]** There are no production users to preserve through this shell transition; current installations are development/test devices. Do not manufacture legacy-navigation migration machinery without a real need.

# O. Persistence & Reuse Guardrails
**[DECIDED]** Digest is derived from canonical contacts, orbit state, birthdays, interactions/history, and Group Event data.

**[DERIVED]** No new relationship-domain SQLite schema or persisted Digest snapshot/cache is expected.

**[DERIVED]** Reuse existing Digest reads/logic, birthday reads, canonical relationship status/progress, Group Event reads, Phase 32/Profile heatmap aggregation, navigation-origin machinery, global FAB, and Settings preference conventions.

**[PLANNING NOTE]** Verify exact execution-time ownership of reads/helpers/components before planning. Dossier sections are product contracts, not instructions to create one service per module.

# P. Themes, Accessibility & Empty States
**[DECIDED]** Standard and Galaxy use identical information architecture and interaction semantics; differences remain presentational.

**[DERIVED]** Preserve labeled tab/FAB actions, adequate touch targets, readable presentation, and accessible selected/expanded states.

**[DERIVED]** Heatmap day selection must not rely solely on color/intensity.

**[DECIDED]** Neutral empty-state model:
- Up Next: nobody currently needs attention.
- Horizon: nothing currently on the horizon.
- Your Week: no qualifying activity in the selected period.

# Q. Explicit Deferrals
**[DEFERRED]** Digest customization beyond the Your Week period preference.

**[DEFERRED]** Configurable Up Next count or birthday horizon.

**[DEFERRED]** Digest-specific FAB actions or inline outreach controls.

**[DEFERRED]** Calendar rotary/full long-range history in Digest.

**[DEFERRED]** Contacts or Events redesign.

**[DEFERRED]** Planned-event/calendar integration.

**[DEFERRED]** Broad Settings restructuring.

**[DEFERRED]** Repository-wide historical/internal terminology cleanup.

# R. GSD / Planning Guardrails
**[DERIVED]** Do not decompose Phase 38 into one plan per tab or Digest module. The coherent problem is the shell/home-model transition plus the minimum Digest composition needed to make it useful.

A sensible planning shape is likely:
- five-tab/root-stack shell and semantic routing;
- Digest read/composition foundation (Up Next + Horizon);
- Your Week period/metrics/heatmap integration;
- Contacts/Events promotion cleanup + notification/FAB integration;
- navigation regression, accessibility, themes, and physical-device UAT.

This is guidance, not a mandated plan count.

**[DERIVED]** Keep the phase narrow even though navigation touches many surfaces. Do not opportunistically redesign every screen encountered.

# S. Planning-Time Verification Checklist
Before GSD decomposes Phase 38 against the execution-time repository:

1. Inventory current root tabs/stacks and routes nested under Dashboard/Home.
2. Verify origin-aware Profile navigation from Contacts, Events, Digest, and Orrery.
3. Audit global FAB mounting/actions.
4. Verify Settings Backup & Restore before removing the Backup tab.
5. Inventory user-facing Dashboard/Group Events labels that must become Contacts/Events.
6. Identify canonical relationship/orbit status/progress logic for deterministic Up Next ordering.
7. Verify overlooked/rogue and never-contacted reads and Up Next/Horizon deduplication.
8. Verify next-seven-days birthday/date-boundary behavior.
9. Verify Phase 32/Profile heatmap aggregation and reusable day-detail presentation.
10. Define Rolling 7 Days and locale-aware Calendar Week boundaries once and apply them consistently.
11. Verify Group Event contribution to metrics, heatmap activity, and inline day detail without double counting.
12. Add the period preference through existing Settings persistence conventions.
13. Audit Digest notification/deep-link routing to the new Digest root.
14. Test tab reselect-to-root, tab-state preservation, fresh launch to Digest, and background/resume preservation.
15. Exercise physical Android UAT across all five tabs, origin-aware Profile Back, FAB actions, Horizon drill-through, heatmap inline expansion, notification routing, and Standard/Galaxy presentation.

---

## Dossier Summary
Phase 38 replaces Orbit's contact-browser-as-dashboard model with a true Digest-centered home shell.

Navigation becomes **Contacts · Events · Digest · Orrery · Settings**, with Digest centered and used for fresh launches. Contacts and Events are promoted/relabelled without redesigning their underlying experiences; Backup simply loses its redundant bottom-tab exposure.

Digest is a fixed three-part surface: **Up Next** identifies the three contacts most deserving outreach using canonical orbit semantics; **Horizon** provides contextual awareness through birthdays, additional overlooked contacts, and never-contacted contacts; **Your Week** summarizes the selected retrospective period through People reached / Interactions / Events metrics and a reusable activity heatmap with inline day detail.

The phase should mostly recompose existing reads, aggregation, navigation, FAB, notification, and Settings infrastructure. Its planning priority is therefore not "build three dashboard widgets." It is: **establish Orbit's durable home/navigation model while turning existing relationship state into a concise, useful Digest without spawning parallel domain logic or adjacent redesigns.**
