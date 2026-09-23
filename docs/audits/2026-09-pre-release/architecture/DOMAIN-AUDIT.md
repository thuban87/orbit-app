# Architecture, Maintainability, and Technical Debt Audit

## Audit Metadata

- **Date:** 2026-09-22
- **Domain code:** ARCH
- **Mode:** Deep domain audit, with architectural archaeology
- **Repository:** `/home/bwales/projects/orbit-app`
- **HEAD:** `0e04c27e1d82bc3b5069bbf5adfc72281155df69` — `docs(kb): record phase 38.1 extraction`
- **Initial worktree:** No tracked modifications. Existing untracked campaign reports under `data-privacy/` and `security/` were present and left untouched.
- **Output:** `docs/audits/2026-09-pre-release/architecture/DOMAIN-AUDIT.md`
- **Mutation boundary:** This report is the only file written. No application, test, dependency, configuration, migration, generated graph, or pre-existing documentation changes; no commits or pushes.

## Executive Summary

Nine substantiated findings: **seven S2 Moderate and two S3 Minor**, all OPEN. No S0 or S1 finding was established in this domain.

The principal debt is incomplete adoption of newer contracts across existing entry points. The repository has meaningful canonical boundaries—transaction-composable DAO cores, normalized values, shared recency calculation, shared Quick Log and native handoff commands—but some behavior lives above those boundaries in one particular caller. Later features reuse a lower-level writer without inheriting history or publication semantics. Conversely, several older consumers still read or route through a superseded model after its replacement shipped.

The concrete consequences include missing retained values and lifecycle events, contradictory AI enablement controls, stale Profile and assist projections, restored appearance settings that do not reach the live theme, and maintenance failures propagating into unrelated features. These are demonstrated behavioral consequences of ownership gaps, rather than objections to file size or the number of modules.

Two data-path discrepancies were reproduced against an in-memory SQLite database using the current application migration chain and real DAO implementations. A separate executable probe established launch-hook failure propagation. UI findings are supported by traced current wiring, not by a claimed device reproduction.

## Scope

Included:

- Persistence/transaction ownership; contact metadata, lifecycle, custom-value/history, merge/purge and restoration boundaries.
- UI versus domain ownership, Zustand/store hydration, Profile/history composition, Dashboard and Orrery state separation, shell lifecycle.
- AI configuration migration, permission-editor consumers, Compose and interaction-assist publication, widget refresh, shared capture/handoff commands.
- Multiple implementation generations, superseded consumers, retained compatibility, and explicit deferrals.

Excluded:

- Implementing fixes, choosing product priorities, changing security posture, or designing a remediation phase sequence.
- A comprehensive security/privacy audit, exhaustive backup reconciliation correctness proof, exhaustive migration-by-migration certification, and native performance claims.
- Vendor/generated source as authored architecture; dormant code or large files without a concrete adverse consequence.

## Repository Context Reviewed

Orbit is an Android-first React Native/Expo application with local SQLite, Zustand, native-stack/tab navigation, optional explicitly configured AI, and native widget/notification entry points. Foreground boot gates navigation on migration and theme hydration; headless entry points intentionally avoid foreground maintenance.

Interpretation used `HANDOFF.md`, repository instructions, current system documentation, ADR bodies and dossier decisions. Material authorities included:

- ADR-001/009/010/014/015/016: normalized raw-text custom values, forward-only migration, recency ownership, transactional edits and retention.
- ADR-045/062/070/071/072: event-push widgets, Bound/Unbound lifecycle, durable user-attested assists, shared native handoff.
- ADR-083/090/092/104/110/111: durable theme, retained custom-value history, Dashboard state, Orrery state, coherent Profile reads and relationship actions.
- ADR-118/119/120/123/133/135: lifecycle events, canonical history, shared history windows, Profile integration, Compose sessions, multi-connection AI.
- System docs for persistence, custom fields, contact knowledge, contacts, reconciliation, backup/restore, app shell, Profile, history, AI, capture, notifications, digest and widgets.
- Milestone-2 dossiers for theme, contact knowledge, Profile, Interaction History & Insights, rapid capture, Compose and AI; relevant Phase 25/32/36 artifacts and recorded deferrals.

The phase-to-dossier map was used as a locator, not assumed current in every statement: its milestone-2 section still says phase directories do not exist. Current code and later phase artifacts were checked directly. Similarly, historical ADR implementation notes about future backup formats or placeholder routes were not treated as proof those deferrals still apply.

## Methodology and Coverage

Four complementary tracks covered persistence/data ownership; UI/state/history; AI/Compose/background consumers; and root-level lifecycle/restore integration. Investigators read actual subsystem source rather than diffs. Candidate evidence was adjudicated against current source and decisions; the orchestrator independently opened the implicated paths, checked worktree/HEAD, and repeated the two SQLite reproductions.

