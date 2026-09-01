# App Shell

**Last updated:** 2026-08-16
**Updated by phase:** 12-home-screen-widget
**Owners:** `App.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts`, `src/navigation/linking.ts`, `src/navigation/notification-gate.tsx`, `src/navigation/widget-linking.ts`, `src/screens/SettingsScreen.tsx`, `src/theme/theme-types.ts`, `src/theme/theme-presets.ts`

## Purpose

The app shell holds Orbit’s ready-gated native navigation tree and the shared visual tokens its screens consume. It gives multi-screen flows typed stack navigation, including a pending Android share-intent route, without mounting a read surface before local SQLite migration completes.

## Architecture

### Data Model

_None._ The shell owns runtime navigation and theme contracts, not durable application data.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Bootstrap | `App.tsx` | Opens and migrates SQLite before mounting the navigator inside theme and safe-area providers. |
| Navigator | `src/navigation/RootNavigator.tsx` | Registers native-stack routes, including dashboard sibling lists, management, modal crop, and Compose surfaces, with custom headers. |
| Route types | `src/navigation/types.ts` | Defines serializable parameters for profile, edit, crop, and self-fetching Compose routes. |
| Intent gate | `src/navigation/linking.ts` | Converts provider-owned pending share state into ready-gated navigation to Capture. |
| Notification gate | `src/navigation/notification-gate.tsx` | Converts warm and cold local-notification responses into ready-gated actions or navigation. |
| Widget gate | `src/navigation/widget-linking.ts` | Converts narrowly accepted widget `orbit://` links into ready-gated Dashboard-rooted resets. |
| Settings surface | `src/screens/SettingsScreen.tsx` | Hosts low-traffic lifecycle routes, self-photo, and the Manage favourites entry. |
| Theme contract | `src/theme/theme-types.ts`, `src/theme/theme-presets.ts` | Defines named tokens, including destructive, avatar-swatch, rogue-status, and gravity-tier tokens, and their sole palette values. |

### Key Files

| File | Role |
|---|---|
| `App.tsx` | Readiness gate, navigation mount point, gesture root, and photo/notification lifecycle registration. |
| `src/navigation/RootNavigator.tsx` | Native stack for the dashboard Home, Settings, contact lifecycle, Compose, NeverContacted, ManageFavourites, and CropPhoto. |
| `src/navigation/types.ts` | Typed root-stack route contract, including serializable Compose and photo-crop targets plus dashboard sibling routes. |
| `src/navigation/linking.ts` | Holds the navigation ref and the single ready-gated Capture navigation owner. |
| `src/navigation/notification-gate.tsx` | Owns warm/cold notification-response handling once navigation is ready. |
| `src/navigation/widget-linking.ts` | Owns the separate, strict widget URI bridge without consuming native share state. |
| `src/screens/CaptureScreen.tsx` | Provides the in-app target for a pending Android text share. |
| `src/screens/HomeScreen.tsx` | Provides the dashboard Home and its destination entries. |
| `src/screens/SettingsScreen.tsx` | Provides the distinct settings home, including self-photo and Manage favourites entries. |
| `src/theme/theme-types.ts` | Names palette tokens, including avatar swatches, rogue status, gravity tiers, and foreground text. |
| `src/theme/theme-presets.ts` | Holds the only allowed color literals, including avatar swatches and the rogue/gravity palette values. |

## How It Works

### Starting the application

1. `App.tsx` opens and migrates the local database before it renders a navigable screen.
2. Once ready, the app mounts `NavigationContainer` inside the existing theme and safe-area providers.
3. `RootNavigator` supplies the native stack; platform Back walks this stack rather than a Home-screen-local state toggle.

### Navigating dashboard and settings

1. Home is the dashboard and navigates to contact profiles, creation, Not yet contacted, Archived, Settings, and favourite management.
2. Settings exposes Custom Fields, Archived contacts, and Manage favourites as separate, low-traffic rows.
3. Every stack screen renders its own themed chrome because native-stack headers are disabled; no duplicate native header appears above screen-local Back controls.

### Composing from a contact

1. A profile opens `Compose` with the serializable `{ contactId }` route parameter; the screen fetches its own current data rather than receiving callbacks or preloaded state.
2. Compose resets both software and Android hardware Back to the Home dashboard, so the destination is stable for present and later entry points.

