# Phase 17: Backup, Export & Restore - Research

**Researched:** 2026-08-25
**Domain:** Local-first SQLite backup, Android SAF storage, authenticated encryption, and UID-keyed restoration
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Reconciliation, deletion, and custom fields

- **D-01:** Add generic tombstones in migration 007 before export/restore work. A tombstone records `entity_type`, `entity_uid`, and `deleted_at`, with a unique logical key; retain them indefinitely in v1. Apply it in the same SQLite transaction as every hard deletion of a mergeable logical entity: contact purge, interactions, events, fuel, links, permanently deleted custom-field definitions and their values, and any equivalent hard-delete writer discovered during planning. Quarantine is not deletion. `field_history` is transient: never export or tombstone it. — **Reversibility:** one-way — migration 007 and published backup files depend on the deletion evidence.
- **D-02:** Reconcile through one standalone, thoroughly tested module. Match records by stable `uid`, resolve children through parent UIDs before mapping to local integer IDs, and let callers provide the participating row sets/policy so a future sync apply path reuses it rather than duplicating backup-private logic. — **Reversibility:** costly — backup restore and future sync will both depend on this contract.
- **D-03:** Scalar and mutable row conflicts use newer `modified_at`; missing rows insert; same-second ties favor deletion. A newer tombstone prevents resurrection, while a genuinely newer incoming row may restore the logical entity. `contacts.last_contact` is derived, never merged directly, and must be recomputed via the existing DAO after a successful apply.
- **D-04:** A Phase 16 normalized custom-field value row with `value = NULL` is an explicit clear, not absence. Export it and reconcile it just like any other mutable row: a newer clear overwrites an older populated value. A newer field-definition row may restore a logically deleted field.
- **D-05:** Validate the entire selected backup, including normalized custom-field invariants such as one value per contact/field pair and valid parents/definitions, before any restore write. A malformed, duplicate, or orphaned relationship rejects the whole restore with local data unchanged; never best-effort skip or invent data.

### Backup contents, format, and automatic retention

- **D-06:** Backup/export covers full non-secret app state: relationship data, categories, profile, photos, and non-secret SQLite settings. Exclude API keys, encryption/key material, and `field_history`. Serialize photo bytes and restore them as fresh local files; never trust serialized local file paths. Rebuild derived OS schedules and recompute derived recency instead of serializing either.
- **D-07:** Ship both manual full export via the share sheet and automatic backup to a user-selected Android SAF folder. They use the same versioned file format and encryption machinery, but manual exports never participate in automatic rotation or backup-health success.
- **D-08:** Automatic backups are distinct timestamped snapshots, never an in-place rewritten file. Write and verify a new automatic snapshot before pruning. Retention must never delete the newest verified automatic snapshot, even if it is older than the retention window.
- **D-09:** Expose two user-set positive integer settings: **back up every N days** (default `1`) and **keep backups for N days** (default `7`). The previous fixed 1/3/7/14 retention presets are superseded. Validate safely while preserving support for arbitrary integer day values rather than prescribed presets.
- **D-10:** v1 automatic backup is foreground-only: on an eligible app launch, run one snapshot if the interval elapsed *and* exportable data changed since the last successful automatic snapshot. No launch means no promised run; a later launch catches up with one snapshot, not a series. Use the existing launch sweep and isolate reusable due-backup/storage/rotation logic so future inexact background work can call it without reworking the format or reconciliation. Exact scheduled background backups are out of scope.

### Encryption and restore safety