Graphify was used read-only as the discovery entry point. Sanctioned `npm run graph:ask -- governs ...` queries covered bootstrap, lifecycle, database/contact/value writers, restore, theme, Profile, Dashboard, Orrery preferences, Compose, Quick Log, AI connections and Digest. Direct read-only graph traversal enumerated incoming/outgoing module relationships for launch sweeps, shell refresh and app settings. The graph has 16,136 nodes and 32,536 edges; its report identifies build source `3524dac4`. The later HEAD changes are KB/registry/graph artifacts, not application-source changes. No graph rebuild was performed.

Graph **EXTRACTED** citations and **INFERRED** ADR Key-files relationships were kept distinct. For example, restore directly cites ADR-010/056; its other governance links are document-derived claims. Theme-store governance is INFERRED. Supersession warnings directed reading to later decisions, including ADR-083 and the later lifecycle/backup decisions. Neither absent edges nor graph communities were treated as proof of boundaries. SQL writer discovery used manual searches because Graphify cannot see TypeScript-to-SQL relationships.

| Track | Substantial inspection | Limits |
|---|---|---|
| Persistence | Shared transaction/mutex/bootstrap; contact aggregate and lifecycle; custom-value/history writers; merge/purge and relevant reconciliation writers; restore application | Not every migration or import/reconciliation service was exhaustively audited |
| UI/state | Full implicated Profile/history/editor files; relevant store/renderer ownership; Dashboard query/control and Orrery preference/session seams | Orrery review covered architecture/lifecycle, not physical-device rendering performance |
| Services | Full implicated Compose/Memory/AI consumers; assist DAO/store; widget publication; Quick Log, capture, native handoff, prompt resolution | No provider calls, device interaction or native-delivery validation |
| Cross-cutting | App bootstrap, complete sweep registry and registrations; restore-to-theme publication; current settings reader/writer | Other restore-sensitive caches remain a targeted follow-up, not assumed defective |

Verification performed without writing test files:

1. An stdin-only Node/tsx probe used `src/db/__testkit__/node-sqlite.ts`, current `MIGRATIONS`/`TARGET_VERSION`, and real contact/value/lifecycle DAOs. Only the native `expo-sqlite` import was stubbed; SQL executed in memory. It reproduced AUD-ARCH-001 and 002.
2. An stdin-only Node/tsx probe registered a rejecting sweep hook followed by an independent hook. Only the first ran; `runLaunchSweep()` rejected, reproducing AUD-ARCH-007's failure boundary.
3. Existing relevant tests were read for counterevidence and coverage. No full test-suite, build, device, or network run was performed. No test pass count is claimed.

## Findings Summary

**By severity:** S0: 0 · S1: 0 · S2: 7 · S3: 2 · S4: 0 admitted findings.  
**By disposition:** OPEN: 9 · INVESTIGATE: 0 primary findings. Accepted/deferred/rejected candidates appear separately below.  
**By confidence:** C3: 9. Confirmation refers to repository behavior/control flow; native visual acceptance is still required where specified.

| ID | Severity | Scope | Finding |
|---|---|---|---|
| AUD-ARCH-001 | S2 | Multi-area | Rapid custom-field edits bypass retained-value history |
| AUD-ARCH-002 | S2 | Multi-area | Complete contact edits bypass Bind/Unbind event recording |
| AUD-ARCH-003 | S2 | Multi-area | Active Memory editors still derive AI enablement from the retired provider setting |
| AUD-ARCH-004 | S2 | Multi-area | Inline history deletion refreshes only one of two Profile projections |
| AUD-ARCH-005 | S2 | Cross-cutting | Restored appearance settings never publish into the live theme store |
| AUD-ARCH-006 | S2 | Multi-area | Compose assist confirmation omits shared queue/widget publication |
| AUD-ARCH-007 | S2 | Cross-cutting | Launch maintenance relies on inconsistent per-hook failure containment |
| AUD-ARCH-008 | S3 | Local | Profile interaction-history actions still route to contact knowledge |
| AUD-ARCH-009 | S3 | Local | Selector Retry duplicates submission but omits successful settlement |

## Findings

### AUD-ARCH-001 — Rapid custom-field edits bypass retained-value history

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** ARCH, DATA, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The rapid Update Contact editor uses a history-free current-value writer, while complete Edit Contact implements the newer retained-history policy. The same edit has different durable semantics depending on its entry point.

#### Expected Behavior / Invariant

ADR-090 establishes optional retained raw-value history: a real changed-value edit must retain its previous value atomically. The contact-knowledge dossier §O distinguishes current-only and history-retained definitions. Rapid-capture presentation should preserve the definition's semantics.

#### Observed Behavior

