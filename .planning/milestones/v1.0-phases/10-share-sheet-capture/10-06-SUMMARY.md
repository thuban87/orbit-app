---
phase: 10-share-sheet-capture
plan: 06
subsystem: ui
tags: [react-native, share-intent, capture, multi-select, sqlite, fuel, contacts]

# Dependency graph
requires:
  - phase: 10-share-sheet-capture (plan 05)
    provides: "CaptureScreen single-tap base — payload resolve, write-on-pick, isCommittingRef latch, writtenRows, confirmation surface, cancel/finish"
  - phase: 10-share-sheet-capture (plan 03)
    provides: "captureMultiAttach + captureMultiNote DAOs (atomic N-row fan-out / note apply)"
  - phase: 10-share-sheet-capture (plan 02)
    provides: "resolveCapturePayload — note→`note — base` recompose, url canonical/separate"
provides:
  - "CaptureScreen multi-select (long-press → Done·N → captureMultiAttach, N independent rows in one transaction)"
  - "Optional-note surface recomposing display text to `note — base` (single via editFuel, N>1 via captureMultiNote — url untouched)"
  - "Inline name-only create (＋ tile → createContactFull name-only never-contacted → addFuel)"
  - "Tap-to-reveal search filtering the grid by name (keyboard closed on the fast path)"
