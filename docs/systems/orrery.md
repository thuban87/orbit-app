# Orrery

**Last updated:** 2026-09-02
**Updated by phase:** 23-theme-visual-system
**Owners:** `src/db/orrery-read.ts`, `src/db/ring-seq-dao.ts`, `src/db/sun-picker-read.ts`, `src/logic/orrery-geometry-logic.ts`, `src/logic/orrery-ring-logic.ts`, `src/logic/sun-occupant-logic.ts`, `src/screens/OrreryScreen.tsx`, `src/components/orrery/OrreryCanvas.tsx`, `src/components/orrery/SunBody.tsx`

## Purpose

The orrery gives Orbit a glanceable local map of contacted relationships without replacing the dashboard as the daily work surface. It renders contacts on a Skia canvas from on-device SQLite state, makes due status visible by position and ring treatment, and opens a chosen person's profile directly.

## Architecture

### Data Model

The orrery owns no per-contact table or stored status. It reads contact recency and `ring_seq`, then derives status, progress, display rank, position, and drift at query time. Two app-level settings choose the central sun occupant and, when that occupant is self, the selected themed star colour.

**Tables:**

- `contacts` — supplies `last_contact`, `interval_days`, lifecycle fields, photo, and the persisted `ring_seq` preference.
- `app_settings` — singleton row holding nullable `sun_contact_id` (`NULL` means self) and nullable `self_sun_colour` (resolved to the palette default at render).

**Types** (`src/db/orrery-read.ts` and `src/logic/orrery-geometry-logic.ts`):

- `OrbitingContact` — a contacted, non-archived render row with non-null derived status and progress.
- `OrreryMetrics` — one measured-canvas geometry object, including the centre, ring spacing, and outer drift bound.
- `SunOccupant` — the resolved self or contact occupant and its glow colour.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Read DAO | `src/db/orrery-read.ts` | Selects the orbiting population with shared status SQL and a dense display order. |
| Write DAO | `src/db/ring-seq-dao.ts` | Rewrites the complete visible rank order in one guarded transaction. |
| Read DAO | `src/db/sun-picker-read.ts` | Lists non-archived sun candidates with favourites first. |
| Settings DAO | `src/db/app-settings-dao.ts` | Persists the sun occupant and validated self-star selection. |
| Geometry logic | `src/logic/orrery-geometry-logic.ts` | Computes polar placement, bounded drift, hit tests, and responsive dimensions. |
| Visual logic | `src/logic/orrery-ring-logic.ts` | Extends the shared status palette into orbit-ring and rogue-body treatment. |
| Sun logic | `src/logic/sun-occupant-logic.ts` | Resolves self/contact presentation and archived or missing fallback. |
| Screen | `src/screens/OrreryScreen.tsx` | Loads local data, owns gestures and view state, and mounts the canvas. |

### Key Files

| File | Role |
|---|---|
| `src/db/orrery-read.ts` | Single local read chokepoint for the status/progress orbiting projection. |
| `src/db/ring-seq-dao.ts` | Transactional writer for radial-drag reordering. |
| `src/db/sun-picker-read.ts` | Favourites-first selection list for Settings. |
| `src/db/migrations/003-orrery-settings.ts` | Adds durable app-level sun settings. |
| `src/db/app-settings-dao.ts` | Validates and reads/writes those settings. |
| `src/db/status.ts` | Supplies the shared progress/status SQL and `ROGUE_K` threshold. |
| `src/logic/orrery-geometry-logic.ts` | Pure geometry, drift inversion, hit-testing, and ring-order helpers. |
| `src/logic/orrery-ring-logic.ts` | Maps status to ring vocabulary and the cold rogue body fill. |
| `src/logic/sun-occupant-logic.ts` | Applies the self/contact/archived sun policy. |
| `src/screens/OrreryScreen.tsx` | Composes local reads, layout, navigation, gesture commit, and canvas lifecycle. |
| `src/components/orrery/OrreryCanvas.tsx` | Owns the sole ambient Skia clock inside the unmountable canvas subtree. |
| `src/components/orrery/OrbitBody.tsx` | Renders one keyed planet, photo/fallback, and per-body morph worklets. |
| `src/components/orrery/SunBody.tsx` | Renders the central occupant and consumes the shared pulse clock. |
| `src/theme/use-reduced-motion.ts` | Supplies the live OS accessibility signal as a Skia-readable shared value. |
| `src/theme/tokens/motion.ts` | Defines the ambient-motion speed used by the visual layer. |
| `src/components/SegmentedControl.tsx` | Controlled Status / Relationship selector. |
| `assets/Inter-SemiBold.ttf` | Bundled Paragraph-API font for Skia initials fallback. |

