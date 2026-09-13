# Phase 35 — API Coverage

No external API integration: reuses existing AiService (provider/model/key integration is Phase 36) and hands off to OS SMS/email composers via intents.

- AI generation reaches the user-configured provider through the existing `AiService` / `AiSuggestionLifecycle` egress path (`src/logic/ai-suggestion-logic.ts`). Phase 35 reshapes that lifecycle (single→three suggestions, drop the ADR-052 ack gate) but adds no new provider, endpoint, model, or credential surface — that is Phase 36.
- External delivery is an OS handoff (SMS via `expo-sms`, email via RN `Linking` `mailto:`, tel via `Linking`) through `performReachOut` — an intent handoff across the app boundary, not an API Orbit calls or awaits a result from. Orbit never claims delivery.
- No capability matrix applies: there is no new external API to enumerate methods/params against.
