---
phase: 19-system-contact-import
plan: 19
subsystem: contact picker package visibility
tags: [android, package-visibility, queries, native, manifest, device-uat]
provides:
  - Contact-pick package-visibility <queries> in the picker module manifest
  - The app can now resolve and launch the system ContactsPickerActivity
affects:
  - contact import picker launch (IMP-01)
  - Phase 19-17 device UAT
key_files:
  created:
    - .planning/phases/19-system-contact-import/19-DEVICE-UAT-FINDINGS.md
  modified:
    - modules/orbit-contact-picker/android/src/main/AndroidManifest.xml
decisions:
  - Scope visibility to the contact-pick intent(s) only; no READ_CONTACTS, no QUERY_ALL_PACKAGES.
  - Declare the query in the local picker module's manifest (co-located with the module that fires the intent).
metrics:
  completed: 2026-08-29
  tasks: 1
status: complete-with-caveat
requirements-completed: []
requirements-advanced: [IMP-01]
coverage:
  - id: E1
    description: The app declares contact-pick package visibility and now launches ContactsPickerActivity (previously fell to the resolver).
    requirement: IMP-01
    verification:
      - kind: device
        ref: logcat START ... ContactsPickerActivity from uid com.bwales.orbit (see 19-DEVICE-UAT-FINDINGS.md)
        status: pass
    human_judgment: true
    rationale: The visibility fix is verified. End-to-end picker launch remains blocked by an OS-level defect (see caveat), which is not orbit code.
---

# Phase 19 Plan 19: Contact-Picker Package Visibility

The app could not launch the system contact picker: with targetSdk 36 under Android 11+
package-visibility filtering, orbit declared no `<queries>` for the contact-pick intent, so
`com.android.contactspicker` was invisible and the launch fell through to the system resolver
("No apps can perform this action") — while `am start` from shell (exempt from visibility) launched it.
19-12 corrected the picker action but not the visibility declaration.

## Task Completed
1. **Declared scoped contact-pick `<queries>`** in the local picker module's (previously empty)
   AndroidManifest.xml — `android.provider.action.PICK_CONTACTS` and the classic `ACTION_PICK` +
   `vnd.android.cursor.dir/contact`. No `READ_CONTACTS`, no `QUERY_ALL_PACKAGES`. Rebuilt (prebuild
   --clean + assembleDebug on droid) and reinstalled.

## Verification
- On-device manifest now lists the contact-pick `queriesIntents` (`dumpsys package com.bwales.orbit`).
- No new contacts permission and no `QUERY_ALL_PACKAGES` added.
- **logcat proves the fix worked:** the app now issues
  `START act=android.provider.action.PICK_CONTACTS cmp=com.android.contactspicker/.ContactsPickerActivity from uid (com.bwales.orbit)` —
  it reaches the system picker, which it could not do before.

## ⚠️ Caveat — end-to-end picker still blocked by an OS-level defect (not this fix, not orbit code)
Once launched, `ContactsPickerActivity` logs `No PreferredActivity Found` and bounces to an empty
system Chooser (`PICK_CONTACTS is not supported`, 0 targets). This is a **device/OS failure of the
brand-new Android 17 picker** (reproduces for the classic `ACTION_PICK` too, for any app), documented
in `19-DEVICE-UAT-FINDINGS.md`. This plan's own goal — package visibility so the app can *reach* the
picker — is achieved and verified; the remaining blocker is an OS thread, not a code gap.

## Deviations from Plan
- The plan's acceptance criterion ("launches ContactsPickerActivity, NOT the resolver") is **partially**
  met: the app now launches ContactsPickerActivity (the visibility defect this plan targets is fixed),
  but that system activity itself then routes to the resolver due to the OS defect. No further orbit
  change would alter this. Status recorded as `complete-with-caveat`; IMP-01 is *advanced*, not closed.

## Next
- IMP-01 device sign-off waits on a working Android 17 picker (OS/device thread). See findings doc.

---
*Phase: 19-system-contact-import* · *Completed: 2026-08-29*
