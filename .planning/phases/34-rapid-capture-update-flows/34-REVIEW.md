---
phase: 34-rapid-capture-update-flows
reviewed: 2026-09-12T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - scripts/audit-interaction-vocabulary.sh
  - src/backup/backup-schema.ts
  - src/components/PostLogNoteEditor.tsx
  - src/components/Snackbar.tsx
  - src/components/UniversalFab.tsx
  - src/components/ui/AccordionSection.tsx
  - src/components/ui/index.ts
  - src/components/universal-fab-logic.ts
  - src/db/app-settings-dao.ts
  - src/db/contact-methods-dao.ts
  - src/db/contacts-dao.ts
  - src/db/database.ts
  - src/db/fuel-dao.ts
  - src/db/memory-registry.ts
  - src/db/migrations/027-default-interaction-channel.ts
  - src/navigation/tabs/DashboardStack.tsx
  - src/navigation/tabs/OrreryStack.tsx
  - src/navigation/tabs/SettingsStack.tsx
  - src/screens/CreateContactScreen.tsx
  - src/screens/EditContactScreen.tsx
  - src/screens/HomeScreen.tsx
  - src/screens/LogInteractionScreen.tsx
  - src/screens/MemoryScreen.tsx
  - src/screens/UpdateContactScreen.tsx
  - src/screens/create-contact-logic.ts
  - src/screens/edit-contact-logic.ts
  - src/screens/log-interaction-logic.ts
  - src/screens/post-log-note-logic.ts
  - src/screens/update-contact-chooser-logic.ts
  - src/services/quick-log-command.ts
  - src/stores/snackbar-store.ts
  - src/components/TouchpointRefineForm.tsx
  - src/backup/restore-apply.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-09-12
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 34 (rapid capture & update flows) adds migration 027 (the durable Default
Interaction Channel preference, app_settings-only additive ALTER), the shared
Quick Log command + post-log note/memory editor, the detailed Log Interaction
screen, the registry-driven Update Contact chooser, the accordion-restructured
Create/Edit Contact forms, and their pure logic modules.

I reviewed the actual code on disk (not just the diff), including every writer of
`app_settings` (`app-settings-dao.ts`) and of `fuel`/`interactions` reachable
from the new surfaces, plus the migration chain registration and the backup
schema declare-only wiring.

**Data-layer verdict — clean.** Migration 027 is a correct forward-only,
additive `ALTER TABLE ADD COLUMN` on app_settings only; it does not touch
`interactions`, assumes no starting state, rewrites no data, and its CHECK
vocabulary matches migration 025's frozen channel literals plus the `remember`
sentinel. `TARGET_VERSION` is bumped through the version const and `migration027`
is registered in `MIGRATIONS`. The composed create/edit transactions
(`createContactFull` / `updateContactFull`) keep the single-writer
`last_contact` invariant, the kind-scoped off_limits diff, and exactly one
`data_revision` bump per composed save. The backup schema declares the two new
channel keys as camelCase restore-only keys, validated through the same DAO
validators, with no `BACKUP_FORMAT_VERSION` bump. No custom-field invariant,
migration hazard, ADR/HANDOFF decision reversal, hardcoded colour, or
`toISOString().split` off-by-one was found.

No BLOCKER-severity defects. The findings below are robustness/consistency
issues.

## Warnings

### WR-01: LogInteractionScreen Save uses a React-state single-flight guard, not a ref — double-tap can record two interactions

**File:** `src/screens/LogInteractionScreen.tsx:168-192`
**Issue:** `handleSave` gates re-entry with `if (!value || contactId === null || saving) return;`, where `saving` is React state. `setSaving(true)` is asynchronous, so two taps dispatched before the re-render commits both read `saving === false` and both call `recordTouchpoint(...)` with distinct `newUid()`s, creating two interaction rows for one intended log (which perturbs recency/counts and requires manual cleanup). The sibling capture path (`services/quick-log-command.ts:101-105`) deliberately uses a synchronous `pendingRef` for exactly this reason, and `PostLogNoteEditor` uses `savingRef`; this new screen does not. The `disabled={saving}` prop only closes the window after the first commit re-renders.
**Fix:** Mirror the established pattern — add a `useRef(false)` in-flight flag set/cleared synchronously around the write:
```ts
const savingRef = useRef(false);
async function handleSave() {
  if (!value || contactId === null || savingRef.current) return;
  savingRef.current = true;
  setSaving(true);
  try { /* recordTouchpoint ... */ }
  finally { savingRef.current = false; }
}
```

### WR-02: PostLogNoteEditor can create a duplicate Memory when the post-create re-read returns null

