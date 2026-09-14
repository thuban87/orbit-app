# Phase 37: Settings & Personalization - Research

**Researched:** 2026-09-14
**Domain:** React Navigation IA restructuring (native-stack), settings/preference plumbing over `app_settings` + `profile`, backup screen-tree dual-homing
**Confidence:** HIGH (this is codebase archaeology of shipped code, not external-library research; every load-bearing claim below was read on disk this session)

## Summary

Phase 37 is an organization-and-consolidation phase. There is **no external technology to research** — the stack (React Navigation native-stack, Zustand, `expo-sqlite` DAOs, theme tokens) is already in place and every seam Phase 37 consolidates already ships. The research question reduces to: *what is the exact current shape of the Settings monolith, the navigation stacks, the preference DAO, and the backup tree, and what is the lowest-risk way to restructure them without losing behaviour or touching schema?*

The core structural work (D-09) is decomposing `src/screens/SettingsScreen.tsx` (2,168 lines, one `ScrollView`) into a hub + category sub-route screens, replicating the **only** existing Settings sub-route pattern — the five AI leaf routes registered in `SettingsStack.tsx` + `SettingsStackParamList`. The five research risks the CONTEXT flags (backup dual-home, preference emission state, Galaxy-conditional controls, Categories IA reservation, self-name editor) are all **confirmed feasible and low-risk against the real code**, with two important corrections to the CONTEXT/prompt phrasing documented below (self record lives in the `profile` table, not `contacts`; and preference emission is already live in format-5, not "Phase-36-gated/deferred").

**Primary recommendation:** Build a `SettingsHubScreen` (the navigation-first directory) plus one screen per top-level category, register each as a Settings sub-route exactly like the AI leaf routes, and **move** existing row-group JSX into the destination category screens with zero behavioural change. Surface the already-persisted preferences (message mode, right-swipe, orrery density/satellites, global profile layout/background default, self name) through the existing validated DAO writers — **no migration, no backup-format bump**.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01…D-09 — verbatim intent)
- **D-01:** Ground truth = the Phase 37 dossier §A–§S. All §A–§S decisions stand EXCEPT where a D-NN corrects them. CONTEXT is the overlay.
- **D-02:** Sun colour follows **ADR-047** unchanged. Only the self-star colour (`self_sun_colour`) is user-configurable; a *contact* at the orrery centre keeps its status-derived glow — it does NOT get a user-chosen colour. The "Your star" control stays available regardless of the current centre selection. No ADR-047 reversal, no data-layer change.
- **D-03:** **Category CRUD is OUT.** `categories` (migration 001) is seeded (4 rows) and read-only. Phase 37 **reserves only the Categories IA slot + a stable internal route** under Contacts & Relationships → Relationship Structure. Per §K no-dead-placeholders, ship **no** functional or inert Categories row until a future Category Management phase exists. **Roadmap follow-up owed:** a "Category Management" phase (CRUD + deletion cascade) is an unscheduled dependency — raise with the owner at/before plan close.
- **D-04:** Expose three stub-contract preferences the dossier omitted, all already persisted: (a) **Compose default message mode** (`default_message_mode`); (b) **Self-name / owner-profile editor** (small NEW UI over the existing self record — no new column); (c) **Dashboard right-swipe action** (`dashboard_right_swipe_action`). Category placement delegated to the planner (guidance: (a)+(c) fit **Interactions**; (b) an owner-profile grouping, Appearance-adjacent).
- **D-05:** Expose the **GLOBAL default** profile layout/background (`profile_layout_template_uid`, `profile_background_template_uid`) as an **Appearance** control. Per-contact managers stay contact-scoped (Settings does NOT link them).
- **D-06:** Backup wire format is **v5** on disk. Phase 37 owns no schema by default. D-04's additions reuse existing columns → **no format bump expected** — the planner must CONFIRM this; any newly introduced durable/portable preference owes a **format-6** bump, an owner decision, never a silent side effect.
- **D-07:** Galaxy-conditional appearance controls are **trivial** — a one-line `themePackage === "galaxy"` guard. Active package is already reactive; Mode/Accent already per-package. No store/schema change, no theme rewrite.
- **D-08:** Data & Backup dual-home is feasible. The Backup tree self-fetches and takes only navigation props. Register the four Backup route names in `SettingsStackParamList` + `SettingsStack.tsx`. Watch the `restorePreviewCache` param and the `consumeSharedBackup` native singleton. Tab removal stays deferred (§R).
- **D-09:** Settings is one monolithic 2,168-line screen with no category sub-routes — only AI leaf routes exist. Build the hub + category routes and decompose the monolith; this is the phase's core structural work, larger than "small shared UI/navigation infrastructure" implies.

### Claude's Discretion
- Category placement of the three D-04 preferences (guidance given, not locked).
- Plan slicing by coherent Settings architecture (per §Q: slice by architecture/feature integration, NOT one plan per toggle).
- The concrete decomposition mechanism (hub screen + per-category screens vs. sectioned sub-routes) — the planner chooses, within the AI-leaf-route precedent.

