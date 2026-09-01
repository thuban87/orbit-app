# Dossier — Rapid Capture & Update Flows

**Status:** complete · Interrogated through 2026-09-01 · Ordinary single-contact capture/update product decisions settled · Consumes Phase 12 Group Interaction Logging without redefining it.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner during Phase 13 interrogation.
- **[DERIVED]** implementation/architecture consequence of settled product choices or inherited contracts.
- **[DEFERRED]** intentionally postponed or left to a later owning phase.
- **[SUPERSEDES]** intentionally replaces an earlier planning decision for the unimplemented milestone.

## Scope

This dossier defines Orbit's release-quality **ordinary rapid capture and contact-update workflows**.

It covers:
- Add Contact form structure and progressive disclosure,
- full Edit Contact form structure,
- Bound/Unbound and Contact Frequency behavior during creation,
- ordinary single-contact Quick Log integration,
- ordinary single-contact detailed Log Interaction,
- Channel vocabulary and default preference contract,
- Direction / Connected contextual defaults,
- optional Tone,
- optional duration inherited from Phase 11,
- notes and Memory conversion/capture seams,
- historical/backdated ordinary logging,
- Update Contact taxonomy and repeated-update session behavior,
- lightweight and full Memory authoring seams used by rapid capture,
- custom-field discoverability in Update Contact,
- save/cancel/validation/error behavior,
- keyboard/focused-workflow ergonomics,
- picker/preselection,
- deep-link/widget-ready routes,
- accessibility and completion behavior.

It intentionally does **not** redefine Group Event persistence, Group Log field ownership, participant inheritance/overrides, participant lifecycle, Group Event Detail/Edit, Group Event browsing/management, atomic multi-child persistence, or Group Event backup semantics. Those are owned by Phase 12 — Group Interaction Logging.

---

# A. Product Role

**[DECIDED]** Rapid Capture should optimize for the smallest reasonable amount of work needed to record or update relationship information while preserving separate full editing surfaces for exhaustive changes.

**[DECIDED]** Orbit distinguishes four ordinary capture/update intents:
1. **Add Contact** — create a new contact with minimal required information and optional enrichment.
2. **Quick Log** — record an interaction immediately at the current time once the target is known.
3. **Log Interaction** — author a detailed ordinary single-contact interaction.
4. **Update Contact** — rapidly add/change one or a few pieces of relationship/contact knowledge without opening the complete Edit Contact form.

**[DECIDED]** Full **Edit Contact** remains a separate administrative workflow exposing the contact's complete editable record.

**[DERIVED]** Do not collapse Quick Log, detailed Log Interaction, Update Contact, and Edit Contact into one overloaded form merely because some fields overlap.

---

# B. Group Interaction Boundary

**[DECIDED]** Phase 13 consumes the canonical Phase 12 Group Log workflow and does not implement a second multi-contact detailed logging form.

**[DECIDED]** Existing cross-phase routing remains authoritative:
- one selected Dashboard Grid contact → ordinary detailed Log Interaction,
- two or more selected Dashboard Grid contacts → canonical Group Log,
- Quick Log remains a separate immediate action.

**[DECIDED]** Universal FAB includes distinct Group Log routing through the Phase 1 amendment.

**[DERIVED]** Any Phase 13 shared controls reused by Group Log must remain reusable components/domain controls; Phase 13 does not acquire ownership of Group Event semantics by sharing them.

---

# C. Add Contact — Required Data

**[DECIDED]** **Name is the only field required** to create a contact.

**[DECIDED]** Contact Frequency is optional during Add Contact.

**[DECIDED]** Category is optional during Add Contact.

**[DECIDED]** Contact methods such as phone/email are optional during Add Contact.

**[DECIDED]** Photo/avatar is not part of the initial basic Add Contact surface.

**[DERIVED]** Add Contact validation must not block creation merely because Category, Contact Frequency, contact methods, remembered information, or photo are absent.

---

# D. Add Contact — Streamlined Progressive Disclosure

**[DECIDED]** Add Contact is intentionally **more streamlined than Edit Contact** and should not initially present the user with the entire contact schema as a long wall of collapsed drawers.

