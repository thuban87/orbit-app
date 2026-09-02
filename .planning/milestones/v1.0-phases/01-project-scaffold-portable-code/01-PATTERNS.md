# Phase 1: Project Scaffold & Portable Code - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 15 new files (7 ported + 8 scaffold/config)
**Analogs found:** 15 / 15 (7 are near-verbatim self-ports; 8 mirror quest-board)

> **Analog location note:** `/home/bwales/projects/orbit-app/src/` is EMPTY and there is
> no `package.json`. There is no in-repo analog for anything this phase. Analogs live in two
> read-only SIBLING repos, read in place:
> - **Scaffold/theme/config** → `~/projects/quest-board-app` (Expo SDK 55 monorepo)
> - **Ported logic/types** → `~/projects/Orbit/src` (Obsidian plugin; the analog IS the source file)
>
> quest-board is an npm-workspaces **monorepo**; Orbit is a **flat single app**. Extract the
> token/store/config *patterns*, but its monorepo build machinery is an anti-pattern — see
> "Anti-Patterns (do NOT copy)" at the bottom.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/types.ts` (status logic) | model / pure-logic | transform | `~/projects/Orbit/src/types.ts` | self-port (strip 2 lines) |
| `src/services/AiService.ts` | service | request-response | `~/projects/Orbit/src/services/AiService.ts` | self-port (transport swap) |
| `src/schemas/types.ts` | model | — | `~/projects/Orbit/src/schemas/types.ts` | verbatim |
| `src/schemas/new-person.schema.ts` | config/data | — | `~/projects/Orbit/src/schemas/new-person.schema.ts` | verbatim |
| `src/schemas/edit-person.schema.ts` | config/data | — | `~/projects/Orbit/src/schemas/edit-person.schema.ts` | verbatim |
| `src/utils/dates.ts` | utility | transform | `~/projects/Orbit/src/utils/dates.ts` | verbatim (keep comment) |
| `src/utils/logger.ts` | utility | — | `~/projects/Orbit/src/utils/logger.ts` | verbatim (`any[]`→`unknown[]`) |
| `src/theme/theme-types.ts` | provider/types | — | qb `packages/ui/src/theme-types.ts` | role-match (flatten pkg) |
| `src/theme/theme-presets.ts` | provider/data | — | qb `packages/ui/src/theme-presets.ts` | role-match |
| `src/theme/theme-provider.tsx` | provider | event-driven (context) | qb `packages/ui/src/theme-provider.tsx` | role-match |
| `src/stores/theme-store.ts` | store | state + persist | qb `apps/mobile/src/stores/theme-store.ts` | role-match (simplify) |
| `app.config.ts` | config | — | qb `apps/mobile/app.config.ts` | role-match (strip Sentry/router) |
| `biome.json` | config | — | qb `biome.json` | role-match (drop monorepo bits) |
| `tsconfig.json` | config | — | qb `apps/mobile/tsconfig.json` | role-match (drop pkg aliases) |
| `babel.config.js` | config | — | qb `apps/mobile/babel.config.js` | role-match (drop reanimated) |

---

## Pattern Assignments — Ported files (analog = the source file itself)

### `src/types.ts` (model, pure transform)

**Analog:** `~/projects/Orbit/src/types.ts` (191 lines, read in full)

**The strip — exactly two deletions (FND-03):**
- Line 1: `import { TFile } from "obsidian";` → **delete**
- Lines 48-49: the `/** Reference to the TFile in the vault */` comment + `file: TFile;` field → **delete**

Nothing in the ported set (or `AiService`) reads `file`, so removal is compile-safe. Do NOT invent a vault abstraction; if a placeholder is wanted `id?: string` suffices (SQLite identity is Phase 2). Everything else ports unchanged.

**Core pattern to port (lines 98-123, `calculateStatus`) — pure, no Obsidian:**
```typescript
export function calculateStatus(lastContact: Date | null, frequency: Frequency): OrbitStatus {
    if (!lastContact) return "decay";              // No contact ever = decayed
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
    const threshold = FREQUENCY_DAYS[frequency];
    if (daysSince < threshold * 0.8) return "stable";   // < 80% of interval
    if (daysSince < threshold) return "wobble";         // 80-100%
    return "decay";                                     // past threshold
}
```
**Also port (all pure):** `Frequency`, `FREQUENCY_DAYS` (lines 19-27), `OrbitStatus`, `SocialBattery`, `LastInteractionType`, `OrbitContact` (minus `file`), `calculateDaysSince` (131-137), `calculateDaysUntilDue` (146-155), `parseDate` (163-183), `isValidFrequency` (188-191).

---

### `src/services/AiService.ts` (service, request-response) — the transport swap (FND-04)

**Analog:** `~/projects/Orbit/src/services/AiService.ts` (540 lines; header + all call sites read)

**Import block to rewrite (lines 10-14):**
```typescript
// BEFORE
import { requestUrl } from 'obsidian';         // ← line 10, DELETE
import { Logger } from '../utils/logger';      // keep (now ../utils/logger)
import { formatLocalDate } from '../utils/dates';
import type { OrbitSettings } from '../settings';   // ← line 13, settings.ts NOT ported
import type { OrbitContact } from '../types';        // keep — types.ts ported, non-file fields only
```
`../settings` is not ported this phase (Pitfall 3). Replace with a **minimal local interface** (inline or `src/services/ai-types.ts`) covering ONLY the fields the service reads (grep-confirmed):
`aiProvider`, `aiApiKey`, `aiApiKeys?`, `aiModel`, `aiCustomEndpoint`, `aiCustomModel`.

**The 7 `requestUrl(` call sites:** lines **180, 194, 211, 264, 319, 377, 431**.
**The 6 `const data = response.json;` reads (THE TRAP):** lines **198, 222, 278, 334, 386, 443**.
**Status check:** line **185** (`response.status === 200`).

**Per-site swap (representative, from RESEARCH Code Examples):**
```typescript
// BEFORE (Obsidian requestUrl — .json is a pre-parsed PROPERTY)
const response = await requestUrl({ url, method: 'POST', contentType: 'application/json',
                                    headers, body, throw: false });
const data = response.json;                    // property

// AFTER (fetch — .json() is an async METHOD; fetch never throws on 4xx/5xx)
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },   // contentType → header entry
  body,
});
if (!response.ok) throw new Error(`... request failed: ${response.status}`);  // LOCKED: explicit ok-check
const data = await response.json();            // method — was: response.json
```
- `response.status === 200` (line 185, Ollama `isAvailable`) → `response.ok`.
- Keep the existing response-shape guards (`data?.choices?.[0]?.message?.content`) — they are the V5 input-validation control (Security Domain).
- **Port faithfully, do not redesign.** Not wired to any screen this phase — must only compile + typecheck.
- The bug typechecks silently: missing the `.json` → `await .json()` change yields `[object Promise]`/`undefined` at runtime, no compile error.

---

### `src/schemas/types.ts` · `new-person.schema.ts` · `edit-person.schema.ts` (verbatim)

**Analogs:** `~/projects/Orbit/src/schemas/{types.ts (99L), new-person.schema.ts (72L), edit-person.schema.ts (72L)}` — grep-confirmed **zero Obsidian refs.** Port verbatim.

- `types.ts` exports `FieldType`, `FieldDef`, `SchemaDef`, `isFieldDef` (75-84), `isSchemaDef` (92-99). The `SchemaDef.output.path` field + `photo` "URL" comment are Obsidian vestiges but are pure types — harmless now, reworked in Phase 3 (Assumption A6).
- The schema files are plain data objects: `import type { SchemaDef } from './types';` then `export const newPersonSchema: SchemaDef = {...}`. No logic, no coupling.

### `src/utils/dates.ts` (utility, transform — verbatim, KEEP THE COMMENT)

**Analog:** `~/projects/Orbit/src/utils/dates.ts` (22 lines). Port whole file. The header + inline comments (lines 1-16) document WHY `toISOString().split('T')[0]` is banned (UTC off-by-one already fixed once — CLAUDE.md dates rule). **Never** reintroduce `toISOString()`.
```typescript
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

