# Dossier — Messaging & AI Compose

**Status:** complete · Interrogated through 2026-09-01 · Compose, research/context, AI-assisted drafting, delivery handoff, and session behavior settled.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope

This dossier defines Orbit's release-quality **Messaging & AI Compose** experience.

It covers:
- the product role of Compose,
- manual message composition,
- Text versus Email composition mode,
- recipient/destination resolution,
- email subject behavior,
- the external messaging handoff,
- Copy behavior,
- post-handoff send confirmation and interaction-logging seam,
- Compose-session persistence and abandonment,
- the Compose-specific Things to Remember research experience,
- AI visibility/availability rules,
- intentional AI Draft / Rewrite invocation,
- preauthorized AI context consumption,
- Message Focus / `Add to AI`,
- three-suggestion AI review,
- regeneration and failure behavior,
- accessibility/keyboard/routing boundaries.

It intentionally does **not** define AI provider/model/key administration, full prompt-personalization controls, user-adjustable AI generation instructions, provider-specific prompt construction, central AI-permission administration, general Contact Knowledge editing, ordinary interaction-form redesign, durable message drafts, third-party chat-app integrations, or final cross-device/release hardening.

---

# Amendment — audit resolutions 2026-09-01

**AF-01 — AI availability is three-state, not binary.** Section L and Phase Success Criterion 9 previously described a pre-Phase-16 binary model in which AI affordances vanished whenever the provider was `None` **or** the selected provider lacked usable credentials/configuration. That second case is now **AI On + Needs Attention** and is owned by **Phase 16 §F — AI Readiness / Needs Attention**: Compose replaces its AI actions with a restrained `AI needs attention` repair notice rather than hiding AI, so a deliberately disabled AI and an enabled-but-broken AI are not confused. Only the **AI Off** state still removes all AI affordances, and that state's exclusion list is unchanged.

The `AI needs attention` notice is a repair route for an enabled connection, not an AI setup/configure prompt; it does not reopen the Explicitly Deferred item “AI setup/configure prompts inside Compose,” and Compose still does not become a provider-troubleshooting surface (§T).

Unchanged by this amendment: Things to Remember Research remains fully useful without AI, and Phase 14 continues to consume a reliable AI-availability state from Phase 16 rather than computing it.

---

# A. Product Role

**[DECIDED]** Compose is an **AI-assisted drafting workspace with lightweight external delivery handoff**, not an in-app messaging client.

**[DECIDED]** Orbit does not own an inbox, conversation thread, message transport, delivery receipts, or messaging history in this phase.

**[DECIDED]** Compose's primary jobs are:
1. help the user write a message manually,
2. optionally help the user recall useful contact context,
3. optionally generate/rewrite message drafts with configured AI,
4. hand the finished composition to the appropriate external messaging application,
5. optionally confirm follow-through afterward so Orbit can log the interaction truthfully.

**[DECIDED]** The actual composition is visually and functionally primary. Reference/context material must not dominate the initial Compose viewport.

**[DERIVED]** Existing Compose implementation/plumbing should be refactored around this product identity rather than treating the current visual hierarchy as authoritative.

---

# B. Compose-First Screen Hierarchy

**[DECIDED]** Compose opens directly in the **composition side** of the workflow.

The working hierarchy is:
- contact identity/header,
- message editor,
- email subject when applicable,
- current message-mode affordance / ad-hoc switch,
- AI action when AI is actually available,
- compact Message Focus summary when present,
- entry into Things to Remember research,
- Copy,
- **Transmit**.

**[DECIDED]** The editor must remain immediately reachable without first scrolling through Conversation Fuel / remembered-information cards.

**[DECIDED]** Compose opens blank by default.

It does not automatically insert:
- a greeting,
- AI-generated prose,
- remembered context,
- conversation prompts.

**[DERIVED]** Manual composition remains fully functional regardless of AI state.

---

# C. Text / Email Composition Mode

**[DECIDED]** Initial Compose message modes are:
- **Text**
- **Email**

**[DECIDED]** Other messaging channels such as Facebook Messenger, WhatsApp, Signal, Instagram, and similar app-specific destinations are outside the initial product contract.