**[DECIDED]** Initial Add Contact surface exposes approximately three primary top-level accordion sections:
1. **Identity** — open by default.
2. **Relationship Basics**.
3. **Contact Methods**.

**[DECIDED]** A clear **Show More** / equivalent progressive-disclosure action reveals the less-common enrichment sections only when requested.

**[DECIDED]** Revealed advanced sections use the same recognizable vocabulary as Edit Contact, including as applicable:
- Last Talked About,
- Key People / Relationships,
- Current Location,
- Memories,
- Custom Fields,
- Off Limits,
- other compatible Contact Knowledge sections established by the semantic model.

**[DECIDED]** Multiple accordion drawers may remain open simultaneously.

**[DECIDED]** Filling one field does not automatically spawn additional repeated rows or additional drawers.

**[DERIVED]** Repeated values use explicit `Add another` / equivalent affordances rather than auto-growing the form.

**[DERIVED]** Add Contact and Edit Contact should reuse canonical field editors and validation rules while composing those editors differently.

---

# E. Edit Contact — Complete Form

**[DECIDED]** Edit Contact deliberately exposes the **complete editable contact form** rather than using the streamlined Add Contact composition.

**[DECIDED]** Edit Contact uses top-level accordion sections with the same product vocabulary used by Add Contact's expanded state.

**[DECIDED]** Things-to-Remember subdomains should be directly findable as top-level editing sections rather than buried inside a second nested accordion solely because Profile groups them under the Things to Remember presentation concept.

Expected editing vocabulary includes:
- Identity,
- Relationship Basics,
- Contact Methods,
- Last Talked About,
- Key People / Relationships,
- Current Location,
- Memories,
- Custom Fields,
- Off Limits.

**[DECIDED]** Multiple sections may remain open simultaneously.

**[DERIVED]** Profile may continue to present these domains under a broader Things to Remember concept; direct-access editing information architecture is intentionally optimized for field discovery rather than mirroring Profile nesting exactly.

---

# F. Bound / Unbound and Contact Frequency During Creation

**[SUPERSEDES]** Earlier planning that manual contact creation necessarily defaults to Bound with a required cadence is superseded for the new Add Contact experience.

**[DECIDED]** A newly created contact with **no Contact Frequency** is created **Unbound**.

**[DECIDED]** Selecting a Contact Frequency during creation automatically turns **Bound ON**.

**[DECIDED]** Bound/Unbound remains conceptually distinct from Contact Frequency.

**[DECIDED]** The user may explicitly turn Bound OFF while retaining an assigned Contact Frequency as dormant cadence information.

**[DECIDED]** Turning Bound ON when no cadence exists requires selecting a valid Contact Frequency.

**[DERIVED]** Do not model Unbound as synonymous with `interval_days = null`; lifecycle state and cadence remain separate concepts even though Add Contact coordinates them ergonomically.

**[DERIVED]** Reconciliation should verify any older cadence-null lifecycle rules against this explicit Add Contact supersession before GSD canonicalization.

---

# G. Add Contact Save / Completion

**[DECIDED]** Add Contact uses one form-level **Save** action.

**[DECIDED]** No special `Save & Add Another` flow is required initially.

**[DECIDED]** Successful creation routes to the newly created Contact Profile.

**[DECIDED]** The primary Save action may live in the focused workflow app bar; a permanently duplicated sticky bottom Save button is not required.

**[DERIVED]** Keyboard-aware layout must keep Save reachable while editing without adding redundant permanent controls solely for keyboard avoidance.

---

# H. Quick Log — Immediate Contract

**[DECIDED]** Quick Log preserves the Phase 1 shell contract: it writes immediately once the contact target is known.

Examples:
- Contact Profile → Quick Log → immediate write.
- Global FAB → Quick Log → choose contact → immediate write.

**[DECIDED]** Quick Log means **now**. It does not support backdating.

**[DECIDED]** Quick Log never asks for interaction duration before writing.

**[DECIDED]** Successful Quick Log provides truthful success feedback and Undo according to the shell contract.

