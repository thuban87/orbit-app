# Phase 31 Deferred Items

- **Pre-existing regression:** `src/db/orrery-preferences.test.ts:32` hard-codes `TARGET_VERSION === 22`; it already failed against the Phase 30 live registry at version 23 before Phase 31 and now reports 24. Ownership remains with the Phase 30 migration/preferences follow-up.
- **Pre-existing tooling drift:** `npm run check` is named by the phase plans but `package.json` has no `check` script. Phase 31-01 ran `npx tsc --noEmit`, targeted Biome, and `npm run check:colors` as the available direct checks.
