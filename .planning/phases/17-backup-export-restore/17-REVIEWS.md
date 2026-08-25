---
phase: 17
reviewers: [codex, claude]
reviewed_at: "2026-08-25T09:53:19.247Z"
plans_reviewed:
  - .planning/phases/17-backup-export-restore/17-01-PLAN.md
  - .planning/phases/17-backup-export-restore/17-02-PLAN.md
  - .planning/phases/17-backup-export-restore/17-03-PLAN.md
  - .planning/phases/17-backup-export-restore/17-04-PLAN.md
  - .planning/phases/17-backup-export-restore/17-05-PLAN.md
  - .planning/phases/17-backup-export-restore/17-06-PLAN.md
  - .planning/phases/17-backup-export-restore/17-07-PLAN.md
  - .planning/phases/17-backup-export-restore/17-08-PLAN.md
  - .planning/phases/17-backup-export-restore/17-09-PLAN.md
  - .planning/phases/17-backup-export-restore/17-10-PLAN.md
  - .planning/phases/17-backup-export-restore/17-11-PLAN.md
  - .planning/phases/17-backup-export-restore/17-12-PLAN.md
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-sonnet-5"
model_sources:
  codex: "banner"
  claude: "native"
---

# Cross-AI Plan Review — Phase 17

> **Note on codex reasoning effort:** the `gsd-review` reviewer-lane runner resolved
> Codex's effort to `low` for this run (confirmed in `gsd-review-codex.err`: `reasoning
> effort: low`), not the `high` configured as this host's interactive default in
> `~/.codex/config.toml`. This is an artifact of `gsd-tools`' own review-lane effort
> resolution (it derives effort from the `gsd-plan-checker` agent profile via
> `resolve-execution`, which currently resolves to `low` under this project's
> `model_profile: "quality"`), not something this reviewer session requested or
> overrode. The resulting Codex review is still source-grounded, cites real
> `file:line` evidence, and its findings were independently verified against the
> actual code below — but the owner may want to look at why the review lane's
> effort resolution disagrees with the configured interactive default.

## Consensus Summary

Both reviewers independently read the actual Phase 16 source (not just the plans) and
converge on the same core assessment: the phase's ordering and architecture are sound
— tombstones before export, export before restore, encryption isolated behind a
service, UI deferred until the engine exists — and the hard-delete-writer audit that
migration 007 (17-02/17-03/17-04) is built on is **verified accurate** against the real
code (`recency-dao.ts`, `fuel-dao.ts`, `contact-links-dao.ts`, `field-ddl.ts`,
`purge-dao.ts`; events have no standalone delete, only purge fan-out). Both reviewers
also converge on the same two structural gaps as the highest-risk items: **export lacks
a defined read-consistency mechanism**, and **restore writes photos after the DB commit
with no staging**, which together threaten the phase's two central promises (a faithful
backup and a safe, all-or-nothing restore).

### Agreed Strengths
- The migration-007 tombstone audit is grounded in the real write paths, not assumed;
  both reviewers separately traced every `DELETE FROM` in `src/db/*.ts` and got the
  same closed set.
- The core/wrapper transaction-composition discipline (`inWriteTransaction` non-
  reentrant mutex, non-mutexed cores for composition) is correctly understood and
  correctly reused by the restore/tombstone plans.
- Custom-field NULL-clear semantics (a durable row, not absence) are correctly
  identified as requiring export/reconcile, matching ADR-001.
- Photo paths are correctly treated as untrusted on restore — bytes are re-persisted
  through the existing crash-safe `photo-storage.ts` chokepoint rather than trusting
  serialized paths.

### Agreed Concerns
- **[HIGH]** No read-snapshot/isolation mechanism is defined for export (17-05), yet
  the plan's own must-haves assert a "consistent SQLite read snapshot." `SqlExecutor`
  (`src/db/types.ts`) exposes only unmutexed reads and the one write mutex
  (`src/db/transaction.ts`); nothing currently gives export isolation from a
  concurrent write (a foreground automatic-backup sweep, a user edit, a launch-time
  field sweep).
- **[HIGH]** Restore (17-08) persists photo bytes and rebuilds schedules **after** the
  database commit, with failures only "typed and logged privately." `persistMaster`
  (`photo-storage.ts:141-194`) can throw. A post-commit photo failure leaves committed
  contact/value rows pointing at photo files that were never written, which is a real
  data-integrity risk the plan does not define a compensation or recovery contract for.
- **[MEDIUM]** Fuel/link hard-delete cores need call-site changes the plan's declared
  file list omits (see Claude review below for the concrete file:line evidence);
  reconciliation's entity-policy registry should explicitly name every mergeable UID
  table, not just the ones with hard-delete writers.

### Divergent Views
- Codex additionally flags the `app_settings.sun_contact_id` `ON DELETE SET NULL` /
  `modified_at` interaction as HIGH (17-08); Claude's review independently verified
  this against `003-orrery-settings.ts` and `app-settings-dao.ts` and concurs it is a
  real, unaddressed gap — this is not actually divergent, both reviewers land on the
  same finding via different entry points, and it is folded into the HIGH list below
  rather than kept separate.
- Claude's review places somewhat more weight on the **plan-file-scope gap** for the
  fuel/link timestamp threading (concrete production call sites outside the declared
  `files_modified` lists) as a planning-process risk distinct from the underlying
  correctness risk codex names; both are the same root concern from different angles.

---

## Codex Review

The phase is thoughtfully sequenced around data integrity: tombstones and deletion coverage precede export; export/validation precede restore; encryption and SAF are isolated behind services; UI is delayed until core behavior exists. The plans correctly recognize the repository’s non-reentrant write transaction constraint and existing UID-based normalized model. However, two correctness-critical seams need explicit design before implementation: a consistent export snapshot, and restore/photo atomicity. There is also an unresolved portable-settings reference case when a sun contact is tombstoned.

### Strengths

- The deletion audit is largely grounded in the real write paths. Production hard deletes are in:
  - interactions: `src/db/recency-dao.ts:308`
  - fuel: `src/db/fuel-dao.ts:225`
  - links, including the edit-form diff path: `src/db/contact-links-dao.ts:136`, `src/db/contact-links-dao.ts:198`
  - permanent field/value deletion: `src/db/field-ddl.ts:101`
  - contact purge’s explicit fan-out: `src/db/purge-dao.ts:169`.

  Plans 17-02 through 17-04 cover these. Events have no standalone deletion API; their sole production removal is purge, as documented in `src/db/events-dao.ts:5`.

- The plans correctly preserve the transaction composition model. `inWriteTransaction` uses a non-reentrant mutex and explicitly forbids nesting (`src/db/transaction.ts:12`). Plans 17-04, 17-08, and 17-12 appropriately propose non-mutexed cores for restore composition.

- Plan 17-08 correctly avoids importing derived recency. `last_contact` is explicitly derived from current interactions and is the sole recency writer (`src/db/recency-dao.ts:142`). Recomputing it after restore is the correct direction.

- The normalized-value semantics are accurately recognized. A value row has stable UID, nullable TEXT value, and uniqueness by contact/field pair (`src/db/migrations/006-normalize-custom-field-values.ts:41`). Thus treating `NULL` as a retained clear rather than an absent row is correct.

- The plans correctly avoid trusting serialized photo paths. Existing storage accepts guarded relative names and writes through a crash-safe replacement flow (`src/services/photos/photo-storage.ts:141`); it also states that DB paths must be relative, not cache/absolute URIs (`src/services/photos/photo-storage.ts:4`).

- Plan 17-06’s launch-sweep integration is appropriate. The sweep only runs after the app is ready and only on real foreground launches (`src/services/launch-sweep.ts:93`); `App.tsx` registers current hooks before installing the trigger (`App.tsx:129`).

- Plan 17-12’s SecureStore separation matches an established repository pattern: AI keys are deliberately excluded from SQLite/export surfaces (`src/services/ai-key-store.ts:2`).

### Concerns

#### 17-01 — Package provenance gate

- **LOW:** The plan calls for an Expo/native install but does not explicitly require verifying resulting Expo config-plugin changes or a clean Android prebuild diff. This matters because the current application is Expo-managed and has native imports already concentrated in app bootstrap (`App.tsx:1`). Approval of npm metadata alone does not prove the installed native configuration is compatible.

#### 17-02 — Migration 007 and purge tombstones

- **MEDIUM:** The plan needs an explicit closed `entity_type` vocabulary and migration-level `CHECK` or equivalent DAO enforcement. The schema currently has UIDs on categories, profile, contacts, children, and field definitions (`src/db/migrations/001-initial.ts:41`); a generic string type without a closed vocabulary makes omissions and typos silently non-reconcilable.

- **MEDIUM:** Purge must capture UIDs before deletion, not just add tombstones around current DELETE statements. The current purge initially reads only `archived_at` (`src/db/purge-dao.ts:176`) and deletes children immediately (`src/db/purge-dao.ts:186`). The plan says this conceptually, but acceptance tests should assert every captured UID/type, including values and events.

#### 17-03 — Standalone interaction, fuel, and link deletes

- **HIGH:** Fuel and direct-link deletion APIs currently do not receive a deletion timestamp: `deleteFuel` receives only `{id, contactId}` (`src/db/fuel-dao.ts:267`) and `removeLink` does likewise (`src/db/contact-links-dao.ts:178`). The plan requires timestamped tombstones but does not state how callers and `applyLinkDiff` will supply a local-wall-clock `now`. Add this to interfaces and every relevant UI call site, or inject a clock at the DAO boundary.

- **MEDIUM:** The plan should explicitly test `applyLinkDiff`, not only standalone `removeLink`. The diff path calls the same core directly inside a transaction (`src/db/contact-links-dao.ts:229`); a wrapper-only test could miss the compositional path.

#### 17-04 — Field tombstones and reconciliation policy

- **MEDIUM:** The plan should specify tombstone behavior if a permanent field delete is attempted with a stale/missing definition. Current `dropFieldValues` deletes by ID without asserting definition deletion count (`src/db/field-ddl.ts:117`). A tombstone should never be written for an entity that was not actually removed.

- **MEDIUM:** The reconciliation API must include deterministic policy for immutable event rows and categories/profile, not just generic “mutable rows.” These are mergeable UID-bearing records (`src/db/migrations/001-initial.ts:41`), and future sync reuse needs a complete entity-policy registry.

#### 17-05 — Plaintext export

- **HIGH:** “Consistent SQLite read snapshot” is asserted but no mechanism is planned. `SqlExecutor` exposes raw reads and raw `execAsync`, but has no read-snapshot abstraction (`src/db/types.ts:17`). Existing writers are serialized only through the write mutex (`src/db/transaction.ts:42`); an export issuing sequential table reads without an explicit snapshot can produce an internally inconsistent relationship graph during concurrent writes. Define and test a read-snapshot service/transaction, including its interaction with the shared connection and photo byte reads.

- **MEDIUM:** Export must define behavior for a photo DB reference whose local file has been removed or is unreadable. The existing photo deletion is best-effort (`src/services/photos/photo-storage.ts:196`), so this state is possible. Silently omitting bytes creates a backup that cannot satisfy “full state”; aborting with a calm repair-needed error is safer.

#### 17-06 — Automatic SAF backup

- **MEDIUM:** “Only on change” needs a precise, persisted change marker and a proof that every exportable mutation advances it. Current tables have independent `modified_at` values, but there is no global export revision in the current schema. Scanning every exportable table for a max timestamp must account for tombstones and same-second writes; otherwise a change may be missed. Define this before adding settings columns.

- **MEDIUM:** Retention tests should include filenames that look similar but are not owned snapshots, SAF duplicate/collision names, unreadable listed files, and a timestamp clock rollback. The current code has no SAF adapter, so this is a design gap rather than an established safeguard.

#### 17-07 — Encryption

- **HIGH:** The plan freezes an envelope profile only after a physical-device checkpoint, but Plan 17-11 also requires that profile to be verified in a final release build. Ensure the benchmark is run against the same release/native dependency configuration—not a development build—before emitting any encrypted file. This is a compatibility contract, not merely a performance preference.

- **MEDIUM:** “Re-encrypt accessible automatic files” needs a crash-recovery protocol. SAF does not provide a general atomic replace guarantee. The plan should require: write new distinct verified encrypted snapshot, preserve the prior file until verification succeeds, then remove only the superseded owned file; partial re-encryption must leave the previously verified file intact.

#### 17-08 — Restore apply

- **HIGH:** The plan promises one transactional restore but writes photos after database commit. Existing `persistMaster` performs filesystem work and can throw (`src/services/photos/photo-storage.ts:141`). If photo restoration fails after DB commit, the restore has committed contact/value rows that point to absent photos—contradicting the practical “unchanged on failure” and complete-restore guarantees. Stage and validate photo files before the DB commit, or define durable recovery/compensation with a blocking incomplete-restore status; do not merely log a typed post-commit error.

- **HIGH:** App settings’ `sun_contact_id` has `ON DELETE SET NULL` (`src/db/migrations/003-orrery-settings.ts:35`), but that FK action does not update `app_settings.modified_at`. A contact purge can therefore change portable settings without an LWW timestamp update. The plans also do not state what happens when an incoming settings `sunContactUid` points to a contact that the reconciliation policy deletes because a tombstone wins. Define a policy: null it as self and update settings timestamp, or reject/retain settings deterministically.

- **MEDIUM:** Rebuilding notifications/digest after commit can fail independently. The plan should distinguish “restore committed; local scheduling rebuild needs retry” from “restore failed,” and register a durable launch-sweep reconcile marker. Current scheduling already relies on launch lifecycle registration (`App.tsx:147`).

#### 17-09 — Landing/settings UI

- **LOW:** The settings UI bounds `1..3650` are reasonable, but the service/DAO plan must own the same constant. Otherwise the UI can reject values a direct service call accepts, or vice versa. Existing settings validation is DAO-owned and occurs before transaction open (`src/db/app-settings-dao.ts:305`).

#### 17-10 — Restore UI

- **MEDIUM:** A route token is safer than file paths/passphrases, but it creates process-death risk: React Navigation may restore a route with a token whose in-memory preview cache is gone. The plan should include an expired-token recovery path back to picker/landing without claiming that preview remains valid.

- **LOW:** “Non-dismissable applying state” cannot make a JS-side SQLite/SAF operation truly uncancellable under Android activity/process termination. Copy and result logic should be idempotent when the app returns after interruption.

#### 17-11 — Final gates/UAT

- **MEDIUM:** The UAT matrix is comprehensive, but the automated phase gate should include a migration path from real v6 populated fixtures, not only targeted unit suites. Migration 006 explicitly uses normalized rows and cascading FKs (`src/db/migrations/006-normalize-custom-field-values.ts:41`); Phase 17 must prove v6→v7 plus export→restore with fields/photos/tombstones together.

#### 17-12 — Settings persistence

- **MEDIUM:** Adding all backup settings to migration 007 is reasonable, but the plan must preserve current non-secret AI settings in the export allowlist. `app_settings` already contains AI provider/model/custom-endpoint configuration (`src/db/app-settings-dao.ts:70`); BKP-01 says non-secret settings are included, while credentials remain SecureStore-only. An overly narrow “backup settings snapshot” would unintentionally lose valid user configuration.

- **MEDIUM:** The proposed `updateAppSettingsCore` must preserve the existing special behavior that resets `ai_ack_custom` when the endpoint changes (`src/db/app-settings-dao.ts:367`). A core/wrapper split that omits it would cause restore and normal settings updates to diverge.

### Suggestions

1. Add a prerequisite design/test plan before 17-05 for:
   - an export consistency mechanism;
   - the global “exportable data changed” marker;
   - photo-read failure behavior.

2. Amend 17-03 to add a local timestamp to fuel/link deletion inputs and specifically test `applyLinkDiff` tombstones.

3. Amend 17-08 with a restore side-effect protocol:
   - stage photo bytes safely;
   - commit DB only after staging succeeds;
   - finalize/reconcile photo files with durable recovery state;
   - treat notification/digest rebuild failure as committed restore plus retry-needed, never rollback fiction.

4. Add a reconciliation rule for settings references:
   - advance `app_settings.modified_at` when a purge’s `ON DELETE SET NULL` changes the sun;
   - resolve an incoming sun UID only if its final reconciled contact survives;
   - test tombstone-wins and cross-device IDs explicitly.

5. Make the tombstone entity vocabulary explicit and exhaustive, then add a test that compares it to every production `DELETE FROM` path found by repository search.

### Risk Assessment

**HIGH.** The plan order and core architecture are strong, and delete-writer coverage is close to complete. But export snapshot consistency and post-commit photo restore failure are loss/corruption risks in the phase’s two most important promises: a faithful backup and safe restore. Resolve those contracts before implementation; the remaining concerns are manageable within the proposed plan structure.

---

## Claude (Sonnet 5) Review

**Method.** I read `HANDOFF.md` in full (including §3 Data layer, §11 Explicitly out of
scope, and §14 Custom fields), `CLAUDE.md`, `docs/decisions/ADR-001-normalized-custom-
field-values.md`, all 12 `17-*-PLAN.md` files, `17-CONTEXT.md`, `17-DISCUSSION-LOG.md`,
`17-PATTERNS.md`, and `17-VALIDATION.md`, and then verified the phase's central factual
claim — the hard-delete-writer audit migration 007 depends on — directly against source:
`src/db/purge-dao.ts`, `src/db/field-ddl.ts`, `src/db/fuel-dao.ts`,
`src/db/contact-links-dao.ts`, `src/db/recency-dao.ts`, `src/db/field-values-dao.ts`,
`src/db/events-dao.ts`, `src/services/field-sweep.ts`, `src/db/transaction.ts`,
`src/db/types.ts`, `src/db/migrations/001-initial.ts`, `src/db/migrations/003-orrery-
settings.ts`, `src/db/app-settings-dao.ts`, and `src/services/photos/photo-storage.ts`,
plus a repo-wide grep for every `DELETE FROM`/`DROP` in `src/db`. No `src/backup/` or
`src/services/backup/` directory exists yet — this phase has not been executed, so all
findings below are against the plans and today's pre-Phase-17 source.

### Escalation check (HANDOFF.md / ADR-001)

No finding below reverses a `[DECIDED]` or `[REJECTED]` HANDOFF item or ADR-001. Backup
and export was explicitly `[OPEN]` in HANDOFF §3 ("whether to add encrypted backup to
the user's own cloud... automatic local rotation, or manual export only") — Phase 17's
CONTEXT.md decisions (D-06 through D-18) are the phase resolving that open question, not
reversing a settled one. Optional passphrase-based backup-file encryption (D-11) does
not conflict with HANDOFF §11's "[DECIDED] No end-to-end encryption work" — that item is
about sync E2EE for a then-nonexistent cloud sync layer, and D-11 explicitly keeps
backup-at-rest encryption "entirely separate from any future sync E2EE." The SAF folder
target for automatic backups is still a local file write initiated by the app with no
outbound network call; if the user happens to point it at a cloud-synced folder, that is
the user's own OS-level choice, not a network dependency the app introduces. ADR-001's
normalized `custom_field_values` model is correctly treated as the ground truth
throughout (plans consistently say "custom field," never "custom column," and correctly
treat `value = NULL` as a durable clear per D-04/ADR-001, verified against
`upsertValueCore` in `field-values-dao.ts:62-79`, which UPSERTs by `(contact_id,
field_def_id)` and preserves `uid`/`created_at` on the update branch exactly as ADR-001
describes). **No owner escalation is required.**

### HIGH

1. **Export has no defined read-consistency mechanism (17-05).** Concur with Codex,
   independently verified. `SqlExecutor` (`src/db/types.ts:17-29`) exposes only
   `execAsync`/`runAsync`/`getFirstAsync`/`getAllAsync` with no read-snapshot or
   read-transaction concept, and `inWriteTransaction` (`src/db/transaction.ts:42-57`)
   is the *only* isolation primitive in the codebase, gating writes through one
   non-reentrant mutex. 17-05's task 1 asserts as a must-have that export reads happen
   "inside a consistent SQLite read snapshot," but nothing in the plan's action text
   names a concrete mechanism (e.g., acquiring the same write mutex for the duration
   of the read, or an explicit `BEGIN`/`COMMIT` read transaction on the shared
   connection). **Failure scenario:** a foreground automatic-backup snapshot (17-06)
   runs concurrently with a user editing a contact (e.g., adding an interaction then
   archiving the contact) — export's sequential `SELECT`s could read the new
   interaction row but a since-superseded contacts row, or read a contact after its
   purge tombstone was written but before (or after) the corresponding
   `custom_field_values` rows were deleted, producing a backup file that fails 17-08's
   own orphan-parent validation on restore, or worse, one that passes validation but
   encodes a state that never actually existed. This directly threatens D-06's "full
   non-secret app state" promise.

2. **Restore writes photo bytes and rebuilds OS schedules after the DB commit, with no
   staging or compensation (17-08).** Concur with Codex, independently verified.
   `persistMaster` (`src/services/photos/photo-storage.ts:141-194`) performs real
   filesystem I/O (`File(...).copy(...)`, `.move(...)`) and its own doc comment says
   "A failed copy OR a failed move leaves the prior master intact" — i.e., it is
   written to throw on failure, not to guarantee success. 17-08's task 2 action text
   says explicitly: "After commit, persist fresh photo bytes through safe generated
   relative names and call notification/digest reconciliation; make failures typed and
   log privately." **Failure scenario:** a Merge or Replace-all restore commits 40
   contacts including 10 with photos; photo bytes for contact #7 fail to write (disk
   full, storage permission revoked mid-restore, corrupt/truncated base64 in the
   backup for just that one photo). The DB transaction has already committed — the
   `contacts` row for #7 now references a photo filename that was never created. The
   phase's own D-05/D-15 language ("local data unchanged on failure" / "Failure is
   calm and specific... explicitly says local data is unchanged") is written for
   pre-commit validation failures; this is a **post-commit** partial failure the D-
   decisions do not name a policy for, and 17-08's plan text does not define one
   beyond "typed and logged privately," which leaves the user's data silently
   inconsistent with no visible error and no retry mechanism.

3. **`app_settings.sun_contact_id`'s `ON DELETE SET NULL` does not advance
   `modified_at`, and no plan closes this (17-08).** Concur with Codex, independently
   verified against `src/db/migrations/003-orrery-settings.ts:35-40` (`ADD COLUMN
   sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL`) and
   `src/db/app-settings-dao.ts` (no trigger or explicit `modified_at` bump anywhere
   tied to this FK action — `sun_contact_id` is just one more field in the row
   mapping). **Failure scenario:** the user purges their sun contact locally on
   Monday (SQLite's FK action silently nulls `sun_contact_id`, but
   `app_settings.modified_at` is untouched from an earlier Sunday edit). On Wednesday
   they Merge-restore a backup taken Tuesday, whose settings row has a Tuesday
   `modified_at` — newer than the stale Sunday local timestamp — and a
   `sunContactUid` that still points at the now-purged (and tombstoned) contact.
   Under D-03's plain "newer `modified_at` wins" rule, the Tuesday incoming settings
   row wins and reintroduces the reference to a contact the reconciliation pass is
   simultaneously deleting via the newer tombstone. Neither 17-04's reconciliation
   plan nor 17-08's restore-apply plan states what happens when a settings row's
   `sunContactUid` names a UID that the same reconciliation pass is tombstoning —
   17-08's task 2 behavior list resolves `sunContactUid` "after contacts" but never
   addresses the tombstone-wins-over-settings-reference case. This is a real
   resurrected-reference / dangling-FK risk, not merely a UX nit.

### MEDIUM

1. **Fuel and link tombstone timestamp plumbing is understated in 17-03's plan text,
   and the concrete production call sites that need updating are outside the plan's
   declared `files_modified`.** Verified: `deleteFuelCore`
   (`src/db/fuel-dao.ts:226-235`) and `removeLinkCore`
   (`src/db/contact-links-dao.ts:137-146`) both take only `{id, contactId}` — no `now`
   parameter at all, unlike `recency-dao.ts`'s `deleteTouchpoint`, which already
   threads `input.now` through to `recomputeLastContact`. Writing a tombstone needs
   both the row's `uid` (not currently fetched before either DELETE) and a
   local-wall-clock timestamp (not currently available in either signature). 17-03's
   task 2 says only "Extend `deleteFuelCore` and `removeLink` using the same
   target-read, tombstone-core, exact-change pattern as the tracer" — the "tracer"
   (recency-dao) is a poor analog here specifically because it already had `now`; fuel
   and links do not. I independently found the real production callers that a `now`
   signature change would ripple into and confirmed they are **not** in 17-03's
   `files_modified` list (`[src/db/recency-dao.ts, ...test.ts, src/db/fuel-dao.ts,
   ...test.ts, src/db/contact-links-dao.ts, ...test.ts]`):
   `src/screens/ContactProfileScreen.tsx:608` (`await deleteFuel(getExecutor(), {id,
   contactId})`) and `src/screens/EditContactScreen.tsx:372` (`await
   applyLinkDiff(exec, {...})`). TypeScript will force a compile fix once the
   signatures change, so this will not silently ship without a timestamp — but the
   plan's own file-scope declaration is incomplete, which is exactly the kind of gap
   that produces an under-scoped executor task or a same-wave file-conflict surprise
   during execution. **Action needed:** either add `src/screens/ContactProfileScreen.
   tsx` and `src/screens/EditContactScreen.tsx` to 17-03's `files_modified`, or have
   the DAO synthesize `now` internally (a deviation from the codebase's existing
   caller-supplied-clock convention used everywhere else, which would need to be
   called out explicitly).

2. **Reconciliation's entity-policy registry should explicitly enumerate every
   mergeable UID-bearing table, not just the ones with hard-delete writers.** Concur
   with Codex. Verified `categories` and `profile` are both UID-bearing
   (`src/db/migrations/001-initial.ts:42-59`) but currently have no delete API at all
   (confirmed via grep: no `DELETE FROM categories` anywhere in `src/`), so there is no
   tombstone gap for them today — but 17-04's reconciliation module is meant to be the
   reusable contract "a future sync apply path reuses... rather than duplicating
   backup-private logic" (D-02), and a registry that only names tables with a
   currently-existing hard-delete writer will silently miss `categories`/`profile`
   merge semantics (LWW on `modified_at`, no deletion path) when sync is eventually
   built. This is a completeness/documentation gap in the reconciliation contract's
   scope, not a data-loss risk today.

3. **17-01's package-provenance gate should require inspecting the Expo prebuild/
   config-plugin diff, not just npm registry metadata**, matching Codex's LOW finding.
   Verified `App.tsx` already concentrates native bootstrap logic, and three of the
   four approved packages (`react-native-quick-crypto`, `react-native-nitro-modules`,
   plus their Expo config-plugin wiring) add native Android code; npm publisher/repo
   verification alone does not prove the resulting `android/` prebuild is what the
   owner expects. Elevate to plan text: after approval, diff `npx expo prebuild
   --clean` output or run 17-11's `npx expo config --type public` step earlier as a
   sanity check.

### LOW

1. Settings-screen day-bound constants (`1..3650`) should cite the exact DAO-owned
   validator location so UI and DAO cannot silently diverge — 17-09 states the bound
   but doesn't name `src/db/app-settings-dao.ts`'s validator as the single source
   (matches Codex's LOW finding; verified `app-settings-dao.ts:268` documents the
   `sun_contact_id` positive-integer pattern this would extend).
2. 17-10's "non-dismissable applying state" cannot survive Android process death; the
   plan should say explicitly that a resumed app checks for and recovers from an
   interrupted restore rather than only preventing user-initiated cancellation.

### Risk Assessment

**HIGH**, concurring with Codex. The plan sequencing, delete-writer audit, and
transaction-composition discipline are all sound and independently verified against
source. But the two structural gaps — export read consistency, and post-commit photo/
schedule failure handling in restore — sit directly in the phase's two most
safety-critical promises (a faithful backup, and "local data unchanged on failure" /
all-or-nothing restore), and the settings/tombstone interaction (`sun_contact_id`) is a
concrete, traceable path to reintroducing a reference to a permanently deleted contact.
None of these require re-architecting the phase; they need explicit mechanisms named in
17-05 and 17-08 before execution, plus a small file-scope correction in 17-03.
