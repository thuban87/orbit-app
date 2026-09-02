---
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-02
  gap_snapshot: "unknown::scenarios=0"
---

# Phase 20 — Contact Reconciliation & Merge — UAT Runbook Research

Code-verified navigation, fixtures, and DB deltas for the 7 human-check scenarios,
plus cross-cutting answers A–E. Every claim is tagged `file:line`. All paths absolute
under `/home/bwales/projects/orbit-app`.

## Orientation — where things live

- Nav shell: `src/navigation/RootNavigator.tsx` — all Phase-20 screens are registered
  as native-stack routes (`RootNavigator.tsx:99-117`): `LegacyContactPicker`,
  `ImportReview`, `BulkImportSetup`, `ImportProgress`, `DuplicateReview`,
  `ImportComplete`, `BulkReview`, `SurvivorSelect`, `MergeConflicts`,
  `MergeImpactSummary`, `ReconcileDetail`, `ReconcileGrid`, `ReconcileComplete`.

- There is **no tab bar**. Reconcile/merge/import are reached from the **contact
  profile OverflowMenu**, the **Settings screen**, and the **Add speed-dial FAB**.

- Migration 013 owns the new tables: `src/db/migrations/013-reconciliation-and-merge.ts`
  - `reconciliation_sessions(id, uid, status['pending'|'complete'|'discarded'], total_checked, created_at, modified_at)` (`013:8-12`)
  - `reconciliation_session_cards(id, uid, session_id, contact_id, card_status['unresolved'|'partial'|'resolved'|'missing_source'], diff_json, unresolved_count, staged_photo_rel_path, created_at, modified_at)` (`013:18-24`)
  - `reconcile_source_snapshot(uid, external_contact_link_id, field_family, reviewed_value, reviewed_at)` UNIQUE(external_contact_link_id, field_family) (`013:33-36`, upsert `reconcile-snapshot-dao.ts:44-50`)
  - `bulk_review_resolutions(uid, import_session_row_id, flag_type='birthday', resolution['fixed'|'ignored'], resolved_at)` (`013:43`, insert `bulk-review-dao.ts:54-58`)
- Import tables from migration 012: `import_session_rows(... source_payload, contact_id, row_status, match_outcome ...)` (`src/db/migrations/012-import-sessions.ts:35`).
- Tombstones (pre-existing): `tombstones(entity_type, entity_uid, deleted_at)` — written by `insertTombstoneCore` (`merge-dao.ts:184`).

### run-as DB access reminder

