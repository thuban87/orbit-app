---
phase: 22-app-shell-navigation
plan: "03"
subsystem: navigation
tags: [react-navigation, nested-tabs, completion-resets, unsaved-changes]
requires:
  - phase: 22-app-shell-navigation/01
    provides: four-tab shell, TabParamList navigation ref, Dashboard reset intents
  - phase: 22-app-shell-navigation/02
    provides: focused-workflow behavior contract
provides:
  - Nested tab-safe cross-stack navigation for resume, import, reconcile, and completion flows
  - Reusable Discard/Keep beforeRemove guard with a confirmed-save bypass
  - Exhaustively audited post-tab-split route call sites
affects: [22-04-shell-chrome, 22-05-universal-fab, 22-06-contact-picker]
actuals:
  tokens: 6453
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [TabParamList container navigation, Dashboard completion reset, explicit unsaved baselines]
key-files:
  created: [src/navigation/discard-keep-guard.ts]
  modified: [src/components/ResumeImportPrompt.tsx, src/components/ResumeReconcilePrompt.tsx, src/screens/ImportCompleteScreen.tsx, src/screens/ImportReviewScreen.tsx, src/screens/ContactProfileScreen.tsx, src/components/MergeImpactSummary.tsx, src/screens/ReconcileCompleteScreen.tsx, src/screens/EditContactScreen.tsx, src/screens/HomeScreen.tsx, src/screens/SettingsScreen.tsx]
key-decisions:
  - "All cross-tab component and completion paths dispatch through the TabParamList-typed container ref."
  - "Import and reconcile completion returns are Dashboard-rooted; backup restore resets remain Backup-stack-local."
  - "Discard protects only uncommitted metadata, links, and custom-field values; immediately persisted photo changes are excluded."
metrics:
  duration: 31m
  completed: 2026-09-02
status: complete
---

# Phase 22 Plan 03: Cross-Tab Recovery and Edit Guard Summary

**Cross-tab workflow exits now resolve through the four-tab tree, while Edit Contact protects truly unsaved changes without intercepting a confirmed save or misrepresenting immediate photo persistence.**

## Performance

- Duration: 31 min
- Completed: 2026-09-02T21:54:30Z
- Tasks: 3/3
- Files modified: 11

## Accomplishments

- Routed resume prompts, import completion actions, Profile reconciliation, imported-contact completion, and merge completion to their registered tab stacks.
- Reset import and reconcile Done actions to the Dashboard root; retained the Backup stack's own Backup-root resets.
- Added `useDiscardKeepGuard`, comparing seeded DAO-input metadata, ordered link drafts, and committed custom-field values; a successful Edit save bypasses the confirmation immediately before navigating to Profile.
- Re-audited navigation, replace, push, reset, shared-component mounts, and service-passed navigation functions after the tab split.

## Task Commits

1. Task 1: Reshape stranded component cross-tab sites — `41ce9fc`
2. Task 2: Preserve completion reset destinations — `111ad9b`
3. Task 3: Guard unsaved edit changes — `4eb732b`
4. Rule 1 audit fix: Route remaining tab shortcuts — `22d4d02`

## Cross-Tab Route Audit

### Step 1: Route-call sweep

Executed:

```text
grep -rnE 'navigation(Ref)?(\.current)?\??\.(navigate|replace|push|reset)\(\s*[{"]' src/screens src/components src/services src/navigation
```

The sweep covered screens, components, services, and navigation. Its matched call-site set was: `ImportReview` (ImportComplete x2, ImportReview x2, ImportProgress, DuplicateReview, BulkImportSetup, import-acquire x2); `ReconcileGrid` (Settings x2, ReconcileComplete); Backup stack routes (BackupScreen x2 and RestorePreview/RestoreResult resets); Dashboard-stack routes (Home, CreateContact, EditContact, Digest, NeverContacted, UnboundContacts, Compose); Orrery-stack Profile routes; Settings merge/reconcile routes; shared PhotoSourcePicker CropPhoto x2; the Resume prompts; AddSpeedDialFab; and container `navigationRef` link/widget/reset actions. Full locations were recorded while executing from the literal grep and are classified below.

