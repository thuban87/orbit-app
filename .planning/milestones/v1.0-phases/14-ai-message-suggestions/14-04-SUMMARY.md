---
phase: 14-ai-message-suggestions
plan: 04
subsystem: ai
tags: [privacy, opt-in, custom-fields, settings, secure-store, view-state, tdd]
status: complete

# Dependency graph
requires:
  - phase: 14-01
    provides: app-settings-dao AI config columns + ai_ack_* read-only, ai-key-store (SecureStore), validateCustomEndpoint
  - phase: 14-02
    provides: AiService provider adapters + listModels ModelDiscovery contract (free-text fallback)
  - phase: 14-03
    provides: ResolvedPrompt shape (immutable, prompt===inspectorDisplay===payload), readPromptContext reads share_with_ai=1 defs
  - phase: 03 (custom fields)
    provides: field-defs-dao writer idioms (inWriteTransaction + assertOneChange), FieldDefForm / CustomFieldsScreen
provides:
  - Per-field share_with_ai opt-in with a working create AND edit persistence path (H7 fixed)
  - updateFieldShareWithAi — dedicated DEFS-row flag writer (shared mutex, changes===1 guard)
  - field-def-form-logic — pure hydrateFieldDefDraft / draftToFieldFields (node-tested, no renderer)
  - Settings AI section — provider/model/template/Custom-endpoint config + masked SecureStore key entry
  - settings-ai-logic — pure helpers Compose (Plan 05) consumes: buildInspectorViewState, buildProviderAckViewState, discoverModelsForField, validateEndpointForSave, buildAiSettingsPatch