### Receiving an Android share

1. `ShareIntentProvider` consumes a pending native share while database migrations run.
2. Once `NavigationContainer.onReady` sets the reactive readiness flag, `ShareIntentGate` navigates the pending share to Capture.
3. The gate remains inside the successful migration-ready branch, so Capture cannot query a half-built local database; no deep-link consumer competes for the same native share payload.

### Starting and opening notifications

1. The ready-gated application effect registers notification reconciliation, awaits channel and action-category initialization, then installs the launch-sweep trigger.
2. `App.tsx` imports the headless-task module at bundle scope and sets an explicit silent foreground notification behavior.
3. `NotificationResponseGate` shares the navigator readiness flag with `ShareIntentGate`, queues an early body tap, and applies it only after the navigation ref is ready.

### Opening and refreshing the widget

1. `App.tsx` mounts `WidgetLinkingGate` with the same reactive readiness flag used by the share and notification gates.
2. The gate handles only strictly parsed `orbit://` widget links, so it cannot race the share-intent singleton; every accepted link resets to Dashboard plus its destination.
3. The ready-gated application effect registers the widget launch-sweep hook once. Foreground mutation publishers re-render placed widgets without blocking the user write.
4. Settings offers the in-app Add Orbit widget request and displays fallback instructions when the launcher declines it.

### Applying destructive emphasis

1. Screens obtain colors through `useTheme().colors`.
2. The Archived contacts purge action uses `colors.danger`; native confirmation alerts use the platform destructive style.
3. No screen contains a raw hex color because palette literals belong only in `theme-presets.ts`.

### Applying relationship-state emphasis

1. The profile reads every presentation colour through `useTheme().colors`.
2. A rogue explanation uses the dedicated `colors.rogue` token; it is not a destructive-action danger state.
3. Gravity uses the ordered `colors.gravityTiers` ramp, whose length matches the four named gravity tiers.
4. Stable, wobble, and decay use dedicated shared status tokens beside `rogue`; dashboard cards and headless widget bitmaps consume the same palette vocabulary.

### Editing a photo

1. A contact, self, or custom-field source picker navigates to `CropPhoto` with a serializable target descriptor and optional request id.
2. The crop screen uses the existing custom-header convention and returns through native stack Back behavior after persistence.
3. Settings reloads the self record on focus; the contact edit surface reloads only photo state so unsaved form values survive the round trip.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `headerShown` | `false` | `src/navigation/RootNavigator.tsx` | Leaves each screen responsible for its own header chrome. |
| `danger` | `#E5484D` | `src/theme/theme-presets.ts` | Owner-approved destructive and validation emphasis token. |
| `rogue` | `#E0904A` | `src/theme/theme-presets.ts` | In-app relationship-status emphasis token. |
| `statusStable` / `statusWobble` / `statusDecay` | `#45B98A` / `#E8C15C` / `#E56A52` | `src/theme/theme-presets.ts` | Shared status-ring palette for dashboard and widget surfaces. |
| `gravityTiers` | 4 ordered tokens | `src/theme/theme-presets.ts` | Named gravity-bar ramp from thin through deep. |

## Decisions

