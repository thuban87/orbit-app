# Phase 23: Theme & Visual System - Research

**Researched:** 2026-09-03
**Domain:** React Native / Expo cross-app theming — theme engine, semantic tokens, icon registry, status glyphs, reduced-motion (Skia + Reanimated), font loading, SQLite-backed persistence, contrast validation
**Confidence:** HIGH (integration unknowns verified against the actual code on disk and against current library type definitions)

<user_constraints>
## User Constraints (from CONTEXT.md + dossier)

### Locked Decisions (D-01 … D-11)
- **D-01:** The dossier (`docs/dossier/milestone-2/phase-02-theme-visual-system-dossier.md`) is ground truth; its 2026-09-01 "Amendment — audit resolutions" section overrides older text. `[DECIDED]`/`[REJECTED]` items and any Accepted ADR / `HANDOFF.md` entry are settled — reversing one is an owner decision, never a "fix."
- **D-02:** The planning-notes file is a binding appendix — every REPLAN finding must appear in the plan; every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Verify head+1 against `src/db/migrations/` and `TARGET_VERSION` at plan time (verified this session: **head+1 = migration `015`** — see Persistence & Schema). All new durable prefs are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.
- **D-04 (E-09, resolved):** App-wide preset backgrounds behind text-heavy screens **supersede** HANDOFF §7's dashboard/orrery-only rule (owner ratified 2026-09-01; supersession note in §7). ADR-048 tap-to-freeze / live creeping motion remains superseded — do not reinstate.
- **D-05 (R-17):** Status glyphs, the semantic icon registry, and reduced-motion support have **no existing foundation** (confirmed on disk this session). This phase delivers all three as first-class deliverables **before** renderer phases consume them. Never fork a second icon or status source.
- **D-06 (trip-wire):** Every colour resolves through theme tokens, **including inside Skia draw calls**. Glyphs and the icon registry must not hardcode colour.
- **D-07 (trip-wire):** Animation is never driven from React state. The reduced-motion hook must be readable from the Skia render loop without per-frame `setState`.
- **D-08 (R-16):** Theme package, appearance mode, accent, background, and per-package memory all become `app_settings` columns; migrating the existing AsyncStorage `orbit-theme` value into them is this phase's job (read-once-then-clear vs one-time import is the plan's call).
- **D-09 (trip-wire):** Every new key must be added to `PORTABLE_SETTINGS_KEYS` (`src/backup/backup-schema.ts`) so the Phase 36/backup format bump carries them.
- **D-10:** Package and appearance mode are independent axes → all four combinations; Follow System ships from start and tracks the OS live; first launch defaults to Galaxy + Follow System; theme-critical prefs restore before the main UI renders (no wrong-theme flash).
- **D-11 / dossier §D:** Switching packages restores that package's last-used mode, accent, and background.

