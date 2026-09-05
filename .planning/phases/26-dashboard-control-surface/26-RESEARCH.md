# Phase 26: Dashboard Control Surface - Research

**Researched:** 2026-09-05
**Domain:** React Native / Expo control-shell UI — anchored floating panels, Android a11y focus management, presentation-seam architecture, and a large in-place refactor of the existing Dashboard screen + management routes.
**Confidence:** HIGH (this is almost entirely an in-repo integration/refactor phase; nearly every fact is verified by reading source on disk this session)

## Summary

Phase 26 is **not** a greenfield build and introduces **no new dependencies, no new theme tokens, and no migration of its own**. It is a control-shell layer over machinery Phase 25 already shipped: `dashboard-query-store` (SQLite-backed via `app_settings`, migration 019), `dashboard-session-store` (ephemeral search/scroll), `dashboard-query-logic` (populations / filter families / sort modes / `resetDashboardView`), and the new `listDashboardPopulation()` read. The core deliverable is one reusable `AnchoredPanel` primitive with three content components (Population / Filters / Sort) wired through Phase 25's store, plus a chrome-only refactor of `HomeScreen`, `ArchivedContactsScreen`, and `UnboundContactsScreen`, and an amended overflow menu.

The single largest piece of hidden work: **`HomeScreen` today still runs on the OLD `dashboard-prefs-store` (AsyncStorage) + old `listDashboard(term)` read + `FilterChipRow` + inline 4-option sort row** `[VERIFIED: src/screens/HomeScreen.tsx:63,101-104,193,360-403]`. Phase 25 built the new store/logic/read but **wired nothing to the Dashboard screen** — the new store has zero screen consumers `[VERIFIED: grep useDashboardQueryStore → only the store + session files]`. Phase 26 owns that migration. This is the highest-risk, highest-value part of the phase, and it exposes a genuine cross-phase seam gap (search read — see Open Questions).

**Primary recommendation:** Build `AnchoredPanel` as an **in-tree, absolutely-positioned overlay registered in `shellTransientStore`** (NOT an RN `Modal`), so (a) the control-row triggers stay live above the scrim for one-tap control-to-control switching, (b) the dashboard list keeps re-rendering visibly behind a light scrim, and (c) Android Back / active-tab dismissal reuse the shell's existing `resolveBackIntent` + `dismissTop` path for free. Animate with Reanimated (never React-state-per-frame, never Skia), honour `useReducedMotion()`, and gate the background inert + a11y-hidden with `pointerEvents` on the scrim + `importantForAccessibility="no-hide-descendants"` on the content wrapper.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Population/Filters/Sort query state + persistence | Data layer (SQLite `app_settings`, Phase 25) | — | `dashboard-query-store` writes through `app-settings-dao`; Phase 26 consumes, never forks (D-11 layer 1) |
| Option-content rendering (what rows exist, selection) | Client UI (Phase 26 new, layer 2) | — | Presentation-agnostic components taking state + callbacks as props |
| Anchored floating container (position/scrim/animation/focus) | Client UI (Phase 26 new, layer 3) | Shell (`shellTransientStore` for Back/dismiss) | The HUD swap point; the only layer a future HUD replaces |
| Search text (ephemeral) | Client session state (`dashboard-session-store`) | — | Outlives screen for Dashboard→Profile→Back; cleared on fresh launch |
| Dashboard list/grid **rendering** | Client UI (Phase 27 List / Phase 28 Card) | — | Phase 26 ships only the `viewMode` toggle + persisted state |
| Contact search **read** | Data layer | — | **GAP** — new read path has no term param (Open Question O-1) |
| Navigation / origin-aware Back | Shell (four-tab per-tab stacks, ADR-080) | — | Archived/Unbound are Dashboard child routes already registered |
| Group Events / Your Week domain | Phase 33 / deferred Your Week | — | Phase 26 owns entry affordances + routing ONLY |

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01…D-11 — settled; research HOW, never reopen)
- **D-01/D-02:** Dossier + planning-notes are ground truth; every REPLAN finding must be reflected; every trip-wire is a stop-and-ask. `[DECIDED]`/`[REJECTED]` reversal = owner decision.
- **D-03:** **No migration of its own.** Retiring `include_unbound_never_contacted` and the AsyncStorage `dashboard-prefs-store` touches `app_settings` / `PORTABLE_SETTINGS_KEYS` → coordinate with the Phase 36 backup-format bump, do NOT drop keys ad hoc. If a migration proves unavoidable, number it head+1 verified against `src/db/migrations/` + `TARGET_VERSION` **on disk** (currently 19) — never assume.
- **D-04:** Your Week **and** Group Events are co-equal first-class header destinations; icon-only fallback (never wrap, never displace the control row); redundant Group Events overflow entry. Entry affordances only.
- **D-05 (ADR-080):** Archived keeps BOTH overflow entry AND Settings row → one screen. Unbound + Archived are Dashboard child routes with origin-aware return.
- **D-06 (ADR-075):** Manage Favorites removed with nothing in its place. No ranked-favourites affordance. No sort by `favourite_rank`.
- **D-07 (ADR-076):** Population panel gains selectable **All Contacts** row; Active Contacts is the implicit unlisted default; deselecting the last explicit population returns to it. No permanent birthday module.
- **D-08 (ADR-062):** Unbound child route needs its own search (the retrieval-path replacement). Removing Unbound retrieval without replacement = STOP-AND-ASK.
- **D-09:** Overflow "Select Contacts" routes to Phase 28 bulk mutations that DON'T EXIST YET — ship it **disabled**; enters Card/Grid multi-select, never a standalone screen; no import.
- **D-10:** Overflow entry named **Select Contacts**; no import capability.
- **D-11:** Population/Filters/Sort as anchored floating panels (NOT modals/bottom sheets), one at a time, live-apply with no Apply/Done; background interaction-inert AND removed from a11y focus while open; presentation swappable for a later HUD.

