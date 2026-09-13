# API Coverage — OpenRouter + BYOK/Custom AI lanes (Phase 36)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> The deterministic `api-coverage.cjs` detector returned `detected:false` on the ROADMAP
> section prose alone (its verb+noun adjacency did not fire on "browser-authorized" / "model
> picker"). The phase nonetheless integrates external APIs — OpenRouter OAuth-PKCE, the
> OpenRouter `/api/v1/models` catalog, and OpenAI-compatible chat/completions across three lanes
> (RESEARCH §Architecture Patterns 1–2, §On-Disk #2). This matrix is authored deliberately so the
> seal-time `api-coverage.verify-pre` gate is satisfied and every un-built capability is a decided
> gap, not an invisible hole.

## OpenRouter (openrouter.ai) — recommended lane

| capability | decision | reason |
|---|---|---|
| oauth_pkce_connect (`/auth` + `POST /api/v1/auth/keys`, S256) | INTEGRATE | |
| key_reconnect_refresh (re-run OAuth to refresh credential, preserve model/personalization) | INTEGRATE | |
| models_catalog (`GET /api/v1/models`, public) | INTEGRATE | |
| model_pricing (`pricing.{prompt,completion}` USD-per-token strings) | INTEGRATE | |
| catalog_refresh (first-open-of-new-local-day + explicit Refresh Models) | INTEGRATE | |
| input_cost_estimate (`estimatedInputTokens * Number(pricing.prompt)`) | INTEGRATE | |
| chat_completions (generation via existing OpenAI-compatible `AiService` adapter) | INTEGRATE | |
| credits/usage balance endpoint | OPT-OUT | not needed — billing surfaced only as the "insufficient credits / billing issue" failure category (AICFG-13); no dedicated balance UI this phase |
| streaming responses (SSE) | OPT-OUT | not needed — Orbit consumes a batched three-suggestion response; the existing adapter parses non-streaming JSON |
| tool / function calling | OPT-OUT | not needed — relationship message drafting only; no tool use |
| image / multimodal input | OPT-OUT | not needed — text drafting only; off scope (dossier Deferred) |
| provider routing / `provider` preferences params | OPT-OUT | not needed — Orbit selects exactly one model per connection; no per-call routing (dossier D: one active connection, no per-generation switching) |
| output-cost estimate | OPT-OUT | explicitly out of scope — dossier §V requires input-cost only, "does not fabricate a typical output-cost estimate" |

## Direct BYOK lanes — OpenAI / Anthropic / Gemini (Advanced)

| capability | decision | reason |
|---|---|---|
| api_key_entry (per-provider → SecureStore `orbit.ai.key.<provider>`) | INTEGRATE | |
| model_catalog (existing LiteLLM `filterLiteLLMCatalog`, deprecation-aware) | INTEGRATE | |
| manual_model_id_escape_hatch | INTEGRATE | |
| chat_completions (existing per-provider adapters in `AiService`) | INTEGRATE | |
| per-provider pricing / cost estimate | OPT-OUT | dossier §V — no trustworthy current price source; show token size + "Cost estimate unavailable for this connection." (do not build a pricing DB) |

## Custom Endpoint lane — OpenAI-compatible HTTPS (Advanced)

| capability | decision | reason |
|---|---|---|
| endpoint_config (base URL + optional credential + model id) | INTEGRATE | |
| url_validation (`validateCustomEndpoint` + `secure-fetch` SSRF/private-address guards) | INTEGRATE | |
| model_discovery (where the compatible endpoint supports it) | INTEGRATE | |
| chat_completions (existing custom OpenAI-compatible adapter) | INTEGRATE | |
| arbitrary HTTP method/header/response-path builder | OPT-OUT | explicitly deferred (dossier §I, Explicitly Deferred) — contract is OpenAI-compatible HTTPS only |
| LAN / private-network / local-model endpoints | OPT-OUT | explicitly deferred (dossier §I) — private-address/SSRF guards stay in force |
| per-endpoint pricing / cost estimate | OPT-OUT | no trustworthy price source (dossier §V) — "Cost estimate unavailable for this connection." |
