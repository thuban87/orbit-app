---
phase: 37-settings-personalization
plan: 03
subsystem: ui
tags: [settings, appearance, profile-dao, app-settings-dao, adr-047, d-02, d-04b, d-05, react-navigation]

# Dependency graph
requires:
  - phase: 37-settings-personalization
    plan: 02
    provides: SettingsAppearanceScreen (Theme section) at the registered SettingsAppearance route; persistAppearanceSetting reconcile pattern
  - phase: 13-orrery
    provides: app_settings sun fields (self_sun_colour, sun_contact_id), listSunCandidates, sunOccupantIsSelf, ADR-047
  - phase: 31-profile-presentation
    provides: profile_layout_template_uid / profile_background_template_uid global PREFs, listProfileLayoutTemplates / listProfileBackgroundTemplates
provides:
  - setProfileName(exec, name, now) — self-name writer on the single-row profile table (id=1), D-04b
  - SettingsAppearanceScreen extended — Your profile (self-name editor + owner photo), Orbit Appearance (self-star D-02 + Orbit Center picker), Profile Defaults (global layout/background with Default/None clear, D-05)
  - Settings monolith slimmed — Your photo + Your orbit groups removed
affects: [37-04, 37-05, 37-06, 37-07, 37-08]

actuals:
  tokens: 13200
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "New single-row profile writer mirrors setProfilePhoto exactly (one inWriteTransaction, ?-bound UPDATE ... WHERE id = 1, changes===1 loud-fail, bumpDataRevisionCore) with fail-fast normalise/validate OUTSIDE the transaction"
    - "Async choice-list controls (global profile defaults) render explicit loading + inline error states rather than assuming synchronous template availability"

key-files:
  created: []
  modified:
    - src/db/profile-dao.ts
    - src/db/profile-dao.test.ts
    - src/db/app-settings-dao.test.ts
    - src/screens/SettingsAppearanceScreen.tsx
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "setProfileName clears to NULL for empty/whitespace/null input (keeps the selfName ?? 'You' fallback correct), trims, bounds at 100 chars, and rejects control characters BEFORE the UPDATE opens (V5 / T-37-01) — targets profile, never contacts (RESEARCH Pitfall 1)"
  - "ADR-047 / D-02 enforced, not reversed: only the self-star colour is user-configurable and stays available regardless of the current centre; a contact at centre keeps its status-derived glow — no user-chosen colour for a contact centre"
  - "Global profile defaults (D-05) written via updateAppSettings PREF path (chosen over the narrow assignGlobal* writers) with a Default/None choice writing null; the per-contact managers stay contact-scoped and are NOT linked from Settings"
  - "No schema change and BACKUP_FORMAT_VERSION stays 5 (D-06): profile.name and both global template keys are existing columns that already round-trip backup"

requirements-completed: []

coverage:
  - id: T1
    description: "setProfileName round-trips a name, clears to NULL on empty/whitespace/null, trims surrounding whitespace, and rejects over-length / control-char names before any write (D-04b, V5)"
    verification:
      - kind: unit
        ref: "src/db/profile-dao.test.ts#setProfileName — self name writer (D-04b) on the id=1 profile row"
        status: pass
    human_judgment: false
  - id: T3
    description: "Each global profile-default key (layout, background) clears back to null via the Default/None choice — assign a UID, write null, getAppSettings returns null (review MEDIUM #3)"
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#clears each global template UID back to null (the Default/None choice, review MEDIUM #3)"
        status: pass
    human_judgment: false
  - id: UAT
    description: "Device UAT: self name persists in profile id=1 and clearing renders 'You'; star colour + Orbit Center persist; a contact centre offers no colour control; global default participates for a contact lacking a stronger override; Default/None clears the global default"
    verification: []
    human_judgment: true
    rationale: "On-device persistence + the ADR-047 no-contact-colour behaviour + effective-presentation fallback need visual + run-as DB confirmation on the Pixel (device-uat-runas-pattern). Deferred to end-of-phase UAT."

duration: 14min
completed: 2026-09-14
status: complete
---

# Phase 37 Plan 03: Appearance Completion (Orbit Center, owner profile, global defaults) Summary

**The Appearance category is complete: the owner photo, self-star colour (D-02), and a searchable Orbit Center picker migrate out of the 2,168-line Settings monolith into SettingsAppearanceScreen, joined by a validated self-name editor (D-04b) backed by a new `setProfileName` writer on the single-row `profile` table and global default profile layout/background controls (D-05) with a Default/None clear — all over existing storage, no schema or backup-format change, with ADR-047 enforced rather than reversed.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 3
- **Files modified:** 5 (0 created, 5 modified)
- **Task commits:** 5 (RED + GREEN for the TDD writer, a biome-clean refactor, plus the two migration commits)

## Accomplishments

