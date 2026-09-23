# Reliability, Error Handling, Edge Cases, and Testing Audit

## Audit Metadata

- **Date:** 2026-09-22.
- **Repository:** `/home/bwales/projects/orbit-app`.
- **HEAD:** `0e04c27e1d82bc3b5069bbf5adfc72281155df69`.
- **Domain code:** `REL`.
- **Mode:** Deep domain audit using the global `/home/bwales/.codex/skills/repo-audit/SKILL.md`.
- **Worktree at start:** Existing untracked `docs/audits/2026-09-pre-release/` campaign artifacts. No tracked modifications reported.
- **Authorized output:** This file only. No application, test, dependency, migration, configuration, or generated-graph changes; no fixes, added tests, commits, pushes, or worktrees.
- **Scope requested:** Important user workflows, asynchronous/failure/recovery paths, interruptions/repeated actions, and meaningful behavioral test coverage.

## Executive Summary

**14 OPEN findings: 2 S1 Major and 12 S2 Moderate.** The most consequential are Replace-all deleting incoming avatar files and Edit Contact replaying committed collection additions on subsequent saves.

The existing test suite passes: **411 files, 3,840 tests**. Its real-SQLite coverage is valuable, but passing component helpers and DAO tests does not establish the behavior of their screen/service composition. Confirmed gaps include post-commit recovery, repeated saves, photo ownership across restore and later edits, native notification readback, and pending/error presentation.

The Replace-all defect was independently reproduced through actual restore code with in-memory SQLite and a shared filesystem model. Most other findings are established by source-level execution/data flow; notification cold/warm delivery timing remains C2 pending runtime confirmation. These are audit findings for owner triage, not an implementation plan or a release certification.

## Scope

Included: startup/migration gating and launch maintenance; contact editing and knowledge collections; interaction/group mutation orchestration; backup/export/restore and photo recovery; import session/photo liveness; notifications, widget actions, Compose/AI cancellation and external handoff; Dashboard/Digest read lifecycles; relevant tests and test doubles.

Excluded: implementing fixes/tests; dependency upgrades; broad security/privacy, visual/accessibility, and performance audits; live provider requests; device mutation or native UAT; generated/vendor code as authored application code. Installed Expo source was read narrowly to verify the notification boundary.

## Repository Context Reviewed

- `HANDOFF.md` and the supplied repository instructions: local-first, no network on core reads, forward-only migrations, shared writer serialization, lossless custom values, and launch-only maintenance.
- Current app is React Native 0.86 / Expo 57, Zustand, expo-sqlite, Android-first; registered schema target is 30 and portable backup format is 7.
- Relevant current authority includes ADR-009/010 (migration/recency), ADR-017 (link identity), ADR-040/045 (external actions), ADR-057/058 (backup/recovery), ADR-065 (durable imports), ADR-125 (participant inheritance), ADR-131 (aggregate editing), ADR-133 (Compose), ADR-147/148 (Digest), and their system docs.
- Superseded dynamic-column custom-field storage was not treated as the current contract. Normalized values and later phase decisions govern.
- Current system documentation, notification dossier, and Phase 38 review/UI-SPEC were used to distinguish expected behavior and already-known issues. A previous review's finding was checked against current code, not assumed resolved or accepted.
- Graph queries used `npm run graph:ask -- governs <path>`. Relevant governing links were predominantly **INFERRED** from ADR Key-files declarations; Compose's ADR-107 citation was **EXTRACTED**. ADR bodies and source were checked directly. No graph rebuild was performed. A missing graph edge was not taken as absence of a governing decision.

## Methodology and Coverage

Four investigative tracks examined actual files and neighboring boundaries: durable backup/import/photo flows; notifications/widget/Compose asynchronous work; contact/group mutations; and startup/read-state/test orchestration. Candidate findings were adjudicated against the current working tree. Shared-table invariants were checked through the relevant writers, not inferred from Graphify (which cannot enumerate SQL writers). No diff-only review was used.

| Track | Strongest coverage | Important boundary/limit |
|---|---|---|
| Durable flows | Full restore/export, merge writer, import session/driver/photo flow, photo storage/recovery, result adapters | Native filesystem/SAF behavior not executed; reconciliation screens less deeply covered |
| User mutations | Complete contact-edit coordinator and aggregate/link boundaries; group edit/participant payloads and DAO contracts | Archive/trash and custom-field management UI received narrower inspection |
| External asynchronous work | Notification scheduler/native readback, routing/action dedup, widget actions; AI cancellation and Compose handoff | No device notification delivery or real provider calls |
| App/read state | Bootstrap, sweep hooks/order, Home read cancellation, Digest/Your Week and shell refresh | No React Native mount/device test or exhaustive Orrery render audit |

Checks performed:

- `npm test -- --reporter=dot`: **411/411 test files, 3,840/3,840 tests passed**, 55.91 seconds. No test failure was used as an audit shortcut. Node emitted SQLite experimental warnings and Vite emitted a future config-loader warning.
- Read-only inline diagnostics executed the actual launch-sweep runner, actual notification date functions, and actual current migration/export/restore code with synthetic in-memory data. No persistent diagnostic/test files were created.
- Inspected `vitest.config.ts`, the node:sqlite adapter, migration-chain tests, behavior tests, source-string assertions, and native test doubles. Node SQL proves substantial persistence behavior but does not reproduce native bridge scheduling, filesystem failures, or React effect ordering.
- Evidence references below refer to the audited HEAD/working tree. Existing neighboring campaign reports were left untouched; cross-domain deduplication belongs to synthesis.

## Findings Summary

| Severity | OPEN | INVESTIGATE | Total |
|---|---:|---:|---:|
| S0 Critical | 0 | 0 | 0 |
| S1 Major | 2 | 0 | 2 |
| S2 Moderate | 12 | 0 | 12 |
| S3 Minor | 0 | 0 | 0 |
| S4 Advisory | 0 | 0 | 0 |
| **Total** | **14** | **0** | **14** |

13 findings are C3 Confirmed; one is C2 Strong. Testing gaps are tied to concrete risk within the findings rather than counting every untested function as another issue.

| ID | Severity | Confidence | Finding |
|---|---|---|---|
| AUD-REL-001 | S1 | C3 | Replace-all photo cleanup deletes newly restored canonical files |
| AUD-REL-002 | S1 | C3 | Edit Contact retries replay collections that already committed |
| AUD-REL-003 | S2 | C3 | Restore-photo recovery can overwrite a newer successful avatar edit |
| AUD-REL-004 | S2 | C3 | Imported-photo failures lose their retry input at the next sweep |
| AUD-REL-005 | S2 | C3 | Restore completion hides outstanding photo and schedule recovery |
| AUD-REL-006 | S2 | C3 | Editing an existing participant override silently drops the new value |
| AUD-REL-007 | S2 | C3 | Participant actions erase unsaved group-event drafts |
| AUD-REL-008 | S2 | C3 | Participant-add refresh failures cause retries of an already committed write |
| AUD-REL-009 | S2 | C3 | One launch-hook rejection skips unrelated recovery and maintenance |
| AUD-REL-010 | S2 | C3 | Notification tests model the wrong Android DATE-trigger readback |
| AUD-REL-011 | S2 | C3 | After-slot reconciliation adds a next-day reminder to the weekly cadence |
| AUD-REL-012 | S2 | C2 | Cold notification routing can overwrite a newer warm-tap destination |
| AUD-REL-013 | S2 | C3 | Digest ignores successful Quick Log and Undo while it remains focused |
| AUD-REL-014 | S2 | C3 | Digest day-detail read failures are presented as “No activity” |

## Findings

### AUD-REL-001 — Replace-all photo cleanup deletes newly restored canonical files

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Replace-all treats old photo filenames as garbage even when the replacement graph reuses those same filenames.

#### Expected Behavior / Invariant

ADR-057 requires complete photo round trips; ADR-058 requires recoverable committed photo finalization. Cleanup must not delete files owned by the restored state.

#### Observed Behavior

Replacement contacts receive reusable local IDs. Restore first writes incoming image bytes to ID-derived canonical paths, removes their staging source, and then deletes the old canonical paths. A second branch queues the same delete twice and fails the journal UNIQUE constraint.

#### Evidence

`src/backup/restore-apply.ts:1145–1179` collects all old contact/custom-photo paths; `replaceAllReset` deletes contacts at `:1270–1283`; `upsertContacts` at `:647–673` inserts without preserving local IDs. Contact schemas in migrations 001/009/011 use `INTEGER PRIMARY KEY`, without AUTOINCREMENT. `src/services/photos/photo-storage.ts:87` derives `avatars/contact-<id>.jpg`. Finalization at `restore-apply.ts:1606–1623` precedes deletion at `:1641–1649`. For same-UID incoming `photoBase64:null`, `stageCandidates(:1084–1095)` and reset both queue the old path; `:1572–1584` inserts identical `delete:<path>` keys into the UNIQUE journal defined in migration 008. An independently repeated read-only diagnostic executed the current migration chain, `buildExportManifest`, and `applyRestore` against in-memory SQLite and a shared byte Map: output was `persist avatars/contact-1.jpg` then `delete avatars/contact-1.jpg`; result was `status:applied`, both photo counters zero, SQLite still referenced that path, and the byte Map was empty.

#### Impact

A populated-to-populated replacement can report success while leaving restored contacts pointing at missing images, with no pending source left to recover. The duplicate-intent branch instead rejects an otherwise valid restore before commit.

#### Trigger / Preconditions

