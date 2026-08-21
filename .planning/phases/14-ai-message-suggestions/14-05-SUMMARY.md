---
phase: 14-ai-message-suggestions
plan: 05
subsystem: ai
tags: [privacy, ai, compose, lifecycle, cancellation, acknowledgement, tdd]
status: complete

# Dependency graph
requires:
  - phase: 14-01
    provides: app-settings-dao AI columns + ai_ack_* (read-only via generic patch), ai-key-store
  - phase: 14-02
    provides: AiService.generate(input) with caller-owned signal (H4); adapters read only resolvedPrompt.payload (C3-M1)
  - phase: 14-03
    provides: resolvePrompt + immutable ResolvedPrompt (prompt===inspectorDisplay===payload), readPromptContext
  - phase: 14-04
    provides: settings-ai-logic pure inspector/ack view-state builders that ACCEPT a ResolvedPrompt
provides:
  - AiSuggestionLifecycle — pure one-request lifecycle owning the SOLE AbortController + 20s timeout (H4), monotonic request-generation token, one immutable ResolvedPrompt per request
  - First-send-per-provider ack gate (H5) with egress ordered strictly after a durable ack (C2-H3) and a stale-request guard after the ack await (C3-H4)
  - acknowledgeProvider — the SOLE ai_ack_* DAO writer (fixed provider->column allowlist switch, inWriteTransaction, assertOneChange)
  - Compose AI Suggest flow (trigger, loading+Cancel, exact-prompt acknowledgement, replacement confirmation, Retry)
  - Additive profile "AI draft" entry + serializable consume-once Compose route param (requestAiSuggestion)
  - M1 injected Compose-flow integration test proving one immutable ResolvedPrompt reference across inspector/ack/adapter
affects: [14-06, compose-screen, contact-profile-screen, ai-egress]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stateful-but-node-pure lifecycle: owns a real AbortController + timeout, every effect injected, zero expo/react-native import — fully Vitest-proven off-device"
    - "Monotonic request-generation token invalidates any slow completion (cancel/timeout/unmount/config-change/supersede) so a stale result can never mutate the draft"
    - "Egress ordered strictly after an awaited durable ack (no controller exists during the ack write); re-validate token/focus/mount/config AFTER the await before creating the controller"
    - "Dedicated single-column ack writer with a fixed allowlist switch (source-constant column names, never interpolation) mirroring favourites/field-defs writers"

key-files:
  created:
    - src/logic/ai-suggestion-logic.ts
    - src/logic/ai-suggestion-logic.test.ts
    - src/logic/ai-suggestion-compose-integration.test.ts
    - src/navigation/ai-suggestion-navigation.ts
    - src/navigation/ai-suggestion-navigation.test.ts
  modified:
    - src/screens/ComposeScreen.tsx
    - src/screens/ContactProfileScreen.tsx
    - src/navigation/types.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts

decisions:
  - "Modelled the lifecycle as a small STATEFUL class (it genuinely owns a controller + timeout) rather than a bare reducer, but kept it node-pure by injecting every effect (resolvePrompt, ack write, generate, controller factory, timers, freshness facts, draft mutation). This is what makes H4/H5/C2-H3/C3-H4 provable in Vitest."
  - "Replacement confirmation is applied AT RESULT TIME: an empty editor applies the draft directly; a non-empty editor transitions to confirm-replace and leaves the text untouched until the user confirms (T-14-14)."
  - "The stale guard uses BOTH mechanisms: cancel/dispose/onConfigChange bump the generation token, AND acknowledge() re-compares the immutable config snapshot against the live currentConfig() — so a silent config change (no token bump) is still caught."
  - "Gated the profile 'AI draft' entry on a configured provider by adding a getAppSettings read to the profile load, so a never-configured user never sees a control that leads to an inert Compose flow. The exact contact-specific prompt + acknowledgement still live only in Compose (H5)."
  - "acknowledgeProvider maps provider->column via a fixed switch over the closed AiCloudProviderId union with a `never` exhaustiveness default — the column name is always one of four source constants, never interpolated runtime data."

metrics:
  duration_min: 14
  tasks_completed: 2
  files_created: 5
  files_modified: 5
  completed_date: 2026-08-21
---

# Phase 14 Plan 05: Compose AI Suggestion Integration Summary

A cancellable, inspectable, acknowledged AI-suggestion request wired into the sole editable-draft surface (Compose) plus the profile→Compose intent, with one cancellation owner, durable first-send gating, and strict prompt-object identity — no touchpoint/last_contact/interaction side effects.

## What was built

