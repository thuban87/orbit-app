# App Shell

**Last updated:** 2026-09-02
**Updated by phase:** 28-dashboard-card-view
**Owners:** `App.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/tabs/`, `src/navigation/types.ts`, `src/navigation/reset-intents.ts`, `src/navigation/linking.ts`, `src/navigation/notification-gate.tsx`, `src/navigation/widget-linking.ts`, `src/components/UniversalFab.tsx`, `src/components/ShellAppBar.tsx`

## Purpose

The app shell holds Orbit’s ready-gated four-tab navigation tree and reusable navigation chrome. It preserves a stack per top-level section, gives external entry points a safe Dashboard fallback, and exposes capture actions without mounting any local read surface before SQLite migration completes.

## Architecture

### Data Model

The shell owns runtime navigation and consumes the durable theme contract; `app_settings` owns the non-secret theme values themselves.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Bootstrap | `App.tsx`, `src/theme/hydrate-theme-at-boot.ts` | Opens and migrates SQLite, imports legacy theme state once, hydrates the theme store, then mounts the navigator; renders accurate classified or generic startup failure copy when opening fails. |
| Navigator | `src/navigation/RootNavigator.tsx` | Mounts the fixed Dashboard, Orrery, Backup, and Settings tabs with a native stack for each. |
| Route types | `src/navigation/types.ts` | Defines serializable tab and per-stack route parameters. |
| Reset intents | `src/navigation/reset-intents.ts` | Sole owner of typed nested Dashboard-root reset states for external and completion paths. |
| Transient/back state | `src/stores/shell-transient-store.ts`, `src/navigation/back-intent.ts` | Registers executable overlay dismissal callbacks and resolves transient-first Back behavior. |
| Shell chrome | `src/components/ShellAppBar.tsx`, `src/navigation/use-bottom-clearance.ts` | Provides themed root/child app bars, measured compact trailing content, and shared tab/FAB clearance. |
| Capture | `src/components/UniversalFab.tsx`, `src/services/quick-log-command.ts`, `src/components/ContactPicker.tsx`, `src/components/Snackbar.tsx` | Provides the universal action dial, shared Quick Log command, local contact selection, and commit-truthful feedback. |
| Intent gate | `src/navigation/linking.ts` | Converts provider-owned pending share state into ready-gated navigation to Capture. |
| Backup-share gate | `src/navigation/backup-share-intent.ts` | Holds a narrow inbound backup-file intent until the backup restore surface is ready. |
| Notification gate | `src/navigation/notification-gate.tsx` | Converts warm and cold local-notification responses into ready-gated actions or navigation. |
| Widget gate | `src/navigation/widget-linking.ts` | Converts narrowly accepted widget `orbit://` links into ready-gated Dashboard-rooted resets. |
| Settings surface | `src/screens/SettingsScreen.tsx` | Hosts low-traffic lifecycle routes, live Appearance controls, self-photo, sun controls, and non-secret AI configuration. |
| Theme contract | `src/theme/` | Defines four semantic palettes, curated accents, typography and motion tokens, local background/surface primitives, and their sole palette values. |
| Interaction primitives | `src/components/icons/`, `src/components/ui/` | Provides semantic icons, non-colour status glyphs, scalable text, and shared action/overlay contracts. |

### Key Files

