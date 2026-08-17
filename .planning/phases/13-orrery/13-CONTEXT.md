# Phase 13: Orrery - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — owner engaged on all 4 grey areas

<domain>
## Phase Boundary

The two-view Skia "solar system" visualisation (HANDOFF §7 / dossier 09) — a glanceable
overview, explicitly **not** the primary interface (the dashboard is home). Delivers:

- Per-contact rings (radius = `ring_seq` / closeness), angle = interval progress, status
  colour + ring style, a sun at centre; never-contacted excluded (`last_contact IS NOT NULL`).
- **Two views on ONE Skia canvas** — a **status** view (default) and a **relationship** view —
  sharing the radius axis and morphing between fixed/progress angles + muted/full colour via a
  single `progress` shared value driven by a segmented-control toggle.
- **No live body loop:** bodies are placed by timestamp math on focus and sit still; only the
  ambient layer (starfield twinkle + sun pulse) animates, and it pauses on blur/background.
- `rogue` rendering (max drift + cold/extinguished body + faint-trace ring, on rails + tappable)
  driven by the single shared `ROGUE_K` constant.
- The assignable sun (self or a contact) and the user-selectable self-sun colour, both managed
  from **Settings**; tap a planet → opens that contact's profile; drag a planet radially → sets
  its `ring_seq`.

**Excludes** (owned elsewhere, reused not rebuilt): status/progress math (Phase 2 `status.ts`),
photo storage + 512px master (Phase 5), gravity/intensity (Phase 6), the dashboard (Phase 8),
and the notify decay-suppression that already reads `ROGUE_K` (Phase 11).
</domain>

<decisions>
## Implementation Decisions

### Relationship view (the calm map)
- Muted treatment = **desaturated status colours** (same hues, low saturation) — keeps each
  planet's identity and makes the morph a clean saturation fade. NOT full greyscale, NOT a single
  neutral tone.
- The relationship view **retains a faint desaturated status signal** (calm, not urgent) — it is
  not purely closeness.
- The morph fades **both angle** (even resting angles → interval-progress angle) **and colour**
  (muted → full status saturation); **radius stays fixed** (shared axis, dossier Cluster A).
- Relationship-view resting angles = **even aesthetic spread** (rings already separate everyone by
  radius, so angle there is free).

### Self-sun & the star palette
- Palette source = a **dedicated themed star-colour token set** (resolved through theme tokens,
  mirroring the Phase-5 avatar-swatch discipline) — NOT freeform hex, NOT the app accent token.
- **~6 curated star colours.**
- The self-sun **colour is picked in Settings** ("Your star"), mirroring the Phase-5 "Your photo"
  self pattern.
- Default self-sun colour before the user picks = a **warm gold/yellow star** token.

### Morph, controls & rogue tunability
- View toggle = a **segmented control** (Status ｜ Relationship), reusing the filled-accent chip
  idiom (`FilterChipRow`).
- Morph feel ≈ **~500ms ease-in-out**, a single tunable constant at the top of its file.
- The `rogue` multiple **stays a FIXED shared constant — reuse `ROGUE_K = 3` from
  `src/db/status.ts`; it is NOT user-tunable.** This preserves the single-shared-constant
  invariant already read by notify (`decay-suppression.ts`) and, later, the digest.
- Ambient layer = a **subtle** starfield twinkle + slow sun pulse; **pause-on-blur** by
  conditionally unmounting `<Canvas>` on `useIsFocused && AppState==='active'` (dossier P2).

### Entry & direct manipulation (ORR-06)
- Dashboard → orrery entry = a **header orbit button** on the dashboard, beside the existing
  Settings gear.
- **Sun-occupant assignment lives in SETTINGS, not the orrery (owner override).** A Settings
  control opens a picker listing **your favourites first, then contacts in general, plus a
  "Me / self" option** (NULL = self). Long-press-on-the-orrery was **REJECTED by the owner** as
  too easy to trigger by accident (and it would collide with the radial-drag gesture).
  - **Consequence — record so it is never mis-flagged as a gap:** ORR-06's phrase "assign the sun
    *from the orrery*" is **intentionally relocated to Settings by owner decision**. The half of
    ORR-06 that REMAINS on the canvas is the `ring_seq` radial drag. Do not "restore"
    orrery-based sun assignment as a later gap fix.
- Set `ring_seq` = **drag a planet radially** to reorder its ring; commit on release through a
  single transactional writer.
- Empty state (sun only) = **sun + a gentle "mark someone contacted to see them orbit"** prompt
  pointing at the dashboard / never-contacted list.

