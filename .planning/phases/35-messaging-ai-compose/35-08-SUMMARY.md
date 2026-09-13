---
phase: 35-messaging-ai-compose
plan: 08
subsystem: ui
tags: [compose, ai-compose, adr-079, three-suggestion, rewrite, availability, prompt-template, react-native, expo]

# Dependency graph
requires:
  - phase: 35-messaging-ai-compose
    plan: 04
    provides: "reshaped AiSuggestionLifecycle (three-suggestion review, Draft/Rewrite source-draft carry), generateVariants + variantTemperature fan-out, computeAiAvailability/selectAiAffordance three-state adapter"
  - phase: 35-messaging-ai-compose
    plan: 05
    provides: "closed readPromptContext egress projection (PromptContext allowlist)"
  - phase: 35-messaging-ai-compose
    plan: 07
    provides: "mode-aware (Text/Email) ComposeScreen as a thin compose-logic consumer"
provides:
  - "resolvePrompt(template, context, sourceDraft?) — an optional bounded/delimited MESSAGE TO REWRITE DATA block with minimal §P-411 rewrite framing; Draft output byte-identical; sourceDraft is a param, NOT a PromptContext field"
  - "ComposeScreen AI re-wired against the reshaped lifecycle: single adaptive Draft/Rewrite action, non-destructive three-suggestion review surface (Choose this / Try Again / Cancel + Rewrite keep-original), three AI-availability states sourced from an on-focus async credential-PRESENCE read, and the re-created sanitized error-code→short-line surface"
  - "ai-availability.ts extended: node-pure isCredentialFailure(code) + readCredentialPresence(provider, getKey) (narrows 'none' before any getKey call — A4)"
affects: [35-09]

# Actuals (#2632)
actuals:
  tokens: 9265
  tasks: 4
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rewrite source-draft rides resolvePrompt's new sourceDraft PARAM (bounded/fence-neutralized MESSAGE TO REWRITE block joining the scaffold's baseCount region), never raw string concatenation and never a PromptContext field — egress allowlist unchanged"
    - "Screen re-creates the provider-wiring 35-01 removed (AiService/settings/catalog refs, refreshProviders/getActiveProvider/model-selection/resolveMaxOutputTokens) and wires generate = generateVariants(generateOne, prompt, signal, 3) where generateOne is an adapter building GenerationInput with a per-call variantTemperature"
    - "Availability is SOURCED (not computed) on the screen: an on-focus async aiKeyStore.getKey PRESENCE read (boolean only) + an observed-unauthorized session-local flag feed the pure computeAiAvailability adapter; no key material is retained/logged/rendered"

key-files:
  created: []
  modified:
    - src/ai/prompt-template.ts
    - src/ai/prompt-template.test.ts
    - src/screens/ComposeScreen.tsx
    - src/logic/ai-availability.ts
    - src/logic/ai-availability.test.ts

key-decisions:
  - "The Rewrite instruction line AND the MESSAGE TO REWRITE block JOIN the scaffold (baseCount region measured before the shared-field budgeting loop), so their cost is reserved against TOTAL_LIMIT up front and the end hard-trim never severs the block's closing fence or drops the instruction (review MEDIUM #6)."
  - "Rewrite-vs-Draft at review time is derived from editor emptiness (body.trim().length > 0), which is reliable because the editor is untouched until Choose this — no extra lifecycle state needed to know it was a Rewrite."
  - "isCredentialFailure is deliberately narrow (only 'unauthorized'); transient codes (timeout/rate_limited/network/blocked/invalid_endpoint/cancelled) never demote a correctly-configured provider to needs-attention."
  - "readCredentialPresence returns false for 'none' WITHOUT calling getKey (A4) — getKey's param type excludes 'none' (AiCloudProviderId), so passing it would both fail tsc and be semantically wrong."
  - "The Needs-Attention repair notice routes to the existing Settings surface (interim per D-12); Compose is never a provider-troubleshooting screen."

patterns-established:
  - "AI is an ADDITIVE layer on the mode-aware editor: the manual editor, Copy, Transmit, mode switch, Subject field, and the 'Did you send it?' panel render independently of AI availability/state — availability never gates manual composition."

requirements-completed: [COMP-09, COMP-12, COMP-13]

