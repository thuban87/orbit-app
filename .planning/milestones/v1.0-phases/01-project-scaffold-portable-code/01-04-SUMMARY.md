---
phase: 01-project-scaffold-portable-code
plan: 04
subsystem: ai-service
tags: [typescript, port, ai-providers, fetch, obsidian-decoupling, vitest, dormant, https, biome]

# Dependency graph
requires:
  - "01-02: OrbitContact DTO (Obsidian-free) @/types, formatLocalDate @/utils/dates, static gated Logger @/utils/logger"
  - "01-01: @/* alias, biome.json (*.test.ts noNonNullAssertion override), vitest runner + node env"
provides:
  - "AiSettings local settings interface + AiProviderId union ('none'|openai|anthropic|google|custom) (src/services/ai-types.ts)"
  - "Ported fetch-based AiService with 4 cloud providers (OpenAI/Anthropic/Google/Custom-HTTPS), dormant/unwired (src/services/AiService.ts)"
  - "Provider classes OpenAiProvider/AnthropicProvider/GoogleProvider/CustomProvider + AiService orchestrator + DEFAULT_PROMPT_TEMPLATE + prompt-assembly helpers"
  - "Mocked-fetch behavioural tests proving ok-guard precedes body parse per provider (src/services/AiService.test.ts)"
