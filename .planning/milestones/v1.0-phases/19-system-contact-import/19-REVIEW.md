---
phase: 19-system-contact-import
reviewed: 2026-08-29T14:43:41Z
depth: standard
files_reviewed: 57
files_reviewed_list:
  - App.tsx
  - app.config.ts
  - modules/orbit-contact-picker/android/build.gradle
  - modules/orbit-contact-picker/android/src/main/AndroidManifest.xml
  - modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt
  - modules/orbit-contact-picker/expo-module.config.json
  - modules/orbit-contact-picker/index.ts
  - modules/orbit-contact-picker/src/OrbitContactPickerModule.ts
  - modules/orbit-contact-picker/src/OrbitContactPickerModule.web.ts
  - src/backup/restore-apply.test.ts
  - src/backup/restore-apply.ts
  - src/components/AddSpeedDialFab.tsx
  - src/components/CandidateCardGrid.tsx
  - src/components/ConfidenceChip.tsx
  - src/components/ConsolidationPrompt.tsx
  - src/components/ResumeImportPrompt.tsx
  - src/db/contacts-dao.ts
  - src/db/database.ts
  - src/db/import-session-dao.test.ts
  - src/db/import-session-dao.ts
  - src/db/import-session-read.test.ts
  - src/db/import-session-read.ts
  - src/db/imported-contact-dao.test.ts
  - src/db/imported-contact-dao.ts
  - src/db/migrations/012-import-sessions.test.ts
  - src/db/migrations/012-import-sessions.ts
  - src/db/migrations/full-chain.test.ts
  - src/db/photo-relative-path.ts
  - src/logic/birthday-logic.test.ts
  - src/logic/birthday-logic.ts
  - src/logic/picked-contact-map.test.ts
  - src/logic/picked-contact-map.ts
  - src/navigation/RootNavigator.tsx
  - src/navigation/types.ts
  - src/screens/BulkImportSetupScreen.tsx
  - src/screens/DuplicateReviewScreen.tsx
  - src/screens/HomeScreen.tsx
  - src/screens/ImportCompleteScreen.tsx
  - src/screens/ImportProgressScreen.tsx
  - src/screens/ImportReviewScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/use-import-leave-guard.ts
  - src/services/import/contact-import-resume-sweep.test.ts
  - src/services/import/contact-import-resume-sweep.ts
  - src/services/import/duplicate-evidence.test.ts
  - src/services/import/duplicate-evidence.ts
  - src/services/import/import-acquire.test.ts
  - src/services/import/import-acquire.ts
  - src/services/import/import-driver.test.ts
  - src/services/import/import-driver.ts
  - src/services/import/import-photo.test.ts
  - src/services/import/import-photo.ts
  - src/services/import/source-consolidation.test.ts
  - src/services/import/source-consolidation.ts
  - src/services/photos/photo-storage.ts
findings:
  critical: 5
  warning: 1
  info: 0
  total: 6
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-29T14:43:41Z
**Depth:** standard
**Files Reviewed:** 57
**Status:** issues_found

## Summary

The durable-session SQL and its focused test suite are generally coherent, but the complete import path has several ship-blocking integration defects. In particular, the Android picker asks the platform for unsupported data fields, resolved single-import rows are discarded by the leave guard, a consolidation-only batch cannot finish, editable birthdays bypass the validation boundary, and successful imports retain raw staged contact photos indefinitely.

Targeted import, migration, DAO, recovery, and consolidation tests passed (37 tests), but they do not exercise these cross-screen or Android-platform failure paths.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Android picker requests MIME types the Contact Picker does not support

**File:** `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt:76`

**Issue:** The required-data-fields list includes `Event.CONTENT_ITEM_TYPE` and `Photo.CONTENT_ITEM_TYPE`. Android 17's `ContactsPickerSessionContract.EXTRA_PICK_CONTACTS_REQUESTED_DATA_FIELDS` accepts only the documented picker field set (structured name, email, phone, postal, organization, and relation); Event and Photo are not supported. The system picker rejects an unsupported requested field, so this intent can fail to launch on the only supported Android version. Even if launch behavior changed to ignore them, the code's birthday/photo paths cannot rely on those fields being returned.

