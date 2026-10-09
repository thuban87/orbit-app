# Phase 39 — Living Onboarding Design Decisions

**Living workpaper · Owner + ChatGPT decision ledger · Not a dossier or implementation plan**

## 1. Purpose of this Workpaper

Preserve agreed first-run, foundational/core and feature-family onboarding decisions. Feature-family journey triage is now **substantially complete**: this ledger records what receives core journeys, small progressive teaching moments, no dedicated tutorial or dependency-deferred teaching. Discovery evidence explains decisions; it does not override them. These owner decisions supersede differing provisional recommendations in the source workpapers.

This ledger does not select tutorials for all 145 discovery candidates, specify implementation plans, or define final copy and visuals. Future updates should preserve the distinction between evidence, agreement and unresolved direction; change a status only when further owner + ChatGPT triage supports it.

Remaining work shifts primarily from **what Orbit should teach** to **how the onboarding system should work**. Architecture/state/trigger design is next; visual/presentation design follows separately. Product dependencies and future questions remain unresolved where explicitly identified below.

## 2. Status Vocabulary

| Status | Meaning |
|---|---|
| **LOCKED** | Owner and ChatGPT have explicitly agreed. |
| **PROVISIONAL** | Current direction, deliberately awaiting later discovery/design. |
| **OPEN** | Requires further owner/ChatGPT triage. |
| **DEFERRED** | Explicitly outside the current Phase 39 decision scope. |

## 3. Governing Onboarding Principles

**LOCKED:** Onboarding is relatively unaggressive, contextual and progressive, but decisive enough to teach a feature at its meaningful first encounter. It is never required to access product functionality. Teach the fundamental mental model early and deeper capabilities when relevant; avoid one enormous tutorial before use.

**LOCKED:** Tutorials teach stable product behavior. They must not substitute for clarifying confusing product UX. The prerequisite remediation below establishes the baseline for dependent teaching.

**PROVISIONAL:** Prefer clear contextual teaching over relying solely on transient toasts; avoid constant interruption and generally avoid unnecessary `Not Now` semantics unless a workflow benefits from postponement. Visual behavior and interaction architecture remain **OPEN**. Skip requirements are already **LOCKED**, independently of this provisional style.

## 4. Ordered Prerequisite Remediation

**LOCKED:** Complete each relevant remediation before implementing onboarding that depends on it. This is a dependency requirement, not an implementation task order or plan numbering scheme.

| Area | Locked baseline / requirement | Discovery evidence and rationale |
|---|---|---|
| Manual creation | Change tracking default **Unbound → Bound** and Last Spoke default **Today → Not Yet**. | Fresh audit F08/F09: collapsed defaults currently create a real interaction without an explicit date choice. F11/F12: Unbound can disappear from the principal population; Bound + Not Yet naturally participates in tracking through Never Contacted/Horizon until an interaction is recorded. This intentionally changes current behavior. |
| Import defaults | Retain the existing explicit participation choice and current **Unbound** default. Do not inherit the new manual Bound default. | Fresh audit F13/F14; discovery E01–E03. Import can acquire many people and must not automatically opt an entire cohort into active tracking. |
| Possible-match resolution | Provide an obvious normal path to resolving a match. An undisclosed long-press must not be a prerequisite for basic resolution. Long-press may remain useful for bulk/multi-select. | Fresh audit F16: ordinary tapping did nothing; long-press exposed resolution actions. Exact replacement interaction is **OPEN**. |
| Compose / Assist | Examine and clean up overlapping Compose-local `Did you send it?` and global Assist confirmation before Reach Out onboarding. Establish one coherent conceptual outcome model for confirming communication, declining logging and postponing resolution where supported. | Fresh audit F22: the same pending communication has overlapping controls with different semantics. This is a confirmation-model ambiguity, not evidence of duplicate interaction writes. Final remediation is **OPEN**. |

These requirements do not authorize additional remediation merely because an audit finding exists.

## 5. First-Run Structure

**LOCKED:** The guided initial sequence is:

`Welcome → Acquire → Orient → release into normal app`

