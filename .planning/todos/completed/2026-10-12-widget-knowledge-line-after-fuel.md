---
created: 2026-10-12T00:00:00.000Z
title: Widget large tile has no knowledge line after fuel retirement — decide a replacement
area: widget
severity: minor
files:

  - src/services/widget/widget-data.ts
  - src/services/widget/widget-render.tsx

source: 38.10 dossier Q-12, owner 2026-10-12 — "Nothing for now, if there's a todo or roadmap entry for the widget overhaul though … please add this so we know to include it." Target: the widget-overhaul phase (not yet on the roadmap).
---

## Problem

Phase 38.10 retires `fuel`. The widget's large tile showed one ranked fuel line per contact (owner decision, 03-fuel dossier :361, "against the orchestrator's recommendation"; ADR-043). 38.10 removes it with no replacement (38.10 D-59).

## For the widget-overhaul phase

Decide whether the large tile shows a knowledge line again, and from what: latest Last Talked About, newest Thought of Them / Gift Ideas, or nothing. Off Limits must never appear on the widget (38.10 D-10). Ordering by pin was rejected in 03-fuel :250 / ADR-029 :23. File paths verified 2026-10-12.

## Moved to backlog 999.7 (backlog cleanup, owner-approved 2026-10-16)

Not done. Merged into ROADMAP Backlog "Phase 999.7: Widget overhaul", which now carries this item.