**Fix:** Restrict the requested MIME list to fields supported by `ContactsPickerSessionContract` (at minimum phone/email, and structured name if needed). Do not advertise birthday/photo import until the platform exposes supported picker fields for them; remove the unsupported reads or put them behind a separately supported, permission-safe acquisition path.

### CR-02: Leaving a resolved single-import screen discards its summary row

**File:** `src/screens/use-import-leave-guard.ts:12`

**Issue:** The guard treats every row with `contactId === null` as unresolved. Deterministic already-linked and user-skipped rows intentionally have `contact_id = NULL` while their `row_status` is `skipped`. After `ImportReviewScreen` resolves either state and calls `navigation.replace` (`src/screens/ImportReviewScreen.tsx:223` and `src/screens/ImportReviewScreen.tsx:301`), `beforeRemove` runs this guard, marks the session discarded, and deletes those rows. The next ImportComplete screen therefore loses the Already in Orbit / Failed-skipped count that was just committed.

**Fix:** Define unresolved rows by `rowStatus` (`pending`, `needs_review`, and optionally retryable `failed`), not by `contactId`. Only call `discardSession` when at least one of those statuses remains; resolved `skipped` and `already_linked` rows must survive the route replacement.

### CR-03: A batch containing only a combined cluster is stranded in setup

**File:** `src/services/import/source-consolidation.ts:238`

**Issue:** `combineCluster` resolves every selected row but never calls `finalizeSessionIfTerminal`. `BulkImportSetupScreen.onCombine` then reloads its count and stays on setup (`src/screens/BulkImportSetupScreen.tsx:147`), where `count` is zero and the Import button is disabled. A batch that consists only of the suggested cluster therefore has no route to ImportComplete and remains `pending` until a later launch happens to repair it.

**Fix:** After the transaction resolves all cluster rows, finalize the session and have the setup screen replace/navigate to `ImportComplete` when it is terminal. Add an integration test for a two-row-only cluster and assert both `status='complete'` and navigation to the summary.

### CR-04: Editable import birthdays bypass the persistent birthday validation rule

**File:** `src/db/imported-contact-dao.ts:118`

**Issue:** `ImportReviewScreen` permits arbitrary text in its birthday input (`src/screens/ImportReviewScreen.tsx:489`) and passes that value to `importContactRecord`. The DAO writes it straight into `contacts.birthday` without `isValidStoredBirthday` validation. A user can thus persist malformed dates such as `02-30` or arbitrary text; downstream birthday logic silently ignores those contacts, while the UI reported a successful import.

**Fix:** Validate at the DAO boundary: accept `null`, otherwise require `isValidStoredBirthday(birthday)` and reject (or normalize through the shared storage builder) before opening the transaction. Surface that validation error in ImportReview and add cases for malformed and year-unknown valid values.

### CR-05: Successful imports retain raw staging photos indefinitely

**File:** `src/services/import/import-photo.ts:99`

**Issue:** After the resized master is persisted and attached to the contact, the raw `import-staging/...` source is never deleted or cleared from its session row. The recovery sweep treats all rows belonging to any non-discarded session as live (`src/services/import/contact-import-resume-sweep.ts:92`), including completed/imported rows, so it will preserve these full-resolution temporary contact photos forever. Consolidated imports also retain every non-chosen source photo. This creates permanent duplicate PII storage and prevents the staging directory from being reclaimed.

**Fix:** Once the master write and `setContactPhoto` have both succeeded, commit a session-row transition that clears/retires its staging reference, then delete that exact staging file post-commit. Preserve the source only for pending/failed retryable rows. Add a recovery test proving completed and successfully imported rows no longer keep staged images while failed rows do.

## Warnings

### WR-01: A failed activity launch permanently wedges the native picker

**File:** `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt:86`

**Issue:** `pendingPickPromise` is assigned before `startActivityForResult`, but the launch call is not protected. If the host activity is unavailable or Android rejects the intent, it throws, the promise is neither rejected nor cleared, and every later pick throws `ContactPickInProgressException` for the rest of the module lifetime.

**Fix:** Wrap launch in `try/catch`; on failure clear `pendingPickPromise` and reject the current promise with a coded exception. Alternatively assign the pending promise only after launch succeeds, while still handling synchronous launch errors.

---

_Reviewed: 2026-08-29T14:43:41Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