coverage:
  - id: T1
    description: "resolvePrompt bounded Rewrite source-draft: byte-identical Draft when absent/blank; exactly one fenced MESSAGE TO REWRITE block + minimal §P-411 instruction; forged-fence neutralization; over-length trim disclosed by category only + same frozen instance; fence integrity + instruction survival at/over TOTAL_LIMIT"
    requirement: "COMP-12"
    verification:
      - kind: unit
        ref: "src/ai/prompt-template.test.ts"
        status: pass
    human_judgment: false
  - id: T2
    description: "Availability sourcing: computeAiAvailability missing-key→needs-attention / present→ready / 'none'→off; isCredentialFailure unauthorized=true, transient=false; readCredentialPresence 'none' zero-read + cloud present/absent"
    requirement: "COMP-09"
    verification:
      - kind: unit
        ref: "src/logic/ai-availability.test.ts"
        status: pass
    human_judgment: false
  - id: T3
    description: "Adaptive Draft/Rewrite action + three-variant fan-out wiring (generateVariants + generateOne adapter with per-call variantTemperature), non-destructive three-suggestion review surface, three availability states, failure-safe sanitized error surface — RN screen render"
    requirement: "COMP-09, COMP-12, COMP-13"
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors (both exit 0); grep gates: generateVariants+variantTemperature consumed, resolveMaxOutputTokens+getActiveProvider re-created, computeAiAvailability/readCredentialPresence consumed, no aiProvider!=='none' inline gate, no apiKey/secret stored, no ack symbols, AiService diff empty, begin() only in handlers"
        status: pass
      - kind: device_uat
        ref: "Pixel phase-gate backstop (E5 review surface render, on-focus credential-presence read, Needs-Attention notice/route, sanitized error surface, Choose/Try-Again/Cancel interactions)"
        status: deferred
    human_judgment: true
    rationale: "The pure logic (three-suggestion contract, fan-out/variantTemperature, availability derivation, bounded Rewrite source-draft) is node-tested off-device; the RN screen render + interactions have no clean automated seam and are verified on the Pixel at the phase gate (plan verification MEDIUM #7)."

# Metrics
duration: 13min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 08: AI re-wired into the mode-aware ComposeScreen Summary

**Extended `resolvePrompt` with an optional bounded/delimited Rewrite `sourceDraft` (HIGH-3 / §P-411) — the user's own draft rendered as a fence-neutralized MESSAGE TO REWRITE DATA block that joins the scaffold so the end hard-trim can never sever it — then re-wired AI into the now-mode-aware ComposeScreen against the reshaped 35-04 lifecycle: one adaptive Draft/Rewrite action, a non-destructive three-suggestion review surface (Choose this / Try Again / Cancel + a Rewrite keep-original path), three AI-availability states sourced from an on-focus async credential-PRESENCE read fed to `computeAiAvailability`, and a re-created sanitized error-code→short-line surface — additive over the manual editor, no ack gate, no auto-write, egress surface not widened.**

## Performance
- **Duration:** ~13 min
- **Started:** 2026-09-13T17:22:32Z
- **Tasks:** 4 (Task 1 TDD split RED→GREEN)
- **Files modified:** 5