- **`setProfileName` (D-04b, TDD).** New writer on the single-row `profile` table (id=1) mirroring `setProfilePhoto` exactly: fail-fast normalise/validate OUTSIDE the transaction (trim; empty/whitespace/null → SQL NULL clear; reject >100 chars or any C0/DEL control character), then one `inWriteTransaction` running a `?`-bound `UPDATE profile SET name = ?, modified_at = ? WHERE id = 1`, a `changes !== 1` loud-fail guard, and `bumpDataRevisionCore`. Never touches `contacts`. RED (failing cases) committed before GREEN.
- **Orbit Appearance + owner photo (Task 2).** The monolith's "Your orbit" group becomes an **Orbit Appearance** section on the Appearance screen: the self-star colour control (`self_sun_colour`) stays available regardless of the current centre, and a searchable **Orbit Center** picker (special "You" option, favourites-first candidates via `listSunCandidates`, occupant name resolved through `sunOccupantIsSelf`) writes `sun_contact_id`. Per ADR-047 / D-02 the self-star is the ONLY user-configurable colour — a contact at centre keeps its status-derived glow and gets no colour control. The owner photo (`PhotoSourcePicker target={{kind:'profile'}}`) moved unchanged into a **Your profile** section.
- **Global Profile Defaults + self-name editor (Task 3, D-05 / D-04b).** A **Profile Defaults** section exposes the GLOBAL default profile layout/background (`profile_layout_template_uid` / `profile_background_template_uid`) written through `updateAppSettings`, with choices sourced from `listProfileLayoutTemplates` / `listProfileBackgroundTemplates`, explicit loading + inline error states, and a **Default / None** choice that writes `null` so the user can return to inherited/factory behaviour. The current selection (including "Default / None" when null) is rendered. The per-contact managers stay contact-scoped and are NOT linked. The **self-name editor** is a bounded input seeded from `getProfile().name` that commits via `setProfileName` (empty clears to NULL → "You" fallback).
- **Monolith slimmed.** The "Your photo" row and the entire "Your orbit" section (plus now-orphaned imports, state, callbacks, and styles) were removed from `SettingsScreen.tsx` — no duplicate write surface remains.
- No migration added; `TARGET_VERSION` stays 29, `BACKUP_FORMAT_VERSION` stays 5 (D-06). ADR-047 upheld.

## Task Commits

1. **Task 1 (RED):** failing self-name writer cases — `81bf794` (test)
2. **Task 1 (GREEN):** `setProfileName` self-name writer on the profile table — `4045dd5` (feat)
3. **Task 1 (hardening):** control-char check via char-code scan (biome-clean) + import sort — `d9fb5cb` (refactor)
4. **Task 2:** migrate Orbit Appearance + owner photo into Appearance — `00a3ae4` (feat)
5. **Task 3:** global profile defaults + self-name editor in Appearance + null-clear test — `f22ee6c` (feat)

## Files Modified

- `src/db/profile-dao.ts` — added `setProfileName` writer + `hasControlChar` helper + `MAX_PROFILE_NAME_LENGTH`.
- `src/db/profile-dao.test.ts` — round-trip, clear-to-NULL (empty/whitespace/null), trim, over-length, control-char, and 100-char-boundary cases.
- `src/db/app-settings-dao.test.ts` — null-clear round-trip for both global template keys (review MEDIUM #3).
- `src/screens/SettingsAppearanceScreen.tsx` — Your profile (self-name editor + owner photo), Orbit Appearance (self-star + Orbit Center picker), Profile Defaults (global layout/background with Default/None).
- `src/screens/SettingsScreen.tsx` — removed the Your photo row + Your orbit section and their orphaned imports/state/callbacks/styles.

## Deviations from Plan

**1. [Rule 1 - Lint] Control-char check rewritten to satisfy Biome; profile-dao imports sorted.**
- **Found during:** Task 2 Biome pass.
- **Issue:** The initial `setProfileName` implementation used a regex literal containing C0 control characters, which trips Biome's `noControlCharactersInRegex`.
- **Fix:** Replaced the regex with a `hasControlChar()` char-code scan (identical behaviour, all 9 tests still green) and sorted the two `profile-dao.ts` imports Biome flagged.
- **Files:** `src/db/profile-dao.ts`
- **Commit:** `d9fb5cb`

No other deviations — the plan executed as written (updateAppSettings PREF path chosen for the global defaults per the plan's explicit "either axis is acceptable" allowance).

## Deferred Issues

- **Pre-existing, unrelated: `src/components/orrery/orrery-controls-render.test.tsx` fails to transform** (`SyntaxError: Unexpected token 'typeof'`, 0 tests run). The offending `typeof import("react")` predates Plan 37 (present at parent commit `8116dd9`; file last modified 7 days ago in `5d38954`, Phase 29). None of this plan's commits touch orrery. Logged to `.planning/phases/37-settings-personalization/deferred-items.md`. Out of scope for this plan (executor scope boundary). The full suite is otherwise green: 3569 tests pass.

## Known Stubs

None. Every migrated/new control drives a live DAO write (setProfileName / updateAppSettings / profile-dao via PhotoSourcePicker); the global-default controls render real template lists with loading + error states, no placeholder/empty-data path.

## Threat Flags

None. No new network endpoints, auth paths, file access, or schema changes. The self name (the only new free-text input) is bounded + control-char-rejected before a `?`-bound UPDATE (T-37-01 mitigated); colour/template writes reuse the existing `app_settings` validators; ADR-047 scope-reversal avoided (T-37-04). The self name never leaves the device.

## User Setup Required

None for automated verification. Device UAT (see coverage UAT) requires the owner's Pixel: confirm self-name persist + "You" clear (run-as DB read), star colour + Orbit Center persistence, that a contact centre offers no colour control, and that the global default participates for a contact lacking a stronger override / Default-None clears it. Deferred to end-of-phase UAT.

## Verification

- `npx tsc --noEmit` — clean (project-wide).
- `npx vitest run src/db/profile-dao.test.ts src/db/app-settings-dao.test.ts` — 114 passed.
- `npm run check:colors` — clean.
- `npx biome check` on all touched files — clean (one remaining flag is pre-existing history-lens test formatting on a line this plan did not author).
- Full suite: 3569 tests pass; 1 pre-existing unrelated transform failure (see Deferred Issues).

## Self-Check: PASSED

All five modified files present on disk; all five task commits (`81bf794`, `4045dd5`, `d9fb5cb`, `00a3ae4`, `f22ee6c`) exist in git history.