**[DECIDED]** Failure never displays success and should expose Retry where recoverable.

---

# I. Quick Log — Post-Log Note / Memory Capture

**[DECIDED]** Quick Log does **not** become a pre-submit form merely to collect an optional note.

**[DECIDED]** After the immediate write, the success snackbar/toast exposes an **Add Note** affordance alongside the existing Undo behavior where presentation permits.

**[DECIDED]** Add Note opens a very small post-log editor associated with the interaction that was just created.

**[DECIDED]** The user may save the text as an ordinary **Interaction Note**.

**[DECIDED]** The editor also exposes an explicit **Create Memory Instead** action/choice.

**[DECIDED]** `Create Memory Instead` means the entered text becomes a new Memory and is **not duplicated** into the Interaction Note.

**[DECIDED]** Interaction Notes and Memories are semantically distinct:
- Interaction Note = context attached to that interaction.
- Memory = durable remembered knowledge attached to the contact.

**[DECIDED]** The quick Memory path remains deliberately basic and does not redirect the user into the full Memory editor before saving.

**[DECIDED]** After the basic Memory is created, feedback may offer **Edit Memory**; choosing it opens the full Memory editor.

**[DERIVED]** There is no synchronization/drift problem because Quick Log creates either the Interaction Note or the Memory from that entered text, not two permanently linked copies.

---

# J. Memory Type Taxonomy Boundary

**[DECIDED]** Phase 13 does not invent a new comprehensive Memory-type taxonomy.

**[INHERITED]** Contact Knowledge Foundation already establishes typed Memories governed by a central Memory-type registry, including a generic/custom mechanism, but does not fully enumerate the final built-in type catalog.

**[DECIDED]** Basic rapid Memory creation should use the registry's designated **default/general Memory type** so the user can save one content value with minimal friction.

**[DEFERRED]** Exact product name/identity of that default/general built-in Memory type should be finalized during the planned cross-dossier reconciliation / Memory-mechanics cleanup rather than fabricated inside Phase 13.

**[DERIVED]** The registry must expose enough metadata for rapid capture to request/use the canonical default Memory type without hardcoding a storage-specific type ID in the Quick Log UI.

---

# K. Full Memory Editor in Update Contact

**[DECIDED]** The **actual full Memory creation/editor experience** is owned by the Update Contact workflow rather than the Quick Log post-save editor.

Flow:

`Update Contact → Memory → Memory editor`

**[DECIDED]** Memory Type selection lives **inside the Memory editor**, rather than introducing an additional type-chooser page before the editor.

**[DECIDED]** The full editor may expose the Memory model's richer optional metadata.

**[DECIDED]** The basic/fast state should prioritize Memory content; less-common metadata remains behind **More Options** where appropriate.

**[DECIDED]** Label belongs under More Options rather than being mandatory in rapid creation.

**[DERIVED]** Additional established Memory metadata such as note, meaningful date, URL, pinning, Profile visibility, and AI permission may be exposed through the full editor / More Options according to the Contact Knowledge registry and owning privacy rules.

---

# L. Last Talked About Is Not Generic Memory

**[DECIDED]** **Last Talked About** remains a distinct semantic/history-aware knowledge concept and must not be treated as merely another generic Memory type in the Update Contact information architecture.

**[DECIDED]** Update Contact exposes **Last Talked About** directly as its own first-class action.

**[DERIVED]** Last Talked About continues consuming the Phase 3 retained-history model, with the latest value surfaced as current and prior values remaining available through history.

---

# M. Ordinary Detailed Log Interaction — Product Role

**[DECIDED]** Detailed **Log Interaction** is the canonical ordinary single-contact authoring form for an interaction requiring more information than Quick Log.

**[DECIDED]** It remains separately routable from Quick Log.

**[DECIDED]** It may be launched pre-targeted from Profile, Dashboard List/Card actions, History backfill, deep links, or future widgets/shortcuts.

**[DERIVED]** Use one canonical form with contextual initial values rather than separate Dashboard/Profile/History logging implementations.

---

# N. Log Interaction — Primary Fields