- **D-11:** Readable plaintext JSON is the default anti-lock-in path. Encryption is optional AES-256-GCM using a user passphrase; encrypted automatic backups reuse the cached passphrase in SecureStore while enabled. The envelope may expose only technical decryptability metadata (format version, encryption flag, cipher/KDF parameters, salt, IV); export time, counts, and all app/user content remain encrypted. Backup encryption stays entirely separate from any future sync E2EE. — **Reversibility:** costly — the published encrypted-file envelope is a compatibility contract.
- **D-12:** Passphrase setup requires confirmation entry, a plain irrecoverability warning, gentle strength guidance, and no stored hint. Disabling encryption deletes the cached SecureStore passphrase but leaves old encrypted files intact. A normal change verifies the old passphrase and defaults to verified re-encryption of accessible automatic files, with a future-files-only alternative; manually shared files retain their old passphrase. A forgotten passphrase cannot recover or re-encrypt old files, but may establish a new one for future files.
- **D-13:** When encryption is enabled, a manual export defaults to encrypted. Offer a deliberate readable-JSON override for an explicit portability need; do not force plaintext or silently lower protection.
- **D-14:** Restore always decrypts/parses/validates and previews first: exported date, format version, encryption state, row/photo counts, and mode. Merge is default and follows the reconciliation rules above. Replace-all remains available for clean migration, with an impact-summary confirmation (no typed phrase). Before Replace-all, write and verify a fresh automatic snapshot when a destination is configured; otherwise clearly state that current local data will be lost without blocking the restore. Older files migrate forward; a newer-app file is rejected with an update-first message.
- **D-15:** Success uses concise totals, not a sensitive per-record audit: added, updated from backup, newer local retained, and tombstone deletions applied. Replace-all adds that local data was replaced and whether a verified pre-restore backup was created or no automatic destination existed. Failure is calm and specific (wrong passphrase, damaged/incomplete file, newer app, or invalid structure), explicitly says local data is unchanged, and returns to selection or preview.

### Product surface and backup health

- **D-16:** Create the Backup & Restore landing page as the permanent health/action surface: health status, last successful automatic backup, Export now, Restore a backup, and encryption status. Automatic-folder, cadence/retention, and encryption configuration live on a separate Backup settings page. Restore is a dedicated preview-and-confirm flow entered only from the landing page and returns there afterward.
- **D-17:** This phase creates no navigation bar. Add a temporary Dashboard link alongside Orrery and Settings that opens Backup & Restore. The next UI milestone will implement the nav bar and make this the fourth top-level destination; when sync actually ships, this destination can be renamed/extended to Data Management rather than shipping an empty Sync page now.
- **D-18:** Dashboard backup nudges are rare, calm, and dismissible—not a permanent card. Show one only after meaningful data exists and either no successful automatic backup exists, or data changed since the last success and at least 14 days have elapsed. Successful automatic-folder writes define backup health; opening a manual share sheet does not.

### the agent's Discretion

- Define a sensible, code-grounded threshold for “meaningful data,” exact safe bounds/error copy for positive-integer settings, and the internal backup-file schema/KDF implementation details while preserving the locked compatibility and privacy properties.
- Choose exact components and route names consistent with the existing React Navigation and theme-token conventions. The landing-page mockup is visual direction, not a pixel-for-pixel implementation.
- Design SAF provider error handling, lost-folder states, and restore progress mechanics consistent with Android platform constraints and the locked “local data unchanged on failure” guarantee.

### Deferred Ideas (OUT OF SCOPE)

- Bottom navigation-bar implementation and final fourth-destination placement belong to the next UI milestone; Phase 17 supplies only the temporary Dashboard link.
- Network sync, Turso/libSQL, accounts, global ordering/revisions, device enrollment, synced/device-local partition ratification, and sync E2EE belong to the future sync milestone.
- Background scheduling may later call the reusable due-backup service with inexact platform work. Exact scheduled backups require separate platform-permission/product decisions and are not part of v1.
- Import beyond restore-from-Orbit-backup and a final Data Management rename are future product work.
</user_constraints>

## Project Constraints (from AGENTS.md)

- Local Git commits are authorized; use the configured identity. [VERIFIED: AGENTS.md:3]
- Do not add `Co-authored-by`, `Signed-off-by`, or Codex/AI attribution trailers unless explicitly requested. [VERIFIED: AGENTS.md:4]
- Never push, create a pull request, or perform another GitHub write action without current explicit user authorization. [VERIFIED: AGENTS.md:5]

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| BKP-01 | Full plaintext, non-secret, manifest-stamped share-sheet export | Versioned wire schema, export manifest, photo byte codec, document/share adapters, exclusion tests |
| BKP-02 | Foreground launch-sweep SAF snapshots, rotation, health/nudge | SAF adapter, pure due/rotation logic, health metadata, launch-hook registration, provider-failure model |
| BKP-03 | Optional passphrase AES-256-GCM encryption with lifecycle | Native crypto package gate, passphrase repository, versioned encrypted envelope, re-encryption and device test |
| BKP-04 | Previewed Merge/Replace restore with forward migration and tombstones | Migration 007, complete input validation, standalone reconciliation/apply core, photo restore, schedule/recency rebuild |

## Summary

