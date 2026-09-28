---
created: 2026-09-28T12:00:00.000Z
title: Tapping a contact on the home-screen widget does not open their Profile
area: widget
severity: major
files:

  - src/navigation/widget-linking.ts

source: 38.4 owner checklist item 9c, owner 2026-09-28 — deferred to the widget-overhaul phase (not 38.4)
---

## Problem

On the owner's phone (release cf0e949), tapping a contact on the Orbit widget does not take you to that contact's
Profile.

## Solution

Fold into the planned widget-overhaul phase (with RG-001 max-resize/visible refresh and RG-032 widget action names).
