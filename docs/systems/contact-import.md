# Contact Import

**Last updated:** 2026-09-25
**Updated by phase:** 38.3-audit-remediation-runtime-state
**Owners:** `modules/orbit-contact-picker/`, `src/db/import-session-dao.ts`, `src/db/imported-contact-dao.ts`, `src/services/import/`, `src/screens/ImportReviewScreen.tsx`

## Purpose

Contact Import lets a user deliberately bring selected Android system contacts into Orbit while keeping acquisition local to the device. It uses Android's privacy-preserving system picker on API 37+ and a scoped-permission custom picker on API 36 and below, then drives reviewed single or incremental bulk import from durable local state; it never treats the source provider as Orbit's authority.

## Architecture

### Data Model

Migration 012 stores import work outside Orbit's portable backup model. Picker payloads are JSON snapshots, so an accepted selection remains reviewable after the provider's temporary URI grant expires.

**Tables:**
- `import_sessions` — one local-only single or bulk import operation.
  - `mode` (`TEXT`) — `single` or `bulk` workflow shape.
  - `phone_region` (`TEXT`) — region used when canonicalizing imported phone evidence.
  - `batch_category_id` (`INTEGER`, nullable) — explicit bulk override; `NULL` means Uncategorized.
  - `batch_tracking_enabled` (`INTEGER` 0/1) — the batch lifecycle chosen at bulk setup (38.4 D-57); written by `setSessionBatchDefaults` together with the category and cadence. Picker acceptance still writes 0 (Unbound).
  - `batch_interval_days` (`INTEGER`, nullable; migration 032) — the batch cadence when Bound; `NULL` when Unbound and for every session created before migration 032. The CHECK admits only `NULL` or a positive integer; the Bound ⇒ cadence pairing is enforced by `assertImportLifecycle` in the writer.
  - `status` (`TEXT`) — durable pending, complete, or discarded session state.
- `import_session_rows` — one picker snapshot and review state per selected source contact.
  - `source_payload` (`TEXT`) — accepted name, methods, birthday, and Note snapshot; the allowlist remains the durable source after a provider grant expires.
  - `row_status` (`TEXT`) — pending, imported, linked, skipped, needs_review, or failed state.
  - `match_outcome` (`TEXT`) — deterministic or advisory outcome retained for truthful completion counts.
  - `candidates_json` (`TEXT`) — JSON-safe advisory candidate list; malformed persisted data reads as an empty list.
  - `photo_rel_path` (`TEXT`, nullable) — private durable `import-staging/` path retained only while photo work is retryable.
- `bulk_review_resolutions` — migration-013 dispositions for import rows with unreadable birthdays.
  - `resolution` (`TEXT`) — `fixed` writes a valid birthday and `ignored` leaves Orbit data untouched.

**Types** (`modules/orbit-contact-picker/index.ts`, `src/db/import-session-dao.ts`):
- `PickedContact` — native, grant-safe Android snapshot returned to JavaScript.
- `ImportSessionRow` — durable row state, payload, candidate evidence, and staging reference.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Native picker | `modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt` | Launches the API-37 system picker, reads legacy selected contacts, and re-reads linked contacts only for user-initiated reconciliation. |
| Legacy picker | `src/screens/LegacyContactPickerScreen.tsx` | Provides token-driven browse, search, multi-select, and permission recovery for the scoped legacy path. |
| Session DAO | `src/db/import-session-dao.ts` | Accepts snapshots atomically and owns transaction-composable row transitions. |
| Session read | `src/db/import-session-read.ts` | Finds resumable work and groups durable completion counts. |
| Import writer | `src/db/imported-contact-dao.ts` | Composes contact creation/linking, external links, method provenance, AI-off imported Notes, and row resolution in one transaction. |
| Duplicate service | `src/services/import/duplicate-evidence.ts` | Performs deterministic active-link lookup and advisory candidate scoring. |
| Batch service | `src/services/import/import-driver.ts` | Incrementally classifies and imports each row without a batch-wide transaction. |
| Recovery service | `src/services/import/contact-import-resume-sweep.ts` | Reconciles resumable sessions and private staging on foreground launch. |
| Photo service | `src/services/import/import-photo.ts` | Masters a staged photo after contact commit and retains input on failure. |

### Key Files

