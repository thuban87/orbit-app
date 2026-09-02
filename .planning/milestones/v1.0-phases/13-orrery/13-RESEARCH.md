# Phase 13: Orrery — Research

**Researched:** 2026-08-17
**Domain:** Skia render-surface visualisation (two-view solar system) + one additive SQLite migration + pure geometry/reorder math
**Confidence:** HIGH (stack + platform facts verified first-hand on disk against installed packages; math interpretations flagged where the source phrasing is ambiguous)

> This phase is IMPLEMENTATION research. The design is settled (13-CONTEXT locked, 13-UI-SPEC approved, dossier 09 decided). Everything below is grounded in the actual code on disk — every symbol cited was opened and confirmed to exist with the stated shape. Where a HANDOFF/dossier phrasing admits more than one implementation, the ambiguity is called out and logged in the Assumptions Log for planner/owner confirmation, not silently resolved.

---

<user_constraints>
## User Constraints (from 13-CONTEXT.md)

### Locked Decisions
- **Relationship view (calm map):** muted = **desaturated status colours** (same hue, low saturation) — NOT greyscale, NOT single neutral. Retains a faint desaturated status signal. Morph fades **both angle** (even resting → progress) **and colour** (muted → full); **radius stays fixed** (shared axis). Relationship resting angles = **even aesthetic spread**.
- **Self-sun & star palette:** dedicated themed **star-colour token set** (through theme tokens, mirroring Phase-5 avatar-swatch discipline) — NOT freeform hex, NOT the accent token. **~6 curated star colours.** Colour picked in **Settings** ("Your star"). Default before pick = **warm gold/yellow** star token (`starPalette[0]` = `#F2C14E`).
- **Morph/controls/rogue:** view toggle = **segmented control** (Status ｜ Relationship) reusing the filled-accent chip idiom (`FilterChipRow`). Morph ≈ **~500ms ease-in-out**, single tunable constant. Rogue multiple = **FIXED shared constant, reuse `ROGUE_K = 3` from `src/db/status.ts`** — NOT user-tunable. Ambient = **subtle** starfield twinkle + slow sun pulse; **pause-on-blur by conditionally unmounting `<Canvas>`** on `useIsFocused && AppState==='active'`.
- **Entry & manipulation (ORR-06):** dashboard→orrery = **header orbit button** beside the Settings gear. **Sun-occupant assignment lives in SETTINGS, not the orrery (owner override).** Settings picker lists **favourites first, then all contacts, plus "Me / self"** (NULL = self). Long-press on the orrery was **REJECTED by the owner**. **The half of ORR-06 that stays on the canvas is the `ring_seq` radial drag** — do NOT "restore" orrery-based sun assignment as a later gap fix. Set `ring_seq` = **drag a planet radially**, commit on release through a single transactional writer. Empty state = sun + gentle "mark someone contacted to see them orbit" prompt.

### Claude's Discretion
- Exact morph easing/duration within ~500ms; segmented-control styling within the filled-accent idiom; internal structure of the pure math modules.
- (Planning bucket, per dossier) `ring_seq` renumber-vs-gap on archive/purge — **leave-gap recommended below**.

### Deferred Ideas (OUT OF SCOPE)
- Exact star-palette hex set + relationship "muted" tone (design-pass §12.4 taste — the UI-SPEC ships tunable seeds).
- Whether relationship resting angles are purely even vs lightly grouped (aesthetic).
- Body-size = gravity/frequency encodings — **deliberately un-encoded in v1** (dossier Cluster C/F). Not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ORR-01** | Skia solar system — per-contact rings (radius=`ring_seq`/closeness), angle=interval progress, status colour + ring style, sun at centre; never-contacted excluded | §Standard Stack (Skia canvas), §Angle↔Time Math, §Reuse Map (new `orrery-read` composes `PROGRESS_SQL`/`STATUS_SQL`), §Ring Vocabulary (extends `contact-card-ring.ts`) |
| **ORR-02** | Two views (status default, relationship) sharing radius axis, morph on one canvas via toggle | §Two-View Morph (single `morph` shared value, `interpolate`/`interpolateColor` in `useDerivedValue` worklets), §Reuse Map (`FilterChipRow` idiom) |
| **ORR-03** | Bodies placed by timestamp math on focus (no live body loop); tap→profile; ambient starfield + sun pulse pause on blur/background | §Ambient Layer + Pause, §Tap Hit-Testing, §Angle↔Time Math (placed-on-focus) |
| **ORR-04** | `rogue` = max drift + cold/extinguished body + faint ring, on rails & tappable, single shared rogue constant | §Angle↔Time Math (drift + `DRIFT_MAX` clamp), §Reuse Map (`ROGUE_K` imported, `rogueExtinguished` token) |
| **ORR-05** | Self-sun colour user-selectable from themed star palette; contact-occupied sun glows that contact's status; sun-only orrery shows empty-state prompt | §Migration 003 (`self_sun_colour`), §Sun Occupant Resolution, §Standard Stack (theme tokens `starPalette`) |
| **ORR-06** | Set `ring_seq` by dragging a body **and** assign the sun from the orrery | §ring_seq Radial Drag → Commit (canvas half). **Sun-assignment half relocated to Settings by owner decision — see User Constraints; NOT an ORR-06 gap.** §Migration 003 (`sun_contact_id`) |
</phase_requirements>

---

## Summary

Phase 13 is a self-contained Skia render surface plus **one additive, forward-only SQLite migration (003)** and a cluster of **pure, node-tested `*-logic.ts` math modules**. The entire animated stack — `@shopify/react-native-skia@2.6.2`, `react-native-reanimated@4.5.1`, `react-native-worklets@0.10.4`, `react-native-gesture-handler@~2.32.0` on RN 0.86.2 / Expo ~57.0.13 — is **already installed and proven in production** by `CropPhotoScreen.tsx` (the repo's only prior Skia surface). No new npm dependency is required; the only new binary asset is **one bundled `.ttf`** for the Skia planet-initials fallback (Skia's Paragraph API has no OS-default font). This dramatically de-risks the phase: there is nothing to verify on the registry, only patterns to reuse.

The correctness-critical work is math, not rendering, and it belongs in RN-free modules the repo already tests with Vitest + in-memory `node:sqlite`: **progress→angle mapping, drift/clamp, hit-testing, even-spread angles, and `ring_seq` reorder**. The rendering itself copies `CropPhotoScreen`'s exact idioms — `<Canvas>` + `useSharedValue`/`useDerivedValue`, `Gesture*` composition, every colour through `useTheme().colors.*` including inside Skia draw calls, and never a per-frame `setState`. The orrery reads status/progress/rogue from `src/db/status.ts` **verbatim** (`PROGRESS_SQL`, `STATUS_SQL`, `ROGUE_K = 3`) and must never recompute them.

Two integration seams need care. **Migration 003** adds `sun_contact_id` and `self_sun_colour` to the single-row `app_settings` table (app-level state, not per-contact) — the first schema change since 002, and irreversible on real devices. **`ring_seq` has no writer anywhere in the codebase today** (it exists in the schema from migration 001, is read in `contact-read.ts`, and is never written) — so the orrery introduces the *first* `ring_seq` writer, which should mirror the proven `rewriteFavouriteRanks` transactional-reorder pattern exactly.