**[DECIDED]** Ordinary detailed Log Interaction exposes the following primary information directly:
- Date / time,
- Channel,
- Direction,
- Connected where meaningful,
- Tone,
- Note.

**[DECIDED]** Date/time defaults to **now** for ordinary invocation and remains editable.

**[DECIDED]** Optional Duration is available through **More Options** rather than being a required/default primary field.

**[DECIDED]** More Options may grow later only when genuine structured interaction metadata exists; do not invent fields solely to populate the section.

---

# O. Channel Vocabulary

**[SUPERSEDES]** The ordinary new-interaction Channel chooser no longer exposes legacy `Other`, `Unspecified`, or a separate `Email` option.

**[DECIDED]** Initial user-facing Channel vocabulary is exactly:
- **Message**
- **Call**
- **In Person**

**[DECIDED]** `Message` intentionally covers text/SMS, chat/DM platforms, email, and similar asynchronous written communication for the initial product.

**[DECIDED]** Additional granularity may be added later if real usage demonstrates value.

**[DERIVED]** Existing/imported historical values such as `unspecified`, `email`, or `other` may remain representable internally for compatibility; removal from the new-entry chooser does not require destructive historical migration solely for UI cleanliness.

---

# P. Ordinary Channel Default Preference

**[DECIDED]** Settings later exposes an ordinary single-contact logging preference with four choices:
- **Remember Last Choice**
- **Message**
- **Call**
- **In Person**

**[DECIDED]** Factory default is **Remember Last Choice**.

**[DECIDED]** When a fixed Channel is selected in Settings, ordinary new Log Interaction forms initialize to that Channel.

**[DECIDED]** When `Remember Last Choice` is selected, Orbit initializes ordinary logging from the last successfully saved ordinary single-contact interaction Channel.

**[DECIDED]** Changing Channel inside a form updates the remembered value **only after a successful save**.

**[DECIDED]** Canceling/abandoning an unsaved form does not mutate the remembered Channel.

**[DERIVED]** The preference should have a sensible first-use fallback before any successful remembered choice exists; Message is the preferred implementation fallback unless Settings/Onboarding later explicitly establishes another factory seed.

---

# Q. Group Log Channel Preference Exception

**[DECIDED / INHERITED FROM PHASE 12]** The ordinary Channel preference above applies only to ordinary single-contact logging.

**[DECIDED / INHERITED FROM PHASE 12]** **Group Log ignores this preference and defaults to In Person.**

**[DECIDED]** Phase 13 explicitly exports this exception to the later **Settings & Personalization** phase so Settings does not imply that the ordinary default governs Group Log.

**[DERIVED]** Settings copy should make the scope clear enough that users do not expect changing Default Interaction Channel to alter Group Log's initial In Person value.

---

# R. Direction Behavior

**[DECIDED]** For Message and Call, Direction defaults to **Outbound**.

**[DECIDED]** Changing Channel to **In Person** automatically defaults Direction to **Mutual**.

**[DECIDED]** Users may manually change Direction afterward where the domain allows it.

**[DECIDED]** Once the user explicitly overrides Direction, the form should not repeatedly fight that choice through unrelated re-renders.

**[DERIVED]** Channel-sensitive defaulting is initialization/context behavior, not an immutable validation rule.

---

# S. Connected Behavior

**[DECIDED]** Connected remains a simple toggle for Message and Call and defaults **Yes/On**.

**[DECIDED]** Connected is hidden/not requested for In Person because the occurrence of an in-person interaction already implies connection for this product model.

**[DERIVED]** Historical/internal connected data may remain canonical where applicable; the UI simply avoids asking a meaningless question for In Person.

---

# T. Tone

**[SUPERSEDES]** The old `Quality` terminology and `Hard / Fine / Good` choices are replaced.

**[DECIDED]** Canonical product term is **Tone**.

**[DECIDED]** Initial Tone values are:
- **Positive**
- **Neutral**
- **Negative**

**[DECIDED]** Tone is optional and defaults **null/unset**.

**[DECIDED]** Orbit must not silently interpret an omitted Tone as Neutral.