| File | Role |
|---|---|
| `App.tsx` | Readiness gate, theme hydration before first main paint, startup-failure presentation, navigation mount point, gesture root, and photo/notification lifecycle registration. |
| `src/navigation/RootNavigator.tsx` | Four-tab root, semantic registry tab icons, fade transition, focused-route and keyboard visibility, transient-first retap, and system-Back boundary. |
| `src/navigation/tabs/` | Owns the native-stack registrations for each persistent tab. |
| `src/navigation/types.ts` | Typed tab and stack contracts, including semantic placeholder routes. |
| `src/screens/ThingsToRememberScreen.tsx` | Contact-knowledge surface reached from either contact-profile stack. |
| `src/screens/RecentlyDeletedScreen.tsx` | Typed Memory recovery and confirmed permanent-delete destination. |
| `src/screens/MemoryHistoryScreen.tsx` | Typed retained-current-state history destination. |
| `src/navigation/reset-intents.ts` | Builds the only root-level Dashboard reset states. |
| `src/components/UniversalFab.tsx` | Mounts the six-action shell capture dial once above browse/read surfaces. |
| `src/services/quick-log-command.ts` | Shares commit-truthful Quick Log behavior between the universal FAB and Dashboard List gestures. |
| `src/components/ShellAppBar.tsx` | Supplies accessible themed root and child app bars, including measured icon-only fallback for constrained root destinations. |
| `src/navigation/linking.ts` | Holds the navigation ref and the single ready-gated Capture navigation owner. |
| `src/navigation/backup-share-intent.ts` | Handles the narrow Files-to-Orbit backup-share fallback without placing a file URI in route state. |
| `src/navigation/notification-gate.tsx` | Owns warm/cold notification-response handling once navigation is ready. |
| `src/navigation/widget-linking.ts` | Owns the separate, strict widget URI bridge without consuming native share state. |
| `src/screens/CaptureScreen.tsx` | Provides the in-app target for a pending Android text share. |
| `src/screens/HomeScreen.tsx` | Provides the dashboard Home and its destination entries. |
| `src/screens/DigestScreen.tsx` | Provides the live weekly retrospective destination with its own themed Back chrome. |
| `src/screens/SettingsScreen.tsx` | Provides the distinct settings home, including live Theme/Mode/Accent controls, AI configuration, self-photo, self-star, and sun-centre entries. |
| `src/screens/LegacyContactPickerScreen.tsx` | Provides the typed API-36-and-below custom contact-picker route and permission-recovery views. |
| `src/services/import/start-contact-import.ts` | Selects one SDK-routed import acquisition path for dashboard and Settings entry points. |
| `src/screens/ImportReviewScreen.tsx` | Provides the typed selected-contact review route and explicit duplicate choices. |
| `src/screens/ReconcileGridScreen.tsx` | Provides the Settings-launched linked-contact review workspace. |
| `src/screens/ReconcileDetailScreen.tsx` | Provides per-contact reconciliation and missing-source actions. |
| `src/screens/SurvivorSelectScreen.tsx` | Provides the explicit duplicate-contact merge entry. |
| `src/theme/theme-types.ts` | Names palette tokens, including avatar swatches, rogue status, gravity tiers, and Orrery star/muted values. |
| `src/theme/theme-presets.ts` | Holds the only allowed color literals, including avatar, relationship-status, and Orrery palette values. |
| `src/theme/hydrate-theme-at-boot.ts` | Safely imports legacy theme state and returns the SQLite-backed boot selection. |
| `src/components/icons/icon-registry.ts` | Maps semantic icon names and variants to the replaceable base icon family. |
| `src/components/ui/` | Hosts AppText, Button, and standardized overlay primitives for consuming screens. |

## How It Works

### Starting the application

1. `App.tsx` opens and migrates the local database, then hydrates the theme store from `app_settings` before it renders a navigable screen.
2. The one-time legacy `orbit-theme` import compares values before writing and clears its AsyncStorage key only after a successful write; a failed import remains non-fatal.
3. Once ready, the app mounts `NavigationContainer` inside the existing theme and safe-area providers with the saved Galaxy/Standard package and resolved appearance already selected.
4. A classified migration-006 integrity failure renders its specific safe-unchanged explanation; another bootstrap failure uses the generic safe-unchanged state without promising a support channel. Neither failure mounts navigation.
5. `RootNavigator` supplies the tab navigator only after that gate resolves; platform Back falls through to the focused tab stack unless a shell transient is open.

### Moving through the shell

1. The fixed root tabs are Dashboard, Orrery, Backup / Restore, and Settings. Each renders a separate native stack, so switching tabs preserves its in-tab history.
2. A retap on the active tab dismisses the top shell transient first; a subsequent retap pops that tab to its root. Focused workflows and an open software keyboard hide the tab bar and universal FAB.
3. `ShellAppBar` and Android Back resolve a shell transient before ordinary stack navigation. Dashboard control panels register a dismiss callback as that transient; completed edits replace or focus their destination so Back never replays a finished workflow.
4. `reset-intents.ts` expresses notification, widget, Compose, import, reconcile, merge, and other external fallbacks as nested Dashboard-tab states. An in-app Profile Back instead remains origin-aware through its owning stack.

### Capturing from any browse surface

