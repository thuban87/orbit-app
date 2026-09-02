# Phase 13: Orrery - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 18 new/modified (9 new logic/db + 4 new UI/asset + 5 widened existing)
**Analogs found:** 18 / 18 (every new file has a shipped, verified analog on disk)

> Every analog below was opened and confirmed on disk this session (not trusted from the doc). Line numbers are from the current files. All the "no analog found" cells are empty — this phase is unusually reuse-heavy, exactly as RESEARCH's Reuse Map claimed.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/logic/orrery-geometry-logic.ts` | utility (pure) | transform | `src/logic/favourites-reorder-logic.ts` | role-match (pure `*-logic` idiom) |
| `src/logic/orrery-ring-logic.ts` | utility (pure) | transform | `src/components/contact-card-ring.ts` (`ringVisual`) | exact (status→visual map) |
| `src/logic/ring-reorder-logic.ts` | utility (pure) | transform | `src/logic/favourites-reorder-logic.ts` (`computeReorder`) | exact (clone) |
| `src/logic/sun-occupant-logic.ts` | utility (pure) | transform | `src/logic/favourites-reorder-logic.ts` (pure module shape) | role-match |
| `src/db/orrery-read.ts` | read DAO | request-response (read) | `src/db/dashboard-read.ts` | exact (read chokepoint composing `status.ts`) |
| `src/db/ring-seq-dao.ts` (`rewriteRingSeq`) | write DAO | CRUD (transactional reorder) | `src/db/favourites-dao.ts` (`rewriteFavouriteRanks`) | exact (clone verbatim) |
| `src/db/sun-picker-read.ts` | read DAO | request-response (read) | `src/db/dashboard-read.ts` (`listFavourites`) | exact |
| `src/db/app-settings-dao.ts` (WIDEN) | write/read DAO | CRUD | *(self — widen in place)* | modify existing |
| `src/db/migrations/003-orrery-settings.ts` | migration | batch (DDL) | `src/db/migrations/002-app-settings.ts` | exact (additive forward migration) |
| `src/db/database.ts` (WIDEN: TARGET_VERSION, array) | config | — | *(self — 2-line edit)* | modify existing |
| `src/screens/OrreryScreen.tsx` | screen (Skia) | event-driven (render loop) | `src/screens/CropPhotoScreen.tsx` | role-match (only Skia surface; static-body vs modal) |
| `src/components/SegmentedControl.tsx` | component | request-response | `src/components/FilterChipRow.tsx` | role-match (filled-accent chip idiom) |
| `src/theme/theme-presets.ts` (ADD tokens) | theme/config | — | *(self — extend `space-dark.dark`)* | modify existing |
| `src/theme/theme-types.ts` (ADD keys) | theme/config | — | *(self — extend `ThemePalette`)* | modify existing |
| `src/navigation/RootNavigator.tsx` (ADD route) | route | — | *(self — additive `<Stack.Screen>`)* | modify existing |
| `src/navigation/types.ts` (ADD param) | route | — | *(self — additive `RootStackParamList` entry)* | modify existing |
| `src/screens/HomeScreen.tsx` (ADD orbit button) | screen | — | `src/screens/HomeScreen.tsx:485-497` (Settings gear) | exact (self, mirror gear) |
| `src/screens/SettingsScreen.tsx` (ADD 2 controls) | screen | request-response | `src/screens/SettingsScreen.tsx` row idiom | exact (self, mirror shipped rows) |
| `assets/<font>.ttf` (NEW asset) | asset | — | *(none — no `.ttf` ships today)* | no analog (build-phase add) |

---

## Pattern Assignments

### `src/db/ring-seq-dao.ts` — `rewriteRingSeq` (write DAO, transactional reorder) — THE most load-bearing clone

**Analog:** `src/db/favourites-dao.ts` `rewriteFavouriteRanks` (lines 105-143). Clone it **verbatim**, swapping `favourite_rank` → `ring_seq` and the scope predicate. `ring_seq` has **no writer anywhere in the codebase today** — this is the first.

