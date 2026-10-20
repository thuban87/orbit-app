---
created: 2026-10-16
source: 38.11-DEVICE-PASS.md finding F-11 (38.11-14 device pass) — routed to 38.13 by the orchestrator (planner call), 2026-10-16
area: contacts
target_phase: 38.13
resolves_phase: 38.13
files:
  - src/db/dashboard-read.ts
---
Contacts → All Contacts search could not find some Unbound people with no frequency on the Pixel 3a test data (e.g. "Xuzebo Ratoli", contact id 7, opened instead by `orbit://contact/7`). Not investigated in 38.11 (Contacts search is 38.13's scope).

For 38.13: check whether the search scope (`searchScope` in `src/db/dashboard-read.ts` and the population filter it combines with) drops Unbound / no-interval rows, and whether that is intended for "All Contacts". File path verified 2026-10-16; the cause is not confirmed.