1. `App.tsx` mounts one `UniversalFab` and snackbar host outside the tab tree. The FAB is visible only on browse/read routes and uses measured tab-bar geometry for its bottom offset.
2. The fixed labeled speed dial is Add Contact, Quick Log, Log Contact, Group Log, Update Contact, and Memory. Profile context preselects a contact; global contact-specific actions open the reusable local picker, while Group Log routes directly. Dashboard List can reuse the same Quick Log command after its configured gesture commits.
3. Quick Log waits for the canonical SQLite write to resolve before it shows success and an Undo action. Its picker, dial, List host, and snackbar register real dismissal callbacks with the transient store.

### Navigating dashboard and settings

1. Dashboard presents co-equal Your Week and Group Events header destinations. `ShellAppBar` measures the available bar and active text scale; both labels render only when both fit, otherwise both remain accessible icon-only controls.
2. Dashboard’s fixed overflow is Group Events, Unbound Contacts, Archived Contacts, Select Contacts, and Reset Dashboard View. Select Contacts persists Card View before entering its in-memory frozen selection session; Reset persists its query reset before clearing session state.
3. Archived remains the same destructive surface reached from Dashboard and Settings, while Unbound is a Dashboard child route. Both use shared child chrome, and their stack origin determines Back behavior after opening a Profile.
4. Settings exposes low-traffic lifecycle and configuration controls in its own remembered tab stack. Its Appearance section changes package, mode, and curated accent live, then persists the active package's values through the validated settings DAO.
5. Root tabs use branded/destination app bars without Back; child routes use a title and Back control. Native stack headers remain disabled so no duplicate chrome appears.

### Handing off detailed Dashboard logging

1. Card View routes one selected contact to the existing `LogContact` route. Two or more targets navigate to `GroupLog` with an optional serializable `participantIds` array.
2. `navigation/types.ts` defines the handoff only. The Group Interaction Logging phase consumes those IDs when it replaces the placeholder workflow; no contact data or callback crosses the route boundary.

### Opening Backup & Restore

1. Backup / Restore is a top-level tab with its own root and remembered child stack.
2. `Backup` owns manual export, file selection, and health actions. Its child settings, preview, and result routes retain only serializable aggregate or opaque-token parameters.
3. `App.tsx` registers backup and restore-photo recovery hooks after migration readiness, before the foreground launch-sweep trigger runs.

### Composing from a contact

1. A profile opens `Compose` with the serializable `{ contactId }` route parameter, or `{ contactId, requestAiSuggestion: true }` for an AI draft; the screen fetches its own current data rather than receiving callbacks or preloaded state.
2. Compose uses the typed nested Dashboard reset for its external-entry fallback, so the destination is stable without treating Home as a root-stack sibling.
3. The AI intent is a primitive consumed once by Compose and then cleared with `setParams`; it cannot retain a prompt, contact snapshot, key, or callback across navigation.

### Opening the weekly digest

1. The dashboard's “Your week” action navigates to the param-less `Digest` route; the screen rereads its local data on focus.
2. A digest notification body tap resets the stack to Home then Digest, so Back always lands on the dashboard regardless of the warm stack.
3. `App.tsx` registers the digest schedule hook after database readiness, alongside other ready-gated notification initialization.

### Configuring AI settings

1. Settings hosts the token-only AI configuration controls, including provider/model selection, Custom endpoint validation, masked key entry, model-catalog scope, and explicit refresh.
2. The screen persists ordinary settings through the typed SQLite DAO and routes credentials directly to SecureStore; no navigation state or settings patch carries a key.

### Receiving an Android share

1. `ShareIntentProvider` consumes a pending native share while database migrations run.
2. Once `NavigationContainer.onReady` sets the reactive readiness flag, `ShareIntentGate` navigates the pending share to Capture.
3. The gate remains inside the successful migration-ready branch, so Capture cannot query a half-built local database; no deep-link consumer competes for the same native share payload.

### Starting and opening notifications

1. The ready-gated application effect registers notification reconciliation, awaits channel and action-category initialization, then installs the launch-sweep trigger.
2. `App.tsx` imports the headless-task module at bundle scope and sets an explicit silent foreground notification behavior.
3. `NotificationResponseGate` shares the navigator readiness flag with `ShareIntentGate`, queues an early body tap, and applies it only after the navigation ref is ready.

### Bootstrapping normalized-method migration

1. `App.tsx` resolves the device region before its first `openAndMigrate()` call and passes it through migration dependencies.
2. Notification and widget headless first-open paths use the same platform-only region provider, so a killed-app action cannot consume the irreversible v9 migration with an invented region.
3. A missing device region fails closed for national-format migration parsing; later user edits may use the validated persisted override.

