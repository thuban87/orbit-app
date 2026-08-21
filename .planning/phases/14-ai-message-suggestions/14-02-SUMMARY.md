---
phase: 14-ai-message-suggestions
plan: 02
subsystem: ai
tags: [ai-adapters, fetch, secure-fetch, abort-signal, securestore, ssrf, sanitized-errors]

# Dependency graph
requires:
  - phase: 14-01
    provides: validateCustomEndpoint, ai-key-store (provider-scoped SecureStore), neutral ai-types
  - phase: 14-03
    provides: ResolvedPrompt immutable type (adapters read only resolvedPrompt.payload)
  - phase: 14-07
    provides: secureCustomFetch native egress transport (Kotlin egress guard, green on desktop)
provides:
  - Neutral AiProvider adapter contract (listModels + generate(input))
  - Four typed adapters (OpenAI/Anthropic/Gemini on raw fetch; Custom on native secureCustomFetch)
  - parseSuggestionOutput shared draft validator (trim/non-empty/1,200-code-point ceiling)
  - Sanitized AiError union (message == code; no key/endpoint/body/header leakage)
  - Per-call injected key accessor; refreshProviders never reads/caches a key
  - Legacy aiApiKey/aiApiKeys removed from AiSettings
affects: [14-05 compose caller (owns AbortController/timeout), ai settings screen, ai suggestion UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Neutral adapter contract: each provider owns URL/headers/body/response-extraction/error-normalization"
    - "Caller-owned cancellation (H4): adapters forward input.signal, construct no controller/timeout"
    - "Per-call key accessor closure over SecureStore (C3-M2): key fetched immediately before the request, never cached in settings/state"
    - "unknown-JSON boundary: safe path-walk + shared post-parse ceiling before a response becomes a draft"
    - "Sanitized error union: message is exactly the stable code (no raw detail ever surfaces)"

key-files:
  created:
    - src/services/ai-service-guards.test.ts
  modified:
    - src/services/AiService.ts
    - src/services/AiService.test.ts
    - src/services/ai-types.ts

key-decisions:
  - "generate(input) carries the immutable ResolvedPrompt; adapters read ONLY resolvedPrompt.payload for the request body (C3-M1 identity)"
  - "maxOutputTokens maps per provider: OpenAI max_completion_tokens, Anthropic max_tokens, Gemini generationConfig.maxOutputTokens — no single field name leaks into the neutral contract"
  - "Custom generate() validates via the shared validateCustomEndpoint (H2) then dials ONLY secureCustomFetch (H3); official providers stay on raw fetch to fixed hosts"
  - "Custom listModels() is non-networked — Custom is free-text-only (C4-M1)"
  - "SecureFetchError redirect/private_address/host_mismatch map to a single neutral 'blocked' AiError code"
  - "Model discovery never throws — any failure returns { kind: 'manual' } so free-text entry always survives"

patterns-established:
  - "Safe unknown-JSON walk(root, path) helper feeding parseSuggestionOutput"
  - "Source-grep test guard: read AiService.ts and assert zero AbortController/setTimeout tokens (H4 structural proof)"

requirements-completed: [AI-01]

coverage:
  - id: D1
    description: "OpenAI/Anthropic/Gemini adapters produce a validated bounded draft from a mocked response; ok-status guard runs before body parse"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "src/services/AiService.test.ts#official adapters — valid response extraction / sanitized HTTP-status errors"
        status: pass
    human_judgment: false
  - id: D2
    description: "parseSuggestionOutput trims, rejects empty/non-string, and enforces the 1,200 code-point ceiling via Array.from (astral-safe)"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "src/services/AiService.test.ts#parseSuggestionOutput"
        status: pass
    human_judgment: false
  - id: D3
    description: "Caller-owned cancellation (H4): signal forwarded to transport; already-aborted rejects; source contains no AbortController/setTimeout"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "src/services/AiService.test.ts#caller-owned cancellation (H4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-call key accessor (C3-M2): refreshProviders reads no key; accessor invoked once at generate time"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "src/services/AiService.test.ts#key accessor is invoked at call time, not during refreshProviders (C3-M2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Gemini key-in-URL (C2-M5): a Gemini failure's sanitized error carries no URL/query/key substring"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "src/services/AiService.test.ts#Gemini key-in-URL is never leaked (C2-M5)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Custom egress reuses validateCustomEndpoint (H2) and routes ONLY through secureCustomFetch (H3); official providers use raw fetch; Custom listModels is non-networked (C4-M1)"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "src/services/ai-service-guards.test.ts#Custom egress routes ONLY through secureCustomFetch / validated before transport / non-networked listModels"
        status: pass
    human_judgment: false
  - id: D7
    description: "Native redirect/private-resolution/timeout errors map to sanitized neutral codes with no endpoint/body/header leakage (T-14-05)"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "src/services/ai-service-guards.test.ts#native errors map to sanitized codes with no leakage (T-14-05)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Legacy aiApiKey/aiApiKeys removed from ai-types.ts (L1); whole-repo typecheck passes"
    requirement: AI-01
    verification:
      - kind: automated
        ref: "grep -c aiApiKey src/services/ai-types.ts == 0; npx tsc --noEmit"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-21
status: complete
---

# Phase 14 Plan 02: Neutral AI Provider Adapters Summary

**Rewrote the dormant AiService into four bounded, cancellable, typed provider adapters — official providers on raw `fetch`, the user-controlled Custom endpoint on the Plan 07 native secure-fetch transport — with a single caller-owned cancellation point, a per-call SecureStore key accessor, and sanitized non-disclosing errors.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-21T11:03:00Z (approx)
- **Completed:** 2026-08-21T11:11:00Z (approx)
- **Tasks:** 2 (both TDD, RED→GREEN)
- **Files modified:** 3 (+1 created)

## Accomplishments

- **Neutral `AiProvider` contract** — `listModels(signal?)` + `generate(input)` where `input` carries `{ resolvedPrompt, model, temperature, maxOutputTokens, signal }`. Adapters read ONLY `input.resolvedPrompt.payload` for the request body (C3-M1 identity, proven by a body-capture test).
- **Four adapters.** OpenAI (`Authorization: Bearer`, `max_completion_tokens`), Anthropic (`x-api-key`, `max_tokens`, paginated model list), Gemini (key-in-URL query, `generationConfig.maxOutputTokens`, discovery filtered to `generateContent`) on raw `fetch` to fixed public hosts; Custom via `validateCustomEndpoint` + `secureCustomFetch`.
- **Single cancellation owner (H4).** Adapters forward `input.signal` straight to the transport and construct no `AbortController` and no timeout — proven both behaviorally (signal identity / already-aborted rejects) and structurally (source grep asserts zero `AbortController`/`setTimeout` tokens).
- **Per-call key accessor (C3-M2).** `refreshProviders` injects a `() => Promise<string|null>` closure over `ai-key-store` and reads no key itself; the accessor is invoked once, inside `generate`, immediately before the request (spy-verified).
- **Sanitized errors (T-14-05).** A stable `AiError` union whose `message` equals its bare `code`; no key, endpoint, query string, header, body, or raw response text ever surfaces. The named Gemini key-in-URL leak test (C2-M5) passes.
- **Custom egress boundary (H2/H3/C4-M1).** Custom reuses the save-time `validateCustomEndpoint` at request time and dials only the native `secureCustomFetch`; `listModels()` is non-networked; `SecureFetchError` redirect/private/host-mismatch map to a neutral `blocked` code.
- **`parseSuggestionOutput`** — trims, rejects empty/non-string, enforces the 1,200 code-point ceiling via `Array.from` (astral-safe: 601 emoji accepted, 1,201 rejected).
- **Legacy removal (L1).** `aiApiKey`/`aiApiKeys` deleted from `AiSettings`; the legacy Markdown assembler (`extractSection`/`assemblePrompt`/`extractContext`), hard-coded model lists, and every prompt/provider `Logger` call are gone.

## Gate Outcomes

- `npx vitest run src/services/AiService.test.ts src/services/ai-service-guards.test.ts` — **PASS** (38 tests).
- `npx vitest run` (full suite) — **PASS** (90 files, 1186 tests).
- `npx tsc --noEmit` (whole repo) — **PASS**.
- `npm run check:colors` — **PASS**.
- `grep -c aiApiKey src/services/ai-types.ts` — **0**.
- `grep -c AbortController src/services/AiService.ts` — **0**; `setTimeout` — **0**.

## TDD Gate Compliance

Both tasks followed RED→GREEN with distinct commits:

- Task 1: `test(14-02)` 276e393 (RED, 17 failing) → `feat(14-02)` 299c7c7 (GREEN).
- Task 2: `test(14-02)` 443bd63 (RED, 12 failing) → `feat(14-02)` 2990889 (GREEN).

## Deviations from Plan

**[Rule 3 — Blocking issue] Mocked `@/ai/secure-fetch` in `AiService.test.ts` (a Task 1 file) during Task 2.**
- **Found during:** Task 2 GREEN. Wiring `AiService.ts` to import `secureCustomFetch` made every test that imports `AiService` transitively load the native `orbit-secure-fetch` module, which throws `ReferenceError: __DEV__ is not defined` under node/vitest.
- **Fix:** Added a `vi.mock("@/ai/secure-fetch", …)` block to `AiService.test.ts` (mirroring the guards test and the existing `secure-fetch.test.ts` native-mock pattern) and re-pointed its Custom happy-path test at the mocked transport — Custom now legitimately routes through `secureCustomFetch`, not raw `fetch`.
- **Why necessary:** Without it the whole suite fails to import; this is a mocking consequence of the Task 2 transport change, not a scope expansion.
- **Files modified:** src/services/AiService.test.ts
- **Commit:** 2990889

Otherwise the plan executed as written.

## Known Stubs

None. All four adapters are fully implemented; no placeholder/empty-data paths remain. (The service remains dormant — wired to no screen — which is by design for this plan; the Compose caller in Plan 05 will own the `AbortController`/timeout and invoke `getActiveProvider(settings).generate(input)`.)

## Notes for Downstream (Plan 05 / UI)

- The Compose caller MUST create and own the `AbortController` and the 20s timeout, then pass `signal` into `generate(input)`. The adapter will not time out on its own.
- `AiService` construction takes an optional `AiKeyStoreLike` (defaults to the `aiKeyStore` singleton) — inject a fake for tests.
- Model discovery is advisory: a `{ kind: "manual" }` result means "keep the free-text model field", not "error".
- `AiSettings` no longer carries any key field; keys live only in SecureStore via `ai-key-store`.

## Self-Check: PASSED
