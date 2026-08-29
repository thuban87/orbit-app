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

**Cascade:** Because every 19-17 scenario is picker-fed, this blocks the **entire** 19-17 device UAT:
- **Task 1** (picker launch / snapshot / cancel→no session / re-invoke): directly blocked.
- **Tasks 2-3** (review counts, cluster Combine, resume/discard, photo lifecycle, birthday validation): transitively blocked — no real session can be created. Faithful DB-seeding as a workaround is also impractical here: **there is no `sqlite3` binary on the device**, so seeding would require pull→edit→push DB surgery (WAL) producing only synthetic-input findings. Not pursued (low confidence, high effort, phase can't sign off regardless).

---

## 📋 For the ONE consolidated gap-planning session

1. **No additional orbit *code* defects were found beyond 19-18 / 19-19.** The 19-12→19-16 fixes remain **node-verified (1696 vitest, tsc, colours green)**; their **device** proof is **deferred** until the OS picker works.
2. **The picker block is an OS/device item, not a code gap** — it does not belong in the code gap-planning session; it is a separate "get a working Android 17 picker" thread the owner drives.
3. **Once the picker works**, run the full 19-17 (all 3 tasks) — importing from the owner's real contacts (owner-approved), cleaning up orbit-side copies after. Candidate test data already identified: cluster/Combine pair "Grandma Joy" + "Joyce Milligan" (shared phone); 63 phone+email contacts; photo contact "Shamiran Azo".
4. **Open question for the owner:** whether to (a) attempt OS remediation on this device, (b) source a different working Android 17 device, or (c) reassess reliance on the brand-new picker given it is non-functional on the owner's actual hardware. (Owner's `AskUserQuestion` selection leaned "investigate the OS picker further," then owner pivoted to "pin it and batch the rest.")

---

## Infrastructure notes (for the eventual real UAT)
- **adb `input tap` DOES drive React Native** on this device (prior "pointer injection dead" was the scrim). Caveat: high header targets (e.g. Settings ⚙ at y≈105) hit the **status-bar inset** — tap lower in the a11y bounds (y≈160).
- **No on-device `sqlite3`.** For DB inspection, pull via `adb exec-out run-as com.bwales.orbit cat files/SQLite/orbit.db` (+ `-wal`, `-shm`) and read on the Linux box with `node:sqlite`. DB path: **`files/SQLite/orbit.db`** (122 KB + WAL), user data present.
- **Metro:** orbit runs on **:8082** (quest-board owns :8081); device reverse routes both 8081→8082 and 8082→8082 to orbit's Metro. Force-stop + relaunch pulls a fresh bundle; the dev-menu "Reload" (native, tappable) forces it.
- **Rebuild pipeline** (native changes): sync (tar-over-ssh) → `expo prebuild --clean` (`set "CI=1"`) → `gradlew.bat assembleDebug` on droid → `install -r`. ~7 min.
