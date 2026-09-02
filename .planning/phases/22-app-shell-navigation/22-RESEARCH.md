# Phase 22: App Shell & Navigation - Research

**Researched:** 2026-09-02
**Domain:** React Navigation shell refactor (native-stack → four-tab bottom-nav + per-tab stacks), universal speed-dial FAB, origin-aware Back, commit-truthful Quick Log
**Confidence:** HIGH (codebase facts read on disk this session; library APIs CITED against react-navigation v7 docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Read the phase dossier IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED]/[REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships NO SQLite migration; do not add schema. It is a pure navigation refactor and can be planned independently of the milestone's migration chain.
- **D-04:** Plan the **four-tab bottom-nav root shell** (Dashboard, Orrery, Backup/Restore, Settings), each with its own stack. Supersedes ADR-019's stack-root shell via ADR-080 (owner-ratified 2026-09-01). ADR-018's archive-before-purge gate is untouched — do not treat the shell change as licence to alter archive/purge behavior.
- **D-05:** The FAB speed dial has **exactly six actions in fixed order**: Add Contact, Quick Log, Log Contact, Group Log, Update Contact, Memory. Any five-action text anywhere is stale. Group Log sits at position 4 and opens its canonical focused workflow directly, with no shell-level contact pre-picker.
- **D-06 (R-18 REPLAN):** The tab navigator and origin-aware Back are **unbuilt** — a single `createNativeStackNavigator` exists with no bottom-tabs dependency. Profile Back is already a plain `goBack()`. Plan against the code as it actually is on disk.
- **D-07 (R-18 trip-wire):** The three forced-Dashboard-reset flows — Compose Back, notification taps, widget deep links — are **requirements that must survive** the tab refactor, not legacy to delete. Removing the external-entry → Dashboard fallback reverses ADR-044 → stop and ask.
- **D-08 (R-18 trip-wire):** Before writing the navigator, enumerate **every** `navigation.reset` call site and state its post-refactor behavior. Re-verify against the files on disk at plan time.
- **D-09:** Archived Contacts reachable from Dashboard overflow (E-07); the Settings row may remain as a second entry point routing to the same screen. Group Events is a prominent Dashboard header destination plus a redundant overflow entry — **not** a fifth bottom-nav tab, and the Dashboard tab is **not** a radial launcher (both rejected).
- **D-10:** Predictive back is currently disabled in app config — note its state; do not silently flip it.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry. (In this phase that centrally includes: the **route→tab assignment**, the nested-reset state shape, the picker/snackbar component internals, and the FAB→placeholder-route wiring for actions whose forms land in later phases.)

### Deferred Ideas (OUT OF SCOPE)
Group Events as a fifth bottom-nav destination and converting the Dashboard tab into a radial/menu launcher (both rejected). Also: "Mission Control" dashboard redesign, any bottom-nav restructuring, the detailed Add/Log/Update Contact forms (Rapid Capture, Phase 34), Group Event persistence/participant management (Phase 33), final Memory terminology (Contact Knowledge, Phase 24). Do not plan these.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | Four-tab bottom nav, correct insets, each tab own stack (ADR-080) | `@react-navigation/bottom-tabs` v7 + one `createNativeStackNavigator` per tab; `react-native-safe-area-context` owns insets (both patterns below) |
| SHELL-02 | Active-tab retap: dismiss transient UI first, then pop to root | `tabPress` listener + shell transient-UI store; `popToTop()` (pattern below) |
| SHELL-03 | System Back == visible Back everywhere; dismiss transient first; never replay completed edit | Single back-intent resolver; `navigation.replace()` for completed edits; hardware-back via nested-navigator default + custom `BackHandler` where transient layers exist |
| SHELL-04 | Origin-aware Profile Back (not always Dashboard) | Already free — Profile Back is `goBack()` (`ContactProfileScreen.tsx:762`); per-tab stacks make it correct by construction |
| SHELL-05 | External/deep-link flows fall back to Dashboard; missing contact → friendly message + Dashboard | Preserve the 4 external-reset call sites (D-08 inventory); missing-contact path already exists (`widget-linking.ts:265-279`) |
| SHELL-06 | Nav + FAB hidden in focused workflows and while keyboard open | `tabBarHideOnKeyboard` (nav bar) + per-route focused classification + `Keyboard` listener (FAB) |
| SHELL-07 | Unsaved-changes Discard/Keep prompt | `beforeRemove` listener (pattern already in `RestorePreviewScreen.tsx:94`) + `Alert` |
| SHELL-08 | FAB → six labeled actions, fixed order, translucent scrim | Replace 2-action `AddSpeedDialFab` with universal six-action dial (Reanimated, theme-tokened) |
| SHELL-09 | Profile preselects contact; global → shared picker; Group Log direct | FAB context param + shared picker; Group Log routes directly (no pre-picker) |
| SHELL-10 | Reusable modal picker, search ordered Favorites→recent→alphabetical; archived via search only; snoozed selectable | New component; data from `listFavourites` + recency-dao + dashboard-read (no picker exists) |
| SHELL-11 | Quick Log commit-truthful: success snackbar+Undo+haptic / error snackbar+Retry; never claim success without commit | `recordTouchpoint()` returns `{interactionId}` inside `inWriteTransaction` — key off the resolved promise; new Snackbar component + Undo delete path (seam) |
| SHELL-12 | Dashboard header Group Events (icon+label) + overflow; Archived from overflow (Settings row may remain) | Header additions in `HomeScreen.tsx`; Group Events routes to placeholder (Phase 33 owns the screen) |
| SHELL-13 | Root tabs branded title/no Back; child/focused show Back+title; status bar themed; content clears nav+FAB | App-bar primitives; `headerShown:false` already set — screens own chrome; bottom clearance via inset-aware padding |
| SHELL-14 | Semantic labels, touch targets, focus order, modal/speed-dial focus mgmt; semantic haptics | `accessibilityViewIsModal`, `accessibilityRole`, `expo-haptics`/existing haptic path; 44px targets |
| SHELL-15 | Very short crossfade; no horizontal slide; no swipe-between-tabs | bottom-tabs `animation: 'fade'`; swipe is not a bottom-tabs feature (free) |
</phase_requirements>

## Summary

Orbit currently mounts a **single flat `createNativeStackNavigator`** (`src/navigation/RootNavigator.tsx`) with ~35 screens registered as siblings, behind a migration-readiness gate in `App.tsx`. There is **no bottom-tabs dependency**, no tab navigator, no shared contact picker, no snackbar, and the "speed-dial FAB" that exists (`src/components/AddSpeedDialFab.tsx`) is a **dashboard-local, two-action** affordance (Import from Contacts / Create manually) — not the universal six-action dial the dossier requires. This phase converts the flat stack into a four-tab bottom navigator (Dashboard, Orrery, Backup/Restore, Settings), each owning its own native stack, and builds the universal shell primitives on top.

The single hardest technical problem is **`navigation.reset` under a nested tab tree**. Nine reset call sites exist (full inventory below, D-08). Four of them are the external-entry forced-Dashboard fallbacks that ADR-044 requires to survive (D-07): they reset via the root `navigationRef` onto `[Home, target]`. Once "Home" lives inside a Dashboard-tab stack rather than at the root, a root-level `reset({routes:[{name:"Home"}, ...]})` no longer type-checks or lands correctly — it must be re-expressed as a nested reset that sets the Dashboard tab's stack state. Getting this shape right, and preserving "Back always lands on Dashboard," is the correctness core of the phase.

The second theme is that the FAB exposes **six actions whose target workflows are built in later phases** (Group Log → Phase 33; Log Contact / Update Contact → Phase 34; Memory → Phase 24). Only Add Contact (existing `Create` screen) and Quick Log (a shell-owned immediate write via the existing `recordTouchpoint` DAO) are fully buildable now. The codebase already has an established, documented pattern for this exact situation — register a semantic route pointing at a themed placeholder screen that a later phase replaces (`src/navigation/types.ts:14-16`). That pattern, plus the dossier's explicit "exposure/routing only" boundary, resolves it without pulling form logic into Phase 22.

**Primary recommendation:** Install `@react-navigation/bottom-tabs@^7.18` (same monorepo/version line as the installed `native`/`native-stack@7`), keep the migration-readiness gate strictly ahead of the tab navigator, assign every existing content route to exactly one owning tab stack, and build a single serializable **nested-reset helper** that all four external-entry paths call so the Dashboard fallback is expressed in exactly one place. Build the six-action FAB, shared picker, and commit-truthful snackbar as new theme-tokened primitives; route the four not-yet-built actions to placeholder screens.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab shell + per-tab stacks | Client (RN navigation tree) | — | Pure on-device navigation state; no server, no DB read on the shell path |
| Origin-aware Back | Client (navigation stack) | — | Back = pop the focused tab's stack; correct by construction with per-tab stacks |
| External-entry reset (notification/widget/compose) | Client (`navigationRef` root) | Database (existence guard) | Reset shape is a nav concern; the missing-contact guard reads the DB via `getContactHeader` |
| Quick Log immediate write | Database (`recordTouchpoint` + `inWriteTransaction`) | Client (snackbar/Undo UI) | The *truth* of "success" is the committed transaction; UI only reflects it |
| Shared contact picker ordering | Database (favourites/recency/alpha reads) | Client (modal + live filter) | Ordering is a query concern; presentation is client |
| Speed-dial FAB animation | Client (Reanimated UI thread) | Theme tokens | Animation must not touch React state per-frame (CLAUDE.md); colours via tokens |
| Keyboard/inset handling | Client (safe-area + Keyboard) | — | Device chrome only |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-navigation/bottom-tabs` | `^7.18.18` (to install) | The four-tab bottom navigator | Official companion to the already-installed `@react-navigation/native@7.3.16` + `native-stack@7.18.8`; v7 line matches exactly [VERIFIED: npm registry — `npm view @react-navigation/bottom-tabs version` → 7.18.18] |
| `@react-navigation/native` | `7.3.16` (installed) | Container + `navigationRef` + `useNavigation` | Already the app's nav container [VERIFIED: package.json + node_modules read this session] |
| `@react-navigation/native-stack` | `7.18.8` (installed) | Per-tab stacks (one `createNativeStackNavigator` per tab) | Already used as the single root stack today [VERIFIED: package.json] |
| `react-native-screens` | `~4.26.0` (installed, resolved 4.26.2) | Native screen optimization + freeze; required peer of bottom-tabs | Present; bottom-tabs uses it for `detachInactiveScreens`/freeze [VERIFIED: node_modules read] |
| `react-native-safe-area-context` | `~5.7.0` (installed) | Device insets for the tab bar + content clearance (SHELL-01/13) | Already the `SafeAreaProvider` in `App.tsx:363` [VERIFIED: App.tsx read] |
| `react-native-reanimated` | `4.5.1` (installed) | Speed-dial + snackbar animation on the UI thread (CLAUDE.md: never animate from React state) | Already drives `AddSpeedDialFab` [VERIFIED: AddSpeedDialFab.tsx read] |
| `react-native-gesture-handler` | `~2.32.0` (installed) | Gesture root (already wraps the tree); picker/scrim touch | Already outermost in `App.tsx:362` [VERIFIED: App.tsx read] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-haptics` | not installed — VERIFY | Semantic haptics: light (FAB open), success (Quick Log), warning (destructive) — dossier §M | Only if no existing haptic path is found; check before adding (see Open Questions) |
| `react-native` `Keyboard` API | built-in | FAB hide-on-keyboard (nav bar uses `tabBarHideOnKeyboard`) | Built-in; no dep |
| `react-native` `Modal` / `Pressable` | built-in | Shared contact picker bottom-sheet surface | Prefer built-in Modal over a new bottom-sheet dependency (see Don't Hand-Roll) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| built-in `Modal` picker | `@gorhom/bottom-sheet` | Nicer sheet ergonomics, but a new native dep + gesture wiring; dossier only asks for "compact modal/bottom-sheet style" — not worth the dep for one picker |
| custom themed Snackbar | `react-native-paper` Snackbar | Paper pulls a whole Material theme system that fights Orbit's theme-token rule (CLAUDE.md: all colours via tokens) — reject |
| `@react-navigation/bottom-tabs` | `@react-navigation/material-top-tabs` | Top-tabs are swipeable and horizontal — directly violates SHELL-15 (no swipe, no horizontal slide). Reject. |
| one stack per tab | shared flat stack + custom tab bar | Loses per-tab remembered history (SHELL-01, ADR-080 core). Reject. |

**Installation:**
```bash
npm install @react-navigation/bottom-tabs@^7.18.18
# expo-haptics ONLY if no existing haptic path exists (verify first):
# npx expo install expo-haptics
```

**Version verification:** `@react-navigation/bottom-tabs` latest = `7.18.18` [VERIFIED: `npm view` this session]. This matches the installed `native-stack@7.18.8` v7 line; do not pull a v6. `react-native-screens@4.26.2` and `safe-area-context@5.7.0` already satisfy bottom-tabs v7 peers [VERIFIED: node_modules].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@react-navigation/bottom-tabs` | npm | 8+ yrs | millions/wk | github.com/react-navigation/react-navigation | OK | Approved — same scoped org as installed `@react-navigation/native`+`native-stack` [VERIFIED: npm registry + official react-navigation monorepo] |
| `expo-haptics` | npm | 6+ yrs | millions/wk | github.com/expo/expo | OK | Approved *if needed* — first-party Expo module; install via `npx expo install` for SDK-57 pin [CITED: docs.expo.dev/versions/latest/sdk/haptics] |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

All recommended additions are within already-trusted first-party scopes (`@react-navigation/*`, `expo-*`). No third-party navigation/FAB/snackbar library is recommended.

## Architecture Patterns

### System Architecture Diagram

```
App.tsx (unchanged gate order)
  GestureHandlerRootView
   └ SafeAreaProvider
      └ ShareIntentProvider
         └ ThemeProvider
            └ AppShell
               ├─ [migration gate] openAndMigrate() ──► not ready → themed spinner / error  (NAV NOT MOUNTED)
               └─ ready && !error
                  └ NavigationContainer (ref = navigationRef)   ◄── external gates target this
                     ├ ShareIntentGate / NotificationResponseGate / WidgetLinkingGate (render-null, isReady-gated)
                     └ RootNavigator  ──────── BECOMES ────────►  TabNavigator (createBottomTabNavigator)
                          │                                          │  animation:'fade', tabBarHideOnKeyboard
                          │  (was: one flat native stack)            ├─ Dashboard tab → native stack [Home, Profile, Edit, Compose, Create, Digest, Capture, NeverContacted, UnboundContacts, ...]
                          │                                          ├─ Orrery tab    → native stack [Orrery]
                          │                                          ├─ Backup tab    → native stack [Backup, BackupSettings, RestorePreview, RestoreResult, import/reconcile...]
                          │                                          └─ Settings tab  → native stack [Settings, CustomFields, ManageFavourites, Archived, ...]
                          │
                     ┌────┴─── shell primitives (new, theme-tokened) ───────────────────────────┐
                     │  UniversalFab (6 actions, Reanimated)  ── context param ──► Compose/Create/placeholder routes
                     │  ContactPicker (modal: Favourites→recent→alpha)  ── selection ──► action route
                     │  Snackbar (Quick Log: success+Undo / error+Retry) ◄── recordTouchpoint() commit truth
                     │  DiscardKeepGuard (beforeRemove) ; back-intent resolver (system Back == visible Back)
                     └──────────────────────────────────────────────────────────────────────────┘

External entry (data flow to the reset core):
  notification tap ─► NotificationResponseGate ─► resolveNotificationNav() ─► navigationRef.reset(NESTED [DashboardTab→[Home, target]])
  widget deep link ─► WidgetLinkingGate ─► resolveWidgetUri() + guardWidgetIntent() ─► navigationRef.reset(NESTED ...) | missing → reset(DashboardTab→[Home]) + Alert
  Compose Back     ─► goHome() ─► navigation.reset(Dashboard root)   (entry-agnostic fallback, ADR-044)
```

### Component Responsibilities

| Component/File | Responsibility (post-refactor) |
|----------------|-------------------------------|
| `App.tsx` | Unchanged gate: `openAndMigrate` resolves BEFORE the tab navigator mounts (ADR-080 risk: never mount screens against an unmigrated DB) |
| `src/navigation/RootNavigator.tsx` | Becomes the `createBottomTabNavigator`; each tab renders a `createNativeStackNavigator` component |
| `src/navigation/types.ts` | Splits `RootStackParamList` into a `TabParamList` + one param list per tab stack; adds `CompositeScreenProps` helpers |
| `src/navigation/reset-intents.ts` (new) | Single owner of the nested-reset state shape used by all external-entry paths (DRY the [Dashboard→Home,target] reset) |
| `src/components/UniversalFab.tsx` (new; replaces `AddSpeedDialFab`) | Six-action speed dial, context-aware, theme-tokened, Reanimated |
| `src/components/ContactPicker.tsx` (new) | Reusable modal picker; Favourites→recent→alpha; archived-via-search; snoozed-marked |
| `src/components/Snackbar.tsx` (new) | Commit-truthful Quick Log feedback (Undo/Retry) |
| `src/screens/HomeScreen.tsx` | Dashboard tab root; hosts Group Events header entry + Archived/Group Events overflow |

### Recommended Project Structure
```
src/navigation/
├── RootNavigator.tsx       # createBottomTabNavigator (4 tabs)
├── tabs/
│   ├── DashboardStack.tsx  # native stack: Home + content routes
│   ├── OrreryStack.tsx     # native stack: Orrery
│   ├── BackupStack.tsx     # native stack: Backup + restore/import/reconcile
│   └── SettingsStack.tsx   # native stack: Settings + low-traffic homes
├── types.ts                # TabParamList + per-stack param lists + Composite helpers
├── reset-intents.ts        # NEW: nested-reset builders (single owner)
├── linking.ts              # navigationRef (unchanged export)
├── widget-linking.ts       # reset shapes updated to nested
└── notification-gate.tsx   # reset shapes updated to nested
src/components/
├── UniversalFab.tsx        # NEW (supersedes AddSpeedDialFab)
├── ContactPicker.tsx       # NEW
├── Snackbar.tsx            # NEW
```

### Pattern 1: Bottom tabs with a native stack per tab
**What:** `createBottomTabNavigator` whose each screen is a small component wrapping a `createNativeStackNavigator`.
**When to use:** The ADR-080 root shell.
**Example:**
```tsx
// Source: CITED reactnavigation.org/docs/tab-based-navigation (nesting a stack in each tab)
const Tab = createBottomTabNavigator<TabParamList>();
export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,          // screens own their chrome (unchanged rule, RootNavigator.tsx:75)
        tabBarHideOnKeyboard: true,  // SHELL-06 nav-bar half
        animation: "fade",           // SHELL-15 short crossfade, no horizontal slide  [CITED: v7 `animation` option — VERIFY exact token]
      }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStack} />
      <Tab.Screen name="OrreryTab" component={OrreryStack} />
      <Tab.Screen name="BackupTab" component={BackupStack} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} />
    </Tab.Navigator>
  );
}
```

### Pattern 2: Active-tab retap — dismiss transient UI, then pop to root (SHELL-02)
**What:** Intercept `tabPress`; if a transient layer (speed dial / picker / filter modal) is open, close it and stop; otherwise pop that tab's stack to root.
```tsx
// Source: CITED reactnavigation.org/docs/navigation-events + use-navigation
<Tab.Screen name="DashboardTab" component={DashboardStack}
  listeners={({ navigation, route }) => ({
    tabPress: (e) => {
      const focused = navigation.isFocused();
      if (!focused) return;                       // ordinary tab switch
      if (shellStore.getState().dismissTopTransient()) { e.preventDefault(); return; } // 1st tap: dismiss
      const stack = getFocusedStackNav(route);    // 2nd tap: pop to root
      if (stack?.canGoBack()) { e.preventDefault(); stack.popToTop(); }
    },
  })}
/>
```
Note: the transient-UI open state (speed dial, picker) lives in a small Zustand shell store so both `tabPress` and the Back resolver can consult/dismiss it from one place.

### Pattern 3: Nested reset for external entry (D-07 / SHELL-05) — the correctness core
**What:** All external forced-Dashboard resets must land the **Dashboard tab** at its root, optionally with one target pushed, so Back → Dashboard. Under the tab tree the reset target changes shape.
```ts
// Source: CITED reactnavigation.org/docs/nesting-navigators#navigating-to-a-screen-in-a-nested-navigator
//         + docs/navigation-actions#reset (state-object form)
// src/navigation/reset-intents.ts  (single owner — every external path calls these)
export function resetToDashboardRoot() {
  return { index: 0, routes: [{ name: "DashboardTab" as const,
    state: { index: 0, routes: [{ name: "Home" as const }] } }] };
}
export function resetToDashboardWith(target: { name: string; params?: object }) {
  return { index: 0, routes: [{ name: "DashboardTab" as const,
    state: { index: 1, routes: [{ name: "Home" as const }, target] } }] };
}
```
Then `navigationRef.current?.reset(resetToDashboardWith({ name: "Compose", params: { contactId } }))`. The two-element inner `routes` guarantees Back pops `Compose` → `Home` (exactly what `notification-nav.ts:63-72` and `widget-linking.ts:55-57` guarantee today, preserved). **This is the ADR-044 fallback — do not remove it (D-07).**

### Anti-Patterns to Avoid
- **Flat root reset under a tab tree.** `navigationRef.reset({routes:[{name:"Home"},...]})` at the container level now targets the TAB navigator; `"Home"` is not a tab name → runtime "route not found" or silent wrong-tab landing. Use the nested state form (Pattern 3).
- **Animating the speed dial from React state.** CLAUDE.md forbids per-frame `setState`. The existing `AddSpeedDialFab` correctly uses `useSharedValue`/`withTiming`; the six-action dial must keep that (React state only mirrors open/closed for `pointerEvents`, as `add-speed-dial-fab-logic.ts` already does).
- **Optimistic Quick Log snackbar.** Never show the success snackbar before `recordTouchpoint()`'s promise resolves. Show success only in `.then(({interactionId}) => ...)`; show error+Retry in `.catch(...)` (SHELL-11: "never success unless the write committed").
- **Registering one Archived route in a shared place and reaching it from two tabs.** A route object instance belongs to one stack; reaching Archived from both Dashboard overflow and the Settings row means registering the `Archived` route in **both** tab stacks (or a chosen single owner both entries `navigate` into). Do NOT create two Archived *screens* (ADR-080 risk: two homes for restore/purge weakens ADR-018's single destructive surface).
- **Manual inset guessing.** Dossier §J: screens must not hand-roll status-bar/nav padding; route it through safe-area primitives + `useBottomTabBarHeight()` for content clearance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab bar + per-tab history | Custom tab bar over one stack | `@react-navigation/bottom-tabs` | Remembered per-tab stacks, hardware-back integration, `tabBarHideOnKeyboard`, screen freezing — all solved |
| Device insets | Manual `StatusBar.currentHeight` math | `react-native-safe-area-context` (already present) | Cutouts/gesture zones vary per device; dossier §J forbids ad-hoc padding |
| Content-clears-nav-bar | Hardcoded bottom padding | `useBottomTabBarHeight()` | Exact bar+inset height; survives theme/large-text changes |
| Hardware Back over nested navigators | Custom `BackHandler` walking a global stack | React Navigation's built-in nested back + targeted `beforeRemove`/tabPress hooks | RN's integration already pops the focused stack then falls through tabs; only override for transient-layer dismissal |
| Keyboard-aware nav hide | Custom measure of keyboard | `tabBarHideOnKeyboard` (nav) + `Keyboard` events (FAB) | Built-in for the bar |
| Quick Log write + recency | New insert SQL in the FAB | `recordTouchpoint(exec, input)` (`recency-dao.ts:217`) | Already runs inside `inWriteTransaction`, recomputes `last_contact`, bumps data revision, guards future dates. Returns `{interactionId}` — the commit-truth signal SHELL-11 needs |

**Key insight:** Almost every shell primitive except the FAB, picker, and snackbar is already solved by react-navigation + safe-area-context, both already installed. The net-new *code* is three UI components, a route-tree split, and one nested-reset helper — not a navigation framework.

## Runtime State Inventory

> This is a refactor phase. No datastore, OS registration, or secret embeds a shell string, but **serializable navigation intents** are the runtime state that survives the refactor and must be migrated in lockstep with the route tree.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No DB table, ChromaDB/Mem0 collection, or SQLite content keys on a navigator/route name. D-03: no migration. Verified: `grep` for route names in `src/db/` returns only unrelated matches. | None |
| Live service config | **None.** No n8n/Datadog/external service references a route name. | None |
| OS-registered state | **Deep-link intent shapes (code-embedded, not OS-registered).** `orbit://` URIs resolve to reset intents in `widget-linking.ts` (`resolveWidgetUri`) and notification payloads resolve in `notification-nav.ts` (`resolveNotificationNav`). These emit `{routes:[{name:"Home"},{name:"Profile"|"Compose"|"Digest"|"ManageFavourites"}]}` — **flat** shapes that break under the tab tree. | Update the emitted intent shapes to the nested form (Pattern 3) in the SAME change that splits the route tree, and re-run their existing unit tests (`widget-linking.test.ts`, `notification-nav.test.ts`) |
| Secrets/env vars | **None.** No env var or SOPS key names a route. `EXPO_PUBLIC_BACKUP_ENCRYPTION_BENCHMARK` (App.tsx:347) is unrelated. | None |
| Build artifacts | **None new.** `app.config.ts:76` `predictiveBackGestureEnabled: false` is a build-time Android manifest flag (D-10) — note its state, do not flip. No egg-info/compiled artifact carries a route name. | None (leave predictive-back as-is) |

**The canonical question — after the route tree is split, what still holds the OLD flat shape?** The three pure resolvers (`resolveWidgetUri`, `resolveNotificationNav`, and the widget missing-contact fallback at `widget-linking.ts:274`), plus the four in-screen resets below. All are code, all have or need tests, none is opaque runtime state — but they are the reason a "just add a tab navigator" plan silently strands external entries.

## `navigation.reset` Call-Site Inventory (D-08 — required)

> Re-verified against files on disk **this session** (2026-09-02). Nine call sites across seven files. Grouped by post-refactor behavior class. **Every value below is quoted verbatim from the cited line.**

### Class A — External-entry forced-Dashboard fallback (D-07 / ADR-044 — MUST SURVIVE)

| # | Site | Current code (verbatim) | Post-refactor behavior |
|---|------|------------------------|------------------------|
| A1 | `src/screens/ComposeScreen.tsx:267` | `() => navigation.reset({ index: 0, routes: [{ name: "Home" }] })` | Compose Back → Dashboard tab root. Entry-agnostic (notification/widget callers have no Home in stack). Re-express as `resetToDashboardRoot()`. **Do not remove.** |
| A2 | `src/navigation/notification-gate.tsx:136` | `nav.reset({ index: intent.index, routes: intent.routes })` (intent from `notification-nav.ts`: decay `[Home, Compose{contactId}]`, digest `[Home, Digest]`; birthday is a `navigate` to Profile, not a reset) | Nested reset landing Dashboard tab with `Compose`/`Digest` pushed. Update `resolveNotificationNav` to emit nested shape (or map flat→nested in the gate via `reset-intents.ts`). **Preserve Back→Dashboard.** |
| A3 | `src/navigation/widget-linking.ts:287` | `navigationRef.current?.reset({ index: guarded.intent.index, routes: guarded.intent.routes })` (routes `[Home, Profile\|Compose\|ManageFavourites]`) | Nested reset via root `navigationRef`. **Note:** `ManageFavourites` currently targets the Settings/Dashboard area — decide its owning tab; the reset must push it onto that tab's stack. |
| A4 | `src/navigation/widget-linking.ts:274` | `navigationRef.current?.reset({ index: 0, routes: [{ name: "Home" }] })` (missing-contact reach fallback + `Alert.alert("This contact is no longer available.")`) | Missing deep-link contact → Dashboard tab root + friendly Alert. This IS the SHELL-05 missing-contact requirement — re-express as `resetToDashboardRoot()`. |

### Class B — Backup-tab-local completion resets (stay WITHIN the Backup tab stack)

| # | Site | Current code (verbatim) | Post-refactor behavior |
|---|------|------------------------|------------------------|
| B1 | `src/screens/RestorePreviewScreen.tsx:99` | `navigation.reset({ index: 0, routes: [{ name: "Backup" }] })` | Cancel restore preview → Backup **stack** root. Now a tab-local reset: the `navigation` prop is the Backup stack's own navigator, so `reset({routes:[{name:"Backup"}]})` still works **if `Backup` is that stack's root route name.** No nested shape needed — but confirm the route lives in `BackupStack`. |
| B2 | `src/screens/RestorePreviewScreen.tsx:123` | `navigation.reset({ index: 1, routes: [{ name: "Backup" }, { name: "RestoreResult", params: toRestoreResultParams(result) }] })` | Success → Backup stack `[Backup, RestoreResult]`. Tab-local; unchanged shape provided both routes are in `BackupStack`. |
| B3 | `src/screens/RestoreResultScreen.tsx:18` | `navigation.reset({ index: 0, routes: [{ name: "Backup" }] })` | Return to Backup root. Tab-local; unchanged if `Backup` is the stack root. |

### Class C — Import/reconcile completion → Dashboard (origin-ambiguous)

| # | Site | Current code (verbatim) | Post-refactor behavior |
|---|------|------------------------|------------------------|
| C1 | `src/screens/ImportCompleteScreen.tsx:300` | `navigation.reset({ index: 0, routes: [{ name: "Home" }] })` | Import Done → Dashboard root. Import is launchable from the FAB (Add Contact) and/or Settings, so its owning tab is ambiguous — see Open Question 2. Recommend: reset the owning tab (whichever launched it) to root; if using root `navigationRef`, use `resetToDashboardRoot()`. |
| C2 | `src/screens/ReconcileCompleteScreen.tsx:47` | `navigation.reset({ index: 0, routes: [{ name: "Home" }] })` | Reconcile Done → Dashboard root. Same origin ambiguity as C1. |

**Note on the gate at `RestorePreviewScreen.tsx:94-96`:** a `beforeRemove` listener already `preventDefault()`s Back while `applying` — this is the SHELL-07 Discard/Keep guard idiom already in the codebase; reuse it, don't reinvent.

## Common Pitfalls

### Pitfall 1: Flat reset shape under the tab tree
**What goes wrong:** `navigationRef.reset({routes:[{name:"Home"}, ...]})` after the split → "route Home not found" or lands the wrong tab; Back no longer returns to Dashboard.
**Why it happens:** The container's top level is now the tab navigator; `Home` is nested one level down.
**How to avoid:** Route every reset through `reset-intents.ts` (Pattern 3). One place to get the nesting right, one place tests cover.
**Warning signs:** Notification/widget taps land on a blank tab or throw; `widget-linking.test.ts`/`notification-nav.test.ts` assertions on `routes` fail.

### Pitfall 2: Migration gate below the tab navigator
**What goes wrong:** Tab screens mount and read against an unmigrated DB (ADR-080 explicit risk).
**Why it happens:** Moving the navigator during refactor can accidentally hoist it above the `ready` gate.
**How to avoid:** Keep the tab navigator strictly inside `App.tsx`'s `ready && !error` branch (App.tsx:309). Do not touch the gate order.
**Warning signs:** Half-built-DB reads on cold start; first render flashes empty data.

### Pitfall 3: Speed-dial scrim swallows dashboard touches
**What goes wrong:** An `absoluteFill` scrim at opacity 0 still captures touches, blanketing the tab content.
**Why it happens:** RN opacity-0 views remain hit-testable — this exact bug is documented in `add-speed-dial-fab-logic.ts:1-13`.
**How to avoid:** Reuse `speedDialScrimPointerEvents(open)` → `"none"` when collapsed, `"auto"` when open. Keep the pure helper + its test.
**Warning signs:** Taps on the dashboard do nothing when the FAB is closed.

### Pitfall 4: Hardware Back vs. nested navigators + transient layers
**What goes wrong:** System Back closes the app or pops a screen when it should first dismiss an open speed dial / picker / modal (SHELL-03).
**Why it happens:** RN's default nested back pops the focused stack; it doesn't know about your transient overlays.
**How to avoid:** A single back-intent resolver: if a transient layer is open (shell store), a `BackHandler` handler dismisses it and returns `true`; else fall through to default nav back. Wire the visible Back control to the same resolver so "system Back == visible Back" is literally one function.
**Warning signs:** Back exits the app with the speed dial still open; visible Back and system Back diverge.

### Pitfall 5: Keyboard overlaps FAB / bottom bar
**What goes wrong:** FAB floats over the keyboard; bottom bar pushed up or hidden inconsistently.
**Why it happens:** `tabBarHideOnKeyboard` hides the bar but not the FAB (a separate overlay).
**How to avoid:** Subscribe the FAB to `Keyboard.addListener('keyboardDidShow'/'keyboardDidHide')` and hide it in lockstep (SHELL-06). Note MEMORY: prefer `onSubmitEditing` over `KeyboardAvoidingView` for bottom surfaces on this device.
**Warning signs:** FAB visible above keyboard during Quick Log picker search.

### Pitfall 6: Two Archived screens
**What goes wrong:** Dashboard overflow and Settings row each mount their own Archived screen → restore/purge gains a second home (weakens ADR-018).
**Why it happens:** Registering `Archived` in two stacks with two component instances.
**How to avoid:** One `Archived` screen. Either register it in one owning stack and have the other entry `navigate` across, or register the same component in both stacks — but never two distinct destructive surfaces. (ADR-080 risk note.)

### Pitfall 7: Speed-dial focus trapping / a11y (SHELL-14)
**What goes wrong:** Screen reader can reach dashboard content behind the open speed dial; focus not restored to FAB on close.
**Why it happens:** Overlay isn't marked modal.
**How to avoid:** Set `accessibilityViewIsModal` on the open dial container; on close, return focus to the invoking FAB (`AccessibilityInfo.setAccessibilityFocus` / ref). Announce open/close.
**Warning signs:** TalkBack reads through the scrim.

## Code Examples

### Quick Log commit-truthful write + snackbar (SHELL-11)
```ts
// Source: VERIFIED src/db/recency-dao.ts:217-243 (read this session)
// recordTouchpoint runs inside inWriteTransaction, recomputes last_contact,
// bumps data revision, and rejects future occurred_at BEFORE opening the txn.
recordTouchpoint(getExecutor(), { contactId, occurredAt: now, now /* + channel/source defaults */ })
  .then(({ interactionId }) => {
    showSnackbar({ kind: "success", label: "Logged", onUndo: () => undoTouchpoint(interactionId) });
    // haptic: success (dossier §M)
  })
  .catch((err) => {
    showSnackbar({ kind: "error", label: "Couldn't log", onRetry: () => /* re-invoke */ });
  });
