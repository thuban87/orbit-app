# Dossier — AI Configuration & Prompting

**Status:** complete · Interrogated through 2026-09-01 · AI connection architecture, model selection, personalization, prompt assembly, privacy management, transparency, generation adjustment, lifecycle, and diagnostic seams settled.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope

This dossier defines Orbit's release-quality **AI Configuration & Prompting** subsystem consumed by Messaging & AI Compose and the Contact Knowledge privacy model.

It covers:
- global AI enablement,
- the three-lane AI connection architecture,
- OpenRouter connection and model-selection experience,
- direct-provider BYOK configuration,
- OpenAI-compatible Custom Endpoint configuration,
- one-active-connection semantics,
- credential/configuration persistence and switching,
- model catalogs, recommendation and pricing presentation,
- model unavailability and refresh behavior,
- Orbit-owned prompt architecture,
- structured writing preferences,
- arbitrary global personalization/context sections,
- paste and `.txt` / `.md` import,
- prompt/context estimation,
- Adjust behavior,
- semantic Contact Knowledge context assembly,
- Message Focus weighting,
- recent Interaction context,
- Off Limits handling,
- central AI permission management,
- whole-system and contact-specific transparency/review surfaces,
- AI readiness and repair behavior,
- human-readable generation failures,
- sanitized diagnostics/telemetry seams,
- backup/restore boundaries.

It intentionally does **not** redefine Compose layout, Text/Email delivery behavior, Contact Knowledge storage semantics, ordinary interaction logging, onboarding, general Settings information architecture, a hosted Orbit AI backend, AI subscription/credit monetization, arbitrary HTTP API construction, local/LAN model hosting, or final app-wide Sentry/release-hardening implementation.

---

# Amendment — audit resolutions 2026-09-01

**E-05 — ratified AI egress plus the per-interaction gate.** The owner ratified the widened AI egress in §Y (AI-enabled Off Limits sent as avoidance constraints); **ADR-050 and ADR-036 are superseded 2026-09-01** by ADR-078. The same decision closes the gate that was missing on interaction notes: a note is transmitted only when that interaction's **Allow AI** toggle is ON (§Z), the toggle is authored in Phase 13 §N and defaults OFF, and this dossier's permission manager covers interaction notes as an information type with a default-OFF, new-items-only type default plus review/withdrawal (§AB). **Group Notes are never transmitted to AI** (Phase 12 §H).

**E-06 — first-use AI disclosure.** The owner ratified §AG's lightweight disclosure with full prompt/context review available **on demand**, together with Phase 10 §C's removal of the Profile AI-draft entry (AI is reached via Message → Draft with AI, two taps). **ADR-052's exact-prompt first-send acknowledgement is superseded 2026-09-01 by ADR-079.** No other §AG behavior changes: the disclosure still names the active connection's real data path.

---

# A. Product Role

**[DECIDED]** AI is an optional capability layer within Orbit rather than a mandatory product dependency.

**[DECIDED]** Orbit owns one coherent AI configuration and prompting subsystem that supplies a reliable `AI available / unavailable / needs attention` capability to consuming experiences such as Compose.

**[DECIDED]** The AI subsystem should remain **connection-agnostic above the connection layer**.

Compose, prompt assembly, privacy filtering, Message Focus, Adjust, output parsing, and user-facing error handling must not care whether inference is currently reached through OpenRouter, a direct provider connection, or a compatible custom endpoint.

**[DECIDED]** AI should generally be **set and forget**. Provider/connection switching is an occasional Settings action rather than a per-generation decision.

---

# B. Global AI Master State

**[DECIDED]** Orbit exposes a real global **AI Enabled** master toggle.

**[DECIDED]** Turning AI OFF:
- disables AI generation throughout Orbit,
- causes Compose to remove AI generation affordances,
- preserves the active connection selection,
- preserves all saved credentials/configuration,
- preserves model selections,
- preserves Writing Style and Personalization Context,
- preserves all per-information AI permissions.

**[DECIDED]** Turning AI back ON restores the prior configuration immediately when the active connection/model remains valid.

**[DECIDED]** When AI is OFF, the normal AI configuration surface is visually simplified rather than leaving the full configuration hierarchy expanded.

The ordinary off-state should show:
- AI Enabled = Off,
- concise explanation that configuration and permissions are preserved,
- a small indication that saved configuration remains available.

**[DECIDED]** An **escape hatch to manage/remove saved connections/credentials remains accessible even while AI is OFF**.

This allows credential removal without requiring the user to reactivate AI first.

**[DERIVED]** `AI off` and `AI misconfigured` are distinct states.

---

# C. Three-Lane AI Connection Architecture

**[DECIDED]** Orbit supports three connection lanes.

## Lane 1 — Direct Provider / BYOK

Advanced setup supporting the existing direct-provider architecture:
- OpenAI,
- Anthropic,
- Google Gemini.

Users provide their own provider API credentials, which remain stored securely on-device using the existing secure credential-storage foundation rather than ordinary SQLite preference storage or backups.

## Lane 2 — OpenRouter

**[DECIDED]** OpenRouter is Orbit's **recommended / promoted connection path**.

