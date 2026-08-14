# Dossier 15 — `backup` — Backup, export & data portability

**Status:** in-progress · Interrogated 2026-08-14 · Round 1 recorded · Investigation complete

## Scope

How a user's entire Orbit dataset leaves the device and comes back: the export format and
its scope (which tables, settings, and on-disk files), the delivery mechanism (manual
share vs automatic folder backup), optional at-rest encryption, and restore semantics
(merge vs replace, conflict resolution, schema-version compatibility). This is HANDOFF §3's
`[OPEN]` backup item and §8's anti-lock-in differentiator. It is **load-bearing, not a
chore**: `android:allowBackup="false"` (01-data cluster G) plus deletion-on-uninstall means
export is the *only* barrier between a wiped phone and total, unrecoverable loss (there is
no server, no remote access, no Auto Backup).

This domain is a **consumer** of schema decided across domains 01/03/04/06/07/09/11/12/13/14;
it owns the export/restore machinery and its UX, not the schema those domains fixed. The
settings *screens* as a whole are cross-cutting and assembled from other domains' decisions;
they are not re-interrogated here.

**No plugin predecessor.** The Obsidian plugin has no backup/export/import feature — its
markdown vault files *were* the portable format. Its one JSON writer (`OrbitIndex.ts:366`
`saveStateToDisk`) is a **lossy, derived, read-only** flat-contacts dump written for AI
agents to read (contacts + derived status only; no interactions, fuel, custom fields, or
restore path). Backup owes nothing to a port.

---

## Decisions

### Cluster A — Getting data out (delivery & safety net)

**[DECIDED] v1 ships BOTH a manual on-demand export AND an automatic rotating backup to a
user-picked folder.** Manual = a share-sheet export (`expo-sharing`) the user fires anytime.
Auto = a backup written to a folder the user grants once, rotated, on an app-launch sweep.
Rationale (owner): export is the only barrier to total loss, and a backup the user must
remember to make is the one that never gets made — the same friction that killed the plugin
cuts here too, so the loss-barrier deserves the unattended version, not just a button.
Platform-verified: the SAF directory grant persists across app kill and reboot
(`takePersistableUriPermission`, native source), so "auto" means *no per-write prompt* and
runs at launch — **not** a background daemon running while the app is closed (that is neither
needed nor reliable; it matches the existing DB launch-sweep pattern).
**[REJECTED] Manual export only** — leanest, but relies on the user remembering; highest
silent-loss risk. **[REJECTED] Auto-to-folder only** — loses the ad-hoc "send me a copy now"
(e.g. before a risky action or a phone swap).

**[DECIDED] "Cloud backup" is not a separate integration — it is the auto folder pointed at a
cloud-synced directory** (Drive/Nextcloud folder), or a manual share to a cloud app. No
OAuth, no Drive API, no Orbit server. This satisfies HANDOFF §3's "encrypted backup to the
user's own cloud" candidate without any cloud code.

**[DECIDED] The app nudges the user to back up when a backup is overdue.** A gentle in-app
reminder (and/or a first-run prompt) when there is no recent backup.
Rationale (owner): export is the only thing between a wiped phone and total loss, and a
manual backup is exactly what a busy user skips — the friction-death premise (HANDOFF §6)
applied to backup. The nudge is calm and no-obligation, consistent with the product's tone.
**[REJECTED] One-time onboarding mention only** — respects calm, but accepts that some users
never back up their only copy. **[REJECTED] Silent, settings-only** — leanest, highest
silent-loss risk; rejected precisely because this feature is the loss backstop.
*Deferred to phase discussion:* the nudge's exact channel (in-app banner vs a notification
type on 11's settings), its "overdue" threshold, and whether it counts unbacked-up *changes*
or elapsed days.

**[DECIDED] Auto-backup keeps a rolling ~week of copies, writing at most once per day.** The
launch sweep writes a new dated file only if data changed since the last backup, and prunes
to roughly the last 7. Recover from up to a week-plus back without unbounded storage growth.
Rationale: single-latest gives no depth (a bad state backed up over a good one is
unrecoverable), and a user-configurable count adds a settings knob for little gain at this
data scale. The retention count and the write cadence are **tunable constants at the top of
the backup service** (CLAUDE.md convention), so tuning is a one-number edit.
**[REJECTED] Keep only the latest** — minimal storage, zero history depth. **[REJECTED]
User-configurable count** — most control, but a settings surface and more storage to reason
about for negligible benefit at tens of contacts.

### Cluster B — Encryption / at-rest safety of the export file