Destination contact 1 has an avatar; replacement creates contact 1 with an avatar. Contact UID equality is unnecessary. The duplicate-intent branch requires an existing same-UID photo and incoming explicit photo removal.

#### Remediation Direction

Determine cleanup against the final graph's file ownership and make duplicate cleanup intents harmless, including after interruption.

#### Verification

Use real SQLite and a shared filesystem byte model: populate both source and destination with avatars, Replace-all, then assert referenced bytes exist and equal incoming bytes. Cover reordered contacts, photo removal, custom photos, and interrupted cleanup. Existing `restore-apply.test.ts` replacement coverage around line 1564 omits avatars; photo finalization coverage around line 1684 uses Merge.

#### Related Findings

AUD-REL-003, AUD-REL-005

#### Planning Notes

Preserve the explicit destructive confirmation and verified pre-restore snapshot policy. Fixes must cover immediate cleanup and journal replay; changing only loop order does not establish ownership.

### AUD-REL-002 — Edit Contact retries replay collections that already committed

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, BUG, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

A successful contact save that stays on the form can leave the original collection baselines intact. Saving again duplicates knowledge and can permanently fail the link diff until the screen is reopened.

#### Expected Behavior / Invariant

ADR-131's aggregate editing and ADR-017's stable link identity require retries to preserve committed row identity. A correction to methods must not re-add previously saved knowledge.

#### Observed Behavior

Canonical method collisions are committed, non-throwing results. The screen commits knowledge and links, then stays open and refreshes only methods. New knowledge still has synthetic IDs, and links retain their old seed. A failed partial-save reseed has a similar replay risk.

#### Evidence

`src/screens/EditContactScreen.tsx:948–970` builds/commits the aggregate; `:1019–1024` commits links; `:1037–1053` returns on `canonicalDuplicate` after updating only methods. `src/db/contact-methods-dao.ts` (`saveMethodDiffCore`, collision preparation and return) collapses duplicates while committing the surviving methods. `src/screens/edit-contact-logic.ts:293–317` emits unmatched synthetic IDs as additions. `src/db/contacts-dao.ts` (`applyEditKnowledgeCore`) creates fresh Memory/relationship/fuel rows. `src/db/contact-links-dao.ts:239–269` replays ID-less inserts or seeded removals. `EditContactScreen.tsx:861–905` logs and swallows a failed reseed after a link failure.

#### Impact

Durable duplicate relationship knowledge and repeated link-save failures; each retry can commit another knowledge copy before links fail.

#### Trigger / Preconditions

Add knowledge or links while entering canonically duplicate methods, Save, then correct/re-save. Alternatively, metadata succeeds, links fail, and the recovery read also fails.

#### Remediation Direction

Advance committed collection identities/baselines whenever a save remains on screen, and do not permit stale additions to replay when recovery reads fail.

#### Verification

Exercise the actual save coordinator twice with canonical duplicates plus new Memory, relationship, Off Limits, and link additions/removals. Inject link-write and reseed failures separately. Assert stable row counts/UIDs. Existing DAO collision and pure payload tests do not execute the commit/stay/retry screen sequence.

#### Related Findings

AUD-REL-008

#### Planning Notes

Retain the deliberate metadata/knowledge transaction followed by a separate link transaction. The immediate first-interaction clearing guard is already present and should remain.

### AUD-REL-003 — Restore-photo recovery can overwrite a newer successful avatar edit

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DATA, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Pending recovery establishes target existence but not whether the old restore still owns the current photo.

#### Expected Behavior / Invariant

ADR-058 recovery must finish interrupted work without undoing a later successful user edit.

#### Observed Behavior

A retained finalize entry writes old staged bytes over the same canonical path after a newer crop. A retained delete entry can delete a newly selected photo.

#### Evidence

`src/services/photos/restore-photo-finalize-sweep.ts:20–34` checks contact existence (profile always passes), not photo ownership or revision; `:42–46` deletes unconditionally and `:67` persists the pending bytes. `src/screens/CropPhotoScreen.tsx:268–285` persists the replacement master then calls the normal photo writer. `src/db/contacts-dao.ts:962–1017` and `src/db/profile-dao.ts:38–62` do not retire/supersede the pending restore intent.

#### Impact

A photo the user successfully selected is later replaced with older backup content or removed on foreground recovery.

#### Trigger / Preconditions

Restore photo finalization or deletion fails, the user changes that avatar, and a later sweep retries the retained journal entry.

#### Remediation Direction

Recovery must validate that its intent still owns the photo mutation before touching canonical bytes.

#### Verification

Add behavioral coverage for failed finalize → successful user crop → sweep, and failed delete → successful crop → sweep. Assert newer bytes survive and stale work retires. Existing sweep tests cover liveness/retry, not intervening user edits.

#### Related Findings

AUD-REL-001, AUD-REL-005

#### Planning Notes

This persists even if Replace-all path collisions are fixed. Coordinate the journal and normal avatar-write boundaries; no claim is made here about every custom-field writer.

