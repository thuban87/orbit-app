---
created: 2026-09-28T12:00:00.000Z
title: Back from Import complete lands on a leftover bulk setup screen ("0 contacts selected")
area: ui
severity: minor
files:

  - src/screens/ImportCompleteScreen.tsx
  - src/screens/BulkImportSetupScreen.tsx

source: 38.4 D-74 fix pass out-of-scope finding 1 (screenshot uat-shots/D74-5); owner chose a todo, 2026-09-28. Predates 38.4.
---

## Problem

After a bulk import finishes, pressing Back on "Import complete" returns to the bulk setup screen, which shows
"0 contacts selected", the Unbound/Bound choice and a disabled "Import 0 contacts" button. Nothing breaks and a second
Back leaves normally, but it is a confusing dead end.

## Solution

Make Import complete's Back leave the whole import flow (as Done already does), or have the setup screen leave on its
own when the session has nothing pending. Keep the D-73/D-74 stopped-import and single-run behaviour intact.
