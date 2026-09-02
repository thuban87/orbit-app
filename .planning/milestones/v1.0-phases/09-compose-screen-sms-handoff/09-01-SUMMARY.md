---
phase: 09-compose-screen-sms-handoff
plan: 01
subsystem: database
tags: [expo-sms, expo-clipboard, compose, sms, clipboard, control-state, sqlite, tdd]

# Dependency graph
requires:
  - phase: 08 (favourites / dashboard)
    provides: "the 08-06 favourite_rank additive-widen idiom that getContactHeader's phone widen mirrors"
  - phase: 04 (profile scaffold)
    provides: "getContactHeader — the light by-id header seek this plan widens"
provides:
  - "resolveComposeControls(hasPhone, smsAvailable) — the pure, node-tested CMP-03 Send/Copy capability resolver + ComposeControls interface"
  - "expo-sms + expo-clipboard installed at SDK-57-pinned ~57.0.1 (no config-plugin entry)"
  - "getContactHeader additively returns phone (string | null)"
affects: [09-02 (ComposeScreen assembly), 11 (notification entry), 12 (widget entry), 14 (AI Suggest)]

# Tech tracking
tech-stack:
  added: [expo-sms ~57.0.1, expo-clipboard ~57.0.1]
  patterns:
    - "Pure discriminated control-state resolver in src/logic/*.ts (dashboard-empty-logic idiom), node-tested off-device"
    - "Additive getContactHeader widening: append field to SELECT + both type literals, keep the light by-id seek (08-06 favourite_rank idiom)"

key-files:
  created:
    - src/logic/compose-logic.ts
    - src/logic/compose-logic.test.ts
  modified:
    - src/db/contact-read.ts
    - src/db/contact-read.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Both native deps installed via `npx expo install` (SDK-pinned ~57.0.1), NOT npm latest — first-party Expo modules, no postinstall (T-09-SC mitigated)."
  - "No app.config.ts plugins entry added — neither module ships a config plugin; an entry would fail prebuild (01-01 deduped-plugins lesson)."
  - "getContactHeader widened additively for phone rather than switching to getContactForEdit — the header stays the light by-id seek (no join, no custom-value/link load)."
  - "no-phone branch is checked FIRST in resolveComposeControls so a missing number always wins over SMS capability — (false, true) reads identically to (false, false)."

patterns-established:
  - "Pure control-state resolver: same inputs → same output, no I/O, never throws; every branch node-tested."
  - "Additive DAO widening with a mirrored safety doc-comment naming the field-wise callers."

requirements-completed: [CMP-01, CMP-03]

coverage:
  - id: D1
    description: "resolveComposeControls decides all three CMP-03 capability rows (no-phone / phone+no-SMS / phone+SMS) plus purity"
    requirement: "CMP-03"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#resolveComposeControls — CMP-03 Send/Copy capability matrix"
        status: pass
    human_judgment: false
  - id: D2
    description: "expo-sms + expo-clipboard installed at SDK-pinned ~57.0.1 with no config-plugin entry; project typechecks"
    requirement: "CMP-01"
    verification:
      - kind: unit
        ref: "node -e require('./package.json') deps assert expo-sms + expo-clipboard ~57.0.1"
        status: pass
      - kind: other
        ref: "test \"$(grep -Ec 'expo-sms|expo-clipboard' app.config.ts || true)\" -eq 0"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "getContactHeader returns phone additively; phone-bearing and phone-less cases proven; existing callers unbroken"
    requirement: "CMP-03"
    verification:
      - kind: unit
        ref: "src/db/contact-read.test.ts#getContactHeader — by-id light read (archived-reachable by design)"
        status: pass
      - kind: unit
        ref: "npm test (full) — 673 passed"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-16
status: complete
---

# Phase 9 Plan 01: Compose Prerequisites Summary

