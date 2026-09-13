---
phase: 35-messaging-ai-compose
plan: 09
subsystem: compose
tags: [compose, research, message-focus, navigation, origin-aware, ai-intent-retirement, react-native, expo]

# Dependency graph
requires:
  - phase: 35-messaging-ai-compose
    plan: 06
    provides: "ComposeResearchScreen (plain-prop) + compose-research-read (readComposeResearch / ResearchItem) + session-only messageFocus store"
  - phase: 35-messaging-ai-compose
    plan: 08
    provides: "AI re-wired into the mode-aware ComposeScreen (adaptive Draft/Rewrite, review surface, availability states) — preserved additively here"
provides:
  - "ComposeResearch registered route (both DashboardStack + OrreryStack + both param lists) via a plain-prop route adapter (ComposeResearchRoute)"
  - "Compose-side 'Things to Remember · N' entry (session-preserving navigate) + compact 'Message focus · N' summary (hidden when empty; Off Limits never shown)"
  - "ComposeOrigin route param + origin-aware Compose return (pop-toward-Profile from either stack; dashboard reset otherwise; no finished route in Back history)"
  - "composeExitDisposition(exit) — pure per-path session+navigation table (clear-on-confirm vs preserve-on-Back/Copy/pending/Not-yet)"
  - "requestAiSuggestion consume-once AI-intent plumbing fully retired (param + ai-suggestion-navigation.ts + its orphaned test removed)"
affects: []

# Actuals (#2632)
actuals:
  tokens: 5500
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain-prop screen registered as a native-stack route via a thin route adapter (ComposeResearchRoute) — keeps the 35-06 plain contactId contract while resolving as a serializable ComposeResearch route"
    - "Origin-aware return is DATA-driven by a pure node-tested disposition table (composeExitDisposition) the screen consumes — no scattered ad-hoc clear/reset calls; only the confirmed-log path clears the session + removes the finished route"
    - "Stack-agnostic pop-toward-Profile via navigation.goBack() (canGoBack guarded) so origin:'profile' resolves within whichever stack (Dashboard or Orrery) launched Compose"
    - "Populated Research count sourced by a non-blocking on-focus local SQLite read (readComposeResearch), reusing the same normalized projection the Research side renders — never on the render path"

key-files:
  created: []
  modified:
    - src/navigation/types.ts
    - src/navigation/tabs/DashboardStack.tsx
    - src/navigation/tabs/OrreryStack.tsx
    - src/screens/ComposeScreen.tsx
    - src/screens/ComposeResearchScreen.tsx
    - src/screens/ContactProfileScreen.tsx
    - src/logic/compose-logic.ts
    - src/logic/compose-logic.test.ts
    - src/db/lifecycle-consumer-ledger.test.ts
  deleted:
    - src/navigation/ai-suggestion-navigation.ts
    - src/navigation/ai-suggestion-navigation.test.ts

key-decisions:
  - "The 'Things to Remember · N' entry is HIDDEN when the populated Research count is 0 (nothing to research → no dead-end entry), shown with the count otherwise. The count is items.length over readComposeResearch (total populated projection incl. the Avoid group) — no UI-side isOffLimits filter, preserving the 35-06 principle that off-limits marking stays structural at the read boundary."
  - "ComposeResearchScreen kept its stable plain contactId contract (35-06); the navigation seam is a thin exported route adapter (ComposeResearchRoute) rather than converting the screen to route props — least surprise, sole consumer, honours the 35-06 stated-stable contract."
  - "The confirmed-log path now NAVIGATES away (origin-aware, removing the finished route) where it previously only cleared the session and stayed — this is the COMP-14 'no finished Compose route in Back history' requirement; ordinary Back preserves the session and returns origin-aware."
  - "composeExitDisposition carries removeFinishedRoute as an enumerated contract field; the navigation mechanism (goBack pop / dashboard reset) inherently removes the current route, so the screen keys off navigatesToOrigin + clearSession and the field documents/tests the finished-flow guarantee."

patterns-established:
  - "Origin-aware return keyed off an optional serializable route param + a pure exit-disposition table, consumed by both the Back handler and the confirmed-log handler"

