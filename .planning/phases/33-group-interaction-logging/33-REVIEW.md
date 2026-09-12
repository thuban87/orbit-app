---
phase: 33-group-interaction-logging
reviewed: 2026-09-12T11:51:10Z
depth: deep
files_reviewed: 46
files_reviewed_list:
  - src/backup/phase-17-integration.test.ts
  - src/components/ContactPicker.tsx
  - src/components/MergeImpactSummary.tsx
  - src/components/TouchpointRefineForm.tsx
  - src/components/contact-picker-multiselect.test.ts
  - src/components/contact-picker-multiselect.ts
  - src/components/group/GroupTitlePromptSheet.tsx
  - src/components/group/ParticipantCard.tsx
  - src/components/group/ParticipantOverrideEditor.tsx
  - src/components/group/RemoveParticipantSheet.tsx
  - src/components/history/GroupScopePrompt.tsx
  - src/components/history/HistorySection.tsx
  - src/components/history/InteractionDetail.tsx
  - src/db/ai-context-read.test.ts
  - src/db/contact-status-read.test.ts
  - src/db/database.ts
  - src/db/group-events-dao.test.ts
  - src/db/group-events-dao.ts
  - src/db/group-events-read.test.ts
  - src/db/group-events-read.ts
  - src/db/history-read.test.ts
  - src/db/history-read.ts
  - src/db/merge-dao.test.ts
  - src/db/merge-dao.ts
  - src/db/migrations/026-group-events-schema.test.ts
  - src/db/migrations/026-group-events-schema.ts
  - src/db/migrations/full-chain.test.ts
  - src/db/purge-dao.ts
  - src/db/recency-dao.test.ts
  - src/db/recency-dao.ts
  - src/db/tombstones-dao.ts
  - src/logic/group-inheritance.test.ts
  - src/logic/group-inheritance.ts
  - src/logic/group-log-participant-inputs.test.ts
  - src/logic/group-log-participant-inputs.ts
  - src/navigation/focused-route-classification.test.ts
  - src/navigation/focused-route-classification.ts
  - src/navigation/tabs/DashboardStack.tsx
  - src/navigation/tabs/OrreryStack.tsx
  - src/navigation/tabs/SettingsStack.tsx
  - src/navigation/types.ts
  - src/screens/EditGroupEventScreen.tsx
  - src/screens/EditParticipantScreen.tsx
  - src/screens/GroupEventDetailScreen.tsx
  - src/screens/GroupEventsScreen.tsx
  - src/screens/GroupLogScreen.tsx
findings:
  critical: 4
  warning: 2
  info: 0
  total: 6
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-09-12T11:51:10Z  
**Depth:** deep  
**Files Reviewed:** 46  
**Status:** issues_found

## Summary

This was a deep subsystem review of the Group Event schema, write/read paths, all on-disk writers of `interactions` and `contacts.last_contact`, merge/purge/tombstone paths, and the current backup/export/restore boundary. The group-parent design, three-field inheritance limit, single-recency-core composition, and closed AI-context projection are generally preserved. Four defects block release: deletion makes every backup export fail; multi-select participant additions are not atomic; a group child's per-interaction Allow AI permission cannot be changed or represented truthfully; and event duration is displayed in the wrong unit.

Validation run: `npx vitest run` for all 14 Phase-33 targeted suites (247 tests), `npx tsc --noEmit`, and `npm run check:colors` all passed. Those tests do not exercise the failing cross-boundary or UI paths below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Deleting or dissolving a Group Event breaks all subsequent backup exports

**File:** `src/db/group-events-dao.ts:681`  
**Issue:** Lifecycle deletion inserts a `group_event` tombstone, and the exporter serializes every tombstone. The current backup validator rejects that new type: `src/backup/backup-schema.ts:197-212` omits `group_event`, then rejects it at lines 633-641. Consequently, after the first dissolve/delete, `buildExportManifest()` fails validation and neither manual nor automatic backups can export any data. The Phase 36 handoff correctly assigns the complete portable wire-format change to Phase 36, but that makes this an unreleasable cross-phase dependency rather than a safe interim state.

**Fix:** Do not release Phase 33 independently. Complete and test the Phase 36 format update as the release dependency: add `groupEvents` and the child link/follow fields to export/validation/reconciliation/restore, admit `group_event` tombstones, and round-trip both dissolve and full-delete cases. Add an integration regression that creates then dissolves a Group Event and asserts `buildExportManifest()` succeeds.