**[DECIDED]** Settings later owns a default-message-mode preference with:
- Text,
- Email,
- Remember Last Choice.

**[DECIDED]** Factory default is **Remember Last Choice**.

**[DECIDED]** Compose initializes silently from that preference rather than asking the user to choose a message type on every entry.

**[DECIDED]** The user can switch the current composition ad hoc from the Compose surface, using concise language such as:
- `Make this an email`
- `Make this a text`

**[DECIDED]** When `Remember Last Choice` is active, the remembered mode updates when the user meaningfully commits the current composition through **Transmit or Copy**, not merely when the temporary mode control is toggled.

**[DERIVED]** Phase 14 defines the runtime Compose behavior; Phase 15 Settings & Personalization owns the actual preference-management UI.

---

# D. Destination Resolution

**[DECIDED]** Text uses the contact's **primary phone number**.

**[DECIDED]** Email uses the contact's **primary email address**.

**[DECIDED]** If multiple viable destinations exist but no primary is established, Orbit asks the user which one to use.

**[DECIDED]** That deliberate selection becomes the contact's primary destination of that type and is reused afterward.

**[DECIDED]** If the preferred/default mode has no usable destination but the alternate supported mode does, Compose automatically falls back to the usable mode rather than opening in an impossible state.

**[DECIDED]** If neither Text nor Email has a usable destination, Compose remains usable as a drafting/Copy surface while Transmit is unavailable with an accessible explanation.

**[DERIVED]** Compose should consume the canonical contact-method / primary-contact-method model rather than invent a messaging-only destination store.

---

# E. Email Subject

**[DECIDED]** Email mode exposes a dedicated **Subject** field in addition to the message body.

**[DECIDED]** External email handoff should preserve recipient, subject, and body where the platform handoff supports them.

**[DECIDED]** The main **Copy** action copies the email body.

**[DECIDED]** Email Subject receives its own lightweight copy affordance.

**[DECIDED]** Orbit does not force `Subject: ...` into the copied body merely to collapse two email fields into one clipboard value.

---

# F. Primary Completion Action — Transmit

**[DECIDED]** The primary external-handoff action is labeled **Transmit**.

**[DECIDED]** `Transmit` means **hand the prepared composition to the appropriate external app**; it does not mean Orbit itself has delivered the message.

Expected product behavior:
- Text → hand off recipient + body to the platform's supported text/SMS compose surface.
- Email → hand off recipient + subject + body to the platform's supported email compose surface.

**[DECIDED]** Orbit does not claim a message was sent merely because the external composer was opened.

**[DERIVED]** Platform-specific handoff implementation should use supported OS/app APIs rather than brittle app-specific automation.

**[DEFERRED]** Direct private-message integrations for Facebook Messenger, WhatsApp, Signal, Instagram, and other third-party chat platforms.

---

# G. Post-Transmit Follow-Through Confirmation

**[DECIDED]** Orbit preserves the newly introduced follow-through concept but changes the target presentation from a janky notification into a compact Compose-attached confirmation after returning from a Transmit handoff.

Working interaction:

```text
Did you send it?

[ Yes, log interaction ]
[ Not yet ]
```

**[DECIDED]** `Yes, log interaction` records the completed outreach through Orbit's canonical ordinary **Message interaction** semantics and completes the Compose workflow.

**[DECIDED]** `Not yet` dismisses the confirmation and preserves the Compose session so the user can continue editing or try again.

**[DECIDED]** Copy does **not** trigger the `Did you send it?` confirmation.

**[DECIDED]** Opening the external app alone never creates the interaction.

**[DERIVED]** Exact resume/lifecycle detection is implementation/device behavior and should avoid fragile heuristics that prompt after unrelated app interruptions.

**[DERIVED]** Phase 14 should reuse the canonical Interaction write path rather than creating a separate messaging-history record type.

---

# H. Copy Behavior

**[DECIDED]** Copy remains a first-class completion utility beside Transmit.

**[DECIDED]** Copy does not end the Compose workflow.

**[DECIDED]** Copy provides only restrained success feedback, e.g.:
- `Message copied`
- `Subject copied`

**[DECIDED]** No confirmation dialog or Orbit clipboard-history subsystem is required.

