---
phase: 13-orrery
reviewed: 2026-08-17T00:00:00Z
depth: deep
files_reviewed: 33
files_reviewed_list:
  - src/db/migrations/003-orrery-settings.ts
  - src/db/migrations/003-orrery-settings.test.ts
  - src/db/database.ts
  - src/db/app-settings-dao.ts
  - src/db/app-settings-dao.test.ts
  - src/db/orrery-read.ts
  - src/db/orrery-read.test.ts
  - src/db/ring-seq-dao.ts
  - src/db/ring-seq-dao.test.ts
  - src/db/sun-picker-read.ts
  - src/db/sun-picker-read.test.ts
  - src/logic/orrery-geometry-logic.ts
  - src/logic/orrery-geometry-logic.test.ts
  - src/logic/orrery-ring-logic.ts
  - src/logic/orrery-ring-logic.test.ts
  - src/logic/ring-reorder-logic.ts
  - src/logic/ring-reorder-logic.test.ts
  - src/logic/sun-occupant-logic.ts
  - src/logic/sun-occupant-logic.test.ts
  - src/theme/theme-presets.ts
  - src/theme/theme-presets.test.ts
  - src/theme/theme-types.ts
  - src/components/SegmentedControl.tsx
  - src/components/orrery/OrbitBody.tsx
  - src/components/orrery/OrreryCanvas.tsx
  - src/components/orrery/SunBody.tsx
  - src/components/orrery/orrery-clock-context.ts
  - src/screens/OrreryScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/navigation/types.ts
  - src/navigation/RootNavigator.tsx
  - src/screens/HomeScreen.tsx
  - src/services/notifications/notification-schedule.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-17
**Depth:** deep
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Reviewed the full Phase-13 Orrery implementation at deep depth, tracing the
migration → DAO → read → screen data flow end-to-end and stress-testing the
cross-file seams the review lens called out: the `rewriteRingSeq` guard
alignment, the drag-commit argument threading, the sun-occupant null-safety
chain, the migration additivity, and the no-hardcoded-colour rule.

**The high-risk invariants hold.** I verified each of the lens's ground-truth
concerns against the actual code:

- **Single-writer `contacts.last_contact`:** `rewriteRingSeq` writes only
  `ring_seq` + `modified_at`; `last_contact` appears only in read-scope WHERE
  clauses, never a SET. No new writer introduced. ✓
- **Guard alignment / drag threading:** The `AND id <> ?` exclusion is applied
  to Guard 2's COUNT and every Guard 3 UPDATE, bound only when non-null, and
  `OrreryScreen.commitRingSeq` threads `sun.sunContactId` — the same value used
  as `excludeContactId` when building `orbiting`. I hand-traced the four sun
  cases (self / live-contacted / archived / never-contacted sun); the effective
  guard set equals the rendered (N or N−1) set in every case, so a contact-sun
  reorder does **not** roll back. ✓
- **Migration 003:** additive `ADD COLUMN` only, migrations 001/002 byte-
  unchanged (git-confirmed), nullable with no hex default, `ON DELETE SET NULL`
  FK correct. ✓
- **Colours:** no hex literals outside `theme-presets.ts`; every Skia/RN colour
  (including `interpolateColor` endpoints and the ghost ring) resolves through
  tokens. ✓
- **Hooks/worklets:** no hook inside the body `.map()`; `useClock` lives only in
  the unmountable `OrreryCanvas`; `useImage(photo ? resolvePhotoUri(photo) :
  null)` guarded; morph via one shared value, radius never interpolated. ✓
- **null-safety / dates:** never-contacted sun → neutral glow (no crash);
  `effectiveGap` floored > 0; `localDateTime()` used throughout, no
  `toISOString()`. ✓

No Critical defects found. The findings below are behavioural/quality issues,
led by a real drag-reorder correctness bug caused by the drift push not being
inverted at drag-release.

## Warnings

