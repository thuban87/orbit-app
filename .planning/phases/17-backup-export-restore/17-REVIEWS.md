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

---

## Codex Review — Cycle 2

> Run against commit c9058e8 ("fix(17): revise plans per cycle-1 cross-AI review"), the
> current revised 12 plans, with the full Cycle 1 review text supplied as reference
> context. Resolved model: `gpt-5.6-terra (reasoning=low)` (source: banner) — the same
> effort-resolution caveat noted in Cycle 1 applies again; this was not requested or
> overridden by this reviewer session.

## Summary

The revision resolves most Cycle 1 gaps: the export snapshot, delete coverage,
reconciliation completeness, encryption gating, UI recovery, and end-to-end migration
test are now explicitly planned. However, the photo protocol still permits an
unrecoverable post-commit missing-photo state, and the automatic-backup change marker
is still mathematically unable to detect same-second writes. No `[DECIDED]`/`[REJECTED]`
HANDOFF or ADR reversal found.

## Resolved

- **17-01 package provenance/prebuild check — FULLY RESOLVED.** The plan now requires Expo config inspection and a clean prebuild diff when warranted: `17-01-PLAN.md:75-80`.

- **17-02 closed tombstone vocabulary — FULLY RESOLVED.** A runtime-guarded TypeScript union explicitly names the covered hard-delete entities: `17-02-PLAN.md:76-82`.

- **17-02 capture purge UIDs before deletion — FULLY RESOLVED.** The action requires selecting/asserting every child UID and writing evidence before fan-out deletes: `17-02-PLAN.md:90-97`. This addresses the current purge, which only reads `archived_at` before deleting children (`src/db/purge-dao.ts:176-200`).

- **17-03 fuel/link timestamp threading and production call-site scope — FULLY RESOLVED.** Both screens are in `files_modified` and the action specifies `now` through cores and `applyLinkDiff`: `17-03-PLAN.md:7`, `17-03-PLAN.md:64-76`. This covers the current timestamp-less fuel core (`src/db/fuel-dao.ts:226-235`), link core (`src/db/contact-links-dao.ts:137-146`), and diff delete call (`src/db/contact-links-dao.ts:229-233`).

- **17-03 `applyLinkDiff` tombstone test — FULLY RESOLVED.** Dedicated compositional-path behavior, action, and acceptance criteria are present: `17-03-PLAN.md:68-76`.

- **17-04 stale field-delete tombstone — FULLY RESOLVED.** The plan requires an exact-one definition-delete guard and rollback test: `17-04-PLAN.md:56-63`. Current code lacks that assertion (`src/db/field-ddl.ts:117-124`).

- **17-04 complete reconciliation registry — FULLY RESOLVED.** Categories, profile, and immutable events are expressly assigned policies: `17-04-PLAN.md:72-81`.

- **17-05 export read consistency — FULLY RESOLVED.** `inReadSnapshot` uses the same module-level mutex as writes, wraps the complete export in `BEGIN`/`COMMIT`, prohibits nesting, and has an ordering regression test: `17-05-PLAN.md:67-72`. This composes safely with the existing non-reentrant mutex because it is a sibling outermost primitive, not called from within `inWriteTransaction`; that limitation matches the current mutex semantics (`src/db/transaction.ts:12-23`, `src/db/mutex.ts:22-35`). It prevents interleaving from normal DAO writers, which use the shared wrapper (for example `src/db/fuel-dao.ts:240-272`).

- **17-05 unreadable photo export behavior — FULLY RESOLVED.** A referenced missing/unreadable photo aborts the entire export with a typed repair-needed error: `17-05-PLAN.md:62-72`. This is necessary because current photo deletion is explicitly best-effort (`src/services/photos/photo-storage.ts:196-210`).

- **17-06 retention edge cases — FULLY RESOLVED.** Lookalike files, unreadable listings, and clock rollback are all specified with tests: `17-06-PLAN.md:59-67`.

- **17-07 release-build KDF benchmark and safe re-encryption — FULLY RESOLVED.** The checkpoint requires the release APK identity: `17-07-PLAN.md:67-85`; re-encryption uses write-new, decrypt-verify, then delete-old: `17-07-PLAN.md:89-101`.

- **17-08 schedule failure contract — FULLY RESOLVED.** It is now a committed-with-resync-pending result and tests invoke the existing launch reconcilers: `17-08-PLAN.md:88-102`. Those reconcilers are registered at startup (`App.tsx:153-162`) and re-run from launch hooks (`src/services/notifications/notification-schedule.ts:515-524`, `src/services/notifications/digest-schedule.ts:191-198`).

- **17-09 shared day-bound validator — FULLY RESOLVED.** UI must import the DAO-owned validator rather than duplicate `1..3650`: `17-09-PLAN.md:69-79`.

- **17-10 expired preview token and interrupted UI — FULLY RESOLVED.** The missing-cache recovery and no persisted applying state are explicitly required and tested: `17-10-PLAN.md:57-65`, `17-10-PLAN.md:73-82`.

- **17-11 v6→v7 populated end-to-end gate — FULLY RESOLVED.** It requires migration, export, and both restore modes over representative fixtures: `17-11-PLAN.md:56-63`.

- **17-12 non-secret AI settings and acknowledgement-reset parity — FULLY RESOLVED.** Both are explicit behavior/action/acceptance requirements: `17-12-PLAN.md:73-81`. This preserves current endpoint-change acknowledgement behavior (`src/db/app-settings-dao.ts:367-383`).