### Claude's Discretion
- Everything dossier-marked `[DERIVED]`, plus implementation details not touching a `[DECIDED]`/ADR/HANDOFF entry — including exact panel pixel dimensions/offsets and final microanimation timings.

### Deferred Ideas (OUT OF SCOPE)
- Custom Orbit HUD control surface; full-screen combined Manage View; bottom-sheet control variants; a fourth top-row presentation-mode button; Group Events bottom-nav destination; Dashboard-tab radial launcher; permanent Group Events / birthday content module; any greenfield reimplementation of Archived/Unbound logic (refactor + reuse only).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASHC-01 | Lean top hierarchy: header → control row → search+toggle row → collection | `HomeScreen` restructure; existing `listHeader` composition is the seam `[VERIFIED: HomeScreen.tsx:316-405]` |
| DASHC-02 | Your Week + Group Events first-class header destinations (icon+label, icon-only fallback) | `ShellAppBar trailing` slot + semantic icon registry (needs new names); current header already has a Group Events `Pressable` to migrate `[VERIFIED: HomeScreen.tsx:537-551]` |
| DASHC-03 | Three equal controls, `+N` summaries, restrained active treatment | Read state from `dashboard-query-store`; active idiom mirrors `FilterChipRow`/`SegmentedControl` |
| DASHC-04 | Anchored floating panel, live-apply, results update behind | `AnchoredPanel` primitive (see Pattern 1); store setters apply immediately |
| DASHC-05 | Background inert + a11y-hidden; dismiss re-tap/outside/Back; direct switch; one open | `shellTransientStore` + `resolveBackIntent`; `importantForAccessibility` + `pointerEvents` |
| DASHC-06 | All Contacts row; Active implicit default; Filters clear-in-panel; Sort explicit Default | `dashboard-query-logic` populations/filters/sort already model this `[VERIFIED: dashboard-query-logic.ts:5-11,215-224]` |
| DASHC-07 | Collapsible search + right-aligned accessible List/Card toggle on one row | `dashboard-session-store` for text; `SegmentedControl` for the toggle; `setViewMode` |
| DASHC-08 | Overflow: Group Events / Unbound / Archived / Select Contacts (disabled) / Reset; no Manage Favorites | Refactor `overflowActions` array `[VERIFIED: HomeScreen.tsx:107-150]` |
| DASHC-09 | Unbound + Archived child routes, origin-aware return; both Archived entry points → one screen | Routes already registered in DashboardStack + SettingsStack `[VERIFIED: DashboardStack.tsx:62-63; types.ts:153-159]` |
| DASHC-10 | Reset returns to Active/no-filters/Default/cleared-search, preserving List/Card | `resetDashboardView()` (store) + `clearSession()` (session store) `[VERIFIED: dashboard-query-store.ts:93-105; dashboard-session-store.ts:26]` |

## Standard Stack

**No new packages.** Everything needed is already installed and in-repo. Verified from `package.json` this session:

| Library | Version (verified) | Purpose in this phase | Why Standard |
|---------|--------------------|-----------------------|--------------|
| `react-native-reanimated` | 4.5.1 `[VERIFIED: package.json]` | Panel enter/exit + search collapse animation on the UI thread | CLAUDE.md: Reanimated for gestures/animation; never React-state-per-frame |
| `@shopify/react-native-skia` | 2.6.2 `[VERIFIED: package.json]` | **Do NOT use for panels** — Skia is the orrery render loop | Reserved for the orrery; a control panel is a discrete transition, not a render loop |
| `react-native-gesture-handler` | 2.32.0 `[VERIFIED: package.json]` | Available if outside-tap/gesture needs it (a `Pressable` scrim is simpler) | Already the project's gesture layer |
| `expo-blur` | ~57.0.2 `[VERIFIED: package.json]` | Galaxy glass in `GlassSurface` (already consumed) | Panels reuse `GlassSurface`, which owns blur + graceful fallback |
| zustand | (in-repo, all stores) | `dashboard-query-store`, `dashboard-session-store`, `shell-transient-store` | Project's state pattern (CLAUDE.md) |
| `@expo/vector-icons` Ionicons | (in-repo via `Icon`) | Header/control/toggle glyphs via the semantic registry | Only icon source (D-05) |

### In-repo primitives to reuse (do not rebuild)
| Primitive | Path | Reuse for |
|-----------|------|-----------|
| `GlassSurface` | `src/components/ui/GlassSurface.tsx` | Panel body surface (Galaxy glass / Standard flat), `density="dense"` for readability `[VERIFIED: GlassSurface.tsx:54-110]` |
| `BaseOverlay` / `SCRIM_OPACITY` | `src/components/ui/overlay-base.tsx` | Reference for a11y-focus-on-open + Back contract; NOT directly (see Pitfall 1) `[VERIFIED: overlay-base.tsx]` |
| `SegmentedControl` | `src/components/SegmentedControl.tsx` | The List/Card view toggle (generic 2-segment, filled-accent + `accessibilityState.selected`) `[VERIFIED: SegmentedControl.tsx:42-89]` |
| `ShellAppBar` | `src/components/ShellAppBar.tsx` | `variant="child"` for Archived/Unbound; Back already routes through `resolveBackIntent` + `dismissTop` `[VERIFIED: ShellAppBar.tsx:29-40,44-54]` |
| `OverflowMenu` | `src/components/OverflowMenu.tsx` | The `⋯` menu — refactor the actions array, add a `disabled` state for Select Contacts `[VERIFIED: OverflowMenu.tsx:28-118]` |
| `Icon` + `ICON_REGISTRY` | `src/components/icons/` | Header/control icons — **new semantic names must be added at the registry map only** `[VERIFIED: icon-registry.ts:33-66; Icon.tsx:36-45]` |
| `shellTransientStore` | `src/stores/shell-transient-store.ts` | Register the open panel so Back + active-tab-retap dismiss it `[VERIFIED: shell-transient-store.ts:22-56]` |