### Opening and refreshing the widget

1. `App.tsx` mounts `WidgetLinkingGate` with the same reactive readiness flag used by the share and notification gates.
2. The gate handles only strictly parsed `orbit://` widget links, so it cannot race the share-intent singleton; every accepted link resets to Dashboard plus its destination.
3. The ready-gated application effect registers the widget launch-sweep hook once. Foreground mutation publishers re-render placed widgets without blocking the user write.
4. Settings offers the in-app Add Orbit widget request and displays fallback instructions when the launcher declines it.

### Surfacing the interaction-assist banner

1. `App.tsx` mounts `<AssistBanner />` after the root navigator so it is app-global while Orbit is foregrounded, refreshes the eligible-assist queue on a real background→active return, and registers the interaction-assist launch-sweep hook alongside the other ready-gated foreground hooks.
2. The banner is a plain `position:absolute` overlay with `pointerEvents="box-none"` — not a `Modal` — so the Android Back button navigates the underlying stack normally and passes through the banner; the banner is durable state that persists until resolved, dismissed, or expired.
3. Settings hosts the default-on **Interaction Assist** toggle; disabling it expires every pending assist and refreshes the banner in the same action.
4. The widget `Contact` deep-link (`orbit://reach/<id>`) resolves through `WidgetLinkingGate` to Profile with a consumed-once `openReachOut` param (`src/navigation/types.ts`); the Profile opens the shared Reach Out router once and clears the param.

### Applying destructive emphasis

1. Screens obtain colors through `useTheme().colors`.
2. The Archived contacts purge action uses `colors.danger`; native confirmation alerts use the platform destructive style.
3. No screen contains a raw hex color because palette literals belong only in `theme-presets.ts`.

### Applying the visual system

1. `ThemeProvider` resolves the active package and system/light/dark appearance to one of four palettes, then overlays its curated accent tone triple.
2. Screens use semantic registry names and shared UI primitives rather than base-family icon names or ad-hoc action/overlay implementations.
3. `AppText` preserves OS text scaling. Destructive controls combine the danger treatment, warning glyph, and an explicit confirmation rather than relying on colour alone.

### Applying relationship-state emphasis

1. The profile reads every presentation colour through `useTheme().colors`.
2. A rogue explanation uses the dedicated `colors.rogue` token; it is not a destructive-action danger state.
3. Gravity uses the ordered `colors.gravityTiers` ramp, whose length matches the four named gravity tiers.
4. Stable, wobble, and decay use dedicated shared status tokens beside `rogue`; dashboard cards and headless widget bitmaps consume the same palette vocabulary.
5. The Orrery adds ordered `starPalette`, muted status endpoints, and a cold `rogueExtinguished` token; all Skia colours still resolve from this contract.

### Editing a photo

1. A contact, self, or custom-field source picker navigates to `CropPhoto` with a serializable target descriptor and optional request id.
2. The crop screen uses the existing custom-header convention and returns through native stack Back behavior after persistence.
3. Settings reloads the self record on focus; the contact edit surface reloads only photo state so unsaved form values survive the round trip.

### Starting contact import

1. Home's speed dial and Settings' Contacts Integration row call the same `startContactImport()` seam. It opens the permissionless system picker on API 37+ and the typed `LegacyContactPicker` route on API 36 and below.
2. The legacy route primes and requests the scoped read permission at the value moment, offers a calm re-request state after denial, and opens app settings after permanent denial; it uses theme tokens but remains a standalone utility list.
3. `RootNavigator` registers legacy acquisition alongside import review, setup, progress, duplicate-review, and completion routes; every downstream screen reads durable session state rather than a source URI.
4. A foreground prompt routes interrupted work to its local continuation or explicitly discards unresolved rows.

### Reconciling and merging contacts

1. Profile overflow offers `Update from Contacts` for an actively linked person and `Merge with another contact`; Settings offers `Check linked contacts` and flagged-item review.
2. The navigator registers typed reconciliation grid, detail, completion, survivor selection, and merge-conflict routes. Screens fetch durable session or contact data instead of receiving source payloads in route state.
3. `App.tsx` registers the foreground reconciliation resume sweep after database readiness. If import and reconciliation work are both resumable, the import prompt takes precedence so app-root sheets do not overlap.

### Opening contact knowledge

