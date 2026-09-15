---
status: passed
phase: 37-settings-personalization
source: [37-VERIFICATION.md]
started: 2026-09-14T22:25:00Z
updated: 2026-09-14T23:10:00Z
device: Pixel 6 Pro (1A071FDEE002BU), debug build + Metro, driven via adb
---

## Current Test

number: 7
name: complete
expected: |
  All 7 device-UAT items exercised on the Pixel 6 Pro. All passed.
awaiting: none

## Tests

### 1. Navigation parity across all 8 categories
expected: No control lost vs the retired monolith; each category screen renders and its rows act as before (navigation parity).
result: pass
notes: Hub renders all 8 categories in §A order (Appearance, Contacts & Relationships, Interactions, Notifications, Orrery, Data & Backup, AI, About Orbit) + the "Add Orbit widget" action row. Each category screen opened and rendered its migrated controls. A dev-only "Background failure test harness" row appears at the top of the hub — confirmed `__DEV__`-gated (SettingsHubScreen.tsx:80), so it will not appear in release builds.

### 2. Appearance — instant restyle + durable relaunch
expected: Instant whole-app restyle with no jank; selection survives a force-quit + cold relaunch.
result: pass
notes: Mode Light↔Dark flipped the entire shell (content + tab bar) live. Set Galaxy+Dark, force-quit, cold relaunch → Appearance still showed Galaxy + Dark (durable app_settings). The sub-second "no theme flash before first paint" is the one nuance a screenshot at T+12s can't fully prove; persisted selection is honored on launch.

### 3. Contacts & Relationships — OS permission handoff
expected: Denied state shows an actionable Open-system-settings handoff; capabilities stay visible.
result: pass
notes: Revoked READ_CONTACTS → row showed "Contacts access is off … can't read your phone contacts until access is granted" with an "Allow Contacts access" action and Import/Check-linked/Review still visible. Tapping the action launched the OS GrantPermissions dialog. Re-granted to restore state. Contacts screen also confirmed: Archived row present, NO Category Management row (D-03).

### 4. Notifications — OS schedule re-arm + raw permission row
expected: Schedule re-arms immediately without restart; raw permission row independent of master toggle.
result: pass
notes: All 10 controls present. Permission row is independent of the master toggle and shows the OS state honestly (denied → "Your phone is blocking Orbit's notifications … Open system settings"; granted → "…can be delivered"), reading fresh on focus. Toggling the master ON (no restart) armed 18 RTC_WAKEUP alarms for com.bwales.orbit (0 → 18); toggling OFF cancelled them (18 → 0). Restored to original (master off, POST_NOTIFICATIONS denied).

### 5. Orrery — single-source cross-surface agreement
expected: Settings and the Orrery agree through one preference source, no divergence.
result: pass
notes: Set Density = Compact in Settings → Orrery's own View options independently showed "Compact — Selected" (+ Satellites On). Changing back to Balanced from the Orrery side also reflected. Single `useOrreryPreferencesStore`, no duplicate model. Restored to Balanced.

### 6. Data & Backup — dual-home return + single-drain
expected: One canonical tree from both entries; origin-aware post-restore return; Settings copy has Back; shared-backup consumed once.
result: pass (structural/chrome on-device; restore-return + single-drain by unit test)
notes: Backup TAB renders "Backup & Restore" with title-only root chrome (no Back). Settings → Data & Backup renders the SAME tree with a Back affordance (child chrome) that returns to the Settings hub (origin-aware). Both reach the one canonical tree. The full destructive restore-return (Backup→Backup vs Settings→Settings) and shared-backup single-drain were NOT run on-device (a restore mutates data and the SAF folder currently needs reconnecting — a pre-existing, non-Phase-37 issue); these are covered by the 9 passing backup-dualhome-logic unit tests.

### 7. About Orbit — render
expected: Real product name + expo-constants version; no build number, no dead placeholder rows.
result: pass
notes: Shows "Orbit" (not the app.json scaffold value) and "Version 1.0.0" (expo-constants). No build number, no license/support/privacy placeholder rows.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- None blocking. Residual (not a defect): the full destructive Data & Backup restore-return and shared-backup single-drain were verified by unit test only, not exercised on-device (would mutate data + needs a reconnected SAF folder + a backup file). Offer belt-and-suspenders on request.
- Pre-existing (not Phase 37): `src/components/orrery/orrery-controls-render.test.tsx` fails to transform (Phase 29); the Backup "folder needs reconnecting" SAF-grant state is a known prior issue.
