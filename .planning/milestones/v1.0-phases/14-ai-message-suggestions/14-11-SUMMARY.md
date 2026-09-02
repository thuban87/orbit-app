---
phase: 14-ai-message-suggestions
plan: 11
subsystem: ai
tags: [ai, model-registry, frontier-tiers, token-budget, litellm, thinking-models, tdd]
status: complete

# Dependency graph
requires:
  - phase: 14-10
    provides: "LiteLLM-sourced ModelCatalog + cache/refresh + Frontier/All scope"
  - phase: 14-09
    provides: "resolveTokenBudget (per-provider thinking-aware cap) — REMOVED here"
  - phase: 14-02
    provides: "neutral AiService provider adapters + GenerationInput contract"
provides:
  - "FRONTIER_TIERS knob + latest-per-tier frontier resolution (<=3 ids per provider)"
  - "ModelCatalog.limits — per-model max output sourced from LiteLLM"
  - "resolveMaxOutputTokens(provider, model, catalog) — catalog-aware, cap removed"
affects: [14-06, model-picker, ai-suggestions, compose-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frontier = named tier keywords (the single knob) + a version comparator that resolves the LATEST catalog id per tier; ids never hand-listed"
    - "Provider output field OMITTED unless required (Anthropic max_tokens); size fields decoupled from byte-identical prompt payload"
    - "Spec supersession by append-only ERRATA (§0.7), never in-place rewrite"

key-files:
  created: []
  modified:
    - src/ai/model-registry.ts
    - src/ai/model-registry.test.ts
    - src/ai/model-catalog-filter.ts
    - src/ai/model-catalog-filter.test.ts
    - src/ai/model-catalog-cache.ts
    - src/ai/model-registry.seed.generated.ts
    - src/ai/token-budget.ts
    - src/ai/token-budget.test.ts
    - src/services/AiService.ts
    - src/services/AiService.test.ts
    - src/screens/ComposeScreen.tsx
    - src/screens/settings-ai-logic.test.ts

key-decisions:
  - "Frontier narrowed from family globs to exactly 3 latest-per-tier ids per provider, resolved from the live catalog (auto-updates on refresh; never hardcoded)"
  - "Artificial output cap removed: only Anthropic sends max_tokens (its API requires it) = the model's own catalog maximum; OpenAI/Gemini omit it; Gemini also omits thinkingConfig for its default dynamic thinking"
  - "ModelCatalog carries a per-provider limits map (max_output_tokens preferred, legacy max_tokens fallback)"

metrics:
  duration: "~50 min"
  completed: 2026-08-22
  tasks: 3
  files-changed: 12
---

# Phase 14 Plan 11: Frontier Tiers + Output-Cap Removal Summary

Narrowed the AI "Frontier only" picker to exactly three latest-per-tier ids per provider (resolved live from the LiteLLM catalog, never hardcoded) and removed the artificial output-token cap — only Anthropic still sends `max_tokens` (its API requires one), set to the selected model's own catalog maximum, so thinking models (Gemini) stop truncating drafts.

## What shipped

**Change 1 — Frontier = 3 latest-per-tier per provider (`model-registry.ts`).**
Replaced the loose `FRONTIER_PATTERNS` globs (which returned 26/7/12 models) with a `FRONTIER_TIERS` keyword knob (the single hand-maintained surface, top-of-file) plus a version comparator. Per tier: match by an `include` keyword (+ optional `exclude` so `flash` never captures `flash-lite`), require a parseable version, then pick the winner by — highest version, then undated alias over its dated snapshot, then shorter id (base over a `-customtools`/variant suffix), then lexicographic. Previews are eligible; `-latest` aliases with no version never win. `modelsFor(frontier)` and `filterToFrontier` now return ≤3 per-tier winners in tier order; "All models" is unchanged.

**The comparator resolves the committed seed to exactly the pinned ids** (asserted in `model-registry.test.ts`):
- Gemini: `gemini-3.1-pro-preview`, `gemini-3.7-flash`, `gemini-3.5-flash-lite`
- Anthropic: `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5`
- OpenAI: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`

**Change 2 — Output cap removed (`token-budget.ts`, `AiService.ts`, `ComposeScreen.tsx`).**
- `ModelCatalog` gained a per-provider `limits` map; `filterLiteLLMCatalog` reads each entry's max output (canonical `max_output_tokens`, legacy `max_tokens` fallback); the seed was regenerated via `npm run gen:models` (openai=71 anthropic=17 google=34).
- `resolveTokenBudget` → `resolveMaxOutputTokens(provider, model, catalog)`, returning `number | undefined`: Anthropic → the model's own catalog max (fallback 8192 for free-text/absent); OpenAI/Gemini/none → `undefined` (omit); Custom → 8192 (high, non-binding). 14-09's `GEMINI_THINKING_*` / `CHAT_OUTPUT` constants and the `thinkingBudget` concept were deleted.
- Adapters omit their output field when unset: Gemini also omits `thinkingConfig` (default dynamic thinking); OpenAI omits `max_completion_tokens`; Anthropic always sends a numeric `max_tokens` (belt-and-braces constant if ever absent); Custom omits `max_tokens` when unset. `GenerationInput.maxOutputTokens` is now optional; `thinkingBudget` removed.
- ComposeScreen resolves the max from the active catalog (cache-overrides-seed, loaded best-effort on focus). The outbound prompt payload is byte-identical — only generation-config size fields changed. No egress/privacy control was touched (orbit-secure-fetch, PromptContext allowlist, response.ok guards, first-send ack ordering, key storage all unchanged).

**Change 3 — Doc sync.** AI-SPEC ERRATA §0.7 (append-only) records that the flat cap AND 14-09's thinking budget are both superseded; 14-08/14-09 summaries carry one-line supersession notes; 14-VALIDATION gained a pending device-UAT checklist (new picker + full-length Gemini drafts), nothing marked device-verified.

## External facts verified (2026-08-22, live sources)

- **Anthropic `max_tokens` is REQUIRED and cannot be omitted** — confirmed via the claude-api skill (Messages API mandatory parameter, shown in every example + the max_tokens pitfall). This is why Anthropic is the sole provider still sending a ceiling.
- **LiteLLM max-output field** — the live `model_prices_and_context_window.json` carries BOTH `max_output_tokens` (canonical) and legacy `max_tokens` per entry (equal values, e.g. claude-opus-5 = 128000, claude-haiku-4-5 = 64000, gpt-5.6-sol = 128000, gemini tiers = 65536). The filter prefers `max_output_tokens`, falls back to `max_tokens`.
- **Gemini omitting `maxOutputTokens`/`thinkingConfig`** — ai.google.dev/gemini-api/docs/thinking: "Gemini models engage in dynamic thinking by default, automatically adjusting the amount of reasoning effort"; `maxOutputTokens` is an optional GenerationConfig int (omitting = model default). So omitting both yields the model's default dynamic thinking with no output cap.

## Verification (real command output)

- `npm test` → **Test Files 99 passed (99); Tests 1305 passed (1305)**
- `npx tsc --noEmit` → exit 0 (clean, whole-repo)
- `npm run check:colors` → exit 0
- `npx biome check` on the 10 touched non-ComposeScreen files → clean; ComposeScreen has only one PRE-EXISTING `noArrayIndexKey` (inspector-truncations map, untouched by 14-11 — logged in `deferred-items.md`).

## Device UAT must confirm (owner's pending pass)

Picker shows exactly 3 frontier chips per provider; All toggle expands to the full set; Refresh updates from LiteLLM (newer version re-resolves the chip with no code change); offline falls back to the seed; free-text still works. Full-length, non-truncated drafts across all 3 Gemini tiers — especially **Pro** (the tier most prone to spending budget on reasoning) — plus Anthropic (carries the catalog `max_tokens`), OpenAI, and Custom.

## Deviations from Plan

**1. [Rule 1 - Test correctness] Updated two `settings-ai-logic.test.ts` cases to the new frontier semantics.**
- Found during: Change 1 verification (`npm test`).
- Issue: two `discoverModelsForField` tests asserted the OLD glob behavior (order-preserving filter; "2.5-flash is non-frontier"). Under latest-per-tier resolution, `filterToFrontier` returns tier-ordered winners and a lone 2.5-flash IS the flash winner.
- Fix: updated the mixed-list test to expect `[gemini-3.1-pro-preview, gemini-3.5-flash]` (tier order) and the degrade-to-manual test to use ids with no resolvable tier.
- Commit: 61da915.

**2. [Scope boundary] Pre-existing biome `noArrayIndexKey` in ComposeScreen left unfixed.**
- Found during: biome check. The error predates 14-11 (line 558 in HEAD) and is unrelated to the model-layer change. Logged in `deferred-items.md`; not fixed per the scope boundary.

**Total deviations:** 1 auto-fixed (test correctness), 1 out-of-scope logged. **Impact:** none on shipped behavior; both node-verified.

## Self-Check: PASSED

- `git log` shows all 14-11 commits present (b0d7182, 7d28c1c, d026395, 61da915, 56122b5, 52157e5, 98703b4, c546559).
- `npm test` / `tsc` / `check:colors` all green (real output above).
- Modified files all exist on disk; seed regenerated and committed.