**Primary recommendation:** Build the geometry/reorder as pure `*-logic.ts` modules tested node-side first; add migration 003 as two nullable `ALTER TABLE ADD COLUMN`s (bump `TARGET_VERSION` to 3, append `migration003` to the `database.ts` array); render by cloning `CropPhotoScreen`'s Skia/Reanimated/gesture idioms; reuse `status.ts` and `contact-card-ring.ts` rather than rebuilding status/ring logic.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Angle/radius/drift/hit-test/reorder math | Pure logic (`src/logic/*-logic.ts`, RN-free) | — | Correctness-critical, node-testable; repo convention (`birthday-logic`, `compose-logic`, `favourites-reorder-logic`) |
| Status/progress/rogue derivation | Data (`src/db/status.ts`) | — | Already the single source of truth; DERIVED-NEVER-STORED; reuse verbatim |
| Orbiting-contact scan (id, name, photo, ring_seq, status, progress) | Data (new `src/db/orrery-read.ts`) | `status.ts` fragments | Read chokepoint composing existing SQL, mirroring `dashboard-read.ts` |
| `ring_seq` write, sun/star settings write | Data (transactional DAOs) | `transaction.ts` | Single-writer + `changes===1` guards; `last_contact` DAO untouched |
| Schema change (`sun_contact_id`, `self_sun_colour`) | Data (`migrations/003-*.ts`) | `runner.ts` | Forward-only `user_version` migration |
| Canvas render / morph / ambient loop / gestures | UI (`src/screens/OrreryScreen.tsx` + Skia) | Reanimated worklets (UI thread) | Off-JS-thread animation; pause by unmount |
| Theme tokens (star palette, muted, extinguished) | Theme (`theme-presets.ts` + `theme-types.ts`) | — | Single hex home; no hardcoded colour elsewhere, canvas included |
| Nav registration + dashboard entry button | UI (`RootNavigator.tsx`, `navigation/types.ts`, `HomeScreen.tsx`) | — | Additive native-stack route + header button |
| Settings controls ("Your star", "Sun / centre") | UI (`SettingsScreen.tsx`) | app-settings DAO | Owner relocated sun assignment here |

---

## Standard Stack

### Core (all already installed & proven — no install step, no registry risk)
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `@shopify/react-native-skia` | **2.6.2** `[VERIFIED: package.json + node_modules]` | `<Canvas>`, `<Circle>`, `<Fill>`, `ImageShader`, Paragraph API, `useImage`, `useClock` | The RN GPU-drawing standard; Expo SDK-57-pinned; proven by `CropPhotoScreen` |
| `react-native-reanimated` | **4.5.1** `[VERIFIED]` | The animation engine (worklets on UI thread): `useSharedValue`, `useDerivedValue`, `withTiming`, `interpolate`, `interpolateColor`, `Easing` | Skia's animation is now Reanimated-driven (dossier P2); off-JS-thread guarantee |
| `react-native-worklets` | **0.10.4** `[VERIFIED: node_modules]` | Worklet runtime backing Reanimated 4 | Hard dep of Reanimated 4 (New Arch) |
| `react-native-gesture-handler` | **~2.32.0** `[VERIFIED]` | `Gesture.Tap`/`Gesture.Pan`/`Gesture.Race`, `GestureDetector` | Tap + radial-drag composition; proven by `CropPhotoScreen` (Pan/Pinch) |
| `@react-navigation/native-stack` | **^7.18.8** `[VERIFIED]` | Additive `Orrery` route registration | Every existing screen registered here |
| `@react-navigation/native` | **^7.3.16** `[VERIFIED]` | `useIsFocused` for pause-on-blur | Standard focus hook |
| `react-native` (`AppState`) | **0.86.2** `[VERIFIED]` | Background detection for pause | Built-in |

### Supporting
| Item | Purpose | When to Use |
|------|---------|-------------|
| One bundled `.ttf` (e.g. Inter or Roboto, weight 600) | Skia Paragraph API planet-initials fallback | **Mandatory** — Skia has no OS-default font. `assets/` currently ships **no** `.ttf` `[VERIFIED: ls assets/]` |
| `resolvePhotoUri(relative)` from `src/services/photos/photo-storage.ts` | Rel `avatars/<name>.<ext>` → absolute `file://` URI for `useImage` | Every planet photo + self/contact sun photo |
| `getProfilePhoto` / `getProfile` from `profile-dao.ts` | Self photo for the self-sun occupant | Sun render when `sun_contact_id IS NULL` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `require('*.ttf')` bundled font | `@expo-google-fonts/inter` (npm package) | Adds a new dependency → package-legitimacy gate + install step. The raw `.ttf` require adds **no** npm dependency — prefer it (matches UI-SPEC "the executor adds it"). |
| New `orrery-read.ts` chokepoint | Extend `dashboard-read.ts` | `dashboard-read` has 4 mutually-exclusive population branches and no `ring_seq`/`rarely_responds` projection; a dedicated read is cleaner and keeps the dashboard read untouched |
| `sun_contact_id INTEGER` FK | `sun_contact_id TEXT` (research-agenda hint) | INTEGER + `REFERENCES contacts(id) ON DELETE SET NULL` is type-correct (it IS a contact id) and auto-reverts a purged sun to self. See Migration 003 + Assumptions A1. |

**Installation:** None. All native modules present and proven. Only asset work: add one `.ttf` under `assets/` and register it with Skia's font manager (`useFonts`).

**Version verification (performed this session):**
```
@shopify/react-native-skia   2.6.2      [VERIFIED: node_modules present]
react-native-reanimated      4.5.1      [VERIFIED]
react-native-worklets        0.10.4     [VERIFIED: node_modules/react-native-worklets/package.json]
react-native-gesture-handler ~2.32.0    [VERIFIED]
react-native                 0.86.2     [VERIFIED]
expo                         ~57.0.13   [VERIFIED]
```
`useImage` signature confirmed on disk: `useImage(source: DataSourceParam, onError?: (err: Error) => void) => SkImage | null` `[VERIFIED: node_modules/@shopify/react-native-skia/.../Image.d.ts]`. Reanimated exports `interpolateColor`, `useDerivedValue`, `Easing`, `interpolate` `[VERIFIED: node_modules/react-native-reanimated/lib/typescript/index.d.ts]`. Skia `ParagraphBuilder` type present `[VERIFIED]`.

## Package Legitimacy Audit

> This phase installs **no new npm packages** — the entire stack is already installed and shipping (Phase 5 widget/photo work). No registry legitimacy check is required for dependencies.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none added) | — | — | — | — | — | No new dependency |
| bundled `.ttf` font | not an npm package | n/a | n/a | Inter (github.com/rsms/inter, OFL) or Roboto (Apache-2.0) | OK (asset) | Vendored asset — verify licence (OFL/Apache permit bundling), not a registry dep |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.
*If the planner instead chooses `@expo-google-fonts/*`, that IS a new npm dependency and must pass `gsd-tools query package-legitimacy check --ecosystem npm` + `npx expo install` pinning before use. The raw-`.ttf` path avoids this entirely and is recommended.*

---

## Architecture Patterns

### System Architecture Diagram