### `src/utils/logger.ts` (utility — verbatim + one lint fix)

**Analog:** `~/projects/Orbit/src/utils/logger.ts` (43 lines). Static-method `Logger` class, level-gated (`off`/`warn`/`error`/`debug`), defaults `off`. **One deviation (Pitfall 5):** lines 24/31/38 use `...args: any[]` — Biome `recommended` flags `noExplicitAny` and fails FND-06. Change `any[]` → `unknown[]` (strict improvement; `console.*` accepts `unknown`). Do NOT log settings objects / request bodies (API-key leak — Security Domain).

---

## Pattern Assignments — Scaffold/config files (analog = quest-board)

### `src/theme/` — theme-token module (FND-05, mirror qb `packages/ui/src`)

**Analogs:** `~/projects/quest-board-app/packages/ui/src/{theme-types.ts, theme-presets.ts, theme-provider.tsx}` (read in full).

**`theme-types.ts` shape** (qb `theme-types.ts:1-37`) — a `ThemePalette` of base tokens + derived `SemanticColors`, `ThemePreset` with `dark`/`light` palettes:
```typescript
export type ThemeMode = "light" | "dark" | "system";
export interface ThemePalette {
  background: string; surface: string; surfaceElevated: string; accent: string;
  textPrimary: string; textSecondary: string; border: string; borderStrong: string;
}
```