### Deferred Ideas (OUT OF SCOPE)
- **Category Management** (CRUD + deletion cascade) — its own future phase; roadmap row owed.
- **Theme-merge** (Galaxy/Standard → Dark/Light, reverses ADR-087) — PARKED per STATE `carried_forward`. Build Appearance on the CURRENT package model; accept the later rework. Do NOT start it here.
- **Backup bottom-tab removal** (§R) — Phase 37 prepares (canonical tree + Settings entry) but does not remove the tab.
- **Settings search, global Reset, generic General/Advanced categories, external URL deep-links, additional interaction defaults without demonstrated need** — all deferred (§R).
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Local-first, no network on any read path.** Settings adds no egress; the only AI egress path (`AiService.ts`) is untouched by this phase.
- **All colours resolve through theme tokens** — no hardcoded colours, including Skia. The monolith already obeys this (`useTheme().colors.*`); moved JSX must preserve it. `npm run check:colors` gate applies.
- **Never edit a shipped migration; forward-only.** Phase 37 should add none.
- **`formatLocalDate()` / `localDateTime()`** for dates — never `toISOString().split('T')[0]`. Existing settings writers already use `localDateTime()`.
- **Git worktrees DISABLED.** (Research is read-only; noted for the planner: never pass `isolation: "worktree"`.)
- **Queries go through DAOs**, never inline in components. Settings already routes every write through `app-settings-dao` / `profile-dao`.
- **Review the code, not the diff** — decomposition touches every writer of `app_settings` and the `profile` table; the planner/executor must read moved JSX in full.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Settings navigation directory (hub + category routes) | Client (React Navigation native-stack) | — | Pure in-app navigation; `SettingsStack` owns it |
| Preference read/write | Database / DAO (`app-settings-dao`, `profile-dao`) | Client (screens) | Single-writer DAO invariant; UI never inlines SQL |
| Live theme selection | Client store (`theme-store` Zustand) | Database (`app_settings` durable) | Store drives instant restyle; DAO persists |
| Backup/restore execution | Services (`src/backup/*`, `src/services/backup/*`) | Client (Backup screens) | Screens self-fetch; logic is tier-independent |
| Categories (read-only) | Database (seeded migration 001) | — | Zero runtime CRUD; Phase 37 reserves IA only |

## Phase Requirements

None assigned. Requirements were deferred (REQUIREMENTS.md: "Phase 37 … deferred planning"). Success criteria are defined at planning time from the dossier §A–§S + D-01…D-09. **Do not invent REQ-IDs.**

## Standard Stack

No new packages. Everything Phase 37 needs already ships and is in use:

| Library | Version (in repo) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `@react-navigation/native-stack` | already installed | Settings sub-routes (hub + categories) | The AI leaf routes already use it; the only sub-route precedent |
| `zustand` | already installed | `theme-store`, `ai-config-store`, `assist-store` | Project state convention (`src/stores/`) |
| `expo-sqlite` (via DAOs) | already installed | `app_settings` / `profile` persistence | Project data-layer convention |
| React Native `Switch`/`Pressable`/`FlatList`/`Modal` | RN in repo | Existing settings controls | Reuse the monolith's visual language (§B) |

**Installation:** none. `## Package Legitimacy Audit` is **N/A** — this phase installs no external packages.

**Alternatives considered:** none warranted — introducing a new nav or state library would violate §P scope-lock and project conventions.

## Migration & Backup-Format Facts (verify-once, so the planner never assumes a number)

- **Head migration on disk:** `029-ai-configuration.ts`. `AI_CONFIGURATION_SCHEMA_VERSION = 29` `[VERIFIED: src/db/migrations/029-ai-configuration.ts:15]`; `TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION` `[VERIFIED: src/db/database.ts:67]`.
- **The "missing 024":** there is no `024-*.ts` file because `profile-presentation.ts` **is** version 24 — `PROFILE_PRESENTATION_SCHEMA_VERSION = 24` `[VERIFIED: src/db/migrations/profile-presentation.ts:4]`, registered in the `MIGRATIONS` array between `migration023` and `migration025` `[VERIFIED: src/db/database.ts:94]`. So the sequence is 1–23, 24 (profile-presentation), 25–29 — contiguous, no gap.
- **Backup wire format:** `BACKUP_FORMAT_VERSION = 5` `[VERIFIED: src/backup/types.ts:14]`; asserted `=== 5` by tests `[VERIFIED: src/backup/export-manifest.test.ts:92, src/backup/orrery-preferences-portability.test.ts:151]`. **D-06's "v5" is correct.**
- **Phase 37 should add NO migration.** If a plan appears to need one, that is the §Q signal an owning feature phase missed something — stop and check, don't add schema here.

## Architecture Patterns

### System Architecture Diagram (target Settings IA)

