---
status: partial
phase: 26-dashboard-control-surface
source: [26-VERIFICATION.md]
started: 2026-09-05
updated: 2026-09-05
---

## Current Test

[testing paused — 2 items need owner confirmation; 1 sub-item fixture-blocked]

<!--
Driven on the physical Pixel 6 Pro over USB (Metro :8082, adb reverse tcp:8081→8082).
Verification method per test recorded inline. A launch-blocking render-loop crash was
found and fixed inline this session (commit fc62a7b) before any test could run — see
## Blocker found & fixed.
-->

## Tests

### 1. Anchored panels — geometry, scrim, live-update-behind
expected: Open each of Population, Filters, Sort. Each opens an anchored floating panel anchored below its control (not a modal/bottom sheet), with the dashboard list visibly re-querying behind a light full-surface scrim that covers the app bar too.
result: pass
evidence: |
  All three open as anchored floating cards below their own control (Population left-aligned,
  Sort right-aligned, Filters a tall scrollable panel), NOT modals/bottom sheets. Scrim node
  bounds [0,145][1440,2865] — spans full width and covers the app bar (Orbit / Your Week /
  Group Events visibly dimmed) down to just above the tab bar. Selecting Favourites re-queried
  the list behind live (control label + count updated with panel still open).

### 2. Panel dismissal + background inertness + Back ordering
expected: With a panel open, the background is inert and out of assistive-tech focus. All three dismiss paths close it — (a) re-tapping the same control, (b) tapping outside anywhere including over the app bar, (c) Android system Back. Back dismisses the panel before any route navigation; only one panel is ever open at a time.
result: pass
evidence: |
  (a) Re-tapping the same control (Sort) dismissed the panel. (b) Tapping outside on the scrim
  dismissed it. (c) Android Back dismissed the panel and stayed on Dashboard (not routing/exit).
  Single-panel: opening Filters while Population was open closed Population (one scrim only).
  Background inert to touch: tapping the FAB's position while a panel was open did nothing
  (no Create screen, panel stayed). NOTE: the assistive-tech *focus* exclusion (TalkBack, WR-01)
  was NOT verified — only touch-inertness + single-scrim were. See ## Needs owner confirmation.