**Imports** (favourites-dao.ts:15-16):
```typescript
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
```

**Core pattern — the 3 guards + N raw UPDATEs in ONE txn** (favourites-dao.ts:110-142):
```typescript
return inWriteTransaction(exec, async () => {
  // Guard 1: reject a non-unique list BEFORE any write.
  if (new Set(orderedIds).size !== orderedIds.length) { throw new Error(/* dup */); }
  // Guard 2: the supplied list must be the COMPLETE current orbiting set.
  const countRow = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contacts WHERE last_contact IS NOT NULL AND archived_at IS NULL",
  );
  const current = countRow?.n ?? 0;
  if (current !== orderedIds.length) { throw new Error(/* count mismatch */); }
  // Guard 3: each UPDATE scoped to a live orbiting row (changes===1 per row).
  for (let rank = 0; rank < orderedIds.length; rank++) {
    const result = await exec.runAsync(
      `UPDATE contacts SET ring_seq = ?, modified_at = ?
         WHERE id = ? AND last_contact IS NOT NULL AND archived_at IS NULL`,
      [rank, now, orderedIds[rank]],
    );
    if (result.changes !== 1) { throw new Error(/* stale id */); }
  }
});
```

**CRITICAL (favourites-dao.ts:92-95, transaction.ts):** the mutex is **non-reentrant** — issue N *raw* UPDATEs inside the ONE outer `inWriteTransaction`; NEVER call a wrapped single-writer (e.g. `setFavouriteRank`) inside. `now` must be `localDateTime()` (database.ts:46), never `toISOString()`.

**Guard-2 scope note:** favourites scopes on `favourite_rank IS NOT NULL`; the orrery's orbiting set is `last_contact IS NOT NULL AND archived_at IS NULL` (matches `orrery-read`'s filter — see below). Keep the count-guard predicate identical to the read's WHERE so the two never disagree.

---

### `src/logic/ring-reorder-logic.ts` — `computeRingReorder` (pure transform)

**Analog:** `src/logic/favourites-reorder-logic.ts` `computeReorder` (lines 25-53). Clone verbatim (rename only). Pure, RN-free, node-tested; input never mutated, result always a permutation, out-of-range indices clamped (not thrown).

```typescript
export function computeReorder(orderedIds: number[], from: number, to: number): number[] {
  const next = orderedIds.slice();               // copy — never mutate input
  if (next.length === 0) return next;
  const clampedFrom = clampIndex(from, next.length);
  const clampedTo = clampIndex(to, next.length);
  if (clampedFrom === clampedTo) return next;    // no-op move
  const [moved] = next.splice(clampedFrom, 1);
  next.splice(clampedTo, 0, moved);
  return next;
}
```
The orrery maps release-radius → `targetRank`, then feeds `(currentOrderedIds, movedFromRank, targetRank)` here, then hands the result to `rewriteRingSeq`.

---

### `src/logic/orrery-ring-logic.ts` — status → stroke style (pure)

**Analog:** `src/components/contact-card-ring.ts` `ringVisual` (lines 44-61). Reuse its colour selection verbatim; **extend** with a stroke-style axis (solid/dashed/faded/faint-trace) per the UI-SPEC status table. Do NOT re-map colours — call/mirror `ringVisual` for `{color,opacity,width}`.

```typescript
// ringVisual returns { color, opacity, width } keyed on ProfileStatus | null:
//   stable → statusStable /1/2 · wobble → statusWobble /1/3
//   decay → statusDecay /1/4 · rogue → colors.rogue /1/3 · null → border /0.5/2
// orrery-ring-logic ADDS: strokeStyle 'solid'|'dashed'|'faded'|'faintTrace'
//   and the rogue BODY fill = colors.rogueExtinguished (new token; ring stays colors.rogue)
```
Every colour resolves through the passed `ThemePalette` — no hex (CLAUDE.md / `check:colors`).

