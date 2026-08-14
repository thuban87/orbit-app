# Phase 1: Project Scaffold & Portable Code - Research

**Researched:** 2026-08-14
**Domain:** Expo/React Native scaffold (SDK 57), theme-token architecture, Obsidian→RN code extraction, cross-machine Android build pipeline
**Confidence:** HIGH (stack + ports verified against live registry and actual source; pipeline bring-up MEDIUM — owner-gated steps unverified this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Pure infrastructure phase — grey-area discussion skipped per smart-discuss infrastructure detection. Implementation choices are at Claude's discretion, **bounded by the authoritative decisions already recorded** in HANDOFF.md, CLAUDE.md, PROJECT.md, and the dossier — those are `[DECIDED]`, not open for reversal.

**Load-bearing constraints this phase must honour (not choices):**
- Reuse quest-board's RN scaffolding + theme-token pattern where it transfers (HANDOFF §2, PROJECT Constraints).
- Every colour resolves through a theme token — **no hardcoded colours anywhere** (CLAUDE.md).
- Portrait-locked at the config layer; Biome for lint/format.
- Keep `formatLocalDate()`'s comment/intent intact — it deliberately avoids the `toISOString()` UTC off-by-one already fixed once in the plugin. Never reintroduce `toISOString().split('T')[0]`.
- `AiService.ts`: swap the sole Obsidian coupling `import { requestUrl } from 'obsidian'` for `fetch`, with explicit `response.ok` handling. Port faithfully, do not redesign here.
- `types.ts` line 1 imports `TFile` from `obsidian` and `OrbitContact` carries `file: TFile` — strip/generalise to an opaque ref so `types.ts` becomes 100% portable (HANDOFF §4).

### Claude's Discretion
Implementation details of the scaffold, theme-token module shape, Zustand store scaffold, Biome ruleset, and project structure — bounded by the recorded decisions above and quest-board conventions.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase; discussion stayed within scope. SQLite/migrations → Phase 2; custom fields → Phase 3; the Obsidian *data* importer was cut entirely by the owner (only *code* porting survives).

**Explicitly NOT in scope this phase:** SQLite schema/migrations (Phase 2), custom fields (Phase 3), any contact CRUD or UI feature. `AiService.ts` compiles standalone but is **not** connected to any screen. Do NOT port `schemas/loader.ts` (Phase 3, only `keyToLabel()` salvaged later).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Expo/RN app builds + launches to a home shell on the Pixel 6 Pro through the desktop-build → install pipeline (proven once). | Scaffold command + `expo prebuild`/`gradlew assembleDebug` over SSH to `droid`; flat (non-monorepo) app means **no** `patch-build-gradle` hack needed. See Environment Availability + Pitfall 6. |
| FND-02 | Extract portable plugin files into `src/` as tracked, linted, typed source. | All 7 source files read in place and verified; grep confirms zero Obsidian refs in schemas/dates/logger. See Code Examples + Standard Stack "Portable Source Map". |
| FND-03 | `types.ts` free of Obsidian coupling (`TFile` stripped); extracted files typecheck. | Exactly two lines to strip (`types.ts:1` import, `types.ts:49` field). `tsc --noEmit` is the gate. See Pitfall 1. |
| FND-04 | `AiService.ts` ported with `requestUrl`→`fetch` + explicit `response.ok`, decoupled from Obsidian types (not wired to UI). | 7 `requestUrl` call sites + 6 `response.json` reads mapped file:line; local settings interface replaces `../settings` import. See Code Examples + Pitfall 2. |
| FND-05 | Theme-token module + Zustand store scaffold (quest-board pattern); no hardcoded colours. | quest-board `packages/ui` theme module + `stores/theme-store.ts` read in full; flat-repo adaptation given. See Architecture Patterns. |
| FND-06 | Biome lint/format, portrait-lock, CLAUDE.md folder layout configured. | quest-board `biome.json` + `app.config.ts orientation:"portrait"` verified working. See Architecture Patterns + Pitfall 4. |
</phase_requirements>

## Summary

This is a from-scratch Expo scaffold (`/home/bwales/projects/orbit-app` has **no `package.json`, empty `src/`**) plus a mechanical, low-risk extraction of ~900 lines of pure logic/types from the Obsidian plugin at `~/projects/Orbit/src`. The stack is pinned and verified current: **Expo SDK 57.0.12 (React Native 0.86, React 19.2, New Architecture always-on since SDK 55), TypeScript ~5.9, expo-sqlite 57.0.1, Zustand 5.0.15, Biome 2.5.8.** The reference implementation for every scaffold pattern — theme tokens, Zustand persistence, `app.config.ts` portrait lock, Biome config — is the sibling repo `~/projects/quest-board-app` (Expo SDK 55), which was read in full; its patterns transfer directly with one structural divergence: **quest-board is an npm-workspaces monorepo, Orbit is a flat single app**, so the monorepo build hacks (`patch-build-gradle.js`, Metro `watchFolders`, `packages/*` path aliases) must **not** be copied.

The port itself is nearly trivial and fully mapped to file:line. `types.ts` needs exactly two deletions (`TFile` import on line 1, `file: TFile` field on line 49) to become 100% portable. `AiService.ts` needs the `requestUrl` import removed, 7 call sites converted to `fetch`, and — the one genuine trap — **6 `const data = response.json;` property reads converted to `await response.json()` method calls**, because Obsidian's `requestUrl` returns a pre-parsed `.json` property whereas `fetch` returns a `Response` whose `.json()` is an async method. The other five files (`schemas/types.ts`, both schemas, `dates.ts`, `logger.ts`) port verbatim (grep-confirmed zero Obsidian references).

The real risk in this phase is **not** the code — it is proving the cross-machine build loop (FND-01). This Linux box cannot build Android APKs; the loop is commit → rsync/scp the repo to the Windows desktop (`droid`) → `expo prebuild` + `gradlew assembleDebug` over SSH → pull the APK back → `adb install` on the wired Pixel 6 Pro. Several steps of this loop are **owner-gated** (SSH host block + first-auth host-key accept, Windows toolchain confirmation, on-device USB-debug prompt, package-id and Windows-username confirmation) and cannot be completed by an agent. The planner must front-load these as a `checkpoint:human-verify` gate before FND-01 can be declared proven.

**Primary recommendation:** Scaffold a flat Expo SDK 57 app with `create-expo-app`, install the pinned stack (including `expo-sqlite` now so Phase 2 needs no native rebuild), mirror quest-board's theme-token + Zustand + Biome patterns into flat `src/theme` / `src/stores`, extract the 7 portable files with the two `types.ts` deletions and the `requestUrl`→`fetch`+`await response.json()` swap in `AiService.ts`, and gate FND-01 behind an owner checkpoint for the SSH/Pixel bring-up. Use `tsc --noEmit` + `biome check` + a small Vitest suite over the pure functions as the automated validation gates.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App shell / navigation | Client (RN JS) | — | Local-first app; there is no server tier at all. Home shell renders on-device. |
| Theme resolution (tokens → colours) | Client (React context) | — | `useTheme()` provider pattern; no colour resolves anywhere else. |
| State (Zustand stores) | Client (JS) + on-device persistence | AsyncStorage | Persisted via `zustand/middleware persist` → AsyncStorage; no network. |
| Status calculation (`calculateStatus`) | Client (pure function) | — | Pure logic, derived-never-stored (per DATA-05 later); belongs in `src/` logic, callable from JS thread. |
| AI provider HTTP (`AiService`) | Client → external AI provider (HTTPS) | — | The **only** network egress in the whole app, and only when user-invoked. Not wired this phase. |
| Android APK build | External build host (`droid` / Windows) | Pixel 6 Pro (install target) | This box cannot compile; build tier is physically a different machine reached over SSH. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo` | `57.0.12` (`latest`) | Expo SDK 57 framework | [VERIFIED: npm registry] `latest` dist-tag = 57.0.12; PROJECT.md pins SDK 57. Bundles RN 0.86 / React 19.2. |
| `react-native` | `0.86.x` (SDK-57 pinned) | RN runtime | [VERIFIED: web + npm] SDK 57 ships RN 0.86 (registry `latest` is 0.87 — do **not** install that; let `expo install` resolve the SDK-pinned 0.86). |
| `react` / `react-dom` | `19.2.x` | React | [VERIFIED: web search] React unchanged at 19.2 across SDK 56/57. |
| `typescript` | `~5.9.x` | Types | [CITED: quest-board apps/mobile devDeps `~5.9.2`] Matches Expo tsconfig base. |
| `expo-sqlite` | `57.0.1` | On-device SQLite (Phase 2) | [VERIFIED: npm registry] Install **now** as a config plugin so the first prebuild covers it — avoids a second native rebuild in Phase 2. |
| `zustand` | `5.0.15` | State stores | [VERIFIED: npm registry] quest-board uses `^5.0.12`; API stable. |
| `@react-native-async-storage/async-storage` | SDK-pinned (`expo install`) | Zustand persistence backend | [CITED: quest-board theme-store] Required by the `persist` middleware pattern. |
| `@biomejs/biome` | `2.5.8` | Lint + format | [VERIFIED: npm registry] quest-board uses `2.4.10`; config schema is version-pinned in `biome.json`. |

### Supporting (scaffold defaults + shell)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-status-bar` | `57.x` (`expo install`) | Status bar control | [VERIFIED: npm registry OK] Scaffold default; part of edge-to-edge portrait shell. |
| `react-native-safe-area-context` | SDK-pinned | Safe-area insets for home shell | [VERIFIED: npm registry] Scaffold default. |
| `react-native-screens` | SDK-pinned | Native screen primitives | Scaffold default (needed if using expo-router/navigation). |
| `expo-router` | SDK-pinned | File-based routing | quest-board uses it; **optional** for a single home shell. See Alternatives. |
| `vitest` | `^4.x` | Unit tests for pure functions | [CITED: quest-board + plugin both use Vitest] Test `calculateStatus`, `formatLocalDate`, parsers without an RN runtime. See Validation Architecture. |

### Deferred to later phases (do NOT install this phase)
| Library | Version | Phase | Note |
|---------|---------|-------|------|
| `@shopify/react-native-skia` | `2.6.2` | Orrery (13) / Photos (5) | Orrery + Skia crop. Native dep. |
| `react-native-reanimated` | `4.5.1` | Orrery (13) | Gestures/animation. Needs babel plugin. |
| `react-native-android-widget` | `0.22.0` | Widget (12) | [VERIFIED: npm registry] Requires custom dev client. |
| `expo-share-intent` | `8.0.1` | Capture (10) | [VERIFIED: npm registry] Share-sheet target. |
| `expo-secure-store` | `57.x` | AI (14) | API-key storage (AI-01). |
| `expo-notifications` | `57.x` | Notifications (11) | Local notifications. |

### Portable Source Map (verified in place at `~/projects/Orbit/src`)
| Source file | Lines | Obsidian refs | Action | Destination |
|-------------|-------|---------------|--------|-------------|
| `services/AiService.ts` | 540 | 1 import + 7 `requestUrl` calls | Port; `requestUrl`→`fetch`; `.json`→`await .json()`; local settings interface | `src/services/AiService.ts` |
| `types.ts` (subset) | 191 | `TFile` (line 1 + 49) | Port pure logic + types; delete 2 lines | `src/types.ts` (or `src/logic/status.ts`) |
| `schemas/types.ts` | 99 | 0 (grep-confirmed) | Port verbatim | `src/schemas/types.ts` |
| `schemas/new-person.schema.ts` | 72 | 0 | Port verbatim | `src/schemas/new-person.schema.ts` |
| `schemas/edit-person.schema.ts` | 72 | 0 | Port verbatim | `src/schemas/edit-person.schema.ts` |
| `utils/dates.ts` | 22 | 0 | Port verbatim (keep comment) | `src/utils/dates.ts` |
| `utils/logger.ts` | 43 | 0 | Port verbatim (Biome `any` caveat, Pitfall 5) | `src/utils/logger.ts` |

**`types.ts` exports to port:** `Frequency`, `FREQUENCY_DAYS`, `OrbitStatus`, `SocialBattery`, `LastInteractionType`, `OrbitContact` (minus `file`), `calculateStatus()`, plus the helpers present in the same file — `calculateDaysSince()`, `calculateDaysUntilDue()`, `parseDate()`, `isValidFrequency()`. All pure. `AiService` consumes `OrbitContact` fields `name`/`category`/`lastContact`/`lastInteraction`/`daysSinceContact`/`socialBattery` — **none is `file`**, so dropping `file: TFile` is safe for compilation.

**Do NOT port:** `schemas/loader.ts` (479 lines, 23 Obsidian refs — Phase 3 salvages only `keyToLabel()`), `services/OrbitIndex.ts`, `services/ContactManager.ts`, `settings.ts`, `services/LinkListener.ts`, all `components/`/`views/`/`modals/`, `utils/ImageScraper.ts`, `utils/FolderSuggest.ts`, `utils/paths.ts`, `main.ts`.

**Installation (scaffold):**
```bash
# From ~/projects/ (creates ./orbit-app files into the existing dir; see Pitfall 6 re: non-empty dir)
npx create-expo-app@latest orbit-app --template   # pick the SDK 57 default / blank-typescript template
# Then, inside the repo, pin the stack via expo install (resolves SDK-57-correct versions):
npx expo install expo-sqlite expo-status-bar react-native-safe-area-context @react-native-async-storage/async-storage
npm install zustand
npm install -D @biomejs/biome@2.5.8 vitest
```
> **Always use `npx expo install`** (not bare `npm install`) for any Expo/RN native package — it resolves the version matched to the installed SDK. Bare `npm install react-native` would pull 0.87 and break the SDK-57 pin.

**Version verification performed this session (npm registry, 2026-08-14):**
- `expo` latest = 57.0.12 ✓ · `expo-sqlite` = 57.0.1 ✓ · `zustand` = 5.0.15 ✓ · `@biomejs/biome` = 2.5.8 ✓ · `react-native` latest = 0.87.0 (SDK 57 pins 0.86 — use `expo install`) · React = 19.2.x ✓ · `create-expo-app` = 4.0.0 ✓

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm expo expo-sqlite zustand @biomejs/biome expo-status-bar react-native-safe-area-context`.

| Package | Registry | Age (last publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|--------------------|--------------|-------------|---------|-------------|
| `expo` | npm | 2026-08-10 | 7.7M | github.com/expo/expo | SUS (`too-new`) | Approved — recency false-positive |
| `expo-sqlite` | npm | 2026-07-15 | 907K | github.com/expo/expo | OK | Approved |
| `zustand` | npm | 2026-08-13 | 50.6M | github.com/pmndrs/zustand | SUS (`too-new`) | Approved — recency false-positive |
| `@biomejs/biome` | npm | 2026-08-11 | 12.5M | github.com/biomejs/biome | SUS (`too-new`) | Approved — recency false-positive |
| `expo-status-bar` | npm | 2026-07-15 | 6.0M | github.com/expo/expo | OK | Approved |
| `react-native-safe-area-context` | npm | 2026-08-12 | 8.1M | github.com/AppAndFlow/react-native-safe-area-context | SUS (`too-new`) | Approved — recency false-positive |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `expo`, `zustand`, `@biomejs/biome`, `react-native-safe-area-context` — **all four are false positives.** The only reason flagged is `too-new` (a patch/minor released within days of this research). Each has a multi-million weekly download count, an official well-known source repo, no `postinstall`, and is not deprecated — none of the SLOP/slopsquat signals is present. These are the canonical, actively-maintained mainstream packages; the `too-new` heuristic simply fires on frequent legitimate releases. No `checkpoint:human-verify` needed. If the planner wants belt-and-suspenders, pin exact versions and let `expo install` resolve them.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │        DEV / BUILD LOOP (FND-01)             │
  edit code ──commit──▶ │  Linux box (this machine) — cannot build APK │
                        └───────────────┬─────────────────────────────┘
                          rsync/scp over SSH (NOT git push)
                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │  droid (Windows desktop)                     │
                        │  C:\Users\bwles\projects\orbit-app           │
                        │  npm install → expo prebuild → gradlew        │
                        │  assembleDebug → app-debug.apk               │
                        └───────────────┬─────────────────────────────┘
                          scp/pull APK back
                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │  Linux box → adb install (~/.local/bin/adb)  │
                        │  → Pixel 6 Pro (USB, emu-connect)            │
                        └─────────────────────────────────────────────┘

           RUNTIME (on-device, no server tier):
  ┌──────────────┐   useTheme()   ┌───────────────┐
  │ Home shell   │◀──────────────▶│ ThemeProvider │──▶ colors/spacing/typography tokens
  │ (RN screen)  │                └───────────────┘
  │              │   useStore()   ┌───────────────┐   persist    ┌──────────────┐
  │              │◀──────────────▶│ Zustand store │─────────────▶│ AsyncStorage │
  └──────────────┘                └───────────────┘              └──────────────┘
     (portable pure logic: calculateStatus, formatLocalDate, schemas — imported, not yet surfaced)
     (AiService: compiles standalone, fetch→AI provider over HTTPS — NOT wired to any screen this phase)
```

### Recommended Project Structure (flat — NOT monorepo)
```
orbit-app/
├── app.config.ts          # Expo config: name, slug, package, orientation:"portrait", plugins:[expo-sqlite]
├── biome.json             # Lint/format (schema 2.5.8)
├── babel.config.js        # babel-preset-expo (add reanimated plugin only when Skia/Reanimated land)
├── tsconfig.json          # extends expo/tsconfig.base; strict:true; "@/*":["./src/*"]
├── index.js / App entry
├── src/
│   ├── theme/             # colors.ts, theme-types.ts, theme-presets.ts, theme-provider.tsx (useTheme)
│   ├── stores/            # Zustand stores (theme-store.ts scaffold, persist→AsyncStorage)
│   ├── services/          # AiService.ts (ported, standalone)
│   ├── schemas/           # types.ts + new-person.schema.ts + edit-person.schema.ts (verbatim)
│   ├── utils/             # dates.ts, logger.ts (verbatim)
│   ├── types.ts           # ported status logic + types (TFile stripped)  [or src/logic/status.ts]
│   ├── db/                # (empty this phase — Phase 2 SQLite)
│   ├── components/        # (empty/minimal this phase)
│   └── screens/           # home shell
└── docs/ …                # existing KB
```
> Matches CLAUDE.md "Repo layout". **Do not** create `apps/` or `packages/` — that is quest-board's monorepo shape and does not apply here.

### Pattern 1: Theme-token module (mirror quest-board `packages/ui` → flat `src/theme`)
**What:** Static base colours + per-preset/mode dynamic palette, resolved once by a `ThemeProvider` and read everywhere via a `useTheme()` hook. No component ever references a hex value.
**When to use:** Every colour, everywhere — including future Skia draw calls (CLAUDE.md).
**Shape (verified from `~/projects/quest-board-app/packages/ui`):**
```typescript
// Source: quest-board packages/ui/theme-types.ts + theme-provider.tsx (read in full this session)
// src/theme/theme-types.ts
export interface ThemePalette {
  background: string; surface: string; surfaceElevated: string;
  accent: string; textPrimary: string; textSecondary: string;
  border: string; borderStrong: string;
}
// src/theme/theme-provider.tsx
export function useTheme(): ResolvedTheme {
  const t = useContext(ThemeContext);
  return t ?? /* default-preset fallback so tests/components outside provider still resolve */;
}
```
Orbit adaptation: one space-themed dark preset is enough this phase (the actual visual design is the owner's, HANDOFF §7 + Q4). Ship the *token infrastructure* + `useTheme()`, not a finished palette. Do **not** hardcode the monorepo `@quest-board/ui` package boundary — put it in `src/theme` and import via `@/theme`.

### Pattern 2: Zustand store with persistence (mirror `apps/mobile/stores/theme-store.ts`)
**What:** `create<T>()(persist((set,get)=>({...}), { name, storage: createJSONStorage(()=>AsyncStorage), version, partialize, onRehydrateStorage }))`.
```typescript
// Source: quest-board apps/mobile/src/stores/theme-store.ts (read in full)
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({ /* state + actions */ }),
    { name: "orbit-theme", storage: createJSONStorage(() => AsyncStorage), version: 1,
      partialize: (s) => ({ /* only what to persist */ }) },
  ),
);
```
FND-05 asks only for a *scaffold* — one working persisted store proves the pattern. Zustand v5 has no `subscribeWithSelector` by default; quest-board uses the full-state listener form — copy that if cross-store subscription is needed.

### Pattern 3: Portrait lock + package id via `app.config.ts`
**What:** Config-layer orientation lock (CLAUDE.md: "portrait-locked at the config layer").
```typescript
// Source: quest-board apps/mobile/app.config.ts (verified working, SDK 55; field unchanged in SDK 57)
const config: ExpoConfig = {
  name: "Orbit", slug: "orbit", orientation: "portrait",   // ← the lock
  android: { package: "com.<owner>.orbit", predictiveBackGestureEnabled: false },
  plugins: ["expo-sqlite"],   // add now so first prebuild covers Phase 2's native dep
};
```
> New Architecture is **always-on** since SDK 55 — no `newArchEnabled` flag needed (do not re-derive). `orientation:"portrait"` is the correct SDK-57 field; confirm the package id string with the owner (Open Questions).

### Pattern 4: Biome config (mirror `biome.json`, drop monorepo-only bits)
```jsonc
// Source: quest-board biome.json (schema 2.4.10 → bump to 2.5.8)
{
  "$schema": "https://biomejs.dev/schemas/2.5.8/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["**", "!.planning", "!android", "!**/dist"] },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```
Drop quest-board's `expo-haptics` `noRestrictedImports` rule and the custom `.grit` plugin (project-specific). Add `!android` to `files.includes` so the generated native folder is never linted.

### Anti-Patterns to Avoid
- **Copying quest-board's monorepo build machinery.** `patch-build-gradle.js`, `scripts/expo-cli-wrapper.js`, Metro `watchFolders`/`nodeModulesPaths`, and `packages/*` tsconfig aliases exist solely to fix npm-workspaces hoisting. Orbit is flat — copying them creates a broken build that looks configured.
- **Bare `npm install <native-pkg>`.** Bypasses SDK version resolution. Use `npx expo install`.
- **Building via Expo Go for FND-01.** The pipeline being proven is the *native APK* loop (later phases add native-only deps). Prove it with `gradlew assembleDebug`, not Expo Go.
- **Driving colours from anything but `useTheme()`.** Hardcoded hex anywhere fails FND-05 and CLAUDE.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expo project skeleton | Manual `package.json`/babel/metro/tsconfig | `create-expo-app` (SDK 57 template) | Gets New-Arch, tsconfig base, index entry, metro correct by default. |
| SDK-version resolution | Hand-picked versions in package.json | `npx expo install` | Registry `latest` (RN 0.87) ≠ SDK-57 pin (RN 0.86). |
| Native Android project | Hand-written `android/` | `expo prebuild --platform android` | Regenerates manifest, icons, permissions, autolinking from `app.config.ts`. |
| State persistence | Custom AsyncStorage read/write | `zustand/middleware persist` | Handles hydration timing, partialize, versioning (quest-board pattern). |
| Local date formatting | `new Date().toISOString().split('T')[0]` | ported `formatLocalDate()` | UTC off-by-one already fixed once in the plugin (CLAUDE.md). |
| HTTP to AI providers | New client design | ported `AiService` (5 providers behind one interface) | 540 lines already correct; only the transport swaps. |
| Lint + format | ESLint+Prettier combo | Biome | Pinned in stack; quest-board convention. |

**Key insight:** This phase is ~90% "wire up the blessed defaults + copy a verified sibling repo," ~10% mechanical port. The failure modes are all in *deviating* from those defaults (monorepo cargo-culting, bare npm install, hand-rolled native config), not in missing capability.

## Common Pitfalls

### Pitfall 1: `types.ts` — stripping `TFile` (FND-03)
**What goes wrong:** Agent tries to "generalise" `TFile` into an elaborate opaque interface, or leaves the `import` and gets a "cannot find module 'obsidian'" typecheck error.
**Why it happens:** The coupling looks bigger than it is.
**How to avoid:** It is exactly two edits: delete line 1 (`import { TFile } from "obsidian";`) and delete the `file: TFile;` field (line 49, plus its doc-comment line 48). Nothing in the ported set reads `file`. No replacement ref is needed this phase (SQLite identity is Phase 2). If a placeholder is wanted, `id?: string` is sufficient — do not invent a vault abstraction.
**Warning signs:** `tsc --noEmit` reporting `Cannot find module 'obsidian'`.

### Pitfall 2: `AiService.ts` — `response.json` is a property in Obsidian, a method in fetch (FND-04)
**What goes wrong:** Mechanical find/replace of `requestUrl(` → `fetch(` leaves `const data = response.json;` reading the *function reference* (or `undefined`), so every provider silently returns garbage.
**Why it happens:** Obsidian's `requestUrl` resolves to `{ status, json, text, ... }` with `json` **already parsed** (a property). `fetch` resolves to a `Response` whose `.json()` is an **async method**.
**How to avoid:** For each of the 6 sites (lines 198, 222, 278, 334, 386, 443) change `const data = response.json;` → `const data = await response.json();`. And:
- `requestUrl({ url, method, headers, contentType, body, throw:false })` → `fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body })`. `contentType` becomes a `Content-Type` header entry.
- `response.status === 200` (line 185) → `response.ok` (or keep `response.status === 200`).
- **Add explicit `response.ok` handling** before parsing (locked decision): `if (!response.ok) throw new Error(...)`. `requestUrl`'s `throw:false` suppressed HTTP-error throws; `fetch` never throws on 4xx/5xx, so an un-checked non-ok response would parse an error body as success.
- The 7 `requestUrl(` call sites are lines **180, 194, 211, 264, 319, 377, 431**.
**Warning signs:** Providers return `[object Promise]`/`undefined`; no compile error (this bug typechecks).

### Pitfall 3: `AiService.ts` — the `../settings` type import (FND-04)
**What goes wrong:** `import type { OrbitSettings } from '../settings'` fails because `settings.ts` is **not** ported this phase (504 lines, 12 Obsidian refs, rewritten in a later phase).
**How to avoid:** Define a minimal local settings interface inside the ported service (or a tiny `src/services/ai-types.ts`) covering only the fields `AiService` reads: `aiProvider`, `aiApiKey`, `aiApiKeys?`, `aiModel`, `aiCustomEndpoint`, `aiCustomModel`. `import type { OrbitContact } from '../types'` **is** fine once `types.ts` is ported (it consumes non-`file` fields only).
**Warning signs:** `Cannot find module '../settings'`.

### Pitfall 4: New Architecture / RN version drift
**What goes wrong:** Installing `react-native@latest` (0.87) or toggling `newArchEnabled` breaks the SDK-57 contract.
**How to avoid:** Let `expo install` pin RN 0.86. New Arch is always-on since SDK 55 — no config flag. Do not add `newArchEnabled` to `app.config.ts`.

### Pitfall 5: `logger.ts` + Biome `noExplicitAny`
**What goes wrong:** `logger.ts` uses `...args: any[]` in three methods. Biome's recommended ruleset flags `noSuspiciousExplicitAny`/`noExplicitAny`, so `biome check` may error on a verbatim port and fail FND-06's "lint clean."
**How to avoid:** Either change `any[]` → `unknown[]` (safe; `console.*` accepts `unknown`), or add a scoped Biome override for `src/utils/logger.ts`. Prefer `unknown[]` — it is a strict improvement and keeps the config clean. Note this is the one file where "port verbatim" collides with "lint clean."
**Warning signs:** `biome check` non-zero on `logger.ts`.

### Pitfall 6: `create-expo-app` into a non-empty existing directory (FND-01)
**What goes wrong:** `/home/bwales/projects/orbit-app` already contains `CLAUDE.md`, `HANDOFF.md`, `docs/`, `.planning/`, `.claude/`, `.git`. `create-expo-app orbit-app` from the parent may refuse or want an empty target.
**How to avoid:** Scaffold into a temp dir and move the generated files in, or use the template's in-place mode carefully, preserving the existing `docs/`, `.planning/`, `.claude/`, `.git`, `CLAUDE.md`, `HANDOFF.md`. Never overwrite those. Verify `git status` after scaffolding shows only additive changes to tracked planning docs.
**Warning signs:** Missing `HANDOFF.md`/`.planning` after scaffold; `create-expo-app` aborting on non-empty dir.

### Pitfall 7: Windows/SSH build invocation details (FND-01)
**What goes wrong:** Copying quest-board's `./gradlew assembleDebug` verbatim fails on Windows (it is `gradlew.bat`), and the monorepo `cd apps/mobile` step does not exist here (flat repo). SSH default shell on Windows may be cmd or PowerShell, changing `&&` chaining and path syntax.
**How to avoid:** On `droid` the sequence is `npm install` → `npx expo prebuild --platform android --no-install` → `cd android` → `gradlew.bat assembleDebug` (APK at `android\app\build\outputs\apk\debug\app-debug.apk`). No `patch-android`, no `apps/mobile` subdir. Confirm the Windows shell and username with the owner before scripting the SSH command.
**Warning signs:** `./gradlew: not found`; path-not-found on `apps/mobile`.

### Pitfall 8: Graphify must not be built this phase
**What goes wrong:** Running `graphify build` corrupts the graph silently (STATE.md blocker; ADR-bridge scripts not yet ported).
**How to avoid:** Graphify is `enabled:false` in config. Do not build it. Porting `adr-registry.ts` + `normalize-graph-docrefs.ts` + the block hooks is a separate foundation task, **not** in FND-01…06.

## Code Examples

### `AiService.ts` — the transport swap (Ollama `isAvailable`, representative)
```typescript
// BEFORE (Obsidian, ~/projects/Orbit/src/services/AiService.ts:180)
const response = await requestUrl({ url: this.baseUrl, method: 'GET', throw: false });
return response.status === 200;

// AFTER (fetch)
const response = await fetch(this.baseUrl, { method: 'GET' });
return response.ok;
```

### `AiService.ts` — a POST provider (OpenAI, lines 264-282, representative of all 4 cloud providers)
```typescript
// AFTER
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.apiKey}`,
  },
  body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
});
if (!response.ok) {
  throw new Error(`OpenAI request failed: ${response.status}`);
}
const data = await response.json();          // ← was: const data = response.json;
if (!data?.choices?.[0]?.message?.content) {
  throw new Error('OpenAI returned an unexpected response format');
}
return data.choices[0].message.content;
```
> Apply the same shape to Anthropic (line 319 — note it needs an `anthropic-version` header, and direct-from-device calls historically need `anthropic-dangerous-direct-browser-access`; flag for Phase 14 when actually wired), Gemini (line 377), and Custom (line 431). This phase only requires it to **compile and typecheck**, not run.

### `types.ts` — the strip (lines 1, 48-49)
```typescript
// DELETE line 1:      import { TFile } from "obsidian";
// DELETE lines 48-49: /** Reference to the TFile in the vault */
//                     file: TFile;
// Everything else in the interface + all functions port unchanged.
```

### `formatLocalDate()` — port verbatim, keep the comment (utils/dates.ts)
```typescript
// Keep the header comment intact — it documents WHY toISOString() is banned.
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Opt-in New Architecture (`newArchEnabled`) | Always-on New Arch | SDK 55 | No flag to set; do not re-derive. |
| Obsidian `requestUrl` (CORS-bypassing, pre-parsed `.json`) | `fetch` + `await .json()` + `response.ok` | This port | The `.json` property→method change is the one real gotcha. |
| ESLint + Prettier | Biome (single tool) | quest-board convention | One config, faster; version-pinned schema. |
| Expo Go for iteration | Custom dev client / native debug APK | Since native deps (Skia, widget) | Orbit will need dev-client from the orrery/widget phases; not yet. |
| React 18 (plugin) | React 19.2 (SDK 57) | SDK 56 | Ported files are pure/typed — unaffected. |