### CR-02: Adding several participants can partially commit despite reporting failure

**File:** `src/screens/EditGroupEventScreen.tsx:149-158`  
**Issue:** The multi-select handler starts one independent `addParticipant()` transaction per selected contact with `Promise.all`. `addParticipant()` opens and commits its own write transaction (`src/db/group-events-dao.ts:574-592`). If one add succeeds and another fails (stale membership, deleted contact, SQLite error), the successful children remain committed, while the UI reports that changes were not saved. This violates the decided atomic participant-change contract. `GroupEventDetailScreen` repeats the same defect serially at lines 72-79: a later failure leaves earlier additions committed.

**Fix:** Add one batch participant-add DAO that owns a single `inWriteTransaction`, re-reads the parent/membership inside it, composes `insertInteractionCore` plus `recomputeLastContactCore` for every participant, and performs one trailing revision bump. Make both screens call that batch operation once and add a failure-in-the-second-child rollback regression.

### CR-03: Group-linked interaction notes can never receive their required per-item Allow AI consent

**File:** `src/components/group/ParticipantOverrideEditor.tsx:39-48`  
**Issue:** `participantDraft()` replaces the stored permission with `allowAi: 0`, and the editor's visible fields at lines 111-118 omit `allowAi`. Both save owners only submit direction/connected/note direct fields (`src/screens/EditParticipantScreen.tsx:97-107`; `src/screens/EditGroupEventScreen.tsx:231-241`); the DAO intentionally preserves the old value. Thus a user cannot opt in a group child's own participant note, even though ADR-078 and the phase dossier allow that note only through the child interaction's explicit, default-off permission. The Detail screen additionally fabricates `allowAi: 0` at `src/screens/GroupEventDetailScreen.tsx:126-143`, so an existing opted-in interaction converted to a group event is displayed as not shared.

**Fix:** Read the real `allow_ai` in the participant projection, carry it in `ParticipantEditDraft`, expose the existing per-interaction Allow AI control in individual-participant editing only, and include it in the atomic participant-save input/core. Keep Group Note out of this path entirely. Add regressions for default-off creation, explicit child opt-in, and conversion of an already opted-in standalone interaction.

### CR-04: Group Event Detail renders seconds as minutes

**File:** `src/screens/GroupEventDetailScreen.tsx:188-190`  
**Issue:** `interactions.duration` and `group_events.duration` are stored in whole seconds (the shared `TouchpointRefineForm` contract and migration-025). The Detail view interpolates the raw seconds with a `min` suffix. A one-hour event stored as `3600` is shown as `3600 min`, an incorrect duration by a factor of sixty.

**Fix:** Use the existing `formatDurationLabel(event.duration)` helper, as the interaction Detail and duration editor do, and add a render-level regression for `1800 -> 30 min` and `3600 -> 1 hr`.

## Warnings

### WR-01: The focused Group Event editor cannot correct its required title

**File:** `src/screens/EditGroupEventScreen.tsx:276-286`  
**Issue:** The title is rendered as read-only text, and neither `EventDraft` nor `UpdateGroupEventPatch` has a title update path. A Group Event is independently editable and its required title is event-owned, not immutable; a typo entered during event-first capture cannot be corrected without deleting/recreating the record.

**Fix:** Add a title field to the Edit Group Event draft and a validated nonblank title patch to `updateGroupEvent`, then preserve title changes in the same transaction as the other event edits.

### WR-02: Group recency mutations do not publish a foreground widget refresh

**File:** `src/screens/GroupLogScreen.tsx:87-99`  
**Issue:** Successful Group Log creation changes participant `last_contact`, but returns to the caller without `notifyWidgetDataChanged()`. The Group Event edit/detail mutation paths likewise add/delete/detach participants and alter recency without publishing. The Android favourites widget is explicitly event-push refreshed for foreground mutations, so it can keep stale recency/status-derived content until an unrelated write or app foreground sweep.

**Fix:** After each successful Group Event mutation that can affect participant-visible/widget data, fire `notifyWidgetDataChanged()` after the DAO resolves (never inside its transaction). Cover create, participant add/remove, event-date fan-out, and delete/dissolve.

---

_Reviewed: 2026-09-12T11:51:10Z_  
_Reviewer: gsd-code-reviewer_  
_Depth: deep_