**Installation:** none. `npm install` adds nothing this phase.

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. All primitives are in-repo; the only runtime dependencies (Reanimated, Skia, gesture-handler, expo-blur, zustand, Ionicons) are already present and consumed by shipped code. No `npm install` step belongs in any Phase 26 plan.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────────────┐
   user taps a      │  HomeScreen (Dashboard tab root)             │
   control ───────► │                                             │
                    │  ShellAppBar(variant="root")                 │
                    │    trailing: [Your Week] [Group Events] ⋯    │  ── overflow ──► GroupEvents / Unbound /
                    │  ┌───────────────────────────────────────┐  │                  Archived / Select(disabled) /
                    │  │ Control row: Population | Filters | Sort│◄─┼── stays ABOVE    Reset (resetDashboardView+clearSession)
                    │  └───────────────────────────────────────┘  │   the scrim →
                    │  Search (collapsible) ......... [List|Card]  │   one-tap switch
                    │  ┌───────────────────────────────────────┐  │
                    │  │ Contact collection (FlatList)          │◄─┼── visibly updates behind panel,
                    │  │  inert + a11y-hidden while panel open   │  │   inert (scrim) + importantForAccessibility
                    │  └───────────────────────────────────────┘  │
                    └───────────────────────────────────────────┬─┘
                                                                 │ open panel (registered in shellTransientStore)
                                                                 ▼
   LAYER 3 (swap point) ──► AnchoredPanel (scrim + measured anchor position + Reanimated enter/exit)
                                                                 │  props: {anchorRect, size, onDismiss}
                                                                 ▼
   LAYER 2 (presentation-agnostic) ──► PopulationPanelContent / FilterPanelContent / SortPanelContent
                                                                 │  props: {state, onChange}  (NO panel internals)
                                                                 ▼
   LAYER 1 (Phase 25, consume-only) ──► dashboard-query-store  ──►  app-settings-dao  ──►  SQLite app_settings
                                          (setPopulations/setFilters/setSort/setViewMode/resetDashboardView)
                                                                 │
   read path ────────────────────────► listDashboardPopulation(query, now)  [NO term param — see O-1]
