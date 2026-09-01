# Orbit UI/UX Milestone — Master Planning Handoff

**Updated through Phase 16 · Working roadmap v1.0 · Detailed planning complete for Phases 1–14 and 16 · Settings/Onboarding/Release Hardening intentionally deferred until later execution state**


# 1. What This Planning Project Is

This is preparatory product planning for Orbit's next release-quality UI/UX milestone before the work is handed to a Codex agent running GSD's new-milestone workflow. The goal is to resolve roughly 90% of meaningful product and higher-level architecture decisions conversationally, then let GSD normalize requirements, traceability, canonical phase numbering, and ROADMAP.md.

# 2. Source-of-Truth Order

1.  Current Orbit repository and its existing planning/domain dossiers.

2.  Completed phase dossiers from this UI/UX planning effort.

3.  The current working roadmap v1.0.

4.  The current planning conversation.

Completed dossiers are authoritative for decisions already made. Existing architectural/domain invariants remain binding unless explicitly superseded. Earlier visual/presentation decisions may be revised only when this design milestone intentionally replaces them or device testing reveals a genuine conflict.

# 3. Planning Method / GSD Guardrails

- Interrogate meaningful product and higher-level architecture forks thoroughly, usually in batches of 10 or fewer.

- Clearly mark the assistant's recommendation, but do not silently make meaningful product decisions for the owner.

- Do not ask the owner to approve routine implementation best practices with no meaningful product consequence.

- After each phase is decision-complete, write a dossier separating \[DECIDED\], \[DERIVED\], and \[DEFERRED\].

- Treat phase boundaries as provisional; split coherent subsystems before GSD rather than allowing phase bloat.

- Do not pull business workflows into renderer/presentation phases merely because a surface routes into them.

- Do not add speculative schema/services solely for future possibilities; preserve cheap architectural seams instead.

- The final GSD new-milestone workflow will create atomic user-centric requirements and map every requirement to one canonical phase.

# 4. Milestone Goal

Transform Orbit's functional foundation into a release-quality, low-friction mobile experience with intentional navigation, presentation, capture workflows, personalization, accessibility, responsive layouts, and onboarding, suitable for outside beta testers at the end of the milestone.

# 5. Current Phase Status

| **Phase**                              | **Status** | **Artifact**                                           |
|----------------------------------------|------------|--------------------------------------------------------|
| 1 — App Shell & Navigation             | Complete   | phase-01-app-shell-navigation-dossier(1).md            |
| 2 — Theme & Visual System              | Complete   | phase-02-theme-visual-system-dossier(1).md             |
| 3 — Contact Knowledge Foundation       | Complete   | phase-03-contact-knowledge-foundation-dossier(1).md    |
| 4 — Dashboard Data & State Foundation  | Complete   | phase-04-dashboard-data-state-foundation-dossier.md    |
| 5 — Dashboard Control Surface          | Complete   | phase-05-dashboard-control-surface-dossier.md          |
| 6 — Dashboard List View                | Complete   | phase-06-dashboard-list-view-dossier(1).md             |
| 7 — Dashboard Card View                | Complete   | phase-07-dashboard-card-view-dossier(1).md             |
| 8 — Orrery Camera, Scale & Exploration | Complete   | phase-08-orrery-camera-scale-exploration-dossier(1).md |
| 9 — Orrery Systems                     | Complete   | phase-09-orrery-systems-dossier(1).md                  |
| 10 — Profile Experience                | Complete   | phase-10-profile-experience-dossier.md                 |
| 11 — Interaction History & Insights    | Complete   | phase-11-interaction-history-insights-dossier.md       |
| 12 — Group Interaction Logging         | Complete   | phase-12-group-interaction-logging-dossier.md          |
| 13 — Rapid Capture & Update Flows      | Complete   | phase-13-rapid-capture-update-flows-dossier.md         |
| 14 — Messaging & AI Compose            | Complete   | phase-14-messaging-ai-compose-dossier.md               |
| 15 — Settings & Personalization        | Deferred planning | Revisit after execution of Phases 1–14 so final Settings IA/admin consolidation reflects the implemented product. |
| 16 — AI Configuration & Prompting      | Complete   | phase-16-ai-configuration-prompting-dossier(1).md      |
| 17 — Onboarding                        | Deferred planning | Revisit after substantive implementation exists.       |
| 18 — Responsive & Release Hardening    | Deferred planning | Revisit after substantive implementation/device testing. |