## Still Open / New Concerns

- **HIGH — 17-08 photo staging relocates, rather than eliminates, the committed missing-photo risk.** Staging bytes in cache before the transaction only proves that cache is writable. The plan still commits DB state first and only then calls `persistMaster` into canonical storage; it explicitly accepts a per-photo failure after commit: `17-08-PLAN.md:88-100`. If the process dies after commit but before finalization—or `persistMaster` fails—DB rows can reference a canonical photo that was never written. The proposed existing launch reconciliation cannot recover cache-staged files because it only reconciles `.tmp`/`.bak` under the canonical avatars directory (`src/services/photos/photo-storage.ts:213-228`); cache staging creates neither. User-visible counts help a live process, but do not provide durable recovery after a kill. Require durable staging in the photo storage area plus a persistent finalize/retry journal, or finalize canonical files before commit with compensating cleanup/recovery.

- **HIGH — 17-06's "same-second" marker claim is false; writes can be missed indefinitely.** The plan says `newMarker > storedMarker` permits a same-second edit after backup: `17-06-PLAN.md:65`. It does not: if both timestamps are equal to second precision, `newMarker === storedMarker`, so the backup is skipped until some later mutation advances the maximum. Current timestamps are explicitly second-granularity (`src/db/database.ts:46-55`). This remains unresolved from the Cycle 1 marker finding. Use a monotonically incremented export revision, or store a composite/change-log marker that cannot collide.

- **MEDIUM — purge's required `modified_at` timestamp has no defined source or call-site update.** Plan 17-02 requires `UPDATE app_settings ... modified_at = ?` but does not define a `now` input, injected clock, or internal clock source: `17-02-PLAN.md:87-97`. Current `purgeContact` accepts only `(exec, contactId, opts)` (`src/db/purge-dao.ts:169-173`) and its production caller likewise supplies no timestamp (`src/screens/ArchivedContactsScreen.tsx:146-147`). The previous timestamp-threading correction in 17-03 is not mirrored here. Define a caller-supplied local-wall-clock `now`, add `ArchivedContactsScreen.tsx` to the plan scope, and test the exact timestamp.

- **LOW — `inReadSnapshot` is a convention-only read boundary.** The plan says "with no writes inside it" but does not make that enforceable (`17-05-PLAN.md:70`). `SqlExecutor` has the same unrestricted write API available inside the callback (`src/db/types.ts:17-28`). This does not deadlock or defeat normal-writer isolation, but a future accidental write inside a snapshot would commit under a misleading API name. A narrowed read-only executor type would make the guarantee structural.

## Risk Assessment

**HIGH.** The revised plans are substantially stronger, and the mutex-based snapshot design is sound when used as specified. But the restore still has a post-commit data-integrity hole for photos, and automatic backups can silently omit same-second changes. Those affect the phase's central safety promises.

---

## Claude (Sonnet 5) Review — Cycle 2

**Method.** Read `HANDOFF.md`, `CLAUDE.md`, all 12 revised `17-*-PLAN.md` files in full,
`17-CONTEXT.md`, and the Cycle 1 `17-REVIEWS.md` sections above, then independently
verified every Cycle-1 finding's resolution claim and the codex Cycle-2 findings above
against the real source on disk: `src/db/transaction.ts`, `src/db/mutex.ts`,
`src/db/types.ts`, `src/db/fuel-dao.ts`, `src/db/contact-links-dao.ts`,
`src/db/purge-dao.ts`, `src/db/field-ddl.ts`, `src/db/field-values-dao.ts`,
`src/db/app-settings-dao.ts`, `src/db/migrations/003-orrery-settings.ts`,
`src/db/database.ts`, `src/db/contacts-dao.ts`, `src/services/photos/photo-storage.ts`,
`src/utils/dates.ts`, `src/screens/ArchivedContactsScreen.tsx`, `App.tsx`,
`src/services/notifications/notification-schedule.ts`,
`src/services/notifications/digest-schedule.ts`, plus a repo-wide grep for every
`DELETE FROM` in `src/db` to re-verify the tombstone-vocabulary completeness claim
independently of both Cycle 1 reviews. No `src/backup/` directory exists yet — the
phase has not been executed, so all findings are against plan text and today's
pre-Phase-17 source. I also ran the codex Cycle-2 lane (`gpt-5.6-terra`,
reasoning resolved to `low` by the review-lane runner, same `#3532`-adjacent
effort-resolution artifact noted in Cycle 1 — not requested by this session) and
independently verified its findings below rather than taking them on faith.

### Escalation check (HANDOFF.md / ADR-001)

No finding below reverses a `[DECIDED]`/`[REJECTED]` HANDOFF item or an ADR. The
revisions extend Cycle 1's already-cleared D-06–D-18 resolution of HANDOFF's `[OPEN]`
backup question; nothing in commit c9058e8 touches encryption scope, sync E2EE
separation, or the custom-fields normalized model differently than Cycle 1 already
assessed as clean. **No owner escalation is required.**

### Verification of Cycle 1 resolutions (source-checked, not plan-text-only)