**[DECIDED]** The initial product keeps exactly three Tone choices rather than exposing user-defined Tone taxonomies.

**[DERIVED]** Future analytics can distinguish explicit Neutral from missing/unrated interactions.

---

# U. Duration

**[INHERITED FROM PHASE 11]** Duration is optional.

**[DECIDED]** Duration belongs under More Options in ordinary detailed Log Interaction.

**[INHERITED]** Users enter duration in human-friendly minutes/hours through presets plus Custom; canonical storage may use seconds.

**[INHERITED]** Quick Log never sets duration.

**[INHERITED]** Duration does not affect Status, Gravity, or Intensity during this milestone.

**[DERIVED]** Duration must remain editable later through canonical Interaction Detail/Edit Interaction and survive backup/restore according to Phase 11.

---

# V. Detailed Log Interaction — Note vs Memory

**[DECIDED]** The ordinary detailed Log Interaction Note field may expose the same explicit **Create Memory Instead** semantics used by the Quick Log post-save note editor.

**[DECIDED]** Saving as a Memory does not duplicate the same text into the Interaction Note.

**[DECIDED]** Memory creation remains secondary/unobtrusive inside detailed logging; Log Interaction's primary purpose is still authoring the interaction.

**[DERIVED]** When richer Memory editing is requested after basic creation, route to the canonical full Memory editor in Update Contact rather than cloning Memory-edit controls into Log Interaction.

---

# W. Historical / Backdated Ordinary Logging

**[DECIDED]** Ordinary detailed Log Interaction defaults date/time to now but permits the user to change it freely.

**[DECIDED]** Historical/backdated logging is supported without arbitrary warnings for old dates.

**[DECIDED]** Orbit trusts deliberate user-entered historical dates rather than asking confirmation merely because an interaction is months/years old.

**[DECIDED]** History-originated backfill routes pre-target the contact and prefill date context where unambiguous.

**[DECIDED]** A single-day History entry point may prefill that day; a multi-day period must not invent an arbitrary exact day.

**[DECIDED]** Date/time remains editable after creation through canonical Edit Interaction for standalone Interactions, subject to the Phase 11/12 group-linked ownership rules.

---

# X. Update Contact — Product Boundary

**[DECIDED]** Update Contact is a **fast relationship/contact-information capture workflow**, normally intended for one to a few changes.

**[DECIDED]** Update Contact does not present the full Edit Contact form.

**[DECIDED]** Edit Contact remains the complete administrative record editor.

**[DECIDED]** Identity-oriented/admin changes such as **Category** remain in Edit Contact rather than Update Contact.

**[DERIVED]** The boundary is semantic rather than storage-table-based: Update Contact should expose information users naturally think of as quickly learned/changed relationship context, while Edit Contact owns exhaustive identity/administrative editing.

---

# Y. Update Contact — Initial Chooser

**[DECIDED]** After the contact is known, Update Contact opens a compact chooser/action surface rather than the full form.

**[DECIDED]** Initial built-in choices include:
- Last Talked About,
- Key People / Relationships,
- Current Location,
- Memory,
- Off Limits,
- Contact Method,
- Contact Frequency,
- custom-field access as defined below.

**[DECIDED]** Category is not included in Update Contact.

**[DECIDED]** Selecting an item opens a focused small editor for that information type.

**[DERIVED]** The chooser should be driven by the semantic Contact Knowledge field/type registry where possible rather than hardcoding storage tables into navigation.

---

# Z. Custom Fields in Update Contact

**[DECIDED]** Existing applicable custom fields should be discoverable **by their user-facing field names directly from the top-level Update Contact chooser**, rather than requiring users to remember that a familiar named field happens to be technically stored under `Custom Fields`.

Examples:
- `Favorite restaurant`
- `Kids' school`
- `Anniversary`

may appear directly as update targets when those definitions apply to the contact.

**[DECIDED]** A generic **Custom Fields** entry remains available for:
- adding a new one-off field,
- selecting a less-prominent existing field,
- promoting/choosing reusable definitions where owned by the Contact Knowledge model.