```
SettingsTab (native-stack, initialRoute "Settings")
  │
  ├── "Settings"  = SettingsHubScreen   ← NEW navigation-first directory
  │     (icon + title + subtitle rows; NO live values per §A)
  │     │  taps navigate() to ↓
  │     ├─► "SettingsAppearance"          ← NEW category screen
  │     │      Theme (pkg/mode/accent/bg), Orbit Appearance (star + Orbit Center),
  │     │      global default Profile layout/background (D-05),
  │     │      owner-profile / self-name editor (D-04b, Appearance-adjacent)
  │     ├─► "SettingsContacts"            ← NEW  (Contact Sources / Unbound /
  │     │      Relationship Structure {Custom Fields, [Categories route RESERVED]} /
  │     │      Contact Management {Archived})
  │     ├─► "SettingsInteractions"        ← NEW  (Interaction Assist,
  │     │      Default Interaction Channel, default_message_mode D-04a,
  │     │      dashboard_right_swipe_action D-04c)
  │     ├─► "SettingsNotifications"       ← NEW  (the 10 existing controls)
  │     ├─► "SettingsOrrery"              ← NEW  (Display: density/satellites;
  │     │      Systems → SystemsManagement)
  │     ├─► "Backup" (+3)                 ← REGISTER existing Backup tree (D-08)
  │     ├─► AI hub  (existing AIConnection/AIModelPicker/AIPersonalization/
  │     │      AIPermissions/AIPreview leaf routes — already registered)
  │     ├─► "SettingsAbout"               ← NEW basic About surface (§K)
  │     └─► "Add Orbit widget" utility row near bottom (§L)
  │
  (every route name above is also a stable internal address per §M)
```

File-to-destination mapping lives in the Component Responsibilities table below, not the diagram.

### Current SettingsScreen row inventory → destination (D-09 decomposition map)

Read verbatim from `src/screens/SettingsScreen.tsx` (render order). Every group below currently lives in the single `ScrollView` returned at line 669.

| Current group (testID / label) | Source lines | Destination category | Notes |
|---|---|---|---|
| Dev theme-preview row (`settings-dev-theme-preview-row`) | 679–694 | keep dev-only, hub or Appearance | `__DEV__`-gated; compile-time stripped |
| Appearance: Theme / Mode / Accent / Background | 701–981 | **Appearance › Theme** | Background renders BOTH package subgroups today (935–962) — see D-07 |
| Contact methods: Phone region, Check linked contacts, Review flagged items | 983–1054 | **Contacts & Relationships › Contact Sources** | phone-region "ordered lower" per §E |
| Contacts Integration: Import contacts | 1056–1083 | **Contacts & Relationships › Contact Sources** | |
| Notifications: master, degraded, Decay, Birthday, Birthday-unbound, Weekly digest, Lock-screen, Reminder time, Quiet start, Quiet end | 1173–1529 | **Notifications** | 10 controls + native time picker; every write → `persist()` → `reconcileSchedule` + `reconcileDigestSchedule` |
| Interaction Assist toggle | 1531–1565 | **Interactions** | |
| Your photo (`settings-your-photo-row`) | 1567–1584 | **Appearance / owner-profile** | `PhotoSourcePicker target={{kind:"profile"}}` → `profile-dao` |
| Your orbit: Your star (self sun colour), Sun / centre (occupant picker) | 1586–1728 | **Appearance › Orbit Appearance** | Reframe as "Orbit Center" per §D; D-02 governs the star colour |
| AI: AI Enabled + hub rows + first-use disclosure | 1730–1874 | **AI** | Hub row/route model already factored in `settings-ai-hub-logic.ts` |
| Home screen: Add Orbit widget | 1876–1928 | **utility row near bottom** (§L) | |
| Custom Fields row | 1930–1943 | **Contacts › Relationship Structure** | navigates `CustomFields` |
| Systems row | 1945–1958 | **Orrery › Systems** | navigates `SystemsManagement` |
| Archived contacts row | 1960–1973 | **Contacts › Contact Management** | navigates `Archived` |

**Preferences persisted but NOT currently surfaced in Settings** (the "expose already-established preferences centrally" work, §P; all reuse existing columns):
- `default_message_mode` (D-04a) — Interactions
- `dashboard_right_swipe_action` (D-04c) — Interactions
- `default_interaction_channel` (CAPT-11, §F names it a current resident but the monolith renders only Interaction Assist — surface it) — Interactions
- `orrery_density`, `orrery_satellites_enabled` (§H Display) — Orrery
- `profile_layout_template_uid`, `profile_background_template_uid` GLOBAL default (D-05) — Appearance
- self **name** on the `profile` table (D-04b) — owner-profile

### Pattern 1: Settings sub-route registration (the ONLY precedent to replicate)

The AI leaf routes are the template. Two edits per new route: add the name to `SettingsStackParamList`, and add a `<Stack.Screen>` in `SettingsStack`.

```typescript
// Source: src/navigation/types.ts:229-300 (SettingsStackParamList) — VERIFIED
export type SettingsStackParamList = {
  Settings: undefined;
  AIConnection: undefined;
  AIModelPicker: { lane: AiCloudProviderId };
  AIPersonalization: { focus?: "writing-style" | "personalization" } | undefined;
  AIPermissions: undefined;
  AIPreview: undefined;
  // … + Profile/Archived/CustomFields/SystemsManagement/import/reconcile already here
};

// Source: src/navigation/tabs/SettingsStack.tsx:95-161 — VERIFIED
<Stack.Navigator initialRouteName="Settings" screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Settings" component={SettingsScreen} />
  <Stack.Screen name="AIConnection" component={AIConnectionRoute} />
  {/* … one <Stack.Screen> per route … */}
</Stack.Navigator>
```