requirements-completed: [COMP-08, COMP-10, COMP-11, COMP-14]

coverage:
  - id: E1
    description: "composeExitDisposition per-path table: confirmed-log → clearSession+removeFinishedRoute+navigatesToOrigin; Back → preserve session + navigate toward origin; transmit-pending/Not-yet/Copy → preserve + stay; clear-on-confirm fence (only 'logged' clears)"
    requirement: "COMP-14"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#composeExitDisposition — per-path session + navigation table"
        status: pass
    human_judgment: false
  - id: E2
    description: "Origin-aware caller shape: the Message→Compose navigate still carries contactId and the origin:'profile' param, is not lifecycle-gated (architectural-guard assertion updated to tolerate origin while preserving intent)"
    requirement: "COMP-14"
    verification:
      - kind: unit
        ref: "src/db/lifecycle-consumer-ledger.test.ts#keeps profile-initiated Compose reachable for a live Unbound contact"
        status: pass
    human_judgment: false
  - id: E3
    description: "Dual-stack ComposeResearch registration + retired-intent removal compile and run with no orphaned imports (project-wide tsc + full suite green)"
    requirement: "COMP-08"
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit (exit 0); npm test (3383 passed); grep gates: ComposeResearch registered in both stacks/param lists, requestAiSuggestion|consumeAiSuggestionIntent → NONE; npm run check:colors exit 0"
        status: pass
    human_judgment: true
    rationale: "tsc/test/grep/check:colors prove structure + compile + no orphaned consumers; the origin-aware Back-stack behaviour, Compose↔Research session survival, and the 'Message focus · N' summary render are device-observable (Pixel phase-gate backstop)."
  - id: E4
    description: "Origin-aware return (pop-toward-Profile from BOTH stacks), finished-route-not-in-Back-history, Compose↔Research session survival, 'Message focus · N' summary render"
    requirement: "COMP-11, COMP-14"
    verification:
      - kind: device_uat
        ref: "Pixel phase-gate backstop (35-VALIDATION.md): launch Compose from a Dashboard-reached Profile and an Orrery-reached Profile, Transmit-confirm → returns to Profile; Back does not resurrect the finished draft; dashboard-root launch → dashboard reset; Compose→Research→back preserves draft + Message Focus"
        status: deferred
    human_judgment: true
    rationale: "React-navigation Back-stack behaviour has no reliable JSDOM/navigator seam; verified on the Pixel at the phase gate per the project's device-UAT norm."

# Metrics
duration: 12min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 09: Final Compose expansion — Research link, Message Focus summary, origin-aware return, AI-intent retirement Summary

**Wired the final Compose entry points and retired the dead AI-intent nav plumbing: registered the `ComposeResearch` route in both stacks (via a plain-prop route adapter that keeps the 35-06 screen contract), linked Compose to the sibling Research side with a session-preserving 'Things to Remember · N' entry and a compact 'Message focus · N' summary (hidden when empty, Off Limits structurally excluded), made return origin-aware through a pure per-path `composeExitDisposition` table (confirmed-log clears the session and removes the finished route; Back preserves and returns toward origin; the Profile caller passes `origin:'profile'` so a Profile-launched send pops back to Profile from whichever stack hosted it), and removed the retired `requestAiSuggestion` consume-once param plus its module and orphaned test.**

## Performance
- **Duration:** ~12 min
- **Tasks:** 3
- **Files:** 9 modified, 2 deleted

