# Categories

**Last updated:** 2026-10-18
**Updated by phase:** 38.12-lifecycle-import-settings-ux
**Owners:** `src/db/categories-dao.ts`, `src/logic/category-logic.ts`, `src/screens/CategoryManagementScreen.tsx`

## Purpose

Categories are Orbit's single, user-managed grouping axis for contacts. They remain local-only, allow zero real rows, and supply stable identity to contacts, Dashboard filters, Profile presentation, Orrery Systems, imports, and portable backup without becoming tags or multi-category membership.

## Architecture

### Data Model

- `categories` owns a device-local integer `id`, portable `uid`, visible `name`, contiguous `display_order`, and timestamps.
- `contacts.category_id`, `import_sessions.batch_category_id`, and `profile_category_presentation.category_id` use local IDs.
- `system_rules.value`, `category:<uid>` System references, backup category relationships, and category tombstones use stable UIDs/references.
- Display, local search, import matching, Profile, AI context, and knowledge search may read the visible name. Names are never durable relationship identity.
- Uncategorized is `NULL`, not a category row. It cannot be renamed, reordered, deleted, or used for Profile category presentation.

Migration 001 alone seeds the original four rows on a new database. They become ordinary user-managed rows after creation. No launch, restore, or runtime CRUD path reseeds them; an upgraded or restored database with zero categories stays at zero. Phase 37.1 changes no SQLite schema (`TARGET_VERSION` remains 29).

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Validation/model | `src/logic/category-logic.ts` | Trim/NFC/case-insensitive name rules, canonical ordering, 12/13 search threshold, optional Uncategorized row, and stale-ID resolution. |
| DAO | `src/db/categories-dao.ts` | Canonical list/create/rename/reorder, deletion preview fingerprint, atomic fallout, tombstone, and one revision bump. |
| Manager | `src/screens/CategoryManagementScreen.tsx` | Add, rename, reorder (drag handle, or Move up/down in the row ⋯), and a one-step delete confirm with committed-state refresh. It is the reference for the shared management-list pattern (ADR-246). |
| Shared chooser | `src/components/category/CategoryChoiceSheet.tsx` | Complete bounded category selection at every catalog size; a thin wrapper over the app-wide `OptionSheet` that shows search at 13 or more rows. |
| Shell refresh | `src/stores/shell-refresh-store.ts` | Publishes committed taxonomy changes to mounted consumers. |

### Identity and Consumer Matrix

| Family | Identity | Contract |
|---|---|---|
| Contact/import writes | local ID | Create, Edit, bulk import, and import review re-read the ordered catalog immediately before writing; a stale selection becomes Uncategorized. |
| Dashboard | local ID + `uncategorized` sentinel | Positive decimal IDs are the only real-category filter tokens. Bulk writes revalidate targets; shell refresh removes deleted filters. |
| Profile presentation | local ID, portable UID | Managers show only real categories in a complete bounded chooser. Rename preserves assignment; delete removes that category assignment so inheritance continues. |
| Category/custom Systems | UID/ref | Category bases and category rules survive rename. Runtime deletion removes only the affected rule; unrelated historically missing rules remain diagnostic evidence. |
| Backup/restore | UID + tombstone | Format 6 carries category rows, relationships, and category deletion evidence. Merge tombstones suppress older dependents; Replace-all reproduces the exact incoming taxonomy, including zero. |
| Labels/search/AI | name | Display-only joins and local matching may use names. AI receives only the explicitly permitted category label through its narrow projection. |

`MergeConflictsScreen` is the one audited pre-existing screen-local SQL exception for category labels. It is classified here rather than silently treated as a new DAO boundary.

## How It Works

### Creating, renaming, and ordering

1. The manager reads `listCategoriesForManagement()` in canonical `display_order, uid` order.
2. Create and rename normalize with trim + NFC, reject blank/control/over-100-character values, and reject locale-independent case collisions with categories, built-ins, and custom Systems. Capitalization-only rename of the same row remains legal.
3. Create appends at the next order. Reorder submits the complete current ID set; the DAO rejects missing, stale, or duplicate IDs before updating contiguous positions.
4. A successful transaction bumps `data_revision` once. Only then does the manager publish shell refresh and replace optimistic/draft state with committed readback.

### Deleting with complete fallout

1. The manager asks `readCategoryDeletionPreview()` for the source row, every survivor target, and aggregate counts for contacts, pending/complete/discarded imports, rules, System customization, active selection, Profile presentation, and Dashboard filters.
2. The preview serializes those facts into a fingerprint. Final confirmation supplies that fingerprint and either one surviving category ID or `NULL` for Uncategorized.
2a. Delete is one non-dismissable destructive `ConfirmDialog` (ADR-246): plain counts ("2 people move to Uncategorized"), the Move-to chooser, the detail behind a Show details toggle, and one Cancel; an empty category gets a one-line body. Back stays inert on it (38.9 D-06).
3. Under the shared writer lock, `deleteCategory()` re-reads the preview. Any changed fallout, removed source, or stale target returns a refreshed preview with zero writes.
4. The committed transaction reassigns contacts and **every import-session status** to the same target, removes only rules referencing the deleted UID, removes the category System's overrides/preferences, falls an active selection back to All Contacts, removes Dashboard/Profile references, normalizes order, writes a category tombstone, and deletes the parent row last.
5. Custom Systems keep unrelated rules and explicit includes. A definition with no positive rule/include becomes Needs Attention; historical missing-category rules unrelated to this proven deletion remain visible diagnostics.