New category screens follow the same additive shape. `initialRouteName="Settings"` stays; `headerShown:false` (screens render their own `ShellAppBar`).

### Pattern 2: In-app navigation typing inside the screen

The monolith navigates via `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` `[VERIFIED: src/screens/SettingsScreen.tsx:240-241]`. `RootStackParamList` is the intersection of all four stacks `[VERIFIED: src/navigation/types.ts:314-317]`, so a category screen can `navigation.navigate("SettingsAppearance")` once the route is registered. New category screens should type against `SettingsScreenProps<"...">` (the composite tab+stack props helper, types.ts:337-341) or reuse the `useNavigation` idiom.

### Pattern 3: Preference write posture (already correct — reuse verbatim)

Every settings write goes through `updateAppSettings(exec, patch, localDateTime())` inside the screen's `persist()` callback (SettingsScreen.tsx:501-520), which re-reads and fires the notification/digest reconcilers. The DAO validates every field before the UPDATE opens (V5 input validation, see Security). Moved JSX must keep routing writes through the DAO — **never** inline SQL.

### Pattern 4: Self-record editing (D-04b) — writes the `profile` table, NOT `contacts`

```typescript
// Source: src/db/profile-dao.ts:38-61 (setProfilePhoto) — VERIFIED
export async function setProfilePhoto(exec, relative, now) {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE profile SET photo = ?, modified_at = ? WHERE id = 1", [relative, now]);
    if (result.changes !== 1) throw new Error(/* loud-fail → rollback */);
    await bumpDataRevisionCore(exec);
  });
}
```

The self-name editor is a NEW `setProfileName(exec, name, now)` writer mirroring this exactly (single `inWriteTransaction`, `?`-bound `UPDATE profile SET name = ?, modified_at = ? WHERE id = 1`, `changes===1` guard, `bumpDataRevisionCore`). See Common Pitfall 1 for why this is the `profile` table.

### Anti-Patterns to Avoid
- **Duplicating a canonical manager** for a Settings-only copy (§Q). Custom Fields, Archived, Systems, Backup, the AI hub, and the per-contact profile managers are reused by navigation, never reimplemented.
- **Inlining SQL** in a moved category screen. Route through the DAO.
- **A dead/inert Categories row** (D-03 / §K). Reserve the route name + IA slot only.
- **Bumping `BACKUP_FORMAT_VERSION`** as a side effect (D-06). It is an owner decision.
- **Driving a new "General"/"Advanced" dumping-ground** (§A/§R). Every setting has a conceptual home.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Preference persistence | New store / AsyncStorage | `app-settings-dao` writers | Single-writer + validation + backup portability already solved; AsyncStorage for prefs is prohibited (theme-store.ts:22-25) |
| Self name/photo | A `contacts` row edit | `profile-dao` (`profile` table id=1) | The self record is a distinct single-row table (see Pitfall 1) |
| Backup/Restore surface | A second Backup screen tree | Register the existing four Backup screens (D-08) | "One canonical tree, multiple entry points" (§I) |
| Live theme apply | New theme plumbing | `theme-store` setters + `persist()` | `ThemeProvider` re-renders from the store; instant restyle already works |
| Notification rescheduling | Manual OS scheduling in Settings | `persist()` → `reconcileSchedule`/`reconcileDigestSchedule` | Already wired and idempotent (SettingsScreen.tsx:501-520) |

**Key insight:** Phase 37 is a *relocation* phase. Almost every "how do I build X" answer is "X already exists — navigate to it or move its JSX." New code is limited to: the hub screen, the per-category container screens, one `setProfileName` DAO writer, and small controls for the already-persisted preferences.

## Runtime State Inventory (this is a restructure — required)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No renamed keys. `app_settings` (id=1) and `profile` (id=1) columns are all pre-existing; Phase 37 writes existing columns only. | None — no data migration |
| Live service config | Notification/digest OS schedule is re-armed by `reconcileSchedule`/`reconcileDigestSchedule` on every settings write (SettingsScreen.tsx:507,516). If the Notifications controls move to a category screen, that screen MUST preserve the same `persist()` reconcile wiring. | Code: carry the reconcile-on-write path into the Notifications category screen |
| OS-registered state | Home-screen widget pin (`requestPinWidget`, SettingsScreen.tsx:647) — unaffected by relocation, keep the utility row. | None |
| Secrets / env vars | AI credentials are SecureStore-only (`ai-key-store`), never in `app_settings` or backup. Settings only toggles `ai_enabled`. | None — do not widen |
| Build artifacts | None. | None — verified: no rename, no package rename |

**Canonical question — after every Settings row moves to a category screen, what runtime state still points at the old location?** Nothing *stored* (columns unchanged). The one live coupling is the notification/digest reconcile that must ride with the Notifications controls into their new screen. Route names are additive; the `Settings` route name itself is preserved (deep-link and back-stack safe, §M).

## Common Pitfalls

