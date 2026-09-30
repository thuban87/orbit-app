# Phase 38.6 --- Photo Handling: Sync, Sizes & Lightbox Dossier

**Status:** INSERTED 2026-09-29; discussed 2026-09-29 (O-1..O-4 resolved as D-10..D-19, see Discuss Rulings). Authored at phase insertion from the owner's request of 2026-09-29 and a
read-only grounding pass over the photo code (findings below are verified against source unless labelled LIKELY). This
phase promotes backlog item **999.1** (38.4 D-73: bigger Card-view photos, cross-screen photo sync, Profile lightbox),
which is retired from the backlog. The OPEN items were resolved in the 2026-09-29 discuss session.

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
| Import review | `src/screens/ImportReviewScreen.tsx:396-404` | **Corrected 2026-09-29:** already shows the phone photo (staged) when the device contact has one; initials only when it has none |
| Consolidation prompt | `src/components/ConsolidationPrompt.tsx:27-46` | **Corrected 2026-09-29:** already shows the staged phone photo; initials fallback only |
| Legacy device-contact picker | `src/screens/LegacyContactPickerScreen.tsx:278-287` | **Corrected 2026-09-29:** already shows the device thumbnail (`photoThumbUri`); initials fallback only |
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

## OPEN (owner, for discuss) --- all RESOLVED 2026-09-29

Kept for the record. The rulings are in **Discuss Rulings (2026-09-29)** below: O-1 → D-10..D-13, O-2 → D-14,
O-3 → D-15, O-4 → D-16.

-   **[RESOLVED · was OPEN] O-1 --- Photo resolution vs the bigger Profile photo and the lightbox.** `07-photos.md` Cluster B **decided** one
    512×512 master and **rejected** "512 + original" and "original only". Options: (a) keep 512 and accept a soft
    lightbox and Profile photo; (b) raise the single master (for example to 1024) for new photos only, with existing
    photos staying 512 until re-picked; this reverses the decided 512 size, costs ~4× orrery texture memory per photo and
    backup size, and needs a widget-thumbnail check; (c) keep a second, larger lightbox-only file; this is close to the
    rejected "512 + original" and would reverse that rejection. Any change here reverses a recorded decision, so it is
    the owner's call.
-   **[RESOLVED · was OPEN] O-2 --- Coverage scope (D-02).** Recommendation: every surface that shows an **existing Orbit contact** with an
    initials bubble gets the real photo (Digest day detail, the duplicate/reconcile candidate grid). Pre-import device-
    contact surfaces (import review, consolidation prompt, legacy picker) keep initials, because there is no Orbit photo
    yet. Text-only surfaces (DateDetailSheet, pending confirmations, reach-out router, archived contacts, merge impact)
    stay text-only unless the owner wants avatars added there.
-   **[RESOLVED · was OPEN] O-3 --- Lightbox reach.** The Profile photo only (D-03), or also the Edit Contact photo preview and the Settings
    self photo? Recommendation: Profile only, with the component reusable.
-   **[RESOLVED · was OPEN] O-4 --- Lightbox behaviour.** Pinch-zoom and pan, double-tap to zoom, Back/tap/swipe-down to close. Background
    black or theme-token scrim. Recommendation: pinch + double-tap + pan, Back or swipe-down closes, a near-opaque scrim from
    theme tokens.

## Discuss Rulings (2026-09-29)

Owner rulings from `/gsd-discuss-phase 38.6`. D-10 onward continue the owner-request numbering.

### Photo resolution (O-1)

-   **[DECIDED · 2026-09-29] D-10 --- One 1024 WebP master for every new photo.** Every write of a new photo
    (crop/picker, URL download, device import, import retry, reconcile, custom photo field, self photo) saves one
    square master at up to 1024×1024 as **WebP** instead of 512×512 JPEG. Never upscale: a source smaller than 1024 is
    saved at its own size (still square). Quality setting is tuned for visual parity with today's q 0.75 JPEG. **This
    reverses `07-photos.md` Cluster B's "one 512×512 JPEG master".** The owner asked for the 512 rationale first
    (orrery GPU texture memory, the widget Binder ceiling, backup size) and chose this knowing: storage and backup size
    ≈ 2.5--3× today (~10--12 MB per 100 contacts vs ~4 MB), accepted. Still one file per photo, so Cluster B's
    "no thumbnail pair / no original" stands.
