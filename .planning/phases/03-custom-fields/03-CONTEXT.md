# Phase 3: Custom Fields - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Auto-generated (design is `[DECIDED]` in HANDOFF §14; one `[OPEN]` item — the quarantine window — resolved by the owner below)

<domain>
## Phase Boundary

The full HANDOFF §14 custom-fields subsystem — the field-editor UI, the dynamic query layer, the
7 parsers, `field_history`, and the quarantine sweep — with its invariants enforced. FLD-01…FLD-07.

**Key framing:** the three tables ALREADY EXIST (Phase 2 migration 1 created them empty):
`custom_field_defs` (id, uid, col_name UNIQUE, label, type, options, show_on_new, always_show,
display_order, quarantined_at, share_with_ai), `contact_custom_values` (contact_id PK, uid,
modified_at — **column-less**, ready for runtime ADD COLUMN), `field_history` (contact_id,
field_col_name, old_value, operation, created_at). So this phase does NOT create tables and does NOT
add a `user_version` migration. Custom fields are managed at **RUNTIME** by the user via transactional
DDL (`ALTER TABLE contact_custom_values ADD/RENAME/DROP COLUMN`) — NOT via migrations.

**In scope (FLD-01…07):**
- FLD-02 create: `INSERT def + ALTER TABLE ADD COLUMN <col_name> TEXT` in ONE transaction; `col_name`
  whitelist-CONSTRUCTED (never escaped) and cannot collide with any fixed-column name.
- FLD-03 rename (metadata-only `RENAME COLUMN`), reorder (`display_order`), change type/options.
- FLD-04 type change: pre-flight through the target parser (7 parsers total), auto-convert clean
  values, flag unconvertible ones as a tap-to-fix error state, destroy NO data, snapshot to
  `field_history` in the SAME transaction — NO extra confirmation prompt.
- FLD-05 delete/quarantine: dynamic action — immediate Delete when the field is empty, else Quarantine
  (reversible, data untouched, `quarantined_at` set); the launch sweep expires quarantined defs
  (`DELETE def + DROP COLUMN` in ONE transaction) and prunes `field_history` on the 30-day schedule.
- FLD-06 (infra): every custom-field sort/filter routes through the single `sortExpr()`; NO custom
  value column is ever indexed or made UNIQUE.
- FLD-07 where fields appear: profile shows a field whenever it has a value (or always, if always-show);
  create form shows only `show_on_new` fields; edit form shows EVERY non-quarantined field (no config).
- FLD-01 (infra) — the tables (done in Phase 2); this phase wires the def/values/history operations.

**Explicitly NOT this phase:** contact CRUD/forms scaffold itself (Phase 4 — but the custom-field
sections plug into those forms), photos (Phase 5), interaction log/fuel, dashboard. This phase owns the
custom-field subsystem and its editor; the host forms/profile it renders INTO are Phase 4's shell.
</domain>

<decisions>
## Implementation Decisions

### The §14 design is `[DECIDED]` — enforce it, do not redesign
HANDOFF §14 is almost entirely `[DECIDED]`. These are the invariants an agent is most likely to break
on instinct (CLAUDE.md "Custom fields — invariants" — NON-NEGOTIABLE):
- **Two tables; the same field is a ROW in `custom_field_defs` and a COLUMN in `contact_custom_values`.**
  Say "custom field," never "custom column."
- **Every `contact_custom_values` column is declared TEXT, forever** (§14.2). Deliberate — makes a field
  type change a one-row `UPDATE` on the defs table, not a column rebuild. Never declare INTEGER/REAL/BOOLEAN.
- **Field type lives in `custom_field_defs.type` and drives the UI widget only** — storage type (TEXT) and
  field type are different concepts. A type change touches `contact_custom_values` NOT at all.
- **Route every sort/filter through the single `sortExpr()` helper** (§14.2) — TEXT storage means numbers
  sort lexicographically; that helper is the ONLY place the TEXT decision is observable. Never interpolate
  a custom column name into ORDER BY / comparison directly. `sortExpr`: number→`CAST(col AS REAL)`,
  date→col (ISO sorts as text), toggle→`CAST(col AS INTEGER)`, else→col.