It should receive slightly stronger product prominence than the advanced alternatives because it offers:
- browser-based connection rather than manual vendor-key entry,
- one connection across multiple model providers,
- a unified current model catalog,
- current price metadata,
- simple switching among supported provider/model families.

OpenRouter is recommended, not mandatory.

## Lane 3 — Custom Endpoint

**[DECIDED]** Custom Endpoint remains an **Advanced** connection path.

For this milestone it supports a cleaned-up, explicitly documented **OpenAI-compatible HTTPS endpoint/reverse-proxy contract**.

It is intended for advanced users connecting Orbit to an endpoint, gateway, or reverse proxy they control or trust.

**[DEFERRED]** Truly arbitrary HTTP API construction with configurable methods, headers, request templates, response extraction paths, and similar generic API-client behavior.

**[DEFERRED]** Local/LAN/private-network AI endpoint support. Existing private-address / SSRF safeguards are not casually removed in this milestone.

---

# D. Connection Selection & Presentation

**[DECIDED]** Exactly **one AI connection is active at a time**.

Orbit does not dynamically select among multiple configured connections for individual calls.

**[DECIDED]** Multiple credentials/configurations may remain stored for later reuse.

Examples:
- OpenRouter configured but inactive,
- direct Anthropic key saved,
- direct OpenAI key saved,
- Gemini not configured,
- Custom Endpoint saved.

Only one connection supplies current inference.

**[DECIDED]** Connection choice should use a mobile-friendly **selectable card/row presentation with expandable setup/status**, not a dense wall of literal radio buttons and credential forms.

Working hierarchy:

### Recommended
- Connect with OpenRouter

### Advanced Setup
- Connect directly to a provider
  - OpenAI
  - Anthropic
  - Gemini
- Custom Endpoint

**[DERIVED]** Mutual exclusivity is still radio-button-like state even if the visual treatment is richer than literal radio controls.

---

# E. Safe Connection Switching

**[DECIDED]** Selecting an unconfigured lane begins that lane's setup without immediately replacing the currently working connection.

The new connection becomes active only after its setup succeeds.

If setup is canceled or fails, the existing working connection remains active.

**[DECIDED]** Switching to an already-configured valid connection is intentionally lightweight.

Orbit restores that connection's remembered model and makes it active without requiring a full setup ceremony every time.

**[DECIDED]** Switching connections never deletes credentials or configuration from inactive connections.

**[DECIDED]** Deliberate removal is separate from switching.

Examples:
- `Disconnect OpenRouter` removes the OpenRouter credential only.
- `Remove Anthropic key` removes the stored Anthropic credential only.
- selecting OpenRouter while Anthropic is active leaves Anthropic configured but inactive.

---

# F. AI Readiness / Needs Attention

**[DECIDED]** AI readiness is not equivalent to merely having AI Enabled = ON.

A usable AI state requires a valid active connection plus a valid selected model/configuration.

**[DECIDED]** If the active connection credential expires, becomes invalid, or otherwise stops working:
- AI Enabled remains ON,
- configuration is preserved,
- active AI state becomes **Needs attention**,
- Orbit does not silently activate another saved connection.

**[DECIDED]** If AI is ON but Needs Attention, Compose should **replace normal AI-generation actions with a restrained `AI needs attention` notice/affordance** rather than simply making AI disappear.

The notice should route toward the relevant repair experience.

This prevents confusion between:
- deliberately disabled AI, and
- enabled AI that currently requires repair.

**[DECIDED]** Appropriate repair actions include, depending on cause:
- Reconnect,
- Replace key,
- Choose another model,
- Change AI connection.

---

# G. OpenRouter Connection

**[DECIDED]** OpenRouter setup is Orbit's recommended consumer-friendly AI connection path.

**[DECIDED]** Setup should use OpenRouter's supported browser authorization/connection flow rather than requiring the user to manually create and paste an OpenRouter API key into Orbit.

**[DECIDED]** Successful OpenRouter reauthorization replaces/refreshes credential state while preserving:
- selected model,
- model browsing/preferences,
- Writing Style,
- Personalization Context,
- Contact Knowledge AI permissions,
- other noncredential AI configuration.

**[DERIVED]** OpenRouter credentials remain credential material and are excluded from ordinary Orbit backup/restore.

---

# H. Direct Provider / BYOK

**[DECIDED]** Existing branded direct-provider support remains an Advanced feature for:
- OpenAI,
- Anthropic,
- Google Gemini.

**[DECIDED]** Multiple provider credentials may remain stored independently so switching back to a previously configured provider does not require re-entry.

**[DECIDED]** Only one direct provider can be the active connection at a time, and only one connection lane can be active globally.

**[DECIDED]** Direct-provider setup retains the existing powerful model-selection philosophy where compatible:
- curated/recommended choices,
- broader provider model catalog/discovery,
- manual model-ID escape hatch under Advanced.

**[DERIVED]** Preserve useful existing provider-adapter and secure-key infrastructure where compatible with these product contracts rather than replacing it solely because OpenRouter is now recommended.

---

# I. Custom Endpoint

**[DECIDED]** Custom Endpoint is presented as an Advanced power-user capability rather than a normal onboarding path.

**[DECIDED]** Initial Custom Endpoint contract is explicitly **OpenAI-compatible HTTPS**, reflecting and cleaning up the effective contract already present in the codebase.

