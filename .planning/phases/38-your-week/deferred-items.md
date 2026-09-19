# Deferred Items

- Pre-existing repository-wide test-run failure: `src/components/orrery/orrery-controls-render.test.tsx` cannot load in the Node Vitest environment (`Unexpected token 'typeof'`). Phase 38 Plan 02 does not touch this UI/render subsystem; its targeted suites and compile gates pass.