### Claude's Discretion
- Exact morph easing/duration within the ~500ms shape, segmented-control styling within the
  filled-accent idiom, and the internal structure of the pure math modules are mine to tune.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/screens/CropPhotoScreen.tsx`** — the repo's only existing Skia render-loop surface
  (Phase 5): `<Canvas>` + Reanimated shared values via `useDerivedValue`, no per-frame
  `setState`, gesture-handler pan/pinch. **THE reference pattern** for the orrery's canvas.
- **`src/db/status.ts`** — `PROGRESS_SQL`, `STATUS_SQL`, `REASON_SQL`, and the shared
  **`ROGUE_K = 3`** constant. The orrery reads these; status/rogue are never recomputed.
- **`src/components/contact-card-ring.ts`** — existing ring colour/opacity/width logic incl. the
  rogue branch (`colors.rogue`); the orrery's ring styling extends this vocabulary
  (solid → dashed → faded → faint-trace).
- **`src/theme/theme-presets.ts`** — status colour tokens (stable/wobble/decay/rogue) already
  exist; the orrery adds the **star-colour palette**, the relationship **"muted" palette**, and
  (per dossier) possibly a distinct **cold/dark rogue-extinguished** token.
- **Photo pipeline (Phase 5)** — one 512px master per contact; orrery loads via Skia
  `useImage(absoluteFileUri)` with a base64 fallback wired to the error handler (dossier P1); no
  routine per-photo base64 step. Fallback = themed swatch + initials via a **bundled font**
  (Paragraph API).
- **`app_settings` (migration 002, Phase 11) + its settings DAO** — the natural home for the new
  `sun_contact_id` + `self_sun_colour` app-level state.
- Skia 2.6.2 / Reanimated 4.5.1 / gesture-handler ~2.32.0 already installed and proven.

### Established Patterns
- Correctness-critical math lives in **pure, node-tested `*-logic.ts`** modules (react-native
  free); `.tsx` screens are device-UAT. Angle/radius/hit-test/rogue-drift math goes there.
- **All colours through theme tokens, incl. Skia draw calls** (Skia accepts runtime token/HSL
  strings — dossier P1).
- Animation off the JS thread (Reanimated worklets); **pause on `useIsFocused===false` +
  AppState background** by unmounting `<Canvas>`.
- Any write (ring_seq reorder, sun assignment) goes through a **transactional writer**; the
  single-writer `last_contact` DAO is untouched by the orrery.
- Settings already hosts self "Your photo" (Phase 5) + Notifications (Phase 11) — the new
  "Your star" colour + "Sun / centre" picker slot in there.

### Integration Points
- New **Orrery screen** registered additively on the react-navigation native-stack
  (types.ts + RootNavigator), reached from a new dashboard header orbit button.
- New **migration 003** adds `sun_contact_id` (nullable, NULL = self) + `self_sun_colour` to
  `app_settings`; export/restore (Phase 16) must include both.
- Shared `ROGUE_K` wired to the orrery rogue rendering (already read by notify — do not fork).
</code_context>

<specifics>
## Specific Ideas

- **⚠ `sun_contact_id` / `self_sun_colour` do NOT exist yet** (verified: migration 001 `contacts`
  has `ring_seq` but no sun column; migration 002 `app_settings` has no sun fields). The dossier's
  "01-data's `sun_contact_id`" and its "companion" self-sun colour were **never implemented**.
  Phase 13 must add them via a **new forward migration 003** on the single-row `app_settings`
  table (app-level state, not a per-contact column). This is an implementation correction, not a
  reversal of the assignable-sun product decision.
- **`ROGUE_K = 3`** (`src/db/status.ts`) is the shared rogue constant — reuse verbatim; do not
  invent a second threshold.
- Installed **Skia 2.6.2 + Reanimated 4.5.1** match the dossier P0 baseline; the dossier's P1
  "Skia 2.6.2 pairs with Reanimated v3" aside is moot — the repo runs v4.5.1, proven by
  `CropPhotoScreen`.
- **Owner decision (this discuss):** the sun **occupant** is assigned from a **Settings picker**
  (favourites first, then all contacts, + Me/self), NOT an orrery long-press. Record so it is not
  later read as an ORR-06 miss.
- The Skia `file://` happy-path **Pixel spike** (dossier deferred-to-planning) and **font
  bundling** for the Skia initials fallback land in this phase's build/UAT.
</specifics>

<deferred>
## Deferred Ideas

- The exact **star-colour palette hex set** and the relationship **"muted" palette tone** —
  design-pass detail (owner's §12.4 taste bucket).
- Whether relationship-view resting angles are purely even vs. lightly grouped — aesthetic,
  design/planning.
- Body-size = gravity / frequency encodings remain **deliberately un-encoded in v1** (dossier) —
  not this phase.
- `ring_seq` **renumber-vs-gap** on archive/purge — dossier deferred to planning; the planner
  decides (leave-gap recommended).
</deferred>