```
**Undo seam:** No delete-interaction export was found in `recency-dao.ts` (only `recordTouchpoint`/`editTouchpointFull` read this session). Undo needs a new guarded DAO export that deletes interaction `interactionId` and recomputes `last_contact` inside one `inWriteTransaction` — mirror `recordTouchpoint`'s structure. Flag as a plan task. [VERIFIED: recency-dao.ts:178-243 read — no delete path present]

### Composite screen props for a nested tab+stack route
```ts
// Source: CITED reactnavigation.org/docs/typescript#nesting-navigators
export type DashboardStackParamList = {
  Home: undefined;
  Profile: { contactId: number; openReachOut?: boolean };
  Edit: { contactId: number };
  Compose: { contactId: number; requestAiSuggestion?: boolean };
  // ...content routes moved from RootStackParamList
};
export type TabParamList = {
  DashboardTab: NavigatorScreenParams<DashboardStackParamList>;
  OrreryTab: NavigatorScreenParams<OrreryStackParamList>;
  BackupTab: NavigatorScreenParams<BackupStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};
export type DashboardScreenProps<T extends keyof DashboardStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<DashboardStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;
```
Note: current `RootStackParamList` (`types.ts:22-141`) is one flat list; splitting it is the largest mechanical change and every `RootStackScreenProps<...>` consumer must move to the right per-tab helper.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single flat `createNativeStackNavigator` root (ADR-019) | Four-tab bottom nav, per-tab stacks (ADR-080) | 2026-09-01 (owner-ratified) | This phase's entire refactor |
| Two-action dashboard FAB (`AddSpeedDialFab`: Import / Create) | Universal six-action speed dial | this phase | Replace `AddSpeedDialFab`; keep its Reanimated + scrim-pointer-events patterns |
| "Profile always backs to Dashboard" | Origin-aware Back | this phase (already free — `goBack()`) | Correct by construction with per-tab stacks |
| Flat `[Home, target]` external reset intents | Nested `[DashboardTab→[Home, target]]` | this phase | Update `widget-linking.ts`, `notification-gate.tsx`, `notification-nav.ts` shapes + tests |

**Deprecated/outdated after this phase:**
- `src/components/AddSpeedDialFab.tsx` + `add-speed-dial-fab-logic.ts` — superseded by the universal FAB. Keep the `speedDialScrimPointerEvents` helper (still needed); retire the two-action component. The `dashboard-create-fab` testID and its callers must move.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bottom-tabs v7 `animation: 'fade'` is the correct token for the SHELL-15 crossfade | Pattern 1 / Standard Stack | Wrong token name → build error or slide animation; VERIFY against v7 docs at plan time (v7 added an `animation` prop; exact accepted values must be confirmed) |
| A2 | The natural owning tab for Profile/Compose/Edit/Digest/Create/Capture/NeverContacted/UnboundContacts is the **Dashboard** stack | Recommended Structure / reset inventory | If mis-assigned, deep-link targets land in the wrong tab's stack; this is a Claude's-discretion design call but affects every reset shape |
| A3 | `ManageFavourites` and `Archived` should be reachable from both Settings and Dashboard by registering the route in the relevant stack(s), not by a shared root route | Anti-Patterns / Pitfall 6 | Wrong choice risks two destructive surfaces (ADR-018) — needs a deliberate single-owner decision |
| A4 | No existing haptics module — `expo-haptics` may be needed for dossier §M | Supporting stack | If a haptic path already exists, adding the dep is waste; VERIFY (grep found none, but not exhaustive) |
| A5 | Undo requires a NEW delete-interaction DAO export (none found) | Code Examples | If a delete path exists elsewhere, reuse it; if not, it's a required new guarded task |
| A6 | The four not-yet-built FAB actions route to themed placeholder screens (established `types.ts:14-16` pattern) rather than "coming soon" affordances | Summary / Open Q1 | If the owner wants a different UX for unbuilt actions, the FAB wiring changes — implementation detail, but user-visible |

## Open Questions (RESOLVED)

1. **How should the FAB expose actions whose forms are built in later phases?**
   - What we know: Add Contact → existing `Create`; Quick Log → shell-owned immediate write (buildable now). Log Contact/Update Contact (Phase 34), Group Log (Phase 33), Memory (Phase 24) target unbuilt workflows. Dossier: Phase 22 owns "exposure/routing only."
   - What's unclear: whether unbuilt actions route to themed placeholder screens (registered semantic routes, deep-link-ready) or show a "coming soon" state.
   - Recommendation: **register semantic placeholder routes** (the codebase's own documented pattern, `types.ts:14-16`) so SHELL-08's six-in-fixed-order and the routing-contract's deep-link readiness are satisfied now, and Phases 24/33/34 swap the placeholder for the real screen with zero shell change. This is settled enough to plan (not a blocker) — but it is user-visible, so surfaced here for confirmation.
   - — RESOLVED: register themed semantic placeholder routes (deep-link-ready); adopted by Plans 04 (Group Events header/overflow) and 05 (unbuilt FAB actions).

2. **Which tab owns the contact-import / reconcile flow (Class C resets)?**
   - What we know: Import is launched from the FAB (Add Contact) and historically resets to Home; it can also start from Settings.
   - What's unclear: post-refactor owning tab for its completion reset.
   - Recommendation: reset to Dashboard root via `resetToDashboardRoot()` (matches current Home reset and the external-entry fallback); revisit only if the owner wants import to return to Settings.
   - — RESOLVED: import/reconcile completion resets to Dashboard root via `resetToDashboardRoot()`; adopted by Plan 03.

3. **Group Events destination screen (SHELL-12) — placeholder or existing?**
   - What we know: Dashboard header + overflow expose Group Events; Phase 33 owns the Group Event screens/persistence.
   - Recommendation: header/overflow entries route to a themed placeholder route (same pattern as Q1); Phase 33 fills it.
   - — RESOLVED: Group Events routes to a themed placeholder route (Phase 33 fills it); adopted by Plan 04.

No item here reverses a [DECIDED]/ADR/HANDOFF entry, so none is a stop-and-ask. They are discretion calls with clear recommendations, each now resolved and adopted by the plan named above.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-navigation/bottom-tabs` | Tab shell (SHELL-01) | ✗ (to install) | 7.18.18 on registry | none — required |
| `@react-navigation/native` | container | ✓ | 7.3.16 | — |
| `@react-navigation/native-stack` | per-tab stacks | ✓ | 7.18.8 | — |
| `react-native-screens` | bottom-tabs peer | ✓ | 4.26.2 | — |
| `react-native-safe-area-context` | insets | ✓ | 5.7.0 | — |
| `react-native-reanimated` | FAB/snackbar anim | ✓ | 4.5.1 | — |
| `expo-haptics` | semantic haptics (§M) | ✗ (verify need) | — | ship without haptics initially; add via `npx expo install` |
| Android device (Pixel 6 Pro) / desktop emulator | UAT of nav/back/keyboard | ✓ | via `emu-connect` | — |

