# Contact Import

**Last updated:** 2026-08-26
**Updated by phase:** 20-contact-reconciliation-merge
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
  - `status` (`TEXT`) — durable pending, complete, or discarded session state.
- `import_session_rows` — one picker snapshot and review state per selected source contact.
  - `source_payload` (`TEXT`) — accepted name, methods, birthday, and source metadata snapshot.
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
| Import writer | `src/db/imported-contact-dao.ts` | Composes contact creation/linking, external links, method provenance, and row resolution in one transaction. |
| Duplicate service | `src/services/import/duplicate-evidence.ts` | Performs deterministic active-link lookup and advisory candidate scoring. |
| Batch service | `src/services/import/import-driver.ts` | Incrementally classifies and imports each row without a batch-wide transaction. |
| Recovery service | `src/services/import/contact-import-resume-sweep.ts` | Reconciles resumable sessions and private staging on foreground launch. |
| Photo service | `src/services/import/import-photo.ts` | Masters a staged photo after contact commit and retains input on failure. |

### Key Files

| File | Role |
|---|---|
| `src/db/migrations/012-import-sessions.ts` | Adds local-only durable import-session tables and state constraints. |
| `src/services/import/import-acquire.ts` | Accepts picker snapshots, stages accepted photos, and routes single versus bulk flow. |
| `modules/orbit-contact-picker/android/src/main/AndroidManifest.xml` | Declares the permission used by legacy acquisition and reconciliation re-reads. |
| `plugins/withContactPickerPermission.js` | Writes the decisive app-manifest permission declaration during Expo prebuild. |
| `src/services/import/start-contact-import.ts` | Selects the system or legacy acquisition path once for both entry points. |
| `src/screens/LegacyContactPickerScreen.tsx` | Browses lightweight contact summaries and reads full fields only for selected contacts. |
| `src/screens/ImportReviewScreen.tsx` | Provides detailed single-contact review and explicit duplicate interrupt. |
| `src/screens/BulkImportSetupScreen.tsx` | Shows shared Unbound/Uncategorized defaults, category override, and consolidation prompt. |
| `src/screens/ImportProgressScreen.tsx` | Shows one determinate logical bulk import. |
| `src/screens/DuplicateReviewScreen.tsx` | Resolves advisory rows through explicit Link, Import as New, or Skip actions. |
| `src/screens/ImportCompleteScreen.tsx` | Reports durable outcome buckets and offers review or Unbound navigation. |
| `src/components/ResumeImportPrompt.tsx` | Offers explicit Resume or Discard after an interrupted import. |

## How It Works

### Acquiring and accepting a selection

1. `AddSpeedDialFab` and Settings call `startContactImport()`, which routes API 37+ to the permissionless system picker and API 36 and below to `LegacyContactPicker`.
2. The system picker snapshots selected fields from its temporary grant; the legacy picker requests scoped `READ_CONTACTS`, lists on-device summaries, then reads full fields only for selected lookup keys. Both map to `PickedContact[]`; no provider URI enters route state or durable payload.
3. The legacy reader accepts birthdays only from `Event.TYPE_BIRTHDAY`, preserves multiple methods, stages selected photos privately, and rejects a read failure so the screen can show an error rather than a false cancellation.
4. `acceptPickedContacts()` moves accepted photos into flat private `import-staging/` paths, then commits the import session and every row together. Cancelling before acceptance writes neither a session nor an Orbit contact.

### Reviewing one contact

1. One accepted row opens `ImportReviewScreen`, where the user can choose Bound or Unbound, category, selected/primary methods, birthday, and photo before writing.
2. The DAO rejects an invalid non-null birthday before opening its transaction; the screen keeps invalid raw input visible and disables Import. The mapper accepts supported year-less and unambiguous slash formats, while still-unreadable values remain flagged rather than coerced.
3. A deterministic active external link resolves as already in Orbit. Advisory matches require an explicit Link to Existing, Import as New, or Skip choice and never overwrite an existing name.
4. A successful create or link resolves the import row in the same write transaction as contact data, links, and method provenance.

### Processing bulk work and recovery