**Deprecated/outdated:**
- Plugin's `react`/`react-dom` 18.2 + esbuild toolchain — irrelevant; none of the ported files touch React.
- `main.js`/esbuild plugin build — replaced entirely by Expo/Metro.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Owner's Windows username is `bwles` (from `C:\Users\bwles\...` in PROJECT.md) and the SSH host alias will be `droid` | Environment / Pattern 3 | rsync/SSH target path + package-id guess wrong; build never lands. Owner-gated. |
| A2 | Android package id `com.<owner>.orbit` (exact string unset) | Pattern 3 | Wrong id is painful to change after first install (uninstall/reinstall). Owner decision. |
| A3 | `droid` has JDK 17 + Android SDK (API 35/36) + `JAVA_HOME`/`ANDROID_HOME` set, per quest-board's build guide | Environment | Build fails on missing toolchain. Reuses quest-board's machine, likely present, but unverified this session. |
| A4 | A plain debug APK (no `expo-dev-client`) satisfies FND-01's "home shell launches" | Environment | If Metro hot-reload on device is wanted, add `expo-dev-client` (one native dep, one rebuild). |
| A5 | The SDK-57 default template uses expo-router; a single home shell may not need it | Standard Stack | If router is skipped, home shell is a plain `App.tsx` — simpler, fine for FND-01. |
| A6 | `schemas/types.ts` `output.path` field + "photo URL" comment (Obsidian vestiges) are harmless to port verbatim now | Portable Source Map | They are types/comments with no import coupling; later phases rework them (HANDOFF §14.9). Zero compile risk. |

