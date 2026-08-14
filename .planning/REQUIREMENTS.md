# Requirements: Orbit

**Defined:** 2026-08-14
**Core Value:** Collapse the taps between "you're overdue with X" and the message actually being sent.

Scoped to the dossier's decided v1. Every requirement is derived from a `[DECIDED]` item in
`docs/dossier/` or `HANDOFF.md` — not re-derived. Requirement categories map one-to-one onto
roadmap phases. Items marked *(infra)* are foundation guarantees rather than end-user actions.

## v1 Requirements

### Foundation & Portable Code (FND)

- [ ] **FND-01**: The Expo/RN app builds and launches to a home shell on the Pixel 6 Pro through the desktop-build → install pipeline (pipeline verified once). *(infra)*
- [x] **FND-02**: The portable plugin files are extracted into `src/` as tracked, linted, typed source — `calculateStatus()` + `FREQUENCY_DAYS`/`Frequency`/`OrbitStatus`/`SocialBattery`, `schemas/types.ts`, both built-in schemas, `formatLocalDate()`, `logger.ts`. *(infra)*
- [x] **FND-03**: `types.ts` is free of Obsidian coupling (`TFile` stripped/generalised) and the extracted files typecheck. *(infra)*
- [x] **FND-04**: `AiService.ts` is ported with `requestUrl`→`fetch` and explicit `response.ok` handling, decoupled from Obsidian types (not yet wired to UI). *(infra)*
- [x] **FND-05**: A theme-token module and Zustand store scaffold exist (quest-board pattern); no hardcoded colours. *(infra)*
- [x] **FND-06**: Biome lint/format, portrait-lock, and the CLAUDE.md folder layout are configured. *(infra)*

### Data Foundation & Status Engine (DATA)

