---
phase: 10-share-sheet-capture
plan: 04
subsystem: navigation
tags: [expo-share-intent, react-navigation, share-intent, cold-start, single-owner, A4]

# Dependency graph
requires:
  - phase: 10-share-sheet-capture
    plan: 01
    provides: expo-share-intent@8.0.1 installed + patched; text/plain share target; finishActivity() module
provides:
  - "navigationRef (imperative NavigationContainerRef) for non-screen navigation"
  - "ShareIntentGate — the SINGLE ready-gated owner of pending-share → Capture navigation (A4)"
  - "Capture: undefined route in RootStackParamList (type only; Stack.Screen lands in 10-05)"
  - "App.tsx wrapped in ShareIntentProvider; NavigationContainer onReady→navReady state; gate inside the migration ready gate"
affects: [10-05 Capture screen component + Stack.Screen registration, 10-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-owner reactive share-consumption: provider context state (hasShareIntent) is the sole source of truth; navigation is a downstream ready-gated reaction keyed on both hasShareIntent and an isReady state flag (no linking getInitialURL race)"
    - "Reactive navigator readiness via NavigationContainer onReady → state flag, not the non-reactive navigationRef.current?.isReady()"

key-files:
  created:
    - src/navigation/linking.ts
  modified:
    - src/navigation/types.ts
    - App.tsx

key-decisions:
  - "Provider mounts ABOVE the migration ready gate (consumes the pending share into context state during migrations); NAVIGATION stays INSIDE the ready gate — separates consumption from navigation so a cold-start share is never lost yet the picker never queries a half-built DB (A4 / RESEARCH Q4)"
  - "Navigate effect keyed on [hasShareIntent, isReady] (the navReady state flag from onReady), NOT navigationRef.current?.isReady() — a non-reactive guard cannot re-run and would strand a share that arrives before the container is ready (A4-refine)"
  - "Omitted the optional options.onResetShareIntent Home-navigate fallback: with resetOnBackground defaulting true it would fire on background/foreground transitions and navigate Home unexpectedly — a side effect not worth the harmless-fallback framing; the capture screen owns return-to-source via finishActivity()"
  - "No top-level scheme deep-link linking config added (not required for the share flow; single-owner is the provider)"

requirements-completed: [CAP-01, CAP-04]

# Metrics
duration: 2min
completed: 2026-08-16
status: complete
---

# Phase 10 Plan 04: Share-Intent → Navigation Wiring Summary

**Wired `expo-share-intent` into the app as ONE deterministic owner of the pending share (A4): the `ShareIntentProvider` consumes the native singleton into context state, and a ready-gated `ShareIntentGate`—keyed reactively on both `hasShareIntent` and a `navReady` flag from `NavigationContainer.onReady`—navigates to the new `Capture` route, cold-start-safe without a linking `getInitialURL` race.**

## Performance
- **Duration:** ~2 min
- **Started:** 2026-08-16T14:27:26Z
- **Completed:** 2026-08-16T14:29:42Z
- **Tasks:** 2
- **Files:** 1 created (`src/navigation/linking.ts`), 2 modified (`src/navigation/types.ts`, `App.tsx`)

## Accomplishments
- **`src/navigation/types.ts`** — added `Capture: undefined` to `RootStackParamList` additively (serializable, no params — the screen drains the payload via `useShareIntentContext()`, not route params). All existing routes untouched; `initialRouteName` stays `Home`. No `Stack.Screen` registered here (that lands in 10-05 with the component).
- **`src/navigation/linking.ts` (new)** — exports (1) `navigationRef` (`createRef<NavigationContainerRef<RootStackParamList>>()`) for non-screen imperative navigation, and (2) `ShareIntentGate`, a render-`null` component that is the SINGLE owner of pending-share navigation. It reads `hasShareIntent` from `useShareIntentContext()` and runs a `useEffect` **keyed on `[hasShareIntent, isReady]`** that calls `navigationRef.current?.navigate("Capture")` when both are true. No competing linking `getInitialURL`/`subscribe` redirect. UI-free / colour-literal-free.
- **`App.tsx`** — wrapped the shell in `ShareIntentProvider` (sole consumer of the native singleton, mounted above the migration gate so it consumes during migrations); added `const [navReady, setNavReady] = useState(false)`; wired `<NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)}>` and rendered `<ShareIntentGate isReady={navReady} />` inside it — all still **inside the `ready && !error` migration branch** so navigation and the picker query resolve only after `openAndMigrate()` resolves.

## Task Commits
1. **Task 1: linking.ts navigationRef + ready-gated ShareIntentGate; Capture route** — `449e9ef` (feat)
2. **Task 2: wrap tree in ShareIntentProvider; ready-gated ShareIntentGate in App** — `367adee` (feat)

## A4 / A4-refine invariants satisfied
- **Single owner:** the provider is the ONLY consumer of the native pending-share singleton; `ShareIntentGate` is the ONLY thing turning `hasShareIntent` into a navigation. No `getInitialURL`/`getStateFromPath`/`subscribe` redirect races it.
- **Reactive readiness:** the navigate effect depends on `[hasShareIntent, isReady]` and re-runs whichever settles last. `isReady` is the `navReady` STATE flag set in `onReady` — NOT the non-reactive `navigationRef.current?.isReady()`. A pending share arriving one tick before the container is ready still navigates when `navReady` flips true.
- **Cold-start ordering:** `NavigationContainer` + `ShareIntentGate` stay inside the `ready && !error` gate; the provider consumes the share while migrations run and `hasShareIntent` persists until the screen resets it, so the share lands on Capture the moment the gate opens — never on a half-built DB.

## Deviations from Plan
### Auto-fixed Issues
**1. [Rule 3 - Blocking] biome organizeImports + format on App.tsx edits**
- **Found during:** Task 2 (`npx biome check App.tsx` acceptance gate)
- **Issue:** biome flagged import-name sort order (`ShareIntentGate, navigationRef` → `navigationRef, ShareIntentGate`) and collapsed the multi-line `<NavigationContainer>` open tag to a single line.
- **Fix:** Applied both formatting changes by hand (no logic change); re-ran the gate clean.
- **Files modified:** App.tsx
- **Committed in:** `367adee` (Task 2 commit)

The plan's optional `options.onResetShareIntent` Home-navigate fallback was **deliberately omitted** (documented as a decision above, not a deviation): with `resetOnBackground` defaulting true it would navigate Home on background/foreground transitions.

**Total deviations:** 1 auto-fixed (blocking formatting). No scope creep. No out-of-scope fixes.

## Verification
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean (linking.ts is config/logic, no colour literals; App.tsx additions use no colours).
- `npx biome check src/navigation/linking.ts src/navigation/types.ts App.tsx` — clean. (Whole-repo `biome check .` still carries the pre-existing drift logged in `deferred-items.md` by 10-01 — out of scope, untouched here.)
- `npm test` — **707 passed (57 files)**, existing suite still green.

## Known Stubs
None. The `Capture` route is typed but intentionally has no `Stack.Screen` yet — that is 10-05's scope (called out in the plan and the type comment), not a stub.

## Deferred / Human-check (Pixel UAT — this box cannot build APKs)
The cold-start/background routing is native-only and invisible to a Metro reload; it is confirmed ONLY at end-of-phase Pixel UAT via the desktop-build release APK:
- **COLD-START ordering (A4/A4-refine):** with Orbit FULLY KILLED, share a Chrome link → app cold-starts, runs migrations, `onReady` flips `navReady`, lands on the Capture picker with the payload present (never Home, never a half-built-DB flash) — proving the reactive `isReady` retry catches a share that settles before readiness.
- **WARM/route-arrival:** with Orbit backgrounded, share → foregrounds and routes to Capture.
- (`finish()` return-to-source and EXTRA_SUBJECT display remain 10-01's Pixel UAT items.)

No `expo prebuild` / gradlew / APK build was attempted here (correct — this box has no such capability).

## Self-Check: PASSED
- Files exist: `src/navigation/linking.ts` ✔, `src/navigation/types.ts` (Capture route) ✔, `App.tsx` (ShareIntentProvider + ShareIntentGate + onReady) ✔.
- Commits present: `449e9ef` ✔, `367adee` ✔.

---
*Phase: 10-share-sheet-capture*
*Completed: 2026-08-16*