The product should not imply that an arbitrary HTTP AI API will work merely because a URL can be entered.

**[DECIDED]** Custom Endpoint may support configuration such as:
- endpoint/base URL,
- optional API credential,
- model identifier,
- model discovery where the compatible endpoint supports it.

**[DECIDED]** Responsibility/security language should make clear that the user is choosing an endpoint they control or trust.

**[DEFERRED]** Generic arbitrary-HTTP endpoint construction.

**[DEFERRED]** Removing existing private-network protections merely to support LAN/self-hosted AI.

---

# J. Connection-Specific Model Memory

**[DECIDED]** Each saved connection remembers its own last selected model.

Example:
- OpenRouter → GPT-5.6 Terra,
- Direct Anthropic → Claude Opus,
- Direct Gemini → Gemini Flash,
- Custom → user-entered model identifier.

Switching back to a previously configured connection restores its model selection.

**[DERIVED]** Connection identity and selected model identity must be modeled separately.

This is especially important for OpenRouter, where:
- connection provider = OpenRouter,
- inference model/provider family may = OpenAI, Anthropic, Google, etc.

---

# K. OpenRouter Model Picker

**[DECIDED]** Orbit owns the model-selection UI. OpenRouter is infrastructure/catalog/authentication, not an embedded model-picker UI inside Orbit.

**[DECIDED]** OpenRouter model selection is **curated-first, catalog-second**.

The primary picker exposes a small Orbit-curated set appropriate to relationship-aware message drafting.

A secondary **Browse all models** path exposes the broader OpenRouter model catalog with search/browsing.

**[DECIDED]** Orbit should bias recommendations toward models that are strong enough for nuanced drafting without unnecessarily steering users toward expensive frontier/reasoning-heavy models.

**[DECIDED] Initial recommendation direction at dossier completion:**
1. **GPT-5.6 Terra** — primary balanced recommendation.
2. **Gemini Flash** — cost-efficiency recommendation.
3. **Claude Haiku** — lightweight / lower-effort-capable recommendation.

These are initial catalog recommendations, not permanent immutable requirements.

**[DERIVED]** Recommendation labels should explain the practical reason for each choice rather than claim an eternal objective ranking.

Examples:
- Balanced,
- Cost efficient,
- Lightweight / simple & capable.

**[DERIVED]** Orbit's recommendation mapping must be updateable as models change over time.

---

# L. OpenRouter Model Information & Pricing

**[DECIDED]** OpenRouter model cards/details may expose useful concise metadata such as:
- display/model name,
- underlying provider,
- Orbit-oriented recommendation/description,
- current detailed input/output pricing,
- deeper context-window and technical metadata under More Info where useful.

**[DECIDED]** Do **not** replace real pricing with vague `$ / $$ / $$$` indicators when current OpenRouter pricing metadata is available.

**[DECIDED]** Pricing displayed for OpenRouter models must be sourced from current/cached OpenRouter metadata rather than hardcoded into Orbit's product logic.

**[DERIVED]** Exact prices are runtime/catalog data and must not become fixed requirements in this dossier or GSD roadmap.

---

# M. Model Catalog & Price Refresh

**[DECIDED]** Model availability does not need minute-by-minute freshness.

**[DECIDED]** OpenRouter/provider model catalog refresh should be conservative and cache-friendly.

Product direction:
- retain bundled/cached model data for fast/offline Settings rendering,
- automatically refresh the relevant catalog roughly on the first appropriate AI/model-settings open of a new local day,
- expose an explicit **Refresh Models** action,
- retain cached data when refresh fails,
- show an `Updated ...` freshness indicator where helpful.

**[DECIDED]** Pricing freshness is treated somewhat separately because it directly informs displayed cost estimates.

When Orbit is about to show/recalculate an OpenRouter cost estimate, it may refresh selected-model pricing if the cached price is materially stale without requiring a full catalog refresh.

**[DERIVED]** Exact price-cache TTL is implementation tuning; do not encode a literal hourly value as a product requirement.

**[DECIDED]** Orbit should not hit OpenRouter on every personalization keystroke solely to refresh pricing.

Local token/context estimates can recalculate continuously while price metadata is reused until its refresh policy says otherwise.

---

# N. Model Unavailability

**[DECIDED]** Orbit never silently substitutes another model when the user's selected model disappears or becomes unavailable.

**[DECIDED]** The selected model is marked unavailable and the user receives explicit guidance such as:

> **This model is no longer available. Please choose another model.**

**[DECIDED]** AI remains Needs Attention until the user selects a usable model.

**[DECIDED]** No automatic provider/model fallback occurs during generation.

If the active model or connection fails, Orbit does not silently use:
- another OpenRouter model,
- another configured direct-provider key,
- another connection lane.

---

# O. Prompt Architecture

**[DECIDED]** Orbit owns the immutable functional/system prompt contract.

Normal users do not replace the entire system prompt.

**[DECIDED]** Final prompt assembly conceptually separates:
1. Orbit-owned immutable system/output instructions,
2. user Writing Style/preferences,
3. global user Personalization Context,
4. permitted contact-specific context,
5. recent Interaction context,
6. Off Limits constraints,
7. Message Focus emphasis,
8. temporary Adjust instruction,
9. current draft/reference text where applicable,
10. output contract.

