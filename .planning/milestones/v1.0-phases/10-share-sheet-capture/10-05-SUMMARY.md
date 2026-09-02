---
phase: 10-share-sheet-capture
plan: 05
subsystem: capture
tags: [share-intent, capture, fuel, single-tap, write-on-pick, B2, A10, A1-A2, react-navigation]

# Dependency graph
requires:
  - phase: 10-share-sheet-capture
    plan: 01
    provides: finishActivity() native module (plain Activity.finish() → source app)
  - phase: 10-share-sheet-capture
    plan: 02
    provides: resolveCapturePayload (pure share-payload → { displayText, url } resolver)
  - phase: 10-share-sheet-capture
    plan: 03
    provides: listCapturePickContacts (picker read) + addFuel/NewFuelItem (fuel writer)
  - phase: 10-share-sheet-capture
    plan: 04
    provides: ShareIntentProvider + ready-gated ShareIntentGate → Capture route; Capture type in RootStackParamList
provides:
  - "CaptureScreen — the grid-of-faces picker + single-tap fuel commit + Saved-to confirmation + auto-return"
  - "Capture Stack.Screen registration in RootNavigator (route now reachable)"
  - "writtenRows state ({ id, contactId }[]) — the id+contactId handoff the 10-06 note recompose editFuels"