### 3. Live-apply — no Apply/Done button; zero-result keeps panel open
expected: Toggling populations/filters/sort applies immediately with NO Apply/Done affordance. A selection yielding zero rows leaves the panel open with the cause-aware empty state behind it.
result: pass
evidence: |
  Population is multi-select. Selecting Favourites applied immediately (control label →
  "Favourites"), panel stayed open, no Apply/Done control anywhere. Narrowing to Snoozed only
  (0 rows) kept the panel open with the cause-aware "Nothing in Snoozed." empty state rendering
  behind it. (See ## Product observation re: the count header under a zeroed population.)

### 4. Header destinations — icon-only fallback under text scale
expected: At default and 200% OS text scale, both header destinations (Your Week, Group Events) stay present. Labels show when they fit; otherwise BOTH collapse to icon-only. Header never wraps, shrinks below role size, or pushes the control/search rows down.
result: pass
evidence: |
  At the smaller default scale both destinations showed icon+label. Set OS font_scale to 2.0:
  both destinations collapsed to icon-only TOGETHER (calendar + people icons), overflow "…"
  retained, header stayed on one line and did NOT wrap or push the control row down. Restored
  font_scale to 1.15 afterward.

### 5. Row-3 search expand/collapse + List/Card toggle targets
expected: Expand/collapse the Row-3 search with reduced-motion OFF then ON; background the app mid-animation. Motion is restrained; reduced-motion collapses to instant; no half-run animation after backgrounding. The right-aligned List/Card toggle keeps a 44px target at supported widths and 200% text scale; search takes the remaining row width.
result: pass
evidence: |
  Search expands to an EditText ("Search people and notes") that takes the remaining row width
  between the search icon and the right-aligned List/Card toggle. List/Card targets are 154px tall
  = 44dp at the Pixel's ~3.5x density. WR-02 confirmed: typing "Ada", collapsing via "Close search",
  then re-expanding shows the empty placeholder (term cleared → full list restored, never silently
  filtered). Search still expands/collapses functionally with reduced-motion ON (all animation
  scales = 0). CAVEAT: the motion *feel* — "restrained" motion, truly-instant under reduced-motion,
  and no half-run frame after backgrounding mid-animation — cannot be judged from static captures
  and needs your eyes. See ## Needs owner confirmation.

### 6. Origin-aware return + Unbound live search + dual Archived entry points
expected: Dashboard → Archived → a Profile → Back lands back on Archived (not Dashboard root). Dashboard → Unbound → search → Back filters live and disambiguates no-match from true-empty. Both Archived entry points (overflow + Settings row) reach the same one screen.
result: pass
partial: true
evidence: |
  Unbound live search VERIFIED: overflow → Unbound Contacts (12 unbound, incl. Andrew/Chris Wales,
  Dad, Joyce Milligan + ZZ-UAT fixtures). Typing "Wales" filtered live to 2 rows ("2 matching");
  a non-matching term gave "0 matching" + "No matching unbound contacts" — distinct from the
  true-empty "No unbound contacts" state. Back returned to Dashboard (origin). Archived screen
  reached via overflow (title "Archived", child-variant Back chrome, "No archived contacts" empty
  state). Dual entry points CODE-VERIFIED to reach the same ArchivedContactsScreen: overflow
  navigate("Archived") via DashboardStack.tsx:62; Settings row navigate("Archived") via
  SettingsStack.tsx:32 (SettingsScreen.tsx:2231). Settings-row path could not be driven because
  adb taps don't register on the custom bottom tab bar (known false-negative), so it was confirmed
  in code rather than on-device.
  NOT device-verified: Archived → a Profile → Back → Archived origin-aware return — there are 0
  archived contacts to open a profile from (creating one needs profile+archive actions that land
  in a later phase). Fixture-blocked. See ## Needs owner confirmation.

### 7. Disabled Select Contacts row + Reset Dashboard View
expected: Tapping the disabled Select Contacts overflow row is a true no-op with the sheet staying open and the row read as disabled to assistive tech. Reset Dashboard View (from a mixed state and from an already-default state) returns Active / no filters / Default sort / cleared search with NO confirmation dialog, while preserving the List/Card viewMode.
result: pass
evidence: |
  Select Contacts overflow row has enabled=false (read as disabled to assistive tech) and is
  visibly greyed; tapping it was a true no-op (sheet stayed open, no selection mode, no nav).
  Reset from a mixed state (Population=Snoozed) → Active Contacts / no filters / Default sort /
  cleared search, NO confirmation dialog, List viewMode preserved. Reset from an already-default
  state with viewMode=Card → stayed default, no dialog, Card viewMode preserved. Both viewMode
  variants confirmed preserved through Reset.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0
notes: 1 launch-blocker found & fixed inline (fc62a7b); 3 sub-items await owner confirmation (see below)

## Blocker found & fixed (this session)

Before ANY test could run, the dashboard crashed on mount on the Pixel with a red-box
**"Maximum update depth exceeded"** (`HomeScreen.tsx:135`). Root cause: an object-returning
Zustand selector —

    const query = useDashboardQueryStore((state) => ({ viewMode, populations, filters, sort }));

Under Zustand v5's `Object.is` snapshot comparison this returns a fresh reference every render,
so `useSyncExternalStore` treats the snapshot as changed on every commit → infinite render loop.
It also re-fired the read effect (`[query, ...]`) each render. Introduced by phase-26 commit
`88d19d4`; it is the ONLY object-returning selector in `src/` and no test rendered HomeScreen in a
real reconciler, so vitest/verification/review all passed while the screen never rendered on-device.

Fixed inline (in-bucket implementation bug, reverses no recorded decision) by wrapping the selector
in `useShallow` — the canonical Zustand v5 fix; smallest diff; preserves the object shape and the
`[query]` effect semantics. tsc + biome clean. Committed **fc62a7b**. Re-verified on-device: the
dashboard now renders and all 7 tests above were driven against the fixed build.

## Needs owner confirmation (could not be verified by driving)

- **Test 2 / WR-01 — TalkBack focus is NOT yanked back to the panel on each in-panel toggle.**
  Verified touch-inertness + single-scrim; the assistive-tech FOCUS behavior needs a TalkBack pass
  (enable TalkBack, open a panel, toggle options, confirm focus is not stolen each time).
- **Test 5 — motion feel.** "Restrained" motion, truly-instant collapse under reduced-motion, and
  no half-run animation frame after backgrounding mid-animation are timing/feel judgments that
  static screenshots can't settle. Your eyes needed.
- **Test 6 — Archived → open a Profile → Back → lands on Archived (not Dashboard root).**
  Fixture-blocked: 0 archived contacts exist, and archiving one needs profile/archive actions from
  a later phase. Everything else in Test 6 (Unbound live search + no-match/true-empty, Back→origin,
  dual-entry-points-to-same-screen) is verified.

## Product observation (not a defect — your call)

Under a population that filters to 0 rows (e.g. Snoozed only, or Favourites + "Needs attention"),
the count header still reads "2 contacts" while the list shows the cause-aware empty state
("Nothing in Snoozed." / "Nothing here right now."). This is the DOCUMENTED behavior — the header
renders `counts.live` (total active contacts, gated `counts.live > 0`), not the current population's
row count (HomeScreen.tsx:416-419; audit ledger "header count excludes never-contacted :383-388").
So it is internally consistent (you have 2 active contacts; none are snoozed), but "2 contacts"
directly above an empty state can read as contradictory. Whether the header should instead reflect
the filtered count is a product/taste call that's currently decided as total-live — flagging it for
you, not changing it.

## Gaps

(none open — the one blocker found this session was fixed inline in commit fc62a7b, not deferred to
a gap-closure plan)

## Review notes (from 26-REVIEW.md — confirmed on device where drivable)

- WR-01 (fixed 8418857): TalkBack focus not yanked on in-panel toggle — **needs a TalkBack pass**
  (touch-inertness + single-scrim confirmed; assistive-tech focus not driven).
- WR-02 (fixed d380ce1): collapsing Row-3 search clears the term — **confirmed** (re-expand shows
  empty placeholder, full list restored).
- WR-03 (fixed d380ce1): a favourites list zeroed by an active filter shows neutral "Nothing here
  right now." not "No favourites yet" — **confirmed** (Favourites + "Needs attention" → 0 rows →
  "Nothing here right now.").
