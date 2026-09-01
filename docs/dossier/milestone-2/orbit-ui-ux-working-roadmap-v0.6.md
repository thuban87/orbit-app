# Orbit — Working UI/UX Milestone Roadmap v0.6

**Status:** preparatory roadmap · Phases 1–11 interrogated · Dashboard, Orrery, Profile, and History sequences complete · Phase 12 next · fungible until GSD finalization.

## 1. Purpose & Current Status

This document is the current working roadmap for Orbit's upcoming release-quality UI/UX milestone. It is preparatory rather than canonical: phase boundaries and names may still change as remaining phases are interrogated. Completed phase dossiers are the most authoritative planning artifacts for decisions already made.

- **Phase 1 — App Shell & Navigation:** interrogation complete; dossier written.
- **Phase 2 — Theme & Visual System:** interrogation complete; dossier written.
- **Phase 3 — Contact Knowledge Foundation:** interrogation complete; dossier written.
- **Phase 4 — Dashboard Data & State Foundation:** interrogation complete; dossier written.
- **Phase 5 — Dashboard Control Surface:** interrogation complete; dossier written.
- **Phase 6 — Dashboard List View:** interrogation complete; dossier written.
- **Phase 7 — Dashboard Card View:** interrogation complete; dossier written. The settled product is a compact 3-column avatar-first grid despite the historical working name.
- **Phase 8 — Orrery Camera, Scale & Exploration:** interrogation complete; dossier written.
- **Phase 9 — Orrery Systems:** interrogation complete; dossier written.
- **Phase 10 — Profile Experience:** interrogation complete; dossier written.
- **Phase 11 — Interaction History & Insights:** interrogation complete; dossier written.
- **Phase 12 — Rapid Capture & Update Flows:** next phase to interrogate.
- Official milestone requirements and canonical `ROADMAP.md` will later be produced by GSD's `new-milestone` workflow.

### GSD numbering note

This preparatory roadmap uses sequential integer phase numbers because GSD reserves decimal phases for urgent inserted work rather than normal planned decomposition. The eventual `gsd-roadmapper` should assign canonical milestone phase numbers according to GSD's active numbering mode. These preparatory numbers describe **sequence and phase seams**, not a requirement that the canonical milestone literally begin at Phase 1.

## 2. Milestone Product Goal

Transform Orbit's functional foundation into a release-quality, low-friction mobile experience with intentional navigation, presentation, capture workflows, personalization, accessibility, responsive layouts, and onboarding.

The milestone should end in a state suitable for outside beta testers.

## 3. Planning Principles

- UI/UX work may include supporting data/domain changes when required by the desired experience.
- Existing architectural/domain invariants remain binding unless explicitly superseded; prior visual/presentation decisions may be revised during this intended design pass.
- Sync/authentication are not part of this milestone except for foundations explicitly needed now; a local owner profile is acceptable.
- Universal capture, low friction, privacy-first AI behavior, accessibility, and future widget/deep-link readiness remain cross-cutting concerns.
- Dossiers distinguish owner choices **[DECIDED]** from implementation consequences **[DERIVED]** and postponed work **[DEFERRED]**.
- Only meaningful product or higher-level architectural forks should require owner interrogation; routine implementation best practices should be derived.
- Decision density itself is a phase-boundary signal: coherent subsystems should be split before GSD planning rather than allowed to become oversized phases that later require emergency restructuring.
- Renderer phases should not silently absorb business workflows that already belong to shared routing, domain, Settings, Onboarding, or data-management phases.
- Do not turn future-looking architectural compatibility into speculative schema/services. Preserve seams only where current work can do so cheaply.

## 4. Provisional Phase Map