## Accomplishments
- **Task 1 — ComposeResearch route + Compose research entry + Message Focus summary.** Registered `ComposeResearch: { contactId }` in both `DashboardStackParamList` and `OrreryStackParamList` and as a `<Stack.Screen>` in both stacks, via a thin exported `ComposeResearchRoute` adapter (extracts the serializable `contactId` route param → renders the plain-prop `ComposeResearchScreen`, keeping the 35-06 contract stable). Added a tertiary accentText `Things to Remember · N` entry on the Compose side that `navigate('ComposeResearch', { contactId })` WITHOUT touching the session store (draft/mode/Subject/Message Focus all survive the transition), shown only when the populated count > 0. Added a compact `Message focus · N` label sourced from the session `messageFocus` (hidden when empty); Off Limits can never appear because the store only ever holds `aiEligible`, non-off-limits items. Gave `ComposeResearchScreen` the same Back + Avatar + name identity header as Compose (D-14-010 orientation parity), with Back popping to Compose (session preserved).
- **Task 2 — origin-aware return + pure exit-disposition table.** Added an optional serializable `origin` param (`ComposeOrigin = 'profile' | 'dashboard' | 'deep-link'`) to the Compose route in both param lists. Encoded the per-path session+navigation disposition as the pure, node-tested `composeExitDisposition(exit)` in `compose-logic.ts` — the screen consumes it via a single `performExit` helper rather than scattering clear/reset calls. `ContactProfileScreen` now passes `origin:'profile'` (the only caller whose return semantics differ; HomeScreen/widget/notification are intentionally untouched and still type-check on the optional param). The return branches on origin: `'profile'` → stack-agnostic `navigation.goBack()` (pops back to Profile within whichever stack launched Compose, removing the finished route); otherwise the existing dashboard reset. The confirmed-log path now navigates origin-aware and removes the finished Compose route from Back history (previously it only cleared and stayed); ordinary Back preserves the session and returns origin-aware.
- **Task 3 — retired the AI-intent nav plumbing.** Removed the retired `requestAiSuggestion` consume-once param from the Compose route type (both param lists), deleted `src/navigation/ai-suggestion-navigation.ts` (dead since Phase 31 removed the Profile AI-draft entry) and its now-orphaned test (which imported the removed helper and asserted the retired param). Confirmed via grep that no consumer remains and that no focus/mount effect auto-starts AI — `begin()` runs only from the adaptive-action tap handler (plan 35-08).

## Task Commits
1. **Task 1: ComposeResearch route + Compose research entry & Message Focus summary** — `21d6f5a` (feat)
2. **Task 2: origin-aware Compose return via pure exit-disposition helper** — `a08d173` (feat)
3. **Task 3: retire requestAiSuggestion consume-once AI-intent plumbing** — `bfa33cb` (refactor)

## Deviations from Plan
### 1. [Rule 2 — required functionality] Added the contact-identity header to ComposeResearchScreen
- **Found during:** Task 1
- **Issue:** The must-have truth (COMP-08) and D-14-010 require "the same header kept on both sides for orientation," but the 35-06 `ComposeResearchScreen` rendered no contact-name header, and the plan's Task 1 `<files>` list omitted that file.
- **Resolution:** Added a Back + Avatar + name (`role="heading"`) header to `ComposeResearchScreen` (reading the header via `getContactHeader` on focus, local SQLite, non-blocking) and a `useNavigation()`-backed Back that pops to Compose with the session preserved. Enforcing a recorded decision (D-14-010) is a planner call; documented here as a scope note because the file was not in the plan's files list.
- **Files:** src/screens/ComposeResearchScreen.tsx

