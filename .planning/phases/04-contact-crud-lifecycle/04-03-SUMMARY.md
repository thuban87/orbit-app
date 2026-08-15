---
phase: 04-contact-crud-lifecycle
plan: 03
subsystem: ui / contact-form input controls
tags: [crud, react-native, form-controls, datetimepicker, picker, validation, tdd]
status: complete
requires:
  - phase: 04-01
    provides: "danger theme token (#E5484D) in ThemePalette + space-dark preset — the validation-error colour both controls render"
  - "src/types.ts (FREQUENCY_DAYS — the 7-preset day mapping; parseDate)"
  - "src/utils/dates.ts (formatLocalDate — the only date formatter)"
  - "src/components/field-widgets/TextFieldWidget.tsx + DropdownFieldWidget.tsx (input + Pressable-selection styling to copy)"
provides:
  - "FrequencyPicker — 7 presets + custom every-N → positive-integer interval_days, with onValidityChange so Save can block (CRUD-01)"
  - "TriStateLastSpoke — purely-controlled Today/Pick date/Not yet segmented control + native date picker, future-date rejected at entry (CRUD-02)"
  - "frequency-picker-logic.ts / tri-state-last-spoke-logic.ts — tested pure validation modules (parseCustomInterval, resolvePickedDate) reusable by the wiring screens"
  - "LastSpokeValue type — { kind: 'today' } | { kind: 'date'; date } | { kind: 'not-yet' } for consumers"
  - "@react-native-community/datetimepicker 9.1.0 + @react-native-picker/picker 2.11.4 installed; datetimepicker config plugin registered"
affects:
  - "Plan 04 (CreateContactScreen assembles both controls; passes { kind: 'today' } + blocks Save on FrequencyPicker invalidity)"
  - "Plan 06 (edit form never-contacted path passes { kind: 'not-yet' })"
tech-stack:
  added:
    - "@react-native-community/datetimepicker ~9.1.0 (native date picker)"
    - "@react-native-picker/picker ~2.11.4 (native dropdown — for later plans' category/social-battery)"
  patterns:
    - "pure-logic extraction: correctness-critical validation lives in a react-native-free .ts module (unit-testable in the node Vitest env) that the .tsx imports — the component file cannot load under vitest"
    - "purely-controlled segmented control: selected segment derives from the value prop, no internal default; consumers seed initial state"
    - "config-plugin registration for native modules deferred to the desktop prebuild via the deduped-Set plugins array in app.config.ts"
key-files:
  created:
    - "src/components/FrequencyPicker.tsx"
    - "src/components/frequency-picker-logic.ts"
    - "src/components/frequency-picker-logic.test.ts"
    - "src/components/TriStateLastSpoke.tsx"
    - "src/components/tri-state-last-spoke-logic.ts"
    - "src/components/tri-state-last-spoke-logic.test.ts"
  modified:
    - "package.json + package-lock.json (two native deps)"
    - "app.config.ts (register datetimepicker config plugin)"
decisions:
  - "Extracted the correctness-critical validation (interval > 0 integer; future-date rejection) into react-native-free logic modules so it is unit-tested in the node Vitest env — the component .tsx files import react-native + the native picker and cannot load under vitest (which is node-env, .test.ts-only). Honours tdd='true' where feasible; component-render/interaction UAT is device-only (deferred to the desktop rebuild)."
  - "FrequencyPicker surfaces validity via an onValidityChange(valid) callback (chosen over embedding validity in onChange) so Plan 04's Save can block without the parent re-deriving it; onChange never fires on an invalid custom entry."
  - "TriStateLastSpoke is purely controlled with NO internal default — selectedKind = value.kind; the only internal state is native-picker visibility + the transient future-date error. Consumers own the initial value."
  - "Did NOT set the picker's maximumDate — a future pick must still fire onChange so the locked rejection copy can show (setting maximumDate would silently suppress the message the contract requires)."
requirements-completed: [CRUD-01]
coverage:
  - id: D1
    description: "Both native input modules installed at SDK-57 versions (datetimepicker 9.1.0, picker 2.11.4); datetimepicker config plugin registered for the deferred prebuild"
    verification:
      - kind: other
        ref: "node -e require('./package.json') deps assertion → prints ok"
        status: pass
    human_judgment: false
  - id: D2
    description: "FrequencyPicker interval validation: 7 presets via FREQUENCY_DAYS, custom every-N → N×{1,7,30}, positive-integer guard rejecting 0/negative/blank/non-integer/exponent/hex with the exact locked copy"
    requirement: CRUD-01
    verification:
      - kind: unit
        ref: "src/components/frequency-picker-logic.test.ts (10 cases)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit && npm run check:colors src/components/FrequencyPicker.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "TriStateLastSpoke value model + future-date rejection: today/past accepted as { kind: 'date' } via formatLocalDate, a later local calendar day rejected with the exact locked copy and no emit"
    requirement: CRUD-02
    verification:
      - kind: unit
        ref: "src/components/tri-state-last-spoke-logic.test.ts (7 cases)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit && npm run check:colors src/components/TriStateLastSpoke.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "On-device widget behaviour: preset/custom chip selection + unit toggle, native date picker opens, muted 'Not yet' segment (not accent-filled), future-date copy renders in danger — requires the native modules linked by the desktop prebuild"
    verification: []
    human_judgment: true
    rationale: "Native modules (datetimepicker/picker) red-screen on a JS-only reload and require the phase-gate desktop rebuild before device UAT; RN component render/interaction is not testable in this box's node Vitest harness (VALIDATION.md manual-only)."