**[DECIDED]** User-authored personalization is subordinate reference/instruction content and must not be able to replace Orbit's privacy, output, or system-level behavioral contract merely through section text.

**[DERIVED]** Existing legacy prompt language around older concepts such as `Conversation Fuel` or pre-Tone terminology should be reconciled with the newer Contact Knowledge and Compose contracts rather than treated as authoritative.

---

# P. Writing Style — Basic Personalization

**[DECIDED]** Normal users should receive human-oriented Writing Style controls rather than being required to edit a raw prompt template.

Initial structured direction includes controls such as:
- Tone — e.g. Casual / Balanced / Polished,
- Length — e.g. Concise / Normal / Detailed,
- Directness — e.g. Gentle / Balanced / Direct,
- freeform custom writing guidance.

Exact final labels/options may be tuned during implementation as long as the concept remains small and understandable.

**[DECIDED]** Structured preferences should support a **Use prompt / custom guidance instead** option where appropriate.

This allows a power user to disable a canned dimension and rely on their freeform/custom personalization material instead.

**[DECIDED]** The normal freeform field is intended for instructions such as:
- preferred tone habits,
- punctuation/style dislikes,
- formality preferences,
- habitual phrasing guidance,
- other self-authored communication instructions.

---

# Q. Personalization Context — Arbitrary Global Sections

**[DECIDED]** Orbit supports arbitrary user-created global AI personalization/context sections.

Each section contains at least:
- user-defined title,
- long-form body text,
- enabled/disabled state,
- display/order position.

Possible user-created examples include:
- Personal Profile,
- Communication Style,
- Relationship Philosophy,
- Things AI Gets Wrong About Me,
- other user-defined contextual documents.

**[DECIDED]** Section titles may be used as semantic headings during prompt assembly.

**[DECIDED]** Section ordering is primarily organizational/predictability state and does **not** secretly alter semantic weighting.

**[DECIDED]** These sections are global user context.

Orbit does **not** create a second per-contact knowledge system inside AI Settings.

Contact-specific knowledge continues to belong to Contact Knowledge.

**[DECIDED]** A global personalization document may still mention specific people if the user chooses; the important boundary is that it is sent globally while enabled and is not a hidden per-contact record store.

---

# R. Personalization Paste & File Import

**[DECIDED]** Pasting text is the preferred/fundamental power-user path for large personalization content.

**[DECIDED]** Phase 16 also supports importing text-oriented personalization documents in:
- `.txt`,
- `.md` / Markdown.

**[DECIDED]** Imported content is copied into Orbit's own local personalization record.

Orbit does not maintain a live link/watch relationship to the original file.

Therefore:
- source-file movement/deletion does not break Orbit,
- the imported copy is editable inside Orbit,
- normal backup/restore can preserve the imported text.

**[DECIDED]** Imported/pasted sections support simple management:
- rename,
- edit,
- enable/disable,
- reorder,
- delete,
- replace by re-importing where desired.

**[DEFERRED]** DOCX/PDF parsing.

**[DEFERRED]** Rich-text editing, nested folders, attachments, document version history, or automatic live file synchronization.

---

# S. No Writing-Sample Training System

**[DECIDED]** Orbit does not build a dedicated writing-sample ingestion/training/style-analysis subsystem in this milestone.

Users may gather and author their own profile/style material and place it into the provided personalization fields/sections.

Orbit supplies the space and prompt integration; it does not automatically derive a personal writing model from a corpus of the user's messages.

---

# T. Personalization Enablement Semantics

**[DECIDED]** Global Personalization Context sections do not need a second separate AI-permission flag in addition to enabled/disabled state.

Their purpose is AI prompting.

Therefore:
- Enabled = stored and included in AI prompting.
- Disabled = stored locally but not sent.

This is distinct from Contact Knowledge, whose per-item AI permissions remain explicit privacy gates because those records exist primarily for broader Orbit use rather than AI prompting.

---

# U. Context Size Philosophy

**[DECIDED]** Orbit does **not** impose an arbitrary smaller product-level context ceiling merely to control cost or latency.

If the user has enabled a large amount of global and contact context, Orbit does not silently truncate/discard it simply because Orbit prefers a shorter prompt.

**[DECIDED]** The actual selected model's context window is the real hard capacity constraint.

**[DECIDED]** If the assembled request exceeds the selected model's capacity, Orbit tells the user explicitly and requires a deliberate resolution such as:
- reducing/turning off some context,
- changing personalization,
- selecting a larger-context model.

**[DECIDED]** Orbit does not silently discard context to make the request fit.

**[DERIVED]** Prompt assembly may still maintain deterministic semantic section ordering/priority so the prompt remains understandable and so future user-controlled reduction tools have a stable basis.

---

# V. Context Usage & Estimated Input Cost

**[DECIDED]** Personalization Context surfaces estimated context size/token usage.

**[DECIDED]** For OpenRouter, Orbit also displays an **estimated input cost per generation** using the selected model's current/cached OpenRouter price metadata.

Example direction:

```text
Estimated context
~12,480 tokens
~$0.025 input cost with GPT-5.6 Terra
```