Debug build + WAL-aware read (see MEMORY `device-uat-runas-pattern`). Package name TBD
— confirm with owner (CLAUDE.md notes the documented package name is quest-board's).

---

## Scenario 1 — Merge two Orbit contacts atomically

**Entry point + navigation**

1. Open the **survivor** contact's profile → route `Profile` (`ContactProfileScreen`).
2. Tap the overflow menu (kebab), then **"Merge with another contact"**
   (label `ContactProfileScreen.tsx:796`, testID `contact-profile-merge`) →
   `navigation.navigate("SurvivorSelect", { firstContactId })` (`:798`).

3. `SurvivorSelectScreen` with no `secondContactId`: title **"Choose a contact to
   merge"** (`SurvivorSelectScreen.tsx:38`); tap a candidate card → `setParams({secondContactId})`.

4. Same screen re-renders: title **"Which contact survives?"** (`:39`); a
   **"Recommended"** badge marks the recommendation (`recommendSurvivor`,
   `logic/survivor-recommendation.ts`); selected shows **"✓ Will survive"**; tap
   **"Continue"** → `navigation.navigate("MergeConflicts", { survivorId, absorbedId })`
   (`:36-37`). `absorbedId` = the non-selected id.

5. `MergeConflictsScreen`: if no conflicts, **"Continue"** (`:202`) →
   `navigation.navigate("MergeImpactSummary", { survivorId, absorbedId, resolutions })` (`:158`).

6. `MergeImpactSummary` (component `src/components/MergeImpactSummary.tsx`): title
   `Merge {absorbed} into {survivor}` (`:19`), a red warning `{absorbed} will be
   retired.` (`:19`). Tap **"Merge contacts"** (`:19`) → `Alert.alert("Merge
   contacts?", "This cannot be undone.")` with a destructive **"Merge"** button
   (`:17`) → `mergeContacts(...)` → `navigation.replace("Profile", { contactId: survivorId })` (`:17`).

**Fixtures**: Two live Orbit contacts (`contacts.archived_at IS NULL`) with **no
field conflicts** (or identical values), so `MergeConflictsScreen` yields an empty
conflict set and passes straight through. Simplest: two contacts A (survivor) and B,
each with distinct interactions/fuel/methods so the impact counts are non-zero.

**Expected observable result + DB deltas** (all inside one write txn,
`merge-dao.ts:98-188`):

- Land on the **survivor** profile (`replace("Profile", {contactId: survivorId})`).
- `contacts`: absorbed row **DELETEd** — `DELETE FROM contacts WHERE id = absorbed`
  asserts exactly 1 row (`merge-dao.ts:185-186`). It is **not** archived
  (`archived_at` is irrelevant; the row is gone).

- `tombstones`: **new row** `entity_type='contact', entity_uid=<absorbed.uid>,
  deleted_at=<now>` (`merge-dao.ts:184`). Assert: `SELECT * FROM tombstones WHERE
  entity_uid = '<absorbedUid>'`.

- Child rows reparented to survivor: `interactions, events, fuel,
  custom_field_values, contact_links, contact_methods, external_contact_links`
  all `contact_id → survivorId` (`merge-dao.ts:153`), plus `field_history`
  (`:154`).

- `recomputeLastContactCore(survivor)` (`:187`).
- Idempotency guards: re-merge of an already-tombstoned uid throws
  (`merge-dao.ts:105-106`); self-merge throws (`:96`).

**Assert absorbed is gone (not archived)**:
`SELECT COUNT(*) FROM contacts WHERE id=<absorbedId>` → 0, and the tombstone exists.

---

## Scenario 2 — Merge with name + birthday + primary-method conflicts

**Entry point + navigation**: identical to Scenario 1 through step 4. At step 5,
`MergeConflictsScreen` now renders conflict groups and requires a choice per group
before **"Continue"** enables (`ready` gate, `MergeConflictsScreen.tsx:139-148,202`).

**Which conflicts surface** (`MergeConflictsScreen.tsx`):

- **Scalar conflicts** — Name / Birthday / Category — only when both sides are
  non-empty AND differ (`meaningful` + `differs`, `:128-136`). Rendered via
  `FieldChoiceGroup mode="conflict"` labelled "Name" / "Birthday" / "Category"
  (`:172`). Provenance text is `From {name}` (`:63-65,165-166`).

- **Primary-method conflicts** — only `phone` and `email`, only when both contacts
  have an `is_primary=1` method of that type whose canonical values differ
  (`primaryConflict`, `:54-61,116-120`). Rendered as **"Primary phone"** /
  **"Primary email"** (`:180`).

- **Custom-field conflicts** — both non-blank and differing (`:92-107`).
- **Photo conflict** — both photos non-null and differing (`:137,174-177`).

Each group is `FieldChoiceOption` with ids `survivor` / `absorbed`. Selecting
resolves that group; when all resolved, **"Continue"** → `MergeImpactSummary`.

**Fixtures**: Two live contacts where:

- `contacts.name` differs (both non-empty).
- `contacts.birthday` differs (both non-null, both parse-valid).
- Each has a **primary** phone whose canonical values differ, and/or a primary email
  differing. (Primary = `contact_methods.is_primary=1`.)

**Expected DB deltas** (`merge-dao.ts`):

- Scalar choice `absorbed` copies the absorbed value onto the survivor via
  `updateContactMetadataCore` and snapshots the prior survivor value to
  `field_history` op `merge-overwritten` (`:156-173`). Choice `survivor` leaves the
  survivor value. `resolutions.scalars` carries keys `name`/`birthday`/`categoryId`
  (`MergeConflictsScreen.tsx:129-135`, contract `merge-dao.ts:23-28`).

- Primary-method resolution: the losing side's `is_primary` is set to 0
  (`merge-dao.ts:113-117`); duplicate canonical methods are collapsed (provenance
  reparented, loser DELETEd, `:124-132`).

- After merge, survivor's `contacts` row shows the chosen name/birthday; `field_history`
  has `merge-overwritten` rows for each absorbed-chosen scalar; absorbed contact deleted

  + tombstoned as Scenario 1.

**Note**: The merge writer's `MergeResolutions` contract (`merge-dao.ts:23-28`)
also lists `intervalDays/trackingEnabled/socialBattery/rarelyResponds/remindersOff`,
but the UI (`MergeConflictsScreen`) only emits **name, birthday, categoryId,
customFields, primaryMethod, photo**. Do not expect the cadence scalars to appear
as conflict rows.

---

## Scenario 3 — Per-contact "Update from Contacts" (single Bound contact)

**Entry point + navigation**

1. Open a **Bound** contact's profile. The overflow item **"Update from Contacts"**
   (label `ContactProfileScreen.tsx:801`, testID `contact-profile-update-from-contacts`)
   renders **only when `hasActiveExternalLink`** is true (`:800`) →
   `navigation.navigate("ReconcileDetail", { contactId })` (`:803`).

2. `ReconcileDetailScreen` title **"Update from Contacts"** (`ReconcileDetailScreen.tsx:131`).
   It reads active links, reads the live device contact via the native
   `readAllContacts` (`:43`), stages a source photo, and classifies via
   `classifyReconciliation` (`:57-60`).

3. Per-field rows via `ChoiceRow`/`FieldChoiceGroup` (`:133,136-139`):
   - **additive** → `mode="additive"`, default pre-selected to **source**
     (`setChoices ... "source"`, `:61`); recommended chip on the Contacts option.

   - **conflict** → `mode="conflict"`, **no default** (choice stays undefined →
     Apply disabled until chosen) (`unresolved` gate `:130,133`).

   - **removed-from-source** → `mode="removed"`, default **orbit**.
4. Tap **"Apply"** (`:133`) → `applyReconcileSelections` in a write txn (`:111`).

**Fixtures**: One Orbit contact **Bound** to an Android system contact via
`external_contact_links (is_active=1)` (see cross-cutting B for how to create the
binding). On the device contact:

- **(i) additive** change: add a NEW phone the Orbit contact lacks (source has a
  method canonical value not in Orbit → `additive`, `reconcile-diff.ts:265-272`).

- **(ii) conflict** change: change the device contact's **name** to something
  different from Orbit's (both non-empty, differ → `conflict`, `reconcile-diff.ts:213-220`);
  or change an existing email address so Orbit and source share the family but the
  canonical set has both an addition and a removal (`conflict`, `:270-275`).

**Expected observable + DB deltas** (`reconcile-apply.ts`):

- Accepting an additive phone → `contact_methods` gains the new method
  (`applyContactMethodDiffCore`, `:206-212`); Orbit methods are never dropped
  (`buildDesiredMethodList`, `reconcile-diff.ts:342-354`).

- Accepting a source name → `contacts.name` updated, prior value snapshotted to
  `field_history` op `reconcile-overwritten` (`reconcile-apply.ts:63-74,163-171`).

- **No re-nag mechanism** (KEY): every applied/kept non-photo field writes a row to
  `reconcile_source_snapshot (external_contact_link_id, field_family, reviewed_value=<source value>)`
  (`reconcile-apply.ts:89-103,215-218`; `reconcile-snapshot-dao.ts:44-59`). On the
  **second run**, `classifyReconciliation` reads those snapshots as `lastReviewed`
  (`ReconcileDetailScreen.tsx:56-59`) and, when `reviewedValue === current source
  value`, classifies the field **`unchanged-since-review`** instead of
  additive/conflict (`reconcile-diff.ts:178-187,254-262`). If the source later
  changes AGAIN, it re-surfaces as a conflict (`reconcile-diff.test.ts:58-60`).

- **Message states**: `diff.fields.length === 0` → "No changes from Contacts."
  (`ReconcileDetailScreen.tsx:62,131`). Stale-write guard: if Orbit changed under
  the open scan, "Orbit changed while this was open…" and reload (`:124`).

**⚠ Ambiguity to verify on-device (see end)**: `unchanged-since-review` is still
emitted as a *field object* and `ReconcileDetailScreen` renders **all**
`scan.diff.fields` (`:133`) — there is no filter dropping `unchanged-since-review`
rows in the detail screen. So a resolved field may still *appear* on the second run
(pre-selected to keep Orbit, no recommended-to-change chip) rather than vanishing.
The re-classification (no longer additive/conflict, Apply is effectively a no-op)
is the mechanical "no re-nag"; whether the row visibly disappears must be confirmed
by observation. Assert via SQL: after run 1, `SELECT field_family, reviewed_value
FROM reconcile_source_snapshot WHERE external_contact_link_id=<linkId>`.

---

## Scenario 4 — Bulk "Check linked contacts"

**Entry point + navigation**

1. **Settings** screen → **"Check linked contacts"** row (label
   `SettingsScreen.tsx:762`, a11y label `SettingsScreen.tsx:754`, testID
   `settings-check-linked-contacts-row`) → `onCheckLinkedContacts`
   (`SettingsScreen.tsx:172-183`).

2. If a **pending** reconcile session already exists, the **Resume prompt** appears
   instead of a fresh scan (`getNewestPendingReconcileSessionId`, `:174-177`) — see
   Scenario 5. Otherwise `navigation.navigate("ReconcileGrid")` (`:179`).

3. `ReconcileGridScreen` title **"Check linked contacts"** (`ReconcileGridScreen.tsx:268`),
   spinner label "Checking linked contacts…" (`:275`). It scans every contact with
   an active link (`:132-138`), classifies each, and **only creates a card when
   `diff.fields.length > 0`** (`:182-185`) → "only CHANGED contacts appear."

4. Cards render in `CandidateCardGrid` with bulk actions
   `["apply-recommendation", "keep-orbit", "use-contact-values"]` (`:272`).
   Human labels (`CandidateCardGrid.tsx:66-72`): **"Apply recommendation"**,
   **"Keep Orbit Values"**, **"Use Contact Values"**. Each card chip = "Add" /
   "Keep Orbit" / "Manual review" / "Source missing" (`ReconcileGridScreen.tsx:53-58`),
   with an "N differences left" hint (`:230`). Tapping a card opens
   `ReconcileDetail` for manual per-field resolution (`:277`).

**"Use Contact Values" ABSENT when a conflict row is selected**: the grid passes
`isActionEligible={(action, selected) => action !== "use-contact-values" ||
isAdditiveOnlySelection(selected diffs)}` (`ReconcileGridScreen.tsx:276`).
`isAdditiveOnlySelection` returns true only when EVERY selected card's every field
is `additive` and non-photo (`logic/reconcile-bulk-eligibility.ts:8-23`). So if any
selected card has a conflict / removed / photo / missing-source field, the
**"Use Contact Values"** action is filtered out of the action bar. (Confirm the
grid hides ineligible actions — `CandidateCardGrid` receives `isActionEligible`.)

**Partial resolution persists**: `onBulkAction` writes each card's status
transactionally (`ReconcileGridScreen.tsx:234-259`): `resolved` when 0 remain,
else `partial`, else `missing_source` (`:243-246`); `unresolved_count` updated;
`completionDisposition` set to `updated`/`kept-orbit` in `diff_json`
(`:247-254`). `refreshCards` re-lists and keeps only `unresolved`/`partial` cards
visible (`:114-121`). Resolved cards leave the working set but their contact writes
and snapshots stand.

**Summary counts**: on completion → `ReconcileComplete` (`:124-126`), counts via
`reconcileCompletionCounts` (`reconcile-session-read.ts:159-203`):
`checked`(=total_checked), `changed`, `updated`, `keptOrbitValues`, `sourceMissing`,
`unresolved` — computed by grouping `reconciliation_session_cards` on
`card_status` + `json_extract(diff_json,'$.completionDisposition')`.

**Fixtures**: ≥3 Orbit contacts each Bound to a device contact.

- 1 with only additive device changes (added phone) → chip "Add", eligible for
  "Use Contact Values".

- 1 with a conflict (changed name) → chip "Manual review"; selecting it must make
  "Use Contact Values" disappear.

- 1 with device data equal to Orbit → **must NOT appear** (fields empty, filtered
  at `:182-184`).

**DB deltas**: `reconciliation_sessions` row (status pending→complete via
`finalizeSessionIfTerminal`); one `reconciliation_session_cards` row per changed
contact with evolving `card_status`/`unresolved_count`; `contact_methods`/`contacts`
writes from applied additives; `reconcile_source_snapshot` rows per applied field.

---

## Scenario 5 — Kill app mid-review (process death) → Resume

**What is an "applied change" that must survive**: any card already written to a
terminal/partial state during the session — `contacts`/`contact_methods` edits are
committed per-card in their own txn (`ReconcileGridScreen.tsx:240-256`), and the
card's `card_status` (`resolved`/`partial`/`missing_source`) + `reconcile_source_snapshot`
rows are durable. Killing the process cannot roll these back (each was its own
committed SQLite transaction).

**How resume is detected on relaunch**:

- The session stays `status='pending'` until all cards are terminal
  (`finalizeSessionIfTerminal`); a mid-review kill leaves it pending with a mix of
  `resolved`/`partial` and `unresolved` cards.

- Launch sweep `registerReconcileResumeSweep` (`services/import/reconcile-resume-sweep.ts:85-118`)
  runs at foreground, calls `getResumableReconcileSession` — returns the **newest
  pending** session and **discards older pending sessions** (`reconcile-session-read.ts:104-129`).
  Corrupt `diff_json` → `discardOnly` (`reconcile-resume-sweep.ts:50-56,102-109`).

- User-facing resume: **Settings → "Check linked contacts"** calls
  `getNewestPendingReconcileSessionId` (`SettingsScreen.tsx:174`); if non-null it
  shows `ResumeReconcilePrompt` (`SettingsScreen.tsx:816-820`) with a **"Resume"**
  button (a11y "Resume check", `ResumeReconcilePrompt.tsx:45`) →
  `navigation.navigate("ReconcileGrid", { sessionId })`.

- `ReconcileGridScreen` with a `sessionId` param **does NOT re-scan** — it calls
  `refreshCards(sessionId)` (`ReconcileGridScreen.tsx:114-121,215`), listing only
  `unresolved`/`partial` cards. Already-`resolved` cards are excluded → applied work
  preserved, unresolved work restored.

- Precedence when both an import and a reconcile are resumable: import wins
  (`services/resume-prompt-precedence.ts:5-12`).

**Fixtures**: A bulk reconcile session with ≥2 changed contacts. Resolve one card
(status → resolved, contact write committed), leave ≥1 `unresolved`. Then force-kill:
`adb shell am force-stop <package>` (or `am kill`). Relaunch.

**Expected**: Settings shows the Resume prompt. Resume lands on `ReconcileGrid`
showing only the still-unresolved card(s); the resolved contact retains its applied
edit. **DB asserts**: `reconciliation_sessions.status='pending'`;
`reconciliation_session_cards` shows the mix of `resolved` + `unresolved`; the
resolved contact's `contacts`/`contact_methods` reflect the applied change;
`reconcile_source_snapshot` has the resolved card's rows.

---

## Scenario 6 — Delete a linked device contact → "Source missing"

**Entry point + navigation**: same as Scenario 3 — profile overflow **"Update from
Contacts"** → `ReconcileDetailScreen`. (Also reachable per-card from
`ReconcileGrid`.)

