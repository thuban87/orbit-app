---
created: 2026-10-16
source: 38.11-DEVICE-PASS.md finding F-06 (38.11-14 device pass) — pre-existing, routed to the backlog (no phase yet) by the orchestrator (planner call), 2026-10-16
area: photos
target_phase: none (backlog)
files:
  - src/components/profile/ProfileBackgroundCreateFlow.tsx
  - src/services/photos/master-encode.ts
---
Choose photo (Profile background, Settings → Profile Backgrounds and the Background sheet) fails with "Couldn't prepare that image" for a 4096×3072 camera photo on the Pixel 3a. The image loader hands expo-image-manipulator a smaller (downsampled) bitmap than the photo's reported size, so a full-height crop computed from the reported size is "outside the source image". Normal-size images work. The pipeline is unchanged since Phase 31, so this is pre-existing.

Likely fix area: compute the crop rectangle against the bitmap the manipulator actually receives (or clamp it to that size) wherever a crop is derived from the picker's reported width/height. Check the avatar crop path too. File paths verified 2026-10-16; the exact failing call is not yet confirmed.