- **ADR-006:** Theme-Token Architecture — all UI colors resolve through the theme contract.
- **ADR-015:** Lossless Field Changes with Quarantine and Launch-Time Retention Sweep — keeps launch-time cleanup inside the ready-gated application shell.
- **ADR-018:** Archive-Gated Contact Purge with Explicit Fan-Out — destructive controls use the dedicated danger token.
- **ADR-019:** Native Stack Contact Lifecycle Navigation — replaces temporary Home-local routing with native-stack navigation.
- **ADR-020:** Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download — adds the modal crop route and self-photo entry.
- **ADR-022:** Tokenized Deterministic Initials Avatars — adds avatar fallback tokens to the theme contract.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — adds a dedicated in-app rogue emphasis token.
- **ADR-027:** Derived Profile-Only Gravity and Intensity — adds the gravity-tier ramp used by the profile bar.
- **ADR-031:** Bound Local Fuel Search without FTS5 — adds the reusable Phase-7 FuelSearch route and Settings entry.
- **ADR-032:** Flat Dashboard Discovery and In-Query Contact Search — moves search into Home and adds the dashboard's sibling list route.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — adds the shared Manage favourites route and entry points.
- **ADR-034:** Birthday Banner and Re-query Dashboard Freshness — mounts the birthday and reliable refresh paths in Home.
- **ADR-036:** Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails — adds the serializable Compose route and Home-reset Back behavior.
- **ADR-037:** Text-Only Android Share Intent Integration — adds the provider-owned, ready-gated Capture route for native text shares.
- **ADR-039:** Pre-Scheduled Inexact Decay Reminders — registers ready-gated launch/foreground notification reconciliation.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — adds the response gate and deterministic notification destinations.
- **ADR-041:** Notification Settings, Privacy Channels, and Birthday Alerts — requires channels and categories before the first scheduler run.
- **ADR-042:** Shared Status Palette for Dashboard and Widget Rings — extends the token contract with the shared relationship-status colours.
- **ADR-043:** Static Globally Mirrored Favourites Widget — registers the state-free provider and its Settings entry.
- **ADR-044:** Headless Widget Actions and Dashboard-Rooted Deep Links — adds a single-owner, ready-gated widget URI bridge.
- **ADR-045:** Event-Driven Widget Refresh and Boot Recovery — registers foreground refresh without polling.

## Gotchas

1. **Do not mount a read screen before migration readiness.** The navigator belongs only in the successful ready branch.
2. **Do not enable native stack headers without removing screen-local chrome.** The Phase-4 screens already render their own Back/title pattern.
3. **Navigation additions require an application rebuild.** Native-stack dependencies do not arrive through a JavaScript-only reload.
4. **Use tokens, never raw color literals.** The color gate enforces this outside the theme preset boundary.
5. **Crop navigation parameters must stay serializable.** The crop result uses a request id where a custom field needs a return signal; do not pass callbacks through navigation.
6. **Keep gravity tokens and tiers in lockstep.** The ordered palette ramp has one entry per gravity tier; changing one without the other can miscolor or crash profile presentation.
7. **Keep search ownership in the dashboard.** The reusable reader and result-row pattern survive the retired FuelSearch route, but Settings must not add a duplicate search surface.
8. **Compose Back is intentionally not a stack pop.** Both Back paths reset to Home so callers need not provide a profile or other origin route.
9. **Keep native share navigation single-owner.** A linking redirect beside `ShareIntentGate` can race the pending native intent, especially on a cold start.
10. **Initialize immutable notification channels before scheduling.** Scheduling first can post a request on a wrong/default channel and weaken the intended privacy posture.
11. **Keep widget links separate from React Navigation linking configuration.** A second initial-intent consumer can race `ShareIntentGate`; the explicit widget gate handles only `orbit://`.

## Related Systems

- **Contacts** — supplies the create, profile, edit, and archived routes.
- **Custom fields** — is reached through Settings rather than Home-local route state.
- **Dashboard** — is the Home route and owns daily discovery/search navigation.
- **Contact methods** — registers the self-fetching Compose surface in the stack.
- **Capture** — enters through the provider-owned Capture route after migrations are ready.
- **Notifications** — initializes at readiness and uses the response gate for body/action delivery.
- **Widget** — adds its URI gate, launch refresh registration, and Settings CTA to the ready shell.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 04 | Created ready-gated native-stack navigation, Settings routes, and the destructive theme token. |
| 2026-08-15 | 05 | Added photo crop navigation, self-photo settings, avatar tokens, and launch-time photo reconciliation registration. |
| 2026-08-15 | 06 | Added dedicated rogue-status and gravity-tier theme tokens for profile relationship feedback. |
| 2026-08-15 | 07 | Added the Settings-reached FuelSearch route and reusable search result surface. |
| 2026-08-15 | 08 | Made the dashboard Home, added first-contact and favourite-management routes, and relocated search from Settings. |
| 2026-08-16 | 09 | Added the serializable Compose route and dashboard-reset Back behavior. |
| 2026-08-16 | 10 | Added ready-gated navigation from Android share intents to Capture. |
| 2026-08-16 | 11 | Added notification initialization, launch reconciliation, and ready-gated response routing. |
| 2026-08-16 | 12 | Added shared status tokens, widget URI routing, foreground refresh registration, and the Settings pin CTA. |