Phase 17 is best planned as a data-integrity phase first and a UI phase second. Migration 007 and every hard-delete writer must land before export or restore: the current app has hard deletes for individual interactions, fuel, links, permanent field definitions/values, and whole-contact purge fan-out. `field_history` is a deliberate exception. [VERIFIED: src/db/recency-dao.ts:308-327; src/db/fuel-dao.ts:225-235; src/db/contact-links-dao.ts:136-146; src/db/field-ddl.ts:101-124; src/db/purge-dao.ts:162-212]

The primary restoration boundary should be one node-tested reconciliation module plus one transaction-owning apply service. It must validate before acquiring the write transaction, map wire parent UIDs to local IDs inside the apply, and only then call existing non-mutexed cores. That follows the codebase's non-reentrant transaction rule and preserves the required all-or-nothing restore guarantee. [VERIFIED: src/db/transaction.ts:12-28; src/db/transaction.ts:42-56] [CITED: .planning/sync-milestone/PHASE-17-SYNC-READINESS.md:21-37]

Android storage is viable with the existing Expo SDK line: use the legacy `expo-file-system` SAF namespace exclusively for the automatic folder, use a cached local file for manual sharing, and use the system document picker for restore. Persisted SAF access can still become invalid when a document is moved or deleted, so every automatic write must treat provider access as a probe and map failure to the approved lost-folder state rather than updating health. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/] [CITED: https://developer.android.com/training/data-storage/shared/documents-files]

**Primary recommendation:** Plan Wave 0 around migration 007, deletion/tombstone coverage, wire-schema validation, and reconciliation tests; put export/SAF/encryption/UI only on top of that verified core.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Backup manifest, export rows, validation, reconciliation | API / Backend (local service layer) | Database / Storage | Business rules and wire conversion are TypeScript service code over SQLite, not screen logic. [VERIFIED: src/db/types.ts:13-29] |
| Tombstone persistence and atomic deletion | Database / Storage | API / Backend | The evidence and deletion must commit in one SQLite transaction. [VERIFIED: src/db/transaction.ts:42-56] |
| Restore apply | Database / Storage | API / Backend | Parent UID resolution, child writes, and recency recomputation must be transactional. [VERIFIED: src/db/recency-dao.ts:142-173] |
| Backup/restore file bytes and photos | Android platform storage | API / Backend | SAF and local files are platform I/O; services own serialization and error translation. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/] |
| Encryption and cached passphrase | Native crypto / SecureStore | API / Backend | Crypto must remain native-library backed; the service owns the envelope and lifecycle. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/crypto/] |
| Health, settings, preview, result screens | Browser / Client | API / Backend | React Native renders only aggregate state and dispatches service operations. [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:40-102] |

## Standard Stack

### Core