affects: [phase-11, ai-suggestions, never-contacted-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Focused useFocusEffect + BackHandler owns hardware Back; return true consumes (ComposeScreen idiom)"
    - "One component-body isCommittingRef in-flight latch shared across every commit path"
    - "Screen calls DAOs (captureMultiAttach/captureMultiNote/editFuel/createContactFull/addFuel) — never opens inWriteTransaction inline"

key-files:
  created: []
  modified:
    - "src/screens/CaptureScreen.tsx — multi-select, note recompose, inline-create, tap-to-reveal search"

key-decisions:
  - "cancelCapture() factored as the single cancel path; hardware Back exits multi-select (mode-active, any count) without writing, Close pill always cancels (C1)"
  - "Multi-select Done disabled + guarded at zero selection (B3); every commit path shares one isCommittingRef (B2/C2)"
  - "Inline create is name-only (last_contact NULL, interval 30 Monthly default), contactId destructured from the object return (B4), no detail prompt"
  - "savedName state generalised to savedLabel holding the full toast text (Saved to {name} / Saved to N contacts)"

patterns-established:
  - "Pattern 1: multi-select overlay bar (Done·N) with dimmed-disabled zero-selection state via opacity + accessibilityState"
  - "Pattern 2: note recompose keyed by BOTH id AND contactId — no uid-based fuel lookup; single-row editFuel vs N>1 captureMultiNote split"

requirements-completed: [CAP-02, CAP-04]

coverage:
  - id: D1
    description: "Long-press multi-select → Done·N writes N independent fuel rows via captureMultiAttach (returned ids stored in writtenRows); Done disabled+guarded at zero selection; shared isCommittingRef latch"
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/db/capture-dao.test.ts (captureMultiAttach atomic fan-out — DAO layer)"
        status: pass
      - kind: manual_procedural
        ref: "Pixel UAT: long-press enters multi-select, tap toggles, Done writes N rows, Back exits without writing, zero-selection disables Done"
        status: unknown
    human_judgment: true
    rationale: "Multi-select gestures, badge rendering, Back-exit semantics, and the N-row on-device write are native behavior invisible to Metro reload — REQUIRED release-APK Pixel UAT (this box cannot build APKs)."
  - id: D2
    description: "Optional-note surface recomposes display text to `note — base` (url untouched) — single row via editFuel, N>1 atomically via captureMultiNote; Skip keeps original"
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/logic/capture-logic.test.ts (note→`note — base` recompose, url canonical) + src/db/capture-dao.test.ts (captureMultiNote atomic)"
        status: pass
      - kind: manual_procedural
        ref: "Pixel UAT: Add a note cancels auto-return, Done recomposes on the profile with url intact, multi-attach applies to all N, Skip keeps original"
        status: unknown
    human_judgment: true
    rationale: "The on-device recompose write + profile display (url still separate) is UI-observable-only; the pure resolver and DAO atomicity are node-tested, the screen wiring is Pixel UAT."
  - id: D3
    description: "Inline name-only create (＋ tile) → never-contacted contact (last_contact NULL) + captured fuel; empty name rejected; contactId destructured from object return; no detail prompt"
    requirement: "CAP-04"
    verification:
      - kind: unit
        ref: "src/screens/create-contact-logic.ts canSave (name.trim().length>0) + contacts-dao createContactFull name-only path (existing suites)"
        status: pass
      - kind: manual_procedural
        ref: "Pixel UAT: type name → Create & save → never-contacted contact + fuel visible; blank name leaves submit disabled; return to source, no prompt"
        status: unknown
    human_judgment: true
    rationale: "Contact creation + fuel write + return-to-source is native/on-device; the blank-name guard logic is tested but the screen flow needs release-APK Pixel UAT."
  - id: D4
    description: "Tap-to-reveal search live-filters the grid by name (case-insensitive substring), autofocused only when revealed — keyboard closed on the fast path"
    requirement: "CAP-01"
    verification:
      - kind: manual_procedural
        ref: "Pixel UAT: search reveal filters grid, keyboard stays closed until reveal, clear restores full grid"
        status: unknown
    human_judgment: true
    rationale: "Reveal/autofocus/keyboard timing and in-memory filtering are UI-observable-only; no node harness for the RN screen."

# Metrics
duration: 12min
completed: 2026-08-16
status: complete
---

# Phase 10 Plan 06: CaptureScreen Enrichments Summary

**Long-press multi-select (Done·N → captureMultiAttach, N independent rows in one transaction), an optional note recomposing display text to `note — base` (editFuel / captureMultiNote, url untouched), inline name-only never-contacted create, and a tap-to-reveal search — completing the CAP-02/CAP-04 capture surface.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-16T14:43:00Z
- **Completed:** 2026-08-16T14:51:20Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Long-press multi-select with an accent corner checkmark badge + borderStrong outline, a persistent "Done · N" bar, and a Done handler that fans N independent fuel rows into ONE transaction via `captureMultiAttach` — storing the ordered `{id, contactId}[]` in `writtenRows` for the note recompose (A1). Done is disabled and guarded at zero selection (B3).
- A focused `useFocusEffect` `BackHandler` split cleanly (C1): hardware Back exits multi-select without writing whenever the mode is active (any count), else cancels via the shared `cancelCapture()`; the Close pill always calls `cancelCapture()`.
- The optional-note surface recomposes display text to `note — base` via `resolveCapturePayload` and patches text ONLY — single row through the `editFuel` DAO wrapper, N>1 atomically through the `captureMultiNote` DAO (no inline transaction, B1); url/created_at untouched; Skip keeps the original.
- Inline name-only create (＋ tile) → `createContactFull` name-only (last_contact NULL, interval 30) with `{ contactId }` destructured from the object return (B4), then `addFuel`; empty/blank name rejected (A7); no detail prompt.
- Tap-to-reveal search filters the grid by name (case-insensitive substring), autofocused only when revealed.
- Every commit path (single-tap, multi Done, inline Create & save, note-Done) shares the one `isCommittingRef` latch (B2/C2).

## Task Commits

Each task was committed atomically:

1. **Task 1: Long-press multi-select + Done·N → captureMultiAttach** - `f27a3c0` (feat)
2. **Task 2: Optional-note surface — recompose display text (`note — base`)** - `49cacc0` (feat)
3. **Task 3: Inline name-only create + tap-to-reveal search** - `f88291d` (feat)

## Files Created/Modified
- `src/screens/CaptureScreen.tsx` - Extended the 10-05 single-tap base with multi-select state + Done·N bar, focused Back handler + `cancelCapture()` split, note recompose keyed by id+contactId (editFuel / captureMultiNote), inline name-only create surface, and tap-to-reveal search. Reuses the shared `isCommittingRef`, `writtenRows`, `armAutoReturn`, and confirmation surface.

## Decisions Made
- Generalised the `savedName` string state to `savedLabel` holding the full toast text so the same confirmation surface serves "Saved to {name}" (single/inline) and "Saved to {N} contacts" (multi). Implementation detail, my bucket.
- Factored `armAutoReturn()` out of the single-tap handler so all four commit paths arm the identical setState+setTimeout return (no per-frame animation).
- Added `INLINE_CREATE_INTERVAL_DAYS = 30` as a top-of-file tunable (CLAUDE.md tunable-constants convention), matching the create form's Monthly default.

## Deviations from Plan

None - plan executed exactly as written. All B/C/A review-hardening items (A1/A6/A7/A8/A10/B1/B2/B3/B4/C1/C2) were implemented as specified in the plan text.

## Issues Encountered
- Initial `style={[styles.tile, { ...styles.tileSelected }]}` spread a `StyleSheet.create` id (an opaque number at runtime, object-like only in the RN types) — corrected to array composition (`styles.tileSelected` as its own array entry) before the Task 1 commit, so the selected-tile outline actually applies on-device.
- Biome flagged two `// biome-ignore lint/a11y/noAutofocus` suppressions as unused (the rule isn't enabled in this repo's config) — removed both; plain `autoFocus` lints clean.

## Deferred Issues (out of scope — pre-existing)
`npx biome check .` reports 13 pre-existing formatting/lint findings in unrelated files (`BirthdayBanner.tsx`, `ComposeScreen.tsx`, `ContactProfileScreen.tsx`, `HomeScreen.tsx`, `ManageFavouritesScreen.tsx`, `NeverContactedScreen.tsx`, `RootNavigator.tsx`, `dashboard-empty-logic.ts`, `capture-read.test.ts`). None are in `CaptureScreen.tsx` (which passes `biome check` cleanly) and none were introduced by this plan — left untouched per the scope boundary.

## Verification
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean (zero hex literals; all colours via theme tokens).
- `npx biome check src/screens/CaptureScreen.tsx` — clean.
- `npm test` — 707 passed / 57 files (suite stays green).
- On-device multi-select / note / inline-create / search behavior is REQUIRED end-of-phase Pixel UAT via the desktop release-APK pipeline (this box cannot build APKs / has no emulator) — see coverage D1–D4.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full CAP-01/02/03/04 capture surface is code-complete; the phase's final gate is the end-of-phase Pixel UAT (release APK) covering multi-select N-write, focused-Back exit, note recompose (url intact), inline name-only create (never-contacted), rapid-tap double-commit prevention, and tap-to-reveal search.

---
*Phase: 10-share-sheet-capture*
*Completed: 2026-08-16*
