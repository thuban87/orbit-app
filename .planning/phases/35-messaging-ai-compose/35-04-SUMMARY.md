---
phase: 35-messaging-ai-compose
plan: 04
subsystem: logic
tags: [ai-compose, lifecycle, fan-out, availability, node-pure, adr-079, react-native, expo]

# Dependency graph
requires:
  - phase: 35-messaging-ai-compose
    plan: 01
    provides: "ComposeScreen stripped of all AiSuggestionLifecycle/AiSuggestionState wiring (zero references) — unblocks this plan's export narrowing"
provides:
  - "AiSuggestionLifecycle reshaped to the ADR-079 three-suggestion contract: review:{ suggestions: readonly string[] } success shape, chooseSuggestion(index) the sole editor mutation, generate dep → Promise<readonly string[]>, resolvePrompt dep gains (sourceDraft?: string) for the Rewrite carry, egress-failure aborts the controller before nulling (HIGH-2), ack gate removed cleanly"
  - "generateVariants(generateOne, prompt, signal, count=3): node-pure three-call fan-out under one shared read-only signal (fast-fail, pre-abort short-circuit)"
  - "variantTemperature(base, variantIndex, count=3): node-pure distinct/in-range per-variant temperature ladder (COMP-12 lever)"
  - "computeAiAvailability + AiAvailability + selectAiAffordance: stable three-state (off/ready/needs-attention) availability adapter and every-state affordance posture selector"
affects: [35-08]

# Actuals (#2632)
actuals:
  tokens: 20461
  tasks: 4
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fan-out at the lifecycle boundary: three independently-cancellable single-draft calls under ONE AbortController/signal produce the three-suggestion set; the AiService AiProvider.generate single-draft contract stays unchanged (provider layer is Phase 36)"
    - "Read-only-signal fan-out helper cannot abort; the sole controller owner (the lifecycle) performs the abort on a propagated rejection so in-flight siblings cancel (HIGH-2)"
    - "Stable swap-internals-later adapter (computeAiAvailability) mirroring app-settings-dao read-shape discipline — a provisional D-12 derivation Phase 36 replaces without touching Compose"

key-files:
  created:
    - src/logic/ai-generate-variants.ts
    - src/logic/ai-generate-variants.test.ts
    - src/logic/ai-availability.ts
    - src/logic/ai-availability.test.ts
  modified:
    - src/logic/ai-suggestion-logic.ts
    - src/logic/ai-suggestion-logic.test.ts
    - src/logic/ai-suggestion-compose-integration.test.ts

key-decisions:
  - "PROMOTE (assumption-delta): the three-suggestion set is the PRIMARY success representation (review:{ suggestions: readonly string[] }); the single-suggestion confirm-replace shape is retired, not kept alongside — avoids a half-migrated union."
  - "Injected isEditorEmpty predicate + getEditorBody dep drive the Draft-vs-Rewrite decision at begin() time; the lifecycle only PASSES the source-draft to resolvePrompt (delimited rendering is plan 35-08's prompt-template work), so the closed PromptContext allowlist is not widened."
  - "Dropped the ack-await-window deps (isProviderAcknowledged, acknowledgeProvider) AND currentConfig/sameConfig: with no ack await there is no post-await stale-guard window, and config changes are fully covered by onConfigChange() bumping the token. RequestConfig kept as an exported contract type."
  - "variantTemperature slides a fixed-spacing window (step 0.15) wholly inside [0, 1-width] rather than clamping per-point, so values never collapse at base=0 or base=1."

patterns-established:
  - "generateVariants is generic over the prompt type (<P>) and imports nothing — the plan-35-08 screen adapter owns GenerationInput construction inside generateOne."

requirements-completed: []

coverage:
  - id: T1
    description: "AiSuggestionLifecycle three-suggestion contract: review success shape (exactly three, non-destructive), chooseSuggestion sole mutation, Draft/Rewrite source-draft carry, HIGH-2 non-stale-failure controller abort (unit + end-to-end with generateVariants), stale/cancel/timeout guards preserved, ack gate removed"
    requirement: "COMP-12"
    verification:
      - kind: unit
        ref: "src/logic/ai-suggestion-logic.test.ts"
        status: pass
      - kind: unit
        ref: "src/logic/ai-suggestion-compose-integration.test.ts"
        status: pass
    human_judgment: false
  - id: T2
    description: "generateVariants fan-out (order, per-call variantIndex, one shared signal, fast-fail, pre-abort short-circuit) + variantTemperature distinct/in-range ladder at base 0/1/mid"
    requirement: "COMP-12"
    verification:
      - kind: unit
        ref: "src/logic/ai-generate-variants.test.ts"
        status: pass
    human_judgment: false
  - id: T3
    description: "computeAiAvailability three-state derivation (off/ready/needs-attention), pure over inputs, reads no secret"
    requirement: "COMP-09"
    verification:
      - kind: unit
        ref: "src/logic/ai-availability.test.ts#computeAiAvailability"
        status: pass
    human_judgment: false
  - id: T4
    description: "selectAiAffordance maps each availability state to its affordance posture; manual + Research usable in all three; needs-attention repair notice replaces (not hides, not restores) AI actions; off exposes no AI affordance"
    requirement: "COMP-09"
    verification:
      - kind: unit
        ref: "src/logic/ai-availability.test.ts#selectAiAffordance"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 04: Node-pure AI lifecycle reshape + fan-out + availability adapter Summary