# 6. Critical Decisions Already Settled

## Shell & Visual System

- Permanent bottom nav: Dashboard, Orrery, Backup/Restore, Settings; each tab preserves its own navigation stack.

- Universal context-aware FAB now exposes Add Contact, Quick Log, Log Contact, Group Log, Update Contact, and Memory; fast-entry flows remain deep-link/widget-ready.

- Quick Log writes immediately once the target is known; detailed Log Contact remains a separate routable form.

- Galaxy + Standard themes and Light/Dark/Follow System are separate axes; Galaxy is deep-space/glass-forward and Standard is calmer/soft-modern.

- Use semantic theme tokens and a centralized semantic icon registry; color never carries status meaning alone.

## Contact Knowledge Foundation

- Things to Remember is one user-facing concept over first-class fields, custom fields, structured Relationships, and typed Memories.

- Search/Profile/AI/Update Contact consume a semantic knowledge abstraction rather than storage-specific tables.

- History-aware current-state fields may retain/edit prior values according to field/type metadata.

- AI access is explicit opt-in per information item/field and defaults OFF; Off Limits means avoid bringing up the topic, not hidden/private content.

- Import and Backup/Restore preserve current/history state, Memories, Relationships, Custom Fields, privacy permissions, and lifecycle state.

## Dashboard — Phases 4–7

- Dashboard is primarily a contact browser/relationship command center; Orrery is the more explicit relationship-health/attention visualization.

- Default universe is Active Contacts. Special populations: Favorites, Birthdays, Not Contacted, Snoozed; filters use OR within a family and AND across families.

- Search is scoped to current Population + Filters and never leaks Archived/Unbound.

- List View is scan-first with Name; recency + category; one adaptive context line; favorite, restrained status, snooze override, and configured swipe routing.

- Card View is a 3-column avatar-first grid with status rings, compact adaptive context, long-press power actions, and Grid multi-select as Dashboard bulk management.

- Gravity is derived-never-stored; contact import remains outside Dashboard bulk management.

## Orrery — Phases 8–9

- Orrery is a constrained 2.5D navigable relationship-health world with pan/zoom/tilt/yaw, semantic zoom, scalable geometry, focus/cluster focus, Polaris, and recenter.

- Large contact sets rely on growing world geometry plus viewport culling/LOD rather than shrinking everything indefinitely.

- Built-in Systems include All Contacts, Favorites, Needs Attention, Not Contacted, Snoozed, Chargers, and one per Category.

- Custom Systems support dynamic rules, durable manual inclusions, and exclusions of current rule-derived members.

- System builder uses an Orrery HUD with rule accordions, Manage Members, and full-canvas Preview; management CRUD is separate from the switcher.

- Relationship Satellites are lightweight moons for unlinked person-like relationships, not the future social graph.

## Profile Experience — Phase 10

- Profile is a presentation-first read surface with a fixed Hero: large avatar, name, Category, Favorite, Message, Call, overflow, and optional Profile background.

- Factory body order: Relationship Overview → Things to Remember → Contact Methods → Interaction History.

- Profile is modular but not an unrestricted page builder: top-level sections can reorder/hide/show; eligible child sections reorder within their parent only; no third customizable level.

- Reusable Profile layout templates and background templates are independent. Assignment precedence is contact override → Category assignment → global/default.

- Reusable template edits update Profiles assigned to the template; freeform per-contact overrides remain independent. Expanded/collapsed state persists per contact.

- Relationship Overview is an auto-packed stats tile grid for Orbit Status, Gravity, Intensity, Last Interaction, Contact Frequency, and Snooze.

- Orbit Status remains Stable/Wobbly/Decaying/Rogue using existing recency + frequency semantics; no new Health metric.

- Gravity uses named tier + size-coded sphere; Intensity uses histogram; Frequency updates immediately; custom Snooze date/duration gets a narrow route.

