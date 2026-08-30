# Roadmap: Orbit

## Overview

Orbit is built foundation-first, then in vertical feature slices, dashboard before orrery, with
the friction features (capture, notifications, widget) landing as early as their data dependencies
allow — because they are the reason the plugin fell out of use. Phases 1–3 lay the irreversible
groundwork: the Expo scaffold and portable-code extraction, the migration-1 SQLite schema (with
every un-backfillable column and the single-writer recency DAO present from day one), and the
custom-fields subsystem. Phases 4–7 build the contact model users touch (CRUD, photos, the
interaction log with gravity/intensity/rogue, and Conversational Fuel). Phases 8–13 deliver the
daily surfaces and the friction loop (dashboard + never-contacted screen, the compose screen,
share-sheet capture, actionable notifications, the widget, and the orrery). Phases 14–17 add AI
suggestions, the weekly digest, custom-field value normalization, and the load-bearing
backup/export/restore. Phases 18–21 normalize the contact model, acquire selected system contacts,
reconcile them safely, and reduce the friction of reaching out. Phases map one-to-one
onto the dossier domains; a `[DECIDED]`/`[REJECTED]` decision is implemented, never reopened.

## Phases

- [x] **Phase 1: Project Scaffold & Portable Code** — Expo/RN app, theme tokens, and the ~900 lines of portable plugin source extracted into `src/`. (completed 2026-08-14)
- [x] **Phase 2: Data Foundation & Status Engine** — migration-1 SQLite scaffold, all core tables, single-writer `last_contact` DAO, continuous status, launch-sweep skeleton. (completed 2026-08-14)
- [x] **Phase 3: Custom Fields** — HANDOFF §14 two-table design, 7 parsers, `field_history`, quarantine sweep, and the field editor. (completed 2026-08-15)
- [x] **Phase 4: Contact CRUD & Lifecycle** — create/edit forms, `contact_links`, archive/restore/purge, the contact profile scaffold. (completed 2026-08-15)
- [x] **Phase 5: Photos** — library picker + URL path, in-app Skia crop, 512px master, themed initials fallback. (completed 2026-08-15)
- [x] **Phase 6: Interaction Log, Status & Impact** — touchpoint rows, editable timeline, gravity/intensity, rogue, "Rarely responds". (completed 2026-08-15)
- [x] **Phase 7: Conversational Fuel** — per-item rows (5 kinds incl. `off_limits`), ranked projection, profile editor, cross-contact search. (completed 2026-08-16)
- [x] **Phase 8: Dashboard & Never-Contacted Screen** — the home screen, sort/filter/search, birthday banner, favourites, freshness, empty states. (completed 2026-08-16)
- [x] **Phase 9: Compose Screen & SMS Handoff** — the in-app message surface (fuel visible, Send→SMS, Copy) that notify/widget/AI all open. (completed 2026-08-16)
- [x] **Phase 10: Share-Sheet Capture** — Android share target, grid-of-faces picker, `EXTRA_SUBJECT` patch, inline create. (completed 2026-08-16)
- [x] **Phase 11: Actionable Notifications** — pre-scheduled + launch-reconcile engine, decay + birthday, headless actions, mute, settings. (completed 2026-08-16)
- [x] **Phase 12: Home Screen Widget** — favourites grid, headless mark, Quick mark · Log contact · Message, add-widget button. (completed 2026-08-17)
- [x] **Phase 13: Orrery** — the two-view Skia solar system, rogue rendering, assignable/self-colour sun, ambient layer. (completed 2026-08-18)
- [x] **Phase 14: AI Message Suggestions** — providers + keys, editable-draft flow, prompt assembly, `share_with_ai`. ✅ owner-accepted 2026-08-22
- [ ] **Phase 15: Weekly Digest** — one WEEKLY Sunday notification → a live "your week" screen.
- [ ] **Phase 16: Custom Field Value Normalization** — replace dynamic custom-value columns with a sync-safe normalized row model, preserving every existing behavior and value.
- [ ] **Phase 17: Backup, Export & Restore** — manual + auto SAF backup, optional encryption, tombstone-aware Merge/Replace restore (reusable reconciliation core), forward-migrate.
- [x] **Phase 18.1: Contact Method Normalization** — normalized phone/email methods with stable identity and system-contact provenance foundations; all contacts stay Bound. **COMPLETE 2026-08-28** (device UAT passed; restore route repaired).
- [ ] **Phase 18.2: Bound/Unbound Lifecycle** — the independent Bound/Unbound lifecycle across all proactive surfaces, on Phase 18.1's normalized model. (Streamlined Export deferred out of the original Phase 18.)
- [x] **Phase 19: System Contact Import** — deliberate single/bulk system-contact acquisition, conservative duplicate evidence, initial linking, and resumable import review. **COMPLETE 2026-08-30** (device UAT passed on the Pixel 6 / API 37; verifier PASS 4/4; the Android-17 picker dead-end was root-caused to an intent bug and fixed in gap plan 19-20 — not an OS defect).
- [ ] **Phase 20: Contact Reconciliation & Merge** — user-triggered one-way source reconciliation, durable review, and explicit atomic Orbit-to-Orbit merge.
- [ ] **Phase 21: Interaction Assist & Reach Out** — shared Call/Text/Email routing, durable post-handoff assist confirmation, and widget Contact integration.

## Cross-phase constraints (from INDEX.md's constraint log — these cross phase boundaries)

Recorded here because they bind phases that do not own them. Every planner/executor inherits these.

- **Single-writer `last_contact` DAO** (Phase 2): the *only* writer of `contacts.last_contact`,
  recomputed as MAX over current interaction rows on every insert/edit/delete, in a transaction,
  behind a JS mutex. Every touchpoint route — CRUD (4), log (6), capture is NOT one (10), widget (12),
  notification (11) — writes through it; headless writers (11, 12) share the mutex. For "Rarely
  responds" contacts (6) the MAX is over connected rows only.

- **One launch sweep, many responsibilities** (skeleton in Phase 2): quarantine expiry + history
  retention (Phase 3), archived-contact purge (Phase 4), notification schedule reconcile (Phase 11),
  digest re-register (Phase 15), custom-field cleanup (Phase 16), backup rotation (Phase 17). It runs once per real foreground launch —
  never on module import or a headless widget/notification tap.

- **Un-backfillable columns exist from migration 1** (Phase 2): surrogate PK + distinct `uid`,
  `created_at`, `modified_at`, `ring_seq`; interaction `recorded_at`/`source`; fuel
  `kind`/`created_at`/`source`/`url`; `custom_field_defs` display-order and `share_with_ai`. Adding
  them later is impossible against un-reachable devices.

- **The legacy dynamic-column custom-field rules are superseded by Phase 16.** It replaces value
  columns with stable, normalized value rows; no new custom-field operation may require replicated
  DDL. The Phase-3 `col_name` whitelist remains relevant only to safely read/migrate old schemas.

- **The compose screen is one surface, built once** (Phase 9) and reused by notifications (11), the
  widget Message action (12), and AI Suggest (14). "Fuel visible" lives here, not in notification text.

- **The shared `rogue` constant** (a multiple of the interval) is one value read by the orrery (13),
  notification decay-suppression (11), and the digest (15) — never computed three times.