### Step 2: Route-to-stack registration map

| Stack | Registered routes |
| --- | --- |
| Dashboard | Home, Profile, Edit, Create, Compose, Capture, CropPhoto, Archived, NeverContacted, UnboundContacts, ManageFavourites, Digest, SurvivorSelect, MergeConflicts, MergeImpactSummary |
| Orrery | Orrery, Profile, Edit, Compose, CropPhoto, SurvivorSelect, MergeConflicts, MergeImpactSummary |
| Backup | Backup, BackupSettings, RestorePreview, RestoreResult |
| Settings | Settings, CustomFields, Archived, CropPhoto, LegacyContactPicker, ImportReview, BulkImportSetup, ImportProgress, DuplicateReview, ImportComplete, BulkReview, SurvivorSelect, MergeConflicts, MergeImpactSummary, ReconcileDetail, ReconcileGrid, ReconcileComplete |

`CropPhoto` is registered once in SettingsStack (and also in Dashboard/Orrery), so every PhotoSourcePicker mount has a registered local target.

### Step 3: Shared consumers and mount stacks

| Component/service | Mount or caller stacks | Result |
| --- | --- | --- |
| ResumeImportPrompt | App root / TabParamList container | SettingsTab nested routes for every resumable import state |
| ResumeReconcilePrompt | SettingsScreen / Settings | SettingsTab → ReconcileGrid |
| PhotoSourcePicker | SettingsScreen / Settings; EditContactScreen / Dashboard and Orrery; PhotoFieldWidget through EditContactScreen and CreateContactScreen / Dashboard and Orrery | CropPhoto is registered in Settings, Dashboard, and Orrery |
| ContactCard | Home, Digest, NeverContacted / Dashboard | no navigation consumer |
| AddSpeedDialFab | Home / Dashboard | import service caller is flagged below for Plan 05 removal |
| import-acquire route callback | SettingsScreen and LegacyContactPickerScreen / Settings; AddSpeedDialFab / Dashboard | Settings callers are local; Dashboard caller is the Plan 05 removal item |

### Step 4: Call-site × target disposition matrix

| Call sites | Origin stack(s) | Target/disposition |
| --- | --- | --- |
| ResumeImportPrompt: all five resume routes | container | fixed: SettingsTab nested ImportReview, BulkImportSetup, ImportProgress, DuplicateReview, or ImportComplete |
| ResumeReconcilePrompt | container | fixed: SettingsTab → ReconcileGrid |
| ImportComplete: DuplicateReview | Settings | local, unchanged |
| ImportComplete: UnboundContacts / Profile | Settings | fixed: DashboardTab nested targets |
| ImportComplete Done; ReconcileComplete Done | Settings | fixed: TabParamList `resetToDashboardRoot()` |
| ImportReview: Profile x2 | Settings | fixed: `resetToDashboardWith(Profile)` |
| ImportReview: ImportComplete x2; ImportProgress/DuplicateReview/BulkImportSetup flows | Settings | local, unchanged |
| MergeImpactSummary: Profile completion | Dashboard, Orrery, Settings | fixed: `resetToDashboardWith(Profile)` from every origin |
| ContactProfile: ReconcileDetail | Dashboard, Orrery | fixed: SettingsTab nested target |
| ContactProfile: SurvivorSelect, Edit, Compose | Dashboard, Orrery | registered in both origins, unchanged |
| EditContact: Profile | Dashboard, Orrery | local existing Profile; navigate returns to that existing profile and removes Edit |
| CreateContact, Digest, NeverContacted, UnboundContacts: Profile | Dashboard | local, unchanged |
| Home: Profile, ManageFavourites, NeverContacted, UnboundContacts, Archived, Create, Digest | Dashboard | local, unchanged |
| Home: Backup, Orrery, Settings | Dashboard | Rule 1 fixed: BackupTab, OrreryTab, and SettingsTab nested roots |
| Settings: ReconcileGrid, BulkReview, CustomFields, Archived | Settings | local, unchanged |
| Settings: ManageFavourites | Settings | Rule 1 fixed: DashboardTab → ManageFavourites |
| ReconcileGrid/ReconcileDetail and merge cluster | Settings | local, unchanged |
| SurvivorSelect/MergeConflicts | Dashboard, Orrery, Settings | multi-registered, local, unchanged |
| Orrery Profile paths | Orrery | local, unchanged |
| Compose: Edit | Dashboard, Orrery | multi-registered, local; Compose's existing parent Tab reset to Dashboard remains safe |
| BackupScreen and RestorePreview/RestoreResult | Backup | local Backup-stack navigation and resets; Backup is the actual stack root |
| PhotoSourcePicker: CropPhoto | Settings, Dashboard, Orrery | multi-registered, local, unchanged |
| ShareIntent and widget linking refs | TabParamList container | nested tab navigates/resets, safe |
| `import-acquire` from SettingsScreen/LegacyContactPicker | Settings | local ImportReview/BulkImportSetup, safe |
| `import-acquire` from AddSpeedDialFab | Dashboard | flagged cross-tab; intentionally not reshaped because Plan 05 removes AddSpeedDialFab and its import action. End-of-phase verification must confirm the file is gone. |