**`theme-provider.tsx` — the `useTheme()` contract** (qb `theme-provider.tsx:30-75`). Resolve palette once in a `useMemo`, expose via context, and **fall back to a default preset when outside the provider** so tests/components still resolve a colour (never `null`, never a hex):
```typescript
export function useTheme(): ResolvedTheme {
  const theme = useContext(ThemeContext);
  if (!theme) { /* resolve default-preset palette so callers outside provider still get colours */ }
  return theme;
}
```

**`theme-presets.ts` — colour VALUES live here and ONLY here** (qb `theme-presets.ts:8-32`): `THEME_PRESETS: Record<ThemePresetId, ThemePreset>` maps preset→`{dark, light}` hex palettes. This is the single place a hex literal may appear — every component reads `useTheme().colors.*`, never a literal.

**Orbit adaptation:** ONE space-themed dark preset is enough this phase (visual design is the owner's — HANDOFF §7). Ship the token *infrastructure* + `useTheme()`, not a finished palette. Flatten qb's `@quest-board/ui` package boundary into flat `src/theme`, import via `@/theme`. Do not recreate `packages/ui`.

### `src/stores/theme-store.ts` — Zustand + persist scaffold (FND-05)

**Analog:** `~/projects/quest-board-app/apps/mobile/src/stores/theme-store.ts` (113 lines, read in full).

**Core pattern (qb lines 33-93):**
```typescript
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({ /* state + actions */ }),
    { name: "orbit-theme",                                    // ← rename from "quest-board-theme"
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ /* only what to persist */ }),
      onRehydrateStorage: () => (_state, error) => { if (error) console.warn(...); } },
  ),
);
```
FND-05 asks only for a *scaffold* — one working persisted store proves the pattern. **Simplify aggressively:** qb's store is coupled to `character-store` (per-character prefs + `useCharacterStore.subscribe`, lines 5, 78-112) — Orbit has no characters; drop all of that. Zustand v5 has no `subscribeWithSelector` by default; qb uses the full-state listener form (lines 100-112) — copy only if cross-store subscription is actually needed (it is not this phase).

### `app.config.ts` — portrait lock + package id (FND-06, mirror qb, strip heavily)

**Analog:** `~/projects/quest-board-app/apps/mobile/app.config.ts` (read in full).

**Keep (qb lines 6-27):** `orientation: "portrait"` (line 11 — the config-layer lock, CLAUDE.md), `android.package`, `android.predictiveBackGestureEnabled: false`.
```typescript
const config: ExpoConfig = {
  name: "Orbit", slug: "orbit", orientation: "portrait",   // ← the lock
  android: { package: "com.<owner>.orbit", predictiveBackGestureEnabled: false },
  plugins: ["expo-sqlite"],    // add NOW so first prebuild covers Phase 2's native dep
};
export default config;
```
**Strip:** `withSentry` wrapper (qb 1-3, 67-71 — no crash reporting carries user content, CLAUDE.md local-first), `expo-router`/`expo-splash-screen`/`expo-secure-store`/datetimepicker plugins (qb 32-53, later phases), `@quest-board/ui` constant imports (qb 2 — inline literals), `experiments.reactCompiler`, EAS `extra`. **Do NOT** add `newArchEnabled` (always-on since SDK 55). Confirm the package-id string with the owner (Open Question 1 — `checkpoint:human-verify`).

### `biome.json` (FND-06, mirror qb, drop monorepo bits)

**Analog:** `~/projects/quest-board-app/biome.json` (read in full).
```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.8/schema.json",   // ← bump 2.4.10 → 2.5.8
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },   // qb:3
  "files": { "includes": ["**", "!.planning", "!android", "!**/dist"] },     // add !android (generated)
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 } // qb:32-36
}
```
**Drop:** qb's `expo-haptics` `noRestrictedImports` rule + haptics/tests overrides (qb 20-30, 37-58) and the `./tools/biome/no-animation-in-worklet.grit` plugin (qb:14) — all project-specific to quest-board.

### `tsconfig.json` (FND-06, mirror qb, drop package aliases)

**Analog:** `~/projects/quest-board-app/apps/mobile/tsconfig.json`.
```jsonc
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true, "forceConsistentCasingInFileNames": true,
    "paths": { "@/*": ["./src/*"] }        // KEEP the @/* alias; DROP all @quest-board/* aliases (qb:9-12)
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### `babel.config.js` (FND-06, mirror qb, drop reanimated)

**Analog:** `~/projects/quest-board-app/apps/mobile/babel.config.js`. Use `presets: ["babel-preset-expo"]` only. **Drop** `react-native-reanimated/plugin` (qb:5) — Reanimated is a Phase 13 (orrery) dep, not installed this phase. Add it back only when Skia/Reanimated land.

---

## Shared Patterns

### No hardcoded colours (applies to: all `src/` UI + future Skia)
**Source of truth:** `src/theme/theme-presets.ts` (mirrors qb `packages/ui/src/theme-presets.ts:8-32`).
Hex literals appear **only** in the presets file. Every consumer reads `useTheme().colors.*`. Enforced by grep for hex outside `src/theme` (FND-05 gate) + `biome check`. Load-bearing CLAUDE.md rule.

### `@/` path alias (applies to: every import across files)
`@/*` → `./src/*` (tsconfig). Use `@/theme`, `@/utils/dates`, `@/services/AiService`. Do NOT reproduce `@quest-board/*` package imports — flat repo.

### `expo install` for native deps (applies to: scaffold)
`npx expo install <pkg>` for any Expo/RN native package (resolves SDK-57 pin RN 0.86); bare `npm install` only for pure-JS (`zustand`) and devDeps (`@biomejs/biome@2.5.8`, `vitest`). Registry `latest` RN is 0.87 — would break the pin.

### Test structure (applies to: `status.test.ts`, `dates.test.ts`, guard tests)
**Source:** `~/projects/Orbit/test/unit/{types.test.ts, utils/dates.test.ts}` — the plugin already ships Vitest suites for `calculateStatus` and `formatLocalDate`. **Port them, don't rewrite** (adjust import paths to `@/` / `src/`).
```typescript
import { describe, it, expect } from 'vitest';
import { calculateStatus } from '@/types';
function daysAgo(days: number): Date { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-days); return d; }
describe('calculateStatus', () => {
  it('returns "decay" when lastContact is null', () => expect(calculateStatus(null, 'Monthly')).toBe('decay'));
  // Monthly=30, 80%=24: 5d→stable, 25d→wobble, 31d→decay
});
```
Full gate: `npx tsc --noEmit && npx biome check . && npx vitest run`.

---

## Anti-Patterns (do NOT copy from quest-board)

quest-board is an npm-workspaces monorepo; these exist SOLELY to fix workspace hoisting and will produce a broken-but-configured-looking build in a flat repo:
- `patch-build-gradle.js`, `scripts/expo-cli-wrapper.js`
- Metro `watchFolders` / `nodeModulesPaths` (`metro.config.js`)
- `packages/*` and `@quest-board/*` tsconfig path aliases
- `apps/` / `packages/` directory shape — Orbit is flat (`src/` at repo root)
- `withSentry` / any crash reporting carrying user content (violates local-first, CLAUDE.md)
- Building via Expo Go for FND-01 — the pipeline being proven is the *native APK* loop (`gradlew.bat assembleDebug` on `droid`), later phases add native-only deps.

## No Analog Found

None — every file has a strong analog. The two genuinely new artifacts this phase are the **home shell** (`App.tsx`/`src/screens/`, a trivial RN view from the Expo template, no meaningful analog needed) and `vitest.config.ts` (Wave 0 config, standard Vitest boilerplate).

## Metadata

**Analog search scope:** `~/projects/Orbit/src/{types.ts, utils/, schemas/, services/AiService.ts}` + `~/projects/Orbit/test/unit/`; `~/projects/quest-board-app/{biome.json, apps/mobile/{app.config.ts, tsconfig.json, babel.config.js, index.js, src/stores/theme-store.ts}, packages/ui/src/{theme-types.ts, theme-presets.ts, theme-provider.tsx}}`
**Files scanned:** 14 analog files read directly (not estimated)
**Pattern extraction date:** 2026-08-14