### AUD-REL-004 — Imported-photo failures lose their retry input at the next sweep

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** RELIABILITY, DATA, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Photo failure is recorded on an imported row, but neither retry eligibility nor staging liveness recognizes that state.

#### Expected Behavior / Invariant

ADR-065 explicitly requires failed imported-photo inputs to remain available for retry while preserving the independently committed contact.

#### Observed Behavior

The contact import succeeds, photo failure sets a flag, contact Retry excludes that row, and launch cleanup deletes its staged photo. Interruption between contact commit and photo completion has the same gap.

#### Evidence

`src/services/import/import-driver.ts:90–119` commits the contact before photo work and only marks photo failure afterward. `src/db/import-session-dao.ts:254–266` sets `photo_failed=1` without changing imported status. `src/screens/ImportCompleteScreen.tsx:85–94` retries pending/failed rows; `import-driver.ts` additionally skips rows with a non-null contactId. `src/services/import/contact-import-resume-sweep.ts:93–108` retains only pending/needs_review/failed-row staging. Repository search found `photoFailed` mapped in the read layer but no runtime consumer that performs photo retry.

#### Impact

Transient image/filesystem failure becomes a missing imported photo with no durable retry source, despite an explicit recovery promise.

#### Trigger / Preconditions

Image mastering/photo-column update fails, or the process stops after contact commit and before photo completion; then foreground cleanup runs.

#### Remediation Direction

Represent pending/failed photo work independently of successful contact creation, preserve its live source, and provide a truthful photo-only recovery path.

#### Verification

Exercise import → photo failure/interruption → completion → launch sweep → retry with real session rows; assert one contact and surviving input until successful photo completion. `import-photo.test.ts` and resume-sweep tests validate the pieces separately and miss their incompatible liveness assumptions.

#### Related Findings

AUD-REL-009

#### Planning Notes

Preserve per-contact commits and failure-isolated photos; making a whole import transactional would reverse ADR-065.

### AUD-REL-005 — Restore completion hides outstanding photo and schedule recovery

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** RELIABILITY, BUG, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The restore service returns partial-success diagnostics that are discarded before the result screen.

#### Expected Behavior / Invariant

ADR-058 identifies incomplete photo recovery and misleading success states as risks. Users should distinguish committed data from unfinished recovery.

#### Observed Behavior

Photo finalization/cleanup or notification reconciliation can fail while the UI displays the same unqualified “Backup restored” result as a complete restore.

#### Evidence

`src/backup/restore-apply.ts:1620–1676` accumulates `photosNeedingAttention`, `photoCleanupPending`, and `scheduleResyncPending`. `src/screens/backup-restore-logic.ts:137–146` omits all three from `toRestoreResultParams`. `src/screens/RestoreResultScreen.tsx` renders only aggregate counts and safety-snapshot status.

#### Impact

Missing photos or stale reminders have no visible explanation or recovery status after restore.

#### Trigger / Preconditions

Database commit succeeds but any reported post-commit recovery task fails.

#### Remediation Direction

Carry outstanding recovery state into the result and distinguish it from a failed database restore or a fully completed restore.

#### Verification

Pass nonzero photo counters and a true schedule flag through the actual result adapter/presentation. Existing `backup-restore-logic.test.ts` only supplies zero/false recovery values.

#### Related Findings

AUD-REL-001, AUD-REL-003, AUD-REL-009

#### Planning Notes

Do not imply rollback after commit. Preserve the committed aggregate and expose its remaining work.

### AUD-REL-006 — Editing an existing participant override silently drops the new value

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Both participant editors persist a shared-field override only when its Follow event boolean changes.

#### Expected Behavior / Invariant

ADR-125 makes explicit Channel, Tone, and Duration overrides independently editable, including overrides equal to the parent value.

#### Observed Behavior

For an already overridden field, editing its value leaves follow=false. Both screens omit the changed value, then close as though saved.

#### Evidence

`src/components/group/ParticipantOverrideEditor.tsx` (`changeValue`) changes values and sets follow false. `src/screens/EditParticipantScreen.tsx:75–98` and `src/screens/EditGroupEventScreen.tsx` (`saveParticipant`, follow payload) compare only old/new follow booleans. `src/db/group-events-dao.ts:535–546` correctly no-ops an empty patch. Standalone Save navigates back at `EditParticipantScreen.tsx:117–118`; inline Save closes and reloads.

#### Impact

An ordinary edit appears successful but leaves the prior participant values in durable history.

#### Trigger / Preconditions

Change Channel/Tone/Duration on a participant whose corresponding field is already overridden.

#### Remediation Direction

Persist value changes as well as follow-state changes while preserving explicit override identity.

#### Verification

Exercise both entry points with false→false value edits for all three fields, null Tone/Duration, and an override equal to the parent. DAO tests around `group-events-dao.test.ts:1168–1318` supply correctly formed patches and do not test the screen's patch construction.

