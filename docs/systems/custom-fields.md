# Custom Fields

**Last updated:** 2026-08-14
**Updated by phase:** 04-contact-crud-lifecycle
**Owners:** `src/db/field-defs-dao.ts`, `src/db/field-values-dao.ts`, `src/db/field-ddl.ts`, `src/db/field-type-change.ts`, `src/db/field-parsers.ts`, `src/db/field-sort.ts`, `src/services/field-sweep.ts`

## Purpose

The custom-fields system lets a user define fields that appear beside Orbit's fixed contact data. It keeps each field queryable in on-device SQLite while preserving data through type changes and a reversible quarantine period; there is no backend or remote repair path.

## Architecture

### Data Model

Migration 001 provides the three base tables. A custom field is both a row in `custom_field_defs` and a dynamically added `TEXT` column in `contact_custom_values`; field type determines interpretation and widget selection, never SQLite column affinity.

**Tables:**
- `custom_field_defs` — field definitions and presentation metadata.
  - `id` (`INTEGER`) — local primary key.
  - `uid` (`TEXT`) — durable unique identity for the definition.
  - `col_name` (`TEXT`) — stable internal SQL identifier, unique across definitions.
  - `label` (`TEXT`) — user-visible field name; renaming leaves `col_name` unchanged.
  - `type` (`TEXT`) — one of text, textarea, dropdown, date, toggle, number, or photo.
  - `options` (`TEXT`) — dropdown options stored as JSON when relevant.
  - `show_on_new` / `always_show` (`INTEGER`) — curation flags for the create form and profile.
  - `display_order` (`INTEGER`) — ordered position in forms and the editor.
  - `quarantined_at` (`TEXT`) — local timestamp for reversible deletion.
  - `share_with_ai` (`INTEGER`) — stored flag; its editor control is deferred to the AI phase.
- `contact_custom_values` — one row per contact containing dynamically added value columns.
  - `contact_id` (`INTEGER`) — primary key and contact foreign key.
  - `uid` (`TEXT`) — row identity, created once per contact and retained by later value writes.
  - `modified_at` (`TEXT`) — local timestamp updated for every value write.
  - dynamic custom-field columns (`TEXT`) — values for the matching definition `col_name`; never indexed or `UNIQUE`.
- `field_history` — recovery/audit snapshot rows for destructive field operations.
  - `contact_id` (`INTEGER`) — contact owning the former value.
  - `field_col_name` (`TEXT`) — stable internal field identifier.
  - `old_value` (`TEXT`) — stored value before a drop or type change.
  - `operation` (`TEXT`) — operation and type transition where applicable.
  - `created_at` (`TEXT`) — local snapshot timestamp.

**Types** (`src/db/field-types.ts`):
- `CustomFieldDef` — durable definition row consumed by data and UI layers.
- `NewFieldDef` — complete create payload, including generated identity and timestamps.
- `FieldType` — exhaustive seven-type union used by parsers and widgets.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Identifier boundary | `src/db/col-name.ts` | Slugifies labels and validates safe dynamic column names. |
| Schema guard | `src/db/reserved-columns.ts` | Reserves fixed columns and SQLite row-id aliases from collision. |
| Definition DAO | `src/db/field-defs-dao.ts` | Lists, curates, renames, reorders, quarantines, and restores definitions. |
| DDL DAO | `src/db/field-ddl.ts` | Creates and drops dynamic `TEXT` value columns transactionally. |
| Value DAO | `src/db/field-values-dao.ts` | Reads values and exposes public and transaction-composable UPSERT paths. |
| Type layer | `src/db/field-parsers.ts` | Validates values at read time and checks dropdown membership. |
| Type-change layer | `src/db/field-type-change.ts` | Preflights and applies lossless type changes. |
| Query helper | `src/db/field-sort.ts` | Produces the sole safe sort/filter expression for a custom field. |
| Launch service | `src/services/field-sweep.ts` | Expires quarantined fields and prunes old history at launch. |
| UI | `src/components/FieldDefForm.tsx` | Captures definition create/edit input and renders a type preview. |
| UI | `src/screens/CustomFieldsScreen.tsx` | Coordinates definition management and preflight summaries. |

### Key Files

| File | Role |
|---|---|
| `src/db/field-types.ts` | Shared custom-field definitions and type union. |
| `src/db/col-name.ts` | The single whitelist-construction and validation chokepoint. |
| `src/db/reserved-columns.ts` | Fixed-column collision protection, drift-tested against the schema. |
| `src/db/transaction.ts` | Shared non-reentrant transaction boundary for all custom-field writes. |
| `src/db/field-ddl.ts` | Atomic create/drop and stale-quarantine recheck. |
| `src/db/field-defs-dao.ts` | Definition reads and serialized metadata mutations. |
| `src/db/field-values-dao.ts` | Guarded dynamic SELECT, standalone writer, and non-mutexed `upsertValueCore()` for composed contact writes. |
| `src/db/field-parsers.ts` | Seven permissive target parsers and option validation. |
| `src/db/field-sort.ts` | TEXT-aware numeric, toggle, date, and text ordering expression. |
| `src/db/field-type-change.ts` | Read-only preflights plus history-backed type update. |
| `src/services/field-sweep.ts` | Fixed-window quarantine expiry and history retention hook. |
| `src/components/FieldValueInput.tsx` | Single field-type-to-widget dispatcher. |
| `src/components/CustomFieldValue.tsx` | Display and tap-to-fix gate for invalid values. |
| `src/components/FieldDefForm.tsx` | Definition editor and live type preview. |
| `src/screens/CustomFieldsScreen.tsx` | Reachable custom-field management surface. |