1. A contact profile in either the Dashboard or Orrery stack opens `ThingsToRemember` with a serializable contact ID.
2. Both stacks also register typed `RecentlyDeleted` and `MemoryHistory` destinations, preserving native Back behavior for their origin.
3. Each destination self-fetches its local SQLite projection; route parameters carry no Memory content or callbacks.

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `headerShown` | `false` | `src/navigation/tabs/` | Leaves screen-owned themed chrome visible inside each tab stack. |
| `animation` | `fade` | `src/navigation/RootNavigator.tsx` | Gives tab switching a short crossfade without horizontal tab motion. |
| `FAB_SIZE` / `FAB_EDGE_GAP` | `56` / `16` | `src/navigation/use-bottom-clearance.ts` | Keeps FAB placement and content clearance single-sourced. |
| `danger` | `#E5484D` | `src/theme/theme-presets.ts` | Owner-approved destructive and validation emphasis token. |
| `rogue` | `#E0904A` | `src/theme/theme-presets.ts` | In-app relationship-status emphasis token. |
| `statusStable` / `statusWobble` / `statusDecay` | `#45B98A` / `#E8C15C` / `#E56A52` | `src/theme/theme-presets.ts` | Shared status-ring palette for dashboard and widget surfaces. |
| `gravityTiers` | 4 ordered tokens | `src/theme/theme-presets.ts` | Named gravity-bar ramp from thin through deep. |
| `starPalette` | 6 ordered tokens | `src/theme/theme-presets.ts` | Self-sun choices; index 0 is the render-time default. |
| Theme packages | Galaxy / Standard | `src/theme/theme-types.ts` | Independent of light/dark/follow-system appearance mode. |
| `AA_NORMAL` / `AA_LARGE` | `4.5` / `3.0` | `src/theme/contrast.ts` | Contrast thresholds for text and large/status elements. |

## Decisions