Acquire at least one person before teaching Orient, so dashboard instruction has meaningful relationship data. Progressive onboarding follows. The global Skip Tutorials escape hatch remains available; tutorial participation never gates the product. Exact continuation handling for cancellation or unsuccessful acquisition remains **OPEN**.

### Welcome

**LOCKED:** Begin with a lightweight, short Welcome explaining what Orbit is and why someone would use it. Provide clear **Get Started** and **Skip Tutorials** paths; avoid a large carousel or feature tour.

Conceptual framing, **not final copy**:

> Relationships are an n-body problem. Orbit helps you keep the people in your life organized, remember what matters, and know when it's time to reconnect.

**PROVISIONAL:** A short local-first/privacy reassurance may belong here. Exact copy/design is **OPEN**. **DEFERRED:** Email/newsletter signup is outside first-run onboarding at this time.

Evidence: fresh audit F01/F02 currently finds immediate empty Digest with no Welcome or acquisition choice; discovery R01 grounds the local-first concept.

### Acquisition / First Person

**LOCKED:** Ask how the user wants to begin adding people, offering **Add someone manually** and **Import from Contacts**. Teach only the chosen path, including Import's existing in-context permission explanation where appropriate.

| First choice | Initial teaching | Later progressive eligibility |
|---|---|---|
| Manual | Manual Add Contact workflow | Import remains **not introduced**; teach when intentionally encountered later. |
| Import | Existing Import workflow | Manual Add remains **not introduced**; teach at a later Add Contact encounter through the FAB or another normal entry. |

**LOCKED:** Tutorial state must distinguish never introduced, currently active, completed and dismissed/skipped. Workflow state is separate: cancelling Import does not mean “never teach me Import”; denying permission does not inherently skip the tutorial; partial import is not automatically tutorial completion. Exact state architecture and completion rules are **OPEN**.

Evidence: discovery A03–A06/E01–E03; fresh audit F04/F06/F13–F16/F26. Today/Pick Date currently creates an initial interaction; Not Yet creates none. The changed manual default prevents that consequence from occurring silently, while teaching should describe stable behavior rather than conceal it.

### Orient

**LOCKED:** After acquisition, explain three ways to get the lay of the land:

- **Digest:** actionable/current overview. **Up Next** concerns people needing attention now; **Horizon** concerns upcoming/noteworthy relationship information; **Your Week** concerns recent activity/effort.
- **Contacts:** direct people/library view for inspecting people and their relationship information/status.
- **Orrery:** visual representation of relationships.

Keep this conceptual: no full metric, status-calculation, filter, History or Contacts feature tour. Orrery's role is **LOCKED**; exact V2 steps are **PROVISIONAL**, pending Phase 38.7 implementation.

Evidence: discovery A11–A14; fresh audit F12/F18/F27/F28. Bound + Not Yet can appear in Horizon; it should not be described as automatically appearing in the default Active Contacts population.

## 6. Core Product Loop

**LOCKED:** The onboarding mental model is:

`Orient → Prepare → Reach Out → Record → updated state → Orient`

| Stage | Purpose |
|---|---|
| Orient | Understand the relationship landscape and who may need attention. |
| Prepare | Review useful person knowledge/context before communicating. |
| Reach Out | Initiate communication. |
| Record | Tell Orbit what actually happened, keeping history and relationship state current. |

The fresh audit's populated-state core loop (§6, F18–F24) demonstrated this feedback cycle. It is a conceptual loop, not a requirement to force every stage or collect knowledge before permitting communication.

## 7. Locked Progressive Journeys

### Prepare — Understand a Contact Profile

**LOCKED trigger:** First meaningful normal Profile encounter after initial onboarding. Avoid unusual import/reconciliation/maintenance-hosted contexts where appropriate.

**LOCKED purpose and scope:** Before contacting someone, Orbit can remind the user what they know about that person. Briefly orient them to **Relationship Overview, Things to Remember, Contact Methods and Interaction History**.

Give **Things to Remember extra emphasis**: useful person information can be stored/reviewed here to prepare future conversations. Establish the lightweight distinction between knowledge about someone and interactions that occurred with them. Bridge toward communication: saved context can help when ready to reach out.

