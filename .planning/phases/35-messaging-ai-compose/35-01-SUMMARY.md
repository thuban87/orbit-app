---
phase: 35-messaging-ai-compose
plan: 01
subsystem: ui
tags: [compose, zustand, sms-handoff, interaction-assist, react-native, expo]

# Dependency graph
requires:
  - phase: 21-interaction-assist-reach-out
    provides: durable pending-assist lifecycle (createPendingAssist/markAssistLogged/markAssistFailed), app-global AssistBanner + PendingConfirmationsSheet, performReachOut handoff
  - phase: 23-theme
    provides: AppText/Button role primitives, theme tokens, ChromeScrim
provides:
  - "compose-session-store (useComposeSession): session-only draft state (body/subject/mode/destination) keyed by contactId"
  - "performReachOut return contract widened to { handoffStarted, assistUid } (exposes the created assist UID)"
  - "editor-first Text ComposeScreen with an additive 'Did you send it?' confirmation panel in AppText/Button roles"
  - "ComposeScreen stripped of all AiSuggestionLifecycle/AiSuggestionState wiring (unblocks 35-04's export narrowing)"
affects: [35-03, 35-04, 35-07, 35-08, 35-09]

# Actuals (#2632)
actuals:
  tokens: 17900
  tasks: 4
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-only Zustand singleton (module state) modelled on assist-store: survives nav/background, lost on relaunch by construction (no durable store)"
    - "Handoff returns a structured outcome so the caller logs the EXACT assist UID rather than re-querying by contact+timestamp"
    - "Additive confirmation surface gated on handoffStarted && assistUid; coexists with the app-global assist banner (never replaces it)"

key-files:
  created:
    - src/stores/compose-session-store.ts
    - src/stores/compose-session-store.test.ts
  modified:
    - src/services/reach-out/handoff.ts
    - src/services/reach-out/handoff.test.ts
    - src/screens/ComposeScreen.tsx
    - src/db/interaction-assist-dao.test.ts

key-decisions:
  - "TextInput body text is sized via TYPOGRAPHY.body tokens (size + lineHeight), not a raw literal — AppText cannot wrap a TextInput, so the role's tokens are applied inline (removes the old raw-fontSize refactor debt)."
  - "clear-on-confirm fires on 'Yes, log interaction' (the Transmit-confirmed path), not on Transmit itself — 'Not yet' preserves the draft and leaves the assist PENDING."
  - "On a failed confirmation write the panel stays open (retry without a re-query) and the assist stays pending; the app-global banner remains the durable fallback."

patterns-established:
  - "Compose confirmation reuses markAssistLogged UNCHANGED (D-06) — connected=1, now=localDateTime(); the interaction stamps at the assist handoff_at, never at confirmation time."

requirements-completed: [COMP-01, COMP-05, COMP-06, COMP-07]

coverage:
  - id: D1
    description: "compose-session-store: session-only draft (body/subject/mode/destination) survives same-contact nav/background, resets on contact switch, clears on confirm, empty after relaunch"
    requirement: "COMP-07"
    verification:
      - kind: unit
        ref: "src/stores/compose-session-store.test.ts#compose-session-store"
        status: pass
    human_judgment: false
  - id: D2
    description: "performReachOut returns { handoffStarted, assistUid }: exposes the created assist UID (null when opted out), handoffStarted false on a thrown native launch"
    requirement: "COMP-05"
    verification:
      - kind: unit
        ref: "src/services/reach-out/handoff.test.ts#performReachOut"
        status: pass
    human_judgment: false
  - id: D3
    description: "ComposeScreen rebuilt editor-first (blank editor, Transmit/Copy, additive 'Did you send it?' panel logging the exact assist); old fuel-first + AI-lifecycle wiring removed; AppText/Button roles"
    requirement: "COMP-01"
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors (both exit 0); grep gates: no channel literal / no AI-lifecycle symbols / no requestAiSuggestion / no aiErrorText|renderAi"
        status: pass
    human_judgment: true
    rationale: "Editor-first UX, Transmit→SMS composer handoff, draft survival across background, and the on-return confirmation panel are device-observable (Pixel phase-gate UAT); tsc/check:colors/grep prove structure, not the running behavior."
  - id: D4
    description: "Phase-35 assist coexistence invariants locked: stamp at handoff_at (never confirmation time), 'text'→'Message' remap, markAssistDismissed writes zero interactions; DAO reused unchanged"
    requirement: "COMP-06"
    verification:
      - kind: unit
        ref: "src/db/interaction-assist-dao.test.ts#phase-35 confirmation-coexistence invariants"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 01: Messaging & AI Compose (leading tracer) Summary

**Editor-first Text reach-out slice: blank Compose editor → session-only Zustand draft → OS SMS handoff (now returning the created assist UID) → additive "Did you send it?" panel that logs the canonical Message interaction through the existing assist path, unchanged.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-13T14:13:52Z
- **Completed:** 2026-09-13T14:22:59Z
- **Tasks:** 4 (Task 2 split RED→GREEN)
- **Files modified:** 6