- **ADR-006:** Theme-Token Architecture — all UI colors resolve through the theme contract.
- **ADR-001:** Normalized Custom-Field Values — keeps the navigator behind the migration gate and distinguishes its classified integrity failure from generic startup failure.
- **ADR-015:** Lossless Field Changes with Quarantine and Launch-Time Retention Sweep — keeps launch-time cleanup inside the ready-gated application shell.
- **ADR-018:** Archive-Gated Contact Purge with Explicit Fan-Out — destructive controls use the dedicated danger token.
- **ADR-019:** Native Stack Contact Lifecycle Navigation — replaces temporary Home-local routing with native-stack navigation.
- **ADR-080:** Four-Tab Bottom Navigation Shell with Per-Tab Stacks — supersedes the flat root shell while retaining the migration gate and Dashboard fallback.
- **ADR-082:** Universal Capture FAB, Canonical Picker, and Truthful Quick Log — fixes shell capture actions, local target selection, and commit-only feedback.
- **ADR-083:** Durable Multi-Package Theme Configuration and Restore-Before-Paint — moves theme selection to SQLite and gates first main paint on its hydration.
- **ADR-084:** Four Semantic Theme Palettes, Curated Accents, and Contrast Validation — supplies the four-palette and live-accent contract.
- **ADR-086:** Semantic Icons and Accessible Interaction Primitives — supplies registry, typography, status, action, and overlay seams.
- **ADR-087:** Bundled Background Presets and Package-Specific Surface Treatment — supplies tokenized local background and surface primitives for later screen adoption.
- **ADR-101:** Avatar-First Accessible Dashboard Card Renderer — consumes the semantic icon and accessible interaction primitives in Card View.
- **ADR-102:** Frozen-Universe Dashboard Multi-Select — adds the Select Contacts entry and serializable Group Log participant handoff.
- **ADR-020:** Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download — adds the modal crop route and self-photo entry.
- **ADR-022:** Tokenized Deterministic Initials Avatars — adds avatar fallback tokens to the theme contract.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — adds a dedicated in-app rogue emphasis token.
- **ADR-027:** Derived Profile-Only Gravity and Intensity — adds the gravity-tier ramp used by the profile bar.
- **ADR-031:** Bound Local Fuel Search without FTS5 — adds the reusable Phase-7 FuelSearch route and Settings entry.
- **ADR-032:** Flat Dashboard Discovery and In-Query Contact Search — moves search into Home and adds the dashboard's sibling list route.
- **ADR-033:** Profile Marking and Shared Drag-Reordered Favourites — superseded by ADR-075 for the removed Manage favourites route and user-facing order.
- **ADR-034:** Birthday Banner and Re-query Dashboard Freshness — superseded by ADR-076 for the removed banner; reliable refresh paths remain.
- **ADR-036:** Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails — adds the serializable Compose route and Home-reset Back behavior.
- **ADR-037:** Text-Only Android Share Intent Integration — adds the provider-owned, ready-gated Capture route for native text shares.
- **ADR-038:** Contact-Owned Share Capture Fuel — keeps the share-capture route on a selected contact rather than creating a standalone inbox.
- **ADR-039:** Pre-Scheduled Inexact Decay Reminders — registers ready-gated launch/foreground notification reconciliation.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — adds the response gate and deterministic notification destinations.
- **ADR-041:** Notification Settings, Privacy Channels, and Birthday Alerts — requires channels and categories before the first scheduler run.
- **ADR-042:** Shared Status Palette for Dashboard and Widget Rings — extends the token contract with the shared relationship-status colours.
- **ADR-043:** Static Globally Mirrored Favourites Widget — registers the state-free provider and its Settings entry.
- **ADR-044:** Headless Widget Actions and Dashboard-Rooted Deep Links — adds a single-owner, ready-gated widget URI bridge.
- **ADR-045:** Event-Driven Widget Refresh and Boot Recovery — registers foreground refresh without polling.
- **ADR-047:** App-Level Assignable Sun and Themed Self Identity — adds the Settings-owned sun and self-star controls.
- **ADR-048:** Status-Default Static Orrery with a Single-Canvas Morph — adds the typed Orrery route and token-driven canvas lifecycle.
- **ADR-049:** BYO-Key AI Configuration and Credential Boundary — hosts non-secret AI settings while retaining credentials outside navigation and SQLite settings patches.
- **ADR-052:** Compose-Owned AI Draft Lifecycle and Acknowledged Egress — adds the serializable, consume-once Compose AI request intent.
- **ADR-053:** Local-First LiteLLM AI Model Catalog — adds Settings model-scope and explicit-refresh controls.
- **ADR-054:** Live Weekly Digest Retrospective and Overlooked Relationship Read — adds the self-fetching Digest route and dashboard entry.
- **ADR-055:** Dedicated Weekly Digest Scheduling and Persisted Notification Policy — adds the dashboard-rooted Digest notification reset and ready-gated schedule hook.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — adds the Backup destination and ready-gated foreground automatic work.
- **ADR-058:** Optional Encrypted Backups and Previewed Local Restoration — keeps restore content and passphrases out of navigation state.
- **ADR-059:** Normalized Contact Methods, Canonical Actionability, and Local Provenance — supplies the device-region bootstrap for the one-time method migration.
- **ADR-060:** Versioned Portable Method Graph and Collision-Normalized Restoration — adds the narrow ready-gated backup-share fallback.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — adds the dedicated Unbound route and lifecycle-oriented settings surfaces.
- **ADR-064:** Permissionless Android 17 System-Contact Snapshot Acquisition — adds the optional selected-contact entry without broad contacts permission.
- **ADR-066:** Deliberate Reviewed Import with Unbound Bulk Defaults — registers reviewed import routes and the completion destination.
- **ADR-002:** Cross-Version Contact Import — Hybrid Two-Picker — adds the legacy acquisition route and one SDK-routed entry seam.
- **ADR-003:** `READ_CONTACTS` on API 37+ for Reconcile — requests Contacts access only in the reconciliation flow that needs a current linked-source read.
- **ADR-068:** User-Triggered, Source-Only Reconciliation with Durable Review — adds durable reconciliation routes and foreground resume handling.
- **ADR-069:** Atomic Tombstone-Backed Orbit Contact Merge — adds explicit survivor, conflict, and impact-confirmation navigation.
- **ADR-070:** Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out — mounts the app-global non-modal assist banner, the Settings toggle, and the ready-gated assist launch-sweep hook.
- **ADR-074:** Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe — adds the `orbit://reach/<id>` widget bridge and the consumed-once `openReachOut` Profile param with a stale-target Dashboard fail-safe.
- **ADR-088:** Additive Contact-Knowledge Schema and Application-Owned Memory Registry — adds typed contact-knowledge routes in both profile-owning stacks.
- **ADR-089:** Recoverable Memory Lifecycle and Contact-Operation Integrity — exposes the guarded Recently Deleted recovery destination.
- **ADR-075:** Binary Favourite Membership Without a User-Facing Order — retires the shell's Manage favourites route and Settings entry.
- **ADR-076:** Population-Reached Birthdays Without a Dashboard Banner — removes the Dashboard banner without changing local refresh ownership.
- **ADR-093:** Scoped Composable Dashboard Population and Filter Model — retires the Never Contacted route and leaves its next visible control to Dashboard work.
- **ADR-095:** Live-Applying Dashboard Floating Control Surface — registers Dashboard controls as a transient-first in-tree surface rather than a native modal.
- **ADR-096:** Dashboard Header and Overflow Discovery Paths — defines measured header fallback, fixed overflow entries, and shared management-route chrome.
- **ADR-098:** Scan-First, Accessible Dashboard List Rows — reuses typed Dashboard Profile/Edit destinations and accessible action primitives.
- **ADR-099:** Durable Global Dashboard Right-Swipe Action — reuses the shell's commit-truthful Quick Log and typed Log Contact route from the global Dashboard preference.