## Accomplishments
- **Task 1 — bounded Rewrite source-draft (TDD).** `resolvePrompt(template, context, sourceDraft?)` gains an optional third param. When present and non-blank it renders one fenced `===== DATA: MESSAGE TO REWRITE =====` … block carrying the user's own draft, sanitized (fence-neutralized via `sanitizeValue`, so a forged `=====` cannot break out) and bounded to `PER_VALUE_LIMIT` code points with a category-only truncation disclosure. The block AND its minimal §P-411 rewrite-instruction line JOIN the scaffold (the `baseCount` region measured before the shared-field budgeting loop), so their cost is reserved against `TOTAL_LIMIT` up front and the final safety-net hard-trim never severs the closing fence or drops the instruction (review MEDIUM #6). Absent/blank → the Draft prompt is byte-identical. `sourceDraft` is a resolvePrompt PARAM, never a `PromptContext` field — the contact-data egress allowlist is unchanged.
- **Task 2 — adaptive action + lifecycle wiring.** Re-created the entire provider-wiring plan 35-01 removed: the `AiService` instance ref, the AI-settings ref + on-focus load, and the model-catalog ref + best-effort cache load. The lifecycle's `generate` dep is `generateVariants(generateOne, prompt, signal, 3)`, where `generateOne` is an ADAPTER that BUILDS a `GenerationInput` (`provider.generate` takes an input object, not `(prompt, signal)`) and applies a DISTINCT per-call `variantTemperature(0.7, variantIndex, 3)` so the three suggestions are deliberately varied (COMP-12 / D-12). Model selection + `resolveMaxOutputTokens(...,catalogRef.current)` are rebuilt so Anthropic's required `max_tokens` is not silently dropped. The `resolvePrompt` dep passes the current editor body as `sourceDraft` on Rewrite (through the Task-1 path — never raw-concatenated). A single adaptive action reads 'Draft with AI' on an empty editor / 'Rewrite with AI' when it holds text; `begin()` runs ONLY from the tap handler (never a focus/mount effect); the lifecycle disposes on blur/unmount. `AiService` is untouched.
- **Task 3 — non-destructive three-suggestion review surface.** The `review` state renders exactly three unlabeled suggestions at `AppText` role `body` (16/24, no shrink), each with a 'Choose this' primary that calls `chooseSuggestion(index)` — the ONLY editor mutation. 'Try Again' (tertiary) → `retry()` replaces the whole set; 'Cancel' (secondary) dismisses without mutating. For a Rewrite the original is shown with a clear 'Keep the original' path. A non-destructive pending placeholder covers `resolving`/`loading` (editor untouched, Cancel available). Long suggestions/original scroll within bounded, individually-selectable boxes.
- **Task 4 — availability sourcing + three states + failure-safe error surface.** Extended `ai-availability.ts` with node-pure `isCredentialFailure(code)` (only `unauthorized` qualifies) and `readCredentialPresence(provider, getKey)` (returns false for `'none'` WITHOUT calling `getKey` — A4). On focus the screen async-reads the active provider's key PRESENCE (boolean only, never the value) and feeds `computeAiAvailability`; an observed `unauthorized` generation flips a session-local `credentialFailed` flag → needs-attention (cleared on a later success), all without exposing key material. Off → no AI affordance; Ready → the adaptive action + review; Needs-Attention → a restrained 'AI needs attention' notice that REPLACES (never hides/restores) the actions and routes to the existing Settings surface. Re-created the sanitized error-code→short-line mapping (`aiErrorText`) covering timeout/cancelled/not_configured/unauthorized/rate_limited/blocked/invalid_endpoint/default; the failure-safe error surface preserves the manual draft with Try Again / Cancel.

## Task Commits
1. **Task 1 (RED): failing tests for resolvePrompt Rewrite source-draft** — `c60fd3b` (test)
1. **Task 1 (GREEN): extend resolvePrompt with a bounded Rewrite source-draft** — `6487dbb` (feat)
2. **Task 2: adaptive Draft/Rewrite action + reshaped lifecycle wiring** — `d28bda6` (feat)
3. **Task 3: non-destructive three-suggestion review surface** — `d5b403e` (feat)
4. **Task 4: source AI availability + three states + failure-safe error surface** — `4ba554c` (feat)

**Plan metadata:** committed with STATE/ROADMAP/REQUIREMENTS update (docs commit).

## Files Created/Modified
- `src/ai/prompt-template.ts` — `resolvePrompt` gains the optional bounded/delimited `sourceDraft` (MESSAGE TO REWRITE block joining the scaffold; §P-411 minimal framing); Draft output unchanged.
- `src/ai/prompt-template.test.ts` — extended byte-identity / fence-neutralization / over-length-trim / fence-integrity-at-limit suite for the source-draft.
- `src/screens/ComposeScreen.tsx` — re-created AI wiring (provider/settings/catalog), adaptive action, three-suggestion review surface, three availability states + credential-presence sourcing, sanitized error surface.
- `src/logic/ai-availability.ts` — node-pure `isCredentialFailure` + `readCredentialPresence` (A4) atop `computeAiAvailability`.
- `src/logic/ai-availability.test.ts` — missing-key, unauthorized-vs-transient, and 'none'-zero-read coverage.