| Library / subsystem | Version | Purpose | Why Standard |
|---|---:|---|---|
| Existing `expo-sqlite` + `SqlExecutor` | `~57.0.1` in project | Read/export and transactional restore against the local DB | Keeps DAOs node-testable and follows the established one-connection transaction model. [VERIFIED: package.json:22] [VERIFIED: src/db/types.ts:13-29] |
| Existing `expo-file-system/legacy` SAF namespace | `~57.0.4` in project | Android directory grant, create/list/write automatic snapshots | Official SDK 57 API exposes directory permission, file creation, SAF URI reads/writes, and directory listing. [VERIFIED: package.json:14] [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/] |
| `expo-document-picker` | current registry `57.0.1` | Select exactly one restore file into readable cache | Official picker supports Android and `copyToCacheDirectory`. [VERIFIED: npm registry] [CITED: https://docs.expo.dev/versions/latest/sdk/document-picker/] |
| `expo-sharing` [WARNING: flagged as suspicious — verify before using.] | current registry `57.0.15` | Share manually-created local export file | Official API opens platform sharing for a local file URL. [VERIFIED: npm registry] [CITED: https://docs.expo.dev/versions/latest/sdk/sharing/] |
| `react-native-quick-crypto` [WARNING: flagged as suspicious — verify before using.] | current registry `1.1.7` | Native PBKDF2 plus AES-256-GCM | Official upstream documents Expo install/prebuild and native crypto; use its KDF instead of a JS implementation. [VERIFIED: npm registry] [CITED: https://github.com/margelo/react-native-quick-crypto/blob/main/README.md] [CITED: https://margelo.github.io/react-native-quick-crypto/docs/api/hash] |

### Supporting

| Library / subsystem | Version | Purpose | When to Use |
|---|---:|---|---|
| `react-native-nitro-modules` [WARNING: flagged as suspicious — verify before using.] | current registry `0.37.0` | RNQC peer dependency | Install at the version required by the RNQC peer range. [VERIFIED: npm registry] |
| `react-native-quick-base64` | current registry `3.0.1` | RNQC peer dependency / efficient binary boundary | Install at the version required by the RNQC peer range. [VERIFIED: npm registry] |
| Existing `expo-secure-store` | `~57.0.1` in project | Store only the cached current passphrase while encryption is enabled | Mirror the injected, lazy native-secret repository pattern; never serialize this value. [VERIFIED: package.json:19] [VERIFIED: src/services/ai-key-store.ts:35-104] |
| Existing `launch-sweep` registry | in-repo | Foreground-only automatic backup entry point | Register one idempotent hook after database migration; never invoke on module import/headless taps. [VERIFIED: src/services/launch-sweep.ts:1-23; src/services/launch-sweep.ts:93-115] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| RNQC native KDF/cipher | `expo-crypto` cipher plus a separate KDF | Expo Crypto provides AES-GCM but the official SDK surface does not document a password KDF, leaving an unsafe custom/pure-JS KDF problem. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/crypto/] |
| SAF folder snapshots | Exact background work | Out of scope: the locked product promise is one catch-up foreground snapshot, not clock-exact background execution. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |
| Merge reconciliation | Replace-all-only restore | Replace-all cannot satisfy the locked loss-safe Merge/sync-reuse contract. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |

Verbatim installed-manifest values: `"expo-file-system": "~57.0.4"`, `"expo-secure-store": "~57.0.1"`, and `"expo-sqlite": "~57.0.1"`. [VERIFIED: package.json:14-22]

**Installation:**

```bash
npx expo install expo-document-picker expo-sharing react-native-quick-crypto react-native-nitro-modules react-native-quick-base64
npx expo prebuild
```

The planner must put a `checkpoint:human-verify` before installing `expo-sharing`, `react-native-quick-crypto`, and `react-native-nitro-modules`: the legitimacy seam returned `SUS` solely because their latest publishes are new. No recommended package reported a postinstall script. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age / downloads signal | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|
| `expo-document-picker` | npm | 2.25M weekly | expo/expo | OK | Approved |
| `expo-sharing` | npm | 2.01M weekly | expo/expo | SUS: too-new | Flagged — human verify before install |
| `react-native-quick-crypto` | npm | 197K weekly | margelo/react-native-quick-crypto | SUS: too-new | Flagged — human verify before install |
| `react-native-nitro-modules` | npm | 1.73M weekly | mrousavy/nitro | SUS: too-new | Flagged — human verify before install |
| `react-native-quick-base64` | npm | 311K weekly | craftzdog/react-native-quick-base64 | OK | Approved |

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: npm registry]

**Packages flagged as suspicious [SUS]:** `expo-sharing`, `react-native-quick-crypto`, `react-native-nitro-modules`; planner inserts a human verification checkpoint before each install. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
Dashboard temporary entry ─┐
                          ├──> Backup landing ──> settings / manual export / restore picker
Launch sweep ──────────────┘             │                         │
                                         │                         v
                                  Backup service          decrypt → parse → validate
                                      │                                  │
                  ┌───────────────────┴────────────┐                     v
                  v                                v              Restore preview
      SQLite export manifest + photos      SAF snapshot writer           │
                  │                                │                     v
                  └──> plaintext/encrypted file ───┘           Merge or Replace confirmation
                                                                         │
                                                                         v
                                             one reconciliation/apply transaction → photos → recency → schedules
                                                                         │
                                                                         v
                                                                    Restore result
```

The UI routes are additive `Backup`, `BackupSettings`, `RestorePreview`, and `RestoreResult`; no navigation bar belongs to this phase. [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:20-34]

### Recommended Project Structure

```text
src/
├── backup/                 # wire types, manifest validation, migration, reconciliation and pure policy
├── services/backup/        # export, SAF storage, rotation, encryption, restore orchestration
├── db/migrations/007-*.ts  # tombstone table
├── db/tombstones-dao.ts    # transaction-body and query primitives
├── screens/                # Backup, BackupSettings, RestorePreview, RestoreResult
└── services/               # one launch-sweep registration adapter
```

### Pattern 1: Validate → preview → one apply transaction

**What:** Do all file I/O, decrypt, JSON parsing, user-version compatibility, duplicate/parent/pair validation, and forward payload migration before the user sees a preview or the database transaction opens. Apply only the already-validated in-memory model in one outer `inWriteTransaction`, composing non-mutexed cores.

**When to use:** Every Merge and Replace-all path. A picker error, wrong passphrase, malformed structure, or unsupported newer format must happen before a write.

**Why:** The shared database mutex is non-reentrant. [VERIFIED: src/db/transaction.ts:12-28] The approved UI contract requires no partial restore and says local data is unchanged on every pre-commit failure. [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:191-199]

### Pattern 2: UID wire relationships, local integer writes

**What:** The backup format carries each row's stable `uid` and child-parent UID fields. The apply service first upserts/resolves parents, builds UID→local-ID maps, then applies children with the local integer FKs.

**When to use:** Contacts/categories/profile before contact children; field definitions before normalized values.

**Why:** Current child tables store local integer FKs, while each mergeable logical row has a stable `uid`. The normalized values explicitly require a contact and field-definition FK. [VERIFIED: src/db/migrations/001-initial.ts:41-179] [VERIFIED: src/db/migrations/006-normalize-custom-field-values.ts:41-51]

### Pattern 3: Tombstone comparison belongs in one pure helper

**What:** Given local row/tombstone and incoming row/tombstone timestamps, decide insert/update/keep/delete. Deletion wins ties; do not distribute timestamp comparisons through DAOs.

**When to use:** Every Merge row type, including a nullable custom-field value as an intentional present row.

**Why:** The future sync milestone reuses this semantic boundary and v1 timestamp precision is seconds. [CITED: .planning/sync-milestone/PHASE-17-SYNC-READINESS.md:21-37] The current value UPSERT preserves the row while writing `NULL`: `"ON CONFLICT(contact_id, field_def_id) DO UPDATE SET value = excluded.value, modified_at = excluded.modified_at"`. [VERIFIED: src/db/field-values-dao.ts:40-80]

### Pattern 4: New verified snapshot before prune / Replace-all

**What:** Generate to a local temporary file, verify by read-back/decrypt/parse, create a distinct SAF file, verify the remote/Saf result, record success, then prune old automatic snapshots. Before Replace-all, reuse this same automatic snapshot operation if a destination is configured.

**When to use:** Automatic backup and pre-Replace safety copy only; never manual share export.

**Why:** The locked retention rule protects the newest verified automatic snapshot and the UI contract separates manual export from health. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:174-183]

### Anti-Patterns to Avoid

- **Cascade-only tombstones:** explicit delete fan-outs remove child UIDs before a contact; read and tombstone children before each delete. [VERIFIED: src/db/purge-dao.ts:186-212]
- **Nested write transactions:** calling a public DAO wrapper from restore's outer transaction can deadlock permanently; extract/use core functions. [VERIFIED: src/db/transaction.ts:12-28]
- **Restoring serialized photo paths:** only export bytes; paths contain local integer IDs and must be regenerated through the photo-storage chokepoint. [VERIFIED: src/services/photos/photo-storage.ts:1-39]
- **Treating a NULL custom value as missing:** it is a durable clear that must export and participate in LWW. [VERIFIED: src/db/field-values-dao.ts:40-80]
- **Counting a shared manual export as protection:** only a verified automatic SAF write changes health. [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:174-183]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Android folder picker / persisted storage grant | Custom Android intent plumbing in a screen | Expo `StorageAccessFramework` adapter | It encapsulates directory grants, SAF URI file creation, and supported SAF operations. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/] |
| Restore file selection | A custom file browser | `expo-document-picker` | The system picker supplies provider-specific selection and cached readable file option. [CITED: https://docs.expo.dev/versions/latest/sdk/document-picker/] |
| Share sheet / content URI translation | Custom `ACTION_SEND` implementation | `expo-sharing` | The official API accepts the local file URL and launches platform share UI. [CITED: https://docs.expo.dev/versions/latest/sdk/sharing/] |
| AES, GCM tag handling, PBKDF2 | JS loops or homemade crypto | RNQC native primitives | A password requires a KDF; native crypto is the required assurance boundary. [CITED: https://margelo.github.io/react-native-quick-crypto/docs/api/hash] [CITED: https://margelo.github.io/react-native-quick-crypto/docs/guides/e2ee-chat] |
| Restore conflict selection | Per-DAO ad-hoc timestamp checks | One pure reconciliation policy module | All entities need same deletion-tie behavior and future sync reuse. [CITED: .planning/sync-milestone/PHASE-17-SYNC-READINESS.md:21-37] |

**Key insight:** the dangerous work is not JSON serialization; it is preserving a complete, validated identity graph while deletions and derived state obey one transaction boundary.

## Common Pitfalls

### Pitfall 1: Losing child tombstones during contact purge

**What goes wrong:** A contact purge deletes interactions, events, fuel, values, and links before their UIDs are captured, so a Merge from another backup resurrects them.

**How to avoid:** In the existing purge transaction, query all hard-deleted mergeable rows first, create each tombstone, then run the current explicit deletes. Exclude only `field_history`. [VERIFIED: src/db/purge-dao.ts:186-212] [CITED: .planning/sync-milestone/PHASE-17-SYNC-READINESS.md:27-37]

### Pitfall 2: Applying an invalid file partially

**What goes wrong:** A duplicate UID, broken parent UID, or duplicate custom-value pair arrives midway through restoration after local writes started.

**How to avoid:** Schema-validate all arrays, require unique UID per entity type, validate every parent relationship, and validate the one `(contactUid, fieldDefUid)` value pair before preview and before `BEGIN`. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md]

### Pitfall 3: Nested transactions during restore

**What goes wrong:** Restore calls public `upsertValue`, `recordTouchpoint`, or similar wrappers while it already owns `inWriteTransaction`, hanging on the non-reentrant mutex.

**How to avoid:** Plan core/wrapper splits before implementation and make restore call only non-mutexed cores inside one outer transaction. [VERIFIED: src/db/transaction.ts:12-28] [VERIFIED: src/db/field-values-dao.ts:57-80]

### Pitfall 4: Corrupting derivations and OS side effects

**What goes wrong:** Restore writes `contacts.last_contact` from the file or restores notification/digest IDs, leaving local derived state inconsistent.

**How to avoid:** Omit the derived scalar from Merge and call the recency recompute after interactions are applied; call existing notification and digest reconcile services after commit. [VERIFIED: src/db/recency-dao.ts:142-173] [VERIFIED: src/services/notifications/notification-schedule.ts:489-525] [VERIFIED: src/services/notifications/digest-schedule.ts:189-200]

### Pitfall 5: Assuming a saved SAF URI is always usable

**What goes wrong:** A provider revokes, moves, or removes the directory; the app claims healthy without a verified write.

**How to avoid:** Treat each due backup as an access probe, preserve configuration for diagnosis, and show the approved lost-folder state on failure. [CITED: https://developer.android.com/training/data-storage/shared/documents-files] [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:174-180]

### Pitfall 6: Reducing encryption to AES without a KDF

**What goes wrong:** A passphrase is used as raw key material or through a weak JS hash loop.

**How to avoid:** Use a versioned native PBKDF2-HMAC-SHA256 parameter set, a random salt, an AES-256-GCM fresh nonce, an authenticated tag, and bind envelope technical metadata as AAD. The iteration count must be benchmarked on the physical Pixel before freeze because it is a security/performance parameter. [CITED: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf] [CITED: https://margelo.github.io/react-native-quick-crypto/docs/guides/e2ee-chat]

## Code Examples

### Restore selection uses a cached local copy

```ts
const selection = await DocumentPicker.getDocumentAsync({
  copyToCacheDirectory: true,
  multiple: false,
});
```

Source: Expo DocumentPicker. The relevant documented values are verbatim: `"copyToCacheDirectory"`, `"true"`, and default `"multiple"` `"false"`. [CITED: https://docs.expo.dev/versions/latest/sdk/document-picker/]

### SAF automatic snapshot sequence

```text
request/retain directory URI → create distinct file → write verified serialized bytes
→ re-read/verify → persist success metadata → prune only older automatic files
```

Source: `StorageAccessFramework` documents `requestDirectoryPermissionsAsync`, `createFileAsync`, `readDirectoryAsync`, and SAF URI-compatible `writeAsStringAsync`. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Dynamic custom-field value columns | Normalized `custom_field_values` identity rows | Migration 006 | Export/reconcile values as normal mutable rows, including clears. [VERIFIED: src/db/migrations/006-normalize-custom-field-values.ts:41-51] |
| No first-party Expo symmetric cipher | Expo Crypto documents AES-GCM, but no documented password KDF | SDK 57 docs | A passphrase design still needs a native KDF boundary. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/crypto/] |
| File-system new API only | Legacy import remains needed for Expo SDK 57 SAF directory operations | current SDK 57 docs | Isolate legacy SAF calls in one adapter, not across screens. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The exact PBKDF2 iteration count can be fixed after a physical-device benchmark while preserving the envelope's versioned parameters. | Common Pitfalls | A too-low cost weakens offline passphrase resistance; too-high cost harms restore UX. |
| A2 | The selected SAF provider may support the native folder-opening action; the adapter needs capability/error fallback. | Architecture Patterns | The UI must retain the approved Files-app fallback rather than claim an in-app folder browser. |

## Open Questions

1. **Which exact encrypted envelope and PBKDF2 parameter version ships first?**
   - What we know: AES-256-GCM and a password KDF are locked; no secret metadata may leak. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md]
   - What's unclear: Benchmark-derived PBKDF2 cost and exact field names are not locked.
   - Recommendation: Define a `formatVersion` plus explicit KDF/cipher parameter object; benchmark on Pixel before the implementation freezes those defaults. [ASSUMED]
2. **How is every historic automatic snapshot identified for safe pruning?**
   - What we know: No in-app history browser is allowed and pruning cannot delete the newest verified snapshot. [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:66-75]
   - What's unclear: SAF listing may not expose friendly stable metadata uniformly.
   - Recommendation: Own automatic filenames with a strict prefix plus timestamp/monotonic collision suffix and parse only files matching that format. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Node tests / tooling | ✓ | `v24.19.0` | — |
| npm | package install / test | ✓ | `11.17.0` | — |
| Expo CLI | prebuild/device build | ✓ | `57.0.15` | — |
| Vitest | pure migration/reconciliation tests | ✓ | `4.1.10` | — |
| TypeScript | type gate | ✓ | `6.0.3` | — |
| New picker/share/native crypto packages | BKP-01/BKP-03 | ✗ | not installed | Wave 0 human verification/install checkpoint |
| Android device bridge (`emu-connect` / configured ADB) | required physical SAF/encryption UAT | ✗ in this shell | — | owner/device-session checkpoint |

**Missing dependencies with no fallback:** a real Android device/provider is required to prove SAF persistence, folder loss behavior, and native encrypted round trip.

**Missing dependencies with fallback:** package installs are routine after the required legitimacy checkpoint.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `4.1.10` [VERIFIED: command output] |
| Config file | `vitest.config.ts` [VERIFIED: repository file listing] |
| Quick run command | `npm test -- src/backup/reconciliation.test.ts` [ASSUMED] |
| Full suite command | `npm test -- --run` [VERIFIED: package.json:38-39] |

The package script is quoted verbatim: `"test": "vitest run"`. [VERIFIED: package.json:38]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| BKP-01 | Manifest includes every exportable table/photo and excludes secrets/history | unit/integration | `npm test -- src/backup/export-manifest.test.ts` | ❌ Wave 0 |
| BKP-02 | Due/change policy, verified-write-before-prune, latest snapshot retained, lost-folder state | unit | `npm test -- src/backup/auto-backup-policy.test.ts` | ❌ Wave 0 |
| BKP-03 | Encrypt/decrypt vectors, wrong passphrase, envelope tamper, passphrase lifecycle | unit + Android smoke | `npm test -- src/backup/encryption.test.ts` | ❌ Wave 0 |
| BKP-04 | Validation rejection is write-free; UID merge, tombstones, same-second deletion, NULL clear, parent mapping, Replace-all | unit/integration | `npm test -- src/backup/reconciliation.test.ts src/backup/restore-apply.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** focused Vitest file(s), `npx tsc --noEmit`, and `npm run check:colors` for screen work. [VERIFIED: package.json:35-39]
- **Per wave merge:** `npm test -- --run`.
- **Phase gate:** full suite, typecheck, colour check, then Android release/device UAT with disposable data and a real SAF provider.

### Wave 0 Gaps

- [ ] `src/db/migrations/007-tombstones.test.ts` — migration/additive upgrade and unique logical tombstone coverage.
- [ ] `src/backup/reconciliation.test.ts` — pure winner/deletion/UID-parent policy.
- [ ] `src/backup/backup-schema.test.ts` — strict parse/forward migration/input graph validation.
- [ ] `src/backup/restore-apply.test.ts` — outer transaction, normalized pair integrity, derived rebuild.
- [ ] `src/backup/auto-backup-policy.test.ts` — due/change/rotation and health semantics.
- [ ] `src/backup/encryption.test.ts` — parameterized envelope vectors and lifecycle fake backend.
- [ ] Physical Android UAT — SAF folder choice, persisted write, provider loss, manual share, encrypted restore, Merge and Replace-all.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V1 Architecture | yes | Local-only file operations; no network/sync introduced. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |
| V2 Authentication | no | No account/authentication flow is in scope. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |
| V3 Session Management | no | No remote/session state is in scope. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |
| V4 Access Control | yes | User-selected SAF grant only; validate it at use time. [CITED: https://developer.android.com/training/data-storage/shared/documents-files] |
| V5 Input Validation | yes | Strict untrusted backup parser, array/UID/parent/pair validation before any write. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |
| V6 Cryptography | yes | Native PBKDF2 + AES-256-GCM, random salt/nonce, authenticated envelope; no custom JS crypto. [CITED: https://margelo.github.io/react-native-quick-crypto/docs/api/hash] |
| V8 Data Protection | yes | Exclude API keys/key material/history, cache passphrase only in SecureStore, never log plaintext/passphrases. [VERIFIED: src/services/ai-key-store.ts:1-22] [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |
| V10 Error Handling | yes | Typed, calm user errors; technical/provider details remain private; no state change claim on failure. [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:196-199] |

### Known Threat Patterns for the stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Malformed or adversarial backup graph | Tampering | Full structural validation before preview/write; reject whole file. [CITED: .planning/phases/17-backup-export-restore/17-CONTEXT.md] |
| Wrong passphrase / ciphertext modification | Tampering / Information disclosure | AES-GCM authenticated decryption; do not expose preview content until it succeeds. [CITED: https://docs.expo.dev/versions/v57.0.0/sdk/crypto/] |
| Path traversal in serialized photo path | Tampering | Do not restore paths; persist regenerated files through allowlisted photo storage. [VERIFIED: src/services/photos/photo-storage.ts:32-39] |
| SAF grant loss/provider failure | Denial of service | Retain diagnostic configuration, show lost-folder state, never falsify health. [VERIFIED: .planning/phases/17-backup-export-restore/17-UI-SPEC.md:174-180] |
| Tombstone omission / stale row resurrection | Tampering | Tombstone every hard-deleted mergeable UID in same transaction; deletion wins timestamp ties. [CITED: .planning/sync-milestone/PHASE-17-SYNC-READINESS.md:27-37] |

## Sources

### Primary (HIGH confidence)

- [Expo FileSystem legacy SAF](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/) — Android folder selection, SAF URI file operations.
- [Expo DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/) — system file selection and cached copies.
- [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) — local-file share sheet.
- [Android SAF documentation](https://developer.android.com/training/data-storage/shared/documents-files) — persistent grant limits and provider-controlled documents.
- [RNQC README](https://github.com/margelo/react-native-quick-crypto/blob/main/README.md) and [implementation coverage](https://github.com/margelo/react-native-quick-crypto/blob/main/.docs/implementation-coverage.md) — Expo integration and PBKDF2 support.
- [NIST SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) — PBKDF2 password-based key derivation.
- In-repo source-of-truth migration, DAO, transaction, photo, launch-sweep, UI-spec, and sync-readiness files cited inline.

### Secondary (MEDIUM confidence)

- [Expo Crypto SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/) — AES-GCM API and the need for a separate documented KDF.
- [RNQC AES-GCM guide](https://margelo.github.io/react-native-quick-crypto/docs/guides/e2ee-chat) — native AES-GCM/nonce example.

### Tertiary (LOW confidence)

- None; the two implementation assumptions are isolated in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM — Expo/Android APIs are official; RNQC requires the mandated human package verification checkpoint.
- Architecture: HIGH — derived from locked decisions and current source-of-truth DAOs/migrations.
- Pitfalls: HIGH — explicit hard deletes, non-reentrant transaction behavior, and UI safety states were source-audited.

**Research date:** 2026-08-25
**Valid until:** 2026-09-01 for mobile package/platform details; locked in-repo architecture remains valid until superseded.
