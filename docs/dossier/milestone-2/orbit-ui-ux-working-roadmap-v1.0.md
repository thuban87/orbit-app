# Orbit — Working UI/UX Milestone Roadmap v1.0

**Status:** preparatory roadmap · Phases 1–14 and 16 interrogated · AI Configuration & Prompting complete · Phase 15 intentionally deferred until after execution of Phases 1–14 · Onboarding/Release Hardening planning also deferred · fungible until GSD finalization.

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
- **Phase 12 — Group Interaction Logging:** interrogation complete; dossier written.
- **Phase 13 — Rapid Capture & Update Flows:** interrogation complete; dossier written.
- **Phase 14 — Messaging & AI Compose:** interrogation complete; dossier written.
- **Phase 15 — Settings & Personalization:** interrogation intentionally deferred until after execution of Phases 1–14, so the final Settings IA can consolidate the actual implemented preference/admin surface rather than speculate ahead of it.
- **Phase 16 — AI Configuration & Prompting:** interrogation complete; dossier written.
- **Phase 17 — Onboarding:** interrogation intentionally deferred until the substantive product is implemented enough to design first-run setup against the real experience.
- **Phase 18 — Responsive & Release Hardening:** detailed planning intentionally deferred until the substantive product is implemented enough for device/accessibility/performance findings to be concrete.
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
- Settings, Onboarding, and Release Hardening are intentionally treated as late integration/planning surfaces: earlier feature phases export configuration/teaching/hardening seams, but their final IA/content should be planned against the implemented product rather than exhaustively predesigned.

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
| 12 | Group Interaction Logging | COMPLETE | Group Event parent + canonical child Interactions, event-first capture, shared/default inheritance, participant overrides, Group Event Detail/Edit, browse/management, lifecycle, atomicity, backup/restore seams. |
| 13 | Rapid Capture & Update Flows | COMPLETE | Add Contact, Quick Log, ordinary detailed Log Interaction, Update Contact, routable fast-entry flows; consumes Phase 12 Group Log rather than redefining it. |
| 14 | Messaging & AI Compose | COMPLETE | Compose-first drafting workspace, Text/Email handoff, Research-side Things to Remember, optional AI Draft/Rewrite, Message Focus, three-suggestion review, Transmit/follow-through logging. |
| 15 | Settings & Personalization | DEFERRED PLANNING | Final Settings IA/admin consolidation is intentionally deferred until after execution of Phases 1–14; earlier phases still export the preferences/admin seams it must eventually expose. |
| 16 | AI Configuration & Prompting | COMPLETE | Three-lane AI connection architecture, OpenRouter-first setup, direct BYOK/custom endpoint advanced paths, model catalogs/pricing, prompt personalization/context, Adjust, permissions, transparency, lifecycle and diagnostics. |
| 17 | Onboarding | DEFERRED PLANNING | Final first-run setup/teaching is intentionally deferred until the substantive product exists in implementation. |
| 18 | Responsive & Release Hardening | DEFERRED PLANNING | Detailed device/accessibility/performance/readiness planning is intentionally deferred until implementation exposes real cross-screen issues. |
| 19 (provisional) | Your Week | DEFERRED PLANNING | Designs the Your Week page (relocated birthday presentation per ADR-034 supersession, Group Events, heatmap aggregation reuse) once those inputs exist; planned after Phase 16. |

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

### Group Interaction / Rapid Capture sequence

Group Interaction Logging is now a coherent domain/workflow subsystem inserted before ordinary Rapid Capture. Rapid Capture consumes it rather than implementing a Dashboard-specific or single-form bulk variant.

```text
Interaction History & canonical Interaction model
                    ↓
       Group Interaction Logging
 Group Event + child Interaction contract
                    ↓
      Rapid Capture & Update Flows
 ordinary capture + consuming entry points
```

Phase 12 owns Group Event persistence, event-first capture, shared/default inheritance, participant overrides, Group Event Detail/Edit, browse/management, participant lifecycle, atomicity, and backup/restore seams. Phase 13 owns ordinary single-contact capture/update ergonomics and consumes the Phase 12 route where multi-contact logging is invoked.

