---
phase: 04-contact-crud-lifecycle
plan: 07
subsystem: database
tags: [sqlite, contact-links, crud, linking, react-native, edit-form]

# Dependency graph
requires:
  - phase: 04-contact-crud-lifecycle (Plan 05)
    provides: getContactForEdit edit-form assembly + EditContactScreen host
  - phase: 04-contact-crud-lifecycle (Plan 02)
    provides: core/wrapper transaction split + inWriteTransaction composition precedent
provides:
  - contact-links-dao — listLinks, addLink/updateLink/removeLink (cores + wrappers), applyLinkDiff (atomic seeded-vs-current diff)
  - LinksEditor component — repeatable rows, safe scheme-allowlist tap-to-open
  - getContactForEdit now returns the contact's ordered links
  - EditContactScreen hosts LinksEditor, persists via one applyLinkDiff on Save
affects: [profile-display, export-restore, purge, phase-16-merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Child-table CRUD via non-mutexed cores composed by standalone wrappers AND a batched applyLinkDiff, all through the single shared inWriteTransaction"
    - "Editor draft-state + one seeded-vs-current diff on Save (all-or-nothing-on-cancel), matching the metadata edit's a38c763 semantics"
    - "POSITIVE scheme allowlist (/^https?:\\/\\//i) for handing user URLs to Linking.openURL — not a ://-substring test"
    - "Two-transaction save boundary (metadata then links) with explicit partial-save handling"

key-files:
  created:
    - src/db/contact-links-dao.ts
    - src/db/contact-links-dao.test.ts
    - src/components/LinksEditor.tsx
  modified:
    - src/db/contact-read.ts
    - src/db/contact-read.test.ts
    - src/screens/EditContactScreen.tsx
    - src/screens/edit-contact-logic.test.ts

key-decisions:
  - "applyLinkDiff takes a caller-supplied `now` in its params object (the plan's shorthand omitted it) — timestamps are caller-supplied local wall-clock everywhere in the codebase, never toISOString"
  - "normaliseLinkUrl strips only a DOT-FREE leading scheme ([a-z][a-z0-9+-]*) so a schemeless host:port (example.com:8080) is not mis-stripped; real hostile schemes (file/intent/javascript) contain no dot, and the result always begins https:// so the security property holds regardless"
  - "buildLinksForDiff DROPS blank-url draft rows — an added-then-untyped row is ignored, and clearing an existing link's URL DELETEs it via the diff (intuitive remove-by-empty)"
  - "LinksEditor keys rows by the draft `uid` (seeded rows keep theirs; new rows mint newUid() at add) for stable identity across edits"

patterns-established:
  - "Links persistence = ONE model: draft state + applyLinkDiff on Save, never immediate-per-row writes"
  - "Partial-save recovery: metadata-committed + links-failed re-seeds the metadata form, keeps linksDraft for retry, stays on the form, shows explicit partial-save copy (never the generic save-failure copy)"

requirements-completed: [CRUD-04]

coverage:
  - id: D1
    description: "contact_links CRUD DAO — append at MAX(display_order)+1, list ordered, update/remove both-key scoped with assertOneChange"
    requirement: "CRUD-04"
    verification:
      - kind: unit
        ref: "src/db/contact-links-dao.test.ts#addLink appends / listLinks ORDER BY / update+remove both-key scoped"
        status: pass
    human_judgment: false
  - id: D2
    description: "applyLinkDiff applies a seeded-vs-current diff (insert id-less, delete seeded-absent, update changed) in ONE transaction; a mid-diff failure rolls the whole diff back"
    requirement: "CRUD-04"
    verification:
      - kind: unit
        ref: "src/db/contact-links-dao.test.ts#applyLinkDiff — one atomic seeded-vs-current diff (add/update/remove + mid-diff rollback)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getContactForEdit returns the contact's links ORDER BY display_order"
    requirement: "CRUD-04"
    verification:
      - kind: unit
        ref: "src/db/contact-read.test.ts#getContactForEdit — links assembly (ORDER BY display_order)"
        status: pass
    human_judgment: false
  - id: D4
    description: "LinksEditor open handler normalises via the /^https?:\\/\\//i allowlist (file://, intent://, javascript:// stripped + re-prefixed https://); Linking.openURL in try/catch, no canOpenURL"
    requirement: "CRUD-04"
    verification:
      - kind: unit
        ref: "src/components/LinksEditor.tsx#normaliseLinkUrl (exported pure normaliser); tsc + check:colors exit 0"
        status: pass
    human_judgment: true
    rationale: "The actual OS hand-off (tap → browser opens the URL; open-failure Alert) and the on-device add/edit/remove/back-out-without-save flow are UI-observable only — device UAT at the phase gate."
  - id: D5
    description: "EditContactScreen mounts LinksEditor, edits as draft state, persists on Save via one applyLinkDiff with all-or-nothing-on-cancel + two-transaction partial-save handling"
    requirement: "CRUD-04"
    verification:
      - kind: manual_procedural
        ref: "Device UAT: add/edit/remove links, back out (nothing persists), Save (diff applies), tap-to-open"
        status: unknown
    human_judgment: true
    rationale: "Draft-vs-persist behaviour, all-or-nothing-on-cancel, and partial-save recovery are RN screen behaviours the node harness cannot load; verified on the Pixel at the phase gate."

# Metrics
duration: 8min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 07: Contact Links CRUD & Editor Summary

**A `contact_links` child-table DAO (both-key-scoped CRUD + an atomic `applyLinkDiff`) and a repeatable LinksEditor wired into the edit form as draft state, persisted on Save via one diff, with tap-to-open behind a positive `https?://` scheme allowlist.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-15T06:23:13Z
- **Completed:** 2026-08-15T06:30:45Z
- **Tasks:** 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- `contact-links-dao.ts`: `listLinks` (ORDER BY display_order), `addLink`/`updateLink`/`removeLink` wrappers over non-mutexed cores, and `applyLinkDiff` — a whole seeded-vs-current diff (insert id-less, delete seeded-absent, update changed) in ONE `inWriteTransaction`, so a mid-diff failure rolls everything back. Every mutation scoped by (id, contact_id) + `assertOneChange` (WR-04); every value `?`-bound (T-04-02).
- `LinksEditor.tsx`: controlled repeatable rows (URL + optional label + remove ✕ + Open), "+ Add link", "No links yet" empty state. Tap-to-open normalises with a POSITIVE `/^https?:\/\//i` allowlist and `Linking.openURL` in try/catch (no `canOpenURL`) — `file://`/`intent://`/`javascript://` are stripped and re-prefixed `https://`, never handed to the OS as typed (T-04-09).
- `getContactForEdit` now assembles the contact's ordered links; `EditContactScreen` seeds a `linksDraft`, edits it locally, and persists once on Save via `applyLinkDiff` — links share the metadata edit's all-or-nothing-on-cancel semantics (a38c763).
- Two-transaction save boundary with explicit partial-save handling: metadata-committed + links-failed re-seeds the metadata form, keeps the draft for retry, stays on the form, and shows the explicit partial-save copy.

## Task Commits

1. **Task 1 (RED): failing contact-links-dao tests** - `8850089` (test)
2. **Task 1 (GREEN): contact-links-dao implementation** - `689e7d3` (feat)
3. **Task 2: LinksEditor component** - `c32d4b5` (feat)
4. **Task 3: wire links into assembly + edit form** - `31d75f0` (feat)

_TDD Task 1 = RED test commit + GREEN impl commit; no refactor commit was needed._

## Files Created/Modified
- `src/db/contact-links-dao.ts` (created) - child-table CRUD cores/wrappers + atomic `applyLinkDiff` + `listLinks`
- `src/db/contact-links-dao.test.ts` (created) - node:sqlite proof: append order, ordering, both-key scoping, diff add/update/remove, mid-diff rollback (9 cases)
- `src/components/LinksEditor.tsx` (created) - repeatable rows + exported `normaliseLinkUrl` scheme allowlist + safe open handler
- `src/db/contact-read.ts` (modified) - `getContactForEdit` returns ordered `links`; `ContactForEdit.links` added
- `src/db/contact-read.test.ts` (modified) - links-assembly assertions (ordered, empty)
- `src/screens/EditContactScreen.tsx` (modified) - hosts LinksEditor; draft state; Save via `applyLinkDiff`; two-transaction + partial-save handling
- `src/screens/edit-contact-logic.test.ts` (modified) - fixture carries the new `links` field

## Decisions Made
- `applyLinkDiff` takes a caller-supplied `now` in its params object (plan shorthand omitted it) — consistent with the codebase's caller-supplied local-wall-clock convention.
- `normaliseLinkUrl` strips only a DOT-FREE leading scheme so a schemeless `host:port` is not mis-mangled; the result always begins `https://`, so the T-04-09 property holds regardless of edge inputs.
- `buildLinksForDiff` drops blank-url rows: an added-then-untyped row is ignored, and clearing an existing link's URL removes it via the diff.
- Rows keyed by draft `uid` for stable identity across edits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the `ContactForEdit` fixture in `edit-contact-logic.test.ts`**
- **Found during:** Task 3 (wiring links into `getContactForEdit`)
- **Issue:** Adding the required `links` field to `ContactForEdit` broke the `forEdit()` test fixture in `edit-contact-logic.test.ts` (TS2741 — missing property), failing `tsc`.
- **Fix:** Added `links: []` to the fixture's returned object.
- **Files modified:** src/screens/edit-contact-logic.test.ts
- **Verification:** `tsc --noEmit` exit 0; full suite 323/323 green.
- **Committed in:** 31d75f0 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fixture update was a mechanical consequence of the required interface extension. No scope creep.

## Issues Encountered
None — all three verify steps (vitest, tsc, check:colors) passed; biome formatting applied to new files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Links CRUD + editor are complete and unit-proven; ready for the profile-display surface to render tappable links and for purge to delete `contact_links` (already in the Plan's purge fan-out).
- Device UAT (D4/D5) is the outstanding phase-gate check: add/edit/remove in the draft, back out without saving (nothing persists), Save (diff applies), tap-to-open (http/https as typed; other schemes reprefixed https), and the open-failure copy — UI-observable only, per the repo's device-UAT convention.

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*

## Self-Check: PASSED

- Created files verified on disk: `src/db/contact-links-dao.ts`, `src/db/contact-links-dao.test.ts`, `src/components/LinksEditor.tsx`, `04-07-SUMMARY.md`.
- Task commits verified in git log: `8850089`, `689e7d3`, `c32d4b5`, `31d75f0`.
- Verification: full suite 323/323 green; `tsc --noEmit` exit 0; `check:colors` exit 0 on LinksEditor + EditContactScreen; biome clean on all touched files.
