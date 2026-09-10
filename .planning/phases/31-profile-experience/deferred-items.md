# Phase 31 Deferred Items

- **Pre-existing regression:** `src/db/orrery-preferences.test.ts:32` hard-codes `TARGET_VERSION === 22`; it already failed against the Phase 30 live registry at version 23 before Phase 31 and now reports 24. Ownership remains with the Phase 30 migration/preferences follow-up.
- **Pre-existing tooling drift:** `npm run check` is named by the phase plans but `package.json` has no `check` script. Phase 31-01 ran `npx tsc --noEmit`, targeted Biome, and `npm run check:colors` as the available direct checks.
- **Resolved Plan 31-10 blocker:** commit `a1e15e5` restores the ADR-074 consumed-once widget Reach-out contract and shared `ReachOutRouter`, including unconditional clearing for a methodless contact. The focused Profile/background/crop gate passed 31 files / 170 tests plus TypeScript and color checks. Remaining checklist rows are a bounded owner release smoke, not an implementation redo.