**[DERIVED]** Restrained haptic feedback may accompany the copy success if consistent with the shared haptic language.

---

# I. Compose Session State

**[DECIDED]** Compose drafts are **session state**, not durable message records.

The current Compose session may retain:
- body text,
- email subject,
- Text/Email mode,
- selected/resolved destination,
- Message Focus selections,
- current workflow state needed to return from transient in-app navigation/backgrounding.

**[DECIDED]** Session state survives meaningful in-app navigation return and ordinary temporary app backgrounding where practical.

**[DECIDED]** Session state does **not** survive a fresh app relaunch as a durable saved draft.

**[DECIDED]** Phase 14 does not add a message-drafts database table or backup/restore contract.

**[DECIDED]** Completion behavior:
- Transmit → confirmed sent → log interaction, clear Compose session, complete back to the appropriate origin/Profile flow.
- Transmit → Not yet → preserve session and remain in Compose.
- Copy → preserve session and remain in Compose.

**[DECIDED]** Back/Cancel with no meaningful draft may leave directly.

**[DECIDED]** Back/Cancel with meaningful draft inherits the shell's existing:
- `Discard changes`
- `Keep editing`

focused-workflow contract.

---

# J. Things to Remember — Research Side

**[DECIDED]** The old Compose `Conversation Fuel` concept is replaced by a broader **Things to Remember** research experience.

**[DECIDED]** Things to Remember does **not** expand inline into the Compose editor page.

Instead, Compose and Things to Remember behave as **two sibling sides/modes of one focused workflow**:
- **Compose side** → writing, AI, Copy, Transmit.
- **Research side** → compact read-only remembered/contact context.

**[DECIDED]** Compose remains the initial/default side.

**[DECIDED]** Entry from Compose uses a clear Things to Remember affordance with a useful count, e.g. `Things to Remember · 14`.

**[DECIDED]** Research mode retains the same contact identity/header so the user remains oriented inside one workflow.

**[DERIVED]** This pattern intentionally prevents remembered context from consuming the initial composition viewport while still making deeper context one interaction away.

---

# K. Research Projection / Density

**[DECIDED]** Compose Research is a **specialized read-only projection** of the Contact Knowledge / Things to Remember model, not the entire Profile implementation transplanted into Compose.

**[DECIDED]** Only populated/useful groups appear.

**[DECIDED]** Research mode does not show empty-section prompts or data-completeness administration.

**[DECIDED]** Research mode does not expose general add/edit/admin actions.

**[DECIDED]** Presentation is compact and scannable rather than large card-heavy UI.

Useful content may include:
- pinned/high-value remembered items,
- Last Talked About,
- Key People / Relationships,
- Current Location where useful,
- relevant Memories,
- useful Custom Fields,
- Off Limits,
- other semantically conversation-relevant remembered/current knowledge.

**[DECIDED]** Compose Research should not treat mundane relationship/system metadata as writing inspiration merely because it exists in the contact model.

Examples generally excluded from the research projection:
- phone numbers,
- email addresses,
- Contact Frequency,
- Gravity,
- Orbit Status,
- Social Battery,
- other operational/relationship-health metadata that is not useful composition reference.

**[DERIVED]** Conversation/research suitability should eventually resolve from semantic field/type metadata rather than a permanently hardcoded Compose-only field list.

---

# L. AI Is Optional and Non-Intrusive

**[DECIDED]** AI is not a mandatory or constantly advertised part of Compose.

**[DECIDED]** Compose consumes the **three AI states** owned by **Phase 16 §F — AI Readiness / Needs Attention**, not a binary available/unavailable flag:

1. **AI Off** — the global AI master state is off. Compose shows **no AI affordances**.
2. **AI On + Ready** — a valid active connection plus a valid selected model/configuration exist. Compose exposes its normal AI actions.
3. **AI On + Needs Attention** — AI is enabled but the active connection/model is not currently usable (not yet configured, expired/invalid credential, unavailable model, or equivalent). Compose **replaces its normal AI actions with a restrained `AI needs attention` notice** that routes toward the relevant Phase 16 repair experience. AI must not silently disappear in this state.