| File | Role |
|---|---|
| `src/db/migrations/012-import-sessions.ts` | Adds local-only durable import-session tables and state constraints. |
| `src/services/import/import-acquire.ts` | Accepts picker snapshots, stages accepted photos, and routes single versus bulk flow. |
| `src/services/import/source-consolidation.ts` | Combines explicit source clusters with the batch lifecycle and retains the first non-blank Note for the new contact. |
| `src/db/migrations/032-import-batch-cadence.ts` | Adds the nullable positive-integer `import_sessions.batch_interval_days` (38.4 D-57). |
| `src/screens/bulk-import-setup-logic.ts` | Bulk setup's batch lifecycle: `BULK_IMPORT_DEFAULT_FREQUENCY` (Monthly), `BULK_BOUND_BLURB`, `bulkLifecycleChoice()` and `initialBulkLifecycle()` (38.4 D-57). |
| `src/services/import/import-lifecycle-effects.ts` | `applyBoundImportEffects()`: after a Bound pass, combine or single import, reconciles the notification schedule and refreshes the widget once, isolated and best-effort (38.4 D-57). |
| `modules/orbit-contact-picker/android/src/main/AndroidManifest.xml` | Declares the permission used by legacy acquisition and reconciliation re-reads. |
| `plugins/withContactPickerPermission.js` | Writes the decisive app-manifest permission declaration during Expo prebuild. |
| `src/services/import/start-contact-import.ts` | Selects the system or legacy acquisition path once for both entry points. |
| `src/screens/LegacyContactPickerScreen.tsx` | Browses lightweight contact summaries and reads full fields only for selected contacts. |
| `src/screens/ImportReviewScreen.tsx` | Provides detailed single-contact review and explicit duplicate interrupt. |
| `src/screens/BulkImportSetupScreen.tsx` | Offers the batch's Orbit participation (Unbound default, or Bound with a batch frequency), the category override, and the consolidation prompt; saves the batch defaults to the session before any write. |
| `src/screens/ImportProgressScreen.tsx` | Shows one determinate logical bulk import, or a truthful "Import stopped" surface after a fatal setup/session failure. |
| `src/screens/DuplicateReviewScreen.tsx` | Resolves advisory rows through explicit Link, Import as New, or Skip actions. |
| `src/screens/ImportCompleteScreen.tsx` | Reports durable outcome buckets and offers review, contact, Retry and Done actions. |
| `src/components/ResumeImportPrompt.tsx` | Offers explicit Resume or Discard after an interrupted import. |

## How It Works

Category choices use the canonical ordered catalog and switch to the complete searchable Sheet at 13 rows. Both bulk setup and single-contact review re-read catalog truth immediately before writing, so a deleted selection becomes Uncategorized. If a category itself is deleted, the category DAO reassigns every referencing import session—`pending`, `complete`, and `discarded`—to the same chosen survivor or `NULL`; session status and unrelated recovery data are preserved.

### Acquiring and accepting a selection

1. `AddSpeedDialFab` and Settings call `startContactImport()`, which routes API 37+ to the permissionless system picker and API 36 and below to `LegacyContactPicker`.
2. The system picker snapshots selected fields from its temporary grant; the legacy picker requests scoped `READ_CONTACTS`, lists on-device summaries, then reads full fields only for selected lookup keys. Both map to `PickedContact[]`, including the first non-blank Android Note; no provider URI enters route state or durable payload.
3. The legacy reader accepts birthdays only from `Event.TYPE_BIRTHDAY`, preserves multiple methods, stages selected photos privately, and rejects a read failure so the screen can show an error rather than a false cancellation.
4. `acceptPickedContacts()` moves accepted photos into flat private `import-staging/` paths, then commits the import session and every row together. Cancelling before acceptance writes neither a session nor an Orbit contact.

### Reviewing one contact

1. One accepted row opens `ImportReviewScreen`, where the user can choose Bound or Unbound, category, selected/primary methods, birthday, and photo before writing. The Bound choice and its frequency are honoured: `commitSingleImport()` passes the reviewed lifecycle to `importContactRecord()`, which takes the lifecycle as an explicit, validated parameter. Before 38.4 the seam forced Unbound and silently dropped a Bound choice (D-57 finding; Phase 19 Cluster D, ADR-066).
2. The DAO rejects an invalid non-null birthday before opening its transaction; the screen keeps invalid raw input visible and disables Import. The mapper accepts supported year-less and unambiguous slash formats, while still-unreadable values remain flagged rather than coerced.
3. A deterministic active external link resolves as already in Orbit. Advisory matches require an explicit Link to Existing, Import as New, or Skip choice and never overwrite an existing name.
4. A successful new-contact create preserves a raw Note as an `imported`, import-provenance Memory with stored AI permission off, regardless of the general new-Memory default. The per-item toggle is the opt-in path. An already-linked outcome deliberately writes no Note.

