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
share-sheet capture, actionable notifications, the widget, and the orrery). Phases 14–16 add AI
suggestions, the weekly digest, and the load-bearing backup/export/restore. Phases map one-to-one
onto the dossier domains; a `[DECIDED]`/`[REJECTED]` decision is implemented, never reopened.

## Phases

- [x] **Phase 1: Project Scaffold & Portable Code** — Expo/RN app, theme tokens, and the ~900 lines of portable plugin source extracted into `src/`. (completed 2026-08-14)
- [x] **Phase 2: Data Foundation & Status Engine** — migration-1 SQLite scaffold, all core tables, single-writer `last_contact` DAO, continuous status, launch-sweep skeleton. (completed 2026-08-14)
- [x] **Phase 3: Custom Fields** — HANDOFF §14 two-table design, 7 parsers, `field_history`, quarantine sweep, and the field editor. (completed 2026-08-15)
- [x] **Phase 4: Contact CRUD & Lifecycle** — create/edit forms, `contact_links`, archive/restore/purge, the contact profile scaffold. (completed 2026-08-15)
- [x] **Phase 5: Photos** — library picker + URL path, in-app Skia crop, 512px master, themed initials fallback. (completed 2026-08-15)
- [ ] **Phase 6: Interaction Log, Status & Impact** — touchpoint rows, editable timeline, gravity/intensity, rogue, "Rarely responds".
- [ ] **Phase 7: Conversational Fuel** — per-item rows (5 kinds incl. `off_limits`), ranked projection, profile editor, cross-contact search.
- [ ] **Phase 8: Dashboard & Never-Contacted Screen** — the home screen, sort/filter/search, birthday banner, favourites, freshness, empty states.
- [ ] **Phase 9: Compose Screen & SMS Handoff** — the in-app message surface (fuel visible, Send→SMS, Copy) that notify/widget/AI all open.
- [ ] **Phase 10: Share-Sheet Capture** — Android share target, grid-of-faces picker, `EXTRA_SUBJECT` patch, inline create.
- [ ] **Phase 11: Actionable Notifications** — pre-scheduled + launch-reconcile engine, decay + birthday, headless actions, mute, settings.
- [ ] **Phase 12: Home Screen Widget** — favourites grid, headless mark, Quick mark · Log contact · Message, add-widget button.
- [ ] **Phase 13: Orrery** — the two-view Skia solar system, rogue rendering, assignable/self-colour sun, ambient layer.
- [ ] **Phase 14: AI Message Suggestions** — providers + keys, editable-draft flow, prompt assembly, `share_with_ai`.
- [ ] **Phase 15: Weekly Digest** — one WEEKLY Sunday notification → a live "your week" screen.
- [ ] **Phase 16: Backup, Export & Restore** — manual + auto SAF backup, optional encryption, Merge/Replace restore, forward-migrate.

## Cross-phase constraints (from INDEX.md's constraint log — these cross phase boundaries)

Recorded here because they bind phases that do not own them. Every planner/executor inherits these.

- **Single-writer `last_contact` DAO** (Phase 2): the *only* writer of `contacts.last_contact`,
  recomputed as MAX over current interaction rows on every insert/edit/delete, in a transaction,
  behind a JS mutex. Every touchpoint route — CRUD (4), log (6), capture is NOT one (10), widget (12),
  notification (11) — writes through it; headless writers (11, 12) share the mutex. For "Rarely
  responds" contacts (6) the MAX is over connected rows only.

- **One launch sweep, many responsibilities** (skeleton in Phase 2): quarantine expiry + history
  retention (Phase 3), archived-contact purge (Phase 4), notification schedule reconcile (Phase 11),
  digest re-register (Phase 15), backup rotation (Phase 16). It runs once per real foreground launch —
  never on module import or a headless widget/notification tap.

- **Un-backfillable columns exist from migration 1** (Phase 2): surrogate PK + distinct `uid`,
  `created_at`, `modified_at`, `ring_seq`; interaction `recorded_at`/`source`; fuel
  `kind`/`created_at`/`source`/`url`; `custom_field_defs` display-order and `share_with_ai`. Adding
  them later is impossible against un-reachable devices.

- **`col_name` is whitelist-constructed, never escaped** (Phase 3), and the slugifier is a single
  producer that reserves the entire fixed-column name set (Phase 4 exports the reserved set).

- **The compose screen is one surface, built once** (Phase 9) and reused by notifications (11), the
  widget Message action (12), and AI Suggest (14). "Fuel visible" lives here, not in notification text.

- **The shared `rogue` constant** (a multiple of the interval) is one value read by the orrery (13),
  notification decay-suppression (11), and the digest (15) — never computed three times.