History retention is composed only in `updateContactFull`. The later standalone editor calls `upsertValue`, whose implementation explicitly assumes production edits pass through the aggregate.

#### Evidence

- `src/screens/UpdateContactScreen.tsx:676–747`, `CustomFieldFocusedEditor`: reads the existing value, then saves through `upsertValue` at line 720.
- `src/db/field-values-dao.ts:45–60`: the public wrapper overwrites the pair and bumps revision, with no history append. Its line-54 comment explains the aggregate-only assumption.
- `src/db/contacts-dao.ts:722–743`: complete edit checks scope, calls `maybeAppendPriorValueHistoryCore`, then upserts in the same transaction.
- `src/db/value-history-dao.ts:36–68`: retains a changed previous non-null value when `history_retained=1`.
- `src/backup/backup-schema.ts:546–547` accepts the retention flag; `src/backup/restore-apply.ts`, `upsertParents`, persists it.
- Real-DAO reproduction: seed `old` → rapid writer saves `rapid new` → current value is `rapid new`, history is `[]`. A subsequent aggregate edit to `full new` produces history `['rapid new']`. The original `old` was not retained.

#### Impact

An opted-in prior value is irretrievably absent from the retained timeline. New editor authors must know an undocumented semantic difference between two plausible public value-writing entry points.

#### Trigger / Preconditions

An existing definition has `history_retained=1`, a non-null value, and the rapid editor changes or clears it. Normal field-creation UI currently defaults retention to zero; this is **not** a claim that all ordinary fields are affected. Supported restored/directly-present retained definitions exercise the defect.

#### Remediation Direction

Make every user edit enforce one atomic retained-value policy while preserving distinct creation, seeding and restore semantics.

#### Verification

Exercise both actual editor write paths with retained/current-only definitions: first set, unchanged value, changed value, clear, rollback and stable current-value UID. Changed/cleared retained values must produce the same history on either path.

#### Related Findings

AUD-ARCH-002: domain semantics were added to only one generation of writer.

#### Planning Notes

Preserve normalized pair identity and raw TEXT. Do not blanket-add history to import/seeding/restore primitives or nest the non-reentrant write transaction. Contact-scoped creation remains a separate deferred capability.

### AUD-ARCH-002 — Complete contact edits bypass Bind/Unbind event recording

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** ARCH, DATA, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Phase 32 added immutable lifecycle history to dedicated Bind/Unbind commands, but complete Edit Contact still changes the same lifecycle through the older metadata writer without recording the event.

#### Expected Behavior / Invariant

ADR-118 requires Bind/Unbind moments to appear as immutable history, atomically with their state transition. Its rejected alternatives explicitly prohibit post-commit event recording that can omit a committed transition.

#### Observed Behavior

The complete editor detects the lifecycle change, persists through `updateContactFull`, and publishes notification/widget effects afterward. Neither the aggregate nor those effects records a lifecycle event.

#### Evidence

- `src/screens/EditContactScreen.tsx:943–970`: calculates `lifecycleDirection` and saves through `updateContactFull`; the live Bound/Unbound controls are at `1391–1443`.
- `src/db/contacts-dao.ts:492–514`: `updateContactMetadataCore` writes `tracking_enabled`. `updateContactFull` reads stored state and calls that core at `684–719`, but records no Bind/Unbind event before its revision bump.
- `src/screens/EditContactScreen.tsx:994` calls `applyLifecycleTransitionEffects`; `src/services/contact-lifecycle-effects.ts`, that function, only reconciles notifications and widgets.
- `src/db/contact-lifecycle-dao.ts:65–95` and `108–134`: dedicated commands insert `bind`/`unbind` events inside the transaction.
- Real-DAO reproduction: `updateContactFull(... trackingEnabled:false)` leaves `tracking_enabled=0` with `events=[]`; subsequent dedicated `bindContact` produces `events=['bind']`.

#### Impact

The immutable history omits a real user transition, so later history surfaces cannot explain it. Behavior depends on whether the user chose Profile's dedicated action or the complete editor.

#### Trigger / Preconditions

Change an existing contact between Bound and Unbound in complete Edit Contact and save successfully.

#### Remediation Direction

All explicit user lifecycle transitions must atomically produce exactly one immutable event, regardless of editor, without inventing events for unchanged state.

#### Verification

Compare complete-edit and dedicated-command bind/unbind flows. Verify one event with the transition time, preserved dormant cadence, rollback of event plus state together, and no event for an unchanged save.

#### Related Findings

AUD-ARCH-001.

#### Planning Notes

The metadata core also serves reconciliation, bulk review and merge. Those have different semantics; do not indiscriminately emit lifecycle events for imported/reconciled metadata. Preserve one outer transaction and post-commit external effects.

### AUD-ARCH-003 — Active Memory editors still derive AI enablement from the retired provider setting

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** ARCH, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Four active editor paths still use `aiProvider !== 'none'` as the AI master setting after the application moved to `ai_enabled` and an active connection.

