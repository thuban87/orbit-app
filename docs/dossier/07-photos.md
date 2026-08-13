# Dossier 07 — `photos` — Photo handling

> **Status: complete.** 7 questions over 3 rounds; no `[OPEN]` items. This run **reverses
> HANDOFF §14.3** (URL input is kept alongside the picker) and **partially un-deletes §4's
> `ImageScraper`** (its download logic only) — both flagged to and chosen by the owner. It
> also resolves the ported HSL-avatar hash against CLAUDE.md's theme-token rule.

## Scope

How a contact's (and the user's own) photo is captured, stored, rendered, and destroyed on
mobile. The plugin resolved photos three different ways (URL / wikilink / vault path) and
scraped remote URLs to disk via `ImageScraper` (HANDOFF §4 marks it **delete**). Mobile
replaces all of it with a native image picker writing to local file storage (HANDOFF §14.3),
a single resolution path, and the initials-avatar fallback ported from the plugin. This
domain owns the **source, storage policy, avatar fallback, and lifecycle** of the photo file
— not the ring/"planet" styling (HANDOFF §7; dashboard/orrery domains) nor the `photo`
custom **field** type widget (that reuses this domain's picker).

**Binding decisions inherited (not reopened here):**
- `photo` is a **nullable TEXT path column** on `contacts` (01-data #10).
- **Native image picker + local file storage** (HANDOFF §14.3) — replaces the plugin's URL input.
- Photo is **edit-only**, never on the create form (06-crud Cluster A).
- **Purge deletes the photo file explicitly** in the transaction — no FK reaches it
  (01-data → photos; 06-crud).
- The **user's own photo** lives on the separate single-row self/profile record; the orrery
  **sun** carries the self (or an assigned contact's) photo (01-data). Same pipeline.
- **Images-as-fuel are out of scope** (03-fuel) and the **vault importer is cut** (domain 5)
  — so the *only* photo files that ever exist are contact photos and the one self photo. No
  remote/vault photo references reach the app.

## Decisions

### Cluster A — Capture & source

**[DECIDED] Photo source is the system photo library only — no in-app camera.** Verifier
confirmed `launchImageLibraryAsync` routes through the Android 13+ system Photo Picker with
**no runtime permission prompt**, whereas an in-app camera would add a `CAMERA` runtime
permission and a Play Store permission declaration. The user can still shoot a photo with
their own camera app and pick it from the gallery, so nothing is truly lost.
Rationale: leanest capture, no permission surface, reinforces "private by construction"
(HANDOFF §8). *(image-picker.md finding 2.)*
**[REJECTED] Library + camera** — a real convenience (snap someone you just met) but costs a
permission + a store declaration; owner declined for v1. **[REJECTED] Camera only.**
*Config-hardening exported to implementation: set `cameraPermission: false` and
`microphonePermission: false` in the picker config plugin so `CAMERA`/`RECORD_AUDIO` never
enter the manifest.*

**[DECIDED] Framing is an in-app custom crop (Skia), not the native crop screen and not
render-time auto-crop.** *Owner's call over the recommended auto-center-crop.* The native
`allowsEditing` crop screen is styled with **build-time hex and cannot follow the runtime
theme** (image-picker.md finding 5) — an in-app Skia crop keeps full theme control and lets
the user frame the face. So we **skip `allowsEditing`**, take the raw picked image, and
present our own crop → the cropped region is then downscaled to the 512px square master
(Cluster B).
Rationale (owner): theme fidelity + framing control are worth the net-new UI.
*Consequence:* this is net-new work with no plugin predecessor; the crop UI is a photos-domain
build item, flagged so it is not mistaken for a port.
**[REJECTED] Auto center-crop, no crop screen** (recommended for leanness) — no framing
control. **[REJECTED] Native square crop** — off-theme seam on theme switch.

**[DECIDED — controlled reversal of §14.3/§4] A URL entry path is kept alongside the picker,
and it downloads once to the same local 512px master.** *Owner chose to keep URL; the
download-once semantics keep the reversal controlled.* Flagged to the owner across two rounds.
- **What reverses:** §14.3's "picker *replaces* URL input" — URL input returns as a second
  way in. §4's "delete `ImageScraper`" is **partially** reversed: its download +
  content-type→extension logic is re-ported (as `fetch`, not Obsidian `requestUrl`), while its
  wikilink return, vault-path naming, and folder-conflict resolution stay deleted (no vault on
  mobile). Net new-code, not a straight port.
- **What is preserved:** the end state is always a **local file** (Cluster B's master), so
  HANDOFF §3's "no network dependency on any read path" [DECIDED] is untouched — the one
  network hit is on the *write* path, at paste time only.
- **[REJECTED] Store the remote URL as-is** — every render would re-fetch over the network,
  violating §3 and breaking the offline dashboard. Barred by a non-negotiable, not merely
  discouraged. **[REJECTED] Drop URL entirely** — owner declined; he wants the paste path.

### Cluster B — Sizing & storage

**[DECIDED] One 512×512 JPEG master per photo, quality ~0.75 (~30–60 KB); no thumbnail pair,
no original retained.** On import (picker *or* URL download), the image is square-cropped
(from the Skia crop region) and downscaled via `expo-image-manipulator`'s current
`ImageManipulator.manipulate()` API, then copied from cache into the persistent document dir.
Rationale, verified: `expo-image` self-downscales one master for the grid *and* profile
(`allowDownscaling` default true), so no thumbnail pair is needed; the Skia orrery holds each
photo as a GPU texture (≈ w×h×4 bytes) so a small master bounds render-loop memory; the widget
cannot read `file://` and must receive **base64**, and 512px re-encodes well within the
RemoteViews byte ceilings. *(storage-manipulate.md 3–5, render-surfaces.md 1–2, 4.)*
**[REJECTED] 256×256** — leaner but soft on a large profile view; 512 is the better single
size. **[REJECTED] 512 + original** — doubles storage/backup for a full-res view v1 doesn't
have; original is useless to the widget. **[REJECTED] Original only, downscale at render** —
ruled out by the widget's Binder limit and orrery texture cost; there is no viable "keep it
huge" path.

**[DECIDED] Store under the persistent document dir via the new `expo-file-system` class API;
the picker/manipulator cache file MUST be copied there.** Both the picker and the manipulator
write to the **evictable cache** dir first (`file://…/cache/…`); Android can purge it, so the
copy-to-`Paths.document` step is mandatory or avatars silently vanish. Use `File`/`Paths`
(new API), not the deprecated legacy `documentDirectory`/`copyAsync` that most tutorials show.
*(image-picker.md 1, storage-manipulate.md 1–2.)*

### Cluster E — Backup (constraint on the pending `backup` domain)

**[DECIDED] The JSON export embeds photo bytes as base64.** `allowBackup="false"` +
deletion-on-uninstall + no server means export is the only barrier to total loss (01-data →
backup); a path-only export loses every avatar on restore to a new device. At ~40 KB × tens of
contacts the base64 payload is a few MB — trivial, and the small master (Cluster B) is what
keeps it cheap. Applies to the self photo too.
**[REJECTED] Path only** — avatars gone on device migration, no recovery. **[REJECTED]
JSON + separate photos zip** — leaner JSON but more for the user to keep together on restore;
a single self-contained file is the safer default for a non-technical restore.
*(Final format/mechanics are the `backup` domain's call; this fixes the requirement.)*

### Cluster C — Avatar fallback (no photo)

**[DECIDED] The initials fallback keeps a deterministic per-contact color, but quantized to a
themed swatch set — not the plugin's free HSL hue.** The plugin's
`hsl(hash(name) % 360, 65%, 45%)` generates an arbitrary hue, which breaks CLAUDE.md's
non-negotiable (every colour through a theme token; no hardcoded colours incl. Skia; a theme
switch restyles everything). Instead: the name-hash indexes into **N avatar swatches defined
as theme tokens**, so the color is still stable per person and glanceable, but it obeys the
token architecture and restyles with the theme.
Rationale (owner, taste/architecture bucket): keeps the "each contact has a color" benefit
without a permanent carve-out. Trade accepted: a finite palette instead of infinite hues.
**[REJECTED] Free HSL hash as a documented carve-out** — max variety, but a standing exception
to a non-negotiable and avatars wouldn't restyle on theme change. **[REJECTED] Single neutral
token background** — fully themed but every photo-less contact looks identical, hurting
glance-ability across the grid and orrery.
*The initials-derivation logic itself ports verbatim (see "Decisions made without you").*

## Cross-domain constraints exported

- **[photos → data]** `contacts.photo` (and the self record's photo) stores a **relative
  filename** under the document dir, resolved to an absolute `file://` path at read time — not
  an absolute path, which is device-specific and breaks on restore. Reaffirms 01-data #10
  (nullable TEXT), adds the relative-path rule.
- **[photos → crud / self]** Purge deletes the photo file (already decided) **and** any custom
  photo-field files; **replace/remove deletes the old file inline** and is **non-undoable**
  (no `field_history` for binary files). Applies to the self record too.
- **[photos → fields]** A custom field of type **`photo`** (§14.8) **reuses this pipeline**
  verbatim — picker/URL-download → 512px master under the document dir → path stored in its
  `contact_custom_values` TEXT column. Not dropped from the field-type set. Purge/backup/orphan
  rules and the themed-fallback rule all extend to these files.
- **[photos → dashboard / orrery]** One 512px master per contact; render via **`expo-image`**
  (grid/profile, self-downscaling) and **Skia** (orrery). Fallback = **themed swatch + initials**,
  deterministic per contact. Planet/ring styling is those domains' call, not photos'.
- **[photos → widget]** Widget images **must be base64 `data:` URIs** — RemoteViews cannot read
  `file://` — re-encoded from the 512px master on demand, within RemoteViews byte ceilings
  (~5–6 MB decoded bitmap; ~1 MB Binder transaction). Favourite-contact photos are feasible but
  must stay small; the 512px master satisfies this.
- **[photos → notify]** ⚠ **expo-notifications (managed) has NO per-notification large icon** —
  a contact's photo **cannot** appear on a decay notification without a bare-workflow native
  module. This is a scope decision for the `notify` domain, not a storage constraint.
- **[photos → backup]** Export **embeds photo bytes as base64** (contacts + self). Restore
  writes fresh files under the document dir and **repoints paths** — stored paths are never
  restored verbatim (they are device-specific and relative).

## Deferred to phase discussion

- **Skia `file://` uncertainty:** the render-surfaces verifier found Skia's docs demonstrate
  only `require()`/network/bundle sources — a raw `file://` is undocumented. Spike whether
  `useImage`/`Skia.Data.fromURI` accepts the sandbox path directly; if not, go base64 →
  `Skia.Image.MakeImageFromEncoded`. Decide at orrery-phase time. *(render-surfaces.md open item.)*
- **In-app Skia crop interaction model:** zoom/pan vs a fixed-size square drag; whether it
  offers rotation. Needs the crop UI's design context.

## Deferred to phase planning

- Exact on-disk filename scheme — recommend **uid-based** (the stable per-row id from
  `[log → all]`), never name-based (names collide and change; the plugin's `{name} - Photo`
  scheme does not survive here).
- Exact document subdir (e.g. `avatars/`) and whether contact vs custom-field photos separate.
- The new `File`/`Paths` class-API's **await/overwrite-on-existing** semantics — the verifier
  found the docs show `.copy()/.delete()/.create()` without `await` and silent on overwrite;
  confirm on-device (defensively `delete()` before `copy()` in the meantime).
- `expo-image-manipulator` exact resize/crop params and format (JPEG confirmed, quality ~0.75).

## Decisions made without you

*(Trivia the orchestrator picked — veto any at review.)*

- **Initials derivation ports verbatim** from `ContactCard.tsx`: split on whitespace, first
  char of the first two words, uppercase, `slice(0,2)`. Single-word name → 1 initial; empty
  name → blank swatch. Applies to contacts and the self record.
- **Photo replace/remove is immediate, best-effort, and non-undoable** — old file deleted
  inline on replace/clear, **no launch-time orphan sweep in v1** (tens of contacts × one ~40 KB
  file makes accumulation negligible; a sweep is cheap to add later if it ever matters).
- **`expo-image` is the render component** for local avatars: `contentFit="cover"`,
  `cachePolicy="memory-disk"`, `recyclingKey={contactId}` in grids.
- **Picker config hardening:** `cameraPermission: false`, `microphonePermission: false` so
  `CAMERA`/`RECORD_AUDIO` never enter the manifest.
- **`MediaTypeOptions` is deprecated** → use `mediaTypes: ['images']`; result is
  `{ canceled, assets[] }` (no flat `result.uri`). Recorded so stale tutorials don't mislead.

## Findings

Investigation read the plugin's photo path in full and verified every platform capability
against **Expo SDK 55** official docs (RN 0.83.4 — the quest-board scaffold's version).

**Plugin behavior (source of truth over its own docs):**
- `contact.photo` is free text resolving **three** ways in `ContactCard.tsx:241-264` — URL
  passthrough, `[[wikilink]]` via `metadataCache`, or vault path via the adapter — with an
  `onError` fallback to the initials avatar. Mobile collapses this to **one** local-file path.
- `ImageScraper.ts` downloads a pasted URL to the vault (`{name} - Photo.{ext}`, content-type→
  extension with `.webp` fallback, numeric conflict resolution) and returns a wikilink. Invoked
  from four sites (`main.ts`, `OrbitIndex.ts:230-260`, `OrbitHubModal.ts`, form `_scrapePhoto`
  toggle), gated by the `photoScrapeOnEdit: 'ask'|'always'|'never'` setting. HANDOFF §4 marks it
  **delete**; this run **re-ports only its download logic** for the kept URL path (Cluster A).
- The plugin does **no resizing/compression** — it stores raw bytes. Mobile adds the 512px
  downscale (Cluster B).
- The initials + `stringToColor` HSL hash live only in `ContactCard.tsx`; the hash is the
  piece that "ports," but its free hue collides with the theme-token rule (Cluster C).

**Platform verification (full reports in `workpapers/07-photos/`):**
- `image-picker.md` — picked file is in **evictable cache** (copy required); library needs no
  permission, camera does; `quality` compresses but doesn't resize; native crop screen is
  off-theme.
- `storage-manipulate.md` — new `expo-file-system` class API (`Paths.document`, `File.copy`);
  `expo-image-manipulator`'s `manipulate()` (not deprecated `manipulateAsync`); one 512px JPEG
  ~30–60 KB; `expo-image` self-downscales one master for grid + profile.
- `render-surfaces.md` — Skia circular clip feasible (`file://` undocumented → base64 path);
  **widget needs base64, can't read `file://`**, plus RemoteViews byte ceilings; **no
  per-notification large icon** in managed Expo. Net: a small master + base64-emit capability is
  a hard requirement.
