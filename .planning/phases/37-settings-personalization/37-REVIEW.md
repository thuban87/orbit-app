---
phase: 37-settings-personalization
reviewed: 2026-09-14T00:00:00Z
depth: deep
files_reviewed: 40
files_reviewed_list:
  - src/db/app-settings-dao.test.ts
  - src/db/profile-dao.test.ts
  - src/db/profile-dao.ts
  - src/navigation/settings-routes.test.ts
  - src/navigation/settings-routes.ts
  - src/navigation/tabs/BackupStack.tsx
  - src/navigation/tabs/SettingsStack.tsx
  - src/navigation/types.ts
  - src/screens/backup-dualhome-logic.test.ts
  - src/screens/backup-dualhome-logic.ts
  - src/screens/BackupScreen.tsx
  - src/screens/RestorePreviewScreen.tsx
  - src/screens/RestoreResultScreen.tsx
  - src/screens/settings-about-model.ts
  - src/screens/SettingsAboutScreen.tsx
  - src/screens/settings-add-widget.ts
  - src/screens/settings-ai-hub-logic.test.ts
  - src/screens/settings-ai-hub-logic.ts
  - src/screens/SettingsAIScreen.tsx
  - src/screens/settings-appearance-background.test.ts
  - src/screens/settings-appearance-background.ts
  - src/screens/settings-appearance-persist.test.ts
  - src/screens/settings-appearance-persist.ts
  - src/screens/SettingsAppearanceScreen.tsx
  - src/screens/settings-contacts-model.test.ts
  - src/screens/settings-contacts-model.ts
  - src/screens/SettingsContactsScreen.tsx
  - src/screens/settings-hub-model.test.ts
  - src/screens/settings-hub-model.ts
  - src/screens/SettingsHubScreen.tsx
  - src/screens/settings-interactions-logic.test.ts
  - src/screens/settings-interactions-logic.ts
  - src/screens/SettingsInteractionsScreen.tsx
  - src/screens/settings-notifications-logic.test.ts
  - src/screens/settings-notifications-logic.ts
  - src/screens/SettingsNotificationsScreen.tsx
  - src/screens/SettingsOrreryScreen.tsx
  - src/stores/orrery-preferences-store.cross-surface.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-09-14
**Depth:** deep
**Files Reviewed:** 40
**Status:** issues_found

## Summary

Phase 37 decomposes the Settings monolith into per-category screens plus a
navigation-first hub, a dual-homed Backup tree, an About surface, and a self-name
writer. The work is unusually disciplined: writes route through DAOs (no inline
SQL in screens), colours resolve through theme tokens (grep found no hardcoded
hex/rgba), no `toISOString().split()` UTC bug, the shared orrery preference store
is the single writer for density/satellites (no second unsynchronized writer),
ADR-047/D-02 self-star-only colour is respected, and D-03 `CategoryManagement`
is correctly an inert reserved route with a test that asserts non-registration.
Local-first is intact — the AI hub's fresh-on-focus hydration reads only the
on-disk catalog cache and SecureStore, never a network call, and the master
toggle flips `ai_enabled` only.

No critical/blocker defects were found. The findings below are correctness
edge-cases in the persist-failure reconcile path, a misleading return-button
label in the dual-home flow, redundant duplicate writes on self-name commit, and
a handful of maintainability/test-fragility items.

No `<structural_findings>` block was provided, so this report is entirely
narrative findings.

## Warnings

### WR-01: Appearance persist double-failure leaves the theme store diverged from SQLite (and unhandled rejection)