## 6. Exported Constraints from Completed Phases

### Phase 1 — App Shell & Navigation
- Permanent bottom nav: Dashboard, Orrery, Backup/Restore, Settings.
- Each top-level tab preserves its stack; retapping the active tab dismisses transient UI first, then returns to root.
- Browse/read screens retain bottom nav and universal FAB; focused workflows hide both.
- Android/system Back and visible app Back have the same logical result; in-app navigation is origin-aware.
- Universal labeled speed-dial FAB exposes six actions: Add Contact, Quick Log, Log Contact, Group Log, Update Contact, and Memory.
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
- Active Contacts is the implicit default universe and excludes never-contacted contacts (ADR-011 preserved); special populations are Favorites, Birthdays, Not Contacted, Snoozed, and All Contacts (Active ∪ Not Contacted); Favorites are binary — the Manage-favourites reorder screen is retired (ADR-033 superseded 2026-09-01).
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
- Bulk Archive is the recoverable removal (permanent deletion stays a manual per-contact action on the Archived list, ADR-018; no contact auto-purge); Gravity remains derived and noneditable.

### Phase 8 — Orrery Camera, Scale & Exploration
- Orrery is a constrained 2.5D navigable world over one canonical relationship-health/status visualization (ADR-048 superseded 2026-09-01: single unnamed status view).
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

### Phase 12 — Group Interaction Logging
- Group Event is a first-class event/history-context parent; it does **not** replace ordinary one-contact-per-Interaction rows.
- Every participant receives exactly one canonical child Interaction. The parent never counts as an additional contact interaction.
- A Group Event requires title + date/time and may validly have zero participants for event-first capture.
- Event-owned shared/default fields include Channel, Tone, Duration, and Group Note. Tone defaults null; Duration defaults unset; Group Log defaults Channel to In Person.
- Participant-overridable fields include Channel, Tone, Duration, and direction/connected where relevant. Date/time is shared and non-overridable.
- Overrides use live inheritance. `Follow event ...` removes an override and resumes inheritance.
- Group Note and participant note remain linked but distinct; Group Note is one shared parent field rather than duplicated into children.
- Group Event Detail is presentation-first; Edit Group Event is a separate focused form. Participant cards link to child Interaction Detail and expose edit/remove context actions.
- Group Events have a lean chronological/searchable management page reachable from a prominent Dashboard header icon+label and redundantly from Dashboard overflow.
- Universal FAB gains a distinct Group Log action. Dashboard Grid keeps Quick Log and routes detailed Log Interaction as 1 selected → individual, 2+ → Group Log.
- Existing ordinary Interactions can be converted into Group Events without replacing their identity.
- Dissolve Group Event keeps child Interactions as standalone records; Delete Group Event & Interactions permanently removes the parent and children after confirmation.
- Group Event multi-row mutations are atomic from the user's perspective; failed saves preserve unsaved form state.
- Backup/Restore preserves Group Events, child links, shared/default values, Group Note, and explicit override/inheritance state.
- Future planned events, calendar sync, Mission Control, Group Event analytics, and shell restructuring are deferred.