**Missing dependencies with no fallback:** `@react-navigation/bottom-tabs` (install step — the phase cannot start without it).
**Missing dependencies with fallback:** `expo-haptics` (haptics can be deferred; nav correctness does not depend on it).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 [VERIFIED: package.json + vitest.config.ts read] |
| Config file | `vitest.config.ts` — `environment: "node"`, `globals: true`, `include: src/**/*.test.ts(x)`, `passWithNoTests: true` |
| Quick run command | `npx vitest run <path>` (single file, node env, no DOM) |
| Full suite command | `npm test` (→ `vitest run`) |

**Critical constraint:** the vitest env is **node, render-free** (no jsdom/happy-dom). Tests exercise **pure logic only** — they never render a component or mount a navigator. This is why the codebase pushes navigation *decisions* into pure resolvers (`notification-nav.ts`, `widget-linking.ts`'s `resolveWidgetUri`, `add-speed-dial-fab-logic.ts`) that return serializable intents, then tests assert on the intent shape. **The Phase 22 plan must follow this idiom:** put the nested-reset builders, the back-intent resolution, the picker ordering, and the FAB action→route mapping in pure modules so they are node-testable; the navigator wiring itself is verified on-device (UAT), not in vitest.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-05 | External reset intents land Dashboard+target (nested shape) | unit | `npx vitest run src/navigation/reset-intents.test.ts` | ❌ Wave 0 |
| SHELL-05 | Widget URIs resolve to nested resets; missing contact → Dashboard | unit (extend) | `npx vitest run src/navigation/widget-linking.test.ts` | ✅ (update assertions) |
| SHELL-05 | Notification taps resolve to nested resets | unit (extend) | `npx vitest run src/services/notifications/notification-nav.test.ts` | ✅ (update assertions) |
| SHELL-02/03 | Back/tabPress intent resolution (dismiss transient → pop root) | unit | `npx vitest run src/navigation/back-intent.test.ts` | ❌ Wave 0 |
| SHELL-10 | Picker ordering Favourites→recent→alpha; archived-via-search; snoozed-marked | unit | `npx vitest run src/logic/contact-picker-order.test.ts` | ❌ Wave 0 (distinct from existing import-picker `contact-picker-*` logic) |
| SHELL-08/09 | FAB six-action set/order + context→target mapping | unit | `npx vitest run src/components/universal-fab-logic.test.ts` | ❌ Wave 0 |
| SHELL-08 | Scrim pointer-events collapsed→inert | unit | `npx vitest run src/components/add-speed-dial-fab-logic.test.ts` | ✅ (reuse helper) |
| SHELL-11 | Quick Log success only on commit; Undo delete + recompute | unit | `npx vitest run src/db/recency-dao.test.ts` (extend for delete/undo) | ✅ (extend) |
| SHELL-01/06/13/15 | Tab shell renders, insets, keyboard hide, crossfade, no swipe | manual (on-device) | UAT on Pixel via `emu-connect` + `uiautomator dump` | manual — render-free vitest cannot cover |
| SHELL-04/07/12/14 | Origin-aware Back, Discard/Keep, header entries, a11y focus | manual (on-device) | UAT on Pixel (TalkBack for a11y) | manual |

### Sampling Rate
- **Per task commit:** `npx vitest run <the touched pure-logic test file>` (sub-second, node env).
- **Per wave merge:** `npm test` (full render-free suite; `passWithNoTests` safe).
- **Phase gate:** `npm test` green **plus** on-device UAT of the manual rows (tab switching, hardware Back == visible Back with a transient layer open, keyboard hide, Quick Log commit-truth, deep-link/notification landing on Dashboard) before `/gsd-verify-work`. On-device is mandatory here — the node test env cannot render the navigator, and MEMORY notes `adb input tap` false-negatives on small RN Pressables, so verify against code first and use the correct input taxonomy.

### Wave 0 Gaps
- [ ] `src/navigation/reset-intents.ts` + `reset-intents.test.ts` — nested-reset builders (SHELL-05), single owner
- [ ] `src/navigation/back-intent.ts` + test — back/tabPress resolution (SHELL-02/03)
- [ ] `src/logic/contact-picker-order.ts` + test — picker ordering (SHELL-10) — NOTE: name-distinct from the existing import-flow `contact-picker-*` logic to avoid confusion
- [ ] `src/components/universal-fab-logic.ts` + test — action set/order/context mapping (SHELL-08/09)
- [ ] Extend `widget-linking.test.ts` + `notification-nav.test.ts` for nested-reset shapes
- [ ] Extend `recency-dao.test.ts` for the new Undo delete-interaction path (SHELL-11)
- [ ] No framework install needed (vitest present)

## Security Domain

> `security_enforcement` not explicitly false in config → included. This is a pure client-side navigation phase; the security surface is deep-link input, which is already hardened.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth/account identity (explicitly deferred, dossier) |
| V3 Session Management | no | Local-first, no sessions |
| V4 Access Control | no | Single-user-context device app; no server authz |
| V5 Input Validation | **yes** | Deep-link (`orbit://`) and notification payloads are untrusted launcher input — already validated by strict allow-list resolvers (`resolveWidgetUri`, `resolveNotificationNav`). Preserve this: the nested-reset change must not loosen the digit-only anchored regexes or the `Number.isSafeInteger`/`> 0` id checks (`widget-linking.ts:103-119`) |
| V6 Cryptography | no | No crypto in the shell path |

### Known Threat Patterns for RN deep-link shell
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed `orbit://` intent from another app | Spoofing/Tampering | Strict allow-list resolver returns null for anything but the four minted forms; never eval/interpolate the URI (existing `widget-linking.ts` contract — do not weaken) |
| Forged notification payload → navigate to arbitrary contact | Tampering | Payload re-validated via `resolveNotificationNav`; decay taps additionally guarded against non-live/archived contacts (`notification-gate.tsx:91-117`) |
| Deep link to deleted/missing contact | DoS/crash | Fail-safe: friendly Alert + Dashboard reset, no crash (`widget-linking.ts:265-279`) — this IS SHELL-05; keep it |
| Reset onto attacker-influenced route | Elevation | Reset targets are compile-time route names, never derived from URI free-text; only the integer id is data |

**Do not hand-roll deep-link parsing.** The existing pure resolvers are the security boundary; the refactor changes only the *emitted reset shape*, never the *acceptance logic*.

## Sources

### Primary (HIGH confidence)
- Codebase read this session: `RootNavigator.tsx`, `types.ts`, `App.tsx`, `widget-linking.ts`, `notification-gate.tsx`, `notification-nav.ts`, `linking.ts`, `AddSpeedDialFab.tsx`, `add-speed-dial-fab-logic.ts`, `recency-dao.ts`, `RestorePreviewScreen.tsx`, `RestoreResultScreen.tsx`, `ImportCompleteScreen.tsx`, `ReconcileCompleteScreen.tsx`, `ContactProfileScreen.tsx` (back site), `HomeScreen.tsx` (FAB/header sites), `vitest.config.ts`, `app.config.ts` (predictive-back), `package.json` + `node_modules` versions
- Decision record: ADR-080; dossier `phase-01-app-shell-navigation-dossier-amended-group-events.md` (full); `planning-notes/phase-01-planning-notes.md`; `.planning/REQUIREMENTS.md` (SHELL-01..15); `.planning/ROADMAP.md` (phase ordering 22→40)
- `npm view @react-navigation/bottom-tabs version` → 7.18.18 [VERIFIED this session]

### Secondary (MEDIUM confidence)
- reactnavigation.org v7 docs (nesting navigators, tab-based navigation, navigation-actions#reset, typescript nesting, tab `animation` option) — [CITED]; the `animation: 'fade'` token (A1) and `tabBarHideOnKeyboard` should be re-confirmed against the installed v7 minor at plan time

### Tertiary (LOW confidence)
- None load-bearing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions read from disk + npm; all within already-trusted first-party scopes
- Architecture / reset inventory: HIGH — all nine call sites and the migration gate read verbatim this session
- bottom-tabs v7 option tokens (`animation`, `tabBarHideOnKeyboard`): MEDIUM — CITED, confirm exact tokens against installed minor
- Undo delete path / haptics existence: MEDIUM — grep-based negative claims (A4/A5), verify at plan time

**Research date:** 2026-09-02
**Valid until:** 2026-10-02 (stable stack; re-verify bottom-tabs minor if installed later)

## RESEARCH COMPLETE

**Phase:** 22 - App Shell & Navigation
**Confidence:** HIGH

### Key Findings
- The flat root native-stack becomes a four-tab bottom navigator (install `@react-navigation/bottom-tabs@^7.18.18` — the only new dependency; all other primitives already installed).
- **Nine `navigation.reset` call sites** enumerated verbatim (D-08), grouped: 4 external-entry Dashboard fallbacks that MUST survive (D-07/ADR-044), 3 Backup-tab-local, 2 import/reconcile completions. The external four must move from flat `[Home,target]` to a **nested** `[DashboardTab→[Home,target]]` shape — the phase's correctness core, best centralized in one `reset-intents.ts` helper.
- The existing `AddSpeedDialFab` is a 2-action dashboard-local affordance, not the universal six-action dial — it must be superseded (keep its Reanimated + scrim-pointer-events patterns).
- Quick Log has a ready commit-truthful write path (`recordTouchpoint` → `{interactionId}` inside `inWriteTransaction`); Undo needs a NEW guarded delete-interaction DAO (none found).
- Four of the six FAB actions (Log Contact, Group Log, Update Contact, Memory) target workflows built in Phases 24/33/34 — route them to themed placeholder screens (the codebase's own established pattern); no form logic enters Phase 22.

### File Created
`/home/bwales/projects/orbit-app/.planning/phases/22-app-shell-navigation/22-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Versions from disk + npm; first-party scopes only |
| Architecture / reset inventory | HIGH | All sites + gate read verbatim this session |
| Pitfalls | HIGH | Derived from real codebase idioms (scrim pointer-events, migration gate, pure-resolver tests) |
| bottom-tabs v7 option tokens | MEDIUM | CITED; confirm exact `animation` token at plan time |

### Open Questions (none blocking; all have recommendations)
1. FAB routing for not-yet-built actions → recommend themed placeholder routes (established pattern).
2. Owning tab for import/reconcile completion resets → recommend Dashboard root.
3. Group Events destination → recommend placeholder route (Phase 33 fills it).

### Ready for Planning
Research complete. No stop-and-ask reversal surfaced — no recommendation touches a [DECIDED]/ADR/HANDOFF entry. Planner can create PLAN.md.