| Phase | Working Name | Status | Core Purpose |
|---|---|---|---|
| 1 | App Shell & Navigation | COMPLETE | Safe areas, bottom nav, back-stack behavior, universal FAB, routing/deep-link foundation. |
| 2 | Theme & Visual System | COMPLETE | Light/dark, Galaxy + Standard themes, backgrounds, tokens, visual/accessibility primitives. |
| 3 | Contact Knowledge Foundation | COMPLETE | Things to Remember model, history, relationships, AI privacy, custom fields, import/backup contracts. |
| 4 | Dashboard Data & State Foundation | COMPLETE | Shared Dashboard result/query model, special populations, filters, sorting, semantic search, persistence, state coordination. |
| 5 | Dashboard Control Surface | COMPLETE | Lean Dashboard shell, Population/Filters/Sort controls, anchored panels, search affordance, List/Card toggle, management access. |
| 6 | Dashboard List View | COMPLETE | Scan-first full-width rows, recency/category/context hierarchy, status/snooze treatment, search-match presentation, favorite toggle, swipe routing. |
| 7 | Dashboard Card View | COMPLETE | Browse-and-recognize 3-column avatar-first grid, status rings, compact adaptive context, long-press actions, Dashboard multi-select. |
| 8 | Orrery Camera, Scale & Exploration | COMPLETE | 2.5D camera, pan/zoom/tilt/yaw, scalable geometry, semantic zoom, focus/cluster focus, built-in Systems, relationship satellites, high-count usability. |
| 9 | Orrery Systems | COMPLETE | Dynamic named Systems, rule/manual membership, HUD builder, preview, management/CRUD, switching animation, persistence and safeguards. |
| 10 | Profile Experience | COMPLETE | Hero-first modular Profile, layout/background templates, Relationship Overview tiles, Things to Remember, contact methods, Profile administration. |
| 11 | Interaction History & Insights | COMPLETE | Interaction-activity heatmap, shared Intensity timeframe, Rolodex History Browser, shared detail sheet, interaction detail/editing, optional duration. |
| 12 | Rapid Capture & Update Flows | NEXT | Add Contact, Quick Log, detailed Log Contact, Update Contact, routable fast-entry flows. |
| 13 | Messaging & AI Compose | PLANNED | Compose UX, contextual knowledge, intentional AI invocation, Copy/Send/Cancel, error states. |
| 14 | Settings & Personalization | PLANNED | Settings IA, notifications, contacts admin/category CRUD, appearance entry points, local owner profile, List swipe-log preference. |
| 15 | AI Configuration & Prompting | PLANNED | AI toggle, provider/model/key management, prompt personalization, central AI permission review. |
| 16 | Onboarding | PLANNED | Concise first-run setup, privacy/local-first explanation, profile, theme, permissions, gesture education, initial swipe-log choice, import/orientation. |
| 17 | Responsive & Release Hardening | PLANNED | Functional landscape, accessibility audit, cross-screen QA, device behavior, responsive density/performance, release readiness. |

## 5. Major Phase Decompositions

### Dashboard sequence

The original Dashboard Experience concept remains intentionally decomposed into shared query/state, controls, and sibling List/Grid renderers.

```text
Dashboard Data & State Foundation
              ↓
    Dashboard Control Surface
              ↓
        ┌─────┴─────┐
        ↓           ↓
    List View    Card/Grid View
```

### Orrery sequence

Orrery remains split between the visualization/camera foundation and the dynamic System authoring/management subsystem.

```text
Orrery Camera, Scale & Exploration
              ↓
      Built-in System consumer
              ↓
         Orrery Systems
      author/manage/switch
```

### Profile / History sequence

Profile composition and personalization are separate from the deeper temporal History subsystem.

```text
Profile Experience
      ↓
History section slot + minimal seam
      ↓
Interaction History & Insights
heatmap / intensity / browser / detail / edit
```

The split is intentional. Phase 10 owns Profile composition, layout/background templates, modular sections, and the History slot. Phase 11 owns History internals and the canonical interaction-detail/editing experience.

## 6. Exported Constraints from Completed Phases

### Phase 1 — App Shell & Navigation
- Permanent bottom nav: Dashboard, Orrery, Backup/Restore, Settings.
- Each top-level tab preserves its stack; retapping the active tab dismisses transient UI first, then returns to root.
- Browse/read screens retain bottom nav and universal FAB; focused workflows hide both.
- Android/system Back and visible app Back have the same logical result; in-app navigation is origin-aware.
- Universal labeled speed-dial FAB exposes Add Contact, Quick Log, Log Contact, Update Contact, and Memory.
- Quick Log writes immediately once the target is known; detailed Log Contact remains a separate routable form.

### Phase 2 — Theme & Visual System
- Galaxy/Standard theme package and Light/Dark/Follow System appearance mode are independent axes.
- Galaxy is deep-space/glass-forward; Standard is softer and calmer.
- Use one semantic component/token system and centralized semantic icon registry.
- Color never carries state meaning alone.
- Orrery may be more immersive while remaining tokenized/accessibile; later Profile/History special visuals still resolve through the same semantic theme system.