### Claude's Discretion
Everything the dossier marks `[DERIVED]`, plus implementation details that touch no `[DECIDED]` item, ADR, or HANDOFF entry — exact font families, token values, animation timings, background assets, and the accent palette. (The UI-SPEC's *(discretion)* values are the proposed defaults; owner may retune.)

### Deferred Ideas (OUT OF SCOPE — do not plan or research build approaches for)
Fully custom Orbit icon **family** (only the registry seam); user-uploaded / downloadable / remote / CDN backgrounds; full illustration library; user-controlled density; unrestricted accent picker; radically different theme-specific layouts; theme-specific font families (architecture supports them later, do not build).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| THEME-01 | Package × appearance-mode independent axes; Follow System live; default Galaxy + system | Theme Architecture pattern; `Appearance`/`useColorScheme` (already wired in `theme-provider.tsx`); four-palette authoring under `src/theme/` |
| THEME-02 | Curated accent palette (~8–10), separate from star colour | Accent palette + contrast validation (Don't Hand-Roll #4); `starPalette` already a distinct token |
| THEME-03 | Per-package memory; live preview; restore before first render | Restore-before-paint pattern (folds into App's existing `ready` gate); Zustand store extension |
| THEME-04 | Curated bundled backgrounds + None/Solid; fixed while scrolling; opacity by density | Background system pattern; local `require()` asset registry; surface-opacity tokens |
| THEME-05 | Galaxy glass-forward + subtle ambient motion; Standard flatter/quieter | Surface treatment tokens; `expo-blur` graceful fallback (Don't Hand-Roll #5) |
| THEME-06 | OS reduced-motion respected; reusable hook consumable from Skia loop | **Reduced-motion architecture (highest-risk item)** — Pattern 1 |
| THEME-07 | Text reflows under OS scaling, not truncate/shrink | Typography pattern; RN `<Text>` reflow defaults; avoid fixed heights |
| THEME-08 | Stable status hue families + distinct silhouette glyphs; never colour-alone | Status Glyphs pattern; extends `ringVisual` (`contact-card-ring.ts`) |
| THEME-09 | Centralized semantic icon registry with state variants | Icon Registry pattern (Ionicons via `@expo/vector-icons`) |
| THEME-10 | Shared modal/sheet variants; formal button hierarchy; destructive beyond colour | Modal/Button primitives pattern |
| THEME-11 | AA-equivalent contrast in every theme/mode combo | Contrast validation script (Validation Architecture + Don't Hand-Roll #4) |
| THEME-12 | Orrery follows package with immersive treatment, still tokenized/accessible | Orrery exception (already token-driven via `useTheme().colors.*`) |
| THEME-13 | Theme prefs persist durably + survive backup/restore | Persistence & Schema (migration 015 + `PORTABLE_SETTINGS_KEYS`) |
</phase_requirements>

## Summary

This is a **primitives** phase, not a screen redesign, and its risk is concentrated in **four integration seams** — not in choosing libraries. The existing theme layer (`src/theme/`) is a clean, well-factored foundation: a pure `resolveMode`/`resolvePalette` pair (node-testable, no `react-native` import), a `ThemeProvider` that already resolves `system` live via `useColorScheme()`, and a single hex-literal file (`theme-presets.ts`) enforced by `npm run check:colors`. The work is (a) growing one dark preset into four palettes (Galaxy/Standard × Light/Dark), (b) building three net-new subsystems that have **zero foundation today** — a reduced-motion hook, a semantic icon registry, and status glyphs — and (c) moving theme prefs from AsyncStorage into `app_settings` with restore-before-paint. `[VERIFIED: src/theme/theme-presets.ts:18-98, src/theme/theme-provider.tsx:28-44]`

The **single highest-risk item is THEME-06/D-07: reduced motion readable from the Skia render loop without per-frame setState.** Reanimated's own `useReducedMotion()` is a trap here — its type doc states it "returns a boolean indicating whether the reduced motion setting was enabled **when the app started**" and "Changing the reduced motion system setting doesn't cause your components to rerender." `[VERIFIED: node_modules/react-native-reanimated/lib/typescript/hook/useReducedMotion.d.ts]` That is a *static, boot-time* read — it cannot satisfy the dossier's **live** `reduceMotionChanged` requirement. The correct pattern is to subscribe with `AccessibilityInfo.isReduceMotionEnabled()` + `AccessibilityInfo.addEventListener('reduceMotionChanged', …)` and push the value into a Reanimated `useSharedValue<boolean>`, which the Skia render loop reads through `useDerivedValue` — exactly the shape the Orrery already uses for its ambient clock (`useClock()` + `useDerivedValue` inside `<Canvas>`). `[VERIFIED: node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.d.ts:13-71, src/components/orrery/OrreryCanvas.tsx:93-99]`

**Primary recommendation:** Author the four palettes as pure data under `src/theme/` (keeping `check:colors` and node-testable resolvers intact); build the reduced-motion hook as an `AccessibilityInfo`-subscription → Reanimated shared value bridge (never Reanimated's boot-time `useReducedMotion`); migrate theme prefs into a new **migration 015** `app_settings` column set added to `PORTABLE_SETTINGS_KEYS`; and gate the main-UI mount on the theme read by folding it into `App.tsx`'s existing `openAndMigrate` `ready` gate. Add `@expo/vector-icons`, `expo-font`, and `expo-blur` via `npx expo install` (all verified on npm and SDK-57 aligned).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Palette values (4 palettes) | Theme data (`src/theme/`) | — | Only sanctioned hex-literal location; pure data, node-testable |
| Mode/package resolution | Theme provider (React context) | OS (`Appearance`) | `system` resolves live at the provider boundary via `useColorScheme()` |
| Reduced-motion signal | RN accessibility API → Reanimated shared value | Skia render loop (worklet reader) | Must cross the JS-state → worklet boundary without re-render (D-07) |
| Icon rendering | Semantic registry component | `@expo/vector-icons` (Ionicons) base family | Screens couple to semantic names only; base family swappable at registry seam |
| Status glyphs | Icon registry / Skia-tokenized path | Theme tokens (colour) | One shared glyph+hue source for card/profile/orrery/widget |
| Theme persistence | SQLite `app_settings` (DAO) | Zustand store (in-memory mirror) | Durable + backup-portable; store drives the provider re-render |
| First-paint gating | `App.tsx` boot shell | SQLite read | Fold theme read into the existing `openAndMigrate` `ready` gate |
| Contrast validation | Build-time script (node/vitest) | Palette data | Pure computation over token sets; no runtime cost |
| Font loading | `expo-font` (RN `<Text>`) + Skia `useFonts` (canvas) | Local `assets/*.ttf` | Two separate font pipelines already coexist (see Pitfall 5) |

## Standard Stack

### Core (already installed — verified in `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native` | 0.86.2 | `Appearance`/`useColorScheme`/`AccessibilityInfo` | `[VERIFIED: package.json]` OS theme + a11y signals |
| `react-native-reanimated` | 4.5.1 | Shared values / `useDerivedValue` for the Skia loop | `[VERIFIED: node_modules/react-native-reanimated/package.json]` worklet-readable primitives |
| `@shopify/react-native-skia` | 2.6.2 | Canvas render loop (Orrery, ambient motion, status glyph paths) | `[VERIFIED: node_modules/@shopify/react-native-skia/package.json]` off-JS-thread rendering |
| `zustand` | ^5.0.15 | In-memory theme selection store driving the provider | `[VERIFIED: package.json]` existing `theme-store.ts` idiom |
| `expo-sqlite` | ~57.0.1 | `app_settings` durable prefs | `[VERIFIED: package.json]` local-first store |

### Supporting (to add this phase — via `npx expo install`)
| Library | Version (registry) | Purpose | When to Use |
|---------|--------------------|---------|-------------|
| `@expo/vector-icons` | 15.1.1 | Ionicons base family for the icon registry (outline/filled pairs) | Icon registry only — never imported by screens directly `[VERIFIED: npm registry — but see provenance note]` |
| `expo-font` | 57.0.3 | Load Inter + Space Grotesk for RN `<Text>` | Restore-before-paint font gate `[VERIFIED: npm registry; already a transitive dep of expo]` |
| `expo-blur` | 57.0.2 | Optional Galaxy glass blur (with token fallback) | Only if real blur is pursued; decorative, must degrade `[VERIFIED: npm registry]` |
| Space Grotesk `.ttf` | OFL 1.1 | Display/Heading font, bundled locally | Add `SpaceGrotesk-SemiBold.ttf` (or `@expo-google-fonts/space-grotesk@0.4.1`) to `assets/` `[CITED: github.com/floriankarsten/space-grotesk/blob/master/OFL.txt]` |

**Install:**
```bash
npx expo install @expo/vector-icons expo-font expo-blur
# Space Grotesk: either drop SpaceGrotesk-*.ttf into assets/ (like the existing Inter-SemiBold.ttf),
# or: npx expo install @expo-google-fonts/space-grotesk expo-font   # font file bundled locally as a module, no network
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@expo/vector-icons` (Ionicons) | `react-native-svg` custom SVGs | More control, but that IS the deferred custom-icon family — out of scope this phase |
| `expo-blur` | Pure semi-opaque tinted surface token (no blur dep) | Fewer deps, no native cost; the dossier's fallback IS a tinted token, so blur is genuinely optional |
| Hand-rolled contrast fn | `wcag-contrast` / `color` npm libs | A ~30-line pure WCAG function is smaller, node-testable, and adds no dep (see Don't Hand-Roll #4) |
| `@expo-google-fonts/space-grotesk` | Raw `.ttf` in `assets/` | Both bundle locally (no network); raw ttf mirrors the existing `Inter-SemiBold.ttf` idiom exactly |

**Version verification (this session):**
- `@expo/vector-icons` → `15.1.1`, no postinstall `[VERIFIED: npm view]`
- `expo-blur` → `57.0.2`, no postinstall `[VERIFIED: npm view]`
- `expo-font` → `57.0.3`, no postinstall; already present at `node_modules/expo/node_modules/expo-font@~57.0.1` `[VERIFIED: npm view + filesystem]`
- `@expo-google-fonts/space-grotesk` → `0.4.1` `[VERIFIED: npm view]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@expo/vector-icons` | npm | mature | very high | github.com/expo/vector-icons | OK | Approved — first-party Expo, no postinstall |
| `expo-font` | npm | mature | very high | github.com/expo/expo | OK | Approved — first-party Expo (already transitive) |
| `expo-blur` | npm | mature | high | github.com/expo/expo | OK | Approved — first-party Expo, optional |
| `@expo-google-fonts/space-grotesk` | npm | mature | high | github.com/expo/google-fonts | OK | Approved — optional font-delivery convenience |

**Provenance note:** these are first-party Expo packages and `npx expo install` pins each to the version matched to SDK 57, which is the authoritative source for versions here — prefer it over a bare `npm install`. No `[SLOP]` or `[SUS]` verdicts. No postinstall scripts on any. The `package-legitimacy` seam was unavailable in this environment; verdicts above are from `npm view` + first-party provenance (Expo monorepo), not the seam — treat as HIGH but confirm with `npx expo install` at plan time.

## Architecture Patterns

### System Architecture Diagram

```
                    OS settings                         App boot (App.tsx)
              ┌───────────────────┐                ┌──────────────────────────┐
              │ colour scheme     │                │ openAndMigrate() ─ ready  │
              │ reduce-motion     │                │  └─ read app_settings ────┼─┐
              │ font scale        │                └──────────────────────────┘ │
              └───────┬───────────┘                                             │
                      │                                                         ▼
   useColorScheme() ──┤                                        hydrate ThemeStore (zustand)
   AccessibilityInfo ─┤                                        (package, mode, accent, bg
    .addEventListener │                                         per-package memory)
    ('reduceMotion    │                                                  │
      Changed')       │                                                  ▼
                      │                                          ThemeProvider (context)
                      │                                     resolveMode() + resolvePalette()
                      │                                                  │
        ┌─────────────┼──────────────────────────────┬──────────────────┼───────────────┐
        ▼             ▼                                ▼                  ▼               ▼
  useSharedValue  useReducedMotionShared()      useTheme().colors   IconRegistry   BackgroundHost
  <boolean>       (SV bridge, live)             (tokens everywhere)  (semantic →    (require() asset
        │             │                                │             Ionicons)      + opacity-by-density)
        └──────┬──────┘                                │                  │               │
               ▼                                       ▼                  ▼               ▼
      Skia <Canvas> render loop  ◄── useDerivedValue reads SV      StatusGlyph      Surface/Glass
      (Orrery, ambient drift/twinkle)  gate motion, NO setState    (glyph+hue+      (expo-blur OR
                                                                    border weight)   tinted token)
                                                                                          │
                          writes (Settings, Phase 37) ──────────────────────────► app_settings (migration 015)
                                                                                    → PORTABLE_SETTINGS_KEYS → backup (Phase 36)
```

### Recommended Project Structure
```
src/theme/                         # THE ONLY sanctioned hex-literal path (check:colors)
├── theme-presets.ts               # extend: 4 palettes (galaxy/standard × light/dark)
├── theme-types.ts                 # extend: ThemePackage axis, required light, token additions
├── theme-provider.tsx             # extend: package axis, accent/background resolution
├── tokens/                        # spacing, radii, motion, iconSize, surface — pure data
├── palettes/                      # (optional split) galaxy-dark.ts, galaxy-light.ts, …
├── accents.ts                     # curated accent palette + on-accent foreground
├── backgrounds.ts                 # slot manifest → local require() map + provenance
├── contrast.ts                    # pure WCAG relative-luminance + ratio (node-tested)
└── use-reduced-motion.ts          # AccessibilityInfo → Reanimated shared value bridge
src/components/icons/
├── icon-registry.ts               # semantic name → Ionicons component + state variants
├── Icon.tsx                       # <Icon name="close" state="active" size="md" />
└── StatusGlyph.tsx                # silhouette per status, colour via tokens
src/components/ui/                 # Modal/Sheet variants, Button hierarchy primitives
src/stores/theme-store.ts          # rework: source of truth becomes app_settings (not AsyncStorage)
src/db/migrations/015-theme-settings.ts   # head+1 (VERIFIED this session)
```

### Pattern 1: Reduced motion — AccessibilityInfo → Reanimated shared value (D-07, THEME-06) — HIGHEST RISK
**What:** A live OS reduced-motion signal readable inside Skia worklets with zero per-frame React state.
**When to use:** Every ambient/decorative animation (Galaxy drift/twinkle, Orrery inertia, decorative transitions).
**Why the obvious approach is wrong:** Reanimated's `useReducedMotion()` captures the value **at app start** and never re-renders on change `[VERIFIED: node_modules/react-native-reanimated/lib/typescript/hook/useReducedMotion.d.ts]`. It fails the dossier's *live* requirement. Use `AccessibilityInfo` directly.

```typescript
// src/theme/use-reduced-motion.ts
// Source: RN AccessibilityInfo API (verified against AccessibilityInfo.d.ts:13-71),
//         Reanimated shared-value pattern (proven in-repo: OrreryCanvas.tsx:93-99).
import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

/**
 * Live OS reduced-motion flag as a Reanimated shared value. Worklets / the Skia
 * render loop read `.value` WITHOUT re-rendering the React tree (D-07). Seeds
 * from isReduceMotionEnabled(); stays live via the reduceMotionChanged event.
 * NOT react-native-reanimated's useReducedMotion() — that is boot-time only.
 */
export function useReducedMotionShared(): SharedValue<boolean> {
  const reduced = useSharedValue(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) reduced.value = v;              // writing .value ≠ setState
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v: boolean) => { reduced.value = v; },     // live updates, no re-render
    );
    return () => { active = false; sub.remove(); };
  }, [reduced]);
  return reduced;
}
```

Consumed in the Skia loop exactly like the existing ambient clock:
```typescript
// Source: proven pattern in src/components/orrery/OrreryCanvas.tsx:93-99
const reduced = useReducedMotionShared();
const clock = useClock();
const twinkle = useDerivedValue(() =>
  reduced.value ? 0 : (Math.sin(clock.value * TWINKLE_SPEED) + 1) / 2,
);  // reduced ON → motion collapses to a constant; no per-frame setState anywhere
```

**A React-tree twin for non-Skia consumers:** provide a separate boolean hook (state-backed, re-renders on change) for JS-driven layout decisions (e.g. "render a crossfade vs an instant swap"). The shared value is for worklets; the boolean is for React. Do NOT drive Skia from the boolean.

### Pattern 2: Live Follow-System OS theme tracking (D-10, THEME-01)
**What:** `system` mode tracks the OS scheme live and drives palette selection across all four combos.
**Already proven:** `ThemeProvider` reads `useColorScheme()` and feeds the pure `resolveMode(mode, scheme)` — no coercion, `"unspecified"` handled `[VERIFIED: src/theme/theme-provider.tsx:28-44, src/theme/theme-presets.ts:114-123]`. Extend it: add a `package: "galaxy" | "standard"` axis, and resolve `(package, resolvedMode)` → one of four palettes. Keep resolvers pure (no `react-native` import) so the existing node vitest tests still run.
**When to use:** All palette selection. `useColorScheme()` re-renders the provider on OS change automatically — no manual listener needed for the colour scheme (unlike reduced motion, which has no RN hook that updates live).

### Pattern 3: Theme restore BEFORE first paint (D-10, THEME-03) — no wrong-theme flash
**What:** Read persisted theme prefs from `app_settings` before mounting the main UI.
**The current flash hazard:** `theme-store.ts` uses `zustand/persist` over AsyncStorage, which **rehydrates asynchronously** `[VERIFIED: src/stores/theme-store.ts:29-45]`. Today there is exactly one dark palette so no flash is visible; once four palettes ship, async rehydration WILL flash the wrong palette. The fix is to make the SQLite `app_settings` read a *gating* read.
**Where it sits:** `App.tsx` already gates the navigator on `openAndMigrate()` via a `ready` flag and shows a themed `<ActivityIndicator>` while pending `[VERIFIED: App.tsx:129-161, 292-298]`. Fold the theme-pref read into that same gate: after `openAndMigrate` resolves, read `getAppSettings()`, hydrate the theme store, then flip `ready`. The pre-`ready` splash may use the default palette (Galaxy + `system`, resolvable synchronously from `useColorScheme()`); a short neutral/default splash is explicitly acceptable (UI-SPEC), a *flash of the wrong saved palette* is not. `ThemeProvider` stays outside `AppShell` so the splash resolves tokens.

### Pattern 4: Icon registry (THEME-09, D-05)
**What:** `semantic name → Ionicons component`, with outline/filled + active/inactive state variants; colour through tokens; size through an `iconSize` token set.
```typescript
// src/components/icons/icon-registry.ts
// Source: @expo/vector-icons Ionicons (ships matched outline/filled pairs).
import Ionicons from "@expo/vector-icons/Ionicons";
// Screens import semantic names only — NEVER an Ionicons glyph name (exported constraint [theme → icon usage]).
export const ICON_REGISTRY = {
  close:    { outline: "close",           filled: "close" },
  settings: { outline: "settings-outline", filled: "settings" },
  favorite: { outline: "heart-outline",    filled: "heart" },
  search:   { outline: "search-outline",   filled: "search" },
  back:     { outline: "chevron-back",      filled: "chevron-back" },
  add:      { outline: "add",               filled: "add" },
  message:  { outline: "chatbubble-outline", filled: "chatbubble" },
  call:     { outline: "call-outline",      filled: "call" },
  edit:     { outline: "create-outline",    filled: "create" },
} as const;
export type IconName = keyof typeof ICON_REGISTRY;
```
```typescript
// src/components/icons/Icon.tsx — colour ALWAYS from tokens (D-06); size from iconSize token set.
export function Icon({ name, state = "outline", size = "md", tone = "textPrimary" }: IconProps) {
  const { colors } = useTheme();
  const glyph = ICON_REGISTRY[name][state === "active" ? "filled" : "outline"];
  return <Ionicons name={glyph} size={ICON_SIZE[size]} color={colors[tone]} />;
}
```
The base family swaps at the registry map only (deferred custom family). Route the existing raw glyphs — `✕` in `CaptureScreen`/`LinksEditor`/`FuelEditor`, `◎`/`⚙` in `RootNavigator` — through the registry where practical (planner's scope call) `[VERIFIED: src/screens/CaptureScreen.tsx:656, src/components/LinksEditor.tsx:185, src/navigation/RootNavigator.tsx:44-46]`.

### Pattern 5: Status glyphs (THEME-08, D-05) — extend, don't fork
**What:** Distinct silhouettes per status, colour through tokens, readable without colour (glyph + border weight + text label).
**Extend the existing single source:** `ringVisual(status, colors)` in `src/components/contact-card-ring.ts` already maps status → `{color, opacity, width}` via tokens, no hex `[VERIFIED: src/components/contact-card-ring.ts:44-61]`. Add a parallel pure `statusGlyph(status)` → semantic glyph id in the SAME module (or a sibling), so card/profile/orrery/widget read ONE glyph+hue source. Render either through the icon registry or a Skia-tokenized path (colour via `useTheme().colors.*`). The five/six statuses (stable/wobble/decay/rogue/neutral/snoozed) each get a distinct silhouette — never a recoloured copy of one icon.

### Anti-Patterns to Avoid
- **Driving Skia motion from a React boolean** (D-07). Use the shared value inside worklets.
- **Reanimated `useReducedMotion()` for the live requirement.** Boot-time only; use `AccessibilityInfo`.
- **A hex literal outside `src/**/theme/**`.** `check:colors` fails the build; put every palette/accent/background-tint value under a `/theme/` path `[VERIFIED: scripts/check-colors.sh]`.
- **A second icon or status source** (D-05). One registry, one glyph+hue map.
- **AsyncStorage for any new theme pref** (D-08/D-09). It is not in the backup; use `app_settings`.
- **Editing a shipped migration** (CLAUDE.md / runner contract). Add migration 015 only.
- **`toISOString().split('T')[0]`** for the `created_at`/`modified_at` writes — use `formatLocalDate()`; migrations already take an injected `now` via `MigrationDeps` `[VERIFIED: src/db/migrations/002-app-settings.ts:59-78]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS colour scheme tracking | Manual `Appearance` listener | `useColorScheme()` (already in provider) | Re-renders provider on change automatically |
| Matched outline/filled icon pairs | Custom SVG set | Ionicons via `@expo/vector-icons` | Native paired glyphs = the state variants; custom family is deferred |
| Font loading for RN `<Text>` | Manual native font linking | `expo-font` `useFonts`/`loadAsync` | Bundled, no network; standard Expo path |
| Reduced-motion *live* signal | Polling / interval | `AccessibilityInfo.addEventListener('reduceMotionChanged')` | Event-driven, no battery cost |
| WCAG contrast ratio | ❗ *Do* hand-roll (small) | ~30-line pure `contrast.ts` in `src/theme/` | Avoids a dep; node-testable; formula is stable/standard (see below) |

**Key insight:** the contrast check is the one place a tiny hand-rolled function beats a library — the WCAG relative-luminance formula is fixed and short, and a pure module fits the existing node-testable `theme-presets`/`ringVisual` idiom while adding zero runtime deps to a local-first app. Everything else (icons, fonts, colour-scheme, a11y events) has a first-party primitive — use it.

## Common Pitfalls

### Pitfall 1: Reanimated `useReducedMotion()` silently satisfies the letter, not the spirit
**What goes wrong:** It compiles, returns a plausible boolean, and passes a quick test — but never updates when the user toggles reduced motion mid-session.
**Why:** By design it reads the value only at app start `[VERIFIED: useReducedMotion.d.ts]`.
**How to avoid:** Use the `AccessibilityInfo` subscription bridge (Pattern 1). **Warning sign:** motion doesn't stop until app restart.

### Pitfall 2: Wrong-theme flash appears only once light palettes exist
**What goes wrong:** With four palettes, the AsyncStorage/zustand async rehydrate paints the default then snaps to the saved palette.
**Why:** `zustand/persist` rehydration is async and non-gating `[VERIFIED: src/stores/theme-store.ts:29-45]`.
**How to avoid:** Read `app_settings` as a gating read folded into `App.tsx`'s `ready` gate (Pattern 3). **Warning sign:** a visible dark→light snap on cold start.

### Pitfall 3: A palette value placed outside `/theme/` fails `check:colors`
**What goes wrong:** Adding an accent/background-tint hex in a component breaks CI.
**Why:** `check:colors` only exempts paths matching `^[^:]*/theme/` `[VERIFIED: scripts/check-colors.sh]`.
**How to avoid:** All palette/accent/tint literals live under a `src/**/theme/**` path. **Warning sign:** `check-colors: forbidden colour literal(s) found`.

### Pitfall 4: Migration assumes a starting state / edits a shipped file
**What goes wrong:** A device jumping v1→v15 in one update wedges permanently — no remote repair.
**Why:** Migrations are forward-only, in strict order, irreversible on device `[VERIFIED: src/db/migrations/runner.ts:1-69]`.
**How to avoid:** Migration 015 is purely additive `ALTER TABLE app_settings ADD COLUMN … NOT NULL DEFAULT …` (mirror `014-interaction-assists.ts:25-26`); never touch 001–014. Seed defaults inline so a v0→v15 device lands clean `[VERIFIED: src/db/migrations/014-interaction-assists.ts, 002-app-settings.ts]`.

### Pitfall 5: Two separate font pipelines (Skia vs RN `<Text>`)
**What goes wrong:** Loading a font for `<Text>` does not make it available to Skia, and vice versa.
**Why:** The Orrery loads Inter through **Skia's** `useFonts({ Inter: [require("../../assets/Inter-SemiBold.ttf")] })` for canvas text; RN `<Text>` needs **`expo-font`** `[VERIFIED: src/screens/OrreryScreen.tsx:175-176, src/components/orrery/OrbitBody.tsx:138]`. `expo-font` is not yet a direct dep (only transitive under expo) `[VERIFIED: filesystem — node_modules/expo/node_modules/expo-font]`.
**How to avoid:** Load Inter + Space Grotesk via `expo-font` for `<Text>`, and (if canvas text needs Space Grotesk) also register it in the Skia `useFonts` map. Gate first paint on the `expo-font` load alongside the theme read. **Warning sign:** `<Text>` shows the system font while the Orrery shows Inter.

### Pitfall 6: `PORTABLE_SETTINGS_KEYS` omission silently drops prefs from backup
**What goes wrong:** New theme columns restore locally but vanish on restore-into-fresh-install.
**Why:** `assertPortableSettings` rejects any settings key not in the allowlist, and the wire projection only serialises listed keys `[VERIFIED: src/backup/backup-schema.ts:106-139]`.
**How to avoid:** Add every new theme key to `PORTABLE_SETTINGS_KEYS` (D-09), extend `PortableSettingsSnapshot`/`getPortableSettingsSnapshot`/`COLUMN_OF`/`WritableSettingsKey` in `app-settings-dao.ts`, and add a `assert*` validator per new column (the DAO validates every writable field before the UPDATE opens) `[VERIFIED: src/db/app-settings-dao.ts:134-300, 555-596]`. **Warning sign:** theme resets after restore.

## Code Examples

### Migration 015 — additive theme columns (mirror the proven idiom)
```typescript
// src/db/migrations/015-theme-settings.ts
// Source: proven additive pattern in 014-interaction-assists.ts:4-28 (verified).
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";
export const migration015: Migration = {
  version: 15,  // VERIFIED head+1 this session (TARGET_VERSION=14, latest 014-*)
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings ADD COLUMN theme_package TEXT NOT NULL DEFAULT 'galaxy'
        CHECK(theme_package IN ('galaxy','standard'));
      -- per-package memory: one column set per package (galaxy_* / standard_*)
      ALTER TABLE app_settings ADD COLUMN galaxy_mode TEXT NOT NULL DEFAULT 'system'
        CHECK(galaxy_mode IN ('light','dark','system'));
      ALTER TABLE app_settings ADD COLUMN galaxy_accent TEXT NOT NULL DEFAULT '#6C8CFF';
      ALTER TABLE app_settings ADD COLUMN galaxy_background TEXT NOT NULL DEFAULT 'deep-space-gradient';
      ALTER TABLE app_settings ADD COLUMN standard_mode TEXT NOT NULL DEFAULT 'system'
        CHECK(standard_mode IN ('light','dark','system'));
      ALTER TABLE app_settings ADD COLUMN standard_accent TEXT NOT NULL DEFAULT '#5566B5';
      ALTER TABLE app_settings ADD COLUMN standard_background TEXT NOT NULL DEFAULT 'soft-gradient';
    `);
  },
};
// NOTE: accent hex defaults live here as SQL DEFAULT literals, not in a .ts colour file —
//       verify check:colors scope does not scan migrations (it scans src/**/*.ts{,x});
//       migrations ARE under src/, so prefer defaulting to a NULL/enum id resolved to a
//       palette value at render, OR confirm the DEFAULT literal is acceptable. FLAG for planner.
```
> ⚠️ **Planner decision:** `check:colors` scans `src` recursively `[VERIFIED: scripts/check-colors.sh — default target `src`]`, and migrations live under `src/db/migrations/` (NOT under a `/theme/` path), so a raw `#RRGGBB` DEFAULT in migration 015 **would trip the gate**. Prefer storing an **accent id / enum** (resolved to a hex at render via `accents.ts` under `src/theme/`) rather than a hex string in the column, OR store `NULL` and resolve the package default at render (the exact idiom `self_sun_colour` already uses — NULL → `starPalette[0]` at render) `[VERIFIED: src/db/app-settings-dao.ts:66-71, 346-349]`. This also keeps the accent palette swappable without a data migration.

### Contrast validation (pure, node-testable — THEME-11)
```typescript
// src/theme/contrast.ts  — Source: WCAG 2.x relative-luminance definition (stable formula).
function channel(c: number): number { const s = c / 255; return s <= 0.03928 ? s/12.92 : ((s+0.055)/1.055)**2.4; }
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126*channel((n>>16)&255) + 0.7152*channel((n>>8)&255) + 0.0722*channel(n&255);
}
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x,y)=>y-x);
  return (l1 + 0.05) / (l2 + 0.05);
}
export const AA_NORMAL = 4.5, AA_LARGE = 3.0;  // AA-equivalent thresholds
```
Run as a vitest check over all four palettes × (text-on-surface, accent-as-link, on-accent foreground, status-on-surface) and fail any accent that misses AA in any combo (drops it from the curated palette, per the UI-SPEC validation gate).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reanimated `useReducedMotion()` for a11y motion | `AccessibilityInfo` event bridge → shared value | ongoing (RN added `reduceMotionChanged`) | Only the event bridge is live; the hook is boot-time |
| AsyncStorage theme prefs | `app_settings` SQLite columns (backup-portable) | this phase (D-08) | Prefs survive backup/restore |
| Single dark preset + `light?` fallback | Four required palettes; `resolvePalette` dark-fallback stops being load-bearing | this phase | `ThemePreset.light` becomes required |
| Colour + border weight for status | + distinct silhouette glyph (redundant channel) | this phase (D-05) | Status readable without colour |

**Deprecated/outdated for this phase:**
- HANDOFF §7 "starfield dashboard/orbit-only" — superseded 2026-09-01 (D-04). Plan against the dossier.
- ADR-048 tap-to-freeze / live creeping motion — superseded; do not reinstate.

## Runtime State Inventory

> This phase migrates a stored preference (AsyncStorage `orbit-theme`) — inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | AsyncStorage key `orbit-theme` (`{mode, presetId}`), written by `zustand/persist` `[VERIFIED: src/stores/theme-store.ts:34, only usage in src/]` | **Data migration**: read the value once at boot; import `mode` into `app_settings` (map `presetId "space-dark"` → package `galaxy`), then read-once-then-clear vs one-time-import (D-08, plan's call). Also a **code edit**: repoint the store's source of truth to `app_settings`. |
| Live service config | None — appearance has no external service (local-first, no network per D/E) | None |
| OS-registered state | None — theme is not registered with any OS scheduler/widget config | None (the widget bitmap uses a separate `widget-colors.ts`, no theme provider — do NOT wire the provider into the headless widget) `[VERIFIED: contact-card-ring.ts:15-17 note]` |
| Secrets/env vars | None — no theme secrets; accent/star colours are plain prefs | None |
| Build artifacts | New font asset(s) in `assets/` (Space Grotesk `.ttf`); `expo-font`/`@expo/vector-icons`/`expo-blur` added to `package.json` | Bundle fonts locally; run `npx expo install`; rebuild dev client (native deps → new build required, not just Metro reload) |

**Canonical question — after every file is updated, what still has the old value cached?** Only the AsyncStorage `orbit-theme` blob on each existing device. The migration must read it at boot (device-local, one-time) — a code-only rename does not move it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ionicons semantic-name mapping choices (`heart` for favorite, `chatbubble` for message, etc.) | Icon Registry | Low — cosmetic; registry seam makes remapping trivial |
| A2 | Space Grotesk for Display/Heading; Inter Regular to be added | Typography/Fonts | Low — discretion grant; owner may retune font families |
| A3 | Accent palette hexes and status glyph silhouettes (UI-SPEC *(discretion)* defaults) | Color/Status Glyphs | Medium — must pass the AA gate (THEME-11) or be dropped; owner taste |
| A4 | Token values (spacing/radii/motion timings) as proposed in UI-SPEC | Tokens | Low — discretion; tunable single-number edits |
| A5 | `check:colors` scans migrations (they are under `src/`), so a hex DEFAULT in migration 015 would trip it | Migration 015 | Medium — drove the "store accent id/NULL not hex" recommendation; planner must confirm scope |
| A6 | expo-blur is genuinely optional (dossier fallback is a tinted token) | Surface/Glass | Low — can ship glass-*like* surfaces with zero blur dep |
| A7 | Package-legitimacy seam unavailable; verdicts from `npm view` + Expo first-party provenance | Package Audit | Low — all first-party Expo; `npx expo install` is the authoritative pin |

## Open Questions

1. **Accent storage: hex string vs enum id vs NULL-resolved-at-render?**
   - What we know: `check:colors` scans `src` and migrations live under `src/db/` (not a `/theme/` path); `self_sun_colour` already uses the NULL→render-resolve idiom.
   - Recommendation: store an **accent id** (or NULL) and resolve to a hex in `src/theme/accents.ts` at render. Keeps the palette swappable and the gate green. **Planner decides.**

2. **`orbit-theme` migration: read-once-then-clear vs one-time import?** (D-08, explicitly the plan's call.)
   - What we know: only `mode` + `presetId` exist there; one preset today.
   - Recommendation: one-time import at boot (map `presetId → galaxy`, carry `mode`), then clear the AsyncStorage key to avoid a second import. **Planner decides.**

3. **Scope of routing existing raw glyphs (`✕`/`◎`/`⚙`) through the registry now vs later.** (Explicitly planner's scope call per UI-SPEC.)
   - Recommendation: build the registry + convert the tab-bar glyphs (`RootNavigator`) this phase (highest visibility); leave in-form `✕` conversions to consuming phases if scope is tight.

4. **Does any canvas (Skia) text need Space Grotesk, or only RN `<Text>`?**
   - What we know: Orrery loads only Inter into Skia today.
   - Recommendation: load Space Grotesk via `expo-font` for `<Text>`; add to the Skia `useFonts` map only if a canvas surface renders display text. **Planner/executor confirms during build.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `react-native` Appearance/AccessibilityInfo | THEME-01/06 | ✓ | 0.86.2 | — |
| `react-native-reanimated` | THEME-06 (shared value) | ✓ | 4.5.1 | — |
| `@shopify/react-native-skia` | THEME-06/12 (render loop) | ✓ | 2.6.2 | — |
| `expo-sqlite` | THEME-13 | ✓ | ~57.0.1 | — |
| `@expo/vector-icons` | THEME-09 | ✗ (add) | 15.1.1 | none needed — `npx expo install` |
| `expo-font` | THEME (fonts) | ✗ direct (✓ transitive) | 57.0.3 | `npx expo install` to make it a direct dep |
| `expo-blur` | THEME-05 (optional) | ✗ (add) | 57.0.2 | **semi-opaque tinted surface token (dossier fallback) — blur is optional** |
| Space Grotesk `.ttf` | Typography | ✗ (add asset) | OFL 1.1 | Inter for all roles if not bundled (degraded, not blocking) |

**Missing with fallback:** `expo-blur` (tinted token), Space Grotesk (Inter fallback). **Missing, blocking none** — all addable via `npx expo install`. Native deps require a **new dev-client build** (per CLAUDE.md build pipeline: build on `droid`, install on the Pixel), not just a Metro reload.

## Validation Architecture

> Nyquist validation is enabled for this phase (no `workflow.nyquist_validation: false` found).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (node env) `[VERIFIED: package.json devDependencies]` |
| Config file | none detected — vitest run via `npm test` `[VERIFIED: package.json scripts.test = "vitest run"]` |
| Quick run command | `npx vitest run src/theme` (targeted) |
| Full suite command | `npm test` |
| Colour gate | `npm run check:colors` `[VERIFIED: package.json + scripts/check-colors.sh]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| THEME-01 | `resolveMode`/`resolvePalette` across 4 combos + package axis | unit | `npx vitest run src/theme/theme-presets.test.ts` | ✅ exists (extend for package axis + 4 palettes) `[VERIFIED: src/theme/theme-presets.test.ts]` |
| THEME-11 | Every accent/text/status passes AA in all 4 combos | unit | `npx vitest run src/theme/contrast.test.ts` | ❌ Wave 0 (new `contrast.ts` + test) |
| THEME-08 | `statusGlyph(status)` distinct per status; `ringVisual` unchanged | unit | `npx vitest run src/components/contact-card-ring.test.ts` | ⚠️ ringVisual tested; add glyph-map test (Wave 0) |
| THEME-06 | reduced-motion hook seeds + subscribes; no setState in worklet path | unit (mock `AccessibilityInfo`) + device UAT | `npx vitest run src/theme/use-reduced-motion.test.ts` | ❌ Wave 0 |
| THEME-13 | migration 015 additive; DAO read/write; `PORTABLE_SETTINGS_KEYS` carries new keys | unit + migration test | `npx vitest run src/db/migrations/015-theme-settings.test.ts src/db/app-settings-dao.test.ts` | ⚠️ DAO test exists; add migration 015 test + portable-keys assertion (Wave 0) |
| THEME-03 | restore-before-paint gating (import mapping pure fn) | unit | `npx vitest run src/theme/orbit-theme-migration.test.ts` | ❌ Wave 0 |
| THEME-09 | registry maps every semantic name; screens use names only | unit | `npx vitest run src/components/icons/icon-registry.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed src/theme|src/db path>` + `npm run check:colors <changed files>`
- **Per wave merge:** `npm test` + `npm run check:colors`
- **Phase gate:** full suite + `check:colors` green; **device UAT on the Pixel** for reduced-motion live toggle, no-wrong-theme-flash cold start, and all-four-combo visual pass (emulator cannot assess Skia perf per CLAUDE.md; the Pixel can).

### Wave 0 Gaps
- [ ] `src/theme/contrast.ts` + `contrast.test.ts` — THEME-11
- [ ] `src/theme/use-reduced-motion.ts` + test (mock `AccessibilityInfo`) — THEME-06
- [ ] `src/db/migrations/015-theme-settings.ts` + test — THEME-13
- [ ] `src/theme/orbit-theme-migration.ts` (pure `orbit-theme` → columns mapper) + test — THEME-03/D-08
- [ ] `src/components/icons/icon-registry.ts` + test — THEME-09
- [ ] Extend `theme-presets.test.ts` for the package axis + 4 required palettes — THEME-01
- [ ] `full-chain.test.ts` migration chain extends to 015 `[VERIFIED: src/db/migrations/full-chain.test.ts exists]`
- [ ] Framework install: none — Vitest already present.

## Security Domain

> `security_enforcement` not disabled; included. This phase is local-first with **no network path** — the attack surface is small.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in a local-first app |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-device, no multi-user |
| V5 Input Validation | yes | DAO `assert*` validators on every new column write (accent/mode/package must be validated to the enum/hex shape before UPDATE) `[VERIFIED: src/db/app-settings-dao.ts:460-596]` |
| V6 Cryptography | no | No secrets in theme prefs (star/accent are plain prefs) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed theme value from a tampered backup restore | Tampering | Validate new columns in `assertPortableSettings` + DAO `assert*` before UPDATE; `CHECK` constraints in migration 015 `[VERIFIED: backup-schema.ts:129-139, app-settings-dao.ts:555-596]` |
| Backup exfiltration of secrets via new keys | Info Disclosure | New keys are plain prefs; `SECRET_SHAPED_KEY` regex + allowlist already reject secret-shaped keys `[VERIFIED: backup-schema.ts:115-135]` |
| No network introduced on a read path | (local-first invariant) | Fonts/backgrounds bundled locally (`require()`), no CDN — enforced by dossier §E and CLAUDE.md |

**Hermes note:** no theme code path needs `globalThis.crypto` (no hashing/UUID in theming); the avatar swatch hash is a plain integer hash, not crypto. No Hermes crypto guard needed here `[VERIFIED: no crypto usage in src/theme or contact-card-ring]`.

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/theme/` (`theme-types.ts`, `theme-presets.ts`, `theme-provider.tsx`, `index.ts`) — current engine, one dark preset, pure resolvers
- `src/stores/theme-store.ts` — AsyncStorage `orbit-theme` persist (the value to migrate)
- `src/db/migrations/` (`runner.ts`, `002-app-settings.ts`, `014-interaction-assists.ts`, `full-chain.test.ts`), `src/db/database.ts` (`TARGET_VERSION = 14`) — migration head+1 = 015
- `src/db/app-settings-dao.ts` — DAO read/write/validate idiom; NULL-resolve-at-render pattern
- `src/backup/backup-schema.ts` — `PORTABLE_SETTINGS_KEYS`, `assertPortableSettings`
- `src/components/contact-card-ring.ts` — status→ring token mapping (extend for glyphs)
- `src/components/orrery/OrreryCanvas.tsx`, `src/screens/OrreryScreen.tsx` — Skia `useClock`+`useDerivedValue` render-loop pattern; Skia `useFonts` idiom
- `App.tsx` — boot `ready` gate to fold theme read into
- `scripts/check-colors.sh` — the hex-literal gate scope
- `node_modules/react-native-reanimated/lib/typescript/hook/useReducedMotion.d.ts` — boot-time-only confirmation
- `node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.d.ts` — `reduceMotionChanged` + `isReduceMotionEnabled`

### Secondary (MEDIUM confidence — verified against registry/docs)
- `npm view` for `@expo/vector-icons@15.1.1`, `expo-blur@57.0.2`, `expo-font@57.0.3`, `@expo-google-fonts/space-grotesk@0.4.1`
- [Space Grotesk OFL 1.1](https://github.com/floriankarsten/space-grotesk/blob/master/OFL.txt)
- [Reanimated ReducedMotionConfig / accessibility docs](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/)

### Tertiary (LOW confidence)
- WebSearch corroboration that Reanimated `useReducedMotion` is boot-time only (cross-checked against the on-disk type doc, which is authoritative)

## Metadata

**Confidence breakdown:**
- Integration unknowns (reduced motion, follow-system, restore-before-paint, persistence): HIGH — verified against on-disk code + library type defs
- Standard stack + versions: HIGH — `npm view` + `package.json` + filesystem
- Migration number (015): HIGH — `TARGET_VERSION=14`, latest `014-*` on disk
- Token/accent/glyph specifics: MEDIUM — discretion defaults from UI-SPEC, subject to the AA gate and owner taste
- `check:colors`-scans-migrations claim: MEDIUM — inferred from the script's default `src` target; planner should confirm

**Research date:** 2026-09-03
**Valid until:** 2026-10-03 (stable stack; re-verify migration head+1 at plan time — it drifts every schema phase)
