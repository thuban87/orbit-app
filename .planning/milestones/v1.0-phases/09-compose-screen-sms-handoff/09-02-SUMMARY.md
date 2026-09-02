---
phase: 09-compose-screen-sms-handoff
plan: 02
subsystem: ui
tags: [react-native, expo-sms, expo-clipboard, navigation, compose, sms, clipboard]

# Dependency graph
requires:
  - phase: 09-01
    provides: "resolveComposeControls/ComposeControls (compose-logic.ts), getContactHeader.phone, expo-sms + expo-clipboard installed"
  - phase: 04
    provides: "RootStackParamList + RootNavigator native-stack shell, ContactProfileScreen, Avatar, FuelEditor row chrome"
  - phase: 07-08
    provides: "getRankedFuel in-query RANKED_FUEL_EXCLUSIONS (fuel-read.ts) + fuel-read.test.ts parity test"
provides:
  - "ComposeScreen — the single entry-agnostic compose surface (fuel reference cards + blank draft + capability-gated Send/Copy/add-number)"
  - "fuelKindLabel(kind) — compose-local pure kind-label helper"
  - "Compose route { contactId } in RootStackParamList + RootNavigator registration"
  - "contact-profile-message 'Message' entry button on ContactProfileScreen"
affects: [phase-11-notifications, phase-12-widget, phase-14-ai-suggest]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entry-agnostic screen: serializable { contactId } params only, self-fetching on focus — no callback params so notification/widget/AI entries open it with just an id"
    - "Explicit discriminated screenState (loading|ready|missing|error) + separate boolean|null capability flag, both reset at the START of every focus with a cancelled-flag guard on every post-await setter"
    - "Back → dashboard via goHome useCallback (navigation.reset INSIDE the callback) bound to BOTH the software Back pill AND a focused BackHandler hardwareBackPress override that returns true"

key-files:
  created:
    - "src/screens/ComposeScreen.tsx"
    - "src/services/fuel-kind-label.ts"
  modified:
    - "src/navigation/types.ts"
    - "src/navigation/RootNavigator.tsx"
    - "src/screens/ContactProfileScreen.tsx"

key-decisions:
  - "Interim controls literal while smsAvailable === null (Send hidden, Copy sole primary, no SMS-unavailable helper) so resolveComposeControls is only ever called with a concrete boolean — no wrong-state flash"
  - "SMS capability probe runs SEPARATELY from the header/fuel Promise.all so a rejected isAvailableAsync() degrades to false without failing the contact/fuel load"
  - "A null getContactHeader (stale/deleted contact) sets state 'missing' and immediately goHome() — never renders a 'no phone' surface for a nonexistent contact"
  - "Empty-draft Send/Copy ALLOWED (not gated) — owner-taste OPEN item A1, surfaced not decided"
  - "Two filled-accent primaries on the profile ('Message' + 'Log contact') — owner-taste OPEN item A2; 'Log contact' styling unchanged"

patterns-established:
  - "fuelKindLabel is a compose-local Record<FuelKind,string> helper (NOT a repo-wide single source of truth — FuelEditor keeps its own module-private KIND_OPTIONS, out of scope)"
  - "Read-only fuel cards reuse getRankedFuel (in-query off_limits/AI/blank exclusion is the access-control boundary) and render EVERY returned row"

requirements-completed: [CMP-01, CMP-02, CMP-03]

coverage:
  - id: D1
    description: "ComposeScreen reads fuel via getRankedFuel only (off_limits + unconfirmed AI + blank excluded in-query); no editor-only read, no UI filter"
    requirement: CMP-01
    verification:
      - kind: unit
        ref: "src/db/fuel-read.test.ts (RANKED_FUEL_EXCLUSIONS parity) — npm test"
        status: pass
      - kind: other
        ref: "grep -c getRankedFuel src/screens/ComposeScreen.tsx >=1; zero-match listFuelForEditor"
        status: pass
    human_judgment: false
  - id: D2
    description: "Send opens the OS SMS composer pre-filled via expo-sms; Copy writes the draft to the clipboard with a transient 'Copied'; in-flight Send latch; no DB write"
    requirement: CMP-01
    verification:
      - kind: other
        ref: "grep -c sendSMSAsync src/screens/ComposeScreen.tsx >=1; zero-match Linking/recency-dao"
        status: pass
      - kind: manual_procedural
        ref: "Pixel release-APK UAT — Send opens SMS app pre-filled; Copy→Copied→paste yields draft; double-tap Send opens once"
        status: unknown
    human_judgment: true
    rationale: "expo-sms/expo-clipboard are native modules that need a release APK on the Pixel (not a Metro reload) to exercise the real handoff; result is UI-observable only"
  - id: D3
    description: "Profile 'Message' button opens ComposeScreen; Back (software pill AND Android hardware) lands on the dashboard, never a pop to the profile"
    requirement: CMP-02
    verification:
      - kind: other
        ref: "grep -c contact-profile-message; grep name=\"Compose\" RootNavigator.tsx; npx tsc --noEmit"
        status: pass
      - kind: manual_procedural
        ref: "Pixel UAT — Message opens compose; both Back paths → dashboard"
        status: unknown
    human_judgment: true
    rationale: "Hardware BackHandler + navigation.reset behaviour is only verifiable on-device"
  - id: D4
    description: "No-phone degradation: Send hidden, Copy sole primary, 'Add a phone number' → Edit; no-wrong-state-flash holds on re-focus (per-focus reset + cancelled-flag guard)"
    requirement: CMP-03
    verification:
      - kind: other
        ref: "grep smsAvailable >=1; cancelled >=2; locked testIDs >=7"
        status: pass
      - kind: manual_procedural
        ref: "Pixel UAT — no-phone → add-number; re-focus from Edit shows no stale SMS-helper flash"
        status: unknown
    human_judgment: true
    rationale: "Re-focus/probe-timing state transitions are only observable driving the real screen on-device"

