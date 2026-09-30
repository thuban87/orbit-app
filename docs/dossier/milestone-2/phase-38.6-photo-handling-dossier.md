# Phase 38.6 --- Photo Handling: Sync, Sizes & Lightbox Dossier

**Status:** INSERTED 2026-09-29, pre-discuss. Authored at phase insertion from the owner's request of 2026-09-29 and a
read-only grounding pass over the photo code (findings below are verified against source unless labelled LIKELY). This
phase promotes backlog item **999.1** (38.4 D-73: bigger Card-view photos, cross-screen photo sync, Profile lightbox),
which is retired from the backlog. Run gsd-discuss-phase to resolve the OPEN items before planning.

## Decision Legend

-   **[DECIDED]** explicitly chosen by the owner.
-   **[OPEN]** an owner decision still to be made (discuss-phase).
-   **[DERIVED]** a consequence of a decision or of a measured fact.
-   **[PLANNING NOTE]** a repository finding or engineering follow-up to verify at planning time.

**Numbering.** D-01..D-09 are the owner's insertion-time requests (2026-09-29). Discuss rulings continue at D-10. Carried
decisions from other phases are written "38.4 D-NN" or cite their dossier.

## Objective

A contact's photo is the same, current photo everywhere Orbit shows that contact. Photos are bigger where people look at
them (Profile, Contacts list, Contacts grid), and tapping the Profile photo opens it full screen with pinch-zoom.

## Owner Requests (2026-09-29)

-   **[DECIDED] D-01 --- Photo sync across the app.** Changing a contact's photo must update it on every surface, not just
    the Orrery. Today the Profile and the Contacts page keep showing the old photo.
-   **[DECIDED] D-02 --- Photo-coverage audit.** Audit every place the app lists or shows a contact, and make each one show
    the contact's real photo instead of initials. Named example: the Digest's Your Week heatmap. Tapping a day lists that
    day's contacts with initials bubbles only.
-   **[DECIDED] D-03 --- Profile photo lightbox.** Tapping the photo on a contact's Profile opens it full screen in a
    lightbox. Zoom is wanted ("zoomable would be good").
-   **[DECIDED] D-04 --- Profile photo about 2× bigger, growing upwards.** The content below the photo must not move lower
    than it is today. The photo grows into the space above it. The owner expects this to need tuning on the device.
-   **[DECIDED] D-05 --- Contacts List view photos 50% bigger.**
-   **[DECIDED] D-06 --- Contacts Grid view photos about 2× bigger "to start"** (tuning expected).
-   **[DECIDED] D-07 --- Grid card corner controls 5px from the card edges.** The favourite star (today about 10px in) and
    the selection checkbox (today about 20px in) both move to 5px from their card edges. The aim is even spacing around
    the photo and room for the photo to grow without growing the card much.
-   **[DECIDED] D-08 --- Grid card names wrap to two lines.** The name fills the first line first; only the part that does
    not fit (normally the last name) moves to line 2. The card grows a little, which is accepted.
-   **[DECIDED] D-09 --- Uniform row height in the grid.** If any card in a grid row needs the second name line, every card
    in that row gets the same two-line name height, so each row has a single height.

## Current State (grounding, 2026-09-29)

### Storage

-   `contacts.photo` / `profile.photo` hold a relative path. The path is **fixed per contact**: `avatars/contact-<id>.jpg`,
    custom photo fields `avatars/cv-<id>-<col>.jpg`, self `avatars/profile.jpg` (`src/db/photo-relative-path.ts`).
-   One 512×512 JPEG master at q 0.75 per photo (`src/services/photos/photo-pipeline.ts:41`), per `docs/dossier/07-photos.md`
    Cluster B.
-   Replacing a photo **overwrites the same path** (`persistMaster`, `src/services/photos/photo-storage.ts`: tmp → bak →
    rename). The file URI never changes.

### Why photos go stale (D-01 root cause)

-   **[DERIVED · verified] The image cache, not the data.** `Avatar` (`src/components/Avatar.tsx`) renders through
    expo-image with `cacheKey: photo#bust`, `recyclingKey` and `cachePolicy="memory-disk"`. On Android, expo-image returns
    a `RawModelProvider(uri)` for `file://` sources **before** it reads `cacheKey`
    (`node_modules/expo-image/android/.../records/SourceMap.kt`). The cache key only applies to network URLs. With the same
    URI string, the native view does not reload and Glide serves the old decoded bitmap. The whole cache-bust scheme
    (`src/stores/photo-cache-bust-store.ts` + `cacheBust` props) does nothing for local photos on Android.
-   **[DERIVED · verified] Why the Orrery is right.** Skia `useImage` re-reads the file on every mount with no decode cache,
    and `OrreryWorld` remounts on each focus (`OrreryScreen.tsx`). The widget also re-reads the file on each render.
-   **[DERIVED · verified] The data is current.** The Profile and dashboard reads re-query `photo, modified_at` on focus.
-   **[PLANNING NOTE · LIKELY]** Glide's disk cache may keep the stale image after an app restart too, contrary to the
    comment in `photo-cache-bust-store.ts`. Verify on device.