## Gotchas

1. **Do not mount a read screen before migration readiness.** The navigator belongs only in the successful ready branch.
2. **Keep all root-level Dashboard resets in `reset-intents.ts`.** A bare flat route fails under the tab tree and can strand a deep-link user without the required fallback.
3. **A transient id alone cannot dismiss a UI surface.** Register its executable close callback with `shell-transient-store`; otherwise Back and active-tab retap clear bookkeeping but leave the modal open.
4. **Do not put the FAB on a focused workflow or below a guessed inset.** The shell uses route classification, keyboard state, and measured tab-bar geometry.
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
12. **Do not put Orrery sun assignment on the canvas.** Settings owns the Sun / centre picker; canvas long-press conflicts with the radial reorder gesture.
13. **Keep the AI Compose intent serializable and minimal.** It carries only `contactId` and a boolean request marker; prompts, credentials, and callbacks must not enter route parameters.
14. **Reset digest notification taps instead of navigating onto a warm stack.** The Home/Digest reset is what makes the Digest screen's Back destination stable.
15. **Do not mount navigation after a bootstrap failure.** A classified migration failure has rolled back unchanged; generic failure copy must not promise unavailable support or recovery.
16. **Restore route parameters must be content-free.** Pass only an opaque in-memory cache token and aggregate preview; never put a file URI, manifest, callback, or passphrase in navigation state.
17. **Every possible first opener needs the migration region.** `openAndMigrate()` can run before React mounts from headless notification or widget work; database bootstrap itself stays free of native localization imports for node-testability.
18. **Keep Unbound navigation retrieval-oriented.** The dedicated browse list may open Profile, but active-orbit controls stay in their Bound query owners; the temporary typed-lookup gap is owned by Phase 26.
19. **Import routes carry durable identifiers, never picker grants.** A selected-contact URI is temporary provider state and must not enter navigation parameters.
20. **Keep contact-import routing single-sourced.** Dashboard and Settings must call the shared SDK-routing seam; duplicating the Android-version branch can make their permission behavior drift.
21. **Do not overlap root recovery prompts.** Import resume takes precedence over reconciliation resume; a pending check must be resumed or discarded before starting another.
22. **The assist banner must stay a non-modal overlay.** It is durable state, not a Back-dismissible transient layer, so it is a `position:absolute` `box-none` overlay and never a `Modal`; making it modal would consume Android Back and break the pass-through contract.
23. **The `orbit://reach` bridge stays with the other widget links.** It is parsed by the strict widget URI gate (anchored digits-only), not added to React Navigation linking config, so it cannot race the share-intent singleton.
24. **Do not hydrate theme after navigation mounts.** A first main frame in the wrong saved palette is a visual regression; only the neutral pre-ready splash may precede theme hydration.
25. **Do not bypass semantic visual seams.** New screens use token roles, semantic icon names, scalable text, and shared action/overlay primitives; they do not add raw colour or base-family icon imports.
26. **Keep contact-knowledge routes typed in both profile stacks.** Dashboard and Orrery Profile must expose the same serializable destinations; do not move Memory content into route parameters.
27. **Root header labels must fail closed to icon-only.** Do not wrap, shrink, or independently hide a co-equal Dashboard destination when measured text no longer fits.
28. **A disabled overflow entry must not close its menu.** Select Contacts is a visible future capability, not a no-op route or a hidden item.
29. **Keep Archived registered in both owning stacks.** It is one screen with two deliberate entry paths; replacing either route with a duplicate breaks origin-aware Back behavior.
30. **Keep Quick Log command-owned.** The Dashboard List may invoke it, but must not duplicate FAB feedback, Undo, Retry, haptic, or refresh behavior in a second shell path.

