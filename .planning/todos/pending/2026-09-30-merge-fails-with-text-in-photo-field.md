---
created: 2026-09-30T23:00:00.000Z
title: Contact merge fails when the absorbed contact has text in a photo field (IN4-03)
area: merge
severity: minor
files:

  - src/services/photos/merge-photo-rehome.ts
  - src/db/merge-dao.ts

source: 38.6 code review pass 4, IN4-03 (ENGINEERING, deferred), 2026-09-30
---

## Problem

In `merge-photo-rehome.ts` (`selected`, about lines 78-107), any truthy absorbed photo-field value is taken when the survivor's is empty, including text such as "Rex". It is added to `paths`, `withCanonicalPathLocks` runs `assertSafeRelative` on it and throws before any work, so the whole contact merge is rejected. Reachable today with a Text→Photo type change and no restore. D-31/D-34 keep such values usable elsewhere, so this is the remaining user action they break.

## Solution

Filter `selected` with `isStoredPhotoPath(other.value)`. Let the text travel through `merge-dao.ts`'s ordinary custom-value transfer, and check its `isPhoto && !own && !transfer` delete (`merge-dao.ts` around 418-423) so the text is not dropped. Pin it with a merge test that has text in the absorbed photo field (see `38.6-REVIEW.md` IN4-03).