**[DECIDED]** In the **AI Off** state, Compose/Research must not show:
- Draft with AI,
- Rewrite with AI,
- sparkle/setup nags,
- disabled AI cards,
- `Configure AI` CTAs,
- `Add to AI`,
- Message Focus,
- other AI-specific empty-state language.

**[DECIDED]** In the **AI On + Needs Attention** state, the restrained repair notice is the only AI-specific element Compose shows. It does not restore Draft with AI, Rewrite with AI, `Add to AI`, or Message Focus, and it is a repair route rather than a setup/marketing nag.

**[DECIDED]** Things to Remember Research remains fully useful as a **human memory aid** even when AI is absent.

**[DERIVED]** Phase 16 owns AI setup/discovery/configuration and the definition of these three states. Phase 14 merely consumes a reliable AI-availability state from Phase 16.

---

# M. AI Privacy Boundary

**[DECIDED]** Phase 3 Contact Knowledge AI privacy remains authoritative.

Only information already permitted for AI through the established global + per-information permission model may be transmitted to AI.

**[DECIDED]** Phase 14 does **not** ask the user to review/authorize the entire AI context payload on every Draft or Rewrite request.

**[DECIDED]** AI context is drawn from the preconfigured/preauthorized pool.

**[DECIDED]** If the user is dissatisfied with what AI may use, ordinary permission/configuration management happens through the canonical contact/edit and later Phase 16 AI-management surfaces rather than through repeated Compose authorization dialogs.

**[DECIDED]** Locally visible Research content is not restricted merely because an item's AI permission is OFF. AI permission controls transmission to AI, not the user's ability to see their own local contact knowledge.

---

# N. Off Limits in Compose Research and AI

**[DECIDED]** Off Limits remains semantically **topics to avoid bringing up**.

**[DECIDED]** Off Limits may be visible to the human in Research mode using a clearly differentiated presentation such as an `Avoid` group.

**[DECIDED]** If an Off Limits item is AI-authorized, AI receives it automatically as an **avoidance constraint**, not as positive conversation fuel.

**[DECIDED]** Off Limits items can never be selected as Message Focus / `Add to AI` because centering the message on an avoid-topic would contradict their meaning.

---

# O. Message Focus / Add to AI

**[DECIDED]** Compose Research supports a lightweight, session-only way to steer an AI request toward specific remembered context.

**[DECIDED]** Eligible items expose the concise action **`Add to AI`**.

**[DECIDED]** Selected state reads **`Added ✓`** and may receive a restrained selected highlight.

**[DECIDED]** Tapping the selected state again removes the item from the current Message Focus.

**[DECIDED]** The resulting Compose-side summary is called **Message Focus**.

Example:

`Message focus · 2`

with compact selected-item chips/rows beneath.

**[DECIDED]** Empty Message Focus is not shown.

**[DECIDED]** Up to **three** items may be selected as Message Focus in one Compose session.

**[DECIDED]** Phase 14 does not expose weights, ordering, percentages, primary/secondary importance, or other prompt-engineering controls.

**[DECIDED]** `Add to AI` is **not itself an AI-permission grant**.

Only information already AI-authorized may expose `Add to AI`.

**[DECIDED]** AI-ineligible Research items remain visible to the user but do not expose `Add to AI`.

**[DECIDED]** Message Focus selections persist for the rest of the Compose session until explicitly removed or the session ends.

**[DERIVED]** Phase 16 owns the exact prompt/context mechanics used to emphasize Message Focus items.

---

# P. Intentional AI Invocation

**[DECIDED]** AI never writes automatically merely because Compose opens.

**[DECIDED]** AI uses one adaptive primary action rather than permanently showing separate Draft and Rewrite buttons.

Behavior:
- editor empty → **Draft with AI**
- editor contains meaningful text → **Rewrite with AI**

**[DECIDED]** Draft with AI does **not** require Message Focus.

Without explicit Message Focus, AI uses the ordinary preauthorized context pool according to the later prompting/configuration contract.

**[DECIDED]** Rewrite with AI treats the user's existing message as the primary semantic content and should preserve its core intent rather than replacing it with an unrelated conversation starter.

