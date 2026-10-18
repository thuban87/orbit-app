---
created: 2026-10-16
source: 38.11-DEVICE-PASS.md finding F-03 (38.11-14 device pass) — routed to 38.12 by the orchestrator (planner call), 2026-10-16
area: profile
target_phase: 38.12
resolves_phase: 38.12
files:
  - src/screens/ContactProfileScreen.tsx
---
After a successful Unbind from the Profile ⋯ menu (confirm → Unbind), the ⋯ sheet stays open and shows the new (unbound) menu under it, instead of closing. Seen on the Pixel 3a debug build, 38.11-14 (`untracked/artifacts/38.11/38.11-14/T2-menu-03-unbound-after-unbind.png`).

Routed to 38.12 because Profile Bind/Unbind feedback is 38.12's scope (38.11 CONTEXT out of scope). Check there: Unbind (and Bind) close the sheet and give the 38.9 feedback (snackbar with Undo per 38.9 D-32 where it applies). File path verified 2026-10-16.
