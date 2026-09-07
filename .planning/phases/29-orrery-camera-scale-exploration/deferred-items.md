# Deferred items

- Plan 29-04: `src/db/lifecycle-consumer-ledger.test.ts` has pre-existing Biome formatter drift outside the new cadence-owner row. The baseline `c1e1a3a` reproduces it (`/tmp/orbit-29-04-ledger-baseline-biome.log`). Left unchanged per scope rule; all eleven primary changed implementation/test files pass targeted Biome. The ledger's eleven runtime tests pass. Native display/calibration and FIFO latency remain assigned to Plan 29-12 / Phase 40, tracked in WINDOWS entry 47.