### Phase 13 — Rapid Capture & Update Flows
- Add Contact is deliberately streamlined: Name is the only required field; initial visible accordion groups are Identity, Relationship Basics, and Contact Methods, with **Show More** revealing advanced enrichment sections. Multiple drawers may remain open.
- Edit Contact exposes the complete accordion-based contact record using the same vocabulary, with remembered-information subdomains directly findable rather than hidden behind a nested Things to Remember accordion.
- New contacts with no Contact Frequency are Unbound. Selecting a cadence turns Bound on; users may explicitly keep a cadence while Unbound as dormant cadence information.
- Quick Log remains immediate/current-time, never asks for duration before writing, and may offer **Add Note** after success. The tiny post-log editor can save an Interaction Note or **Create Memory Instead**, never duplicate both.
- Rapid Memory capture stays basic and may offer Edit Memory after save; the full Memory editor lives in Update Contact. Exact default/general Memory type naming remains unresolved because the existing Memory registry contract does not enumerate a complete built-in catalog.
- Ordinary detailed Log Interaction uses primary fields Date/Time, Channel, Direction, Connected where relevant, optional Tone, and Note; Duration lives under More Options.
- Ordinary Channel vocabulary is **Message / Call / In Person**. Message intentionally absorbs email/text/chat granularity for this release.
- Ordinary Channel preference choices are Message / Call / In Person / Remember Last Choice; factory default is Remember Last Choice, and remembered Channel changes only after successful ordinary saves. Group Log is explicitly exempt and defaults In Person.
- Direction defaults Outbound for Message/Call and Mutual for In Person. Connected defaults Yes for Message/Call and is omitted for In Person.
- Canonical **Tone** values are Positive / Neutral / Negative; Tone is optional/null and omission must not be treated as Neutral.
- Historical ordinary logging is freely backdateable without arbitrary age warnings; History-originated logging can prefill contact/date context while preserving later editability.
- Update Contact is a fast chooser/editor loop distinct from full Edit Contact. It includes Last Talked About, Key People/Relationships, Current Location, Memory, Custom Fields, Off Limits, Contact Method, and Contact Frequency; Category remains Edit Contact scope.
- Existing custom fields may surface directly in Update Contact by their user-facing names, while a generic Custom Fields entry remains for creation/broader discovery. Saving one update returns to the chooser for additional changes until Done.
- Add/Edit use one form-level Save; populated optional values must validate, errors reveal their accordion, failed saves preserve form state, and unchanged forms can exit without confirmation.
- All ordinary fast-entry routes reuse canonical picker/preselection, focused-workflow shell, keyboard-aware behavior, origin-aware completion, and deep-link/widget-ready semantic routes.


### Phase 14 — Messaging & AI Compose
- Compose is an **AI-assisted drafting workspace with external handoff**, not an in-app messaging client; manual drafting remains fully functional with or without AI.
- Composition owns the initial viewport. The old Conversation Fuel-first hierarchy is replaced by a Compose-first surface plus a separate full-screen **Things to Remember** Research side.
- Compose message modes are **Text / Email**. Phase 15 Settings owns the preference **Text / Email / Remember Last Choice**, with **Remember Last Choice** as factory default.
- Text resolves to the primary phone; Email resolves to the primary email. If no primary exists, deliberate selection establishes one. If the preferred mode is unusable but the alternate supported mode is viable, Compose falls back automatically.
- Email mode exposes Subject + Body. Main Copy copies the body; Subject has its own lightweight copy action.
- The primary external-handoff action is **Transmit**. Orbit hands the composition to the supported external text/email composer but never treats opening that app as proof of delivery.
- Returning from Transmit triggers a compact **Did you send it?** confirmation when reliable lifecycle detection permits. `Yes, log interaction` writes the canonical Message interaction; `Not yet` preserves the Compose session. Copy never triggers follow-through logging.
- Compose drafts are **session-only navigation state**, not durable records: body, subject, mode, destination, and Message Focus may survive meaningful in-app return/backgrounding, but no draft table/backup contract is added.
- AI affordances are completely absent when AI is not actually configured/usable: no disabled sparkle UI, setup nag, or Compose-level provider troubleshooting.
- When AI is available, the action adapts by editor state: **Draft with AI** when empty, **Rewrite with AI** when text exists. Standard generation returns **three suggestions** for comparison; AI never overwrites the editor until the user explicitly chooses one.
- `Try Again` replaces the current three suggestions with three fresh ones. One-off Adjust/fine-tuning behavior is owned by the completed Phase 16 AI Configuration & Prompting contract.
- Research mode shows only useful populated knowledge groups in a compact read-only projection; contact-method/relationship-health metadata is not treated as composition research. Off Limits remains visibly human-readable and is never selectable as a focus topic.
- AI consumes the preauthorized Contact Knowledge pool established by Phase 3 without per-generation approval. Eligible Research items may be marked **Add to AI** / `Added ✓` as session-only **Message Focus**, capped at three items; this never grants AI permission by itself.
- **Random Thought** — surfacing a random remembered item to inspire manual outreach — is explicitly deferred as a future Compose enhancement.

