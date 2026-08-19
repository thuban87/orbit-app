# Phase 14: AI Message Suggestions — Research

**Date:** 2026-08-18
**Scope:** AI-01 through AI-04; planning research after accepted Phase 14 context and AI-SPEC.

## Executive Summary

Orbit should implement this as a small direct-`fetch` TypeScript boundary, not an AI framework.
It is a single, user-triggered, non-streaming request that returns text into the existing editable
Compose draft. The hard problems are the outbound-data allowlist, credential split, provider-wire
format validation, and stale/cancelled request handling—not model orchestration.

## Locked Architecture

- Four providers: OpenAI, Anthropic, Gemini, plus user-supplied HTTPS OpenAI-compatible Custom.
  Custom uses a free-text model; official providers attempt dynamic discovery but never block a
  free-text model fallback. No local/Ollama, LAN `http:`, provider SDK, server, entitlement, or
  streaming in v1.
- Keys are provider-scoped `expo-secure-store` values. SQLite `app_settings` stores only
  provider/model/template/validated Custom URL/first-send acknowledgement. API keys, prompts,
  context, endpoints, headers, bodies, and raw provider errors must not enter exports, backups,
  logs, analytics, or navigation params.
- Migration `004` must be additive. Do not modify already-shipped migrations 001–003. Extend the
  typed `AppSettings` DAO, read mapping, update allowlist/validation, migration list, and seed/test
  fixtures together.
- Create a dedicated AI context read + pure template resolver. It may use `getRankedFuel` but must
  not use a broad editor/contact read or select interaction `note`/`detail`. Allowed custom values
  are live `share_with_ai=1` definitions, safely fetched by `col_name` and displayed by label.
- Compose remains the only editable result UI. Profile navigates additively to Compose with a
  serializable AI request intent. Generation never creates a touchpoint, changes `last_contact`,
  writes fuel, or sends SMS; existing Copy/SMS behavior stays intact.

## Existing Seams and Required Changes

| Area | Existing seam | Planning direction |
|---|---|---|
| Provider service | `src/services/AiService.ts`, `AiService.test.ts` | Replace Markdown `extractSection`/`assemblePrompt`, hard-coded lists, and full-prompt `Logger.debug`; retain only useful typed adapter structure and explicit `response.ok` behavior. |
| Settings | `src/db/migrations/002-app-settings.ts`, `003-orrery-settings.ts`, `src/db/app-settings-dao.ts`, `SettingsScreen.tsx` | Add migration 004 and AI settings section following current focus reload/guarded persistence patterns. |
| Secure key store | absent from `package.json` | Install first-party `expo-secure-store` with Expo config integration; expose a narrow provider-key repository testable without native storage. |
| Draft surface | `src/screens/ComposeScreen.tsx` | Insert the reserved Phase-14 control; one active request, Cancel, timeout, unmount cleanup, request-id stale guard, inspector, and non-empty-draft replacement confirmation. |
| Profile entry | `ContactProfileScreen.tsx`, navigation types | Route to Compose with a serializable request intent; do not build a second result surface. |
| Fuel | `src/db/fuel-read.ts:getRankedFuel` | Reuse this structural SQL privacy projection: it excludes off-limits, unconfirmed-AI, and blank fuel. Preserve rank and render fuel age. |
| Interaction context | `src/db/impact-read.ts`, `src/services/impact.ts` | New AI-specific aggregate projection: counts/cadence/quality/newest channel/gravity/intensity only. Never select note/detail text. |
| Custom fields | `src/db/field-values-dao.ts`, `field-types.ts`, `FieldDefForm.tsx` | Reuse safe identifier binding; expose existing `share_with_ai` metadata flag in field editing and exclude unflagged/quarantined/null/blank values. |

## Provider and Security Guidance

- Use documented dynamic model endpoints: OpenAI `GET /v1/models` with Bearer auth; Anthropic
  `GET /v1/models` with `x-api-key` plus `anthropic-version` (handle pagination); Gemini
  `GET /v1beta/models`, retaining only `generateContent` models. Treat discovery as advisory and
  retain free text after offline/bad-key/error outcomes.
- Keep a neutral `AiProvider` contract; each adapter owns headers/body/success parser. `response.json()`
  is `unknown`: validate each expected provider response shape and then validate non-empty bounded
  suggestion text. Explicitly check `response.ok` before parsing error/success paths.
- Validate Custom URLs before save and request with `new URL`: protocol exactly `https:`, non-empty
  host, no username/password. Reject cleartext and redirects; never enable app-wide cleartext.
- Use fresh `AbortController` + manually cleared `setTimeout` per request. Cancel, navigation,
  unmount, provider/model change, and timeout must invalidate the request id. Never auto-retry a
  network/timeout failure because the provider may already have billed it.
- SecureStore protects a key at rest, but direct mobile BYO-key traffic still exposes it to the
  selected provider. Setup must say that Orbit neither exports nor logs the key and cannot make
  retention claims for a Custom endpoint.

## Prompt Contract and Limits

Use static product instructions separately from a delimited serialized `PromptContext`; contact data
is untrusted data, never model instructions. Build the inspector and provider payload from the same
immutable resolved prompt. Suggested deterministic bounds: max 6,000 Unicode code points total,
2,000 template, eight fuel rows in rank order, 300 code points per user value, and 120 output tokens
with a 1,200-code-point post-parse draft limit. Return truncation metadata to disclose omitted
categories without retaining omitted text.

The resolver must handle known structured placeholders plus approved field `col_name` bindings,
displayed by label. Unknown/dropped/quarantined fields resolve `None available`; no fallback query
may widen the egress boundary. Prompt previews are mandatory before first request per provider and
always available later.

## Test and UAT Requirements

1. Migration/DAO tests prove correct defaults and no secret column exists in settings.
2. Secure-store wrapper tests prove provider isolation and no key reaches settings/export/log paths.
3. Mocked-fetch adapter tests cover provider headers/payloads, status mapping, model discovery
   fallbacks, malformed JSON/response shapes, output limits, Custom HTTPS rejection, timeout, abort,
   and no automatic retry.
4. SQLite/prompt tests prove forbidden fuel, note/detail text, unapproved/quarantined/blank fields,
   and prompt-injection-shaped values cannot serialize; approved fields use label + safe col_name.
5. Compose logic tests prove first-send acknowledgement, inspector identity, one in-flight request,
   cancel/stale/no-write behavior, and confirmed replacement of only a non-empty draft.
6. Pixel release-build UAT covers SecureStore configuration/masking, all provider/free-text paths,
   HTTP rejection, preview/inspector, offline/bad key/rate limit, cancel/navigation, Copy/SMS, and
   log inspection for absent prompt/key data.

## Plan Shape

1. SecureStore dependency/config; migration 004; typed non-secret settings DAO/tests.
2. Provider/key boundary: model discovery, strict Custom URL, timeout/cancel, parsing, redaction,
   and mocked-fetch tests.
3. Structured prompt context DAO/resolver plus exhaustive outbound-data privacy tests.
4. Field editor sharing toggle and Settings AI configuration/first-send acknowledgement/inspector.
5. Compose/Profile integration for suggestion lifecycle and editable draft; pure state tests.
6. Cross-layer verification and prebuild/physical-Pixel UAT.

## Sources

- `docs/dossier/13-ai.md` and its provider/keystore workpapers (project decisions and documented
  official sources).
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [OpenAI Models API](https://developers.openai.com/api/reference/resources/models/methods/list)
- [Anthropic API errors](https://platform.claude.com/docs/en/api/errors)
- [Gemini Models API](https://ai.google.dev/api/models)

## RESEARCH COMPLETE