- **Photos are one 512px master** (Phase 5); the widget (12) re-encodes it to base64 (RemoteViews
  can't read `file://`); the orrery (13) uses it via Skia `useImage`; backup (16) embeds base64.

- **Keys in `expo-secure-store`, never exported** (Phase 14); backup (16) exports non-secret AI
  settings only.

- **`modified_at` on every mergeable table + `uid` distinct from PK** (Phase 2) exist for backup's
  newest-edit-wins Merge (Phase 16).

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

**Plans:** 4/6 plans executed

**Wave 1**

- [x] 06-01-PLAN.md — One-tap "Log contact" + shared future-date guard (log-guards) through the single writer (LOG-01, LOG-06)

**Wave 2** *(blocked on Wave 1)*

- [x] 06-02-PLAN.md — Events writer (immutable events-dao + archive/restore retrofit) + interleaved timeline read + TimelineRow render + purge events surfacing (LOG-02)

**Wave 3** *(blocked on Wave 2)*

- [x] 06-03-PLAN.md — Refine/edit (editTouchpointFull, all cols + always-recompute) + confirmed unrecoverable delete + two-dialog date+time (LOG-01, LOG-02, LOG-04, LOG-06)

**Wave 4** *(blocked on Wave 3)*

- [x] 06-04-PLAN.md — Rogue reason (REASON_SQL) + single-contact query-time status read + status/gravity colour tokens (rogue + gravityTiers) + in-app rogue label (LOG-05, LOG-04)

**Wave 5** *(blocked on Wave 4)*

- [ ] 06-05-PLAN.md — Gravity (age-decay → named tiers + bar) + impact-read + GravityBar, derived-never-stored profile-only (LOG-03)

**Wave 6** *(blocked on Wave 5)*

- [ ] 06-06-PLAN.md — Intensity (neutral rate + trailing cadence) + IntensityLine, profile-only (LOG-03)

### Phase 7: Conversational Fuel

**Goal:** Per-item fuel with kinds and the never-transmitted `off_limits`, a single ranked projection for every glanceable surface, the profile editor, and cross-contact search.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** FUEL-01, FUEL-02, FUEL-03, FUEL-04, FUEL-05, FUEL-06
**Success Criteria** (what must be TRUE):

  1. A user can add/edit/delete fuel items on a profile across the 5 kinds + optional label; `off_limits` is excluded from every glanceable surface in-query.
  2. One ranked projection (kind priority then recency) produces the line the card, notification, and widget all reuse; age renders and drives ranking without ever hiding data.
  3. Cross-contact search matches name AND fuel text with `off_limits` excluded; `source='ai'` items render unconfirmed and are excluded from prompts until confirmed.

**Plans:** TBD

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

**Plans:** TBD

### Phase 9: Compose Screen & SMS Handoff

**Goal:** The in-app compose screen — the single "fuel visible → send" surface — reachable from the profile now and reused by later phases.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements:** CMP-01, CMP-02, CMP-03
**Success Criteria** (what must be TRUE):

  1. From a contact's profile a user opens the compose screen, sees the contact's full fuel and an editable draft, and can Send (→ SMS composer) or Copy (always works).
  2. Back from compose lands on the dashboard.
  3. With no phone number, Copy still works and an "add number" affordance appears.

**Plans:** TBD

### Phase 10: Share-Sheet Capture

**Goal:** Zero-friction capture — Orbit as an Android share target that lands a link/text as fuel on a picked (or inline-created) contact, durably and fast.
**Mode:** mvp
**Depends on:** Phase 9
**Requirements:** CAP-01, CAP-02, CAP-03, CAP-04
**Success Criteria** (what must be TRUE):

  1. Sharing `text/plain` into Orbit opens the grid-of-faces picker (favourites → capture-MRU → rest, includes never-contacted, excludes archived) with the keyboard closed.
  2. A single tap writes the fuel row immediately (`topic`/`share`, `EXTRA_SUBJECT` label with bare-URL fallback, `url` canonical), long-press multi-selects, and capture never marks a touchpoint.
  3. A user can inline-create a name-only contact (lands never-contacted); a toast confirms and Orbit returns to the source app.

**Plans:** TBD

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

**Plans:** TBD

### Phase 12: Home Screen Widget

**Goal:** A favourites-grid widget with headless mark-contacted, status-colour avatars, and a larger-tile action set — adding no new schema.
**Mode:** mvp
**Depends on:** Phase 11
**Requirements:** WDG-01, WDG-02, WDG-03
**Success Criteria** (what must be TRUE):

  1. The widget shows favourites in static manual rank with status-colour base64 avatars; a small-tile tap marks contacted headlessly (30s budget, DAO+mutex) and a name/chevron opens the profile.
  2. The larger tile adds Quick mark · Log contact · Message (→ the compose screen) plus the fuel line.
  3. Freshness is event-push + launch/boot refresh (no polling); an empty widget prompts "Choose favourites"; an in-app "Add widget" button works with graceful fallback; "Back → dashboard" is JS navigation.

**Plans:** TBD

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

**Plans:** TBD

### Phase 14: AI Message Suggestions

**Goal:** The optional AI feature — ported providers, secure keys, editable-draft flow, and a privacy-bounded prompt assembled from structured data.
**Mode:** mvp
**Depends on:** Phase 13
**Requirements:** AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):

  1. A user configures OpenAI/Anthropic/Gemini or an HTTPS-only custom endpoint, with keys in secure-store (never exported) and dynamic model lists (free-text fallback); AI is off by default and free BYO-key.
  2. AI Suggest on compose and profile returns an editable draft (Copy guaranteed, Send → SMS).
  3. The prompt uses ranked fuel (minus `off_limits`), interaction aggregates only, gravity tier/intensity/quality, and only `share_with_ai`-flagged fields; it is shown before the first send per provider and always inspectable, and the debug log is redacted.