### Phase 16 — AI Configuration & Prompting
- AI is optional and globally controlled by a real **AI Enabled** master toggle. Turning AI off hides normal AI setup/usage surfaces but preserves connections, model selections, personalization, and per-information permissions; a credential-management escape hatch remains available while AI is off.
- Orbit supports exactly **one active AI connection at a time** across three lanes: **OpenRouter** as the recommended path, **Direct Provider / BYOK** for OpenAI/Anthropic/Gemini under Advanced Setup, and an **OpenAI-compatible Custom Endpoint** under Advanced Setup. Inactive saved credentials/configurations are retained until explicitly removed.
- Switching to an unconfigured lane never breaks the currently working connection; the new lane becomes active only after successful setup. Orbit never silently fails over to another saved connection or model.
- OpenRouter uses a browser-based authorization/connection flow and Orbit-owned model picker. The picker is curated-first with broader catalog browsing, detailed current/cached pricing, and initial economical recommendations led by **GPT-5.6 Terra** (balanced), **Gemini Flash** (cost efficiency), and **Claude Haiku** (lightweight/simple capability). Concrete catalog IDs/prices are runtime data, not frozen requirements.
- Each saved connection remembers its own selected model. Missing/unavailable models create an explicit **Needs attention** state and require deliberate reselection. Model/catalog freshness may be daily/manual; pricing used for estimates should be materially fresher than the broader catalog.
- Orbit owns the immutable system/output prompt contract. Users personalize through structured Writing Style controls plus arbitrary global **Personalization Context** sections with title/body/enabled/order state. Pasting is preferred; `.txt` and `.md` import is supported by copying content into Orbit-owned local records.
- Orbit does **not** impose an artificial context ceiling or silently truncate enabled context. It exposes token/context estimates and, for OpenRouter, estimated **input cost** using current/cached pricing; true model-capacity overflow is shown explicitly.
- Contact Knowledge AI permissions remain authoritative: permission means eligible contact information is included in AI context; **Message Focus** increases emphasis without granting permission; AI-enabled **Off Limits** are sent as negative/avoidance constraints. The three most recent Interactions may be included, with notes only where permitted.
- **Adjust** is ephemeral to the current generation/review session and can combine quick actions with freeform guidance; it returns three revised alternatives without changing persistent Writing Style.
- Central AI permission management supports defaults for new information, searchable existing-access review, bulk disable, and confirmed bulk enable. Type-default changes remain new-items-only.
- Transparency is intentionally split: **Settings** can inspect the whole resolved AI system/prompt and optionally preview it with a chosen contact; **Compose** exposes only the contact-specific disclosure for that generation (for example, the exact items being shared about Mom).
- AI Off removes AI generation UI. AI On + broken connection/model preserves configuration and surfaces a clear **AI needs attention** repair path in Compose instead of silently hiding AI.
- User-facing provider/model errors are human-readable and preserve Compose state. A sanitized structured telemetry seam is defined for later Sentry integration, but prompts, contact data, personalization text, credentials, and generated drafts must never enter production diagnostics by default.
- Backup/Restore preserves nonsecret personalization/configuration and AI permissions while excluding direct-provider keys, OpenRouter credential state, and Custom Endpoint secrets.
- Explicitly deferred: Orbit-hosted AI proxy/subsidized inference, arbitrary HTTP API builder, LAN/local-model endpoints, per-contact persistent AI personalization docs, writing-sample training/inference, DOCX/PDF personalization imports, silent fallback, and full app-wide Sentry implementation.

## 7. Cross-Phase Corrections / Watch Items