## Deviations from Plan
None — plan executed as written. (TDD note: Task 1's fence-integrity/byte-identity tests were landed RED then made GREEN; the four screen-wiring tasks each committed atomically with `tsc`/`check:colors` green.)

## Constraint Adherence (orbit hard constraints)
- **Local-first / AI egress NOT widened.** The Rewrite source-draft is the user's OWN composition passed through `resolvePrompt`'s new PARAM (bounded, fence-neutralized, code-point-capped); the closed `PromptContext` allowlist is unchanged and `grep -n "sourceDraft" src/ai/prompt-types.ts` returns nothing. AI remains the single sanctioned network exception, only on explicit invocation, and never writes to the editor without an explicit Choose this. `git diff src/services/AiService.ts` is empty (provider contract untouched); the app-global AssistBanner / PendingConfirmationsSheet are untouched (ADR-070/071 coexistence intact).
- **Theme tokens only.** All new UI resolves colours through `useTheme().colors.*` (no hex; Skia not involved); `npm run check:colors` exit 0. New UI speaks in `AppText`/`Button` roles; suggestions at body 16/24 (no shrink).
- **No per-frame animation from React state**; `formatLocalDate` not needed (no date formatting in scope).
- **No worktree, no branch, no push** — all committed in place on `main` with hooks (never `--no-verify`).
- **Reviewed the code, not the diff.** Read the current ComposeScreen, resolvePrompt/prompt-types, ai-suggestion-logic/ai-generate-variants/ai-availability, AiService/GenerationInput, ai-key-store/ai-types, and the pre-35-01 ComposeScreen from git history before re-creating the removed wiring.

## Verification
- `npx vitest run src/ai/prompt-template.test.ts src/logic/ai-availability.test.ts src/logic/ai-suggestion-logic.test.ts src/logic/ai-generate-variants.test.ts src/logic/ai-suggestion-compose-integration.test.ts`: **67 passed**.
- `npx tsc --noEmit`: **clean project-wide**.
- `npm run check:colors`: **pass**.
- `npm test` (full suite): **3384 passed; 355/356 suites green**. The single failing suite is the pre-existing Phase-30 `src/components/orrery/orrery-controls-render.test.tsx` (`SyntaxError: Unexpected token 'typeof'`, transform-level; the file existed unchanged at the pre-plan commit `6e985b4`) — untouched by this plan and already tracked in `deferred-items.md` (35-02/04/06) + the WINDOWS ledger. Out of scope; not fixed (scope boundary). Logged again under `[35-08]`.
- Grep gates: `generateVariants` + `variantTemperature` consumed in the fan-out; `resolveMaxOutputTokens` + `getActiveProvider` re-created; `computeAiAvailability` + `readCredentialPresence` consumed; no inline `aiProvider !== "none"` availability gate; no `apiKey`/`secret` stored or rendered (`getKey` only inside the presence-read closure); no `needs-acknowledgement`/`acknowledgeProvider`; `begin()`/`retry()` only in handlers; `git diff src/services/AiService.ts` empty.

## Known Stubs
None introduced. AI is now a real, wired additive layer over the mode-aware editor. `computeAiAvailability`/`selectAiAffordance` remain the deliberate PROVISIONAL D-12 adapter (a stable interface Phase 36 re-implements without touching Compose), not a stub — the derivation is real and unit-tested, and this plan supplies the previously-missing credential-presence source. Sophisticated generation-context construction (channel-awareness, personalization weighting, provider-specific prompting, exact variation instructions) is Phase 36 per §U/§Q/D-13, by design.

## Threat Surface
No new surface beyond the plan's `<threat_model>`. T-35-02 (prompt egress): the Rewrite source-draft enters through the new `sourceDraft` param — sanitized, code-point-bounded, delimited — never raw-concatenated; PromptContext unchanged. T-35-25 (credential-presence sourcing): presence read is `!== null` → boolean; the key VALUE is never retained/logged/rendered/nav-param'd; observed `unauthorized` flips a boolean via the pure `isCredentialFailure`. T-35-03 (review/error surface): resolves from the closed prompt path; error maps sanitized codes to short lines, never raw provider text. T-35-18 (non-destructive review): the editor mutates ONLY on explicit Choose this. T-35-23 (fan-out egress): three calls share the lifecycle's one signal (cancel/timeout aborts all three); AiService unchanged.

## Deferred / Out-of-Scope
- **Pre-existing unrelated failure:** `src/components/orrery/orrery-controls-render.test.tsx` (Phase 30, `SyntaxError`) — see Verification; logged in `deferred-items.md` under `[35-08]`. Not a regression from this plan.
- **Device backstop (phase-gate UAT, not this plan):** on the Pixel — Draft on empty + Rewrite on filled editor return three visibly-varied suggestions; Rewrite suggestions clearly rework the user's own text (§P-411); Choose this applies one; Try Again replaces; Cancel/timeout preserve the draft; toggle provider config to exercise Off / Ready / Needs-Attention and the sanitized error surface.

## Next Phase Readiness
- **35-09 (wave 4)** adds nav + the Compose-side Research entry / 'Message focus · N' summary alongside the AI surfaces landed here; it must preserve the additive AI layer (adaptive action, review surface, availability states) and the mode switch / Subject / no-destination / remembered-on-commit wiring from 35-07.

## Self-Check: PASSED
- Files verified present on disk: `src/ai/prompt-template.ts`, `src/ai/prompt-template.test.ts`, `src/screens/ComposeScreen.tsx`, `src/logic/ai-availability.ts`, `src/logic/ai-availability.test.ts`.
- Task commits verified in `git log`: `c60fd3b`, `6487dbb`, `d28bda6`, `d5b403e`, `4ba554c`.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