#### Related Findings

AUD-REL-007

#### Planning Notes

Keep child Allow-AI preservation and membership validation in the existing atomic participant save.

### AUD-REL-007 — Participant actions erase unsaved group-event drafts

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** BUG, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Refreshing participant membership reseeds the entire parent edit form and resets its dirty baseline.

#### Expected Behavior / Invariant

Unsaved Group Note/date/shared-field edits should survive an unrelated participant action unless the user explicitly discards them.

#### Observed Behavior

Adding/removing a participant or saving its inline edits reloads persisted parent values, silently replacing the unsaved parent draft.

#### Evidence

`src/screens/EditGroupEventScreen.tsx:84–103` rebuilds `eventDraft`, writes `baselineRef`, and calls `setDraft`. The add/remove/participant-save paths call this load at `:159`, `:184`, and `:246`. Parent fields commit only in `saveEvent(:112–146)`. `src/navigation/discard-keep-guard.ts:24–45` handles route removal, not these in-place replacements.

#### Impact

Typed shared prose and structured changes disappear, and the dirty indication is also lost.

#### Trigger / Preconditions

Edit parent fields, then use a participant control before event-level Save.

#### Remediation Direction

Refresh committed participant data without discarding the parent draft or its comparison baseline.

#### Verification

Change parent fields, perform each participant operation, then verify the draft remains and event Save persists it. No behavioral EditGroupEventScreen test was found; the picker source-string assertion for `await load` does not establish draft preservation.

#### Related Findings

AUD-REL-006, AUD-REL-008

#### Planning Notes

ADR-125 distinguishes parent and participant ownership. Preserve that boundary when refreshing.

### AUD-REL-008 — Participant-add refresh failures cause retries of an already committed write

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The picker treats a post-commit refresh failure as if participant insertion failed and retains a batch that cannot be inserted again.

#### Expected Behavior / Invariant

Retry after a successful mutation must recover the failed read without replaying a non-idempotent creation.

#### Observed Behavior

The add commits, reload rejects, and the picker remains open with its original selections. Retry fails because those contacts are now already participants.

#### Evidence

`src/screens/EditGroupEventScreen.tsx:149–163` and `src/screens/GroupEventDetailScreen.tsx:100–119` await add and reload in one rejecting boundary. `src/components/contact-picker-multiselect.ts:33–45` maps every owner rejection to failure; `src/components/ContactPicker.tsx:153–167` preserves selection. `src/db/group-events-dao.ts:585–605` rejects already-present IDs before mutation. The edit screen also claims “Your changes weren't saved.”

#### Impact

Misleading failure feedback and a retry loop requiring dismissal/reopening despite a successful original addition.

#### Trigger / Preconditions

Successful add followed by a transient `readGroupEventDetail` failure.

#### Remediation Direction

Retain knowledge that the batch committed and recover its read/presentation independently.

#### Verification

Inject successful insertion followed by one failed reload; retry must not insert again and must eventually refresh exclusions/membership. `contact-picker-multiselect.test.ts:61–76` asserts source strings for the batch-and-reload sequence rather than its post-commit failure behavior.

#### Related Findings

AUD-REL-002, AUD-REL-007

#### Planning Notes

Do not weaken the DAO duplicate-participant guard; it protects a valid invariant.

### AUD-REL-009 — One launch-hook rejection skips unrelated recovery and maintenance

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The central launch sweep stops at the first unhandled hook error, and both trigger sites discard its rejecting promise.

#### Expected Behavior / Invariant

Failure of one maintenance responsibility should not suppress independent photo recovery, notifications, widget refresh, and resumable-work discovery.

#### Observed Behavior

Hooks are awaited without per-hook isolation; a rejection aborts the remaining pass and clears the pending-rerun flag. Some hooks contain local catches, but several real failure paths escape.

#### Evidence

`src/services/launch-sweep.ts:70–88` loops with `await hook()` and only a finally; `:106,111` fire-and-forget without a catch. `field-sweep.ts` leaves candidate-read/history-prune errors unhandled, `memory-trash-sweep.ts` leaves scans unhandled, and `backup-sweep.ts` leaves settings/revision/SecureStore/health-write failures unhandled. Registration order in `App.tsx:225–302` puts these ahead of restore-photo, schedule, widget, and import-resume hooks. A read-only inline execution of the actual runner registered a throwing maintenance hook then a recovery hook: output was `seen:["maintenance"]`, error `injected storage failure`; recovery was never called.

#### Impact

A local failure suppresses unrelated recovery for that launch and can repeatedly starve later hooks; the trigger also produces an unhandled rejection.

#### Trigger / Preconditions

Any escaping early-hook failure, including a transient read/prune error or backup dependency rejection.

#### Remediation Direction

