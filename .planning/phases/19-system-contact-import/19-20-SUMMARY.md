---
phase: 19-system-contact-import
plan: 20
subsystem: contact picker intent construction
tags: [android, native, intent, contact-picker, api37, device-uat, bugfix]
provides:
  - Working Android-17 system contact picker (correct USE_SYSTEM_CONTACTS_PICKER extra namespace)
affects:
  - IMP-01 (permissionless system picker launch)
  - 19-17 device UAT (was picker-blocked)
key_files:
  modified:
    - modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt
  created:
    - .planning/phases/19-system-contact-import/19-ANDROID17-PICKER-ROOTCAUSE.md
    - .planning/phases/19-system-contact-import/19-20-PLAN.md
decisions:
  - Root cause was orbit's intent (wrong extra namespace), not an OS defect; no OS update needed.
  - Fix the USE_SYSTEM_CONTACTS_PICKER key to android.intent.extra.*; add explicit multi-select limit (defensive).
  - Complementary to Phase 19.1 (ADR-002 older-Android ACTION_PICK path), not a substitute.
metrics:
  completed: 2026-08-29
  tasks: 3
status: complete
requirements-completed: []
requirements-advanced: [IMP-01]
commits:
  - cfa660c fix(19-20): correct USE_SYSTEM_CONTACTS_PICKER extra namespace
  - b56956e docs(19-20): gap plan + root-cause; retire OS-defect conclusion
---

# 19-20 SUMMARY — Android-17 picker intent fix

## What was wrong

The Android-17 system contact picker dead-ended in an empty system chooser ("No apps can
perform this action") when launched from orbit — earlier believed to be an OS/device defect
requiring an OS update. Root-caused on-device by disassembling `/system/priv-app/ContactsPicker`
(`dexdump`) and a faithful repro: the trampoline `ContactsPickerActivity` renders its own picker
UI only when `ContactsViewModel.handleIntent(...)` returns true, else it forwards to a
non-existent "preferred" activity and builds a self-excluding chooser (empty). `handleIntent`
returned false because orbit set the picker flag under `android.provider.extra.USE_SYSTEM_CONTACTS_PICKER`
while the trampoline reads `android.intent.extra.USE_SYSTEM_CONTACTS_PICKER` — the flag defaulted
to false → forward → dead end. Full analysis: `19-ANDROID17-PICKER-ROOTCAUSE.md`.

Device-state remediations were proven dead (incl. `pm clear com.android.contactspicker`, tested).

## The change

`OrbitContactPickerModule.kt`:
- `EXTRA_USE_SYSTEM_CONTACTS_PICKER` → `android.intent.extra.USE_SYSTEM_CONTACTS_PICKER` (the fix).
- Multi-select path sets `android.provider.extra.PICK_CONTACTS_SELECTION_LIMIT = 100` (defensive).

No new permission, no READ_CONTACTS, no QUERY_ALL_PACKAGES — the permissionless-snapshot design
is preserved.

## Verification

- Build: `assembleDebug` on `droid` → BUILD SUCCESSFUL; clean rebuild (log stripped) installed for UAT.
- On-device (Pixel 6 / API 37): the native multi-select picker renders (checkboxes, search, real
  contacts, privacy banner naming orbit); top activity `ContactsPickerActivity`, no dead-end chooser.
- Gate: `npm test` 1696 passed, `tsc --noEmit` clean, `check:colors` clean.
- Downstream: fully unblocked 19-17; all three 19-17 tasks passed device UAT (see 19-17-SUMMARY.md).

## Notes

Complementary to Phase 19.1 (ADR-002 older-Android hybrid `ACTION_PICK` path) — still needed for
pre-17 devices. Incidental proof during root-cause: Google Contacts' `ACTION_PICK` picker renders
fine on this device (useful reference for 19.1).