duration: 9min
completed: 2026-08-15
---

# Phase 4 Plan 03: Frequency + Last-Spoke Form Controls Summary

**FrequencyPicker (7 presets + custom every-N → positive-integer `interval_days`) and a purely-controlled TriStateLastSpoke (Today / Pick date / Not yet) segmented control over the native datetimepicker — both with their correctness-critical validation extracted into unit-tested react-native-free logic modules and every colour resolving through `useTheme().colors.*`.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-15T00:47:14-05:00
- **Completed:** 2026-08-15T00:52:00-05:00
- **Tasks:** 3
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- Installed the two RN-community native input modules (`@react-native-community/datetimepicker` 9.1.0, `@react-native-picker/picker` 2.11.4) via `npx expo install` (SDK-57-pinned) and registered the datetimepicker config plugin for the deferred desktop prebuild.
- Built `FrequencyPicker`: 7 presets mapped straight through `FREQUENCY_DAYS` (no re-declared numbers) plus a "Custom…" affordance revealing a number-pad input + days/weeks/months unit toggle (×1/×7/×30); an invalid custom interval is blocked at entry with the exact locked copy in `colors.danger`, and validity is surfaced to the parent via `onValidityChange` so Plan 04's Save can block.
- Built `TriStateLastSpoke`: a purely-controlled Today / Pick date / Not yet segmented control (selection derives from the `value` prop, no internal default) where "Not yet" stays muted (`textSecondary` + `borderStrong`, never accent-filled) and a future "Pick date" is rejected at entry with the locked copy, keeping the prior selection.
- Extracted the correctness-critical validation into `frequency-picker-logic.ts` (`parseCustomInterval`) and `tri-state-last-spoke-logic.ts` (`resolvePickedDate`, `LastSpokeValue`) so it is unit-tested (17 new cases) in the node Vitest env the .tsx files cannot load under.

## Task Commits

Each task committed atomically (native install as one commit; both components via TDD RED→GREEN):

1. **Task 1: Install native input modules** — `f559326` (chore) — deps + app.config.ts plugin
2. **Task 2: FrequencyPicker** — `bef2d88` (test, RED) → `ec2ffe1` (feat, GREEN)
3. **Task 3: TriStateLastSpoke** — `23e302f` (test, RED) → `62d062b` (feat, GREEN)

_No REFACTOR commits — GREEN implementations were clean; no cleanup pass needed._

## Files Created/Modified

- `src/components/FrequencyPicker.tsx` — controlled presets + custom every-N control; emits `interval_days`, reports validity
- `src/components/frequency-picker-logic.ts` — `parseCustomInterval`, `UNIT_FACTORS`, `INVALID_INTERVAL_MESSAGE` (tested)
- `src/components/frequency-picker-logic.test.ts` — 10 cases (N×unit, boundary, all invalid forms, locked copy)
- `src/components/TriStateLastSpoke.tsx` — purely-controlled tri-state segmented control + native date picker
- `src/components/tri-state-last-spoke-logic.ts` — `resolvePickedDate`, `isFutureLocalDate`, `FUTURE_DATE_MESSAGE`, `LastSpokeValue` (tested)
- `src/components/tri-state-last-spoke-logic.test.ts` — 7 cases (future reject + copy, today/past accept, local-date no-UTC-flip)
- `package.json` / `package-lock.json` — two native deps
- `app.config.ts` — datetimepicker config plugin registered in the deduped-Set plugins array

## Verification