#### Expected Behavior / Invariant

ADR-135 establishes a separate global master switch and multi-connection configuration. Permission controls must reflect that master contract, keeping per-item consent distinct from connection readiness and generation authorization.

#### Observed Behavior

Canonical Settings and Compose use the new configuration. Memory editor hosts derive a different boolean from the retained legacy provider field, which ordinary new configuration does not synchronize.

#### Evidence

- `src/db/migrations/004-ai-settings.ts:43` seeds legacy `ai_provider='none'`; migration 029 adds independent `ai_enabled`/`ai_active_connection` at `21–25`.
- `src/screens/SettingsAIScreen.tsx:117–129`, `onToggleAi`, writes `buildAiEnabledPatch`; `src/db/ai-connections-dao.ts:152–163` activates only `aiActiveConnection`.
- Legacy reads remain at `src/screens/MemoryScreen.tsx:82`, `src/screens/ThingsToRememberScreen.tsx:179`, `src/screens/EditContactScreen.tsx:586`, and `src/components/PostLogNoteEditor.tsx:89–91`.
- `ThingsToRememberScreen.tsx:171–172` explicitly calls this gate interim and says Phase 36 will replace it. Phase 36 has shipped, but the gate remains.
- `src/components/MemoryEditor.tsx:386–410` disables the existing Memory's “Allow AI to use this” switch using that boolean and displays “Turn on AI in Settings first.”
- `src/stores/ai-config-store.ts`, `hydrate`, and `src/screens/ComposeScreen.tsx`, generation preparation, use the new master/active-connection state instead.

#### Impact

On a fresh install, AI can be enabled and usable in Compose while Memory editors prohibit permission changes and falsely say it is off. Historical provider values can create the opposite presentation disagreement after the new master is disabled. The separate permissions manager is an alternate surface, but does not make these controls consistent.

#### Trigger / Preconditions

New AI setup with legacy `aiProvider='none'`, or a restored/historical non-none provider combined with a disabled new master; open an existing Memory through an affected editor.

#### Remediation Direction

Use the canonical global posture consistently in all active consumers. Keep legacy fields only where compatibility requires them; do not implicitly change per-item consent or substitute connection readiness for the master setting without preserving current product semantics.

#### Verification

Exercise each host with `(aiEnabled=1, aiProvider='none')` and `(aiEnabled=0, aiProvider='openai')`. Verify control consistency and unchanged generation/egress enforcement.

#### Related Findings

AUD-ARCH-008: a later replacement shipped while an earlier consumer contract remained active.

#### Planning Notes

This finding does not establish unauthorized egress. Retained legacy columns and retired acknowledgement fields are not themselves defects and must not be removed by editing shipped migrations.

### AUD-ARCH-004 — Inline history deletion refreshes only one of two Profile projections

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** ARCH, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

The newer History section owns its own query while its Intensity input and surrounding relationship facts belong to the parent Profile snapshot. Inline deletion refreshes only the child's query.

#### Expected Behavior / Invariant

ADR-110/111 require coherent, truthful Profile projections; ADR-120/123 integrate window-aligned history and Intensity. A committed interaction deletion must be reflected by all affected visible projections.

#### Observed Behavior

The heatmap/detail data updates after deletion, but parent Status, Gravity, Last Interaction and the history chart's parent-provided `impactInputs` remain stale until a separate parent refresh.

#### Evidence

- `src/screens/ContactProfileScreen.tsx:82–109`: owns the snapshot and refreshes on focus or shell refresh.
- `src/components/profile/ProfileModuleHost.tsx:386–392`: passes `snapshot.impactInputs` into `HistorySection`, with no mutation callback to invalidate that snapshot.
- `src/components/history/HistorySection.tsx:164–179`: owns another `readContactHistory` load. At `204–238`, counts use this local history while Intensity uses the parent prop.
- `src/components/history/InteractionDetail.tsx:123–131`: deletes through `deleteTouchpoint`, publishes widget refresh, then calls `onDeleted`.
- `HistorySection.tsx:405–408`: `onDeleted` closes the detail and invokes only its own `load()`.
- `src/db/recency-dao.ts:377–420` correctly recomputes durable recency. `src/db/data-revision-dao.ts` updates a SQLite revision, not a reactive Profile signal; widget publication does not bump `shell-refresh-store`.

#### Impact

One screen presents inconsistent versions of the same relationship history after a destructive operation. Adding further derived modules increases the number of independently stale consumers.

#### Trigger / Preconditions

Delete a qualifying interaction inline while Profile remains mounted. For a clear visible example, delete the newest of at least two interactions whose removal changes the displayed metrics.

#### Remediation Direction