- Things to Remember uses compact semantic cards, omits blank metadata, caps repeatable summaries around three items, and keeps Off Limits visible by default.

- Remembered-information cards tap to detail and long-press to Edit / Pin / Hide; hidden content remains recoverable and hiding is presentation-only.

- Interaction History is only a replaceable Profile section slot here; its internals belong to Phase 11.

## Interaction History & Insights — Phase 11

- History replaces the conventional vertical timeline with Activity Heatmap, Intensity, and a Rolodex-style History Browser.

- Heatmap is interaction-only. Lifecycle/history events never affect heatmap saturation or its small context card.

- Heatmap lenses: Cycles, rolling 7 Days, Month, Year. Cycles uses the contact's current Contact Frequency; presets 5/10/15/20 with 10 default.

- Heatmap and Intensity share one selected timeframe/window so both visualize the same period differently.

- Heatmap first tap opens a small context card; See Details opens the shared date/period detail sheet; empty periods can route to historical detailed logging.

- Temporal aggregation/rendering should be reusable later with broader interaction queries without building account/category analytics now.

- History Browser uses synchronized Month / Day / Year wheels, event markers on nearby dates, a summary drawer, no future dates, and theme-resolved Galaxy/Standard treatments.

- History Browser and Heatmap reuse one detail sheet with chronologically interleaved interactions, immutable lifecycle events, and appropriate history-bearing knowledge changes.

- Three record families are preserved: editable/deletable Interactions; read-only lifecycle events; independently editable history-aware knowledge changes.

- Contact Frequency and Category changes are omitted from History v1 to avoid audit-log clutter.

- Phase 11 introduces canonical Interaction Detail and focused Edit Interaction routes.

- Interaction delete remains hard-delete with confirmation; no new interaction trash.

- Interactions gain optional duration entered in minutes/hours via presets + Custom; Quick Log never sets duration and duration does not affect derived metrics in this milestone.

## Group Interaction Logging — Phase 12

Group Event is a first-class event/history-context parent around ordinary one-contact-per-Interaction child rows; the parent never double-counts contact history.

Group Events require title + date/time and may validly have zero participants, enabling event-first capture before the user reconstructs everyone who attended.

Shared/default Channel, Tone, Duration, and Group Note live at event level. Tone starts null; Duration starts unset; Group Log defaults Channel to In Person.

Participant-overridable fields include Channel, Tone, Duration, and direction/connected where relevant. Date/time is shared and non-overridable.

Participant overrides use live inheritance; Follow event … removes an override and resumes inheritance. Group Note and participant note remain linked but distinct.

Group Event Detail is presentation-first; Edit Group Event is a separate focused workflow. Participant cards open child Interaction Detail and expose edit/remove actions.

Group Events have a lean chronological/searchable management page reachable from a prominent Dashboard header action and redundantly from Dashboard overflow.

Universal FAB gains Group Log. Dashboard Grid retains Quick Log and routes detailed Log Interaction as one selected → individual and two or more → Group Log.

Existing Interactions can be expanded into Group Events without replacing their identity. Dissolve keeps standalone child Interactions; full delete removes event + children after confirmation.

Group Event fan-out mutations are atomic from the user perspective, failed saves preserve form state, and Backup/Restore preserves parent records, child links, Group Note, and override state.

## Rapid Capture & Update Flows — Phase 13

Add Contact is deliberately streamlined: Name is the only required field; Identity, Relationship Basics, and Contact Methods are initially visible, while Show More reveals advanced enrichment sections. Edit Contact exposes the complete accordion-based record.

New contacts without Contact Frequency are Unbound. Choosing cadence turns Bound on; explicit Unbound may retain dormant cadence information.

Quick Log remains immediate/current-time and may offer Add Note after success. The tiny post-log editor saves either an Interaction Note or Create Memory Instead, never duplicate copies; basic Memory creation may then offer Edit Memory.

Ordinary detailed Log Interaction uses Date/Time, Channel, Direction, Connected where relevant, optional Tone, and Note, with Duration under More Options. Historical logging is freely backdateable.

Ordinary Channel vocabulary is Message / Call / In Person. Settings later offers those three plus Remember Last Choice; factory default is Remember Last Choice and the remembered value changes only after successful ordinary saves. Group Log remains exempt and defaults In Person.

