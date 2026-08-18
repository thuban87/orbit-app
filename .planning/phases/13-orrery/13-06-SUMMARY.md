---
phase: 13-orrery
plan: 06
subsystem: settings — orrery sun controls
tags: [orrery, settings, star-palette, sun-picker, self-sun-colour, sun-contact-id, app-settings-dao, modal-flatlist, device-uat]
status: complete

# Dependency graph
requires:
  - phase: 13-orrery (13-01)
    provides: "app-settings-dao widened getAppSettings/updateAppSettings (selfSunColour + sunContactId) with the exported SELF_SUN_COLOUR_RE / assertSelfSunColour / assertSunContactId validators"
  - phase: 13-orrery (13-03)
    provides: "sun-picker-read listSunCandidates (favourites-first, archived-excluded, never-contacted included) + SunCandidate type"
  - phase: 13-orrery (13-04)
    provides: "theme starPalette token (6 colours, gold index 0 = unset self-sun default)"
  - phase: 04-contacts
    provides: "contact-read getContactHeader (name + archived_at — the M4 archived/missing fallback trigger)"
  - phase: 11-notifications
    provides: "SettingsScreen host + the `persist` try/catch + Logger.error write posture (M6 mirror) + the section/row/helper chrome"
  - phase: field-widgets
    provides: "DropdownFieldWidget zero-dependency Pressable→Modal+FlatList picker idiom + background-token scrim"
provides:
  - "Settings 'Your star' row — the ~6 starPalette swatches as circular ≥44px targets; selected = selfSunColour (or starPalette[0] when unset) with the accent ring; writes self_sun_colour (ORR-05)"
  - "Settings 'Sun / centre' row — a Modal+FlatList picker (Me first, then favourites-first candidates); writes sun_contact_id (NULL for Me); ORR-06 relocated to Settings"
