---
phase: 01-project-scaffold-portable-code
plan: 02
subsystem: core-logic
tags: [typescript, port, pure-logic, types, schemas, vitest, tdd, biome, obsidian-decoupling]

# Dependency graph
requires:
  - "01-01: @/* alias, biome.json (logger.ts + *.test.ts overrides), vitest runner, src/ folder skeleton"
provides:
  - "calculateStatus + calculateDaysSince + calculateDaysUntilDue + parseDate + isValidFrequency (src/types.ts)"
  - "Frequency/FREQUENCY_DAYS/OrbitStatus/SocialBattery/LastInteractionType + OrbitContact DTO (Obsidian-free) (src/types.ts)"
  - "formatLocalDate — local-timezone YYYY-MM-DD, no UTC off-by-one (src/utils/dates.ts)"
  - "Static gated Logger (off/warn/error/debug), unknown[] rest args (src/utils/logger.ts)"
  - "FieldType/FieldDef/SchemaDef + isFieldDef/isSchemaDef guards (src/schemas/types.ts)"
  - "newPersonSchema + editPersonSchema built-in schemas (src/schemas/*.schema.ts)"
  - "Ported Vitest suites proving behaviour survived the port (42 tests)"
affects: [01-04, 02, 03, dashboard, orrery, digest, ai-suggestions, every-later-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Obsidian decoupling: TFile import + OrbitContact.file field deleted, no vault abstraction substituted"
    - "Semantic-verbatim port: behaviour + comments preserved, Biome format + safe autofixes accepted"
    - "In-bounds hand edits: isNaN -> Number.isNaN, parseInt(x) -> parseInt(x,10), any[] -> unknown[]"
    - "TDD RED (ported test) -> GREEN (ported impl) gate sequence"

key-files:
  created:
    - src/types.ts
    - src/types.test.ts
    - src/utils/dates.ts
    - src/utils/dates.test.ts
    - src/utils/logger.ts
    - src/schemas/types.ts
    - src/schemas/new-person.schema.ts
    - src/schemas/edit-person.schema.ts
  modified: []

key-decisions:
  - "Stripped Obsidian coupling with exactly two deletions (TFile import, OrbitContact.file field); no replacement import — SQLite identity arrives Phase 2"
  - "Applied isNaN->Number.isNaN and parseInt radix by hand (Biome classifies them unsafe; semantics-safe here because args are Date.getTime() numbers / base-10 date ints)"
  - "Kept the local-timezone comment in dates.ts that names the banned toISOString one-liner — it documents WHY, and appears in no executable line"
  - "Labelled SchemaDef.output.path and OrbitContact precomputed status/daysSinceContact/daysUntilDue as legacy-compat-only; Phase 3 / Phase 2 must replace, not inherit"

requirements-completed: [FND-02, FND-03]

# Metrics
duration: 3min
completed: 2026-08-14
status: complete
---

# Phase 1 Plan 02: Portable Pure-Logic & Type Layer Summary

**Ported the ~350-line pure-logic/type/schema layer from the Obsidian plugin into `src/`, severed the single Obsidian coupling in `types.ts`, and proved behaviour survived the port with the plugin's own Vitest suites (42 tests) — tsc, `biome check .`, and `vitest run` all green.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-08-14T17:55:01Z
- **Tasks:** 3
- **Files created:** 8

## Accomplishments
- **Task 1 (RED):** Ported `test/unit/types.test.ts` -> `src/types.test.ts` and `test/unit/utils/dates.test.ts` -> `src/utils/dates.test.ts`, rewiring imports to the `@/` alias. Every assertion and the `daysAgo` helper preserved verbatim. `vitest run` failed with module-not-found (RED) — confirming the tests exercise the ported code, not stubs.
- **Task 2 (GREEN):** Ported `types.ts` Obsidian-free (two deletions: `import { TFile } from "obsidian"` and the `OrbitContact.file` field + its doc-comment), plus `dates.ts` (comment-preserving) and `logger.ts` (`any[]`->`unknown[]`). The Task 1 suites went GREEN — 42 tests pass.
- **Task 3:** Ported `schemas/types.ts` + both built-in `*.schema.ts` data objects verbatim (zero Obsidian). Ran the full phase gate: `tsc --noEmit && biome check . && vitest run` all exit 0.
- Confirmed the plan's Obsidian-free guarantee: `! grep -rIl obsidian src/types.ts src/utils src/schemas` is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Port pure-logic Vitest suites (RED)** — `6d50882` (test)
2. **Task 2: Port types.ts (Obsidian-free), dates.ts, logger.ts (GREEN)** — `20ec306` (feat)
3. **Task 3: Port built-in schemas + shared types verbatim** — `3ebfddd` (feat)

## Files Created
- `src/types.ts` — Frequency/FREQUENCY_DAYS/OrbitStatus/SocialBattery/LastInteractionType + OrbitContact (Obsidian-free) + calculateStatus/calculateDaysSince/calculateDaysUntilDue/parseDate/isValidFrequency
- `src/types.test.ts` — Ported suite (calculateStatus + 4 helpers), `@/types` import
- `src/utils/dates.ts` — formatLocalDate + the explanatory local-timezone comment
- `src/utils/dates.test.ts` — Ported formatLocalDate suite (incl. 23:30-local and leap-year cases), `@/utils/dates` import
- `src/utils/logger.ts` — Static gated Logger (default `off`), `unknown[]` rest args
- `src/schemas/types.ts` — FieldType/FieldDef/SchemaDef + isFieldDef/isSchemaDef guards
- `src/schemas/new-person.schema.ts` — `newPersonSchema` data object
- `src/schemas/edit-person.schema.ts` — `editPersonSchema` data object

## Decisions Made
- **Two-deletion Obsidian strip.** Removed only line 1 (`import { TFile }`) and the `OrbitContact.file` field+comment; invented no vault abstraction and added no replacement import. Nothing in the ported set reads that field — SQLite identity arrives in Phase 2.
- **Applied the two unsafe Biome edits by hand.** `biome check --write` does not apply `noGlobalIsNan` (`isNaN`->`Number.isNaN`) or `useParseIntRadix` (`parseInt(x)`->`parseInt(x, 10)`) because it classifies them coercion-unsafe. Both are semantics-safe here (every `isNaN` arg is a `Date.getTime()` number; the date parsers are base-10), so I wrote them into the source before running `--write`. `biome check` on all three files then exits 0 with no `--unsafe` needed.
- **Kept the banned-one-liner comment in dates.ts.** The header/inline comments legitimately name `toISOString().split('T')[0]` to document why local-timezone formatting exists (CLAUDE.md dates rule). The acceptance criterion bans it in *executable* code only — verified: comment-stripped grep finds zero live occurrences, while the comment is retained.
- **Preserved the static `Logger` class shape.** Left `noStaticOnlyClass`/`noThisInStatic` disabled (01-01 override) rather than letting an autofix refactor `Logger` into free functions — 01-04 call sites use `Logger.warn/error/debug`.

## Deviations from Plan

None — plan executed exactly as written. All in-bounds edits (two `types.ts` deletions, `isNaN`/`parseInt`/`any[]` fixes, Biome formatting) were explicitly enumerated by the plan; no bug-fix, missing-functionality, or architectural deviation was required.

## Legacy-Compat Carryover (labelled, not inherited)
Per the plan's `<legacy_compat>` block — ported now because they are pure types/data with zero compile risk, but later phases must **replace**, not extend:
- **`SchemaDef.output.path`** (`src/schemas/types.ts`) encodes Obsidian file-creation paths, meaningless on mobile (HANDOFF §14). **Phase 3** must drop/replace it.
- **`OrbitContact` precomputed `status` / `daysSinceContact` / `daysUntilDue`** (`src/types.ts`) are a plugin-era DTO shape. **Phase 2's data layer is derived-never-stored** — these are fine as a transient in-memory DTO but must NOT become SQLite row columns.

## Known Stubs
None. All ported symbols are complete, behaviour-covered implementations — no placeholders, empty returns, or unwired data sources. The two legacy-compat shapes above are fully-typed carryover, labelled for replacement, not stubs.

## TDD Gate Compliance
RED (`6d50882`, `test`) precedes GREEN (`20ec306`, `feat`) in git history; no REFACTOR commit was needed (the ports were clean on first pass). Gate sequence satisfied.

## Threat Flags
None. The plan's threat register (T-1-02a) records only the latent Logger information-disclosure concern, mitigated by its default-`off` gate; no new trust boundary, network read path, or secret is introduced. No security-relevant surface beyond the register was added.

## Verification Evidence
- `npx tsc --noEmit` — exit 0
- `npx biome check .` — exit 0 (the pre-existing biome.json `recommended` deprecation *info* from 01-01 is non-blocking; check exits 0)
- `npx vitest run` — 2 files, 42 tests pass
- `! grep -rIl obsidian src/types.ts src/utils src/schemas` — clean (no Obsidian refs)
- `grep -ic obsidian src/types.ts` == 0; `grep -c 'any\[\]' src/utils/logger.ts` == 0

## Next Phase Readiness
- The portable logic/type/schema layer is landed, lint-clean, typechecked, and test-covered — ready for 01-04 (AiService port, which calls `Logger.*`) and later phases (02 data layer, 03 custom fields, dashboard/orrery/digest).
- No blockers introduced. Standing project blockers unchanged (droid build bring-up in 01-05; graphify ADR-bridge still deferred).

## Self-Check: PASSED

All 8 created files verified present on disk; all three task commits (`6d50882`, `20ec306`, `3ebfddd`) verified in git history.

---
*Phase: 01-project-scaffold-portable-code*
*Completed: 2026-08-14*