## Open Questions

1. **Android package id string** — What exactly? (`com.bwales.orbit`? `com.thuban.orbit`?)
   - What we know: `C:\Users\bwles` suggests `bwles`; changing it after first install requires uninstall.
   - Recommendation: Owner confirms before the first `app.config.ts` commit (planner: `checkpoint:human-verify`).
2. **SSH host + Windows shell** — Is `droid` a `~/.ssh/config` alias or Tailscale MagicDNS? cmd or PowerShell over SSH?
   - What we know: STATE.md says the `droid` Host block + first `ssh droid` verification are still pending.
   - Recommendation: Owner-gated bring-up task before FND-01 can be proven.
3. **Dev-client now or later?** — Add `expo-dev-client` this phase for on-device hot reload, or defer to the first native-only feature?
   - Recommendation: Defer. A plain debug APK proves the pipeline; dev-client lands with Skia/widget. (Claude's discretion.)
4. **expo-router vs plain App entry** for the home shell?
   - Recommendation: Claude's discretion; plain `App.tsx` is the minimal FND-01 proof, expo-router matches quest-board if navigation is imminent (Phase 4+).

## Environment Availability

| Dependency | Required By | Available (this box) | Version | Fallback |
|------------|------------|----------------------|---------|----------|
| Node.js / npm | Scaffold, install | ✓ (assumed; settings allow `npm`/`npx`) | — | — |
| `~/.local/bin/adb` | Install APK on Pixel | ✓ (per CLAUDE.md; never `apt install adb`) | SDK 37 | — |
| `emu-connect` | Pick Pixel/emulator target | ✓ (per CLAUDE.md) | — | desktop emulator (fallback; no perf claims) |
| Android APK build (local) | FND-01 | ✗ **by hardware** (2012 Ivy Bridge) | — | **`droid` over SSH (the whole point)** |
| SSH to `droid` (Windows) | FND-01 build | ✗ **bring-up pending** | — | none — blocking until owner sets up |
| JDK 17 + Android SDK on `droid` | Gradle build | ? unverified this session | — | none if absent |
| Pixel 6 Pro USB + USB-debug authorised | FND-01 install/launch | ? (owner must accept on-device prompt) | — | desktop emulator (weaker proof) |

**Missing dependencies with no fallback (BLOCKING FND-01 — all owner-gated):**
- `~/.ssh/config` `Host droid` block (HostName = Tailscale MagicDNS or IP, `User` = Windows username, `IdentityFile`, `Port 22`) + first `ssh droid` host-key accept/auth.
- One-time confirmation that `droid` has the toolchain and a debug `gradlew.bat assembleDebug` succeeds at `C:\Users\bwles\projects\orbit-app`.
- Pixel 6 Pro "Allow USB debugging" prompt accepted (only the owner can tap it).
- Android package id + Windows username/shell confirmation.

**Missing dependencies with fallback:**
- Physical Pixel absent → `emu-connect` falls back to the desktop emulator for a *launch* check, but perf/native-render claims are not valid there (CLAUDE.md) and it is a weaker proof of FND-01.

> **rsync guidance:** sync source only — `rsync -az --delete --exclude node_modules --exclude android --exclude .git --exclude .expo ./ droid:.../orbit-app/` then `npm install` + `prebuild` on `droid`. Do not rsync `node_modules` (native binaries differ) or `android/` (regenerated by prebuild). Transport is rsync/scp/ssh (allowed in `settings.local.json`); **never `git push`** (global deny; CLAUDE.md).

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.x` for pure logic (no RN runtime needed). RN-component testing (jest-expo) deferred until there are components worth rendering. |
| Config file | none yet — **Wave 0** creates `vitest.config.ts` |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npx tsc --noEmit && npx biome check . && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FND-02/03 | Extracted files typecheck, no Obsidian import | typecheck | `npx tsc --noEmit` | ❌ Wave 0 (needs tsconfig) |
| FND-02 | `calculateStatus()` thresholds (stable/wobble/decay, null→decay) | unit | `npx vitest run src/**/status.test.ts` | ❌ Wave 0 (port plugin test) |
| FND-02 | `formatLocalDate()` local-date correctness (no UTC off-by-one) | unit | `npx vitest run src/utils/dates.test.ts` | ❌ Wave 0 |
| FND-02 | `isValidFrequency`, `parseDate`, `isFieldDef`/`isSchemaDef` guards | unit | `npx vitest run` | ❌ Wave 0 |
| FND-04 | `AiService` compiles standalone; `extractSection`/`extractContext` pure logic | typecheck + unit | `npx tsc --noEmit` (+ optional unit) | ❌ Wave 0 |
| FND-05 | No hardcoded colours; `useTheme()` resolves | lint/static | `npx biome check .` + grep for hex literals outside `src/theme` | ❌ Wave 0 |
| FND-06 | Biome clean; portrait set; folder layout present | lint/static | `npx biome check .` | ❌ Wave 0 |
| FND-01 | App builds + launches to home shell on Pixel | manual (device) | desktop-build → `adb install` → `uiautomator dump` | ❌ manual, owner-gated |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npx biome check <changed>`
- **Per wave merge:** `npx tsc --noEmit && npx biome check . && npx vitest run`
- **Phase gate:** full suite green + the one-time device launch proof (FND-01) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.ts` — test runner config
- [ ] `tsconfig.json` — `tsc --noEmit` gate (from Expo template; add `strict:true`)
- [ ] `biome.json` — lint gate (Pattern 4)
- [ ] `src/**/status.test.ts`, `src/utils/dates.test.ts` — **the plugin already ships Vitest tests** (`~/projects/Orbit/test/`, `package.json` has `vitest`); port the ones covering `calculateStatus`/`formatLocalDate`/guards rather than writing fresh.
- [ ] Framework install: `npm install -D vitest`

## Security Domain

> `security_enforcement: true`, ASVS L1. This phase lands `AiService` (handles API keys in-memory, makes HTTPS calls) but wires it to **nothing** — attack surface is minimal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Local app, no backend, no accounts. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No server; OS sandbox owns file access. |
| V5 Input Validation | yes | `AiService` must check `response.ok` before parsing and guard malformed JSON (`data?.choices?.[0]?...` guards already present — keep them). |
| V6 Cryptography | no (this phase) | API-key encryption is `expo-secure-store` in Phase 14 (AI-01) — do not hand-roll; not this phase. |
| V9 Communications | yes (latent) | Cloud providers HTTPS-only; custom endpoint HTTPS-only (locked, 03-ai/13-ai). Ollama `http://localhost` is a local loopback — **not wired this phase**; the no-cleartext posture is enforced when the custom-endpoint UI lands. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-ok HTTP parsed as success (post-`fetch` swap) | Tampering / DoS | Explicit `if (!response.ok) throw` before `await response.json()` (locked decision). |
| API key leaked to logs | Info disclosure | `logger.ts` ports as-is; do **not** log settings objects or request bodies containing keys. Full redaction is AI-04 (Phase 14) — just don't introduce a leak now. |
| Cleartext egress via `http://` custom endpoint | Info disclosure | Out of scope this phase (not wired); enforce HTTPS-only when the endpoint field is built (13-ai). |
| Supply-chain (slopsquat) on scaffold deps | Tampering | Package Legitimacy Audit run — all mainstream, official repos, no `postinstall`. |

**Net:** no ASVS-L1 control is *implemented* this phase beyond preserving `AiService`'s existing response-shape guards and adding the `response.ok` check. Nothing here should widen egress or persist a secret.

## Sources

### Primary (HIGH confidence)
- Actual source read in place: `~/projects/Orbit/src/{types.ts, utils/dates.ts, utils/logger.ts, schemas/types.ts, schemas/new-person.schema.ts, services/AiService.ts}` — all file:line claims verified by reading, not estimated.
- `~/projects/quest-board-app/{biome.json, apps/mobile/app.config.ts, apps/mobile/package.json, apps/mobile/tsconfig.json, apps/mobile/babel.config.js, apps/mobile/ANDROID_BUILD_GUIDE.md, packages/ui/{theme.ts,theme-types.ts,colors.ts,theme-provider.tsx}, apps/mobile/src/stores/{theme-store.ts,settings-store.ts}}` — scaffold/theme/build patterns read in full.
- npm registry (2026-08-14): `expo@57.0.12`, `expo-sqlite@57.0.1`, `zustand@5.0.15`, `@biomejs/biome@2.5.8`, `create-expo-app@4.0.0`, `react-native@0.87` (latest), `react@19.2.8`, dist-tags confirming SDK 57 = `latest`/`next`.
- `gsd-tools query package-legitimacy check` — 6 scaffold packages audited.
- Repo docs: `CLAUDE.md`, `HANDOFF.md` (§2, §4, §14, §15), `PROJECT.md`, `REQUIREMENTS.md`, `STATE.md`, `01-CONTEXT.md`.

### Secondary (MEDIUM confidence)
- WebSearch (Expo changelog + Expo/X posts): SDK 57 = RN 0.86, React 19.2 unchanged, New Architecture always-on since SDK 55. [CITED: expo.dev/changelog/sdk-57]

### Tertiary (LOW confidence)
- Owner-gated pipeline specifics (Windows username, `droid` toolchain presence, exact SSH host config) — inferred from PROJECT.md/STATE.md, not verified this session. See Assumptions A1–A3.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version confirmed against live npm registry; RN-pin caveat documented.
- Ports (file:line): HIGH — read every portable source file directly; couplings enumerated by grep + read.
- Architecture patterns: HIGH — copied from a verified working sibling repo, with the monorepo divergence called out.
- Build pipeline: MEDIUM — mechanism is clear (quest-board build guide), but several steps are owner-gated and unverified this session.
- Security: HIGH (scope is small and mostly latent this phase).

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days; Expo SDKs move ~quarterly, but SDK 57 is current `latest` and stable). Re-verify `expo install` pins if scaffolding after a new SDK ships.