### Pitfall 1: The self record is the `profile` table, NOT `contacts` (corrects the prompt/CONTEXT wording)
**What goes wrong:** The research prompt (item 6) and a natural reading of D-04b say "the id=1 self record in `contacts`." A plan built on that would add a `contacts` name writer — wrong table.
**Reality (VERIFIED on disk):** The self record is a dedicated single-row table: `CREATE TABLE profile ( id INTEGER PRIMARY KEY CHECK (id = 1), uid TEXT NOT NULL UNIQUE, name TEXT, photo TEXT, created_at TEXT NOT NULL, modified_at TEXT NOT NULL )` `[VERIFIED: src/db/migrations/001-initial.ts:52-59]`, seeded with **no name** (`INSERT INTO profile (id, uid, created_at, modified_at)` — name omitted → NULL) `[VERIFIED: src/db/migrations/001-initial.ts:227-231]`. `contacts` is a separate table with `name TEXT NOT NULL` `[VERIFIED: src/db/migrations/001-initial.ts:61-65]`. The self avatar/name flow already uses `profile-dao.getProfile` / `setProfilePhoto` against `WHERE id = 1` `[VERIFIED: src/db/profile-dao.ts:38-102]`, and `SettingsScreen.tsx:242-249` confirms `name` is nullable with a "You" fallback and "carries no name until a self-name editor ships."
**How to avoid:** D-04b's editor is a new `setProfileName` writer on the **`profile`** table, mirroring `setProfilePhoto`. Do not touch `contacts`.
**Warning signs:** any plan task referencing "self contact row" or a `contacts` name UPDATE for the owner.

### Pitfall 2: Preference emission is ALREADY LIVE in format-5 (corrects "Phase-36-gated/deferred")
**What goes wrong:** The `PortableSettingsSnapshot` interface doc-comments still say emission is "DEFERRED to Phase 36" for the theme/dashboard/history/channel/message-mode keys (app-settings-dao.ts:435-491). Those comments are **stale**. Reading the actual `getPortableSettingsSnapshot` SELECT shows Phase 36 lifted the deferral: the projection now emits `dashboard_right_swipe_action`, `default_message_mode`, `remembered_message_mode`, `profile_layout_template_uid`, `profile_background_template_uid`, `orrery_density`, `orrery_satellites_enabled`, theme keys, history keys, and channel keys `[VERIFIED: src/db/app-settings-dao.ts:950-969 (SELECT) + 978-1041 (return)]`. `profile.name` is emitted via the profile-table export `SELECT uid, name, photo, … FROM profile` `[VERIFIED: src/backup/export-manifest.ts:106]` and restored LWW `[VERIFIED: src/backup/restore-apply.ts:232, reconciliation.ts:116]`.
**Why it matters (D-06):** Every preference Phase 37 surfaces already round-trips through backup **in format 5**. Surfacing them requires **no schema change and no format bump** — confirmed against the DAO and the latest migration. Do NOT re-defer or "add emission."
**How to avoid:** Trust the SELECT projection over the interface doc-comments; the planner may note the comments are stale (an optional doc-sync, not a Phase 37 blocker).

### Pitfall 3: Backup dual-home — the `RestoreResultScreen.reset` and `consumeSharedBackup` topology assumptions (D-08)
**What goes wrong:** The four Backup screens are typed `RootStackScreenProps<"Backup">` etc. and take only `navigation`/`route` `[VERIFIED: src/screens/RestoreResultScreen.tsx:5-8; BackupScreen.tsx:63; others import `RootStackScreenProps`]`, so registering them in `SettingsStack` type-checks immediately (they already live in `BackupStackParamList`, part of the `RootStackParamList` intersection). But two behaviours assume the Backup *tab* topology:
  1. `RestoreResultScreen` calls `navigation.reset({ index: 0, routes: [{ name: "Backup" }] })` `[VERIFIED: src/screens/RestoreResultScreen.tsx:18]`. Inside the Settings stack this resets the Settings stack to a lone "Backup" route — the user loses the path back to the Settings hub.
  2. `BackupScreen` runs `consumeSharedBackup()` in a focus effect `[VERIFIED: src/screens/BackupScreen.tsx:262]`, draining the native shared-backup singleton. Mounted in *two* stacks, whichever `Backup` screen gains focus consumes it. The share-intent gate always routes a shared backup to `BackupTab › Backup` `[VERIFIED: src/navigation/linking.ts:67]`, so the tab copy is the intended consumer — but a Settings-mounted copy would also fire on focus.
**Clarification on the "non-serializable `restorePreviewCache` route param":** the route param is actually **serializable** — `RestorePreviewRoute = { token: string; preview: RestorePreviewAggregate }` `[VERIFIED: src/screens/backup-restore-logic.ts:5-8]`; the heavy candidate (manifest) stays in a module-level in-memory `Map` keyed by `token` `[VERIFIED: src/screens/backup-restore-logic.ts:31-52]`. Because `restorePreviewCache` is a single exported module singleton, a token stored from either entry point reads back from the same cache — dual-home safe. The real hazard is the *process-local* nature (a cold launch re-selects; deliberate, backup-restore-logic.ts:51), not serialization.
**How to avoid:** The planner should decide the Settings-entry return semantics (e.g. an origin-aware return instead of a hard `reset` to "Backup", or accept resetting to Backup-within-Settings), and ensure the Settings-mounted `BackupScreen` does not double-consume the shared-backup singleton (gate the consume on tab identity, or keep shared-backup handling tab-only). Tab removal stays deferred (§R), so both copies coexist this phase.
**Warning signs:** after a Settings→Data & Backup→Restore flow, Back does not return to the Settings hub; or a shared backup is consumed but the visible screen is the Settings copy.

