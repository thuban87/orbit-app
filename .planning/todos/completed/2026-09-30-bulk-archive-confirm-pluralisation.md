---
created: 2026-09-30T23:00:00.000Z
title: Bulk archive confirm reads "Archive 1 contacts?" for one contact
area: dashboard
severity: cosmetic
files:

  - src/screens/HomeScreen.tsx

source: 38.6 device pass (seen during test-data cleanup), 2026-09-30
---

## Problem

The bulk-action confirm title is built as `` `Archive ${bulkConfirm.ids.length} contacts?` `` (`src/screens/HomeScreen.tsx:2250`), so selecting one contact reads "Archive 1 contacts?". The quick-log variant beside it (`Log ${n} interactions?`) has the same shape. Pre-existing, not a 38.6 change.

## Solution

Singular/plural copy for both titles ("Archive 1 contact?" / "Archive N contacts?"; "Log 1 interaction?"), with a render test for n = 1 and n = 2.

## Resolved (backlog cleanup, owner-approved 2026-10-16)

Both bulk titles are pluralised: `HomeScreen.tsx:2336` (`Log ${plural(…, "interaction")}?`) and `:2338` (`bulkBinConfirmation(n).title`). Flagged as already fixed in 38.11-14-SUMMARY and 38.11-VERIFICATION. Checked on `main @ ad0b0162`.
