# Graph Report - orbit-app  (2026-08-31)

## Corpus Check
- 565 files · ~439,203 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3602 nodes · 11160 edges · 199 communities (162 shown, 37 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9834a7ae`
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
- formatLocalDate
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
- notification-nav.ts
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
- Migration006IntegrityError
- field-type-change.test.ts
- NativeGcmCipher
- File
- SegmentedControl.tsx
- Directory
- ReconciliationRow
- makeDef

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
- `AppShell()` --calls--> `getDeviceRegion()`  [EXTRACTED]
  App.tsx → src/services/device-region.ts
- `AppShell()` --calls--> `registerImportResumeSweep()`  [EXTRACTED]
  App.tsx → src/services/import/contact-import-resume-sweep.ts

## Import Cycles
- None detected.

## Communities (199 total, 37 thin omitted)

### Community 0 - "database.ts"
Cohesion: 0.09
Nodes (47): migrations, photoMocks, AI_DEFAULTS, BACKUP_DEFAULTS, IsNever, KeysOverlap, newUid(), seedContact() (+39 more)

### Community 1 - "types.ts"
Cohesion: 0.06
Nodes (48): migrated(), PHOTO, uidFactory(), db(), newUid(), migrateToV2(), migrateToV5(), seedBenchmarkData() (+40 more)

### Community 2 - "field-types.ts"
Cohesion: 0.06
Nodes (48): CustomFieldValue(), CustomFieldValueProps, FieldSpec, presentValue(), styles, draftToFieldFields(), FieldDefDraft, FieldDraftFields (+40 more)

### Community 3 - "001-initial.ts"
Cohesion: 0.06
Nodes (39): makeContact(), uid(), contact(), method(), uid(), seedContact(), uid(), EventRow (+31 more)

### Community 4 - "import-session-dao.ts"
Cohesion: 0.15
Nodes (27): AcceptImportSessionWithRowsInput, assertOneChange(), completeSessionCore(), createImportSession(), CreateImportSessionInput, deferNeedsReview(), deferNeedsReviewCore(), finalizeSessionIfTerminal() (+19 more)

### Community 5 - "inWriteTransaction"
Cohesion: 0.12
Nodes (38): acknowledgeProvider(), setInteractionAssistEnabled(), assertPositiveCadence(), bindContact(), unbindContact(), clearContactPhoto(), restoreContact(), bumpDataRevisionCore() (+30 more)

### Community 6 - "import-session-read.ts"
Cohesion: 0.13
Nodes (15): seedFlag(), seedImportRow(), acceptImportSessionWithRows(), acceptRows(), newUid(), seedContact(), InvalidImportBirthdayError, NameRequiredError (+7 more)

### Community 7 - "AiService.ts"
Cohesion: 0.08
Nodes (24): AiKeyStore, AiCloudProviderId, AiSettings, AiErrorCode, AiKeyStoreLike, AiProvider, AiService, AnthropicProvider (+16 more)

### Community 8 - "getExecutor"
Cohesion: 0.10
Nodes (39): Counts, MergeImpactSummary(), plural(), styles, getDb(), getExecutor(), getSessionById(), listSessionRows() (+31 more)

### Community 9 - "HomeScreen.tsx"
Cohesion: 0.08
Nodes (39): BirthdayBanner(), BirthdayBannerProps, birthdayCopy(), BirthdayEntry, styles, FilterChip, FilterChipRow(), FilterChipRowProps (+31 more)

### Community 10 - "OrbitContactPickerModule"
Cohesion: 0.09
Nodes (29): Any, InputStream, Intent, Boolean, CodedException, Context, Module, Promise (+21 more)

### Community 11 - "encryption.ts"
Cohesion: 0.07
Nodes (22): BackupEncryptionProfile, EncryptedBackupEnvelope, APPROVED_BACKUP_ENCRYPTION_PROFILE, BackupEncryptionBackend, BackupEnvelopeCrypto, BackupEnvelopeCryptoOptions, BackupEnvelopeError, BackupEnvelopeErrorCode (+14 more)

### Community 12 - "App.tsx"
Cohesion: 0.11
Nodes (27): AppShell(), styles, isMigration006IntegrityError(), RootNavigator(), registerBackupSweep(), registerFieldSweep(), StaleCandidate, interactionAssistSweep() (+19 more)

### Community 13 - "backup-service.ts"
Cohesion: 0.06
Nodes (37): automaticBackupFilename(), AutomaticBackupMetadata, filesToPrune(), isExpiredAutomaticBackup(), isOwnedAutomaticBackup(), shouldRunAutomaticBackup(), now, createPreRestoreSnapshot() (+29 more)

### Community 14 - "index.ts"
Cohesion: 0.12
Nodes (13): PickContactsOptions, PickedContact, PickedMethod, readAllContacts(), readContactsByLookupKeys(), SelectedReadResult, OrbitContactPickerModule, OrbitContactPickerModule (+5 more)

### Community 15 - "model-catalog-filter.ts"
Cohesion: 0.08
Nodes (28): main(), renderSeedModule(), SEED_PATH, CatalogFetch, CatalogFetchResponse, CatalogStorage, isEmptyCatalog(), isModelCatalog() (+20 more)

### Community 16 - "restore-apply.ts"
Cohesion: 0.10
Nodes (36): applyRestore(), assertCompleteIncomingPairs(), deleteActions(), DeleteCandidate, entities, entry(), FinalizeCandidate, idMap() (+28 more)

### Community 17 - "reconcile-apply.ts"
Cohesion: 0.13
Nodes (23): ReconcileSelection, assertOneChange(), getReviewedSnapshots(), ReviewedSnapshotMap, reviewedValueFor(), upsertReviewedSnapshot(), upsertReviewedSnapshotCore(), UpsertReviewedSnapshotInput (+15 more)

### Community 18 - "ReconcileGridScreen.tsx"
Cohesion: 0.07
Nodes (36): ScrimPointerEvents, speedDialScrimPointerEvents(), AddSpeedDialFab(), AnimatedPressable, styles, ConsolidationPrompt(), sourceName(), SourcePreview() (+28 more)

### Community 19 - "AiSuggestionLifecycle"
Cohesion: 0.11
Nodes (15): ResolvedPrompt, CONFIG, CONTEXT, Seam, AiSuggestionDeps, AiSuggestionLifecycle, AiSuggestionState, RequestConfig (+7 more)

### Community 20 - "Logger"
Cohesion: 0.25
Nodes (14): ringColor(), ringWeight(), fixture, widgetPalette, ActionButton(), asColor(), asImageSource(), Avatar() (+6 more)

### Community 21 - "EditContactScreen.tsx"
Cohesion: 0.16
Nodes (17): isAdditiveOnlySelection(), card(), ReconcileDiffResult, ReconcileFieldDiff, ScanState, chipLabel(), GridCard, Link (+9 more)

### Community 22 - "reconcile-session-dao.ts"
Cohesion: 0.16
Nodes (23): assertOneChange(), createReconcileSession(), createReconcileSessionCore(), CreateReconcileSessionInput, discardSession(), discardSessionCore(), finalizeSessionIfTerminal(), finalizeSessionIfTerminalCore() (+15 more)

### Community 23 - "Phase Details"
Cohesion: 0.06
Nodes (34): Canonical refs, Canonical refs, Canonical refs, Canonical refs, Canonical refs, Cross-phase constraints (from INDEX.md's constraint log — these cross phase boundaries), Overview, Phase 10: Share-Sheet Capture (+26 more)

### Community 24 - "MergeConflictsScreen.tsx"
Cohesion: 0.08
Nodes (36): ContactMethodEditorDraft, groups(), ContactMethodsEditor(), ContactMethodsEditorProps, LABELS, STANDARD_LABELS, styles, typeCopy() (+28 more)

### Community 25 - "settings-ai-logic.ts"
Cohesion: 0.10
Nodes (28): IPV4_MAPPED_PREFIX, ipv4InCidr(), ipv4IsNonPublic(), ipv6InCidr(), ipv6IsNonPublic(), isNonPublicIpLiteral(), NAT64_PREFIX, NON_PUBLIC_IPV4_CIDRS (+20 more)

### Community 26 - "contact-status-read.ts"
Cohesion: 0.16
Nodes (17): ringVisual, colors, ContactStatusRow, getContactStatus(), RawRow, RogueReason, orreryRingStyle, StrokeStyle (+9 more)

### Community 27 - "OrreryScreen.tsx"
Cohesion: 0.16
Nodes (25): listOrbitingContacts(), getProfile(), getProfilePhoto(), clamp01(), deriveOrreryMetrics(), drawnRadius(), driftPush(), evenSpreadAngle() (+17 more)

### Community 28 - "field-ddl.ts"
Cohesion: 0.15
Nodes (20): addLink(), addLinkCore(), applyLinkDiff(), assertOneChange(), DraftLink, removeLink(), removeLinkCore(), SeededLink (+12 more)

### Community 29 - "contacts-dao.ts"
Cohesion: 0.14
Nodes (26): applyContactMethodDiff(), applyContactMethodDiffCore(), assertOneChange(), ContactMethodDraft, ContactMethodNormalizationContext, ContactMethodRow, ContactMethodSaveResult, listContactMethods() (+18 more)

### Community 30 - "SettingsScreen.tsx"
Cohesion: 0.10
Nodes (23): pickContacts(), createFileCatalogStorage(), AppSettingsPatch, resolveEffectivePhoneRegion(), listSunCandidates(), SunCandidate, pinResultCopy(), providerDisplayName() (+15 more)

### Community 31 - "localDateTime"
Cohesion: 0.12
Nodes (25): AssistBanner(), questionFor(), styles, AssistConfirmation(), AssistConfirmationProps, styles, PendingConfirmationsSheet(), questionFor() (+17 more)

### Community 32 - "app-settings-dao.ts"
Cohesion: 0.09
Nodes (29): AppSettings, AppSettingsRow, assertAiProvider(), assertHour(), assertPhoneRegionOverride(), assertSelfSunColour(), assertSunContactId(), assertToggle() (+21 more)

### Community 33 - "backup-schema.ts"
Cohesion: 0.13
Nodes (28): array(), assertPortableSettings(), fail(), FORWARD_MIGRATIONS, Migration, parseBackupManifest(), PORTABLE_SETTINGS_KEYS, RawManifest (+20 more)

### Community 34 - "PhotoSourcePicker.tsx"
Cohesion: 0.13
Nodes (19): confirmRemovePhoto(), PhotoSourcePicker(), styles, clearProfilePhoto(), profilePhotoRelPath(), concatChunks(), CONTENT_TYPE_MAP, downloadCappedToFile() (+11 more)

### Community 35 - "impact.ts"
Cohesion: 0.18
Nodes (13): listNeverContacted(), NeverContactedSort, countUnbound(), listUnbound(), UnboundRow, NeverContactedScreen(), SORT_OPTIONS, styles (+5 more)

### Community 36 - "photo-storage.ts"
Cohesion: 0.09
Nodes (20): OrbitBody(), OrbitBodyProps, resumeImport(), ResumeImportPrompt(), ResumeImportPromptProps, RootNavigation, styles, BenchmarkResult (+12 more)

### Community 37 - "notification-schedule.test.ts"
Cohesion: 0.09
Nodes (22): __reset(), ScheduledRequestDouble, __setScheduled(), cancelMock, getAllMock, recorded(), RecordedRequest, scheduledDigest() (+14 more)

### Community 38 - "BackupScreen.tsx"
Cohesion: 0.13
Nodes (20): consumeSharedBackup(), pickBackupDocument(), BackupHealth, BackupHealthInput, BackupNudgeInput, BackupNudgeState, resolveBackupHealth(), resolveBackupNudge() (+12 more)

### Community 39 - "NonPublicAddresses"
Cohesion: 0.14
Nodes (18): Boolean, ByteArray, InetAddress, Int, List, Map, Module, Promise (+10 more)

### Community 40 - "reconciliation.ts"
Cohesion: 0.14
Nodes (23): assertUniqueRows(), assertUniqueTombstones(), compareRowAndTombstone(), ENTITY_POLICIES, EntityPolicy, incompatibleRows(), MergeableEntityType, newestRow() (+15 more)

### Community 41 - "index.ts"
Cohesion: 0.25
Nodes (13): ThemeStore, useThemeStore, resolveMode(), resolvePalette(), ThemeContext, ThemeProvider(), ThemeProviderProps, ResolvedMode (+5 more)

### Community 42 - "newUid"
Cohesion: 0.21
Nodes (13): completeSession(), retireRowStagedPhoto(), ExternalContactLinkInput, commitSingleImport(), CommitSingleImportInput, deleteStagedPhoto(), ImportedPhotoFs, persistImportedPhotoPostCommit() (+5 more)

### Community 43 - "secure-fetch.ts"
Cohesion: 0.07
Nodes (22): cancel(), request(), NativeSecureFetchInput, NativeSecureFetchResult, OrbitSecureFetchModule, OrbitSecureFetchModule, generateRequestId(), mapNativeError() (+14 more)

### Community 44 - "phase-17-runtime-integration.test.ts"
Cohesion: 0.11
Nodes (11): db(), Directory, fs, insertContact(), text, uidFactory(), BackupPassphraseBackend, createBackupPassphraseStore() (+3 more)

### Community 45 - "v1 Requirements"
Cohesion: 0.07
Nodes (27): Actionable Notifications (NOTIF), AI Message Suggestions (AI), Backup, Export & Restore (BKP), Compose consumers' shared surface — see CMP; and the Orrery (ORR), Compose Screen & SMS Handoff (CMP), Contact CRUD & Lifecycle (CRUD), Contact Data Normalization (CDN), Contact Reconciliation & Merge (RCN) (+19 more)

### Community 46 - "useTheme"
Cohesion: 0.18
Nodes (12): isBulkActionAvailable(), actionLabels, BulkAction, CandidateCardGrid(), CandidateCardGridProps, CandidateChoice, CandidateItem, styles (+4 more)

### Community 47 - "FuelEditor.tsx"
Cohesion: 0.10
Nodes (29): blankToNull(), DraftRow(), FuelDraft, FuelEditor(), FuelEditorProps, FuelEditPatch, FuelRow(), KIND_OPTIONS (+21 more)

### Community 48 - "biome.json"
Cohesion: 0.08
Nodes (25): source, assist, actions, files, includes, formatter, enabled, indentStyle (+17 more)

### Community 49 - "ai-context-read.ts"
Cohesion: 0.18
Nodes (16): ArchivedContactRow, listArchived(), computeImpact(), countRows(), impactSummaryLines(), plural(), PURGE_CHILDREN, PurgeChildSpec (+8 more)

### Community 50 - "create-contact-logic.ts"
Cohesion: 0.14
Nodes (21): MethodGroups, isFutureLocalDate(), LastSpokeValue, PickDateResult, resolvePickedDate(), NOW, buildCreateInput(), BuildCreateInputDeps (+13 more)

### Community 51 - "DigestScreen.tsx"
Cohesion: 0.17
Nodes (22): GentleLine, OverlookedRow, QualityMarkRow, readGentleLine(), readOverlooked(), readRetrospective(), RetrospectiveRow, AllQuietInputs (+14 more)

### Community 52 - "dependencies"
Cohesion: 0.08
Nodes (25): expo, expo-file-system, expo-notifications, expo-sms, expo-status-bar, dependencies, expo, expo-file-system (+17 more)

### Community 53 - "ComposeScreen.tsx"
Cohesion: 0.08
Nodes (34): resolveActiveCatalog(), codePoints(), DEFAULT_STYLE_NOTE, intensityLine(), qualityLine(), resolvePrompt(), sanitizeValue(), STATIC_INSTRUCTION (+26 more)

### Community 54 - "RestorePreviewScreen.tsx"
Cohesion: 0.18
Nodes (21): RestoreApplyResult, RestoreMode, confirmReplaceAllRestore(), createRestoreApplySingleFlight(), createRestorePreviewCache(), initialRestoreApplyState(), isEncryptedBackupEnvelope(), replaceAllConfirmation() (+13 more)

### Community 55 - "ContactProfileScreen.tsx"
Cohesion: 0.07
Nodes (45): EVENT_LABELS, styles, TimelineRow(), TimelineRowProps, ContactMethodGroups, listActionablePrimaryMethods(), listContactMethodGroups(), selectActionablePrimaryMethods() (+37 more)

### Community 56 - "contact-import-resume-sweep.ts"
Cohesion: 0.15
Nodes (21): ImportSessionMode, setRowContact(), getResumableSession(), ImportSession, ImportSessionDbRow, mapSession(), parseCandidates(), sessionSummaryCounts (+13 more)

### Community 57 - "Avatar.tsx"
Cohesion: 0.17
Nodes (16): Avatar(), AvatarProps, getInitials(), hashName(), swatchIndex(), styles, ProfileStatus, DashboardRow (+8 more)

### Community 58 - "assist-store.ts"
Cohesion: 0.09
Nodes (23): EndpointSelector(), EndpointSelectorProps, styles, ReachOutRouter(), ReachOutRouterProps, styles, createPendingAssist(), InteractionAssistChannel (+15 more)

### Community 59 - "lifecycle-consumer-ledger.test.ts"
Cohesion: 0.06
Nodes (43): IntensityLineProps, ImpactInputs, Assert, CADENCE_OWNERS, _CadenceCreate, _CadenceDashProgress, _CadenceDashStatus, _CadenceEditRow (+35 more)

### Community 60 - "CaptureScreen.tsx"
Cohesion: 0.08
Nodes (33): finishActivity(), OrbitShareFinishModule, captureMultiAttach(), captureMultiNote(), FuelRow, seedContact(), shareRow(), uid() (+25 more)

### Community 61 - "reconcile-resume-sweep.ts"
Cohesion: 0.19
Nodes (13): ResumeReconcilePrompt(), ResumeReconcilePromptProps, RootNavigation, styles, getNewestPendingReconcileSessionId(), cleanupDiscardedReconcileStagedPhotos(), describeResumableReconcile(), nativeReconcileStagingFs (+5 more)

### Community 62 - "expo"
Cohesion: 0.09
Nodes (21): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+13 more)

### Community 63 - "model-registry.ts"
Cohesion: 0.17
Nodes (18): asCatalogProvider(), better(), EMPTY, filterToFrontier(), FRONTIER_TIERS, FrontierTier, frontierWinners(), isDated() (+10 more)

### Community 64 - "transaction.ts"
Cohesion: 0.22
Nodes (4): EventType, RecordEventInput, chain, withMutex()

### Community 65 - "006-normalize-custom-field-values.ts"
Cohesion: 0.11
Nodes (17): ContactOpts, InteractionOpts, localDateOffset(), localDateTimeOffset(), seedContact(), seedInteraction(), uid(), CHILD_COPY_COLUMNS (+9 more)

### Community 66 - "SqlExecutor"
Cohesion: 0.13
Nodes (15): OrbitingContact, localDateOffset(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid(), WOBBLE() (+7 more)

### Community 67 - "ImportReviewScreen.tsx"
Cohesion: 0.16
Nodes (17): addSignal(), candidateFor(), candidateScore(), classifyCandidate(), ContactNameRow, DuplicateEvidenceCandidate, DuplicateEvidenceResult, DuplicateEvidenceSignal (+9 more)

### Community 68 - "recency-dao.ts"
Cohesion: 0.24
Nodes (12): isValidLocalDateTime(), rejectFutureOccurredAt(), CreateContactInput, createContactWithInteraction(), deleteTouchpoint(), DeleteTouchpointInput, editTouchpointFull(), EditTouchpointFullInput (+4 more)

### Community 69 - "CreateContactScreen.tsx"
Cohesion: 0.11
Nodes (40): addMethodDraft(), canonicalDuplicateCopy(), choosePrimary(), collapseCanonicalDuplicate(), discardBlankMethodDrafts(), EMPTY_METHOD_GROUPS, emptyMethodDraft(), MethodLabel (+32 more)

### Community 70 - "LegacyContactPickerScreen.tsx"
Cohesion: 0.21
Nodes (15): listContactsSummary(), filterRows(), matchesQuery(), selectionCount(), rows, toggleSelection(), ContactPickerRow, toPickerRows() (+7 more)

### Community 71 - "audit-adr-key-files.ts"
Cohesion: 0.15
Nodes (18): adrDir, auditAdrKeyFiles(), AuditResult, byBasename, Category, CATEGORY_ORDER, classify(), everExisted() (+10 more)

### Community 72 - "types.ts"
Cohesion: 0.17
Nodes (12): isContactPickerAvailable(), contactImportMode, { isContactPickerAvailable }, PickedImportNavigator, routePickedImport(), AppNavigate, startContactImport(), StartContactImportOptions (+4 more)

### Community 73 - "queries.test.ts"
Cohesion: 0.36
Nodes (6): statusOrder, NewestRow, ScanRow, seedContact(), seedInteraction(), uid()

### Community 74 - "expo-notifications.ts"
Cohesion: 0.11
Nodes (16): addNotificationResponseReceivedListener, AndroidImportance, AndroidNotificationVisibility, cancelScheduledNotificationAsync, clearLastNotificationResponseAsync, getAllScheduledNotificationsAsync, getLastNotificationResponseAsync, getPermissionsAsync (+8 more)

### Community 75 - "notification-gate.tsx"
Cohesion: 0.22
Nodes (11): applyBodyNav(), dataOf(), guardNotificationBodyIntent(), NotificationContactLookup, NotificationResponseGate(), runActionTap(), birthday, decay (+3 more)

### Community 76 - "BackupSettingsScreen.tsx"
Cohesion: 0.13
Nodes (18): assertBackupDays(), recordAutomaticBackupHealthCore(), BackupSettingsFormInput, BackupSettingsPatchResult, buildBackupSettingsPatch(), EncryptionSetupResult, validateEncryptionSetup(), validateWholeBackupDays() (+10 more)

### Community 77 - "bulk-review-dao.test.ts"
Cohesion: 0.14
Nodes (19): RFC-4122, insertContact(), assertOneChange(), ContactMetadataRow, ignoreBulkReviewFlag(), ignoreBulkReviewFlagCore(), IgnoreBulkReviewFlagInput, insertResolutionCore() (+11 more)

### Community 78 - "fuel-read.test.ts"
Cohesion: 0.22
Nodes (14): setContactPhotoCore(), byDisplayOrder(), defsForCreateForm(), isLive(), upsertValueCore(), visibleDefsForProfile(), ContactRow, isEmptyMergeValue() (+6 more)

### Community 79 - "SurvivorSelectScreen.tsx"
Cohesion: 0.31
Nodes (7): getMergeCandidate(), listMergeCandidates(), MergeCandidate, tableExists(), Candidate, styles, SurvivorSelectScreen()

### Community 80 - "devDependencies"
Cohesion: 0.12
Nodes (17): babel-preset-expo, @biomejs/biome, devDependencies, babel-preset-expo, @biomejs/biome, patch-package, tsx, @types/node (+9 more)

### Community 81 - "AiCloudProviderId"
Cohesion: 0.27
Nodes (4): createAiKeyStore(), keyItemName(), nativeSecureStoreBackend, SecureKeyBackend

### Community 82 - "use-read-contacts-permission.ts"
Cohesion: 0.21
Nodes (15): classifyPermissionResult(), ContactsPermissionRequestResult, ContactsPermissionVerdict, clearDeniedPresentation(), ContactsPermissionRequestState, ContactsPermissionResult, ContactsPermissionState, ensureReadContactsPermission() (+7 more)

### Community 83 - "OrbitSecureFetchModuleTest"
Cohesion: 0.19
Nodes (7): File, ByteArray, InetAddress, List, String, OrbitSecureFetchModuleTest, Vector

### Community 84 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, android, audit:adr-key-files, check:adr-key-files, check:colors, fix:adr-key-files, gen:adr-index, gen:adr-registry (+8 more)

### Community 85 - "TouchpointRefineForm.tsx"
Cohesion: 0.13
Nodes (19): combineDateAndTime(), DateOrStored, isCombinedInFuture(), localTimePart(), parseLocalDateTime(), toDate(), CHANNEL_OPTIONS, DIRECTION_OPTIONS (+11 more)

### Community 86 - "notification-read.test.ts"
Cohesion: 0.20
Nodes (12): BirthdayNotificationCandidate, DecayEligibleCandidate, listBirthdayNotificationCandidates(), listDecayEligibleCandidates(), localDateOffset(), OVERDUE(), ROGUE(), seedContact() (+4 more)

### Community 87 - "reconcile-photo.ts"
Cohesion: 0.20
Nodes (13): ActiveLink, Choice, ReconcileDetailScreen(), styles, ADR-0003, deleteReconcileStaging(), reconcileStagingRelPath(), resolveReconcileStagingUri() (+5 more)

### Community 88 - "restore-photo-finalize-sweep.ts"
Cohesion: 0.13
Nodes (30): isSafeColName(), assertSafeImportStagingRelative(), assertSafeReconcileStagingRelative(), assertSafeRelative(), assertSafeRestorePendingRelative(), persistCroppedMaster(), deletePhoto(), deleteRestorePending() (+22 more)

### Community 89 - "widget-linking.ts"
Cohesion: 0.20
Nodes (11): parseWidgetId(), resolveWidgetUri(), WidgetLinkingGate(), WidgetNavIntent, guardWidgetIntent(), archived, bound, Contact (+3 more)

### Community 90 - "saf-storage.ts"
Cohesion: 0.19
Nodes (10): ImportMatchOutcome, ImportSessionRow, ImportSessionRowDbRow, LinkExistingContactToRowInput, ResolveImportRowInput, hasUnresolvedRows(), UNRESOLVED_ROW_STATUSES, ImportRowAsNewParams (+2 more)

### Community 91 - "PhotoFieldWidget.tsx"
Cohesion: 0.17
Nodes (19): canonicalFor(), customFieldValueForTarget(), isPhotoWidgetEnabled(), PhotoFieldWidget(), styles, assertContactId(), contactPhotoRelPath(), customFieldPhotoRelPath() (+11 more)

### Community 92 - "resolvePhotoUri"
Cohesion: 0.25
Nodes (8): OrreryClockContext, useOrreryClock(), OrreryCanvas(), OrreryCanvasProps, seeded(), Star, SunBody(), SunBodyProps

### Community 93 - "notification-schedule.ts"
Cohesion: 0.20
Nodes (19): allowedSlotForDay(), clampHour(), clampStagger(), inQuietWindow(), nextAllowedFireInstant(), nextNudgeDate(), buildBirthdayRequest(), buildDecayRequest() (+11 more)

### Community 94 - "include"
Cohesion: 0.14
Nodes (13): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, ./src/*, **/*.ts, **/*.tsx, compilerOptions, forceConsistentCasingInFileNames (+5 more)

### Community 95 - "FrequencyPicker.tsx"
Cohesion: 0.09
Nodes (27): CustomIntervalResult, IntervalUnit, parseCustomInterval(), UNIT_FACTORS, FrequencyPickerProps, PRESET_VALUES, PRESETS, styles (+19 more)

### Community 96 - "contact-profile-logic.ts"
Cohesion: 0.14
Nodes (13): Architecture, Changelog, Configuration, Contacts, Data Model, Decisions, Gotchas, How It Works (+5 more)

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
Cohesion: 0.22
Nodes (11): ensureChannels(), setChannel, actionUid(), birthdayBody(), birthdayIdentifier(), decayBody(), decayIdentifier(), FOREGROUND_NOTIFICATION_BEHAVIOR (+3 more)

### Community 102 - "gen-adr-registry.ts"
Cohesion: 0.18
Nodes (10): ADR-0018, Adr, adrDir, adrs, field(), outPath, IMPORTANT: outranks NOTE: for a human skimming, and both are graphify, readAdrs() (+2 more)

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
Cohesion: 0.14
Nodes (13): Architecture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works, Key Files (+5 more)

### Community 108 - "ConsumedBackupShare"
Cohesion: 0.25
Nodes (3): ConsumedBackupShare, OrbitBackupDocumentPickerModule, OrbitBackupDocumentPickerModule

### Community 109 - "contact-picker-chunk.test.ts"
Cohesion: 0.14
Nodes (13): Architecture, Changelog, Configuration, Data Model, Decisions, Gotchas, How It Works, Key Files (+5 more)

### Community 110 - "dashboard-read.test.ts"
Cohesion: 0.29
Nodes (9): addFuelRow(), DECAY(), localDateOffset(), ROGUE(), seedContact(), SeedOpts, STABLE(), uid() (+1 more)

### Community 111 - "field-sweep.test.ts"
Cohesion: 0.25
Nodes (5): defId(), newDef(), quarantineDaysAgo(), seedContact(), uid()

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
Cohesion: 0.39
Nodes (10): seedContact(), seedCustomValues(), seedDef(), seedEvent(), seedFuel(), seedFullContact(), seedHistory(), seedInteraction() (+2 more)

### Community 118 - "birthday-logic.ts"
Cohesion: 0.20
Nodes (17): markRowPhotoFailed(), setRowContactCore(), setRowMatchOutcome(), setRowMatchOutcomeCore(), importContactRecord(), insertExternalContactLinkCore(), insertMethodProvenanceCore(), linkExistingContactToRow() (+9 more)

### Community 119 - "buildDecayRequest"
Cohesion: 0.43
Nodes (5): hasSharedBackup(), BACKUP_SHARE_MIME_TYPES, isBackupShareIntent(), navigationRef, ShareIntentGate()

### Community 120 - "audit-scalar-method-refs.mjs"
Cohesion: 0.25
Nodes (7): findings, OWNERS, ROOT, scalarReferences(), SOURCE_ROOT, stripComments(), unowned

### Community 121 - "normalize-graph-docrefs.ts"
Cohesion: 0.22
Nodes (8): abs, canonical, Graph, GraphLink, GraphNode, links, remap, seen

### Community 123 - "006-normalize-custom-field-values.test.ts"
Cohesion: 0.33
Nodes (6): addContact(), addDefinition(), addLegacyRow(), legacyMigrations, migrate(), uid()

### Community 124 - "011-contact-lifecycle-schema.test.ts"
Cohesion: 0.25
Nodes (5): DIRECT_CONTACT_CHILDREN, newUid(), seedV10Fixture(), TableInfo, V10

### Community 125 - "ContactMethodsEditor.tsx"
Cohesion: 0.23
Nodes (12): BulkReviewDbRow, BulkReviewFlag, listBulkReviewFlags(), sourceBirthday(), CreateContactFullInput, ImportContactRecordInput, isBirthdayUnreadable(), localDateTime() (+4 more)

### Community 126 - "fail"
Cohesion: 0.46
Nodes (8): assertTextValue(), fail(), FIXED_LEGACY_COLUMNS, loadAndValidateDefs(), proveCopy(), quoteSafeColumn(), readLegacyRows(), snapshotOrphanColumn()

### Community 127 - "notification-actions.test.ts"
Cohesion: 0.29
Nodes (11): ReconcileCardStatus, ReconcileSessionStatus, getReconcileSessionById(), getResumableReconcileSession(), listReconcileSessionCards(), mapCard(), mapReconcileSession(), ReconcileCardDbRow (+3 more)

### Community 128 - "adr-registry.ts"
Cohesion: 0.08
Nodes (24): ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011 (+16 more)

### Community 129 - "3. Data layer"
Cohesion: 0.29
Nodes (7): 3. Data layer, [DECIDED] Local-first. On-device SQLite. No cloud backend., [DECIDED] Migration path stays open, [DECIDED] Offline reads must always work, [DECIDED] Supabase is explicitly rejected for this app, On-device SQLite operating model — read this before touching schema, [OPEN] Backup and export

### Community 130 - "expo-task-manager.ts"
Cohesion: 0.29
Nodes (3): defineTask, isTaskDefined, TaskExecutor

### Community 131 - "ai-context-read.test.ts"
Cohesion: 0.48
Nodes (5): addMethodPiiFixture(), makeContact(), makeDef(), makeNeverAssignedUnboundContact(), uid()

### Community 132 - "formatLocalDate"
Cohesion: 0.27
Nodes (9): applyLifecycleTransitionEffects(), bindWithLifecycleEffects(), defaultDeps, EffectDeps, EffectDepsOverride, LifecycleDeps, LifecycleDirection, exec (+1 more)

### Community 133 - "crop-geometry.ts"
Cohesion: 0.16
Nodes (15): PhotoSourcePickerProps, setContactPhoto(), ProfileRecord, setProfilePhoto(), CropGeom, CropPhotoScreen(), styles, clamp() (+7 more)

### Community 135 - "7. Visual design"
Cohesion: 0.33
Nodes (6): 7. Visual design, [DECIDED] Space theme throughout, [DECIDED] Theme tokens, [DECIDED] Two distinct screens — do not merge them, Rendering, The orrery — settled mechanics

### Community 136 - "favourites-dao.test.ts"
Cohesion: 0.36
Nodes (7): BackupEncryptionBenchmarkHarness(), styles, BACKUP_ENCRYPTION_BENCHMARK_CANDIDATES, BackupEncryptionBenchmarkResult, measureBackupEncryptionCandidates(), median(), createBackupEnvelopeCrypto()

### Community 137 - "File"
Cohesion: 0.17
Nodes (7): HeadlessResponsePayload, DATA, freshHandler(), h, NotificationData, DesiredRequest, ScheduledEntry

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
Cohesion: 0.38
Nodes (7): daysInMonth(), daysUntilBirthday(), isLeapYear(), isValidStoredBirthday(), observedDayFor(), ParsedBirthday, parseStoredBirthday()

### Community 142 - "sun-picker-read.test.ts"
Cohesion: 0.48
Nodes (5): addLinkRow(), makeContact(), makeContactRow(), makeDef(), uid()

### Community 143 - "notification-nav.ts"
Cohesion: 0.28
Nodes (7): ContactCard(), ContactCardProps, statusLabel(), styles, RankedFuelLine(), RankedFuelLineProps, styles

### Community 144 - "Directory"
Cohesion: 0.31
Nodes (7): deleteJournalEntryCore(), insertJournalEntryCore(), listJournalEntriesCore(), RestorePhotoJournalAction, RestorePhotoJournalEntry, RestorePhotoJournalTargetKind, entry

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
Cohesion: 0.32
Nodes (4): editFull(), makeContact(), readInteraction(), uid()

### Community 152 - "13. Tooling"
Cohesion: 0.67
Nodes (3): 13. Tooling, [DECIDED] GSD and Graphify from the start, [DECIDED] The Roadmap Workshop is not used

### Community 189 - "ADR Index"
Cohesion: 0.40
Nodes (4): ADR Index, Do not machine-read this file, How to use this, Index

### Community 190 - "computeRingReorder"
Cohesion: 0.36
Nodes (6): recommendSurvivor(), scoreCandidate(), SurvivorContinuitySignal, SurvivorRecommendation, SurvivorRecommendationCandidate, candidate()

### Community 191 - "Migration006IntegrityError"
Cohesion: 0.15
Nodes (13): contact(), email(), phone(), uid(), seedArchivedFavourite(), seedContact(), seedThreeFavourites(), uid() (+5 more)

### Community 192 - "field-type-change.test.ts"
Cohesion: 0.38
Nodes (3): contact(), field(), uid()

### Community 195 - "SegmentedControl.tsx"
Cohesion: 0.40
Nodes (4): SegmentedControl(), SegmentedControlOption, SegmentedControlProps, styles

### Community 197 - "ReconciliationRow"
Cohesion: 0.50
Nodes (4): ReconcileEntityInput, ReconciliationAction, ReconciliationRow, ReconciliationTombstone

### Community 198 - "makeDef"
Cohesion: 0.67
Nodes (3): contact(), makeDef(), uid()

## Knowledge Gaps
- **921 isolated node(s):** `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance`, `AndroidNotificationVisibility`, `scheduled` (+916 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlExecutor` connect `types.ts` to `database.ts`, `field-types.ts`, `ai-context-read.test.ts`, `001-initial.ts`, `inWriteTransaction`, `import-session-dao.ts`, `import-session-read.ts`, `crop-geometry.ts`, `HomeScreen.tsx`, `formatLocalDate`, `File`, `App.tsx`, `backup-service.ts`, `sun-picker-read.test.ts`, `restore-apply.ts`, `reconcile-apply.ts`, `Directory`, `reconcile-session-dao.ts`, `defsForCreateForm`, `contact-status-read.ts`, `field-ddl.ts`, `contacts-dao.ts`, `SettingsScreen.tsx`, `app-settings-dao.ts`, `backup-schema.ts`, `impact.ts`, `photo-storage.ts`, `notification-schedule.test.ts`, `newUid`, `phase-17-runtime-integration.test.ts`, `FuelEditor.tsx`, `ai-context-read.ts`, `DigestScreen.tsx`, `ComposeScreen.tsx`, `ContactProfileScreen.tsx`, `contact-import-resume-sweep.ts`, `Avatar.tsx`, `assist-store.ts`, `lifecycle-consumer-ledger.test.ts`, `CaptureScreen.tsx`, `reconcile-resume-sweep.ts`, `Migration006IntegrityError`, `transaction.ts`, `006-normalize-custom-field-values.ts`, `field-type-change.test.ts`, `SqlExecutor`, `recency-dao.ts`, `CreateContactScreen.tsx`, `ImportReviewScreen.tsx`, `types.ts`, `queries.test.ts`, `bulk-review-dao.test.ts`, `fuel-read.test.ts`, `SurvivorSelectScreen.tsx`, `notification-read.test.ts`, `restore-photo-finalize-sweep.ts`, `PhotoFieldWidget.tsx`, `notification-schedule.ts`, `contacts-dao.test.ts`, `dashboard-read.test.ts`, `field-sweep.test.ts`, `seedFullContact`, `birthday-logic.ts`, `006-normalize-custom-field-values.test.ts`, `011-contact-lifecycle-schema.test.ts`, `ContactMethodsEditor.tsx`, `notification-actions.test.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `useTheme()` connect `ReconcileGridScreen.tsx` to `field-types.ts`, `crop-geometry.ts`, `inWriteTransaction`, `favourites-dao.test.ts`, `HomeScreen.tsx`, `getExecutor`, `App.tsx`, `notification-nav.ts`, `EditContactScreen.tsx`, `MergeConflictsScreen.tsx`, `OrreryScreen.tsx`, `SettingsScreen.tsx`, `localDateTime`, `PhotoSourcePicker.tsx`, `impact.ts`, `photo-storage.ts`, `BackupScreen.tsx`, `index.ts`, `useTheme`, `FuelEditor.tsx`, `ai-context-read.ts`, `DigestScreen.tsx`, `ComposeScreen.tsx`, `RestorePreviewScreen.tsx`, `ContactProfileScreen.tsx`, `Avatar.tsx`, `assist-store.ts`, `CaptureScreen.tsx`, `reconcile-resume-sweep.ts`, `SegmentedControl.tsx`, `CreateContactScreen.tsx`, `LegacyContactPickerScreen.tsx`, `BackupSettingsScreen.tsx`, `SurvivorSelectScreen.tsx`, `TouchpointRefineForm.tsx`, `reconcile-photo.ts`, `PhotoFieldWidget.tsx`, `FrequencyPicker.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `BackupScreen()` connect `BackupScreen.tsx` to `CreateContactScreen.tsx`, `inWriteTransaction`, `audit-adr-key-files.ts`, `getExecutor`, `favourites-dao.test.ts`, `BackupSettingsScreen.tsx`, `ReconcileGridScreen.tsx`, `RestorePreviewScreen.tsx`, `restore-photo-finalize-sweep.ts`, `computeRingReorder`, `localDateTime`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `styles`, `SchedulableTriggerInputTypes`, `AndroidImportance` to the rest of the system?**
  _921 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08625525946704067 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05910364145658263 - nodes in this community are weakly interconnected._
- **Should `field-types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06189640035118525 - nodes in this community are weakly interconnected._