# ADR-020: Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 05-photos
**Source decisions:** dossier `07-photos` Cluster A
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needs an edit-only way to add a contact or self photo without introducing camera permissions, a remote dependency during rendering, or an off-theme crop screen. A pasted image URL remains useful, but it must converge on the same local master as a selected library image.

## Decision

The system uses the system photo library without an in-app camera, presents a themed Skia crop surface, and permits a user-pasted HTTPS image URL as a one-time write-path download. Both sources pass the original image through the same crop and local persistence pipeline; read paths never fetch a URL.

## Alternatives Considered

- **Library plus camera** — rejected because camera capture adds runtime and Play Store permission surface.
- **Auto center-crop without framing** — rejected because it removes the user's framing control.
- **Native square crop** — rejected because its build-time styling cannot follow the runtime theme.
- **Store the remote URL** — rejected because rendering would require network access and break offline reads.
- **Drop URL entry** — rejected because the owner retained the paste path.

## Consequences

### Positive

- Photo acquisition remains permission-light and all rendered photos are local.
- The crop UI keeps theme fidelity while manipulating source-resolution pixels.

### Negative

- The app owns a net-new Skia/Reanimated crop surface and an image-download hardening boundary.

### Risks

- Picker, crop, native fetch, and file-system behavior require physical-device verification.

## Implementation

**Key files:**
- `app.config.ts` — disables camera and microphone picker permissions.
- `src/components/PhotoSourcePicker.tsx` — exposes library and pasted-URL sources for each photo target.
- `src/screens/CropPhotoScreen.tsx` — renders the shared-value-driven themed crop surface.
- `src/services/photos/crop-geometry.ts` — converts the crop transform into source-pixel bounds.
- `src/services/photos/photo-pipeline.ts` — crops and re-encodes the original source into the local master.
- `src/services/photos/url-image.ts` — validates and downloads a pasted image URL on the write path.

**Depends on:** ADR-006 (Theme-Token Architecture); ADR-019 (Native Stack Contact Lifecycle Navigation)
**Required by:** _None._
