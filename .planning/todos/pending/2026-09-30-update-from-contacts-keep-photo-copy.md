---
created: 2026-09-30T21:00:00.000Z
title: Update from Contacts keep-Orbit-photo card copy is cut off and reads oddly
area: contacts-sync
severity: minor
files:

  - src/components/PhotoChoice.tsx

source: 38.6 device pass S16; owner ruling D-40 (log for later), 2026-09-30
---

## Problem

On the Pixel 6 Pro at font scale 1.15 the F-3 keep card's label "No meaningful change — keep Orbit photo" is cut to "No meaningful change — ke…", and "No meaningful change" reads oddly when the Orbit photo and the Contacts photo visibly differ. Evidence: `~/orbit-art/38.6/device-pass/D-25__F-3__update-from-contacts-joyce.png`.

## Solution

Let the label wrap (or shorten it), and reword it for the photo case, e.g. "Keep Orbit photo". Copy is the owner's call; confirm the wording before changing it.