affects: [13-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-time self-sun resolution in the UI: the selected swatch = selfSunColour ?? colors.starPalette[0] — NULL resolves to gold at RENDER, no stored hex default (the DAO never resolves a palette colour)"
    - "M4 archived/missing occupant → self: the Settings row resolves the stored sun_contact_id via getContactHeader and shows 'Me' when the header is missing OR archived_at !== null — the SAME self fallback resolveSunOccupant applies on the canvas, so Settings and orrery never disagree"
    - "M6 write posture: both the swatch write and the occupant write mirror the screen's `persist` try/catch + Logger.error — a future non-conforming starPalette token (rejected by the DAO validator) surfaces a handled, logged error, not an unhandled rejection"
    - "Zero-dependency picker reuse: the DropdownFieldWidget Pressable→Modal+FlatList idiom (background-token scrim at 0.85, surfaceElevated sheet) reused inline for the sun picker — no new picker library"

key-files:
  created:
    - .planning/phases/13-orrery/13-06-SUMMARY.md
  modified:
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Placed both controls in a new 'Your orbit' sectionHeading block directly below the 'Your photo' self row (mirrors the Phase-5 self pattern the plan named)"
  - "Swatch selection ring rendered as a constant 3px border that switches colour (accent when selected, border otherwise) — no layout shift between states; device-UAT (13-08) can refine the ring treatment"
  - "M4 handled at the display minimum the plan allowed: the row shows 'Me' for an archived/missing stored occupant; the stored setting is NOT auto-cleared to NULL (the migration-003 FK already reverts a hard-purged occupant, and the canvas applies the same fallback)"
  - "sunOptions built in render as [{id:null,name:'Me'}, ...listSunCandidates] — the synthetic Me (NULL id) prepended UI-side, candidates already archived-excluded by the read"

patterns-established:
  - "Settings self-control that reads on focus + writes-then-reloads through the widened app-settings-dao, wrapped in the shared error posture"

requirements-completed: [ORR-05, ORR-06]

coverage:
  - id: T1
    description: "'Your star' — the starPalette swatches as ≥44px Pressables; selected (selfSunColour, or starPalette[0] gold when unset) carries the accent ring; tapping persists self_sun_colour via updateAppSettings and reloads on focus; write wrapped in try/catch + Logger.error (M6)"
    requirement: "ORR-05"
    verification:
      - kind: other
        ref: "npx tsc --noEmit clean; npm run check:colors clean (swatch fills are starPalette TOKENS, no hex literal); npm test 1000 green; biome clean on SettingsScreen. Render/tap flow is device-UAT in 13-08."
  - id: T2
    description: "'Sun / centre' — a Modal+FlatList picker with Me first then favourites-first candidates (listSunCandidates); the current occupant name shows on the row; selecting Me writes sun_contact_id=NULL, a contact writes its id, both persist + reload; M4 archived/missing stored occupant → 'Me'; write wrapped in try/catch + Logger.error (M6)"
    requirement: "ORR-06 (relocated to Settings by owner decision)"
    verification:
      - kind: other
        ref: "npx tsc --noEmit clean; npm run check:colors clean (scrim via background token); npm test 1000 green; biome clean. Picker render + selection is device-UAT in 13-08."

metrics:
  duration_minutes: 8
  completed: 2026-08-17
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
---

# Phase 13 Plan 06: Settings "Your star" swatch + "Sun / centre" picker Summary

Two Settings controls that own the orrery sun — a "Your star" swatch row over the themed `starPalette` (self-sun colour, ORR-05) and a "Sun / centre" occupant picker (Me / favourites / all contacts, the owner-relocated half of ORR-06) — both persisting through the widened `app-settings-dao` and reading on focus, wrapped in the screen's existing `persist`-style error posture.

## What shipped

A new **"Your orbit"** section in `SettingsScreen.tsx`, placed below the Phase-5 "Your photo" self row:

- **"Your star"** (`settings-your-star-row`) renders the six `useTheme().colors.starPalette` tokens as circular 44px `Pressable` swatches (`settings-star-swatch-{index}`). The selected swatch — the one equal to `selfSunColour ?? starPalette[0]` (NULL resolves to gold at render, no stored hex default) — carries a 3px `accent` border ring. Tapping writes `self_sun_colour` via `updateAppSettings` and reloads. Helper copy per the UI-SPEC: "Pick the colour of your star at the centre of your orbit."
- **"Sun / centre"** (`settings-sun-centre-row`) shows the resolved occupant name and opens a `Modal` + `FlatList` picker (`settings-sun-picker`) built on the app's zero-dependency dropdown idiom. The list is `[{ id: null, name: "Me" }, ...listSunCandidates()]` — the synthetic Me first, then favourites-first candidates. Selecting an option (`settings-sun-option-{id|me}`) writes `sun_contact_id` (NULL for Me), closes the modal, and reloads. Helper copy: "Choose who sits at the centre — you, or someone you orbit around."

Both controls load their state in the focus effect via a new `reloadOrbit` callback (cancelled-flag-free, matching `reloadNotifications`).

## Review-concern mitigations carried through

- **M4 (archived/missing occupant → self):** `reloadOrbit` resolves a non-null `sun_contact_id` via `getContactHeader` and displays "Me" when the header is missing OR `archived_at !== null` — the same self fallback `resolveSunOccupant` applies on the canvas (13-05), so Settings and the orrery never disagree about a hidden occupant. Display is the plan's stated minimum; the stored setting is not auto-cleared (the migration-003 FK reverts a hard-purged occupant).
- **M6 (error posture):** both writes mirror the `persist` helper — `try { await updateAppSettings(…); await reloadOrbit() } catch (err) { Logger.error(LOG_SCOPE, …, err) }` — so a future non-`#RRGGBB` `starPalette` token (which the DAO validator rejects) surfaces a handled, logged error, not an unhandled promise rejection.
- **L10 (doc-sync pointer):** an in-code comment on `sunOptions` records that this IS ORR-06's "assign the sun", relocated to Settings by owner decision (the orrery long-press was rejected) — a diff-scoped auditor seeing no orrery sun-assignment gesture must read this as SATISFIED, not a gap. REQUIREMENTS.md was NOT edited.
- **M3 (no ring_seq normalization):** switching `sun_contact_id` here writes only `app_settings`; orrery-read derives the display rank densely at read (13-03), so a sun change cannot corrupt ring order — nothing to normalize here.

## Colour discipline

Every colour resolves through theme tokens: the swatch fills ARE `starPalette` tokens (legitimate token use, not hardcoded hex), the ring/labels use `accent`/`border`/`textPrimary`/`textSecondary`, and the modal scrim uses `colors.background` at 0.85 opacity (the shipped scrim idiom). `npm run check:colors` stays green.

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes, no auth gates, no architectural escalations.

## Known Stubs

None. Both controls are fully wired to the DAO and the read layer; no placeholder data.

## Verification

- `npx tsc --noEmit` — clean
- `npm run check:colors` — clean (no hex literal; swatches are tokens, scrim is the background token)
- `npx biome check src/screens/SettingsScreen.tsx` — clean (added lines biome-conformant; no unrelated reformatting)
- `npm test` — 83 files, 1000 tests green

The `.tsx` render + pick flow is DEVICE-UAT (13-08) per the phase plan — no RN render test written. Persistence is proven by the 13-01 DAO tests.

## Commits

- `f1d675a` feat(13-06): 'Your star' self-sun colour swatch row in Settings
- `397277c` feat(13-06): 'Sun / centre' occupant picker in Settings (relocated ORR-06)

## Self-Check: PASSED

- FOUND: src/screens/SettingsScreen.tsx (settings-your-star-row + settings-sun-centre-row present)
- FOUND: commit f1d675a
- FOUND: commit 397277c
- FOUND: .planning/phases/13-orrery/13-06-SUMMARY.md
