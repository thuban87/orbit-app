---
created: 2026-10-12T00:00:00.000Z
title: Roll the shared text field out app-wide; audit the remaining text inputs
area: ui
severity: minor
files:

target_phase: 40
source: 38.10 dossier draft review, owner 2026-10-12 — "Good to know the sweep I'm talking about is only 25-35 items but agreed it's out of scope for here. Add it to phase 40 I guess. For the remaining 50+ sites we should also look at how to best optimize those similarly. Maybe do an audit of that in phase 40 when we get there."
---

## What

38.10 D-66 builds one shared entry text field (multi-line wrap to ~3 lines then scroll; keyboard Enter = Save/Send; visible Save button kept; when focused, the field sits centered in the screen height left above the keyboard). 38.10 applies it only to Add/Edit Contact's Things to Remember entry fields and the new per-section editors.

## For Phase 40

1. Sweep: convert the free-text entry boxes (notes, descriptions, event text, etc.) to the shared field — roughly 25–35 of the app's 92 raw `TextInput` sites (48 files; count taken 2026-10-12 at `ee5dd2da`, sites not yet classified individually). Rough size ≈ 2 plans.
2. Audit: the remaining ~55–65 sites (search boxes, numbers, emails, API keys, names) — decide how each should behave, at least the keyboard-clearance part, before converting anything.