**[DECIDED]** Message Focus may additionally steer Draft or Rewrite toward explicitly selected topics.

---

# Q. Three-Suggestion AI Contract

**[DECIDED]** A normal AI Draft or Rewrite request returns **three suggestions**.

**[DECIDED]** Three alternatives are the standard behavior rather than requiring a second `Give me options` request.

**[DECIDED]** Draft alternatives should meaningfully vary their approach/topic/tone where the available context supports useful variation rather than merely paraphrasing one sentence three times.

**[DECIDED]** AI suggestions do not need separate generated labels such as `Warm check-in` or `Workout angle`.

**[DERIVED]** Exact prompt instructions used to obtain useful variation belong to Phase 16 AI Configuration & Prompting.

---

# R. Unified AI Review Surface

**[DECIDED]** AI generation opens one reusable comparison/review surface rather than directly overwriting the editor.

For an empty editor, the review surface presents the three generated alternatives and a **Choose this** action for each.

For Rewrite, the review surface also shows the current/original text so the user can compare before and after.

**[DECIDED]** Review is **comparison-only**, not a multi-editor surface.

**[DECIDED]** The user edits a generated result only after choosing it and returning it to the main Compose editor.

**[DECIDED]** The original editor contents remain untouched until the user explicitly chooses a generated option.

**[DECIDED]** Choosing an option returns to Compose with that option loaded into the editor.

**[DECIDED]** Rewrite review preserves a clear path to keep the original text.

---

# S. Try Again / Adjustment Boundary

**[DECIDED]** AI review exposes **Try Again**.

**[DECIDED]** Try Again requests **three new suggestions using the same current context/intent**.

**[DECIDED]** The new set replaces the prior three; Phase 14 does not build an AI-generation history stack/carousel.

**[DEFERRED]** `Adjust` / one-off instructions such as:
- make it warmer,
- shorter,
- more casual,
- mention a particular angle,
- other user-authored prompt adjustments.

These controls are explicitly owned by **Phase 16 — AI Configuration & Prompting**.

**[DEFERRED]** Broader user-configurable prompt personalization and generation controls.

---

# T. AI Loading / Cancellation / Failure

**[DECIDED]** AI generation never destructively alters the current Compose editor while a request is pending.

**[DECIDED]** The generation/review workflow is cancellable.

**[DECIDED]** Cancelling returns to the unchanged Compose state.

**[DECIDED]** AI failure remains confined to the explicitly invoked AI workflow and never blocks manual composition.

**[DECIDED]** On generation failure, preserve the user's current/manual draft and provide concise recovery such as:
- Try Again,
- Cancel.

**[DECIDED]** Compose should not become a provider-troubleshooting surface.

**[DERIVED]** Provider/key/configuration details belong to Phase 16.

**[DERIVED]** A skeleton/placeholder treatment for the three pending suggestions is a reasonable initial implementation direction, but exact loading presentation remains device/usability tuning rather than a product invariant.

---

# U. AI Context / Channel-Aware Prompting Boundary

**[DECIDED]** Phase 14 does **not** prematurely construct a new AI context/prompt system merely to make Text versus Email generation channel-aware.

**[DECIDED]** Text/Email remains real Compose state in Phase 14 for composition and external handoff.

**[DEFERRED]** Exact incorporation of message mode, personalized context weighting, provider-specific prompting, and other generation-context construction belongs to Phase 16.

**[DERIVED]** Phase 14 should preserve a clean seam so Phase 16 can consume Compose intent/state later without redesigning the Compose UI.

---

# V. Random Thought — Deferred Concept

**[DEFERRED]** A future **Random Thought** inspiration feature may draw a random useful item from the broader Things to Remember catalogue to prompt the user to write their own message.

Product intent:
- human inspiration rather than automatic AI generation,
- surface forgotten/small details without flooding Compose,
- potentially trigger genuine outreach from information the user would not otherwise have remembered.

**[DEFERRED]** Exact eligibility, repetition avoidance, weighting, and presentation.

**[DERIVED]** Research architecture should not make this future feature unnecessarily difficult, but Phase 14 should not add speculative persistence/services solely for it.

---

# W. Routing / Entry / Completion