Do not deeply teach Memory types, Key People, Off Limits, custom fields, pin/hide/outdated, Gravity/Intensity, History lenses/heatmaps, AI permissions or Profile layout/background customization. Exclusion here does not select a later tutorial; the family decisions in §§10/13 govern dedicated teaching scope.

Evidence: discovery A16 and knowledge candidates; fresh audit F19/F20.

### Reach Out

**LOCKED primary trigger:** First normal entry into Compose.

**LOCKED teaching scope:**

- The message editor is the workspace for preparing communication.
- Things to Remember can be consulted without losing the draft, reinforcing Prepare.
- **Copy** copies prepared content; **Transmit** hands prepared communication to the appropriate Android app.
- On first Transmit, provide a one-time conceptual explanation that Orbit opens the appropriate communication app with prepared content; the user controls actual sending/placing the communication. Exact wording/design remains **OPEN**.
- On return, Assist owns the actual-outcome question. Do not stack another tutorial over a sufficiently clear confirmation; remediate the duplicate confirmation model first.

**LOCKED exclusions:** Direct Call/Text/Email actions do not currently require separate walkthroughs. AI is completely excluded: no mention, teaser, disabled-control spotlight, availability explanation or conditional AI steps.

Evidence: discovery E16/E17 and Compose candidates; fresh audit F21/F22.

### Record — Keep Orbit Current

**LOCKED trigger:** First intentional logging action. Do not automatically launch Record because Reach Out completed.

| First logging action | Locked teaching and continuation |
|---|---|
| Quick Log | Intercept **before the immediate write**. Explain immediate recording and the detailed Log Interaction alternative for adding details before saving. Then allow the requested Quick Log to proceed. **Skip must also proceed with that original action.** |
| Log Interaction | Explain detailed recording, **nothing committed until Save**, and Quick Log as the faster alternative. Then let the normal workflow proceed. |

**LOCKED:** Assist is another entry into the same recording model. Do not create a separate mandatory Assist tutorial unless later testing demonstrates a need after remediation. Explain that recording updates relevant interaction history, relationship state and future attention/orientation information, closing the loop.

Do not teach every field, backdating, Add Note after Quick Log, Memory conversion, full History navigation, interaction editing/deletion, group-event semantics or AI here. Exclusion from Record does not select another tutorial; the family decisions in §§10/13 govern dedicated teaching scope.

Evidence: discovery A22–A24/E17; fresh audit F23/F24 demonstrated writes, Undo, History and attention changes.

## 8. FAB Teaching Concept

**LOCKED:** The universal **+** menu is a container-level teaching opportunity: the major place to add, update or record information. Its six current actions are **Add Contact, Quick Log, Log Interaction, Group Log, Update Contact and Memory**.

Do not imply common commit behavior: Quick Log writes immediately; detailed Log waits for Save; focused Update editors commit independently; Group Log requires explicit participant selection; Add Contact saves through its form. **Import is not in the FAB.**

**OPEN:** Exact timing/placement relative to first-run and core progressive journeys.

Evidence: discovery A02; fresh audit F25 and §15 correct the earlier surface-map inclusion of Import.

## 9. Tutorial Control / Escape-Hatch Requirements

**LOCKED:** Initial onboarding exposes clear **Skip Tutorials**; every progressive journey offers **Skip**. Skipping never blocks the underlying action.

Settings must allow users to **disable, re-enable and restart/reset tutorials**. Per-journey completion/dismissal must remain distinguishable from global disablement; restart/reset must not be conflated with enabled/disabled state.

**OPEN:** Settings placement, wording, persistence/state implementation and reset details. These controls must preserve the locked acquisition-state distinctions and Quick Log continuation behavior.

## 10. AI Separation and Optional Guided Setup

**LOCKED — core separation:** AI does not appear in core onboarding, Reach Out or other ordinary foundational journeys. Orbit's core workflow remains understandable and usable without AI. Fresh audit §6 demonstrated the manual core loop without configured AI.

### AI setup

**LOCKED — dedicated optional guided setup:** Trigger when the user deliberately enables AI **or deliberately enters the AI setup process**. This is the substantive AI onboarding; it may be a guided setup flow rather than a spotlight/overlay walkthrough.