**[DECIDED]** Only input-cost estimation is required.

Orbit does not need to fabricate a typical output-cost estimate simply for completeness.

**[DECIDED]** Context/token estimates recalculate naturally after meaningful personalization changes with reasonable debouncing.

**[DECIDED]** Direct-provider / Custom connections need not show a monetary estimate when Orbit lacks a trustworthy current price source.

In those cases Orbit may show token/context size with:

`Cost estimate unavailable for this connection.`

**[DERIVED]** Do not build/maintain a separate Orbit provider-pricing database solely to make this feature universal.

---

# W. Contact Context Eligibility

**[DECIDED]** Contact Knowledge AI permission means the information is **eligible and included as contact context for AI generation for that contact**.

The user does not need to manually re-add every permitted item to Message Focus on every generation.

**[DECIDED]** Permission remains the privacy gate established by Contact Knowledge.

Only information permitted through the global AI state plus the field/item permission model may leave the device for AI use.

**[DECIDED]** Orbit should preserve semantic type meaning during prompt construction rather than flattening everything into undifferentiated text.

---

# X. Message Focus

**[DECIDED]** Message Focus means:

> Make this permitted information especially important for this particular message.

Message Focus:
- does not create AI permission,
- does not permanently alter AI permissions,
- does not permanently pin the item,
- does not mean AI may use only Focus items,
- does not copy the item directly into the outgoing draft.

**[DECIDED]** Focused context receives stronger relevance/emphasis while other permitted context remains available.

**[DERIVED]** Phase 14's `Add to AI` / Message Focus UI consumes this weighting contract.

---

# Y. Off Limits

**[DECIDED]** AI-enabled Off Limits content receives special negative-constraint semantics.

It is not ordinary conversation fuel/context.

Prompt meaning should effectively communicate:

> Avoid mentioning or steering the conversation toward these topics.

**[DECIDED]** AI-enabled Off Limits constraints should be included reliably rather than dropped merely because they rank poorly under ordinary positive relevance ranking.

**[DECIDED]** If an Off Limits item is AI-disabled, Orbit respects that privacy choice and does not secretly transmit it merely so the model can enforce the avoidance constraint.

**[DECIDED]** The owner ratified this widened AI egress on 2026-09-01 (ADR-050 and ADR-036 superseded 2026-09-01 by ADR-078).

---

# Z. Recent Interaction Context

**[DECIDED]** AI context includes a compact projection of the contact's **three most recent Interaction records**.

Useful recent context may include:
- date/time/recency,
- channel,
- Tone where present,
- permitted Interaction note,
- relevant group affiliation/context where appropriate and already available through canonical Interaction semantics.

**[DECIDED]** Recent history is bounded to the latest three Interaction entries rather than transmitting the complete History Browser.

**[DECIDED]** An Interaction note is sent **only when that interaction's `Allow AI` toggle is ON**.

The toggle is authored on the Log Interaction form (Phase 13 §N), defaults **OFF**, and remains editable afterward through Phase 11's canonical Edit Interaction. A note whose toggle is OFF is withheld from the projection entirely; the rest of that interaction's compact structured context may still be sent.

**[DECIDED]** **Group Notes are never transmitted to AI** (owner decision 2026-09-01), whatever any participant's Allow AI state. Only a participant's own interaction note may be sent, subject to that interaction's Allow AI toggle. Group affiliation may still be referenced as ordinary structured context.

**[DERIVED]** Recent context exists to prevent obviously tone-deaf/repetitive drafting and provide near-term conversational continuity, not to turn the AI prompt into full historical analytics.

---

# AA. Adjust

**[DECIDED]** Compose AI review includes **Adjust** as a temporary generation-control mechanism.

**[DECIDED]** Adjust may provide quick actions such as:
- Shorter,
- Longer,
- Warmer,
- More casual,
- More direct,
- similar concise transformations,
- plus a freeform `Tell Orbit what to change...` instruction.

**[DECIDED]** Adjust does not alter persistent Writing Style or Personalization Context.

**[DECIDED]** Adjust is ephemeral to the current Compose AI session/generation flow.

**[DECIDED]** Adjust generates a new set of **three alternatives**.

**[DECIDED]** If the user has selected a specific prior suggestion/draft, that selected draft may be included as additional reference so the new alternatives preserve continuity while applying the adjustment.

**[DEFERRED]** A deeper transformation/history system with distinct persistent branches, editable generation trees, or complex iterative prompt programming.

---

# AB. Central AI Permission Manager

**[DECIDED]** Phase 16 provides the centralized AI permission review/manage surface required by Contact Knowledge.

**[DECIDED]** The manager should avoid a giant contact × field matrix.

Initial shape includes two complementary areas:

## Defaults for new information

Type/field defaults controlling whether newly created eligible information begins AI-enabled or AI-disabled according to the owning Contact Knowledge metadata.

**[DECIDED]** Existing privacy posture remains default OFF unless deliberately configured otherwise.

**[DECIDED]** Changing a type-level default affects **new items only**.

The UI should say this plainly and may offer a path such as `Review existing ...`.

**[DECIDED]** **Interaction notes are one of the information types covered by these defaults.** Their `Allow AI` default is **OFF**, and changing that default affects **new interactions only** — existing interactions keep the Allow AI state they were saved with.

