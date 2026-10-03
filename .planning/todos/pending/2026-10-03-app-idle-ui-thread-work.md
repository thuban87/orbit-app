---
title: App keeps the UI thread busy at rest outside the Orrery
created: 2026-10-03
source: 38.7-08 spike (38.7-SPIKE.md "Surfaced items")
status: pending (owner to decide whether to schedule)
---
With the Orrery not focused (Digest tab, nothing moving), the UI thread uses ~10 % of a core on the release build and ~24 % on debug, and debug logs ~25 Reanimated "Reading from `value` during component render" warnings per second — something animates or re-reads continuously app-wide. Recommendation: a small investigation plan outside 38.7 (it also matters for the D-49 idle-refresh question).