Teach/configure only what the implemented provider architecture requires, including provider selection, credentials/API key, model/default selection and connection/setup validation **as applicable**. Exact controls and copy must match the actual system.

**LOCKED — privacy/context boundary:** Establish that AI is optional, Orbit works without it, using AI may send permitted Orbit context to the configured provider, and users control stored-information eligibility where the product supports such controls. Do not overstate guarantees or invent provider behavior. Final privacy language must be grounded against implementation/provider behavior during design.

### First AI-enabled Compose use

**LOCKED — small contextual teaching moment:** After successful configuration, the first meaningful AI-enabled Compose encounter may briefly introduce drafting/revision using context the user has allowed AI to access. Do not reteach Compose or provider setup, rerun privacy onboarding, or introduce hypothetical capabilities.

**LOCKED — future-feature scope boundary:** Do not design Phase 39 teaching for speculative AI summaries, relationship analysis, suggested actions, extraction or other future capabilities. Decide their onboarding when those features exist. Exact setup/presentation details remain later design work; AI family triage itself is complete.

## 11. Orrery V2 Dependency

**LOCKED:** Orrery has a visual orientation role alongside Digest and Contacts. The old Orrery renderer is excluded from this decision evidence and must not supply future teaching requirements.

**PROVISIONAL:** Exact Orrery V2 onboarding steps await Phase 38.7 implementation and the separate discovery pass. Both source reports explicitly record this exclusion/dependency.

## 12. Deferred Milestone 3 Concerns

**DEFERRED:** User-to-developer feedback/support/feature-request routes and developer-to-user announcements/release communication are collected as likely **Milestone 3: Launch Pipeline** work. They do not enter Phase 39 because onboarding touches communication.

**DEFERRED — likely Milestone 3 Launch Pipeline concern:** Before actual launch, review permanent local-data-loss/backup messaging so users understand device loss, uninstall and other local-data-loss implications while Orbit remains local-first/pre-sync. This is not a Phase 39 tutorial or launch work planned here.

Preserved project direction: Milestone 2 concerns overall polish/launch hardening; Milestone 3 concerns the actual launch pipeline and launch-required capabilities. Feature work there should remain limited and primarily launch-driven. This ledger does not plan Milestone 3.

## 13. Completed Feature-Family Triage and Remaining Dependencies

### Knowledge / Organization

| Capability | Decision | Status |
|---|---|---|
| Memory creation | Small contextual introduction at first deliberate creation/encounter with creation: a Memory is reusable person knowledge that becomes part of Things to Remember. Briefly distinguish it from an interaction note where useful. No full walkthrough or teaching every pin/hide/outdated/date/link/AI-eligibility option. | **LOCKED — small progressive teaching moment** |
| Categories | Small contextual introduction around first meaningful management/use: organizational purpose and reuse across contacts. No tutorial for ordinary CRUD, reorder or deletion. Exact trigger/presentation remains later architecture work. | **LOCKED — small progressive teaching moment** |
| Current-state updates | Last Talked About / Current Location and similar updates are owned by existing UI. | **LOCKED — no dedicated tutorial** |
| Key People | Use contextual UI/copy where needed; no standalone journey. | **LOCKED — no dedicated tutorial** |
| Off Limits | Existing UI/copy owns explanation. | **LOCKED — no dedicated tutorial** |
| Custom Fields | Existing definition/value UI owns the workflow unless future testing reveals a specific problem. | **LOCKED — no dedicated tutorial** |
| Systems | Likely progressive teaching because the mental model is unusual; evaluate scope and relationship to Systems after Orrery V2 is implemented. No Systems tutorial is locked. | **PROVISIONAL — Orrery V2 dependency** |

### Interaction extensions

**LOCKED — small progressive teaching moment: Group Events.** Trigger on first deliberate **Group Log** use. Teach that one shared event records an interaction involving multiple contacts: users select participants, shared information applies to the group, and Orbit derives/records relevant participant interactions. No full Group Events walkthrough. Participant overrides, historical event editing, interaction-to-group conversion, advanced participant correction and deeper management remain contextual-UI responsibilities unless future testing identifies a concrete problem.