**[DECIDED]** Profile's existing **Message** action remains a primary canonical entry into Compose.

**[DECIDED]** Compose should remain independently routable/deep-link-ready where the shell architecture supports targeted messaging actions.

**[DECIDED]** Compose consumes known contact context when launched pre-targeted rather than introducing another contact-editing workflow.

**[DECIDED]** Successful confirmed send/log completion returns through the appropriate origin-aware flow, normally back toward the contact Profile when launched there.

**[DERIVED]** Completed Compose should not remain in Back history in a way that resurrects a finished draft workflow.

---

# X. Keyboard & Accessibility

**[DERIVED]** Compose inherits focused-workflow shell behavior for keyboard-aware layout, safe areas, and unsaved-change protection.

**[DERIVED]** The message editor, Subject, mode switch, Things to Remember entry, AI action, Message Focus removal, Copy, and Transmit require accessible names/states and logical focus order.

**[DERIVED]** Research mode must remain usable without relying on color to distinguish `Add to AI` / `Added ✓` or Off Limits.

**[DERIVED]** AI review should expose suggestion boundaries and `Choose this` actions clearly to assistive technology without forcing the user through duplicated verbose context.

**[DERIVED]** Large text/reflow may increase vertical usage; the product requirement is that the editor and completion actions remain reachable rather than preserving a fixed screenshot geometry.

**[DERIVED]** Final cross-device, landscape, screen-reader, large-text, and performance auditing remains Phase 18 responsibility.

---

# Y. Existing-Implementation Reuse / Architecture

**[DERIVED]** Phase 14 is not greenfield and should preserve compatible proven plumbing where it already satisfies the new product contract.

Likely reusable concerns include:
- existing Compose routing/contact targeting,
- SMS/external handoff infrastructure,
- clipboard handling,
- existing AI provider service abstraction,
- cancellation/stale-response safeguards,
- secure credential consumption,
- privacy-bounded Contact Knowledge AI context access.

**[DERIVED]** Existing visual hierarchy and existing Conversation Fuel presentation are **not** authoritative where they conflict with this dossier.

**[DERIVED]** Separate the following concerns so later Phase 16 work does not require a Compose rewrite:
1. Compose/editor/session state,
2. Research/Things to Remember projection,
3. Message Focus selection state,
4. AI-availability capability,
5. AI generation intent + review contract,
6. later prompt/context/provider configuration,
7. external Transmit adapters.

---

# Z. Cross-Phase Constraints

- **App Shell & Navigation:** Compose is a focused workflow; use canonical Back/Cancel, keyboard, safe-area, deep-link, and unsaved-change behavior. Completion must not leave stale finished Compose routes behind.
- **Theme & Visual System:** Compose/Research/AI Review use semantic tokens/components. The composition editor remains visually primary; do not reintroduce oversized card stacks that bury it.
- **Contact Knowledge Foundation:** authoritative for Things to Remember semantics, AI permission, structured knowledge, and Off Limits = avoid-topic. Local visibility is distinct from AI transmission permission.
- **Profile Experience:** Profile owns the Message entry and contact identity/read experience; Compose does not become another Profile or contact-admin surface.
- **Interaction History & Insights / Rapid Capture:** confirmed outreach logs through canonical ordinary Interaction semantics. Compose does not invent a parallel messaging-history model.
- **Rapid Capture & Update Flows:** canonical user-facing interaction Channel remains `Message`; Compose's Text/Email mode does not redefine the interaction taxonomy.
- **Settings & Personalization:** owns the Text / Email / Remember Last Choice default preference UI. Factory default is Remember Last Choice.
- **AI Configuration & Prompting:** owns provider/model/key administration, AI setup/discovery, central permission management, prompt personalization, Adjust controls, exact context construction, channel-aware prompt treatment, provider-specific prompting, and advanced weighting.
- **Onboarding:** may explain messaging/AI capabilities if useful but must respect AI's optional/nonintrusive posture.
- **Responsive & Release Hardening:** owns final device QA, loading presentation tuning, lifecycle/resume reliability, landscape/large-text polish, and accessibility/performance audit.

---

# Explicitly Deferred

