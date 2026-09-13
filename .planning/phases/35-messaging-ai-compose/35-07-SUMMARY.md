---
phase: 35-messaging-ai-compose
plan: 07
subsystem: ui
tags: [compose, text-email-mode, message-mode, contact-methods, mailto, react-native]

# Dependency graph
requires:
  - phase: 35-messaging-ai-compose
    provides: "35-01 editor-first ComposeScreen + performReachOut { handoffStarted, assistUid } + compose-session-store (mode/subject/destination/setMode/setSubject/setDestination); 35-02 migration 028 default_message_mode/remembered_message_mode + getAppSettings accessors + updateAppSettings write path; 35-03 mode-aware resolveComposeControls/resolveUsableMode/effectiveMode/nextRememberedMode/resolveCopyTargets, mailto email handoff arm, setContactMethodPrimary single-method writer"
  - phase: 18.1-contact-data-normalization
    provides: "selectActionablePrimaryMethods + listContactMethodGroups (per-row is_primary/is_actionable); statement-immediate partial-unique primary index"
provides:
  - "ComposeScreen wired end-to-end for Text AND Email: mode init from the durable preference, ad-hoc mode switch, remembered-mode-on-commit, mode-aware destination resolution with preferred-then-fallback, usable no-destination state, establish-missing-primary picker, Email Subject field + separate Subject copy, and a mode-derived Transmit channel/endpoint"
affects: [35-08, 35-09]

# Actuals (#2632)
actuals:
  tokens: 6000     # chars/4 over the realized ComposeScreen diff (23894 chars); estimate was 60000 (low-confidence, large overshoot)
  tasks: 3
  commits: 4       # 3 task commits + this docs commit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screen stays a THIN consumer (WR-02): every send/copy/fallback/picker DECISION comes from the pure compose-logic layer (resolveComposeControls/resolveUsableMode/effectiveMode/nextRememberedMode/resolveCopyTargets) — the screen re-derives no capability arithmetic."
    - "One listContactMethodGroups read serves BOTH the effective-primary resolution (selectActionablePrimaryMethods) AND the establish-primary picker decision (per-row is_primary/is_actionable) — the selector alone cannot distinguish an explicit stored primary from a first-actionable fallback (MEDIUM)."
    - "Durable message-mode preference is seeded on a FRESH session only (store contactId != route contactId), so an in-app return to the same contact preserves the in-session mode; the remembered mode advances only on a committed Transmit/Copy via nextRememberedMode."

key-files:
  created: []
  modified:
    - src/screens/ComposeScreen.tsx

key-decisions:
  - "Reused actionablePrimaryPhoneDestination as the generic actionable-destination extractor for BOTH phone and email (it is purely is_actionable ? canonical_value : null); no new exported symbol was created, per the plan's artifacts contract."
  - "The remembered-mode write is centralized in one persistRememberedMode helper called ONLY from the Transmit and main-Copy handlers (never the switch handler, never the Subject-copy affordance) — so an ad-hoc switch and a Subject copy never advance the durable preference (COMP-02)."
  - "Transmit channel + endpoint derive from resolveUsableMode (preferred-then-fallback), not the raw session mode: an Email-mode draft with no email address falls back to the phone/text handoff; the establish-primary picker is additive (Transmit stays usable on the first-actionable fallback), never a gate."
  - "Copy-feedback refactored from a boolean to a single string state ('Message copied' / 'Subject copied') sharing one setTimeout — no per-frame animation (CLAUDE.md)."

patterns-established:
  - "Forward-reference discipline (MEMORY worklet-forward-ref-hazard): all useCallback helpers (flashCopyFeedback, refreshMethods, onChoosePrimary, persistRememberedMode, onSwitchMode) are declared ABOVE their callers — a forward reference tripped tsc TS2448 during Task 1 and was fixed by hoisting."

requirements-completed: [COMP-02, COMP-03, COMP-04]