### Phase 3 — Contact Knowledge Foundation
- Things to Remember is one user-facing concept over first-class fields, custom fields, relationships, and typed Memories.
- Relationships are structured repeatable records with person/name, relation type, and optional linked Orbit contact.
- Search/Profile/AI/Update Contact consume a semantic knowledge abstraction rather than storage-specific tables.
- AI access is explicit opt-in per item/field and defaults OFF.
- History-aware current-state fields preserve prior values where configured; historical values may be editable according to their owning knowledge model.
- Backup/Restore preserves the expanded knowledge/history/privacy model.

### Phase 4 — Dashboard Data & State Foundation
- Dashboard remains the contact browser/relationship command center; Orrery remains the more explicit relationship-health visualization.
- Active Contacts is the implicit default universe; Favorites, Birthdays, Not Contacted, and Snoozed are special populations.
- Filters remain Category, Social Battery, Relationship Status/Needs Attention, Gravity, and Contact Frequency with OR-within / AND-across semantics.
- Search is scoped to current Population + Filters and never leaks Archived/Unbound.
- Gravity is derived, never ordinary editable contact state.

### Phase 5 — Dashboard Control Surface
- Population, Filters, and Sort remain independent anchored live-apply controls.
- Search sits below them with the List/Card toggle.
- Dashboard overflow resolves bulk management to Select Contacts / Phase 7 Grid multi-select.
- Contact import belongs with Backup/Restore/contact data management, not Dashboard bulk management.

### Phase 6 — Dashboard List View
- Scan-first full-width medium-compact rows with prominent avatar and stable three-line hierarchy.
- Name; recency + category; one deterministic adaptive context line.
- Favorite is always visible; status uses same-weight border + distinct glyph; snooze neutralizes visible health treatment.
- Search replaces secondary rows with match explanation/context.
- Tap opens Profile; right swipe executes configured logging behavior; left swipe routes to Edit Contact.

### Phase 7 — Dashboard Card View
- Card View is a 3-column avatar-first browse-and-recognize grid on normal portrait phones.
- Name, recency, one compact adaptive context line; status via avatar ring + badge; snooze overrides status presentation.
- Tap opens Profile; long press exposes per-contact power menu; no List swipe duplication.
- Grid multi-select is Dashboard bulk management and freezes the current result universe.
- Bulk delete uses the existing 30-day quarantine; Gravity remains derived and noneditable.

### Phase 8 — Orrery Camera, Scale & Exploration
- Orrery is a constrained 2.5D navigable world over one canonical relationship-health/status visualization.
- Camera supports pan, pinch zoom, bounded tilt, yaw, focus/cluster focus, and canonical recenter/north orientation.
- High-count geometry grows physically rather than crushing contacts indefinitely into the initial viewport.
- Semantic zoom progressively reveals identity/context; ambiguous touch clusters use Focus Zoom plus a bottom contact panel.
- Built-in Systems include All Contacts, Favorites, Needs Attention, Not Contacted, Snoozed, Chargers, and one per Category.
- Relationship Satellites are optional lightweight moons for existing unlinked person-like relationships, not a social graph.
- Large sets rely on culling/LOD rather than full-detail rendering of every body simultaneously.

### Phase 9 — Orrery Systems
- A System is a named dynamically resolved Orrery subset with rule-based membership, durable manual inclusions, and exclusions of current rule-derived members.
- Built-in/category Systems have immutable base semantics but support visibility and manual membership overrides.
- System authoring uses an Orrery HUD wizard with rule accordions, Manage Members, and full-canvas Preview.
- Systems Management owns CRUD/order/hide-show; switcher remains for switching only.
- Last active System persists; polished switching uses membership-delta-adaptive spin + shedding/capture with Reduced Motion fallback.
- Empty-valid and broken Systems remain selectable with distinct severity indicators.
- No arbitrary System membership cap.