-   **[DECIDED · 2026-09-29] D-11 --- Working memory stays flat.** expo-image surfaces already decode at display size
    (`allowDownscaling`), so a 1024 master costs them nothing extra. The Skia Orrery (`OrbitBody.tsx`, `SunBody.tsx`
    `useImage`) decodes full-size, so it must get a downsampled image (≤ today's 512, or body-sized) so its GPU texture
    memory is no higher than today. How is an engineering call. The widget already re-encodes its own small copy
    (`src/services/widget/widget-photo.ts`); verify it stays within the RemoteViews ceiling from a 1024 WebP source.
-   **[DECIDED · 2026-09-29] D-12 --- Existing photos stay as-is.** Saved 512 JPEG masters are not converted or
    re-encoded. A contact moves to D-10 only when a new photo is written for it. Every reader, the backup exporter,
    restore, merge re-homing and the launch sweep must handle a mixed library (`.jpg` and `.webp`, 512 and 1024).
-   **[REJECTED · 2026-09-29] 512 master + 1024 lightbox-only file** (the owner's own first idea, "most apps keep a
    small and a large copy"). Rejected once it was clear that two files use **more** storage than one 1024 file
    (≈3.5--4× vs ≈2.5--3×), would leave the bigger Profile photo soft, and working memory is flat either way (D-11).
-   **[REJECTED · 2026-09-29] 1024 JPEG** (≈4× storage) and **keep 512** (soft Profile photo and lightbox).
-   **[DECIDED · 2026-09-29] D-13 --- Imported phone photos follow D-10.** Import already brings in the device
    contact's photo as the Orbit photo (`import-acquire.ts` → `import-photo.ts`, today resized to 512 JPEG); it now
    uses the D-10 master rule. The owner's "use phone photos when importing" wish is therefore already built; only
    the size/format changes.

### Coverage (O-2)

-   **[DECIDED · 2026-09-29] D-14 --- Where real photos appear.** Real photos replace initials on every surface showing
    an existing Orbit contact: the Digest Your Week day detail and the duplicate/reconcile candidate grid (plus
    anything the phase's own audit finds). **Pending confirmations** gains contact photos. The other text-only
    surfaces (History DateDetailSheet, reach-out chooser, archived contacts, merge impact summary) stay text-only.
    Pre-import surfaces already show the phone photo (grounding table corrected above).

### Lightbox (O-3, O-4)

-   **[DECIDED · 2026-09-29] D-15 --- Lightbox on the Profile photo only**, built as a reusable component.
-   **[DECIDED · 2026-09-29] D-16 --- Full gestures.** Pinch to zoom, double-tap to zoom in/out, pan when zoomed.
    Close with Back, a labelled ✕ button, or swipe down. Near-opaque scrim from theme tokens. TalkBack can reach and
    operate the close button.

### Profile layout (D-04 follow-up)

-   **[DECIDED · 2026-09-29] D-17 --- The Profile favourite star moves into the top app bar**, beside the ⋮ overflow
    button. The star's own utility row above the photo is removed, freeing space for D-04's upward growth; the photo
    may also rise into the empty middle band of the app bar (device tuning). The star keeps its ≥44 hit area and its
    Add/Remove Favorites accessibility labels.

### Scope pull-in

-   **[DECIDED · 2026-09-29] D-18 --- Pull in todo `2026-08-26-validate-restore-progress-with-imported-photo-library`.**
    During the device pass, restore a backup holding ~50 photo contacts and confirm the progress treatment and Back
    behaviour before the result screen. No new code unless it finds a bug. Close the todo at phase end.

### Post-research rulings (owner, 2026-09-29)

-   **[DECIDED · 2026-09-29] D-20 --- Encrypted-backup cap: measure first (research F-3).** The 1024 WebP masters
    make encrypted backups hit the approved 8 MiB ciphertext cap (`src/services/backup/encryption.ts:23`) at roughly
    40--85 photo contacts instead of 100--200 (estimates). This phase does not change the encryption profile. The
    device pass measures real encrypted and automatic backup sizes with a 50--100 photo-contact library and reports
    them; the owner then decides (accept / raise the cap). Raising the cap is not in this phase.
-   **[DECIDED · 2026-09-29] D-21 --- Filenames unchanged; WebP bytes under the `.jpg` names (research F-1/F-2).**
    38.2 D-09 / ADR-021 identity-derived filenames stay. New masters are WebP content stored at the existing
    `avatars/contact-<id>.jpg` / `avatars/cv-<id>-<col>.jpg` paths; readers decode by content. D-12's "mixed
    `.jpg`/`.webp` library" means mixed JPEG/WebP *content* and 512/1024 sizes, not mixed extensions. This
    supersedes D-19's "new filename per write" direction: the stale-photo fix must not rename files (research's
    display-revision approach). If the fix can only work by renaming, stop and ask the owner.
-   **[DECIDED · 2026-09-29] D-22 --- Imported phone photos stay thumbnail-sized (research F-4).** The native picker
    reads the contact's thumbnail (`OrbitContactPickerModule.kt:207-208`); under D-10's never-upscale rule it is
    stored at that size. No native change in this phase; logged as a future item.

### Engineering boundaries (recorded so planning cannot drift)

-   **[DERIVED] D-19 --- Stale-photo fix and its trip-wires.** The D-01 cache fix approach is an engineering call
    (a new filename per write is the preferred direction, see Current State). It must cover every writer, go through the
    38.2 RG-010 ownership primitives, and handle D-12's mixed library. Backups carry `photoBase64` with no extension or
    MIME (`src/backup/backup-schema.ts`), so restore must write WebP bytes to a WebP-appropriate path (or otherwise
    stay correct). **If the fix or D-10 needs a backup-format bump (today `BACKUP_FORMAT_VERSION = 7`), stop and ask
    the owner.** Any schema change is a migration at head+1 verified on disk.
-   **[PLANNING NOTE] KB follow-up.** D-10 supersedes a `07-photos.md` Cluster B decision; phase KB extraction must
    record it as a new ADR superseding whatever ADR carries the 512 master (check `npm run graph:ask`).

## Carried Constraints

-   `07-photos.md` (photo domain, all [DECIDED] items) **except the 512 JPEG size, superseded by D-10**: single master, persistent document dir, base64 photos in backup,
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
    contacts with photos. **Pulled in (D-18).**
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
-   Added 2026-09-29: lightbox pinch / double-tap / pan / Back / ✕ / swipe-down (D-16); a mixed library of old 512 JPEG
    and new 1024 WebP photos renders, backs up, restores and merges correctly (D-12); Orrery memory no higher than
    before with many 1024 photos (D-11, physical phone only); widget still renders from a WebP master; restore
    progress with ~50 photo contacts (D-18).

## Revision Log

-   **2026-09-29** --- Inserted (D-01..D-09, grounding, O-1..O-4).
-   **2026-09-29** --- Discuss session: D-10..D-19 recorded; O-1..O-4 resolved; photo-coverage table corrected (import
    review, consolidation prompt and legacy picker already show phone photos); 07-photos Cluster B 512 JPEG size
    superseded by D-10; restore-progress todo pulled in.
-   **2026-09-29** --- Post-research rulings D-20..D-22 (encrypted-backup cap measured not changed; filenames unchanged
    with WebP bytes under `.jpg` names, superseding D-19's new-filename direction; imported photos stay thumbnails).