```

### Recommended file structure (additions)
```text
src/components/control-surface/
├── AnchoredPanel.tsx            # LAYER 3 — the swap point (container/scrim/position/anim/focus)
├── PopulationPanelContent.tsx   # LAYER 2 — presentation-agnostic (state + onChange props)
├── FilterPanelContent.tsx       # LAYER 2
├── SortPanelContent.tsx         # LAYER 2
├── DashboardControlRow.tsx      # the three triggers + summaries (reads query store)
├── control-summary.ts           # PURE: populations[]/filters{}/sort → "+N" summary string (node-testable)
└── anchor-position.ts           # PURE: anchorRect + panel size + viewport → clamped {top,left,width} (node-testable)
```
Rationale: the two `.ts` files carry the only logic testable in the render-free `node` vitest env (see Validation Architecture). Everything visual is on-device UAT.

### Pattern 1: AnchoredPanel as an in-tree shell transient (RECOMMENDED)

**What:** An absolutely-positioned overlay rendered inside the Dashboard screen tree (a sibling of the `FlatList`), NOT an RN `Modal`. A full-screen light scrim `Pressable` catches outside taps; the panel floats above it, positioned from the invoking control's measured window rect; the control row is rendered ABOVE the scrim so a second control is tappable in one interaction.

**When to use:** All three controls (Population/Filters/Sort). One `AnchoredPanel` primitive, three size variants (compact/medium/large per UI-SPEC).

**Why not RN `Modal` (the tempting reuse of `BaseOverlay`):**
- An RN `Modal` renders in a **separate native window**. The control-row triggers would sit *behind* it, so "tap another control to switch in one interaction" (DASHC-05 / §F) becomes a two-tap dismiss-then-tap. **This alone rules out `Modal`.**
- `BaseOverlay` only supports `justify: center | flex-end` `[VERIFIED: overlay-base.tsx:57,95]` and a fixed `SCRIM_OPACITY = 0.85` `[VERIFIED: overlay-base.tsx:35]` — too opaque for "content behind stays readable so live updates are perceptible" (§G/§E). The panel needs a lighter, theme-dependent scrim.
- Anchor-relative positioning against a control is not something `BaseOverlay` expresses.

**Mechanics:**
- Measure the trigger with `ref.current.measureInWindow((x,y,w,h) => …)` on press (portrait-locked, so no rotation edge case). Feed the rect to the pure `anchor-position.ts` helper which returns `{top, left, width}` clamped to the `SPACING.base` (16px) gutter.
- Anchor top edge just below the control row; align leading edge to the control, clamped.
- Surface via `GlassSurface density="dense"`; corners `RADII.lg` (16) `[VERIFIED: radii.ts:14]`.
- Scrim = `colors.background` at a **lower** opacity than 0.85 (theme-dependent; exact value is Claude's discretion / device-UAT tunable).
- Register on open: `shellTransientStore.getState().openTransient("dashboard-panel", closePanel)`; `closeTransient` on close. This makes Android Back and active-tab-retap dismiss the panel *before* navigation, for free (both already call `dismissTop()`) `[VERIFIED: RootNavigator.tsx:64,95-106; back-intent.ts:8-14]`.
- Animate open/close with Reanimated `withTiming(…, {duration: MOTION.base})` (200ms) `[VERIFIED: motion.ts:30]`, `EASING.decelerate` on enter; collapse to instant when `useReducedMotion()` is true `[VERIFIED: use-reduced-motion.ts:122]`.

### Pattern 2: Background inert + a11y focus removal (Android)

**What:** While a panel is open, the contact collection must be (a) untappable and (b) invisible to the screen reader, while remaining visually present and live-updating.

**How (Android-correct):**
- **Interaction-inert:** the full-screen scrim `Pressable` physically intercepts touches to the list; on tap it dismisses (outside-tap). Belt-and-braces, set `pointerEvents="none"` (or `"box-none"`) on the list wrapper while open.
- **A11y focus removal:** wrap the dashboard content (everything below the control row) in a `View` and set `importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}` — this is the **Android** API that removes descendants from the accessibility tree. Pair with `accessibilityElementsHidden` for iOS parity (harmless on Android; the codebase is Android-first but keep it portable). The panel + scrim remain the only focusable nodes.
- The control-row triggers stay focusable (they're above the scrim) so a screen-reader user can switch controls.

**Note:** `BaseOverlay` gets a11y-hiding "for free" because a native `Modal` window traps focus and hides the window behind it `[VERIFIED: overlay-base.tsx:80-84 focus-on-open]`. Since we're deliberately NOT using `Modal`, we must implement the hide explicitly. This is the main cost of the in-tree approach and must be an explicit task with an on-device TalkBack backstop.

### Pattern 3: The presentation seam (§P / D-11) — three enforced layers

**What:** Layer 2 content components take `{ state, onChange }` props and render identically inside `AnchoredPanel` today or a HUD later. They must not import `AnchoredPanel`, positioning, scrim, or animation. Layer 1 (`dashboard-query-store`) is consumed, never forked.

**Contract to verify (checker/review target):** `grep` in `PopulationPanelContent`/`FilterPanelContent`/`SortPanelContent` must show zero imports of `AnchoredPanel` internals and zero direct `app-settings-dao` writes — they call the store setters passed as `onChange`. A HUD swap must touch only `AnchoredPanel`.

### Pattern 4: HomeScreen migration old→new store (the big refactor)

**What:** Replace `useDashboardPrefs` (AsyncStorage, `sort`/`filter`) with `useDashboardQueryStore` (`populations[]`/`filters{}`/`sort`/`viewMode`), replace `listDashboard(term)` with `listDashboardPopulation(query, now)`, and replace the `FilterChipRow` + inline sort row with the three panel controls `[VERIFIED: HomeScreen.tsx:63,101-104,193,277-297,360-403]`.

**Hydration:** the new store is SQLite-backed and async — call `hydrate(exec)` on mount (mirror the shell's DB-ready gate); the store defaults (`viewMode:"list"`, `populations:[]`, `filters:{}`, `sort:"default"`) render correctly pre-hydration `[VERIFIED: dashboard-query-store.ts:58-64]`.

**Setters take `exec`:** every mutator is `(exec, value) => Promise` and writes through `app-settings-dao` `[VERIFIED: dashboard-query-store.ts:16-28,65-105]`. The panel content callbacks must thread `getExecutor()`.

### Anti-Patterns to Avoid
- **Driving the panel animation from React `setState` per frame** — CLAUDE.md non-negotiable; use Reanimated shared values.
- **Using Skia for the panel** — Skia is the orrery render loop only.
- **Reusing `BaseOverlay`/RN `Modal` for the panel** — breaks one-tap control switching and the readable-background requirement (Pitfall 1).
- **A colour literal anywhere** — every colour via `useTheme().colors.*`; new icons at the registry map only; `npm run check:colors` must stay green `[VERIFIED: package.json:62 → scripts/check-colors.sh]`.
- **Dropping `app_settings` / `PORTABLE_SETTINGS_KEYS` entries to "clean up"** the old prefs — D-03: coordinate with Phase 36.
- **Re-authoring Phase 25 copy** (population/filter/sort labels, empty/error copy, `+N more`) — render only.
- **Reintroducing ranked favourites / a `favourite_rank` sort / a Manage Favorites row** — ADR-075 / D-06.
- **Adding a birthday banner/module** — ADR-076 / D-07.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Panel surface (glass/flat/blur/AA) | A per-theme panel component family | `GlassSurface` with `density` | THEME-05 semantic surface; blur degrades gracefully; AA-checked `[VERIFIED: GlassSurface.tsx]` |
| Back / active-tab dismissal | A bespoke `BackHandler` in the panel | `shellTransientStore` + `resolveBackIntent` | Shell already owns topmost-transient Back `[VERIFIED: RootNavigator.tsx:86-113]` |
| List/Card toggle | A new segmented control | `SegmentedControl` | Generic, filled-accent, `accessibilityState.selected` built in `[VERIFIED: SegmentedControl.tsx]` |
| Query state + persistence | A new store / AsyncStorage | `dashboard-query-store` (Phase 25) | SQLite-backed, validated in `app-settings-dao` |
| Reset semantics | Inline field clears | `resetDashboardView()` + `clearSession()` | State contract owned by Phase 25 `[VERIFIED: dashboard-query-logic.ts:215-224]` |
| Child-route chrome | Hand-rolled Back + raw font sizes | `ShellAppBar variant="child"` | The whole point of the D-05 refactor |
| Icons | Raw Ionicons glyph strings | `Icon` + new semantic registry names | D-05: one icon source; `tsc` validates glyphs |

**Key insight:** Phase 25 already paid for the hard data-layer work. The temptation is to "just wire it up quickly"; the actual risk is in the presentation seam and Android a11y — the parts with no unit-test coverage in a render-free env.

## Runtime State Inventory

This is a refactor/retirement phase. Explicit inventory of what changes beyond source files:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (SQLite) | New `app_settings` columns `dashboard_view_mode`/`dashboard_populations`/`dashboard_filters`/`dashboard_sort` already exist via migration 019 `[VERIFIED: migrations/019-dashboard-prefs.ts:15-26; app-settings-dao.ts:312-315,397-400]`. Phase 26 **reads/writes** them (no schema change). | Code only — wire the store; **no migration** (D-03). |
| Stored data (AsyncStorage) | `dashboard-prefs-store` key `orbit-dashboard-prefs` (old `sort`/`filter`) `[VERIFIED: dashboard-prefs-store.ts:34]`. Becomes orphaned when HomeScreen migrates off it. | Stop reading it; **do NOT delete the key or the store file ad hoc** — retirement coordinates with Phase 36 (D-03). Leaving stale AsyncStorage is harmless (no migration, no schema). |
| Live service config | None — no external services, local-first. | None — verified: no backend, no telemetry (CLAUDE.md). |
| OS-registered state | None introduced. Widget projection reads `listDashboardPopulation` already `[VERIFIED: grep widget-data.ts uses listDashboardPopulation]` — unaffected by the control shell. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts / installed packages | None — no new packages, no native modules. | None. |
| Portable settings allowlist | `PORTABLE_SETTINGS_KEYS` already allowlists `dashboardViewMode/Populations/Filters/Sort` AND `includeUnboundNeverContacted`/`birthdayUnboundEnabled` (allowlisted, NOT emitted — Phase 36) `[VERIFIED: backup-schema.ts:132-173]`. | None — do not touch (D-03). |

**The canonical question — after every source file is updated, what still holds the old string/state?** The orphaned `orbit-dashboard-prefs` AsyncStorage blob. It is inert once unread; its formal retirement is Phase 36's, not Phase 26's.

## Common Pitfalls

### Pitfall 1: Reusing RN `Modal`/`BaseOverlay` for the anchored panel
**What goes wrong:** Control-to-control one-tap switching breaks (control row is behind the Modal window); the 0.85 scrim hides the live-updating background; anchor positioning is impossible.
**Why it happens:** `BaseOverlay` looks like the "shared overlay" the codebase wants you to reuse, and its Android Back/focus contract is genuinely good.
**How to avoid:** Build `AnchoredPanel` in-tree; borrow `BaseOverlay`'s *contract* (a11y focus on open, Back handling) but not its `Modal` implementation. Register in `shellTransientStore` for Back.
**Warning signs:** You find yourself measuring window coordinates to position content inside a `<Modal>`, or the second control tap dismisses instead of switching.

### Pitfall 2: Background stays in the a11y tree
**What goes wrong:** TalkBack reads contact rows behind the open panel; focus escapes the panel. Fails DASHC-05 / §Q.
**Why it happens:** The in-tree approach doesn't get the native `Modal` window's automatic focus trap.
**How to avoid:** `importantForAccessibility="no-hide-descendants"` on the content wrapper while open (Android); `accessibilityElementsHidden` for iOS parity. Verify with TalkBack on the Pixel — this cannot be unit-tested (render-free env).
**Warning signs:** Swipe-navigating with TalkBack reaches a contact card while a panel is open.

### Pitfall 3: Search read has no home in the new query world
**What goes wrong:** After migrating HomeScreen to `listDashboardPopulation(query, now)`, the search box has nothing to call — that read takes **no term** `[VERIFIED: dashboard-read.ts:274-296]`, whereas the old `listDashboard({filter,sort,term})` did `[VERIFIED: dashboard-read.ts:365-369]`.
**Why it happens:** Phase 25 shipped the population read + the session-store search text + the `search-empty` empty state `[VERIFIED: dashboard-empty-logic.ts:14,52,150-152]`, but no population-aware search read.
**How to avoid:** Treat as a cross-phase seam (Open Question O-1). Do not silently keep the old dual-read or silently drop search. Confirm with Phase 25 owner scope before designing.
**Warning signs:** You're about to add a `term` param to `listDashboardPopulation` (that's Phase 25's read — a fork risk) or keep calling old `listDashboard` in parallel.

### Pitfall 4: Header can't fit both destinations
**What goes wrong:** Labels wrap to a second line or shrink, or push the control row down. Violates D-04 (locked).
**Why it happens:** OS font scaling + two labels + `⋯` in a fixed-height bar. The current header already flirts with this — the Group Events entry uses `maxWidth: 132` and `numberOfLines={1}` `[VERIFIED: HomeScreen.tsx:640-656]`.
**How to avoid:** Implement the icon-only fallback (both destinations) with unchanged `accessibilityLabel`s; the control row's vertical position is invariant. Back-stop on the Pixel at large text scale.
**Warning signs:** Header height grows or the control row moves at 200% font scale.

### Pitfall 5: Zero-result live selection auto-closes the panel
**What goes wrong:** Selecting a filter that yields no rows closes the panel. Violates §F.
**How to avoid:** Panel dismissal is user-driven only; a zero-result selection leaves the panel open and shows the Phase 25 cause-aware empty state behind it.

### Pitfall 6: Removing Unbound retrieval (ADR-062 trip-wire)
**What goes wrong:** Migrating Dashboard search off the old read (which returned Unbound as neutral rows) removes the only name-lookup path for Unbound. Weakens ADR-062.
**How to avoid:** Ship the Unbound child route's own search (`unbound-contacts-search-input` / `-clear`) as the replacement path (D-08). `listUnbound` currently has **no search** — it's `ORDER BY name COLLATE NOCASE, id` with a fixed WHERE `[VERIFIED: unbound-read.ts:24-39]`; add a name-filter variant (or filter in `unbound-list-logic`). If you cannot ship it, STOP AND ASK.

## Code Examples

### Pure summary helper (node-testable, layer-2 input)
```typescript
// src/components/control-surface/control-summary.ts — PURE, no react-native import
// Renders the "+N" collapse for a control trigger (dossier §C / UI-SPEC).
// Copy for labels comes from Phase 25's Copywriting Contract — do not re-author.
export function collapseSummary(names: string[], maxShown: number): string {
  if (names.length === 0) return ""; // caller substitutes the axis default
  if (names.length <= maxShown) return names.join(", ");
  const shown = names.slice(0, maxShown).join(", ");
  return `${shown} +${names.length - maxShown}`;
}
```

### Store setters take an executor (verified shape)
```typescript
// Source: src/stores/dashboard-query-store.ts:73-92 (verbatim signatures)
setPopulations: (exec: SqlExecutor, populations: DashboardPopulation[]) => Promise<void>;
setFilters:     (exec: SqlExecutor, filters: DashboardFilters) => Promise<void>;
setSort:        (exec: SqlExecutor, sort: DashboardSortMode) => Promise<void>;
setViewMode:    (exec: SqlExecutor, viewMode: DashboardViewMode) => Promise<void>;
resetDashboardView: (exec: SqlExecutor) => Promise<void>;
// Panel onChange callbacks call these with getExecutor(); never write app-settings-dao directly.
```

### Verified discrete value sets (quote verbatim — these drive the panel rows)
```typescript
// Source: src/logic/dashboard-query-logic.ts:5-11
export const DASHBOARD_POPULATIONS = [
  "favourites", "birthdays", "not-contacted", "snoozed", "all-contacts",
] as const;
// Source: src/logic/dashboard-query-logic.ts:14-20
export const DASHBOARD_FILTER_FAMILIES = [
  "category", "social-battery", "needs-attention", "gravity", "contact-frequency",
] as const;
// Source: src/logic/dashboard-query-logic.ts:118-125
export const DASHBOARD_SORT_MODES = [
  "default", "name-asc", "name-desc", "least-recent", "most-recent", "status",
] as const;
// Source: src/logic/dashboard-query-logic.ts:133
export type DashboardViewMode = "list" | "card";
// Source: src/logic/dashboard-query-logic.ts:215-224 — reset preserves viewMode
export function resetDashboardView(state) {
  return { viewMode: state.viewMode, populations: [], filters: {}, sort: "default" };
}
```

### New semantic icon names to add (registry map only)
```typescript
// src/components/icons/icon-registry.ts — ADD to ICON_REGISTRY (glyph pairs = Ionicons outline/filled).
// UI-SPEC lists needs: filter, sort, list, grid, your-week, group-events, chevron-down.
// The registry currently has NONE of these [VERIFIED: icon-registry.ts:33-66].
// Exact Ionicons glyphs are Claude's discretion; tsc validates them in Icon.tsx.
filter:        { outline: "filter-outline",        filled: "filter" },
sort:          { outline: "swap-vertical-outline", filled: "swap-vertical" },
list:          { outline: "list-outline",          filled: "list" },
grid:          { outline: "grid-outline",          filled: "grid" },
"your-week":   { outline: "calendar-outline",      filled: "calendar" },
"group-events":{ outline: "people-outline",        filled: "people" },
"chevron-down":{ outline: "chevron-down",          filled: "chevron-down" },
```

## State of the Art

| Old Approach (in-repo today) | Current Approach (this phase) | When Changed | Impact |
|------------------------------|-------------------------------|--------------|--------|
| `dashboard-prefs-store` (AsyncStorage, single `filter`+`sort`) | `dashboard-query-store` (SQLite, `populations[]`/`filters{}`/`sort`/`viewMode`) | Phase 25 built store; Phase 26 wires it | Multi-axis query state; persisted in `app_settings` |
| `FilterChipRow` single-active + inline 4-option sort row | Three anchored panels (Population/Filters/Sort) | Phase 26 | The core deliverable |
| `listDashboard({filter,sort,term})` (old read, has search) | `listDashboardPopulation(query, now)` (no term) | Phase 25 | **Search read gap — O-1** |
| Archived/Unbound hand-rolled Back + raw fonts | `ShellAppBar variant="child"` | Phase 26 | First-class child-route chrome |
| Overflow: Your Week/Backup/Orrery/Settings/GroupEvents/Archived | Group Events/Unbound/Archived/Select(disabled)/Reset | Phase 26 | Backup/Orrery/Settings now bottom-nav tabs (ADR-080) `[VERIFIED: HomeScreen.tsx:107-150]` |

**Deprecated/outdated:**
- Ranked favourites / `favourite_rank` sort / Manage Favorites screen — retired (ADR-033 → ADR-075). Note: `ContactCard` still reads `isFavourite={item.favourite_rank !== null}` as a **membership** flag `[VERIFIED: HomeScreen.tsx:565]` — binary, correct; do not treat as order.
- Standalone Never Contacted screen — retired; the HomeScreen footer "Not yet contacted" currently self-navigates to `Home` as a one-phase gap `[VERIFIED: HomeScreen.tsx:410-426]`; Phase 26's Not-Contacted population replaces it.
- Permanent birthday banner/module (ADR-034 → ADR-076).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | In-tree overlay (not RN Modal) is the right AnchoredPanel base | Pattern 1 | If a Modal is mandated, one-tap switching + readable background need another solution; but the constraints strongly favour in-tree. Validate the interaction on-device early. |
| A2 | Suggested Ionicons glyphs (`filter-outline`, `swap-vertical`, etc.) exist in the installed Ionicons version | Code Examples | `tsc --noEmit` fails in `Icon.tsx` if a glyph name is invalid — caught at build, cheap to fix. Exact glyphs are Claude's discretion anyway. |
| A3 | The orphaned `orbit-dashboard-prefs` AsyncStorage key is harmless if left unread | Runtime State Inventory | If some other reader depends on it, retiring the store breaks it — grep confirms only HomeScreen reads it `[VERIFIED: grep useDashboardPrefs]`, so risk is low. |
| A4 | `importantForAccessibility="no-hide-descendants"` correctly removes the background from Android a11y focus for an in-tree overlay | Pattern 2 | If insufficient, may need to also toggle `accessible`/focus management; verify with TalkBack on the Pixel (backstop). |

## Open Questions (RESOLVED 2026-09-05)

> Disposition: O-1 → owner decision, CONTEXT D-12 (below). O-2 → RESOLVED: use `localDateTime()` (grep-banned against `toISOString()` in plans 26-01/26-07 per CLAUDE.md). O-3 → RESOLVED: ship Select Contacts with no helper copy (the `accessibilityState.disabled` is the load-bearing part); owner may add copy at UAT. O-4 → RESOLVED: default Unbound search placeholder "Search unbound contacts"; owner may adjust at UAT. All non-blocking.

1. **O-1 (HIGH) — RESOLVED 2026-09-05 (owner decision → CONTEXT D-12).** Dashboard search reads via a **new, additive population-aware search read authored in Phase 26** that composes population + filters + term and preserves the recorded A3 search-scope semantics (`dashboard-read.ts:38`). It must **not** fork Phase 25's `listDashboardPopulation` (no `term` param on it — D-11 layer-1). Legacy `listDashboard` retires once the new read is wired; **no dual-read**. See CONTEXT.md D-12.
   - Original context (retained): `dashboard-session-store.searchText` exists `[VERIFIED]`, `dashboard-empty-logic` models `search-empty` `[VERIFIED]`, `listDashboardPopulation(query, now)` takes **no term** `[VERIFIED: dashboard-read.ts:274-296]`; the old `listDashboard` (with `term`) is what HomeScreen calls today `[VERIFIED: dashboard-read.ts:365-369]`.

2. **O-2 (MEDIUM) — Is `listDashboardPopulation`'s `now` string sourced consistently?** It requires a `YYYY-MM-DD`-prefixed local wall-clock string and throws otherwise `[VERIFIED: dashboard-read.ts:262-273]`. HomeScreen must pass `localDateTime()` (per CLAUDE.md `formatLocalDate`/local-date rules), not `toISOString()`.
   - Recommendation: use the same local-date helper the rest of the app uses; add a unit test around the read call site if feasible.

3. **O-3 (LOW) — Select Contacts disabled-row helper copy.** UI-SPEC leaves "Available in Card view" as owner-confirm (omit if cluttered). Recommendation: ship without the helper unless the owner asks; the `accessibilityState={{disabled:true}}` is the load-bearing part.

4. **O-4 (LOW) — Unbound search placeholder copy** "Search unbound contacts" is owner-confirm default. Non-blocking.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-native-reanimated | panel/search animation | ✓ | 4.5.1 | reduced-motion → instant (built in) |
| @shopify/react-native-skia | (not used here) | ✓ | 2.6.2 | — |
| react-native-gesture-handler | optional gesture | ✓ | 2.32.0 | Pressable scrim |
| expo-blur | Galaxy glass | ✓ | ~57.0.2 | GlassSurface tint fallback (built in) |
| Physical Pixel 6 Pro | on-device UAT (a11y, blur, perf) | ✓ (owner's, per CLAUDE.md) | — | desktop emulator (no valid perf/blur claims) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all animation degrades to reduced-motion/tint fallbacks already implemented.

## Validation Architecture

`workflow.nyquist_validation: true` `[VERIFIED: .planning/config.json:24]`. **Critical constraint: vitest `environment: "node"` `[VERIFIED: vitest.config.ts:12]` — render-free, no DOM, Hermes-like.** Component rendering, animation, a11y focus, blur, and gesture behavior are **on-device UAT only**; only pure logic is unit-testable.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 `[VERIFIED: package.json]` |
| Config file | `vitest.config.ts` (environment: node) |
| Quick run command | `npx vitest run src/components/control-surface` |
| Full suite command | `npm test` (`vitest run`) |
| Static gates | `npm run check:colors` (no colour literals) + `tsc --noEmit` (icon glyph validation) `[VERIFIED: package.json:62,71]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASHC-03 | `+N` summary collapse | unit (pure) | `npx vitest run src/components/control-surface/control-summary.test.ts` | ❌ Wave 0 |
| DASHC-04 | anchor rect → clamped position | unit (pure) | `npx vitest run src/components/control-surface/anchor-position.test.ts` | ❌ Wave 0 |
| DASHC-06 | population/filter/sort defaults + reset | unit | `npx vitest run src/stores/dashboard-query-store.test.ts` (extend) | ✅ exists |
| DASHC-10 | reset → Active/none/Default/cleared, viewMode preserved | unit | `npx vitest run src/logic/dashboard-query-logic.test.ts` + session store | ✅ exists |
| DASHC-08 | overflow set correctness (5 rows, disabled Select) | unit (pure array) | extract overflow-actions builder to a pure fn + test | ❌ Wave 0 |
| DASHC-09 | Unbound name-search filter | unit (pure) | `npx vitest run src/screens/unbound-list-logic.test.ts` (extend) | ✅ exists |
| DASHC-04/05 | panel open/switch/live-apply/inert | **on-device UAT** | Pixel: `uiautomator dump` + TalkBack | manual |
| DASHC-05 | background a11y-hidden + Back dismiss | **on-device UAT (TalkBack)** | Pixel | manual |
| DASHC-02 | icon-only header fallback at large font scale | **on-device UAT** | Pixel at 200% scale | manual |
| DASHC-07 | search collapse honours reduced motion | **on-device UAT** | Pixel | manual |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched dir>` + `npm run check:colors` + `tsc --noEmit`.
- **Per wave merge:** `npm test`.
- **Phase gate:** full suite green + on-device UAT pass on the Pixel (per the repo's verify-UI-on-the-Pixel rule) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/components/control-surface/control-summary.test.ts` — DASHC-03 `+N` logic
- [ ] `src/components/control-surface/anchor-position.test.ts` — DASHC-04 clamped positioning
- [ ] Pure overflow-actions builder + test — DASHC-08 (extract from `HomeScreen`)
- [ ] Extend `unbound-list-logic.test.ts` — DASHC-09 Unbound name filter
- [ ] Extend `dashboard-query-store.test.ts` — panel setter/hydrate coverage if new branches added

