# Graph Report - orbit-app  (2026-09-01)

## Corpus Check
- 587 files · ~481,095 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4121 nodes · 11658 edges · 220 communities (184 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d5c1f6a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- database.ts
- types.ts
- field-types.ts
- 001-initial.ts
- import-session-dao.ts
- inWriteTransaction
- import-session-read.ts
- AiService.ts
- getExecutor
- HomeScreen.tsx
- OrbitContactPickerModule
- encryption.ts
- App.tsx
- backup-service.ts
- index.ts
- model-catalog-filter.ts
- restore-apply.ts
- reconcile-apply.ts
- ReconcileGridScreen.tsx
- AiSuggestionLifecycle
- Logger
- EditContactScreen.tsx
- reconcile-session-dao.ts
- Phase Details
- MergeConflictsScreen.tsx
- settings-ai-logic.ts
- contact-status-read.ts
- OrreryScreen.tsx
- field-ddl.ts
- contacts-dao.ts
- SettingsScreen.tsx
- localDateTime
- app-settings-dao.ts
- backup-schema.ts
- PhotoSourcePicker.tsx
- impact.ts
- photo-storage.ts
- notification-schedule.test.ts
- BackupScreen.tsx
- NonPublicAddresses
- reconciliation.ts
- index.ts
- newUid
- secure-fetch.ts
- phase-17-runtime-integration.test.ts
- v1 Requirements
- useTheme
- FuelEditor.tsx
- biome.json
- ai-context-read.ts
- create-contact-logic.ts
- DigestScreen.tsx
- dependencies
- ComposeScreen.tsx
- RestorePreviewScreen.tsx
- ContactProfileScreen.tsx
- contact-import-resume-sweep.ts
- Avatar.tsx
- assist-store.ts
- lifecycle-consumer-ledger.test.ts
- CaptureScreen.tsx
- reconcile-resume-sweep.ts
- expo
- model-registry.ts
- transaction.ts
- 006-normalize-custom-field-values.ts
- SqlExecutor
- ImportReviewScreen.tsx
- recency-dao.ts
- CreateContactScreen.tsx
- LegacyContactPickerScreen.tsx
- audit-adr-key-files.ts
- types.ts
- queries.test.ts
- expo-notifications.ts
- notification-gate.tsx
- BackupSettingsScreen.tsx
- bulk-review-dao.test.ts
- fuel-read.test.ts
- import-acquire.ts
- devDependencies
- AiCloudProviderId
- use-read-contacts-permission.ts
- OrbitSecureFetchModuleTest
- scripts
- restore-photo-finalize-sweep.ts
- import-session-read.ts
- reconcile-photo.ts
- restore-photo-finalize-sweep.ts
- widget-linking.ts
- saf-storage.ts
- PhotoFieldWidget.tsx
- contact-lifecycle-effects.ts
- Interaction Assist & Reach Out
- include
- FrequencyPicker.tsx
- contact-profile-logic.ts
- 14. Custom fields — [DECIDED] in v1, as its own phase
- Orbit
- graph-ask.ts
- contacts-dao.test.ts
- notification-ids.ts
- gen-adr-registry.ts
- 1. One-time FND-01 standalone proof (RELEASE APK, embedded JS bundle)
- fix-adr-key-files.ts
- gen-adr-index.ts
- synthesize-adr-edges.ts
- contact-lifecycle-effects.ts
- ConsumedBackupShare
- contact-picker-chunk.test.ts
- dashboard-read.test.ts
- AI Model Catalog Maintenance Pipeline
- Runbook: Cross-AI plan-review convergence (`/gsd-plan-review-convergence`)
- Orbit (mobile) — Project Handoff
- withWidgetBootReceiver.js
- check-adr-key-files.ts
- col-name.ts
- seedFullContact
- birthday-logic.ts
- buildDecayRequest
- audit-scalar-method-refs.mjs
- normalize-graph-docrefs.ts
- File
- 006-normalize-custom-field-values.test.ts
- 011-contact-lifecycle-schema.test.ts
- reconcile-session-read.ts
- index.ts
- notification-actions.test.ts
- adr-registry.ts
- 3. Data layer
- expo-task-manager.ts
- PhotoFieldWidget.tsx
- ai-service-guards.test.ts
- crop-geometry.ts
- File
- 7. Visual design
- linking.ts
- File
- System Docs
- 4. Port analysis — verified against the repo, not estimated
- package.json
- ResumeReconcilePrompt.tsx
- sun-picker-read.test.ts
- field-type-change.test.ts
- Directory
- 5. Repo structure and access to the old code
- 6. Friction reduction — the features that decide whether this works
- 8. Product positioning
- OrbitShareFinishModule
- withBackupRestoreShareIntent.js
- withContactPickerPermission.js
- defsForCreateForm
- 13. Tooling
- OrbitShareFinishModule
- app.config.ts
- expo-clipboard
- expo-document-picker
- expo-image
- expo-image-manipulator
- expo-image-picker
- expo-localization
- expo-secure-store
- expo-share-intent
- expo-sharing
- expo-sqlite
- expo-task-manager
- libphonenumber-js
- react
- react-native-android-widget
- @react-native-community/datetimepicker
- react-native-gesture-handler
- @react-native-picker/picker
- react-native-quick-base64
- react-native-reanimated
- react-native-screens
- @react-navigation/native
- @react-navigation/native-stack
- zustand
- WINDOWS.md
- check-colors.sh
- graph-build.sh
- MAX_SUPPORTED_BACKUP_FORMAT_VERSION
- NAME_ONLY_CEILING
- ADR Index
- computeRingReorder
- fuel-dao.test.ts
- File
- export-manifest.ts
- transaction.ts
- recency-dao.test.ts
- source-consolidation.ts
- timeline-read.ts
- NativeGcmCipher
- survivor-recommendation.ts
- LinksEditor.tsx
- buildDecayRequest
- contact-read.test.ts
- 011-contact-lifecycle-schema.test.ts
- field-sweep.test.ts
- EditContactScreen.tsx
- imported-contact-dao.ts
- notification-read.test.ts
- Directory
- contact-read.test.ts
- purge-dao.ts
- import-photo.ts
- field-sweep.test.ts
- ReconcileDetailScreen
- fail
- field-type-change.test.ts
- assist-eligibility.ts
- NativeGcmCipher
- NativeQuickCrypto
- RankedFuelLine.tsx

## God Nodes (most connected - your core abstractions)
1. `SqlExecutor` - 189 edges
2. `useTheme()` - 155 edges
3. `inWriteTransaction()` - 139 edges
4. `runMigrations()` - 100 edges
5. `getExecutor()` - 96 edges
6. `openTestDb()` - 95 edges
7. `nodeSqliteExecutor()` - 93 edges
8. `localDateTime()` - 71 edges
9. `bumpDataRevisionCore()` - 69 edges
10. `migration001` - 67 edges

## Surprising Connections (you probably didn't know these)
- `AppShell()` --indirect_call--> `getExecutor()`  [INFERRED]
  App.tsx → src/db/database.ts
- `BackupScreen()` --indirect_call--> `section()`  [INFERRED]
  src/screens/BackupScreen.tsx → scripts/audit-adr-key-files.ts
- `AppShell()` --calls--> `openAndMigrate()`  [EXTRACTED]
  App.tsx → src/db/database.ts
- `AppShell()` --calls--> `registerBackupSweep()`  [EXTRACTED]
  App.tsx → src/services/backup-sweep.ts
- `AppShell()` --calls--> `getDeviceRegion()`  [EXTRACTED]
  App.tsx → src/services/device-region.ts

## Import Cycles
- None detected.

## Communities (220 total, 36 thin omitted)

### Community 0 - "database.ts"
Cohesion: 0.06
Nodes (29): makeContact(), uid(), seedContact(), uid(), EventRow, seedContact(), uid(), seedArchivedFavourite() (+21 more)

### Community 1 - "types.ts"
Cohesion: 0.05
Nodes (47): migrated(), PHOTO, uidFactory(), db(), newUid(), AI_DEFAULTS, BACKUP_DEFAULTS, IsNever (+39 more)

### Community 2 - "field-types.ts"
Cohesion: 0.12
Nodes (20): CustomIntervalResult, IntervalUnit, parseCustomInterval(), UNIT_FACTORS, FrequencyPicker(), FrequencyPickerProps, PRESET_VALUES, PRESETS (+12 more)

### Community 3 - "001-initial.ts"
Cohesion: 0.10
Nodes (29): newUid(), seedContact(), contact(), method(), uid(), readDataRevision(), makeContact(), uid() (+21 more)

### Community 4 - "import-session-dao.ts"
Cohesion: 0.09
Nodes (23): ContactEditRow, Assert, CADENCE_OWNERS, _CadenceCreate, _CadenceDashProgress, _CadenceDashStatus, _CadenceEditRow, _CadenceImpactInputs (+15 more)

### Community 5 - "inWriteTransaction"
Cohesion: 0.09
Nodes (21): Architecture, Changelog, Configuration, Dashboard, Data Model, Decisions, Gotchas, Handling Bound and Unbound contacts (+13 more)

### Community 6 - "import-session-read.ts"
Cohesion: 0.13
Nodes (26): ringVisual, colors, orreryRingStyle, StrokeStyle, mapSunOccupantLookup(), resolveSunOccupant(), SunOccupant, SunOccupantHeader (+18 more)

### Community 7 - "AiService.ts"
Cohesion: 0.07
Nodes (29): SecureFetchError, inputFor(), makePrompt(), secureCustomFetchMock, SecureFetchError, AiSettings, AiError, AiErrorCode (+21 more)

### Community 8 - "getExecutor"
Cohesion: 0.09
Nodes (16): def(), makeContact(), uid(), FuelRow, seedContact(), uid(), CREATE_STATEMENTS, migration001 (+8 more)

### Community 9 - "HomeScreen.tsx"
Cohesion: 0.10
Nodes (25): BirthdayBanner(), BirthdayBannerProps, birthdayCopy(), BirthdayEntry, styles, FilterChipRow(), BirthdayCandidate, count() (+17 more)

### Community 10 - "OrbitContactPickerModule"
Cohesion: 0.09
Nodes (29): Any, InputStream, Intent, Boolean, CodedException, Context, Module, Promise (+21 more)

### Community 11 - "encryption.ts"
Cohesion: 0.10
Nodes (19): BackupEncryptionProfile, EncryptedBackupEnvelope, BackupEnvelopeCrypto, BackupEnvelopeCryptoOptions, BackupEnvelopeError, BackupEnvelopeErrorCode, base64(), decodeBase64() (+11 more)

### Community 12 - "App.tsx"
Cohesion: 0.13
Nodes (19): combineDateAndTime(), DateOrStored, isCombinedInFuture(), localTimePart(), parseLocalDateTime(), toDate(), CHANNEL_OPTIONS, DIRECTION_OPTIONS (+11 more)

### Community 13 - "backup-service.ts"
Cohesion: 0.09
Nodes (29): AppShell(), styles, isMigration006IntegrityError(), RootNavigator(), registerFieldSweep(), StaleCandidate, interactionAssistSweep(), AppStateLike (+21 more)

### Community 14 - "index.ts"
Cohesion: 0.16
Nodes (18): blankToNull(), DraftRow(), FuelDraft, FuelEditor(), FuelEditorProps, FuelEditPatch, FuelRow(), KIND_OPTIONS (+10 more)

### Community 15 - "model-catalog-filter.ts"
Cohesion: 0.12
Nodes (22): getImpactInputs(), ImpactInputs, computeGravity(), GravityInteraction, GravityResult, GravityTier, GravityTunables, parseLocalMs() (+14 more)

### Community 16 - "restore-apply.ts"
Cohesion: 0.10
Nodes (37): applyRestore(), assertCompleteIncomingPairs(), deleteActions(), DeleteCandidate, entities, entry(), FinalizeCandidate, idMap() (+29 more)

### Community 17 - "reconcile-apply.ts"
Cohesion: 0.16
Nodes (20): resumeImport(), ResumeImportPrompt(), ResumeImportPromptProps, RootNavigation, styles, listCategories(), getSessionById(), listSessionRows() (+12 more)

### Community 18 - "ReconcileGridScreen.tsx"
Cohesion: 0.05
Nodes (55): CustomFieldValue(), CustomFieldValueProps, FieldSpec, presentValue(), styles, draftToFieldFields(), FieldDefDraft, FieldDraftFields (+47 more)

### Community 19 - "AiSuggestionLifecycle"
Cohesion: 0.11
Nodes (15): ResolvedPrompt, CONFIG, CONTEXT, makeSeam(), Seam, AiSuggestionDeps, AiSuggestionLifecycle, AiSuggestionState (+7 more)

### Community 20 - "Logger"
Cohesion: 0.21
Nodes (10): PhotoSourcePickerProps, clamp(), CropRect, cropRectFromTransform(), CropTransform, persistCroppedMaster(), PersistCroppedMasterArgs, PhotoPipelineError (+2 more)

### Community 21 - "EditContactScreen.tsx"
Cohesion: 0.10
Nodes (19): Architecture, Changelog, Composing and handing off a message, Configuration, Consolidating methods during a contact merge, Contact Methods, Data Model, Decisions (+11 more)

### Community 22 - "reconcile-session-dao.ts"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Configuration, Contact Reconciliation, Data Model, Decisions, Gotchas, Handling a missing source (+7 more)

### Community 23 - "Phase Details"
Cohesion: 0.06
Nodes (34): Canonical refs, Canonical refs, Canonical refs, Canonical refs, Canonical refs, Cross-phase constraints (from INDEX.md's constraint log — these cross phase boundaries), Overview, Phase 10: Share-Sheet Capture (+26 more)

### Community 24 - "MergeConflictsScreen.tsx"
Cohesion: 0.14
Nodes (16): HeadlessResponsePayload, DATA, freshHandler(), h, actionUid(), birthdayBody(), birthdayIdentifier(), decayBody() (+8 more)

### Community 25 - "settings-ai-logic.ts"
Cohesion: 0.16
Nodes (18): IPV4_MAPPED_PREFIX, ipv4InCidr(), ipv4IsNonPublic(), ipv6InCidr(), ipv6IsNonPublic(), isNonPublicIpLiteral(), NAT64_PREFIX, NON_PUBLIC_IPV4_CIDRS (+10 more)

### Community 26 - "contact-status-read.ts"
Cohesion: 0.07
Nodes (28): App Shell, Applying destructive emphasis, Applying relationship-state emphasis, Architecture, Bootstrapping normalized-method migration, Changelog, Composing from a contact, Configuration (+20 more)

### Community 27 - "OrreryScreen.tsx"
Cohesion: 0.10
Nodes (25): isBulkActionAvailable(), actionLabels, BulkAction, CandidateCardGrid(), CandidateCardGridProps, CandidateChoice, CandidateItem, styles (+17 more)

### Community 28 - "field-ddl.ts"
Cohesion: 0.17
Nodes (11): Android Contact Reconciliation UAT Pipeline, Architecture (Phase 20), Code, Device-to-database evidence chain, File Locations, How to Run Contact Reconciliation UAT, Overview, Pitfalls (+3 more)

### Community 29 - "contacts-dao.ts"
Cohesion: 0.10
Nodes (25): groups(), FieldChoiceGroup(), FieldChoiceGroupProps, FieldChoiceMode, FieldChoiceOption, initialSelection(), styles, KEEP_ORBIT_PHOTO (+17 more)

### Community 30 - "SettingsScreen.tsx"
Cohesion: 0.10
Nodes (33): OrbitBody(), OrbitBodyProps, SegmentedControl(), SegmentedControlOption, SegmentedControlProps, styles, getContactStatus(), tableExists() (+25 more)

### Community 31 - "localDateTime"
Cohesion: 0.10
Nodes (24): main(), renderSeedModule(), SEED_PATH, CatalogFetch, CatalogFetchResponse, CatalogStorage, isEmptyCatalog(), isModelCatalog() (+16 more)

### Community 32 - "app-settings-dao.ts"
Cohesion: 0.09
Nodes (30): AppSettingsPatch, AppSettingsRow, assertAiProvider(), assertBackupDays(), assertHour(), assertPhoneRegionOverride(), assertSelfSunColour(), assertSunContactId() (+22 more)

### Community 33 - "backup-schema.ts"
Cohesion: 0.12
Nodes (27): assertUniqueRows(), assertUniqueTombstones(), compareRowAndTombstone(), ENTITY_POLICIES, EntityPolicy, incompatibleRows(), MergeableEntityType, newestRow() (+19 more)

### Community 34 - "PhotoSourcePicker.tsx"
Cohesion: 0.16
Nodes (17): BulkReviewDbRow, BulkReviewFlag, listBulkReviewFlags(), sourceBirthday(), daysInMonth(), daysUntilBirthday(), isLeapYear(), isValidStoredBirthday() (+9 more)

### Community 35 - "impact.ts"
Cohesion: 0.09
Nodes (25): ModelCatalog, createFileCatalogStorage(), resolveActiveCatalog(), resolveMaxOutputTokens(), CATALOG, InteractionAssistChannel, actionablePrimaryPhoneDestination(), ComposeControls (+17 more)

### Community 36 - "photo-storage.ts"
Cohesion: 0.21
Nodes (18): array(), assertPortableSettings(), fail(), FORWARD_MIGRATIONS, Migration, parseBackupManifest(), PORTABLE_SETTINGS_KEYS, RawManifest (+10 more)

### Community 37 - "notification-schedule.test.ts"
Cohesion: 0.09
Nodes (31): migrations, photoMocks, contact(), MIGRATIONS, uid(), assist(), contact(), MIGRATIONS (+23 more)

### Community 38 - "BackupScreen.tsx"
Cohesion: 0.08
Nodes (53): consumeSharedBackup(), pickBackupDocument(), RestoreApplyResult, RestoreMode, AppSettings, getAppSettings(), recordAutomaticBackupHealthCore(), localDateTime() (+45 more)

### Community 39 - "NonPublicAddresses"
Cohesion: 0.14
Nodes (18): Boolean, ByteArray, InetAddress, Int, List, Map, Module, Promise (+10 more)

### Community 40 - "reconciliation.ts"
Cohesion: 0.17
Nodes (18): assertOneChange(), ContactMetadataRow, ignoreBulkReviewFlag(), ignoreBulkReviewFlagCore(), IgnoreBulkReviewFlagInput, insertResolutionCore(), resolveBulkReviewFlag(), resolveBulkReviewFlagCore() (+10 more)

### Community 41 - "index.ts"
Cohesion: 0.21
Nodes (14): classifyPermissionResult(), ContactsPermissionRequestResult, ContactsPermissionVerdict, clearDeniedPresentation(), ContactsPermissionRequestState, ContactsPermissionResult, ContactsPermissionState, getContactsPermission() (+6 more)

### Community 43 - "secure-fetch.ts"
Cohesion: 0.11
Nodes (16): cancel(), request(), NativeSecureFetchInput, NativeSecureFetchResult, OrbitSecureFetchModule, OrbitSecureFetchModule, generateRequestId(), mapNativeError() (+8 more)

### Community 44 - "phase-17-runtime-integration.test.ts"
Cohesion: 0.21
Nodes (7): byDisplayOrder(), defsForCreateForm(), isLive(), upsertValue(), visibleDefsForProfile(), chain, withMutex()

### Community 45 - "v1 Requirements"
Cohesion: 0.07
Nodes (27): Actionable Notifications (NOTIF), AI Message Suggestions (AI), Backup, Export & Restore (BKP), Compose consumers' shared surface — see CMP; and the Orrery (ORR), Compose Screen & SMS Handoff (CMP), Contact CRUD & Lifecycle (CRUD), Contact Data Normalization (CDN), Contact Reconciliation & Merge (RCN) (+19 more)

### Community 46 - "useTheme"
Cohesion: 0.10
Nodes (19): Architecture, Capturing and cropping a photo, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works (+11 more)

### Community 47 - "FuelEditor.tsx"
Cohesion: 0.43
Nodes (6): compareFuel(), FUEL_KIND_PRIORITY, kindRank(), RankableFuel, rankedIds(), Row

### Community 48 - "biome.json"
Cohesion: 0.08
Nodes (25): source, assist, actions, files, includes, formatter, enabled, indentStyle (+17 more)

### Community 49 - "ai-context-read.ts"
Cohesion: 0.20
Nodes (9): automaticBackupFilename(), AutomaticBackupMetadata, filesToPrune(), isExpiredAutomaticBackup(), isOwnedAutomaticBackup(), shouldRunAutomaticBackup(), now, ownedAutomaticUris() (+1 more)

### Community 50 - "create-contact-logic.ts"
Cohesion: 0.07
Nodes (59): addMethodDraft(), canonicalDuplicateCopy(), choosePrimary(), collapseCanonicalDuplicate(), ContactMethodEditorDraft, discardBlankMethodDrafts(), EMPTY_METHOD_GROUPS, emptyMethodDraft() (+51 more)

### Community 51 - "DigestScreen.tsx"
Cohesion: 0.18
Nodes (13): setRowContact(), cleanupDiscardedStagedPhotos(), describeResumable(), ImportStagingFileSystem, nativeImportStagingFs, reconcileOrphanStagedPhotos(), registerImportResumeSweep(), RegisterImportResumeSweepOptions (+5 more)

### Community 52 - "dependencies"
Cohesion: 0.08
Nodes (25): expo, expo-file-system, expo-notifications, expo-sms, expo-status-bar, dependencies, expo, expo-file-system (+17 more)

### Community 53 - "ComposeScreen.tsx"
Cohesion: 0.21
Nodes (12): getMergeCandidate(), listMergeCandidates(), MergeCandidate, recommendSurvivor(), scoreCandidate(), SurvivorContinuitySignal, SurvivorRecommendation, SurvivorRecommendationCandidate (+4 more)

### Community 54 - "RestorePreviewScreen.tsx"
Cohesion: 0.07
Nodes (28): AutomaticBackupDependencies, AutomaticBackupReencryptionDependencies, AutomaticBackupReencryptionResult, BackupPreview, BackupPreviewResult, backupServiceQueue, createAutomaticBackupReencryptionService(), createAutomaticBackupService() (+20 more)

### Community 55 - "ContactProfileScreen.tsx"
Cohesion: 0.09
Nodes (32): GravityBar(), GravityBarProps, styles, OverflowAction, OverflowMenu(), styles, ContactMethodGroups, listActionablePrimaryMethods() (+24 more)

### Community 56 - "contact-import-resume-sweep.ts"
Cohesion: 0.18
Nodes (22): GentleLine, OverlookedRow, QualityMarkRow, readGentleLine(), readOverlooked(), readRetrospective(), RetrospectiveRow, AllQuietInputs (+14 more)

### Community 57 - "Avatar.tsx"
Cohesion: 0.19
Nodes (16): getInitials(), hashName(), swatchIndex(), countNeverContacted(), DashboardRow, FavouriteRow, listDashboard(), listNeverContacted() (+8 more)

### Community 58 - "assist-store.ts"
Cohesion: 0.16
Nodes (22): BirthdayNotificationCandidate, DecayEligibleCandidate, listBirthdayNotificationCandidates(), listDecayEligibleCandidates(), allowedSlotForDay(), clampHour(), clampStagger(), inQuietWindow() (+14 more)

### Community 59 - "lifecycle-consumer-ledger.test.ts"
Cohesion: 0.16
Nodes (18): captureMultiAttach(), captureMultiNote(), addFuel(), addFuelCore(), assertOneChange(), confirmFuel(), confirmFuelCore(), ConfirmFuelInput (+10 more)

### Community 60 - "CaptureScreen.tsx"
Cohesion: 0.38
Nodes (6): DAYS_TO_FREQUENCY, intendedLabel(), IntensityLine(), IntensityLineProps, styles, IntensityResult

### Community 61 - "reconcile-resume-sweep.ts"
Cohesion: 0.11
Nodes (9): createBackupEncryptionLifecycle(), EncryptionFlagStore, BackupPassphraseBackend, BackupPassphraseChangeStore, BackupPassphraseStore, createBackupPassphraseStore(), nativeBackend, PendingBackupPassphraseChange (+1 more)

### Community 62 - "expo"
Cohesion: 0.09
Nodes (21): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+13 more)

### Community 63 - "model-registry.ts"
Cohesion: 0.10
Nodes (30): asCatalogProvider(), better(), EMPTY, filterToFrontier(), FRONTIER_TIERS, FrontierTier, frontierWinners(), isDated() (+22 more)

### Community 64 - "transaction.ts"
Cohesion: 0.25
Nodes (10): assertSafeReconcileStagingRelative(), assertSafeRelative(), listReconcileStagingPhotos(), reconcileStagingRelPath(), stageReconcilePhoto(), digest(), promoteReconcilePhoto(), ReconcilePhotoFs (+2 more)

### Community 65 - "006-normalize-custom-field-values.ts"
Cohesion: 0.11
Nodes (17): Architecture, Changelog, Choosing the sun, Configuration, Data Model, Decisions, Gotchas, How It Works (+9 more)

### Community 66 - "SqlExecutor"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works, Key Files (+7 more)

### Community 67 - "ImportReviewScreen.tsx"
Cohesion: 0.16
Nodes (17): addSignal(), candidateFor(), candidateScore(), classifyCandidate(), ContactNameRow, DuplicateEvidenceCandidate, DuplicateEvidenceResult, DuplicateEvidenceSignal (+9 more)

### Community 68 - "recency-dao.ts"
Cohesion: 0.12
Nodes (15): Architecture, Capture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works (+7 more)

### Community 69 - "CreateContactScreen.tsx"
Cohesion: 0.17
Nodes (16): AssistBanner(), questionFor(), styles, AssistConfirmation(), AssistConfirmationProps, styles, PendingConfirmationsSheet(), questionFor() (+8 more)

### Community 70 - "LegacyContactPickerScreen.tsx"
Cohesion: 0.10
Nodes (19): Architecture, Changelog, Configuration, Data Model, Decisions, Deriving gravity and intensity, Gotchas, How It Works (+11 more)

### Community 71 - "audit-adr-key-files.ts"
Cohesion: 0.15
Nodes (18): adrDir, auditAdrKeyFiles(), AuditResult, byBasename, Category, CATEGORY_ORDER, classify(), everExisted() (+10 more)

### Community 72 - "types.ts"
Cohesion: 0.11
Nodes (17): Acquiring and accepting a selection, Architecture, Changelog, Configuration, Contact Import, Data Model, Decisions, Gotchas (+9 more)

### Community 73 - "queries.test.ts"
Cohesion: 0.14
Nodes (13): contact(), email(), phone(), uid(), LegacyColumn, LegacyDef, LegacyRow, Migration006IntegrityError (+5 more)

### Community 74 - "expo-notifications.ts"
Cohesion: 0.11
Nodes (16): addNotificationResponseReceivedListener, AndroidImportance, AndroidNotificationVisibility, cancelScheduledNotificationAsync, clearLastNotificationResponseAsync, getAllScheduledNotificationsAsync, getLastNotificationResponseAsync, getPermissionsAsync (+8 more)

### Community 75 - "notification-gate.tsx"
Cohesion: 0.22
Nodes (16): ringColor(), ringWeight(), fixture, widgetPalette, WidgetTile, ActionButton(), asColor(), asImageSource() (+8 more)

### Community 76 - "BackupSettingsScreen.tsx"
Cohesion: 0.13
Nodes (30): applyContactMethodDiff(), applyContactMethodDiffCore(), assertOneChange(), ContactMethodDraft, ContactMethodNormalizationContext, ContactMethodRow, ContactMethodSaveResult, listContactMethods() (+22 more)

### Community 77 - "bulk-review-dao.test.ts"
Cohesion: 0.12
Nodes (15): AI Suggestions, Architecture, Changelog, Configuration, Configuring a provider, Custom egress and model catalog, Data Model, Decisions (+7 more)

### Community 78 - "fuel-read.test.ts"
Cohesion: 0.21
Nodes (9): finishActivity(), OrbitShareFinishModule, CapturePickRow, listCapturePickContacts(), CaptureScreen(), GridItem, hostOf(), styles (+1 more)

### Community 79 - "import-acquire.ts"
Cohesion: 0.18
Nodes (16): deferNeedsReview(), ImportSessionRowStatus, markRowStatus(), resolveAlreadyLinked(), ImportSessionRow, hasUnresolvedRows(), UNRESOLVED_ROW_STATUSES, failureReason() (+8 more)

### Community 80 - "devDependencies"
Cohesion: 0.12
Nodes (17): babel-preset-expo, @biomejs/biome, devDependencies, babel-preset-expo, @biomejs/biome, patch-package, tsx, @types/node (+9 more)

### Community 81 - "AiCloudProviderId"
Cohesion: 0.13
Nodes (9): AiKeyStore, createAiKeyStore(), keyItemName(), nativeSecureStoreBackend, SecureKeyBackend, AI_PROVIDER_IDS, AiCloudProviderId, AiGenerationRequest (+1 more)

### Community 82 - "use-read-contacts-permission.ts"
Cohesion: 0.15
Nodes (23): canonicalFor(), assertSafeImportStagingRelative(), acceptPickedContacts(), deleteStagedPhoto(), persistPhotoMaster(), photoRelativePath(), assertContactId(), contactPhotoRelPath() (+15 more)

### Community 83 - "OrbitSecureFetchModuleTest"
Cohesion: 0.19
Nodes (7): File, ByteArray, InetAddress, List, String, OrbitSecureFetchModuleTest, Vector

### Community 84 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, android, audit:adr-key-files, check:adr-key-files, check:colors, fix:adr-key-files, gen:adr-index, gen:adr-registry (+8 more)

### Community 85 - "restore-photo-finalize-sweep.ts"
Cohesion: 0.19
Nodes (14): assertSafeRestorePendingRelative(), deleteJournalEntryCore(), listJournalEntriesCore(), RestorePhotoJournalAction, RestorePhotoJournalEntry, RestorePhotoJournalTargetKind, deleteRestorePending(), listRestorePendingPhotos() (+6 more)

### Community 86 - "import-session-read.ts"
Cohesion: 0.18
Nodes (15): ImportSessionMode, getResumableSession(), ImportSession, ImportSessionDbRow, mapSession(), parseCandidates(), sessionSummaryCounts, sourceBirthday() (+7 more)

### Community 87 - "reconcile-photo.ts"
Cohesion: 0.25
Nodes (8): OrreryClockContext, useOrreryClock(), OrreryCanvas(), OrreryCanvasProps, seeded(), Star, SunBody(), SunBodyProps

### Community 88 - "restore-photo-finalize-sweep.ts"
Cohesion: 0.14
Nodes (13): Animation and pause boundary, Architecture (Phase 13), Assets, Code, Fallback Chain / Resolution Order, File Locations, Geometry and rendered state, How to Add or Change an Orrery Layer (+5 more)

### Community 89 - "widget-linking.ts"
Cohesion: 0.20
Nodes (11): parseWidgetId(), resolveWidgetUri(), WidgetLinkingGate(), WidgetNavIntent, guardWidgetIntent(), archived, bound, Contact (+3 more)

### Community 90 - "saf-storage.ts"
Cohesion: 0.26
Nodes (8): ContactCard(), ContactCardProps, statusLabel(), styles, ProfileStatus, RawRow, OrbitingContact, UnboundRow

### Community 91 - "PhotoFieldWidget.tsx"
Cohesion: 0.10
Nodes (17): PickContactsOptions, PickedContact, PickedMethod, readAllContacts(), readContactsByLookupKeys(), SelectedReadResult, OrbitContactPickerModule, OrbitContactPickerModule (+9 more)

### Community 92 - "contact-lifecycle-effects.ts"
Cohesion: 0.11
Nodes (17): Acting from the shade, Architecture, Changelog, Cleaning up a purge, Configuration, Data Model, Decisions, Gotchas (+9 more)

### Community 93 - "Interaction Assist & Reach Out"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works, Interaction Assist & Reach Out (+7 more)

### Community 94 - "include"
Cohesion: 0.14
Nodes (13): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, ./src/*, **/*.ts, **/*.tsx, compilerOptions, forceConsistentCasingInFileNames (+5 more)

### Community 95 - "FrequencyPicker.tsx"
Cohesion: 0.13
Nodes (14): Architecture, Changelog, Configuration, Data Model, Decisions, Delivering the weekly prompt, Digest, Gotchas (+6 more)

### Community 96 - "contact-profile-logic.ts"
Cohesion: 0.08
Nodes (25): Architecture, Binding and unbinding a relationship, Changelog, Configuration, Contacts, Creating a contact during capture, Creating and editing a contact, Creating or linking an imported contact (+17 more)

### Community 97 - "14. Custom fields — [DECIDED] in v1, as its own phase"
Cohesion: 0.15
Nodes (13): 14.10 What must be built new, 14.11 Two SQLite constraints — both non-issues, recorded so they are not re-derived, 14.1 Storage model — [DECIDED] two tables, 14.2 [DECIDED] Every value column is declared TEXT, permanently, 14.3 [DECIDED] Type enforcement is the UI's job, not the database's, 14.4 [DECIDED] Type changes — automatic conversion with flagged exceptions, 14.5 [DECIDED] Deletion — dynamic action, quarantine, undo, 14.6 [DECIDED] Snapshot table for undo (+5 more)

### Community 98 - "Orbit"
Cohesion: 0.15
Nodes (12): Active, Business Context, Constraints, Context, Core Value, Evolution, Key Decisions, Orbit (+4 more)

### Community 99 - "graph-ask.ts"
Cohesion: 0.15
Nodes (11): adrDir, adrStatus, byId, graph, graphPath, Link, [mode, arg], Node (+3 more)

### Community 100 - "contacts-dao.test.ts"
Cohesion: 0.09
Nodes (9): addDefinition(), uid(), CHILD_COPY_COLUMNS, CHILD_DDL, copyContacts(), createMethods(), EXPECTED_CONTACT_CHILDREN, LegacyContact (+1 more)

### Community 101 - "notification-ids.ts"
Cohesion: 0.12
Nodes (15): Architecture, Backup & Restore, Changelog, Configuration, Data Model, Decisions, Encrypting a backup, Exporting a snapshot (+7 more)

### Community 102 - "gen-adr-registry.ts"
Cohesion: 0.18
Nodes (10): Adr, adrDir, adrs, field(), outPath, IMPORTANT: outranks NOTE: for a human skimming, and both are graphify, readAdrs(), repoRoot (+2 more)

### Community 103 - "1. One-time FND-01 standalone proof (RELEASE APK, embedded JS bundle)"
Cohesion: 0.08
Nodes (24): Android Home-Screen Widget Integration Pipeline, Architecture (Phase 12), Code, File Locations, How to Change the Widget, Overview, Pitfalls, Provider configuration (+16 more)

### Community 104 - "fix-adr-key-files.ts"
Cohesion: 0.17
Nodes (11): Finding, adrDir, apply, byFile, CORRECTABLE, diffs, Edit, edits (+3 more)

### Community 105 - "gen-adr-index.ts"
Cohesion: 0.17
Nodes (8): adrDir, byAdr, carried, { findings }, outPath, repoRoot, Row, rows

### Community 106 - "synthesize-adr-edges.ts"
Cohesion: 0.17
Nodes (11): abs, adrNodeIds, adrsLinked, existing, fileNodeId, filesLinked, { findings }, Graph (+3 more)

### Community 107 - "contact-lifecycle-effects.ts"
Cohesion: 0.13
Nodes (14): Architecture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works, Key Files (+6 more)

### Community 108 - "ConsumedBackupShare"
Cohesion: 0.33
Nodes (7): isSafeColName(), makeColName(), slugify(), CONTACTS_COLUMNS, CUSTOM_FIELD_VALUES_COLUMNS, RESERVED_COLUMN_NAMES, ROWID_ALIASES

### Community 109 - "contact-picker-chunk.test.ts"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Configuration, Data Model, Decisions, Explaining profile rogue status, Gotchas, How It Works (+7 more)

### Community 110 - "dashboard-read.test.ts"
Cohesion: 0.29
Nodes (9): addFuelRow(), DECAY(), localDateOffset(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid() (+1 more)

### Community 111 - "AI Model Catalog Maintenance Pipeline"
Cohesion: 0.17
Nodes (11): AI Model Catalog Maintenance Pipeline, Architecture (Phase 14), Catalog generation, Code, Fallback Chain / Resolution Order, File Locations, How to Refresh the Bundled Catalog, Overview (+3 more)

### Community 112 - "Runbook: Cross-AI plan-review convergence (`/gsd-plan-review-convergence`)"
Cohesion: 0.20
Nodes (9): 0. The command, 1. Why each reviewer needs special handling, 2. The review step — one Sonnet-5 subagent does all three lanes, 3. The replan + internal-check steps — inherit the orchestrator model, 4. The CYCLE_SUMMARY contract (load-bearing), 5. Loop control the orchestrator runs, 6. Non-negotiable discipline, 7. What it produces (+1 more)

### Community 113 - "Orbit (mobile) — Project Handoff"
Cohesion: 0.20
Nodes (9): 10. Contact list driving the personal use case, 11. Explicitly out of scope, 12. Open questions summary, 15. First moves, 1. What Orbit is, 2. Platform and stack, 9. Security posture (settled context, carried from the session), Existing feature set (Obsidian plugin, v0.9.0) (+1 more)

### Community 114 - "withWidgetBootReceiver.js"
Cohesion: 0.31
Nodes (9): addBootPermission(), addBootReceiver(), fs, path, receiverKotlinSource(), {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
}, withBootReceiverClass(), withBootReceiverManifest() (+1 more)

### Community 115 - "check-adr-key-files.ts"
Cohesion: 0.22
Nodes (8): all, baseArg, byAdr, changedAdrs(), errors, { findings, noKeyFilesBlock }, git(), repoRoot

### Community 116 - "col-name.ts"
Cohesion: 0.17
Nodes (11): Architecture (Phases 02, 11, 16, 17, 18.1), Code, File Locations, How to Add a SQLite Migration, Migration runner, Overview, Pitfalls, Resolution order (+3 more)

### Community 117 - "seedFullContact"
Cohesion: 0.39
Nodes (10): seedContact(), seedCustomValues(), seedDef(), seedEvent(), seedFuel(), seedFullContact(), seedHistory(), seedInteraction() (+2 more)

### Community 118 - "birthday-logic.ts"
Cohesion: 0.15
Nodes (12): Architecture (Phase 15), Code, File Locations, How to Add a Local Notification Kind, Local Notification Integration Pipeline, Notification identifiers, Overview, Pitfalls (+4 more)

### Community 119 - "buildDecayRequest"
Cohesion: 0.10
Nodes (19): Architecture, Capturing a custom photo value, Changelog, Choosing AI-sharing consent, Configuration, Creating and editing a definition, Custom Fields, Data Model (+11 more)

### Community 120 - "audit-scalar-method-refs.mjs"
Cohesion: 0.25
Nodes (7): findings, OWNERS, ROOT, scalarReferences(), SOURCE_ROOT, stripComments(), unowned

### Community 121 - "normalize-graph-docrefs.ts"
Cohesion: 0.22
Nodes (8): abs, canonical, Graph, GraphLink, GraphNode, links, remap, seen

### Community 122 - "File"
Cohesion: 0.12
Nodes (7): db(), Directory, fs, insertContact(), text, uidFactory(), BackupEncryptionBackend

### Community 123 - "006-normalize-custom-field-values.test.ts"
Cohesion: 0.48
Nodes (5): addMethodPiiFixture(), makeContact(), makeDef(), makeNeverAssignedUnboundContact(), uid()

### Community 124 - "011-contact-lifecycle-schema.test.ts"
Cohesion: 0.13
Nodes (22): assertOneChange(), ReviewedSnapshotMap, reviewedValueFor(), upsertReviewedSnapshot(), upsertReviewedSnapshotCore(), UpsertReviewedSnapshotInput, buildDesiredMethodList(), canonicalMethod() (+14 more)

### Community 125 - "reconcile-session-read.ts"
Cohesion: 0.06
Nodes (43): isContactPickerAvailable(), pickContacts(), ScrimPointerEvents, speedDialScrimPointerEvents(), AddSpeedDialFab(), AnimatedPressable, styles, ResumeReconcilePrompt() (+35 more)

### Community 126 - "index.ts"
Cohesion: 0.16
Nodes (8): ConsumedBackupShare, hasSharedBackup(), OrbitBackupDocumentPickerModule, OrbitBackupDocumentPickerModule, BACKUP_SHARE_MIME_TYPES, isBackupShareIntent(), navigationRef, ShareIntentGate()

### Community 127 - "notification-actions.test.ts"
Cohesion: 0.29
Nodes (9): listContactsSummary(), filterRows(), matchesQuery(), selectionCount(), rows, toggleSelection(), ContactPickerRow, toPickerRows() (+1 more)

### Community 128 - "adr-registry.ts"
Cohesion: 0.01
Nodes (148): ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011 (+140 more)

### Community 129 - "3. Data layer"
Cohesion: 0.29
Nodes (7): 3. Data layer, [DECIDED] Local-first. On-device SQLite. No cloud backend., [DECIDED] Migration path stays open, [DECIDED] Offline reads must always work, [DECIDED] Supabase is explicitly rejected for this app, On-device SQLite operating model — read this before touching schema, [OPEN] Backup and export

### Community 130 - "expo-task-manager.ts"
Cohesion: 0.29
Nodes (3): defineTask, isTaskDefined, TaskExecutor

### Community 131 - "PhotoFieldWidget.tsx"
Cohesion: 0.30
Nodes (11): customFieldValueForTarget(), isPhotoWidgetEnabled(), PhotoFieldWidget(), styles, customFieldPhotoRelPath(), consumeCropResult(), markPhotoStaged(), PhotoResultStore (+3 more)

### Community 132 - "ai-service-guards.test.ts"
Cohesion: 0.11
Nodes (18): Architecture, Capturing shared material, Changelog, Configuration, Conversational Fuel, Data Model, Decisions, Editing fuel on a profile (+10 more)

### Community 133 - "crop-geometry.ts"
Cohesion: 0.21
Nodes (10): FilterChip, FilterChipRowProps, styles, DashboardFilter, DashboardSort, DashboardEmptyInput, DashboardEmptyState, selectDashboardEmptyState() (+2 more)

### Community 135 - "7. Visual design"
Cohesion: 0.33
Nodes (6): 7. Visual design, [DECIDED] Space theme throughout, [DECIDED] Theme tokens, [DECIDED] Two distinct screens — do not merge them, Rendering, The orrery — settled mechanics

### Community 136 - "linking.ts"
Cohesion: 0.08
Nodes (50): acknowledgeProvider(), setInteractionAssistEnabled(), assertPositiveCadence(), bindContact(), unbindContact(), addLink(), addLinkCore(), applyLinkDiff() (+42 more)

### Community 137 - "File"
Cohesion: 0.15
Nodes (27): AcceptImportSessionWithRowsInput, assertOneChange(), completeSession(), completeSessionCore(), CreateImportSessionInput, deferNeedsReviewCore(), discardSession(), finalizeSessionIfTerminal() (+19 more)

### Community 138 - "System Docs"
Cohesion: 0.40
Nodes (4): Conventions, Generation, System Docs, Template

### Community 139 - "4. Port analysis — verified against the repo, not estimated"
Cohesion: 0.40
Nodes (5): 4. Port analysis — verified against the repo, not estimated, Delete — Obsidian-only, no mobile analogue, Ports nearly as-is (~900 lines), Rewritten against SQLite (logic shapes reusable, implementation not), Rewritten entirely — UI

### Community 140 - "package.json"
Cohesion: 0.40
Nodes (4): main, name, private, version

### Community 141 - "ResumeReconcilePrompt.tsx"
Cohesion: 0.22
Nodes (14): CadenceAggregate, IntensityAggregate, PromptContext, QualityAggregate, RankedFuelEntry, SharedFieldValue, ageDaysOf(), AggregateRow (+6 more)

### Community 142 - "sun-picker-read.test.ts"
Cohesion: 0.06
Nodes (66): Avatar(), AvatarProps, styles, EndpointSelector(), EndpointSelectorProps, styles, Counts, MergeImpactSummary() (+58 more)

### Community 143 - "field-type-change.test.ts"
Cohesion: 0.33
Nodes (6): addContact(), addDefinition(), addLegacyRow(), legacyMigrations, migrate(), uid()

### Community 144 - "Directory"
Cohesion: 0.29
Nodes (8): codePoints(), DEFAULT_STYLE_NOTE, intensityLine(), qualityLine(), resolvePrompt(), sanitizeValue(), STATIC_INSTRUCTION, trimToCodePoints()

### Community 145 - "5. Repo structure and access to the old code"
Cohesion: 0.50
Nodes (4): 5. Repo structure and access to the old code, [DECIDED] Do not clone the old repo into the new one and gitignore it, [DECIDED] Extract the portable source, and give agents full read access to the old repo in place, [DECIDED] New repo at `~/projects/orbit-app`, sibling to the existing `~/projects/Orbit`

### Community 146 - "6. Friction reduction — the features that decide whether this works"
Cohesion: 0.50
Nodes (4): 6. Friction reduction — the features that decide whether this works, [DECIDED] Actionable notifications, [DECIDED] Home screen widget, [DECIDED] Share-sheet target

### Community 147 - "8. Product positioning"
Cohesion: 0.50
Nodes (4): 8. Product positioning, Competitive landscape as assessed, [DECIDED] Differentiators, all three answering complaints users are already making about competitors, [OPEN] Monetisation

### Community 149 - "withBackupRestoreShareIntent.js"
Cohesion: 0.67
Nodes (3): { AndroidConfig, withAndroidManifest }, hasJsonShareFilter(), JSON_MIME_TYPES

### Community 150 - "withContactPickerPermission.js"
Cohesion: 0.50
Nodes (3): ADR-0002, ADR-0003, { withAndroidManifest }

### Community 151 - "defsForCreateForm"
Cohesion: 0.22
Nodes (11): applyBodyNav(), dataOf(), guardNotificationBodyIntent(), NotificationContactLookup, NotificationResponseGate(), runActionTap(), birthday, decay (+3 more)

### Community 152 - "13. Tooling"
Cohesion: 0.67
Nodes (3): 13. Tooling, [DECIDED] GSD and Graphify from the start, [DECIDED] The Roadmap Workshop is not used

### Community 189 - "ADR Index"
Cohesion: 0.40
Nodes (4): ADR Index, Do not machine-read this file, How to use this, Index

### Community 190 - "computeRingReorder"
Cohesion: 0.33
Nodes (7): localDateOffset(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid(), WOBBLE()

### Community 191 - "fuel-dao.test.ts"
Cohesion: 0.10
Nodes (20): LinkDraft, LinksEditor(), LinksEditorProps, normaliseLinkUrl(), openLinkUrl(), styles, confirmRemovePhoto(), PhotoSourcePicker() (+12 more)

### Community 192 - "File"
Cohesion: 0.24
Nodes (10): applyLifecycleTransitionEffects(), bindWithLifecycleEffects(), defaultDeps, EffectDeps, EffectDepsOverride, LifecycleDeps, LifecycleDirection, exec (+2 more)

### Community 193 - "export-manifest.ts"
Cohesion: 0.29
Nodes (10): assertNoLocalOnlyKeys(), buildExportManifest(), ExportManifestDeps, FORBIDDEN_KEYS, readManifest(), withPhoto(), BackupPhotoUnreadableError, getPortableSettingsSnapshot() (+2 more)

### Community 194 - "transaction.ts"
Cohesion: 0.39
Nodes (6): BackupEncryptionBenchmarkHarness(), styles, BACKUP_ENCRYPTION_BENCHMARK_CANDIDATES, BackupEncryptionBenchmarkResult, measureBackupEncryptionCandidates(), median()

### Community 195 - "recency-dao.test.ts"
Cohesion: 0.25
Nodes (5): DIRECT_CONTACT_CHILDREN, newUid(), seedV10Fixture(), TableInfo, V10

### Community 196 - "source-consolidation.ts"
Cohesion: 0.27
Nodes (9): normalizeContactMethod(), NormalizeContactMethodInput, NormalizedContactMethod, raw(), canonicalMethodKeys(), CombineClusterResult, detectSourceClusters(), mapRows() (+1 more)

### Community 197 - "timeline-read.ts"
Cohesion: 0.22
Nodes (9): EVENT_LABELS, styles, TimelineRow(), TimelineRowProps, listTimeline(), TimelineEvent, TimelineItem, TimelineRow (+1 more)

### Community 198 - "NativeGcmCipher"
Cohesion: 0.35
Nodes (8): getNewestPendingReconcileSessionId(), cleanupDiscardedReconcileStagedPhotos(), describeResumableReconcile(), nativeReconcileStagingFs, reconcileOrphanReconcileStagedPhotos(), ReconcileStagingFileSystem, registerReconcileResumeSweep(), RegisterReconcileResumeSweepOptions

### Community 199 - "survivor-recommendation.ts"
Cohesion: 0.39
Nodes (7): ContactOpts, InteractionOpts, localDateOffset(), localDateTimeOffset(), seedContact(), seedInteraction(), uid()

### Community 200 - "LinksEditor.tsx"
Cohesion: 0.11
Nodes (15): concatChunks(), CONTENT_TYPE_MAP, downloadCappedToFile(), downloadImageToCache(), extFromContentType(), isAcceptedRasterContentType(), isImageUrl(), normalizeContentType() (+7 more)

### Community 201 - "buildDecayRequest"
Cohesion: 0.12
Nodes (17): BenchmarkResult, nowMs(), runBenchmark(), seedBenchmarkData(), SeedOptions, recreateIndexes(), statusOrder, NewestRow (+9 more)

### Community 202 - "contact-read.test.ts"
Cohesion: 0.32
Nodes (4): editFull(), makeContact(), readInteraction(), uid()

### Community 203 - "011-contact-lifecycle-schema.test.ts"
Cohesion: 0.32
Nodes (6): BOUNDARY_TRIM, BOUNDARY_WS, CaptureInput, CapturePayload, nonBlank(), resolveCapturePayload()

### Community 204 - "field-sweep.test.ts"
Cohesion: 0.25
Nodes (5): defId(), newDef(), quarantineDaysAgo(), seedContact(), uid()

### Community 205 - "EditContactScreen.tsx"
Cohesion: 0.07
Nodes (53): RFC-4122, insertContact(), setContactPhotoCore(), createField(), deleteOrQuarantineField(), dropField(), dropFieldValues(), DropTarget (+45 more)

### Community 206 - "imported-contact-dao.ts"
Cohesion: 0.24
Nodes (7): ImportMatchOutcome, ImportSessionRowDbRow, ImportContactRecordInput, InvalidImportBirthdayError, LinkExistingContactToRowInput, NameRequiredError, ResolveImportRowInput

### Community 207 - "notification-read.test.ts"
Cohesion: 0.31
Nodes (8): localDateOffset(), OVERDUE(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid(), WOBBLE()

### Community 209 - "contact-read.test.ts"
Cohesion: 0.48
Nodes (5): addLinkRow(), makeContact(), makeContactRow(), makeDef(), uid()

### Community 210 - "purge-dao.ts"
Cohesion: 0.27
Nodes (9): computeImpact(), countRows(), impactSummaryLines(), plural(), PURGE_CHILDREN, PurgeChildSpec, purgeContact(), PurgeImpact (+1 more)

### Community 211 - "import-photo.ts"
Cohesion: 0.42
Nodes (6): retireRowStagedPhoto(), ImportedPhotoFs, persistImportedPhotoPostCommit(), PersistImportedPhotoResult, resizeToMaster(), resolveStagedPhotoPath()

### Community 212 - "field-sweep.test.ts"
Cohesion: 0.09
Nodes (22): __reset(), ScheduledRequestDouble, __setScheduled(), cancelMock, getAllMock, recorded(), RecordedRequest, scheduledDigest() (+14 more)

### Community 213 - "ReconcileDetailScreen"
Cohesion: 0.06
Nodes (62): setContactPhoto(), link(), assertOneChange(), createReconcileSession(), createReconcileSessionCore(), CreateReconcileSessionInput, discardSession(), discardSessionCore() (+54 more)

### Community 214 - "fail"
Cohesion: 0.46
Nodes (8): assertTextValue(), fail(), FIXED_LEGACY_COLUMNS, loadAndValidateDefs(), proveCopy(), quoteSafeColumn(), readLegacyRows(), snapshotOrphanColumn()

### Community 215 - "field-type-change.test.ts"
Cohesion: 0.38
Nodes (3): contact(), field(), uid()

### Community 216 - "assist-eligibility.ts"
Cohesion: 0.60
Nodes (4): isAssistEligible(), localDateTimeMs(), PendingAssistForBanner, selectBannerState()

### Community 219 - "RankedFuelLine.tsx"
Cohesion: 0.50
Nodes (3): RankedFuelLine(), RankedFuelLineProps, styles

## Knowledge Gaps
- **1286 isolated node(s):** `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance`, `AndroidNotificationVisibility`, `scheduled` (+1281 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlExecutor` connect `buildDecayRequest` to `database.ts`, `types.ts`, `001-initial.ts`, `linking.ts`, `getExecutor`, `File`, `HomeScreen.tsx`, `ResumeReconcilePrompt.tsx`, `index.ts`, `model-catalog-filter.ts`, `restore-apply.ts`, `field-type-change.test.ts`, `ReconcileGridScreen.tsx`, `backup-service.ts`, `MergeConflictsScreen.tsx`, `use-read-contacts-permission.ts`, `SettingsScreen.tsx`, `app-settings-dao.ts`, `PhotoSourcePicker.tsx`, `impact.ts`, `notification-schedule.test.ts`, `BackupScreen.tsx`, `reconciliation.ts`, `phase-17-runtime-integration.test.ts`, `create-contact-logic.ts`, `DigestScreen.tsx`, `ComposeScreen.tsx`, `RestorePreviewScreen.tsx`, `ContactProfileScreen.tsx`, `contact-import-resume-sweep.ts`, `Avatar.tsx`, `assist-store.ts`, `lifecycle-consumer-ledger.test.ts`, `computeRingReorder`, `File`, `export-manifest.ts`, `recency-dao.test.ts`, `ImportReviewScreen.tsx`, `CreateContactScreen.tsx`, `timeline-read.ts`, `survivor-recommendation.ts`, `NativeGcmCipher`, `queries.test.ts`, `contact-read.test.ts`, `source-consolidation.ts`, `BackupSettingsScreen.tsx`, `EditContactScreen.tsx`, `fuel-read.test.ts`, `imported-contact-dao.ts`, `notification-read.test.ts`, `contact-read.test.ts`, `purge-dao.ts`, `field-sweep.test.ts`, `import-acquire.ts`, `ReconcileDetailScreen`, `import-session-read.ts`, `field-type-change.test.ts`, `restore-photo-finalize-sweep.ts`, `import-photo.ts`, `saf-storage.ts`, `PhotoFieldWidget.tsx`, `field-sweep.test.ts`, `contacts-dao.test.ts`, `dashboard-read.test.ts`, `seedFullContact`, `File`, `006-normalize-custom-field-values.test.ts`, `011-contact-lifecycle-schema.test.ts`, `reconcile-session-read.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `useTheme()` connect `sun-picker-read.test.ts` to `field-types.ts`, `PhotoFieldWidget.tsx`, `crop-geometry.ts`, `import-session-read.ts`, `linking.ts`, `HomeScreen.tsx`, `App.tsx`, `backup-service.ts`, `index.ts`, `reconcile-apply.ts`, `ReconcileGridScreen.tsx`, `OrreryScreen.tsx`, `contacts-dao.ts`, `SettingsScreen.tsx`, `impact.ts`, `BackupScreen.tsx`, `create-contact-logic.ts`, `ComposeScreen.tsx`, `ContactProfileScreen.tsx`, `contact-import-resume-sweep.ts`, `CaptureScreen.tsx`, `fuel-dao.test.ts`, `transaction.ts`, `CreateContactScreen.tsx`, `timeline-read.ts`, `fuel-read.test.ts`, `ReconcileDetailScreen`, `saf-storage.ts`, `RankedFuelLine.tsx`, `reconcile-session-read.ts`, `notification-actions.test.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `BackupScreen()` connect `BackupScreen.tsx` to `audit-adr-key-files.ts`, `linking.ts`, `sun-picker-read.test.ts`, `reconcile-apply.ts`, `ComposeScreen.tsx`, `reconcile-resume-sweep.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance` to the rest of the system?**
  _1286 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06464646464646465 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05297334244702666 - nodes in this community are weakly interconnected._
- **Should `field-types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12307692307692308 - nodes in this community are weakly interconnected._