**[DERIVED]** If a user has many custom fields, the chooser may rank, search, group, or collapse overflow rather than rendering an unbounded flat wall. Exact threshold/ranking is implementation/usability tuning.

**[DERIVED]** Direct field-name surfacing is a discoverability presentation over the same canonical custom-field definitions; it does not create duplicate fields or a separate schema.

---

# AA. Update Contact — Repeated Updates in One Session

**[DECIDED]** Saving one Update Contact item does **not** exit the route.

**[DECIDED]** After a successful focused edit, Orbit returns to the Update Contact chooser with the same contact still targeted.

**[DECIDED]** The user may immediately update another item, including the same information family again where repeatable records are allowed.

**[DECIDED]** The user explicitly chooses **Done** to finish the Update Contact session.

**[DECIDED]** A subtle recent-success/updated indication is acceptable, but Update Contact should not become a rigid checklist with session-completion semantics.

**[DERIVED]** Individual successful updates may persist as they are saved; the whole Update Contact session need not behave as one giant transaction merely because the route remains open.

---

# AB. Contact Frequency in Update Contact

**[DECIDED]** Contact Frequency remains available as a fast Update Contact action even though Profile also exposes direct frequency adjustment.

**[DERIVED]** Reuse the canonical Contact Frequency control/domain behavior rather than building an Update-specific cadence system.

**[DERIVED]** Bound/Unbound implications must follow the canonical lifecycle rules and the explicit creation-time behavior established in this dossier.

---

# AC. Picker and Preselection

**[INHERITED FROM PHASE 1]** Orbit uses one canonical reusable contact picker for contact-targeted actions when no target is already known.

**[DECIDED]** If the invoking context already identifies the contact, Quick Log, Log Interaction, and Update Contact skip the picker and preselect that contact.

**[DECIDED]** Add Contact remains untargeted.

**[DECIDED]** Group Log is not routed through the single-contact pre-picker; participant management belongs to the Phase 12 canonical workflow.

**[DERIVED]** Deep links/widgets/shortcuts may supply the same target context directly to the canonical route.

---

# AD. Save and Validation

**[DECIDED]** Add Contact and Edit Contact use one form-level Save action rather than independent per-drawer saving.

**[DECIDED]** Only Name is required to create a contact.

**[DECIDED]** Optional fields that the user actually populates must still be valid enough to persist; malformed entered optional content should not be silently dropped.

Example: an explicitly entered malformed email/phone representation that fails the canonical validation contract should be corrected or cleared before Save where validation is applicable.

**[DECIDED]** Validation errors should identify and reveal the relevant accordion section rather than leaving the user to hunt through collapsed drawers.

**[DERIVED]** Prefer field-level actionable error text and focus/scroll to the first blocking problem; exact animation/timing is implementation work.

---

# AE. Save Failure / Error Recovery

**[DECIDED]** Failed saves must preserve the user's form state.

**[DECIDED]** Orbit must not dismiss a focused workflow or pretend completion occurred when persistence failed.

**[DERIVED]** Recoverable failures should allow Retry after correcting the underlying issue or retrying persistence.

**[DERIVED]** Avoid destructive reset of text/date/selection state on ordinary transient errors.

---

# AF. Cancel / Unsaved Changes

**[INHERITED / CONFIRMED]** Focused workflows follow the shell's meaningful-dirty-state protection.

**[DECIDED]** Leaving an unchanged form does not trigger a confirmation.

**[DECIDED]** Leaving after meaningful unsaved edits prompts:
- **Discard changes**
- **Keep editing**

**[DECIDED]** No Phase 13-specific deviation is required.

---

# AG. Keyboard Ergonomics

**[INHERITED / CONFIRMED]** Bottom navigation and universal FAB remain hidden during focused workflows/keyboard use according to the shared shell behavior.

**[DECIDED]** Long Add/Edit forms and small focused editors must remain keyboard-aware so the active control and primary completion action remain reachable.

**[DERIVED]** Use shared keyboard-aware scrolling/inset/resize primitives rather than per-form magic offsets.