**Reshaped the node-pure Compose AI lifecycle to the ADR-079 three-suggestion contract (non-destructive review surface, Rewrite source-draft carry, ack gate cleanly removed, HIGH-2 fan-out sibling cancellation), added the node-pure `generateVariants` three-call fan-out + `variantTemperature` variation lever, and added the stable three-state `computeAiAvailability` / `selectAiAffordance` adapter — all under extended/new Vitest coverage, with the AiService single-draft provider contract untouched.**

## Performance
- **Duration:** ~13 min
- **Started:** 2026-09-13T16:23:23Z
- **Tasks:** 4
- **Files:** 7 (4 created, 3 modified)

## Accomplishments
- **AiSuggestionLifecycle reshaped (Task 1).** Success shape is now `review:{ suggestions: readonly string[] }` (exactly three, unlabeled, non-destructive); the single-suggestion `confirm-replace` shape is retired. `generate` dep resolves `Promise<readonly string[]>`; `chooseSuggestion(index)` is the ONLY editor mutation. `resolvePrompt` dep gains `(sourceDraft?: string)` — `begin()` decides Draft vs Rewrite via the injected `isEditorEmpty` predicate and passes the current editor body (via `getEditorBody`) as `sourceDraft` only on Rewrite. HIGH-2: on a non-stale generation failure the lifecycle aborts its sole `AbortController` BEFORE nulling it, so a partial fan-out rejection cancels the in-flight siblings. The ADR-052 acknowledgement gate and its whole path are removed cleanly (D-09/ADR-079 Trip-Wire 4); the DAO-level writer is untouched. AbortController + 20s timeout + monotonic stale-guard machinery preserved.
- **generateVariants + variantTemperature (Task 2).** A node-pure `generateVariants(generateOne, prompt, signal, count=3)` fires `count` concurrent `generateOne(prompt, signal, variantIndex)` calls under the one shared read-only signal, resolves drafts in deterministic index order, fast-fails on the first rejection, and short-circuits (zero calls) on an already-aborted signal — it never aborts (the lifecycle owns that). `variantTemperature` returns a deterministic, pairwise-distinct, in-range `[0,1]` temperature per variant that never collapses at base 0 or 1.
- **Three-state availability adapter (Tasks 3-4).** `computeAiAvailability` derives `off | ready | needs-attention` from the provider id + a credential-present boolean (reads no secret itself — provisional D-12). `selectAiAffordance` maps each state to an every-state-usable posture: manual composition and Research usable in all three; `off` exposes no AI affordance; `ready` exposes the AI actions; `needs-attention` shows a restrained repair notice that REPLACES the AI actions (not silently hidden, not restored).

## Task Commits
1. **Task 1: reshape AI lifecycle to ADR-079 three-suggestion contract** — `19550ee` (feat)
2. **Task 2: node-pure generateVariants fan-out + variantTemperature** — `3031d48` (feat)
3. **Task 3: three-state ai-availability adapter (D-12 provisional)** — `b742d47` (feat)
4. **Task 4: availability → every-state affordance posture** — `eda5414` (feat)

**Plan metadata:** committed with STATE/ROADMAP update (docs commit).

## Files Created/Modified
- `src/logic/ai-suggestion-logic.ts` — reshaped lifecycle (three-suggestion, Draft/Rewrite carry, HIGH-2 abort, ack path removed)
- `src/logic/ai-suggestion-logic.test.ts` — reshaped unit suite + end-to-end HIGH-2 test wired to the real `generateVariants`
- `src/logic/ai-suggestion-compose-integration.test.ts` — reshaped seam test to the three-suggestion contract (retired ack assertions removed)
- `src/logic/ai-generate-variants.ts` — NEW node-pure fan-out + variation helpers
- `src/logic/ai-generate-variants.test.ts` — NEW fan-out/index/variation/failure/pre-abort coverage
- `src/logic/ai-availability.ts` — NEW three-state adapter + affordance selector
- `src/logic/ai-availability.test.ts` — NEW three-state + every-state-usability coverage

## Decisions Made
- **PROMOTE the three-suggestion set to the primary success representation** (assumption-delta): the single-suggestion `confirm-replace` shape is retired rather than kept alongside, avoiding a dead shape / half-migrated union.
- **Dropped the ack-await-window deps and the config re-validation deps.** With the ack await gone there is no post-await stale window, so `isProviderAcknowledged`, `acknowledgeProvider`, `currentConfig`, and the `sameConfig` helper were removed. Config changes are fully covered by `onConfigChange()` bumping the token and aborting. `RequestConfig` is retained as an exported contract type.
- **`variantTemperature` slides a fixed-spacing window inside range** rather than clamping per-point, guaranteeing distinct in-range values even at base extremes.
- **`generateVariants` is generic over the prompt type and imports nothing** — the plan-35-08 screen adapter owns `GenerationInput` construction inside `generateOne`, keeping the helper node-pure and free of any provider/AiService coupling.

