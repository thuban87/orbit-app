---
phase: 14-ai-message-suggestions
plan: 10
subsystem: ai
tags: [ai, model-picker, litellm, catalog, refresh, cache, seed, local-first, settings, tdd, gap-closure]
status: complete

# Dependency graph
requires:
  - phase: 14-02
    provides: AiService provider adapters + listModels ModelDiscovery contract (bare-id catalog, free-text fallback)
  - phase: 14-04
    provides: Settings AI section + settings-ai-logic pure helpers (discoverModelsForField, model view-state)
  - phase: 14-08
    provides: the hand-curated frontier arrays this plan REPLACES (dropped the owner's LiteLLM-sourcing requirement)
provides:
  - src/ai/model-catalog-filter.ts — pure LiteLLM filter/map (filterLiteLLMCatalog) + LITELLM_MODELS_URL + ModelCatalog type
  - src/ai/model-registry.ts — catalog-driven registry (modelsFor/resolveActiveCatalog/matchesFrontier/filterToFrontier) + FRONTIER_PATTERNS tunable + SEED_CATALOG
  - src/ai/model-catalog-cache.ts — user-instigated refresh (plain public GET) + loadCachedCatalog (injectable I/O)
  - src/ai/model-catalog-storage.ts — expo-file-system binding (ai/model-catalog.json)
  - src/ai/model-registry.seed.generated.ts — bundled LiteLLM seed snapshot
  - scripts/gen-models.ts + npm run gen:models — regenerate the seed on this dev box
  - src/stores/ai-model-prefs-store.ts — persisted Frontier/All toggle (AsyncStorage)
  - Settings AI Model section — Frontier/All Switch + Refresh-models button, picker renders from the cache-or-seed catalog
affects: [14-08, settings-screen, ai-model-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Model list SOURCED from LiteLLM's published catalog (never hand-typed) — a maintained, client-refreshable source (owner requirement 14-08 dropped)"
    - "Bundled seed + on-device runtime cache: seed is the offline/first-run fallback, cache overrides once the user refreshes (resolveActiveCatalog)"
    - "User-instigated network only: the LiteLLM fetch fires on an explicit tap, never on a read path/mount/launch (local-first). Cache reads are local-file, allowed on a read path"
    - "Plain public fetch (no key, no user/contact data) for the public catalog file — deliberately NOT the orbit-secure-fetch Custom transport"
    - "Frontier scope = a short set of family GLOBS (FRONTIER_PATTERNS); exact ids always come from the catalog — the only hand-maintained knob"
    - "Device-local display toggle persisted via AsyncStorage prefs store, NOT a SQLite migration (mirrors dashboard-prefs-store)"
    - "Pure filter/registry + injectable-I/O cache; expo-file-system isolated in a device-only binding (node tests never touch native)"

# Key files
key-files:
  created:
    - src/ai/model-catalog-filter.ts
    - src/ai/model-catalog-filter.test.ts
    - src/ai/model-catalog-cache.ts
    - src/ai/model-catalog-cache.test.ts
    - src/ai/model-catalog-storage.ts
    - src/ai/model-registry.seed.generated.ts
    - src/stores/ai-model-prefs-store.ts
    - scripts/gen-models.ts
  modified:
    - src/ai/model-registry.ts (rewritten — hand-curated arrays removed)
    - src/ai/model-registry.test.ts (rewritten for the catalog-driven API)
    - src/screens/settings-ai-logic.ts (curatedModelsFor removed; discovery is scope-aware)
    - src/screens/settings-ai-logic.test.ts
    - src/screens/SettingsScreen.tsx (scope Switch + Refresh button + cache load)
    - package.json (gen:models script)

# Metrics
metrics:
  duration: ~1h
  completed: 2026-08-22
---

# Phase 14 Plan 10: LiteLLM-Sourced Model Catalog Summary

Replaced 14-08's hand-typed frontier arrays with a client-refreshable, LiteLLM-sourced model catalog plus a persisted "Frontier only / All models" toggle — restoring the owner's requirement that the model list come from LiteLLM's maintained catalog, not a hand list that goes stale within a release.

## The LiteLLM source (verified live on 2026-08-22)

- **URL:** `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`
- **Shape confirmed against the live file** (HTTP 200, ~1.8 MB, **3111** keys): a JSON object keyed by model id. Each value is an object; a reserved `sample_spec` key documents the schema (ignored).
- **Fields actually confirmed and used:**
  - `mode` — string. Observed values include `chat` (2380), `image_generation`, `embedding`, `rerank`, `audio_transcription`, `responses`, `realtime`, `completion`, `audio_speech`, `video_generation`, `moderation`, etc. **We keep only `mode === "chat"`.**
  - `litellm_provider` — string. Confirmed counts: `openai`=226, `anthropic`=26, `gemini`=80, `vertex_ai`=18, `vertex_ai-language-models`=45, `azure`=219 (azure carries no Gemini chat ids).
  - `deprecation_date` — string `YYYY-MM-DD` present on *some* entries (the schema documents this exact format). **We drop any entry whose date is at/before now.**
  - Cost/context fields (`input_cost_per_token`, `max_input_tokens`, …) — present but **not read**.

## Filter / map rules (all node-tested)

1. Keep only `mode === "chat"`.
2. Map provider: `openai`→openai, `anthropic`→anthropic; the **Gemini family** (`gemini` native, plus `vertex_ai` / `vertex_ai-language-models` variants of the same id) → google, native preferred on dedup. A vertex-hosted non-Gemini model (e.g. Claude on vertex) is **not** a Google model.
3. Drop deprecated (`deprecation_date <= now`).
4. Drop OpenAI `ft:` fine-tune **template** rows (12 in the live file) — not directly-selectable models; a user's own fine-tune id stays reachable via free-text.
5. Strip a leading `provider/` prefix so ids are **bare** (the Gemini adapter builds `models/<id>` and requires bare ids; confirmed in AiService).
6. De-duplicate case-insensitively, first-seen order/casing preserved.

**Models that survived the filter (seed snapshot, 2026-08-22):** **openai = 71, anthropic = 17, google = 34.** Frontier-scope intersection at seed time: openai 26, anthropic 7, google 12.

## Cache + seed mechanism

- **Bundled seed** `src/ai/model-registry.seed.generated.ts` — generated by `npm run gen:models` (runs on this box, network only; committed). The offline/first-run picker source.
- **Runtime cache** `ai/model-catalog.json` under `Paths.document` (expo-file-system) — a non-relational JSON cache matching the repo's existing pattern (photos live under the same document dir). **Deliberately not a SQLite migration** — it holds no contact data and is fully re-derivable.
- **Precedence:** `resolveActiveCatalog(cached)` returns cache ?? seed. The screen loads the cache once on mount (local file read — allowed on a read path), and a user Refresh overwrites it. A missing/corrupt cache silently falls back to the seed.
- **Refresh transport:** a plain public `fetch` GET (no key, no headers, no body, no user/contact data) — **not** the `orbit-secure-fetch` Custom transport. Fires **only** on the user's "Refresh models" tap. A network error / non-2xx / all-empty response throws and leaves the prior cache intact; free-text entry always still works.

## Toggle + frontier constant

- **`FRONTIER_PATTERNS`** (single named constant, top of `model-registry.ts`, CLAUDE.md tunable-constants rule): `openai: ["gpt-5*"]`, `anthropic: ["claude-*-5", "claude-haiku-4-5"]`, `google: ["gemini-3*"]`. Glob `*` = any run. Exact ids always come from the catalog; only these family patterns are hand-maintained.
- **Persisted preference** `useAiModelPrefs.modelScope` (AsyncStorage, default `frontier`), surfaced as a Switch in AI settings. The picker re-renders live from the cached catalog per selection: **All** = the full deprecation-filtered chat set; **Frontier only** = the `FRONTIER_PATTERNS` intersection.

## Device UAT must confirm

- AI settings shows the model chips **with no key and no network** (seed), for OpenAI/Anthropic/Google.
- The Frontier/All Switch flips the chip set and the choice survives an app restart.
- "Refresh models" (with network) updates the list and the choice survives going offline afterwards (cache persists); offline with no prior refresh still shows the seed.
- Free-text entry still works when a provider is selected, regardless of scope/refresh.
- (Data-layer correctness is not UI-observable — trust the node tests for the filter/dedup/deprecation rules.)

## Deviations from Plan

This was a spec-driven gap fix (no PLAN.md). Two judgment calls, both documented above and covered by tests, taken under Rule 2 (correctness of the sourced catalog):

1. **[Rule 2] Drop OpenAI `ft:` fine-tune template rows.** They are `mode:chat` but are not directly-selectable base models (a user's own fine-tune id is a free-text entry). Structural prefix drop, not a hand-maintained blocklist.
2. **[Rule 2] "All models" is exactly LiteLLM's `mode:chat` set** — I did *not* re-introduce a hand-typed non-chat token blocklist (the 14-08 approach). A few specialty chat-mode ids LiteLLM itself classifies as `chat` (e.g. `gemini-*-computer-use`, `gemini-robotics-*`) therefore appear in All scope; Frontier scope hides them. Re-adding a hand blocklist would recreate the staleness the owner objected to.

No architectural changes, no auth gates, no changes to the AI generation egress-privacy controls (orbit-secure-fetch / PromptContext allowlist / first-send ack / key storage were not touched).

## Verification (real output)

- `npm test` → **Test Files 99 passed (99), Tests 1303 passed (1303)** (48 in the four new/rewritten suites).
- `npx tsc --noEmit` → clean (exit 0).
- `npm run check:colors` → clean (exit 0).
- `npx biome check` on all touched files → clean.

## Self-Check: PASSED
