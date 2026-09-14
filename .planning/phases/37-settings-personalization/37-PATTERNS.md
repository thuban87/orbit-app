# Phase 37: Settings & Personalization - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 9 new/modified (2 nav files modified; 6+ new screen files; 1 DAO extended)
**Analogs found:** 9 / 9 (all in-repo; this is a relocation phase, no external precedent needed)

> Every excerpt below was read on disk this session and the file:line verified against
> the actual code (not the RESEARCH line ranges, not a diff). Where RESEARCH cited a
> range, it was re-opened and confirmed.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/navigation/types.ts` (MODIFY: add category + Backup route names to `SettingsStackParamList`) | route (type) | request-response (nav) | existing `SettingsStackParamList` AI-leaf entries (types.ts:229-300) | exact (same file, additive) |
| `src/navigation/tabs/SettingsStack.tsx` (MODIFY: register new `<Stack.Screen>` + wrappers) | route (registration) | request-response (nav) | AI-leaf `<Stack.Screen>` + `*Route` wrappers (SettingsStack.tsx:50-109) | exact |
| `src/screens/SettingsHubScreen.tsx` (NEW navigation-first directory) | screen | request-response (nav-only, no live values) | `SettingsScreen.tsx` (row/navigate idiom) + AI leaf screen shell | role-match |
| `src/screens/SettingsAppearanceScreen.tsx` (NEW category) | screen | CRUD (theme/profile-default/self prefs) | `AIPermissionsScreen.tsx` (leaf shell) + `SettingsScreen.tsx` `persist()` | role-match |
| `src/screens/SettingsContactsScreen.tsx` (NEW category) | screen | request-response (navigate to managers) | `AIPermissionsScreen.tsx` + SettingsScreen row idiom | role-match |
| `src/screens/SettingsInteractionsScreen.tsx` (NEW category; D-04a/c) | screen | CRUD (app_settings prefs) | `SettingsScreen.tsx` `persist()` write path | role-match |
| `src/screens/SettingsNotificationsScreen.tsx` (NEW category) | screen | CRUD + event-driven (reconcile) | `SettingsScreen.tsx:501-520` persist+reconcile | exact (carry write path verbatim) |
| `src/screens/SettingsOrreryScreen.tsx` (NEW category) | screen | CRUD (density/satellites) + nav (Systems) | `SettingsScreen.tsx` persist + SystemsManagement nav | role-match |
| `src/screens/SettingsAboutScreen.tsx` (NEW; §K) | screen | static (app name/version/licenses) | AI leaf screen shell | partial (no live-data analog) |
| `src/db/profile-dao.ts` (MODIFY: add `setProfileName`) | model/DAO | CRUD (single-row `profile` UPDATE) | `setProfilePhoto` (profile-dao.ts:38-61) | exact |

**Backup dual-home (D-08) is NOT a new file** — it is four route names registered in the two nav files above. Analog: `BackupStack.tsx:10-18`.

## Pattern Assignments

### `src/navigation/types.ts` — add route names (route type)

**Analog:** the AI-leaf block already in `SettingsStackParamList`.

**Exact shape to extend** (types.ts:229-300, VERIFIED):
```typescript
export type SettingsStackParamList = {
  Settings: undefined;
  AIConnection: undefined;
  AIModelPicker: { lane: AiCloudProviderId };
  AIPersonalization: { focus?: "writing-style" | "personalization" } | undefined;
  AIPermissions: undefined;
  AIPreview: undefined;
  // … SystemsManagement / CustomFields / Archived / Profile already present …
};
```

New additive entries follow the same `RouteName: undefined;` form (category screens take no params):
```typescript
  SettingsAppearance: undefined;
  SettingsContacts: undefined;
  SettingsInteractions: undefined;
  SettingsNotifications: undefined;
  SettingsOrrery: undefined;
  SettingsAbout: undefined;
  // D-08 Backup dual-home: same names already in BackupStackParamList (types.ts:~205-227).
  // Register them here too — RootStackParamList is a TYPE INTERSECTION (types.ts:314-317),
  // so each hosting stack must list the routes it can reach:
  Backup: undefined;
  BackupSettings: undefined;
  RestorePreview: RestorePreviewRoute;      // { token; preview } — serializable (backup-restore-logic.ts:5-8)
  RestoreResult: { /* … existing RestoreResult param shape, types.ts:220-226 … */ };
  // D-03 Categories RESERVATION: hold the route name only, render NO row (§K):
  CategoryManagement: undefined;