**Trigger classification**: when the picker read cannot find the linked device
contact, `readAllContacts` reports it as **omitted**, and
`classifyReconciliation` returns a single **`missing-source`** card
(`reconcile-diff.ts:287-302`) — this is `omittedCount > 0`, i.e. the source contact
is gone, **not** field removals. In `ReconcileGrid` the same is driven by
`omittedCount: pickedLinks.some(item => !item.picked) ? 1 : 0` (`ReconcileGridScreen.tsx:179`).

**Missing-source UI** (`ReconcileDetailScreen.tsx:132`): title "Update from
Contacts", a **"Source missing"** chip (`:132`), body **"This linked phone contact
is no longer available. Your Orbit contact and relationship history stay
unchanged."**, and three actions:

- **"Keep as is"** → `keepMissingSource` (`:74-79`) — marks the card
  `missing_source` if in a session, `navigation.goBack()`. No Orbit write.

- **"Relink to another contact"** → `relinkMissingSource` (`:87-99`) — opens the
  native `pickContacts({multiple:false})`, then `relinkExternalSource`
  (`reconcile-relink-dao.ts:29-70`): retires the stale link (`is_active=0`) and
  inserts a new active `external_contact_links` row, then re-runs `load()` (re-scan
  → the normal diff review resumes). Duplicate-active-link → alert offering
  "Review merge" (`:92-94`).

