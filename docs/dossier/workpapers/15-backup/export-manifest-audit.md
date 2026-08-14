# 15-backup — Export Manifest Audit

**Purpose.** The definitive, implementer-ready inventory of everything a full Orbit backup export
must contain, deliberately exclude, or recompute on restore. Built by reading the settled dossiers
(01-data, 03-fuel, 04-log, 06-crud, 07-photos, 08-dashboard, 09-orrery, 10-capture, 11-notify,
12-widget, 13-ai, 14-digest), INDEX.md's cross-domain constraint log, and HANDOFF §3 / §14 in full.

**Why export is load-bearing (not a chore).** `android:allowBackup="false"` (01-data cluster G) +
the DB lives at `/data/data/<pkg>/files/SQLite/` and is **deleted on uninstall** (01-data F15) + no
server, no remote access, no Auto Backup. Export is the *only* barrier between a wiped phone and
total, unrecoverable loss (`[data → backup]`, INDEX:443-444). Restore must **MERGE, not
replace-only** — recovering from a 3-month-old backup must not destroy 3 months of logging
(`[log → data]`, 04-log:363-369). Merge is why every user-data table carries a stable, globally
unique id (`[log → all]`, 04-log:578).

**Legend for the disposition column.**
- **EXPORT** — serialize the stored value; restore writes it back (merging on uid).
- **EXCLUDE** — deliberately never written to the export file.
- **DERIVED-RECOMPUTE** — either not stored at all, or stored-but-derived; restore must recompute
  it from the exported rows rather than trust an exported copy.

---

## A. SQLite tables — full column enumeration

### A.1 `contacts`