Tone replaces Quality/Impact. Values are Positive / Neutral / Negative; Tone is optional and null/unset is not interpreted as Neutral.

Update Contact is a fast repeated chooser/editor loop for Last Talked About, Key People/Relationships, Current Location, Memory, Custom Fields, Off Limits, Contact Method, and Contact Frequency. Category remains Edit Contact scope.

Existing custom fields may surface directly in Update Contact by their user-facing field names, with a generic Custom Fields entry for creation and broader discovery.

Phase 13 deliberately does not fabricate a complete Memory-type taxonomy. The exact default/general built-in Memory type/name remains a reconciliation/Memory-mechanics item because Phase 3 defines a registry but does not enumerate a complete canonical built-in catalog.

Add/Edit use one form-level Save, preserve state on failure, reveal validation errors inside the relevant accordion, protect meaningful unsaved changes, and inherit shared picker/preselection, keyboard, accessibility, deep-link, and origin-aware completion contracts.


## Messaging & AI Compose — Phase 14

- Compose is an **AI-assisted drafting workspace with lightweight external delivery handoff**, not an in-app messaging client. The message editor is primary and manual composition works independently of AI.
- The old Conversation Fuel-first layout is replaced by two sibling sides of one focused workflow: **Compose** and a separate full-screen **Things to Remember Research** side. Research is compact, read-only, populated-content-only, and never displaces the editor on entry.
- Initial message modes are **Text** and **Email**. Phase 15 Settings owns **Text / Email / Remember Last Choice**, with Remember Last Choice as factory default; the current mode may be switched ad hoc per composition.
- Text uses the primary phone and Email uses the primary email. A deliberate selection can establish a missing primary. If the preferred mode has no usable destination but the alternate supported mode does, Compose falls back automatically.
- Email exposes Subject + Body. Main Copy copies body; Subject has its own copy affordance.
- The primary handoff action is **Transmit**. Text/email content is handed to the supported external composer; Orbit never treats opening that app as proof the user actually sent anything.
- After returning from Transmit, Orbit targets a compact **Did you send it?** confirmation. `Yes, log interaction` writes the canonical ordinary Message interaction and completes the flow; `Not yet` preserves the Compose session. Copy does not trigger this confirmation.
- Compose draft state is session-only navigation state, not a durable data model or Backup/Restore concern. Meaningful Back/Cancel inherits the shell's Discard changes / Keep editing contract.
- AI is intentionally unobtrusive: if no provider/configuration is actually usable, **all AI affordances disappear** from Compose and Research. There is no disabled AI card, setup nag, or provider troubleshooting on Compose.
- When available, AI exposes one adaptive action: **Draft with AI** for an empty editor and **Rewrite with AI** for an existing draft. Each request returns **three suggestions** on one comparison surface; choosing one returns it to Compose for ordinary editing. `Try Again` replaces the current set with three fresh suggestions.
- Existing Contact Knowledge AI permissions remain authoritative. Phase 14 adds no per-generation authorization review.
- Research items already authorized for AI may be marked **Add to AI** and become `Added ✓`; up to three session-only **Message Focus** items can steer generation. Add to AI never grants permission.
- Off Limits remains visible to the human, is supplied to AI as an avoidance constraint when authorized, and can never be selected as Message Focus.
- Prompt/provider/model/key administration, central AI-permission review, channel-aware prompt construction, and one-off **Adjust** controls are owned by the now-complete Phase 16 AI Configuration & Prompting contract.
- **Random Thought** — randomly surfacing remembered information to inspire a human-written message — is explicitly deferred.

## AI Configuration & Prompting — Phase 16

