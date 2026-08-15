# Phase 05-photos — Deferred / Out-of-Scope Items

Discoveries logged during plan execution that fall outside the executing plan's
scope (per the executor scope-boundary rule). NOT fixed by the discovering plan.

## Discovered during 05-04 execution

- **Tree-wide `npm run check:colors` is RED (pre-existing, from 05-03).**
  - File: `src/components/avatar-initials.test.ts:8`
  - Cause: a module-doc comment mentions the barred legacy `hsl(hash % 360, …)`
    string to explain why the module emits an index only. The `check:colors`
    grep matches the literal `hsl(` inside that prose comment.
  - Introduced by commit `114fb56` (`feat(05-03): Avatar component …`, PHOTO-04),
    verified present at `b484d78~1` (before any 05-04 commit).
  - Out of scope for 05-04: 05-04 touches only `crop-geometry.ts(.test.ts)` and
    `photo-pipeline.ts`, all three of which pass `check:colors` individually.
  - Suggested owner: whoever revisits 05-03 / the `check:colors` gate — either
    reword the comment to avoid the literal `hsl(` token or refine the gate to
    ignore comments. Not a runtime colour leak (it is test-file prose).
  - **RESOLVED (orchestrator, during Wave 3):** reworded the comment to drop the
    literal `hsl(` token; `npm run check:colors` is green tree-wide (exit 0).
    Committed separately as `fix(05-03): reword hsl() doc comment …`.
