---
created: 2026-09-30T23:00:00.000Z
title: Text in a photo field reaches AI Research as-is and shows raw on Merge conflicts
area: custom-fields
severity: minor
files:

  - src/db/compose-research-read.ts
  - src/db/profile-knowledge-read.ts
  - src/screens/MergeConflictsScreen.tsx

source: 38.6 close-out (follow-on from D-31/D-34), 2026-09-30
---

## Problem

D-31/D-34 keep text left in a photo-type custom field (e.g. "Rex" after a Text→Photo type change) as data and show it as "Photo unavailable" on the Profile and in the photo editor. Two other readers still treat the raw value as ordinary content:

- **Compose Research:** `readPopulatedCustomFields` (`src/db/profile-knowledge-read.ts:239`) does not filter by field type, and `compose-research-read.ts:220` emits `value: field.rawValue ?? ""` for every populated field. A photo field therefore appears as a Research item with its raw text, and a stored photo field with its relative path (`avatars/cv-…jpg`). When the field's `share_with_ai` is on, that item is AI-eligible and can be sent when the user explicitly invokes AI.
- **Merge conflicts:** the custom-field conflict query (`src/screens/MergeConflictsScreen.tsx:128-137`) lists any two differing values, so a photo field shows raw text or paths side by side instead of the photo choice.

## Solution

Decide how a photo-type field appears in Research (likely: omit it, or a "Photo" placeholder that is never AI-eligible). Changing what the AI feature can transmit is an owner decision, though this one only narrows it. On Merge conflicts, route photo-type fields to the photo choice (or exclude them, since `merge-photo-rehome.ts` already resolves photo fields) and show text values as text. Add tests for a text value and a stored path in a photo field on both surfaces.