**LOCKED — Capture discovery folded into Memory:** During the small Memory introduction, briefly establish that useful text/links found in other Android apps can be shared to Orbit and saved for a person. Capture discovery is not a standalone journey.

**LOCKED — no dedicated Capture workflow tutorial:** After Share → Orbit, the Capture UI owns the workflow unless later UAT identifies a specific usability problem.

**LOCKED — no dedicated advanced interaction-management tutorials:** Backdating, editing/deleting interactions, conversion into Group Events, participant-specific corrections and other advanced management are owned by contextual UI, confirmations and error handling.

### Notifications / Widget

**LOCKED — small progressive notification teaching moment on deliberate enablement:** Do not request notification permission during first-run onboarding merely because notifications exist. Teach contextually around the user's actual enablement/permission: Orbit can surface relationship reminders/upcoming information outside the app; notifications are optional; Settings controls behavior; Android permission is requested because the user chose this capability.

Do not tour notification types, individual reminder categories, quiet hours, timing options, per-contact mute or every event/birthday reminder control. Those belong to Settings/UI.

**LOCKED — no dedicated Widget tutorial:** Discoverability belongs in appropriate product/Settings/help UI; Android owns placement mechanics.

**LOCKED — no dedicated event-reminder tutorial:** After Events/Notifications concepts, ordinary reminder controls are owned by existing UI.

### Data / Lifecycle

**LOCKED — no dedicated Backup/Restore tutorial:** Use strong permanent contextual explanation in Settings/Data, including appropriate protection/backups for local data. Creation, restore, validation, corrupt backups and error/recovery mechanics require clear UI/error handling, not progressive tutorials. Future sync may make backup versus sync an important distinction; do not overfit Phase 39 to today's pre-sync architecture. The launch messaging review remains deferred in §12.

**LOCKED — no dedicated lifecycle/maintenance tutorials:** Archive, Recently Deleted, Restore, permanent deletion, Favourite, Snooze and Mute are intentional actions owned by contextual UI, consequence copy, confirmations and recovery affordances. Bound/Unbound stays in existing foundational teaching, with no duplicate lifecycle journey.

**LOCKED — no dedicated reconciliation/merge tutorial after prerequisite remediation:** Preserve the obvious normal possible-match resolution requirement in §4. After remediation, the workflow teaches resolution itself. No teaching of heuristics, provenance, duplicate-detection internals or advanced merge behavior.

### Customization / Settings / Accessibility

**LOCKED — no dedicated Appearance tutorial:** Themes, Galaxy appearance controls, center selection, sun color, backgrounds and ordinary visual customization are owned by controls and visual feedback; entering Appearance already expresses intent.

**LOCKED — no dedicated Profile presentation tutorial:** Layout/template/background/presentation configuration and resulting appearance own the experience.

**LOCKED — no dedicated Settings-navigation tutorial:** The Settings category architecture should be understandable itself. Difficult destination discovery is an information-architecture issue, not a reason for a generic tutorial.

**LOCKED — no dedicated accessibility-support tutorial.** Separately, **LOCKED — tutorial-framework accessibility is an architectural requirement:** account, as applicable, for screen-reader semantics, predictable focus, scalable text, sufficient contrast, reduced motion, non-visual alternatives to spatial spotlights, accessible Next/Back/Skip and avoidance of inaccessible gesture requirements. Implementation is not specified here.

### History dependency

**DEFERRED:** Do not design a detailed walkthrough around the current Rolodex/date-navigation model pending the History redesign decision. The owner independently finds it unintuitive; tutorials should not compensate for UX that may immediately be replaced. A [History-navigation UX investigation](../../../.planning/phases/38.8-history-navigation-ux/38.8-WORKPAPER-history-navigation.md) is underway as a potential Phase 38.8, not an approved redesign or scheduled phase.

**LOCKED:** Basic History concepts in Prepare/Record remain unchanged. **OPEN:** A tiny contextual hint may be appropriate after redesign; no future History teaching is selected yet.

### Remaining product dependencies

