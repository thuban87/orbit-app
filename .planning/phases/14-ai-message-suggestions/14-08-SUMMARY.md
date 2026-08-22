---
phase: 14-ai-message-suggestions
plan: 08
subsystem: ai
tags: [ai, model-picker, curation, local-first, settings, view-state, tdd, gap-closure]
status: complete

# Dependency graph
requires:
  - phase: 14-02
    provides: AiService provider adapters + listModels ModelDiscovery contract (raw catalog, free-text fallback)
  - phase: 14-04
    provides: Settings AI section + settings-ai-logic pure helpers (discoverModelsForField, curated view-state consumers)
  - phase: 14-06
    provides: device-UAT finding (deprecated gemini-2.5-flash 404s; catalog lists tts/image/embedding/robotics/lyria)
provides:
  - src/ai/model-registry.ts — bundled curated frontier CHAT model list per provider (bundledModelsFor) + frontier filter (filterToFrontier); node-pure, zero I/O
  - curatedModelsFor(provider) in settings-ai-logic — the screen's DEFAULT list source (no key, no network)
  - frontier-filtered discovery — discoverModelsForField(provider, listModels) narrows the raw catalog to the curated set, degrading to free-text when empty
  - Settings AI Model section — curated chips as the default picker; Discover + free-text demoted under an "Advanced" disclosure