- **Never index or add UNIQUE to a `contact_custom_values` column** (§14.11) — `DROP COLUMN` fails on
  indexed/UNIQUE/view/generated columns, and quarantine expiry requires DROP.
- **Type changes never destroy data** — 7 parsers, one per TARGET type (not 42 pairwise). Values that
  fail the target parser are flagged + rendered as an error state on the profile, never coerced/cleared.
  Write parsers PERMISSIVELY. NO "run the conversion?" confirmation (§14.4 — the pre-flight summary is enough).
- **Every destructive op snapshots to `field_history` inside the SAME transaction** (§14.6) — type
  conversions AND column drops both qualify. Only recovery mechanism; no server/backup.
- **Deleting a defs row does NOT drop a column** — `ON DELETE CASCADE` deletes rows, never columns. Both
  statements appear explicitly in ONE transaction (§14.5).
- **`col_name` is whitelist-CONSTRUCTED, never escaped** — salvage `keyToLabel()`/`labelToKey` (~9 lines)
  from the plugin's `loader.ts` for deriving `col_name` from a label; the slugifier is the single producer
  and reserves the ENTIRE fixed-column name set (a whitelist), so a custom field can never collide with a
  real `contacts`/`contact_custom_values` column.
- **Nothing watches a timestamp** — quarantine expiry + history retention run as a SWEEP at app launch
  (register a hook into Phase 2's launch-sweep registry), never a timer/trigger.

### Owner decision (2026-08-14) — quarantine window
The `[OPEN]` item (HANDOFF §14.5 / dossier 02-fields): the quarantine + `field_history` retention window
is **30 days, FIXED** — a single top-of-file tunable constant, NOT user-configurable (no settings surface).
Consistent with §14.7's "drop unnecessary configuration" theme; configurability is a clean v2 add.

### Type-change semantics — RESOLVED by the CLAUDE.md non-negotiable invariant (planner call, not a reversal)
Research flagged an apparent conflict: §14.4/§14.6/FLD-04 say clean values "convert automatically" +
"snapshot to field_history in the same transaction," while §14.2 + **CLAUDE.md (non-negotiable)** say a
type change "must not touch `contact_custom_values` at all / blast radius zero." These reconcile — and
CLAUDE.md's invariant is the dominant authority, so enforcing it is a planner call:
- A type change is **ONE `UPDATE custom_field_defs SET type=?`** — `contact_custom_values` is NOT touched;
  stored TEXT value bytes are NEVER rewritten.
- "Auto-convert" = the clean values are VALID under the new type and render/sort correctly automatically
  (read-time parse via the widget + `sortExpr`); "flag the rest" = a value that fails the target parser
  renders as a **tap-to-fix error state** on the profile — never coerced or cleared.
- `field_history` snapshots the **pre-change state** (old type + affected values, `operation='type_change'`)
  in the SAME transaction as the defs `UPDATE`, purely for undo (§14.6's "one mechanism, two uses").
This is surfaced for the owner's `--to 3` review; it does not reverse any decision (it enforces the
strongest one). The 7 parsers are therefore **read-time validators/interpreters**, not value rewriters.

### Sub-decisions (Claude's discretion / plan-ordering — none reverse a decision)
- **`col_name` is a STABLE internal slug** set at creation; renaming a field updates `label` (metadata)
  only — `col_name` does not change (it is never user-visible and is referenced by `sortExpr`/queries).
  FLD-03's "metadata-only RENAME COLUMN" is satisfied by the cheap `label` UPDATE; a literal `RENAME
  COLUMN` is unnecessary churn. (Planner may revisit if convergence review objects.)
- **`share_with_ai` toggle** — DEFER surfacing it in the editor to Phase 14 (AI); the column exists, but
  a toggle whose effect doesn't exist yet is dead UI. Phase 14 adds the toggle when it reads the flag.
- **`photo` custom-field widget** — DEFER the picker to reuse Phase 5's photo pipeline; `photo` stays a
  valid field type, its editor widget lands minimal/deferred (flag in the plan).
- **Dropdown options edited to exclude a stored value** — render that out-of-list value as the SAME
  tap-to-fix error state as an unconvertible type change (consistency), never silently drop it.

### Where fields appear (§14.7 — `[DECIDED]`, one surface configurable)
New contact form: per-field `show_on_new` (curated). Edit form: EVERY non-quarantined field, NO config.
Profile: automatic whenever a field has a value + one global `always_show` flag per field. `[DECIDED-dropped]`
per-profile view options; `[DECIDED-declined]` per-profile exceptions to a global field — do not build them.

### Claude's discretion (genuinely open)
Field-editor UI layout/visual polish (functionally specified by §14; the owner reviews it at the `--to 3`
gate — no hardcoded colours, theme tokens), module layout under `src/db/`/`src/components/`/`src/screens/`,
the parser implementations (permissive, per §14.4).
</decisions>

<code_context>
## Existing Code Insights

### Existing (Phase 2 — build ON these; do NOT recreate)
- Tables `custom_field_defs` / `contact_custom_values` (column-less) / `field_history` exist from
  migration 1 (`src/db/migrations/001-initial.ts`).
- `src/db/database.ts` (`SqlExecutor` adapter, `openAndMigrate`), `src/db/mutex.ts` (`withMutex` — share it
  for the transactional DDL so field ops serialize with recency writers), the hand-rolled `BEGIN/COMMIT/
  ROLLBACK` transaction pattern (NEVER expo `withTransactionAsync`), `node:sqlite` testkit.
- `src/services/launch-sweep.ts` — the sweep **hook registry** (`registerSweepHook`); register quarantine
  expiry + history retention here (this is a Phase-2 hook consumer — the DATA-06 skeleton was built for this).
- `src/utils/dates.ts` `formatLocalDate()` + `date('now','localtime')` discipline (quarantine 30-day math).
- `src/theme/` tokens (no hardcoded colours); `src/stores/` Zustand pattern.

### Plugin analogs (HANDOFF §14.8/§14.9 — read in place)
- `~/projects/Orbit/src/components/FormRenderer.tsx` (316) — schema-driven, handles all 7 field types;
  REWRITE against RN primitives (dispatch logic + validation carry over; React-DOM plumbing does not).
- `~/projects/Orbit/src/schemas/types.ts` — `FieldType`/`FieldDef`/`SchemaDef` (already ported to `src/schemas/`).
- `~/projects/Orbit/src/schemas/loader.ts` (479) — **essentially all dead** (Obsidian markdown parsing).
  Salvage ONLY `keyToLabel()` (~9 lines) for `col_name` derivation. Do NOT port the rest.
- 7 field types: `text` · `textarea` · `dropdown` · `date` · `toggle` · `number` · `photo` (the `photo`
  field is native image picker — but photos are Phase 5; a `photo` custom field can defer its picker to
  reuse Phase 5's pipeline, or land a minimal path — flag for the planner).

### Integration points
- `src/db/` (defs DAO, values DAO, the transactional DDL ops, `sortExpr`, 7 parsers, type-change pre-flight,
  the quarantine/history sweep hooks), `src/components/` (field editor + the dynamic form/profile renderers),
  `src/screens/` (a Settings → Custom Fields screen), the launch-sweep registry.
</code_context>

<specifics>
## Specific Ideas

Follow HANDOFF §14.10 "What must be built new": (1) field editor UI (largest item — create/edit/reorder/
delete-quarantine); (2) the transactional DDL ops (add/rename/drop); (3) dynamic query layer (forms,
profile sections, `sortExpr`); (4) type-change pre-flight + 7 parsers + summary UI; (5) `field_history`
snapshot + the launch-time sweep (quarantine expiry + history retention, 30-day); (6) error-state rendering
for flagged unconvertible values; (7) `photo` field rework (defer/reuse Phase 5 if needed).

This is the LAST phase before the owner's `--to 3` human review of the irreversible schema + custom fields —
plan for that review (clear field-editor UX, the invariants demonstrably enforced by tests).
</specifics>

<deferred>
## Deferred Ideas

- Contact CRUD/forms shell → Phase 4 (custom-field sections plug into it); `contact_links`, archive/restore.
- Photos pipeline → Phase 5 (a `photo` custom field reuses it).
- Per-profile field view options / per-profile exceptions to a global field → `[DECIDED-dropped/declined]`, never build.
- User-configurable quarantine window → v2 (owner chose fixed 30 days for v1).
</deferred>