---

### `src/logic/orrery-geometry-logic.ts` — angle/radius/drift/hit-test (pure)

**Analog (module shape only):** `src/logic/favourites-reorder-logic.ts` (RN-free, top-of-file doc, node-tested sibling `.test.ts`). No existing geometry analog — this is genuinely new math, but it MUST import thresholds, never re-type them.

**Reuse-not-rebuild imports** (from `src/db/status.ts:40-42`):
```typescript
import { STABLE_MAX, WOBBLE_MAX, ROGUE_K } from "@/db/status.ts";
// WARNING SIGN (Pitfall 1): the literals 3, 0.8, 1.0 appearing in orrery code = a bug.
```
Signatures (RESEARCH §Angle↔Time): `progressToAngle`, `evenSpreadAngle(i,count)`, `ringRadius(rank,inner,gap)`, `drawnRadius(progress,rank,status,C)` (clamps to `DRIFT_MAX`), `polarToXY(cx,cy,r,angle)`, `hitTest(px,py,bodies,HIT_RADIUS)`. All tunable constants (`RING_INNER`, `RING_GAP`, `MORPH_MS`, drift spans) sit at top-of-file (project convention). `[Owner-flag A2]` linear-vs-nonlinear angle map is unconfirmed — keep `progressToAngle` trivially swappable.

---

### `src/logic/sun-occupant-logic.ts` — sun resolution (pure)