## How It Works

### Creating and editing a definition

1. The user opens Custom Fields from the temporary Home-screen route and creates or edits a definition.
2. `FieldDefForm` derives a label slug from the full definition list, including quarantined definitions, then assigns the definition UID, display order, and local timestamps.
3. `createField()` inserts the definition and runs `ALTER TABLE contact_custom_values ADD COLUMN` in one shared transaction. A failed DDL statement rolls back the definition insert.
4. Rename changes only the visible label; curation, option, order, quarantine, and restore changes each serialize through the same write boundary.

### Reading and writing contact values

1. A contact surface loads active definitions and calls `getValuesForContact()` with them. Create renders `show_on_new` definitions after its fixed block; edit renders every non-quarantined definition.
2. The value DAO validates every `col_name`, quotes only those identifiers, binds contact and value parameters, and returns an empty map when no value row exists.
3. `upsertValue()` creates or updates the one row keyed by `contact_id`, retaining its per-contact `uid` and refreshing `modified_at`. A contact create/edit that already owns the shared transaction calls `upsertValueCore()` instead.
4. Pure selectors expose non-quarantined fields: create uses `show_on_new`, edit uses all fields, and profile uses a present value or `always_show`.

### Interpreting values and changing a type

1. `FieldValueInput` dispatches to one controlled widget for the definition type; all widgets emit TEXT-compatible values.
2. Parsers validate and canonicalize clean values only at read time. `CustomFieldValue` presents a tap-to-fix affordance when a parser fails or a dropdown value is no longer in its options.
3. Before a type or dropdown-option edit, the screen runs a read-only preflight and displays the clean-versus-flagged summary.
4. Applying a type change snapshots non-null values to `field_history` and updates the definition type in one transaction. It never rewrites `contact_custom_values` bytes.

### Quarantining and permanently removing a field

1. The editor checks whether a field has values: empty fields delete immediately; populated fields receive `quarantined_at` and keep their data intact.
2. On app launch, the registered sweep identifies definitions older than the fixed retention window.
3. For each candidate, `expireFieldIfStale()` reacquires the serialized transaction, rechecks staleness, snapshots values, deletes the definition, and drops the dynamic column.
4. The same launch hook prunes old history rows in a separate serialized transaction.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `QUARANTINE_WINDOW_DAYS` | `30` | `src/services/field-sweep.ts` | Fixed quarantine and field-history retention window. |

## Decisions

- **ADR-013:** Runtime Two-Table Custom Fields with Whitelist-Constructed DDL — definitions map to guarded, dynamic TEXT columns.
- **ADR-014:** Read-Time Custom-Field Type Semantics and a Single Sort Expression — type interpretation and ordering remain centralized without value rewrites.
- **ADR-015:** Lossless Field Changes with Quarantine and Launch-Time Retention Sweep — destructive operations snapshot first and retire data on launch.
- **ADR-016:** Fixed-First Contact Forms and Atomic Contact Creation — custom values join the contact create/edit transaction through a non-mutexed core.

## Gotchas

1. **Never use an arbitrary identifier in dynamic SQL.** `col_name` must come from `makeColName()` and be revalidated at each interpolation boundary; binding parameters cannot protect SQL identifiers.
2. **Do not add an index or `UNIQUE` constraint to a dynamic value column.** SQLite then rejects the required `DROP COLUMN` at quarantine expiry.
3. **Do not nest `inWriteTransaction()`.** The shared mutex is non-reentrant; use a non-mutexed operation core when composing an atomic destructive operation.
4. **Type changes do not normalize stored bytes.** A value can render clean through a permissive parser while raw CAST sorting disagrees for noncanonical TEXT such as comma-formatted numbers; resolve that mismatch before a production sort consumer is wired.
5. **The field editor applies a multi-part edit incrementally.** Label and curation writes can remain committed if the user cancels a subsequent type-change summary or a later operation fails.
6. **The photo input is a deliberate placeholder.** The native photo picker and `share_with_ai` editor control are deferred to their owning phases.
7. **Do not create definitions from a contact form.** The form fills values only, preserving the settings editor as the sole DDL and slugifier producer.

## Related Systems

- **Persistence core** — supplies migration-1 tables, the shared transaction, and the launch-sweep registry.
- **Contacts** — owns the contacts that receive one `contact_custom_values` row each.
- **AI suggestions** — will later consume the stored `share_with_ai` setting.
- **Photos** — will later provide the native picker for photo-type field values.
- **App shell** — routes the definition editor through Settings.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-14 | 03 | Created runtime custom-field DDL, type semantics, editor, and launch-time quarantine cleanup. |
| 2026-08-14 | 04 | Added the transaction-composable value writer and fixed-first contact-form integration. |