coverage:
  - id: D1
    description: "Mode initializes from default_message_mode/remembered_message_mode via effectiveMode on a fresh session; ad-hoc switch flips session mode without writing the preference; remembered mode advances via nextRememberedMode only on committed Transmit/Copy"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#effectiveMode; #nextRememberedMode (plan 35-03, pass)"
        status: pass
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors (both exit 0); grep: effectiveMode/nextRememberedMode consumed; the remembered-mode setter is reached only from persistRememberedMode, called only in onTransmit + onCopy"
        status: pass
    human_judgment: true
    rationale: "The pure decisions (sentinel resolution, commit-only advancement) are node-tested in 35-03; the screen wiring (fresh-session seeding, switch, on-commit persist) is structurally proven by tsc/check:colors/grep but its running behavior is a Pixel phase-gate UAT (device-UAT norm)."
  - id: D2
    description: "Destination resolves per mode via selectActionablePrimaryMethods; resolveComposeControls (4-arg) gates send/copy; preferred-then-fallback via resolveUsableMode; usable no-destination state (Transmit unavailable + accessible explanation + Copy sole primary, not an error); Email transmittable while SMS availability unknown (probe gates Text only)"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#resolveComposeControls (Text/Email, HIGH-2); #resolveUsableMode (plan 35-03, pass)"
        status: pass
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors (both exit 0); grep: selectActionablePrimaryMethods/listContactMethodGroups/resolveComposeControls all consumed; no-destination branch renders Transmit hidden + Copy primary (no throw)"
        status: pass
    human_judgment: true
    rationale: "Mode-fallback + no-destination + probe-scoping decisions are node-tested in 35-03; the actual render of the no-destination state and picker presentation are Pixel phase-gate UAT."
  - id: D3
    description: "Establish-missing-primary: the picker is shown ONLY when the active mode has >=2 actionable candidates AND no explicit stored primary (decided via listContactMethodGroups per-row flags); a deliberate pick sets the canonical primary via setContactMethodPrimary (never applyContactMethodDiff)"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "src/db/contact-methods-dao.test.ts#setContactMethodPrimary (plan 35-03, pass)"
        status: pass
      - kind: automated_ui
        ref: "grep: setContactMethodPrimary called; applyContactMethodDiff appears only in a prohibitive comment; picker condition reads header.methodGroups per-row is_primary/is_actionable"
        status: pass
    human_judgment: true
    rationale: "The primary-swap writer is transaction-tested in 35-03; the picker presentation + selection flow is Pixel phase-gate UAT."
  - id: D4
    description: "Email mode exposes a Subject field + Body; Transmit carries recipient/subject/body through the email handoff arm; main Copy copies the Body only ('Message copied'); the Subject copy affordance copies the Subject only ('Subject copied'); channel derives from the mode, no hardcoded literal"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#resolveCopyTargets; src/services/reach-out/handoff.test.ts#performReachOut email arm (plan 35-03, pass)"
        status: pass
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors (both exit 0); grep: resolveCopyTargets consumed; performReachOut receives subject when usable==='email'; `grep 'channel: \"text\"'` returns nothing"
        status: pass
    human_judgment: true
    rationale: "Copy-target + email-handoff decisions are node-tested in 35-03; Subject-field visibility in Email mode + composer pre-fill are Pixel phase-gate UAT."

# Metrics
duration: ~10min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 07: ComposeScreen Text/Email Wiring Summary

**ComposeScreen now supports Text and Email end-to-end as a thin consumer of the tested compose-logic layer: mode initializes from the migration-028 durable preference (effectiveMode), an ad-hoc "Make this an email / a text" switch flips the session mode without persisting, the remembered mode advances only on a committed Transmit/Copy (nextRememberedMode), destinations resolve per mode with preferred-then-fallback (resolveUsableMode) plus a usable no-destination state and an establish-missing-primary picker (setContactMethodPrimary), Email exposes a Subject field with its own Subject-copy affordance, and Transmit derives its channel + endpoint from the usable mode — no hardcoded channel literal.**

## Performance
- **Duration:** ~10 min
- **Started:** 2026-09-13T17:04:43Z
- **Completed:** 2026-09-13T17:15:11Z
- **Tasks:** 3 (each an atomic commit)
- **Files modified:** 1 (src/screens/ComposeScreen.tsx; +349 / -45)