**[DECIDED] Encryption is OPTIONAL and OFF by default: plaintext JSON by default, with a
toggle to encrypt the backup with a user-set passphrase (AES-256-GCM).**
Rationale (owner, risk/security bucket): plaintext-by-default keeps the export portable,
human-readable, and trivially restorable — it *is* the anti-lock-in feature — while the
toggle covers users who consider the file sensitive. The file holds third-party phone
numbers and private notes, and SAF backups land **outside** the `allowBackup=false` sandbox,
readable by any app with storage access, so encryption is a genuine, offered protection —
just not forced. Platform-verified buildable: `expo-crypto` v55 (SDK 57 line) ships
AES-256-GCM natively; the only missing piece is a passphrase key-derivation (PBKDF2), sourced
from a small JS impl or `react-native-quick-crypto` (feasibility "Moderate", the app already
ships a custom dev client so a native crypto dep is low marginal risk).
**[REJECTED] Always encrypted (mandatory passphrase)** — strongest for the PII, but a
forgotten passphrase means unrecoverable loss (no server to reset it), and it turns the
anti-lock-in export into an opaque blob only Orbit can read, defeating §8's differentiator.
**[REJECTED] Plaintext only, no encryption in v1** — leanest and most portable, but given the
outside-sandbox exposure it leaves the sensitive default with no in-app protection at all.
*Load-bearing caveat, recorded:* a lost passphrase is unrecoverable by construction. The
encrypt flow must state this at the moment the passphrase is set.

**[DECIDED] When encryption is ON, the unattended auto-backups are encrypted too, reusing a
passphrase cached in the Keystore.** The passphrase is stored in `expo-secure-store` so the
app-launch sweep can encrypt without a prompt; consistent protection across manual and auto.
Rationale (owner, risk bucket): otherwise the toggle would protect the copy made *least*
(manual) while the copies made *most* (the auto folder, sitting outside the sandbox) stay
plaintext — the opposite of the intent. The cached passphrase is Keystore-backed, deleted on
uninstall, and never written into any backup (same rule as the AI API keys).
**[REJECTED] Only manual exports encrypt** — no stored passphrase, simpler threat model, but
leaves the everyday unattended copies unprotected. **[REJECTED] Encryption disables
auto-backup** — forces an either/or between "automatic" and "encrypted"; the owner wanted
both.

### Cluster C — Getting data back in (restore)

**[DECIDED] Restore offers BOTH modes, with Merge as the default.** Merge adds/updates rows
by their stable id and never loses current logging; Replace-all wipes the DB and loads the
file (the clean move-to-a-new-phone flow).
Rationale: the stable-globally-unique-id groundwork on every user-data table (04-log
`[log → all]`) exists for exactly this. Offering Replace-all as the *non-default second
option* does **not** reverse 04-log's `[REJECTED] replace-ONLY restore` — replace-only meant
wipe-and-load as the *sole* mechanism, which would destroy months of logging when restoring
an old backup; here Merge is the default and Replace is an explicit, labelled choice.
**[REJECTED] Merge only** — safest, but leaves the intuitive "new phone, put it all back"
with no clean-slate path. **[REJECTED] Replace-all only** — this is 04-log's already-rejected
option; not adopted.

**[DECIDED] Merge conflict resolution is NEWEST-EDIT-WINS, per row.** When the same stable id
exists on the device and in the backup with differing contents, the more recently modified
version is kept.
Rationale (owner): the most recent edit is the truthful one — a correction should win whether
it lives on the device or in the backup.
⚠️ **Schema ripple, exported below:** newest-wins requires a comparable **`modified_at`
timestamp on every mergeable row** (contacts, interactions, events, fuel, categories,
`custom_field_defs`, `contact_custom_values`, the self record, `contact_links`). Neither
01-data nor 04-log provisioned this; it must be added in **migration 1** (it cannot be
backfilled truthfully, like the uid) and maintained by every writer. This is a new
data-model requirement, not merely a backup detail.
**[REJECTED] Backup wins (incoming overwrites)** — predictable, but a good on-device edit made
after the backup is silently lost. **[REJECTED] Device wins (file fills gaps only)** — safest
against surprise loss, but a correction that lives only in the backup can never come back.

### Cluster D — The backup file: scope, format & compatibility