```
Precedent for "register a route you host via Profile even though its home is another stack" is already in this file (types.ts:245-299 registers LogContact/ThingsToRemember/EditInteraction/Group* "because Profile is hosted in Settings … RootStackParamList is a TYPE intersection"). Backup dual-home is the identical move.

---

### `src/navigation/tabs/SettingsStack.tsx` — register screens (route registration)

**Analog:** AI-leaf `*Route` wrapper functions + `<Stack.Screen>` block.

**Wrapper pattern** (SettingsStack.tsx:50-93, VERIFIED) — leaf screens take an `onBack` prop, the wrapper supplies it from `navigation.goBack()`:
```typescript
function AIPermissionsRoute({ navigation }: SettingsScreenProps<"AIPermissions">) {
  return <AIPermissionsScreen onBack={() => navigation.goBack()} />;
}
```
Category screens that also navigate onward pass typed navigators, exactly like:
```typescript
function AIConnectionRoute({ navigation }: SettingsScreenProps<"AIConnection">) {
  return (
    <AIConnectionScreen
      onBack={() => navigation.goBack()}
      onChooseModel={(lane) => navigation.navigate("AIModelPicker", { lane })}
    />
  );
}
```

**Registration block** (SettingsStack.tsx:95-109, VERIFIED) — additive, `initialRouteName="Settings"` and `headerShown:false` stay (screens render their own chrome):
```typescript
<Stack.Navigator initialRouteName="Settings" screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Settings" component={SettingsHubScreen} />   {/* hub replaces monolith at this name */}
  <Stack.Screen name="SettingsAppearance" component={SettingsAppearanceRoute} />
  <Stack.Screen name="SettingsContacts" component={SettingsContactsRoute} />
  {/* … one per category … */}
  {/* D-08: import the four existing Backup screens (as BackupStack does) and register them */}
  <Stack.Screen name="Backup" component={BackupScreen} />
  <Stack.Screen name="BackupSettings" component={BackupSettingsScreen} />
  <Stack.Screen name="RestorePreview" component={RestorePreviewScreen} />
  <Stack.Screen name="RestoreResult" component={RestoreResultScreen} />