**File:** `src/screens/settings-appearance-persist.ts:60-76`, `src/screens/SettingsAppearanceScreen.tsx:433-453`
**Issue:** The stated invariant is that a failed durable write must reconcile the
live store back to SQLite and never leave it diverged. `persistAppearanceSetting`
handles the single-failure case correctly (re-read → project → `hydrate`, return
`ok:false`). But the reconcile itself calls `deps.getAppSettings(exec)` inside the
`catch` with no guard: if that re-read also throws (a DB error that fails both the
write and the subsequent read is a realistic correlated failure, not purely
hypothetical), `persistAppearanceSetting` rejects. The caller `persist` in
`SettingsAppearanceScreen` awaits it with no `try/catch` and is invoked via
`void persist(...)`, so the rejection becomes an unhandled promise rejection AND
the theme store keeps the optimistic value the setter applied (e.g.
`setThemePackage`) while SQLite still holds the old value — the exact divergence
the helper was written to prevent. It is not self-healing: the theme store is
only ever re-hydrated inside this same reconcile path (`SettingsAppearanceScreen.tsx:437-438`),
never on screen focus, so the diverged state persists until app restart or a
later successful theme write.
**Fix:** Wrap the reconcile re-read so a double failure still returns `ok:false`
(and never rejects), e.g.:
```ts
} catch (error) {
  try {
    const durable = await deps.getAppSettings(exec);
    const selection = themeSelectionFromSettings(durable);
    deps.hydrateThemeStore(selection);
    return { ok: false, reconciledSelection: selection, error };
  } catch (reconcileError) {
    // Could not re-read to reconcile — still report failure, do not reject.
    return { ok: false, error };
  }
}
```
Additionally add a `try/catch` around the `await persistAppearanceSetting(...)`
call in the screen so no persist path can produce an unhandled rejection.

### WR-02: `RestoreResultScreen` return button is labelled "Return to Backup & Restore" but navigates to the Settings hub when host="settings"

**File:** `src/screens/RestoreResultScreen.tsx:24`
**Issue:** The button `onPress` correctly does
`navigation.reset({ ..., routes: [{ name: restoreReturnRouteName(host) }] })`,
which for `host="settings"` resets to the `Settings` hub (the intended
origin-aware behaviour). But both the visible label and `accessibilityLabel` are
the hardcoded string "Return to Backup & Restore" / "Return to Backup and
Restore". In the Settings-hosted flow the button sends the user to the Settings
directory, not to Backup & Restore, so the label misdescribes its destination —
confusing for sighted and screen-reader users alike.
**Fix:** Make the copy host-aware, mirroring `restoreReturnRouteName`, e.g. a
small helper `restoreReturnLabel(host)` returning "Return to Backup & Restore"
for `backup-tab` and "Return to Settings" for `settings`, and use it for both the
`Text` child and `accessibilityLabel`.

### WR-03: Self-name commit fires twice per edit (onEndEditing + onSubmitEditing) → duplicate writes and duplicate data-revision bumps

**File:** `src/screens/SettingsAppearanceScreen.tsx:808-809`, `src/db/profile-dao.ts:92-124`
**Issue:** The self-name `TextInput` wires `onEndEditing={() => void onCommitSelfName()}`
and `onSubmitEditing={() => void onCommitSelfName()}`. On Android, pressing the
"done" key (returnKeyType="done") fires `onSubmitEditing` and then blurs the
field, firing `onEndEditing` as well — so a single confirmed edit runs
`setProfileName` twice. Each call opens a write transaction, rewrites
`modified_at`, and calls `bumpDataRevisionCore`, so one user action advances the
export/backup data revision twice. That inflates the revision counter that the
backup-nudge logic compares (`BackupScreen` reload: `currentDataRevision` vs
`lastBackupDataRevision`), i.e. a no-op re-commit can mark data as "changed since
last backup". Correctness of the stored name is unaffected (idempotent), but the
redundant transaction and double revision bump are avoidable.
**Fix:** Commit from a single event, or guard against a redundant write when the
draft equals the last-persisted `selfName` (skip the DAO call when
`selfNameDraft.trim() === (selfName ?? "")`). Committing only on
`onEndEditing` (blur) is the simplest fix since submit also blurs.