*(Existing infra covers the store/logic; the new pure helpers are the only genuinely new test files.)*

## Security Domain

`security_enforcement: true` `[VERIFIED: .planning/config.json:46]`. This is a local-first UI control shell; threat surface is small but non-zero.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | no auth in app |
| V3 Session Management | no | ephemeral in-memory session store only |
| V4 Access Control | no | single-device, no multi-user |
| V5 Input Validation | yes | Persisted query state validated in `app-settings-dao` (`assertDashboardSort/Populations/Filters`) + `parseDashboardPopulations/Filters` reject malformed JSON `[VERIFIED: app-settings-dao.ts:840-853; dashboard-query-logic.ts:248-280]`. Panel writes must go through the store→DAO path so these guards apply. |
| V6 Cryptography | no | no crypto in this phase |

### Known Threat Patterns for {RN local-first control shell}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter/population values | Tampering | Already mitigated: `buildFilterWhere`/`buildPopulationWhere` select only closed SQL constants and `?`-bind every runtime value `[VERIFIED: dashboard-query-logic.ts:75-116,180-213]`. Phase 26 must not interpolate any identifier/value into SQL. |
| Malformed persisted prefs crash on hydrate | DoS (local) | `parseStoredState` try/catch falls back to empty axes `[VERIFIED: dashboard-query-store.ts:38-49]`. |
| Widening what leaves the device | Info disclosure | None — no network on any read path (CLAUDE.md); `PORTABLE_SETTINGS_KEYS` change is Phase 36's, not this phase's (D-03). Do not add emission. |