## Accomplishments
- **Mode init + ad-hoc switch + remembered-on-commit (COMP-02).** On a FRESH session (store contactId != route contactId, captured before startSession) the session mode is seeded from `default_message_mode`/`remembered_message_mode` via `effectiveMode` — a local SQLite read folded into the existing load `Promise.all`, never blocking render on network. A tertiary `accentText` "Make this an email" / "Make this a text" control flips the session mode via `setMode` and writes NO preference. A single `persistRememberedMode` helper (read current → `nextRememberedMode(current, mode, true)` → write via `updateAppSettings` only when changed) is called ONLY from the Transmit and main-Copy handlers.
- **Destination resolution + no-destination + establish-primary (COMP-03).** The load now reads `listContactMethodGroups` once and derives both effective primaries via `selectActionablePrimaryMethods`; `hasPhone`/`hasEmail` + `smsAvailable` + `mode` feed the 4-arg `resolveComposeControls`. `resolveUsableMode` picks the preferred-then-fallback mode for both the Transmit channel/endpoint and the picker target. No-destination is a usable degraded state (Transmit hidden, accessible "No phone number or email — copy your message instead." caption, Copy the sole primary, an establish-a-primary route to Edit), never a throw. The establish-primary picker is presented ONLY when the active mode has ≥2 actionable candidates AND no explicit stored primary (decided from the per-row `is_primary`/`is_actionable` groups, since `selectActionablePrimaryMethods` hides that distinction); a deliberate pick calls `setContactMethodPrimary` (NOT `applyContactMethodDiff`), records the endpoint in the session store, and refreshes the resolved methods in place. Long values truncate with an ellipsis in the picker row; the full `canonical_value` is applied on selection.
- **Email Subject + Subject copy + mode-derived Transmit (COMP-04).** A Subject field (label + input) renders in Email mode only, bound to the session store `subject`/`setSubject` (owned by 35-01) so it survives nav/background. Main Copy targets the Body only via `resolveCopyTargets` ("Message copied"); a separate tertiary Subject-copy affordance targets the Subject only ("Subject copied") and deliberately does NOT advance the remembered mode. Transmit passes `subject` into `performReachOut` when the usable mode is email (the text/call arms ignore it), with the channel derived from the usable mode — no `channel: "text"` literal anywhere.

## Task Commits
1. **Task 1: mode init + ad-hoc switch + remembered-on-commit** — `edffacf` (feat)
2. **Task 2: mode-aware destination resolution + no-destination state + establish-primary** — `a6a08a1` (feat)
3. **Task 3: Email Subject field + separate Subject copy + subject-carrying Transmit** — `9baa6e1` (feat)

**Plan metadata:** this commit (docs: complete plan) with STATE/ROADMAP/REQUIREMENTS update.

## Files Created/Modified
- `src/screens/ComposeScreen.tsx` — mode init/switch/remembered-on-commit wiring; both-type destination resolution; no-destination usable state; establish-primary picker via `setContactMethodPrimary`; Email Subject field + Subject copy; mode-derived Transmit channel/endpoint carrying subject+body.

## Decisions Made
- **Generic destination extractor reuse.** `actionablePrimaryPhoneDestination` (is_actionable ? canonical_value : null) is used for BOTH phone and email — no new exported symbol, honoring this plan's "creates no new exported symbols" contract.
- **Remembered-mode write is centralized and commit-scoped.** One `persistRememberedMode` helper, invoked only in `onTransmit` (on `handoffStarted`) and `onCopy` — never in `onSwitchMode` or `onCopySubject` — so ad-hoc switches and Subject copies never touch the durable preference (COMP-02 prohibition).
- **Channel from usable mode, picker additive.** Transmit channel/endpoint come from `resolveUsableMode`, so an Email-mode draft with no email falls back to the phone/text handoff; the establish-primary picker is an optional affordance over the first-actionable fallback, never a send blocker.

## Deviations from Plan
None — plan executed exactly as written. Rules 1–4 not triggered. One in-task fix (not a plan deviation): Task 1 initially declared `persistRememberedMode` below its Transmit/Copy callers, tripping tsc TS2448/TS2454 (block-scoped-before-declaration); resolved by hoisting the helper above its callers (MEMORY worklet-forward-ref-hazard, same class of error) before the Task 1 commit.