### WR-04: `SettingsAppearanceScreen.persist` cannot surface a re-read/reconcile failure to the user

**File:** `src/screens/SettingsAppearanceScreen.tsx:433-453`
**Issue:** Related to WR-01 but worth calling out on its own: `persist` only
renders the inline save-error notice when `persistAppearanceSetting` *resolves*
with `!result.ok`. Any thrown error (from the reconcile re-read, or a future
change to the helper) is neither logged nor surfaced here — it silently escapes.
The sibling non-theme writers in the same screen (`onPickStarColour`,
`onPickSunOccupant`, `onSelectGlobalTemplate`, `onCommitSelfName`) all wrap their
awaited DAO call in `try/catch` + `Logger.error`; `persist` is the one write path
that does not, which is inconsistent and hides failures.
**Fix:** Add a `try/catch` around the `await persistAppearanceSetting(...)` call
that logs via `Logger.error(LOG_SCOPE, ...)` and sets `saveError`, matching the
other handlers in this screen.

## Info

### IN-01: Raw NUL byte embedded in a test string literal instead of an explicit escape

**File:** `src/db/profile-dao.test.ts:92`
**Issue:** The "rejects a name containing control characters" test uses the
literal `"Ada Lovelace"` which actually contains a raw NUL byte between "Ada" and
"Lovelace" (verified via `od -c`: `A d a \0 L o v e l a c e`). The test is
functionally correct (NUL is a C0 control char, so `hasControlChar` rejects), but
an invisible embedded NUL in source is fragile: many editors, formatters, and
copy/paste operations silently strip or mangle NUL bytes, which would turn this
into a false pass (the string becomes "AdaLovelace", a valid name, and
`rejects.toThrow()` would then fail — or worse, a different mutation could make it
pass for the wrong reason). Biome/prettier passes may also normalize it away.
**Fix:** Use an explicit escape: `setProfileName(exec, "Ada Lovelace", LATER)`
so the control character is visible and stable in source.

### IN-02: `BackupSettingsHostRoute` is misnamed — it renders the Backup landing, not BackupSettings

**File:** `src/navigation/tabs/SettingsStack.tsx:158-160, 205`
**Issue:** The wrapper registered for the Settings-stack `Backup` route is named
`BackupSettingsHostRoute` but renders `<BackupScreen host="settings" />` (the
Backup landing screen). The actual `BackupSettings` screen is registered
separately on line 206 with the unwrapped `BackupSettingsScreen`. The name
invites a maintainer to confuse the two Backup-related screens.
**Fix:** Rename to `BackupHostRoute` (parallel to `BackupTabRoute` in
`BackupStack.tsx`).

### IN-03: Duplicate `settings-dev-theme-preview-row` testID across two screens

**File:** `src/screens/SettingsHubScreen.tsx:82` and `src/screens/SettingsAppearanceScreen.tsx:502`
**Issue:** Both the hub and the Appearance screen render a dev-only Pressable with
`testID="settings-dev-theme-preview-row"`. Guarded by `__DEV__` so it never ships,
but if both screens are ever mounted in one test tree a `getByTestId` lookup would
throw on the duplicate.
**Fix:** Give each a distinct testID (e.g. `-hub` / `-appearance` suffix), or
drop the row from one surface.

### IN-04: `settings-routes.test.ts` uses substring matching for registration

**File:** `src/navigation/settings-routes.test.ts:23-25`
**Issue:** `isRegistered` checks `COLLAPSED.includes('<Stack.Screen name="X"')`.
The trailing `"` prevents prefix collisions today (e.g. `Backup` does not match
`BackupSettings`), so it is currently correct. But it would also match a route
name appearing inside a comment or string rather than a real JSX registration.
Low risk given the collapsed-source approach; noting for durability.
**Fix (optional):** Anchor on the `component=` that follows, or parse the JSX,
if this check is extended to more routes.

---

_Reviewed: 2026-09-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
