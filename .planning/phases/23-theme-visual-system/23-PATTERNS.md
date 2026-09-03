# Phase 23: Theme & Visual System - Pattern Map

**Mapped:** 2026-09-03
**Files analyzed:** 12 new/modified
**Analogs found:** 11 / 12 (1 net-new subsystem with a strong cross-boundary analog)

> Read-only pattern map. All excerpts are verbatim from disk with file:line. Per CLAUDE.md
> "Review the code, not the diff": for the shared `app_settings` table, every writer path
> (DAO `COLUMN_OF`, validators, portable snapshot, backup allowlist) was read, not just the
> migration. Verified this session: `TARGET_VERSION = 14` (`src/db/database.ts:49`), latest
> migration on disk is `014-interaction-assists.ts` → **head+1 = migration 015**. Re-verify at
> plan time; the number drifts every schema phase.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/015-theme-settings.ts` (+ `.test.ts`) | migration | schema/batch | `src/db/migrations/014-interaction-assists.ts` (additive ALTER); `002-app-settings.ts` (seed idiom) | exact |
| `src/theme/contrast.ts` (+ `.test.ts`) | utility | transform (pure) | `src/components/contact-card-ring.ts` (pure, RN-free, node-tested) | role-match |
| `src/theme/use-reduced-motion.ts` (+ `.test.ts`) | hook | event-driven → worklet | `src/components/orrery/OrreryCanvas.tsx:93-101` (shared value → `useDerivedValue` in Skia loop) | role-match |
| `src/theme/orbit-theme-migration.ts` (+ `.test.ts`) | utility | transform (pure) | `src/stores/theme-store.ts` (the `orbit-theme` shape to read); `resolveMode` in `theme-presets.ts` (pure mapper idiom) | role-match |
| `src/components/icons/icon-registry.ts` (+ `.test.ts`) | config/registry | request-response (lookup) | `src/navigation/RootNavigator.tsx:42-47` (`TAB_GLYPHS` map — the fork to retire) | role-match |
| `src/components/icons/Icon.tsx` | component | request-response | any `useTheme()` consumer (see `theme-provider.tsx:50`) | role-match |
| `src/components/icons/StatusGlyph.tsx` + `statusGlyph()` map | component + utility | transform | `src/components/contact-card-ring.ts:44-61` (`ringVisual` — extend, do NOT fork) | exact |
| `src/theme/theme-presets.ts` (extend: 4 palettes) | config/data | — | itself — the sole hex-literal file | exact (extend) |
| `src/theme/theme-types.ts` (extend: package axis, required `light`) | config/types | — | itself | exact (extend) |
| `src/theme/theme-provider.tsx` (extend: package + accent/bg axes) | provider | request-response | itself | exact (extend) |
| `src/stores/theme-store.ts` (rework: source of truth → `app_settings`) | store | CRUD (in-mem mirror) | itself; DAO read `getAppSettings` | exact (rework) |
| `src/db/app-settings-dao.ts` (extend: new columns) | model/DAO | CRUD | itself (`COLUMN_OF`, `assert*`, `getPortableSettingsSnapshot`) | exact (extend) |
| `src/backup/backup-schema.ts` (extend: `PORTABLE_SETTINGS_KEYS`) | config | — | itself | exact (extend) |
| `App.tsx` (fold theme read into `ready` gate) | boot shell | request-response | itself (`AppShell` `openAndMigrate` gate) | exact (extend) |

---

## Pattern Assignments

### `src/db/migrations/015-theme-settings.ts` (migration, additive schema)

**Analog:** `src/db/migrations/014-interaction-assists.ts` (additive ALTER); `002-app-settings.ts` (bound seed via injected `now`).

**Full additive idiom** (`014-interaction-assists.ts:1-29`) — copy this shape exactly; note `MigrationDeps`/`SqlExecutor` import, `version` field, and the trailing `ALTER TABLE app_settings ADD COLUMN … NOT NULL DEFAULT …` with an inline `CHECK`:
```typescript
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const migration014: Migration = {
  version: 14,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ...
      ALTER TABLE app_settings
        ADD COLUMN interaction_assist_enabled INTEGER NOT NULL DEFAULT 1;
    `);
  },
};
```

For migration 015 set `version: 15`. Every new column is `NOT NULL DEFAULT` with a `CHECK` on
enums (mode/package), so a device jumping v0→v15 lands seeded (Pitfall 4). Use `deps.now` (never
`toISOString().split('T')[0]`) for any timestamp write — see the `002-app-settings.ts:64-78` bound
INSERT that passes `deps.now` for `created_at`/`modified_at`.

**⚠ Accent-storage / check:colors trap (planner decision, RESEARCH Open Q1 / A5):**
`scripts/check-colors.sh` scans `src` recursively and migrations live at `src/db/migrations/`
(NOT under a `/theme/` path), so a raw `#RRGGBB` SQL `DEFAULT` in migration 015 **trips the gate**.
Store an accent **id/enum** (resolved to hex in `src/theme/accents.ts` at render) or `NULL`,
mirroring the `self_sun_colour = NULL → starPalette[0]`-at-render idiom already in place
(`app-settings-dao.ts:66-71, 346-349`). Never edit migrations 001–014.

---

### `src/db/app-settings-dao.ts` (DAO, CRUD) — the shared-table writer path

**Analog:** itself. New theme columns must be threaded through EVERY writer seam, in the order the
DAO enforces. The `self_sun_colour` field is the closest existing precedent (nullable, enum/shape-
validated, portable, NULL-resolved-at-render).

**1. Row read + NULL passthrough** (`app-settings-dao.ts:346-349`) — the DAO never resolves a
palette colour (it cannot import theme); resolution is at render:
```typescript
    // Raw NULL passes straight through as null — the DAO NEVER resolves a
    // palette colour (it cannot import theme); resolution happens at render.
    sunContactId: row.sun_contact_id ?? null,
    selfSunColour: row.self_sun_colour ?? null,
```

**2. Writable-key → column map** (`app-settings-dao.ts:278-300`) — add every new theme key here:
```typescript
const COLUMN_OF: Record<WritableSettingsKey, string> = {
  ...
  sunContactId: "sun_contact_id",
  selfSunColour: "self_sun_colour",
  ...
};
```

**3. Per-field validator + shared exported regex** (`app-settings-dao.ts:494, 512-519`) — copy the
`selfSunColour` pattern for accent/mode/package (exported constant + `assert*` that accepts null or
the exact shape; UI and conformance tests consume the same symbol):
```typescript
export const SELF_SUN_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

export function assertSelfSunColour(field: string, v: unknown): void {
  if (v === null) return;
  if (typeof v !== "string" || !SELF_SUN_COLOUR_RE.test(v)) {
    throw new Error(
      `updateAppSettings: ${field} must be null or a 6-hex colour, got ${String(v)}`,
    );
  }
}
```

**4. Wire the validator into the patch loop** (`app-settings-dao.ts:555-580`) — every writable
field is validated before the UPDATE opens (V5 input-validation, Security Domain). Add a
`*_FIELDS` array + loop for each new enum column (package/mode) exactly like `SELF_SUN_COLOUR_FIELDS`.

**5. Portable projection** (`app-settings-dao.ts:134-158` `PortableSettingsSnapshot` +
`getPortableSettingsSnapshot` at `387+`) — extend the interface and the explicit column pick so
new theme keys serialize into backup.

---

### `src/backup/backup-schema.ts` (config) — portable allowlist (D-09, Pitfall 6)

**Analog:** itself. Any settings key not in `PORTABLE_SETTINGS_KEYS` is REJECTED by
`assertPortableSettings` and dropped from the wire projection.

**Allowlist to extend** (`backup-schema.ts:106-113`):
```typescript
export const PORTABLE_SETTINGS_KEYS = new Set([
  "notificationsEnabled", "decayEnabled", ...
  "selfSunColour", "aiProvider", ...
  "birthdayUnboundEnabled",
]);
```
**Reject gate** (`backup-schema.ts:129-135`) — note `SECRET_SHAPED_KEY` already rejects
secret-shaped keys, so new plain theme prefs are safe (Security Domain, Info Disclosure row):
```typescript
function assertPortableSettings(settings: RawManifest, contacts: Set<string>): void {
  if (typeof settings.modifiedAt !== "string") fail("appSettings has an invalid modifiedAt");
  for (const key of Object.keys(settings)) {
    if (SECRET_SHAPED_KEY.test(key) || !PORTABLE_SETTINGS_KEYS.has(key)) {
      fail("appSettings contains a local-only or secret member");
    }
  }
```
Add every new theme key (package, per-package mode/accent/background). The Phase 36 backup-v4 bump
carries them; this phase only registers them.

---

### `src/theme/use-reduced-motion.ts` (hook, event-driven → Skia worklet) — HIGHEST RISK (D-07, THEME-06)

**Analog:** `src/components/orrery/OrreryCanvas.tsx:93-101` — the proven in-repo shared-value →
`useDerivedValue` render-loop pattern. The new hook produces a `SharedValue<boolean>`; the Skia
loop reads it the same way it reads the ambient clock, with **no per-frame setState**.

**Skia consumption pattern to mirror** (`OrreryCanvas.tsx:93-101`):
```typescript
  // M5: the ONE ambient clock (inside this unmountable subtree).
  const clock = useClock();

  const twinkle = useDerivedValue(() => {
    const t = (Math.sin(clock.value * TWINKLE_SPEED) + 1) / 2; // 0..1
    return TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * t;
  });
```

**Do NOT use Reanimated's `useReducedMotion()`** — it is boot-time-only and never re-updates on a
live toggle (RESEARCH Pitfall 1, verified against its `.d.ts`). Build the
`AccessibilityInfo.isReduceMotionEnabled()` seed + `addEventListener("reduceMotionChanged", …)`
subscription bridge writing into `useSharedValue<boolean>` (full excerpt in RESEARCH.md Pattern 1,
lines 184-213). Provide a separate state-backed boolean twin for non-Skia (React-tree) consumers;
never drive Skia from the boolean.

---

### `src/theme/contrast.ts` (utility, pure transform) — THEME-11

**Analog:** `src/components/contact-card-ring.ts` — the RN-free, node-testable pure-mapping idiom.
Copy its module contract: no `react-native` import, pure functions, header comment stating purity.

**Purity contract to mirror** (`contact-card-ring.ts:44-61`):
```typescript
export function ringVisual(
  status: ProfileStatus | null,
  colors: ThemePalette,
): RingVisual {
  switch (status) {
    case "stable":
      return { color: colors.statusStable, opacity: 1, width: 2 };
    ...
  }
}
```
The WCAG relative-luminance / ratio implementation (hand-rolled, ~30 lines, no dep) is in
RESEARCH.md lines 358-368. Run as vitest over all four palettes × (text-on-surface, accent-link,
on-accent-fg, status-on-surface).

---

### `src/components/icons/StatusGlyph.tsx` + `statusGlyph()` (component + utility) — THEME-08, D-05

**Analog:** `src/components/contact-card-ring.ts:44-61` — **extend, do NOT fork** (D-05). Add a
parallel pure `statusGlyph(status)` → semantic glyph id in the SAME module (or a sibling that
imports it) so card/profile/orrery/widget read ONE glyph+hue source. The status set is
stable/wobble/decay/rogue/null-neutral (ring) plus snoozed (UI-SPEC Status Glyphs table). Colour
resolves through tokens (`colors.statusStable` etc.), never a hex (D-06). Note the widget bitmap
uses a separate `widget-colors.ts` and has NO theme provider — do not wire the provider into the
headless widget (`contact-card-ring.ts:15-17` note).

---

### `src/components/icons/icon-registry.ts` + `Icon.tsx` (registry + component) — THEME-09, D-05

**Analog (the fork to retire):** `src/navigation/RootNavigator.tsx:42-47` — the current raw-glyph map:
```typescript
const TAB_GLYPHS: Record<keyof TabParamList, string> = {
  DashboardTab: "⌂",
  OrreryTab: "◎",
  BackupTab: "↥",
  SettingsTab: "⚙",
};
```
This is exactly the ad-hoc source the registry replaces. Build `ICON_REGISTRY` (semantic name →
Ionicons outline/filled pair) and an `<Icon>` that pulls colour from `useTheme().colors[tone]`
(D-06) and size from an `iconSize` token set (full excerpt RESEARCH.md Pattern 4, lines 244-263).
Screens import semantic names only. Routing the tab-bar glyphs through the registry this phase is
recommended (highest visibility); in-form `✕` conversions are planner's scope call.

**Theme-consumption pattern** (`theme-provider.tsx:50` `useTheme()`) — the only sanctioned way
`Icon.tsx` reads colour.

---

### `src/theme/theme-presets.ts` / `theme-types.ts` / `theme-provider.tsx` (extend) — THEME-01, D-10

**Analog:** themselves. Grow the single dark preset into four palettes; the fallback resolvers stop
being load-bearing once `light` is authored.

**Add the package axis to the pure resolver** — `resolveMode` (`theme-presets.ts:114-123`) is
RN-free and node-tested; keep new resolution pure so `theme-presets.test.ts` still runs in node:
```typescript
export function resolveMode(mode: ThemeMode, systemScheme: SystemScheme): ResolvedMode {
  return mode === "system"
    ? systemScheme === "light" ? "light" : "dark"
    : mode;
}
```
`theme-types.ts:161-172`: `ThemePresetId = "space-dark"` and `ThemePreset.light?` is optional today
— extend `ThemePresetId`/add a `ThemePackage` axis and make `light` **required** (four palettes).
`theme-provider.tsx:28-44` already resolves `system` live via `useColorScheme()` (Pattern 2, no
manual listener needed) — extend its `useMemo` to key on the new package/accent/background axes.
**Every hex literal stays inside `theme-presets.ts`** (or another `/theme/` path such as `accents.ts`).

---

### `src/stores/theme-store.ts` + `orbit-theme-migration.ts` (store rework + pure mapper) — D-08, THEME-03

**Analog:** `theme-store.ts` itself is the AsyncStorage source being retired; `getAppSettings`
(`app-settings-dao.ts:316`) becomes the new source of truth.

**The value to migrate** (`theme-store.ts:33-41`) — only `mode` + `presetId` exist; map
`presetId "space-dark" → galaxy`:
```typescript
    {
      name: "orbit-theme",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ mode: state.mode, presetId: state.presetId }),
```
`orbit-theme-migration.ts` is a pure `{mode, presetId} → column patch` mapper (node-testable, mirror
`contrast.ts`/`resolveMode` purity). Read-once-then-clear vs one-time-import is the plan's call
(RESEARCH Open Q2; recommendation: one-time import at boot then clear the AsyncStorage key).

---

### `App.tsx` (boot shell) — restore-before-paint gate (D-10, THEME-03, Pitfall 2)

**Analog:** `AppShell` (`App.tsx:129-161`) — the existing `ready` gate. Fold the theme-pref read
into it: after `openAndMigrate` resolves, read `getAppSettings()`, hydrate the theme store, then
flip `ready`.

**Gate to extend** (`App.tsx:147-161`):
```typescript
  useEffect(() => {
    let active = true;
    openAndMigrate(getDeviceRegion())
      .then(() => {
        if (active) setReady(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        Logger.error("bootstrap", "openAndMigrate failed", err);
        setError(err);
      });
    return () => { active = false; };
  }, []);
```
`ThemeProvider` stays OUTSIDE `AppShell` so the pre-`ready` splash resolves tokens; a short
neutral/default splash is acceptable, a flash of the wrong saved palette is not.

---

## Shared Patterns

### Colour tokens (D-06 — non-negotiable trip-wire)
**Source:** `src/theme/theme-presets.ts:18-98` (sole hex-literal file) + `useTheme()`
(`theme-provider.tsx:50`).
**Apply to:** every new visual file — `Icon.tsx`, `StatusGlyph.tsx`, all four palettes, Skia draw
calls. New palette/accent/background-tint hexes must live under a `src/**/theme/**` path or
`check:colors` fails (Pitfall 3, `scripts/check-colors.sh` exempts only `^[^:]*/theme/`).

### Pure, node-testable mapper idiom
**Source:** `src/components/contact-card-ring.ts` (RN-free, header states purity);
`resolveMode`/`resolvePalette` (`theme-presets.ts:114-138`).
**Apply to:** `contrast.ts`, `orbit-theme-migration.ts`, `statusGlyph()`, extended `resolveMode`
package axis — keep them importable in the node Vitest env (no `react-native` import).

### Shared-value → worklet bridge (never React state for animation, D-07)
**Source:** `src/components/orrery/OrreryCanvas.tsx:93-101` (`useClock` + `useDerivedValue`).
**Apply to:** `use-reduced-motion.ts` and every ambient/decorative Skia animation.

### app_settings writer contract (V5 input validation)
**Source:** `app-settings-dao.ts` (`COLUMN_OF:278`, `assert*:494-553`, patch loop `555-596`,
portable snapshot `134-158/387+`) + `backup-schema.ts` `PORTABLE_SETTINGS_KEYS:106` +
`assertPortableSettings:129`.
**Apply to:** every new theme column — DAO read, `COLUMN_OF`, exported validator + loop wiring,
portable projection, backup allowlist, and a `CHECK` constraint in migration 015. Miss any seam and
the pref either won't persist, won't validate, or won't survive restore.

### Migration safety (irreversible on device)
**Source:** `002-app-settings.ts:1-33` (additive/seed rationale), `014-interaction-assists.ts:25-26`
(additive ALTER), `full-chain.test.ts` (chain must extend to 015).
**Apply to:** migration 015 — purely additive, `NOT NULL DEFAULT`, never edit 001–014, seed inline
so v0→v15 lands clean.

---

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|------|------|-----------|---------------------|
| (none fully) | — | — | All 12 targets have a strong in-repo analog. The reduced-motion hook is net-new *as a hook* but the shared-value→worklet mechanism is proven in `OrreryCanvas.tsx`; the icon registry is net-new *as a subsystem* but `TAB_GLYPHS` is the fork it replaces. Use RESEARCH.md code examples (Patterns 1 & 4) for the parts with no line-for-line analog. |

---

## Metadata

**Analog search scope:** `src/theme/`, `src/db/migrations/`, `src/db/app-settings-dao.ts`,
`src/backup/`, `src/components/` (contact-card-ring, orrery), `src/stores/`, `src/navigation/`,
`App.tsx`, `src/db/database.ts`, `scripts/check-colors.sh`.
**Files scanned:** ~14 read on disk (full or targeted non-overlapping ranges).
**Migration head verified:** `TARGET_VERSION = 14` (`database.ts:49`), latest `014-*` → new = **015**.
**Pattern extraction date:** 2026-09-03
</content>
</invoke>