## Review existing AI-enabled information

The manager provides:
- contact search,
- filtering by knowledge/information type,
- `Enabled only` or equivalent review filtering,
- contact drill-in,
- clear semantic labels/values rather than storage identifiers,
- summary counts.

**[DECIDED]** Review coverage includes **AI-enabled interaction notes** as a reviewable information type alongside Contact Knowledge items, so a user can find and withdraw notes they previously allowed. Group Notes never appear here because they are never AI-eligible.

Example summary direction:

`AI can currently access information from 18 contacts · 67 items`

---

# AC. Permission Bulk Actions

**[DECIDED]** Bulk disabling existing AI permissions is supported.

**[DECIDED]** Bulk enabling is also supported but requires explicit impact confirmation showing what/how much is about to become AI-accessible.

**[DECIDED]** Orbit does not provide an easy `Enable everything` privacy shortcut.

**[DECIDED]** Orbit does not need a destructive separate `Disable all AI permissions` emergency command beyond:
- the global AI Enabled toggle for temporary complete disablement, and
- bulk disable inside the permission manager for intentional permission changes.

This avoids confusing temporary AI shutdown with permanent destruction of carefully configured permissions.

---

# AD. AI Settings Information Architecture

**[DECIDED]** Phase 16's AI area is substantial enough to use dedicated management destinations rather than one giant settings form.

Conceptual AI configuration hierarchy:
- Connection,
- Model,
- Writing Style,
- Personalization Context,
- AI Data Permissions,
- Preview What Orbit Sends.

**[DERIVED]** Final visual grouping lives within the later Settings & Personalization consolidation phase, but Phase 16 owns the canonical AI-management surfaces and behavior.

**[DERIVED]** When AI Enabled = OFF, this hierarchy is mostly hidden/collapsed from ordinary presentation while the saved-connection management escape hatch remains available.

---

# AE. Full-System Prompt Review — Settings

**[DECIDED]** Settings exposes **Preview What Orbit Sends** as a transparency/power-user tool for reviewing the **entire AI prompt system**.

This review includes the resolved/default AI structure such as:
- Orbit-owned system instructions,
- Writing Style,
- enabled Personalization Context sections,
- context-placement/semantic rules,
- output contract,
- active model/connection assumptions where useful,
- other globally assembled prompt material.

**[DECIDED]** The Settings inspector should support **Preview with contact...** through the canonical contact picker.

Selecting a contact resolves an actual example full prompt including that contact's permitted context, latest-three Interaction projection, Off Limits constraints, and other applicable material.

**[DECIDED]** The full inspector should present a readable sectioned view.

A raw/resolved representation may also be available for power users where practical.

**[DECIDED]** Credentials/secrets are never displayed inside the prompt inspector.

---

# AF. Contact-Specific AI Review — Compose

**[DECIDED]** Compose also provides an AI-context review action, but it is intentionally **not the same inspector** as Settings.

Compose review answers:

> What information about this particular contact is Orbit sharing for this generation?

Example direction:

`Sharing 17 items with AI about Mom`

followed by the actual contact-specific items/context being transmitted.

**[DECIDED]** Compose review should include relevant contact-specific material such as:
- permitted Things to Remember / Contact Knowledge items,
- Message Focus items,
- latest-three Interaction context,
- AI-enabled Off Limits constraints,
- other contact-specific data included in the request.

**[DECIDED]** Compose contact review deliberately strips/omits ordinary global prompt boilerplate such as:
- Orbit's immutable system instructions,
- global Writing Style,
- general Personalization Context,
- standard output contract.

Those are inspectable from Settings instead.

**[DERIVED]** The two review surfaces serve different transparency questions and must not be collapsed into one giant prompt dump everywhere.

---

# AG. First-Use AI Disclosure

**[DECIDED]** First successful AI setup uses a **lightweight disclosure**, not a mandatory audit of the entire exact prompt.

Direction:

> Orbit only sends information you've allowed for AI. Your request is sent through your active AI connection and its underlying model provider. You can review exactly what Orbit sends at any time.

**[DECIDED]** Connection-specific disclosure should accurately identify the relevant data path:
- OpenRouter → OpenRouter plus the selected underlying model/provider,
- Direct Provider → the selected provider,
- Custom → the configured endpoint.

