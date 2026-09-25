# ADR-154: API-37 Import Requests Contacts Access for Notes

**Status:** Accepted
**Date:** 2026-09-24
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** Owner decision 2026-09-24 during 38.2-16 device UAT (import-picker defect)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-002 (partial — API-37+ import is no longer strictly permissionless)
**Superseded by:** None

## Context

24.2-06 added Android contact notes to import by listing the Note mimetype in the API-37 system picker's `PICK_CONTACTS_REQUESTED_DATA_FIELDS`. On a Pixel 6 Pro running Android 17 (SDK 37) the system picker rejects that request (`Unknown or unsupported mimetype: vnd.android.cursor.item/note`) and closes immediately, so no import could start. Devices below SDK 37 use the legacy provider path and were unaffected.

## Decision

The API-37 picker request no longer includes the Note mimetype. After a non-empty pick, import asks for `READ_CONTACTS` in context (reusing ADR-003's grant and request flow); when granted, the picked contacts are re-read by lookup key and their notes are merged before the shared import sink. When access is denied, import proceeds without notes.

## Alternatives Considered

- **Drop note import on API 37+** — rejected by the owner; notes are wanted on the app's primary OS target.
- **Import notes only when access is already on, with a hint** — rejected by the owner; asking for a sensible permission in context is preferred to avoiding it.

## Consequences

### Positive

- Import works again on Android 17, with notes when the user grants access.
- No new manifest or Play policy exposure: ADR-003 already uncapped `READ_CONTACTS` on API 37.

### Negative

- API-37 import can now show the system Contacts permission prompt after the pick.

### Risks

- If the picker's session lookup keys ever diverge from provider lookup keys, notes would silently not merge; import itself still succeeds.

## Implementation

**Key files:**
- `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` — API-37 picker request without the Note mimetype.
- `src/services/import/start-contact-import.ts` — post-pick in-context access request and note merge.
- `src/screens/SettingsContactsScreen.tsx` — wires the permission request and provider re-read into import.

**Depends on:** ADR-002 (Cross-Version Contact Import — Hybrid Two-Picker), ADR-003 (`READ_CONTACTS` on API 37+ for Reconcile)
**Required by:** None