```
                         focus / toggle / gesture events
                                      │
  ┌───────────────────────────────────────────────────────────────────────┐
  │  OrreryScreen.tsx  (UI thread render; NO per-frame setState)           │
  │                                                                        │
  │  on focus ──▶ orrery-read.ts ──▶ [PROGRESS_SQL, STATUS_SQL, ring_seq,  │
  │              (SQLite, offline)      photo, rarely_responds] per contact │
  │                     │                                                   │
  │                     ▼                                                   │
  │        orrery-geometry-logic.ts (PURE)                                 │
  │        progress→angle · rank→radius · drift(progress) · evenSpread     │
  │                     │                                                   │
  │     ┌───────────────┼───────────────────────────┐                      │
  │     ▼               ▼                            ▼                      │
  │  status layout   relationship layout      hit-test table               │
  │     └──────┬────────┘                            │                      │
  │            ▼                                      │                      │
  │   morph SharedValue 0↔1 ──▶ useDerivedValue worklets                    │
  │   (interpolate angle, interpolateColor; radius FIXED)                   │
  │            │                                      │                      │
  │            ▼                                      ▼                      │
  │  ┌──────────────────────── <Canvas> ─────────────────────┐             │
  │  │ Fill · Starfield(twinkle) · Rings · Planets(useImage) │             │
  │  │ · Sun(pulse glow) ── all colours via useTheme().colors│             │
  │  └───────────────────────────────────────────────────────┘             │
  │            │                            │                                │
  │   GestureDetector: Gesture.Race(tap, pan)                              │
  │      tap ─▶ hitTest ─▶ navigate("Profile")                             │
  │      pan ─▶ radius preview ─▶ release ─▶ ring-reorder-logic (PURE)     │
  │                                    └─▶ rewriteRingSeq (txn writer)      │
  │                                                                        │
  │   pause: unmount <Canvas> when !(useIsFocused && AppState==='active')  │
  └───────────────────────────────────────────────────────────────────────┘

  Settings (separate screen): "Your star" swatch ─▶ self_sun_colour
                              "Sun / centre" picker ─▶ sun_contact_id
                              both ─▶ app-settings-dao ─▶ app_settings (migration 003)
```

### Recommended Project Structure
```
src/
├── logic/
│   ├── orrery-geometry-logic.ts   # progress→angle, rank→radius, drift, evenSpread, polarToXY, hitTest (PURE)
│   ├── orrery-geometry-logic.test.ts
│   ├── orrery-ring-logic.ts       # status → stroke style (solid/dashed/faded/faint-trace); reuses ringVisual colour
│   ├── ring-reorder-logic.ts      # computeRingReorder(orderedIds, movedId, targetRank) (PURE, mirrors favourites-reorder-logic)
│   └── sun-occupant-logic.ts      # resolve sun_contact_id (+archived/missing) → {kind:'self'|'contact', ...} (PURE)
├── db/
│   ├── orrery-read.ts             # orbiting-contact scan; composes status.ts fragments (READ-ONLY)
│   ├── ring-seq-dao.ts            # rewriteRingSeq transactional writer (mirrors rewriteFavouriteRanks)
│   ├── sun-picker-read.ts         # favourites-first-then-all contacts list for the Settings picker
│   ├── app-settings-dao.ts        # WIDEN: add sun_contact_id + self_sun_colour to AppSettings/Row/COLUMN_OF/validation
│   └── migrations/003-orrery-settings.ts   # ALTER app_settings ADD COLUMN ×2
├── screens/
│   └── OrreryScreen.tsx           # the <Canvas> surface (clone CropPhotoScreen idioms)
├── components/
│   └── SegmentedControl.tsx       # Status|Relationship toggle (filled-accent idiom, mirrors FilterChipRow)  [or reuse FilterChipRow]
└── theme/
    ├── theme-presets.ts           # ADD starPalette, mutedStable/Wobble/Decay, rogueExtinguished
    └── theme-types.ts             # ADD the token keys to ThemePalette
assets/
└── <font>.ttf                     # NEW — Skia initials fallback
```

### Pattern 1: Skia canvas with Reanimated-driven geometry (THE reference)
**What:** `<Canvas>` reads live position/colour from Reanimated `useDerivedValue`; React state only for one-time init and non-per-frame concerns.
**When to use:** the entire OrreryScreen render.
**Source:** `src/screens/CropPhotoScreen.tsx` `[VERIFIED: read in full this session]` — copy these idioms:
```tsx
// Shared values only (never React state per frame) — CropPhotoScreen.tsx:126-139
const morph = useSharedValue(0);           // 0 = status view, 1 = relationship
// Per body: derive drawn position/colour on the UI thread — CropPhotoScreen.tsx:202-210
const cx = useDerivedValue(() => {
  'worklet';
  const a = interpolate(morph.value, [0, 1], [statusAngle, restAngle]); // shortest-path, see Pitfall 2
  return centre + radius * Math.sin(a);    // radius FIXED across the morph
});
// Colours through theme, INCLUDING in Skia — CropPhotoScreen.tsx:338 uses colors.background in <Fill>
<Fill color={colors.background} />
// Gesture wraps the Canvas — CropPhotoScreen.tsx:333
<GestureDetector gesture={gesture}><Canvas>…</Canvas></GestureDetector>
```

### Pattern 2: Forward-only additive migration (THE reference)
**Source:** `src/db/migrations/002-app-settings.ts` + `runner.ts` + `database.ts` `[VERIFIED]`. The runner wraps each step `BEGIN; apply(); PRAGMA user_version = N; COMMIT` (rollback preserves the original error). Register by appending to the `database.ts` array and bumping `TARGET_VERSION`. See §Migration 003.

### Pattern 3: Single-writer transactional reorder (THE reference for `ring_seq`)
**Source:** `rewriteFavouriteRanks` in `src/db/favourites-dao.ts` `[VERIFIED]` — one `inWriteTransaction`, off-DB-computed ordering, 3 guards (unique ids / count match / per-row scoped `changes===1`), N raw UPDATEs inside ONE transaction (never call a wrapped single-writer inside — the mutex is **non-reentrant**, `transaction.ts:15`). `ring_seq` reorder should clone this exactly.

### Anti-Patterns to Avoid
- **Per-frame `setState`** to move planets — forbidden (CLAUDE.md). Positions come from `useDerivedValue` worklets only.
- **Recomputing status/progress/rogue** — import `PROGRESS_SQL`/`STATUS_SQL`/`ROGUE_K` from `status.ts`; never re-type the thresholds (drift already documented in `status.ts`).
- **Hardcoding any colour in a Skia draw call** — resolve through `useTheme().colors.*`; add new hexes ONLY to `theme-presets.ts`.
- **Adding an index/UNIQUE to `app_settings` new columns** — not needed; keep the single-row table plain.
- **Gating derived values to "pause"** — that only hides motion; the frame loop keeps running (dossier P2). Pause = **unmount `<Canvas>`**.
- **Calling `rewriteRingSeq`/`setFavouriteRank` inside another `inWriteTransaction`** — permanent hang (non-reentrant mutex).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status/progress/rogue thresholds | A second CASE/threshold set | `PROGRESS_SQL`, `STATUS_SQL`, `ROGUE_K`, `STABLE_MAX`, `WOBBLE_MAX` from `status.ts` | One source of truth; notify already reads `ROGUE_K` — forking it re-opens a cross-phase invariant |
| Ring colour/opacity/weight | New status→colour map | `ringVisual()` from `contact-card-ring.ts` | Already the shared status→ring vocabulary; extend with dash style only |
| Rel→absolute photo path | Manual `file://` join | `resolvePhotoUri(relative)` from `photo-storage.ts` | Single rel↔`file://` mapping; rejects traversal |
| Avatar swatch + initials | New hashing/colour | `avatarSwatches` token indexed `abs(hash(name)) % 8` (as `Avatar.tsx` does) | Deterministic per-contact colour already shipped |
| Reorder-commit transaction | Ad-hoc UPDATE loop | Clone `rewriteFavouriteRanks` (3 guards, one txn) | Proven guards prevent partial/duplicate/stale ranks |
| Migration transaction | Manual BEGIN/COMMIT | The `runner.ts` step wrapper | Atomic `user_version` bump + original-error preservation |
| Colour interpolation | Manual RGB lerp in a worklet | `interpolateColor(morph, [0,1], [full, muted])` | Reanimated worklet-safe; handles hex/HSL token strings |

