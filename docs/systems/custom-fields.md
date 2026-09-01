# Custom Fields

**Last updated:** 2026-08-24
**Updated by phase:** 16-custom-field-value-normalization
**Owners:** `src/db/field-defs-dao.ts`, `src/db/field-values-dao.ts`, `src/db/field-ddl.ts`, `src/db/field-type-change.ts`, `src/db/field-parsers.ts`, `src/db/field-sort.ts`, `src/services/field-sweep.ts`

## Purpose

The custom-fields system lets a user define fields that appear beside Orbit's fixed contact data. It keeps each field queryable in on-device SQLite while preserving data through type changes and a reversible quarantine period; there is no backend or remote repair path.

## Architecture

### Data Model

Migration 006 stores current values as normalized rows. Field type determines interpretation and widget selection, never SQLite column affinity; `col_name` remains immutable compatibility metadata for history and custom-photo filenames, not SQL syntax.

**Tables:**
- `custom_field_defs` — field definitions and presentation metadata.
  - `id` (`INTEGER`) — local primary key.
  - `uid` (`TEXT`) — durable unique identity for the definition.
  - `col_name` (`TEXT`) — stable compatibility key, unique across definitions.
  - `label` (`TEXT`) — user-visible field name; renaming leaves `col_name` unchanged.
  - `type` (`TEXT`) — one of text, textarea, dropdown, date, toggle, number, or photo.
  - `options` (`TEXT`) — dropdown options stored as JSON when relevant.
  - `show_on_new` / `always_show` (`INTEGER`) — curation flags for the create form and profile.
  - `display_order` (`INTEGER`) — ordered position in forms and the editor.
  - `quarantined_at` (`TEXT`) — local timestamp for reversible deletion.
  - `share_with_ai` (`INTEGER`) — default-off definition-level consent flag for AI prompt context; it is not a value-row field.
- `custom_field_values` — one current-state row for each contact-and-definition pair.
  - `id` (`INTEGER`) — local primary key.
  - `uid` (`TEXT`) — immutable globally unique value identity.
  - `contact_id` / `field_def_id` (`INTEGER`) — foreign-key pair with `UNIQUE(contact_id, field_def_id)`.
  - `value` (`TEXT`, nullable) — raw stored value; `NULL` and empty text retain distinct meaning.
  - `created_at` / `modified_at` (`TEXT`) — immutable creation and latest-write timestamps.
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
| Compatibility boundary | `src/db/col-name.ts` | Slugifies labels and validates the immutable compatibility key. |
| Schema guard | `src/db/reserved-columns.ts` | Reserves fixed columns and SQLite row-id aliases from collision. |
| Definition DAO | `src/db/field-defs-dao.ts` | Lists, curates, renames, reorders, updates AI sharing, quarantines, and restores definitions. |
| Lifecycle DAO | `src/db/field-ddl.ts` | Seeds, snapshots, and removes normalized value rows transactionally. |
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
| `src/db/field-ddl.ts` | Atomic normalized-pair lifecycle and stale-quarantine recheck. |
| `src/db/field-defs-dao.ts` | Definition reads and serialized metadata mutations. |
| `src/db/field-values-dao.ts` | Defs-filtered normalized reads plus standalone and composable pair UPSERTs. |
| `src/db/field-parsers.ts` | Seven permissive target parsers and option validation. |
| `src/db/field-sort.ts` | TEXT-aware numeric, toggle, date, and text ordering expression. |
| `src/db/field-type-change.ts` | Read-only preflights plus history-backed type update. |
| `src/services/field-sweep.ts` | Fixed-window quarantine expiry and history retention hook. |
| `src/components/FieldValueInput.tsx` | Single field-type-to-widget dispatcher. |
| `src/components/field-widgets/PhotoFieldWidget.tsx` | Edit-only custom-photo UI that reuses the shared photo picker and crop pipeline. |
| `src/components/CustomFieldValue.tsx` | Display and tap-to-fix gate for invalid values. |
| `src/components/FieldDefForm.tsx` | Definition editor and live type preview. |
| `src/components/field-def-form-logic.ts` | Hydrates and serializes the default-off AI sharing draft value. |
| `src/screens/CustomFieldsScreen.tsx` | Reachable custom-field management surface. |

## How It Works

### Creating and editing a definition

1. The user opens Custom Fields from Settings and creates or edits a definition.
2. `FieldDefForm` derives a label slug from the full definition list, including quarantined definitions, then assigns the definition UID, display order, and local timestamps.
3. `createField()` inserts the definition and seeds a blank pair row for every contact in one shared transaction.
4. Rename changes only the visible label; curation, option, order, AI sharing, quarantine, and restore changes each serialize through the same write boundary.

### Choosing AI-sharing consent

1. The definition form initializes `share_with_ai` to off for a new field and hydrates its stored value for an edit.
2. The explicit “Share with AI suggestions” control changes only definition metadata through `updateFieldShareWithAi()`; it does not read or rewrite any contact value.
3. The AI context reader can use only live, non-quarantined definitions with the flag set, addressing values through a defs-filtered compatibility map while showing the label.
4. An unshared, null, blank, dropped, or quarantined field contributes no fallback data to an AI prompt.

### Reading and writing contact values

1. A contact surface loads active definitions and calls `getValuesForContact()` with them. Create renders `show_on_new` definitions after its fixed block; edit renders every non-quarantined definition.
2. The value DAO joins literal normalized tables, binds runtime values, and returns a `col_name`-keyed map only for definitions supplied by the caller.
3. `upsertValue()` writes by `(contact_id, field_def_id)`, retaining a pair row's `uid` and `created_at` on update. A clear writes `NULL` to the same row; a contact create/edit that owns the shared transaction calls `upsertValueCore()` instead.
4. Pure selectors expose non-quarantined fields: create uses `show_on_new`, edit uses all fields, and profile uses a present value or `always_show`.