Give successful inline interaction mutations a coherent invalidation/publication contract across both history and parent-derived facts.

#### Verification

Mounted integration/device verification must show changed heatmap/counts, Last Interaction, Status/Gravity and applicable Intensity without navigating away. A failed delete must preserve all projections. Checking only the DAO or child callback is insufficient.

#### Related Findings

AUD-ARCH-005 and 006 share missing post-commit publication, but have separate owners and triggers.

#### Planning Notes

Preserve the canonical recency writer and the intentional History renderer seam. No additional stored score or connection-level SQLite observer is implied by this finding.

### AUD-ARCH-005 — Restored appearance settings never publish into the live theme store

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** ARCH, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Backup restoration can replace durable appearance preferences while the app and Appearance controls keep rendering the previous in-memory theme selection. The boot-only hydration architecture was not extended to the later portable restore path.

#### Expected Behavior / Invariant

ADR-083 makes SQLite the durable theme source; the theme dossier §D requires live appearance. Successful restoration should reconcile the live projection with the committed settings. No restart-only activation contract was found.

#### Observed Behavior

Restore applies settings and updates native schedules, then the screen resets its navigation stack. Neither operation hydrates the theme store. The root provider remains mounted, and reopening Appearance does not reload its theme selection from SQLite.

#### Evidence

- `src/db/app-settings-dao.ts`, `getPortableSettingsSnapshot` (starts at 882), includes package/mode/accent/background preferences; `src/backup/restore-apply.ts:1582–1600` applies the winning settings transactionally.
- `restore-apply.ts:1601–1678` finalizes photos and reconciles notification/digest scheduling, with no theme-store publication.
- `src/screens/RestorePreviewScreen.tsx:123–145` handles success by discarding preview state and resetting the host stack. `RestoreResultScreen` only renders counts and return navigation.
- `App.tsx:200` hydrates `useThemeStore` during initial bootstrap. Its boot effect is not rerun by the child navigation reset.
- `src/stores/theme-store.ts:39–65` contains in-memory setters only. `src/theme/theme-provider.tsx:39–68` derives the live theme exclusively from them; `BackgroundHost` likewise reads their background selections.
- `src/screens/SettingsAppearanceScreen.tsx:173–189` reads theme controls from that store. Its focus effect refreshes profile/orbit/template data, not theme selection. `settings-appearance-persist.ts` hydrates only after a failed appearance write, not after restore.

#### Impact

The UI and Appearance selections disagree with restored durable data across the application until a fresh bootstrap or another operation happens to reconcile the selection. A successful restore therefore has incomplete application-level semantics even though its SQL commits correctly.

#### Trigger / Preconditions

A successful replace-all restore, or a merge whose settings win, contains appearance values different from the currently hydrated selection.

#### Remediation Direction

Successful restore must publish committed theme state into its live owner. Define this post-commit responsibility explicitly rather than relying on route focus or incidental later writes.

#### Verification

Restore differing package, mode, accent and background values while the app is running. Confirm the provider, BackgroundHost and Appearance controls agree with SQLite without restarting. Failed/retained-settings restores must not publish uncommitted/incoming values.

#### Related Findings

AUD-ARCH-004 and 006.

#### Planning Notes

Respect the parked owner decision about merging theme package into mode; it is not a prerequisite for fixing hydration. This finding establishes the theme cache specifically, not that every store is stale after restore.

### AUD-ARCH-006 — Compose assist confirmation omits shared queue/widget publication

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** ARCH, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Compose's newer confirmation path reuses the assist DAO but omits the queue refresh and widget publication performed by the older confirmation surfaces.

#### Expected Behavior / Invariant

ADR-133 preserves the durable assist lifecycle. ADR-045 requires event-driven widget refresh after successful widget-visible mutations. Completed confirmation should no longer appear pending in the app-global projection.

#### Observed Behavior

Compose marks the assist logged, closes its panel and exits. The persistent interaction changes, while the app-global queue and placed widget can retain the previous state.

#### Evidence

- `src/screens/ComposeScreen.tsx:1067–1079`, `onConfirmYes`, calls `markAssistLogged`, then local `setConfirm(null)` and `performExit('logged')`.
- `src/components/AssistBanner.tsx:42–50` and `src/components/PendingConfirmationsSheet.tsx:42–50` call the same DAO followed by `notifyWidgetDataChanged()` and queue `refresh()`.
- `src/db/interaction-assist-dao.ts:74–145` owns the transaction, interaction, recency, revision and assist status, but no UI/widget publication.
- `src/stores/assist-store.ts:23–45` replaces its queue only on explicit refresh or the next background-to-active transition. `App.tsx:218–220` installs this lifecycle subscription, not a write subscription.
- `src/services/widget/widget-refresh.ts:74–85` has explicit mutation and foreground-sweep entry points. Ordinary navigation after confirmation invokes neither.