### Processing bulk work and recovery

1. A multi-selection opens `BulkImportSetupScreen`. The batch is Unbound by default; the user may choose Bound, which reveals a batch frequency (`FrequencyPicker`, starting at Monthly) and a blurb saying that binding puts every imported contact on reminders at that frequency. An optional category override sits beside it. There are no per-person controls. Import (and Combine, before its combine) saves the category and lifecycle to the session in one `setSessionBatchDefaults` write before any contact is created, and every bulk create — the driver's pass, a resume, Combine, and Duplicate Review's Import as new — reads the lifecycle from the session (`sessionBatchLifecycle`), so an interrupted import resumes with the same batch choice. Returning to setup reloads the saved choice (38.4 D-57).
2. `runImportBatch()` processes each safe row independently; ambiguous rows persist candidate evidence for later review and cannot block safe rows. A nameless bulk row is terminally skipped before it can wedge a resumable session or stage a photo.
3. If setup or session access fails outside the driver's per-row isolation, `ImportProgressScreen` leaves "Importing… X of Y" for an "Import stopped" surface and never re-runs the batch. A still-readable session offers "View import summary" (replace to Import Complete); an unreadable session shows "Couldn't read this import" with Back. The stopped phase releases the `useOpenImportSession` hold (`useOpenImportSession(sessionId, active)`), so the next foreground sweep can offer the session again.
4. `ImportCompleteScreen` reads durable Imported, Already in Orbit, Need review, Failed, nameless-skipped, and unreadable-birthday counts. `importCompleteRetryState()` shows Retry when rows are failed, still pending (the fatal-stop case), or committed contacts have outstanding photos. Retry runs only `pending`/`failed` rows (the driver also skips any row that already has a contact) plus photo-only retries; Skip remaining photos explicitly retires photo work. The summary re-reads on **every focus** (`useFocusEffect`, whose cleanup invalidates the latest-request authority; 38.3 UAT O-3, 38.4 D-10), so returning from Duplicate Review after a link shows the current Need-review count. The focus path runs only `load` — the gated summary read plus the pre-existing idempotent `finalizeSessionIfTerminal` (which completes the session only when no rows are unresolved) — never an import, Retry, Skip, or row mutation.
5. The launch sweep offers Resume for pending work and for completed sessions with outstanding photos. Discard removes only unresolved rows and staging; contacts and their outstanding photo work stay in Orbit.
6. `DuplicateReviewScreen` renders through `duplicateReviewView()`: a failed read shows "Couldn't load matches" with a Retry that only re-reads, never "Nothing to review". A resolve is complete when its write commits: only a rejected link/import/skip write raises the per-row Alert, while a failed finalize or follow-up re-read after a committed write becomes the read error (`runResolveThenRecover` / `runBulkResolveThenRecover`), so the write is never repeated.

### Reviewing unreadable imported birthdays

1. Settings can list unresolved unreadable-birthday flags from immutable import payloads; resolving a flag never mutates that payload.
2. Fix validates and stores a user-entered local birthday, advances exportable data revision, and records `fixed` in the same transaction.
3. Ignore records only `ignored`, leaves the contact unchanged, and permanently removes the flag from the review read.

### Handling photos and source consolidation