**Key insight:** almost every "new" capability the orrery seems to need already exists as a shipped, tested primitive. The genuinely new code is (a) the pure geometry math, (b) migration 003 + DAO widening, (c) the `ring_seq` writer, and (d) the Skia render composition. Everything else is reuse.

---

## Angle↔Time Math (ORR-01 / ORR-04) — pure `orrery-geometry-logic.ts`

**Inputs per body:** `progress` (= `PROGRESS_SQL` = elapsed ÷ interval, a continuous ≥0 real; `status.ts:59`), `rank` (dense sort position by `ring_seq`), `status` (from `STATUS_SQL`).

**Angle (status view).** 0 at 12 o'clock, clockwise, one full interval = one full revolution (HANDOFF §7: "they sweep round as days pass," top arc = first half, bottom arc = second half → the split at `progress = 0.5` sits at 6 o'clock).
```ts
// radians, 0 at top, clockwise; wraps each interval
export function progressToAngle(progress: number): number {
  const frac = progress - Math.floor(progress);   // progress mod 1, ≥0
  return frac * 2 * Math.PI;                        // 0→top, 0.5→bottom(6 o'clock), 1→top
}
// screen position (y grows downward): clockwise-from-top
export function polarToXY(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
}
```
`[ASSUMED — A2]` The linear full-orbit map is the "simplest" reading of HANDOFF §7, but the "top arc first half / bottom arc second half" phrasing also admits a non-linear split (first half of the interval compressed into the upper semicircle). At `progress = 1.0` this map returns a body to 12 o'clock; the **drift + status colour disambiguate** "fresh at top" (progress 0, stable, on-ring) from "overdue at top" (progress 1.0, decay, drifted out). Flag for owner/planner confirmation before locking.

**Radius (both views — the SHARED axis, fixed across the morph).**
```ts
export function ringRadius(rank: number, RING_INNER: number, RING_GAP: number) {
  return RING_INNER + rank * RING_GAP;
}
```
If the outermost rank overflows the viewport, compress `RING_GAP` proportionally so the furthest ring stays on-screen (UI-SPEC; planner detail).

**Drift (status view; carries overdue-ness; ORR-04 clamp).** `DRIFT_MAX` in the UI-SPEC is an **absolute drawn-radius bound** (`min(cx,cy) − PLANET_RADIUS − 8`), not a delta.
```ts
// drawn radius = ring radius + outward push, clamped to the on-screen bound
export function drawnRadius(progress, rank, status, C): number {
  const base = ringRadius(rank, C.RING_INNER, C.RING_GAP);
  let push = 0;                                        // stable/wobble sit on-ring
  if (status === 'decay') {                            // progress ∈ [WOBBLE_MAX, ROGUE_K)
    const t = (progress - WOBBLE_MAX) / (ROGUE_K - WOBBLE_MAX);   // 0→1 across the decay band
    push = clamp01(t) * C.DECAY_DRIFT_SPAN;
  } else if (status === 'rogue') {                     // progress ≥ ROGUE_K OR rarely_responds
    push = C.ROGUE_DRIFT_SPAN;                          // furthest
  }
  return Math.min(base + push, C.DRIFT_MAX);           // hard clamp → always on-screen & tappable
}
```
Reuse `WOBBLE_MAX` (1.0) and `ROGUE_K` (3) imported from `status.ts` — do NOT re-type. The band widths (`DECAY_DRIFT_SPAN`, `ROGUE_DRIFT_SPAN`) are top-of-file tunable constants. `[ASSUMED — A3]` the drift growth shape (linear across the decay band, flat maximum for rogue) is a reasonable reading of "drifts further, rogue furthest"; confirm the exact curve at planning.

**Even-spread angles (relationship view — free axis).**
```ts
export function evenSpreadAngle(index: number, count: number): number {
  return count > 0 ? (index / count) * 2 * Math.PI : 0;  // stable per-body, decay-independent
}
```
`[ASSUMED — A4]` "even" = uniform `index/count`. Light grouping is a deferred aesthetic (CONTEXT deferred).

**Signatures for the node-tested module:** `progressToAngle(progress)`, `evenSpreadAngle(index,count)`, `ringRadius(rank,inner,gap)`, `drawnRadius(progress,rank,status,C)`, `polarToXY(cx,cy,r,angle)`, `hitTest(...)` (below). All pure, RN-free, deterministic — directly node-testable.

## Tap Hit-Testing + Overlap (ORR-01 / ORR-03) — pure + gesture

Skia has **no view hierarchy**, so hit-testing is coordinate math (dossier P2, confirmed).
```ts
// nearest-wins over overlapping planets; returns the closest body within HIT_RADIUS, else null
export function hitTest(px, py, bodies: {id:number,x:number,y:number}[], HIT_RADIUS: number): number | null {
  let best: number | null = null, bestD2 = HIT_RADIUS * HIT_RADIUS;
  for (const b of bodies) {
    const d2 = (px - b.x) ** 2 + (py - b.y) ** 2;
    if (d2 <= bestD2) { bestD2 = d2; best = b.id; }     // ≤ so the last-drawn (top) wins ties
  }
  return best;
}
```
The `bodies` array is the **currently resting layout** (status or relationship, whichever `morph` has settled on) computed in JS from the same pure functions — taps mid-500ms-morph are an acceptable edge case; hit-test against the resting target. Sun hit-test is a separate `d² ≤ SUN_HIT²` check at `(cx,cy)`.

**Gesture composition** (mirrors gesture-handler 2.32 API proven in `CropPhotoScreen`):
```ts
const tap = Gesture.Tap().maxDistance(8).onEnd((e) => { runOnJS(handleTap)(e.x, e.y); });
const pan = Gesture.Pan().activateAfterLongPress(0).minDistance(10)  // movement past threshold → radial drag
  .onBegin((e) => { /* worklet: hit-test the body under touch-down */ })
  .onUpdate((e) => { /* worklet: live radius preview (accent ghost ring) */ })
  .onEnd((e)   => { runOnJS(commitRingSeq)(/* release radius */); });
const gesture = Gesture.Race(tap, pan);   // stationary → tap(profile); movement → pan(drag)
```
`Gesture.Race(tap, pan)` = whichever recognises first wins; a stationary touch resolves to tap → profile, movement past the `minDistance` threshold activates pan → radial drag. Both first identify the planet under the touch-down point. `[VERIFIED: gesture-handler 2.32 Gesture API; Gesture.Simultaneous(pan,pinch) proven in CropPhotoScreen.tsx:245]`

## ring_seq Radial Drag → Commit (ORR-06 canvas half) — pure + txn writer

**Critical finding:** `ring_seq` **has no writer anywhere in the codebase.** It exists in `contacts` from migration 001 (`001-initial.ts:75`), is read in `contact-read.ts` (`ContactEditRow.ring_seq`), and is **never written** (grep-verified: only schema/read/reserved-columns references). The orrery introduces the **first** `ring_seq` writer.