affects: [14-ai, ai-suggestions, secure-store, settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Obsidian requestUrl -> platform fetch: contentType option folded into a Content-Type header; explicit if(!response.ok) throw before await response.json()"
    - "Property-vs-method parse trap fixed: `.json` pre-parsed property read -> `await response.json()` async method call (typechecks silently if missed)"
    - "Decision-enforced-in-code: local/LAN provider omitted entirely (class, id, registration, comment) so no http:// cleartext path can exist in source"
    - "Local minimal settings interface (AiSettings) replaces the unported ../settings module; id union renamed AiProviderId to avoid TS2440 vs the ported interface AiProvider"
    - "Behavioural guard-placement test: json spy not.toHaveBeenCalled() on a non-ok response proves ordering greps cannot"

key-files:
  created:
    - src/services/ai-types.ts
    - src/services/AiService.ts
    - src/services/AiService.test.ts
  modified: []

key-decisions:
  - "OllamaProvider omitted entirely (owner decision CONTEXT.md 2026-08-14): class, 'ollama' id, registration line, and head-comment reference all dropped; enforces the [REJECTED] mobile-local-AI decision in code, not just prose"
  - "Id union named AiProviderId (not AiProvider) and imported into AiService.ts only as the AiSettings type dependency — the ported load-bearing interface AiProvider stays inside AiService.ts, avoiding a TS2440 collision"
  - "Explicit if(!response.ok) throw added before each of the 4 body parses (T-1-01 mitigation); fetch never throws on 4xx/5xx so an unchecked non-ok body would parse an error as success"
  - "extractContext's second parameter renamed fileContent -> _fileContent to clear biome's unused-parameter warning while preserving the faithful legacy signature (param is genuinely unused in the analog too)"

patterns-established:
  - "AI transport: fetch + ok-guard + await response.json() + retained response-shape optional-chaining guards"
  - "Provider registry built from AiSettings via keyFor() per-provider-key-with-legacy-fallback"

requirements-completed: [FND-04]

coverage:
  - id: D1
    description: "Local AiSettings interface + AiProviderId union ('none' included, local/LAN id excluded), replacing the unported ../settings module"
    requirement: "FND-04"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (AiService.ts consumes AiSettings; compiles standalone)"
        status: pass
      - kind: other
        ref: "grep gates: AiProviderId>=1, 'none'>=1, ollama==0, obsidian==0 in src/services/ai-types.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "AiService.ts ported onto fetch, Obsidian-free and local-provider-free, 4 cloud providers, dormant; no http:// cleartext path"
    requirement: "FND-04"
    verification:
      - kind: other
        ref: "grep gates: requestUrl==0, obsidian==0, ollama==0, no http://, await response.json==4, !response.ok==4, .json;==0"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit && npx biome check src/services/AiService.ts (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mocked-fetch tests prove each of the 4 providers throws on a non-ok response BEFORE parsing, and parses one success body"
    requirement: "FND-04"
    verification:
      - kind: unit
        ref: "src/services/AiService.test.ts (8 tests: 4 non-ok guard-before-parse + 4 success) via npx vitest run"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-14
status: complete
---

# Phase 1 Plan 04: AiService Port (fetch, 4 cloud providers, dormant) Summary

**Ported the plugin's AI provider layer onto platform `fetch` with explicit `response.ok` guards before every `await response.json()`, decoupled from Obsidian via a local `AiSettings` interface, with the local/LAN (Ollama) provider omitted entirely so no cleartext `http://` path ships — dormant, wired to no screen.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-14T18:08:27Z
- **Completed:** 2026-08-14T18:14:00Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- `src/services/ai-types.ts`: minimal `AiSettings` interface (only the 6 fields the service reads) + `AiProviderId` union `'none'|'openai'|'anthropic'|'google'|'custom'` — local/LAN id excluded, named to avoid a TS2440 collision with the ported `interface AiProvider`.
- `src/services/AiService.ts`: faithful port of the 540-line analog with the sole Obsidian coupling (`requestUrl`) swapped for `fetch` across the 4 cloud call sites; every `.json` property read converted to `await response.json()`; an explicit `if (!response.ok) throw` added before each parse; the `OllamaProvider` class, its `'ollama'` id, its registration, and its head-comment reference removed entirely — no `http://` cleartext path lands.
- `src/services/AiService.test.ts`: 8 mocked-fetch tests (one non-ok + one success per provider) proving the ok-guard runs before the parse via a `json` spy asserted `not.toHaveBeenCalled()` on a non-ok response.
- Full gate green: `tsc --noEmit` + `biome check .` + `vitest run` (56 tests across 4 files) all exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the local AiSettings interface** - `6d6bb45` (feat)
2. **Task 2: Port AiService.ts — omit local provider, requestUrl→fetch, .json→await .json(), ok-guards** - `415cc4c` (feat)
3. **Task 3: Mocked-fetch behavioural tests — ok-guard before parse** - `ce53333` (test)

_Task 3 is a `tdd="true"` task, but the implementation (the providers) already landed in Task 2's port; the test file validates the completed port against the behavioural contract, so it is a single `test(...)` commit rather than a separate RED→GREEN pair._

## Files Created/Modified
- `src/services/ai-types.ts` - Local `AiSettings` interface + `AiProviderId` union replacing the unported `../settings` module.
- `src/services/AiService.ts` - Ported fetch-based AI service: 4 cloud providers, ok-guarded async parsing, Obsidian-free and local-provider-free, dormant.
- `src/services/AiService.test.ts` - Mocked-fetch guard-placement + success-parse tests, 2 per provider.

## Decisions Made
- **Ollama omitted entirely** (owner decision, CONTEXT.md 2026-08-14): enforced the `[REJECTED]` mobile-local-AI decision in code, not prose. The removal deleted the analog's only `http://` default, so the `! grep -q 'http://'` gate holds structurally, not by convention. Did NOT re-add per HANDOFF §4 — that would be a decision reversal.
- **`AiProviderId` (not `AiProvider`)**: the analog already declares a load-bearing `interface AiProvider` (~line 149, used at `Map<string, AiProvider>`, `getProvider()`, `getActiveProvider()`); reusing the name for the id union would TS2440-collide. `AiService.ts` imports only `AiSettings` (a `type` import) from `ai-types.ts`, never the union directly.
- **Runtime HTTPS-scheme enforcement on the custom endpoint deferred to Phase 14 (T-1-04)** — not claimed here. This phase lands no cleartext path because the only cleartext source (the local provider) is gone; validating a user-supplied `aiCustomEndpoint` URL scheme is a wire-up-time concern with no UI to attach to yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed `extractContext` unused parameter to `_fileContent`**
- **Found during:** Task 2 (AiService port)
- **Issue:** Biome's `noUnusedFunctionParameters` flagged `fileContent` in `extractContext` (a warning — the parameter is genuinely unused in the analog too, a legacy-vault-shaped artifact). The biome gate still exited 0, but the warning was avoidable noise.
- **Fix:** Prefixed the parameter with `_` (biome's own suggested convention for intentionally-unused params). Signature arity and behaviour unchanged; the function is dormant with no callers.
- **Files modified:** src/services/AiService.ts
- **Verification:** `biome check src/services/AiService.ts` exits 0 with no warnings; `tsc --noEmit` exits 0.
- **Committed in:** `415cc4c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/lint-hygiene)
**Impact on plan:** No scope creep. Semantically identical to the faithful port; only clears a lint warning.

## Issues Encountered
- Initial head-comment wording contained the literal tokens "Obsidian", "response.ok", and "await response.json()", which inflated the `grep -ic obsidian == 0`, `response.ok == 4`, and `await response.json == 4` acceptance counts. Reworded the doc comment ("legacy plugin request helper", "ok-status check", "JSON body parse") to keep the gates measuring only executable code. Similarly, `ai-types.ts` originally said "Obsidian-coupled" in a comment (→ "plugin-coupled") to satisfy `grep -ic obsidian == 0`.
- First test draft used a data-driven `for` loop over the 4 providers, which factored the `rejects` / `not.toHaveBeenCalled` assertions into one shared block — failing the `>= 4` per-provider grep gates. Unrolled into 4 explicit `describe` blocks (one non-ok + one success each), which is also more faithful to the plan's "write two cases per provider" instruction. All 8 tests pass.

## Legacy-Compat / Phase-14 Carry-Forward (ported as-is, NOT fixed here — per plan `<legacy_compat>`)
- **AI-04 redaction target (`AiService.ts` `assemblePrompt`):** the `Logger.debug('AiService', \`Assembled prompt:\n${result}\`)` line emits fully-assembled, contact-derived prompt text. Harmless now (Logger defaults `off`, service dormant); Phase 14 must strip/gate contact content before this can fire in a wired build.
- **Wire-up façade bug (`AiService.generate()` empty-`aiModel` throw vs `CustomProvider`'s `model || this.modelName` fallback):** `generate()` throws on an empty `aiModel` before dispatch, making the CustomProvider default-model fallback unreachable via `generate()`. Faithful-port latent bug; resolve the layering at Phase-14 wire-up. Not fixed here.
- **Markdown-vault-shaped prompt assembly (`extractSection`/`extractContext`/`assemblePrompt`/`DEFAULT_PROMPT_TEMPLATE`):** ported as-is at the import level (Obsidian-free) but still shaped for scraping `##` sections of a contact markdown file. Phase 14 must REPLACE (not extend) this — the app has no markdown files, and `off_limits`/`share_with_ai` gating must sit UNDER the prompt builder.

## Known Stubs
None. The service is intentionally DORMANT (compiles/typechecks, wired to no screen) — this is the plan's explicit FND-04 goal, activated in Phase 14 (AI-04), not a stub obstructing this plan's goal.

## User Setup Required
None - no external service configuration required. (API-key handling / secure-store wiring is Phase 14, out of scope here.)

## Next Phase Readiness
- FND-04 satisfied: the AI transport layer is landed correctly and typechecks standalone. Phase 14 (13-ai / AI-04) can wire it to a settings UI + secure key storage, add HTTPS-scheme enforcement on `aiCustomEndpoint`, replace the vault-shaped prompt assembly, and redact the `assemblePrompt` debug log — all recorded above.
- No blockers introduced. Remaining phase-1 work: plan 01-05.

## Self-Check: PASSED

- FOUND: src/services/ai-types.ts
- FOUND: src/services/AiService.ts
- FOUND: src/services/AiService.test.ts
- FOUND commit: 6d6bb45 (Task 1)
- FOUND commit: 415cc4c (Task 2)
- FOUND commit: ce53333 (Task 3)

---
*Phase: 01-project-scaffold-portable-code*
*Completed: 2026-08-14*