Observe/report each failure and preserve execution of independent responsibilities, with explicit handling for genuine dependencies and deferred reruns.

#### Verification

Add a throwing first/middle hook, assert later independent work runs, assert overlapping-launch behavior remains correct, and prove trigger promises are handled. Existing `launch-sweep.test.ts` covers ordering and coalescing only on successful hooks.

#### Related Findings

AUD-REL-003, AUD-REL-004, AUD-REL-005

#### Planning Notes

Keep foreground-only execution, ordering dependencies, and the non-reentrant transaction rule. This is not a proposal for background timers.

### AUD-REL-010 — Notification tests model the wrong Android DATE-trigger readback

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** RELIABILITY, TEST, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

The scheduler expects a scheduling-input field that the installed Android implementation does not return, so unchanged notifications always appear different.

#### Expected Behavior / Invariant

The full-request diff should leave an unchanged native request intact; tests should model the installed native API's output shape.

#### Observed Behavior

Existing triggers expose `value`, but equality reads `date`. Reconciliation needlessly cancels and recreates valid alarms.

#### Evidence

`src/services/notifications/notification-schedule.ts:312–315` reads `existing.trigger.date`; `:470–472` cancels then schedules on inequality. Installed `node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/triggers/NotificationTriggers.kt:56–62` emits `{type:'date', repeats:false, value:timestamp}` plus channelId. `getAllScheduledNotificationsAsync.ts` maps through `utils/mapNotificationResponse.ts:47–50`, which changes content only. `__mocks__/expo-notifications.ts:88–102` instead copies the input trigger containing `date`, masking the mismatch.

#### Impact

Unnecessary native churn, with a real missed-reminder window if re-scheduling fails or execution stops after cancellation.

#### Trigger / Preconditions

An unchanged pending decay or birthday DATE notification is reconciled on Android.

#### Remediation Direction

Compare the actual native output contract and preserve valid unchanged alarms.

#### Verification

Seed the installed Android serialized shape and run two identical reconciliations; the second must make no cancellation/schedule calls. Also cover real drift and failure after cancellation. Device readback can corroborate the installed-source finding.

#### Related Findings

AUD-REL-011

#### Planning Notes

This is a test-fidelity defect as well as a runtime defect. Preserve owned-ID isolation and the separate weekly Digest scheduler.

### AUD-REL-011 — After-slot reconciliation adds a next-day reminder to the weekly cadence

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** BUG, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Two individually tested date helpers compose into a reminder outside the weekly grid once today's delivery time has passed.

#### Expected Behavior / Invariant

`docs/dossier/11-notify.md:127–136` chooses approximately weekly reminders and explicitly rejects daily re-nag; the implementation sets RE_NAG_DAYS=7 and derives a stateless grid.

#### Observed Behavior

On a grid date, `nextNudgeDate` returns today. `nextAllowedFireInstant` then moves a past slot forward one day, even if today's reminder already fired.

#### Evidence

`src/services/notifications/notification-schedule.ts:212–219` composes these helpers. `src/services/notifications/fire-instant.ts:154–171` advances the cursor by one day after a past slot; `nextNudgeDate(:193 onward)` compares calendar dates. Actual function composition with due=2026-09-22, now=2026-09-22 12:00, delivery=09:00, quiet=21–08, stagger=5 yields 2026-09-23 09:05.

#### Impact

Opening the app after a delivered weekly reminder can arm another for the next morning, violating the selected anti-nag behavior.

#### Trigger / Preconditions

Reconcile on a weekly occurrence date after its allowed delivery time.

#### Remediation Direction

Select the next valid cadence occurrence after the allowed delivery instant has passed.

#### Verification

Model an already-fired morning request disappearing from the native pending set, then afternoon reconciliation. Assert the next weekly occurrence, not tomorrow. Cover quiet-hour shifts and preserve birthday date-specific skip behavior. Current helper tests do not establish this composed invariant.

#### Related Findings

AUD-REL-010

#### Planning Notes

Preserve stateless scheduling; do not introduce last-notified persistence or change the owner's cadence policy as a workaround.

### AUD-REL-012 — Cold notification routing can overwrite a newer warm-tap destination

**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Local  
**Type:** RELIABILITY, BUG, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Cold and warm notification body taps do not share the same asynchronous freshness guard.

#### Expected Behavior / Invariant

An older contact lookup must not replace navigation selected by a newer notification tap.

#### Observed Behavior

Warm body navigation uses a request ID, but the cold-start lookup uses the default always-current predicate. A delayed cold result can reset navigation after a newer warm result.

#### Evidence

`src/navigation/notification-gate.tsx:206–220` passes request freshness for warm routing. `:232–242` independently reads the cold response and calls `applyBodyNav(data)`. Its default at `:122–126` is `() => true`; after the contact lookup it resets navigation. `src/navigation/notification-gate.test.tsx:116–168` tests the helper with supplied predicates rather than the gate's two effect sources.

