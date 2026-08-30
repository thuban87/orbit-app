# Phase 19 — First Device UAT: Consolidated Findings

**Date:** 2026-08-29 · **Device:** Pixel 6 Pro `1A071FDEE002BU`, Android 17 (`raven:17/CP2A.260705.006`, API 37, patch 2026-07-05)
**Context:** This was the **first time phase-19 work (19-12→19-16) ran on hardware** — the prior session never got past a touch-input blocker, so nothing downstream was ever exercised. Per owner direction, once a cascade of issues appeared we switched to **discovery/catalogue mode**: pin blockers, catalogue everything, and resolve in **one** consolidated gap-planning session rather than fix→rebuild→fix→rebuild.

---

## ✅ FIXED this session (already committed + verified — not gap-session items)

| Plan | Defect | Root cause | Fix | Verification |
|------|--------|-----------|-----|-------------|
| **19-18** | Dashboard totally untappable (adb **and** finger) except the FAB | `AddSpeedDialFab` full-screen scrim: `absoluteFill` Pressable, always mounted, `pointerEvents="auto"`, only animates opacity (opacity-0 ≠ no-touch in RN). Regression from 19-04 (`57acb93`). | Gate scrim/option `pointerEvents` on collapsed state via a pure helper; mirror `expanded` shared value into React state. Commit `33eefd7`. | Device-verified: chips, Settings, contact nav, FAB expand/collapse all respond. 1696 vitest green. |
| **19-19** | Import picker unreachable — app landed on system resolver "No apps can perform this action" | Android 11+ package-visibility: app (targetSdk 36) declared no `<queries>` for the contact-pick intent, so `com.android.contactspicker` was invisible; `am start` (shell, exempt) worked, app didn't. 19-12 fixed the action but not visibility. | Scoped `<queries>` for `PICK_CONTACTS` + `ACTION_PICK`/contacts in the picker module manifest; no new permission. Commit `17f41d2`. Native rebuild done. | Device-verified via logcat: the app now **launches `ContactsPickerActivity`** (previously couldn't reach it at all). |

> These two were **prerequisites to test anything at all** (without them the app is untappable / the picker unreachable), so they were fixed in-session, not deferred.

---

## ⛔ BLOCKER — Android 17 system contact picker is broken at the OS/device level (NOT orbit code)

**Symptom:** With 19-19 applied, the app successfully launches the OS `ContactsPickerActivity`, which then logs **`No PreferredActivity Found`** and bounces to an **empty system Chooser** (`ChooserActions: android.provider.action.PICK_CONTACTS is not supported`, `getDisplayResolveInfoCount() == 0`) → "No apps can perform this action."

**Evidence (logcat):**
```
START ... act=android.provider.action.PICK_CONTACTS cmp=com.android.contactspicker/.ContactsPickerActivity ... from uid ...(com.bwales.orbit)
ContactsPickerActivity: No PreferredActivity Found
START ... act=android.intent.action.CHOOSER ... from uid ...(com.android.contactspicker)
ChooserActions: android.provider.action.PICK_CONTACTS is not supported.
ChooserListAdapter: getDisplayResolveInfoCount() == 0
```

**Established facts:**
- The app's picker usage **matches the official Android 17 docs** (action `ACTION_PICK_CONTACTS`, `EXTRA_USE_SYSTEM_CONTACTS_PICKER`, `EXTRA_PICK_CONTACTS_REQUESTED_DATA_FIELDS`, multi-select via `Intent.EXTRA_ALLOW_MULTIPLE`). Verified against live `developer.android.com/about/versions/17/features/contact-picker`.
- `com.android.contactspicker` is a **privileged system app** (`/system/priv-app`, v17/API37); Google Contacts is **installed, enabled, and the default** (`SYSTEM_CONTACTS` role), updated 2026-08-19, targetSdk 37 — **not** stale.
- **Both** the new `PICK_CONTACTS` **and** the classic `ACTION_PICK` (contacts) route through the same trampoline and dead-end identically — for **any** app, not just orbit.

