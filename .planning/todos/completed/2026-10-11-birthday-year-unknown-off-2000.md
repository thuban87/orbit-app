---
created: 2026-10-11
source: 38.9-DEVICE-PASS.md (Plan 17 device pass) — owner routing approved 2026-10-11
area: everyday-screens
target_phase: 38.11
---
Turning "Year unknown" off on a birthday fills the year as 2000 (pre-38.9 behaviour). Owner routed to 38.11, 2026-10-11.

## Resolved 38.11 (D-61, plan 38.11-04)

Add Contact and Edit Contact share one Birthday control (`src/components/BirthdayField.tsx`, logic in `src/components/birthday-field-logic.ts`). Turning Year unknown off with a birthday set opens the date picker on the most recent past occurrence of that day (a stored 29 February opens on the latest leap year); nothing is stored until a date is picked, and cancelling leaves Year unknown on. The picker stops at today. Unit-tested, including a randomized check that no sequence stores a 2000 year the user did not pick. Device check: 38.11-14. The Profile Birthday sheet (38.11-08) reuses the same logic.