- Phase 5 `Bulk / Contact Management` remains superseded by Select Contacts → Phase 7 Grid multi-select; do not create a standalone bulk-management screen.
- Contact import remains a Backup/Restore/contact-data-management concern, not Dashboard multi-select.
- Phase 7 requirements should describe the actual 3-column avatar-first Grid despite the historical Card View name.
- Gravity is derived-never-stored and must not become editable through Dashboard, Orrery, Profile, History, or bulk actions.
- **Category administration gap:** users still need create/rename/reorder/delete Category management. The eventual Settings & Personalization consolidation remains the natural owner, but its detailed planning is intentionally deferred until after execution of Phases 1–14. Profile layout/background assignment and Orrery Systems consume Categories but do not own general Category CRUD.
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
- Final large-data performance budgets, responsive behavior, yearly heatmap rendering, wheel density, and accessibility QA remain late Release Hardening concerns whose detailed planning is intentionally deferred until implementation.
- **Group Log amendments synchronized:** Phases 1, 5, 7, and 11 have targeted amendments incorporating the Phase 12 Group Interaction Logging contract. Treat their amended wording as authoritative where older text conflicts.
- **Phase 13 complete:** ordinary rapid capture uses canonical **Tone**, with Tone optional/null by default; it does not recreate Group Event behavior.
- **Ordinary Channel preference seam:** the eventual Settings consolidation must expose Message / Call / In Person / Remember Last Choice, with Remember Last Choice as factory default and remembered state updating only after successful ordinary saves; the underlying preference/state seam may be implemented earlier where required.
- **Group Log Channel exception:** the eventual Settings consolidation must make clear that the ordinary Channel preference does not govern Group Log; Group Log continues to default to In Person.
- **Add Contact creation lifecycle:** Name is the only required field; no cadence creates an Unbound contact, selecting cadence turns Bound on, and explicit Unbound may retain dormant cadence.
- **Memory mechanics watch:** Phase 13 defines basic rapid Memory capture plus a full Memory editor through Update Contact, but the exact canonical default/general built-in Memory type/name remains a reconciliation item because Phase 3 never enumerated a complete built-in type catalog.
- **Backup/Restore watch:** Group Event records, links, Group Note, and override state are durable backup data.


- **Phase 14 complete:** Compose is a drafting/research/handoff workflow, not a messaging client. `Transmit` hands off externally and post-return confirmation logs a Message interaction only after explicit user confirmation.
- **Compose message-mode preference seam:** the eventual Settings consolidation must expose Text / Email / Remember Last Choice, with Remember Last Choice as factory default and remembered state updating on meaningful Copy/Transmit use; runtime preference/state support may land with the owning feature earlier.
- **AI availability contract:** Phase 16 supersedes the earlier simplistic provider=None/unusable wording with three states: AI Off removes AI generation UI; AI On + Ready exposes AI actions; AI On + Needs Attention shows a repair notice rather than silently disappearing. Phase 16 owns connection/model setup, prompt personalization/context, Adjust, permissions, transparency, and readiness.
- **Message Focus privacy boundary:** `Add to AI` only emphasizes already-authorized knowledge for the current Compose session; it never grants AI permission. Off Limits can constrain AI if authorized but can never become Message Focus.
- **Widget membership:** the favourites widget shows the Favorites population in its Default ordering for now; a customizable `include in widget` membership concept is deferred to a future milestone (owner, 2026-09-01).
- **Never-contacted reachability:** never-contacted contacts reach the Dashboard only via the Not Contacted or All Contacts populations; the standalone Never Contacted screen and the include-Unbound toggle retire.
- **Birthday presentation relocated:** the birthday banner is removed from the Dashboard (ADR-034 superseded 2026-09-01); the deferred Your Week phase owns upcoming-birthday presentation.

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
12. Group Interaction Logging
13. Rapid Capture & Update Flows
14. Messaging & AI Compose
15. Settings & Personalization — **planning deferred until after execution of Phases 1–14**
16. AI Configuration & Prompting — **planning complete; dossier written**
17. Onboarding — **planning deferred until substantive implementation exists**
18. Responsive & Release Hardening — **planning deferred until substantive implementation exists**
19. Your Week (provisional) — **planning deferred; planned after Phase 16 once birthday presentation, Group Events, and heatmap aggregation exist**

Some later phases may be reordered by GSD based on final requirements/dependencies. Preparatory numbering represents current planning seams, not canonical execution numbering.

## 9. Planning Handoff / Deferred Late-Phase Strategy

There is **no immediate next dossier-interrogation target before GSD milestone generation**.

The current preparatory planning package intentionally contains detailed dossiers for **Phases 1–14 and 16**. These are the substantive feature/domain/system phases considered mature enough to hand to GSD now.

### Settings & Personalization — intentionally deferred