### Selecting categories

Every consumer opens the shared category sheet (`CategoryChoiceSheet` over `OptionSheet`, opened from an `OptionSelectRow`) at every catalog size; search appears at 13+ (ADR-204). No native picker remains. Search filters only visible rows; it never truncates the catalog or clears a hidden selection. System Builder always exposes the complete UID-backed category set. Profile assignment is real-category-only; contact, import, and Dashboard policies may explicitly include Uncategorized.

### Backup and restore

Backup format 6 exports category tombstones alongside stable-UID rows and dependent references. Merge applies a winning category tombstone to the category and only its proven dependents, using Uncategorized rather than inventing a reassignment target. Replace-all removes destination-only categories through the same fallout core, restores exactly the incoming ordered taxonomy, clears tombstones for live restored categories, and never reseeds defaults.

## Configuration

| Constant | Value | File | Purpose |
|---|---:|---|---|
| `CATEGORY_SEARCH_THRESHOLD` | 12 | `src/logic/category-logic.ts` | Search shows in the category sheet at 13+ rows; it no longer switches native versus themed (ADR-204). |
| `BACKUP_FORMAT_VERSION` | 6 | `src/backup/types.ts` | Carries category tombstones. |
| `TARGET_VERSION` | 29 | `src/db/database.ts` | Category management adds no migration. |

## Decisions

- Phase 37.1 owner-approved dossier — single-category membership, zero-category validity, stable identity, dynamic deletion, complete selectors, and exact restore.
- **ADR-142:** User-Owned Categories with Stable Identity and Canonical Ordering — makes Categories a mutable, ordered, UID-safe user taxonomy.
- **ADR-143:** Lock-Time-Revalidated Atomic Category Deletion and System Fallout — requires previewed, parent-last, revision-once deletion with complete local repair.
- **ADR-144:** Complete Category Selection and Grouped Orrery System Discovery — defines complete local selection and the constrained Orrery selector grouping. *Partially superseded by ADR-204:* the native picker through 12 categories is gone.
- **ADR-204:** One Themed Option Sheet Replaces Every Native Picker; Native Date and Time Pickers Stay — category choice uses the themed sheet at every size; the threshold now controls only search.
- **ADR-145:** Category-Aware Portable Backup Format v6 and Exact Taxonomy Restore — adds deletion evidence and exact portable taxonomy restoration.
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — category deletion evidence uses the existing generic mechanism.
- **ADR-057/058:** Versioned atomic backup and restore — category rows and dependents are validated before mutation and applied transactionally.
- **ADR-104:** Durable Orrery Preferences and Live System Scope — Category Systems use stable UID references.
- **ADR-108:** Durable Independent-Axis Profile Presentation — category presentation is inherited and may fall through after deletion.
- **ADR-246:** One Settings Row and Section Card, One Drag-and-⋯ List Pattern — Categories is the reference list; delete is one confirm with plain counts.

## Gotchas

1. Never use a category name as durable identity. Rename must preserve every local and portable relationship.
2. Never reseed outside migration 001. Zero categories is valid user state.
3. Deletion targets all `import_sessions` statuses, not only pending sessions.
4. Do not erase unrelated malformed System rules while cleaning a proven deleted category.
5. Final category deletion is parent-last and revision-once. Compose transaction-owned cores; do not nest public writers.
6. A category tombstone is merge evidence, not Undo or a user-facing trash bin.
7. Search and scrolling may bound rendering, never the accessible catalog.
8. Category values and diagnostic names remain local; deletion UI and errors expose aggregate counts only.
9. **A chooser must not exclude by an optional id without guarding `undefined`.** `CategoryChoiceSheet` used to compare `undefined !== undefined` in its uid exclusion, which dropped every category without an internal id, so bulk Contacts → Set Category offered only Uncategorized. Fixed in 38.4 (D-72); the fix covers every chooser that uses the sheet.

## Related Systems

- **Contacts and import** — store local category IDs and revalidate mutable selections.
- **Dashboard** — persists a closed local filter grammar and bulk assignment.
- **Profile presentation** — inherits category-scoped layout/background assignments.
- **Orrery** — derives Category Systems and UID-backed custom rules.
- **Backup & restore** — carries portable UIDs and category tombstones in format 6.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-09-17 | 37.1 | Documented the canonical mutable taxonomy, identity matrix, atomic all-status deletion fallout, complete selectors, tombstone merge, and exact replace-all contracts. |
| 2026-09-23 | 38.4 | `CategoryChoiceSheet` lists every category again: its uid exclusion no longer drops categories without an internal id (D-72; pre-existing since 37.1). |
| 2026-10-11 | 38.9 | Category choice uses the themed sheet at every catalog size (`CategoryChoiceSheet` wraps the app-wide `OptionSheet`); the native picker below 13 is gone and `CATEGORY_SEARCH_THRESHOLD` controls only search (ADR-204, partially superseding ADR-144). |
| 2026-10-18 | 38.12 | Category delete is one destructive confirm with plain counts and details behind a toggle (an in-use category no longer takes two Keep taps to back out); Categories is the reference for the shared drag + ⋯ list (ADR-246). |