**Rank derivation for radius (read time):** rank = dense sort position over the orbiting set:
```sql
ORDER BY COALESCE(ring_seq, 1e9), created_at, id     -- ring_seq overrides; ties fall back to created_at
```
Row position (0-based) = the `rank` fed to `ringRadius`. Because rank is **derived densely at read time**, the stored `ring_seq` values need only encode *relative order* — gaps are harmless.

**Commit on release:** map release radius → nearest rank, clamp, reorder:
```ts
const targetRank = clamp(Math.round((releaseRadius - RING_INNER) / RING_GAP), 0, N - 1);
const orderedIds = computeRingReorder(currentOrderedIds, movedId, targetRank);  // PURE, mirrors favourites-reorder-logic
await rewriteRingSeq(exec, orderedIds, now);   // ONE txn, 3 guards, ring_seq = array index (favourites clone)
```
The angular component is **ignored** during the drag (UI-SPEC). `rewriteRingSeq` clones `rewriteFavouriteRanks` verbatim (unique-ids / count-match / per-row scoped `changes===1`), writing `ring_seq = index` for the orbiting set in one `inWriteTransaction`. The `last_contact` single-writer DAO is untouched.

**Renumber-vs-gap on archive/purge (dossier deferred → planner call): RECOMMEND LEAVE-GAP.** Justification: (1) radius rank is derived densely at read time, so a gap in stored `ring_seq` values never affects layout; (2) it matches the shipped `favourite_rank` convention ("ranks need not be gap-free", `favourites-dao.ts:13`); (3) it requires **no launch sweep** — nothing needs to fire when a contact is archived/purged (consistent with the "nothing watches a timestamp" data rule). Renumber-on-archive would add an unnecessary writer and a failure surface for zero visual benefit. `[ASSUMED — A5: leave-gap; the CONTEXT deferred list explicitly notes "leave-gap recommended".]`

## Migration 003 (BLOCKING for the planner) — `app_settings` gains sun columns

**Verified state:** `contacts` has `ring_seq` but **no sun column** (`001-initial.ts:61-82`); `app_settings` has **no sun fields** (`002-app-settings.ts:38-50`). `sun_contact_id`/`self_sun_colour` do NOT exist. `TARGET_VERSION` is currently **2** (`database.ts:37`); the array is `[migration001, migration002]` (`database.ts:110`).

**Design (app-level state on the single-row `app_settings` table, NOT per-contact):**
```ts
// src/db/migrations/003-orrery-settings.ts
export const ADD_SUN_CONTACT = `ALTER TABLE app_settings
  ADD COLUMN sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;`;   // NULL = self
export const ADD_SELF_SUN_COLOUR = `ALTER TABLE app_settings
  ADD COLUMN self_sun_colour TEXT;`;   // NULL = resolve to starPalette[0] at read (no hex in a migration)
export const migration003: Migration = {
  version: 3,
  async apply(exec) {
    await exec.execAsync(ADD_SUN_CONTACT);
    await exec.execAsync(ADD_SELF_SUN_COLOUR);
  },
};
```
Then in `database.ts`: `export const TARGET_VERSION = 3;` and `runMigrations(exec, [migration001, migration002, migration003], TARGET_VERSION, deps)`.

**Why these exact choices (all within `[VERIFIED: SQLite ALTER TABLE ADD COLUMN semantics]`):**
- **Both columns nullable, no non-null default** → `ALTER TABLE ADD COLUMN` is legal, and (critically) SQLite allows a `REFERENCES` clause in `ADD COLUMN` **only when the default is NULL** — satisfied. A single device may jump v1→v3 or v2→v3; both add-column steps are pure and starting-state-independent (forward-only rule honoured).
- **`sun_contact_id INTEGER` (not TEXT):** it *is* a contact id; `REFERENCES contacts(id) ON DELETE SET NULL` makes a **hard-purged** sun-contact auto-revert to self (no dangling id), directly honouring "NULL = self". `[ASSUMED — A1: the research-agenda text hinted TEXT; INTEGER+FK is recommended for correctness. Owner/planner may prefer plain INTEGER with no FK if the __testkit__ node:sqlite harness doesn't enable foreign_keys — the FK is a runtime nicety, not load-bearing. Archive is soft-delete (archived_at), NOT a row delete, so ON DELETE does NOT fire on archive; see Sun Occupant Resolution.]`
- **`self_sun_colour TEXT` nullable, NULL-default:** storing the literal gold hex `#F2C14E` in the migration would put a colour hex outside `theme-presets.ts` AND strand users if the owner later retunes `starPalette[0]`. Instead **default NULL, resolve NULL → `starPalette[0]` at read** — no hex in the migration, single-source palette preserved. `[ASSUMED — A6: NULL-default + read-time resolution vs a stored literal default. Recommended.]`