## Accomplishments
- New `compose-session-store` (`useComposeSession`): in-memory, session-only draft keyed by `contactId` — survives in-app nav and ordinary backgrounding, clears on Transmit-confirmed, and is naturally lost on relaunch (D-10; no drafts table, no backup, no AsyncStorage).
- `performReachOut` widened from `Promise<void>` to `Promise<{ handoffStarted, assistUid }>` (HIGH-1) — the created assist UID is exposed to the caller so the confirmation panel logs the exact assist rather than a fragile re-query; a failed native launch reports `handoffStarted: false` so the panel never appears after a launch failure (T-35-21).
- `ComposeScreen` rebuilt editor-first in `AppText`/`Button` roles: blank body editor, Transmit (channel from the store `mode`, not a literal), Copy → "Message copied", and the additive "Did you send it?" panel (`Yes, log interaction` / `Not yet`). The entire old fuel-first + single-suggestion AI-lifecycle wiring (construction, ack gate, replace-confirm, AI render + error-mapping helpers) and the auto-start-AI focus consumption were removed, leaving zero references to the reshaped AI exports so plan 35-04 can narrow them without a stale-consumer `tsc` failure.
- Locked the Phase-35 assist coexistence invariants by test (DAO reused unchanged): stamp at `handoff_at` not confirmation time, `text`→`Message` remap, and `markAssistDismissed` writes zero interaction rows.

## Task Commits

1. **Task 1: compose-session-store** - `37e497e` (feat)
2. **Task 2 (RED): performReachOut return-contract test** - `cc4d49f` (test)
2. **Task 2 (GREEN): performReachOut returns handoff outcome** - `075acc1` (feat)
3. **Task 3: rebuild ComposeScreen (editor-first Text slice)** - `5a10bbc` (feat)
4. **Task 4: assist coexistence invariant tests** - `82ec988` (test)

**Plan metadata:** committed with STATE/ROADMAP update (docs: complete plan)

## Files Created/Modified
- `src/stores/compose-session-store.ts` - session-only Zustand draft store (COMP-07 / D-10)
- `src/stores/compose-session-store.test.ts` - nav-survival, contact-switch reset, clear-on-confirm, relaunch-empty
- `src/services/reach-out/handoff.ts` - return type → `ReachOutOutcome { handoffStarted, assistUid }` (HIGH-1)
- `src/services/reach-out/handoff.test.ts` - three return-shape assertions
- `src/screens/ComposeScreen.tsx` - editor-first Text rebuild + additive confirmation panel; AI/fuel wiring removed
- `src/db/interaction-assist-dao.test.ts` - Phase-35 coexistence invariants (test-only; no production diff)

## Decisions Made
- **TextInput sizing via TYPOGRAPHY tokens.** The message editor is a `TextInput`, which `AppText` cannot wrap; its body text is sized with `TYPOGRAPHY.body.size`/`lineHeight` (token-driven, not a raw literal), which is the non-debt way to hit the body role and satisfies "no raw numeric fontSize on text."
- **clear-on-confirm binds to "Yes, log interaction".** "Transmit-confirmed" was read as the user's affirmative confirmation, so the session clears only after a successful log; "Not yet" preserves the draft and leaves the assist pending.
- **connected=1 on the affirmative.** Matches the app-global text/email confirmation (whose sole affirmative is `confirm(1)`; the `connected=0` "No answer" branch is call-only), keeping the outbound-message log byte-consistent (D-06, markAssistLogged reused unchanged).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. All grep gates, `npx tsc --noEmit`, and `npm run check:colors` pass; the three verification suites are green (21 tests across the plan's files, 52 including the AI-logic suites that reference ComposeScreen only in comments).

## Known Stubs
None that block the plan's goal. AI affordances are intentionally ABSENT from ComposeScreen — a deliberate, cross-plan-sequenced functionality gap (re-added against the reshaped lifecycle in plan 35-08, wave 4), not a stub. The `subject`/`destination`/`setMode` store fields and the `email` mode branch are seeded now (COMP-07) for consumption by later plans; `mode` is fixed to `text` this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **35-03 (wave 2)** extends `performReachOut`'s email arm and MUST preserve the `{ handoffStarted, assistUid }` return contract; it also extends `resolveComposeControls` beyond the two-argument Text gate this tracer consumes.
- **35-04 (wave 2)** can now narrow the `AiSuggestionLifecycle`/`AiSuggestionState` exports — ComposeScreen holds zero references.
- **35-08 (wave 4)** re-adds AI against the reshaped lifecycle and RE-CREATES the sanitized error-code→line mapping (it must not assume the old `aiErrorText` survived).
- **Device backstop (phase-gate UAT, not this plan):** on the Pixel — open Compose, type, background+foreground (draft survives), Transmit in Text mode (SMS composer opens), return, "Yes, log interaction" logs a Message; confirm the app-global banner still surfaces a pending assist when the session is gone.

## Self-Check: PASSED
- Files verified present: `src/stores/compose-session-store.ts`, `src/stores/compose-session-store.test.ts`, `src/screens/ComposeScreen.tsx`, `src/services/reach-out/handoff.ts` (all on disk).
- Commits verified in `git log`: `37e497e`, `cc4d49f`, `075acc1`, `5a10bbc`, `82ec988`.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
