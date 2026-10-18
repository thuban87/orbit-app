---
created: 2026-10-16
source: 38.11-DEVICE-PASS.md finding F-07 (38.11-14 device pass) — routed to 38.12 by the orchestrator (planner call), 2026-10-16
area: profile
target_phase: 38.12
resolves_phase: 38.12
files:
  - src/components/profile/ProfileTemplateManager.tsx
---
Layout templates: after "Save template" the template is saved, but the page stays on an empty "Create layout template" form instead of returning to the template list. Later adb taps would not focus the name field (may be an adb artefact; re-check with a finger first). The form dates from 2026-09-09, so this is pre-existing, not a 38.11 regression.

For 38.12: re-check by hand, then make Save return to the list (or show the saved template) with the 38.9 feedback. File path verified 2026-10-16.
