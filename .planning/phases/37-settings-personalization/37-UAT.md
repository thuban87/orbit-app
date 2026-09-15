---
status: testing
phase: 37-settings-personalization
source: [37-VERIFICATION.md]
started: 2026-09-14T22:25:00Z
updated: 2026-09-14T22:25:00Z
---

## Current Test

number: 1
name: Navigation parity — open every category from the Settings hub
expected: |
  Every control that lived in the old 2,168-line monolith is present and functional
  across all 8 category screens (Appearance, Contacts & Relationships, Interactions,
  Notifications, Orrery, Data & Backup, AI, About). No control lost; each screen
  renders and its rows act as before.
awaiting: user response

## Tests

### 1. Navigation parity across all 8 categories
expected: No control lost vs the retired monolith; each category screen renders and its rows act as before (navigation parity).
result: [pending]

### 2. Appearance — instant restyle + durable relaunch
expected: Changing theme package / mode / accent / background restyles the whole app immediately with no React-state-driven jank, and the selection survives a force-quit + cold relaunch (durable app_settings, restore-before-paint).
result: [pending]

### 3. Contacts & Relationships — OS permission handoff
expected: With OS Contacts permission denied, the permission row shows an actionable Open-system-settings handoff (no silent re-prompt loop); granted shows status; capabilities stay visible with explanation.
result: [pending]

### 4. Notifications — OS schedule re-arm + raw permission row
expected: Toggling a schedule-affecting control (Decay / Birthday / Weekly digest / Reminder time / Quiet hours) re-arms the OS notification schedule immediately without an app restart, and controls reflect the durable re-read; the raw-permission row is independent of the master toggle and offers a handoff when OS-denied.
result: [pending]

### 5. Orrery — single-source cross-surface agreement
expected: Changing Orrery density/satellites from Settings is reflected immediately when opening the Orrery, and vice versa — both surfaces agree through the single useOrreryPreferencesStore committed value, with no divergence or duplicate preference model; hydration/saving/error/retry UI states behave.
result: [pending]

### 6. Data & Backup — dual-home return + single-drain
expected: Data & Backup opens from BOTH the Backup tab and Settings → Data & Backup (one canonical tree); a restore from each entry returns origin-aware (Backup tab → Backup, Settings → Settings hub); the Settings copy exposes a Back affordance; a shared-backup share-intent is consumed once (no double-drain).
result: [pending]

### 7. About Orbit — render
expected: Renders the real product name (Orbit, not the app.json scaffold value) and the semantic version from expo-constants; no build number, no dead license/support/privacy placeholder rows.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