**Non-negotiable:** Dashboard must render offline; no blocking network on the read path (CLAUDE.md). All reads here are on-device SQLite.

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/screens/HomeScreen.tsx`, `ArchivedContactsScreen.tsx`, `UnboundContactsScreen.tsx`, `unbound-list-logic.ts`
- `src/stores/dashboard-query-store.ts`, `dashboard-session-store.ts`, `dashboard-prefs-store.ts`, `shell-transient-store.ts`
- `src/logic/dashboard-query-logic.ts`, `src/logic/dashboard-empty-logic.ts` (partial)
- `src/db/dashboard-read.ts` (exports + `listDashboardPopulation`), `unbound-read.ts`, `app-settings-dao.ts` (partial), `migrations/019-dashboard-prefs.ts` (partial), `database.ts` (TARGET_VERSION), `picker-read.ts` (partial)
- `src/components/ui/overlay-base.tsx`, `GlassSurface.tsx`, `Sheet.tsx`; `SegmentedControl.tsx`, `ShellAppBar.tsx`, `OverflowMenu.tsx`, `FilterChipRow.tsx` (partial); `icons/icon-registry.ts`, `icons/Icon.tsx`
- `src/navigation/types.ts`, `back-intent.ts`, `RootNavigator.tsx`, `tabs/DashboardStack.tsx`
- `src/theme/tokens/motion.ts`, `radii.ts`, `surface.ts` (exports), `use-reduced-motion.ts` (exports)
- `src/backup/backup-schema.ts` (PORTABLE_SETTINGS_KEYS)
- `package.json`, `vitest.config.ts`, `.planning/config.json`
- Dossier `phase-05-dashboard-control-surface-dossier-amended-group-events.md`; `planning-notes/phase-05-planning-notes.md`; ADR-080; CONTEXT.md; UI-SPEC.md; REQUIREMENTS.md (DASHC-01..10)

### Secondary (MEDIUM confidence)
- Reanimated 4 entering/exiting + `withTiming` API (training knowledge; `MOTION.base`/`EASING.decelerate` tokens are verified in-repo).
- Ionicons outline/filled glyph availability (validated at build by `tsc` in `Icon.tsx`).

### Tertiary (LOW confidence)
- None material — this phase is almost entirely in-repo verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all reuse targets read on disk.
- Architecture (AnchoredPanel/seam/refactor): HIGH — grounded in the actual store/overlay/nav code; A1 (in-tree vs Modal) is a reasoned recommendation to validate on-device.
- Pitfalls: HIGH — each traces to a verified code fact or a locked decision.
- Search read gap (O-1): HIGH that the gap exists; the resolution is an owner/Phase-25-scope question.

**Research date:** 2026-09-05
**Valid until:** ~2026-10-05 (stable in-repo; re-verify `TARGET_VERSION`, migration head, and PORTABLE_SETTINGS_KEYS at plan time if any schema phase lands first).