### WR-01: Drag-release rank ignores the outward drift push — drifted (decay/rogue) bodies jump ranks on a minimal drag

**File:** `src/screens/OrreryScreen.tsx:588-593` (with `src/logic/orrery-geometry-logic.ts:143-158`)

**Issue:** A body is *drawn* at `drawnRadius(progress, rank, status, C)`, which
adds an outward push of up to `DECAY_DRIFT_SPAN` (40) for decay bodies and a
fixed `ROGUE_DRIFT_SPAN` (80) for rogue bodies on top of its ring radius. The
drag hit-test correctly identifies the touched body at that *drawn* position.
But the drag-release rank is computed from the raw finger radius against the
**ring** radius, with no inverse of the drift:

```ts
const releaseRadius = Math.sqrt(dx * dx + dy * dy);
const rawRank = Math.round((releaseRadius - m.ringInner) / m.effectiveGap);
```

Concrete failure: a rogue planet at rank 2 is drawn at `ringRadius(2) + 80`.
The user presses on it and nudges it ~10px (the `PAN_MIN_DISTANCE` threshold) to
start the drag, then releases roughly where they picked it up. `releaseRadius ≈
ringRadius(2) + 80`, so `rawRank ≈ 2 + round(80 / effectiveGap)` — with a typical
`effectiveGap` of 34 that is rank 4-5. The planet is reordered outward by 2-3
ranks even though the user only meant to poke it. The persisted result is a
valid permutation (guards pass, no corruption), but it is not the reorder the
user performed. The live ghost ring does surface the target before release, so
it is not silent — but the initial pickup already shows the jumped ring.

**Fix:** Invert the drift when mapping release radius → rank, or map against the
body's *drawn* radius rather than its ring radius. Simplest: convert
`releaseRadius` back to an effective ring radius by subtracting the dragged
body's own current push before dividing, e.g. capture the dragged body's push at
`onBegin` (it is known from its `status`/`progress`/`rank`) into the drag
snapshot and subtract it:

```ts
// snapshot at onBegin: pushOfDragged = drawnRadius(...) - ringRadius(rank)
const ringReleaseRadius = releaseRadius - m.pushOfDragged;
const rawRank = Math.round((ringReleaseRadius - m.ringInner) / m.effectiveGap);
```

Alternatively treat a drop within a small radial tolerance of the pickup as a
no-op (drop-to-same-place should not reorder).

### WR-02: Orbit rings are drawn unclamped; at realistic contact counts planets compress below their own diameter and pile at the rim

**File:** `src/logic/orrery-geometry-logic.ts:225-251`, consumed at `src/screens/OrreryScreen.tsx:340` and `:353-361`

**Issue:** `effectiveGap` is floored at `MIN_GAP = 8`, but `PLANET_RADIUS = 16`
(a 32px-diameter disc). Once `span / (n−1)` drops below 8 — i.e. for larger `n`
on a phone-sized canvas — the floor pins the gap at 8px while planets are 32px
wide, so adjacent-rank bodies overlap by ~24px. Worse, the ring `<Circle>` is
drawn at the raw `ringRadius(rank, C)` with **no** `DRIFT_MAX` clamp (unlike
`drawnRadius`, which clamps only the *body*), so the outer rings render beyond
`DRIFT_MAX` (off the tappable area) while every body from that rank outward
clamps to `DRIFT_MAX` and stacks on the rim. Since `hitTest` returns the
last-drawn body on overlap, the piled inner-of-rim planets become untappable.
For a relationship manager, tens of contacted contacts is a normal steady state,
so this is reachable in ordinary use, not a stress corner.