### 2. [decision] 'Things to Remember · N' hidden at count 0; count is total populated projection
- **Found during:** Task 1
- **Issue:** The plan specifies "populated count" but not the hide-at-zero behaviour nor whether the Avoid (off-limits) group counts.
- **Resolution:** The entry is hidden when the populated count is 0 (no dead-end into an empty Research side) and the count is `items.length` over `readComposeResearch` — no UI-side `isOffLimits` filter, keeping off-limits marking structural at the read boundary (consistent with the 35-06 Research-screen decision). Implementation detail (executor's bucket).
- **Files:** src/screens/ComposeScreen.tsx

## Constraint Adherence (orbit hard constraints)
- **Theme tokens only.** All new UI (research entry, Message Focus label, Research header) resolves colours through `useTheme().colors.*` / existing tokens; `npm run check:colors` exit 0. New controls speak in `Button`/`AppText` roles and pad to the 44px floor.
- **Local-first / no blocking network on a read path.** The new `readComposeResearch` and `getContactHeader` reads are local SQLite, run off-focus, guarded by a `cancelled` flag, and never gate render. No network introduced.
- **No per-frame animation from React state**; `formatLocalDate` not needed (no date formatting in scope).
- **No worktree, no branch, no push** — all committed in place on `main` with hooks (never `--no-verify`).
- **Reviewed the code, not the diff.** Read the current ComposeScreen, ComposeResearchScreen, both nav stacks, types.ts, reset-intents, back-intent, the compose-session-store, compose-logic, and every consumer of the retired AI-intent plumbing (grepped all of `src/`, including tests + nav stacks) before removing any symbol.

## Verification
- `npx tsc --noEmit` — **clean, project-wide**.
- `npm run check:colors` — **pass**.
- Targeted/consumer suites: `src/db/lifecycle-consumer-ledger.test.ts`, `src/logic/compose-logic.test.ts`, `src/stores/compose-session-store.test.ts`, `src/db/compose-research-read.test.ts` — **64 passed**.
- Full suite (`npm test`): **3383 tests passing, 354/355 suites green**. The single failing suite is the pre-existing Phase-30 `src/components/orrery/orrery-controls-render.test.tsx` (`SyntaxError: Unexpected token 'typeof'`, transform-level) — references none of this plan's files, already tracked in `deferred-items.md` and prior 35-02/04/06/08 summaries. Out of scope (scope boundary); not fixed.
- Grep gates: `ComposeResearch` registered in both stacks + both param lists; `grep -rn "requestAiSuggestion\|consumeAiSuggestionIntent" src/` → **NONE**; `grep -n "origin"` shows the Compose param in both lists and the Profile caller passing `origin:'profile'`.

## Threat Surface
No new surface beyond the plan's `<threat_model>`. T-35-20 (Back-stack tampering): the finished Compose route is removed on the confirmed log (goBack pop / dashboard reset) so a completed draft cannot be resurrected — device-verified at the phase gate. T-35-24 (route registration): `ComposeResearch` registered in both stacks + param lists, carrying only `{ contactId }`, prevents an unregistered-route throw. T-35-12 (retired AI intent): `requestAiSuggestion` + `consumeAiSuggestionIntent` removed; grep proves no caller auto-starts AI. T-35-19 (deep-link origin): the `origin` param only routes return, carries no contact content, and never widens egress.

## Known Stubs
None. `researchCount` defaults to 0 only while the on-focus read is in flight (real local read, not a placeholder). The `Message focus · N` summary and Research entry are fully wired to live session/read state.

## Deferred / Out-of-Scope
- **Pre-existing unrelated failure:** `src/components/orrery/orrery-controls-render.test.tsx` (Phase 30 transform `SyntaxError`) — see Verification; already tracked. Not a regression from this plan.
- **Device backstop (COMP-14, phase-gate UAT):** on the Pixel — launch Compose from a Dashboard-reached Profile and an Orrery-reached Profile, Transmit-confirm and verify the return lands on Profile with the finished draft gone from Back history; launch from dashboard root and verify the dashboard reset; open Compose→Research→back and confirm the draft + Message Focus survive; confirm `Message focus · N` reflects the selection.

## Next Phase Readiness
- Phase 35 (Messaging & AI Compose) plan set is complete (9/9). The Compose surface is the finished editor-first, sibling-Research, origin-aware surface: manual editor + mode switch + Subject + Copy/Transmit + "Did you send it?" panel (35-01/07), AI as an additive adaptive Draft/Rewrite layer with a three-suggestion review surface and availability states (35-04/05/08), the Things to Remember Research side + Message Focus (35-06), and now the navigation wiring + origin-aware return + retired dead plumbing (35-09).

## Self-Check: PASSED
- Files verified present on disk: `src/navigation/types.ts`, `src/navigation/tabs/DashboardStack.tsx`, `src/navigation/tabs/OrreryStack.tsx`, `src/screens/ComposeScreen.tsx`, `src/screens/ComposeResearchScreen.tsx`, `src/logic/compose-logic.ts`.
- Files verified deleted: `src/navigation/ai-suggestion-navigation.ts`, `src/navigation/ai-suggestion-navigation.test.ts`.
- Task commits verified in `git log`: `21d6f5a`, `a08d173`, `bfa33cb`.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
</content>
</invoke>