**DAO widening (`app-settings-dao.ts`):** add `sunContactId: number | null` and `selfSunColour: string | null` to `AppSettings`, `AppSettingsRow` (`sun_contact_id`, `self_sun_colour`), and `COLUMN_OF`; extend `getAppSettings` SELECT with the two columns; add validation before write mirroring `assertHour`/`assertToggle`: `sun_contact_id` = null or a positive integer; `self_sun_colour` = null or `/^#[0-9A-Fa-f]{6}$/` (defense-in-depth — the Settings swatch UI only ever writes a `starPalette` token). Palette **membership** is enforced UI-side (the swatch row), not in the node-pure DAO (which can't import theme).

**Export/restore (Phase 16):** both columns live on `app_settings`, already the backup-native store exported by table (OQ-1, `002` header). If Phase 16 exports `app_settings` with `SELECT *` they are carried automatically; if it hardcodes a column list it must add these two. `sun_contact_id` survives restore because full-DB local backup **preserves contact ids** (no id remapping). Flag this as a note for the Phase 16 planner.

## Two-View Morph (ORR-02)

Single Reanimated `morph` shared value, `0` = Status (default), `1` = Relationship, driven by the segmented control:
```ts
morph.value = withTiming(target, { duration: MORPH_MS, easing: Easing.inOut(Easing.ease) });  // MORPH_MS = 500
```
Per body, in `useDerivedValue` **worklets** (UI thread — off the JS thread, confirmed):
- **Angle:** `interpolate(morph.value, [0,1], [statusAngle, restAngle])` — see Pitfall 2 (shortest-path wrap).
- **Colour:** `interpolateColor(morph.value, [0,1], [fullStatusToken, mutedToken])`; rogue interpolates toward `rogueExtinguished` in both views. `interpolateColor` accepts the theme hex/HSL strings captured in the worklet closure `[VERIFIED: exported by reanimated]`.
- **Radius:** FIXED — never interpolated (shared axis).

The morph is **event-driven and self-terminating** — it does NOT need pause-on-blur (dossier "decisions made without you" #4). Only the ambient layer does.

## Ambient Layer + Pause (ORR-03)

- **Starfield twinkle** (subtle) + **slow sun pulse** (glow radius/opacity oscillate, ~2–4s) driven off Skia's `useClock()` in `useDerivedValue` — the ONLY animated loop. **Bodies do NOT animate** (placed by timestamp math on focus, sit still).
- **Pause = conditionally unmount `<Canvas>`** when `!(useIsFocused && appStateActive)`. `useClock()` takes no `paused` arg; gating derived values only hides motion, it does not stop the frame callback (dossier P2, verified). Wire `useIsFocused()` (`@react-navigation/native`) + an `AppState` `change` listener → a boolean → render `<Canvas>` only when true. `[VERIFIED: dossier P2; useIsFocused available in @react-navigation/native ^7.3.16]`
- Perf/battery claims are **physical-Pixel-only** (Skia render loop; the emulator cannot assess it — CLAUDE.md + dossier).

## Skia Photos (ORR-01 / ORR-05)

- `useImage(resolvePhotoUri(photo), onError)` per planet `[VERIFIED: useImage(source, onError?) signature on disk]`. `resolvePhotoUri` resolves the stored `avatars/<name>.<ext>` relative path to an absolute `file://` URI against `Paths.document` (`photo-storage.ts:130`). `file://` resolves by Skia's `Data.fromURI` contract (dossier P1); the base64 fallback wires to the `onError` handler.
- Circular planet: `ImageShader` filling a `<Circle fit="cover">` (or clipped `<Group>`), ring = a stroked paint child (dossier P1).
- **Fallback = themed `avatarSwatches` swatch + initials** via the **Paragraph API** (`Skia.ParagraphBuilder.Make({...}, fontMgr)`, `TextAlign.Center`). A `.ttf` **must be bundled** (`useFonts({ Inter: [require('../../assets/Inter-SemiBold.ttf')] })`) — Skia has no OS default. `assets/` ships no `.ttf` today `[VERIFIED]`; the executor adds one.
- **Build-phase UAT item (flag):** the one-off Pixel `file://` happy-path spike (dossier deferred-to-planning) — confirm `useImage(absoluteFileUri)` decodes on the physical device before treating the happy path as DECIDED. Image decode is async/native (off JS thread); ~8 photos resolve as promises at mount, fallback shown until ready.

## Sun Occupant Resolution (ORR-05) — pure `sun-occupant-logic.ts`

Resolve `sun_contact_id` → the sun's render inputs:
- **NULL** → self: photo from `getProfilePhoto`; glow colour = `selfSunColour ?? starPalette[0]`.
- **a live contact id** → that contact: photo + glow = that contact's **status** colour (unchanged from 01-data — the user pick applies to the self-sun only, UI-SPEC contract).
- **an archived or missing contact id** → `[ASSUMED — A7]` recommend **fall back to self**. Archiving is soft (archived_at), so the FK `ON DELETE SET NULL` does NOT fire; the read layer should treat an archived/absent sun-occupant as self so the sun never glows a hidden contact. Confirm with owner.

The occupant does **not** also orbit (01-data); exclude `sun_contact_id` from the orbiting scan.

---

## Reuse Map (planner: reuse, do NOT rebuild)

| Capability | Existing symbol / file | How the orrery consumes it |
|------------|------------------------|----------------------------|
| Progress value | `PROGRESS_SQL` (`status.ts:59`) | `orrery-read` selects it per contact (drives angle + drift) |
| Status bucket | `STATUS_SQL` (`status.ts:67`) | `orrery-read` selects it (drives colour + ring style) |
| Rogue constant | `ROGUE_K = 3` (`status.ts:42`) | Imported into geometry-logic for the drift clamp; **never re-typed** (notify already reads it) |
| Thresholds | `STABLE_MAX`/`WOBBLE_MAX` (`status.ts:40-41`) | Imported for drift band boundaries |
| Never-contacted guard | `last_contact IS NOT NULL` + literal-null pattern (`dashboard-read.ts:129-144`) | `orrery-read` filters `last_contact IS NOT NULL AND archived_at IS NULL` |
| Ring colour/opacity/weight | `ringVisual()` (`contact-card-ring.ts:44`) | `orrery-ring-logic` reuses its colour; adds stroke style (solid/dashed/faded/faint-trace) + `rogueExtinguished` body |
| Per-contact `ring_seq` | `contacts.ring_seq` (schema) | `orrery-read` selects it; `rewriteRingSeq` (new, first writer) writes it |
| Favourites list (sun picker) | `listFavourites()` (`dashboard-read.ts:288`) | `sun-picker-read` shows favourites first, then all live contacts, + "Me" |
| Photo path | `resolvePhotoUri()` (`photo-storage.ts:130`) | Every planet + contact-sun photo |
| Self photo | `getProfilePhoto`/`getProfile` (`profile-dao.ts`) | Self-sun occupant |
| Reorder transaction | `rewriteFavouriteRanks` (`favourites-dao.ts:105`) | Cloned as `rewriteRingSeq` (3 guards, one txn) |
| Reorder math | `favourites-reorder-logic` (`computeReorder`) | Cloned as `ring-reorder-logic` |
| Settings-write DAO | `updateAppSettings` (`app-settings-dao.ts:140`) | Widened for `sun_contact_id` + `self_sun_colour` |
| Filled-accent chip idiom | `FilterChipRow` (`components/FilterChipRow.tsx`) | Segmented control (Status ｜ Relationship) styling |
| Skia canvas idioms | `CropPhotoScreen.tsx` | The render/gesture reference pattern |
| Dashboard entry | `HomeScreen.tsx:481-490` (Settings gear `navigation.navigate("Settings")`) | Add an Orbit `◎` button beside it → `navigate("Orrery")` |
| Nav registration | `RootNavigator.tsx:57-74` + `navigation/types.ts` (`RootStackParamList`) | Additive `<Stack.Screen name="Orrery">` + param-list entry |

---

## Version Specifics (do NOT re-litigate the baseline)

Installed & proven: Skia **2.6.2**, Reanimated **4.5.1**, worklets **0.10.4**, gesture-handler **~2.32.0**, RN **0.86.2**, Expo **~57.0.13** `[VERIFIED: package.json + node_modules]`. Reanimated-4-specific APIs the planner targets (all confirmed exported): `useSharedValue`, `useDerivedValue`, `withTiming`, `interpolate`, `interpolateColor`, `Easing.inOut(...)`, `runOnJS`. Skia: `useImage(source, onError?)`, `useClock`, `useFonts`, `Skia.ParagraphBuilder`, `<Canvas>`/`<Fill>`/`<Circle>`/`<Group>`/`ImageShader`. gesture-handler: `Gesture.Tap/Pan/Race`, `GestureDetector`. The orrery runs in Expo Go (all three `inExpoGo: true` on SDK 57 — dossier P2); unlike the widget it does NOT force a custom dev client — but device UAT still uses the desktop-build pipeline for perf claims.

---

## Common Pitfalls

### Pitfall 1: Recomputing status/rogue with a second threshold
**What goes wrong:** a locally-typed `progress >= 3` or a private status CASE drifts from `status.ts` and from notify's decay-suppression (which reads the same `ROGUE_K`).
**How to avoid:** import every threshold/fragment from `status.ts`. A parity test (like `dashboard-read`'s fuel parity) guards it.
**Warning sign:** the number `3`, `0.8`, or `1.0` appearing in orrery code.

### Pitfall 2: Angle interpolation spinning the "long way" across the wrap
**What goes wrong:** `interpolate(morph, [0,1], [350°, 10°])` sweeps 340° the wrong way during the morph.
**How to avoid:** interpolate the **shortest signed angular delta** (normalise `restAngle − statusAngle` to `[−π, π]` and add a fraction), not the raw endpoints.
**Warning sign:** planets doing a full loop during the 500ms toggle.

### Pitfall 3: Migration hex literal / stranded default colour
**What goes wrong:** storing `#F2C14E` as the `self_sun_colour` default puts a colour hex outside `theme-presets.ts` and strands users if the palette is retuned.
**How to avoid:** default NULL; resolve NULL → `starPalette[0]` at read.
**Warning sign:** a hex string in a migration file or DAO.

### Pitfall 4: "Pausing" by gating derived values
**What goes wrong:** the frame callback keeps running and burning battery; only the visible motion stops.
**How to avoid:** unmount `<Canvas>` on blur/background (dossier P2).
**Warning sign:** battery drain while the orrery is backgrounded.

### Pitfall 5: `ring_seq` writer re-entrancy / partial reorder
**What goes wrong:** calling a wrapped single-writer inside the reorder loop deadlocks (non-reentrant mutex); a partial UPDATE leaves stale ranks.
**How to avoid:** clone `rewriteFavouriteRanks` exactly — N raw UPDATEs in ONE `inWriteTransaction`, 3 guards.
**Warning sign:** a hang on drag-release, or ranks that don't match the drawn order.

### Pitfall 6: `toISOString()` for the `now` timestamp
**What goes wrong:** UTC evening off-by-one (a repo-wide banned pattern).
**How to avoid:** use `localDateTime()` (`database.ts:46`) / `formatLocalDate()` for every `modified_at` write.

---

## Runtime State Inventory

> Phase 13 is primarily greenfield rendering plus one additive migration. It is not a rename/refactor, but it DOES add persistent state and a new writer, so the relevant categories are stated explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `app_settings` gains `sun_contact_id` + `self_sun_colour` (migration 003). `contacts.ring_seq` gets its **first writer** (previously always NULL). | Migration 003 (additive); `rewriteRingSeq` DAO |
| Live service config | None — no external service, fully offline. | None |
| OS-registered state | None — no Task Scheduler / receivers / background tasks (orrery is foreground-only, pauses on blur). | None |
| Secrets/env vars | None. | None |
| Build artifacts | New bundled `assets/<font>.ttf` — must be included in the prebuild/APK. | Executor adds the `.ttf` + registers with Skia `useFonts`; rebuild via desktop pipeline |

## Validation Architecture

> `workflow.nyquist_validation = true` `[VERIFIED: .planning/config.json]` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) `[VERIFIED: package.json scripts.test]` |
| Config file | `vitest.config.ts` `[VERIFIED]` |
| Quick run command | `npx vitest run src/logic/orrery-geometry-logic.test.ts` |
| Full suite command | `npm test` |
| Migration harness | in-memory `node:sqlite` via `@/db/__testkit__/node-sqlite` (`nodeSqliteExecutor`, `openTestDb`) — same as `runner.test.ts`/`001-initial.test.ts` `[VERIFIED]` |
| Extra gates | `npm run check:colors` (no hex outside theme-presets) + `tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORR-01 | `progressToAngle` (0→top, 0.5→bottom, wraps), `polarToXY` clockwise, `ringRadius` | unit | `npx vitest run src/logic/orrery-geometry-logic.test.ts` | ❌ Wave 0 |
| ORR-01/04 | `orrery-ring-logic` status→stroke style; reuses `ringVisual` colour | unit | `npx vitest run src/logic/orrery-ring-logic.test.ts` | ❌ Wave 0 |
| ORR-04 | `drawnRadius` drift bands + `DRIFT_MAX` clamp (stable=0, decay grows, rogue=max, never exceeds bound) | unit | `npx vitest run src/logic/orrery-geometry-logic.test.ts` | ❌ Wave 0 |
| ORR-01/03 | `hitTest` nearest-wins + outside-radius → null + sun hit | unit | `npx vitest run src/logic/orrery-geometry-logic.test.ts` | ❌ Wave 0 |
| ORR-02 | morph endpoints: statusAngle vs evenSpread; full vs muted token selection; shortest-path angle delta | unit | `npx vitest run src/logic/orrery-geometry-logic.test.ts` | ❌ Wave 0 |
| ORR-05 | `sun-occupant-logic`: NULL→self, live id→contact status, archived/missing→self | unit | `npx vitest run src/logic/sun-occupant-logic.test.ts` | ❌ Wave 0 |
| ORR-06 | `ring-reorder-logic` computeRingReorder (move to rank; bounds; identity) | unit | `npx vitest run src/logic/ring-reorder-logic.test.ts` | ❌ Wave 0 |
| ORR-06 / data | migration 003 adds both columns, defaults NULL, v2→v3 & v1→v3 both land clean; widened `getAppSettings`/`updateAppSettings` validation | unit (node:sqlite) | `npx vitest run src/db/migrations/003-orrery-settings.test.ts src/db/app-settings-dao.test.ts` | ❌ Wave 0 |
| ORR-06 | `rewriteRingSeq` 3 guards (unique / count-match / scoped changes===1) | unit (node:sqlite) | `npx vitest run src/db/ring-seq-dao.test.ts` | ❌ Wave 0 |
| ORR-01/03/05 | canvas render, morph feel, tap→profile, drag→ring_seq, empty state, pause-on-blur, `file://` decode | manual (device UAT) | desktop-build pipeline + Pixel (perf/`file://` spike) | manual — Skia surface |

### Sampling Rate
- **Per task commit:** the quick run for the touched `*-logic.ts` module + `tsc --noEmit` + `check:colors`.
- **Per wave merge:** `npm test` (full node suite).
- **Phase gate:** full suite green + physical-Pixel UAT (render, morph, gestures, `file://` decode, pause) before `/gsd-verify-work`. Perf claims Pixel-only.

### Wave 0 Gaps
- [ ] `src/logic/orrery-geometry-logic.test.ts` — ORR-01/02/03/04 (angle, radius, drift/clamp, hit-test, morph endpoints)
- [ ] `src/logic/orrery-ring-logic.test.ts` — ORR-01/04 (stroke vocabulary)
- [ ] `src/logic/ring-reorder-logic.test.ts` — ORR-06 (reorder math)
- [ ] `src/logic/sun-occupant-logic.test.ts` — ORR-05 (occupant resolution)
- [ ] `src/db/migrations/003-orrery-settings.test.ts` — additive migration, v1→v3 & v2→v3 (node:sqlite)
- [ ] `src/db/app-settings-dao.test.ts` — **widen existing** for new fields + validation
- [ ] `src/db/ring-seq-dao.test.ts` — `rewriteRingSeq` guards (node:sqlite)
- [ ] `src/db/orrery-read.test.ts` — orbiting scan (excludes never-contacted, archived, and the sun occupant; dense rank)
- [ ] Font install: add `assets/<font>.ttf` (Inter/Roboto, weight 600) — build-phase asset, verified on device

## Security Domain

> `security_enforcement` enabled (absent `false` = enabled) `[VERIFIED: .planning/config.json workflow.security_enforcement = true]`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (local-first, single device) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user surface |
| V5 Input Validation | **yes** | `?`-bound writes only; validate `sun_contact_id` (null or positive int), `self_sun_colour` (null or `/^#[0-9A-Fa-f]{6}$/`), `ring_seq` targetRank (integer, clamped `[0,N-1]`) BEFORE the UPDATE opens — mirrors `assertHour`/`assertToggle` |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns for {RN + on-device SQLite + Skia}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a settings/ring value | Tampering | Every runtime value `?`-bound; only closed code-constants interpolated (matches every existing DAO). PRAGMA `user_version` is the sole interpolated integer (runner asserts `Number.isInteger`). |
| Malformed value corrupting stored state | Tampering / DoS | Validate before write; `changes===1` guard rolls back on a bad id |
| Network on a read path | Info disclosure | None introduced — orrery renders fully offline; `resolvePhotoUri` yields `file://` only (local-first commitment) |
| Path traversal via a stored photo value | Tampering | `assertSafeRelative` already gates writes; orrery only reads via `resolvePhotoUri` |

No new attack surface beyond input validation on three write paths. No new dependency, no network, no secrets.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@shopify/react-native-skia` | Canvas render | ✓ | 2.6.2 | — |
| `react-native-reanimated` | Morph/ambient worklets | ✓ | 4.5.1 | — |
| `react-native-worklets` | Reanimated runtime | ✓ | 0.10.4 | — |
| `react-native-gesture-handler` | Tap/drag | ✓ | ~2.32.0 | — |
| A bundled `.ttf` | Skia initials fallback | ✗ | — | **No fallback** — Skia has no OS default; executor MUST add one (blocking for the initials path) |
| Physical Pixel | Perf + `file://` decode UAT | (owner's phone, USB) | — | Emulator canNOT assess Skia perf; `file://` spike is Pixel-only |

**Missing dependencies with no fallback:** the `.ttf` font (blocking for the initials-fallback path only — planets with photos render without it; a photo-less contact needs it).
**Missing dependencies with fallback:** none.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Skia `useValue`/`useClockValue`/`useComputedValue` | Reanimated is the animation engine (`useSharedValue`/`useDerivedValue`) | Skia ~1.0 rewrite | HANDOFF §7's "Reanimated for gestures" wording is stale; it's now the engine (dossier P2) — intent unchanged |
| Legacy Skia `useFont`/`matchFont` | Paragraph API (`Skia.ParagraphBuilder`, `TextAlign.Center`) | Skia recent | Use Paragraph for the initials fallback (dossier P1) |
| Live 60fps body loop | Timestamp math on focus; bodies static; only ambient animates | dossier Cluster B | No pause dance for bodies; pause only the ambient layer |

**Deprecated/outdated:** Skia's own value/clock system (removed); tap-to-freeze (obsolete — nothing moves; dossier Cluster B).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL` (agenda hinted TEXT) | Migration 003 | Low — plain INTEGER (no FK) is a trivial fallback if the node:sqlite test harness doesn't enable FKs; contract "NULL=self" holds either way |
| A2 | `progressToAngle` = linear full-orbit (`progress mod 1 × 2π`), split at 0.5 = 6 o'clock | Angle↔Time | Medium — a non-linear top/bottom-emphasis map would change resting positions; owner may have a visual preference |
| A3 | Drift grows linearly across the decay band, flat max for rogue | Angle↔Time | Low-Medium — the curve is a tunable; only the clamp is load-bearing |
| A4 | Relationship resting angles = uniform `index/count` | Angle↔Time | Low — CONTEXT defers light grouping as aesthetic |
| A5 | `ring_seq` **leave-gap** on archive/purge (no renumber sweep) | ring_seq Drag | Low — CONTEXT explicitly notes "leave-gap recommended"; radius rank is derived densely |
| A6 | `self_sun_colour` default NULL, resolved to `starPalette[0]` at read | Migration 003 | Low — avoids a migration hex; a stored literal default is the alternative |
| A7 | An archived/missing sun-occupant falls back to self | Sun Occupant Resolution | Medium — product call; owner might prefer the archived contact still glow |

**If any of these matter to the owner, surface them in `/gsd-discuss-phase` or plan-review before locking.**

## Open Questions

1. **Angle mapping shape (A2).**
   - What we know: 0 at top, clockwise, one interval = one revolution, split at 6 o'clock; drift carries overdue-ness.
   - What's unclear: whether the owner wants the literal linear map or a top/bottom-emphasis curve.
   - Recommendation: ship linear (simplest, HANDOFF's stated default); flag the pure function as trivially swappable if the owner dislikes it on device.

2. **Archived sun-occupant behaviour (A7).**
   - What we know: archive is soft; the FK `ON DELETE SET NULL` won't fire on archive.
   - What's unclear: glow the archived contact vs fall back to self.
   - Recommendation: fall back to self; confirm at discuss/plan-review.

3. **Segmented control: reuse `FilterChipRow` vs a dedicated `SegmentedControl`.**
   - What we know: the filled-accent chip idiom is the required styling; `FilterChipRow` is a horizontal `ScrollView` of single-active chips keyed to `DashboardFilter`.
   - What's unclear: whether to shoehorn a 2-item view toggle into `FilterChipRow`'s filter-keyed API or build a thin 2-segment control reusing its colours.
   - Recommendation: a small dedicated `SegmentedControl` reusing the same active/inactive token treatment — cleaner than overloading the dashboard filter type. (Claude's discretion per CONTEXT.)

## Sources

### Primary (HIGH confidence — verified on disk this session)
- `src/db/status.ts` — `PROGRESS_SQL`/`STATUS_SQL`/`REASON_SQL`/`ROGUE_K`/`STABLE_MAX`/`WOBBLE_MAX` exact shapes
- `src/screens/CropPhotoScreen.tsx` — proven Skia/Reanimated/gesture idioms
- `src/components/contact-card-ring.ts` — `ringVisual()` status→ring vocabulary
- `src/db/migrations/{001-initial,002-app-settings,runner}.ts` + `database.ts` — migration pattern, `TARGET_VERSION`, registration array, `user_version` mechanics
- `src/db/app-settings-dao.ts` — DAO widening target (interface/row/COLUMN_OF/validation)
- `src/db/favourites-dao.ts` (`rewriteFavouriteRanks`) — reorder-transaction reference; `src/db/dashboard-read.ts` — read-chokepoint + never-contacted pattern; `src/db/contact-status-read.ts`, `contact-read.ts` — `ring_seq` read (no writer)
- `src/services/photos/photo-storage.ts` (`resolvePhotoUri`), `photo-relative-path.ts`, `profile-dao.ts`
- `src/theme/theme-presets.ts` — single hex home; token-add target
- `src/navigation/RootNavigator.tsx`, `navigation/types.ts`, `src/screens/HomeScreen.tsx:481-490` (entry button), `components/FilterChipRow.tsx`
- `package.json` + `node_modules/*` — installed versions; `useImage`/Reanimated/Skia type signatures
- `.planning/config.json` — nyquist + security flags

### Secondary (MEDIUM confidence — decided design docs)
- `docs/dossier/09-orrery.md` (P0/P1/P2 findings, decided/rejected mechanics), `13-CONTEXT.md`, `13-UI-SPEC.md`, `HANDOFF.md §7`, `.planning/REQUIREMENTS.md` (ORR-01..06), `.planning/STATE.md`

### Tertiary (LOW confidence)
- None — no WebSearch was needed; the stack is installed and the design is settled.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version and API signature verified against installed `node_modules`; no new dependency.
- Architecture/reuse: HIGH — every reused symbol opened and confirmed to exist with the stated shape.
- Migration 003 design: HIGH on mechanics (ALTER-ADD-COLUMN semantics, registration), MEDIUM on the INTEGER-FK vs TEXT and NULL-default choices (logged A1/A6).
- Angle/drift math: MEDIUM — mechanically sound and node-testable, but the HANDOFF "top/bottom arc" phrasing is genuinely ambiguous (A2/A3 logged).
- Pitfalls/security: HIGH — grounded in the shipped DAOs and dossier platform findings.

**Research date:** 2026-08-17
**Valid until:** ~2026-09-16 (30 days — stack is pinned by Expo SDK 57; no fast-moving external dependency).