1. After an imported contact commits, `import-photo.ts` converts the staged source into Orbit's usual master photo and sets the contact photo path.
2. On success, the row's staging reference is retired before best-effort raw-file deletion. A failed or interrupted photo leaves the contact imported and its staged input live for photo-only Retry, including after relaunch. Retry checks the contact UID, row ownership, existing photo and canonical generation under the photo path lock before writing. Purge retires the contact's import workflow copies in its transaction.
3. Before a bulk driver starts, source rows sharing a canonical phone or email may be shown in `ConsolidationPrompt`; only an explicit Combine into one creates one contact with multiple external links.
4. Consolidation chooses the first non-blank imported Note and writes it atomically with the combined new contact; it never uses provider metadata to enable AI.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| System-picker API | `37+` | `OrbitContactPickerModule.kt` | Enables the privacy-preserving system Contact Picker path. |
| Legacy-picker API | `≤36` | `LegacyContactPickerScreen.tsx` | Enables the custom on-device ContactsContract path. |
| Reconcile permission | API `37+`, user initiated | `plugins/withContactPickerPermission.js` | Permits re-reading already-linked contacts after an in-context request; it does not change import acquisition. |
| Legacy selection limit | No app-level cap | `modules/orbit-contact-picker/index.ts` | Chunks selected-key reads without restricting a user's selection. |

## Decisions