## How It Works

### Loading the sky

1. The dashboard's Orbit control opens the additive `Orrery` route.
2. On focus, and after a committed shell Quick Log or Undo refresh signal, `OrreryScreen` reads `app_settings`, resolves the self or contact sun, and asks `listOrbitingContacts()` for the remaining population.
3. The read imports the shared progress and status SQL, selects only Bound contacted non-archived contacts, omits a contact that occupies the sun, and turns ordered rows into a dense display rank.
4. The screen measures the canvas once, derives one `OrreryMetrics` object, then renders rings, keyed planets, and the sun from that shared geometry.

### Status and relationship views

1. Status is the default view. Its angle comes from query-time interval progress; radius comes from `ring_seq` rank and is shared by both views.
2. Relationship view uses even, fixed resting angles and desaturated status-token endpoints; it remains a calm map rather than a second priority ordering.
3. The segmented control drives one self-terminating Reanimated morph. Each keyed planet interpolates angle by the shortest path and its outline colour, but never interpolates radius.
4. Contact bodies are positioned on focus and stay still. The canvas's starfield twinkle and the sun's glow pulse are the only continuous animation.

### Opening and reordering a relationship

1. A stationary touch coordinate-hit-tests the nearest planet and opens that contact's Profile; a contact sun behaves the same, while a self sun is a no-op.
2. A radial pan races the tap gesture, previews the target ring, and maps release distance to a clamped target rank.
3. The release path removes the body's current drift push before calculating rank, so picking up a decayed or rogue body and releasing it in place is a no-op.
4. `computeRingReorder()` produces an immutable reordered id list; `rewriteRingSeq()` validates uniqueness and the complete sun-excluded population, then writes every rank in one transaction.
5. The screen rereads the local projection after a successful write. The recency DAO remains the sole writer of `last_contact`.

### Choosing the sun

1. Settings exposes **Your star** as themed swatches; an unset value resolves to the ordered `starPalette[0]` default at render time.
2. **Sun / centre** prepends **Me** to a favourites-first, otherwise alphabetical list of available contacts.
3. Selecting Me writes `sun_contact_id = NULL`; selecting a contact writes its id. A hard purge automatically clears that id through the migration-003 foreign key.
4. A missing, soft-archived, or Unbound selected contact resolves to self in both Settings and the canvas without clearing the saved setting. A rebind restores an Unbound saved contact as sun automatically.

### Pausing the ambient layer

1. `OrreryScreen` leaves screen chrome mounted but mounts `OrreryCanvas` only after dimensions are valid and the route is focused and foregrounded.
2. `OrreryCanvas` is the only `useClock()` owner and supplies that clock to `SunBody` through context.
3. Blurring or backgrounding unmounts the complete canvas subtree, which stops the ambient clock rather than merely hiding its derived values.
4. While mounted, both canvas twinkle/drift and the sun glow pulse read the live reduced-motion shared value inside their derived worklets. A reduced-motion change holds those decorative values constant without using React state per frame.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `ROGUE_K` | `3` | `src/db/status.ts` | Shared query-time rogue threshold; never recompute it in the orrery. |
| `MORPH_MS` | `500` | `src/logic/orrery-geometry-logic.ts` | Tunable Status ↔ Relationship morph duration. |
| `SUN_RADIUS` | `30` px | `src/logic/orrery-geometry-logic.ts` | Central sun disc radius. |
| `PLANET_RADIUS` | `16` px | `src/logic/orrery-geometry-logic.ts` | Rendered planet radius. |
| `starPalette` | 6 ordered tokens | `src/theme/theme-presets.ts` | Validated self-sun choices; index 0 is the default. |
| `MOTION.ambient` | Tunable per-second rate | `src/theme/tokens/motion.ts` | Shared decorative ambient-motion speed. |