**File:** `src/components/PostLogNoteEditor.tsx:162-190`
**Issue:** `createMemory` calls `addMemory(...)` (success), then `reReadCreatedMemory(id, contactId)` and `setCreatedMemory(row)`. `reReadCreatedMemory` returns `rows.find(...) ?? null`; if the just-created row is not found (returns `null`), `createdMemory` stays `null`, so the editor re-renders the "Add Note" branch with the typed `text` still present and `savingRef` reset in `finally`. A second tap on "Create Memory Instead" then creates a SECOND Memory for the same text — a silent duplicate, with no confirmation that the first write already committed. Low probability (requires the read to miss a freshly-added row) but the consequence is duplicate user data.
**Fix:** Treat a successful `addMemory` as terminal regardless of the re-read outcome — e.g. close on a null re-read, or disable the create action once an id has been returned:
```ts
const id = await addMemory(...);
const row = await reReadCreatedMemory(id, contactId);
if (!row) { onClose(); return; } // created; nothing more to edit inline
setCreatedMemory(row);
```

### WR-03: Save handlers across the new capture surfaces share the same state-based double-submit window

**File:** `src/screens/UpdateContactScreen.tsx:215-234` (and `402-435`, `548-567`, `619-636`, `684-704`); `src/screens/MemoryScreen.tsx:120-140`
**Issue:** The focused editors and `MemoryScreen.add`/`edit` all guard with `if (... || saving) return;` on React state rather than a synchronous ref. For the current-state, off-limits, contact-method, frequency, and custom-field editors the underlying DAO writes are idempotent-ish upserts/diffs, so a double-fire is mostly harmless; but `MemoryScreen.add` and `OffLimitsFocusedEditor` add-mode both INSERT a new row per call, so a fast double-tap can duplicate a Memory or an off-limits row (each mints a fresh `newUid()`, so the UNIQUE constraint does not catch it). This is the same class as WR-01, generalized across the phase's new write surfaces.
**Fix:** Add a synchronous in-flight `useRef` guard to the add/insert paths (`MemoryScreen.add`, `OffLimitsFocusedEditor.save` add branch), matching `PostLogNoteEditor.savingRef` / `quick-log-command.pendingRef`. Upsert/diff editors are lower risk but the same guard is the consistent fix.

## Info

### IN-01: OffLimitsFocusedEditor writes new off_limits fuel with `source: "manual"`, diverging from every other off_limits writer

**File:** `src/screens/UpdateContactScreen.tsx:410-418`
**Issue:** The add branch calls `addFuel(..., source: "manual", ...)`. Every other off_limits writer uses `source: "user"` (`contacts-dao.ts:337` create path, `contacts-dao.ts:623` edit diff). Per `fuel-dao.ts:47-52` the documented meaning of `'manual'` is "an AI suggestion a user confirmed," whereas a user typing an off-limits topic is `'user'` provenance. off_limits is excluded from every ranking/AI projection, so there is no behavioral fallout today, but the provenance is semantically wrong and inconsistent with the two composed writers.
**Fix:** Use `source: "user"` for the standalone off-limits add, matching `createContactFullCore` / `applyKnowledgeDiffsCore`.

### IN-02: Remembered-channel write is unconditional, bumping `data_revision` on every ordinary log even when the channel is unchanged

**File:** `src/screens/LogInteractionScreen.tsx:198-220`
**Issue:** After a successful ordinary save the screen always calls `updateAppSettings({ rememberedInteractionChannel: value.channel })`, which always sets `modified_at` and bumps `data_revision` (`app-settings-dao.ts:1177-1181`) even when the remembered channel already equals `value.channel`. Every ordinary log therefore advances the backup-freshness signal a second time (once for the interaction, once for the settings row) regardless of whether the remembered value actually changed, inflating the "needs backup" nudge cadence. This is a documented non-atomic best-effort write (Review MEDIUM 34-04), so it is not a correctness bug — just avoidable churn.
**Fix:** Skip the write when the remembered channel is unchanged — read `settings.rememberedInteractionChannel` (already available at seed time) and only call `updateAppSettings` when `value.channel !== remembered`.

### IN-03: UpdateContact chooser row applicability is not refreshed after an inner save within a session

**File:** `src/screens/UpdateContactScreen.tsx:802-831`
**Issue:** The chooser rows (which surface applicable custom fields that "already hold a value," `update-contact-chooser-logic.ts:113-124`) are loaded via `useFocusEffect` on the contactId, not on the session's `lastSavedRowKey`. After a focused save returns to the chooser (`completeSave`), a custom field that just gained its first value will not appear as a directly-surfaced row until the screen is re-focused. Purely a discoverability/UI staleness nit within a session — no data impact.
**Fix:** Re-run `load(contactId)` when `session.lastSavedRowKey` changes (or on `onSaved`) so the applicable-field rows reflect the just-committed value.

---

_Reviewed: 2026-09-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