affects: [14-06, settings-screen, ai-model-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bundled curated allowlist as node-pure static data — the default picker path makes zero network calls (local-first, D-01)"
    - "Curation (not runtime metadata filtering) is authoritative for hiding deprecated models — listModels metadata does not flag deprecation (D-02)"
    - "Discovery results intersect the curated frontier set (filterToFrontier); free-text stays the escape hatch for anything not curated (D-04)"
    - "Tunable per-provider arrays at top-of-file so refreshing a model list is a single-array edit (CLAUDE.md tunable-constants convention, D-06)"

key-files:
  created:
    - src/ai/model-registry.ts
    - src/ai/model-registry.test.ts
  modified:
    - src/screens/settings-ai-logic.ts
    - src/screens/settings-ai-logic.test.ts
    - src/screens/SettingsScreen.tsx

decisions:
  - "filterToFrontier is a case-insensitive, order-preserving, de-duplicating INTERSECTION of discovery with the curated allowlist — the most maintainable reading of D-04 ('aligns its results with the curated frontier'). Consequence: discovery can only ever confirm which curated models a key can reach; genuinely-new models arrive via free-text until curated."
  - "Discovered chips render under Advanced with a distinct settings-ai-discovered-* testID (not settings-ai-model-*) to avoid duplicate testIDs, since post-filter discovery is always a subset of the curated chips already shown."
  - "Gemini Pro tier pinned to gemini-3.1-pro-preview: no STABLE 3.x Pro exists yet (only -preview slugs), and the 2.5 line is the UAT-dead one. Preview volatility is covered by the discovery + free-text escape hatches."
  - "The minimal onDiscoverAiModels call-site signature fix was folded into the Task 2 commit (not Task 3) so every commit typechecks."

metrics:
  tasks: 3
  duration_min: 55
  completed: 2026-08-22
---

# Phase 14 Plan 08: Curated Frontier Model Picker Summary

> **SUPERSEDED (14-10, then 14-11):** the hand-curated frontier arrays were replaced by the LiteLLM-sourced catalog (14-10), and the frontier filter narrowed to exactly three latest-per-tier ids per provider (14-11). The curation approach recorded below is historical.

Replaced the raw provider catalog in the AI model picker with a bundled, node-pure curated frontier CHAT-model list per provider, so the default picker needs no API key and no network call and can never offer a deprecated or non-chat model. Dynamic discovery and free-text survive as advanced escape hatches, with discovery now intersected against the same curated frontier set.

## What shipped

- **`src/ai/model-registry.ts` (new, node-pure bundled data).** `bundledModelsFor(provider)` returns a frozen, ordered curated frontier chat list for `openai`/`anthropic`/`google` and an empty list for `none`/`custom`. `filterToFrontier(provider, discovered)` intersects a raw discovered catalog with the curated set — case-insensitive, order-preserving, de-duplicated. The module imports only the `AiProviderId` type; it performs no I/O and never reaches the network (grep-enforced by the test), so the default list path is local-first.
- **`src/screens/settings-ai-logic.ts`.** Added `curatedModelsFor(provider)` (delegates to the registry) as the screen's default list source. `discoverModelsForField` now takes the active provider id and runs discovered ids through `filterToFrontier` before choosing `list` vs `manual`; an empty post-filter result degrades to `{kind:'manual'}` exactly like an unavailable discovery, preserving the advisory C4-M1 contract. Free-text is never blocked.
- **`src/screens/SettingsScreen.tsx`.** The cloud-provider Model row renders `curatedModelsFor(aiProvider)` as the default chip picker (visible immediately on provider select, no key, no network). Discover + the free-text input moved under an `Advanced options` disclosure (`aiModelAdvancedOpen`), collapsed by default and reset on provider switch. Discover stays key-gated and shows frontier-filtered results as distinct `settings-ai-discovered-*` chips; free-text still writes `aiModel` directly. Key/endpoint/template/Save rows untouched; all colours via theme tokens.

## Curated model IDs — D-06 verification (sources + date)

All IDs verified against each provider's live/official model source on **2026-08-22** (build-time documentation check only — no provider API was called from code):

| Provider | Curated frontier chat IDs (flagship / mid / small) | Source verified against |
|---|---|---|
| OpenAI | `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` | openai-python `src/openai/types/shared/chat_model.py` (main branch) — authoritative `ChatModel` enum; GPT-5.x is the current line, `gpt-4o`/`o1` are prior-tier. |
| Anthropic | `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5` | anthropic-sdk-python `src/anthropic/types/model.py` (main branch) — current `Model` enum. |
| Google | `gemini-3.7-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview` | ai.google.dev `/gemini-api/docs/models` + `/deprecations` — Gemini 3.x is the current stable lineup; `gemini-2.5-flash`/`-flash-lite` (the UAT-dead ids) explicitly excluded. |

Notes:
- **The UAT-dead Gemini ids are excluded by construction** and a test asserts they are absent from the curated `google` list.
- **`-latest` aliases were considered** (Google publishes `gemini-flash-latest`) but explicit current IDs were chosen for clarity and verifiability; the discovery + free-text escape hatches absorb point-deprecation drift, and refreshing a list is a single top-of-file array edit.
- **Gemini Pro** is pinned to a `-preview` slug because no stable Gemini 3.x Pro exists yet; the 2.5 Pro line was avoided given the 2.5 flash deprecation.

## Verification (real command output)

- `npx vitest run` (full suite): **96 test files, 1269 tests passed, 0 failed** (baseline before this plan: 95 files / 1256 tests — this plan adds the 10-test `model-registry.test.ts` and net-new `settings-ai-logic` discovery/curation tests).
- `npx vitest run src/ai/model-registry.test.ts src/screens/settings-ai-logic.test.ts`: **passed** (25 tests).
- `npx tsc --noEmit`: **exit 0, clean.**
- `npm run check:colors`: **exit 0, clean** (no hardcoded colour introduced).
- Biome: `src/ai/model-registry.ts`, `src/ai/model-registry.test.ts`, `src/screens/settings-ai-logic.ts`, `src/screens/settings-ai-logic.test.ts` are fully clean. `src/screens/SettingsScreen.tsx` is formatter-clean and lint-clean; see Deferred Issues for the one pre-existing item.
- Purity/boundary greps (from the plan's acceptance criteria): `model-registry.ts` no-network grep = **0**; `settings-ai-logic.ts` `@/ai/prompt-template` grep = **0**; `curatedModelsFor` occurrences in `SettingsScreen.tsx` = **2**.

## TDD gates

- Task 1 (registry): RED — `model-registry.test.ts` failed with `Cannot find package '@/ai/model-registry'`; GREEN — module created, 10 tests pass.
- Task 2 (settings logic): RED — 3 tests failed (`curatedModelsFor is not a function`; filtered-discovery expectation); GREEN — implementation added, 15 tests pass.
- Task 3 (screen): render-layer change, no Node test path (C2-M4) — verified via tsc + check:colors + the logic/registry suites; device re-UAT is the owner-gated step (below).

## Deviations from Plan

### Auto-fixed / process

**1. [Rule 3 - Blocking] Call-site signature fix folded into Task 2.** `discoverModelsForField` gained a leading `provider` parameter (Task 2), which breaks the `SettingsScreen.onDiscoverAiModels` call site the plan assigned to Task 3. To keep every commit typechecking, the minimal one-line call-site update landed in the Task 2 commit; the full Model-section restructure remained Task 3. No behavioural difference from the plan.

Otherwise the plan executed as written.

## Deferred Issues

- **Pre-existing Biome `organizeImports` assist diff in `SettingsScreen.tsx`** (the `@/services/ai-key-store` / `ai-types` / `AiService` import-group ordering). This diff exists in the committed file prior to this plan and was not introduced here — the newly-added `curatedModelsFor` import is placed in the file's existing case-insensitive order. Left untouched per the executor SCOPE BOUNDARY (do not churn unrelated lines); the project's history shows this ordering is tolerated. Logged for the owner rather than auto-reordered.

## Known Stubs

None. The per-provider curated arrays are intentional bundled data (documented as the single curation source of truth), not placeholders; the `TextInput` placeholder is a normal input hint, not a data stub.

## Threat Flags

None. This plan changes only which model IDs are offered — bundled in-app data plus a pure filter. It introduces no network endpoint, auth path, file access, or schema change, and does not touch the native egress guard, the PromptContext allowlist, the Custom-endpoint validator, or key storage. Covered by the plan's existing register entries T-14-20 (registry drift — mitigated by D-06 verification + free-text/discovery escape hatches), T-14-21 (default list path is pure static data, no key/egress), and T-14-SC (no package install).

## Owner-gated follow-up (NOT done here — separate step)

Device re-UAT on the Pixel (14-06 scope, desktop-build-pipeline): confirm that selecting OpenAI / Anthropic / Gemini shows the curated frontier chips with NO key entered and no network, that Discover + free-text live under Advanced, and that picking a curated Gemini model lands a suggestion end-to-end (no "Couldn't draft a message."). Node-level evidence above is green; on-device evidence is the owner's blocking checkpoint.

## Self-Check: PASSED

- Created files present: `src/ai/model-registry.ts`, `src/ai/model-registry.test.ts`, `.planning/phases/14-ai-message-suggestions/14-08-SUMMARY.md`.
- Modified files present: `src/screens/settings-ai-logic.ts`, `src/screens/settings-ai-logic.test.ts`, `src/screens/SettingsScreen.tsx`.
- Commits present in git: `1f2b648` (Task 1), `0e63ab6` (Task 2), `5b1d028` (Task 3).