## Decisions

- **ADR-006:** Theme-Token Architecture — keeps every Skia and Settings colour inside the theme contract.
- **ADR-009:** Crash-Safe Forward-Only SQLite Migrations — governs migration 003's app-settings schema change.
- **ADR-011:** Query-Time Status and Never-Contacted Segregation — supplies the derived status/progress and exclusion model.
- **ADR-022:** Tokenized Deterministic Initials Avatars — provides the themed photo fallback used by planets and the sun.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — supplies the shared rogue state and threshold semantics.
- **ADR-042:** Shared Status Palette for Dashboard and Widget Rings — supplies the existing status-token vocabulary that the orrery extends.
- **ADR-046:** Query-Time Orrery Placement and Transactional Ring Ordering — derives the sky and constrains rank writes.
- **ADR-047:** App-Level Assignable Sun and Themed Self Identity — stores sun state and the self-star palette policy.
- **ADR-048:** Status-Default Static Orrery with a Single-Canvas Morph — defines the two-view, static-body, ambient-layer interaction model.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — makes the active orbit, picker, and ring guards Bound-only.
- **ADR-082:** Universal Capture FAB, Canonical Picker, and Truthful Quick Log — publishes a post-commit refresh signal that causes this local read to rerun.
- **ADR-085:** Live Reduced-Motion Signal for Skia Ambient Animation — gates every ambient-clock consumer with the live OS preference.

## Gotchas

1. **Do not rederive status, progress, or the rogue threshold.** `orrery-read` composes the status-engine SQL and `ROGUE_K`; a parallel calculation would eventually diverge.
2. **Keep the sun exclusion symmetric.** A contact sun must be omitted from both the render read and every rank-writer guard, or the N−1 drag list fails safely rather than reordering.
3. **Use an unconditional, null-guarded `useImage`.** The keyed Skia children call `useImage(photo ? resolvePhotoUri(photo) : null)` so a missing photo falls back cleanly without changing hook order.
4. **Pause by unmounting the canvas.** A derived-value gate does not stop Skia's clock; `useClock()` belongs only in `OrreryCanvas`.
5. **Remove drift before converting a drag release to rank.** This was a same-phase bug: raw release radius made decay and rogue bodies jump outward on a minimal drag; `driftPush` now inverts that offset for preview and commit.
6. **High contact counts can overlap.** The current minimum ring gap can place planets on the outer rim; capacity treatment is intentionally deferred to the owner rather than silently changing the visual model.
7. **Fast Refresh can invalidate an Expo SQLite statement in debug.** A clean relaunch restores the local connection; the phase's device UAT treated this as a development artifact, not an orrery query failure.
8. **Keep a saved Unbound sun reference.** The self rendering is a presentation fallback, not a settings mutation; every ring guard must use the same Bound predicate as the render read.
9. **Shell freshness must re-query data, not drive animation.** `useShellRefresh` refreshes the SQLite projection; Skia's ambient loop remains outside React state.
10. **Gate every ambient-clock consumer.** Stopping only canvas twinkle leaves the independently derived sun pulse running under reduced motion.

## Related Systems

- **Contacts** — supplies lifecycle, photos, recency, and the Profile destination.
- **Status engine** — provides the query-time status, progress, and rogue threshold.
- **Persistence core** — owns migration 003 and the singleton app-settings boundary.
- **App shell** — registers the route, Settings controls, and shared theme tokens.
- **Dashboard** — remains the home surface and supplies the Orrery entry point.
- **Photos** — provides durable local images and the deterministic avatar fallback inputs.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-17 | 13 | Created the local two-view Skia orrery, app-level sun settings, guarded ring reordering, and dashboard entry point. |
| 2026-08-27 | 18.2 | Made orbit/picker/reorder populations Bound-only and preserved saved Unbound sun references as self fallbacks. |
| 2026-09-02 | 22 | Added post-Quick-Log local projection refresh without altering the Skia animation boundary. |
| 2026-09-02 | 23 | Added live reduced-motion gating for canvas twinkle/drift and the sun glow pulse. |