**[DERIVED]** Enter/Next keyboard actions should advance naturally through sensible fields where platform conventions permit, but exact focus choreography is implementation detail.

---

# AH. Completion Behavior

**[DECIDED]** Add Contact success → newly created Contact Profile.

**[DECIDED]** Contact-specific ordinary fast-entry completion generally resolves to the target Contact Profile when no stronger in-app origin requires restoration.

**[DECIDED]** Origin-aware completion should preserve meaningful in-app context where appropriate, such as returning a History-originated backfill flow to its History context rather than unnecessarily dumping the user elsewhere.

**[DECIDED]** Update Contact's internal Save returns to its chooser; explicit Done completes the workflow.

**[DERIVED]** Completed workflows must be removed/replaced in the navigation stack so Back does not replay a finished edit form.

---

# AI. Deep-Link / Widget Readiness

**[INHERITED FROM PHASE 1]** Ordinary fast-entry workflows remain independently routable/deep-link-ready.

Canonical semantic route concepts include:
- Add Contact,
- Quick Log,
- ordinary Log Interaction,
- Update Contact,
- remembered-information/Memory authoring,
- Group Log (owned by Phase 12).

**[DECIDED]** Routes may accept preselected contact/date/context parameters where relevant without creating alternate business logic.

**[DERIVED]** Future widgets/shortcuts should dispatch into these same canonical workflows rather than duplicate writes in widget-specific code.

---

# AJ. Accessibility

**[DECIDED]** Phase 13 workflows inherit the shared shell/theme accessibility architecture rather than deferring accessibility to final hardening.

**[DERIVED]** Requirements include:
- accessible names matching visible labels,
- clear expanded/collapsed state for accordions,
- logical focus order,
- error announcement and focus recovery,
- sufficient touch targets,
- dynamic-text-safe form reflow,
- non-color-only selection/error/Tone semantics,
- keyboard and screen-reader access to More Options, Show More, Create Memory Instead, and Update Contact Done.

**[DERIVED]** Final cross-device/large-text audit remains Phase 18, but Phase 13 must ship accessible primitives/semantics rather than relying on Phase 18 to retrofit the workflows.

---

# AK. Cross-Phase Exports

## To Phase 1 — App Shell / Navigation
- Consume the amended six-action FAB and canonical Group Log route.
- Ordinary Quick Log remains immediate and current-time.
- Phase 13 provides the detailed business/form behavior behind ordinary Add Contact, Log Interaction, and Update Contact.

## To Phase 3 — Contact Knowledge
- Preserve semantic distinction between Last Talked About, Memories, first-class fields, Relationships, and Custom Fields.
- Rapid capture consumes the central registry rather than flattening all remembered data into generic text.
- Full Memory taxonomy/default type name remains a reconciliation/Memory-mechanics follow-up if not already canonicalized elsewhere.

## To Phase 10 — Profile
- Edit Contact remains the complete administrative form.
- Update Contact remains a separate fast workflow.
- Profile grouping under Things to Remember does not force nested editing accordions.

## To Phase 11 — Interaction History & Insights
- Reuse canonical Interaction Detail/Edit Interaction.
- Ordinary backdated Log Interaction is the canonical History backfill path.
- Duration remains optional and metric-neutral.
- Group-linked Interaction edit ownership remains governed by the Phase 11 amendment/Phase 12 Group Event contract.

## To Phase 12 — Group Interaction Logging
- Do not redefine Group Event semantics.
- Group Log defaults In Person and ignores the ordinary Channel preference.
- Shared canonical field controls may be reused where semantics match.

## To Phase 15 — Settings & Personalization
Add ordinary **Default Interaction Channel** preference:
- Remember Last Choice — factory default,
- Message,
- Call,
- In Person.

Settings must explicitly communicate that **Group Log is exempt and defaults to In Person**.

## To Phase 17 — Onboarding
- If logging defaults/gesture education are introduced during onboarding, teach the final Message / Call / In Person vocabulary rather than legacy Text/Email/Other/Unspecified choices.
- Do not imply that ordinary Channel default changes Group Log.