- AI is optional and has a real global **AI Enabled** toggle. Turning AI off preserves connections, models, personalization, and Contact Knowledge AI permissions while hiding normal AI setup/usage surfaces; a credential-management escape hatch remains available while AI is off.
- Orbit supports three connection lanes with exactly **one active connection**: **OpenRouter** as the recommended/promoted path; **Direct Provider / BYOK** for OpenAI, Anthropic, and Gemini under Advanced Setup; and an **OpenAI-compatible Custom Endpoint** under Advanced Setup. Multiple inactive credentials/configurations may remain stored for later reuse.
- Switching to an unconfigured lane is transactional: the current working connection remains active until the new setup succeeds. Orbit never silently changes providers/models when a request fails.
- OpenRouter uses browser-based connection/authorization and an Orbit-owned model picker. Model selection is curated-first with Browse All available; initial recommendation direction is **GPT-5.6 Terra** for balance, **Gemini Flash** for cost efficiency, and **Claude Haiku** for lightweight/simple capability. Model IDs and prices are runtime catalog data, not permanent roadmap constants.
- OpenRouter model cards/details can show detailed current/cached pricing. Model catalogs can refresh roughly daily/on demand; pricing used for user-facing estimates should be refreshed more aggressively when stale.
- Each connection remembers its own selected model. If a selected model disappears, Orbit explicitly says it is no longer available and requires another choice; it does not silently substitute one.
- Orbit owns an immutable system/output prompt contract. User personalization is layered through structured Writing Style controls plus arbitrary global **Personalization Context** sections that can be named, reordered, enabled/disabled, pasted, or imported from `.txt`/`.md` files. Imported text is copied into Orbit-owned local storage rather than live-linked.
- Orbit does not silently truncate user context to an arbitrary application ceiling. It exposes approximate token/context usage and, for OpenRouter, estimated **input cost**; true model-context overflow is surfaced explicitly.
- Contact Knowledge permission means authorized information is included in AI context. **Message Focus** boosts emphasis without changing permission. AI-enabled **Off Limits** are always represented as avoid-topic constraints. The most recent three Interactions can provide compact context, with notes only where permitted.
- **Adjust** is ephemeral: quick adjustments plus freeform guidance produce three revised alternatives without permanently modifying Writing Style.
- Central AI permission management includes defaults for new information, searchable review of existing access, bulk disable, and bulk enable only with explicit impact confirmation.
- Transparency has two different surfaces: **Settings** can inspect the complete assembled AI system/prompt and optionally resolve it using a chosen contact; **Compose** shows only the contact-specific disclosure for the current generation, e.g. `Sharing 17 items with AI about Mom`, with those items listed.
- Runtime states are explicit: AI Off = no AI generation affordances; AI On + Ready = normal AI actions; AI On + broken connection/model = **AI needs attention** notice and repair route in Compose.
- User-facing failures are translated into understandable categories while preserving Compose state. The AI layer exports sanitized structured diagnostics for later Sentry integration, but prompts, Contact Knowledge, personalization text, credentials, and generated drafts are never included in production telemetry by default.
- Backup/Restore preserves nonsecret AI personalization/configuration and permissions while excluding direct-provider keys, OpenRouter credential state, and Custom Endpoint secrets.
- Explicitly deferred: hosted Orbit AI proxy/subsidized inference, arbitrary HTTP API construction, LAN/local-model endpoints, per-contact persistent AI personalization docs, writing-sample training/inference, DOCX/PDF personalization imports, silent failover, and app-wide Sentry implementation.

# 7. Cross-Phase Corrections / Watch Items

- Dashboard bulk/contact management remains Select Contacts → Phase 7 Grid multi-select; do not create a separate bulk-management screen.

- Contact import belongs with Backup/Restore/contact data management.

- Gravity remains derived-never-stored and is never directly editable.

- Category administration remains an eventual Settings/Contacts Administration gap. Detailed Phase 15 planning is intentionally deferred until after execution of Phases 1–14; Category deletion must still account for Orrery Systems plus Profile layout/background Category assignments.

- Profile presentation assignment is limited to global/default, Category, and contact. Do not add dynamic rule-based template assignment in this milestone.

- Profile Hero remains structurally fixed; templates customize the body only.

- Heatmap is interaction-only; lifecycle/history records belong to the History Browser/detail sheet.

- Preserve immutable lifecycle-event semantics; editable location/job/etc. history belongs to the Contact Knowledge history model.

- Canonical Edit Interaction is introduced in Phase 11 and should be reused by later Rapid Capture/Update work.

- Optional interaction duration must survive persistence/backup but must not silently change Status/Gravity/Intensity.