affects: [10-06 multi-select + optional note + inline name-only create + shared close handler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write-on-pick: the fuel row is written the instant a face is tapped, before any prompt, because useShareIntent's resetOnBackground kills an unwritten payload (T-10-04)"
    - "isCommittingRef synchronous latch (set before the first await, cleared in finally) + committing-state face-disable — a rapid double-tap writes exactly one row (B2); mirrors ComposeScreen's `sending` latch"
    - "Single localDateTime() stamp reused for createdAt + now (A10) — not two independent calls"
    - "Confirmation + auto-return via setState + a useRef setTimeout, cleared on unmount and cancelled on note-touch — never a per-frame React-state animation (CLAUDE.md)"

key-files:
  created:
    - src/screens/CaptureScreen.tsx
  modified:
    - src/navigation/RootNavigator.tsx

key-decisions:
  - "The note affordance testID is `capture-note-affordance` (the Pressable that cancels the auto-return); the UI-SPEC's locked `capture-note-input` / `capture-note-done` / `capture-note-skip` are the note FIELD + commit controls, which land in 10-06. This plan ships only the timer-cancelling affordance, so a distinct testID avoids colliding with 10-06's field testIDs."
  - "The confirmation surface is gated on BOTH `savedName !== null` AND `writtenRows.length > 0` — the note affordance targets `writtenRows`, so it is only offered once a row actually exists (they are set together on a successful write)."
  - "The ＋ New contact tile is an appended grid cell (sentinel GridItem) rendered inside the FlatList's numColumns flow as the final cell, not a ListFooterComponent — preserving the UI-SPEC's face-tile footprint and favourites-first muscle memory. Its onPress (inline name-only create) lands in 10-06."
  - "Face-tile onPress uses `() => void onPickFace(row)` (fire-and-forget) — the async commit owns its own try/finally latch; the tile never awaits."

requirements-completed: [CAP-01, CAP-02, CAP-03]

# Metrics
duration: 6min
completed: 2026-08-16
status: complete
---

# Phase 10 Plan 05: CaptureScreen Core Summary

**Built the thinnest end-to-end share→fuel→return slice: a 3-column grid-of-faces picker (drains `useShareIntentContext()`, resolves the payload once via `resolveCapturePayload`, lists contacts via `listCapturePickContacts`, keyboard closed) where a single tap writes one `topic`/`share` fuel row immediately via `addFuel`, shows "Saved to {name}", and auto-returns to the source app via `finishActivity()` — with a double-tap-proof `isCommittingRef` latch, a single `localDateTime()` stamp, and the returned rowid+contactId retained in `writtenRows` for the 10-06 note.**

## Performance
- **Duration:** ~6 min
- **Started:** 2026-08-16T14:33:46Z
- **Completed:** 2026-08-16T14:39:17Z
- **Tasks:** 2
- **Files:** 1 created (`src/screens/CaptureScreen.tsx`), 1 modified (`src/navigation/RootNavigator.tsx`)

## Accomplishments

### Task 1 — Grid-of-faces picker + route (`0546149`)
- **`src/screens/CaptureScreen.tsx` (new)** — drains `{ text, webUrl, title: meta?.title }` from `useShareIntentContext()` and resolves `{ displayText, url }` ONCE via `resolveCapturePayload` (memoized on the `shareIntent` identity). Loads the grid in a `useFocusEffect` with a `cancelled` guard via `listCapturePickContacts(getExecutor())` (favourites → capture-MRU → rest; never-contacted included; archived excluded — all in the shipped read's SQL).
- Renders per UI-SPEC: a `FlatList` (`numColumns:3`, `contentContainerStyle:{padding:16, gap:12}`, `columnWrapperStyle:{gap:12}`, testID `capture-picker-root`); a header row (`capture-close` "Cancel" pill, `capture-title` "Save to…", `capture-search-reveal` icon-only Pressable — **keyboard stays closed, not autofocused**); the `capture-payload-preview` strip (`surfaceElevated`, `displayText` numberOfLines 1 + a `textSecondary` host line when a url is present); face tiles (`Avatar` size 64 + `cacheBust=modified_at` verbatim + name 13/600, testID `capture-face-{id}`); and the always-present `capture-new-contact-tile` (accent-outline ＋) as the final grid cell.
- Empty-payload defensive branch renders `capture-error-state` "Nothing to save" (`danger`) + a Close. The Close pill cancels WITHOUT writing (`resetShareIntent()` then `finishActivity()`).
- **`src/navigation/RootNavigator.tsx`** — registered `<Stack.Screen name="Capture" component={CaptureScreen} />` additively (import + one Stack.Screen line); `initialRouteName` stays `Home`, `headerShown:false` already set.

### Task 2 — Single-tap commit + confirmation + auto-return (`d7e2989`)
- **Single-tap write** — `capture-face-{id}` → `onPickFace(row)` writes ONE fuel row via `addFuel(getExecutor(), { uid: newUid(), contactId: row.id, kind:'topic', source:'share', text: displayText, url, createdAt: stamp, now: stamp })` BEFORE any prompt (write-on-pick, T-10-04). Capture writes ONLY fuel — never `last_contact`, never an interaction row.
- **(B2) Double-tap guard** — `isCommittingRef = useRef(false)` in the component body; `if (isCommittingRef.current) return; isCommittingRef.current = true;` before the first `await`, cleared in `finally`; a paired `committing` state disables the faces (`disabled` + `accessibilityState`). A rapid double-tap writes exactly one row.
- **(A10) Single stamp** — one `const stamp = localDateTime()` feeds BOTH `createdAt` and `now`.
- **(A1/A2)** — the returned rowid + `contactId` are stored in `writtenRows: {id, contactId}[]` for the 10-06 note recompose (no uid-based fuel lookup).
- **Confirmation + auto-return** — on success, `savedName` shows `capture-confirmation-toast` "Saved to {name}" and arms a `useRef` `setTimeout(AUTO_RETURN_MS = 1500)` that calls `resetShareIntent()` then `finishActivity()`. Cleared on unmount; the `capture-note-affordance` "Add a note" cancels the timer so the note is never rushed. A write failure `Alert`s "Couldn't save" / "Please try again." and leaves the payload intact. The url is stored only, never opened.

## Deviations from Plan

### Auto-fixed Issues
**1. [Rule 3 - Blocking] Doc comment tripped the `! grep -q "openURL|Linking.open"` gate**
- **Found during:** Task 2 automated verify.
- **Issue:** The screen's header docblock literally read "no Linking.openURL anywhere in this file" as a promise — but the plan's grep gate `! grep -q "openURL\|Linking.open"` matched that comment text, failing the gate on a false positive (there is no url-opening *code*).
- **Fix:** Reworded the comment to "the screen never navigates to or opens the url" — the invariant is unchanged, the token is gone, the gate now passes truthfully.
- **Files modified:** src/screens/CaptureScreen.tsx
- **Commit:** `d7e2989`

**2. [Rule 3 - Blocking] biome organizeImports + import-wrap formatting**
- **Found during:** Task 1 acceptance gate (`npx biome check src/screens/CaptureScreen.tsx`).
- **Issue:** biome re-sorted the import block (moved the relative `finishActivity` import after the `@/` group) and wrapped the multi-symbol `@/db/capture-read` import.
- **Fix:** `npx biome check --write` on the screen file (no logic change); re-ran the gate clean.
- **Files modified:** src/screens/CaptureScreen.tsx
- **Commit:** `0546149`

**Total deviations:** 2 auto-fixed (both blocking formatting/gate mechanics, no logic change). No scope creep.

### Out of scope (untouched)
- `RootNavigator.tsx` carries a pre-existing biome format drift in the unrelated `NeverContacted` Stack.Screen block (logged in `deferred-items.md` by 10-01/10-04). Not mine to fix in this plan; the Task-1 biome gate scopes to the screen file only. My two additive lines to that file are already correctly formatted.

## Verification
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean (zero hex/rgb/hsl/named-colour literals; every colour via `useTheme().colors.*`).
- `npx biome check src/screens/CaptureScreen.tsx` — clean.
- All plan grep gates pass (`useShareIntentContext`, `listCapturePickContacts`, `resolveCapturePayload`, `name="Capture"`, `addFuel`, `AUTO_RETURN_MS`, `finishActivity`, `capture-confirmation-toast`, `writtenRows`, `isCommittingRef`; and `!` no `openURL`/`Linking.open`).
- `npm test` — **707 passed (57 files)**, existing suite still green (no new unit tests this plan — the pure payload resolver is already node-tested in 10-02; the `.tsx` surface is Pixel-UAT).

## Known Stubs
None that block the plan's goal. Two affordances are intentionally deferred to 10-06 (called out in the plan and the code comments, not silent stubs):
- **`capture-search-reveal`** renders but has no `onPress` yet — the revealed search field + live filtering (`capture-search-input` / `capture-search-clear`) are 10-06 scope.
- **`capture-new-contact-tile`** renders but has no `onPress` yet — the inline name-only create (`capture-inline-*`) is 10-06 scope.
- **`capture-note-affordance`** cancels the auto-return timer (its only job this plan); the note FIELD + recompose write (`capture-note-input` / `capture-note-done` / `capture-note-skip`, editing `writtenRows` by id+contactId) are 10-06 scope.

## Deferred / Human-check (Pixel UAT — this box cannot build APKs, PHASE GATE A10)
The whole single-tap loop is native/on-device behaviour invisible to a Metro reload — a REQUIRED end-of-phase Pixel UAT via the desktop-build release APK (`autonomous:true` covers only tsc/biome/check:colors/grep):
- **Grid render:** sharing a Chrome link opens the grid with the keyboard CLOSED; the preview strip shows the page title (patched EXTRA_SUBJECT) or the bare-URL fallback; favourites first, never-contacted included, archived absent; the ＋ tile present. (uiautomator on the locked testIDs.)
- **Single-tap → save → return:** tap one face → a durable `topic`/`share` fuel row is written (visible on that contact's profile / the never-contacted screen), "Saved to {name}" shows briefly, then the device returns to the source app. Touching "Add a note" cancels the auto-return.
- **Airplane-mode share still writes** (no network on the write path — local-first).
- **Double-tap:** hammering a face writes exactly ONE fuel row (B2 latch, on-device timing).

No `expo prebuild` / gradlew / APK build was attempted here (correct — this box has no such capability; there is no local emulator by hardware).

## Self-Check: PASSED
- Files exist: `src/screens/CaptureScreen.tsx` ✔, `src/navigation/RootNavigator.tsx` (Capture Stack.Screen) ✔.
- Commits present: `0546149` (Task 1) ✔, `d7e2989` (Task 2) ✔.

---
*Phase: 10-share-sheet-capture*
*Completed: 2026-08-16*
