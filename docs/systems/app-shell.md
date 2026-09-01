# App Shell

**Last updated:** 2026-08-15
**Updated by phase:** 05-photos
**Owners:** `App.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts`, `src/screens/SettingsScreen.tsx`, `src/theme/theme-types.ts`, `src/theme/theme-presets.ts`

## Purpose

The app shell holds Orbit’s ready-gated native navigation tree and the shared visual tokens its screens consume. It gives multi-screen flows typed stack navigation and platform Back behavior without mounting a read surface before local SQLite migration completes.

## Architecture

### Data Model

_None._ The shell owns runtime navigation and theme contracts, not durable application data.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Bootstrap | `App.tsx` | Opens and migrates SQLite before mounting the navigator inside theme and safe-area providers. |
| Navigator | `src/navigation/RootNavigator.tsx` | Registers native-stack routes, including the modal crop surface, with custom headers. |
| Route types | `src/navigation/types.ts` | Defines serializable parameters for profile, edit, and crop routes. |
| Settings surface | `src/screens/SettingsScreen.tsx` | Hosts low-traffic lifecycle routes and the self-photo surface. |
| Theme contract | `src/theme/theme-types.ts`, `src/theme/theme-presets.ts` | Defines named tokens, including destructive and avatar-swatch tokens, and their sole palette values. |

### Key Files

| File | Role |
|---|---|
| `App.tsx` | Readiness gate, navigation mount point, gesture root, and photo reconciliation registration. |
| `src/navigation/RootNavigator.tsx` | Native stack for Home, Settings, Custom Fields, Create, Profile, Edit, Archived, and CropPhoto. |
| `src/navigation/types.ts` | Typed root-stack route contract, including serializable photo crop targets. |
| `src/screens/HomeScreen.tsx` | Navigates users into creation and Settings. |
| `src/screens/SettingsScreen.tsx` | Provides the distinct settings home, including the self-photo entry. |
| `src/theme/theme-types.ts` | Names palette tokens, including avatar swatches and foreground text. |
| `src/theme/theme-presets.ts` | Holds the only allowed color literals, including avatar swatches. |

## How It Works

### Starting the application

1. `App.tsx` opens and migrates the local database before it renders a navigable screen.
2. Once ready, the app mounts `NavigationContainer` inside the existing theme and safe-area providers.
3. `RootNavigator` supplies the native stack; platform Back walks this stack rather than a Home-screen-local state toggle.

### Navigating lifecycle settings

1. Home navigates to Settings or the create-contact route.
2. Settings exposes Custom Fields and Archived contacts as separate, low-traffic rows.
3. Every stack screen renders its own themed chrome because native-stack headers are disabled; no duplicate native header appears above screen-local Back controls.

### Applying destructive emphasis

1. Screens obtain colors through `useTheme().colors`.
2. The Archived contacts purge action uses `colors.danger`; native confirmation alerts use the platform destructive style.
3. No screen contains a raw hex color because palette literals belong only in `theme-presets.ts`.

### Editing a photo

1. A contact, self, or custom-field source picker navigates to `CropPhoto` with a serializable target descriptor and optional request id.
2. The crop screen uses the existing custom-header convention and returns through native stack Back behavior after persistence.
3. Settings reloads the self record on focus; the contact edit surface reloads only photo state so unsaved form values survive the round trip.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `headerShown` | `false` | `src/navigation/RootNavigator.tsx` | Leaves each screen responsible for its own header chrome. |
| `danger` | `#E5484D` | `src/theme/theme-presets.ts` | Owner-approved destructive and validation emphasis token. |

## Decisions

- **ADR-006:** Theme-Token Architecture — all UI colors resolve through the theme contract.
- **ADR-018:** Archive-Gated Contact Purge with Explicit Fan-Out — destructive controls use the dedicated danger token.
- **ADR-019:** Native Stack Contact Lifecycle Navigation — replaces temporary Home-local routing with native-stack navigation.
- **ADR-020:** Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download — adds the modal crop route and self-photo entry.
- **ADR-022:** Tokenized Deterministic Initials Avatars — adds avatar fallback tokens to the theme contract.

## Gotchas

1. **Do not mount a read screen before migration readiness.** The navigator belongs only in the successful ready branch.
2. **Do not enable native stack headers without removing screen-local chrome.** The Phase-4 screens already render their own Back/title pattern.
3. **Navigation additions require an application rebuild.** Native-stack dependencies do not arrive through a JavaScript-only reload.
4. **Use tokens, never raw color literals.** The color gate enforces this outside the theme preset boundary.
5. **Crop navigation parameters must stay serializable.** The crop result uses a request id where a custom field needs a return signal; do not pass callbacks through navigation.

## Related Systems

- **Contacts** — supplies the create, profile, edit, and archived routes.
- **Custom fields** — is reached through Settings rather than Home-local route state.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-14 | 04 | Created ready-gated native-stack navigation, Settings routes, and the destructive theme token. |
| 2026-08-15 | 05 | Added photo crop navigation, self-photo settings, avatar tokens, and launch-time photo reconciliation registration. |