**PROVISIONAL:** Systems scope and exact Orrery V2 teaching await implemented V2 evaluation. **DEFERRED:** Detailed History navigation awaits the redesign decision. **OPEN:** A possible tiny post-redesign History hint remains undecided. These dependencies do not reopen completed family triage.

Feature-family triage is substantially complete, not a claim that every future onboarding question is resolved. The 145-candidate inventory remains discovery evidence rather than 145 tutorial commitments. Future concrete usability findings can be reviewed within the exceptions explicitly recorded above.

## 14. Open Architecture / State / Trigger Design

**OPEN — next owner + ChatGPT design stage:** Determine how the onboarding system works, without solving it in this ledger update:

- Journey eligibility and precise trigger semantics, including normal versus maintenance-hosted encounters and FAB timing.
- Per-path/journey state: never introduced, active, completed and skipped/dismissed; separation from workflow state.
- Global tutorials enabled/disabled; restart/reset behavior; Settings controls.
- Dependency/order rules and collisions when multiple journeys become eligible.
- Interruption/resume and first-run versus progressive state.
- Handling triggers whose requested product action commits immediately, preserving Quick Log continuation on Skip.
- Versioning/re-eligibility when a journey materially changes in a future release.
- Acquisition cancellation, permission denial, partial acquisition or no acquired person.
- Framework accessibility requirements from §13.

**OPEN — subsequent separate stage:** Visual/presentation design, final copy and exact setup/teaching controls follow settled architecture/state/trigger behavior. Ground AI privacy language in actual behavior then; do not reopen the agreed AI teaching scope.

Product remediation choices in §4 and V2/History dependencies remain unresolved separately. None of these open details weakens the locked sequence, escape hatches, triggers or exclusions.

## 15. Source Workpapers / Evidence

- [Exhaustive journey discovery](phase-39-onboarding-journey-discovery.md): 145 deliberately over-collected candidates, first-use foundations, dependency map and Orrery follow-ups. Candidate IDs identify supporting product surfaces, not approved tutorials.
- [Fresh-install foundation audit](phase-39-fresh-install-foundation-audit.md): chronological pristine-state observations and F01–F28 findings; especially §4 manual acquisition, §5 Import, §6 core loop, §7 FAB, §8 progressive acquisition and §15 corrections.

The audit's classification recommendations remain provisional evidence. This ledger intentionally changes manual defaults, adds the agreed guided first-run structure and narrows core teaching. The fresh audit already corrects the original report's FAB/Import claim; this ledger follows that correction. No unresolved factual contradiction requires reopening the supplied decisions.

## 16. Decision Log

Subject-oriented record; no fabricated decision dates.