### Pitfall 4: Galaxy-conditional controls (D-07) — the Background grid is the one that renders both packages
**What goes wrong:** §D feared conditional Galaxy controls were "more involved than expected." They are not — but note *which* control differs. Mode and Accent already read the active package's value (`themePackage === "galaxy" ? galaxyMode : standardMode`, etc.) `[VERIFIED: src/screens/SettingsScreen.tsx:789, 845-846]`. The **Background** control is the only one that currently renders BOTH packages' subgroups in one grid `[VERIFIED: src/screens/SettingsScreen.tsx:935-962]`. The active package is a reactive selector: `const themePackage = useThemeStore((s) => s.package)` `[VERIFIED: src/screens/SettingsScreen.tsx:222]`.
**How to avoid:** Gating a Galaxy-only control is a one-line `themePackage === "galaxy"` guard, exactly as D-07 states. No store or schema change. If the design wants background choices gated to the active package, that is a rendering change to the existing grid, still no data-layer work.

### Pitfall 5: Losing the notification reconcile-on-write when Notifications moves
See Runtime State Inventory. The 10 notification controls each call `persist()`, which fires `reconcileSchedule` and `reconcileDigestSchedule` so the OS schedule re-arms immediately `[VERIFIED: src/screens/SettingsScreen.tsx:501-520]`. Moving these controls to a category screen must carry that exact write path; a plain `updateAppSettings` without the reconcilers would leave the OS schedule stale until next launch.

## Categories IA reservation (D-03) — verified read-only

`categories` has **zero runtime CRUD writers.** Every production write to the table is either the migration-001 seed (`INSERT INTO categories … VALUES` for the 4 rows) `[VERIFIED: src/db/migrations/001-initial.ts:220]`, the migration-007 uid rewrite `[VERIFIED: src/db/migrations/007-tombstones.ts:105]`, or the backup restore upsert `INSERT INTO categories … ON CONFLICT(uid) DO UPDATE` `[VERIFIED: src/backup/restore-apply.ts:531]`. Every other `INSERT/UPDATE/DELETE categories` in the tree is inside a `*.test.ts` fixture (grep of `src/` this session). No screen, DAO, or service creates/renames/deletes a category at runtime. **D-03 confirmed.**

**Concrete minimal reservation:** register a stable route name (e.g. `"CategoryManagement"`) in `SettingsStackParamList` and add the IA position under Contacts & Relationships → Relationship Structure in the category screen's data model — but render **no** row for it (§K no-dead-placeholders) until the future Category Management phase supplies the screen. Reserving the *name/position* means the internal route string and the section-order slot exist so §M addressing and the future phase have a stable target, without a tappable dead row. (Simplest form: a commented/opt-out entry in the section list keyed to a `false` feature flag, or simply the documented route name held for the future phase — the planner picks the lightest that leaves no visible placeholder.)

## Code Examples

### Reading the active theme package (D-07 selector)
```typescript
// Source: src/screens/SettingsScreen.tsx:222 — VERIFIED
const themePackage = useThemeStore((s) => s.package); // reactive; "galaxy" | "standard"
// gate a Galaxy-only control:
{themePackage === "galaxy" ? <GalaxyOnlyControl /> : null}
```

### Surfacing an already-persisted preference (message mode, D-04a)
```typescript
// Column + validator already exist. MESSAGE_MODES = ["remember","text","email"]
//   Source: src/db/app-settings-dao.ts:185 — VERIFIED
// Read:  settings.defaultMessageMode  (AppSettings, dao:339)
// Write: await updateAppSettings(exec, { defaultMessageMode: "text" }, localDateTime());
//   assertMessageMode guards on write (dao:200-209); DB CHECK backs it (migration 028)
```

### Right-swipe action (D-04c)
```typescript
// dashboardRightSwipeAction: RightSwipeAction  (AppSettings, dao:309) — VERIFIED
// RIGHT_SWIPE_ACTIONS imported from "@/logic/dashboard-query-logic" (dao:32)
// Write via updateAppSettings({ dashboardRightSwipeAction: … }); emitted in format-5 snapshot
```

## State of the Art

| Old (stub-contract) assumption | Current reality | When changed | Impact on Phase 37 |
|---|---|---|---|
| Category CRUD lives in the Settings phase | Category CRUD is OUT; reserve IA only | D-03 (2026-09-14) | No CRUD manager; roadmap row owed |
| Profile managers routed from Settings | Only the GLOBAL default is a Settings control; per-contact managers stay contact-scoped | D-05 | Appearance gets one global-default control |
| Backup wire format "v4" | v5 on disk (Phase 36 bump) | AICFG-17 / D-06 | No bump this phase |
| Preference emission "deferred to Phase 36" | Emission is LIVE in format-5 `getPortableSettingsSnapshot` | Phase 36 | Surface prefs freely; no format change |
| Self record is a `contacts` row | Self record is the single-row `profile` table | migration 001 (always) | `setProfileName` on `profile`, not `contacts` |

