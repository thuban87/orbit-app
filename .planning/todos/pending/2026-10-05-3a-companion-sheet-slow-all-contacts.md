---
created: 2026-10-05T07:00:00.000Z
title: Pixel 3a — "Contacts in this System" sheet slow to open at All Contacts
area: orrery
severity: minor
files:

  - src/components/orrery/ (Contacts in this System sheet / companion list)

source: 38.7 Plan 16 Pixel 3a release smoke (38.7-DEVICE-PASS.md); owner ruling 3A-1 (2026-10-05)
---

## Problem

On the Pixel 3a release build, at All Contacts (~1,000 contacts), the "Contacts in this System" sheet did not
open within 6 s after its button was tapped. No ANR and no crash. The 3a was smoke-only in 38.7 (D-66), so this
was not investigated.

## Solution

When the 3a is next in scope, time the sheet open at All Contacts and check the list's first render (row count,
virtualization, photo work on open).