All component-level Backup resets retain `Backup`, their confirmed BackupStack root. Container-level `navigationRef.reset` calls are TabParamList-typed. The old component-level `*Tab` reset exemption is not relied on for C1/C2 after the legacy child-stack typing rejected that state; those completion paths now use the typed container ref directly.

## Decisions Made

- Use the typed container ref for cross-tab route dispatch from legacy `RootStackScreenProps` screens, avoiding the compatibility alias accepting a route that no longer exists in a child stack.
- Keep photo-only changes out of Edit's unsaved delta because the existing picker/CropPhoto behavior persists them immediately.
- Preserve the existing `navigation.navigate("Profile")` Edit completion: Profile is already below Edit in both valid stacks, so native-stack navigation removes Edit rather than replaying it on Back.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Dispatched completion resets through the container navigation ref.**
   - Found during: Task 2
   - Issue: the legacy child-stack prop rejects a tab-state reset at compile time.
   - Fix: used the already TabParamList-typed `navigationRef.current?.reset(resetToDashboardRoot())`.
   - Files: ImportCompleteScreen.tsx, ReconcileCompleteScreen.tsx
   - Commit: `111ad9b`

2. **[Rule 1 - Bug] Repaired four route-not-found tab shortcuts uncovered by the required full-source audit.**
   - Found during: Task 1 re-audit
   - Issue: Home targeted Backup/Orrery/Settings and Settings targeted ManageFavourites by flat route name after the split.
   - Fix: dispatched each through its owning nested tab target.
   - Files: HomeScreen.tsx, SettingsScreen.tsx
   - Commit: `22d4d02`

## Known Stubs

None. The scan found only real TextInput placeholder properties and historical comments, not UI data stubs.

## Residual UAT

- On a Pixel, resume pending import/reconcile flows and verify the Settings tab opens; verify import Done/reconcile Done target Dashboard and restore cancel/finish targets Backup.
- Import a single Android contact and link a duplicate; both must open Dashboard Profile without a crash. Complete a merge from both Reconcile and Profile origins.
- Verify Profile → Edit → Save → Profile → Back skips Edit. Verify changed metadata, link, and custom fields show Discard/Keep; unchanged forms and photo-only changes exit without a prompt; photo-only edits persist; successful saves bypass the dialog; partial link-save failure still prompts for retained link changes.

## Verification

- `npx tsc --noEmit` — pass.
- `npm run check:colors` — pass.
- `npm test` — pass: 195 files, 1,856 tests.
- Route assertions — pass: no stale bare cross-tab Resume/ImportComplete/Profile routes; no `replace("Profile")` in merge/import completion paths; SettingsStack contains exactly one CropPhoto registration.

## Self-Check: PASSED

- Confirmed the discard guard and all modified navigation files exist.
- Confirmed task commits `41ce9fc`, `111ad9b`, `4eb732b`, and deviation commit `22d4d02` exist in history.