The former Phase 15 remains an important late-milestone integration phase, but its detailed interrogation is intentionally postponed until **after execution of Phases 1–14**. The reason is product-quality rather than uncertainty about ownership: Settings primarily consolidates configuration/admin surfaces exported by many preceding phases, so final IA should be designed against the actual implemented product rather than a speculative list of planned toggles.

Earlier phases should still implement/preserve any preference state or administrative seam required for their own behavior. What waits is the polished Settings information architecture and consolidation UI.

Expected eventual Settings-owned seams include:
- Appearance entry points consuming the Phase 2 theme system,
- notifications and device-facing preferences,
- Contacts Administration / Category CRUD and its Orrery/Profile fallout,
- local owner-profile settings,
- Dashboard List right-swipe Quick Log vs detailed Log Interaction preference,
- ordinary Log Interaction Channel default,
- Compose Text / Email / Remember Last Choice default,
- canonical entry points to Systems, Profile presentation management, AI management, and other already-owned administration surfaces.

Phase 16 AI Configuration & Prompting is **already decision-complete** and should remain a substantive subsystem, not be folded into the later Settings consolidation. Settings should eventually route to its canonical AI surfaces rather than reimplement them.

### Onboarding — intentionally deferred

Detailed onboarding interrogation waits until the substantive experience exists in implementation. Earlier phases should preserve first-run/default/permission/gesture seams, but the actual onboarding sequence, explanation density, and teaching strategy should be designed against the real product.

### Responsive & Release Hardening — intentionally deferred

Detailed hardening/readiness planning waits until implementation exposes real device, performance, accessibility, layout, and integration findings. Accessibility foundations and responsive seams remain requirements throughout earlier phases; the late hardening phase audits and closes gaps rather than introducing those concerns for the first time.

## 10. Artifact Checklist for GSD / Fresh Planning Context

- Fresh/current Orbit repository or `orbit-app-main.zip`.
- `orbit-ui-ux-working-roadmap-v1.0.md`
- `orbit-ui-ux-master-handoff-v1.0.md`
- `phase-01-app-shell-navigation-dossier-amended-group-events.md`
- `phase-02-theme-visual-system-dossier(1).md`
- `phase-03-contact-knowledge-foundation-dossier(1).md`
- `phase-04-dashboard-data-state-foundation-dossier.md`
- `phase-05-dashboard-control-surface-dossier-amended-group-events(1).md`
- `phase-06-dashboard-list-view-dossier(1).md`
- `phase-07-dashboard-card-view-dossier-v0.2(1).md`
- `phase-08-orrery-camera-scale-exploration-dossier(1).md`
- `phase-09-orrery-systems-dossier(1).md`
- `phase-10-profile-experience-dossier(1).md`
- `phase-11-interaction-history-insights-dossier-v0.2-group-events(1).md`
- `phase-12-group-interaction-logging-dossier(2).md`
- `phase-13-rapid-capture-update-flows-dossier(1).md`
- `phase-14-messaging-ai-compose-dossier(1).md`
- `phase-16-ai-configuration-prompting-dossier(1).md`
- `new-milestone(1).md`

## 11. Remaining Preparatory Phase State

- **1–14 — COMPLETE PLANNING.** Detailed dossiers exist and are intended as the primary substantive GSD input set.
- **15. Settings & Personalization — DEFERRED PLANNING.** Revisit after execution of Phases 1–14 so final Settings IA/admin consolidation reflects the implemented product.
- **16. AI Configuration & Prompting — COMPLETE PLANNING.** Detailed dossier exists; keep as a substantive AI subsystem even if GSD changes canonical numbering/order.
- **17. Onboarding — DEFERRED PLANNING.** Revisit after substantive implementation.
- **18. Responsive & Release Hardening — DEFERRED PLANNING.** Revisit after substantive implementation and device/testing evidence.
- **19. Your Week (provisional) — DEFERRED PLANNING.** Designs the Your Week page (relocated birthday presentation per ADR-034 supersession, Group Events, heatmap aggregation reuse) once those inputs exist; planned after Phase 16.

The preparatory numbering above remains a traceability aid only. GSD should assign canonical milestone phase numbering/order according to requirements, dependencies, and its own roadmapping rules.
