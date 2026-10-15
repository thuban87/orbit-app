# ADR-183: 224 Profile Photo Growing Upward, App-Bar Favourite Star and a Reusable Profile Photo Lightbox

**Status:** Accepted
**Date:** 2026-09-30
**Phase:** 38.6-photo-handling
**Source decisions:** D-03, D-04, D-15, D-16, D-17, D-36 (dossier; DISCUSSION-LOG O-3/O-4 and Profile favourite star)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The owner wanted the Profile photo about twice as big without pushing the content below it any lower, and wanted a tap on it to open the photo full screen with zoom. Above the 112 photo sat about 132 px of chrome: the 56 px app bar, padding, and a utility row that held only the 44×44 favourite star.

## Decision

The Profile photo is 224 (`PROFILE_HERO_AVATAR_SIZE`). It grows upward into the space the star row freed. `profileContentTopPadding` keeps the name at or above the old 260 line (`PROFILE_LEGACY_NAME_TOP`).

The favourite star moves into the top app bar, left of ⋮. It keeps a hit area of at least 44, the Add/Remove Favorites labels, and its pending/bound disabling. The app bar overlays the scroll view (`box-none`) with a threshold-gated scroll scrim. In-Profile scroll targets are offset by the bar height.

Tapping a stored photo opens `PhotoLightbox` as one more `ProfileOverlay` (`"photo"`), so Back closes it through the single-overlay contract. The lightbox is reusable but used on the Profile only. It supports:
- pinch to 4×
- double-tap to 2.5× about the tap point, and back
- pan clamped to the edges
- swipe-down to close past 120 dp or on velocity
- a labelled "Close photo" button of at least 48, which gets TalkBack focus on open
- a near-opaque theme-token scrim

Gesture math lives in worklets in `photo-lightbox-logic.ts`. A contact with no photo, or a lost one, gets no lightbox entry.

## Alternatives Considered

- **Star on the photo's corner** (ST-B) — rejected because it sits near the lightbox tap area.
- **Star beside the photo** (ST-C) — rejected because of the width it costs on narrow phones.
- **Lightbox also on Edit Contact and the Settings self photo** — rejected by D-15. Edit's tap already opens change-photo.
- **Simple gestures** (pinch and pan; close with Back or ✕) — rejected for the full set (D-16).

## Consequences

### Positive

- Content below the hero does not move, and the photo is the dominant element.
- The lightbox stays isolated and reusable, and its tunables are single-number edits.

### Negative

- At 360 dp the star's hit area overlaps the photo by about 5.7 dp. The owner accepted this (D-36, T-a).

### Risks

- Lightbox gestures run as worklets. A helper defined below its caller crashes on Hermes, so both files are in the worklet-order guard.

## Implementation

**Key files:**
- `src/components/PhotoLightbox.tsx` — reusable zoomable full-screen photo view.
- `src/components/photo-lightbox-logic.ts` — scrim, zoom, double-tap and dismiss constants plus clamp/focal worklets.
- `src/components/profile/ProfileHero.tsx` — 224 photo with `onOpenPhoto`; the favourite utility row is removed.
- `src/screens/ContactProfileScreen.tsx` — `ProfileAppBar` (back, star, ⋮, scroll scrim) and the `"photo"` overlay.
- `src/screens/contact-profile-logic.ts` — hero size, legacy name line, app-bar scrim and scroll-target helpers.
- `src/components/orrery/orrery-worklet-order.test.ts` — worklet-order guard covering the lightbox files.

**Depends on:** ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors); ADR-180 (Display-Revision Photo URIs and Current Photos on Every Existing-Contact Surface); ADR-181 (One Square WebP Master up to 1024 px with Bounded Orrery Textures from Cache Copies)
**Required by:** None