- **"Unlink source"** (danger) → `unlinkMissingSource` (`:80-86`) —
  `unlinkExternalSource` sets `is_active=0` (`reconcile-relink-dao.ts:73-86`). Orbit
  contact untouched.

**Fixtures**: An Orbit contact Bound to a device contact (active
`external_contact_links`). Then **delete that contact in the Android Contacts app**.
Have a **second** device contact available to relink to.

**Expected observable + DB deltas**:

- Screen shows "Source missing" (NOT a list of removed fields). Orbit contact +
  interactions unchanged.

- "Keep as is": if launched from a session card → `reconciliation_session_cards.card_status='missing_source'`;
  no `contacts`/`contact_methods`/`external_contact_links` change.

- "Relink": stale `external_contact_links` row `is_active 1→0`, a **new active row**
  with the new `external_contact_id`; then the standard reconcile review runs against
  the new source. Assert:
  `SELECT id,is_active,external_contact_id FROM external_contact_links WHERE contact_id=<id>`.

- "Unlink": the link's `is_active 1→0`; contact becomes Unbound.

---

## Scenario 7 — "Review flagged items" (bulk birthday review)

**Entry point + navigation**

1. **Settings** → **"Review flagged items"** row (label `SettingsScreen.tsx:779`,
   a11y `SettingsScreen.tsx:771`, testID `settings-bulk-review-row`, helper "Fix
   import details Orbit could not read.") → `navigation.navigate("BulkReview")`
   (`:772`).

2. `BulkReviewScreen` title **"Review flagged items"** (`BulkReviewScreen.tsx:126`,
   testID `bulk-review-screen`). Each flagged card shows the contact name and
   `Birthday: "<raw>" — couldn't be read` (`:167-169`) and two buttons:

   - **"Fix"** (a11y `Fix birthday for <name>`, `:231`) → opens an inline
     `TextInput` (placeholder `YYYY-MM-DD`) + **"Save birthday"** button (`:172-225`).

   - **"Ignore"** (a11y `Ignore birthday for <name>`, `:249`).
   Empty state: "Nothing to review" / "No flagged items right now." (`:140-148`).

**What makes a birthday "flagged"** (`bulk-review-read.ts:36-66`): a row in
`import_session_rows` with **`contact_id IS NOT NULL`** (i.e. it was actually
imported/linked) and **no** matching `bulk_review_resolutions` row for
`flag_type='birthday'`, whose `source_payload.birthday` is **unreadable** —
`isBirthdayUnreadable(raw)` = non-empty AND `mapBirthdayForStorage(raw) === null`
(`logic/picked-contact-map.ts:73-80`). `source_payload.birthday` stores the **raw,
unmapped** device birthday captured at accept time (`import-acquire.ts:92-96`).

**"Fix" behavior** (`resolveBulkReviewFlag`, `bulk-review-dao.ts:72-111`): validates
input via the single parser `normalizeEditedBirthday` (`BulkReviewScreen.tsx:58-63`,
`logic/birthday-logic.ts:normalizeEditedBirthday`), writes `contacts.birthday` via
`updateContactMetadataCore`, bumps `data_revision`, and inserts
`bulk_review_resolutions(..., resolution='fixed', ...)`. The flag disappears (the
LEFT JOIN now matches → excluded, `bulk-review-read.ts:44-48`).

**"Ignore" behavior** (`ignoreBulkReviewFlag`, `bulk-review-dao.ts:114-123`): inserts
`bulk_review_resolutions(..., resolution='ignored', ...)` **only** — no
`contacts.birthday`, no other data touched. Flag disappears. (Test confirms
"ignores only the flag and leaves contact data and revision unchanged",
`bulk-review-dao.test.ts:109`.)

**Concrete unreadable VCF `BDAY` value → `2021-02-29`** (Feb-29 in a NON-leap
year). Trace: the native picker reads the Android `Event` (TYPE_BIRTHDAY) `data1`
string **verbatim** into `picked.birthday`
(`modules/orbit-contact-picker/android/.../OrbitContactPickerModule.kt:270-271,432`);
import stores that raw string in `source_payload.birthday`
(`import-acquire.ts:95`). `mapBirthdayForStorage("2021-02-29")` takes the fall-through
branch (not slash, not `--`/`\d\d-\d\d`), passes `"2021-02-29"` to
`buildBirthdayForStorage(_, false)` → `isValidStoredBirthday` →
`parseStoredBirthday` rejects day 29 > `daysInMonth(2021,2)=28` → **null** → unreadable
(`picked-contact-map.ts:62-66`; `birthday-logic.ts:98-108`). So the VCF line
**`BDAY:2021-02-29`** (or `BDAY:20210229`) yields a flag.

- Other reliable unreadable values: `2023-04-31`, `2023-13-01`, any clearly-textual
  value Android stores verbatim (e.g. `BDAY:sometime` — but a valid ISO date is the
  safest to guarantee Android ingests it).

- **Do NOT use** `--02-29` (year-unknown Feb-29): that is **readable** — the parser
  maps `--MM-DD`/`MM-DD` to a leap-permissive `2000-02-29` which validates
  (`picked-contact-map.ts:67-71`, `birthday-logic.ts:82-92`). Year-unknown Feb-29
  survives on purpose.

**Fixtures**: Import (bulk path, see A) at least one device contact whose VCF had
`BDAY:2021-02-29`, completing the import so the contact is created (row gets
`contact_id`). That row then surfaces in "Review flagged items".

**Expected DB deltas**:

- Before: `import_session_rows` row with `contact_id` set,
  `source_payload` containing `"birthday":"2021-02-29"`, `contacts.birthday` NULL
  (mapping returned null at import; `commitSingleImport`/`importRowAsNew` store the
  mapped value which is null).

- After **Fix** "1990-05-14": `contacts.birthday='1990-05-14'`; new
  `bulk_review_resolutions(import_session_row_id=<row>, flag_type='birthday',
  resolution='fixed')`; `data_revision` bumped.

- After **Ignore**: new `bulk_review_resolutions(..., resolution='ignored')`;
  `contacts.birthday` still NULL; nothing else changes.

- Assert: `SELECT resolution FROM bulk_review_resolutions WHERE import_session_row_id=<row>`.

---

# Cross-cutting answers

## A. How Orbit imports a device contact

**Entry points** (three, all funnel to the same sink):

- **Settings → "Import contacts"** row (`SettingsScreen.tsx:808`, a11y "Import
  contacts", testID `settings-import-contacts-row`) → `onImportContacts`
  (`SettingsScreen.tsx:155-170`).

- **Add speed-dial FAB → "Import from Contacts"** (`components/AddSpeedDialFab.tsx:92`,
  onPress `:79` → `startContactImport`, `:55`).

- Both call `startContactImport` (`services/import/start-contact-import.ts:25-45`)
  with `pick: () => pickContacts({ multiple: true })`.

**Routing seam** (`start-contact-import.ts` + `import-acquire.ts`):

- `contactImportMode()` (`use-contact-import-mode.ts:5-8`) returns `"system"` if the
  native picker is available, else `"legacy"`. Legacy → `navigate("LegacyContactPicker")`
  (`start-contact-import.ts:33-36`; `LegacyContactPickerScreen` title "Import
  contacts", `:197`).

- System path: `pick()` opens the native multi-select picker; `routePickedImport`
  (`import-acquire.ts:156-176`) branches by **cardinality**:

  - **exactly 1 picked → single**: `acceptPickedContacts(mode:"single")` →
    `navigate("ImportReview", {sessionId})` (`import-acquire.ts:166-172`).
    `ImportReviewScreen` reviews the one contact then commits via
    `commitSingleImport` (`import-acquire.ts:120-153`) → `ImportComplete`.

  - **≥2 picked → bulk**: `acceptPickedContacts(mode:"bulk")` →
    `navigate("BulkImportSetup", {sessionId})` (`:173-174`).
    `BulkImportSetupScreen` (title "Import contacts", `:200`) sets a batch category,
    then `ImportProgress` runs the driver, then `DuplicateReview` for ambiguous rows
    (`DuplicateReviewScreen`, title "Review matches", `:231`), then `ImportComplete`.

- Both paths write a durable session first: `acceptImportSessionWithRows` inserts
  `import_sessions` + `import_session_rows` (each row carries
  `source_payload={displayName, methods, birthday}` and a staged photo path,
  `import-acquire.ts:63-113`). Screens read the session; they never re-query Android.

**User-visible labels**: "Import contacts" (Settings row + Legacy/BulkSetup titles),
"Import from Contacts" (FAB), "Review matches" (DuplicateReview), bulk-review actions
"Link to Existing" / "Import as New" / "Skip" (`CandidateCardGrid.tsx:67-69`),
"Import as New" resolver (`DuplicateReviewScreen.tsx:161-169`).

## B. How a contact is "Bound"; changed vs unchanged classification

**Binding**: an active row in `external_contact_links(contact_id, provider,
external_contact_id, is_active=1)`. Created when a device contact is imported as new
(`importContactRecord` → `insertExternalContactLinkCore`,
`imported-contact-dao.ts:64-87,108`) or linked to an existing Orbit contact
(`linkExistingContactToRow`, `imported-contact-dao.ts:193-222`; used by
`DuplicateReviewScreen.tsx:195-202`). The profile's `hasActiveExternalLink` gates the
"Update from Contacts" menu item (`ContactProfileScreen.tsx:800`).

**Changed vs unchanged** (`logic/reconcile-diff.ts`, pure): for each field family
(name, phones, emails, birthday, photo) `classifyReconciliation` compares the Orbit
value to the device source value (methods compared by **canonical** value, not raw
formatting/labels — `canonicalMethod`, `:83-92`, `test:40-47`), against the
`reconcile_source_snapshot` `lastReviewed` memory. Outcomes (`:15-20`):

- **`additive`** — source adds a value Orbit lacks, no removals
  (scalar: Orbit empty + source present, `:201-210`; methods: additions only,
  `:265-272`). Recommended → source.

- **`conflict`** — both non-empty and differ (scalar, `:213-220`) or methods have
  both additions AND removals (`:270-275`). Requires manual choice.

- **`removed-from-source`** — Orbit has it, source dropped it (`:189-199,273-274`).
- **`unchanged-since-review`** — `reviewedValue === current source` (`:178-187,254-262`).
- **`missing-source`** — the whole device contact is absent (`omittedCount>0`,
  `:287-302`).

- A field with source == Orbit and no snapshot → **null** (not surfaced; scalar
  `:212`, methods `:267`). A contact with **zero** surfaced fields never becomes a
  card (`ReconcileGridScreen.tsx:182-184`) — this is the "only changed contacts".

**Reliable device edits**:

- **(i) additive** — add a NEW phone number or email to the device contact (Orbit
  keeps all its own methods; the extra canonical value is an addition).

- **(ii) conflict** — change the device contact's **name** to a different non-empty
  value (Orbit name non-empty) → scalar conflict; or **replace** an existing device
  email with a different one so the family has both an add and a remove → method
  conflict. (Merely re-formatting a phone, e.g. dashes vs spaces, is NOT a change —
  canonicalization makes them equal, `test:40-47`.)

## C. What makes a birthday "unreadable"/flagged

Covered fully in Scenario 7. Summary: `import_session_rows` with `contact_id` set,
no `bulk_review_resolutions` for `flag_type='birthday'`, whose raw
`source_payload.birthday` fails `mapBirthdayForStorage` (`bulk-review-read.ts:52-65`;
`picked-contact-map.ts:73-80`). Raw birthday comes verbatim from the Android Event
`data1` (`OrbitContactPickerModule.kt:270-271`) into `source_payload`
(`import-acquire.ts:95`). Concrete VCF value: **`BDAY:2021-02-29`** (Feb-29 non-leap
→ parser null). Avoid `--02-29` (readable by design).

## D. Scenario 5 — applied change vs resume detection

Covered in Scenario 5. Key files: applied writes committed per-card
(`ReconcileGridScreen.tsx:240-256`); resume detection
`getResumableReconcileSession` / `getNewestPendingReconcileSessionId`
(`reconcile-session-read.ts:104-143`); launch sweep
`registerReconcileResumeSweep` (`reconcile-resume-sweep.ts:85-118`); precedence
`resolveActiveResumePrompt` (`resume-prompt-precedence.ts:5-12`); resume UI
`ResumeReconcilePrompt.tsx:45` → `ReconcileGrid` with `sessionId` (refresh, not
re-scan).

## E. Merge flow — initiation, screens, labels, atomic proof

- **Initiation**: profile overflow **"Merge with another contact"**
  (`ContactProfileScreen.tsx:796`) → `SurvivorSelect`. (Also from `ReconcileDetail`
  header link "Merge with another contact", `ReconcileDetailScreen.tsx:133`, and
  from the relink duplicate-active-link "Review merge" alert, `:93`.)

- **Screens + labels**:
  - `SurvivorSelectScreen` — "Choose a contact to merge" (pick the other) → "Which
    contact survives?" with a "Recommended" badge, "✓ Will survive", "Continue"
    (`SurvivorSelectScreen.tsx:38-39`).

  - `MergeConflictsScreen` — "Resolve merge conflicts" / "Choose the value to keep
    for every difference." (`:170-171`); `FieldChoiceGroup` groups labelled Name,
    Birthday, Category, Primary phone/email, custom-field labels, Photo; "Continue"
    (`:202`). (`FieldChoiceGroup` = `src/components/FieldChoiceGroup.tsx`.)

  - `MergeImpactSummary` — "Merge {absorbed} into {survivor}", impact counts
    (interactions/fuel/events/methods/links), "{absorbed} will be retired.",
    "Merge contacts" → confirm alert "Merge contacts?" / "This cannot be undone." /
    destructive "Merge" (`MergeImpactSummary.tsx:17-19`).

  - **`DuplicateReviewScreen`** is the IMPORT duplicate-matching screen ("Review
    matches", actions Link/Import as New/Skip), **not** the merge conflict screen —
    do not conflate.

- **Atomic-merge + tombstone proof** (`merge-dao.ts:92-188`, single
  `inWriteTransaction`): absorbed `DELETE FROM contacts` asserts exactly 1
  (`:185-186`); `tombstones` gains `entity_type='contact', entity_uid=<absorbed.uid>`
  (`:184`); all child tables reparented to survivor (`:153-154`);
  `reconciliation_session_cards` for the absorbed contact are cleaned up and any
  now-empty session marked complete (`:178-183`). Assert: absorbed id absent from
  `contacts`, present in `tombstones`; survivor owns the reparented rows.

---

# Unresolved ambiguities (verify on device)

1. **`unchanged-since-review` rendering (Scenario 3).** The classifier still emits an
   `unchanged-since-review` field object, and `ReconcileDetailScreen` renders every
   `scan.diff.fields` entry with no filter excluding that outcome
   (`ReconcileDetailScreen.tsx:133`). The snapshot mechanism guarantees the field is
   no longer classified additive/conflict (so Apply won't re-change it), but whether
   the row *visually disappears* on the second run vs. shows as a pre-resolved
   keep-Orbit row is not determinable from code alone. Observe: does the second
   "Update from Contacts" show "No changes from Contacts", or a still-listed row?
   (Same question for the grid: a fully-reviewed contact whose device data is
   unchanged — does it still produce a card because its fields are
   `unchanged-since-review` rather than null? `ReconcileGridScreen.tsx:182` filters
   only on `fields.length === 0`.)

2. **App package name / Metro port** for run-as SQLite reads and driving the app —
   confirm with owner (CLAUDE.md flags the documented package as quest-board's; use
   the DEBUG build + WAL-aware read per MEMORY `device-uat-runas-pattern`).

3. **Single vs bulk for Scenario 7 flag creation.** The flag surfaces for any
   imported row (single or bulk) whose `contact_id` is set and raw birthday is
   unreadable (`bulk-review-read.ts:47-54`). The single path (`commitSingleImport`)
   and the bulk path (`importRowAsNew`) both set `contact_id`; both should raise the
   flag. Confirm the single-import path also persists `source_payload.birthday`
   verbatim (it does, `import-acquire.ts:92-96`, shared accept step) — but exercise
   the **bulk** path to match the scenario's "bulk birthday review" framing.

4. **`CandidateCardGrid` action visibility** — confirmed the grid passes
   `isActionEligible`, but verify empirically that an ineligible action ("Use
   Contact Values" with a conflict selected) is actually **removed from the action
   bar** rather than merely disabled.