This is partly a product/taste call (how the orrery should behave at capacity is
the owner's bucket, and a "grid-capacity" follow-up already exists), so flagging
rather than prescribing a layout — but the *unclamped ring radius* combined with
the clamped body radius is an implementation inconsistency worth an explicit
decision.

**Fix:** Decide a capacity strategy with the owner (cap visible ranks, scale
`PLANET_RADIUS` with density, or allow scroll/zoom). At minimum, clamp the ring
radius to the same `DRIFT_MAX` bound the body uses so rings and bodies stay
co-located, and/or derive `MIN_GAP` from `PLANET_RADIUS` so bodies never overlap
by more than an intended amount.

### WR-03: `getContactHeader` does not filter archived rows, so a soft-archived-then-not sun occupant can briefly resolve inconsistently across the two reads

**File:** `src/screens/OrreryScreen.tsx:223-237`, `src/screens/SettingsScreen.tsx:168-175`

**Issue:** Both screens resolve the sun occupant by calling `getContactHeader`
(which intentionally does **not** filter `archived_at IS NULL`) and then checking
`header.archived_at !== null` themselves. That is correct and consistent between
the two screens today. The fragility: the archived→self fallback lives in *two*
hand-written places (the screen’s inline check and `resolveSunOccupant`), and
Settings reimplements the name resolution (`header && header.archived_at ===
null ? header.name : "Me"`) rather than routing through the single
`resolveSunOccupant`. If either copy drifts (e.g. a future edit adds a
`snooze`/`reminders_off` dimension, or changes the archived predicate), Settings
and the canvas will silently disagree about who the sun is. This is duplicated
policy, not a live bug.

**Fix:** Route the Settings occupant-name resolution through the same
`resolveSunOccupant` (or a shared helper) that the canvas uses, so the
archived/missing→self policy has one implementation. At minimum add a test
asserting Settings and `resolveSunOccupant` agree for the archived-occupant case.

## Info

### IN-01: `assertSunContactId` accepts any positive integer; a non-existent id relies on the FK to reject at write time

**File:** `src/db/app-settings-dao.ts:172-179`

**Issue:** The validator only checks null-or-positive-integer, so a
`sun_contact_id` pointing at a non-existent contact is caught only by the
`foreign_keys = ON` FK at UPDATE time (which throws, is caught, and logged). The
picker only ever offers real candidates, so this is not reachable in practice,
but the validation comment implies more coverage than exists.

**Fix:** Fine as-is given the FK backstop; optionally note in the doc-comment
that existence is enforced by the FK, not the validator.

### IN-02: Star-swatch "selected" state silently shows nothing if `self_sun_colour` is not a current palette member

**File:** `src/screens/SettingsScreen.tsx:675-695`

**Issue:** Selection is `token === (selfSunColour ?? starPalette[0])`. If the
owner retunes `starPalette` after a user has persisted a now-absent hex, no
swatch renders as selected and the user cannot see their current pick. Harmless
(the stored value still resolves at render), but a minor UX gap.

**Fix:** Optionally render a read-only "current" chip when the stored colour is
not in the palette, or migrate the stored value on palette change.

### IN-03: Duplicated hit-test loop between pure `hitTest` and the pan worklet

**File:** `src/screens/OrreryScreen.tsx:554-567` vs `src/logic/orrery-geometry-logic.ts:173-189`

**Issue:** The pan `onBegin` re-implements `hitTest` inline (it must, since the
pure function cannot be called in a worklet), so the two nearest-body loops can
drift (e.g. the `<=` tie-break rule). They currently match. This is an accepted
Reanimated constraint, noted for maintenance.

**Fix:** Keep the tie-break rule (`<=`, last-drawn wins) identical in both; a
comment cross-linking the two would help. No change required.

### IN-04: `dragMetrics` initial `effectiveGap: 1` is a placeholder divisor before first placement

**File:** `src/screens/OrreryScreen.tsx:460-467`

**Issue:** The shared `dragMetrics` seeds `effectiveGap: 1`. This is never used
for a real computation because a drag can only occur once `canvasVisible`
(placement non-null) has updated it to the floored value, but a `1` sentinel is
easy to misread as significant.

**Fix:** Cosmetic — a brief comment that these are pre-placement sentinels, or
seed from `MIN_GAP`, would remove the ambiguity.

---

_Reviewed: 2026-08-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
