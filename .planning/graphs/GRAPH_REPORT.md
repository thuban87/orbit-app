# Graph Report - orbit-app  (2026-09-01)

## Corpus Check
- 581 files · ~463,669 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3959 nodes · 11502 edges · 202 communities (164 shown, 38 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `983513f8`
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
- SurvivorSelectScreen.tsx
- devDependencies
- AiCloudProviderId
- use-read-contacts-permission.ts
- OrbitSecureFetchModuleTest
- scripts
- TouchpointRefineForm.tsx
- notification-read.test.ts
- reconcile-photo.ts
- restore-photo-finalize-sweep.ts
- widget-linking.ts
- saf-storage.ts
- PhotoFieldWidget.tsx
- contact-lifecycle-effects.ts
- notification-schedule.ts
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
- ai-service-guards.test.ts
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
- Directory
- NativeGcmCipher
- buildDecayRequest
- 011-contact-lifecycle-schema.test.ts
- EditContactScreen.tsx
- prompt-template.ts
- field-sweep.test.ts
- ReconcileDetailScreen
- encryption-benchmark.ts

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

## Communities (202 total, 38 thin omitted)

### Community 0 - "database.ts"
Cohesion: 0.06
Nodes (54): db(), migrations, newUid(), photoMocks, AI_DEFAULTS, BACKUP_DEFAULTS, IsNever, KeysOverlap (+46 more)

### Community 1 - "types.ts"
Cohesion: 0.07
Nodes (41): migrated(), PHOTO, uidFactory(), seedContact(), seedFuel(), uid(), readDataRevision(), MIGRATIONS (+33 more)

### Community 2 - "field-types.ts"
Cohesion: 0.21
Nodes (11): CustomIntervalResult, IntervalUnit, parseCustomInterval(), UNIT_FACTORS, FrequencyPicker(), FrequencyPickerProps, PRESET_VALUES, PRESETS (+3 more)

### Community 3 - "001-initial.ts"
Cohesion: 0.14
Nodes (17): DateFieldWidget(), styles, DropdownFieldWidget(), styles, NumberFieldWidget(), styles, styles, TextAreaFieldWidget() (+9 more)

### Community 4 - "import-session-dao.ts"
Cohesion: 0.14
Nodes (23): ArchivedContactRow, listArchived(), restoreContact(), computeImpact(), countRows(), impactSummaryLines(), plural(), PURGE_CHILDREN (+15 more)

### Community 5 - "inWriteTransaction"
Cohesion: 0.11
Nodes (17): Architecture, Changelog, Configuration, Dashboard, Data Model, Decisions, Gotchas, How It Works (+9 more)

### Community 6 - "import-session-read.ts"
Cohesion: 0.23
Nodes (14): ThemeStore, useThemeStore, resolveMode(), resolvePalette(), THEME_PRESETS, ThemeContext, ThemeProvider(), ThemeProviderProps (+6 more)

### Community 7 - "AiService.ts"
Cohesion: 0.16
Nodes (14): AiErrorCode, AiProvider, AnthropicProvider, classifyHttpStatus(), extractGeminiModels(), extractIdList(), GoogleProvider, mapSecureFetchError() (+6 more)

### Community 8 - "getExecutor"
Cohesion: 0.22
Nodes (17): addMethodDraft(), canonicalDuplicateCopy(), choosePrimary(), collapseCanonicalDuplicate(), discardBlankMethodDrafts(), EMPTY_METHOD_GROUPS, emptyMethodDraft(), MethodLabel (+9 more)

### Community 9 - "HomeScreen.tsx"
Cohesion: 0.08
Nodes (39): BirthdayBanner(), BirthdayBannerProps, birthdayCopy(), BirthdayEntry, styles, FilterChip, FilterChipRow(), FilterChipRowProps (+31 more)

### Community 10 - "OrbitContactPickerModule"
Cohesion: 0.09
Nodes (29): Any, InputStream, Intent, Boolean, CodedException, Context, Module, Promise (+21 more)

### Community 11 - "encryption.ts"
Cohesion: 0.06
Nodes (23): BackupEncryptionProfile, EncryptedBackupEnvelope, APPROVED_BACKUP_ENCRYPTION_PROFILE, BackupEncryptionBackend, BackupEnvelopeCrypto, BackupEnvelopeCryptoOptions, BackupEnvelopeError, BackupEnvelopeErrorCode (+15 more)

### Community 12 - "App.tsx"
Cohesion: 0.12
Nodes (13): BenchmarkResult, nowMs(), runBenchmark(), SeedOptions, HeadlessResponsePayload, ensureNotificationCategories(), handledSet, isUniqueViolation() (+5 more)

### Community 13 - "backup-service.ts"
Cohesion: 0.08
Nodes (34): AppShell(), styles, hasSharedBackup(), expireFieldIfStale(), isMigration006IntegrityError(), BACKUP_SHARE_MIME_TYPES, isBackupShareIntent(), navigationRef (+26 more)

### Community 14 - "index.ts"
Cohesion: 0.06
Nodes (42): listContactsSummary(), PickContactsOptions, PickedContact, PickedMethod, readAllContacts(), readContactsByLookupKeys(), SelectedReadResult, OrbitContactPickerModule (+34 more)

### Community 15 - "model-catalog-filter.ts"
Cohesion: 0.09
Nodes (23): ContactEditRow, Assert, CADENCE_OWNERS, _CadenceCreate, _CadenceDashProgress, _CadenceDashStatus, _CadenceEditRow, _CadenceImpactInputs (+15 more)

### Community 16 - "restore-apply.ts"
Cohesion: 0.10
Nodes (36): applyRestore(), assertCompleteIncomingPairs(), deleteActions(), DeleteCandidate, entities, FinalizeCandidate, idMap(), importTombstones() (+28 more)

### Community 17 - "reconcile-apply.ts"
Cohesion: 0.19
Nodes (19): RestoreApplyResult, RestoreMode, confirmReplaceAllRestore(), createRestoreApplySingleFlight(), createRestorePreviewCache(), initialRestoreApplyState(), replaceAllConfirmation(), ReplaceAllConfirmationResult (+11 more)

### Community 18 - "ReconcileGridScreen.tsx"
Cohesion: 0.08
Nodes (38): CustomFieldValue(), CustomFieldValueProps, FieldSpec, presentValue(), styles, draftToFieldFields(), FieldDefDraft, FieldDraftFields (+30 more)

### Community 19 - "AiSuggestionLifecycle"
Cohesion: 0.18
Nodes (13): ResolvedPrompt, CONFIG, CONTEXT, Seam, AiSuggestionState, RequestConfig, sameConfig(), CONFIG (+5 more)

### Community 20 - "Logger"
Cohesion: 0.19
Nodes (13): setContactPhoto(), CropGeom, CropPhotoScreen(), styles, clamp(), CropRect, cropRectFromTransform(), CropTransform (+5 more)

### Community 21 - "EditContactScreen.tsx"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Composing and handing off a message, Configuration, Contact Methods, Data Model, Decisions, Entering Compose from a reminder (+7 more)

### Community 22 - "reconcile-session-dao.ts"
Cohesion: 0.11
Nodes (33): assertOneChange(), createReconcileSession(), createReconcileSessionCore(), CreateReconcileSessionInput, discardSession(), discardSessionCore(), finalizeSessionIfTerminal(), finalizeSessionIfTerminalCore() (+25 more)

### Community 23 - "Phase Details"
Cohesion: 0.06
Nodes (34): Canonical refs, Canonical refs, Canonical refs, Canonical refs, Canonical refs, Cross-phase constraints (from INDEX.md's constraint log — these cross phase boundaries), Overview, Phase 10: Share-Sheet Capture (+26 more)

### Community 24 - "MergeConflictsScreen.tsx"
Cohesion: 0.14
Nodes (7): AiSettings, AiService, CustomProvider, inputFor(), makePrompt(), secureCustomFetchMock, SecureFetchError

### Community 25 - "settings-ai-logic.ts"
Cohesion: 0.17
Nodes (17): IPV4_MAPPED_PREFIX, ipv4InCidr(), ipv4IsNonPublic(), ipv6InCidr(), ipv6IsNonPublic(), isNonPublicIpLiteral(), NAT64_PREFIX, NON_PUBLIC_IPV4_CIDRS (+9 more)

### Community 26 - "contact-status-read.ts"
Cohesion: 0.09
Nodes (22): App Shell, Applying destructive emphasis, Applying relationship-state emphasis, Architecture, Changelog, Composing from a contact, Configuration, Configuring AI settings (+14 more)

### Community 27 - "OrreryScreen.tsx"
Cohesion: 0.18
Nodes (12): isBulkActionAvailable(), actionLabels, BulkAction, CandidateCardGrid(), CandidateCardGridProps, CandidateChoice, CandidateItem, styles (+4 more)

### Community 28 - "field-ddl.ts"
Cohesion: 0.09
Nodes (35): newUid(), seedContact(), seedFlag(), newUid(), seedContact(), seedImportRow(), createContactFullCore(), acceptImportSessionWithRows() (+27 more)

### Community 29 - "contacts-dao.ts"
Cohesion: 0.10
Nodes (25): groups(), FieldChoiceGroup(), FieldChoiceGroupProps, FieldChoiceMode, FieldChoiceOption, initialSelection(), styles, KEEP_ORBIT_PHOTO (+17 more)

### Community 30 - "SettingsScreen.tsx"
Cohesion: 0.11
Nodes (31): SegmentedControl(), SegmentedControlOption, SegmentedControlProps, styles, getContactStatus(), listOrbitingContacts(), OrbitingContact, getProfile() (+23 more)

### Community 31 - "localDateTime"
Cohesion: 0.11
Nodes (16): assertNoLocalOnlyKeys(), buildExportManifest(), ExportManifestDeps, FORBIDDEN_KEYS, readManifest(), withPhoto(), db(), Directory (+8 more)

### Community 32 - "app-settings-dao.ts"
Cohesion: 0.11
Nodes (24): AppSettingsRow, assertAiProvider(), assertHour(), assertPhoneRegionOverride(), assertSelfSunColour(), assertSunContactId(), assertToggle(), BACKUP_BOOKKEEPING_COLUMN_OF (+16 more)

### Community 33 - "backup-schema.ts"
Cohesion: 0.21
Nodes (18): array(), assertPortableSettings(), fail(), FORWARD_MIGRATIONS, Migration, parseBackupManifest(), PORTABLE_SETTINGS_KEYS, RawManifest (+10 more)

### Community 34 - "PhotoSourcePicker.tsx"
Cohesion: 0.13
Nodes (19): confirmRemovePhoto(), PhotoSourcePicker(), PhotoSourcePickerProps, styles, PhotoTargetDescriptor, concatChunks(), CONTENT_TYPE_MAP, downloadCappedToFile() (+11 more)

### Community 35 - "impact.ts"
Cohesion: 0.05
Nodes (47): main(), renderSeedModule(), SEED_PATH, CatalogFetch, CatalogFetchResponse, CatalogStorage, isEmptyCatalog(), isModelCatalog() (+39 more)

### Community 36 - "photo-storage.ts"
Cohesion: 0.12
Nodes (25): BulkReviewDbRow, BulkReviewFlag, listBulkReviewFlags(), sourceBirthday(), daysInMonth(), daysUntilBirthday(), isLeapYear(), isValidStoredBirthday() (+17 more)

### Community 37 - "notification-schedule.test.ts"
Cohesion: 0.06
Nodes (28): __reset(), ScheduledRequestDouble, __setScheduled(), defId(), newDef(), quarantineDaysAgo(), seedContact(), uid() (+20 more)

### Community 38 - "BackupScreen.tsx"
Cohesion: 0.12
Nodes (21): consumeSharedBackup(), pickBackupDocument(), BackupHealth, BackupHealthInput, BackupNudgeInput, BackupNudgeState, resolveBackupHealth(), resolveBackupNudge() (+13 more)

### Community 39 - "NonPublicAddresses"
Cohesion: 0.14
Nodes (18): Boolean, ByteArray, InetAddress, Int, List, Map, Module, Promise (+10 more)

### Community 40 - "reconciliation.ts"
Cohesion: 0.09
Nodes (33): assertUniqueRows(), assertUniqueTombstones(), compareRowAndTombstone(), ENTITY_POLICIES, EntityPolicy, incompatibleRows(), MergeableEntityType, newestRow() (+25 more)

### Community 41 - "index.ts"
Cohesion: 0.21
Nodes (8): styles, TriStateLastSpoke(), DraftLink, isDuplicateName(), SOCIAL_BATTERY_OPTIONS, styles, toLinkDrafts(), parseDate()

### Community 42 - "newUid"
Cohesion: 0.12
Nodes (24): AcceptImportSessionWithRowsInput, assertOneChange(), completeSession(), completeSessionCore(), createImportSession(), CreateImportSessionInput, deferNeedsReviewCore(), insertImportSessionCore() (+16 more)

### Community 43 - "secure-fetch.ts"
Cohesion: 0.14
Nodes (13): cancel(), request(), generateRequestId(), mapNativeError(), NOTE: the transport-level guarantees (HTTPS→private rejection, redirect, secureCustomFetch(), SecureFetchError, SecureFetchErrorCode (+5 more)

### Community 44 - "phase-17-runtime-integration.test.ts"
Cohesion: 0.16
Nodes (6): BackupPassphraseBackend, BackupPassphraseChangeStore, createBackupPassphraseStore(), nativeBackend, PendingBackupPassphraseChange, PendingPassphraseChangeReadResult

### Community 45 - "v1 Requirements"
Cohesion: 0.07
Nodes (27): Actionable Notifications (NOTIF), AI Message Suggestions (AI), Backup, Export & Restore (BKP), Compose consumers' shared surface — see CMP; and the Orrery (ORR), Compose Screen & SMS Handoff (CMP), Contact CRUD & Lifecycle (CRUD), Contact Data Normalization (CDN), Contact Reconciliation & Merge (RCN) (+19 more)

### Community 46 - "useTheme"
Cohesion: 0.12
Nodes (16): Architecture, Capturing and cropping a photo, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works (+8 more)

### Community 47 - "FuelEditor.tsx"
Cohesion: 0.18
Nodes (22): GentleLine, OverlookedRow, QualityMarkRow, readGentleLine(), readOverlooked(), readRetrospective(), RetrospectiveRow, AllQuietInputs (+14 more)

### Community 48 - "biome.json"
Cohesion: 0.08
Nodes (25): source, assist, actions, files, includes, formatter, enabled, indentStyle (+17 more)

### Community 50 - "create-contact-logic.ts"
Cohesion: 0.17
Nodes (17): toMethodDrafts(), LastSpokeValue, TriStateLastSpokeProps, buildCreateInput(), BuildCreateInputDeps, CreateFormState, firstInteractionOccurredAt(), buildBirthdayForStorage() (+9 more)

### Community 51 - "DigestScreen.tsx"
Cohesion: 0.18
Nodes (14): DAYS_TO_FREQUENCY, intendedLabel(), IntensityLine(), styles, calculateDaysSince(), calculateDaysUntilDue(), calculateStatus(), Frequency (+6 more)

### Community 52 - "dependencies"
Cohesion: 0.08
Nodes (25): expo, expo-file-system, expo-notifications, expo-sms, expo-status-bar, dependencies, expo, expo-file-system (+17 more)

### Community 53 - "ComposeScreen.tsx"
Cohesion: 0.19
Nodes (12): NeverContactedSort, countUnbound(), listUnbound(), UnboundRow, NeverContactedScreen(), SORT_OPTIONS, styles, unboundCountLabel() (+4 more)

### Community 54 - "RestorePreviewScreen.tsx"
Cohesion: 0.08
Nodes (32): automaticBackupFilename(), AutomaticBackupMetadata, filesToPrune(), isExpiredAutomaticBackup(), isOwnedAutomaticBackup(), shouldRunAutomaticBackup(), now, AutomaticBackupDependencies (+24 more)

### Community 55 - "ContactProfileScreen.tsx"
Cohesion: 0.07
Nodes (42): EVENT_LABELS, styles, TimelineRow(), TimelineRowProps, ContactMethodGroups, listActionablePrimaryMethods(), listContactMethodGroups(), selectActionablePrimaryMethods() (+34 more)

### Community 56 - "contact-import-resume-sweep.ts"
Cohesion: 0.22
Nodes (17): deferNeedsReview(), finalizeSessionIfTerminal(), ImportSessionRowStatus, markRowPhotoFailed(), markRowStatus(), resolveAlreadyLinked(), sessionSummaryCounts, sourceBirthday() (+9 more)

### Community 57 - "Avatar.tsx"
Cohesion: 0.19
Nodes (14): Avatar(), AvatarProps, getInitials(), hashName(), swatchIndex(), styles, DashboardRow, listDashboard() (+6 more)

### Community 58 - "assist-store.ts"
Cohesion: 0.15
Nodes (13): EndpointSelector(), EndpointSelectorProps, styles, ReachOutRouterProps, styles, EligiblePendingAssist, listEligiblePendingAssists(), ReachRoutes (+5 more)

### Community 59 - "lifecycle-consumer-ledger.test.ts"
Cohesion: 0.11
Nodes (24): IntensityLineProps, getImpactInputs(), ImpactInputs, computeGravity(), GravityInteraction, GravityResult, GravityTier, GravityTunables (+16 more)

### Community 60 - "CaptureScreen.tsx"
Cohesion: 0.07
Nodes (38): finishActivity(), OrbitShareFinishModule, captureMultiAttach(), captureMultiNote(), FuelRow, seedContact(), shareRow(), uid() (+30 more)

### Community 61 - "reconcile-resume-sweep.ts"
Cohesion: 0.32
Nodes (9): getNewestPendingReconcileSessionId(), getResumableReconcileSession(), cleanupDiscardedReconcileStagedPhotos(), describeResumableReconcile(), nativeReconcileStagingFs, reconcileOrphanReconcileStagedPhotos(), ReconcileStagingFileSystem, registerReconcileResumeSweep() (+1 more)

### Community 62 - "expo"
Cohesion: 0.09
Nodes (21): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+13 more)

### Community 63 - "model-registry.ts"
Cohesion: 0.06
Nodes (55): CatalogProvider, asCatalogProvider(), better(), EMPTY, filterToFrontier(), FRONTIER_TIERS, FrontierTier, frontierWinners() (+47 more)

### Community 64 - "transaction.ts"
Cohesion: 0.08
Nodes (54): acknowledgeProvider(), setInteractionAssistEnabled(), assertPositiveCadence(), bindContact(), unbindContact(), archiveContact(), clearContactPhoto(), bumpDataRevisionCore() (+46 more)

### Community 65 - "006-normalize-custom-field-values.ts"
Cohesion: 0.11
Nodes (17): Architecture, Changelog, Choosing the sun, Configuration, Data Model, Decisions, Gotchas, How It Works (+9 more)

### Community 66 - "SqlExecutor"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works, Key Files (+7 more)

### Community 67 - "ImportReviewScreen.tsx"
Cohesion: 0.14
Nodes (19): normalizeContactMethod(), NormalizeContactMethodInput, NormalizedContactMethod, raw(), addSignal(), candidateFor(), candidateScore(), classifyCandidate() (+11 more)

### Community 68 - "recency-dao.ts"
Cohesion: 0.12
Nodes (15): Architecture, Capture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works (+7 more)

### Community 70 - "LegacyContactPickerScreen.tsx"
Cohesion: 0.11
Nodes (17): Architecture, Changelog, Configuration, Data Model, Decisions, Deriving gravity and intensity, Gotchas, How It Works (+9 more)

### Community 71 - "audit-adr-key-files.ts"
Cohesion: 0.15
Nodes (18): adrDir, auditAdrKeyFiles(), AuditResult, byBasename, Category, CATEGORY_ORDER, classify(), everExisted() (+10 more)

### Community 72 - "types.ts"
Cohesion: 0.10
Nodes (30): RFC-4122, insertContact(), assertOneChange(), ContactMetadataRow, ignoreBulkReviewFlag(), ignoreBulkReviewFlagCore(), IgnoreBulkReviewFlagInput, insertResolutionCore() (+22 more)

### Community 73 - "queries.test.ts"
Cohesion: 0.13
Nodes (16): CREATE_STATEMENTS, migration001, SEED_CATEGORIES, NewestRow, ScanRow, seedContact(), seedInteraction(), uid() (+8 more)

### Community 74 - "expo-notifications.ts"
Cohesion: 0.11
Nodes (16): addNotificationResponseReceivedListener, AndroidImportance, AndroidNotificationVisibility, cancelScheduledNotificationAsync, clearLastNotificationResponseAsync, getAllScheduledNotificationsAsync, getLastNotificationResponseAsync, getPermissionsAsync (+8 more)

### Community 75 - "notification-gate.tsx"
Cohesion: 0.15
Nodes (22): expoExecutor(), openAndMigrate(), getDeviceRegion(), ringColor(), ringWeight(), fixture, widgetPalette, WidgetTile (+14 more)

### Community 76 - "BackupSettingsScreen.tsx"
Cohesion: 0.21
Nodes (12): applyBodyNav(), dataOf(), guardNotificationBodyIntent(), NotificationContactLookup, NotificationResponseGate(), runActionTap(), birthday, decay (+4 more)

### Community 77 - "bulk-review-dao.test.ts"
Cohesion: 0.12
Nodes (15): AI Suggestions, Architecture, Changelog, Configuration, Configuring a provider, Custom egress and model catalog, Data Model, Decisions (+7 more)

### Community 78 - "fuel-read.test.ts"
Cohesion: 0.06
Nodes (59): AssistBanner(), questionFor(), styles, AssistConfirmation(), AssistConfirmationProps, styles, GravityBar(), GravityBarProps (+51 more)

### Community 79 - "SurvivorSelectScreen.tsx"
Cohesion: 0.11
Nodes (32): ConsolidationPrompt(), sourceName(), SourcePreview(), SourceSnapshot, styles, listCategories(), discardSession(), ImportSessionMode (+24 more)

### Community 80 - "devDependencies"
Cohesion: 0.12
Nodes (17): babel-preset-expo, @biomejs/biome, devDependencies, babel-preset-expo, @biomejs/biome, patch-package, tsx, @types/node (+9 more)

### Community 81 - "AiCloudProviderId"
Cohesion: 0.16
Nodes (7): AiKeyStore, createAiKeyStore(), keyItemName(), nativeSecureStoreBackend, SecureKeyBackend, AiCloudProviderId, AiKeyStoreLike

### Community 82 - "use-read-contacts-permission.ts"
Cohesion: 0.13
Nodes (29): canonicalFor(), ExternalContactLinkInput, assertSafeImportStagingRelative(), assertSafeReconcileStagingRelative(), assertSafeRestorePendingRelative(), acceptPickedContacts(), CommitSingleImportInput, PickedImportNavigator (+21 more)

### Community 83 - "OrbitSecureFetchModuleTest"
Cohesion: 0.19
Nodes (7): File, ByteArray, InetAddress, List, String, OrbitSecureFetchModuleTest, Vector

### Community 84 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, android, audit:adr-key-files, check:adr-key-files, check:colors, fix:adr-key-files, gen:adr-index, gen:adr-registry (+8 more)

### Community 85 - "TouchpointRefineForm.tsx"
Cohesion: 0.21
Nodes (13): combineDateAndTime(), DateOrStored, isCombinedInFuture(), localTimePart(), parseLocalDateTime(), toDate(), CHANNEL_OPTIONS, DIRECTION_OPTIONS (+5 more)

### Community 86 - "notification-read.test.ts"
Cohesion: 0.09
Nodes (30): blankToNull(), DraftRow(), FuelDraft, FuelEditor(), FuelEditorProps, FuelEditPatch, FuelRow(), KIND_OPTIONS (+22 more)

### Community 87 - "reconcile-photo.ts"
Cohesion: 0.17
Nodes (12): OrbitBody(), OrbitBodyProps, OrreryClockContext, useOrreryClock(), OrreryCanvas(), OrreryCanvasProps, seeded(), Star (+4 more)

### Community 88 - "restore-photo-finalize-sweep.ts"
Cohesion: 0.14
Nodes (13): Animation and pause boundary, Architecture (Phase 13), Assets, Code, Fallback Chain / Resolution Order, File Locations, Geometry and rendered state, How to Add or Change an Orrery Layer (+5 more)

### Community 89 - "widget-linking.ts"
Cohesion: 0.20
Nodes (11): parseWidgetId(), resolveWidgetUri(), WidgetLinkingGate(), WidgetNavIntent, guardWidgetIntent(), archived, bound, Contact (+3 more)

### Community 90 - "saf-storage.ts"
Cohesion: 0.12
Nodes (24): ringVisual, ContactCard(), ContactCardProps, statusLabel(), styles, colors, RankedFuelLine(), RankedFuelLineProps (+16 more)

### Community 91 - "PhotoFieldWidget.tsx"
Cohesion: 0.33
Nodes (10): customFieldValueForTarget(), isPhotoWidgetEnabled(), PhotoFieldWidget(), styles, customFieldPhotoRelPath(), consumeCropResult(), markPhotoStaged(), PhotoResultStore (+2 more)

### Community 92 - "contact-lifecycle-effects.ts"
Cohesion: 0.12
Nodes (16): Acting from the shade, Architecture, Changelog, Cleaning up a purge, Configuration, Data Model, Decisions, Gotchas (+8 more)

### Community 93 - "notification-schedule.ts"
Cohesion: 0.20
Nodes (12): BirthdayNotificationCandidate, DecayEligibleCandidate, listBirthdayNotificationCandidates(), listDecayEligibleCandidates(), localDateOffset(), OVERDUE(), ROGUE(), seedContact() (+4 more)

### Community 94 - "include"
Cohesion: 0.14
Nodes (13): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, ./src/*, **/*.ts, **/*.tsx, compilerOptions, forceConsistentCasingInFileNames (+5 more)

### Community 95 - "FrequencyPicker.tsx"
Cohesion: 0.12
Nodes (24): assertBackupDays(), recordAutomaticBackupHealthCore(), BackupSettingsFormInput, BackupSettingsPatchResult, buildBackupSettingsPatch(), EncryptionSetupResult, validateEncryptionSetup(), validateWholeBackupDays() (+16 more)

### Community 96 - "contact-profile-logic.ts"
Cohesion: 0.09
Nodes (21): Architecture, Changelog, Configuration, Contacts, Creating a contact during capture, Creating and editing a contact, Data Model, Decisions (+13 more)

### Community 97 - "14. Custom fields — [DECIDED] in v1, as its own phase"
Cohesion: 0.15
Nodes (13): 14.10 What must be built new, 14.11 Two SQLite constraints — both non-issues, recorded so they are not re-derived, 14.1 Storage model — [DECIDED] two tables, 14.2 [DECIDED] Every value column is declared TEXT, permanently, 14.3 [DECIDED] Type enforcement is the UI's job, not the database's, 14.4 [DECIDED] Type changes — automatic conversion with flagged exceptions, 14.5 [DECIDED] Deletion — dynamic action, quarantine, undo, 14.6 [DECIDED] Snapshot table for undo (+5 more)

### Community 98 - "Orbit"
Cohesion: 0.15
Nodes (12): Active, Business Context, Constraints, Context, Core Value, Evolution, Key Decisions, Orbit (+4 more)

### Community 99 - "graph-ask.ts"
Cohesion: 0.15
Nodes (11): adrDir, adrStatus, byId, graph, graphPath, Link, [mode, arg], Node (+3 more)

### Community 101 - "notification-ids.ts"
Cohesion: 0.23
Nodes (13): CadenceAggregate, IntensityAggregate, PromptContext, QualityAggregate, RankedFuelEntry, SharedFieldValue, ageDaysOf(), AggregateRow (+5 more)

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
Cohesion: 0.22
Nodes (10): isFutureLocalDate(), PickDateResult, resolvePickedDate(), NOW, localNow(), daysAgo(), daysAgo(), daysAgo() (+2 more)

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
Nodes (11): Architecture (Phases 02, 11), Code, File Locations, How to Add a SQLite Migration, Migration runner, Overview, Pitfalls, Resolution order (+3 more)

### Community 117 - "seedFullContact"
Cohesion: 0.39
Nodes (10): seedContact(), seedCustomValues(), seedDef(), seedEvent(), seedFuel(), seedFullContact(), seedHistory(), seedInteraction() (+2 more)

### Community 118 - "birthday-logic.ts"
Cohesion: 0.17
Nodes (11): Architecture (Phase 11), Code, File Locations, How to Add a Local Notification Kind, Local Notification Integration Pipeline, Notification identifiers, Overview, Pitfalls (+3 more)

### Community 119 - "buildDecayRequest"
Cohesion: 0.11
Nodes (18): Architecture, Capturing a custom photo value, Changelog, Choosing AI-sharing consent, Configuration, Creating and editing a definition, Custom Fields, Data Model (+10 more)

### Community 120 - "audit-scalar-method-refs.mjs"
Cohesion: 0.25
Nodes (7): findings, OWNERS, ROOT, scalarReferences(), SOURCE_ROOT, stripComments(), unowned

### Community 121 - "normalize-graph-docrefs.ts"
Cohesion: 0.22
Nodes (8): abs, canonical, Graph, GraphLink, GraphNode, links, remap, seen

### Community 123 - "006-normalize-custom-field-values.test.ts"
Cohesion: 0.14
Nodes (14): addMethodPiiFixture(), makeContact(), makeDef(), makeNeverAssignedUnboundContact(), uid(), addLinkRow(), makeContact(), makeContactRow() (+6 more)

### Community 124 - "011-contact-lifecycle-schema.test.ts"
Cohesion: 0.09
Nodes (44): applyContactMethodDiff(), applyContactMethodDiffCore(), assertOneChange(), ContactMethodDraft, ContactMethodNormalizationContext, ContactMethodRow, ContactMethodSaveResult, listContactMethods() (+36 more)

### Community 125 - "reconcile-session-read.ts"
Cohesion: 0.13
Nodes (16): isContactPickerAvailable(), pickContacts(), ScrimPointerEvents, speedDialScrimPointerEvents(), AddSpeedDialFab(), AnimatedPressable, styles, contactImportMode (+8 more)

### Community 126 - "index.ts"
Cohesion: 0.26
Nodes (3): ConsumedBackupShare, OrbitBackupDocumentPickerModule, OrbitBackupDocumentPickerModule

### Community 127 - "notification-actions.test.ts"
Cohesion: 0.29
Nodes (4): NativeSecureFetchInput, NativeSecureFetchResult, OrbitSecureFetchModule, OrbitSecureFetchModule

### Community 128 - "adr-registry.ts"
Cohesion: 0.02
Nodes (106): ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011 (+98 more)

### Community 129 - "3. Data layer"
Cohesion: 0.29
Nodes (7): 3. Data layer, [DECIDED] Local-first. On-device SQLite. No cloud backend., [DECIDED] Migration path stays open, [DECIDED] Offline reads must always work, [DECIDED] Supabase is explicitly rejected for this app, On-device SQLite operating model — read this before touching schema, [OPEN] Backup and export

### Community 130 - "expo-task-manager.ts"
Cohesion: 0.29
Nodes (3): defineTask, isTaskDefined, TaskExecutor

### Community 131 - "ai-service-guards.test.ts"
Cohesion: 0.20
Nodes (6): inputFor(), makePrompt(), secureCustomFetchMock, SecureFetchError, AiError, KeyAccessor

### Community 132 - "ai-service-guards.test.ts"
Cohesion: 0.11
Nodes (17): Architecture, Capturing shared material, Changelog, Configuration, Conversational Fuel, Data Model, Decisions, Editing fuel on a profile (+9 more)

### Community 133 - "crop-geometry.ts"
Cohesion: 0.33
Nodes (6): createPendingAssist(), markAssistFailed(), markAssistLogged(), PendingAssistRow, isValidLocalDateTime(), rejectFutureOccurredAt()

### Community 135 - "7. Visual design"
Cohesion: 0.33
Nodes (6): 7. Visual design, [DECIDED] Space theme throughout, [DECIDED] Theme tokens, [DECIDED] Two distinct screens — do not merge them, Rendering, The orrery — settled mechanics

### Community 136 - "linking.ts"
Cohesion: 0.33
Nodes (8): ContactMethodEditorDraft, MethodGroups, ContactMethodsEditor(), ContactMethodsEditorProps, LABELS, STANDARD_LABELS, styles, typeCopy()

### Community 137 - "File"
Cohesion: 0.33
Nodes (7): isSafeColName(), makeColName(), slugify(), CONTACTS_COLUMNS, CUSTOM_FIELD_VALUES_COLUMNS, RESERVED_COLUMN_NAMES, ROWID_ALIASES

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
Cohesion: 0.33
Nodes (6): ResumeReconcilePrompt(), ResumeReconcilePromptProps, RootNavigation, styles, ResumableReconcile, deleteReconcileStaging()

### Community 142 - "sun-picker-read.test.ts"
Cohesion: 0.15
Nodes (16): ResumeImportPromptProps, setRowContact(), getResumableSession(), mapSession(), cleanupDiscardedStagedPhotos(), describeResumable(), ImportStagingFileSystem, nativeImportStagingFs (+8 more)

### Community 143 - "field-type-change.test.ts"
Cohesion: 0.33
Nodes (6): addContact(), addDefinition(), addLegacyRow(), legacyMigrations, migrate(), uid()

### Community 144 - "Directory"
Cohesion: 0.32
Nodes (7): assertSafeRelative(), reconcileStagingRelPath(), digest(), promoteReconcilePhoto(), ReconcilePhotoFs, resizeToMaster(), stageReconcileSourcePhoto()

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
Cohesion: 0.15
Nodes (17): assertTextValue(), fail(), FIXED_LEGACY_COLUMNS, LegacyColumn, LegacyDef, LegacyRow, loadAndValidateDefs(), Migration006IntegrityError (+9 more)

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
Nodes (33): allowedSlotForDay(), clampHour(), clampStagger(), inQuietWindow(), nextAllowedFireInstant(), nextNudgeDate(), DATA, freshHandler() (+25 more)

### Community 198 - "NativeGcmCipher"
Cohesion: 0.16
Nodes (16): entry(), deleteJournalEntryCore(), insertJournalEntryCore(), listJournalEntriesCore(), RestorePhotoJournalAction, RestorePhotoJournalEntry, RestorePhotoJournalTargetKind, deleteRestorePending() (+8 more)

### Community 201 - "buildDecayRequest"
Cohesion: 0.39
Nodes (7): ContactOpts, InteractionOpts, localDateOffset(), localDateTimeOffset(), seedContact(), seedInteraction(), uid()

### Community 203 - "011-contact-lifecycle-schema.test.ts"
Cohesion: 0.25
Nodes (5): DIRECT_CONTACT_CHILDREN, newUid(), seedV10Fixture(), TableInfo, V10

### Community 205 - "EditContactScreen.tsx"
Cohesion: 0.19
Nodes (19): addLink(), addLinkCore(), applyLinkDiff(), assertOneChange(), ContactLinkRow, listLinks(), removeLink(), removeLinkCore() (+11 more)

### Community 206 - "prompt-template.ts"
Cohesion: 0.26
Nodes (9): codePoints(), DEFAULT_STYLE_NOTE, intensityLine(), qualityLine(), resolvePrompt(), sanitizeValue(), STATIC_INSTRUCTION, trimToCodePoints() (+1 more)

### Community 212 - "field-sweep.test.ts"
Cohesion: 0.06
Nodes (60): seedBenchmarkData(), newUid(), seedContact(), makeContact(), uid(), contact(), email(), phone() (+52 more)

### Community 213 - "ReconcileDetailScreen"
Cohesion: 0.08
Nodes (40): link(), getReviewedSnapshots(), isAdditiveOnlySelection(), card(), canonicalMethod(), classifyMethodFamily(), classifyReconciliation(), ClassifyReconciliationInput (+32 more)

### Community 217 - "encryption-benchmark.ts"
Cohesion: 0.39
Nodes (6): BackupEncryptionBenchmarkHarness(), styles, BACKUP_ENCRYPTION_BENCHMARK_CANDIDATES, BackupEncryptionBenchmarkResult, measureBackupEncryptionCandidates(), median()

## Knowledge Gaps
- **1170 isolated node(s):** `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance`, `AndroidNotificationVisibility`, `scheduled` (+1165 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlExecutor` connect `types.ts` to `database.ts`, `import-session-dao.ts`, `crop-geometry.ts`, `HomeScreen.tsx`, `App.tsx`, `backup-service.ts`, `sun-picker-read.test.ts`, `field-type-change.test.ts`, `restore-apply.ts`, `ReconcileGridScreen.tsx`, `reconcile-session-dao.ts`, `defsForCreateForm`, `field-ddl.ts`, `SettingsScreen.tsx`, `localDateTime`, `app-settings-dao.ts`, `impact.ts`, `photo-storage.ts`, `notification-schedule.test.ts`, `newUid`, `FuelEditor.tsx`, `ComposeScreen.tsx`, `RestorePreviewScreen.tsx`, `ContactProfileScreen.tsx`, `contact-import-resume-sweep.ts`, `Avatar.tsx`, `assist-store.ts`, `lifecycle-consumer-ledger.test.ts`, `CaptureScreen.tsx`, `reconcile-resume-sweep.ts`, `computeRingReorder`, `model-registry.ts`, `transaction.ts`, `fuel-dao.test.ts`, `ImportReviewScreen.tsx`, `NativeGcmCipher`, `types.ts`, `buildDecayRequest`, `queries.test.ts`, `011-contact-lifecycle-schema.test.ts`, `EditContactScreen.tsx`, `fuel-read.test.ts`, `SurvivorSelectScreen.tsx`, `use-read-contacts-permission.ts`, `field-sweep.test.ts`, `notification-read.test.ts`, `saf-storage.ts`, `notification-schedule.ts`, `FrequencyPicker.tsx`, `contacts-dao.test.ts`, `notification-ids.ts`, `dashboard-read.test.ts`, `seedFullContact`, `006-normalize-custom-field-values.test.ts`, `011-contact-lifecycle-schema.test.ts`, `reconcile-session-read.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `useTheme()` connect `fuel-read.test.ts` to `field-types.ts`, `001-initial.ts`, `import-session-dao.ts`, `import-session-read.ts`, `linking.ts`, `HomeScreen.tsx`, `getExecutor`, `backup-service.ts`, `ResumeReconcilePrompt.tsx`, `index.ts`, `reconcile-apply.ts`, `ReconcileGridScreen.tsx`, `Logger`, `OrreryScreen.tsx`, `contacts-dao.ts`, `SettingsScreen.tsx`, `PhotoSourcePicker.tsx`, `impact.ts`, `photo-storage.ts`, `BackupScreen.tsx`, `index.ts`, `FuelEditor.tsx`, `DigestScreen.tsx`, `ComposeScreen.tsx`, `ContactProfileScreen.tsx`, `contact-import-resume-sweep.ts`, `Avatar.tsx`, `assist-store.ts`, `CaptureScreen.tsx`, `model-registry.ts`, `transaction.ts`, `SurvivorSelectScreen.tsx`, `TouchpointRefineForm.tsx`, `notification-read.test.ts`, `ReconcileDetailScreen`, `encryption-benchmark.ts`, `saf-storage.ts`, `PhotoFieldWidget.tsx`, `FrequencyPicker.tsx`, `reconcile-session-read.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `BackupScreen()` connect `BackupScreen.tsx` to `transaction.ts`, `impact.ts`, `audit-adr-key-files.ts`, `reconciliation.ts`, `BackupSettingsScreen.tsx`, `fuel-read.test.ts`, `FrequencyPicker.tsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance` to the rest of the system?**
  _1170 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05855263157894737 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0746922024623803 - nodes in this community are weakly interconnected._
- **Should `001-initial.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._