**[DECIDED]** Full detailed prompt/context review remains available on demand rather than being forced during every first-send/setup flow (ADR-052's exact-prompt first-send acknowledgement superseded 2026-09-01 by ADR-079).

---

# AH. Generation Errors — User Experience

**[DECIDED]** AI failures are translated into human-readable user-facing categories rather than dumping raw provider/API errors.

Expected categories include:
- Connection needs attention,
- Model unavailable,
- Rate limited / try again shortly,
- Insufficient credits / billing issue,
- Context too large,
- Provider temporarily unavailable,
- Custom endpoint error,
- other recoverable/general generation failure.

**[DECIDED]** More technical provider/error information may be available behind a `Details` affordance where useful.

**[DECIDED]** Generation failure preserves the user's Compose state, including:
- message text,
- Message Focus,
- Adjust state/instruction,
- selected mode/destination,
- other relevant session state.

**[DECIDED]** Orbit does not silently fall back to another model or connection after a generation failure.

---

# AI. Sanitized Diagnostic / Telemetry Seam

**[DECIDED]** AI failures expose a **sanitized structured diagnostic event** suitable for a future application observability/error-reporting system such as Sentry.

**[DECIDED]** User-facing error messaging and developer diagnostics are separate outputs from the same failure.

Safe diagnostic metadata may include concepts such as:
- AI operation (`Draft`, `Rewrite`, `Adjust`),
- active connection lane,
- selected model identifier,
- provider HTTP status/category,
- provider error code where safe,
- request/attempt correlation identifier,
- app build/release version,
- OS/platform version,
- approximate input-token count,
- contact-context item count,
- elapsed request time,
- stack trace for Orbit application exceptions.

**[DECIDED]** Private user/application content must **not** be included in AI telemetry by default.

Do not transmit to diagnostics:
- contact names,
- phone/email values,
- Memory contents,
- interaction notes,
- Group Notes,
- Off Limits text,
- Personalization Context documents,
- Writing Style freeform text,
- Message Focus text,
- prompt bodies,
- API keys/OAuth credentials,
- raw request bodies,
- generated drafts/rewrite/Adjust output text,
- raw provider responses that may echo private prompt content.

**[DECIDED]** Malformed-output diagnostics should prefer structural metadata such as:
- expected suggestion count,
- parsed suggestion count,
- response byte size,
- provider status,

rather than shipping the generated response body.

**[DERIVED]** Prefer a narrow purpose-built AI diagnostic/reporting helper/schema so provider adapters cannot casually attach whole request/response objects to telemetry.

**[DEFERRED]** Full app-wide Sentry installation/instrumentation. This dossier establishes the privacy-safe AI telemetry seam; release hardening may wire it into the chosen observability platform.

---

# AJ. Backup / Restore

**[DECIDED]** Ordinary Orbit backup/restore preserves nonsecret AI personalization/configuration state that is meaningful user-authored data, including:
- Writing Style settings,
- custom Personalization Context sections,
- section order,
- section enabled/disabled state,
- compatible prompt-personalization configuration,
- Contact Knowledge AI permissions according to the Phase 3 backup contract.

**[DECIDED]** Credential material is excluded from ordinary backup/restore, including:
- direct-provider API keys,
- OpenRouter authorization/API credential state,
- Custom Endpoint secrets.

After restore to another device, the user may need to reconnect/re-enter credentials while their nonsecret personalization and privacy configuration remain intact.

**[DERIVED]** Connection metadata that is safe/nonsecret may restore where useful, but restored AI must not falsely appear Ready without valid local credential material.

---

# AK. Existing Implementation Reconciliation

**[DERIVED]** Preserve compatible existing AI infrastructure where it already supports the settled product direction, including:
- secure per-provider credential storage,
- direct OpenAI/Anthropic/Gemini adapters,
- provider/model abstraction,
- existing model discovery/catalog infrastructure,
- custom endpoint SSRF/private-address safeguards,
- deterministic prompt-resolution foundation,
- provider-aware output handling.

**[DERIVED]** Existing UI/product assumptions are not automatically authoritative.

In particular, Phase 16 should reconcile/replace older concepts where they conflict with the new contracts, including:
- raw prompt-template-as-primary-personalization UX,
- old `Conversation Fuel` terminology,
- old interaction quality vocabulary superseded by Tone,
- overly narrow pre-Contact-Knowledge context allowlists,
- `Provider=None` as the only global disable mechanism,
- connection/provider identity conflation,
- Custom Endpoint wording that implies more arbitrary HTTP compatibility than the wire contract actually supports.

**[DERIVED]** Existing prompt-size constants designed around a small legacy template must not be treated as permanent product ceilings.

---

# AL. Cross-Phase Constraints

- **Contact Knowledge Foundation → Phase 16:** AI remains globally gated plus explicitly permissioned at field/item level; default permission posture remains OFF; type defaults affect new items only; Off Limits retains avoid-topic semantics.
- **Messaging & AI Compose → Phase 16:** Phase 14 owns Compose, Draft/Rewrite review, Message Focus UI, and three-suggestion consumption; Phase 16 owns connection/model setup, prompt construction, Adjust semantics, permission administration, and AI availability state.
- **Compose AI availability:** AI Off removes AI UI; AI On + Ready exposes normal AI actions; AI On + Needs Attention exposes a repair notice instead of silently disappearing.
- **Compose context transparency:** Compose review is contact-specific disclosure only; Settings owns whole-system prompt inspection.
- **Settings & Personalization:** later Settings consolidation should route to/use the canonical AI management surfaces defined here rather than reimplementing AI behavior.
- **Backup/Restore:** preserve user-authored AI personalization and privacy configuration but never ordinary credential secrets.
- **Release Hardening / Sentry:** later observability integration must consume the sanitized diagnostic seam and preserve the strict no-private-content telemetry boundary.
- **Onboarding:** later onboarding may promote OpenRouter as the recommended connection and explain privacy/data flow, but does not redefine the connection architecture.

---

# Explicitly Deferred

- Orbit-hosted AI proxy/backend
- Orbit-funded shared provider API keys / subsidized inference
- AI subscription/credit monetization
- Supabase/auth-backed AI service architecture
- automatic model/provider fallback
- multiple simultaneously active AI connections
- per-generation provider switching
- arbitrary HTTP API builder / Postman-like custom endpoint configuration
- LAN/private-network/custom local-model endpoint support
- built-in Ollama/local-model integration
- per-contact persistent AI personalization documents
- writing-sample ingestion/training/style inference
- DOCX/PDF personalization import
- rich-text personalization documents
- live-linked external personalization files
- arbitrary personalization folders/nesting/version history
- silent prompt-context truncation
- user-facing prompt-generation trees/history
- automatic AI classification/extraction of Contact Knowledge
- detailed provider-pricing database for non-OpenRouter connections
- full app-wide Sentry implementation
- immutable AI audit history of every request/response

---

# Phase Success Criteria

Phase 16 is successful when:

1. Orbit exposes a real AI master toggle that disables AI without erasing connections, models, personalization, or per-information permissions, while still allowing saved credentials to be managed when AI is off.
2. Orbit supports exactly one active connection across three lanes: recommended OpenRouter, Advanced direct-provider BYOK, and Advanced OpenAI-compatible Custom Endpoint.
3. Switching to an unconfigured connection cannot break a currently working connection; inactive credentials/configuration are retained until explicitly removed.
4. OpenRouter setup provides a consumer-friendly browser-based connection path and supports model selection across provider families without per-call provider switching.
5. Each connection remembers its own selected model; unavailable models produce explicit Needs Attention state and require deliberate reselection.
6. OpenRouter model selection is curated-first with broader catalog access, current detailed pricing from OpenRouter metadata, and economical Orbit-oriented recommendations rather than automatic bias toward high-cost frontier models.
7. Model catalog refresh is cache-friendly/manual-capable, while displayed OpenRouter cost estimates use materially fresher selected-model pricing metadata.
8. Orbit owns an immutable system/output prompt contract while users customize Writing Style and arbitrary enabled global Personalization Context sections.
9. Users can paste personalization text or import `.txt` / `.md` files, with imported contents copied into editable local Orbit records.
10. Orbit does not silently truncate enabled context to an arbitrary product ceiling; true model-capacity overflow is disclosed explicitly.
11. Personalization Context exposes token/context estimates and OpenRouter input-cost estimates without forcing comparable pricing for connections lacking trustworthy price metadata.
12. Contact Knowledge AI permission means permitted information is included as contact context; Message Focus increases emphasis without changing permission; AI-enabled Off Limits are transmitted as avoidance constraints.
13. AI generation receives a compact projection of the three most recent Interactions, including notes only where AI permission allows them.
14. Adjust provides ephemeral quick/freeform instructions and produces three new alternatives without permanently changing Writing Style.
15. Central AI permission management supports type defaults, searchable existing-access review, bulk disable, and confirmed bulk enable while preserving new-items-only default semantics.
16. Settings provides whole-system prompt review plus optional resolved contact preview; Compose provides a separate contact-specific disclosure review of what is being shared for that generation.
17. First-use AI disclosure is lightweight but accurately explains the active connection/provider data path and points to ongoing transparency tools.
18. AI On + broken configuration produces a clear Needs Attention state and repair route; AI Off simply removes AI generation affordances.
19. Generation failures are human-readable, preserve Compose state, never silently fail over, and emit sanitized structured diagnostics suitable for later Sentry integration.
20. AI prompts, contact data, personalization documents, credentials, and generated drafts never enter production diagnostics/telemetry by default.
21. Backup/restore preserves nonsecret personalization and permission state while excluding API/OAuth/custom-endpoint credentials.
22. Existing AI infrastructure is reused where compatible but reconciled to the newer Contact Knowledge, Tone, Compose, connection-lane, and prompt-personalization contracts.

---

# Notes for GSD / Roadmapper

- Treat this as a substantive AI subsystem phase, not merely a Settings page.
- Do not collapse OpenRouter, direct BYOK, and Custom Endpoint into simultaneously active providers. Exactly one connection is active at a time.
- Preserve multiple stored direct-provider credentials as inactive configuration; switching is not deletion.
- OpenRouter is recommended/promoted but not mandatory.
- Do not freeze current OpenRouter prices or model IDs into long-lived requirements. Initial recommendation order is product direction; catalog/pricing are runtime data.
- Do not silently substitute a new model or provider when the user's selected one fails or disappears.
- Do not reintroduce a raw user-editable system prompt as the normal personalization UX.
- Do not invent an Orbit-level artificial context ceiling or silently truncate user context.
- Keep global Personalization Context distinct from Contact Knowledge; do not create a second per-contact memory store.
- Preserve Phase 3's explicit AI permission model and Off Limits semantics.
- Keep the two transparency surfaces distinct: Settings = whole-system prompt; Compose = contact-specific disclosure.
- Treat telemetry privacy as a hard boundary. Diagnostic usefulness must come from safe metadata, not captured prompts/responses.
- Full Sentry/app observability wiring belongs to later hardening unless implementation order makes earlier installation convenient.
- Settings & Personalization should later consolidate navigation/entry points around these canonical AI surfaces rather than owning their business rules.
