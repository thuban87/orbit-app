---
phase: 08-dashboard-never-contacted-screen
plan: 06
subsystem: ui
tags: [react-native, birthday-banner, favourites, useTheme, contact-profile]

# Dependency graph
requires:
  - phase: 08-01
    provides: listBirthdayCandidates (archived-excluded-only birthday candidates) + BirthdayCandidate type
  - phase: 08-02
    provides: daysUntilBirthday single pure parser (both legacy bugs fixed; day-of === 0 reachable)
  - phase: 08-03
    provides: setFavouriteRank / clearFavouriteRank guarded single-column writers
provides:
  - BirthdayBanner component (DASH-05) — 7-day window, soonest-first, exclude-archived-only, presentational onPressContact callback (ready to mount)
  - ContactProfileScreen favourite star (DASH-06) — reversible favourite_rank toggle, no confirmation
  - getContactHeader widened to additively return favourite_rank (number | null)
affects: [08-07 dashboard mounts BirthdayBanner + wires onPressContact to navigation, 08-verification Pixel UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational component takes an onPressContact(contactId) callback so the caller (dashboard, Plan 07) owns navigation — mirrors FuelSearchResultRow/ContactCard"
    - "Async cancelled-flag guarded read (FuelSearch idiom) with JS-side window filter + soonest-first sort off the single daysUntilBirthday parser"
    - "Favourite state derived from the header's favourite_rank (single source of truth) rather than a separate state — the unified load() reconciles it after every toggle"

key-files:
  created:
    - src/components/BirthdayBanner.tsx
  modified:
    - src/db/contact-read.ts
    - src/db/contact-read.test.ts
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "BirthdayBanner reads listBirthdayCandidates (archived-excluded ONLY) — a DECIDED scoped exception (dossier Cluster E) that OVERRIDES snooze + never-contacted suppression so an imminent birthday still shows; the candidates are NOT re-filtered to the dashboard population."
  - "The 7-day window + soonest-first order are computed in JS off the single daysUntilBirthday parser; the day-of case renders 'today', otherwise 'in N days'. The parser/predicate are never re-implemented."
  - "getContactHeader widened PURELY ADDITIVELY to SELECT + return favourite_rank; the two other callers (EditContactScreen refreshPhoto reads only photo/modified_at; contact-read.test.ts asserts fields individually) stay green — verified by tsc + the test run (MEDIUM-3)."
  - "The profile favourite star toggles favourite_rank via the guarded favourites-dao, then the SINGLE unified load() reconciles the header — reversible + non-destructive, so NO confirmation dialog."
  - "The marked star uses colors.accent (OD-2 provisional favourite token, flagged in-comment) — the owner may substitute a dedicated favourite hue/glyph."

patterns-established:
  - "isFavourite derived from header?.favourite_rank != null — the toggle reads the freshly-loaded header, never a stale snapshot, and load() re-reads after the write."

requirements-completed: [DASH-05, DASH-06]

coverage:
  - id: D1
    description: "BirthdayBanner lists contacts with a birthday within 7 days, soonest-first, exclude-archived-only (incl. a snoozed / never-contacted person), rendering 'today' on the day-of and 'in N days' otherwise; renders nothing when empty; tap → onPressContact."
    requirement: DASH-05
    verification:
      - kind: automated_ui
        ref: "Pixel uiautomator UAT — end-of-phase (dashboard-birthday-banner, dashboard-birthday-item-{id}); seed snoozed + never-contacted + archived with ≤7-day birthdays"
        status: unknown
    human_judgment: true
    rationale: ".tsx render + navigation is device-UAT (repo convention); the read (listBirthdayCandidates) and the parser (daysUntilBirthday) are node-tested in 08-01/08-02."
  - id: D2
    description: "ContactProfileScreen favourite star toggles favourite_rank via setFavouriteRank/clearFavouriteRank with no confirmation, reflecting the persisted state on focus; accessibilityLabel flips Mark/Remove favourite."
    requirement: DASH-06
    verification:
      - kind: automated_ui
        ref: "Pixel uiautomator UAT — contact-profile-favourite-star; star a contact → favourites filter shows it"
        status: unknown
    human_judgment: true
    rationale: "The star's tap + persisted-state reflection is device-UAT; the underlying DAO writes are node-tested in favourites-dao.test.ts (08-03)."
  - id: D3
    description: "getContactHeader additively returns favourite_rank; the two other callers (EditContactScreen, contact-read.test.ts) typecheck and pass unchanged."
    requirement: DASH-06
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (full src green) + npx vitest run src/db/contact-read.test.ts (16 pass, incl. new favourite_rank assertion)"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-08-16
status: complete
---

# Phase 8 Plan 06: Birthday Banner & Profile Favourite Star Summary

**The two Wave-2 additive surfaces consuming the Wave-1 cores: the `BirthdayBanner` (7-day, soonest-first, exclude-archived-only, presentational `onPressContact`) built on `listBirthdayCandidates` + `daysUntilBirthday`, and a reversible profile favourite star toggling `favourite_rank` through the guarded DAO — backed by a purely additive `getContactHeader` widening.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-08-16T04:49:00Z
- **Completed:** 2026-08-16
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `BirthdayBanner` (src/components/BirthdayBanner.tsx, DASH-05): reads `listBirthdayCandidates(getExecutor())` inside an async cancelled-flag effect (FuelSearch idiom, offline), computes `daysUntilBirthday(birthday, new Date())` in JS, keeps `0..7`, sorts soonest-first, and renders one tappable row per hit ("{Name}'s birthday today" / "in N days"). Returns `null` when empty. Presentational — the caller supplies `onPressContact(contactId)`; LOCKED testIDs `dashboard-birthday-banner` / `dashboard-birthday-item-{id}`.
- The exclude-archived-only predicate is honoured verbatim (no re-filter to the dashboard population), with a header comment recording it as the DECIDED scoped exception overriding snooze/never-contacted suppression (dossier Cluster E) — not a reversal.
- `getContactHeader` (src/db/contact-read.ts) widened PURELY ADDITIVELY to SELECT + return `favourite_rank: number | null`.
- `ContactProfileScreen` gains a header favourite star (`contact-profile-favourite-star`, accessibilityLabel toggles "Mark favourite" / "Remove favourite") that toggles `favourite_rank` via `setFavouriteRank`/`clearFavouriteRank` then re-runs the SINGLE unified `load()` — reversible, non-destructive, NO confirmation. Marked star uses `colors.accent` (OD-2 provisional, flagged in-comment).

## Task Commits

Each task was committed atomically:

1. **Task 1: BirthdayBanner.tsx — 7-day window, soonest-first, exclude-archived-only, tap→profile** - `1ebaced` (feat)
2. **Task 2: ContactProfileScreen favourite star + additive getContactHeader widening** - `358e303` (feat)

## Files Created/Modified
- `src/components/BirthdayBanner.tsx` - New DASH-05 banner: exclude-archived-only candidates, JS 7-day/soonest-first off the single parser, renders null when empty, presentational `onPressContact` callback.
- `src/db/contact-read.ts` - `getContactHeader` additively SELECTs + returns `favourite_rank`.
- `src/db/contact-read.test.ts` - Adds a `favourite_rank` null assertion for a non-favourite header.
- `src/screens/ContactProfileScreen.tsx` - Header favourite star toggling `favourite_rank` via the guarded DAO + unified `load()`; `Header` type + import widened.

## Decisions Made
- Derive `isFavourite` from the loaded header's `favourite_rank` (single source of truth) rather than a separate state — the toggle reads the fresh header and `load()` reconciles after the write.
- Keep the banner presentational (`onPressContact` callback) so Plan 07 wires navigation without a rewrite — mirrors `FuelSearchResultRow`/`ContactCard`.
- Same-day banner rows get a `name`/`id` tiebreak after the days-until sort so ordering is stable.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - both surfaces are fully wired to live data (the banner to `listBirthdayCandidates`, the star to `favourites-dao`). `BirthdayBanner` is not yet MOUNTED — that is Plan 07's job by design (the component is "ready to mount"), not a stub.

## Issues Encountered

None. `npx tsc --noEmit` and `npm run check:colors` are green across full src; `contact-read.test.ts` passes 16 tests (including the new `favourite_rank` assertion), confirming the additive widening breaks neither typecheck nor the other callers (MEDIUM-3).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `BirthdayBanner` exists and is ready for Plan 07 to mount at the top of the dashboard and wire `onPressContact` to `navigation.navigate("Profile", { contactId })`.
- The profile star persists favourites, so the dashboard favourites filter (08-01/08-04) will surface starred contacts.
- On-device UAT (Pixel, end-of-phase): star a contact and confirm it appears under the favourites filter; seed a snoozed + a never-contacted contact with a ≤7-day birthday (both appear in the banner) and an archived one (does not).

## Self-Check: PASSED
- FOUND: src/components/BirthdayBanner.tsx
- FOUND commit 1ebaced (Task 1)
- FOUND commit 358e303 (Task 2)

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-16*