1. A multi-selection opens `BulkImportSetupScreen` with shared Unbound and Uncategorized defaults and an optional category override, not per-person controls.
2. `runImportBatch()` processes each safe row independently; ambiguous rows persist candidate evidence for later review and cannot block safe rows. A nameless bulk row is terminally skipped before it can wedge a resumable session or stage a photo.
3. `ImportCompleteScreen` reads durable Imported, Already in Orbit, Need review, Failed, nameless-skipped, and unreadable-birthday counts. Retry targets only genuinely failed rows; a completed batch can open Unbound contacts.
4. The launch sweep offers Resume or Discard for pending work. Discard removes only unresolved rows and staging; contacts already committed stay in Orbit.

### Reviewing unreadable imported birthdays

1. Settings can list unresolved unreadable-birthday flags from immutable import payloads; resolving a flag never mutates that payload.
2. Fix validates and stores a user-entered local birthday, advances exportable data revision, and records `fixed` in the same transaction.
3. Ignore records only `ignored`, leaves the contact unchanged, and permanently removes the flag from the review read.

### Handling photos and source consolidation

1. After an imported contact commits, `import-photo.ts` converts the staged source into Orbit's usual master photo and sets the contact photo path.
2. On success, the row's staging reference is retired before best-effort raw-file deletion. A failed photo leaves the contact imported and retains the staged input for Retry.
3. Before a bulk driver starts, source rows sharing a canonical phone or email may be shown in `ConsolidationPrompt`; only an explicit Combine into one creates one contact with multiple external links.

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
- **ADR-066:** Deliberate Reviewed Import with Unbound Bulk Defaults — requires single review and uses safe shared bulk defaults.
- **ADR-067:** Conservative Advisory Identity Matching and Explicit Source Consolidation — keeps inferred identity user-confirmed and source consolidation explicit.
- **ADR-002:** Cross-Version Contact Import — Hybrid Two-Picker — routes acquisition by Android SDK while retaining one local picker-agnostic pipeline.
- **ADR-003:** `READ_CONTACTS` on API 37+ for Reconcile — enables a permission-gated linked-contact re-read without changing the API-37+ import picker.
- **ADR-068:** User-Triggered, Source-Only Reconciliation with Durable Review — shares the local source records and durable import flag-review boundary.

## Gotchas

1. **Never re-read a picker URI after acceptance.** Its temporary grant can be gone after process death; use the durable session payload only.
2. **Keep acquisition and reconciliation distinct.** API-37+ import remains permissionless through the system picker; only a user-initiated linked-contact re-read requests `READ_CONTACTS`, with a Play declaration release obligation.
3. **Treat `pending`, `needs_review`, and `failed` as the only staging-live rows.** Resolved rows must not preserve private raw photo staging indefinitely.
4. **A photo failure is not a contact failure.** The contact and import row remain committed; only the photo is retryable.
5. **Do not infer identity from name or birthday alone.** Every non-link candidate outcome remains advisory and explicit.
6. **A read error is not a cancellation.** The legacy screen must surface rejected selected-key reads; collapsing them to an empty selection silently loses the user's work.
7. **Keep name-required behavior mode-specific.** A nameless bulk row skips terminally, while a nameless single row remains in review so the user can supply a name.
8. **Fix and Ignore have different write scopes.** Fix must advance data revision with its birthday write; Ignore must only record the durable disposition.

## Related Systems

- **Contacts** — provides the canonical contact-create core and receives imported or linked people.
- **Contact methods** — supplies canonical endpoint matching, external links, and provenance writes.
- **Photos** — converts staged imported images into Orbit-owned masters.
- **Persistence core** — owns migration 012, serialized writes, and launch-sweep registration.
- **App shell** — registers import routes and the Settings entry.
- **Dashboard** — exposes the speed-dial import entry.
- **Backup & Restore** — excludes local-only import sessions from portable snapshots and clears them on Replace-all restore.
- **Contact Reconciliation** — re-reads already-linked source records through a permission-gated, user-initiated path.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-26 | 19 | Created Android-17 selected-contact acquisition, durable review sessions, conservative resolution, and resumable import documentation. |
| 2026-08-29 | 19.1 | Added SDK-routed legacy acquisition, scoped permission recovery, and explicit shared-pipeline terminal outcomes. |
| 2026-08-26 | 20 | Added reconcile-only API-37+ permission handling and durable unreadable-birthday Fix/Ignore review. |
