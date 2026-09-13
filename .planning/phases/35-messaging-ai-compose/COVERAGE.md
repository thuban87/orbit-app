# Phase 35 — AI Integration Coverage

No NEW external API integration: Phase 35 reuses the existing `AiService` / `AiSuggestionLifecycle` egress path and hands off delivery to OS SMS/email composers via intents. Provider/model/key/endpoint configuration is Phase 36. The capability surface below is the AI-provider behavior Compose EXERCISES this phase.

## Provider capability surface (Compose-exercised)

| Capability | Disposition | Where / reason |
|------------|-------------|----------------|
| Draft generation (empty editor) | INTEGRATE | Adaptive action → `AiSuggestionLifecycle.begin()` (Draft branch) → `generateVariants(generateOne, prompt, signal, 3)` (plan 35-04 helper wired in 35-08). `generateOne` is an ADAPTER over `provider.generate` (which takes a `GenerationInput`, not `(prompt,signal)`), not the provider fn passed directly. Reuses existing `AiProvider.generate(input): Promise<string>` — no provider change. |
| Rewrite generation (non-empty editor) | INTEGRATE | Same lifecycle; Rewrite branch carries the user's current editor body as an explicit DELIMITED source-draft within the bounded `resolvePrompt`/`ResolvedPrompt` path (plans 35-04 contract / 35-08 wiring). Not a widening of contact-data egress. |
| Three-suggestion generation | INTEGRATE | MECHANISM (plan 35-04): three independently-cancellable `provider.generate` calls (via a `generateOne` adapter that builds each `GenerationInput`) sharing ONE request token + AbortController signal via `generateVariants`, which passes each call a 0-based variantIndex. COMP-12 'meaningfully varied' is a DELIBERATE lever — a distinct per-call temperature via `variantTemperature` — not provider chance (D-12 minimal; variation-INSTRUCTION prompting is Phase 36). AiService single-draft contract + `parseSuggestionOutput` UNCHANGED. Cost note: ~3× tokens/latency per generation; Phase 36 may consolidate to a single-call multi-variant provider strategy when it owns the provider layer. |
| Cancellation / timeout / stale-guard | INTEGRATE | The lifecycle's sole AbortController + 20s timeout + monotonic gen token are preserved (plan 35-04); the shared signal aborts all three fan-out calls; any single failure surfaces a sanitized code with Try Again. |
| AI-eligible context projection (`readPromptContext`) | INTEGRATE | The closed `PromptContext` projection (`ai-context-read.ts`) is the sole egress; plan 35-05 CARRIES ONE new shape (the gated recent-interaction note) without rendering/transmitting it (D-13). |
| Off Limits → AI (any form) | OPT-OUT (excluded) | **ADR-107 / D-14 (owner-ratified 2026-09-13) reverses ADR-078's off-limits egress:** off-limits is NEVER sent to AI — not as positive context, not as a negative avoidance constraint. No `avoidanceConstraints` shape is added or populated; `fuel-read.ts`'s off-limits exclusion stays unrelaxed; no `fuel` AI-permission column. Off Limits remains a human-facing Research "Avoid" group only. |
| Gated recent-interaction note (note only where `interactions.allow_ai=1`) | INTEGRATE (carry-only) | Same as above; Group Notes NEVER carried; allow_ai=0 notes excluded. |
| Exact prompt-template rendering / transmission of the new shapes | OPT-OUT | Deferred to Phase 36 by D-13 (§U generation-context construction). Phase 35 does not widen actual egress beyond today's authorized projection. |
| Three-state AI availability (Off / Ready / Needs-Attention) | INTEGRATE (provisional) | `ai-availability.ts` adapter (plan 35-04, D-12): provisional derivation from today's state; Phase 36 replaces the internals without touching Compose. |
| Provider / model / API-key / endpoint management | OPT-OUT | Phase 36 (AI Configuration & Prompting). Compose consumes credentials via the existing `ai-key-store`; no new provider surface here. |
| ADR-052 exact-prompt acknowledgement gate | OPT-OUT (retired) | Removed by ADR-079 (plan 35-04); the DAO `acknowledgeProvider` writer is left in place (forward-only), only the logic-module ack path is removed. |

## Delivery handoff (not an API Orbit calls)

- External delivery is an OS handoff — SMS via `expo-sms`, email via RN `Linking` `mailto:` (encoded subject+body, no new dependency), tel via `Linking` — through `performReachOut` (return contract widened to `{ handoffStarted, assistUid }` in plan 35-01). An intent handoff across the app boundary; Orbit never claims delivery and awaits no delivery result.
