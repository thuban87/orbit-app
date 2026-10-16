---
created: 2026-09-30T21:00:00.000Z
title: Edit Contact Save pushes a second Profile instead of going back
area: contacts
severity: minor
files:

  - src/screens/EditContactScreen.tsx

source: 38.6 device pass S1; owner ruling D-40 (log for later), 2026-09-30
---

## Problem

`EditContactScreen.tsx` (~line 1068) calls `navigation.navigate("Profile", { contactId })` after Save. On this React Navigation version that pushes a new Profile, so hardware Back from the saved Profile returns to Edit Contact and one more Back reaches the original Profile. Nothing is lost; the stack has an extra screen. Pre-existing since Phase 04.

## Solution

Return with `goBack` (or `popTo` the existing Profile) after a successful save; cover the origin-aware return paths (Dashboard, Orrery sheet, Archived) in a test.

## Resolved 38.11 (backlog cleanup, owner-approved 2026-10-16)

Fixed by 38.11-01 (`10825dcb`, D-26/D-13): after Save, `resolveEditSaveExit` goes back to the originating Profile/Compose or replaces Edit with the Profile, so no second Profile is pushed (`src/screens/EditContactScreen.tsx` ~:1140-1150). Checked on `main @ ad0b0162`.
