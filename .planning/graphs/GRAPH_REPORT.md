# Graph Report - orbit-app  (2026-09-01)

## Corpus Check
- 571 files · ~448,444 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3753 nodes · 11305 edges · 207 communities (167 shown, 40 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b4283bef`
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
- resolvePhotoUri
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
- field-sweep.test.ts
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
- ContactMethodsEditor.tsx
- fail
- notification-actions.test.ts
- adr-registry.ts
- 3. Data layer
- expo-task-manager.ts
- ai-context-read.test.ts
- ai-service-guards.test.ts
- crop-geometry.ts
- File
- 7. Visual design
- favourites-dao.test.ts
- File
- System Docs
- 4. Port analysis — verified against the repo, not estimated
- package.json
- contact-methods-dao.test.ts
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
- snooze-dao.test.ts
- assist-eligibility.ts
- File
- SegmentedControl.tsx
- Directory
- handoff.test.ts
- NativeGcmCipher
- field-sweep.test.ts
- fuel-read.ts
- buildDecayRequest
- 011-contact-lifecycle-schema.test.ts
- ContactMethodsEditor.tsx
- notification-actions.test.ts
- sun-picker-read.test.ts
- Migration006IntegrityError

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
- `AppShell()` --calls--> `registerBackupSweep()`  [EXTRACTED]
  App.tsx → src/services/backup-sweep.ts
- `AppShell()` --calls--> `registerImportResumeSweep()`  [EXTRACTED]
  App.tsx → src/services/import/contact-import-resume-sweep.ts
- `AppShell()` --calls--> `registerReconcileResumeSweep()`  [EXTRACTED]
  App.tsx → src/services/import/reconcile-resume-sweep.ts

## Import Cycles
- None detected.

## Communities (207 total, 40 thin omitted)

### Community 0 - "database.ts"
Cohesion: 0.07
Nodes (71): migrations, photoMocks, AI_DEFAULTS, BACKUP_DEFAULTS, IsNever, KeysOverlap, migrateToV2(), migrateToV5() (+63 more)

### Community 1 - "types.ts"
Cohesion: 0.05
Nodes (78): migrated(), PHOTO, uidFactory(), db(), newUid(), newUid(), seedContact(), seedFlag() (+70 more)

### Community 2 - "field-types.ts"
Cohesion: 0.18
Nodes (14): styles, TriStateLastSpoke(), TriStateLastSpokeProps, calculateDaysSince(), calculateDaysUntilDue(), calculateStatus(), Frequency, FREQUENCY_DAYS (+6 more)

### Community 3 - "001-initial.ts"
Cohesion: 0.08
Nodes (21): EventRow, seedContact(), uid(), contact(), makeDef(), uid(), FuelRow, seedContact() (+13 more)

### Community 4 - "import-session-dao.ts"
Cohesion: 0.18
Nodes (18): AcceptImportSessionWithRowsInput, assertOneChange(), completeSession(), completeSessionCore(), createImportSession(), CreateImportSessionInput, deferNeedsReview(), deferNeedsReviewCore() (+10 more)

### Community 5 - "inWriteTransaction"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Configuration, Dashboard, Data Model, Decisions, Gotchas, How It Works (+7 more)

### Community 6 - "import-session-read.ts"
Cohesion: 0.25
Nodes (5): inputFor(), makePrompt(), secureCustomFetchMock, SecureFetchError, KeyAccessor

### Community 7 - "AiService.ts"
Cohesion: 0.08
Nodes (24): AiKeyStore, AiCloudProviderId, AiSettings, AiError, AiErrorCode, AiKeyStoreLike, AiProvider, AiService (+16 more)

### Community 8 - "getExecutor"
Cohesion: 0.16
Nodes (19): MethodGroups, toMethodDrafts(), LastSpokeValue, ContactLinkRow, ContactEditRow, ContactForEdit, buildCreateInput(), BuildCreateInputDeps (+11 more)

### Community 9 - "HomeScreen.tsx"
Cohesion: 0.08
Nodes (42): BirthdayBanner(), BirthdayBannerProps, birthdayCopy(), BirthdayEntry, styles, FilterChip, FilterChipRow(), FilterChipRowProps (+34 more)

### Community 10 - "OrbitContactPickerModule"
Cohesion: 0.09
Nodes (29): Any, InputStream, Intent, Boolean, CodedException, Context, Module, Promise (+21 more)

### Community 11 - "encryption.ts"
Cohesion: 0.06
Nodes (23): BackupEncryptionProfile, EncryptedBackupEnvelope, APPROVED_BACKUP_ENCRYPTION_PROFILE, BackupEncryptionBackend, BackupEnvelopeCrypto, BackupEnvelopeCryptoOptions, BackupEnvelopeError, BackupEnvelopeErrorCode (+15 more)

### Community 12 - "App.tsx"
Cohesion: 0.10
Nodes (32): AppShell(), styles, localDateTime(), openAndMigrate(), def(), isMigration006IntegrityError(), CustomFieldsScreen(), getDeviceRegion() (+24 more)

### Community 13 - "backup-service.ts"
Cohesion: 0.08
Nodes (33): automaticBackupFilename(), AutomaticBackupMetadata, filesToPrune(), isExpiredAutomaticBackup(), isOwnedAutomaticBackup(), shouldRunAutomaticBackup(), now, AutomaticBackupDependencies (+25 more)

### Community 14 - "index.ts"
Cohesion: 0.08
Nodes (22): isContactPickerAvailable(), PickContactsOptions, PickedContact, PickedMethod, readAllContacts(), readContactsByLookupKeys(), SelectedReadResult, OrbitContactPickerModule (+14 more)

### Community 15 - "model-catalog-filter.ts"
Cohesion: 0.08
Nodes (36): main(), renderSeedModule(), SEED_PATH, CATALOG_PROVIDERS, CatalogProvider, dedupe(), filterLiteLLMCatalog(), GEMINI_SOURCES (+28 more)

### Community 16 - "restore-apply.ts"
Cohesion: 0.10
Nodes (37): applyRestore(), assertCompleteIncomingPairs(), deleteActions(), DeleteCandidate, entities, entry(), FinalizeCandidate, idMap() (+29 more)

### Community 17 - "reconcile-apply.ts"
Cohesion: 0.39
Nodes (6): BackupEncryptionBenchmarkHarness(), styles, BACKUP_ENCRYPTION_BENCHMARK_CANDIDATES, BackupEncryptionBenchmarkResult, measureBackupEncryptionCandidates(), median()

### Community 18 - "ReconcileGridScreen.tsx"
Cohesion: 0.06
Nodes (51): CustomFieldValue(), CustomFieldValueProps, FieldSpec, presentValue(), styles, draftToFieldFields(), FieldDefDraft, FieldDraftFields (+43 more)

### Community 19 - "AiSuggestionLifecycle"
Cohesion: 0.11
Nodes (15): ResolvedPrompt, CONFIG, CONTEXT, Seam, AiSuggestionDeps, AiSuggestionLifecycle, AiSuggestionState, RequestConfig (+7 more)

### Community 20 - "Logger"
Cohesion: 0.24
Nodes (8): PhotoSourcePickerProps, clamp(), CropRect, cropRectFromTransform(), CropTransform, PersistCroppedMasterArgs, PhotoPipelineError, PhotoTargetDescriptor

### Community 21 - "EditContactScreen.tsx"
Cohesion: 0.10
Nodes (22): Assert, CADENCE_OWNERS, _CadenceCreate, _CadenceDashProgress, _CadenceDashStatus, _CadenceEditRow, _CadenceImpactInputs, _CadenceUpdate (+14 more)

### Community 22 - "reconcile-session-dao.ts"
Cohesion: 0.08
Nodes (42): contact(), link(), uid(), assertOneChange(), createReconcileSessionCore(), CreateReconcileSessionInput, discardSession(), discardSessionCore() (+34 more)

### Community 23 - "Phase Details"
Cohesion: 0.06
Nodes (34): Canonical refs, Canonical refs, Canonical refs, Canonical refs, Canonical refs, Cross-phase constraints (from INDEX.md's constraint log — these cross phase boundaries), Overview, Phase 10: Share-Sheet Capture (+26 more)

### Community 24 - "MergeConflictsScreen.tsx"
Cohesion: 0.15
Nodes (17): groups(), ContactMethodType, NormalizeContactMethodInput, NormalizedContactMethod, hasResolvedMergeConflicts(), MergeConflictChoice, MergeConflictCompletionInput, ContactConflictRow (+9 more)

### Community 25 - "settings-ai-logic.ts"
Cohesion: 0.18
Nodes (16): IPV4_MAPPED_PREFIX, ipv4InCidr(), ipv4IsNonPublic(), ipv6InCidr(), ipv6IsNonPublic(), isNonPublicIpLiteral(), NAT64_PREFIX, NON_PUBLIC_IPV4_CIDRS (+8 more)

### Community 26 - "contact-status-read.ts"
Cohesion: 0.11
Nodes (17): App Shell, Applying destructive emphasis, Applying relationship-state emphasis, Architecture, Changelog, Configuration, Data Model, Decisions (+9 more)

### Community 27 - "OrreryScreen.tsx"
Cohesion: 0.15
Nodes (14): ContactCard(), ContactCardProps, statusLabel(), styles, RankedFuelLine(), RankedFuelLineProps, styles, ContactStatusRow (+6 more)

### Community 28 - "field-ddl.ts"
Cohesion: 0.17
Nodes (14): computeImpact(), countRows(), impactSummaryLines(), plural(), PURGE_CHILDREN, PurgeChildSpec, purgeContact(), PurgeImpact (+6 more)

### Community 29 - "contacts-dao.ts"
Cohesion: 0.17
Nodes (19): applyReconcileSelections(), ApplyReconcileSelectionsInput, ApplyReconcileSelectionsResult, ContactApplyRow, draftFor(), ReconcileSelection, ReconcileWriteField, scalarLiveValue() (+11 more)

### Community 30 - "SettingsScreen.tsx"
Cohesion: 0.11
Nodes (32): SegmentedControl(), SegmentedControlOption, SegmentedControlProps, styles, getContactStatus(), tableExists(), listOrbitingContacts(), getProfile() (+24 more)

### Community 31 - "localDateTime"
Cohesion: 0.07
Nodes (37): finishActivity(), OrbitShareFinishModule, Avatar(), AvatarProps, styles, confirmRemovePhoto(), PhotoSourcePicker(), styles (+29 more)

### Community 32 - "app-settings-dao.ts"
Cohesion: 0.08
Nodes (33): AppSettingsPatch, AppSettingsRow, assertAiProvider(), assertBackupDays(), assertHour(), assertPhoneRegionOverride(), assertSelfSunColour(), assertSunContactId() (+25 more)

### Community 33 - "backup-schema.ts"
Cohesion: 0.21
Nodes (18): array(), assertPortableSettings(), fail(), FORWARD_MIGRATIONS, Migration, parseBackupManifest(), PORTABLE_SETTINGS_KEYS, RawManifest (+10 more)

### Community 34 - "PhotoSourcePicker.tsx"
Cohesion: 0.11
Nodes (15): concatChunks(), CONTENT_TYPE_MAP, downloadCappedToFile(), downloadImageToCache(), extFromContentType(), isAcceptedRasterContentType(), isImageUrl(), normalizeContentType() (+7 more)

### Community 35 - "impact.ts"
Cohesion: 0.25
Nodes (10): setChannel, actionUid(), birthdayBody(), birthdayIdentifier(), decayBody(), decayIdentifier(), FOREGROUND_NOTIFICATION_BEHAVIOR, buildNotificationPurgeCleanup() (+2 more)

### Community 36 - "photo-storage.ts"
Cohesion: 0.07
Nodes (50): RFC-4122, insertContact(), setContactPhotoCore(), updateContactMetadataCore(), createField(), deleteOrQuarantineField(), dropField(), dropFieldValues() (+42 more)

### Community 37 - "notification-schedule.test.ts"
Cohesion: 0.06
Nodes (29): __reset(), ScheduledRequestDouble, __setScheduled(), defId(), newDef(), quarantineDaysAgo(), seedContact(), uid() (+21 more)

### Community 38 - "BackupScreen.tsx"
Cohesion: 0.12
Nodes (21): consumeSharedBackup(), pickBackupDocument(), BackupHealth, BackupHealthInput, BackupNudgeInput, BackupNudgeState, resolveBackupHealth(), resolveBackupNudge() (+13 more)

### Community 39 - "NonPublicAddresses"
Cohesion: 0.14
Nodes (18): Boolean, ByteArray, InetAddress, Int, List, Map, Module, Promise (+10 more)

### Community 40 - "reconciliation.ts"
Cohesion: 0.12
Nodes (27): assertUniqueRows(), assertUniqueTombstones(), compareRowAndTombstone(), ENTITY_POLICIES, EntityPolicy, incompatibleRows(), MergeableEntityType, newestRow() (+19 more)

### Community 41 - "index.ts"
Cohesion: 0.13
Nodes (25): ringVisual, colors, orreryRingStyle, StrokeStyle, resolveSunOccupant(), SunOccupant, SunOccupantHeader, SunOccupantInput (+17 more)

### Community 42 - "newUid"
Cohesion: 0.15
Nodes (21): ImportMatchOutcome, setRowContact(), setRowContactCore(), setRowMatchOutcome(), setRowMatchOutcomeCore(), ImportSessionRowDbRow, importContactRecord(), insertExternalContactLinkCore() (+13 more)

### Community 43 - "secure-fetch.ts"
Cohesion: 0.10
Nodes (18): cancel(), request(), NativeSecureFetchInput, NativeSecureFetchResult, OrbitSecureFetchModule, OrbitSecureFetchModule, validateCustomEndpoint(), generateRequestId() (+10 more)

### Community 44 - "phase-17-runtime-integration.test.ts"
Cohesion: 0.12
Nodes (16): assertNoLocalOnlyKeys(), buildExportManifest(), ExportManifestDeps, FORBIDDEN_KEYS, readManifest(), withPhoto(), db(), Directory (+8 more)

### Community 45 - "v1 Requirements"
Cohesion: 0.07
Nodes (27): Actionable Notifications (NOTIF), AI Message Suggestions (AI), Backup, Export & Restore (BKP), Compose consumers' shared surface — see CMP; and the Orrery (ORR), Compose Screen & SMS Handoff (CMP), Contact CRUD & Lifecycle (CRUD), Contact Data Normalization (CDN), Contact Reconciliation & Merge (RCN) (+19 more)

### Community 46 - "useTheme"
Cohesion: 0.12
Nodes (15): Architecture, Capturing and cropping a photo, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works (+7 more)

### Community 47 - "FuelEditor.tsx"
Cohesion: 0.12
Nodes (24): blankToNull(), DraftRow(), FuelDraft, FuelEditor(), FuelEditorProps, FuelEditPatch, FuelRow(), KIND_OPTIONS (+16 more)

### Community 48 - "biome.json"
Cohesion: 0.08
Nodes (25): source, assist, actions, files, includes, formatter, enabled, indentStyle (+17 more)

### Community 49 - "ai-context-read.ts"
Cohesion: 0.29
Nodes (10): recordAutomaticBackupHealthCore(), BackupSettingsScreen(), encryptionErrorCopy(), createPreRestoreSnapshot(), createAutomaticBackupService(), createVerifiedPreRestoreSnapshot(), createBackupEnvelopeCrypto(), createSafStorage() (+2 more)

### Community 50 - "create-contact-logic.ts"
Cohesion: 0.16
Nodes (23): addMethodDraft(), canonicalDuplicateCopy(), choosePrimary(), collapseCanonicalDuplicate(), discardBlankMethodDrafts(), EMPTY_METHOD_GROUPS, emptyMethodDraft(), MethodLabel (+15 more)

### Community 51 - "DigestScreen.tsx"
Cohesion: 0.18
Nodes (22): GentleLine, OverlookedRow, QualityMarkRow, readGentleLine(), readOverlooked(), readRetrospective(), RetrospectiveRow, AllQuietInputs (+14 more)

### Community 52 - "dependencies"
Cohesion: 0.08
Nodes (25): expo, expo-file-system, expo-notifications, expo-sms, expo-status-bar, dependencies, expo, expo-file-system (+17 more)

### Community 53 - "ComposeScreen.tsx"
Cohesion: 0.14
Nodes (17): codePoints(), DEFAULT_STYLE_NOTE, intensityLine(), qualityLine(), resolvePrompt(), sanitizeValue(), STATIC_INSTRUCTION, trimToCodePoints() (+9 more)

### Community 54 - "RestorePreviewScreen.tsx"
Cohesion: 0.18
Nodes (20): RestoreApplyResult, RestoreMode, confirmReplaceAllRestore(), createRestoreApplySingleFlight(), createRestorePreviewCache(), initialRestoreApplyState(), replaceAllConfirmation(), ReplaceAllConfirmationResult (+12 more)

### Community 55 - "ContactProfileScreen.tsx"
Cohesion: 0.08
Nodes (34): EVENT_LABELS, styles, TimelineRow(), TimelineRowProps, ContactMethodGroups, listActionablePrimaryMethods(), listContactMethodGroups(), selectActionablePrimaryMethods() (+26 more)

### Community 56 - "contact-import-resume-sweep.ts"
Cohesion: 0.09
Nodes (42): resumeImport(), ResumeImportPrompt(), ResumeImportPromptProps, RootNavigation, styles, listCategories(), discardSession(), ImportSessionMode (+34 more)

### Community 57 - "Avatar.tsx"
Cohesion: 0.45
Nodes (6): getInitials(), hashName(), swatchIndex(), DashboardRow, loadWidgetTiles(), shapeWidgetTiles()

### Community 58 - "assist-store.ts"
Cohesion: 0.06
Nodes (44): ScrimPointerEvents, speedDialScrimPointerEvents(), AddSpeedDialFab(), AnimatedPressable, styles, AssistBanner(), questionFor(), styles (+36 more)

### Community 59 - "lifecycle-consumer-ledger.test.ts"
Cohesion: 0.07
Nodes (41): DAYS_TO_FREQUENCY, intendedLabel(), IntensityLine(), IntensityLineProps, styles, ageDaysOf(), AggregateRow, parseLocalMs() (+33 more)

### Community 60 - "CaptureScreen.tsx"
Cohesion: 0.21
Nodes (15): captureMultiAttach(), captureMultiNote(), addFuel(), addFuelCore(), assertOneChange(), confirmFuel(), confirmFuelCore(), ConfirmFuelInput (+7 more)

### Community 61 - "reconcile-resume-sweep.ts"
Cohesion: 0.14
Nodes (18): ResumeReconcilePrompt(), ResumeReconcilePromptProps, RootNavigation, styles, getNewestPendingReconcileSessionId(), getResumableReconcileSession(), RootStackParamList, ReconcileDetailScreen() (+10 more)

### Community 62 - "expo"
Cohesion: 0.09
Nodes (21): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+13 more)

### Community 63 - "model-registry.ts"
Cohesion: 0.06
Nodes (45): pickContacts(), CatalogFetch, CatalogFetchResponse, CatalogStorage, isEmptyCatalog(), isModelCatalog(), loadCachedCatalog(), RefreshDeps (+37 more)

### Community 64 - "transaction.ts"
Cohesion: 0.07
Nodes (56): acknowledgeProvider(), setInteractionAssistEnabled(), assertPositiveCadence(), bindContact(), unbindContact(), addLink(), addLinkCore(), applyLinkDiff() (+48 more)

### Community 65 - "006-normalize-custom-field-values.ts"
Cohesion: 0.39
Nodes (7): ContactOpts, InteractionOpts, localDateOffset(), localDateTimeOffset(), seedContact(), seedInteraction(), uid()

### Community 66 - "SqlExecutor"
Cohesion: 0.33
Nodes (7): localDateOffset(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid(), WOBBLE()

### Community 67 - "ImportReviewScreen.tsx"
Cohesion: 0.18
Nodes (16): addSignal(), candidateFor(), candidateScore(), classifyCandidate(), ContactNameRow, DuplicateEvidenceCandidate, DuplicateEvidenceResult, DuplicateEvidenceSignal (+8 more)

### Community 68 - "recency-dao.ts"
Cohesion: 0.43
Nodes (5): hasSharedBackup(), BACKUP_SHARE_MIME_TYPES, isBackupShareIntent(), navigationRef, ShareIntentGate()

### Community 69 - "CreateContactScreen.tsx"
Cohesion: 0.28
Nodes (10): BulkReviewDbRow, BulkReviewFlag, listBulkReviewFlags(), sourceBirthday(), isBirthdayUnreadable(), localDateTime(), mapBirthdayForStorage(), mapPickedContact() (+2 more)

### Community 70 - "LegacyContactPickerScreen.tsx"
Cohesion: 0.12
Nodes (15): Architecture, Changelog, Configuration, Data Model, Decisions, Deriving gravity and intensity, Gotchas, How It Works (+7 more)

### Community 71 - "audit-adr-key-files.ts"
Cohesion: 0.15
Nodes (18): adrDir, auditAdrKeyFiles(), AuditResult, byBasename, Category, CATEGORY_ORDER, classify(), everExisted() (+10 more)

### Community 72 - "types.ts"
Cohesion: 0.17
Nodes (18): ImportSessionRowStatus, markRowPhotoFailed(), markRowStatus(), commitSingleImport(), failureReason(), importRowAsNew(), ImportRowAsNewResult, pickedFromRow() (+10 more)

### Community 73 - "queries.test.ts"
Cohesion: 0.16
Nodes (12): BenchmarkResult, nowMs(), runBenchmark(), seedBenchmarkData(), SeedOptions, recreateIndexes(), statusOrder, NewestRow (+4 more)

### Community 74 - "expo-notifications.ts"
Cohesion: 0.11
Nodes (16): addNotificationResponseReceivedListener, AndroidImportance, AndroidNotificationVisibility, cancelScheduledNotificationAsync, clearLastNotificationResponseAsync, getAllScheduledNotificationsAsync, getLastNotificationResponseAsync, getPermissionsAsync (+8 more)

### Community 75 - "notification-gate.tsx"
Cohesion: 0.22
Nodes (11): applyBodyNav(), dataOf(), guardNotificationBodyIntent(), NotificationContactLookup, NotificationResponseGate(), runActionTap(), birthday, decay (+3 more)

### Community 76 - "BackupSettingsScreen.tsx"
Cohesion: 0.32
Nodes (6): BOUNDARY_TRIM, BOUNDARY_WS, CaptureInput, CapturePayload, nonBlank(), resolveCapturePayload()

### Community 77 - "bulk-review-dao.test.ts"
Cohesion: 0.12
Nodes (26): applyContactMethodDiff(), applyContactMethodDiffCore(), assertOneChange(), ContactMethodDraft, ContactMethodNormalizationContext, ContactMethodRow, ContactMethodSaveResult, listContactMethods() (+18 more)

### Community 78 - "fuel-read.test.ts"
Cohesion: 0.08
Nodes (36): Counts, MergeImpactSummary(), plural(), styles, getMergeCandidate(), listMergeCandidates(), MergeCandidate, MergeResolutions (+28 more)

### Community 79 - "SurvivorSelectScreen.tsx"
Cohesion: 0.36
Nodes (6): recommendSurvivor(), scoreCandidate(), SurvivorContinuitySignal, SurvivorRecommendation, SurvivorRecommendationCandidate, candidate()

### Community 80 - "devDependencies"
Cohesion: 0.12
Nodes (17): babel-preset-expo, @biomejs/biome, devDependencies, babel-preset-expo, @biomejs/biome, patch-package, tsx, @types/node (+9 more)

### Community 81 - "AiCloudProviderId"
Cohesion: 0.27
Nodes (4): createAiKeyStore(), keyItemName(), nativeSecureStoreBackend, SecureKeyBackend

### Community 82 - "use-read-contacts-permission.ts"
Cohesion: 0.13
Nodes (20): isBulkActionAvailable(), actionLabels, BulkAction, CandidateCardGrid(), CandidateCardGridProps, CandidateChoice, CandidateItem, styles (+12 more)

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
Cohesion: 0.48
Nodes (5): addMethodPiiFixture(), makeContact(), makeDef(), makeNeverAssignedUnboundContact(), uid()

### Community 87 - "reconcile-photo.ts"
Cohesion: 0.11
Nodes (22): FieldChoiceGroup(), FieldChoiceGroupProps, FieldChoiceMode, FieldChoiceOption, initialSelection(), styles, KEEP_ORBIT_PHOTO, PhotoChoice() (+14 more)

### Community 88 - "restore-photo-finalize-sweep.ts"
Cohesion: 0.42
Nodes (8): canonicalFor(), assertContactId(), contactPhotoRelPath(), customFieldPhotoRelPath(), profilePhotoRelPath(), relPathForTarget(), buildPhotoPurgeCleanup(), safeDelete()

### Community 89 - "widget-linking.ts"
Cohesion: 0.20
Nodes (11): parseWidgetId(), resolveWidgetUri(), WidgetLinkingGate(), WidgetNavIntent, guardWidgetIntent(), archived, bound, Contact (+3 more)

### Community 90 - "saf-storage.ts"
Cohesion: 0.31
Nodes (6): ImportSessionRow, hasUnresolvedRows(), UNRESOLVED_ROW_STATUSES, ImportRowAsNewParams, MappedRow, SourceClusters

### Community 91 - "PhotoFieldWidget.tsx"
Cohesion: 0.31
Nodes (10): customFieldValueForTarget(), isPhotoWidgetEnabled(), PhotoFieldWidget(), styles, consumeCropResult(), markPhotoStaged(), PhotoResultStore, publishCropResult() (+2 more)

### Community 92 - "resolvePhotoUri"
Cohesion: 0.22
Nodes (16): ringColor(), ringWeight(), fixture, widgetPalette, WidgetTile, ActionButton(), asColor(), asImageSource() (+8 more)

### Community 93 - "notification-schedule.ts"
Cohesion: 0.31
Nodes (8): localDateOffset(), OVERDUE(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid(), WOBBLE()

### Community 94 - "include"
Cohesion: 0.14
Nodes (13): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, ./src/*, **/*.ts, **/*.tsx, compilerOptions, forceConsistentCasingInFileNames (+5 more)

### Community 95 - "FrequencyPicker.tsx"
Cohesion: 0.21
Nodes (11): CustomIntervalResult, IntervalUnit, parseCustomInterval(), UNIT_FACTORS, FrequencyPicker(), FrequencyPickerProps, PRESET_VALUES, PRESETS (+3 more)

### Community 96 - "contact-profile-logic.ts"
Cohesion: 0.11
Nodes (17): Architecture, Changelog, Configuration, Contacts, Creating and editing a contact, Data Model, Decisions, Gotchas (+9 more)

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
Cohesion: 0.21
Nodes (15): listContactsSummary(), filterRows(), matchesQuery(), selectionCount(), rows, toggleSelection(), ContactPickerRow, toPickerRows() (+7 more)

### Community 102 - "gen-adr-registry.ts"
Cohesion: 0.18
Nodes (10): Adr, adrDir, adrs, field(), outPath, IMPORTANT: outranks NOTE: for a human skimming, and both are graphify, readAdrs(), repoRoot (+2 more)

### Community 103 - "1. One-time FND-01 standalone proof (RELEASE APK, embedded JS bundle)"
Cohesion: 0.17
Nodes (11): 0. Environment facts (proven 2026-08-14), 1. One-time FND-01 standalone proof (RELEASE APK, embedded JS bundle), 1a. Probe transport + classify the destination (before any sync), 1b. Transport source → droid (tar-over-ssh; source only), 1c. Build on droid (cmd.exe; flat repo — no monorepo subdir, no patch-build-gradle), 1d. Pull the APK back (scp; forward-slash remote path), 1e. Install on the physical Pixel + assert the themed shell, 2. Day-to-day DEBUG + Metro iteration loop (later phases) (+3 more)

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
Cohesion: 0.25
Nodes (3): ConsumedBackupShare, OrbitBackupDocumentPickerModule, OrbitBackupDocumentPickerModule

### Community 109 - "contact-picker-chunk.test.ts"
Cohesion: 0.13
Nodes (14): Architecture, Changelog, Configuration, Data Model, Decisions, Explaining profile rogue status, Gotchas, How It Works (+6 more)

### Community 110 - "dashboard-read.test.ts"
Cohesion: 0.29
Nodes (9): addFuelRow(), DECAY(), localDateOffset(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid() (+1 more)

### Community 111 - "field-sweep.test.ts"
Cohesion: 0.60
Nodes (5): byDisplayOrder(), defsForCreateForm(), isLive(), upsertValue(), visibleDefsForProfile()

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
Nodes (11): Architecture (Phase 02), Code, File Locations, How to Add a SQLite Migration, Migration runner, Overview, Pitfalls, Resolution order (+3 more)

### Community 117 - "seedFullContact"
Cohesion: 0.33
Nodes (10): seedContact(), seedCustomValues(), seedDef(), seedEvent(), seedFuel(), seedFullContact(), seedHistory(), seedInteraction() (+2 more)

### Community 118 - "birthday-logic.ts"
Cohesion: 0.38
Nodes (7): daysInMonth(), daysUntilBirthday(), isLeapYear(), isValidStoredBirthday(), observedDayFor(), ParsedBirthday, parseStoredBirthday()

### Community 119 - "buildDecayRequest"
Cohesion: 0.11
Nodes (17): Architecture, Capturing a custom photo value, Changelog, Configuration, Creating and editing a definition, Custom Fields, Data Model, Decisions (+9 more)

### Community 120 - "audit-scalar-method-refs.mjs"
Cohesion: 0.25
Nodes (7): findings, OWNERS, ROOT, scalarReferences(), SOURCE_ROOT, stripComments(), unowned

### Community 121 - "normalize-graph-docrefs.ts"
Cohesion: 0.22
Nodes (8): abs, canonical, Graph, GraphLink, GraphNode, links, remap, seen

### Community 123 - "006-normalize-custom-field-values.test.ts"
Cohesion: 0.12
Nodes (14): addContact(), addDefinition(), addLegacyRow(), legacyMigrations, migrate(), uid(), CHILD_COPY_COLUMNS, CHILD_DDL (+6 more)

### Community 124 - "011-contact-lifecycle-schema.test.ts"
Cohesion: 0.21
Nodes (13): canonicalMethod(), classifyMethodFamily(), classifyReconciliation(), ClassifyReconciliationInput, classifyScalar(), RECONCILE_FIELD_FAMILIES, ReconcileFieldOption, ReconcileOrbitContact (+5 more)

### Community 125 - "ContactMethodsEditor.tsx"
Cohesion: 0.27
Nodes (9): applyLifecycleTransitionEffects(), bindWithLifecycleEffects(), defaultDeps, EffectDeps, EffectDepsOverride, LifecycleDeps, LifecycleDirection, exec (+1 more)

### Community 126 - "fail"
Cohesion: 0.46
Nodes (8): assertTextValue(), fail(), FIXED_LEGACY_COLUMNS, loadAndValidateDefs(), proveCopy(), quoteSafeColumn(), readLegacyRows(), snapshotOrphanColumn()

### Community 127 - "notification-actions.test.ts"
Cohesion: 0.15
Nodes (16): PortableSettingsSnapshot, AiSettingsForm, buildAiSettingsPatch(), buildInspectorViewState(), buildProviderAckViewState(), dedupePreserveOrder(), discoverModelsForField(), ModelFieldState (+8 more)

### Community 128 - "adr-registry.ts"
Cohesion: 0.03
Nodes (68): ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011 (+60 more)

### Community 129 - "3. Data layer"
Cohesion: 0.29
Nodes (7): 3. Data layer, [DECIDED] Local-first. On-device SQLite. No cloud backend., [DECIDED] Migration path stays open, [DECIDED] Offline reads must always work, [DECIDED] Supabase is explicitly rejected for this app, On-device SQLite operating model — read this before touching schema, [OPEN] Backup and export

### Community 130 - "expo-task-manager.ts"
Cohesion: 0.29
Nodes (3): defineTask, isTaskDefined, TaskExecutor

### Community 131 - "ai-context-read.test.ts"
Cohesion: 0.13
Nodes (16): contact(), email(), phone(), uid(), addLinkRow(), makeContact(), makeContactRow(), makeDef() (+8 more)

### Community 132 - "ai-service-guards.test.ts"
Cohesion: 0.12
Nodes (16): Architecture, Changelog, Configuration, Conversational Fuel, Data Model, Decisions, Editing fuel on a profile, Finding saved fuel (+8 more)

### Community 133 - "crop-geometry.ts"
Cohesion: 0.14
Nodes (7): BackupPassphraseBackend, BackupPassphraseChangeStore, BackupPassphraseStore, createBackupPassphraseStore(), nativeBackend, PendingBackupPassphraseChange, PendingPassphraseChangeReadResult

### Community 135 - "7. Visual design"
Cohesion: 0.33
Nodes (6): 7. Visual design, [DECIDED] Space theme throughout, [DECIDED] Theme tokens, [DECIDED] Two distinct screens — do not merge them, Rendering, The orrery — settled mechanics

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

### Community 141 - "contact-methods-dao.test.ts"
Cohesion: 0.13
Nodes (15): OrbitBody(), OrbitBodyProps, OrreryClockContext, useOrreryClock(), OrreryCanvas(), OrreryCanvasProps, seeded(), Star (+7 more)

### Community 142 - "sun-picker-read.test.ts"
Cohesion: 0.43
Nodes (6): ExternalContactLinkInput, acceptPickedContacts(), AcceptPickedContactsOptions, CommitSingleImportInput, PickedImportNavigator, routePickedImport()

### Community 143 - "field-type-change.test.ts"
Cohesion: 0.21
Nodes (15): classifyPermissionResult(), ContactsPermissionRequestResult, ContactsPermissionVerdict, clearDeniedPresentation(), ContactsPermissionRequestState, ContactsPermissionResult, ContactsPermissionState, ensureReadContactsPermission() (+7 more)

### Community 144 - "Directory"
Cohesion: 0.14
Nodes (30): assertSafeImportStagingRelative(), assertSafeReconcileStagingRelative(), assertSafeRelative(), assertSafeRestorePendingRelative(), deleteJournalEntryCore(), listJournalEntriesCore(), RestorePhotoJournalAction, RestorePhotoJournalEntry (+22 more)

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
Cohesion: 0.38
Nodes (3): contact(), field(), uid()

### Community 152 - "13. Tooling"
Cohesion: 0.67
Nodes (3): 13. Tooling, [DECIDED] GSD and Graphify from the start, [DECIDED] The Roadmap Workshop is not used

### Community 189 - "ADR Index"
Cohesion: 0.40
Nodes (4): ADR Index, Do not machine-read this file, How to use this, Index

### Community 190 - "computeRingReorder"
Cohesion: 0.53
Nodes (4): seedArchivedFavourite(), seedContact(), seedThreeFavourites(), uid()

### Community 191 - "fuel-dao.test.ts"
Cohesion: 0.20
Nodes (17): BirthdayNotificationCandidate, DecayEligibleCandidate, listBirthdayNotificationCandidates(), listDecayEligibleCandidates(), buildBirthdayRequest(), buildDecayRequest(), cancelAllOwned(), hourKey() (+9 more)

### Community 192 - "snooze-dao.test.ts"
Cohesion: 0.31
Nodes (9): assertOneChange(), ContactMetadataRow, ignoreBulkReviewFlag(), ignoreBulkReviewFlagCore(), IgnoreBulkReviewFlagInput, insertResolutionCore(), resolveBulkReviewFlag(), resolveBulkReviewFlagCore() (+1 more)

### Community 193 - "assist-eligibility.ts"
Cohesion: 0.60
Nodes (4): isAssistEligible(), localDateTimeMs(), PendingAssistForBanner, selectBannerState()

### Community 194 - "File"
Cohesion: 0.22
Nodes (10): isFutureLocalDate(), PickDateResult, resolvePickedDate(), NOW, localNow(), daysAgo(), daysAgo(), daysAgo() (+2 more)

### Community 195 - "SegmentedControl.tsx"
Cohesion: 0.47
Nodes (3): newDef(), seedContact(), uid()

### Community 200 - "fuel-read.ts"
Cohesion: 0.43
Nodes (6): compareFuel(), FUEL_KIND_PRIORITY, kindRank(), RankableFuel, rankedIds(), Row

### Community 201 - "buildDecayRequest"
Cohesion: 0.50
Nodes (6): allowedSlotForDay(), clampHour(), clampStagger(), inQuietWindow(), nextAllowedFireInstant(), nextNudgeDate()

### Community 203 - "011-contact-lifecycle-schema.test.ts"
Cohesion: 0.25
Nodes (5): DIRECT_CONTACT_CHILDREN, newUid(), seedV10Fixture(), TableInfo, V10

### Community 204 - "ContactMethodsEditor.tsx"
Cohesion: 0.36
Nodes (7): ContactMethodEditorDraft, ContactMethodsEditor(), ContactMethodsEditorProps, LABELS, STANDARD_LABELS, styles, typeCopy()

### Community 205 - "notification-actions.test.ts"
Cohesion: 0.17
Nodes (7): HeadlessResponsePayload, DATA, freshHandler(), h, NotificationData, DesiredRequest, ScheduledEntry

### Community 208 - "sun-picker-read.test.ts"
Cohesion: 0.38
Nodes (4): SunCandidate, seedContact(), SeedOpts, uid()

## Knowledge Gaps
- **1026 isolated node(s):** `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance`, `AndroidNotificationVisibility`, `scheduled` (+1021 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlExecutor` connect `types.ts` to `database.ts`, `ai-context-read.test.ts`, `001-initial.ts`, `import-session-dao.ts`, `HomeScreen.tsx`, `App.tsx`, `backup-service.ts`, `sun-picker-read.test.ts`, `index.ts`, `restore-apply.ts`, `Directory`, `reconcile-session-dao.ts`, `defsForCreateForm`, `OrreryScreen.tsx`, `field-ddl.ts`, `contacts-dao.ts`, `SettingsScreen.tsx`, `localDateTime`, `app-settings-dao.ts`, `photo-storage.ts`, `notification-schedule.test.ts`, `newUid`, `phase-17-runtime-integration.test.ts`, `ai-context-read.ts`, `model-registry.ts`, `DigestScreen.tsx`, `ContactProfileScreen.tsx`, `contact-import-resume-sweep.ts`, `Avatar.tsx`, `assist-store.ts`, `lifecycle-consumer-ledger.test.ts`, `CaptureScreen.tsx`, `reconcile-resume-sweep.ts`, `computeRingReorder`, `fuel-dao.test.ts`, `snooze-dao.test.ts`, `transaction.ts`, `006-normalize-custom-field-values.ts`, `SegmentedControl.tsx`, `SqlExecutor`, `CreateContactScreen.tsx`, `handoff.test.ts`, `ImportReviewScreen.tsx`, `types.ts`, `queries.test.ts`, `011-contact-lifecycle-schema.test.ts`, `bulk-review-dao.test.ts`, `fuel-read.test.ts`, `notification-actions.test.ts`, `sun-picker-read.test.ts`, `notification-read.test.ts`, `restore-photo-finalize-sweep.ts`, `notification-schedule.ts`, `contacts-dao.test.ts`, `dashboard-read.test.ts`, `field-sweep.test.ts`, `006-normalize-custom-field-values.test.ts`, `ContactMethodsEditor.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `useTheme()` connect `assist-store.ts` to `field-types.ts`, `HomeScreen.tsx`, `App.tsx`, `reconcile-apply.ts`, `ReconcileGridScreen.tsx`, `reconcile-session-dao.ts`, `MergeConflictsScreen.tsx`, `OrreryScreen.tsx`, `SettingsScreen.tsx`, `localDateTime`, `BackupScreen.tsx`, `index.ts`, `FuelEditor.tsx`, `ai-context-read.ts`, `create-contact-logic.ts`, `DigestScreen.tsx`, `RestorePreviewScreen.tsx`, `ContactProfileScreen.tsx`, `contact-import-resume-sweep.ts`, `lifecycle-consumer-ledger.test.ts`, `reconcile-resume-sweep.ts`, `model-registry.ts`, `transaction.ts`, `ContactMethodsEditor.tsx`, `fuel-read.test.ts`, `use-read-contacts-permission.ts`, `TouchpointRefineForm.tsx`, `reconcile-photo.ts`, `PhotoFieldWidget.tsx`, `FrequencyPicker.tsx`, `notification-ids.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `BackupScreen()` connect `BackupScreen.tsx` to `transaction.ts`, `audit-adr-key-files.ts`, `App.tsx`, `backup-service.ts`, `fuel-read.test.ts`, `SurvivorSelectScreen.tsx`, `ai-context-read.ts`, `assist-store.ts`, `model-registry.ts`, `localDateTime`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance` to the rest of the system?**
  _1026 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07084585659081151 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0468215994531784 - nodes in this community are weakly interconnected._
- **Should `001-initial.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07807807807807808 - nodes in this community are weakly interconnected._