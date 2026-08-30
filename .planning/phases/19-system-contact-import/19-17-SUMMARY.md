---
phase: 19-system-contact-import
plan: 17
subsystem: device UAT (contact import)
tags: [device-uat, android17, contact-picker, import, run-as, pixel6]
provides:
  - Device-verified proof of the five import gap fixes (19-12..19-16) on real hardware
  - Device-verified proof of the 19-20 Android-17 picker intent fix
affects:
  - IMP-01 (permissionless system picker), IMP-02 (birthday), IMP-04 (durable completion)
key_files:
  created:
    - .planning/phases/19-system-contact-import/19-17-SUMMARY.md
  modified: []
decisions:
  - Ran on the real Pixel 6 (API 37); all happy paths testable now the picker works.
  - Photo retain-on-failure is not triggerable through the real OS picker (valid photos only); left as code-verified, not fabricated.
  - 4 real contacts imported as UAT test data left in place per owner decision (ids 3-6).
metrics:
  completed: 2026-08-29
  tasks: 3
status: complete
requirements-completed: [IMP-01, IMP-02, IMP-04]
requirements-advanced: []
---

# 19-17 SUMMARY — Device UAT of the import gap fixes

**Environment:** Pixel 6 Pro `1A071FDEE002BU`, Android 17 / API 37. DEBUG APK built on `droid`
from HEAD (includes the 19-20 picker fix, `assembleDebug` BUILD SUCCESSFUL), `install -r`.
Agent-driven via `adb`/`uiautomator`; DB read WAL-aware via `run-as` + `node:sqlite`.
Gate green on the committed code: `npm test` 1696 passed, `tsc --noEmit` clean, `check:colors` clean.

All three tasks are **device-verified** (not static-only). The Android-17 picker happy-path is
now reachable because of 19-20; before it, this UAT was blocked.

## Task 1 — Android-17 picker launch (GAP A / IMP-01) — PASS

- **Launches the OS system picker permissionlessly.** "Import from Contacts" opens
  `com.android.contactspicker/.ContactsPickerActivity` (its own Compose UI) with the privacy
  banner "Orbit will only have access to info from the contacts you select" — **no**
  READ_CONTACTS / broad-permission prompt (uiautomator showed no permission dialog).
- **Cancel writes no session.** Launch → back → `import_sessions` empty (run-as). ✓
- **Re-invocation works** after a cancel (launch-guard, GAP A Task 2): picker reopened. ✓
- **Snapshot returns name/phone/email.** Single pick (Andrew Wales) → session `single`/1 row;
  `source_payload` held `{displayName, methods:[email,email,phone], birthday}`; the review UI
  showed the name, both emails, phone. Multi-pick (2 contacts) → session `bulk`/2 rows. ✓

## Task 2 — resolved flow, recovery, completion (GAP C.1/C.3 / IMP-04) — PASS

- **Two-row cluster Combine reaches Import complete (19-15).** Picked the shared-phone pair
  Grandma Joy + Joyce Milligan → "These may be the same person" → **Combine into one** →
  **"Import complete"** (not a disabled "Import 0"). Both rows `imported`/`new` → the *same*
  `contact_id` (4); exactly one new contact created. ✓
- **Resolved counts survive navigation; session completes (19-14).** Bulk of 3 (Andrew
  already-in-Orbit + 2 new): Andrew → `skipped`/`already_linked`; one → `imported`/`new`; one
  → `needs_review`/`possible` ("similar name"). Import complete showed **Already in Orbit (1)**.
  Resolved the possible-match via the card's long-press → "Import as New" → session status
  became **`complete`**; counts persisted (Already in Orbit 1, Imported 2, Need review 0). ✓
- **Resume after process death (19-14).** With a pending bulk session, `am force-stop` +
  relaunch restored the **Resume prompt** (session still `pending`, 3 rows) and previously
  committed contacts survived. ✓
- **Discard keeps committed contacts, clears unresolved.** Discard from the Resume prompt →
  session `discarded`, its `import_session_rows` cleared (0), and all prior committed contacts
  remained (total 6 unchanged). ✓

## Task 3 — photo lifecycle + birthday validation (GAP C.2/B / IMP-02, IMP-04) — PASS (photo-failure code-verified)

- **Birthday validation (19-13).** In single review, typing `2021-02-29` (non-leap) showed the
  inline error **"Enter a real date (YYYY-MM-DD or MM-DD)."** and the **Import button went
  disabled**. Correcting to the year-unknown form `07-11` re-enabled Import; after import
  `contacts.birthday` = **`07-11`** stored **unchanged** (run-as). ✓
- **Photo success retires staging (19-16).** Imported contacts with photos → each imported
  row's `photo_rel_path` is **NULL** and `photo_failed` = 0; the `files/import-staging/`
  directory is **empty** (raw staged sources deleted); the contact master photos exist
  (`avatars/contact-N.jpg`). ✓
- **Photo retain-on-failure:** the real OS picker only yields valid photos, so a genuine
  photo-copy failure is **not triggerable on-device without artificial failure injection**
  (the plan flags synthetic DB seeding as impractical). Left **code-verified** — the
  subsystem review confirmed retain-on-failure sound and the node suite (1696) is green — not
  fabricated as a device pass. *(Minor observed detail: an already-linked/skipped row can hold
  a `photo_rel_path` pointing at an already-deleted staged file — the known transient-orphan
  item #7; not one of the five gap fixes.)*

## Outcome

The five gap fixes (19-12..19-16) and the 19-20 picker fix are **device-verified** on the
owner's Android-17 Pixel. Final DB: sessions 1-3 `complete`, session 4 `discarded`; 6 contacts
(2 baseline + 4 UAT imports). Per owner decision, the 4 imported test contacts (ids 3-6:
Andrew Wales, Joyce Milligan, Dad, Chris Wales) are **left in place**.

Still open (not part of this plan): the three verified code-review defects in
`19-DEVICE-UAT-FINDINGS.md` (#1 Events-as-birthday, #2 silent read-fail, #3 nameless-row
resume nag). A minor UX note surfaced: a single-import "Already in Orbit" terminal screen
offered only "VIEW CONTACT" (back did not dismiss it) — worth a follow-up but out of scope here.