**[DECIDED] Restore migrates an OLDER backup forward and REJECTS a newer-than-app backup.**
The export carries a `PRAGMA user_version` stamp. An older backup is run forward through the
same forward-only migration sequence and restores cleanly; a backup stamped newer than the
running app is refused with an "update Orbit first" message rather than loaded unsafely.
Rationale: the export is the loss backstop, so "your old backup always restores" is the whole
point; the forward-only migration engine (HANDOFF §3) is exactly the mechanism, so this reuses
it rather than inventing a second compatibility path. Refusing a newer backup prevents an old
app from silently dropping fields it doesn't understand or violating invariants a later
migration established.
**[REJECTED] Exact-version match only** — simplest, but any migration makes every older backup
unrestorable, gutting the loss barrier. **[REJECTED] Best-effort, ignore unknown fields** —
lenient, but a newer backup on an older app silently loses data.
*Note:* the export format is therefore **versioned data at a known `user_version`**, not a
version-independent logical schema. Restore = parse → (if older) migrate forward → merge.

**[DECIDED] The export is FULL app state (all non-secret settings), not data-only.** Beyond the
relationship tables it includes the ~14 non-secret app-level settings: theme, notification
master + per-type toggles + lock-screen visibility, digest on/off, sun assignment +
self-sun colour, custom categories, and non-secret AI settings (provider, model, prompt
template, HTTPS endpoint URL, `share_with_ai` field flags). A restored device comes back
configured. API keys remain excluded (re-entered per device); derived notification/digest
schedules are re-registered on restore, never exported.
Rationale: a device migration should restore the app, not just the rows; the settings are
tiny next to the photo payload, and leaving them out means hand-reconfiguring on every new
phone. **[REJECTED] Relationship-data-only** — leaner file, rougher migration.

**[DECIDED] Readable plaintext JSON IS the anti-lock-in guarantee; no second export format in
v1.** The backup's structure is documented well enough that a determined user or tool can read
it, but it is a **versioned snapshot that tracks the schema** (which is why restore migrates)
— not a frozen public contract.
Rationale (owner, positioning): plaintext-by-default already answers the lock-in complaint
§8 positions against; a spreadsheet-friendly CSV is a real "get your data out" gesture but
can't round-trip photos or custom fields, so it would be a second, lossy format to build and
maintain for a v1 whose user is the owner. Kept as an obvious later addition.
**[REJECTED for v1] Also ship a CSV export** — strongest portability gesture, but a second
format that can't represent the full model; revisit post-v1. **[REJECTED] Internal
round-trip only (undocumented)** — leanest, but the weakest possible answer to the exact
lock-in complaint the product is positioned against.

**[DECIDED] `field_history` (the custom-field undo buffer) is EXCLUDED from the export.**
Resolves the "(decide)" 01-data left on this (01-data:461-463 / HANDOFF §14.6).
Rationale: it is a transient 30-day buffer swept at launch, and its rows reference field defs
and values a merge may not preserve, so restoring stale undo history is incoherent. A restored
device starts with clean history; the **actual custom-field data still restores fully** — only
the in-flight *undo* for a very recent quarantine/type-change is not carried across a restore.
**[REJECTED] Include it** — would preserve in-flight undo across a device migration, but adds
a table whose foreign references must survive merge for a narrow, low-value window.

---

## Cross-domain constraints exported

- **[backup → data / log / ALL]** ⚠ **New migration-1 requirement: a `modified_at` timestamp
  on every mergeable row** (contacts, interactions, events, fuel, categories,
  `custom_field_defs`, `contact_custom_values`, the self record, `contact_links`), maintained
  by every writer. The newest-edit-wins merge rule (Cluster C) has no other way to resolve a
  conflict. Like the uid/`created_at`/`recorded_at`/`ring_seq`, it **cannot be backfilled
  truthfully**, so it must exist from the first migration. Neither 01-data nor 04-log
  provisioned it.
- **[backup → data]** The globally-unique **uid must be a distinct column from the local
  primary key.** Merge keys on the uid across devices; a per-device autoincrement PK is not
  portable. This resolves an ambiguity 01-data (surrogate PK) and 04-log (globally-unique id
  on every table) never reconciled — recommend the uid be an app-generated UUID, PK stays a
  local integer.
- **[backup → log / data]** Restore **recomputes `contacts.last_contact` as MAX over the
  restored interaction rows** and never loads it as authoritative — reaffirms `[log → backup]`.
  A backup missing interaction rows silently relocates those contacts to the never-contacted
  screen, so a partial/older backup restored as Merge is safe (rows are added) but Replace-all
  of a lossy backup is not — the restore-preview must show interaction counts.