</Stack.Navigator>
```
> **Preserve the `Settings` route name** — deep-link + back-stack safe (§M). The hub screen mounts under the existing `Settings` name; do not invent a new name for it.

---

### `src/navigation/tabs/BackupStack.tsx` — the dual-home source of truth (D-08)

**Analog (copy the import + registration verbatim into SettingsStack)** — BackupStack.tsx:1-18, VERIFIED:
```typescript
import { BackupScreen } from "@/screens/BackupScreen";
import { BackupSettingsScreen } from "@/screens/BackupSettingsScreen";
import { RestorePreviewScreen } from "@/screens/RestorePreviewScreen";
import { RestoreResultScreen } from "@/screens/RestoreResultScreen";
// …
<Stack.Screen name="Backup" component={BackupScreen} />
<Stack.Screen name="BackupSettings" component={BackupSettingsScreen} />
<Stack.Screen name="RestorePreview" component={RestorePreviewScreen} />
<Stack.Screen name="RestoreResult" component={RestoreResultScreen} />
```
The four screens take only `navigation`/`route` and self-fetch, so they mount unchanged in a second stack. **Two hazards ride along (see Shared Patterns → Backup dual-home).** Tab stays; this only adds an entry point (§R).

---

### `src/db/profile-dao.ts` — add `setProfileName` (DAO/model, CRUD)

**Analog:** `setProfilePhoto` in the SAME file (profile-dao.ts:38-61, VERIFIED). This is the single-row `profile` table (`id=1`), **NOT `contacts`** — RESEARCH Pitfall 1, confirmed against migration 001 DDL.

**Pattern to mirror exactly** (one `inWriteTransaction`, `?`-bound UPDATE `WHERE id = 1`, `changes===1` loud-fail guard, `bumpDataRevisionCore`):
```typescript
export async function setProfileName(
  exec: SqlExecutor,
  name: string,
  now: string,
): Promise<void> {
  // V5 input validation (Security): bound length + reject control chars BEFORE the
  // UPDATE, mirroring assertSafeRelative's fail-fast posture in setProfilePhoto.
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE profile SET name = ?, modified_at = ? WHERE id = 1",
      [name, now],
    );
    if (result.changes !== 1) {
      throw new Error(
        `setProfileName: profile row id=1 not updated (changed ${result.changes})`,
      );
    }
    await bumpDataRevisionCore(exec);
  });
}
```
`getProfile` (profile-dao.ts:96-102) already returns `{ name, photo, modified_at }`, so the read side is done. Add a `profile-dao.test.ts` name case (Wave 0 gap). `profile.name` already round-trips backup in format-5 (export-manifest.ts:106) — **no format bump** (D-06).

---

### Category / hub screen bodies (screen shell + write posture)

**Shell analog:** `AIPermissionsScreen.tsx:1-40` (VERIFIED) — leaf screens are self-contained: `useTheme()` for colours, `ScrollView`/`Pressable`/`Switch`/`GlassSurface` from `@/components/ui`, DAO writers imported directly, `getExecutor()`/`localDateTime()` from `@/db/database`, a module-level `LOG_SCOPE`, an `onBack` prop. They do **not** register their own route — the SettingsStack wrapper does.

**Write posture analog (carry verbatim for any settings write):** `SettingsScreen.tsx:501-520` `persist()` (VERIFIED). Every `app_settings` write goes through `updateAppSettings(exec, patch, localDateTime())`, re-reads via `getAppSettings`, then fires `reconcileSchedule` + `reconcileDigestSchedule`:
```typescript
const persist = useCallback(async (patch: AppSettingsPatch) => {
  const exec = getExecutor();
  try {
    await updateAppSettings(exec, patch, localDateTime());
    const next = await getAppSettings(exec);
    setSettings(next);
    void reconcileSchedule(exec);
    void reconcileDigestSchedule(exec);
  } catch (err) {
    Logger.error(LOG_SCOPE, "failed to persist notification setting", err);
  }
}, []);
```
> **`SettingsNotificationsScreen` MUST carry the reconcile calls** (Pitfall 5). A plain `updateAppSettings` without `reconcileSchedule`/`reconcileDigestSchedule` leaves the OS schedule stale until next launch. The other category screens can drop the reconcilers only if they touch no notification/digest column — but reusing the full `persist()` verbatim is harmless (both reconcilers are idempotent + defer-guarded), so prefer copying it whole.

**In-screen nav typing** (SettingsScreen.tsx:240-241, VERIFIED): `useNavigation<NativeStackNavigationProp<RootStackParamList>>()`; or type against `SettingsScreenProps<"...">` (types.ts:337-341). Once a route is registered, `navigation.navigate("SettingsAppearance")` type-checks.

## Shared Patterns

### Theme tokens (applies to EVERY new screen — non-negotiable)
**Source:** `useTheme()` from `@/theme` (SettingsScreen.tsx:217; AIPermissionsScreen.tsx:26).
**Apply to:** all 6 category screens + hub + About.
No hardcoded colours — every colour resolves through `colors.*` / `@/theme/tokens/*`. `npm run check:colors` gates the phase. Moved JSX already obeys this; preserve it on relocation.

### Galaxy-conditional control (D-07)
**Source:** `SettingsScreen.tsx:222` `const themePackage = useThemeStore((s) => s.package)` (VERIFIED — reactive selector).
**Apply to:** `SettingsAppearanceScreen`.
One-line guard: `{themePackage === "galaxy" ? <GalaxyOnlyControl /> : null}`. Mode/Accent already read the active package (SettingsScreen.tsx:789, 845-846); only the Background grid renders both packages (935-962). No store/schema change.

### DAO write validation (V5)
**Source:** `app-settings-dao` validators (assertMessageMode etc.) run before every UPDATE.
**Apply to:** all preference writes + the new `setProfileName` (bound length, reject control chars).
Never inline SQL in a screen; route through `updateAppSettings` / `setProfileName`.

### Backup dual-home hazards (D-08 — carry into the Settings-mounted copies)
**Source:** `RestoreResultScreen.tsx:18` (`navigation.reset({ routes:[{name:"Backup"}] })`) and `BackupScreen.tsx:262` (`consumeSharedBackup()` in a focus effect).
**Apply to:** the Settings-mounted Backup route registrations.
1. `RestoreResultScreen`'s hard `reset` to "Backup" strands the user inside the Settings stack — planner decides origin-aware return vs. accepting reset-within-Settings.
2. `BackupScreen` drains the native shared-backup singleton on focus; the share-intent gate routes shared backups to `BackupTab › Backup` (linking.ts:67). Keep shared-backup consumption tab-scoped so the Settings copy never double-consumes.
`RestorePreviewRoute` param is serializable (`{ token; preview }`); the heavy manifest lives in a module-singleton `Map` keyed by token (backup-restore-logic.ts:31-52) — dual-home safe.

### No schema / no format bump (D-06)
**Apply to:** every plan. `TARGET_VERSION === 29`, `BACKUP_FORMAT_VERSION === 5` stay. All D-04 additions reuse existing columns; `profile.name` already emits in format-5. Any newly introduced durable/portable preference owes a **format-6** bump = owner decision, never silent.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/screens/SettingsHubScreen.tsx` | screen | nav-only directory | No existing "directory of subtitle rows with NO live values" screen (§A). Closest is the SettingsScreen row idiom + the AI leaf shell; the hub is a thinner, values-free variant. |
| `src/screens/SettingsAboutScreen.tsx` | screen | static app name/version/licenses | No static-info screen precedent in-repo. Ships app name/version/licenses only, omits dead rows (§K, Assumption A3). Use the AI leaf shell as the container. |
| D-03 Categories reservation | route (name only) | n/a | Deliberately NO screen/row. Reserve `CategoryManagement` route name + IA slot under Contacts → Relationship Structure; render nothing (§K no-dead-placeholders). Roadmap follow-up owed to owner. |

## Metadata

**Analog search scope:** `src/navigation/`, `src/screens/`, `src/db/`, `src/stores/`, `src/backup/`.
**Files read this session (verified, not from RESEARCH ranges):** `SettingsStack.tsx` (full), `BackupStack.tsx` (full), `profile-dao.ts` (full), `types.ts:220-349`, `SettingsScreen.tsx:215-284 + 490-529`, `AIPermissionsScreen.tsx:1-60`.
**Pattern extraction date:** 2026-09-14

## PATTERN MAPPING COMPLETE

**Phase:** 37 - Settings & Personalization
**Files classified:** 10 (2 nav modified, 6 new screens, 1 DAO extended, 1 reservation)
**Analogs found:** 9 / 9 with a concrete in-repo analog; 2 screens (Hub, About) use the leaf shell as a partial analog by necessity.

### Coverage
- Files with exact analog: 5 (types.ts, SettingsStack.tsx, BackupStack registration, profile-dao setProfileName, Notifications persist path)
- Files with role-match analog: 4 (Appearance, Contacts, Interactions, Orrery category screens)
- Files with no direct analog: 2 (Hub directory, About) + 1 route-only reservation (Categories)

### Key Patterns Identified
- Every new Settings sub-route = two additive edits: a `RouteName: undefined` line in `SettingsStackParamList` + a `<Stack.Screen>` (with a `*Route` wrapper passing `onBack={() => navigation.goBack()}`), exactly like the five AI leaf routes. `Settings` route name is preserved for the hub.
- Backup dual-home (D-08) copies BackupStack's four imports/registrations into SettingsStack; carries two hazards (RestoreResult hard-reset, shared-backup singleton consume) — keep shared-backup consumption tab-scoped.
- `setProfileName` mirrors `setProfilePhoto` on the single-row `profile` table (id=1), NOT `contacts`; every settings write reuses `SettingsScreen`'s `persist()` (updateAppSettings + reconcileSchedule + reconcileDigestSchedule); no schema, no backup-format bump.

### File Created
`/home/bwales/projects/orbit-app/.planning/phases/37-settings-personalization/37-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference the AI-leaf-route analog for every category route, the `setProfilePhoto`→`setProfileName` analog for the self-name writer, and the BackupStack registration analog for the Data & Backup dual-home.