- in-app messaging/inbox/thread ownership
- delivery receipts or actual transport confirmation from Orbit itself
- third-party Facebook Messenger / WhatsApp / Signal / Instagram private-message integrations
- arbitrary external chat-app adapters without a supported platform contract
- durable per-contact message drafts
- message-draft backup/restore or future sync
- AI setup/configure prompts inside Compose
- per-generation full context authorization/review screens
- AI-generated suggestion labels
- AI-generation history stack
- freeform `Adjust` / one-off generation instruction controls
- prompt personalization
- provider/model/API-key management
- exact provider-specific prompt payloads
- exact Text-vs-Email AI generation treatment
- advanced Message Focus weighting/ordering
- Random Thought
- exact loading animation/skeleton styling
- final device-specific external-app lifecycle heuristics

---

# Phase Success Criteria

Phase 14 is successful when:

1. Compose is a clean drafting workspace rather than an in-app messaging client, with the editor immediately available and remembered context no longer burying the core controls.
2. Text and Email composition use a Settings-driven default with Remember Last Choice as factory default plus a lightweight per-session override.
3. Text resolves the primary phone and Email resolves the primary email; missing-primary selection can establish the canonical primary destination.
4. Email supports Subject + Body, with Transmit preserving both and Copy keeping body/subject copy behavior clear.
5. **Transmit** truthfully hands the composition to an external app without claiming delivery.
6. Returning from Transmit can ask `Did you send it?`; only explicit confirmation creates the canonical Message interaction, while `Not yet` preserves the Compose session.
7. Compose session state is preserved appropriately in-session but does not become a durable draft/backup data model.
8. Things to Remember opens as a separate compact Research side of the Compose workflow and shows useful populated conversation-relevant knowledge without becoming Profile/Edit Contact.
9. Compose honors the three Phase 16 AI states: **AI Off** removes every AI affordance from Compose/Research; **AI On + Ready** exposes the normal AI actions; **AI On + Needs Attention** shows a restrained `AI needs attention` repair notice in place of the AI actions rather than letting AI silently vanish. Manual Compose and Things to Remember Research remain fully useful in every state.
10. AI consumes only preauthorized Contact Knowledge; Phase 14 does not require repetitive payload authorization screens.
11. Off Limits remains visible as human avoidance context and is passed to AI as an avoidance constraint when authorized, never as Message Focus.
12. Up to three AI-authorized research items can be selected with `Add to AI` / `Added ✓` and carried as session-only Message Focus.
13. AI invocation is intentional and adaptive: empty editor → Draft with AI; populated editor → Rewrite with AI.
14. Each AI request returns three alternatives through a non-destructive comparison surface; choosing one explicitly moves it into the main editor.
15. Try Again replaces the current three with three fresh suggestions; prompt adjustment/fine-tuning remains Phase 16 scope.
16. AI cancellation/error never destroys or blocks manual drafting and does not turn Compose into a provider-troubleshooting screen.
17. Compose remains compatible with origin-aware navigation, deep-link-ready routing, keyboard behavior, accessibility, and later Phase 16 prompting/context evolution.

---

# Notes for GSD / Roadmapper

- Treat Phase 14 primarily as a **Compose UX/refactor and integration phase**, not a new messaging backend or new AI-provider subsystem.
- Preserve proven existing handoff/AI/privacy plumbing where compatible, but replace the current Conversation Fuel-first layout where it conflicts with this dossier.
- Do not pull provider/model/key management or prompt-personalization work forward from Phase 16.
- Do not create a durable drafts domain solely because session state exists.
- Do not reinterpret `Add to AI` as an AI-permission grant; it is temporary emphasis over already-authorized information.
- Do not put per-request context authorization in the happy path.
- Keep Research useful when AI is absent; AI is optional enhancement, not Compose's prerequisite.
- Keep the interaction taxonomy canonical: Text/Email are Compose/handoff modes while confirmed outreach logs as ordinary `Message` interaction semantics.
- Treat exact loading visuals and external-app resume detection as implementation/device-test tuning unless they materially violate the observable contracts above.
- Preserve a clean seam into Phase 16 so exact prompt/context construction, channel-aware AI behavior, Adjust controls, and provider configuration can evolve without rebuilding Compose.