- **[backup → fields]** Restore must **recreate each dynamic `contact_custom_values` column via
  `ALTER TABLE ADD COLUMN` from the restored defs BEFORE loading values**, and must **never add
  an index or UNIQUE** to them (would break §14's quarantine-expiry `DROP COLUMN`). Quarantined
  defs restore with `quarantined_at` intact so the launch sweep still expires them on schedule.
- **[backup → photos]** Restore writes embedded base64 photo bytes to **fresh files under the
  document dir and repoints the relative path column**; stored paths are never restored
  verbatim — reaffirms `[photos → backup]`. Covers contact photos, the self photo, and custom
  `photo`-field files.
- **[backup → ai]** **API keys are never in the export** (reaffirms `[ai → backup]`); the
  non-secret AI settings (provider, model, template, HTTPS endpoint URL, `share_with_ai` flags)
  **are**. On restore the user re-enters each provider key once.
- **[backup → notify / digest]** The decay/birthday notification schedules and the weekly
  digest `WEEKLY` trigger are **re-registered by the launch reconcile after restore, never
  exported** — reaffirms `[notify → backup]` and `[digest → backup]`. Only the on/off toggles
  and visibility settings travel in the file.
- **[backup → crud / self]** The manual export is **whole-database only** — no per-contact or
  subset export in v1. Purge-parity still holds elsewhere; this only fixes export granularity.
- **[backup → planning / launch-sweep]** The **auto-backup rotation write is added to the
  existing app-launch sweep** (beside quarantine expiry, history retention, archived-contact
  purge, and schedule reconcile), gated on "data changed since last backup" and once/day.
- **[backup → security posture]** The plaintext-by-default backup written via SAF lands
  **outside the `allowBackup=false` sandbox**, readable by any app with storage access — a real
  egress surface the app otherwise has none of. Encryption is the opt-in mitigation; this is
  recorded so the default is a conscious posture, not an oversight.

## Deferred to phase discussion

- The nudge's exact channel (in-app banner vs a fourth notification type on 11's settings), the
  "overdue" threshold, and whether it counts unbacked-up *changes* or elapsed days.
- Passphrase-set UX: the unrecoverable-loss warning at set time, confirm-entry, an optional
  hint, and whether to discourage weak passphrases.
- The **Replace-all restore confirmation** — it is destructive; mirror 06-crud's purge
  impact-summary confirm ("this replaces N contacts, M interactions…").
- A **restore preview**: show a backup's contents (exported-at date, row counts, encrypted?)
  before committing, so the user isn't restoring blind.
- Where backup lives in Settings, the "Back up now / choose folder / view backups" surface, and
  the first-run backup prompt copy.

## Deferred to phase planning

- **Identity split:** implement the uid as an app-generated UUID column distinct from the local
  PK (see the export above); confirm every writer stamps uid + `modified_at`.