**Task 1 — pure one-request lifecycle (`src/logic/ai-suggestion-logic.ts`)**
`AiSuggestionLifecycle` owns exactly one in-flight request tracked by a monotonically-increasing generation token, the SINGLE AbortController + 20s timeout (H4 — the adapter never creates its own; the lifecycle's signal is authoritative), and the one immutable `ResolvedPrompt` resolved once per request. Transitions cover: resolving, needs-acknowledgement (the H5 gate before any network), loading, confirm-replace (non-empty draft, T-14-14), error, and idle. Cancel / timeout / unmount(dispose) / provider-model-contact change / a superseding `begin` all abort the same controller and invalidate the token, so a stale completion can never mutate the draft. Retry is a deliberate fresh `begin`, never automatic (T-14-07). Node-tested with 31 cases; every effect is injected (no expo/react-native import).

**Task 2 — Compose + profile wiring, durable ack, M1 test**
- `acknowledgeProvider(exec, provider, now)` added to `app-settings-dao.ts`: the SOLE `ai_ack_*` writer, a fixed provider→column allowlist `switch` (source-constant column names, `never` exhaustiveness default), `inWriteTransaction` + `assertOneChange`. The four ack columns remain absent from `COLUMN_OF`, so the generic patch still cannot reach them (C3-H3a).
- `ComposeScreen.tsx` drives the lifecycle: it resolves context+prompt exactly once via the Plan 03 API, passes that EXACT `ResolvedPrompt` to the Plan 04 inspector/ack builders AND to `AiService.generate` (with the lifecycle's own signal). The first-send gate shows the exact contact-specific prompt; on acknowledge it `await`s `acknowledgeProvider` and only after that resolves may the lifecycle create the controller/timeout and call generate (C2-H3). A rejected ack write blocks egress entirely; a declined provider makes no network call. Copy / SMS / Send / archived-missing behavior is unchanged.
- Stale guard (C3-H4): the lifecycle captures a token + immutable `{provider, model, contactId}` snapshot before awaiting the ack, then re-validates token currency, focus+mount, and config equality after the await — dropping the request without a controller/generate if anything differs.
- Profile→Compose intent: `Compose` route param widened with a serializable `requestAiSuggestion?: boolean`; the additive profile "AI draft" entry navigates with `{ contactId, requestAiSuggestion: true }`; Compose consumes-and-clears it once (`consumeAiSuggestionIntent` + `setParams`) so a focus reload/re-render cannot repeat it (T-14-16).
- M1 integration test (`ai-suggestion-compose-integration.test.ts`): drives the real lifecycle + real settings-ai-logic builders + an injected resolver/adapter, asserting strict `===` identity of the `ResolvedPrompt` across inspector, acknowledgement, and `AiService.generate` (which reads exactly `resolved.payload`), plus C2-H3 ordering and C3-H4 stale-drop at the seam.

## Verification (gate outcomes)

- `npx vitest run src/logic/ai-suggestion-logic.test.ts src/navigation/ai-suggestion-navigation.test.ts src/logic/compose-logic.test.ts src/logic/ai-suggestion-compose-integration.test.ts src/db/app-settings-dao.test.ts` → **101 passed**.
- `npx vitest run` (full suite) → **95 files / 1255 tests passed** (no regressions).
- `npx tsc --noEmit` → **exit 0**.
- `npm run check:colors` → **exit 0** (all AI-panel colours resolve through `useTheme().colors.*`).

## Data-invariant confirmation (DATA-04)

The suggestion path calls only `readPromptContext` (read), `resolvePrompt` (pure), `AiService.generate` (network), and `acknowledgeProvider` (the one `ai_ack_*` write). It records NO interaction/touchpoint and writes NO `contacts.last_contact` — confirmed by reading the writers and by the DAO write-spy test (no `contacts`/`interactions`/`fuel`/`last_contact` statement on the ack path). Copy/SMS/Send continue to write nothing.

## Deviations from Plan

### Additive source files / reads (Rule 3 — blocking: a listed test needs an importable source)

**1. [Rule 3] Added `src/navigation/ai-suggestion-navigation.ts`**
- **Found during:** Task 2. The plan listed `src/navigation/ai-suggestion-navigation.test.ts` but no matching source module for the node test to import.
- **Fix:** Added a tiny pure module exporting `consumeAiSuggestionIntent(requestAiSuggestion, alreadyConsumed)` — the consume-once decision the screen wires to `setParams`. Mirrors the existing `widget-linking.ts` + `widget-linking.test.ts` pairing.
- **Commit:** 9927514

**2. [Rule 2] Gated the profile "AI draft" entry on a configured provider**
- **Found during:** Task 2. An ungated entry would navigate a never-configured user to an inert Compose flow (poor taste; owner cares).
- **Fix:** Added a `getAppSettings` read to `ContactProfileScreen.load` and an `aiConfigured` state so the entry renders only when `aiProvider !== 'none'`. The exact contact-specific prompt + acknowledgement still live only in Compose (H5 unaffected).
- **Commit:** 9927514

No architectural changes; no ADR/HANDOFF decision reversed; no owner decision required.

## TDD Gate Compliance

Both tasks are `tdd="true"`. Following the repo's established co-commit idiom for pure logic modules (e.g. `compose-logic.ts` + its test), the implementation and its Vitest proof were authored and committed together per task rather than as separate RED/GREEN commits. Every acceptance-criteria assertion is present and passing; the MVP+TDD runtime gate was not active for this phase (`tdd_mode: false`).

## Known Stubs

None. The flow is fully wired end-to-end (resolver → inspector/ack → adapter). The `.tsx` render surface is device-UAT (per the repo convention that correctness-critical logic lives in node-tested `*-logic.ts`); the AI panel itself has no mock/placeholder data source.

## Follow-ups for later plans

- 14-06 (release validation) owns the device-UAT pass: drive the AI Suggest flow on the Pixel, confirm the acknowledgement shows the exact prompt, Cancel/timeout behavior, and the profile→Compose intent firing exactly once.

## Self-Check: PASSED

All 5 created files and 5 modified files present on disk; both task commits (82d666e, 9927514) in git history.
