---
phase: 10-share-sheet-capture
plan: 02
subsystem: capture
tags: [share-intent, pure-logic, vitest, payload-parsing, note-composition]

# Dependency graph
requires:
  - phase: 07-fuel
    provides: "fuel-read RANKED_FUEL_EXCLUSIONS blank-boundary TRIM set (the display-text null rule this resolver must satisfy)"
provides:
  - "resolveCapturePayload() — pure share-payload → { displayText, url } resolver (the 4-row payload table + `note — base` composition)"
  - "CaptureInput / CapturePayload types"
affects: [10-03, share-write, capture-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure `-logic.ts` resolver idiom (mirrors compose-logic): one exported interface + one pure fn, no react-native/expo/I/O, fully node-tested off-device"

key-files:
  created:
    - src/logic/capture-logic.ts
    - src/logic/capture-logic.test.ts
  modified: []

key-decisions:
  - "Consolidated Task 1 (payload mapping) + Task 2 (note composition) into a single cohesive resolver function, mirroring compose-logic's compact one-fn shape rather than shipping a half-resolver at the Task-1 boundary."
  - "url = webUrl ?? null in EVERY branch — canonical first-http match, never derived from title/prose/note (F-CAP-6/F-CAP-15)."
  - "base = first non-blank of title then text — so bare-URL-no-title falls back to the URL as its own label, and a note over a plain-text/bare-URL share keeps the prose/URL as the base (A5: base is never discarded)."
  - "Blank-boundary TRIM built via String.fromCharCode(9,10,11,12,13,32,160) — mirrors fuel-read's RANKED_FUEL_EXCLUSIONS charset with no invisible literal in source."

patterns-established:
  - "Note composition: `note — base` (note leads, em-dash separator, base always appended); note-only (no base present) → note alone; whitespace-only note treated as absent."

requirements-completed: [CAP-02, CAP-03]

coverage:
  - id: D1
    description: "resolveCapturePayload maps all 4 share shapes (bare-URL+title, bare-URL-no-title, plain text, prose-with-URL) to { displayText, url }; url = webUrl ?? null; blank/extended-whitespace text → null."
    requirement: "CAP-03"
    verification:
      - kind: unit
        ref: "src/logic/capture-logic.test.ts#CAP-03 payload → { displayText, url } (Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Note composition `note — base` across all 4 payload types × {note, no-note}; base never discarded (incl. A5 note+plain-text and note+bare-URL); note-only → note alone; whitespace note ignored; url never touched."
    requirement: "CAP-03"
    verification:
      - kind: unit
        ref: "src/logic/capture-logic.test.ts#CAP-03 note composition `note — base` (Task 2, A5)"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-08-16
status: complete
---

# Phase 10 Plan 02: Share-Capture Payload Resolver Summary

**Pure, node-tested `resolveCapturePayload()` maps every Android share shape to a fuel row's `{ displayText, url }` and recomposes the display text as `note — base` when the user adds a note — url stays canonical and the base is never discarded.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-16T09:14Z
- **Completed:** 2026-08-16T09:19Z
- **Tasks:** 2 completed
- **Files modified:** 2 created

## Accomplishments
- `resolveCapturePayload()` resolves the RESEARCH §Q6 4-row payload table: bare-URL+title → title; bare-URL-no-title → the bare URL (fallback); plain text → the text; prose-with-URL → the whole prose. `url = webUrl ?? null` in every case (canonical first-http match, never title/prose/note-derived).
- Note composition (A5): `note — base` with the note leading and the base (title │ prose │ bare URL) ALWAYS appended and NEVER discarded. Explicitly covers the two cases the review flagged as missing — note+plain-text and note+bare-URL. note-only (no base present) → note alone; whitespace-only note treated as absent; `url` untouched in every branch.
- Blank-boundary enforcement: display text normalized with a TRIM over the same whitespace set fuel-read's `RANKED_FUEL_EXCLUSIONS` uses (tab, LF, VT, FF, CR, space, NBSP) → empty → `null`, so a blank share row can't slip past and be dropped in-query downstream.
- 20 node tests green; full suite 695/695 green; tsc clean; check:colors clean.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing payload-resolver test** - `08a8342` (test)
2. **Task 1 (GREEN): resolveCapturePayload + 4-row mapping** - `c19fcc6` (feat)
3. **Task 2 (RED): note-composition test incl. A5 cases** - `90f2c18` (test)
4. **Task 2 (GREEN): note composition `note — base`** - `ec9dee2` (feat)

## Files Created/Modified
- `src/logic/capture-logic.ts` (107 lines) - Pure resolver: `CaptureInput`/`CapturePayload` types + `resolveCapturePayload()`. No react-native/expo/I/O imports.
- `src/logic/capture-logic.test.ts` (209 lines) - 20 Vitest cases covering every payload row + every note-composition edge case (including embedded ` — `, whitespace notes, and the A5 misses).

## Decisions Made
- **Consolidated the two tasks into one resolver function.** The plan splits payload mapping (Task 1) and note composition (Task 2), but the compose-logic idiom this plan mirrors is a single compact pure fn. Shipping a note-less half-resolver at the Task-1 commit would have been a throwaway intermediate. Task 1's GREEN commit therefore already contained the full resolver; Task 2's commits add the A5 test coverage (RED) and the biome-formatted note branch (GREEN). Gate sequence (test → feat, per task) is preserved in git history.
- **`String.fromCharCode(...)` for the boundary whitespace set** rather than a string literal — an earlier literal-NBSP attempt embedded an invisible character in source; the char-code form is fully ASCII and self-documenting.

## Deviations from Plan

### Structural consolidation (not a deviation rule — a task-ordering choice)

**1. Task 1 + Task 2 implementation consolidated into one resolver**
- **Found during:** Task 1
- **Rationale:** The mirrored `compose-logic` idiom is a single pure fn; a note-less intermediate resolver would be discarded work. The note branch is two lines of the same function.
- **Effect:** Task 2's note-composition tests passed immediately against the Task-1 impl. Per the fail-fast rule this is the "feature already exists" case — here intentionally, because the resolver is one cohesive unit. Task 2 still contributes a `test(...)` commit (A5 coverage) and a `feat(...)` commit (biome-formatted note branch), so the per-task RED→GREEN gate sequence holds in history.
- **Files modified:** src/logic/capture-logic.ts, src/logic/capture-logic.test.ts

---

**Total deviations:** 0 auto-fixed (Rules 1–4). One task-ordering consolidation, documented above.
**Impact on plan:** None. All acceptance criteria met; url-canonical, base-never-discarded, and blank→null invariants all node-proven.

## Issues Encountered
- Authoring the boundary-whitespace string literal repeatedly embedded an invisible NBSP/control char in source (Edit/Write round-tripping). Resolved by building the set from `String.fromCharCode(9,10,11,12,13,32,160)` — ASCII-clean and unambiguous.
- Biome flagged the nested ternary formatting; applied `biome check --write` on the two files and re-verified (tests + tsc + check:colors all green).

## User Setup Required
None — pure logic module, no external services.

## Scope Boundary (deferred to later plans, per plan)
- BLANK→NULL is enforced here; **kind `topic` / source `share` are set by the WRITER (10-03)**, not this resolver — this plan returns only the resolved `{ displayText, url }` shape.
- Multi-attach (apply one composed note to N rows) is the SCREEN's job — this fn is per-row and stateless.
- No react-native/expo/native/device UAT for this plan (pure node-tested logic).

## Self-Check: PASSED
- FOUND: src/logic/capture-logic.ts
- FOUND: src/logic/capture-logic.test.ts
- FOUND commit: 08a8342 (test Task 1 RED)
- FOUND commit: c19fcc6 (feat Task 1 GREEN)
- FOUND commit: 90f2c18 (test Task 2 RED)
- FOUND commit: ec9dee2 (feat Task 2 GREEN)
- Verification: `npx vitest run src/logic/capture-logic.test.ts` → 20/20 pass; full suite 695/695; `npx tsc --noEmit` clean; `npm run check:colors` clean.