- **Photos are one 512px master** (Phase 5); the widget (12) re-encodes it to base64 (RemoteViews
  can't read `file://`); the orrery (13) uses it via Skia `useImage`; backup (17) embeds base64.

- **Keys in `expo-secure-store`, never exported** (Phase 14); backup (17) exports non-secret AI
  settings only.

- **`modified_at` on every mergeable table + `uid` distinct from PK** (Phase 2) exist for backup's
  newest-edit-wins Merge (Phase 17). Phase 16 extends stable identity to custom-field definitions
  and values before they participate in that Merge.

- **App-wide `launchMode="singleTask"`** (imposed by `expo-share-intent`, Phase 10): notification (11)
  and widget (12) taps arrive via `onNewIntent`; "Back → dashboard" is a JS-navigation concern.

- **The single birthday parser** (Phase 8, with the day-of-drop and Feb-29 fixes) is reused by the
  birthday notification (11).

- **No hardcoded colours, incl. Skia**; **no network on any read path**; **`formatLocalDate()` /
  `date('now','localtime')`** — apply in every phase (CLAUDE.md).

## Phase Details

### Phase 1: Project Scaffold & Portable Code

**Goal:** A themed Expo/RN app that builds and launches on the Pixel via the desktop pipeline, with the portable plugin code extracted, decoupled from Obsidian, and typechecking.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** FND-01, FND-02, FND-03, FND-04, FND-05, FND-06
**Success Criteria** (what must be TRUE):

  1. The app installs and opens to a home shell on the Pixel 6 Pro through the commit → desktop-build → install loop (pipeline proven once).
  2. `calculateStatus()`, the frequency/status/battery types, both built-in schemas, `formatLocalDate()`, and `logger.ts` live in `src/`, lint clean, and typecheck.
  3. `types.ts` has no Obsidian coupling and `AiService.ts` compiles standalone with `fetch` + `response.ok` handling.
  4. Colours resolve through theme tokens; Biome and portrait-lock are configured.

**Plans:** 5/5 plans complete
**Wave 1**

- [x] 01-01-PLAN.md — Expo SDK 57 scaffold + Biome/tsconfig/portrait-lock/Vitest + folder layout (FND-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Port pure logic + types + built-in schemas + Vitest suites, Obsidian-free (FND-02, FND-03)
- [x] 01-03-PLAN.md — Theme tokens + useTheme provider + persisted Zustand store + themed home shell (FND-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Port AiService.ts onto fetch, dormant/standalone (FND-04)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Prove the desktop-build → Pixel install pipeline once, owner-gated (FND-01)

### Phase 2: Data Foundation & Status Engine

**Goal:** The migration-1 SQLite scaffold — every core table and un-backfillable column, the single-writer recency DAO, query-time status, and the launch-sweep skeleton — correct and irreversible-safe from day one.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):

  1. A fresh install runs migration 1 (all tables, all un-backfillable columns, seeded categories, self record) with `foreign_keys=ON` + WAL set before any transaction, each migration step transaction-wrapped.
  2. Inserting/editing/deleting an interaction through the single DAO recomputes `contacts.last_contact` as MAX and leaves recency and history consistent.
  3. Status computes at query time as elapsed ÷ interval, buckets at 80%/100%, resolves at local midnight, and is never stored.
  4. The launch sweep runs once per real foreground launch (not on a headless tap) and exposes hooks for later responsibilities.
  5. The newest-interaction-per-contact query and status scan benchmark acceptably on the Pixel.

**Plans:** 6/6 plans complete

**Wave 1**

- [x] 02-01-PLAN.md — Crash-safe `user_version` migration runner + `node:sqlite` test harness (DATA-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Migration-1 DDL (all 10 tables, un-backfillable columns, seeds, empty fuel + custom-fields tables) + WAL/FK bootstrap (DATA-02, DATA-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Single-writer `last_contact` recency DAO + shared promise-chain mutex (DATA-04)
- [x] 02-04-PLAN.md — Query-time status engine + dashboard scan + newest-per-contact query (DATA-05)
- [x] 02-05-PLAN.md — Launch-sweep skeleton + hook registry + App.tsx migrate-gate/sweep wiring (DATA-06)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-06-PLAN.md — On-device Pixel benchmark + `localtime` probe + `allowBackup=false` (DATA-07)

### Phase 3: Custom Fields

**Goal:** The full HANDOFF §14 custom-fields subsystem — two tables, TEXT-forever storage, 7 parsers, `field_history`, quarantine sweep, and a field editor — with its invariants enforced.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** FLD-01, FLD-02, FLD-03, FLD-04, FLD-05, FLD-06, FLD-07
**Success Criteria** (what must be TRUE):

  1. A user can create, rename, reorder, retype, and delete/quarantine a custom field from settings; create runs INSERT def + ALTER ADD COLUMN atomically and `col_name` cannot collide with a fixed column.
  2. A type change auto-converts clean values, flags the rest as a tap-to-fix error state, destroys no data, and snapshots to `field_history` in the same transaction.
  3. Quarantine hides a populated field without touching data; the launch sweep expires it (DELETE def + DROP COLUMN atomically) and prunes history on the 30-day schedule.
  4. Every custom-field sort/filter goes through `sortExpr()`, and no custom value column is indexed or UNIQUE.

**Plans:** 8/8 plans complete

**Wave 1**

- [x] 03-01-PLAN.md — Shared `CustomFieldDef` type + reserved-column whitelist + `col_name` slugifier + single `inWriteTransaction` (`src/db/transaction.ts`) (FLD-01, FLD-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — 7 permissive parsers + `isValueInOptions` + guarded `sortExpr()` (FLD-04, FLD-06)
- [x] 03-03-PLAN.md — Transactional DDL (atomic create / non-mutexed drop core + public dropField / atomic dynamic delete-quarantine) + field-defs metadata DAO incl. `updateFieldCuration` (FLD-01, FLD-02, FLD-03, FLD-05, FLD-06)
- [x] 03-04-PLAN.md — Custom-value read/serialized UPSERT + §14.7 visibility selectors (FLD-01, FLD-07)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-05-PLAN.md — Type-change + options pre-flight + apply (`UPDATE defs.type` + same-txn `field_history` snapshot encoding the transition, values byte-identical) (FLD-04)
- [x] 03-06-PLAN.md — 7 RN value widgets + `FieldValueInput` + `CustomFieldValue` tap-to-fix (FLD-04, FLD-07)
- [x] 03-07-PLAN.md — Quarantine-expiry + history-retention launch sweep (dropField called directly, datetime window) + App wiring (FLD-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-08-PLAN.md — CustomFieldsScreen + FieldDefForm + in-app reachability (FLD-02, FLD-03, FLD-04, FLD-05, FLD-07)

### Phase 4: Contact CRUD & Lifecycle

**Goal:** Create, edit, and the archive/restore/purge lifecycle, plus the contact profile scaffold and the `contact_links` child table.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** CRUD-01, CRUD-02, CRUD-03, CRUD-04, CRUD-05, CRUD-06
**Success Criteria** (what must be TRUE):

  1. A user can create a contact from the lean form (duplicate-name warning, custom "every N" frequency, "not yet / don't know" writing no interaction row) and a last-spoke date writes contact + interaction atomically through the DAO.
  2. The edit form shows every non-quarantined field plus phone/email/links and the Rarely-responds + reminders-off toggles; many links per contact add/edit/remove and open on tap.
  3. Archive hides a contact everywhere and is restorable; purge from the Archived list shows an impact summary and deletes all owned rows + the photo file + scheduled notifications in one transaction.
  4. Never-contacted and archived are reachable as separate homes.

**Plans:** 9/9 plans complete
**Wave 1**

- [x] 04-01-PLAN.md — Navigation shell (react-navigation native-stack) + Settings relocation (CRUD-05)
- [x] 04-02-PLAN.md — Contact create + shared reads DAO (composed atomic create) (CRUD-01, CRUD-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — Create-form inputs (FrequencyPicker, TriStateLastSpoke) + native picker install (CRUD-01)
- [x] 04-05-PLAN.md — Contact metadata edit + rarely_responds recompute + edit assembly DAO (CRUD-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — CreateContactScreen + ContactProfile scaffold (CRUD-01, CRUD-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-06-PLAN.md — EditContactScreen (always-show fields + toggles + birthday) (CRUD-03)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-07-PLAN.md — Contact links (contact-links-dao + LinksEditor, tappable open) (CRUD-04)
- [x] 04-08-PLAN.md — Archive / restore + Archived home + overflow menu (CRUD-05)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 04-09-PLAN.md — Purge fan-out + impact summary + danger token (CRUD-06)

### Phase 5: Photos

**Goal:** A single-master photo pipeline — library picker + URL path, in-app Skia crop, themed initials fallback — reused for contacts, the self record, and custom `photo` fields.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04, PHOTO-05
**Success Criteria** (what must be TRUE):

  1. A user can set a contact/self photo from the library (no camera/permission) and frame it with the Skia crop; a pasted URL downloads once to the same local master.
  2. Each photo is one 512px JPEG under the document dir, stored as a relative path resolved at read.
  3. A photo-less contact shows a deterministic themed-swatch initials avatar (no hardcoded colour); replace/remove deletes the old file and purge deletes photo files.

**Plans:** 8/8 plans complete

**Wave 1**

- [x] 05-01-PLAN.md — Native enablement (7 modules, picker plugin camera/mic off, Reanimated babel, gesture root) + avatarSwatches/avatarSwatchText tokens (PHOTO-04)

**Wave 2** *(blocked on Wave 1)*

- [x] 05-02-PLAN.md — photo-storage chokepoint (derivable filenames, rel↔file://, crash-safe copy-to-temp-then-atomic-overwrite-move + launch-time tmp/bak reconciliation sweep) + setContactPhoto/clearContactPhoto + net-new profile-dao (PHOTO-03, PHOTO-05)

**Wave 3** *(blocked on Wave 2)*

- [x] 05-03-PLAN.md — avatar-initials + Avatar component + profile header wiring (PHOTO-04)
- [x] 05-04-PLAN.md — crop-geometry (pure) + photo-pipeline (512px JPEG master, no snapshot) (PHOTO-01, PHOTO-03)
- [x] 05-07-PLAN.md — purge-photo-cleanup adapter (derive+delete from contactId) + Archived-list registration (PHOTO-05)

**Wave 4** *(blocked on Wave 3)*

- [x] 05-05-PLAN.md — CropPhotoScreen (Skia/Reanimated) + PhotoSourcePicker + EditContactScreen wiring (PHOTO-01, PHOTO-05)

**Wave 5** *(blocked on Wave 4)*

- [x] 05-06-PLAN.md — pasted-URL path (https-only) + self-record photo in Settings (PHOTO-02, PHOTO-01)
- [x] 05-08-PLAN.md — custom `photo`-field widget wired to the pipeline (edit-only) (PHOTO-01, PHOTO-05)

### Phase 6: Interaction Log, Status & Impact

**Goal:** The full touchpoint model and its read surfaces — one-tap + refine logging, the editable profile timeline, gravity/intensity, rogue, and "Rarely responds".
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06
**Success Criteria** (what must be TRUE):

  1. A user can log a touchpoint in one tap and refine channel/direction/connected/quality/note/date+time; edits change status; same-day taps make distinct rows; future dates are rejected.
  2. The profile timeline interleaves editable touchpoints and read-only events newest-first; deleting a touchpoint is unrecoverable.
  3. `gravity` (tiers + bar) and `intensity` (neutral rate + long-run cadence) render on the profile only, derived-never-stored.
  4. A "Rarely responds" contact computes recency over connected rows only and shows its label; a contact goes `rogue` at the shared constant / via the setting, surfaced in-app only.

**Plans:** 6/6 plans complete

**Wave 1**

- [x] 06-01-PLAN.md — One-tap "Log contact" + shared future-date guard (log-guards) through the single writer (LOG-01, LOG-06)

**Wave 2** *(blocked on Wave 1)*

- [x] 06-02-PLAN.md — Events writer (immutable events-dao + archive/restore retrofit) + interleaved timeline read + TimelineRow render + purge events surfacing (LOG-02)

**Wave 3** *(blocked on Wave 2)*

- [x] 06-03-PLAN.md — Refine/edit (editTouchpointFull, all cols + always-recompute) + confirmed unrecoverable delete + two-dialog date+time (LOG-01, LOG-02, LOG-04, LOG-06)

**Wave 4** *(blocked on Wave 3)*

- [x] 06-04-PLAN.md — Rogue reason (REASON_SQL) + single-contact query-time status read + status/gravity colour tokens (rogue + gravityTiers) + in-app rogue label (LOG-05, LOG-04)

**Wave 5** *(blocked on Wave 4)*

- [x] 06-05-PLAN.md — Gravity (age-decay → named tiers + bar) + impact-read + GravityBar, derived-never-stored profile-only (LOG-03)

**Wave 6** *(blocked on Wave 5)*

- [x] 06-06-PLAN.md — Intensity (neutral rate + trailing cadence) + IntensityLine, profile-only (LOG-03)

### Phase 7: Conversational Fuel

**Goal:** Per-item fuel with kinds and the never-transmitted `off_limits`, a single ranked projection for every glanceable surface, the profile editor, and cross-contact search.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** FUEL-01, FUEL-02, FUEL-03, FUEL-04, FUEL-05, FUEL-06
**Success Criteria** (what must be TRUE):

  1. A user can add/edit/delete fuel items on a profile across the 5 kinds + optional label; `off_limits` is excluded from every glanceable surface in-query.
  2. One ranked projection (kind priority then recency) produces the line the card, notification, and widget all reuse; age renders and drives ranking without ever hiding data.
  3. Cross-contact search matches name AND fuel text with `off_limits` excluded; `source='ai'` items render unconfirmed and are excluded from prompts until confirmed.

**Plans:** 4/4 plans complete

**Wave 1**

- [x] 07-01-PLAN.md — Fuel writer DAO + shared read + FuelEditor mounted on the profile (add/edit/delete, 5 kinds) (FUEL-01, FUEL-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 07-02-PLAN.md — Pure kind-priority ranking + age + getRankedFuel (off_limits + source='ai' excluded in-query) + RankedFuelLine (FUEL-02, FUEL-03, FUEL-04, FUEL-06)

**Wave 3** *(blocked on Wave 2)*

- [x] 07-03-PLAN.md — AI-unconfirmed state + confirm-flip source 'ai'→'manual' (no migration) (FUEL-06)
- [x] 07-04-PLAN.md — Cross-contact search query + minimal FuelSearch screen (name AND fuel text, off_limits + archived excluded) (FUEL-05)

### Phase 8: Dashboard & Never-Contacted Screen

**Goal:** The app's home screen — flat list, full sort/filter/search, birthday banner, favourites, the never-contacted screen — rendering offline with reliable freshness.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):

  1. The dashboard is home, a flat status-sorted list excluding never-contacted/archived/snoozed, with the full sort/filter set and name+fuel search.
  2. Cards carry avatar, status ring (incl. rogue), name, the required fuel line, category label, and favourite marker — nothing log-derived.
  3. The "Not yet contacted (N)" screen (rendering fuel), a snoozed segment with a count, and a count-less Archived entry are reachable; the birthday banner overrides snooze/never-contacted suppression (archived excluded) with the parser bugs fixed.
  4. A user marks favourites via a profile star and orders them on a shared "Manage favourites" screen; the dashboard renders with no network and refreshes on focus/AppState/pull with async queries.

**Plans:** 10/10 plans complete

**Wave 1** *(parallel — independent correctness cores)*

- [x] 08-01-PLAN.md — dashboard-read DAO (listDashboard/never-contacted/favourites/counts/birthday-candidates) + shared fuel-fragment extraction + node tests (DASH-01, DASH-02, DASH-04, DASH-07)
- [x] 08-02-PLAN.md — birthday-logic parser (day-of-drop + Feb-29 bugs fixed, both formats), node-tested (DASH-05)
- [x] 08-03-PLAN.md — favourites-dao (mark/clear/transactional reorder) + pure reorder-logic, node-tested (DASH-06)
- [x] 08-04-PLAN.md — ContactCard + FilterChipRow + dashboard-prefs store (DASH-02, DASH-03, DASH-07)

**Wave 2** *(blocked on Wave 1)*

- [x] 08-05-PLAN.md — NeverContactedScreen + NeverContacted route (DASH-04, DASH-01)
- [x] 08-06-PLAN.md — BirthdayBanner + profile favourite star (DASH-05, DASH-06)

**Wave 3** *(blocked on Wave 2)*

- [x] 08-07-PLAN.md — HomeScreen → dashboard core (list + freshness + banner + counts + footer + empty states) (DASH-01, DASH-03, DASH-04, DASH-05, DASH-07)
- [x] 08-08-PLAN.md — ManageFavouritesScreen + drag-lib owner checkpoint + ManageFavourites route (DASH-06)

**Wave 4** *(blocked on Wave 3)*

- [x] 08-09-PLAN.md — dashboard controls: chips + sort + live name+fuel search + persistence (DASH-02, DASH-04, DASH-06)

**Wave 5** *(blocked on Wave 4)*

- [x] 08-10-PLAN.md — retire standalone FuelSearch + Settings Manage-favourites row (DASH-06, DASH-02)

### Phase 9: Compose Screen & SMS Handoff

**Goal:** The in-app compose screen — the single "fuel visible → send" surface — reachable from the profile now and reused by later phases.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements:** CMP-01, CMP-02, CMP-03
**Success Criteria** (what must be TRUE):

  1. From a contact's profile a user opens the compose screen, sees the contact's full fuel and an editable draft, and can Send (→ SMS composer) or Copy (always works).
  2. Back from compose lands on the dashboard.
  3. With no phone number, Copy still works and an "add number" affordance appears.

**Plans:** 2/2 plans complete

**Wave 1**

- [x] 09-01-PLAN.md — Native handoff deps (expo-sms/expo-clipboard) + pure Send/Copy capability resolver + phone read widening (CMP-01, CMP-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 09-02-PLAN.md — ComposeScreen (fuel visible, blank draft, Send/Copy, Back→dashboard) + Compose route + profile "Message" entry (CMP-01, CMP-02, CMP-03)

### Phase 10: Share-Sheet Capture

**Goal:** Zero-friction capture — Orbit as an Android share target that lands a link/text as fuel on a picked (or inline-created) contact, durably and fast.
**Mode:** mvp
**Depends on:** Phase 9
**Requirements:** CAP-01, CAP-02, CAP-03, CAP-04
**Success Criteria** (what must be TRUE):

  1. Sharing `text/plain` into Orbit opens the grid-of-faces picker (favourites → capture-MRU → rest, includes never-contacted, excludes archived) with the keyboard closed.
  2. A single tap writes the fuel row immediately (`topic`/`share`, `EXTRA_SUBJECT` label with bare-URL fallback, `url` canonical), long-press multi-selects, and capture never marks a touchpoint.
  3. A user can inline-create a name-only contact (lands never-contacted); a toast confirms and Orbit returns to the source app.

**Plans:** 6/6 plans complete

**Wave 1** *(parallel — independent: native build + correctness cores)*

- [x] 10-01-PLAN.md — Native enablement: expo-share-intent + patch-package, EXTRA_SUBJECT Kotlin patch, finish() module, text/plain plugin + scheme (CAP-01, CAP-03, CAP-04)
- [x] 10-02-PLAN.md — capture-logic pure resolver: payload → display/url + `note — label` composition, node-tested (CAP-02, CAP-03)
- [x] 10-03-PLAN.md — capture DB layer: capture-read (favourites→MRU→rest) + capture-dao (multi-attach + no-touchpoint), node-tested (CAP-01, CAP-02, CAP-04)

**Wave 2** *(blocked on Wave 1)*

- [x] 10-04-PLAN.md — Share-intent → navigation wiring: ShareIntentProvider + linking + navigationRef + Capture route (CAP-01, CAP-04)

**Wave 3** *(blocked on Wave 2)*

- [x] 10-05-PLAN.md — CaptureScreen core: grid picker + single-tap commit + confirmation/auto-return via finish() + route registration (CAP-01, CAP-02, CAP-03)

**Wave 4** *(blocked on Wave 3)*

- [x] 10-06-PLAN.md — CaptureScreen enrichment: long-press multi-select + optional note + inline name-only create + tap-to-reveal search (CAP-02, CAP-04)

### Phase 11: Actionable Notifications

**Goal:** The decay + birthday reminder engine — pre-scheduled + launch-reconciled, generic-body, quiet-windowed, with headless one-tap actions and the reminders-off mute — that opens the compose screen.
**Mode:** mvp
**Depends on:** Phase 10
**Requirements:** NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05
**Success Criteria** (what must be TRUE):

  1. Overdue contacts get a generic-body morning notification (no exact-alarm permission), reconciled on launch/foreground, staggered, re-nagging on a slow cadence and cancelled on mark/snooze/mute/interval-edit.
  2. The notification's mark-contacted and snooze actions write headlessly (double-wired), the body tap opens the compose screen, and Back → dashboard.
  3. No decay notification fires for never-contacted/snoozed/rogue/Rarely-responds/muted; a user can permanently mute a still-decaying contact; birthday notifications fire day-of for non-archived contacts.
  4. `POST_NOTIFICATIONS` is asked at a value moment; master + per-type toggles + private-by-default lock-screen visibility work; denial degrades to in-app.

**Plans:** 13/13 plans complete

Plans:
**Wave 1**

- [x] 11-01-PLAN.md — Native enablement (expo-notifications + plugin), expo-notifications test double, shared notification-ids contract
- [x] 11-02-PLAN.md — app_settings migration (002, forward-only) + validated settings DAO (OQ-1 SQLite storage)
- [x] 11-03-PLAN.md — snooze-dao: first writer of snooze_until + immutable snooze/unsnooze events
- [x] 11-04-PLAN.md — notification-read: decay-suppression predicate + birthday candidates
- [x] 11-05-PLAN.md — fire-instant pure logic: quiet-window roll, stagger, 0–23 clamp, weekly cadence

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-06-PLAN.md — channels (private/public decay + birthday) + POST_NOTIFICATIONS permission
- [x] 11-07-PLAN.md — notification-actions shared handler + module-scope headless task
- [x] 11-08-PLAN.md — purge notification-cancel adapter composed into the purge fan-out
- [x] 11-09-PLAN.md — Edit-form "Mute reminders" relabel + Profile in-app snooze presets

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-10-PLAN.md — notification-schedule reconcile diff + launch-sweep registration
- [x] 11-12-PLAN.md — Notification tap routing: pure resolver + response gate (body→Compose/Profile)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 11-11-PLAN.md — Settings Notifications section (toggles, permission value moment, time controls)
- [x] 11-13-PLAN.md — App.tsx wiring: sweep registration, channels/category init, headless import, response gate mount

### Phase 12: Home Screen Widget

**Goal:** A favourites-grid widget with headless mark-contacted, status-colour avatars, and a larger-tile action set — adding no new schema.
**Mode:** mvp
**Depends on:** Phase 11
**Requirements:** WDG-01, WDG-02, WDG-03
**Success Criteria** (what must be TRUE):

  1. The widget shows favourites in static manual rank with status-colour base64 avatars; a small-tile tap marks contacted headlessly (30s budget, DAO+mutex) and a name/chevron opens the profile.
  2. The larger tile adds Quick mark · Log contact · Message (→ the compose screen) plus the fuel line.
  3. Freshness is event-push + launch/boot refresh (no polling); an empty widget prompts "Choose favourites"; an in-app "Add widget" button works with graceful fallback; "Back → dashboard" is JS navigation.

**Plans:** 8 plans (6 waves)

- [ ] 12-01-PLAN.md — Shared status palette (statusStable/Wobble/Decay tokens) + ContactCard OD-1 upgrade (WDG-01)
- [ ] 12-02-PLAN.md — Native enablement: react-native-android-widget legitimacy checkpoint + install + config plugin (WDG-01/02/03)
- [ ] 12-03-PLAN.md — Base64 thumbnail encoder + headless colour resolver (WDG-01)
- [ ] 12-04-PLAN.md — Favourites tile shaper + strict orbit:// URI resolver & gate (WDG-01/02/03)
- [ ] 12-05-PLAN.md — Headless mark write seam (node:sqlite) + RemoteViews render tree (WDG-01/02)
- [ ] 12-06-PLAN.md — Event-push freshness + widget task handler + index.ts registration (WDG-01/02/03)
- [ ] 12-07-PLAN.md — App wiring: orbit:// gate mount + launch refresh + Settings "Add Orbit widget" (WDG-02/03)
- [ ] 12-08-PLAN.md — Desktop prebuild + manifest hardening + BOOT_COMPLETED receiver + Pixel device UATs (WDG-01/02/03)

### Phase 13: Orrery

**Goal:** The two-view Skia solar-system visualisation — status and relationship — with rogue rendering, the assignable/self-colour sun, and a paused-on-blur ambient layer.
**Mode:** mvp
**Depends on:** Phase 12
**Requirements:** ORR-01, ORR-02, ORR-03, ORR-04, ORR-05, ORR-06
**Success Criteria** (what must be TRUE):

  1. The orrery renders contacts as per-contact-ring planets (radius=`ring_seq`, angle=progress, status colour/ring-style, sun at centre), excluding never-contacted, placed by timestamp math on focus.
  2. Both views ship (status default) sharing the radius axis and morphing on one canvas via a toggle; tapping a planet opens the profile.
  3. `rogue` renders as max drift + cold body + faint ring (on rails, tappable) using the shared constant; the ambient starfield/sun animate and pause on blur.
  4. The self-sun colour is user-pickable from a themed palette, a contact-sun glows its status, an empty orrery shows a prompt, and a user can drag `ring_seq` and assign the sun.

**Plans:** 8 plans (4 waves)

**Wave 1** *(parallel — independent foundations: no theme dep, no file overlap)*

- [x] 13-01-PLAN.md — Migration 003 (sun_contact_id + self_sun_colour) + app-settings-dao widen (ORR-05, ORR-06)
- [x] 13-02-PLAN.md — Pure geometry-logic (angle/radius/drift/hit-test) + ring-reorder-logic (ORR-01, ORR-04, ORR-06)
- [x] 13-03-PLAN.md — orrery-read scan + ring-seq-dao (first ring_seq writer) + sun-picker-read (ORR-01, ORR-06)
- [x] 13-04-PLAN.md — Theme tokens (starPalette/muted/rogueExtinguished) + orrery-ring-logic + sun-occupant-logic (ORR-01, ORR-04, ORR-05)

**Wave 2** *(blocked on Wave 1)*

- [x] 13-05-PLAN.md — OrreryScreen static render + SegmentedControl + font + Orrery route + dashboard ◎ button (ORR-01, ORR-03, ORR-04, ORR-05)
- [x] 13-06-PLAN.md — Settings "Your star" swatch + "Sun / centre" picker (ORR-05, ORR-06)

**Wave 3** *(blocked on 13-05)*

- [x] 13-07-PLAN.md — OrreryScreen morph + ambient/pause-on-blur + radial-drag→ring_seq (ORR-02, ORR-03, ORR-06)

**Wave 4** *(blocked on Wave 3)*

- [x] 13-08-PLAN.md — Desktop prebuild + Pixel device UAT + owner sign-off (ORR-01…06)

### Phase 14: AI Message Suggestions

**Goal:** The optional AI feature — ported providers, secure keys, editable-draft flow, and a privacy-bounded prompt assembled from structured data.
**Mode:** mvp
**Depends on:** Phase 13
**Requirements:** AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):

  1. A user configures OpenAI/Anthropic/Gemini or an HTTPS-only custom endpoint, with keys in secure-store (never exported) and dynamic model lists (free-text fallback); AI is off by default and free BYO-key.
  2. AI Suggest on compose and profile returns an editable draft (Copy guaranteed, Send → SMS).
  3. The prompt uses ranked fuel (minus `off_limits`), interaction aggregates only, gravity tier/intensity/quality, and only `share_with_ai`-flagged fields; it is shown before the first send per provider and always inspectable, and the debug log is redacted.

**Plans:** 7 (14-01..07), wave order 01/03 → 07 → 02 → 04 → 05 → 06

### Phase 15: Weekly Digest

**Goal:** A weekly Sunday-morning notification opening a live "your week" screen — the retrospective and the non-nagged overlooked populations the dashboard can't give on a schedule.
**Mode:** mvp
**Depends on:** Phase 14
**Requirements:** DGST-01, DGST-02, DGST-03
**Success Criteria** (what must be TRUE):

  1. One native WEEKLY (Sunday morning) notification fires unconditionally, survives reboot, opens a live screen, defaults on, and is independently toggleable.
  2. The screen shows the "reached this week" retrospective (all touchpoints, no connected/direction predicate) and "the overlooked" (rogue + Rarely-responds gone-quiet + never-contacted backlog, mute ignored, archived excluded), with a calm empty state.
  3. A gentle non-judgemental line appears when recent quality marks skew "hard"; no new schema is added.

**Plans:** 6 plans / 4 waves

- [ ] 15-01-PLAN.md — digest reads (retrospective/overlooked/gentle-line) + pure logic [wave 1]
- [ ] 15-02-PLAN.md — migration 005 `digest_enabled` + app-settings DAO thread [wave 1]
- [ ] 15-03-PLAN.md — WEEKLY `digest:weekly` schedule service + digest-v1 channel + launch-sweep hook + App wiring [wave 2]
- [ ] 15-04-PLAN.md — DigestScreen "your week" + Digest route + dashboard "Your week" entry [wave 2]
- [ ] 15-05-PLAN.md — notification-tap routing (digest branch) + Settings "Weekly digest" toggle [wave 3]
- [ ] 15-06-PLAN.md — owner-gated on-device UAT (weekly fire + reboot + screen + toggle) [wave 4]

### Phase 16: Custom Field Value Normalization

**Goal:** Replace Phase 3's dynamic custom-value columns with a normalized, row-based model before UI/UX work and before more than test data exists — retaining the custom-field experience exactly while giving definitions and values stable identity suitable for later multi-device sync.
**Mode:** mvp
**Depends on:** Phase 15
**Requirements:** CFN-01, CFN-02, CFN-03, CFN-04
**⟢ Before planning — REQUIRED reading:** `.planning/sync-milestone/SYNC-MILESTONE-INVESTIGATION.md` §§A.5/B.6 and `.planning/phases/17-backup-export-restore/17-CONTEXT.md` §"Planned prerequisite and numbering". Phase 17 must be re-discussed after this migration; do not let Phase 16 pre-decide its backup/sync conflict policy.
**Success Criteria** (what must be TRUE):

  1. Migration **006** converts every extant dynamic custom-field value into a normalized row model without loss, including custom photos, and assigns stable `uid` identity to definitions and values. The migration is forward-only, transaction-safe, idempotently guarded by `user_version`, and leaves no future custom-field operation dependent on `ALTER TABLE` / `DROP COLUMN`.
  2. All seven existing parsers, TEXT-forever value storage, type-change preflight, `field_history`, quarantine/restore/expiry, photo handling, visibility rules, and create/edit/profile field flows continue to behave correctly on the new store.
  3. Every existing custom-field sort and filter works from the normalized rows with the same user-visible ordering and semantics; DAO/query boundaries remain safe and do not interpolate a user-provided identifier as SQL.
  4. Tests cover migrated populated data and the established field lifecycle, including retype, quarantine expiry, permanently deleting a definition, and custom photo values. Existing test-profile data remains usable after on-device migration.

**Plans:** 8 plans / 4 waves (revised after cross-AI review — see 16-REVIEWS.md). This phase changes no backup behavior and does not implement sync.

Plans:

- [ ] 16-01-PLAN.md — migration 006 tracer: atomic legacy→normalized conversion (fail-closed + D-06a orphan snapshot-and-proceed), normalized value DAO (UPSERT-on-pair, defs-filtered read), bootstrap gate [wave 1]
- [ ] 16-02-PLAN.md — create/edit caller migration: complete pair matrix incl. quarantined defs, rowUid removal, first tsc + legacy-table grep gate [wave 2]
- [ ] 16-03-PLAN.md — field lifecycle on rows: createField/quarantine/permanent-delete, re-keyed isFieldEmpty + CustomFieldsScreen, race-safe sweep [wave 3]
- [ ] 16-04-PLAN.md — type-change preflight/history on rows + latent static sortExpr expression [wave 3]
- [ ] 16-05-PLAN.md — edit/profile + AI read projections over normalized rows (defs-filtered privacy) [wave 3]
- [ ] 16-06-PLAN.md — normalized purge child deletion + v6 reserved-column derivation [wave 3]
- [ ] 16-07-PLAN.md — cross-cutting proof matrix (parameterized v1/v4/v5 + 200×15 upper-bound) + release-success & debug-failure device UAT [wave 4]
- [ ] 16-08-PLAN.md — documentation: ADR-001 + CLAUDE.md invariants sync + HANDOFF §14 supersession note [wave 4]

### Phase 17: Backup, Export & Restore

**Goal:** The load-bearing loss backstop — manual + auto rotating backup, optional encryption, and a tombstone-aware Merge/Replace restore that forward-migrates. Its local reconciliation core is documented and reusable by the later sync milestone, without implementing sync now.
**Mode:** mvp
**Depends on:** Phase 16
**Requirements:** BKP-01, BKP-02, BKP-03, BKP-04
**⟢ Before planning — REQUIRED reading:** `.planning/phases/17-backup-export-restore/17-CONTEXT.md`, then run a fresh Phase 17 discussion against Phase 16's implemented schema. Do not plan this phase from its parked context alone.
**Success Criteria** (what must be TRUE):

  1. A user can export full non-secret app state, including normalized custom-field data, base64 photos, and tombstones, as one plaintext JSON file with a `user_version` manifest header.
  2. Automatic rotating SAF-folder backup runs from the foreground launch sweep (~7 kept, once/day, on change) and gives the user a calm in-app health state/nudge based only on a successfully written automatic file. Optional AES-256-GCM backup encryption follows the locked passphrase and recovery rules in the Phase 17 context; it remains distinct from future sync E2EE.
  3. Restore previews first, defaults to Merge, and offers confirmed Replace-all. Merge uses the reusable reconciliation core: `uid` identity, newer `modified_at` for mutable rows, child-parent resolution by uid, derived `last_contact` recomputation, and tombstone-aware deletion. Replace-all creates a verified pre-restore automatic backup when configured, recreates the normalized field model, writes fresh local photo files, and rebuilds derived schedules.
  4. Migration **007** adds generic, indefinitely retained tombstones (`entity_type`, `entity_uid`, `deleted_at`) for every hard-deleted mergeable logical entity. Each delete writes its tombstone in the same transaction; a newer tombstone prevents resurrection and wins same-second ties. Export includes tombstones; old tombstone-less backups remain restorable.

**Plans:** 11/12 plans executed — wave 0 gates native package provenance; subsequent waves establish migration 007/delete evidence, non-secret settings persistence, reconciliation, export, automatic SAF backup, encryption, transactional restore, UI, and Pixel UAT.

Plans:
**Wave 1**

- [x] 17-01-PLAN.md — blocking native-package provenance verification
- [x] 17-02-PLAN.md — migration 007, tombstones, and purge evidence

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-03-PLAN.md — standalone interaction/fuel/link deletion evidence
- [x] 17-04-PLAN.md — permanent field deletion evidence and reusable reconciliation policy
- [x] 17-12-PLAN.md — non-secret singleton backup settings persistence and restore-composable DAO core

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-05-PLAN.md — validated plaintext manifest and manual share export

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 17-06-PLAN.md — verified foreground SAF snapshots, retention, and health

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 17-07-PLAN.md — native encrypted envelope and passphrase lifecycle

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 17-08-PLAN.md — validated preview plus transactional Merge/Replace apply
- [x] 17-09-PLAN.md — Backup landing, settings, and temporary Dashboard entry

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 17-10-PLAN.md — restore picker, preview, confirmation, and aggregate result UI

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 17-11-PLAN.md — automated gates and owner-led Android release UAT

> **Phase 18 was split (2026-08-27).** The original single "Contact Data Normalization" phase
> bundled data-layer method normalization with a cross-cutting Bound/Unbound lifecycle rollout under
> one name, which no reviewer scoped honestly. It is now **Phase 18.1** (method normalization) then
> **Phase 18.2** (Bound/Unbound lifecycle). Streamlined Export (old 18-10) is deferred out entirely.
> The two-cycle review findings are preserved and re-assigned; see
> `.planning/phases/18-contact-data-normalization/18-SPLIT-PLAN.md` for the full provenance and
> plan-to-bucket map. The original phase dir is retained as the historical record.

### Phase 18.1: Contact Method Normalization

**Goal:** Normalize phone/email into first-class, sync-ready contact methods and establish local
system-contact provenance foundations, without losing relationship data or making system contacts
authoritative. All contacts remain Bound; the lifecycle rollout is Phase 18.2.
**Mode:** mvp
**Depends on:** Phase 17
**Requirements:** CDN-01, CDN-04 (normalized-method backup half), CDN-03 (Orbit-identity-independence half only)

#### Canonical refs

`docs/dossier/18-contact-data-normalization.md` — **authoritative product-decision source; researcher and planner MUST read it in full before research or planning.** (Clusters A–F, O, P, Q, and the method half of R govern 18.1.)

**Success Criteria** (what must be TRUE):

  1. Phone and email are migrated from the old singular columns into ordered, first-class methods with stable identity, per-type primaries, canonical matching, extensions, and no duplicate authoritative storage; malformed methods remain storable but are not actionable.
  2. External system-contact links/provenance are structurally supported without changing Orbit identity or permitting source disappearance to delete Orbit data; lossless backup/restore round-trips the normalized method model. (Bound/Unbound state in backup is Phase 18.2.)

**Migration:** ships **v9** — the data-bearing contacts rebuild that retires scalar phone/email into method rows. `interval_days` stays NOT NULL; no `tracking_enabled` yet. The nullable-cadence/lifecycle schema is Phase 18.2's v10.

**Plans:** 6 plans

Plans:
**Wave 1**

- [x] 18.1-01-PLAN.md — v9 method migration foundation + pure phone/email normalizer

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18.1-02-PLAN.md — contact-method write/read DAO

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18.1-03-PLAN.md — contact-method create/edit editor UI
- [x] 18.1-04-PLAN.md — normalized method backup/export/restore graph
- [x] 18.1-05-PLAN.md — profile primary-method display and Compose handoff

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 18.1-06-PLAN.md — 18.1 verification and owner-led Android migration UAT (device UAT passed; restore route repaired)

### Phase 18.2: Bound/Unbound Lifecycle

**Goal:** Establish the independent Bound/Unbound contact lifecycle across every proactive surface —
dashboard, Orrery, Never Contacted, notifications, widgets, favourites, AI — without losing
relationship history, on top of Phase 18.1's normalized model.
**Mode:** mvp
**Depends on:** Phase 18.1
**Requirements:** CDN-02, CDN-03 (lifecycle/Unbound-browsing/AI half), CDN-04 (Bound/Unbound-state backup half)

#### Canonical refs

`docs/dossier/18-contact-data-normalization.md` — **authoritative product-decision source.** (Clusters G–N, S, and the lifecycle half of R govern 18.2.)

**Conflict preserved:** Dossier 18's scope/deferred text labels Interaction Assist as Phase 20, while the requested sequence and Dossier 21 place it in Phase 21. This roadmap makes no product reinterpretation; Phase 18.2 must not absorb Interaction Assist work.

**Success Criteria** (what must be TRUE):

  1. Bound/Unbound is independent of cadence and preserves relationship history: existing contacts migrate Bound, `interval_days = NULL` means only never-assigned, and assigned cadence can never be cleared.
  2. Bound-only proactive surfaces and the dedicated Unbound population honor the locked dashboard, Orrery, favourites, Never Contacted, notification, widget, and AI behavior; explicit person-level work and factual birthday behavior remain available as decided.
  3. Lossless backup/restore preserves Bound/Unbound state and dormant cadence alongside the normalized methods, and rejects illegal lifecycle/cadence combinations before apply.

**Migration:** ships **v10** — a pure shape change (make `interval_days` nullable, add `tracking_enabled` + CHECK constraints + one-way cadence trigger + Unbound settings columns). Moves no data.

**Plans:** 10 plans

Plans:
**Wave 1**

- [x] 18.2-01-PLAN.md — v10 lifecycle-schema migration (nullable cadence, tracking_enabled, constraints)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18.2-02-PLAN.md — lifecycle write DAO (Bind/Unbind transitions)
- [x] 18.2-03-PLAN.md — Bound-aware query owners and policy reads

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18.2-04-PLAN.md — nullable-cadence impact and explicit-AI reads
- [x] 18.2-05-PLAN.md — Orrery Bound-only reads and shared saved-sun policy
- [x] 18.2-09-PLAN.md — Bound/Unbound backup extension and lifecycle-combo validation

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 18.2-06-PLAN.md — notification/widget lifecycle policy and Unbind effects
- [x] 18.2-07-PLAN.md — Unbound browsing, navigation, and settings

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 18.2-08-PLAN.md — create/edit and profile lifecycle forms and Bind/Unbind execution

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 18.2-10-PLAN.md — 18.2 verification and owner-led Android lifecycle UAT

### Phase 19: System Contact Import

**Goal:** Let users deliberately select system contacts and safely import or initially link them through conservative, resumable single/bulk review on Phase 18.2's normalized model.
**Mode:** mvp
**Depends on:** Phase 18.2
**Requirements:** IMP-01, IMP-02, IMP-03, IMP-04

**Status: COMPLETE 2026-08-30.** All four success criteria verified (`19-VERIFICATION.md` PASS 4/4). 11 plans + gap fixes 19-12→19-16 + the Android-17 picker intent fix (gap plan 19-20) shipped; device UAT (19-17) passed on the Pixel 6 (API 37). The earlier "Android-17 picker is an OS defect" belief was disproven — the dead-end was orbit's own intent (wrong `USE_SYSTEM_CONTACTS_PICKER` extra namespace). Carried-forward open items (3 import-subsystem code-review defects + a minor single-import UX note) were folded into **Phase 19.1**. Commits LOCAL on `main`, NOT pushed.

#### Canonical refs

`docs/dossier/19-system-contact-import.md` — **authoritative product-decision source; researcher and planner MUST read it in full before research or planning.**

**Sequencing:** Phase 19 and Phase 20 are a tightly coupled two-phase sprint; Phase 19 must not expand into ongoing reconciliation or generic Orbit-to-Orbit merge.
**Conflict to resolve before planning:** Dossier 19's `[DECIDED]` iOS native-picker statement conflicts with the existing v1 iOS deferral in PROJECT.md/REQUIREMENTS.md. This roadmap intentionally makes no scope choice.
**Success Criteria** (what must be TRUE):

  1. Intentional import is reachable from the Add flow and Settings through the privacy-preserving system picker path, with Android targeting the modern Android 17+ Contact Picker and no broad legacy contact permission; unsupported older Android versions leave Orbit otherwise usable.
  2. A single pick always receives detailed review before create/link; bulk selection uses shared defaults of Unbound + Uncategorized, imports only name/phones/emails/birthday/photo, and processes large batches incrementally without an arbitrary app-level cap.
  3. Exact external linkage is deterministic while all other duplicate evidence is conservative and advisory: ambiguous candidates never silently merge/link or block safe batch imports, and Phase 19 performs no generic Orbit-to-Orbit merge.
  4. Accepted picker results become durable resumable import sessions; cancellation before ownership writes nothing, safe partial commits remain committed, independent photo failures do not invalidate contacts, and completion reports bridge to Unbound contacts.

**Scope decision (resolved at planning):** Android-only for Phase 19 (owner ruling 2026-08-28). Dossier 19's iOS native-picker `[DECIDED]` is honored as design intent for a later iOS milestone and is out of scope now (consistent with the v1 iOS deferral) — sequenced, not reversed.

**Plans:** 11 plans (7 waves) — re-waved 2026-08-29 after the cross-AI review replan (atomic contact+session-row writes, durable document-dir photo staging, row_status/match_outcome discriminator, pre-batch consolidation), then a cycle-2 replan (composed single-transaction classification writers, durable candidates_json, finalizeSessionIfTerminal on every review path, shared importRowAsNew photo seam, Replace-all session purge, required orphan-staging reconciliation; consolidation moved to Wave 6 to depend on the photo seam), then a cycle-3 replan (staged-photo preview via resolveImportStagingUri, durable batch_category_id via setSessionBatchCategory/getSessionById, never-started-vs-mid-batch bulk resume split, App.tsx path fix; plan 07 gained a depends_on:19-10 edge and moved to Wave 6, cascading plan 08 to Wave 7).

Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Migration 012 durable import-session schema (incl. phone_region) + session DAO (mutexed writers + non-mutexed row cores + atomic accept) + read chokepoint (raw + four summary buckets) + state-transition table (one-way gated)
- [x] 19-02-PLAN.md — Native Android 17 contact-picker module (ACTION_PICK_CONTACTS, SDK_INT gate, no READ_CONTACTS; returns a cache copy only)
- [x] 19-05-PLAN.md — Duplicate-evidence engine (owns findActiveExternalLink; deterministic bypass + canonicalized-input advisory ladder, colourless)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-03-PLAN.md — createContactFullCore extraction + isValidStoredBirthday export + picked-contact-map (region-threaded) + imported-contact-dao (atomic create/link + session-row resolution)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-04-PLAN.md — TRACER: single-contact import end-to-end (speed-dial FAB multi-pick + length routing, document-dir photo staging, region capture, atomic commit, discard-on-back) device-verified before expansion

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 19-06-PLAN.md — Bulk import: chunked atomic partial-failure driver (already_linked match_outcome, ambiguous→needs_review, eligibleStatuses retry, region from session) + shared-defaults setup + determinate progress + verified FAB→BulkImportSetup entry

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 19-09-PLAN.md — Durable resume/discard launch sweep (resume state machine incl. never-started-vs-mid-batch bulk routing, one-pending policy, discard-returns-photo-paths, retryable-failed preserved) + staged-photo cleanup
- [x] 19-10-PLAN.md — Photo (post-commit Orbit-owned master from durable staged path) import into the shared commitSingleImport + importRowAsNew seams, best-effort and failure-isolated (birthday owned by 19-03)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 19-07-PLAN.md — Reusable candidate card grid + confidence chip + single/multi duplicate interrupts (atomic linkExistingContactToRow; conservative Apply-recommendation; batch category read from session; already_linked → matched Profile) — depends on 19-10 for the shared importRowAsNew photo seam
- [x] 19-11-PLAN.md — Conservative multi-source consolidation (Cluster K) — PRE-batch detection in BulkImportSetup, atomic combine (row_status='imported' + in-txn birthday + post-commit photo), explicit combine-into-one, never silent

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 19-08-PLAN.md — Import completion summary (four durable summary buckets, finalizeSessionIfTerminal) + bridge to Unbound contacts + Retry (eligibleStatuses, batch category from session)

**Gap closure (post-verification 2026-08-29 — 19-VERIFICATION.md scored 1/4 truths; 3 failed truths across IMP-01/IMP-02/IMP-04, IMP-03 VERIFIED). 6 gap plans (3 waves); 19-01..19-11 untouched.**

- [x] 19-12-PLAN.md — GAP A (IMP-01, W1): native picker targets `android.provider.action.PICK_CONTACTS` + launch guard (Event/Photo handling preserved)
- [x] 19-13-PLAN.md — GAP B (IMP-02, W1): birthday validated at the importContactRecord DAO boundary (shared isValidStoredBirthday) + review-screen error state + shared normalizeEditedBirthday
- [x] 19-14-PLAN.md — GAP C.1 (IMP-04, W1): leave-guard "unresolved" defined by row_status (pending/needs_review/failed) so resolved skips/links survive navigation
- [x] 19-15-PLAN.md — GAP C.3 (IMP-04, W1): combineCluster calls finalizeSessionIfTerminal + BulkImportSetup routes cluster-only batches to ImportComplete
- [x] 19-16-PLAN.md — GAP C.2 (IMP-04, W2): retire session photo_rel_path + delete raw staging on success; status-aware resume-sweep liveness (PII retention closed)
- [ ] 19-17-PLAN.md — Device UAT (IMP-01/02/04, W3): agent-driven Pixel verification of all five fixes (picker launch, resolved-flow/recovery/completion, photo lifecycle, birthday block)

### Phase 19.1: Older-Android Contact Picker (Hybrid two-picker, ADR-002) (INSERTED)

**Goal:** Build the older-Android (≤ API 36) half of the hybrid two-picker contact acquisition
decided in **ADR-002**, so contact import works on Android 14/15/16 (e.g. the Pixel 3a) — not only
Android 17. On ≤16: declare `READ_CONTACTS` scoped with `android:maxSdkVersion="36"` (inert on API-37
devices, so Google Play Contacts-policy compliant) + a **custom in-app picker** (browse / search /
multi-select over `ContactsContract`) that reads full fields — multiple phones/emails, **birthday
only from `Event.TYPE == TYPE_BIRTHDAY`**, and photo — and maps them to the **same `PickedContact[]`**
the existing pipeline consumes. Route by `Build.VERSION.SDK_INT` (17+ → existing system picker; ≤16 →
custom picker) and retire the "requires Android 17+" unsupported state.

**Requirements**: IMP-01 (extends: cross-version acquisition). Full contract in ADR-002.
**Depends on:** Phase 19 (reuses its import pipeline; reverses its Android-17-only picker decision).
**Reverses / supersedes:** the Phase-19 "Android 17+ picker only, no `READ_CONTACTS`" locked decision
(HANDOFF/research) — now recorded in `docs/decisions/ADR-002-hybrid-two-picker-contact-import.md`.

**Scope boundary:** ONLY the older-Android picker path + routing + the ADR. The Android-17 path
(Phase-19 plans 19-12→19-19) stays in Phase 19 and is finished separately once its device blocker is
resolved. The **entire downstream import pipeline is SHARED and unchanged** (sessions, review, cluster
consolidation, complete, resume/discard, photo staging, birthday validation — Phase-19 plans
19-13→19-16).

**Why now / context:** first Phase-19 device UAT found the Android-17 system picker non-functional on
the owner's real Android 17 Pixel 6 (OS-level, not app code), and the owner wants older-device support
(the Pixel 3a) for testing + reach. A spike confirmed rich permissionless reads are impossible below
Android 17, so ≤16 needs `READ_CONTACTS`. Owner ruling: permissions are fine where they earn their
place (a read permission ≠ breaking local-first). **Full context for discussion:**
`19.1-SEED.md` (this phase dir), `ADR-002`, `../19-system-contact-import/19-SPIKE-older-android-permissions.md`,
and `../19-system-contact-import/19-DEVICE-UAT-FINDINGS.md`.

**Plans:** 4/5 plans executed / 4 waves (tracer-first; native reader + carried-forward fixes lead in parallel, then picker UI, permission UX, device UAT)

Plans:

- [x] 19.1-01-tracer-legacy-acquisition-PLAN.md
- [x] 19.1-02-carried-forward-pipeline-fixes-PLAN.md
- [x] 19.1-03-custom-picker-ui-PLAN.md
- [x] 19.1-04-permission-ux-and-routing-PLAN.md
- [ ] 19.1-05-device-uat-and-manifest-verification-PLAN.md

- [x] 19.1-01-PLAN.md — Tracer: end-to-end ≤16 acquisition (native full-provider reader + Event.TYPE gate + reject-on-error, scoped READ_CONTACTS maxSdkVersion=36, shared contactImportMode seam, minimal picker, FAB dispatch) [wave 1]
- [x] 19.1-02-PLAN.md — Carried-forward shared-pipeline fixes: D-12 nameless→skipped + count, D-13 broaden birthday + flag-don't-drop, D-14b already-linked clean exit (no migration) [wave 1]
- [x] 19.1-03-PLAN.md — Custom picker UI (D-09/D-10): decoupled source+selection logic, two-tier native read, searchable/avatar'd/uncapped virtualized FlatList [wave 2]
- [ ] 19.1-04-PLAN.md — Permission UX (D-11a/b/c) + retire the "requires Android 17+" state (D-05) + route both entry points through the shared seam [wave 3]
- [ ] 19.1-05-PLAN.md — Pixel 3a device UAT + generated-manifest scoping verification (A3) + full-suite gate + ADR supersession note [wave 4]

### Phase 20: Contact Reconciliation & Merge

**Goal:** Safely maintain selected system-contact links through user-triggered, one-way reconciliation and let users explicitly, atomically consolidate duplicate Orbit identities.
**Mode:** mvp
**Depends on:** Phase 18.2, Phase 19
**Requirements:** RCN-01, RCN-02, RCN-03, RCN-04

#### Canonical refs

`docs/dossier/20-contact-reconciliation-merge.md` — **authoritative product-decision source; researcher and planner MUST read it in full before research or planning.**

**Success Criteria** (what must be TRUE):

  1. Per-contact update and Check linked contacts perform only user-triggered, System-Contacts-to-Orbit reconciliation across name, normalized methods, birthday, and photo; additive values can be recommended, while conflicts/removals/missing sources never silently overwrite or delete Orbit data.
  2. Reconciliation reuses the shared card-grid workspace, combines multiple source links into one person card, remembers unchanged reviewed discrepancies narrowly, and preserves unresolved work in durable resumable sessions with an explicit result summary.
  3. Users can invoke a serious explicit merge from duplicate/reconciliation detail or a profile: choose the survivor, resolve scalar conflicts, automatically consolidate compatible methods/children, recompute derived relationship values, and confirm one atomic no-simple-undo transaction.
  4. Absorbed identities are retired/tombstoned rather than archived so future sync cannot resurrect them; Phase 20 does not add polling, source write-back, generic multi-device sync, or generic conflict machinery.

**Carried forward from Phase 19.1** (owner-approved, 2026-08-30): a **bulk review surface** that
surfaces per-item unparseable-birthday flags (and other bulk review cases) so the user can resolve
them. Phase 19.1 only *counts* unparseable birthdays on the bulk completion summary (the raw value is
retained in the import row's `source_payload`); the durable per-item resolve UI belongs here, alongside
the reconciliation workspace (Success Criterion 2). See `.planning/phases/19.1-…/19.1-CONTEXT.md`
Deferred Ideas and `19.1-02-…-PLAN.md`.

**Plans:** 0 plans

### Phase 21: Interaction Assist & Reach Out

**Goal:** Provide a shared low-friction Call/Text/Email Reach Out path and optional durable Interaction Assist that asks users to confirm/log the outcome after native handoff.
**Mode:** mvp
**Depends on:** Phase 18.2, Phase 20
**Requirements:** IAS-01, IAS-02, IAS-03, IAS-04

#### Canonical refs

`docs/dossier/21-interaction-assist-reach-out.md` — **authoritative product-decision source; researcher and planner MUST read it in full before research or planning.**

**Success Criteria** (what must be TRUE):

  1. Profile and larger-widget Contact routes open one shared Reach Out router for actionable Call/Text/Email methods, emphasize primaries, use no more than three taps when endpoint choice is needed, and retain coarse—not endpoint/provider—interaction history.
  2. With Interaction Assist enabled, Orbit writes a pending assist immediately before native handoff; failed handoffs become failed, and an app-global non-modal return banner manages a durable queue capped at five unresolved assists and 24 hours.
  3. Confirmations create outbound interactions at the original handoff time through the existing authoritative interaction/recency writer (including Call No answer); notes are optional, and archived/Unbound/merged/purged target handling follows the locked lifecycle rules without resurrection.
  4. Interaction Assist remains wholly local and user-initiated: no passive call/text/email observation, delivery/read verification, background monitoring, or widget-side assist writer; the larger widget's Message action is superseded by Contact while all other widget architecture stays unchanged.

**Plans:** 0 plans

## Progress

**Execution Order:** Phases execute sequentially in numeric order: 1 → 2 → 3 → … → 21.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold & Portable Code | 5/5 | Complete    | 2026-08-14 |
| 2. Data Foundation & Status Engine | 6/6 | Complete    | 2026-08-14 |
| 3. Custom Fields | 8/8 | Complete    | 2026-08-15 |
| 4. Contact CRUD & Lifecycle | 9/9 | Complete   | 2026-08-15 |
| 5. Photos | 8/8 | Complete   | 2026-08-15 |
| 6. Interaction Log, Status & Impact | 6/6 | Complete   | 2026-08-15 |
| 7. Conversational Fuel | 4/4 | Complete   | 2026-08-16 |
| 8. Dashboard & Never-Contacted Screen | 10/10 | Complete   | 2026-08-16 |
| 9. Compose Screen & SMS Handoff | 2/2 | Complete   | 2026-08-16 |
| 10. Share-Sheet Capture | 6/6 | Complete   | 2026-08-16 |
| 11. Actionable Notifications | 13/13 | Complete   | 2026-08-16 |
| 12. Home Screen Widget | 8/8 | Complete   | 2026-08-17 |
| 13. Orrery | 8/8 | Complete   | 2026-08-18 |
| 14. AI Message Suggestions | 7/7 (+gap iters 08→10, 09→11) | Complete — owner-accepted (LiteLLM picker + frontier-3 + cap removed; node 1305/1305 + device-UAT'd; egress smoke-PASS). Local on main, not pushed | 2026-08-22 |
| 15. Weekly Digest | 0/TBD | Not started | - |
| 16. Custom Field Value Normalization | 0/TBD | Not started | - |
| 17. Backup, Export & Restore | 11/12 | In Progress|  |
| 18. Contact Data Normalization | 0 | Not started | - |
| 19. System Contact Import | 16/17 | In Progress|  |
| 20. Contact Reconciliation & Merge | 0 | Not started | - |
| 21. Interaction Assist & Reach Out | 0 | Not started | - |