-   **[PLANNING NOTE · verified] Secondary gaps.** Only `CropPhotoScreen` bumps the cache-bust counter. Import
    (`import-photo.ts`), import retry (raw `UPDATE`, `import-photo-retry.ts:139`), reconcile (`ReconcileDetailScreen.tsx`),
    merge (`merge-dao.ts` + `merge-photo-rehome.ts`), remove-photo (`PhotoSourcePicker.tsx`) and backup restore
    (`restore-apply.ts` `writePhotoReference`, raw `UPDATE` without `modified_at`) do not. Several avatar sites pass no
    `cacheBust` at all. Whatever fix is chosen must cover **every writer** of `contacts.photo` / `profile.photo` and the
    custom photo field, not just the crop screen.
-   **[PLANNING NOTE]** Fix directions: (a) a new filename per write (versioned path, e.g. `contact-<id>-<rev>.jpg`, with
    the old file removed in the same ownership flow; touches `photo-relative-path.ts` `SAFE_RELATIVE`, merge re-homing,
    backup/restore path handling, owned-master deletion intents from 38.2), (b) a version in the URI string (confirm Glide
    treats `?v=` on `file://` as a new model), or (c) explicit cache eviction after every write. (a) is the only one that
    is robust across process restarts and both platforms. The on-disk filename scheme was left to phase planning by
    `07-photos.md` ("Deferred to phase planning"), so this is an engineering call, but it must not break the 38.2 photo
    ownership primitives (RG-010) or the backup format. **A backup-format bump is an owner decision.**

### Photo coverage (D-02 audit seed)

Initials-only or no-avatar surfaces found in the grounding pass. The phase's own audit must re-derive this list from
code, not trust it:

| Surface | Location | Today |
|---|---|---|
| Digest › Your Week day detail | `src/components/digest/DigestDayDetail.tsx:122` | `photo={null}`: initials only (owner's example) |
| Duplicate review / reconcile candidate grid | `src/components/CandidateCardGrid.tsx:232` | Initials only |
| Import review | `src/screens/ImportReviewScreen.tsx:404` | Initials (pre-import device contact) |
| Consolidation prompt | `src/components/ConsolidationPrompt.tsx:46` | Initials |
| Legacy device-contact picker | `src/screens/LegacyContactPickerScreen.tsx:287` | Initials (device contacts) |
| History DateDetailSheet | `src/components/history/DateDetailSheet.tsx` | No avatar (icons only) |
| Pending confirmations sheet | `src/components/PendingConfirmationsSheet.tsx` | No avatar (text only) |
| Reach-out router | `src/components/ReachOutRouter.tsx` | No avatar |
| Archived contacts | `src/screens/ArchivedContactsScreen.tsx` | No avatar |
| Merge impact summary | `src/components/MergeImpactSummary.tsx` | No avatar |

Sites that already render the real photo (all affected by the D-01 cache bug): Profile hero, List rows, Grid cards,
Orrery bodies and contacts sheet, Manage Members, Digest Up Next and Horizon, group event participants, the shared
`ContactPicker` (Log, Group Log, Update Contact, AI compose, Edit Group Event, FAB, Relationship editor, Profile template
manager), Compose header and research, Capture, Unbound contacts, merge survivor select, Edit Contact preview, Settings
self photo, custom photo field, and the widget.

### Sizes and layout today

-   **Profile:** avatar 112 (`src/components/profile/ProfileHero.tsx:61`). Above it: 56px app bar
    (`PROFILE_APP_BAR`), 16 scroll padding, a 44×44 favourite star in its own right-aligned `utilityRow`, and a 16 gap.
    That is about 132px of chrome above the photo (safe-area inset not measured).
-   **List rows:** avatar 48 (`src/components/ListRow.tsx:268`), row `minHeight` 72, name 1 line.
-   **Grid:** `CardGrid.tsx` is a `FlatList` with `numColumns = gridColumnCount(width, fontScale)` (2/3/4/5), column gap 8,
    content padding 16. Cards are `flex:1`, `minHeight` 144, padding 12 (`GridCard.tsx`). Avatar 48 in a 56 ring box. The
    star is in normal flow (`alignSelf:flex-end`, negative margins); the selection checkbox is absolute at `top:4,left:4`
    with a 48×48 hit area. Name, recency and snippet are all `numberOfLines={1}`.
-   **Zoom support:** no lightbox/zoom library installed. Available: `react-native-gesture-handler ~2.32`, reanimated
    4.5.1, expo-image ~57, Skia 2.6.2. Existing pinch/pan to reuse: `CropPhotoScreen.tsx:238,255`,
    `ProfileBackgroundManager.tsx:272-295`.

## Derived Constraints

-   **[DERIVED] Profile growth is into chrome.** Doubling to about 224 while keeping everything below in place means the
    photo takes over roughly 112px above it. Today that is about 132px of app bar + padding + the star row. So the
    favourite star probably moves off its own row (for example beside or over the photo). The exact layout is a device
    tuning item with the owner (D-04 expects tuning).
-   **[DERIVED] Grid width budget.** On a 3-column phone at 360dp, a card is about 104dp wide with about 80dp inside the
    12px padding. A 96dp photo plus its status ring (~112) does not fit. At the Pixel 6 Pro's ~412dp it is about 120dp.
    "About 2×" therefore has to be computed from the available card width (with the D-07 5px insets and reduced
    padding), not hard-coded at 96. The planner must check 2-, 3-, 4- and 5-column layouts and font scales ≥ 1.4.
-   **[DERIVED] Hit targets.** Moving the star and checkbox to 5px from the edges concerns the visible glyph position. The
    48×48 accessible hit areas (38.4 accessibility work) stay; they may extend past the glyph toward the card interior.
-   **[DERIVED] D-09 needs a row-level measure.** `FlatList` `numColumns` lays out each row independently. Uniform
    two-line name height per row needs each card to know whether any sibling in its row wraps (measure name layouts per
    row, or a per-row `minHeight` of 2 × line height when any card in that row needs it). A fixed two-line height for all
    rows is simpler but contradicts D-09's "only rows that need it."
-   **[DERIVED] Resolution.** Masters are 512px. A 224dp Profile photo on the Pixel 6 Pro (~3.5×) needs ~780px, and a full-
    screen lightbox needs ~1440px. Both will look soft on today's master. See O-1.

## OPEN (owner, for discuss)

-   **[OPEN] O-1 --- Photo resolution vs the bigger Profile photo and the lightbox.** `07-photos.md` Cluster B **decided** one
    512×512 master and **rejected** "512 + original" and "original only". Options: (a) keep 512 and accept a soft
    lightbox and Profile photo; (b) raise the single master (for example to 1024) for new photos only, with existing
    photos staying 512 until re-picked; this reverses the decided 512 size, costs ~4× orrery texture memory per photo and
    backup size, and needs a widget-thumbnail check; (c) keep a second, larger lightbox-only file; this is close to the
    rejected "512 + original" and would reverse that rejection. Any change here reverses a recorded decision, so it is
    the owner's call.
-   **[OPEN] O-2 --- Coverage scope (D-02).** Recommendation: every surface that shows an **existing Orbit contact** with an
    initials bubble gets the real photo (Digest day detail, the duplicate/reconcile candidate grid). Pre-import device-
    contact surfaces (import review, consolidation prompt, legacy picker) keep initials, because there is no Orbit photo
    yet. Text-only surfaces (DateDetailSheet, pending confirmations, reach-out router, archived contacts, merge impact)
    stay text-only unless the owner wants avatars added there.
-   **[OPEN] O-3 --- Lightbox reach.** The Profile photo only (D-03), or also the Edit Contact photo preview and the Settings
    self photo? Recommendation: Profile only, with the component reusable.
-   **[OPEN] O-4 --- Lightbox behaviour.** Pinch-zoom and pan, double-tap to zoom, Back/tap/swipe-down to close. Background
    black or theme-token scrim. Recommendation: pinch + double-tap + pan, Back or swipe-down closes, a near-opaque scrim from
    theme tokens.

## Carried Constraints

-   `07-photos.md` (photo domain, all [DECIDED] items): single 512 master, persistent document dir, base64 photos in backup,
    themed initials fallback colour.
-   38.2 RG-010 photo ownership primitives (owned master, reference-safe intents, in-flight staging, merge re-homing,
    durable deletion intents). A versioned filename must go through them.
-   All colours through theme tokens, including the lightbox scrim and any Skia draw.
-   Any schema change is a forward-only migration at head+1, verified on disk at plan time (head is 032 as of 38.4). A
    backup-format bump is an owner decision.
-   Local-first: nothing new on any network path.

## Related Backlog / Todos Reviewed (2026-09-29)

-   **Backlog 999.1** --- promoted into this phase (D-01, D-03, D-06 cover it) and removed from the backlog.
-   **Todo `2026-08-26-validate-restore-progress-with-imported-photo-library`** --- a device observation that needs ~50
    contacts with photos. Candidate pull-in: this phase's device pass will already build a photo-heavy fixture set. Owner
    to confirm.
-   **Todo `2026-09-29-your-week-interactions-wrap`** --- Your Week stat label wrap at font 1.15. Same screen as D-02's
    example but a large-text layout item slated for Phase 40. Not pulled in unless the owner wants it.
-   No other backlog item or pending todo concerns photos.

## Verification Expectations

-   Unit: writer coverage (every photo writer produces a cache-distinct URI or triggers eviction), grid row-height logic,
    size calculations per column count.
-   Device (Pixel 6 Pro + Pixel 3a, debug then one release): change a photo via crop, import, reconcile, merge and restore,
    and see it update on the Profile, List, Grid, Orrery, Digest, pickers and the widget without an app restart, and after
    a restart. Lightbox open, zoom, close, and TalkBack. Grid at 2/3/4 columns and large text.
-   Owner device checkpoint on the Profile and Grid sizes (D-04, D-06 expect tuning).
