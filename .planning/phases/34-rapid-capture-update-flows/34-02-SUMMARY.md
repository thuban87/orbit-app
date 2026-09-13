---
phase: 34-rapid-capture-update-flows
plan: 02
subsystem: database
tags: [memory-registry, interaction-vocabulary, sqlite, capt-15, d-11, tone, ai-context, digest]

# Dependency graph
requires:
  - phase: 32
    provides: "migration 025 (quality->Tone, 6-value channel->Message/Call/In Person) + all literal consumers"
provides:
  - "MEMORY_TYPE_REGISTRY.general.displayName = \"Memory\", custom.displayName = \"Custom\" (D-11, no label collision)"
  - "CAPT-15 verified satisfied-by-dependency: no legacy-vocabulary straggler, consumers compare migrated literals, no second migration"
  - "scripts/audit-interaction-vocabulary.sh — reusable allowlist-scoped straggler gate"
  - "interaction-vocabulary.test.ts CAPT-15 round-trip regression (quality+channel, NULL preserved)"
affects: [34-06, 34-07, memory-capture, memory-editor, rapid-capture]

# Actuals (#2632)
actuals:
  tokens: 2000
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist-scoped scripted straggler audit: fails only on a NEW unlisted legacy-value site, comment/test filtered"
    - "Behavioral round-trip regression asserts vocabulary integrity by code, not only by scan"

key-files:
  created:
    - scripts/audit-interaction-vocabulary.sh
  modified:
    - src/db/memory-registry.ts
    - src/db/memory-registry.test.ts
    - src/db/interaction-vocabulary.test.ts
    - src/db/ai-context-read.test.ts

key-decisions:
  - "D-11 executed via direct displayName values; retired the now-misleading PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME (only used in-file); kept PROVISIONAL_MEMORY_LABEL as the still-accurate Memory fallback noun (used by 3 UI components), keeping the change within the plan's declared file scope."
  - "CAPT-15 consumer regressions the plan anticipated adding ALREADY exist in ai-context-read.test.ts and digest-read.test.ts (dedicated 'migrated-vocabulary regression (D-06 trip-wire)' blocks shipped in Phase 32) — not bloated with redundant assertions."
  - "No second interactions migration authored (D-07 STOP-AND-ASK honored)."

patterns-established:
  - "Straggler audit gate: scripts/audit-interaction-vocabulary.sh scopes by CLAUDE.md's DAO-only invariant (all interactions writers/readers live in src/db + src/backup) and an explicit file allowlist."

requirements-completed: [CAPT-15]

coverage:
  - id: D1
    description: "Memory-type display names swapped to \"Memory\"/\"Custom\" with no duplicate built-in label (D-11)"
    requirement: ""
    verification:
      - kind: unit
        ref: "src/db/memory-registry.test.ts#resolves the D-11 owner-final Memory-type display names without collision"
        status: pass
    human_judgment: false
  - id: D2
    description: "CAPT-15 legacy-vocabulary integrity: round-trip mapping + straggler audit + consumer regressions green, no new migration"
    requirement: "CAPT-15"
    verification:
      - kind: unit
        ref: "src/db/interaction-vocabulary.test.ts#CAPT-15 legacy-vocabulary round-trip integrity"
        status: pass
      - kind: unit
        ref: "src/db/ai-context-read.test.ts#counts Positive/Neutral/Negative over a jump-from-legacy-migrated fixture (no silent zero)"
        status: pass
      - kind: unit
        ref: "src/db/digest-read.test.ts#tallies the effortful line over a legacy-then-migrated fixture (no silent zero)"
        status: pass
      - kind: automated
        ref: "bash scripts/audit-interaction-vocabulary.sh (exit 0: no unlisted straggler)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-09-12
status: complete
---

# Phase 34 Plan 02: Memory-label reconciliation + CAPT-15 vocabulary verification Summary