**Analog (shape):** any `src/logic/*-logic.ts`. Pure resolver: `sunContactId` NULL → self (`selfSunColour ?? starPalette[0]`); live contact id → that contact (glow = contact's **status** colour, unchanged from 01-data); archived/missing id → `[Owner-flag A7]` recommend fall back to self. Exclude the occupant from the orbiting scan.

---

### `src/db/orrery-read.ts` — orbiting scan (read DAO)

**Analog:** `src/db/dashboard-read.ts`. Compose `status.ts` SQL fragments; never recompute status. The never-contacted / archived filter is the shipped `BASE_WHERE` at dashboard-read.ts:142-143:
```sql
c.archived_at IS NULL
  AND c.last_contact IS NOT NULL      -- load-bearing: makes STATUS_SQL NULL-safe (dashboard-read.ts:138)
```
Select `PROGRESS_SQL` and `STATUS_SQL` (status.ts:59,67) per row plus `ring_seq`, name, photo, `rarely_responds`. Dense rank from `ORDER BY COALESCE(ring_seq, 1e9), created_at, id` (RESEARCH). **Exclude the sun occupant** from the scan. Photo path via `resolvePhotoUri(relative)` (photo-storage.ts:130). Add a parity test mirroring dashboard-read's fuel-parity guard (Pitfall 1).

---

### `src/db/sun-picker-read.ts` — favourites-first picker list (read DAO)

**Analog:** `src/db/dashboard-read.ts` `listFavourites` (line 288):
```typescript
export function listFavourites(exec: SqlExecutor): Promise<FavouriteRow[]> {
  // ... WHERE archived_at IS NULL AND favourite_rank IS NOT NULL ORDER BY favourite_rank ASC
}
```
Compose: favourites (this order) first, then all other live contacts (`archived_at IS NULL AND last_contact IS NOT NULL`), + a synthetic "Me / self" row (NULL id). Read-only, no txn.

---

### `src/db/migrations/003-orrery-settings.ts` (migration) + `database.ts` registration

**Analog:** `src/db/migrations/002-app-settings.ts` (whole file) + `runner.ts` + `database.ts:37,110`.

**Migration shape** (mirror 002-app-settings.ts:57-80; additive, forward-only, NULL-default):
```typescript
import type { Migration, SqlExecutor } from "@/db/types";
export const ADD_SUN_CONTACT = `ALTER TABLE app_settings
  ADD COLUMN sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;`; // NULL = self
export const ADD_SELF_SUN_COLOUR = `ALTER TABLE app_settings ADD COLUMN self_sun_colour TEXT;`; // NULL → starPalette[0] at read
export const migration003: Migration = {
  version: 3,
  async apply(exec: SqlExecutor): Promise<void> {
    await exec.execAsync(ADD_SUN_CONTACT);
    await exec.execAsync(ADD_SELF_SUN_COLOUR);
  },
};
```
The runner (runner.ts:56-67) wraps each step `BEGIN; apply(); PRAGMA user_version = N; COMMIT` atomically — do not hand-roll a transaction here.

**Registration edits in `database.ts`:**
- Line 37: `export const TARGET_VERSION = 3;` (currently `2`)
- Line 110: `[migration001, migration002, migration003]` (currently `[migration001, migration002]`)

**Pitfall 3:** NO hex in the migration. `self_sun_colour` defaults NULL; resolve NULL → `starPalette[0]` at read. `[Owner-flag A1]` INTEGER+FK vs plain INTEGER; `[A6]` NULL-default. Test v1→v3 AND v2→v3 both land clean via the node:sqlite harness (`001-initial.test.ts` pattern).

---

### `src/db/app-settings-dao.ts` (WIDEN — modify in place)

**Self-modify.** Add to the four parallel structures, mirroring the shipped `deliveryHour`/`notificationsEnabled` treatment:
- `AppSettings` interface (line 30): `sunContactId: number | null`, `selfSunColour: string | null`
- `AppSettingsRow` (line 51): `sun_contact_id: number | null`, `self_sun_colour: string | null`
- `COLUMN_OF` map (line 77): `sunContactId: "sun_contact_id"`, `selfSunColour: "self_sun_colour"`
- `getAppSettings` SELECT (line 95): add both columns + map in the return object
- New validators mirroring `assertHour`/`assertToggle` (lines 114-130): `sun_contact_id` = null or positive int; `self_sun_colour` = null or `/^#[0-9A-Fa-f]{6}$/`. Validate BEFORE `inWriteTransaction` opens (line 145 posture). Palette **membership** is enforced UI-side, not here (the DAO cannot import theme).

---

### `src/screens/OrreryScreen.tsx` (Skia screen) — THE render reference

**Analog:** `src/screens/CropPhotoScreen.tsx` (the repo's ONLY Skia surface). Copy every idiom; the difference is CropPhoto is a static modal, the orrery has one *ambient* loop + a two-view morph.

**Skia/Reanimated/gesture imports** (CropPhotoScreen.tsx:40-59):
```typescript
import { Canvas, Fill, Group, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
// orrery ADDS: interpolate, interpolateColor, withTiming, Easing, runOnJS (reanimated);
//              useClock, useFonts, Skia.ParagraphBuilder (skia); Gesture.Tap/Pan/Race
```

**Shared-values-only rule** (CropPhotoScreen.tsx:126-129 comment is the law):
```typescript
// Live gesture/animation state — SHARED VALUES ONLY (never React state per frame).
const morph = useSharedValue(0);   // 0 = status view, 1 = relationship
```

**One-time init via React state is allowed** (CropPhotoScreen.tsx:145-168) — bodies are placed by timestamp math on focus, exactly this pattern (compute layout once, mirror into shared values / a ref).

**Derived draw values on the UI thread** (CropPhotoScreen.tsx:202-210):
```typescript
const cx = useDerivedValue(() => {
  'worklet';
  const a = interpolate(morph.value, [0,1], [statusAngle, restAngle]); // Pitfall 2: shortest-path wrap!
  return centre + radius * Math.sin(a);   // radius FIXED across the morph
});
```

**Colour through theme INSIDE Skia** (CropPhotoScreen.tsx:338): `<Fill color={colors.background} />` — every Skia colour via `useTheme().colors.*`.

**Gesture wraps Canvas** (CropPhotoScreen.tsx:333, 245): `<GestureDetector gesture={gesture}><Canvas>…</Canvas></GestureDetector>`. CropPhoto uses `Gesture.Simultaneous(pan,pinch)`; the orrery uses `Gesture.Race(tap, pan)` (tap→profile, pan→radial drag; `runOnJS(commitRingSeq)` on release).

**Pause-on-blur (NEW vs CropPhoto — it had no loop):** conditionally UNMOUNT `<Canvas>` when `!(useIsFocused() && appStateActive)` (Pitfall 4 — gating derived values does NOT stop the frame callback). CropPhoto satisfied this "by construction" (modal, no loop); the orrery must wire `useIsFocused` + an `AppState` listener.

---

### `src/components/SegmentedControl.tsx` (Status ｜ Relationship toggle)

**Analog:** `src/components/FilterChipRow.tsx` (whole file). Reuse the filled-accent idiom exactly — active = `accent` fill / `borderStrong` border / `background` label; inactive = `surface` fill / `border` border / `textSecondary` label (FilterChipRow.tsx:64-80). Reuse the style block (FilterChipRow.tsx:91-108): `minHeight:44`, `borderWidth:1`, `borderRadius:10`, `paddingHorizontal:12`, label `16/600`. Build a thin 2-segment control rather than overloading `FilterChipRow`'s `DashboardFilter`-keyed API (RESEARCH OQ-3, Claude's discretion).

---

### `src/screens/HomeScreen.tsx` (ADD orbit button)

**Analog:** the shipped Settings gear at HomeScreen.tsx:485-497 — mirror it beside the gear:
```typescript
<Pressable
  testID="dashboard-settings-entry"
  accessibilityRole="button" accessibilityLabel="Settings"
  onPress={() => navigation.navigate("Settings")}
  style={styles.settingsEntry}>
  <Text style={[styles.settingsGlyph, { color: colors.textSecondary }]}>⚙</Text>
</Pressable>
```
Add a sibling `◎` Pressable → `navigation.navigate("Orrery")`, `accessibilityLabel="Orbit view"`, pressed/active state uses `accent` (UI-SPEC reserved-accent list).

---

### `src/screens/SettingsScreen.tsx` (ADD "Your star" + "Sun / centre")

**Analog:** the shipped row idiom in-file — `styles.row` (SettingsScreen.tsx:687-690: `borderRadius:10, padding:12`), `styles.sectionHeading` (681), `styles.helper` (721), and the navigate-on-press rows at 610-646 (`onPress={() => navigation.navigate("ManageFavourites")}`). Both new controls write to `app_settings` via the widened `updateAppSettings`. "Your star" = a horizontal `starPalette`-swatch row (mirror the Phase-5 avatar-swatch discipline; selected swatch carries an `accent` ring). "Sun / centre" = a row opening the `sun-picker-read` list. Copy per UI-SPEC Copywriting Contract.

---

### `src/navigation/RootNavigator.tsx` + `src/navigation/types.ts` (ADD Orrery route)

**Analog:** the additive registrations already in both files.
- `types.ts` (mirror line 76 `Capture: undefined;`): add `Orrery: undefined;` to `RootStackParamList`.
- `RootNavigator.tsx` (mirror line 74): import `OrreryScreen`, add `<Stack.Screen name="Orrery" component={OrreryScreen} />`. `initialRouteName` stays `Home`; every existing route untouched.

---

### `src/theme/theme-presets.ts` + `src/theme/theme-types.ts` (ADD tokens)

**Analog:** the shipped `avatarSwatches`/`gravityTiers`/`statusStable…` seeds (theme-presets.ts:38-69) and their `ThemePalette` declarations (theme-types.ts:29-58). Add to `space-dark.dark` (the ONLY hex-literal file) and declare in `ThemePalette`:
- `starPalette: readonly string[]` (~6, ordered/stable — mirror the avatarSwatches "never reorder" warning comment). Seed per UI-SPEC (`#F2C14E` gold = default self-sun at index 0).
- `mutedStable`/`mutedWobble`/`mutedDecay` (desaturated morph endpoints).
- `rogueExtinguished` (cold dark body fill; the rogue *ring* stays `colors.rogue`).
All are owner-tunable design-pass seeds (13-CONTEXT deferred) — ship the UI-SPEC values as the default.

---

## Shared Patterns

### Transactional write posture (favourites-dao idiom)
**Source:** `src/db/favourites-dao.ts` + `src/db/transaction.ts` (non-reentrant mutex).
**Apply to:** `ring-seq-dao.ts`, `app-settings-dao.ts` widening.
One `inWriteTransaction`, `?`-bound UPDATE, `changes===1` loud-failure guard, validate-before-open. Never nest wrapped writers. `now = localDateTime()` never `toISOString()` (Pitfall 6).

### One source of truth for status/progress/rogue
**Source:** `src/db/status.ts` (`PROGRESS_SQL:59`, `STATUS_SQL:67`, `STABLE_MAX/WOBBLE_MAX/ROGUE_K:40-42`).
**Apply to:** `orrery-read.ts` (SQL), `orrery-geometry-logic.ts` (imported thresholds), `orrery-ring-logic.ts` (via `ringVisual`).
Import; never re-type. `ROGUE_K` is already read by notify — forking it re-opens a cross-phase invariant (Pitfall 1).

### Every colour through theme tokens — INCLUDING Skia
**Source:** `src/theme/theme-presets.ts` (the only hex file); CropPhotoScreen.tsx:338 proves Skia accepts token strings.
**Apply to:** OrreryScreen (all draw calls), SegmentedControl, orrery-ring-logic, the Settings swatches. `check:colors` gates this.

### Pure `*-logic.ts` + node-tested sibling
**Source:** `src/logic/favourites-reorder-logic.ts` (+ `.test.ts`), `birthday-logic.ts`, `compose-logic.ts`.
**Apply to:** all four new `src/logic/orrery-*` / `ring-reorder` / `sun-occupant` modules. RN-free, deterministic, Vitest node-side (RESEARCH Validation Architecture Wave 0).

### Additive forward-only migration
**Source:** `src/db/migrations/002-app-settings.ts` + `runner.ts` (atomic per-step `user_version` bump).
**Apply to:** migration 003. Never edit a shipped migration; NULL-default so `ALTER…ADD COLUMN` with `REFERENCES` is legal; irreversible on device.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `assets/<font>.ttf` | asset | — | No `.ttf` ships today (`assets/` verified empty of fonts). Build-phase add (Inter/Roboto weight 600, OFL/Apache — verify licence), registered with Skia `useFonts`. Blocking only for the initials-fallback path. |

*Note: the Skia render loop, two-view morph, and ambient starfield/pulse are new **compositions**, but each primitive (Canvas, `useDerivedValue`, gesture, `useImage`, theme colour) has an exact analog in `CropPhotoScreen.tsx` — so no primitive is analog-less.*

## Metadata

**Analog search scope:** `src/screens/`, `src/db/`, `src/db/migrations/`, `src/logic/`, `src/components/`, `src/theme/`, `src/navigation/`, `src/services/photos/`.
**Files scanned:** 18 analog files opened/verified on disk (CropPhotoScreen, favourites-dao, favourites-reorder-logic, 002-app-settings, runner, database, status, contact-card-ring, app-settings-dao, dashboard-read, RootNavigator, navigation/types, HomeScreen, FilterChipRow, theme-presets, theme-types, SettingsScreen, transaction) + grep confirmation of `resolvePhotoUri`/`getProfilePhoto`/`listFavourites`.
**Pattern extraction date:** 2026-08-17
</content>
</invoke>
