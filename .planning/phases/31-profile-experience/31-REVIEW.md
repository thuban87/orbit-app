---
phase: 31-profile-experience
reviewed: 2026-09-10T10:51:01Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/components/ContactPicker.tsx
  - src/components/profile/ProfileLayoutEditor.tsx
  - src/components/profile/ProfileTemplateManager.tsx
  - src/components/profile/ProfileBackgroundManager.tsx
  - src/components/profile/profile-layout-editor.contract.test.ts
  - src/components/profile/profile-template-manager.contract.test.ts
  - src/components/profile/profile-background-manager.contract.test.ts
  - src/screens/ContactProfileScreen.tsx
  - src/db/picker-read.ts
  - src/db/profile-presentation-dao.test.ts
  - src/profile/resolve-presentation.test.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-09-10T10:51:01Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the bounded Plans 31-14/15 changes at deep depth. In addition to the submitted files, traced the Profile screen, editor/reducer/session, managers/models, presentation reader/resolver/DAO, migration, profile snapshot reader, picker ordering, and photo storage/crop paths. I manually enumerated every writer of the four presentation tables; they are confined to `src/db/profile-presentation-dao.ts` and the schema migration. The direct-drag parent validation, picker archive exclusion, contact-only assignment, resolver precedence, local-only read path, and nullable background fallthrough work as intended.

Graph findings were used only as hints: `picker-read.ts` has an **EXTRACTED** ADR-075 citation and an **INFERRED** ADR-082 link; `ContactPicker.tsx` has an **INFERRED** ADR-082 link. The Profile screen's graph links are also **INFERRED**. Their governing behavior was verified against the actual code and ADR-082, not assumed from graph output.

Focused tests passed (55 tests), along with `npx tsc --noEmit` and `npm run check:colors`. The known unrelated Orrery full-suite parse failure was not treated as a regression.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Global assignment can silently restore a stale opposite presentation axis

**Classification:** BLOCKER

**Files:** `/home/bwales/projects/orbit-app/src/components/profile/ProfileTemplateManager.tsx:313-318`; `/home/bwales/projects/orbit-app/src/components/profile/ProfileBackgroundManager.tsx:401-407`

**Issue:** Both global writes reconstruct the full `app_settings` presentation pair from the Profile snapshot captured when the screen loaded. The template manager writes a new layout with `presentation.global.backgroundTemplateUid`; the background manager writes a new/cleared background with `presentation.global.layoutTemplateUid`. `onCommitted` only starts an asynchronous reload, so a user can change one global axis, move to the other manager before that reload settles, and overwrite the first change with the stale value. This violates the independent-axis invariant and silently loses a user's global layout or background selection. Category assignments correctly perform a fresh sibling-axis read, which makes the global asymmetry especially clear.

**Fix:** Add axis-specific global DAO operations, or read the current global row inside the same write transaction immediately before updating the requested axis. Have both managers call that operation rather than passing a snapshot sibling value. Add an integration test that performs a layout and background write from stale snapshots and asserts both newly chosen values survive.

## Warnings

### WR-01: Layout-template load failure has no recovery path and remains displayed after recovery

**Classification:** WARNING

**File:** `/home/bwales/projects/orbit-app/src/components/profile/ProfileTemplateManager.tsx:142-178`

**Issue:** A failed initial `refresh()` sets `state.error`, but the list exposes no Retry action. More importantly, a later successful refresh only publishes templates/categories/usage and never clears `state.error`. Closing and reopening triggers a new read, yet the old error stays visible indefinitely unless the user happens to start another operation that clears it.

**Fix:** Clear `state.error` at the start or successful end of `refresh`, expose a Retry control when the list load fails, and test fail-then-success reopening/retry behavior.

### WR-02: Reopening Background after abandoning assignment strands the user off the list controls

**Classification:** WARNING

**File:** `/home/bwales/projects/orbit-app/src/components/profile/ProfileBackgroundManager.tsx:453-478`

**Issue:** Closing a clean manager only hides the sheet; it retains `page === "assign"` and `selectedUid`. If a user opens a template's Assign screen, presses Back without applying it, then opens Background again, the manager returns to that old Assign screen. It has no non-mutating route back to the list, so the new global/Category Clear controls and contact Inherit control are unreachable without applying an unintended assignment.

**Fix:** Reset `page` to `"list"` (and clear transient selection/error state as appropriate) on a clean close or on the next `visible` rising edge. Add a component test for assign-page close followed by reopen, asserting the list and its clear/inherit actions are shown.

---

_Reviewed: 2026-09-10T10:51:01Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