**D-11 Memory-type display-name swap (general→"Memory", custom→"Custom", no collision) plus a code-asserted CAPT-15 proof — allowlist-scoped straggler audit + legacy-value round-trip regression — confirming the interaction vocabulary migration shipped by Phase 32 left no straggler and needs no second migration.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-13T01:19:55Z
- **Completed:** 2026-09-13T01:28Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `MEMORY_TYPE_REGISTRY.general.displayName` "General"→"Memory" and `custom.displayName` "Memory"→"Custom" (D-11, owner-resolved 2026-09-12), with a no-duplicate-built-in-label assertion (T-34-05). `DEFAULT_MEMORY_TYPE_KEY` stays `"general"` — capture still requests the type by key, never by label.
- CAPT-15 proven satisfied-by-dependency: a committed allowlist-scoped straggler audit returns zero unlisted legacy-vocabulary sites in interactions writers/readers, and a round-trip regression asserts good/fine/hard→Positive/Neutral/Negative, text/email→Message, other/unspecified pass-through, and NULL quality preserved (never coerced to Neutral).
- Verified (by reading every writer of the `interactions` table, per CLAUDE.md) that no interactions writer/reader emits or compares a legacy literal outside `interaction-vocabulary.ts` + the migration files; the reach-out `call|text|email` transport vocabulary is remapped via `remapLegacyChannel` before any persistence.
- No second interactions migration authored (D-07 STOP-AND-ASK trip-wire honored).

## Task Commits

1. **Task 1 (tracer, TDD RED): failing D-11 registry assertions** - `2486b7b` (test)
2. **Task 1 (tracer, TDD GREEN): swap display names to "Memory"/"Custom"** - `15abb72` (feat)
3. **Task 2: CAPT-15 straggler audit + round-trip regression + D-11 label propagation** - `8d0efbc` (test)

**Plan metadata:** _(docs commit — this SUMMARY + STATE/ROADMAP)_

## Files Created/Modified
- `scripts/audit-interaction-vocabulary.sh` (created) - Allowlist-scoped legacy-vocabulary straggler gate; fails only on a NEW unlisted quality/channel literal in an interactions writer/reader.
- `src/db/memory-registry.ts` - general→"Memory", custom→"Custom"; retired PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME; kept PROVISIONAL_MEMORY_LABEL as the Memory fallback noun.
- `src/db/memory-registry.test.ts` - Added D-11 display-name + no-duplicate-label assertions.
- `src/db/interaction-vocabulary.test.ts` - Added CAPT-15 round-trip integrity regression.
- `src/db/ai-context-read.test.ts` - Updated general-Memory egress label "General"→"Memory" (D-11 propagation).

## CAPT-15 straggler audit (recorded per acceptance criteria)

Command: `bash scripts/audit-interaction-vocabulary.sh`
Result: `OK: no unlisted legacy interaction-vocabulary straggler (CAPT-15).` (exit 0)