# Metrics
duration: ~10min
completed: 2026-08-16
status: complete
---

# Phase 9 Plan 02: Compose Screen & SMS Handoff Summary

**Entry-agnostic ComposeScreen showing getRankedFuel reference cards + a blank draft, with expo-sms Send / expo-clipboard Copy gated by an explicit loading|ready|missing|error state + boolean|null SMS capability, reached from a profile "Message" button and returning (software + hardware Back) to the dashboard.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-16T09:21:35Z
- **Completed:** 2026-08-16T09:22:35Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Built `ComposeScreen.tsx` — self-fetches header + fuel + SMS capability from `{ contactId }` alone; read-only fuel cards via `getRankedFuel` (off_limits/unconfirmed-AI/blank excluded in-query), a blank multiline draft, and capability-gated Send/Copy/add-number controls driven by `resolveComposeControls` behind an interim literal while the probe is pending.
- Explicit state machine (loading|ready|missing|error) + `smsAvailable: boolean|null`, both reset at the START of every focus with a `cancelled` flag flipped in cleanup guarding every post-await setter — no wrong-state flash on first mount OR re-focus; a null header exits home.
- Send carries an in-flight `sending` latch (mirrors the profile logging latch) with token-based disabled styling + `accessibilityState` + a `finally` reset; Copy is never gated by `sending` and shows a transient "Copied" via setState+setTimeout (timer cleared on unmount).
- Back → dashboard via a `goHome` useCallback (`navigation.reset` inside the body) bound to both the software Back pill and a focused `BackHandler` hardware override; additively-registered `Compose` route; profile "Message" filled-accent entry button.
- No DB write on Send/Copy (DATA-04 single-writer intact), no `Linking` import, expo-sms native marshalling only.

## Task Commits

Each task was committed atomically on `main` (in place, hooks on, no worktree):

1. **Task 1: Compose route type + ComposeScreen.tsx + fuelKindLabel** - `bdbffe7` (feat)
2. **Task 2: Register the Compose route in RootNavigator** - `0707783` (feat)
3. **Task 3: "Message" entry button on ContactProfileScreen** - `ebfb744` (feat)

## Files Created/Modified
- `src/screens/ComposeScreen.tsx` (created) - The entry-agnostic compose surface.
- `src/services/fuel-kind-label.ts` (created) - Pure compose-local `fuelKindLabel(kind)` helper over an exhaustive `Record<FuelKind,string>`.
- `src/navigation/types.ts` (modified) - Added serializable `Compose: { contactId: number }` route.
- `src/navigation/RootNavigator.tsx` (modified) - Imported ComposeScreen; appended `<Stack.Screen name="Compose">`.
- `src/screens/ContactProfileScreen.tsx` (modified) - Added the `contact-profile-message` "Message" button above "Log contact".

## Decisions Made
- **Interim controls literal while `smsAvailable === null`** — Send hidden, Copy sole primary, no SMS-unavailable helper — so the pure `resolveComposeControls` is only ever called with a concrete boolean (avoids the wrong-state flash A1 forbids).
- **SMS probe runs separately from the header/fuel `Promise.all`** so a rejected `isAvailableAsync()` degrades to `false` without pushing the screen into "error".
- **Null `getContactHeader` → state "missing" + immediate `goHome()`**, never a "no phone" surface for a deleted contact.
- **Empty-draft Send/Copy allowed, not gated** (owner-taste OPEN item A1 — surfaced, not decided).
- **Two filled-accent primaries on the profile** ("Message" + "Log contact"); "Log contact" styling untouched (owner-taste OPEN item A2).

## Deviations from Plan
None - plan executed exactly as written.

Two reword-only adjustments were needed to satisfy the plan's own automation-safe acceptance greps (which strip only `//` line comments, not `/* */` JSDoc): the header JSDoc in `ComposeScreen.tsx` and `fuel-kind-label.ts` originally spelled out the literal tokens `listFuelForEditor`, `Linking`, `react-native`, and `expo-` in `*`-prefixed block-comment lines, tripping the zero-match `grep -v '^\s*//'` checks. Reworded the prose to avoid the bare identifiers (behaviour unchanged) — not a code/logic deviation.

## Issues Encountered
- The zero-match acceptance greps count identifiers mentioned in `/* */` block comments (only `//` lines are filtered). Resolved by rewording the JSDoc, not by weakening the checks. Both greps now pass.

## User Setup Required
None - no external service configuration required. Both native modules (`expo-sms`, `expo-clipboard`) were installed in Plan 09-01 and ship no config plugin (autolinked; `app.config.ts` untouched).

## Next Phase Readiness
- The full profile → Message → fuel + draft → Send/Copy → Back-to-dashboard slice is code-complete and passes `npx tsc --noEmit`, `npm run check:colors`, and `npm test` (673 tests).
- **Pending on-device Pixel UAT** (release APK after `expo prebuild --clean`, NOT a Metro reload): expo-sms/expo-clipboard native handoff, the software+hardware Back-to-dashboard behaviour, the no-phone degradation, and the re-focus no-stale-flash guarantee (D2/D3/D4 human_judgment).
- Phases 11 (notification), 12 (widget), 14 (AI-Suggest) can now open Compose with just `{ contactId }`; a comment-only AI-Suggest layout slot is reserved above the draft.

## Self-Check: PASSED

All 5 created/modified files exist on disk; all 3 task commits (`bdbffe7`, `0707783`, `ebfb744`) present in git history.

---
*Phase: 09-compose-screen-sms-handoff*
*Completed: 2026-08-16*
