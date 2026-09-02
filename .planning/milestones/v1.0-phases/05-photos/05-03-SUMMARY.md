---
phase: 05-photos
plan: 03
subsystem: ui
tags: [avatar, expo-image, zustand, theme-tokens, cache-bust, initials-hash]

# Dependency graph
requires:
  - phase: 05-01
    provides: avatarSwatches / avatarSwatchText theme tokens (ThemePalette + space-dark preset)
  - phase: 05-02
    provides: photo-storage resolvePhotoUri (relative → file://), contactId-derivable filename scheme
provides:
  - Deterministic themed initials avatar (pure getInitials + hashName + swatchIndex)
  - Reusable Avatar component (expo-image has-photo OR themed-initials fallback, onError degrade)
  - photo-cache-bust-store (per-write monotonic revision token keyed by relPath)
  - getContactHeader extended additively with photo + modified_at
  - Avatar wired into the profile header, refreshed by the existing useFocusEffect
affects: [05-05, 05-08, grid, orrery, widget, contact-profile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure sibling-logic (.ts) + node .test.ts split for correctness-critical avatar math"
    - "Per-write monotonic cache-bust token to close sub-second modified_at collisions on a stable file:// URI"
    - "Additive header-read extension (photo + modified_at) without breaking existing callers"

key-files:
  created:
    - src/components/avatar-initials.ts
    - src/components/avatar-initials.test.ts
    - src/components/Avatar.tsx
    - src/stores/photo-cache-bust-store.ts
  modified:
    - src/db/contact-read.ts
    - src/db/contact-read.test.ts
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "Ported the plugin's initials split + rolling hash verbatim but emit a swatch INDEX, never a colour (free HSL is barred by check:colors); colour resolution stays in the component via theme tokens."
  - "Cache key folds BOTH the modified_at cacheBust prop (cross-session) AND a per-write store revision (sub-second same-value hole), because expo-image caches a decode by a stable derivable file:// URI."
  - "In-memory cache-bust store is correct across restart: a missing revision falls back to photo#modified_at — a key never cached in the fresh process — forcing a clean disk read."

patterns-established:
  - "Pattern: Avatar is the single reusable avatar for profile/grid/orrery/widget; has-photo branch resolves the stored RELATIVE path locally (no network on read path)."
  - "Pattern: every photo WRITE site (05-05/05-08) calls bumpPhotoCacheBust(relPath) right after a set/clear so the Avatar decode refreshes."

requirements-completed: [PHOTO-04]

coverage:
  - id: D1
    description: "Pure initials + deterministic swatch-index logic (getInitials, hashName, swatchIndex) — same name always maps to the same swatch, empty name signals blank swatch."
    requirement: PHOTO-04
    verification:
      - kind: unit
        ref: "src/components/avatar-initials.test.ts#getInitials/hashName/swatchIndex (13 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getContactHeader additively returns photo (relative string / null) + modified_at without breaking existing callers."
    requirement: PHOTO-04
    verification:
      - kind: unit
        ref: "src/db/contact-read.test.ts#getContactHeader photo rel/null + modified_at"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit (existing callers typecheck)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Avatar renders the has-photo expo-image master (cover-fit, circular) OR the themed-swatch initials fallback; onError degrades to initials; empty name → neutral swatch, no glyph."
    verification: []
    human_judgment: true
    rationale: "RN/expo-image rendering and the onError degrade path have no node render harness in this repo; requires on-device UAT (photo-less profile shows a stable coloured initials avatar; same colour across relaunches; a contact with a photo renders the master)."
  - id: D4
    description: "Replacing a photo at the same derivable path visibly refreshes the avatar; two replaces within one wall-clock second each show their own image (per-write revision closes the sub-second modified_at collision)."
    requirement: PHOTO-04
    verification: []
    human_judgment: true
    rationale: "expo-image memory-disk decode caching and the per-write cache-bust behaviour are only observable on-device with a real image write pipeline (lands in 05-05/05-08); no node assertion possible here."

# Metrics
duration: 10 min
completed: 2026-08-15
status: complete
---

# Phase 5 Plan 3: Avatar (initials + photo) Summary

**Reusable Avatar component: deterministic themed-swatch initials (pure, node-tested hash → theme-token index — no free HSL) OR a local expo-image master with a per-write cache-bust token that closes the sub-second modified_at collision, wired into the contact profile header.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-15T14:07Z (after 05-02 close-out)
- **Completed:** 2026-08-15T14:16:38Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Pure `avatar-initials.ts` (getInitials + hashName + swatchIndex) ported verbatim from the plugin but emitting a themed-swatch INDEX, not a colour — 13 node tests green.
- Reusable `Avatar.tsx`: expo-image has-photo branch (resolved local `file://`, cover-fit, circular) with an onError degrade to a themed-swatch + initials fallback; empty name → neutral swatch with no glyph; all colours via theme tokens.
- Net-new `photo-cache-bust-store.ts`: monotonic per-write revision keyed by relPath, folded into the Avatar `cacheKey`/`recyclingKey` alongside the `modified_at` prop so a same-second replace still forces a fresh decode.
- `getContactHeader` extended additively (photo + modified_at) with test assertions for a rel string, null, and modified_at; `<Avatar>` mounted in the profile header, refreshed by the existing `useFocusEffect`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing avatar-initials test** - `65a038e` (test)
2. **Task 1 (GREEN): avatar-initials pure logic** - `3414c6a` (feat)
3. **Task 2: Avatar + cache-bust store + profile wiring** - `114fb56` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `src/components/avatar-initials.ts` - Pure getInitials/hashName/swatchIndex; no theme/RN import, no colour output.
- `src/components/avatar-initials.test.ts` - 13 node cases (initials variants, hash determinism, swatchIndex range/stability/empty→0).
- `src/components/Avatar.tsx` - Reusable avatar: expo-image has-photo OR themed-initials fallback; cache key folds cacheBust prop + store rev; onError degrade.
- `src/stores/photo-cache-bust-store.ts` - bumpPhotoCacheBust / getPhotoCacheBust / usePhotoCacheBust; monotonic per-key counter.
- `src/db/contact-read.ts` - getContactHeader now selects photo + modified_at (additive).
- `src/db/contact-read.test.ts` - makeContact takes photo; asserts header photo rel/null + modified_at.
- `src/screens/ContactProfileScreen.tsx` - Header type gains photo + modified_at; renders `<Avatar cacheBust={modified_at} size={64}>`.

## Decisions Made
- Emit a swatch index, never a colour, from the pure module — keeps colour resolution in the component and passes check:colors (free HSL barred).
- Fold both `modified_at` (cross-session) and a per-write store revision (sub-second) into the image cache key; the store is in-memory but correct across restart via the `photo#modified_at` fallback (a fresh, uncached key).

## Deviations from Plan

None - plan executed exactly as written.

The only extra change was reflowing a doc comment in `avatar-initials.ts` so an illustrative `hsl(...)` example did not trip the `check:colors` literal scanner (the scanner matches `hsl(` even inside comments), and Biome auto-formatting on the touched files. Neither alters behaviour.

## Issues Encountered
- `check:colors` flagged an `hsl(...)` reference inside a code comment (the scanner does not distinguish comments). Resolved by rewording the comment to describe the barred output in prose; re-ran green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Avatar and `photo-cache-bust-store` are ready for 05-05/05-08: those write sites must call `bumpPhotoCacheBust(relPath)` immediately after a set/clear for the decode to refresh.
- On-device UAT outstanding (deferred per phase policy): D3 (both avatar states + onError + empty-name) and D4 (replace refresh + same-second double replace) — verify on the Pixel once the write pipeline lands.

## Self-Check: PASSED

- Files exist: avatar-initials.ts, avatar-initials.test.ts, Avatar.tsx, photo-cache-bust-store.ts (all FOUND).
- Commits exist: 65a038e, 3414c6a, 114fb56 (all FOUND in git log).
- Verification: `npm test` 388/388 pass; `npx tsc --noEmit` clean; `check:colors` clean on all 4 touched render files.

---
*Phase: 05-photos*
*Completed: 2026-08-15*