#### Impact

A logged assist can remain visible as a pending question, and the widget can retain old contact recency/status. Duplicate interaction insertion is guarded by the DAO's pending-state recheck; the demonstrated defect is stale projections, not double logging.

#### Trigger / Preconditions

Return from the native composer after the assist becomes eligible, let the queue/sweep read the pending state, then confirm through Compose. Widget impact requires a placed widget containing the affected contact.

#### Remediation Direction

Every successful confirmation entry should share a consistently owned post-commit publication contract. Publication failure must not undo or replay the committed interaction.

#### Verification

Preload an eligible assist in the store, confirm through Compose, and assert queue removal, widget publication after commit and exactly one interaction. Compare all three confirmation entry points and exercise publication failure.

#### Related Findings

AUD-ARCH-004 and 005.

#### Planning Notes

Preserve handoff-time logging and “Not yet” leaving the durable assist pending. Accepted idle/day-granular widget staleness does not cover omitted refresh after a real mutation. General confirm/dismiss exception handling is separately recorded backlog, not the subject of this finding.

### AUD-ARCH-007 — Launch maintenance relies on inconsistent per-hook failure containment

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** ARCH, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The original ordered sweep registry has accumulated independent feature responsibilities without a consistently enforced failure boundary. Some hooks catch their entire body; others allow ordinary failures to abort every later hook.

#### Expected Behavior / Invariant

The foreground-maintenance contract in `docs/systems/persistence-core.md`, “Running launch maintenance,” runs registered responsibilities after migration. Independent features should not silently depend on another feature's successful cleanup. Explicit recovery dependencies and failure reporting must remain visible.

#### Observed Behavior

`runLaunchSweep` awaits each hook without containment; its foreground trigger discards the rejecting promise. Field/history pruning, Memory scans, assist cleanup and backup operations have rejection paths outside a whole-hook catch, unlike newer guarded photo, notification and widget hooks.

#### Evidence

- `src/services/launch-sweep.ts:76–89`: one rejection exits the loop and clears both running and pending-rerun state. Lines `106` and `111` invoke it with `void`, without a rejection handler.
- `src/services/field-sweep.ts:98–103,126–132`: candidate read and history-prune transaction are outside the per-definition catch. A prune failure therefore escapes despite isolated expiry failures.
- `src/services/memory-trash-sweep.ts`, `registerMemoryTrashSweep`, and `interaction-assist-sweep.ts`, returned hook, likewise expose uncaught query/transaction failures.
- `App.tsx:225–306` registers these ahead of photo/backup recovery, notification/digest scheduling, widget refresh and import/reconciliation resume prompts.
- `src/services/widget/widget-refresh.ts:22–30` explicitly documents the same hazard and locally swallows all errors; `background-reconcile-sweep.ts`, `registerBackgroundReconcileSweep`, also has a whole-hook catch. Protection depends on each feature remembering this convention.
- Executable probe with a rejecting first hook and independent second hook returned `{"visited":["failing-maintenance"],"rejected":"injected local failure"}`. The second responsibility did not run.

#### Impact

A local maintenance failure can skip unrelated refresh/recovery/prompt work for that foreground launch and surface as an unhandled rejection. Persistent failure repeatedly starves later responsibilities; an overlapping pending rerun is also lost on rejection. This is not a claim that normal launches always fail.

#### Trigger / Preconditions

Any uncontained hook rejects, for example a failed field-history prune transaction. No hook timeout/hang reproduction is claimed.

#### Remediation Direction

Establish an explicit, consistently enforced failure policy for maintenance responsibilities and their genuine dependencies, with observable failure handling and preserved launch coalescing.

#### Verification

Inject failures into a real registered cleanup hook and verify unrelated responsibilities still receive the launch, failures are handled, and an overlapping foreground transition is not silently lost. Verify dependent backup/recovery work respects its prerequisites.

#### Related Findings

AUD-ARCH-006 relies on foreground publication as a repair path, but its missing mutation publication remains independently actionable.

#### Planning Notes

Do not parallelize or blindly continue every task: App explicitly orders background reconciliation before backup for restore safety. Preserve foreground-only execution, no timers/headless sweep, and non-reentrant transaction composition.

### AUD-ARCH-008 — Profile interaction-history actions still route to contact knowledge

**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** ARCH, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

The new History renderer was installed, but the older Profile callback used by Last Interaction and Status's “View history” still navigates to Things to Remember.

#### Expected Behavior / Invariant

ADR-123 and the Interaction History & Insights dossier establish the Profile-linked interaction-history experience. An action explicitly offering interaction history must reach that domain.

#### Observed Behavior

Both controls route to the contact-knowledge editor instead of the History section that now exists in the same Profile.

#### Evidence