- [ ] **DATA-01**: On launch the app reads `PRAGMA user_version`, runs forward-only migrations in strict order each wrapped in its own transaction, and sets `foreign_keys=ON` + WAL + a busy_timeout before any transaction opens. *(infra)*
- [ ] **DATA-02**: Migration 1 creates `contacts` with a surrogate PK, a distinct globally-unique `uid`, `created_at`, `modified_at`, `interval_days`, `category_id`, `social_battery`, optional-year `birthday`, `phone`, `email`, `photo`, `last_contact`, favourite rank, `ring_seq`, `archived_at`, snooze, "Rarely responds", and reminders-off — every un-backfillable column present from day one. *(infra)*
- [ ] **DATA-03**: Migration 1 also creates `categories` (seeded Family/Friends/Work/Community, user-editable, reorderable), the single-row self/profile record, `contact_links`, `interactions`, and a separate `events` table; every mergeable table carries `uid` + `modified_at`. *(infra)*
- [ ] **DATA-04**: Exactly one DAO function writes `contacts.last_contact` (= MAX over the contact's current interaction rows, recomputed after every insert/edit/delete, in a transaction, behind a JS mutex shared with headless writers). *(infra)*
- [ ] **DATA-05**: Status/progress is computed at query time (never stored) as elapsed ÷ interval, bucketed at 80%/100%, resolving day-granular at local midnight; SQL uses `date('now','localtime')`. *(infra)*
- [ ] **DATA-06**: A launch-sweep entry point runs once per real foreground launch (never on module import or a headless tap) and is structured to host quarantine expiry, history retention, archived-purge, schedule reconcile, and backup rotation. *(infra)*
- [ ] **DATA-07**: An on-device benchmark on the Pixel confirms the newest-interaction-per-contact query and the status scan are acceptably fast. *(infra)*

### Custom Fields (FLD)

- [ ] **FLD-01**: Migration creates `custom_field_defs` (id, col_name, label, type, options, show_on_new, display-order, quarantined_at, share_with_ai), `contact_custom_values` (one TEXT column per field), and `field_history`. *(infra)*
- [ ] **FLD-02**: A user can create a custom field (label, one of 7 types, dropdown options, show_on_new, always-show) from settings; creation runs INSERT def + ALTER TABLE ADD COLUMN in one transaction; `col_name` is whitelist-constructed and cannot collide with any fixed-column name.
- [ ] **FLD-03**: A user can rename (metadata-only RENAME COLUMN), reorder, and change the type/options of a custom field.
- [ ] **FLD-04**: Changing a field's type runs a pre-flight through the target parser (7 parsers total), auto-converts clean values, flags unconvertible ones as a tap-to-fix error state, destroys no data, and snapshots to `field_history` in the same transaction — with no extra confirmation prompt.
- [ ] **FLD-05**: Deleting a field is dynamic — immediate Delete when empty, else Quarantine (reversible ~30 days, data untouched); the launch sweep expires quarantined defs (DELETE def + DROP COLUMN in one transaction) and prunes `field_history` on the same schedule.
- [ ] **FLD-06**: Every custom-field sort/filter routes through the single `sortExpr()`; no custom value column is ever indexed or made UNIQUE. *(infra)*
- [ ] **FLD-07**: A field shows on a profile whenever it has a value (or always, if its always-show flag is on); the create form shows only `show_on_new` fields, the edit form shows every non-quarantined field.

### Contact CRUD & Lifecycle (CRUD)

- [ ] **CRUD-01**: A user can create a contact via a lean form (name, category, frequency incl. a custom "every N", "when did you last speak" defaulting to today with an explicit "not yet / don't know", phone) plus any `show_on_new` custom fields; a duplicate name warns but does not block.
- [ ] **CRUD-02**: A last-spoke date writes a contact row + one interaction row through the single-writer DAO in one transaction (`source='manual'`, `direction=null`); "not yet / don't know" writes no interaction row (never-contacted); a future date is rejected.
- [ ] **CRUD-03**: A user can edit a contact; the edit form always shows every non-quarantined field plus dedicated phone/email inputs, a links area, and the "Rarely responds" and reminders-off toggles.
- [ ] **CRUD-04**: A user can hold many links per contact in a `contact_links` child table (add/edit/remove, optional label, ordered), each tappable to open; phone and email stay single tappable columns.
- [ ] **CRUD-05**: A user can archive a contact from its profile (hidden everywhere, restorable); restore and purge live only on a dedicated Archived list (two-stage).
- [ ] **CRUD-06**: Purge shows an impact-summary confirmation and, in one transaction, deletes the contact plus its interactions, events, fuel, custom values, `contact_links`, the photo file, and scheduled notifications.

### Photos (PHOTO)

- [ ] **PHOTO-01**: A user can set a contact's (and their own) photo from the system photo library (no camera, no runtime permission) and frame it with an in-app Skia crop.
- [ ] **PHOTO-02**: A user can also set a photo by pasting a URL, which downloads once to the same local master.
- [ ] **PHOTO-03**: Each photo is stored as one 512×512 JPEG master under the persistent document dir (copied out of cache), referenced by a relative filename resolved to `file://` at read. *(infra)*
- [ ] **PHOTO-04**: A contact with no photo shows a deterministic initials avatar coloured from a themed swatch set (no free HSL, no hardcoded colour).
- [ ] **PHOTO-05**: Replacing/removing a photo deletes the old file inline (non-undoable); purge deletes contact and custom photo-field files.

### Interaction Log, Status & Impact (LOG)

- [ ] **LOG-01**: A user can log a touchpoint in one tap (instant log, all defaults) and optionally refine channel, direction, connected, quality, note, and date+time on the resulting row.
- [ ] **LOG-02**: A contact profile shows a full scrollable timeline of touchpoints and read-only, visually-distinct events, newest first; each touchpoint is editable and deletable in place, edits (incl. date/time) change status, and deletes are unrecoverable.
- [ ] **LOG-03**: The profile shows `gravity` (named tiers + bar) and `intensity` (neutral rate vs intended, plus the long-run cadence), both derived-never-stored and profile-only.
- [ ] **LOG-04**: A "Rarely responds" contact's `last_contact` is MAX over connected rows only; its label renders on the profile; a non-connecting attempt does not reset its orbit.
- [ ] **LOG-05**: A contact reaches `rogue` at a shared multiple-of-interval constant or via "Rarely responds"; `rogue` (with a `reason`) is surfaced in-app only, never notified.
- [ ] **LOG-06**: Same-day repeat taps insert distinct rows; a future `occurred_at` is rejected; times store as local wall-clock as written.

### Conversational Fuel (FUEL)

- [ ] **FUEL-01**: Migration creates the fuel table (uid, `contact_id` NOT NULL, kind, label, text, url, created_at, source, modified_at); a user can add/edit/delete fuel items on a contact's profile.
- [ ] **FUEL-02**: Fuel supports 5 kinds (`recent`/`topic`/`fact`/`gift`/`off_limits`) plus an optional free label; `off_limits` items are never transmitted and never glanceable.
- [ ] **FUEL-03**: One ranked projection (kind priority then recency, `off_limits` excluded in-query) drives the card preview, the notification line, and the widget line.
- [ ] **FUEL-04**: Fuel age renders as "N days/months ago" and drives ranking; nothing is destroyed or hidden by age.
- [ ] **FUEL-05**: A user can search across all contacts by name AND fuel text (LIKE, `off_limits` excluded).
- [ ] **FUEL-06**: AI-proposed fuel (`source='ai'`) renders as unconfirmed and is excluded from prompts until confirmed.

### Compose Screen & SMS Handoff (CMP)

- [ ] **CMP-01**: A compose screen shows a contact's full fuel and an editable message draft, with a Send control that hands off to the SMS composer and a Copy control that always works.
- [ ] **CMP-02**: The compose screen is reachable from the profile and (as later phases land) from a notification tap, the widget Message action, and AI Suggest; Back goes to the dashboard.
- [ ] **CMP-03**: The compose screen degrades gracefully when a contact has no phone number (Copy still works; an "add number" affordance appears).

### Dashboard & Never-Contacted Screen (DASH)

- [ ] **DASH-01**: The dashboard is the app's home screen: a flat list excluding never-contacted, archived, and currently-snoozed contacts, status-sorted by default with name / least-recent / most-recent options.
- [ ] **DASH-02**: A user can filter by needs-attention, category, social battery, favourites, and a snoozed segment, and search by name+fuel.
- [ ] **DASH-03**: Each card carries avatar (themed fallback), status ring (incl. the rogue visual), name, a required one-line fuel preview, a category label, and a favourite marker — nothing log-derived.
- [ ] **DASH-04**: A "Not yet contacted (N)" sibling screen that renders fuel and a count-less "Archived" entry are reachable from the dashboard; the snoozed segment shows a count.
- [ ] **DASH-05**: A 7-day birthday banner (soonest-first, tap→profile) shows for any non-archived contact — overriding snooze/never-contacted suppression — using the single birthday parser with the day-of-drop and Feb-29 bugs fixed.
- [ ] **DASH-06**: A user can mark a favourite via a profile star and order favourites by drag on a shared "Manage favourites" screen.
- [ ] **DASH-07**: The dashboard renders with no network and refreshes via focus + AppState-active + pull-to-refresh (not the change-listener), using async queries and `recyclingKey`, with cause-aware empty states.

### Compose consumers' shared surface — see CMP; and the Orrery (ORR)

- [ ] **ORR-01**: The orrery renders contacts as a Skia solar system — per-contact rings (radius = `ring_seq`/closeness), angle = interval progress, status colour + ring style, sun at centre; never-contacted excluded.
- [ ] **ORR-02**: Two views ship (status default, relationship) sharing the radius axis, differing in motion + colour, morphing on one canvas via a toggle.
- [ ] **ORR-03**: Bodies are placed by timestamp math on focus (no live body loop); tapping a planet opens the profile; an ambient starfield twinkle + sun pulse animate and pause on blur/background.
- [ ] **ORR-04**: `rogue` renders as maximum drift + a cold/extinguished body + a faint ring, on rails and tappable, using the single shared rogue constant.
- [ ] **ORR-05**: The self-sun colour is user-selectable from a themed star palette; a contact-occupied sun glows that contact's status; a sun-only orrery shows a gentle empty-state prompt.
- [ ] **ORR-06**: A user can set a contact's `ring_seq` by dragging its body and assign the sun from the orrery.

### Share-Sheet Capture (CAP)

- [ ] **CAP-01**: Orbit registers as an Android `text/plain` share target; sharing a link/text opens Orbit's in-app grid-of-faces picker (favourites → capture-MRU → rest, keyboard closed, includes never-contacted, excludes archived).
- [ ] **CAP-02**: Picking a contact writes the fuel row immediately (kind `topic`, `source='share'`) with an optional skippable note that edits display text while `url` stays canonical; single tap commits, long-press multi-selects; capture never marks a contact contacted.
- [ ] **CAP-03**: Shared links are labelled from `EXTRA_SUBJECT` (patched library) with a bare-URL fallback; a prose-with-URL share stores both.
- [ ] **CAP-04**: A user can inline-create a name-only contact during capture (lands never-contacted); after saving, a toast shows and Orbit returns to the source app.

### Actionable Notifications (NOTIF)

- [ ] **NOTIF-01**: Decay notifications are pre-scheduled dated local notifications with a generic body, reconciled on launch/foreground (cancel/replace on `decay:<contactId>`), delivered fuzzily with no exact-alarm permission at a fixed morning hour outside a quiet window, per-contact and staggered.
- [ ] **NOTIF-02**: A due notification carries two headless actions — mark-contacted and +fixed snooze (both double-wired background + foreground, writing through the DAO / events table) — and a body tap that opens the compose screen; Back → dashboard.
- [ ] **NOTIF-03**: No decay notification fires for never-contacted, snoozed, rogue, "Rarely responds", or muted contacts; a user can permanently mute (reminders-off) a contact that still appears and still decays.
- [ ] **NOTIF-04**: Birthday notifications fire day-of morning for any non-archived contact on their own channel (tap→profile), reusing the single birthday parser.
- [ ] **NOTIF-05**: `POST_NOTIFICATIONS` is requested at a value moment; settings expose a master toggle, per-type toggles, and lock-screen visibility (private-by-default second channel); denial degrades to in-app only.

### Home Screen Widget (WDG)

- [ ] **WDG-01**: A home-screen widget shows a favourites grid in static manual rank, each avatar carrying its status colour, photos as base64 — adding no new schema or persistent state.
- [ ] **WDG-02**: A small-tile tap is a headless mark-contacted (30s budget, DAO + mutex, `source='widget'`) with a name/chevron region opening the profile; the larger tile adds Quick mark · Log contact · Message (Message → the compose screen).
- [ ] **WDG-03**: Widget freshness is event-push + launch/boot refresh (no polling); an empty widget prompts "Choose favourites"; an in-app "Add widget" button uses `requestPinWidget` with graceful fallback; "Back → dashboard" is JS navigation.

### AI Message Suggestions (AI)

- [ ] **AI-01**: A user can configure a provider (OpenAI / Anthropic / Gemini, or an HTTPS-only custom endpoint) with keys in `expo-secure-store` (never exported) and models chosen by dynamic fetch with a free-text fallback.
- [ ] **AI-02**: "AI Suggest" on the compose screen and profile returns an editable draft (Copy guaranteed; Send hands to SMS); AI is free BYO-key with no entitlement gate and disabled by default.
- [ ] **AI-03**: The prompt is assembled from ranked fuel (minus `off_limits`), interaction aggregates only (no note text), gravity tier, intensity, quality, and only `share_with_ai`-flagged custom fields (bound to `col_name`, shown by label); the assembled prompt is shown before the first send per provider and is always inspectable.
- [ ] **AI-04**: `custom_field_defs.share_with_ai` (default false) has a per-field toggle in the field editor; the assembled-prompt debug log is redacted.

### Weekly Digest (DGST)

- [ ] **DGST-01**: A single native WEEKLY notification fires Sunday morning (generic body, survives reboot) and opens a live "your week" screen; it fires unconditionally with a calm empty state; defaults on, independently toggleable.
- [ ] **DGST-02**: The digest screen shows a retrospective ("reached this week" — all touchpoints in the window, no connected/direction predicate) and "the overlooked" (rogue + Rarely-responds gone-quiet + never-contacted backlog, mute ignored, archived excluded).
- [ ] **DGST-03**: The digest surfaces a gentle, non-judgemental line when recent quality marks skew "hard"; it adds no new schema.

### Backup, Export & Restore (BKP)

- [ ] **BKP-01**: A user can export full app state (all tables + non-secret settings + base64 photos; API keys and `field_history` excluded) as a single plaintext JSON file via the share sheet, stamped with `user_version` and a manifest header.
- [ ] **BKP-02**: An automatic rotating backup writes to a user-granted SAF folder on the launch sweep (~7 kept, once/day, only on change), with an overdue-backup nudge.
- [ ] **BKP-03**: A user can optionally encrypt exports with a passphrase (AES-256-GCM; auto-backups reuse a Keystore-cached passphrase); the unrecoverable-loss warning is shown at passphrase-set time.
- [ ] **BKP-04**: A user can restore via Merge (default, newest-`modified_at`-wins keyed on `uid`) or Replace-all; restore recreates custom columns from defs before values, recomputes `last_contact` (MAX), writes fresh photo files and repoints paths, re-registers schedules, migrates an older backup forward and rejects a newer one, and shows a preview with counts.

## v2 / Deferred Requirements

Tracked, not in the current roadmap. Reasons recorded in the dossier.

### Deferred

- **Typed `reach_methods` table** — richer than phone/email/links; a routine later migration (01-data).
- **FTS5 fuel search** — the SQLite build supports it; unneeded at this scale (03-fuel).
- **AI response variants / Regenerate, article summarisation at capture** — extra API calls / widened egress (13-ai, 03-fuel).
- **Widget self-swap-into-profile, per-instance widget config** — poor value/complexity vs a deep link (12-widget).
- **Direct Share targets, capture inbox, `ACTION_PROCESS_TEXT`/clipboard capture** — native cost / privacy / not retrofittable-friendly (10-capture).
- **CSV export** — a second, lossy format (15-backup).
- **User-set notification hour, snooze presets tuning, escalating re-nag** — settings surface deferred (11-notify).
- **Monetisation / IAP entitlement around AI** — BYO-key means it can be added later without rework (13-ai, HANDOFF Q1).
- **Gravity on the orrery (body size / ring weight)** — considered, left un-encoded in v1 (04-log, 09-orrery).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Any backend / cloud sync in v1 | Local-first is the product commitment; sync would be an opt-in layer over a working local DB, never the reverse (HANDOFF §3) |
| Supabase / agent-controlled DB experiment | Moved to the Mise project; all Orbit data is sensitive (HANDOFF §3, §11) |
| Obsidian vault *data* importer | Cut by owner; app starts clean. *Code* porting is untouched (04-log) |
| iOS | Deferred, not cancelled (HANDOFF §11) |
| End-to-end encryption | Moot for a local-only DB (HANDOFF §11) |
| Images as fuel / `image/*` intent filter | Text and links only in v1 (03-fuel) |
| Ollama / any local AI on mobile; `http://` LAN endpoint | No zero-egress mode; would reopen the rejected LAN path + force app-wide cleartext (03-fuel, 13-ai) |
| `READ_CONTACTS`, in-app camera, `SCHEDULE_EXACT_ALARM` | Declined on the "asks for almost nothing" privacy posture (01-data, 07-photos, 11-notify) |
| Per-notification contact photo (large icon) | Needs a bare-workflow native module; cosmetic (07-photos, 11-notify) |
| Streaks / gamified counts | Manufacture obligation, corrupt the log; against §1 (04-log) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01…06 | Phase 1 | Pending |
| DATA-01…07 | Phase 2 | Pending |
| FLD-01…07 | Phase 3 | Pending |
| CRUD-01…06 | Phase 4 | Pending |
| PHOTO-01…05 | Phase 5 | Pending |
| LOG-01…06 | Phase 6 | Pending |
| FUEL-01…06 | Phase 7 | Pending |
| DASH-01…07 | Phase 8 | Pending |
| CMP-01…03 | Phase 9 | Pending |
| CAP-01…04 | Phase 10 | Pending |
| NOTIF-01…05 | Phase 11 | Pending |
| WDG-01…03 | Phase 12 | Pending |
| ORR-01…06 | Phase 13 | Pending |
| AI-01…04 | Phase 14 | Pending |
| DGST-01…03 | Phase 15 | Pending |
| BKP-01…04 | Phase 16 | Pending |

**Coverage:**

- v1 requirements: 82 total
- Mapped to phases: 82
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-14*
*Last updated: 2026-08-14 after initialization*