### Interpreting values and changing a type

1. `FieldValueInput` dispatches to one controlled widget for the definition type; all widgets emit TEXT-compatible values.
2. Parsers validate and canonicalize clean values only at read time. `CustomFieldValue` presents a tap-to-fix affordance when a parser fails or a dropdown value is no longer in its options.
3. Before a type or dropdown-option edit, the screen runs a read-only preflight and displays the clean-versus-flagged summary.
4. Applying a type change snapshots non-null values to `field_history` and updates definition metadata in one transaction. It never rewrites normalized value bytes or identities.

### Capturing a custom photo value

1. On an existing contact, the `photo` widget derives a stable custom-field filename from the contact id and guarded `col_name`, then opens the shared photo source picker.
2. Crop success crosses back through a serializable request id; the widget stages the resulting local file and writes its relative path into the edit form value.
3. The pair-keyed UPSERT persists that `TEXT` path on form save. A teardown reconciliation removes staged files not referenced by committed values.
4. The create form and definition preview have no stable contact id, so custom photo input remains disabled there.

### Quarantining and permanently removing a field

1. The editor checks whether a field has values: empty fields delete immediately; populated fields receive `quarantined_at` and keep their data intact.
2. On app launch, the registered sweep identifies definitions older than the fixed retention window.
3. For each candidate, `expireFieldIfStale()` reacquires the serialized transaction, rechecks staleness, snapshots values, and deletes dependent pairs with the definition.
4. The same launch hook prunes old history rows in a separate serialized transaction.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `QUARANTINE_WINDOW_DAYS` | `30` | `src/services/field-sweep.ts` | Fixed quarantine and field-history retention window. |

## Decisions

- **ADR-001:** Normalized Custom-Field Values — replaces dynamic columns with uid-bearing current-state pairs and atomic migration 006.
- **ADR-013:** Runtime Two-Table Custom Fields with Whitelist-Constructed DDL — superseded by ADR-001.
- **ADR-014:** Read-Time Custom-Field Type Semantics and a Single Sort Expression — partially superseded; parser and raw-TEXT contracts remain while sorting uses a static normalized expression.
- **ADR-015:** Lossless Field Changes with Quarantine and Launch-Time Retention Sweep — partially superseded; its recovery lifecycle remains on normalized pairs.
- **ADR-016:** Fixed-First Contact Forms and Atomic Contact Creation — custom values join the contact create/edit transaction through a non-mutexed core.
- **ADR-021:** Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup — photo fields reuse the local master pipeline and derivable `cv-` filenames.
- **ADR-050:** Closed AI Prompt Egress Allowlist and Opt-In Field Sharing — limits third-party prompt context to explicitly shared live fields.

## Gotchas

1. **Do not use `col_name` as SQL syntax.** It is compatibility metadata; normalized reads bind identifiers and values through literal-table queries.
2. **The pair constraint is intentional.** `uid UNIQUE` and `UNIQUE(contact_id, field_def_id)` protect normalized row identity; complete coverage comes from migration/creation seeding and UPSERT self-heal.
3. **Do not nest `inWriteTransaction()`.** The shared mutex is non-reentrant; use a non-mutexed operation core when composing an atomic destructive operation.
4. **Type changes do not normalize stored bytes.** A value can render clean through a permissive parser while raw CAST sorting disagrees for noncanonical TEXT such as comma-formatted numbers; resolve that mismatch before a production sort consumer is wired.
5. **The field editor applies a multi-part edit incrementally.** Label and curation writes can remain committed if the user cancels a subsequent type-change summary or a later operation fails.
6. **Photo fields are edit-only.** They require a contact id to derive a stable path; create and definition-preview surfaces remain disabled.
7. **Do not create definitions from a contact form.** The form fills values only, preserving the Settings editor as the sole definition and slugifier producer.
8. **Do not delete a staged custom photo unless its committed references are known.** A custom crop can write the stable file before form save, so uncertain cleanup must prefer a bounded file leak over deleting a referenced image.
9. **Do not treat `share_with_ai` as a value-row property.** It belongs to `custom_field_defs`; only the AI reader may consume flagged values through its closed projection.
10. **A loss-bearing migration inconsistency fails closed.** The old database remains unchanged and navigation does not mount; an orphan legacy column is instead retained only as a bounded history snapshot.

## Related Systems

- **Persistence core** — supplies migration 006, the shared transaction, and the launch-sweep registry.
- **Contacts** — owns the contacts that receive a complete normalized pair matrix on creation.
- **AI suggestions** — consumes only explicitly shared, live field values as bounded prompt context.
- **Photos** — supplies the picker, crop, local-master, staged-file, and purge-cleanup contracts for photo-type values.
- **App shell** — routes the definition editor through Settings.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-14 | 03 | Created runtime custom-field DDL, type semantics, editor, and launch-time quarantine cleanup. |
| 2026-08-14 | 04 | Added the transaction-composable value writer and fixed-first contact-form integration. |
| 2026-08-15 | 05 | Replaced the photo placeholder with the shared local photo pipeline and staged-file lifecycle handling. |
| 2026-08-18 | 14 | Exposed default-off per-field AI sharing and routed it to the closed AI context boundary. |
| 2026-08-24 | 16 | Replaced dynamic columns with normalized uid-bearing value pairs through migration 006. |