**Deprecated/outdated:** the `PortableSettingsSnapshot` interface doc-comments claiming "EMISSION DEFERRED" (app-settings-dao.ts:435-491) — stale after Phase 36; the live SELECT emits them.

## Relevant Knowledge-Base Docs

- `docs/systems/app-shell.md` — nav shell, per-tab stacks, back-stack behaviour (§M "Preserve Phase 22 shell/back-stack").
- `docs/systems/backup-restore.md` + `docs/systems/orrery-systems-backup-contract.md` — Backup tree + portability (D-08, §I).
- `docs/systems/notifications.md` — notification settings + reconcile behaviour (§G).
- `docs/systems/profile.md` — profile presentation templates (D-05 per-contact vs global).
- `docs/systems/persistence-core.md` — migration/`app_settings` conventions.
- ADRs: **ADR-080** (four-tab shell, Backup tab, removal deferred), **ADR-083/084/087** (theme model, D-07; ADR-087 is what theme-merge would later reverse — do not touch), **ADR-047** (sun/self identity, D-02), **ADR-041** (notification settings, §G), **ADR-057/058/063/012** (backup, §I), **ADR-076** (birthdays → Your Week; §G owns only birthday *notification* settings).

*(Graph note: `npm run graph:ask -- governs <file>` is the ADR-lookup entry point, but per CLAUDE.md the graph cannot enumerate SQL writers — the categories/`app_settings`/`profile` writer audits above were done by manual grep + file reads, as required.)*

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (node environment; DAOs proven against `node:sqlite`) |
| Config file | present (vitest suites across `src/db`, `src/backup`, `src/logic`) |
| Quick run command | `npx vitest run <path>` (target the touched suite) |
| Full suite command | `npm test` (3391 tests currently green per STATE.md) |
| Type gate | `npx tsc --noEmit` — **not** run by vitest; run explicitly (memory: tsc-in-post-merge-gate) |
| Colour gate | `npm run check:colors` |

### Phase Requirements → Test Map (testable invariants — no REQ-IDs assigned)
| Invariant | Behavior | Test Type | Command | Exists? |
|---|---|---|---|---|
| No behaviour lost in decomposition | Each moved control still reads/writes its column | integration (screen or DAO) | `npx vitest run src/db/app-settings-dao.test.ts` | ✅ DAO suite exists; screen-level ❌ Wave 0 |
| Every surfaced preference round-trips | write → `getAppSettings` returns it; portable snapshot emits it | unit | `npx vitest run src/db/app-settings-dao.test.ts` / `src/backup/export-manifest.test.ts` | ✅ |
| Self-name persists | new `setProfileName` writes `profile.name`, `changes===1` | unit | `npx vitest run src/db/profile-dao.test.ts` | ⚠️ profile-dao test exists; add name case (Wave 0) |
| Backup tree renders from both entry points | Backup routes registered in `SettingsStackParamList`; screens resolve | type + nav smoke | `npx tsc --noEmit` + device UAT | type ✅; nav smoke ❌ Wave 0 |
| No schema/format change | `TARGET_VERSION === 29`, `BACKUP_FORMAT_VERSION === 5` unchanged | unit | existing format-version assertions | ✅ (guards already assert `=== 5`) |
| Categories stays read-only | no new CRUD writer introduced | grep/review gate | manual subsystem audit | ✅ (this research) |

### Sampling Rate
- **Per task commit:** `npx vitest run` on the touched DAO/logic suite + `npx tsc --noEmit`.
- **Per wave merge:** `npm test` + `npm run check:colors` + `npx tsc --noEmit`.
- **Phase gate:** full suite green, then device UAT on the Pixel (drive Settings → each category → Data & Backup from both entry points; verify self-name persists; per memory verify-ui-on-pixel-yourself + device-uat-runas-pattern for DB invariants).

### Wave 0 Gaps
- [ ] Screen/logic tests for the hub + category container navigation (route registration + row→navigate).
- [ ] `setProfileName` writer + a `profile-dao` test case for the name path.
- [ ] A nav smoke test (or documented device-UAT step) that the four Backup routes resolve from Settings.
- [ ] (Optional) a test asserting the Settings-mounted `BackupScreen` does not double-consume `consumeSharedBackup`.

*(No new framework install needed; existing infra covers DAO/backup invariants.)*

## Security Domain

`security_enforcement` assumed enabled (not `false` in config). This is a UI-consolidation phase over an already-validated DAO; it adds no egress and no new attack surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | Local-first, no accounts |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-user device DB |
| V5 Input Validation | yes | `app-settings-dao` validates every field before UPDATE (hours 0–23, toggles 0/1, enum `.includes()` guards, `SELF_SUN_COLOUR_RE`, `assertMessageMode`, etc.) `[VERIFIED: src/db/app-settings-dao.ts:1044-1196, 200-227]`. New `setProfileName` should bound/validate the name string (length, no control chars) before write. |
| V6 Cryptography | no (do not touch) | AI credentials stay SecureStore-only (ADR-049); never surface a key in Settings or backup |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Tampered preference value reaching the scheduler/DB | Tampering / DoS | DAO write-time validators (already enforced); new controls reuse them |
| Widening AI egress via a Settings toggle | Information disclosure | Settings only flips `ai_enabled`; `AiService.ts` untouched (do not widen) |
| Credential leak into backup | Information disclosure | Keys are SecureStore-only; backup excludes them by construction (AICFG-15/16) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `default_interaction_channel` (CAPT-11) is persisted but not currently rendered in the Settings monolith, so it needs surfacing under Interactions | Row inventory / §F | Low — if a control already exists elsewhere, planner just relocates it; column + validator confirmed present |
| A2 | The stale `PortableSettingsSnapshot` "emission deferred" doc-comments are safe to leave (optional doc-sync), since the live SELECT emits the keys | Pitfall 2 | Low — cosmetic; behaviour verified from the SELECT |
| A3 | The About surface (§K) has no real support/privacy/legal destinations yet, so it ships app name/version/licenses only and omits dead rows | Diagram / §K | Low — dossier §K explicitly says omit unavailable rows |