### Phase 10 — Profile Experience
- Profile becomes a presentation-first read surface with a fixed Hero: large avatar, name, Category, Favorite, Message, Call, overflow, and optional Profile background.
- Hero structure is fixed; customization begins below it.
- Factory Profile order: Relationship Overview → Things to Remember → Contact Methods → Interaction History.
- Profile body is modular but not an unrestricted page builder: top-level sections can reorder/hide/show; eligible child sections can reorder only within their parent; no third customizable nesting level.
- Reusable Profile layout templates and background templates are independent systems.
- Layout/background assignment hierarchy is global/default → Category → contact override. Explicit contact customization outranks inherited Category behavior.
- Reusable template edits update Profiles assigned to that template; freeform contact overrides remain independent.
- Expanded/collapsed state persists per contact and may override template defaults.
- Relationship Overview is the visual/statistical exception: an auto-packed tile grid with supported size variants for Orbit Status, Gravity, Intensity, Last Interaction, Contact Frequency, and Snooze.
- Orbit Status remains Stable/Wobbly/Decaying/Rogue using existing recency + Contact Frequency semantics; no new Health metric or tunable weighting.
- Gravity uses a named tier plus wide-range size-coded sphere; Intensity uses a compact histogram; Frequency changes apply immediately; Snooze gets presets plus a narrow custom-duration/date route.
- Things to Remember remains a one-column configurable surface with compact type-specific cards; blank metadata never consumes space and long content truncates before cards become form-like.
- Factory Things to Remember child order: Pinned/Featured, Last Talked About, Key People/Relationships, Current Location, Memories, Custom Fields, Off Limits, Imported Contact Notes.
- Repeatable Profile sections generally show around three items before View All; remembered-information cards tap to detail and long-press to Edit / Pin / Hide.
- Hidden-from-Profile content remains recoverable through Profile administration/View All and is presentation-only, not privacy/deletion/AI state.
- Off Limits is visible by default and means `avoid bringing these up`; it remains distinct from AI permission.
- Interaction History remains a replaceable Profile section slot whose internals are owned by Phase 11.
- Profile overflow prioritizes Edit Contact, Snooze/Unsnooze, Archive, then layout/background/template administration.

### Phase 11 — Interaction History & Insights
- History & Insights replaces the weak conventional timeline with three children: Activity Heatmap, Intensity, and a Rolodex-style History Browser.
- Heatmap is strictly an interaction-activity visualization; lifecycle/history events never affect heatmap color/counts or its small context card.
- Heatmap lenses: Cycles, rolling 7 Days, Month, Year. Last-used lens persists globally.
- Cycles is the default Orbit-specific view: each block equals one **current** Contact Frequency period. Presets: 5 / 10 / 15 / 20, with 10 default and global persistence.
- Current in-progress cycle uses the same saturation semantics and is distinguished structurally rather than with a second hue.
- 7 Days is rolling last-seven-days; Month preserves real calendar weekday geometry; Year uses a dense daily GitHub-like layout.
- Heatmap first tap opens a small context card; See Details opens the shared period/date detail sheet; empty cells can route to historical detailed logging.
- Heatmap aggregation/rendering should be reusable with future broader interaction queries without building those analytics products now.
- Intensity is a separate History child and uses the same selected History lens/window as the Heatmap.
- History Browser replaces the conventional timeline with synchronized Month / Day / Year wheels; Day is primary, Month/Year remain independently adjustable, and future dates are blocked.
- Galaxy may theme the wheel with restrained celestial depth/glow; Standard is cleaner/flatter. Exact visible-neighbor count is tuning.
- Eventful dates are marked before selection. Interaction-bearing and lifecycle-only dates may use distinct marker treatment.
- A drawer beneath the wheels summarizes the selected date and exposes See Details or Log Interaction without auto-opening large sheets while scrolling.
- Heatmap and History Browser reuse one canonical period/date detail sheet with chronologically interleaved interactions, immutable lifecycle events, and appropriate history-bearing knowledge changes.
- History preserves three record families: editable/deletable Interactions; read-only immutable lifecycle events; independently editable history-aware knowledge changes according to their owning model.
- Contact Frequency and Category changes are omitted from History v1 to avoid audit-log clutter.
- Phase 11 introduces canonical Interaction Detail and focused Edit Interaction routes. Edits can change all current editable fields, including date/time, and derived consumers refresh automatically.
- Interaction delete remains hard-delete with explicit irreversible confirmation; no new interaction-trash subsystem.
- Interactions gain optional duration. Users enter human-friendly minutes/hours via presets + Custom; storage may use canonical seconds. Quick Log never sets duration, and duration does not affect Status/Gravity/Intensity in this milestone.
- History backfill routes into the canonical detailed logging flow with contact/date context; Quick Log remains `now` only.

## 7. Cross-Phase Corrections / Watch Items