- `src/screens/ContactProfileScreen.tsx:449–450`: `onOpenHistory` navigates to `ThingsToRemember`.
- `src/components/profile/RelationshipOverview.tsx:100`: Last Interaction uses that callback.
- `src/components/profile/ProfileRelationshipSheets.tsx:165–169`: Status's “View history” uses it too.
- `src/components/profile/ProfileModuleHost.tsx:267–270` forwards the callback, while `386–392` mounts the actual `HistorySection` independently.
- Full `src/screens/ThingsToRememberScreen.tsx` inspection shows knowledge reads/editing—Memories, current-state entries, relationships and custom fields—not an interaction-history destination.

#### Impact

Two named discovery paths take users into the wrong subsystem. Actual History remains accessible elsewhere in Profile, so this is a localized routing inconsistency rather than total loss of the feature.

#### Trigger / Preconditions

Tap Last Interaction or Status → View history on Profile.

#### Remediation Direction

Complete the historical callback migration so both actions reveal actual interaction history, preserving origin and existing layout/navigation contracts.

#### Verification

Exercise both actions from all Profile-hosting stacks and establish that the resulting visible content is interaction history. Mocking a callback without checking its destination does not verify resolution.

#### Related Findings

AUD-ARCH-004 concerns the same renderer integration but a separate refresh defect; AUD-ARCH-003 has similar unfinished consumer migration.

#### Planning Notes

The desired destination is established; this audit does not choose a new route versus scrolling/revealing the existing section. Do not repurpose the knowledge screen or reintroduce the retired vertical timeline.

### AUD-ARCH-009 — Selector Retry duplicates submission but omits successful settlement

**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** ARCH, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Profile relationship selectors have separate normal-submit and Retry orchestration. Retry marks both selectors pending, but unlike normal submission never clears pending on success.

#### Expected Behavior / Invariant

ADR-111 requires usable pending/failure/retry selectors with committed readback. A successful retry must return controls to a settled state.

#### Observed Behavior

The retry performs the saved operation and closes the sheet, leaving both frequency and snooze state pending. The component remains mounted, so reopening either selector disables its choices and rejects normal dismissal.

#### Evidence

- `src/components/profile/ProfileRelationshipSheets.tsx`, `saveFrequency` and `saveSnooze` (`95–130`), dispatch `success` after the operation.
- Its Retry handler at `292–308` dispatches `retry` to **both** state objects and calls the raw saved operation followed by `.then(onClose)`, without successful settlement.
- `src/profile/relationship-sheet-model.ts`, `relationshipSheetReducer`: `retry` sets `pending=true`; only success/failure/dismiss settle it.
- `ProfileRelationshipSheets.tsx:68–85`: snapshot synchronization spreads the old state, retaining pending; `close()` returns while either selector is pending.
- `src/components/profile/ProfileModuleHost.tsx` keeps `ProfileRelationshipSheets` mounted with `active={activeSheet}` even when that value becomes null.

#### Impact

After a recoverable write failure and successful retry, the visible save succeeds but the selector instance remains unusable until remount. This is a concrete consequence of duplicated state-machine orchestration.

#### Trigger / Preconditions

A frequency or snooze operation fails, then succeeds through Retry; reopen a selector on the same mounted Profile.

#### Remediation Direction

Normal submission and Retry must share complete settlement semantics, affecting only the operation they own.

#### Verification

Use a mounted failure → retry success → reopen sequence for both selectors. Verify pending clears, choices work and Close/Back succeeds. Also verify retry failure remains recoverable; reducer-only success tests do not cover the orchestration gap.

#### Related Findings

AUD-ARCH-004 and 008 share the Profile host, but neither is a prerequisite.

#### Planning Notes

Preserve immutable Snooze invocation events and pending-state double-submit protection; do not suppress legitimate repeated actions as a workaround.

## Cross-Finding Patterns

1. **Public primitive versus complete domain operation is ambiguous.** AUD-ARCH-001/002 show a newer invariant attached to one aggregate or dedicated writer while another public path remains callable with weaker semantics. The existing non-mutexed-core pattern is useful; policy ownership above those cores needs to be complete.
2. **A committed database mutation does not automatically publish application state.** AUD-ARCH-004/005/006 each have a correct durable write and an incomplete live projection. Focus refresh, app foregrounding, shell refresh, widget push and boot hydration are different mechanisms; invoking one does not imply the others.
3. **Historical seams survive their replacement phase.** AUD-ARCH-003/008 have active readers/callbacks from the prior design alongside their implemented successors. Explicit temporary comments helped locate the gap, but findings were admitted only after tracing current behavior.
4. **Independent orchestration duplicates lifecycle obligations.** AUD-ARCH-007/009 depend on each hook or retry path remembering the complete failure/success contract. Existing tests emphasize pure modules or individual writers and do not establish these cross-owner transitions.