The audit runs two checks:
- **Quality (high signal):** grep for quoted `good|fine|hard` across all of `src`, allowlisting only `src/db/interaction-vocabulary.ts` + `src/db/migrations/`. Zero hits elsewhere.
- **Channel (data-layer scoped):** grep for quoted `text|email` across `src/db` + `src/backup` (where every interactions writer/reader lives per CLAUDE.md's DAO-only invariant), allowlisting the remap source, migrations, the assist-transport DAO/read files, and the contact-method/search/merge/reconcile/backup files where `email` is a contact-method type. Zero unlisted hits.

`ls src/db/migrations/ | grep -E "interaction"` shows only the pre-existing `014-interaction-assists.ts` and `025-interaction-history-schema.ts` — no new interactions migration authored.

## Decisions Made
- **D-11 implementation form:** set the two `displayName` values directly rather than repointing provisional constants; retired `PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME` (referenced only inside `memory-registry.ts`) since its "General" value is now misleading, and kept `PROVISIONAL_MEMORY_LABEL = "Memory"` because it is the still-accurate fallback noun consumed by `ThingsToRememberScreen`, `MemoryEditor`, and `MemoryCard` — renaming it would have pulled 3 UI files outside the plan's declared file scope. Planner's discretion per D-11.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale AI-egress label assertion broken by the D-11 swap**
- **Found during:** Task 2 (running the consumer test suite)
- **Issue:** `src/db/ai-context-read.test.ts` asserted the general Memory egresses with `label: "General"`. The egress label is sourced from `MEMORY_TYPE_REGISTRY.general.displayName`, which Task 1 changed to "Memory" (the plan's own key_link: "the swap changes the label everywhere").
- **Fix:** Updated the expectation to `label: "Memory"` — the correct post-D-11 value.
- **Files modified:** src/db/ai-context-read.test.ts
- **Verification:** `npx vitest run src/db/ai-context-read.test.ts` passes.
- **Committed in:** `8d0efbc`

### Plan expectation already satisfied (documented, no edit)

**2. Consumer regressions the plan asked to add already exist (Phase 32 / D-07).**
- The plan's Task 2 action said "Extend `ai-context-read.test.ts` and `digest-read.test.ts` to confirm the consumers compare migrated Tone literals." On reading the actual code (CLAUDE.md "review the code, not the diff"), both files already contain dedicated `migrated-vocabulary regression (D-06 trip-wire)` blocks (jump-from-legacy fixtures proving no silent zero) shipped in Phase 32. Adding redundant assertions would be noise, so they were left as-is and verified green. This matches the plan's framing that CAPT-15 is "satisfied-by-dependency" and this plan "VERIFIES."

---

**Total deviations:** 1 auto-fixed (Rule 1 bug) + 1 documented no-op.
**Impact on plan:** Auto-fix was a direct, necessary consequence of the D-11 swap. No scope creep; no second migration; no reversal of any ADR/HANDOFF decision.

## Issues Encountered
- **Pre-existing, out-of-scope suite load failure:** `npx vitest run` reports `SyntaxError: Unexpected token 'typeof'` while transforming `src/components/orrery/orrery-controls-render.test.tsx` (a generic call-type-argument on line 13). The file is unmodified by this plan (last touched in commit `5d38954`, Phase 29-11) and unrelated to the data-layer files here. All 3160 individual tests pass; only this one suite fails to load. Logged to `deferred-items.md`; not fixed (SCOPE BOUNDARY).

## Verification
- `npx vitest run src/db/memory-registry.test.ts` → 3 passed.
- `npx vitest run src/db/ai-context-read.test.ts src/db/digest-read.test.ts src/db/interaction-vocabulary.test.ts` → 40 passed.
- Full `npx vitest run` → 3160 tests passed (1 unrelated pre-existing suite fails to load — see Issues).
- `npm run check:colors` → clean.
- `bash scripts/audit-interaction-vocabulary.sh` → exit 0.

## Threat Model Outcome
- **T-34-05 (duplicate/ambiguous Memory label):** mitigated — no-duplicate-displayName assertion added and green.
- **T-34-06 (straggler legacy Tone literal in ai-context-read):** mitigated — audit clean + consumer jump-from-legacy regression green.
- **T-34-07 (accidental second interactions migration):** mitigated — no new interactions migration; asserted by acceptance criterion.
- No new security-relevant surface introduced (no network, no new endpoints, no schema change).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Memory-facing capture flows (34-06, 34-07) unblocked: labels read "Memory"/"Custom" with no collision, requested by key.
- CAPT-15 closed with a code-asserted proof and a reusable audit gate.
- No blockers.

## Self-Check: PASSED

All created/modified files present on disk; all task commits (`2486b7b`, `15abb72`, `8d0efbc`) present in git history.

---
*Phase: 34-rapid-capture-update-flows*
*Completed: 2026-09-12*
