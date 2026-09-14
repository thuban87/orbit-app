# Deferred Items

- **Pre-existing Phase 30 test failure:** the optional repository-wide `npm test -- --run` check on 2026-09-14 completed with 3,399 passing tests and one failed suite, `src/components/orrery/orrery-controls-render.test.tsx`, which fails during collection with `SyntaxError: Unexpected token 'typeof'`. Phase 36 Plan 03 does not touch the Orrery subsystem; the existing dirty Phase 30 review files and `tsconfig.json` were preserved unchanged. The Phase 36 targeted suites, TypeScript check, and color check all pass.