## To Phase 18 — Responsive & Release Hardening
- Validate Add/Edit accordion density, Show More behavior, large-text layouts, keyboard ergonomics, Update Contact chooser scaling with many custom fields, form error focus, and deep-link completion across supported devices.

---

# AL. Explicitly Deferred

- Comprehensive redesign/expansion of the Memory type taxonomy.
- Final name of the generic/default Memory type if not already canonicalized during reconciliation.
- Automatic extraction/classification of Memories from interaction notes.
- User-defined Tone scales or expanded Tone analytics.
- More granular Channel taxonomy such as separate Email, SMS, WhatsApp, Video Call, etc.
- Arbitrary custom interaction metadata invented solely for More Options.
- Group Event/participant semantics already owned by Phase 12.
- Widget visual design; only canonical routing readiness is required here.
- Exact spacing, animation timing, keyboard focus timing, and custom-field overflow thresholds.

---

# AM. Phase Success Criteria

Phase 13 is successful when:

1. Add Contact allows creation with Name only and presents a quiet three-section initial form with optional Show More enrichment.
2. Edit Contact exposes the complete canonical editable record through direct-access top-level accordion sections without unnecessary nested Things-to-Remember drawers.
3. Add Contact creation correctly coordinates Bound/Unbound with optional Contact Frequency without making cadence mandatory.
4. Quick Log remains truly immediate/current-time and truthful about persistence success/failure.
5. Quick Log can add an Interaction Note after logging or create a basic Memory instead without duplicating/synchronizing the same text across both records.
6. The full Memory editor is reachable through Update Contact, while rapid Memory capture stays intentionally basic.
7. Ordinary detailed Log Interaction exposes date/time, Message/Call/In Person Channel, contextual Direction/Connected behavior, optional Tone, Note, and optional Duration under More Options.
8. Tone uses Positive/Neutral/Negative, starts null, and is not silently interpreted as Neutral.
9. Ordinary Channel default preference supports Remember Last Choice / Message / Call / In Person, updates remembered choice only on successful save, and explicitly does not govern Group Log.
10. Historical ordinary interactions can be backdated freely and corrected later through canonical Edit Interaction.
11. Update Contact provides fast focused editors for relationship/contact knowledge, returns to its chooser after each save, and exits only on Done.
12. Existing custom fields can surface directly by their field names in Update Contact while a generic Custom Fields path remains available for broader creation/selection.
13. Category remains a full Edit Contact concern rather than an Update Contact quick action.
14. Add/Edit validation, dirty-state protection, save failure recovery, keyboard behavior, and accessibility follow one coherent focused-workflow contract.
15. Canonical picker/preselection and semantic routes support Profile/Dashboard/History/deep-link/widget entry without duplicating business logic.
16. Phase 13 consumes Phase 12 Group Interaction Logging and does not recreate any Group Event subsystem semantics.

---

# AN. Notes for GSD / Roadmapper

- Treat Phase 13 as the ordinary rapid-capture/update workflow phase **after** Group Interaction Logging.
- Convert these detailed decisions into atomic user-observable requirements; do not copy every derived implementation note into requirements.
- Do not reopen Phase 12 Group Event ownership in this phase.
- Normalize `Log Contact` legacy wording toward **Log Interaction** where reconciliation determines that newer terminology is canonical.
- Normalize legacy `Quality/Impact` UI terminology to **Tone** and preserve explicit null semantics.
- New-entry Channel UX is Message / Call / In Person; compatibility with historical `email`, `other`, or `unspecified` values is an implementation/migration concern, not a reason to keep those choices in the new form.
- Do not turn Add Contact into the full Edit Contact form. Its quiet initial state and Show More boundary are product requirements.
- Do not flatten Contact Knowledge merely to simplify Update Contact routing.
- Dynamic custom-field-name surfacing in Update Contact is a presentation/discoverability behavior over canonical custom-field definitions.
- Reconciliation should explicitly review the older manual-create Bound/cadence rule and the still-unfinalized generic/default Memory type name before `new-milestone` canonicalization.
- Export the ordinary Channel preference and the Group Log In Person exception to Phase 15 Settings.