All of the following are independently confirmed against real source, not just plan
prose — I re-derived the same closed hard-delete set Cycle 1 found (`grep -rn "DELETE
FROM" src/db/*.ts`: `contact_links` (`contact-links-dao.ts:142`, `purge-dao.ts:197`),
`fuel` (`fuel-dao.ts:231`, `purge-dao.ts:192`), `interactions`
(`recency-dao.ts:318`, `purge-dao.ts:188`), `events` (`purge-dao.ts:191`, no
standalone), `custom_field_values`/`custom_field_defs` (`field-ddl.ts:120,124`,
`purge-dao.ts:194`), `contacts` (`purge-dao.ts:205`), `field_history`
(`purge-dao.ts:200`, correctly excluded from tombstones)) — this exactly matches
17-02's `TombstoneEntityType` union (`'contact' | 'interaction' | 'event' | 'fuel' |
'contact_link' | 'custom_field_def' | 'custom_field_value'`); the vocabulary is
complete against the current tree.

- **17-03/17-04 file-scope and guard gaps — confirmed FULLY RESOLVED.** `deleteFuelCore`
  (`fuel-dao.ts:226-235`) and `removeLinkCore` (`contact-links-dao.ts:137-146`) today
  really do take only `{id, contactId}`, exactly as both plans state, and 17-03 now
  lists `src/screens/ContactProfileScreen.tsx`/`EditContactScreen.tsx` in
  `files_modified`. `field-ddl.ts`'s `DropTarget = Pick<CustomFieldDef, "id" |
  "col_name">` (line 47) really does omit `uid`, and its definition `DELETE` (line
  124) really has no `changes === 1` guard today — 17-04's remedy targets exactly
  these gaps.
- **17-08 photo two-phase design and `createContactFull` avoidance — mechanically
  sound.** `persistMaster(srcUri, relative)` (`photo-storage.ts:141-194`) takes any
  source URI and does its own crash-safe `.tmp`/`.bak` swap into `avatars/`, which is
  exactly the seam 17-08's post-commit finalize step calls unmodified. `createContactFull`
  (`contacts-dao.ts:100-123`) does own its own `inWriteTransaction`, confirming 17-08's
  note that restore must not call it directly (composing it would nest the mutex).
- **17-05's `inReadSnapshot` design is architecturally sound against the real mutex.**
  `inWriteTransaction` (`transaction.ts:42-57`) calls the single module-level
  `withMutex` (`mutex.ts:22-36`), and I confirmed every `runAsync` call site in
  `src/db/*.ts` sits inside a file that also uses `inWriteTransaction` — i.e., the
  codebase's documented "every write goes through the one mutex" convention holds
  today, which is the precondition 17-05's isolation guarantee depends on. A sibling
  `inReadSnapshot` sharing the same `withMutex` chain will genuinely serialize against
  every current writer.
- **17-12's `ai_ack_custom` reset behavior — confirmed real and correctly targeted.**
  `updateAppSettings` (`app-settings-dao.ts:313-383`) really does reset
  `ai_ack_custom` on an endpoint change (lines ~367-378); 17-12 correctly requires
  `updateAppSettingsCore` to reproduce this.
- **17-02/17-04's `app_settings.sun_contact_id` FK — confirmed as described.**
  `003-orrery-settings.ts:40` really declares `ON DELETE SET NULL` with no trigger
  anywhere bumping `modified_at`; 17-02's explicit `UPDATE app_settings SET
  sun_contact_id = NULL, modified_at = ?` ahead of the FK-triggering `DELETE`, plus
  17-04's reference-to-tombstoned-parent fallback and 17-08's re-validation against
  "whichever settings row wins," together close the resurrection path Cycle 1's HIGH
  #3 described — **architecturally** resolved (see MEDIUM below for one loose
  implementation thread).

I independently reached the same "Resolved" set codex lists for 17-01, 17-06 (retention
edge cases), 17-07, 17-09, 17-10, and 17-11, and confirmed the codex file:line citations
for those (`App.tsx:153-162` registers `notification`/`digest` sweep hooks exactly as
claimed; `notification-schedule.ts:515-524` and `digest-schedule.ts:191-198` register
launch-sweep hooks that fully re-read DB state, confirming 17-08's post-commit
schedule-rebuild-failure resolution is not aspirational).

### HIGH (concur with codex, independently verified)

1. **17-08's post-commit photo finalization has no durable recovery for an OS-level
   process kill, not just a live in-process failure.** `reconcilePhotoDir`/
   `reconcilePhotoWrites` (`photo-storage.ts:228-268`) only scan `avatars/*.tmp` and
   `avatars/*.bak` — files `persistMaster` itself creates mid-swap. 17-08's pre-commit
   staging writes each photo's decoded bytes to "a fresh OS temp/cache file" (task 2
   action, item 1), which is **not** inside `avatars/` and carries no `.tmp`/`.bak`
   marker the existing sweep recognizes. The plan's own residual-failure handling (a
   caught `persistMaster` error → `photosNeedingAttention` count in the typed result)
   only works for a **live, non-killed process** — the count is computed and returned
   in-memory by the same call that would never return if the OS kills the app between
   DB commit and that photo's finalize call. In that scenario: the DB row already
   commits a canonical filename reference (Merge/Replace-all writes the resolved
   `avatars/<name>` string as part of the committed transaction, per 17-08's own
   design), the canonical file was never created, no `.tmp`/`.bak` artifact exists for
   the launch sweep to find, and no `photosNeedingAttention` count was ever persisted
   or surfaced — the contact silently ends up with a dangling photo reference and zero
   diagnostic trail, indefinitely. This is a genuine relocation, not an elimination, of
   Cycle 1's HIGH #2: the common-case (decode/disk-full) failure is now correctly
   converted to a pre-commit whole-restore abort, but the process-kill-during-
   finalization window is real, unaddressed, and arguably worse than Cycle 1's original
   gap because it is now completely silent (no post-commit error log, no user-visible
   count) rather than merely "logged privately." **Action needed:** either persist a
   durable per-restore "photos pending finalization" marker (queryable by the existing
   launch-sweep machinery, so a killed finalize resumes/reports on next launch) or
   finalize canonical photo files from the already-verified staged bytes **before** the
   DB transaction opens (using synthesized/placeholder-then-rename UID-keyed names that
   don't depend on post-commit local ids), with compensating cleanup of any file whose
   contact/definition never actually committed.

2. **17-06's `newMarker > storedMarker` change-detection test cannot detect a
   same-second collision, and the omission does not self-correct until an unrelated
   later write occurs.** Verified: `localDateTime()`/`formatLocalDate()`
   (`src/utils/dates.ts:17-22`, `src/db/database.ts:50-54`) produce
   second-granularity strings (`YYYY-MM-DD HH:MM:SS`) with no sub-second component
   anywhere in the codebase. 17-06's task 1 action text defines the "changed" check as
   `newMarker > storedMarker` specifically because "a same-second edit after a
   same-second backup is still eligible **next** due cycle" — but that claim is false:
   if a user's edit lands in the exact same wall-clock second as the marker the prior
   successful automatic backup recorded, `newMarker === storedMarker` on every
   subsequent due-cycle check too, since nothing else advances the max. The most likely
   real-world trigger is exactly the scenario this feature runs in most often: the
   automatic-backup sweep is foreground-launch-triggered (17-06 task 2), so a user's
   first edit of a session racing the same-second launch-time backup check is a
   plausible, not merely theoretical, collision. The failure is silent — no error, no
   degraded-health signal (17-06's health model derives from verified-write results,
   not missed-detection) — and directly undermines the phase's D-08 "automatic
   protection" promise for however long it takes an unrelated write to land in a
   different second. **Action needed:** replace the wall-clock-derived scalar with a
   marker that cannot tie across a real change — e.g., a monotonic revision counter
   bumped by every exportable-table write (a real schema/DAO-wide change), or persist
   the last-backed-up row *count* alongside the max timestamp as a cheap second signal,
   or widen local timestamps to include a monotonic tiebreaker. This is not simply a
   restatement of Cycle 1's MEDIUM (which only asked for a marker to be *defined* at
   all) — the now-defined marker has a specific, verifiable off-by-one correctness bug.

### MEDIUM

1. **(concur with codex) 17-02's purge-time `app_settings.modified_at` bump has no
   defined clock source or call-site wiring, mirroring the exact gap 17-03 correctly
   caught for fuel/links but left unfixed here.** Verified: `purgeContact(exec,
   contactId, opts?)` (`purge-dao.ts:169-173`) and its `PurgeOptions` type
   (`purge-dao.ts:63-69`) carry no `now`/clock parameter today, and the sole
   production caller, `src/screens/ArchivedContactsScreen.tsx:146`
   (`await purgeContact(exec, id, {...})`), passes none. 17-02's task 3 action text
   specifies the bound `UPDATE app_settings SET sun_contact_id = NULL, modified_at = ?
   ... ` but never states where that `?` value comes from — an injected `now`
   parameter (requiring a `PurgeOptions.now` addition and a call-site change this
   plan's `files_modified` list does not include `ArchivedContactsScreen.tsx` for), or
   an internal `localDateTime()` call inside the DAO (a deviation from the
   established caller-supplied-clock convention 17-03 itself invokes as the reason
   *not* to synthesize `now` inside a DAO). Left unresolved, this is exactly the kind
   of gap that produces either a TypeScript compile surprise mid-execution or a
   silent convention violation — and because this write is the mechanism Cycle 1's
   HIGH #3 (`sun_contact_id` resurrection) depends on, an incorrectly-wired timestamp
   here would reopen that HIGH in practice even though the surrounding design is
   otherwise sound. **Action needed:** add a caller-supplied `now` to `PurgeOptions`
   (or `purgeContact`'s signature) and add `ArchivedContactsScreen.tsx` to 17-02's
   `files_modified`.

### LOW

1. **(concur with codex) `inReadSnapshot`'s "no writes inside it" rule is
   convention-only, not type-enforced.** Verified `SqlExecutor`
   (`src/db/types.ts:17-28`) exposes `runAsync`/`execAsync` identically whether called
   from inside `inWriteTransaction` or a future `inReadSnapshot` — nothing stops a
   later change from accidentally writing inside a "read" snapshot and having it
   silently commit. A narrowed read-only executor view (even a thin wrapper type that
   only exposes `getFirstAsync`/`getAllAsync`) would make the guarantee structural
   rather than doc-comment-only. Not blocking for this phase, but worth a follow-up
   note in `transaction.ts`.
2. **No plan addresses the write-availability cost of `inReadSnapshot` blocking every
   other app write for the full duration of a multi-table-plus-all-photo-bytes export.**
   Because `inReadSnapshot` and `inWriteTransaction` share one non-reentrant
   `withMutex` chain (verified above), an in-progress automatic backup (17-06,
   foreground-launch-triggered) or manual export (17-05) holds that mutex for as long
   as it takes to read every table and base64-encode every referenced photo — during
   which every other write in the app, including headless notification-tap writes,
   queues behind it. None of 17-05/17-06's tests or must-haves bound this duration or
   test it against a larger photo library. This is a correctness-safe but
   responsiveness-relevant gap the correctness fix (rightly) introduced; worth a
   plan-text note acknowledging the tradeoff and, ideally, a rough size/duration test
   at 17-11's integration-gate stage.

### Risk Assessment

**HIGH**, concurring with codex. The revision closed 19 of Cycle 1's 22 findings
cleanly and verifiably against source — the tombstone audit, reconciliation
completeness, encryption release-build gating, UI recovery paths, and the end-to-end
migration/restore integration gate are all now real, executable plan text, not
aspirational language. But two HIGHs remain: the photo-restore post-commit path is
safe against live-process failure yet still open against an OS-level kill during
finalization (a materially different, and less visible, failure mode than Cycle 1's
original gap), and the newly-defined automatic-backup change marker has a verified
off-by-one bug that can silently and indefinitely suppress protection for same-second
edits. Both are narrow-but-real, self-contained fixes (a durable finalize journal or
pre-commit canonical write for the first; a monotonic/collision-proof marker for the
second) that do not require re-architecting the phase.

---

## Codex Review — Cycle 3

> Run against commit e95fa98 ("fix(17): revise plans per cycle-2 cross-AI review"), the
> current revised 12 plans, with the full Cycle 2 review text supplied as reference
> context and an explicit instruction to judge whether the new `data_revision` counter
> and `avatars/_restore_pending/` photo-staging/finalize-sweep designs are actually
> complete, not merely present. Invoked directly via `gsd-tools query review-lane invoke
> --slug codex` (the `gsd-review` workflow's own bash steps, run manually per this
> project's codex-reviewer-bypass-flag constraint — no `--dangerously-bypass-hook-trust`
> flag was used or needed). Resolved model: `gpt-5.6-terra (reasoning=low)` (source:
> banner) — the same effort-resolution artifact noted in Cycles 1–2 applies again; not
> requested or overridden by this reviewer session. Confirmed NOT a stubbed/empty
> result (`"stubbed": false` in the lane's JSON result).

## Resolved

- **HIGH — durable post-commit photo recovery: FULLY RESOLVED.** Plan 17-08 now stages under `avatars/_restore_pending/`, not cache, before DB work; retains staged files on live finalization failure; and registers an idempotent foreground-launch finalizer/orphan collector ([17-08-PLAN.md:96-97](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-08-PLAN.md:96), [17-08-PLAN.md:102](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-08-PLAN.md:102), [17-08-PLAN.md:119-127](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-08-PLAN.md:119)). This deliberately avoids the existing root-only `.tmp`/`.bak` reconciler ([photo-storage.ts:228](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:228)) and correctly uses the ready-gated launch registry, which runs only on real launches ([launch-sweep.ts:10](/home/bwales/projects/orbit-app/src/services/launch-sweep.ts:10)).

- **HIGH — same-second automatic-backup marker: FULLY RESOLVED in design.** Migration 007 adds `data_revision`; tombstones bump it in-transaction ([17-02-PLAN.md:80-90](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-02-PLAN.md:80)), and automatic backup compares revision snapshots rather than timestamps ([17-06-PLAN.md:70-72](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-06-PLAN.md:70), [17-12-PLAN.md:64](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-12-PLAN.md:64)).

- **MEDIUM — purge `modified_at` clock wiring: FULLY RESOLVED.** The plan makes `PurgeOptions.now` required, makes the options bag non-optional, updates the real screen caller, and tests the exact bound value ([17-02-PLAN.md:101-108](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-02-PLAN.md:101)). This fixes the current no-clock signature ([purge-dao.ts:169](/home/bwales/projects/orbit-app/src/db/purge-dao.ts:169)).

- **LOW — read-only snapshot API: FULLY RESOLVED.** Plan 17-05 narrows the snapshot callback to `ReadOnlyExecutor`, requires export code to use it, and includes a compile-time acceptance criterion ([17-05-PLAN.md:75-79](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-05-PLAN.md:75)).

- **LOW — snapshot write-availability cost: FULLY RESOLVED.** It requires an in-code tradeoff comment and a 50-photo-library duration regression with a documented budget ([17-05-PLAN.md:77](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-05-PLAN.md:77), [17-11-PLAN.md:61-65](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-11-PLAN.md:61)).

## Still Open / New Concerns

- **HIGH — `data_revision` does not cover every exportable write path despite claiming it does.** Plan 17-06's exhaustive-looking list omits existing production writers for exported `contacts`, `profile`, and `custom_field_defs`: `snoozeContact`/`clearSnooze` ([snooze-dao.ts:78](/home/bwales/projects/orbit-app/src/db/snooze-dao.ts:78), [snooze-dao.ts:120](/home/bwales/projects/orbit-app/src/db/snooze-dao.ts:120)); favorite rank setters/reorder ([favourites-dao.ts:30](/home/bwales/projects/orbit-app/src/db/favourites-dao.ts:30), [favourites-dao.ts:105](/home/bwales/projects/orbit-app/src/db/favourites-dao.ts:105)); ring sequencing ([ring-seq-dao.ts:56](/home/bwales/projects/orbit-app/src/db/ring-seq-dao.ts:56)); profile photo writes ([profile-dao.ts:37](/home/bwales/projects/orbit-app/src/db/profile-dao.ts:37)); and field type changes ([field-type-change.ts:150](/home/bwales/projects/orbit-app/src/db/field-type-change.ts:150)). None of these files is in 17-06's scope/list ([17-06-PLAN.md:62-63](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-06-PLAN.md:62)). Each can leave `data_revision` unchanged, causing a due backup to miss a real user edit indefinitely. Restore-apply's direct/core writes also need an explicit revision policy.

- **HIGH — pending-photo paths are incompatible with the existing safety guard as written.** The plan says pending helpers reuse `assertSafeRelative` while producing `avatars/_restore_pending/...` paths ([17-08-PLAN.md:102](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-08-PLAN.md:102)). The actual guard accepts only `avatars/<name>.<ext>` and rejects subdirectories ([photo-relative-path.ts:22](/home/bwales/projects/orbit-app/src/db/photo-relative-path.ts:22)). Moreover, `src/db/photo-relative-path.ts` is not in 17-08's `files_modified`. Add a separately named pending-path validator or safely extend the shared grammar, update the planned file scope, and test that canonical DB photo paths remain restricted to the existing flat grammar.

- **MEDIUM — pending filename encoding is not reversibly specified.** `contact-<uid>.jpg` and `cv-<uid>-<colName>.jpg` must later be parsed back into UID and column name ([17-08-PLAN.md:102](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-08-PLAN.md:102), [17-08-PLAN.md:125](/home/bwales/projects/orbit-app/.planning/phases/17-backup-export-restore/17-08-PLAN.md:125)). The plan provides no escaping/grammar ensuring hyphens in UUIDs or safe column names cannot make this ambiguous. Use a typed sidecar manifest or a delimiter/encoding with a tested inverse.

No HANDOFF or ADR decision reversal found. The revised plan preserves the local-only/no-sync boundary and the normalized nullable-value model.

## Risk Assessment

**HIGH.** Cycle 2's five findings are genuinely incorporated. But the new correctness foundation—`data_revision`—still has concrete unplanned bypasses, and the new durable photo staging cannot pass its own existing path guard as specified. Both should be corrected before execution.

---

## Claude (Sonnet 5) Review — Cycle 3

**Method.** Read `HANDOFF.md`, `CLAUDE.md`, all 12 current revised `17-*-PLAN.md` files
(post-e95fa98) in full, `17-CONTEXT.md`, and every prior `17-REVIEWS.md` cycle (1 and 2)
above, then independently drove the codex Cycle-3 lane myself via `gsd-tools query
review-lane invoke --slug codex` (real invocation, confirmed non-stubbed via the lane's
`"stubbed": false` JSON result — not a fabricated/predicted transcript), and
independently verified every Cycle-2-resolution claim and every codex Cycle-3 finding
against the real source on disk before accepting any of it: `src/db/snooze-dao.ts`,
`src/db/favourites-dao.ts`, `src/db/ring-seq-dao.ts`, `src/db/profile-dao.ts`,
`src/db/field-type-change.ts`, `src/db/capture-dao.ts`, `src/db/contacts-dao.ts`,
`src/db/photo-relative-path.ts`, `src/services/photos/photo-storage.ts`,
`src/services/launch-sweep.ts`, `src/db/col-name.ts`, `src/db/uid.ts`,
`src/db/app-settings-dao.ts`, `src/db/database.ts`, `src/screens/ArchivedContactsScreen.tsx`,
plus a repo-wide grep for every file calling `inWriteTransaction` in `src/db/*.ts` to
independently re-derive the full write-chokepoint set 17-06 needed to cover (rather than
trusting either the plan's or codex's enumeration). No `src/backup/` directory exists yet
— the phase has not been executed, so all findings are against plan text and today's
pre-Phase-17 source.

### Escalation check (HANDOFF.md / ADR-001)

No finding below reverses a `[DECIDED]`/`[REJECTED]` HANDOFF item or an ADR. Nothing in
commit e95fa98 touches encryption scope, sync E2EE separation, or the custom-fields
normalized model differently than Cycles 1–2 already assessed as clean. The new
`data_revision`/`_restore_pending` machinery is new bookkeeping infrastructure, not a
reversal of anything previously decided. **No owner escalation is required.**

### Verification of codex's Cycle 3 findings (independently confirmed, with additional evidence)

Both of codex's HIGHs are real and I independently reproduce them with concrete evidence
codex did not cite, which strengthens rather than merely echoes its verdict:

1. **`data_revision` write-chokepoint coverage — CONFIRMED, and worse than codex's own
   citation list.** I re-derived the complete set of files calling `inWriteTransaction`
   in `src/db/*.ts` independently of both the plan's and codex's enumeration
   (`grep -rl inWriteTransaction src/db/*.ts`) and cross-checked it against 17-06 Task
   1's explicit file list. Confirmed real, uncovered production writers to exportable
   tables:
   - `src/db/favourites-dao.ts` — `setFavouriteRank`/`clearFavouriteRank`/
     `rewriteFavouriteRanks` (lines 30, 62, 105-143) write `contacts.favourite_rank` +
     `modified_at` directly, with **no** accompanying event/tombstone write of any kind
     — nothing in this file's transactions would ever bump `data_revision` under
     17-06's plan as written. Not in 17-06's file list.
   - `src/db/ring-seq-dao.ts` — `rewriteRingSeq` (lines 45-90) writes
     `contacts.ring_seq` + `modified_at` directly, same shape as favourites, same gap.
     Not in 17-06's file list.
   - `src/db/profile-dao.ts` — `setProfilePhoto` (and its siblings for name) write the
     `profile` table directly (`UPDATE profile SET photo = ?, modified_at = ? WHERE id
     = 1`, line ~44). `profile` is an explicitly named exportable/mergeable table in
     17-04's reconciliation registry and D-06's "categories, profile" export scope —
     yet `profile-dao.ts` is absent from 17-06's entire file list, so profile-photo
     changes can never advance `data_revision`.
   - `src/db/field-type-change.ts` — its sole exported function (line ~157) issues
     `UPDATE custom_field_defs SET type = ?, modified_at = ? WHERE id = ?` (line 173)
     directly, bypassing `field-ddl.ts`/`field-defs-dao.ts` entirely. `custom_field_defs`
     is one of the eight tables 17-06's own must-haves name by name as required
     coverage, yet this is a distinct file from either DAO 17-06 lists, and a field-type
     change is a common, ordinary user action.
   
   I also checked the one plausible **false positive** in codex's list: `src/db/
   snooze-dao.ts`'s `snoozeContact`/`clearSnooze` both write `contacts.snooze_until`
   directly, but **also** call `recordEventCore` unconditionally inside the same
   transaction — and `events-dao.ts`'s `recordEventCore` **is** in 17-06's covered list.
   Since the plan bumps *inside* the core function bodies it names, snooze mutations
   would incidentally get a `data_revision` bump for free via the event insert riding
   in the same transaction — this specific file is not actually a miss, though it is a
   fragile, accidental pass-through (it would silently break if a future change ever
   made the event insert conditional or removed it), not a designed guarantee. I did
   not find any accompanying event/tombstone write in `favourites-dao.ts`, `ring-seq-
   dao.ts`, `profile-dao.ts`, or `field-type-change.ts` that would offer the same
   accidental cover — those four are unambiguous, confirmed gaps.
   
   I also checked `src/db/capture-dao.ts` (also calls `inWriteTransaction`, also absent
   from 17-06's file list) and found it is **not** a gap: `captureMultiAttach`/its
   sibling compose `addFuelCore`/`editFuelCore` directly inside their own transaction,
   and those two cores are exactly what 17-06 Task 1 bumps from *inside* — so capture's
   fan-out inherits the bump correctly through composition, the same mechanism that
   saves the recompute-recency and reconciliation composition patterns elsewhere in
   this phase.

2. **Pending-photo path vs. `assertSafeRelative` — CONFIRMED exactly as codex states,
   verified against the live regex.** `src/db/photo-relative-path.ts:22`:
   `SAFE_RELATIVE = /^avatars\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/` — a single
   path segment after `avatars/`, no `/` permitted in `[A-Za-z0-9_-]+`. 17-08's
   `avatars/_restore_pending/contact-<uid>.jpg` fails this pattern outright (the
   `_restore_pending/` segment contains a `/`), and the plan explicitly says
   `deleteRestorePending` "reuse[s] the same `assertSafeRelative` guard `persistMaster`/
   `deletePhoto` already apply" (17-08-PLAN.md task 2 action) — calling that guard on
   a `_restore_pending/...` path throws immediately by construction. `src/db/photo-
   relative-path.ts` is genuinely absent from 17-08's `files_modified`. I additionally
   confirmed the **collision-avoidance** half of the design *is* sound: `reconcilePhotoWrites`
   (`photo-storage.ts:258-267`) lists only direct entries of `avatars/` and only acts on
   names ending `.tmp`/`.bak`; a `_restore_pending` subdirectory entry matches neither
   suffix check and is silently skipped, so the two sweeps genuinely cannot collide once
   the path-grammar bug above is separately fixed.

### MEDIUM (independently verified, concur with codex)

1. **Pending filename encoding is de facto reversible today but the plan never says
   how, which is itself the gap.** I checked whether codex's ambiguity concern is a real
   parsing hazard or a documentation gap: `col_name` is minted exclusively by
   `slugify()`/`makeColName()` (`src/db/col-name.ts:34-43`) and is guaranteed to match
   `^[a-z][a-z0-9_]*$` — **no hyphens are ever possible** in a `col_name`. `uid` is
   always a fixed-width 36-character RFC-4122 UUID string (`src/db/uid.ts:18-38`, both
   the `crypto.randomUUID()` path and the `Math.random` fallback produce the canonical
   `8-4-4-4-12` hyphenated shape). Given both facts, `cv-<uid>-<colName>.jpg` **is**
   unambiguously parseable by position (first 36 characters after `cv-` are always the
   UID; the single `-` immediately after is a fixed separator; everything after that up
   to `.jpg` is `colName`) — so this is not the "genuinely ambiguous, could silently
   mis-parse a real UUID/column name" hazard codex's wording implies. But the plan text
   never states this parsing algorithm or the two invariants (`col_name` hyphen-free,
   `uid` fixed-width) it depends on — an executor implementing Task 3's "parse the
   entry's kind/UID/colName back out of its filename (the inverse of
   restorePendingRelPath)" with a naive `.split("-")` would break immediately on the
   UID's own internal hyphens. Concur with codex that this needs an explicit, tested
   parse algorithm (or a delimiter that cannot appear in either component, e.g. keeping
   the UUID hyphens but using a character never in `col_name`/never in a UUID as the
   uid/colName separator) — downgrading from "ambiguous" to "correct today by two
   unstated invariants, and one plan-text sentence away from a real bug."

### MEDIUM (new — not raised by codex)

1. **`data_revision`/`last_backup_data_revision`, and the SAF-folder/health bookkeeping
   columns 17-12 adds, are never explicitly excluded from the exported/restorable
   settings snapshot anywhere in 17-05, 17-08, or 17-12.** Verified: 17-05's Task 1
   explicit exclusion list for the settings object is "API-key state, cached
   passphrases, raw encryption/KDF/key material, field_history, derived OS schedule
   IDs, and local photo paths" — `data_revision`, `last_backup_data_revision`, the SAF
   folder bookmark URI, and the last-successful-automatic-backup timestamp are named
   in **none** of the three plans' inclusion or exclusion lists; 17-12 Task 2's own
   language is ambiguous, bundling "folder metadata" and "automatic-success metadata"
   into the same "durable non-secret settings" bullet as the fields that legitimately
   should round-trip (cadence, retention, encryption-enabled). Two distinct concrete
   risks follow if an executor reads this literally:
   - If `data_revision`/`last_backup_data_revision` leak into the wire format and are
     applied via Merge (whichever settings row wins per D-03's row-level LWW) or
     Replace-all, the local monotonic counter that 17-06 was built specifically to make
     collision-proof (Cycle 2's HIGH #2 fix) can be silently reset backward from an
     older backup or a different device's snapshot — self-healing over time as new
     writes continue incrementing from wherever it lands, but defeating the "changed"
     signal's accuracy for however long it takes to recover.
   - More concretely product-relevant: if the SAF folder bookmark URI and
     last-successful-automatic-backup timestamp leak into the wire format and get
     applied via Merge/Replace-all — e.g., restoring the same backup onto a **different**
     device, or a fresh reinstall that never re-granted the SAF folder — the restoring
     device could display "healthy, last backup succeeded" for a folder grant it was
     never actually given on that install, directly contradicting D-16's "Successful
     automatic-folder writes define backup health" and D-18's nudge-suppression logic,
     and silently defeating threat T-17-09's own named mitigation ("Derive healthy from
     verified automatic SAF metadata only") through a completely different code path
     (restore) than the one that threat register entry was written against (17-09's UI).
   
   I found a mitigating factor that meaningfully reduces (but does not eliminate) the
   risk: `updateAppSettingsCore`/`updateAppSettings`'s actual write path is gated by a
   fixed `COLUMN_OF` allowlist (`src/db/app-settings-dao.ts:166`), and the codebase
   already has a live precedent for deliberately excluding certain columns from that
   generic patch surface (`ai_ack_google`/`ai_ack_custom` are "DELIBERATELY absent from
   `COLUMN_OF`", per the file's own comment at line ~400) — so a competent executor
   following the established pattern would plausibly keep `data_revision`/
   `last_backup_data_revision`/folder/health columns out of `COLUMN_OF` too, even
   without being told to. But unlike the `ai_ack_custom` reset behavior — which 17-12
   explicitly calls out as a MUST-preserve parity requirement with its own acceptance
   criterion and test — no Phase 17 plan states this requirement or asks for a
   regression proving these columns can never be written through the generic settings
   patch or the restore path. **Action needed:** add an explicit prohibition + test to
   17-05 (export must never serialize `data_revision`/`last_backup_data_revision`/SAF
   folder/health columns) and to 17-12 (these columns must never be added to
   `COLUMN_OF` or made reachable via `updateAppSettingsCore`), mirroring the existing
   `ai_ack_custom` treatment.

### Risk Assessment

**HIGH**, concurring with codex. Cycle 2's five findings are genuinely and verifiably
incorporated into executable plan text — the tombstone/reconciliation work, the
`inReadSnapshot` design, and the `sun_contact_id`/purge clock fix all hold up against
source. But the two mechanisms Cycle 2 itself mandated to close its own HIGHs —
`data_revision` and durable `_restore_pending` photo staging — each have a concrete,
source-verified gap: `data_revision`'s chokepoint list omits at least four real
production writers to exportable tables (`favourites-dao.ts`, `ring-seq-dao.ts`,
`profile-dao.ts`, `field-type-change.ts`), and the `_restore_pending` path shape
conflicts with the one safety guard (`assertSafeRelative`) the plan itself says it
reuses. Both are narrow, mechanical, easily-scoped fixes (extend 17-06's file list by
four files; either widen `SAFE_RELATIVE` or add a sibling pending-path validator and add
`photo-relative-path.ts` to 17-08's file scope) — not a re-architecture — but as written
today, an executor following the plans literally would ship a `data_revision` counter
that still misses real user edits and a photo-staging helper that throws on its first
call. The settings-snapshot field-scope ambiguity (data_revision/health columns not
explicitly excluded from the wire format) is real but lower-severity, given the
`COLUMN_OF` allowlist convention already narrows the blast radius; it belongs in the
actionable-MEDIUM bucket rather than blocking execution on its own.