| Area | Decision | Status | Evidence / rationale |
|---|---|---|---|
| Philosophy | Contextual, progressive, optional; teach meaningful encounters clearly. | LOCKED | Owner triage; discovery overcollection is not a tutorial set. |
| Product baseline | Fix underlying ambiguity before dependent onboarding. | LOCKED | Fresh audit defaults, match resolution and Assist findings. |
| Manual defaults | Bound + Not Yet replaces Unbound + Today. | LOCKED | F08–F12; tracking without silently creating history. |
| Import defaults | Retain explicit participation and Unbound default. | LOCKED | F13/F14; avoid cohort-wide tracking opt-in. |
| Match resolution | Obvious normal resolution path; no secret long-press prerequisite. | LOCKED | F16. |
| Assist | Coherent outcome model before Reach Out teaching. | LOCKED | F22; exact remediation OPEN. |
| Initial sequence | Welcome → Acquire → Orient → normal app. | LOCKED | F01/F02; meaningful populated orientation. |
| Welcome | Short purpose, Get Started and Skip Tutorials. | LOCKED | Owner conceptual framing; final copy OPEN. |
| Welcome reassurance | Brief local-first/privacy reassurance may belong. | PROVISIONAL | R01; placement/copy OPEN. |
| Acquisition | Teach chosen path; leave the other not introduced. | LOCKED | A03/E01–E03, F26; progressive later encounter. |
| Orient | Digest, Contacts and visual Orrery lenses; limited conceptual scope. | LOCKED | A11–A14, F18; no exhaustive screen tour. |
| Core loop | Orient → Prepare → Reach Out → Record → updated Orient. | LOCKED | Fresh audit §6 and owner product direction. |
| Prepare | Normal Profile encounter; emphasize Things to Remember. | LOCKED | A16, F19/F20; person knowledge versus interactions. |
| Reach Out | Compose, context, Copy/Transmit and user-controlled handoff; no AI. | LOCKED | E16/E17, F21/F22. |
| Record | First intentional log; explain commit boundary and close the loop. | LOCKED | A22/A23, F23; Quick Log Skip still executes. |
| FAB | Teach the add/update/record container without flattening action semantics. | LOCKED | A02/F25; Import is elsewhere. |
| Controls | Skip per journey; disable/re-enable/reset distinctly in Settings. | LOCKED | Owner control requirement; architecture OPEN. |
| Interaction style | Clear contextual teaching; generally avoid unnecessary Not Now. | PROVISIONAL | Owner direction; visual architecture OPEN. |
| AI separation / setup | No core AI; optional guided setup on deliberate enablement/setup entry, with actual provider requirements and accurate context/privacy boundary. | LOCKED | Completed owner/ChatGPT AI triage; core works without AI. |
| AI Compose / future scope | Small first configured AI-Compose capability introduction; no repeated setup/privacy or speculative features. | LOCKED | Completed AI triage; immediate drafting/revision only. |
| Orrery V2 steps | Await Phase 38.7 and separate discovery. | PROVISIONAL | Both reports exclude old renderer. |
| Memory / Share discovery | Small introduction to reusable person knowledge, including Android Share discovery; no full Memory or standalone Capture journey. | LOCKED | Completed triage; Things to Remember versus interaction note. |
| Categories | Small introduction to organization/reuse; no ordinary management tutorial. | LOCKED | Subsequent owner/ChatGPT Organization triage; exact trigger/presentation later. |
| Current state / Key People / Off Limits / Custom Fields | No dedicated tutorials; existing UI/copy owns these workflows. | LOCKED | Subsequent owner/ChatGPT triage; Custom Fields revisitable if specific testing reveals a problem. |
| Systems | Likely progressive teaching; scope awaits Orrery V2 evaluation. | PROVISIONAL | Unusual mental model and Phase 38.7 dependency. |
| Detailed History navigation | Hold current Rolodex walkthrough pending redesign decision. | DEFERRED | Owner friction report and separate potential Phase 38.8 investigation. |
| Basic History teaching | Keep the History concept in Prepare/Record. | LOCKED | Existing conceptual loop preserved. |
| Future History hint | Possible tiny post-redesign hint remains undecided. | OPEN | Requires later triage against the redesigned UI. |
| Group Events | Small first deliberate Group Log lesson: shared event, selected participants and derived interactions. | LOCKED | Core concept only; advanced management remains contextual UI. |
| Notifications | Small lesson at deliberate enablement/permission; optional reminders and Settings control. | LOCKED | No first-run permission promotion or settings tour. |
| Capture / Widget / event reminders | No dedicated workflow tutorials. | LOCKED | Capture UI, product/help discoverability and Android placement own the experience. |
| Backup / lifecycle / reconciliation | No dedicated tutorials; permanent explanation and contextual UI, with match remediation retained. | LOCKED | No backup/sync overfitting or advanced-management tutorials. |
| Advanced interactions / customization / Settings / accessibility support | No dedicated tutorials. | LOCKED | Existing controls, consequences and information architecture own these operations. |
| Tutorial accessibility | Accessible framework is required; no implementation specified here. | LOCKED | Applies to upcoming architecture and presentation stages. |
| Architecture / visuals | State/eligibility/triggers/collisions/resume/versioning open; presentation follows separately. | OPEN | Next design stages; preserve locked requirements. |
| Signup / launch communication | No first-run signup; feedback and announcements collected for likely M3. | DEFERRED | Owner scope boundary; no launch planning here. |
| Local-data-loss messaging | Review device-loss/uninstall/backup implications before launch. | DEFERRED | Likely M3 Launch Pipeline concern while local-first/pre-sync. |