#### Impact

The user is moved back to the wrong contact/Compose destination after tapping a newer notification.

#### Trigger / Preconditions

Cold response A's contact lookup remains pending while a warm response B arrives and routes, then A resolves.

#### Remediation Direction

Apply a common chronology/freshness authority to both delivery paths.

#### Verification

Exercise gate wiring with delayed cold A, newer warm B, B resolving first, and A last; B must remain selected. Warm-versus-warm helper protection is already present. Native delivery timing was not reproduced, hence C2.

#### Related Findings

None.

#### Planning Notes

Preserve durable action deduplication and cold-response clearing; this finding concerns body navigation only.

### AUD-REL-013 — Digest ignores successful Quick Log and Undo while it remains focused

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The default home can display pre-write relationship/activity state immediately after its own shell Quick Log succeeds.

#### Expected Behavior / Invariant

ADR-147 describes a live derived Digest. A successful in-place capture should be reflected without requiring the user to leave and reopen the tab.

#### Observed Behavior

Quick Log uses an overlay picker and does not navigate away. Its successful write/Undo emits shell refresh, but neither Digest's main read nor Your Week subscribes. Their reads only run on focus (or a period change for Your Week).

#### Evidence

`src/components/UniversalFab.tsx:210–255` executes Quick Log after closing its picker without navigation. `src/services/quick-log-command.ts` emits `bumpShellRefresh` after successful log and Undo. `src/stores/shell-refresh-store.ts` exposes the subscription; Home/Orrery consume it. `src/screens/DigestScreen.tsx:92–136` only loads via focus; `src/components/digest/YourWeekSection.tsx:107–136` does likewise. Neither subscribes to shell refresh or foreground changes.

#### Impact

Your Week counts/heatmap stay old; a newly contacted person can remain in Up Next or Never Contacted, inviting another action despite a successful log. Returning from background also does not itself refresh these focused reads.

#### Trigger / Preconditions

Quick Log or Undo from the FAB while Digest is active; no tab/stack focus transition follows.

#### Remediation Direction

Refresh the affected derived Digest data on committed in-place actions and relevant resume events while retaining stale-result protection.

#### Verification

Mount the actual Digest lifecycle, complete FAB Quick Log/Undo without navigation, and assert updated sections. Current Digest tests mock `useFocusEffect` and test composition; YourWeekSection tests mock hooks and inspect initial props, so they cannot detect this missing subscription.

#### Related Findings

AUD-REL-014

#### Planning Notes

Keep reads local and derived; this does not require a persistent Digest cache or a network dependency.

### AUD-REL-014 — Digest day-detail read failures are presented as “No activity”

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** BUG, RELIABILITY, TEST  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Pending, failed, and successfully empty day-detail reads all share the same empty array state.

#### Expected Behavior / Invariant

`docs/systems/digest.md:103` requires loading/error state until the matching read completes; Phase 38 UI-SPEC loading semantics prohibit false empty-state flashes.

#### Observed Behavior

Selecting a day immediately renders an empty result; a read rejection only logs, leaving the false empty statement indefinitely.

#### Evidence

`src/components/digest/YourWeekSection.tsx:171–181` selects the date, clears `dayRows`, and catches without setting a day-detail error. `:230` renders the detail whenever selected. `src/components/digest/DigestDayDetail.tsx:36–39` maps every empty array to “No activity on this date.” `YourWeekSection.test.tsx` replaces useState setters and useFocusEffect with mocks, never exercising async selection; `DigestDayDetail.test.tsx` supplies already-resolved rows.

#### Impact

An active heatmap day can claim to contain no activity, hiding history when a transient read fails.

#### Trigger / Preconditions

Any delayed day query; a rejected query makes the misleading state persistent.

#### Remediation Direction

Distinguish unresolved/error/loaded-empty results and publish only the matching request's result.

#### Verification

Delay and reject a populated-day read, assert no false-empty claim, recover successfully, then switch dates during pending reads. This is also recorded as WR-01 in `.planning/phases/38-your-week/38-REVIEW.md`; it remains present on disk and no explicit acceptance/deferral was found.

#### Related Findings

AUD-REL-013

#### Planning Notes

Retain date-selection freshness protection and distinguish read failure from an empty canonical result.

## Cross-Finding Patterns