- **Manual export:** new File API write to `Paths.cache` + `Sharing.shareAsync(uri, {mimeType:
  'application/json'})`. Do **not** hand-roll a `content://` (FileProvider meta-data bug
  expo/expo#39056 — expo-sharing does the conversion).
- **Auto/SAF:** `StorageAccessFramework` is **legacy-only** — `import { StorageAccessFramework }
  from 'expo-file-system/legacy'`; there is no new-API equivalent, so isolate and label that
  import. Store the persisted `directoryUri` (grant survives reboot via
  `takePersistableUriPermission`); `createFileAsync` + `writeAsStringAsync`; rotate via
  `readDirectoryAsync`. **Flat files only** — Android 11+ scoped storage forbids the
  shared-storage root, so the user picks a sub-folder (subdir traversal is buggy, expo#20102).
- **Restore read:** `getDocumentAsync({type:'application/json'})` returns an **evictable cache
  copy** — read immediately (`new File(uri).text()` → `JSON.parse`), validate by parse (Drive
  may report `application/octet-stream`), never stash the uri.
- **Encryption:** `expo-crypto` v55 AES-256-GCM (`aesEncryptAsync` / `AESSealedData`) for the
  cipher + a PBKDF2 for passphrase→key (small JS impl, or `react-native-quick-crypto@1.1.6`
  which bundles KDFs + AES-GCM natively — pin its min-RN / `sodiumEnabled` first). Cache the
  passphrase in `expo-secure-store` for unattended auto-encrypt. On-device confirm items: share
  `application/json` from cache to Drive; whether new-API `.write()/.copy()` are sync-blocking.
- **Export assembly:** per-table `SELECT *` + base64 photo embed + a **format header** (schema
  `user_version`, app version, exported-at local datetime, encrypted flag, per-table row counts).
- **Restore engine:** parse header → verify `user_version` (**migrate an older payload forward,
  reject a newer one**) → decrypt if needed → recreate dynamic custom columns from defs → Merge
  (newest-`modified_at`-wins, keyed on uid) or Replace-all → recompute `last_contact` (MAX) →
  write fresh photo files + repoint paths → re-register notification/digest schedules.
- Rotation **tunables** (retention count, write cadence) at the top of the backup service.

## Decisions made without you

*(Trivia the orchestrator picked — veto any at review. Read each as the decision AS ADOPTED.)*

1. **Manual export is whole-database only** — no per-contact/subset export in v1 (no use case;
   privacy leans against sharing one contact's record as a file).
2. **Filenames are date-stamped** via `formatLocalDate()` (e.g. `orbit-backup-2026-08-14.json`,
   `.json.enc` when encrypted, `-2` suffix on same-day collision) — never
   `toISOString().split('T')` (CLAUDE.md date rule).
3. **A single self-contained file** (photos base64-embedded), not a JSON+photos zip — the safer
   default for a non-technical restore (confirms 07-photos cluster E).
4. **Restore under Merge is idempotent** — re-importing the same backup is a no-op (uid +
   newest-wins), so a nervous user can restore twice safely.
5. **A format header/manifest tops the file** (schema `user_version`, app version, exported-at,
   encrypted flag, per-table row counts) so restore validates *before* touching the DB and the
   restore-preview reads counts without decrypting the whole payload.
6. **The auto-backup write folds into the existing launch sweep**, not a separate scheduler
   (matches the DB quarantine/history/purge sweep pattern; no background daemon).

## Findings

Investigation 2026-08-14. The orchestrator read the plugin's only JSON writer in full
(`OrbitIndex.ts:355-423`), confirmed there is **no backup/export/import feature** to port
(`saveStateToDisk` is a lossy, derived, read-only AI-agent state dump — no interactions, fuel,
custom fields, or restore path), and read the settings interface (`settings.ts:1-77`). Three
subagents produced workpapers; **every load-bearing platform claim below was re-verified
first-hand** (the `expo-crypto` AES-GCM addition was confirmed against the package CHANGELOG
directly), per CLAUDE.md "Review the code, not the diff."

**Platform facts established (Expo SDK 57 / `expo@57.0.12` / RN 0.86 — current GA):**
- Manual export = `expo-sharing` share sheet, works from the sandbox on the new File API;
  don't hand-roll `content://` (expo#39056). *(`platform-file-io.md`.)*
- SAF (write into a user-picked folder / auto-backup) is **legacy-import-only** on SDK 57; the
  persisted directory grant is **real and durable across reboot** (verified in native source),
  so "auto" = a launch sweep with no per-write prompt, not a while-closed daemon. Android 11+
  forces a user-picked sub-folder and flat files. *(`platform-file-io.md`.)*
- Restore read = `getDocumentAsync` returns an evictable cache copy; read immediately, validate
  by parse. *(`platform-file-io.md`.)*
- Encryption is buildable ("Moderate"): **`expo-crypto` v55 (2026-01-21, in the SDK 57 line)
  ships AES-256-GCM** but **no KDF**; a passphrase route adds a PBKDF2 from a JS impl or
  `react-native-quick-crypto@1.1.6`. `expo-secure-store` (2 KB cap) is for the passphrase/keys,
  not the multi-MB blob; Hermes still has no `crypto.subtle`. *(`platform-encryption.md`.)*

**Export-manifest reconciliation (`export-manifest-audit.md`):** 10 SQLite tables + 3 photo
file-classes + ~14 non-secret app settings EXPORT; API keys and `field_history` EXCLUDE;
`contacts.last_contact` is the sole stored-but-derived value that must be recomputed not
restored; status/gravity/intensity/progress are never stored so backup ignores them;
notification/digest schedules are derived and re-registered.

**Dossier disagreements flagged (carried into the exports above):**
1. 01-data's export list (`01-data.md:461-463`) is an **incomplete early sketch** — it omits
   fuel, events, `contact_links`, the reminders-off mute, notification settings, self-sun
   colour, AI settings and the digest toggle. This dossier's manifest is the reconciled
   superset; an implementer must not trust 01-data's list alone.
2. **`field_history` in the export** was genuinely OPEN in 01-data; resolved here → **exclude**.
3. **surrogate PK vs globally-unique uid** — never reconciled by 01-data/04-log; resolved here
   → they are **distinct columns**, merge keys on the uid (exported to data/planning).

**Workpapers** (`docs/dossier/workpapers/15-backup/`):
- `platform-file-io.md` — export/import/SAF mechanics, versions, URLs, native-source citations.
- `platform-encryption.md` — cipher/KDF options, `expo-crypto` v55, RNQC feasibility.
- `export-manifest-audit.md` — the full column-by-column EXPORT/EXCLUDE/DERIVED manifest and
  restore-hazard list, with file:section citations.