- `npx vitest run`: **268 passed (25 files)** — 17 new logic cases green; the 251 prior tests unregressed.
- `npx tsc --noEmit`: clean (strict TS; datetimepicker `DateTimePickerEvent` typed via the package's own d.ts).
- `npm run check:colors` on both component files + both logic files: clean (every colour via theme tokens; the danger message uses `colors.danger`, never an inline hex).
- **Native-module device UAT deferred (not a failure):** datetimepicker/picker are native modules that red-screen on a JS-only reload and need the phase-gate desktop rebuild (`docs/runbooks/desktop-build-pipeline.md`) before the Pixel can exercise the native picker. Component logic fast-refreshes; the native surface does not.

## Invariants upheld

- **T-04-05 (data corruption):** custom interval validated `Number.isInteger && > 0` at entry (digits-only guard also rejects exponent/hex); future last-spoke rejected at entry so a future `occurred_at` can never pin a contact `stable` — both proven by unit tests, defence-in-depth ahead of the recency-dao chokepoint.
- **Purely-controlled contract (CRUD-02):** `TriStateLastSpoke` holds no default that overrides `value`; consumers seed create→Today / edit-never-contacted→Not yet.
- **"Not yet" is a valid non-error choice:** muted with `textSecondary`+`borderStrong`, never `accent` (not-filled) and never `danger`.
- **Local dates only:** `formatLocalDate` throughout; no `toISOString` anywhere in `src/components/` (only rule-documenting comments mention it).
- **Colour gate:** no colour literal outside `src/**/theme/**`; `check:colors` green.
- **No re-declared constants:** presets come from `FREQUENCY_DAYS` (`src/types.ts`).

## Decisions Made

- **Pure-logic extraction to make TDD feasible in this harness.** Vitest here is node-env and `.test.ts`-only with no React Native testing library, so a `.tsx` importing `react-native` (and the native picker) cannot be loaded or render-tested on this box. The correctness-critical validation — the exact behaviour the plan's `tdd="true"` `<behavior>` blocks describe — was extracted into react-native-free modules and driven RED→GREEN. Component render/interaction remains device-UAT (D4, human_judgment).
- **`onValidityChange` callback** for FrequencyPicker validity (rather than folding validity into `onChange`) so Plan 04 can block Save cleanly; `onChange` never fires on an invalid custom entry.
- **No `maximumDate` on the native picker** — a future pick must reach `onChange` so the locked rejection copy can render (a `maximumDate` cap would silently suppress the required message).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered the datetimepicker config plugin in app.config.ts**
- **Found during:** Task 1 (Install native input modules)
- **Issue:** `npx expo install` reported that `@react-native-community/datetimepicker` ships a config plugin that must be added to the Expo config; without it the deferred desktop prebuild would not link the module correctly. The plan's Task 1 said "Add nothing else" (scoped to package.json deps).
- **Fix:** Added `"@react-native-community/datetimepicker"` to the existing deduped-Set `plugins` array in `app.config.ts` (mirroring the existing `expo-sqlite` pre-registration). `@react-native-picker/picker` ships no config plugin, so it needs no entry.
- **Files modified:** `app.config.ts`
- **Verification:** `npx tsc --noEmit` clean; the deps assertion still prints `ok`.
- **Committed in:** `f559326` (Task 1 commit)

**2. [Implementation detail] Added two co-located pure-logic modules + their tests**
- **Found during:** Tasks 2 & 3
- **Issue:** The plan lists only the two `.tsx` artifacts, but `tdd="true"` asks for tested behaviour that the node/`.test.ts` Vitest harness cannot obtain from a react-native component.
- **Fix:** Extracted `frequency-picker-logic.ts` and `tri-state-last-spoke-logic.ts` (+ `.test.ts` for each); the components import them. No new runtime dependency; keeps the components thin.
- **Files modified:** the 4 new logic/test files
- **Verification:** 17 new cases pass; tsc + check:colors green.
- **Committed in:** `ec2ffe1`, `62d062b` (with each component)

---

**Total deviations:** 2 (1 Rule-3 blocking, 1 implementation-detail extraction)
**Impact on plan:** Both serve correctness — the plugin registration is required for the deferred native build; the logic extraction makes the plan's mandated TDD behaviour actually testable in this harness. No scope creep, no new runtime deps beyond the two authorised native modules.

## Issues Encountered

None — `expo install` resolved and pinned both packages first try; typecheck and colour gate passed without iteration.

## User Setup Required

None for this box. **The owner must run the desktop→Pixel build pipeline** (`docs/runbooks/desktop-build-pipeline.md`) before device UAT of this phase — the two native input modules are not linked into the currently-installed APK and will red-screen on a JS-only reload until the prebuild runs.

## Next Phase Readiness

- `FrequencyPicker` and `TriStateLastSpoke` are ready for Plan 04's `CreateContactScreen` to assemble (Plan 04 passes `{ kind: "today" }` and blocks Save on FrequencyPicker invalidity).
- `LastSpokeValue` and the two logic modules are importable by the wiring screens.
- **Blocker for device UAT only:** native rebuild pending (owner-run desktop pipeline). No blocker for continued JS-side development (Plan 04 can build against these components immediately).

## Self-Check: PASSED

- Files: FOUND src/components/FrequencyPicker.tsx, frequency-picker-logic.ts, frequency-picker-logic.test.ts, TriStateLastSpoke.tsx, tri-state-last-spoke-logic.ts, tri-state-last-spoke-logic.test.ts
- Commits: FOUND f559326 (chore), bef2d88 (test), ec2ffe1 (feat), 23e302f (test), 62d062b (feat)

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*