- Preserve reusable temporal aggregation seams for future analytics/Your Week without implementing those products now.

- Future Social Graph / Satellite Orrery remains out of this milestone.

- Final performance, responsive, large-text, yearly heatmap, and wheel-density QA belong to the late Release Hardening pass, whose detailed planning is intentionally deferred until implementation/device testing.

Phase 1 amendment required: FAB expands to six actions with Group Log and a canonical Group Log route.

Phase 5 amendment required: Dashboard header gains a first-class Group Events icon + label entry; Group Events also remains in Dashboard overflow.

Phase 7 amendment required: detailed multi-contact logging prohibition is superseded; Quick Log remains separate and 2+ selected contacts route to canonical Group Log.

Phase 11 amendment required: Interaction Detail/Edit recognizes Group Event membership, edit scope is individual vs Group Event, and Group Event parents never double-count History/Heatmap/Intensity.

Phase 13 is complete. Canonical term is Tone; ordinary new logging Tone begins null. Rapid Capture consumes Group Log rather than redefining it.

The eventual Settings consolidation must expose Message / Call / In Person / Remember Last Choice for ordinary logging, with Remember Last Choice as factory default, while explicitly stating Group Log is exempt and defaults to In Person. Runtime preference/state support may land earlier with the owning feature.

Group Log amendment branches are synchronized across Phases 1, 5, 7, and 11; their amendment sections supersede conflicting older wording.

# 8. Handoff Instructions / What Happens Next

There is **no immediate next interrogation phase before handing the current dossier set to GSD**.

Detailed preparatory planning is complete for **Phases 1–14 and 16**. The owner intentionally deferred Settings & Personalization, Onboarding, and Responsive/Release Hardening so those integration surfaces can be planned against the implemented product rather than against speculative UI inventory.

## Settings & Personalization — deferred after execution of Phases 1–14

Do not start a full Settings interrogation now merely because older roadmap versions called it "next." Its detailed planning should resume **after Phases 1–14 have been executed** enough to reveal the real set of preferences, management destinations, exceptions, and administration surfaces.

Earlier feature phases still own whatever persistence/state/API seams are necessary for their behaviors. The later Settings pass owns final consolidation and information architecture, including expected areas such as:
- Appearance entry points,
- notifications,
- Contacts Administration / Category CRUD,
- local owner profile,
- Dashboard swipe-log preference,
- ordinary logging Channel default,
- Compose default mode,
- routing to Systems/Profile-presentation/AI and other canonical management surfaces.

Phase 16 AI Configuration & Prompting is **already complete planning** and should not be reopened or absorbed wholesale into Settings. Settings should eventually present entry points to the canonical AI subsystem defined by its dossier.

## Onboarding — deferred

Plan onboarding only after substantive implementation exists. It should teach the real product, not a planning abstraction. Preserve earlier exported first-run/default/permission/gesture seams during implementation so the later onboarding pass has clean hooks.

## Responsive & Release Hardening — deferred

Plan the final hardening pass only after implementation/device testing reveals real layout, accessibility, performance, lifecycle, and integration issues. Accessibility and responsive foundations remain cross-cutting requirements before that point.

## GSD handoff expectation

Use the completed dossiers plus the current repository as authoritative milestone context. GSD should normalize the decisions into requirements and choose canonical execution phase numbering/order. The preparatory numbers remain traceability labels and do not require GSD to execute Phase 15 before Phase 16 simply because of their historical numbering.

# 9. Artifact Checklist for GSD / Fresh Session

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

# 10. Remaining Preparatory Phase State

- **1–14 — COMPLETE PLANNING.** Detailed dossiers exist.
- **15. Settings & Personalization — DEFERRED PLANNING.** Resume after execution of Phases 1–14.
- **16. AI Configuration & Prompting — COMPLETE PLANNING.** Detailed dossier exists.
- **17. Onboarding — DEFERRED PLANNING.** Resume after substantive implementation exists.
- **18. Responsive & Release Hardening — DEFERRED PLANNING.** Resume after substantive implementation and device/testing evidence.

This handoff intentionally remains Markdown. Do not convert it to DOCX unless a later workflow explicitly requires a document artifact format.