*(All other load-bearing claims are `[VERIFIED]` against files read this session. This table is deliberately short because the phase is codebase archaeology, not external research.)*

## Open Questions (RESOLVED)

All three were framed as planner-time delegations and were resolved during planning (see the cross-AI review replan, commit `d32a0e5`). Retained here with their resolutions for the artifact record.

1. **Backup-from-Settings return semantics (D-08).** — **RESOLVED (Plan 37-07):** origin-aware return via an explicit `host` prop (per-stack wrappers, fail-closed `DEFAULT_BACKUP_HOST="backup-tab"`); every reset site made origin-aware rather than accepting the hard reset.
   - Known: `RestoreResultScreen` hard-resets to "Backup" (RestoreResultScreen.tsx:18); dual-mounting is type-safe.
   - Unclear: whether, from the Settings entry, the post-restore return should land on the Settings hub or on Backup-within-Settings.
   - Recommendation: planner decides at plan time (origin-aware return vs. accept the reset); flag if it becomes an owner-facing UX call.

2. **Shared-backup consume ownership when Backup is dual-mounted.** — **RESOLVED (Plan 37-07):** consumption stays host-scoped — `consumeSharedBackup` is gated on the host so the Settings copy never drains it; single-drain-per-host test added.
   - Known: the share-intent gate routes shared backups to `BackupTab › Backup` (linking.ts:67); `BackupScreen` consumes the singleton on focus (BackupScreen.tsx:262).
   - Recommendation: keep shared-backup consumption tab-scoped (or gate on which stack hosts the screen) so the Settings copy never drains it.

3. **Categories reservation form (D-03 / §K).** — **RESOLVED (Plan 37-04 / D-03):** route name reserved (typed but unregistered `CategoryManagement`, asserted by the `SETTINGS_REGISTERED_ROUTES` source-scan test), no visible row; the manager itself is deferred to Phase 37.1.
   - Known: reserve route name + IA slot, render no row.
   - Recommendation: hold the route string + section-order position for the future Category Management phase; the planner picks the lightest no-visible-placeholder representation.

## Sources

### Primary (HIGH confidence — files read this session)
- `src/screens/SettingsScreen.tsx` (full, 2,168 lines) — row inventory, write posture, theme selectors, self seeds.
- `src/navigation/types.ts`, `src/navigation/tabs/SettingsStack.tsx`, `src/navigation/tabs/BackupStack.tsx`, `src/navigation/linking.ts` — nav structure, sub-route precedent, dual-home typing.
- `src/db/app-settings-dao.ts` (read through line 1207 + targeted) — `AppSettings`, `PortableSettingsSnapshot`, live emission SELECT, validators.
- `src/db/profile-dao.ts`, `src/db/migrations/001-initial.ts` (profile/contacts tables + seeds) — self-record correction.
- `src/db/database.ts`, `src/db/migrations/029-ai-configuration.ts`, `src/db/migrations/profile-presentation.ts` — version facts.
- `src/backup/types.ts`, `src/backup/export-manifest.ts`, `src/backup/restore-apply.ts`, `src/backup/reconciliation.ts`, `src/screens/backup-restore-logic.ts`, `src/screens/RestoreResultScreen.tsx`/`BackupScreen.tsx` — format version, profile emission, restore hazards.
- `src/stores/theme-store.ts`, `src/screens/settings-ai-hub-logic.ts` — theme reactivity, AI hub model.
- Grep audits: categories writers, `restorePreviewCache`, `consumeSharedBackup`, `BACKUP_FORMAT_VERSION`, `TARGET_VERSION`.
- CONTEXT.md, dossier §A–§S, REQUIREMENTS.md, STATE.md, CLAUDE.md.

### Secondary / Tertiary
- None — no web/external lookups were needed or performed (no external packages, no version questions).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all seams verified in-repo.
- Decomposition map (D-09): HIGH — every row group read from source with line ranges.
- Emission/schema facts (D-06): HIGH — read the live SELECT, migration versions, and format constant.
- Backup dual-home hazards (D-08): HIGH — screen prop types + the two named hazards read on disk.
- Self-record correction (D-04b): HIGH — table DDL + seed read on disk.

**Research date:** 2026-09-14
**Valid until:** stable until the next Settings/backup/theme change lands (est. 30 days); the version facts (TARGET_VERSION 29, format 5) are stable unless a new migration/format ships.