## Related Systems

- **Contacts** — supplies the create, profile, edit, and archived routes.
- **Custom fields** — is reached through Settings rather than Home-local route state.
- **Dashboard** — is the Home route and owns daily discovery/search navigation.
- **Contact methods** — registers the self-fetching Compose surface in the stack.
- **Capture** — enters through the provider-owned Capture route after migrations are ready.
- **Notifications** — initializes at readiness and uses the response gate for body/action delivery.
- **Widget** — adds its URI gate, launch refresh registration, and Settings CTA to the ready shell.
- **Orrery** — registers its dashboard-reached route and receives its self-star and sun-centre controls from Settings.
- **AI suggestions** — uses Settings for non-secret configuration and the typed Compose intent for profile-originated drafting.
- **Digest** — registers a self-fetching route, dashboard entry, ready-gated scheduler, and notification reset destination.
- **Backup & Restore** — registers typed landing, settings, preview, and result routes plus ready-gated recovery work.
- **Contact Import** — registers the import route family, Settings entry, and foreground recovery prompt.
- **Contact Reconciliation** — registers linked-contact review, merge, bulk-review, and foreground-resume surfaces.
- **Interaction Assist & Reach Out** — mounts the app-global assist banner, the Settings toggle, the assist launch-sweep, and the `orbit://reach` widget bridge with its consumed-once Profile param.
- **Persistence core** — owns migration 015 and the validated durable settings selection consumed before navigation mounts.
- **Orrery** — consumes the theme tokens and shared motion/accessibility contract while retaining its specialized canvas treatment.
- **Contact Knowledge** — supplies profile-reached Things to Remember, Recently Deleted, and retained-history screens in both contact stacks.

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
| 2026-08-17 | 13 | Added the Orrery route, Settings-owned sun controls, and themed star/muted visual tokens. |
| 2026-08-18 | 14 | Added non-secret AI settings and a serializable, consume-once Compose AI intent. |
| 2026-08-23 | 15 | Added the typed Digest route, dashboard entry, dashboard-rooted notification reset, and ready-gated schedule registration. |
| 2026-08-24 | 16 | Added accurate classified migration and generic bootstrap failure presentation while retaining the readiness gate. |
| 2026-08-24 | 17 | Added Backup routes, content-free restore navigation, and ready-gated backup/photo recovery hooks. |
| 2026-08-27 | 18.1 | Added device-region migration bootstrap and the ready-gated backup-share fallback. |
| 2026-08-27 | 18.2 | Added the Unbound route and lifecycle settings/navigation treatment. |
| 2026-08-26 | 19 | Added typed selected-contact import routes, Settings entry, and durable-resume navigation. |
| 2026-08-29 | 19.1 | Added the API-36-and-below legacy picker route and shared hybrid-import dispatch. |
| 2026-08-26 | 20 | Added typed reconciliation and merge routes, Settings entries, and foreground resume precedence. |
| 2026-08-31 | 21 | Mounted the app-global non-modal Interaction Assist banner (Back passes through) with its launch-sweep and Settings toggle, and added the `orbit://reach` widget bridge and consumed-once `openReachOut` Profile param. |
| 2026-09-02 | 22 | Replaced the flat root stack with four tab-owned stacks, nested external resets, shared chrome, and universal capture primitives. |
| 2026-09-02 | 23 | Added restore-before-paint durable theming, live Appearance controls, semantic tab icons, and shared visual primitives. |
| 2026-09-03 | 24.1 | Added typed contact-knowledge, Recently Deleted, and retained-history routes to both profile stacks. |
| 2026-09-02 | 25 | Retired Manage favourites and Never Contacted navigation surfaces plus the Settings include-Unbound control. |
| 2026-09-02 | 26 | Added measured Dashboard header fallback, fixed overflow behavior, transient-aware controls, and shared child chrome for Archived and Unbound routes. |
| 2026-09-02 | 27 | Shared the Quick Log command and existing Dashboard Profile/Edit routing with accessible List gesture actions. |
| 2026-09-02 | 28 | Enabled Select Contacts, added selection-first Back behavior, and defined the serializable Group Log participant handoff. |