**Conclusion:** The brand-new Android 17 system contact picker is **non-functional on this device/build**. This is not fixable in orbit code — it is an **OS/device thread** (candidate remediations: OS/Play-system update, a different Android 17 device, or Google's fix landing in a later build). This is exactly the risk the phase RESEARCH flagged ("MEDIUM confidence — brand-new 2026 picker, verified against docs but not a device").

**Reboot remediation attempted (2026-08-29) — did NOT fix it.** A full `adb reboot` (device has no secure lock, so no PIN-strand risk) reproduced the exact same failure (`No PreferredActivity Found` → empty chooser). So it is a **persistent** defect, not a transient cache.

**Correction on the theory (owner input):** "wait for a Google OS fix" is a *weak* hypothesis — the owner updated this Pixel ~2 weeks ago and a targeted OS fix for this is unlikely. The more probable, **actionable** cause is a **corrupted/misconfigured picker-app state** — the same shape as the Phase-18.1 restore blank-picker, which was a corrupted DocumentsUI cleared by `pm clear com.google.android.documentsui` (see memory `saf-grant-reconnect-cycle` / STATE.md Phase-18.1 note). `No PreferredActivity Found` points at a missing/broken **preferred-activity / delegation** association, not necessarily an OS bug.

### Android-17 picker — remediation routes to try (part of finishing Phase 19)
Ordered cheapest/most-likely first. Most are adb-doable without the owner; a few need the device or the desktop.
1. **`pm clear com.android.contactspicker`** (the trampoline) — then relaunch and re-test. Direct analog of the DocumentsUI blank-picker fix. Cheapest, highest-value. *(Also `pm clear com.google.android.contacts` — heavier: re-syncs the owner's contacts; low risk since synced, but do the trampoline first.)*
2. **Inspect/reset preferred-activity + defaults:** `pm get-preferred-activities`, `dumpsys package preferred-activities`; try clearing/resetting the contacts default so the trampoline can bind a downstream picker. `No PreferredActivity Found` is literally about this.
3. **Dig the trampoline's delegation intent:** deeper logcat on `com.android.contactspicker` to see *what* intent it fires when it can't find a preferred activity — reveals which downstream handler is missing.
4. **Google Contacts / Play-system update (distinct from an OS OTA):** the picker delegation may be a Mainline/Play-system component or a Contacts version/feature-flag; check the Play system-update level and update Google Contacts (incl. beta) — this is more plausible than an OS OTA and partly driveable.
5. **Third-party sample test:** run a known Android-17 contact-picker sample app on the Pixel 6 — if it *also* dead-ends, it's device-wide (confirming not-orbit); if it works, re-examine orbit's intent.
6. **Fresh Android-17 emulator on `droid`** (the Windows desktop can run emulators; this Linux box can't): a stock Google Android-17 image isolates device-specific vs. universal-broken and gives a working picker to test the 17 path against.
7. **Multi-user/profile check:** the trust dump showed user flags; rule out a work-profile/restriction interfering with the delegation.

If none pan out, the ≤16 path (Phase 19.1) still delivers a working import + covers the shared downstream on the 3a; only the Android-17-picker-specific launch/snapshot stays open.

**Cascade:** Because every 19-17 scenario is picker-fed, this blocks the **entire** 19-17 device UAT:
- **Task 1** (picker launch / snapshot / cancel→no session / re-invoke): directly blocked.
- **Tasks 2-3** (review counts, cluster Combine, resume/discard, photo lifecycle, birthday validation): transitively blocked — no real session can be created. Faithful DB-seeding as a workaround is also impractical here: **there is no `sqlite3` binary on the device**, so seeding would require pull→edit→push DB surgery (WAL) producing only synthetic-input findings. Not pursued (low confidence, high effort, phase can't sign off regardless).

---

## 🔎 Code-review findings (import subsystem) — for the gap-planning session

A subsystem-level review (full files, all shared-table writers) of 19-12→19-16 + the import screens. Each item below the "verified" line was **re-confirmed against the code by the planner** (not taken from the reviewer's summary); the low items are reviewer-reported and consistent but not independently re-verified line-by-line.

**Verified (planner-confirmed against source):**

1. **[MED-HIGH] Non-birthday Android Events stored as `contacts.birthday`** — `OrbitContactPickerModule.kt:149-150` (mapping) + `:117-123` (projection).
   The picker requests the Event data field and maps **any** Event's `DATA1` straight to `contact.birthday` with **no `Event.TYPE`/`DATA2` filter** (DATA2 isn't even in the projection). So an **anniversary** or custom Event is stored as a birthday (and if a contact has both, cursor order decides — anniversary can beat the real birthday). Worst on the **bulk** path, which has no birthday review UI. The value is a valid date so `isValidStoredBirthday` passes it. → Add `Event.TYPE`(DATA2) to the projection and only accept `TYPE_BIRTHDAY`. *(Not reachable until the OS picker works, but a real data-integrity bug in the picker mapping — 19-12 area.)*

2. **[MED] A picker read-exception silently discards the whole selection** — `OrbitContactPickerModule.kt:107-113` + `import-acquire.ts:161`.
   `readPickedContacts` failures are caught into `promise.resolve(emptyList())`; `routePickedImport` then sees `length===0` and returns with no session and **no error** — indistinguishable from a cancel. A partial/degraded read looks like "nothing selected." → Distinguish read-failure from cancel and surface an error.

3. **[LOW-MED] Permanently-`failed` rows nag the resume prompt every launch** — `import-session-dao.ts:418-423` + `import-session-read.ts:101-108`.
   `finalizeSessionIfTerminal` counts `'failed'` as unresolved, so a session with a row that can only ever be `failed` (e.g. a **nameless** picked contact → name-required) stays `status='pending'` forever; `getResumableSession` offers the newest pending session every launch. Retry re-fails, Done doesn't complete — **only Discard exits.** → Provide a way to skip/terminalize an unrecoverable row, or auto-terminalize name-required.

**Reviewer-reported low (consistent; confirm during gap planning):**

4. **[LOW]** `ImportProgressScreen` remount can run two concurrent `runImportBatch` passes over one session (dev StrictMode / fast remount) → a spurious `failed` row (the `external_contact_links` partial-UNIQUE prevents a duplicate contact). No per-session in-flight guard. `ImportProgressScreen.tsx:22-52`.
5. **[LOW]** Link-via-DuplicateReview persists `match_outcome='needs_review'` on a `linked` row, contradicting the DAO's transition table (no functional impact — counts bucket `linked` regardless). `DuplicateReviewScreen.tsx:196-199`.
6. **[LOW]** Unparseable Android birthday formats (e.g. `MM/DD/YYYY`) are silently dropped by `picked-contact-map.ts:28-38` (only `--MM-DD`/`MM-DD`/`YYYY-MM-DD` handled). Pairs with #1 — the Android birthday field is both over-inclusive (wrong types) and under-inclusive (formats). Worth a conscious decision.
7. **[LOW]** After a cluster Combine, the non-primary row's staged photo lingers until the next launch sweep deletes it (self-healing; transient orphan only). `source-consolidation.ts:193,252-259`.

**Confirmed SOUND (no action):** birthday validation is triple-gated (review `canImport` + `normalizeEditedBirthday` + DAO/`combineCluster` re-gate); cluster-only consolidation avoids the "Import 0 / disabled" trap and doesn't prematurely complete mixed batches; transaction atomicity (contact+links+provenance+row in one tx, photos post-commit); all import writers go through the shared `createContactFullCore` seam (no `contacts` invariant divergence); photo-staging lifecycle retain-on-failure is correct; **no `toISOString().split()` UTC bug** anywhere; Kotlin cursor/stream/temp-file handling is leak-free.

> **Note the overlap the batch approach catches:** #1 and #6 are the *same* subsystem (Android birthday mapping) — fix them together. #1/#2 are both in the Kotlin picker module (one native change → one rebuild). None of these conflict with 19-18/19-19.

## 📋 Consolidated next steps

1. **Code gap-planning session** should address the code-review findings above (primarily #1–#3; batch #1+#6, and #1+#2 as one native/module change). The 19-12→19-16 fixes otherwise remain **node-verified**; their **device** proof is deferred until the OS picker works.
2. **The picker block is an OS/device item, not a code gap** — separate "get a working Android 17 picker" thread the owner drives. **Reboot was tried and did not help** (see above); remaining OS remediations need the owner at the device.
3. **Once the picker works**, run the full 19-17 (all 3 tasks) — importing from the owner's real contacts (owner-approved), cleaning up orbit-side copies after. Candidate test data already identified: cluster/Combine pair "Grandma Joy" + "Joyce Milligan" (shared phone); 63 phone+email contacts; photo contact "Shamiran Azo".
4. **Open question for the owner:** whether to (a) attempt OS remediation on this device (update needs you present), (b) source a different working Android 17 device, or (c) reassess reliance on the brand-new picker given it is non-functional on the owner's actual hardware.

---

## Infrastructure notes (for the eventual real UAT)
- **adb `input tap` DOES drive React Native** on this device (prior "pointer injection dead" was the scrim). Caveat: high header targets (e.g. Settings ⚙ at y≈105) hit the **status-bar inset** — tap lower in the a11y bounds (y≈160).
- **No on-device `sqlite3`.** For DB inspection, pull via `adb exec-out run-as com.bwales.orbit cat files/SQLite/orbit.db` (+ `-wal`, `-shm`) and read on the Linux box with `node:sqlite`. DB path: **`files/SQLite/orbit.db`** (122 KB + WAL), user data present.
- **Metro:** orbit runs on **:8082** (quest-board owns :8081); device reverse routes both 8081→8082 and 8082→8082 to orbit's Metro. Force-stop + relaunch pulls a fresh bundle; the dev-menu "Reload" (native, tappable) forces it.
- **Rebuild pipeline** (native changes): sync (tar-over-ssh) → `expo prebuild --clean` (`set "CI=1"`) → `gradlew.bat assembleDebug` on droid → `install -r`. ~7 min.