affects: [14-05, 14-06, compose-screen, prompt-inspector, acknowledgement-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correctness-critical view-state extracted to node-testable *-logic.ts (Vitest is render-free — C2-M4)"
    - "Dedicated single-column DEFS-row flag writer mirrors renameField/changeFieldOptions (own inWriteTransaction + assertOneChange)"
    - "Pure inspector/ack builders ACCEPT a ResolvedPrompt and return view-state referencing the SAME immutable strings — never rebuild a prompt (no resolver import)"
    - "Non-secret settings patch builder that structurally cannot carry a key; API key routed only to ai-key-store, probed presence-only, never rendered/persisted"

key-files:
  created:
    - src/components/field-def-form-logic.ts
    - src/components/field-def-form-logic.test.ts
    - src/screens/settings-ai-logic.ts
    - src/screens/settings-ai-logic.test.ts
  modified:
    - src/components/FieldDefForm.tsx
    - src/db/field-defs-dao.ts
    - src/db/field-defs-dao.test.ts
    - src/screens/CustomFieldsScreen.tsx
    - src/screens/SettingsScreen.tsx

decisions:
  - "Chose a dedicated updateFieldShareWithAi sibling writer over extending updateFieldCuration's arity — keeps the curation signature/callers stable and matches the existing one-column-per-writer idiom (renameField, changeFieldOptions)."
  - "handleEdit gains a shareChanged diff routed AFTER the interactive type/options pre-flight gate, preserving the all-or-nothing-on-cancel ordering (WR-03)."
  - "buildAiSettingsPatch has no code path that copies apiKey into the patch — the no-leak contract is structural, not a runtime filter (T-14-12)."
  - "Model discovery is advisory: empty list, manual result, OR a thrown error all fall back to free-text (C4-M1); Custom is always manual."
  - "The API key UI shows a presence-only 'saved' flag (getKey() !== null), never the value; entry clears immediately after setKey."
  - "settings-ai-logic imports only the ResolvedPrompt/TruncationNotice TYPES and validateCustomEndpoint — never the resolver (prompt-template); the exact-prompt first-send gate + ai_ack_* write stay in Compose/Plan 05 (H5)."

metrics:
  duration_min: 8
  tasks_completed: 2
  files_created: 4
  files_modified: 5
  tests_added: 24
  completed: 2026-08-21
---

# Phase 14 Plan 04: Intentional AI Sharing + Provider Setup Summary

Per-field `share_with_ai` opt-in now persists on BOTH create and edit (the H7 silent-drop is fixed), and Settings gains a full AI configuration section — provider/model/template/Custom-endpoint config plus masked SecureStore-only key entry — while the exact-prompt first-send gate is deliberately left to Compose (Plan 05, H5). Correctness-critical logic lives in two new node-tested `*-logic.ts` modules; the `.tsx` layers are Pixel-UAT.

## What was built

### Task 1 — default-off field-sharing control with a working edit path (H7)
- **`src/components/field-def-form-logic.ts`** (new, node-pure): `FieldDefDraft` (now carries `share_with_ai`), `hydrateFieldDefDraft(initial?)` (OFF by default on create, seeded from the stored value on edit) and `draftToFieldFields(draft)` (returns only the six editor-owned fields; excludes create-only `uid`/`col_name`/`display_order`/`now` — C3-L1).
- **`FieldDefForm.tsx`**: seeds state through `hydrateFieldDefDraft`, adds a default-off themed "Share with AI suggestions" `Switch` (testID `field-def-share-with-ai`) wired to `draft.share_with_ai`, and builds both the create `NewFieldDef` and the edit draft via `draftToFieldFields`. `FieldDefDraft` is re-exported so `CustomFieldsScreen` keeps its import site.
- **`field-defs-dao.ts`**: `updateFieldShareWithAi(exec, id, shareWithAi, now)` — a DEFS-row-only flag writer using the same `inWriteTransaction` + `assertOneChange` idiom; no dynamic-column path, no `contact_custom_values` touch.
- **`CustomFieldsScreen.handleEdit`**: adds a `shareChanged` diff and routes it through `updateFieldShareWithAi`, after the interactive pre-flight gate (all-or-nothing-on-cancel preserved).

### Task 2 — Settings provider setup + pure inspector/ack helpers (H5)
- **`src/screens/settings-ai-logic.ts`** (new, node-pure): `buildAiSettingsPatch` (non-secret only), `validateEndpointForSave` (reuses the shared `validateCustomEndpoint`), `discoverModelsForField` (free-text fallback), `buildInspectorViewState` + `buildProviderAckViewState` (return the SAME `inspectorDisplay`/`prompt` strings, plus the Custom retention caveat), and `providerDisplayName`. Imports no resolver.
- **`SettingsScreen.tsx`**: a token-only "AI message suggestions" section — provider chips, cloud model discovery (chips) + manual free-text fallback, Custom endpoint (validated on Save, error rendered in `colors.danger`) + free-text Custom model with the "Orbit doesn't control this endpoint" caveat, masked API-key entry (`secureTextEntry`) routed to `ai-key-store` with a presence-only saved indicator and a Remove control, a multiline prompt-template editor, and a Save button that persists via `updateAppSettings`. Focus-reload probes key presence only.

## Verification / gate outcomes

| Gate | Command | Result |
|------|---------|--------|
| Focused suites | `npx vitest run field-def-form-logic + field-defs-dao + field-values-dao + settings-ai-logic + ai-key-store + AiService` | 84 passed |
| Full suite | `npx vitest run` | 92 files, 1208 passed |
| Types | `npx tsc --noEmit` | exit 0 |
| Colours | `npm run check:colors` | exit 0 |

TDD gates: RED commit (`test(14-04)`) then GREEN commit (`feat(14-04)`) for each task — `updateFieldShareWithAi is not a function` / empty-module import failures confirmed RED before implementation.

## Threat-model coverage
- **T-14-11 (field editor info disclosure):** default-off control + `updateFieldShareWithAi` + DAO tests proving write-1/read-1 and toggle-back-to-0 persistence keep the opt-in-only boundary (H7).
- **T-14-12 (key input):** `buildAiSettingsPatch` structurally omits any key; the screen routes entry to `ai-key-store` and only probes presence — a serialized-patch test asserts the key string never appears.
- **T-14-13 (provider disclosure):** the ack builder surfaces the exact immutable prompt and names the Custom retention limit; Settings never fabricates a prompt (no resolver import).

## Deviations from Plan
None — plan executed as written. Both tasks used the sibling-writer option the plan explicitly permitted; no Rule 1–4 deviations, no auth gates, no architectural changes.

## Deferred (by design, not this plan)
- The first-send blocking acknowledgement gate and its `app_settings` `ai_ack_*` write remain Plan 05 (H5) — this plan only provides the pure helpers Compose will consume with the real contact-specific `ResolvedPrompt`. `ai_ack_*` stays excluded from the generic patch (C3-H3a preserved).
- The rendered `Switch` toggle and the Settings AI section render/flows are Plan 06 Pixel UAT — Vitest is render-free, so no Node test asserts the JSX.

## Self-Check: PASSED
- Files created: `field-def-form-logic.ts`, `field-def-form-logic.test.ts`, `settings-ai-logic.ts`, `settings-ai-logic.test.ts` — all present on disk.
- Commits present: b32a220 (test), d30f3f6 (feat), 9a2ba92 (test), 82edd45 (feat).