These patterns do not imply a repository-wide rewrite, universal event bus, new backend, or replacement state library. The desired outcomes are bounded consistency at the demonstrated seams.

## Reviewed Areas With No Material Findings

- **Transaction composition:** The shared mutex plus one outer `inWriteTransaction` and non-mutexed cores is established and actively reused. Dedicated lifecycle and assist commands couple state/history/recency correctly within their own boundary.
- **Normalized custom values:** Current `(contact_id, field_def_id)` identity and raw TEXT survive updates. Runtime dynamic-column storage was not found competing with normalized storage; historical migration code is intentional.
- **Lifecycle fan-out:** Reviewed merge/purge code explicitly inventories portable children, reparents retained history and handles current-state/relationship collisions. This does not certify every restore conflict combination.
- **Shared commands:** Quick Log centrally owns commit-truthful feedback/Undo/publication. Native reach-out shares write-before-handoff semantics and does not infer message delivery.
- **AI generation:** Current generation resolves the selected connection, revalidates context permissions and retains a separate credential boundary. AUD-ARCH-003 is an editor-state mismatch, not evidence of a parallel unauthorized generation path.
- **Theme boot migration:** The legacy AsyncStorage import uses compare-before-write and cleanup tolerance; failed legacy-key deletion does not force revision churn on every matching boot. Restore publication is the distinct omission.
- **Dashboard/Orrery state separation:** Durable query/preferences and ephemeral selection/camera/session state have distinct documented responsibilities. Orrery preference writes serialize committed publication and track request generations; store count alone is not debt.
- **Capture boundary:** Capture fan-out uses an outer transaction over fuel cores and does not manufacture touchpoints.

## Accepted / Deferred / Rejected Candidates

| Candidate | Disposition | Reason / authority |
|---|---|---|
| Contact-scoped custom-field creation is still unavailable | DEFERRED | ADR-090 and current custom-field system docs explicitly gate it on durable ownership/lifecycle/UI; `createField` rejects contact scope. Phase numbers alone do not authorize activating it. |
| Two theme-package/mode axes should be collapsed | DEFERRED | `.planning/STATE.md` records the owner-selected change as parked work requiring its own phase; the current architecture is not a new defect. |
| Capture/sun/internal pickers retain favourite-rank reads | ACCEPTED | Phase `25-06-SUMMARY.md` and `25-VERIFICATION.md:88` explicitly preserve these internal reads. Broad ADR-075 wording was insufficient to classify them as accidental drift. |
| Legacy AI acknowledgement columns and no first-send acknowledgement | FALSE-POSITIVE | Forward-only compatibility and ADR-079 intentionally retain/retire these pieces. Reintroducing the removed control would reverse a decision. |
| Widget status can age between foreground launches | ACCEPTED | ADR-045 accepts day-granular idle staleness and rejects polling. AUD-ARCH-006 concerns a real mutation's omitted publication instead. |
| General assist confirm/dismiss exception handling | DEFERRED | `docs/systems/interaction-assist.md`, Gotcha 4, records backlog. The separate Compose publication finding is not that accepted backlog item. |
| Obsolete `dashboard-prefs-store.ts`, legacy status helpers and historical comments | FALSE-POSITIVE as primary defects | No runtime consumer/material consequence established for the old Dashboard store; query-time status is intentional. Mere existence, naming and stale prose do not warrant OPEN findings. |
| Profile History reads are separate from its old summary renderer | FALSE-POSITIVE as a blanket objection | ADR-123 intentionally keeps the renderer/layout seam. Only demonstrated refresh and routing inconsistencies are admitted. |
| Missing onboarding/release-hardening completion | DEFERRED | Current planning identifies remaining milestone work. This audit does not relabel unexecuted planned capabilities as architecture defects. |

## Coverage Limitations / Follow-up Investigation

- No physical-device UI acceptance was performed. The Profile refresh, navigation, retry, restored theme and assist/widget cases need the bounded runtime/device checks specified above.
- No full suite was run; existing tests cannot be described as passing based on this audit. The successful targeted in-memory reproductions establish only their named behaviors.
- Backup restore has a broad schema fan-out. Theme publication is confirmed, but every other cache, all reconciliation conflict families, concurrent restore behavior and photo-finalization interleavings were not exhaustively proven. A targeted later review can examine those boundaries without treating them as admitted findings now.
- Import/reconciliation service orchestration, all native modules/plugins and every historical migration received less depth than the principal writer/state tracks. No comprehensive clean bill is implied for those areas.
- No cross-domain synthesis or duplicate reconciliation against the existing security/data-privacy reports was performed. These IDs are independent domain findings for later campaign synthesis.
- Source and HEAD remained unchanged during investigation. Line references identify the audited revision; they are not durable identifiers after remediation.