## Deviations from Plan
None — plan executed as written. (Note: the plan's Task-1 acceptance lists an end-to-end HIGH-2 test that uses the Task-2 `generateVariants` helper; that specific test was landed in the Task-2 commit alongside the helper it depends on, so every commit stays green and atomic. All Task-1 behavior is otherwise covered in the Task-1 commit, including a standalone unit HIGH-2 abort test that needs no helper.)

## Constraint Adherence (orbit hard constraints)
- **Local-first / AI egress not widened.** No new network path; the Rewrite source-draft is the user's OWN composition passed through `resolvePrompt` (delimited rendering deferred to 35-08), and the closed `PromptContext` allowlist is unchanged. AiService's single-draft provider contract and `parseSuggestionOutput` are untouched (`git diff` on `src/services/AiService.ts` is empty).
- **No worktree, no branch, no push.** All work committed in place on `main` with hooks (never `--no-verify`).
- **Reviewed the code, not the diff.** Grepped every consumer of the reshaped symbols first: `ai-suggestion-logic` has ZERO production importers (35-01 stripped ComposeScreen); the only consumers were the two test files this plan owns. The `acknowledgeProvider` matches in `app-settings-dao.ts` / migration 004 / `backup-restore-logic` are the separate forward-only DAO writer (D-09/ADR-079) — deliberately left untouched. `settings-ai-logic.ts` / `buildProviderAckViewState` still compiles and is deliberately left for Phase 36.

## Verification
- `npx vitest run` on the four plan suites: **43 passed**.
- `npx tsc --noEmit`: **clean project-wide** (no orphaned old-contract consumers).
- `git diff src/services/AiService.ts`: **empty** (provider single-draft contract untouched).
- `npm run check:colors`: pass.
- Grep gates: no `needs-acknowledgement`/`acknowledgeProvider`/`isProviderAcknowledged`/`ai_ack`/`confirm-replace` in the reshaped lifecycle or integration test; `generate` dep type is `Promise<readonly string[]>`; `AI_REQUEST_TIMEOUT_MS`/`AbortController`/`this.gen` machinery preserved. `ai-generate-variants.ts` and `ai-availability.ts` have no `expo`/`react-native`/`AiService`/`provider`/`GenerationInput` imports or identifiers, and read no secret directly (the raw plan grep's only residual matches are the `export` keyword and `exposes`, which substring-match "expo" — no actual RN/provider references; verified with a whole-word grep).

## Known Stubs
None. `computeAiAvailability`/`selectAiAffordance` are a deliberate PROVISIONAL D-12 implementation (a stable interface Phase 36 re-implements without touching Compose), not a stub — the derivation is real and fully tested. `generate`/`resolvePrompt`/`getEditorBody`/`isEditorEmpty` are injected deps the plan-35-08 screen wiring supplies (this plan is node-pure logic; the screen wiring is wave 4 by design, not a gap).

## Deferred / Out-of-Scope
- **Pre-existing unrelated failure:** `src/components/orrery/orrery-controls-render.test.tsx` fails to load (`SyntaxError: Unexpected token 'typeof'`). This orrery/Skia component (Phase 30) is untouched by this plan (my 7 changed files are all `src/logic/ai-*`); `tsc --noEmit` is clean and the other 3358 tests pass. It was already logged in this phase's `deferred-items.md` from 35-02 ("not regressions from 35-02") and STATE.md flags Phase 30 as dirty/unreconciled. Logged again under `[35-04]` in `deferred-items.md`; not fixed (scope boundary).

## Next Phase Readiness
- **35-08 (wave 4)** re-wires AI into ComposeScreen against this reshaped lifecycle: it supplies `generate = (prompt, signal) => generateVariants(generateOne, prompt, signal, 3)` where `generateOne` is the adapter over `provider.generate({ resolvedPrompt, model, temperature: variantTemperature(base, i, 3), maxOutputTokens, signal })`; provides `resolvePrompt(sourceDraft)` with the §P-411 delimited Rewrite framing in `prompt-template.ts`; provides `isEditorEmpty`/`getEditorBody`; consumes `computeAiAvailability`/`selectAiAffordance`; and re-creates the sanitized error-code→line mapping (it must not assume the old `aiErrorText` survived).

## Self-Check: PASSED
- Files verified present on disk: all 7 (`ai-suggestion-logic.ts`, `ai-suggestion-logic.test.ts`, `ai-suggestion-compose-integration.test.ts`, `ai-generate-variants.ts`, `ai-generate-variants.test.ts`, `ai-availability.ts`, `ai-availability.test.ts`).
- Commits verified in `git log`: `19550ee`, `3031d48`, `b742d47`, `eda5414`.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