**Plans:** TBD

### Phase 15: Weekly Digest

**Goal:** A weekly Sunday-morning notification opening a live "your week" screen — the retrospective and the non-nagged overlooked populations the dashboard can't give on a schedule.
**Mode:** mvp
**Depends on:** Phase 14
**Requirements:** DGST-01, DGST-02, DGST-03
**Success Criteria** (what must be TRUE):

  1. One native WEEKLY (Sunday morning) notification fires unconditionally, survives reboot, opens a live screen, defaults on, and is independently toggleable.
  2. The screen shows the "reached this week" retrospective (all touchpoints, no connected/direction predicate) and "the overlooked" (rogue + Rarely-responds gone-quiet + never-contacted backlog, mute ignored, archived excluded), with a calm empty state.
  3. A gentle non-judgemental line appears when recent quality marks skew "hard"; no new schema is added.

**Plans:** TBD

### Phase 16: Backup, Export & Restore

**Goal:** The load-bearing loss backstop — manual + auto rotating backup, optional encryption, and a Merge/Replace restore that forward-migrates — closing HANDOFF §3's open item.
**Mode:** mvp
**Depends on:** Phase 15
**Requirements:** BKP-01, BKP-02, BKP-03, BKP-04
**Success Criteria** (what must be TRUE):

  1. A user can export full app state (tables + non-secret settings + base64 photos, keys/`field_history` excluded) as one plaintext JSON file with a `user_version` manifest header.
  2. An automatic rotating SAF-folder backup writes on the launch sweep (~7 kept, once/day, on change) with an overdue nudge; optional AES-256-GCM encryption covers manual and auto (Keystore-cached passphrase, loss warning at set time).
  3. Restore offers Merge (default, newest-`modified_at`-wins on `uid`) and Replace-all — recreating custom columns from defs, recomputing `last_contact`, writing fresh photo files, re-registering schedules — migrating an older backup forward, rejecting a newer one, and previewing counts first.

**Plans:** TBD

## Progress

**Execution Order:** Phases execute sequentially in numeric order: 1 → 2 → 3 → … → 16.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold & Portable Code | 5/5 | Complete    | 2026-08-14 |
| 2. Data Foundation & Status Engine | 6/6 | Complete    | 2026-08-14 |
| 3. Custom Fields | 8/8 | Complete    | 2026-08-15 |
| 4. Contact CRUD & Lifecycle | 9/9 | Complete   | 2026-08-15 |
| 5. Photos | 8/8 | Complete   | 2026-08-15 |
| 6. Interaction Log, Status & Impact | 4/6 | In Progress|  |
| 7. Conversational Fuel | 0/TBD | Not started | - |
| 8. Dashboard & Never-Contacted Screen | 0/TBD | Not started | - |
| 9. Compose Screen & SMS Handoff | 0/TBD | Not started | - |
| 10. Share-Sheet Capture | 0/TBD | Not started | - |
| 11. Actionable Notifications | 0/TBD | Not started | - |
| 12. Home Screen Widget | 0/TBD | Not started | - |
| 13. Orrery | 0/TBD | Not started | - |
| 14. AI Message Suggestions | 0/TBD | Not started | - |
| 15. Weekly Digest | 0/TBD | Not started | - |
| 16. Backup, Export & Restore | 0/TBD | Not started | - |