1. **Commit and presentation recovery are conflated.** Edit Contact and group participant addition can commit successfully before a later step fails or keeps the screen open. Reusing pre-commit drafts then duplicates work or makes Retry fail (002, 008). The restore result loses the distinction in the other direction, suppressing outstanding work (005).
2. **Recovery lacks durable ownership or correct liveness.** A filename can belong to the replacement graph or a later user edit; “old filename”/“target exists” is insufficient authorization to delete/overwrite it (001, 003). Imported contact completion does not imply photo completion (004).
3. **Tests prove isolated contracts while missing their composition.** Correct group DAO payload tests do not exercise the screen's omitted values (006). String-presence assertions can pass while enforcing a harmful reload sequence (007, 008). Separate scheduling helpers miss a cadence violation (011). An input-echoing native mock conceals the actual readback mismatch (010).
4. **Async UI states need explicit authority and outcome.** Cold/warm sources compete without one chronology (012); successful shell writes are invisible to a focused Digest (013); empty arrays stand in for both pending and failed reads (014).
5. **Local catches do not establish whole-workflow isolation.** Many leaf operations catch errors correctly, but the sweep's uncaught hook boundary still lets an early failure suppress unrelated recovery (009).

These patterns justify bounded integration/failure-path coverage, not blanket tests for every function or removal of established transaction boundaries.

## Reviewed Areas With No Material Findings

- **Migration and transaction foundations:** ordered per-step migration transactions, atomic user_version updates, best-effort rollback preserving the original error, the shared rejection-resilient mutex, and migration-before-main-render gating. The full registered chain executes in the passing suite. This is not a claim that every historical populated upgrade has been independently reproduced.
- **Aggregate DAO boundaries:** contact knowledge and Group Event fan-outs compose transaction-owned cores; rollback tests cover material failure cases. Participant writes validate membership and preserve child Allow-AI. Findings above concern orchestration/payloads beyond those protections.
- **Custom-field type semantics:** reviewed lossless raw-value parsing/type changes, snapshotting, and stale expiry rechecks. No new material defect was established in those reviewed paths.
- **Merge safeguards:** one transaction covers reparenting/tombstoning; same-Group-Event collisions are explicitly refused. Tests cover collision rollback and important retained history/relationship consequences.
- **AI and external handoff:** generation cancellation, timeout/shared abort, explicit draft selection, manual Compose fallback, and caught native-handoff failure paths were present in the reviewed flows. No live AI invocation was made.
- **Notification actions/widget writes:** durable notification action UID replay guards have real-SQLite tests; widget marks commit before best-effort render. Per-contact scheduling failures and independent purge cancellation attempts are isolated.
- **Backup safeguards outside admitted defects:** staging precedes restore's SQL transaction; failed pre-restore verification blocks replacement; encrypted backup paths fail closed and verify re-encrypted replacement files before removing predecessors.

## Accepted / Deferred / Rejected Candidates

- **ACCEPTED design:** separate metadata/knowledge and link transactions. The audit does not call the boundary itself a defect; 002 concerns retry baselines after commits.
- **ACCEPTED design:** session-scoped Compose drafts do not survive process death; repeat widget taps intentionally produce distinct interactions; headless snooze schedule re-arm is foreground-deferred under ADR-040.
- **DEFERRED verification:** the existing imported-photo-library restore progress/Back device-UAT item remains in `.planning/todos/pending/2026-08-26-validate-restore-progress-with-imported-photo-library.md`. This audit did not complete that device observation.
- **DEFERRED scope:** future contact-scoped custom-field filtering was not reclassified as a current defect where the current implementation explicitly records the deferral.
- **REJECTED candidates:** the app does catch startup migration failure and shows an error instead of an endless bootstrap spinner; stale documentation warning about an uncaught bootstrap was not promoted. Group participant DAO atomicity is present; 006 is the screen's payload defect. First-interaction intent is cleared immediately after contact commit, so the known first-interaction retry guard was not misreported as absent.
- **Already known, still OPEN:** Digest day-detail WR-01 from Phase 38 review is 014. Its presence in a review is not owner acceptance; the current code still exhibits it.
- Existing warnings about a historical Orrery test transform failure were not treated as current: the complete suite passed during this audit.

## Coverage Limitations / Follow-up Investigation

- No physical-device UAT, process-kill experiment, real SAF provider fault injection, or live AI/provider interaction. Native notification return shape was verified against the installed dependency implementation, not a device capture.
- The restore reproduction uses the real SQL/migration/apply path and a shared in-memory byte model, not expo-file-system. It proves conflicting application file operations without claiming native crash durability.
- Screen defects are principally static call-flow findings. Native rendering/effect timing should be verified downstream; 012 is explicitly C2 because overlapping cold/warm delivery was not exercised.
- HomeScreen's independent focus/foreground/pull/shell cancellation scopes merit a targeted delayed-read check: each reload has a private cancellation flag and pull/shell calls are not invalidated by every newer source. No separate primary finding is admitted without the cross-source execution check.
- Archive/recently-deleted error presentation, native picker acquisition, every reconciliation screen, and the full Orrery rendering subsystem were not exhaustively audited. No finding count is presented as evidence those areas are clean.
- Test success does not prove recovery after interruption. Highest-value additions are the concrete behavioral cases in each finding: shared filesystem ownership, committed-write/failed-read handling, repeated correction saves, real native serialization, and mounted asynchronous screen coordination.

