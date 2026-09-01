# System Docs

This directory contains living documentation for each major subsystem in the codebase.
Read the relevant system doc *before* making changes to that subsystem.

## Conventions

- **Living documents.** Updated whenever a phase modifies the system.
- **One doc per logical subsystem**, not per phase or per store. In orbit the state
  management stores (`src/stores/`) are thin UI-preference holders; the real subsystem
  boundaries are drawn by the **DAOs in `src/db/` and the logic in `src/services/`**, so
  the "Owning code" column names those, not stores.
- **This table is the routing authority** the `extract-phase-kb` skill uses to decide
  which doc a phase's changes belong to. Route by the owning code that shares a table.

| Subsystem | File | Owning code (`src/`) | Anchor phase(s) |
|-----------|------|----------------------|-----------------|
| Persistence core | `persistence-core.md` | `db/database.ts`, `db/migrations/`, `db/transaction.ts`, `db/mutex.ts`, `db/uid.ts`, `db/queries.ts` | 02 |
| App shell | `app-shell.md` | `navigation/RootNavigator.tsx`, `navigation/types.ts`, `screens/SettingsScreen.tsx`, `theme/` | 04 |
| Contacts | `contacts.md` | `db/contacts-dao.ts`, `db/contact-read.ts`, `db/contact-lifecycle-dao.ts`, `db/profile-dao.ts`, `db/favourites-dao.ts`, `db/recency-dao.ts`, `db/purge-dao.ts`, `db/tombstones-dao.ts` | 02, 04 |
| Status engine | `status-engine.md` | `db/status.ts`, `services/gravity-logic.ts`, `services/intensity-logic.ts`, `db/contact-status-read.ts` | 02 |
| Contact methods | `contact-methods.md` | `db/contact-methods-dao.ts`, `db/contact-methods-read.ts`, `db/contact-links-dao.ts`; compose/SMS handoff (`screens/ComposeScreen.tsx`) | 18, 18.1, 18.2, 09 |
| Custom fields | `custom-fields.md` | `db/field-defs-dao.ts`, `db/field-values-dao.ts`, `db/field-ddl.ts`, `db/field-parsers.ts`, `db/field-sort.ts`, `db/field-type-change.ts`, `db/col-name.ts` | 03, 16 |
| Interaction log | `interaction-log.md` | `db/events-dao.ts`, `services/impact.ts`, `db/impact-read.ts`, `db/timeline-read.ts`, `db/log-guards.ts` | 06 |
| Conversational fuel | `conversational-fuel.md` | `db/fuel-dao.ts`, `db/fuel-read.ts`, `services/fuel-age.ts`, `services/fuel-ranking.ts` | 07 |
| Photos | `photos.md` | `db/photo-dao.ts`, `db/photo-relative-path.ts`, `services/photos/` | 05 |
| Dashboard | `dashboard.md` | `db/dashboard-read.ts`, `screens/dashboard-search-row-logic.ts` | 08 |
| Orrery | `orrery.md` | `db/orrery-read.ts`, `db/ring-seq-dao.ts`, `db/sun-picker-read.ts` | 13 |
| Capture | `capture.md` | `db/capture-dao.ts`, `db/capture-read.ts` | 10 |
| Notifications | `notifications.md` | `db/notification-read.ts`, `db/snooze-dao.ts`, `services/notifications/` | 11 |
| Widget | `widget.md` | `services/widget/` | 12 |
| AI suggestions | `ai-suggestions.md` | `services/AiService.ts`, `services/ai-key-store.ts`, `db/ai-context-read.ts`, `stores/ai-model-prefs-store.ts` (sole network path) | 14 |
| Digest | `digest.md` | `db/digest-read.ts` | 15 |
| Backup & restore | `backup-restore.md` | `services/backup/`, `services/backup-sweep.ts`, `db/restore-photo-journal-dao.ts`, `db/app-settings-dao.ts`, `db/data-revision-dao.ts` | 17 |
| Contact import | `contact-import.md` | `db/imported-contact-dao.ts`, `db/import-session-dao.ts`, `db/import-session-read.ts`, `db/unbound-read.ts`, `services/import/` | 19 |
| Contact reconciliation | `contact-reconciliation.md` | merge/dedupe logic + `screens/DuplicateReviewScreen.tsx` (exact DAOs to confirm when authored) | 20 |

**Open routing note — assist / "reach out" (phase 21):** in-flight at the time this map was
drawn. Its home is decided when phase 21 is extracted (likely folds into `contact-methods`
as the reach-out surface; may also touch `status-engine` / `ai-suggestions`). Not pre-boxed.

**Owning-code lists are the initial routing guide**, derived from the DAO/service layout.
Refine a row when its subsystem doc is first authored during extraction and the real file
set is confirmed — per "review the code, not the diff." Some files legitimately span two
subsystems (e.g. `data-revision-dao` is written by backup and read by reconciliation);
that cross-cutting shows up as the same ADR appearing in both docs' Decisions sections.

- Write in **present tense** ("the DAO fetches…" not "the DAO was designed to…").
- Keep an **append-only Changelog** at the bottom so the system's evolution is visible.

## Template

`.planning/knowledgebase/templates/system-doc-template.md`

## Generation

System docs are created or updated by the `extract-phase-kb` skill when a phase touches a
subsystem. New subsystems get a new doc; existing ones get appended to. Structural splits
of an oversized doc are handled by the `split-system-doc` skill.