## CLAUDE.md Compliance
- No hardcoded colours — all through `useTheme().colors.*`; `npm run check:colors` exit 0. New UI in `AppText`/`Button` roles.
- No blocking network on the render/read path — the mode-preference and method reads are local `expo-sqlite` via DAOs; no inline SQL in the component.
- No `git worktree`, no branch, no push — committed in place on `main` with the repo's normal commit flow.
- `formatLocalDate` not needed (no date formatting in scope; timestamps use the existing `localDateTime()` DB helper).

## Behavior Coverage Split (per plan verification)
- **Node-tested pure logic (this screen is a thin consumer, adds no duplicative screen tests):** mode init/effectiveMode, remembered-on-commit/nextRememberedMode, mode-aware resolveComposeControls incl. no-destination Copy-only fallback, probe-pending scoped to Text, Email-transmittable-while-SMS-unknown, body/subject copy-target selectors → `src/logic/compose-logic.test.ts`; establish-primary write → `src/db/contact-methods-dao.test.ts`. All green (68 tests across the wired suites).
- **Device-UAT-only (RN screen render; project norm):** the actual render of the no-destination state, the establish-primary picker presentation, Subject-field visibility in Email mode, and composer pre-fill — Pixel phase-gate backstop (build+install+drive per the desktop-build-pipeline runbook).

## Known Stubs
None. No stub patterns introduced; no placeholder/empty-data flows added. The absence of a dedicated ComposeScreen render test is a deliberate, plan-recorded coverage decision (device-UAT-only for RN render), not a stub — nothing new to add to the WINDOWS ledger.

## Threat Surface
No new surface beyond the plan's `<threat_model>`. T-35-04 (mailto injection) stays mitigated by 35-03's `encodeURIComponent` handoff (this plan only supplies subject/body). T-35-17 (establish-primary tampering) is mitigated: the primary is set only on a deliberate picker selection via the canonical `setContactMethodPrimary` (single transaction, id→contact+type guard, clear-before-promote), never a silent auto-set. T-35-11 (no-destination) is a usable degraded state, never a crash/block.

## Issues Encountered
- Two pre-existing test failures remain out of scope (already logged by 35-02 to `deferred-items.md` + the WINDOWS ledger; neither imports any module this plan touched): `006-normalize-custom-field-values.test.ts` (no such column: allow_ai) and `orrery/orrery-controls-render.test.tsx`. Not re-touched.
- Biome (`npx biome check`) flags `role=` as an ARIA role (`useValidAriaRole`) on the AppText/Button semantic-role props — a false positive that the committed baseline and the whole codebase already trip; biome is not in this repo's enforced gate (no commit hook; the gate is tsc + check:colors + vitest). The one genuine biome flag I owned (import sort) was corrected.

## User Setup Required
None.

## Next Phase Readiness
- **35-08 (wave 4)** re-adds AI against the reshaped lifecycle into this now-mode-aware ComposeScreen; it must preserve the mode switch, Subject field, no-destination state, and the remembered-on-commit wiring.
- **35-09 (wave 4)** adds nav + the Compose-side "Message focus · N" (E4) entry alongside the destination/Subject surfaces landed here.
- **Device backstop (Pixel phase-gate UAT, not this plan):** Transmit in Text and Email modes (correct composer opens pre-filled); Copy copies body; Subject copy copies subject; a no-destination contact stays usable for Copy; a 2+-method contact with no explicit primary shows the picker and the pick sets the canonical primary.

## Self-Check: PASSED
- File verified present on disk: `src/screens/ComposeScreen.tsx` (FOUND).
- Task commits verified in `git log`: `edffacf`, `a6a08a1`, `9baa6e1` (all FOUND).
- Gates: `npx tsc --noEmit` exit 0; `npm run check:colors` exit 0; wired suites green (compose-logic + handoff + contact-methods-dao + contact-methods-read + compose-session-store = 68 tests). Grep gates: effectiveMode/nextRememberedMode/selectActionablePrimaryMethods/listContactMethodGroups/resolveComposeControls/resolveUsableMode/resolveCopyTargets/setContactMethodPrimary all consumed; `channel: "text"` literal absent; `applyContactMethodDiff` present only in a prohibitive comment.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