**Pure node-tested `resolveComposeControls` (CMP-03 Send/Copy matrix), expo-sms/expo-clipboard installed at SDK-pinned ~57.0.1 with no config-plugin entry, and an additive `phone` widen on `getContactHeader`.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-16T09:11:03Z
- **Completed:** 2026-08-16T09:14:09Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `resolveComposeControls(hasPhone, smsAvailable)` + `ComposeControls` — a pure, no-import, node-tested resolver covering all three CMP-03 capability rows (no-phone / phone-but-no-SMS / phone+SMS) plus a purity assertion, with the no-phone branch first so a missing number always wins over SMS capability.
- `expo-sms` and `expo-clipboard` installed via `npx expo install` at SDK-57-pinned `~57.0.1` (both first-party Expo modules, no postinstall), with the `app.config.ts` plugins array left untouched.
- `getContactHeader` widened additively to return `phone: string | null` — appended to the SELECT and both type literals, keeping the light by-id header seek (no join, not switched to `getContactForEdit`), proven by new phone-bearing + phone-less test cases.

## Task Commits

Each task was committed atomically (TDD tasks split RED → GREEN):

1. **Task 1 (RED): failing CMP-03 compose control-state matrix** - `502be8d` (test)
2. **Task 1 (GREEN): pure Send/Copy capability resolver** - `8d4ef2a` (feat)
3. **Task 2: install expo-sms + expo-clipboard** - `3d174df` (chore)
4. **Task 3 (RED): assert getContactHeader returns phone** - `fe46bbb` (test)
5. **Task 3 (GREEN): widen getContactHeader for phone** - `0d359d4` (feat)

**Plan metadata:** (docs commit — this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `src/logic/compose-logic.ts` - `resolveComposeControls` + `ComposeControls`; the pure CMP-03 capability gate (no react-native/expo/db imports).
- `src/logic/compose-logic.test.ts` - the CMP-03 matrix proof (4 branches + purity, ≥5 assertions).
- `src/db/contact-read.ts` - `getContactHeader` gains `phone` in the SELECT + both type literals, with a mirrored safety doc-comment.
- `src/db/contact-read.test.ts` - `makeContact` opts extended with optional `phone`; phone-bearing + phone-less assertions.
- `package.json` / `package-lock.json` - `expo-sms` + `expo-clipboard` at `~57.0.1`.

## Decisions Made
- Installed via `npx expo install` (SDK-pinned ~57.0.1), not npm latest — keeps both aligned with every other `expo-*` dep and matches the verified-first-party, no-postinstall audit (T-09-SC mitigated).
- No `app.config.ts` plugins entry — neither module ships a config plugin; a bogus entry is a prebuild error (01-01 deduped-plugins lesson).
- Additive `getContactHeader` widen over `getContactForEdit` — the header needs only name/photo/phone; the heavier read joins categories and loads custom values + links.
- no-phone branch ordered first in the resolver so SMS capability is irrelevant without a number.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `npx expo install` reported pre-existing npm-audit vulnerabilities (7 moderate, 15 high) in the wider dependency tree; these are unrelated to the two added first-party Expo modules (no postinstall, SDK-tracked) and out of scope for this plan — not fixed here.

## Verification
- `npm test` (full): **673 passed** (54 files) — up from 666 at Phase 8 close (+5 compose-logic, +2 phone assertions).
- `npx tsc --noEmit`: **clean**.
- `npm run check:colors`: **clean** (this plan adds no UI).
- `test "$(grep -Ec 'expo-sms|expo-clipboard' app.config.ts || true)" -eq 0`: **PASS** (no plugin entry).

## Native-dep note (for Plan 02 UAT)
`expo-sms`/`expo-clipboard` add autolinked native code. On-device UAT of the compose screen (Plan 02) requires a full `expo prebuild --clean` + release APK via `docs/runbooks/desktop-build-pipeline.md` — a Metro JS reload will NOT surface the native modules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (ComposeScreen assembly) has all three prerequisites: the tested capability resolver, both native modules autolinkable at the next prebuild, and `phone` reachable from the light header read.
- No blockers.

## Self-Check: PASSED

- Created files verified on disk: `src/logic/compose-logic.ts`, `src/logic/compose-logic.test.ts`, `09-01-SUMMARY.md`.
- Task commits verified in git: `502be8d`, `8d4ef2a`, `3d174df`, `fe46bbb`, `0d359d4`.

---
*Phase: 09-compose-screen-sms-handoff*
*Completed: 2026-08-16*
