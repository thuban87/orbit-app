---
phase: 14-ai-message-suggestions
plan: 09
subsystem: ai
tags: [gemini, thinking-budget, token-budget, generationConfig, ai-suggestions, thinkingConfig]

# Dependency graph
requires:
  - phase: 14-ai-message-suggestions
    provides: "neutral AiService adapters (14-02), Compose AI lifecycle (14-05), curated model registry (14-08)"
provides:
  - "resolveTokenBudget(provider, model?) — per-provider, thinking-aware output/reasoning budget policy"
  - "neutral GenerationInput.thinkingBudget concept mapped only by the Gemini adapter to thinkingConfig.thinkingBudget"
  - "Compose sizes each AI request per active provider instead of a flat MAX_OUTPUT_TOKENS"
  - "AI-SPEC §4 formally superseded via ERRATA §0.6 (audit trail intact)"
affects: [ai-message-suggestions, future AI provider additions, reasoning-model curation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-provider budget policy as a pure, node-tested module with single-number tunable constants at the top"
    - "Neutral request concept (thinkingBudget) mapped to a provider field in exactly one adapter; others ignore it"
    - "Spec supersession by append-only ERRATA + inline pointer, never in-place rewrite"

key-files:
  created:
    - src/ai/token-budget.ts
    - src/ai/token-budget.test.ts
  modified:
    - src/services/AiService.ts
    - src/services/AiService.test.ts
    - src/screens/ComposeScreen.tsx
    - src/ai/prompt-template.ts
    - .planning/phases/14-ai-message-suggestions/14-AI-SPEC.md

key-decisions:
  - "Gemini maxOutputTokens = GEMINI_THINKING_HEADROOM (1024) + GEMINI_OUTPUT_ALLOWANCE (512) = 1536, deliberately NOT thinkingBudget+output — the 256 soft cap overruns (~500 measured), so the request must cover ACTUAL thinking with margin PLUS the message (D-02)."
  - "GEMINI_THINKING_BUDGET = 256 (soft reasoning cap, mapped to thinkingConfig.thinkingBudget)."
  - "OpenAI/Anthropic (curated non-thinking chat models): CHAT_OUTPUT_TOKENS = 512, thinkingBudget null (D-04). none/custom: DEFAULT_OUTPUT_TOKENS = 512, thinkingBudget null."
  - "Retired MAX_OUTPUT_TOKENS from prompt-template.ts entirely (ComposeScreen was its sole importer) rather than keeping a fallback — token-budget.ts owns output sizing and carries its own DEFAULT_OUTPUT_TOKENS."
  - "Gemini field verified as generationConfig.thinkingConfig.thinkingBudget against ai.google.dev/api/generate-content (GenerationConfig → thinkingConfig) on 2026-08-22."

patterns-established:
  - "Thinking-aware budgeting: cap reasoning + size output to cover actual reasoning overrun + message allowance."
  - "One-adapter mapping of a neutral optional field, asserted-unchanged for every other adapter."

requirements-completed: [AI-01, AI-02]

coverage:
  - id: D1
    description: "Pure per-provider thinking-aware token budget policy (Gemini reasoning cap + output headroom; OpenAI/Anthropic tuned output; none/custom safe default)."
    requirement: "AI-01"
    verification:
      - kind: unit
        ref: "src/ai/token-budget.test.ts#resolveTokenBudget — per-provider thinking-aware budget"
        status: pass
    human_judgment: false
  - id: D2
    description: "Neutral GenerationInput.thinkingBudget mapped ONLY by the Gemini adapter to generationConfig.thinkingConfig.thinkingBudget; OpenAI/Anthropic/Custom bodies unchanged; C3-M1 payload identity and C2-M5 key-leak invariants preserved."
    requirement: "AI-01"
    verification:
      - kind: unit
        ref: "src/services/AiService.test.ts#neutral thinkingBudget maps to Gemini thinkingConfig only (D-03)"
        status: pass
      - kind: unit
        ref: "src/services/AiService.test.ts#Gemini key-in-URL is never leaked (C2-M5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Compose sizes each AI request via resolveTokenBudget(activeProvider, model); flat MAX_OUTPUT_TOKENS retired; AI-SPEC §4 superseded via ERRATA §0.6 + pointer."
    requirement: "AI-02"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (whole-repo typecheck after wiring + prompt-template retirement)"
        status: pass
      - kind: other
        ref: "grep-guard: resolveTokenBudget present in ComposeScreen; no flat OUTPUT_TOKENS code line remains; ERRATA §0.6 + §4 pointer present"
        status: pass
    human_judgment: false
  - id: D4
    description: "A curated Gemini thinking model returns a COMPLETE, non-truncated draft on the Pixel (the 14-06 empty/mid-sentence failure mode is gone); OpenAI/Anthropic curated models still return complete drafts; no regression to cancel/replace/error paths."
    requirement: "AI-02"
    verification: []
    human_judgment: true
    rationale: "Device-only behavioral proof (release build on the physical Pixel). Thinking-token spend and draft completeness cannot be asserted node-side — no test can observe the provider's actual reasoning behavior. Owner device re-UAT required (Task 3 human-check)."

# Metrics
duration: 6min
completed: 2026-08-22
status: complete
---

# Phase 14 Plan 09: Thinking-Aware Per-Provider Token Budget Summary

> **SUPERSEDED (14-11):** the token budget is REMOVED. The output cap never bounded visible length (the 1,200-code-point post-parse trim does) and starved thinking models. As of 14-11 only Anthropic sends `max_tokens` (its API requires one, set to the model's own catalog maximum); OpenAI/Gemini omit the cap and Gemini omits `thinkingConfig` for its default dynamic thinking. The budget/thinking machinery below is historical.

**Replaces the flat MAX_OUTPUT_TOKENS stopgap with `resolveTokenBudget`, giving Gemini a `thinkingConfig.thinkingBudget` reasoning cap plus output headroom so thinking models stop spending the whole budget on reasoning and emitting empty/truncated drafts.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-22T05:19:29Z
- **Completed:** 2026-08-22T05:26:28Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- New pure, node-tested `src/ai/token-budget.ts`: `resolveTokenBudget(provider, model?)` returns `{ maxOutputTokens, thinkingBudget }` with all numbers as single-edit tunable constants at the top of the file.
- `GenerationInput` gained a neutral optional `thinkingBudget` concept; the Gemini adapter alone maps it to `generationConfig.thinkingConfig.thinkingBudget` (verified against official docs), omitting it when null/undefined. OpenAI/Anthropic/Custom bodies asserted unchanged.
- ComposeScreen's `generate()` dep now sizes each request per active provider via `resolveTokenBudget`; the flat `MAX_OUTPUT_TOKENS` was retired from `prompt-template.ts` (its sole importer).
- AI-SPEC §4's 120-token ceiling formally superseded via a new ERRATA §0.6 entry plus an inline §4 pointer — the original text is annotated, not deleted (audit trail intact).
- Every privacy/egress invariant preserved: no change to the native Custom transport, the PromptContext allowlist, key storage, cancellation (H4), payload identity (C3-M1), or key-in-URL sanitization (C2-M5). The change adds only size/reasoning caps to `generationConfig`; outbound content is byte-identical.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Per-provider budget policy** - `05e842a` (test) → `05702b3` (feat)
2. **Task 2: Neutral thinkingBudget + Gemini thinkingConfig map** - `d34307f` (test) → `d5141cb` (feat)
3. **Task 3: Wire Compose + supersede AI-SPEC §4** - `9cc0b76` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `src/ai/token-budget.ts` - New per-provider thinking-aware budget policy (pure, no I/O). Tunable constants: `GEMINI_THINKING_BUDGET=256`, `GEMINI_THINKING_HEADROOM=1024`, `GEMINI_OUTPUT_ALLOWANCE=512` (⇒ `GEMINI_MAX_OUTPUT_TOKENS=1536`), `CHAT_OUTPUT_TOKENS=512`, `DEFAULT_OUTPUT_TOKENS=512`.
- `src/ai/token-budget.test.ts` - Pins the per-provider contract (Gemini cap non-null + bounded; OpenAI/Anthropic null; custom/none null; model arg inert).
- `src/services/AiService.ts` - `GenerationInput.thinkingBudget?` neutral field; `GoogleProvider.generate` maps a numeric `thinkingBudget` to `generationConfig.thinkingConfig.thinkingBudget`, omits when null/undefined.
- `src/services/AiService.test.ts` - Mocked-fetch tests: Gemini body carries/omits `thinkingConfig`; OpenAI/Anthropic ignore the field; Gemini C3-M1 payload identity with a budget set.
- `src/screens/ComposeScreen.tsx` - `generate()` dep resolves `resolveTokenBudget(s.aiProvider, model)`; passes `maxOutputTokens` + `thinkingBudget`; flat import dropped; temperature comment corrected.
- `src/ai/prompt-template.ts` - Removed `MAX_OUTPUT_TOKENS`; comment now points at `@/ai/token-budget` as the output-sizing owner.
- `.planning/phases/14-ai-message-suggestions/14-AI-SPEC.md` - ERRATA §0.6 + §4 pointer (supersession recorded, not rewritten).

## Gemini field verification
- **Field:** `generationConfig.thinkingConfig.thinkingBudget`
- **Source:** https://ai.google.dev/api/generate-content — `GenerationConfig.FIELDS.thinking_config` → `ThinkingConfig` (fields include `thinkingBudget`).
- **Date verified:** 2026-08-22.

## Final tuned budget constants
| Provider | maxOutputTokens | thinkingBudget |
|---|---|---|
| google (Gemini, thinking) | 1536 (1024 thinking headroom + 512 output) | 256 (soft cap) |
| openai | 512 | null |
| anthropic | 512 | null |
| none / custom | 512 | null |

Seeded from the 14-06 device measurements (output ≈512, thinkingBudget ≈256; actual thinking overran 256→~500, up to 702–886 for a fuel-rich contact). Owner may retune against the Task 3 device re-UAT.

## Decisions Made
- **Retire, not keep, the flat constant.** `MAX_OUTPUT_TOKENS` was deleted from `prompt-template.ts` because ComposeScreen was its only importer and `token-budget.ts` carries its own `DEFAULT_OUTPUT_TOKENS`. Cleaner than a dangling fallback.
- **Gemini output = thinking-headroom + allowance, not budget + allowance.** The `thinkingBudget` is a SOFT cap Gemini overruns; sizing to `budget + output` would still truncate. Encoded as two constants that sum into `GEMINI_MAX_OUTPUT_TOKENS`.
- **No reasoning control for OpenAI/Anthropic.** The curated frontier (Plan 08: gpt-4.x-class, Sonnet/Haiku non-thinking, Gemini 3.x) is non-thinking for OpenAI/Anthropic, so only a tuned output allowance is applied; the file documents that a per-provider reasoning control must be added — verified against that provider's then-current docs — if a reasoning model is ever curated (D-04).

## Deviations from Plan

None - plan executed exactly as written. (No auto-fixes were required; all three tasks landed as specified.)

## Issues Encountered
- **Context7 MCP + `ctx7` CLI both unavailable** in this environment. Resolved by verifying the Gemini `thinkingConfig.thinkingBudget` field directly against the official reference page (ai.google.dev/api/generate-content) via `curl` — confirmed the field name, nesting under `generationConfig`, and current status (2026-08-22).
- **Biome noise on pre-existing lines (out of scope).** `src/screens/ComposeScreen.tsx` has pre-existing biome lint (`AI_REQUEST_TIMEOUT_MS` unused import), import-sort, and format deviations that predate this plan; the project enforces no biome gate (no lint/format npm script, no pre-commit hook). Left untouched per the scope boundary — my additions match the file's existing style, and `tsc --noEmit`, the full vitest suite (1280 tests), and `check:colors` are all green. `src/services/AiService.test.ts` biome format also wrapped two pre-existing long lines when I formatted my additions (noted in the Task 2 commit body).

## Verification Results (node-level, this box)
- `npm test` (full vitest): **97 files / 1280 tests passed**.
- Plan suite `npx vitest run src/ai/token-budget.test.ts src/services/AiService.test.ts src/services/ai-service-guards.test.ts`: **49 passed** (3 files).
- `npx tsc --noEmit`: clean.
- `npm run check:colors`: clean.
- Acceptance greps: `resolveTokenBudget` in ComposeScreen = 3; flat-cap code lines = 0; ERRATA §0.6 + `token-budget.ts` refs present.
- `npx biome check` on the three new/policy files (`token-budget.ts`, `token-budget.test.ts`, `AiService.ts`, `AiService.test.ts`): clean.

## Next Phase Readiness
- Node-level work is complete and green.
- **Owner device re-UAT is the remaining gate (D4, Task 3 human-check):** on the Pixel release build, select a curated Gemini thinking model and request a suggestion — expect a complete, non-truncated draft (no empty draft, no mid-sentence cutoff), and confirm OpenAI/Anthropic curated models still return complete drafts with no regression to cancel/replace/error paths. Retune the `token-budget.ts` constants if the device shows truncation.

## Self-Check: PASSED
- `src/ai/token-budget.ts` — FOUND
- `src/ai/token-budget.test.ts` — FOUND
- `.planning/phases/14-ai-message-suggestions/14-09-SUMMARY.md` — FOUND (this file)
- Commits `05e842a`, `05702b3`, `d34307f`, `d5141cb`, `9cc0b76` — all present in `git log`.

---
*Phase: 14-ai-message-suggestions*
*Completed: 2026-08-22*