- **ADR-064:** Permissionless Android 17 System-Contact Snapshot Acquisition — uses a selected-field native snapshot instead of broad contacts permission.
- **ADR-065:** Durable Resumable Contact-Import Sessions with Failure-Isolated Photos — keeps review/retry state local and durable while isolating photo failure.
- **ADR-066:** Deliberate Reviewed Import with Unbound Bulk Defaults — requires single review and uses safe shared bulk defaults. *Partially superseded by 38.4 D-57 (bulk setup may bind the batch at one frequency; Unbound stays the default) and D-58 (Import Complete's bridge to Unbound contacts removed); superseding ADR due at KB extraction.*
- **ADR-067:** Conservative Advisory Identity Matching and Explicit Source Consolidation — keeps inferred identity user-confirmed and source consolidation explicit.
- **ADR-002:** Cross-Version Contact Import — Hybrid Two-Picker — routes acquisition by Android SDK while retaining one local picker-agnostic pipeline.
- **ADR-003:** `READ_CONTACTS` on API 37+ for Reconcile — enables a permission-gated linked-contact re-read without changing the API-37+ import picker.
- **ADR-068:** User-Triggered, Source-Only Reconciliation with Durable Review — shares the local source records and durable import flag-review boundary.
- **ADR-091:** Imported Contact Notes as AI-Off Typed Memories — preserves accepted provider Notes through all new-contact import paths.
- **ADR-143:** Lock-Time-Revalidated Atomic Category Deletion and System Fallout — reassigns every referenced pending, complete, and discarded import session in the deletion transaction.
- **ADR-144:** Complete Category Selection and Grouped Orrery System Discovery — keeps import selectors complete, ordered, searchable, and stale-safe.

## Gotchas

1. **Never re-read a picker URI after acceptance.** Its temporary grant can be gone after process death; use the durable session payload only.
2. **Keep acquisition and reconciliation distinct.** API-37+ import remains permissionless through the system picker; only a user-initiated linked-contact re-read requests `READ_CONTACTS`, with a Play declaration release obligation.
3. **Treat `pending`, `needs_review`, and `failed` as the only staging-live rows.** Resolved rows must not preserve private raw photo staging indefinitely.
4. **A photo failure is not a contact failure.** The contact and import row remain committed; only the photo is retryable.
5. **Do not infer identity from name or birthday alone.** Every non-link candidate outcome remains advisory and explicit.
6. **A read error is not a cancellation.** The legacy screen must surface rejected selected-key reads; collapsing them to an empty selection silently loses the user's work.
7. **Keep name-required behavior mode-specific.** A nameless bulk row skips terminally, while a nameless single row remains in review so the user can supply a name.
8. **Fix and Ignore have different write scopes.** Fix must advance data revision with its birthday write; Ignore must only record the durable disposition.
9. **Keep the Note in the session payload allowlist.** Adding it only to the native bridge loses it when bulk or review code reparses durable session JSON.
10. **Already-linked imports do not append Notes.** This deliberate boundary prevents a re-import from duplicating unreviewed provider text on an existing contact.
11. **Never auto-rerun a stopped import.** A fatal ImportProgress stop hands recovery to the user through Import Complete's explicit Retry; replaying a partially committed batch automatically risks duplicate contacts.
12. **A post-write read failure is not a write failure.** In Duplicate Review, never tell the user to redo a committed link or import because finalize or the re-read failed; route it to the read error and its read-only Retry.
13. **The resume prompt's body scrolls; its buttons never do.** At large text "Resume your import?" keeps its heading and body in a bounded `ScrollView` (`flexGrow: 0`, `flexShrink: 1`) inside a shrinking, safe-area-inset card, with Resume / Discard / Later outside the scroll region. It stays an RN `Modal` whose only exits are its buttons; do not move an action into the scroll body or make Back dismiss it (D-49).
14. **The batch lifecycle lives only on the import session.** Never add an in-pass lifecycle override to `runImportBatch` or any other bulk create: resume calls the driver again with no setup state, so it must read the session (`sessionBatchLifecycle`). Every create seam (`importContactRecord`, `importRowAsNew`, `combineCluster`) takes a REQUIRED validated lifecycle, and bulk setup writes it with the category in one `setSessionBatchDefaults` update before any contact is created (D-57).

## Related Systems

- **Contacts** — provides the canonical contact-create core and receives imported or linked people.
- **Contact methods** — supplies canonical endpoint matching, external links, and provenance writes.
- **Photos** — converts staged imported images into Orbit-owned masters.
- **Persistence core** — owns migration 012, serialized writes, and launch-sweep registration.
- **App shell** — registers import routes and the Settings entry.
- **Dashboard** — exposes the speed-dial import entry.
- **Backup & Restore** — excludes local-only import sessions from portable snapshots and clears them on Replace-all restore.
- **Contact Knowledge** — owns imported Notes after the new-contact transaction commits.
- **Contact Reconciliation** — re-reads already-linked source records through a permission-gated, user-initiated path.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-26 | 19 | Created Android-17 selected-contact acquisition, durable review sessions, conservative resolution, and resumable import documentation. |
| 2026-08-29 | 19.1 | Added SDK-routed legacy acquisition, scoped permission recovery, and explicit shared-pipeline terminal outcomes. |
| 2026-08-26 | 20 | Added reconcile-only API-37+ permission handling and durable unreadable-birthday Fix/Ignore review. |
| 2026-09-03 | 24.2 | Added Note MIME acquisition and durable AI-off imported-Memory writes for new-contact imports. |
| 2026-09-17 | 37.1 | Made category selection complete and stale-safe; category deletion reassigns pending, complete, and discarded sessions to the same target. |
| 2026-09-24 | 38.2 | RG-007 forces new imported notes AI-off regardless of the general Memory default. RG-012 retains post-commit photo retry input, offers photo-only Retry and explicit Skip, and retires workflow copies on contact purge. |
| 2026-09-25 | 38.3 | Truthful import stop + review read errors (RG-035): fatal ImportProgress stop with summary/Back and released session hold (D-20); Import Complete Retry includes pending rows (D-26); Duplicate Review read errors with read-only Retry, post-write recovery split from write failures (D-24, D-04). |
| 2026-09-26 | 38.3 | Code-review fixes to the D-20 recovery path and import commit truth: BulkImportSetup holds the open-session mark only while focused and re-enables Import on return, so a fatal ImportProgress stop really releases the session to the resume sweep (B-CR-02); a resume re-entry carries a fresh `runKey` so a reused stopped ImportProgress route re-runs (B-WR-01); Duplicate Review link/bulk writes and Import Complete Retry/Skip photos are single-flight latched (B-WR-02, B-WR-03); Import Complete reads through `ReadPhase` with a read-only Retry and shows a failed Retry write as an inline notice above re-read counts (B-WR-04). |
| 2026-09-26 | 38.4 | Import Complete re-reads on focus (38.3 UAT O-3, D-10): the mount-only summary effect became `useFocusEffect(useCallback(() => { void load(); return () => authority.invalidate(); }))`, still gated by the one latest-request authority; the focus path never re-runs an import, Retry, Skip or row mutation (source-contract test in `import-complete-logic.test.ts`). No legacy-data repair (38.2 D-23). |
| 2026-09-27 | 38.4 | Resume-import prompt scrolls its body at large text; its Resume label uses `onAccent` (D-49, OA-D3). |
| 2026-09-27 | 38.4 | Bulk import Bound/Unbound with a batch frequency; single-review lifecycle honoured; migration 032 `import_sessions.batch_interval_days`; Bound imports refresh reminders and the widget post-commit (D-57, OA-E2). |
| 2026-09-27 | 38.4 | Import Complete's Unbound-contacts bridge removed; it would not list a Bound batch (D-58, OA-E2). ADR-066's bridge clause and the Phase 19 dossier's Import Complete bridge get a superseding note at KB extraction. |