| Column | Disposition | Rationale + source |
|---|---|---|
| surrogate `id` (PK) | EXPORT (see note) | Identity is never name/path (01-data cluster A, "made-without-you" #1). Internal PK; whether it *also* serves as the merge key or a separate `uid` column exists is unresolved — see Disagreements #4. |
| stable `uid` (globally-unique) | EXPORT | `[log → all]` (04-log:578): every user-data table carries a stable uid so restore can MERGE. **Cannot be backfilled truthfully** (04-log:569-570). |
| `name` | EXPORT | Core identity column (01-data A). Duplicate names allowed — no UNIQUE constraint (01-data A), so export is not collision-free; merge keys on uid, never name. |
| `category_id` (FK → categories) | EXPORT | Stable FK to the `categories` table (01-data D). Merge must restore `categories` first so the FK resolves. |
| `interval_days` (frequency) | EXPORT | Integer interval in days; the 7 presets are UI over the number (01-data C). |
| `last_contact` | **DERIVED-RECOMPUTE** | ⚠ **Stored-but-derived.** It is a maintained MAX over the interaction rows' current `occurred_at` (filtered to connected rows for "Rarely responds" contacts) (01-data B, 04-log A). `[log → backup]` (04-log:615-619): **must NOT be restored as authoritative** — omit it or recompute after loading rows; **rows win**. See Restore Hazard #1. |
| `birthday` (nullable year) | EXPORT | Fixed column, one parser, optional year (01-data F). Drives banner (08) + birthday notification (11). |
| `phone` (nullable) | EXPORT | Third-party PII; the decay→SMS loop reads it (01-data E, HANDOFF §6). |
| `email` (nullable) | EXPORT | Nullable reach column (01-data E). |
| `social_battery` (Charger/Neutral/Drain) | EXPORT | Fixed column — read by dashboard filter + AI prompt, so not user-deletable (01-data F). |
| favourite `rank` (nullable) | EXPORT | Ordered nullable rank column; tiles hold position (01-data E; widget config 08/12). |
| `ring_seq` (nullable) | EXPORT | Global radius override (01-data — reverses §7). **Cannot be backfilled truthfully** (01-data "deferred to planning"; 04-log:569-570 class). Orrery reads it; adds no other new column (`[orrery → data/backup]`, 09:200-204). |
| `photo` (nullable TEXT) | EXPORT the **value semantics only, not verbatim** | Stores a **relative filename** under the document dir, resolved to absolute `file://` at read (`[photos → data]`, 07:131-134). The **file bytes** ride in the export as base64 (§B); on restore the path is **repointed to a freshly written file**, never restored verbatim (`[photos → backup]`, 07:154). See Restore Hazard #2. |
| "Rarely responds" flag | EXPORT | Per-contact reciprocity setting; changes recency math to filtered-MAX (04-log A; 06-crud D). Visible label, not hidden switch. |
| "reminders off" mute flag (nullable, default off) | EXPORT | Owner-added permanent mute; suppresses **decay scheduling only** (`[notify → data]`, 11:272-276). *Can* be backfilled (default off) so not migration-critical, but it is real per-contact state → export it. |
| `archived_at` (nullable) | EXPORT | Archive = hidden/restorable; `archived_at IS NULL` predicate excludes from normal queries (01-data A, "made-without-you" #11). Archived contacts and their children are still real data → export. |
| snooze field(s) (`snooze_until`) | EXPORT | Snooze is suppression; clock keeps running (01-data C). The active snooze is contact state → export. (Snooze *history* lives in `events`, §A.3.) |
| `created_at` | EXPORT | General ring tiebreaker; needed by sweeps/retention/export ordering (01-data E). **Cannot be backfilled truthfully** (01-data:497; 04-log:569-570 class). |

> **Removed, do not export:** `contact_link` as a scalar column on `contacts` — **06-crud reversed
> 01-data**: it is now the `contact_links` child table (§A.10). `last_interaction` — **rejected**
> (01-data B): channel lives on the interaction row only, read from the newest row.

### A.2 `interactions`  (`[log → data]`, 04-log:564-570)

| Column | Disposition | Rationale + source |
|---|---|---|
| stable `uid` | EXPORT | Merge key; **cannot be backfilled** (04-log:569-570). |
| `contact_id` | EXPORT | Owning FK. |
| `occurred_at` (local wall-clock, editable) | EXPORT | The value the status engine reads; stored as written wall-clock, no zone (04-log D, F9). `last_contact` is recomputed as MAX over these on restore. |
| `recorded_at` (immutable) | EXPORT | When written down; set from device clock, never changes ("made-without-you" #6). **Cannot be backfilled** (04-log:569-570). |
| `channel` (call/text/in-person/email/other/unspecified) | EXPORT | Closed enum incl. first-class `unspecified` (04-log A). |
| `direction` (outbound/inbound/mutual/null) | EXPORT | Nullable; one-tap routes write `outbound` (04-log A + revision G). |
| connected flag | EXPORT | Whether the touchpoint connected (04-log A). Feeds filtered-MAX for "Rarely responds". |
| `quality` (good/fine/hard/null) | EXPORT | Optional 3-way marker, full-flow only (04-log D). Digest + AI aggregates read it. |
| `note` (nullable) | EXPORT | Plain text (not markdown). **Never transmitted to AI** (04-log D) — but it *is* user data and must be in the backup. |
| `source` (manual/widget/notification/ai) | EXPORT | How the row was created; `import` dropped from enum (04-log F/cut). **Cannot be backfilled** (04-log:569-570). |

Indexed on `(contact_id, occurred_at DESC)` — an ordinary index, fine (04-log "made-without-you" #3).

### A.3 `events`  (`[log → data]`, 04-log:571-572; 348-360)

| Column | Disposition | Rationale + source |
|---|---|---|
| stable `uid`, `contact_id`, event type (snooze/unsnooze/archive/restore), timestamp, (snooze length) | EXPORT | Separate table so no recency query can forget a type predicate (04-log F). Rows are **immutable** ("made-without-you" #5). Timeline reads them interleaved with interactions. `[log → backup]` (04-log:615): **export must include `events`** as well as `interactions`. |

### A.4 fuel items — `fuel` table  (`[fuel → backup]`, 03-fuel:415-417)

| Column | Disposition | Rationale + source |
|---|---|---|
| stable `uid` | EXPORT | Merge key (04-log:578-579). |
| `contact_id` (**NOT NULL**) | EXPORT | No unattached fuel, ever — settled as not-retrofittable (`[capture → fuel]`, 10:161-165). |
| `kind` (recent/topic/fact/gift/off_limits) | EXPORT | Closed set; `off_limits` never transmitted/glanceable (03-fuel A/C). **Backup carries off_limits items** — they are exclusion-from-AI, not exclusion-from-user-data. |
| `label` (optional free-text) | EXPORT | Per-item free label (03-fuel A). |
| `url` (own column, separate from display text) | EXPORT | Canonical, separate from editable prose — the reversibility hinge (03-fuel A; `[capture → fuel/backup]`, 10:174-176). |
| display text | EXPORT | User-editable prose; must never overwrite `url` (10 cluster 2). |
| `created_at` | EXPORT | Drives ranking + age display + AI recency (03-fuel C). **Cannot be backfilled** (03-fuel:388-389). |
| `source` (user/share/ai/import→dropped) | EXPORT | `source='ai'` rows render unconfirmed, excluded from prompts until confirmed (03-fuel E). `import` value dropped (04-log cut). **Cannot be backfilled** (03-fuel:388-389). |

> **01-data's original export list OMITS fuel entirely** (01-data:461-463) — corrected by 03-fuel.
> See Disagreements #1.

### A.5 `categories`  (01-data D)

| Column | Disposition | Rationale + source |
|---|---|---|
| stable `uid`, label, sort order, (seed marker) | EXPORT | User-editable single-select list, seeded Family/Friends/Work/Community; `contacts.category_id` FKs to it (01-data D). Carries a stable uid (04-log:578-579). **Restore this before `contacts`** so the FK resolves. `[data → backup]` names `categories` explicitly (01-data:461-463). |

### A.6 self / profile record (single-row)  (01-data E)

| Column | Disposition | Rationale + source |
|---|---|---|
| user name | EXPORT | "Me" is a separate single-row table so no query must exclude the user (01-data E). Named in `[data → backup]` (01-data:461-463). |
| self `photo` | EXPORT value semantics; **bytes as base64, path repointed** | Same pipeline as contact photos; export embeds the self photo bytes (07-photos cluster E, `[photos → backup]` 07:154). |

### A.7 `custom_field_defs`  (HANDOFF §14.1)

| Column | Disposition | Rationale + source |
|---|---|---|
| `id` / stable `uid` | EXPORT | One **row** per field (HANDOFF §14.1). Stable id per `[log → all]` (04-log:578, names "custom field defs and values"). |
| `col_name` | EXPORT | Whitelist-**constructed** identifier (01-data F17). On restore it drives `ALTER TABLE contact_custom_values ADD COLUMN` re-creation (see Restore Hazard #4). |
| `label`, `type`, `options` | EXPORT | `type` drives the UI widget only; storage stays TEXT (HANDOFF §14.2). |
| `show_on_new` | EXPORT | New fields default false (06-crud "made-without-you" #2). |
| `quarantined_at` (nullable) | EXPORT | Quarantine sets the timestamp; data untouched (HANDOFF §14.5). **A quarantined-but-unexpired field is still live data** → export the def AND its column (Restore Hazard #4). |
| display-order column | EXPORT | Required from migration 1 (`[crud → fields]`, 06-crud:210-214); insertion order cannot be backfilled. |
| `share_with_ai` (default false) | EXPORT | On the **defs** table, not `contact_custom_values`, so §14 index/DROP rules untouched (`[ai → fields]`, 13:140-145). It is a non-secret AI setting and is exportable (`[ai → backup]`, 13:146-149). |

### A.8 `contact_custom_values`  (HANDOFF §14.1)

| Aspect | Disposition | Rationale + source |
|---|---|---|
| one **column** per field (all TEXT forever), one **row** per contact | EXPORT | Values live here (HANDOFF §14.1-14.2). **Every column TEXT permanently** — export/restore must not "fix" a column to INTEGER/REAL/BOOLEAN (CLAUDE.md; HANDOFF §14.2). |
| stable `uid` (per row) | EXPORT | `[log → all]` names "custom field defs **and values**" (04-log:578-579). |
| the dynamic columns themselves | EXPORT as data; **recreate structure from defs on restore** | A naive `SELECT *` captures the *values*, but the *columns* only exist if the ADD COLUMN ran; restore must ADD COLUMN per def first, then load values. Photo-type custom fields store a **path** here → their files ride in §B (`[photos → fields]`, 07:139-141). **Never index / never UNIQUE** these columns (CLAUDE.md; §14.11). |

### A.9 `field_history`  (HANDOFF §14.6)

| Aspect | Disposition | Rationale + source |
|---|---|---|
| contact id, field key, old value, timestamp, operation | **DECISION NEEDED — recommend EXCLUDE** | 01-data explicitly left this "(decide)" in the export scope (`[data → backup]`, 01-data:461-463). It is a **30-day transient undo buffer**, swept at launch (HANDOFF §14.6), and contact purge destroys its rows (01-data:83-93). Recommendation: **EXCLUDE** — it is recovery scratch, not authoritative user data, and exporting expired-then-swept snapshots to a new device is meaningless. Flagged as genuinely OPEN — the owner/backup-domain decides. |

### A.10 `contact_links`  (06-crud — reverses 01-data)

| Column | Disposition | Rationale + source |
|---|---|---|
| stable `uid`, `contact_id`, `url`, optional label, sort order | EXPORT | ⚠ Owner reversal: `contact_link` scalar column → child table (`[crud → data]`, 06-crud:198-201). `[crud → data/backup]` (06-crud:226-229): **export/restore must include `contact_links`; purge must `DELETE FROM contact_links` explicitly.** phone/email stay single columns on `contacts`. |

---

## B. On-disk files outside SQLite (unreachable by any foreign key)

A naive per-table `SELECT *` export silently misses all of these — they are **not in the database**.

| Artifact | Disposition | Rationale + source |
|---|---|---|
| Contact photo files (512px JPEG masters, document dir) | **EXPORT as base64; restore writes fresh files + repoints RELATIVE paths** | `[photos → backup]` (07:105-110, 154): path-only export loses every avatar on device migration. ~40 KB × tens of contacts = a few MB, trivial. **Never restore the stored path verbatim** — it is device-specific/relative (07:131-134). |
| The one self photo | EXPORT as base64 (same) | Explicitly "applies to the self photo too" (07-photos cluster E). |
| Custom photo-field files (§14.8 `photo` type) | EXPORT as base64 (same pipeline) | `[photos → fields]` (07:139-141): photo custom fields reuse the pipeline; "purge/backup/orphan rules… extend to these files." Their path string lives in `contact_custom_values` (§A.8). |

---

## C. App-level / global settings (not per-contact)

Stored in a SQLite **settings** area (non-secret), distinct from secure-store. Restore reconstructs
schedules rather than trusting any exported schedule.

| Setting | Disposition | Rationale + source |
|---|---|---|
| `sun_contact_id` (nullable; NULL = self) | EXPORT | Assignable sun (01-data E). `[orrery → data/backup]` (09:200-204): export the sun assignment. |
| self-sun colour (themed star-colour token) | EXPORT | The **only** new persistent state the orrery adds — one app-level setting, "exported alongside the sun assignment" (`[orrery → data/backup]`, 09:200-204; "made-without-you" #3). |
| Notification: master on/off | EXPORT | `[notify → backup]` (11:306-309): export master + per-type toggles + lock-screen visibility. |
| Notification: per-type toggle — decay reminders | EXPORT | Same (11 cluster D). |
| Notification: per-type toggle — birthday alerts | EXPORT | Birthday alerts owned by notify (11 cluster D); toggle is settings state. |
| Notification: per-type toggle — **digest on/off** | EXPORT | `[digest → backup]` (14:182-185): export the digest on/off toggle; the weekly schedule is derived. Third notification type, defaults on (14 cluster D). |
| Notification: lock-screen visibility choice | EXPORT | The private/public channel choice (03-fuel D; 11 cluster D). *Channel objects themselves are OS state, recreated by the app, not exported.* |
| AI: provider | EXPORT | Non-secret AI setting (`[ai → backup]`, 13:146-149). |
| AI: model (id / free-text) | EXPORT | Non-secret (13:146-149). |
| AI: prompt template (global, user-editable) | EXPORT | Non-secret (13:146-149; 13 cluster B). |
| AI: HTTPS custom-endpoint URL | EXPORT | Non-secret; HTTPS-only boundary (13 cluster C, `[ai → backup]` 13:146-149). |
| AI: `share_with_ai` field flags | EXPORT | Live on `custom_field_defs` (§A.7), which is exported — listed here for completeness (13:146-149). |
| AI: provider = `none` default / enabled state | EXPORT | AI opt-in, defaults disabled (13 "made-without-you" #2). |
| theme choice (active theme profile) | EXPORT | All colour resolves through the active theme (CLAUDE.md; HANDOFF §7 theme tokens). User's chosen profile is app state → export it. *(No dossier names it explicitly; it is app-level non-secret preference and belongs in the backup.)* |
| custom categories | EXPORT | = the `categories` table (§A.5) — user-created rows, not hardcoded. |
| last-used sort/filter | EXPORT-optional (low value) | 08-dashboard defers persistence to AsyncStorage or a settings row, "not load-bearing" (08 deferred-to-planning; "made-without-you" #5). Include if it lives in the settings table; not required for data integrity. |

---

## D. EXCLUDE — deliberately never in the export

| Item | Rationale + source |
|---|---|
| **AI API keys (all providers)** | ⚠ **NEVER exported.** In `expo-secure-store` (Keystore-backed), re-entered per provider on a new device (`[ai → backup]`, 13:146-149; 13 cluster D). The export is meant to be safe to store in cloud/email/share; live credentials would defeat that. A Keystore key is deleted on uninstall and can't ride any backup regardless — "include" would mean the app *deliberately* copying the secret out (13 cluster D). Holds regardless of domain-15's export-encryption choice. |
| **Stored photo path strings (verbatim)** | Device-specific relative filenames; restore repoints to freshly written files (`[photos → backup]`, 07:154). The *bytes* are exported (§B); the *path* is not restored as-is. |
| **`field_history` rows** (recommended) | Transient 30-day undo buffer, swept at launch, destroyed by purge (§A.9; HANDOFF §14.6). Recommend EXCLUDE; flagged OPEN per 01-data. |
| **Widget state** | The widget adds **no new schema and no new persistent state** — global mirror, no self-swap, no per-instance config (`[widget → data/backup]`, 12:144-148). "Backup/restore need nothing widget-specific — recorded so 15-backup does not hunt for widget state." |
| **OS notification channels** | Channels are OS-owned, immutable after creation, recreated by the app under versioned ids (11 cluster D; `platform-lifecycle-channels.md` A/B). Not exported; rebuilt on launch. |

---

## E. DERIVED-RECOMPUTE — never trusted from an exported copy

### E.1 Stored-but-derived (the dangerous class)

| Value | Rationale + source |
|---|---|
| **`contacts.last_contact`** | The single most important one. Stored column, but = MAX over interaction `occurred_at` (filtered to connected rows for "Rarely responds"). `[log → backup]` (04-log:615-619): **do not restore as authoritative** — omit or recompute; **rows win**. An export that restores it over a differing row set leaves it asserting a date no row supports. See Restore Hazard #1. |

*(No other stored-but-derived scalar exists — 01-data deliberately rejected cached `last_interaction`,
and `status`/`gravity`/`intensity` are never stored at all.)*

### E.2 Purely derived — never stored, so absent from the schema; backup ignores them

| Value | Rationale + source |
|---|---|
| `status` (stable/wobble/decay/rogue) | Never stored; computed at query time (01-data C, "made-without-you" #2; `rogue` extends it, 04-log B). |
| `gravity` | Derived, never stored — a stored score rots (`[log → data]`, 04-log:599-603; "made-without-you" #9). |
| `intensity` | Derived, never stored (same). Absorbs the cadence statistic (04-log G). |
| `daysSince` / `daysUntilDue` / progress | All derived (01-data "made-without-you" #3). |
| ranked fuel projection | A query (kind priority then recency, `off_limits` excluded), not a stored column (03-fuel D). |

### E.3 Derived schedules — re-registered on restore, NOT exported

| Value | Rationale + source |
|---|---|
| Decay notification schedule | Pre-scheduled dated notifications, **rebuilt via launch-reconcile** on restore (`[notify → backup]`, 11:306-309: "the notification schedule itself is derived, not exported"). |
| Birthday notification schedule | Same engine; re-registered (11 cluster D). |
| Weekly digest schedule | One native WEEKLY trigger, **re-registered on restore/launch, not exported** (`[digest → backup]`, 14:182-185). |

---

## F. Values that "cannot be backfilled truthfully" (must exist from migration 1, exported verbatim)

Enumerated across dossiers as the columns a merge/restore can never reconstruct after the fact —
so they must be present from migration 1 and carried in the export exactly:

- **stable `uid`** (every user-data table) — 04-log:578, :569-570
- **`recorded_at`** (interactions) — 04-log:569-570
- **`source`** (interactions and fuel) — 04-log:569-570; 03-fuel:388-389
- **`created_at`** (contacts, fuel; general tiebreaker) — 01-data:497-498; 03-fuel:388-389
- **`ring_seq`** (contacts) — 01-data:497-498

*(Contrast: `direction` on interactions *can* be added later — 04-log took it now on product value,
not migration fear (04-log cluster A). The "reminders off" mute *can* be backfilled default-off
(11:272-276). Both are still exported as real state.)*

---

## G. Restore hazards (things that break if restored naively)

1. **`last_contact` restored over a differing row set.** It is stored-but-derived (MAX over
   interaction `occurred_at`, filtered for "Rarely responds"). Restoring the exported scalar as
   authoritative over a merged/partial row set makes it assert a date **no row supports**, and an
   export that silently **loses interaction rows relocates those contacts to the never-contacted
   screen** (`last_contact IS NULL`). **Fix:** omit `last_contact` from restore and recompute MAX
   after loading `interactions`; rows win. (`[log → backup]`, 04-log:615-619; never-contacted
   predicate 01-data C.)

2. **Verbatim photo paths.** Stored paths are device-specific relative filenames. Restoring them
   verbatim points at files that do not exist on the new device → every avatar blank. **Fix:**
   export photo bytes as base64 (contacts + self + custom photo-field files), write fresh files
   under the new device's document dir, and repoint the stored relative path. (`[photos → backup]`,
   07:105-110, 131-134, 154.)

3. **Version-skew: a v3 export restored on a v6-schema app, or a v6 export on a v3 app.** Migrations
   are **forward-only, strict order, and any user may jump v1→v6** (HANDOFF §3; CLAUDE.md). An export
   carrying no schema stamp cannot be safely re-homed. **Fix (synthesis — the backup domain must
   design this):** stamp the export with the source `PRAGMA user_version`. On restore: if the
   export is *older* than the app, run it through the forward migration chain; if *newer* than the
   app, **reject** (the app cannot forward-migrate data shaped by code it does not have). This is not
   spelled out in any dossier — it is an inference from HANDOFF §3's migration model and is the single
   biggest gap the backup design must close.

4. **Quarantined custom-field columns.** A quarantined-but-unexpired def (`quarantined_at` set) still
   owns its column and every contact's value (HANDOFF §14.5) — real data. But (a) restore must
   **recreate the dynamic columns via `ALTER TABLE contact_custom_values ADD COLUMN`** from the
   exported defs *before* loading values (the columns don't exist in a fresh DB), and (b) the launch
   sweep may `DROP COLUMN` on expiry, and `DROP COLUMN` fails on an indexed/UNIQUE/view/generated
   column — so restore must **never** add an index or UNIQUE to these columns (CLAUDE.md; HANDOFF
   §14.5/§14.11). A naive `SELECT *`/`INSERT *` restore that ignores the defs table will fail to
   recreate structure and silently drop custom values.

5. **Merge collisions on the same uid.** Restore is **MERGE, not replace-only** (`[log → data]`,
   04-log:363-369). uids are globally unique, so a uid present on both the backup and the device is
   the *same logical row* — restore must UPDATE/reconcile, not duplicate. A row edited on **both**
   sides since the backup needs a conflict rule (last-writer? newest `recorded_at`? backup loses?) —
   **undecided in any dossier; the backup domain must specify it.** Replace-only restore is
   explicitly rejected because it would destroy data created since the backup.

6. **(Corollary) FK ordering.** `contacts.category_id` → `categories`; every child table →
   `contacts`. Restore/merge must load `categories` and the self record, then `contacts`, then
   `interactions`/`events`/`fuel`/`contact_links`/`contact_custom_values`, or FKs dangle. (`PRAGMA
   foreign_keys` is **off by default and a no-op inside a transaction** — 01-data F15 — so ordering is
   the app's responsibility, not the engine's.)

7. **(Corollary) Purge parity, verified against export.** Everything the export must enumerate is
   exactly what purge must `DELETE` explicitly (FKs are decorative inside
   `withExclusiveTransactionAsync`): interactions, events, fuel, custom values, `contact_links`,
   `field_history`, the photo file on disk, and scheduled notifications (01-data:83-93; 04-log:620-623;
   03-fuel:418-420; 06-crud:226-229). If the backup inventory and the purge inventory ever diverge,
   one of them is missing a table.

---

## H. Where two dossiers disagree (flagged)

1. **01-data's export list is incomplete (superseded by an amendment chain, not contradicted).**
   01-data:461-463 lists: contacts, interactions, `categories`, profile record, `ring_seq`,
   favourites rank, custom field defs+values, and "(decide) `field_history`." Later domains **amend**
   it: `[fuel → backup]` adds fuel and explicitly says "01-data's export list omits fuel entirely…
   must be amended" (03-fuel:415-417); `[log → backup]` adds `events` (04-log:615); `[crud → backup]`
   adds `contact_links` (06-crud:226-229); `[notify → backup]` adds the mute flag + notification
   settings (11:306-309); `[orrery → backup]` adds the self-sun colour (09:200-204); `[ai → backup]`
   adds the non-secret AI settings and **excludes** keys (13:146-149); `[digest → backup]` adds the
   digest toggle (14:182-185). **Not a real conflict** — 01-data was the seed and each later domain
   appended — but an implementer trusting only 01-data's list would miss 5+ tables/settings. This
   audit is the reconciled superset.

2. **`field_history` is genuinely OPEN.** 01-data marks it "(decide)"; no later domain rules on it.
   Recommendation here: EXCLUDE (§A.9). Owner/backup-domain call.

3. **Images-as-fuel: resolved, not open.** HANDOFF §6 (text/link only) vs INDEX's unilateral widening
   to "text/link/image" — **HANDOFF won** (03-fuel:97-99; 10 inherited). Consequence for backup:
   purge/export gain **no** second unreachable-file target beyond photos. Recorded so it is not
   re-litigated.

4. **"surrogate PK" vs "stable uid" — structural ambiguity, not a contradiction.** 01-data decides a
   **surrogate primary key** (01-data A / "made-without-you" #1). 04-log decides a **stable,
   globally-unique id on every user-data table** for merge (04-log:578). Neither dossier states
   whether these are **one column doing both jobs** or **two separate columns** (an internal
   autoincrement PK + a UUID merge key). It matters for backup: merge must key on the *globally
   unique* id, never on a per-device autoincrement PK (which will collide across devices). **Resolve
   at backup/planning time**; this audit treats them as potentially distinct and exports the uid as
   the merge key.

---

## I. One-glance summary

- **10 SQLite tables:** contacts, interactions, events, fuel, categories, self/profile, custom_field_defs, contact_custom_values, field_history (recommend exclude), contact_links.
- **3 photo file-classes** (base64, path-repointed): contact photos, self photo, custom photo-field files.
- **~14 app-level settings** (sun_contact_id, self-sun colour, notification master + 3 per-type toggles + lock-screen visibility, AI provider/model/template/HTTPS-URL/enabled, theme; last-used sort optional).
- **1 secret store, always excluded:** AI API keys (expo-secure-store).
- **1 stored-but-derived value to recompute, not restore:** `contacts.last_contact`.
- **Derived/absent (backup ignores):** status, gravity, intensity, daysSince/daysUntilDue/progress, ranked fuel projection; and all schedules (decay/birthday notifications, weekly digest) — re-registered on restore.
