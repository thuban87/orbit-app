# Phase 19 — Android-17 Contact Picker: Root-Cause Analysis

**Date:** 2026-08-29 (evening session) · **Device:** Pixel 6 Pro `1A071FDEE002BU`, Android 17 (`raven:17/CP2A.260705.006`, API 37)
**Author's note:** This supersedes the earlier conclusion in `19-DEVICE-UAT-FINDINGS.md` that the picker failure is *"an OS/device defect, not fixable in orbit code."* On-device disassembly of the system picker + a faithful reproduction show the failure is **triggered by the intent orbit constructs**, and a **working contact picker already exists on the device**. This is very likely an **orbit-side (code) bug**, not something that requires an OS update.

---

## What was actually happening (verified, not inferred)

The Android-17 system contact picker is a **two-part design**:

- `com.android.contactspicker/.ContactsPickerActivity` — a **router/trampoline** that is the *only* activity on the device registered for `android.provider.action.PICK_CONTACTS` (verified with `pm query-activities`, incl. disabled components; and against Google Contacts' full manifest — it declares **zero** `PICK_CONTACTS` handlers).
- The trampoline **also contains its own Compose picker UI** (`com.android.contactspicker.viewmodel.ContactsViewModel`, reads `com.android.contacts`).

Disassembly of `/system/priv-app/ContactsPicker/ContactsPicker.apk` (via `dexdump`) shows `ContactsPickerActivity.onCreate → routeIntent(intent)`:

```
routeIntent:
  callingPkg = getCallingPackage()                       // null when launched via `am` → RESULT_CANCELED
  handled = ContactsViewModel.handleIntent(action, type, extras, callingPkg, …)   // returns boolean
  if (handled)  setupComposeUi()          // ← renders the native picker (WORKS)
  else          executeForwardingLogic()  // ← the dead-end path
```

`executeForwardingLogic` (its **only** caller is the `else` above):

```
forward = new Intent(getIntent()); forward.setComponent(null); forward.setPackage(null)
prefs = packageManager.getPreferredActivities(...)         // user-set "always open with" defaults
match = first pref whose IntentFilter matches `forward` (action = PICK_CONTACTS)
if (match != null) { startActivity(match); finish() }      // "Starting Preferred activity"
else {
  Log.d("No PreferredActivity Found")
  chooser = Intent.createChooser(forward, …)
  chooser.putExtra(EXTRA_EXCLUDE_COMPONENTS, [ContactsPickerActivity])   // excludes itself
  startActivity(chooser)                                   // 0 handlers → "No apps can perform this action"
}
```

So the dead-end (**"No PreferredActivity Found" → empty chooser**) is reached **only when `handleIntent` returns false.** A faithful on-device reproduction (driving orbit's real "Import from Contacts") confirmed the forward fires **~7 ms after the picker process starts, with zero `ContactsViewModel` logs** — i.e. `handleIntent` returned false very early.

### Why the device-state remediation routes are dead (proven, not assumed)

Because the failure is `handleIntent` returning false — **not** a corrupted trampoline state or a missing default — the routes catalogued in `19-DEVICE-UAT-FINDINGS.md` cannot help:

- **Route 1 — `pm clear com.android.contactspicker`: TESTED on-device. No change** (identical "No PreferredActivity Found" → empty chooser).
- **Route 2 — reset/set a preferred activity:** moot. The forward's chooser targets `PICK_CONTACTS`, whose *only* handler is the trampoline itself (which it excludes). There is no other `PICK_CONTACTS` activity on the device to make a default. You cannot set a default to an app that doesn't exist.
- **Route 7 — multi-user/profile:** irrelevant; the trigger is intent validation, not a profile restriction.
- **An OS/Play-system update** *might* help only if it shipped a second `PICK_CONTACTS` handler — speculative, and unnecessary given the finding below.

### A working picker already exists on the device

Launching Google Contacts' own `ContactPickerActivity` (classic `android.intent.action.PICK`, `vnd.android.cursor.dir/contact`) **rendered a fully working multi-contact picker** ("Choose a contact", "All contacts · 421 contacts", real names). So the device is perfectly capable of picking contacts — only the new `PICK_CONTACTS` trampoline path is failing, and only for orbit's specific intent.

---

## The orbit-side discrepancy (root-cause candidate)

`handleIntent` reads the "use the new system picker" flag under key **`android.intent.extra.USE_SYSTEM_CONTACTS_PICKER`** (verified in the dex string table + read site).

Orbit was setting it under **`android.provider.extra.USE_SYSTEM_CONTACTS_PICKER`** (`OrbitContactPickerModule.kt`) — the **wrong namespace**. The trampoline therefore read the flag as its default (**false**) and forwarded to a non-existent legacy preferred picker → the dead end.

(Other keys orbit sends were verified **correct** against the dex: `PICK_CONTACTS_REQUESTED_DATA_FIELDS` = `android.provider.extra.*` ✓, `ALLOW_MULTIPLE` = `android.intent.extra.*` = `Intent.EXTRA_ALLOW_MULTIPLE` ✓, and all four requested mimetypes — phone/email/event/photo — are in the trampoline's `ACTION_PICK_CONTACTS_SUPPORTED` set, which is every type except `vnd.android.cursor.dir/contact`. The trampoline also validates a `PICK_CONTACTS_SELECTION_LIMIT` of 1..100 for multi-select; its default is 50, so absence was not fatal, but orbit now sets it explicitly = 100.)

### Fix applied — VERIFIED WORKING ON-DEVICE (2026-08-29)

`modules/orbit-contact-picker/android/.../OrbitContactPickerModule.kt`:
- `EXTRA_USE_SYSTEM_CONTACTS_PICKER` key → **`android.intent.extra.USE_SYSTEM_CONTACTS_PICKER`** (the operative fix).
- Set `android.provider.extra.PICK_CONTACTS_SELECTION_LIMIT = 100` on the multi-select path (defensive; the trampoline's default of 50 was already valid, so this is hardening, not the fix).

**Result: the Android-17 system contact picker now renders on the Pixel 6.** Rebuilt debug APK on `droid` (BUILD SUCCESSFUL, 8m43s), `install -r` (data preserved), drove orbit's real "Import from Contacts":
- On-device intent log confirmed runtime == source: `action=android.provider.action.PICK_CONTACTS multiple=true extras=[ALLOW_MULTIPLE, USE_SYSTEM_CONTACTS_PICKER, PICK_CONTACTS_SELECTION_LIMIT, PICK_CONTACTS_REQUESTED_DATA_FIELDS] fields=[phone_v2, email_v2, contact_event, photo]`.
- Top activity became `com.android.contactspicker/.ContactsPickerActivity` — **its own Compose UI**, not the intentresolver chooser.
- Rendered the real multi-select picker: contact rows with **checkboxes**, Search, Favorites, and the privacy banner **"Orbit will only have access to info from the contacts you select"** (names orbit — exactly Phase 19's permissionless design).
- **No** "No PreferredActivity Found", **no** empty chooser, **no** "No apps can perform this action".
- Dismissed without importing (no writes to orbit's DB); returned cleanly to `MainActivity`.

Phase 19's intended permissionless Android-17 path works on the owner's real hardware — **no OS update, no design change, no READ_CONTACTS**. The earlier "OS defect / wait for an OS update" hypothesis is disproven.

**Working-tree state (not yet committed):** the two-line source fix above is applied; the temporary `Log.i` diagnostic was removed after confirming runtime==source (source is clean). The **installed test APK still carries that Log.i line** (harmless, Info-level, no contact PII) — a clean rebuild before real UAT / release drops it. Left uncommitted for the owner to fold into the phase (e.g. a gap plan or into 19-17) and to push.

### What this unblocks / leaves open
- **19-17 (device UAT) is no longer picker-blocked.** All three tasks (picker launch/snapshot/cancel/re-invoke; review counts, cluster Combine, resume/discard; photo lifecycle + birthday validation) can now run against a real session on this device.
- The verified code-review defects in `19-DEVICE-UAT-FINDINGS.md` (#1 Events-as-birthday, #2 silent read-fail, #3 nameless-row resume nag) are still open and were **not** touched here.
- **Phase 19.1 (ADR-002 hybrid, older-Android `ACTION_PICK` path) is unaffected and still needed** for pre-17 devices — this fix is complementary, not a substitute. Note the incidental proof here that Google Contacts' `ACTION_PICK` picker renders fine on this device (useful for 19.1's design), but the ≤16 path remains its own phase.

---

## Infra / method notes
- Trampoline APK pulled to scratch; single `classes.dex`; disassembled with SDK `dexdump` (no network decompiler needed).
- Faithful repro requires a **real calling package** — `am start …/.ContactsPickerActivity` dies earlier at "Cannot get calling package. Finishing with RESULT_CANCELED", so it does **not** reproduce the real failure. Drive orbit's actual import to reproduce.
- `adb input tap` drives orbit fine (post-19-18). Speed-dial FAB at ~(1272,2924); a single tap toggles it — verify expanded state via `uiautomator dump` before tapping "Import from Contacts".