- Phase 5 `Bulk / Contact Management` remains superseded by Select Contacts → Phase 7 Grid multi-select; do not create a standalone bulk-management screen.
- Contact import remains a Backup/Restore/contact-data-management concern, not Dashboard multi-select.
- Phase 7 requirements should describe the actual 3-column avatar-first Grid despite the historical Card View name.
- Gravity is derived-never-stored and must not become editable through Dashboard, Orrery, Profile, History, or bulk actions.
- **Category administration gap:** users still need create/rename/reorder/delete Category management. Phase 14 Settings & Personalization remains the natural owner. Profile layout/background assignment and Orrery Systems consume Categories but do not own general Category CRUD.
- Category deletion must account for generated Orrery Systems, dependent custom-System rules, and Profile layout/background Category assignments. Do not create separate reconciliation subsystems unless implementation demonstrates a real need.
- Profile layout/background assignment is intentionally limited to global/default, Category, and contact. Do not pull Orrery Systems, Favorites, Status buckets, Gravity rules, or arbitrary dynamic groups into Profile presentation assignment during this milestone.
- Profile Hero remains structurally fixed; templates customize the body, not the identity anchor.
- Phase 10 compact remembered-information cards must not regress into exhaustive form-like cards with blank rows.
- Phase 11 Heatmap is interaction-only. Lifecycle/history events belong to the Rolodex Browser/detail sheet, not heatmap saturation or context counts.
- Preserve immutable lifecycle-event semantics; editable location/job/etc. history belongs to the history-aware Contact Knowledge model, not the lifecycle event table.
- Canonical Edit Interaction route is introduced in Phase 11 and should be reused by later Rapid Capture/Update work where appropriate.
- Optional interaction duration must be carried through persistence and Backup/Restore, but must not silently alter derived metrics.
- Heatmap temporal aggregation should preserve cheap future reuse for account/category analytics and Your Week without adding those products now.
- Phase 8 Relationship Satellites remain lightweight presentation of unlinked structured relationships; do not expand them into a real social graph inside this milestone.
- Final large-data performance budgets, responsive behavior, yearly heatmap rendering, wheel density, and accessibility QA remain Phase 17 hardening concerns.

## 8. Updated Dependency Order

1. App Shell & Navigation
2. Theme & Visual System
3. Contact Knowledge Foundation
4. Dashboard Data & State Foundation
5. Dashboard Control Surface
6. Dashboard List View
7. Dashboard Card View
8. Orrery Camera, Scale & Exploration
9. Orrery Systems
10. Profile Experience
11. Interaction History & Insights
12. Rapid Capture & Update Flows
13. Messaging & AI Compose
14. Settings & Personalization
15. AI Configuration & Prompting
16. Onboarding
17. Responsive & Release Hardening

Some later phases may be reordered by GSD based on final requirements/dependencies. Preparatory numbering represents current planning seams, not canonical execution numbering.

## 9. Next Planning Target

**Phase 12 — Rapid Capture & Update Flows**

Interrogation should focus on meaningful product and higher-level architecture forks for the canonical capture/update workflows exposed by the universal FAB and deep-link foundation:

- Add Contact form structure and progressive disclosure,
- Quick Log confirmation/Undo/error behavior only where Phase 1 has not already settled it,
- detailed Log Contact form composition,
- reuse of the Phase 11 Interaction Detail/Edit Interaction contracts,
- optional interaction duration entry,
- Update Contact's low-friction taxonomy versus full Edit Contact,
- adding Things to Remember / Memory from a pre-targeted context,
- contact-picker/preselection behavior where not already shell-owned,
- historical/backdated logging entry points,
- save/cancel/unsaved-change behavior,
- keyboard ergonomics,
- validation/error states,
- deep-link/widget-ready routing and completion destinations,
- accessibility and focused-workflow behavior.

Treat Phase 1 as authoritative for the universal FAB, Quick Log = immediate `now`, contact picker, deep-link routing, and focused-workflow shell. Treat Phase 3 as authoritative for the Contact Knowledge model. Treat Phase 11 as authoritative for Interaction Detail/Edit Interaction and optional duration. Do not recreate those systems inside Phase 12.

Do not pull Messaging/AI Compose, general Settings/Category administration, or onboarding education into Rapid Capture merely because those later phases link to these routes.

## 10. Handoff Rule

For completed phases, consult the phase dossier before relying on this roadmap summary. This roadmap is the index and sequence; the dossiers are the decision record.

Future sessions should not casually reopen **[DECIDED]** choices. Surface only genuine conflicts, new dependencies, or device/usability findings that materially invalidate a prior decision.
