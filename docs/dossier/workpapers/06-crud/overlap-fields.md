# Workpaper — Seam: domain 6 (`crud`) × domain 2 (`fields`)

**Scope.** How the schema-driven create/edit contact forms integrate with the HANDOFF §14
custom-fields system. Concretely: whether one renderer serves both the fixed `contacts`
columns and the dynamic custom fields; where a field *definition* is authored versus a
field *value*; how `show_on_new` composes the create form; how §14.3 validation-at-entry
meets the fixed columns' own validation needs; and what the capture flow's inline-create
(03-fuel) does with all of this.

**Method.** Full read of the actual source on disk — no diffs, no summaries. Plugin:
`src/components/FormRenderer.tsx` (all 316 lines), `src/schemas/types.ts`,
`src/schemas/new-person.schema.ts`, `src/schemas/edit-person.schema.ts`,
`src/services/ContactManager.ts`. Dossier: `HANDOFF.md` §14 (all subsections),
`docs/dossier/02-fields.md`, `01-data.md` (clusters C, D, E, F and the `[data → crud]` /
`[data → fields]` exports), `03-fuel.md` (cluster B capture, the hooks-vs-data boundary).
Every line number below was verified by opening the file. HANDOFF §14 is `[DECIDED]` and is
treated as a constraint to satisfy, never re-litigate; where a finding would touch a
`[DECIDED]` item it is flagged explicitly.

**Headline.** The plugin's `FormRenderer` renders a **single flat list** of `FieldDef`s
(`FormRenderer.tsx:266`, `schema.fields.map(...)`), keyed by `field.key`
(`FormRenderer.tsx:37`), dispatching on `field.type` over 7 types (`:100-241`). That
structure ports — but it hides that on mobile the form now spans **two storage
destinations** (fixed `contacts` columns and the `contact_custom_values` row) and **two
definition sources** (app-hardcoded fixed fields and user-authored `custom_field_defs`
rows), and that several fixed columns need widgets the plugin's 7-type `FieldType` union
cannot express. The plugin also proves the failure mode §14.7 fixes: its form abstraction
is expressive enough for values but says nothing about where a *definition* is created,
which is why the plugin never had an on-device field editor at all (§14.9). The real forks
at this seam are all about that boundary — renderer unification, and where definitions are
authored.

---

## 1. One renderer or two sections? The fixed columns break the `FieldDef` abstraction

`FieldDef` (`schemas/types.ts:25-44`) carries `key, type, label, placeholder, required,
default, options: string[], layout, description`. `FormRenderer.renderField`
(`FormRenderer.tsx:100-241`) switches on `type` ∈ `{text, textarea, dropdown, date, toggle,
number, photo}`. A custom field maps onto this cleanly: `custom_field_defs`
(HANDOFF §14.1: `col_name, label, type, options, show_on_new, quarantined_at`) is a
near-superset, so a translator `custom_field_defs row → FieldDef` is trivial and the custom
section can reuse the ported renderer verbatim.

The **fixed columns do not map cleanly.** Every one that the plugin expressed as a plain
`FieldDef` has since been redecided into something the union cannot represent:

| Fixed column | Plugin widget | Post-decision requirement | `FieldType` can express? |
|---|---|---|---|
| `category` | `dropdown`, 4 hardcoded options (`new-person.schema.ts:22-28`) | Live user-editable `categories` table, FK `contacts.category_id`, rename/add/reorder (01-data cluster D). Picker over a **live table** + inline "add category". | **No** — `options: string[]` (`types.ts:39`) is a static array, not a table query. |
| `frequency` | `dropdown`, 7 named strings (`new-person.schema.ts:30-44`) | Stored as `interval_days` INTEGER; "every 45 days" must be possible with zero migration (01-data cluster C). Preset picker **+ custom interval** writing a number. | **No** — no interval/number-with-presets widget. |
| `birthday` | `type:'date'` (`new-person.schema.ts:52-56`) = HTML date requiring full ISO (`FormRenderer.tsx:133-143`) | Optional-year: `MM-DD` **or** `YYYY-MM-DD`, day often known when year is not (01-data cluster F). | **No** — the `date` widget cannot omit a year. |
| `last_contact` | not on the plugin form (silently stamped today, `ContactManager.ts:136-138`) | Create form asks "when did you last speak", default today, with explicit **"not yet / don't know"** that leaves it genuinely empty (01-data cluster C). A tri-state, not a value. | **No** — no such type. |
| `photo` | URL text input + preview + scrape toggle (`FormRenderer.tsx:174-226`) | Native image picker, local file storage (§14.3). | **No** as built — the whole `photo` case is rewritten. |
| `phone` / `email` | absent in plugin (net-new, 01-data cluster E) | Nullable columns; SMS composer needs one number. `tel`/`email` keypads. | Partially — `text` works, but the input mode differs. |
| `social_battery` | `dropdown`, 3 options | Fixed column, values unchanged (01-data cluster F). | **Yes** — static dropdown fits. |
| `contact_link` | `text` | Fixed column, now actionable (01-data cluster F). | **Yes** for entry. |
| `name` | `text, required` | The identity column; duplicate-name warning at create (01-data cluster A). | Entry yes; the warning is bespoke (§4). |

So `category`, `frequency`, `birthday`, `last_contact` and `photo` each need a **bespoke
widget** with no home in the 7-type union. This is the seam's central fork.

### Q1 (owner). Extend the renderer, or hand-build the fixed section?

- **(a) One renderer.** Extend `FieldType` with new widget kinds (`category-picker`,
  `interval`, `partial-date`, `tristate-date`, `image`) and drive fixed columns through the
  same dispatcher via synthetic `FieldDef`s. Pro: one code path, one validation dispatch,
  one layout engine; custom and fixed fields interleave freely. Con: the fixed widgets are
  not schema-authored and never user-editable, so they carry hardcoded behaviour (a live
  `categories` query, an `interval_days` transform) awkwardly inside a "data-driven"
  abstraction; extending the union is also extending the custom-field type system unless
  the new kinds are marked fixed-only.
- **(b) Two sections.** Hand-build the fixed block as bespoke RN components; use the ported
  schema renderer **only** for the custom section. Pro: each fixed widget is exactly what it
  needs to be; the schema renderer stays a faithful 7-type port. Con: two layout/validation
  regimes to keep visually coherent; interleaving fixed and custom fields becomes hard.

This is a design/architecture call with owner-visible ripple (it shapes every create/edit
screen and the capture inline-create), so it is surfaced, not decided here.

### Q2 (owner). Ordering — are custom fields always after fixed ones, or interleaved? And there is a missing column.

§14.7 decides *which* fields appear on each surface but is silent on **order**. The plugin
renders purely in `schema.fields` array order (`FormRenderer.tsx:266`) — one flat sequence,
no fixed/custom distinction. Two sub-questions:

1. **Fixed-then-custom, or interleaved?** If custom fields can sit between fixed ones (e.g.
   a custom "Nickname" right after `name`), option (a) above is nearly forced and the fixed
   columns need explicit order positions too. If custom always trails the fixed block, (b)
   is clean. Undecided anywhere.
2. **§14.1's `custom_field_defs` has no ordering column, yet §14.10 requires "reorder".**
   HANDOFF §14.10 item 1: *"Edit and reorder."* The §14.1 diagram columns are
   `id, col_name, label, type, options, show_on_new, quarantined_at` — no `seq`/`sort_order`.
   A display-order column is therefore needed on `custom_field_defs` **from migration 1**;
   like `created_at` and `ring_seq` in 01-data, insertion order **cannot be backfilled
   truthfully** once reorder exists. This is a concrete data-model gap in §14.1, additive to
   it, not a reversal — flagged for the field phase's migration-1 scope.

---

## 2. Where the field *editor* lives — and the inline-create fork

The plugin has **no on-device field editor**: definitions were hand-authored as markdown
files with YAML frontmatter and ` ```fields ` blocks (§14.9), which §14.9 calls *"the
largest single piece of new work in the phase [with] no predecessor to port from."* So this
seam has no plugin behaviour to port — only decisions to make.

`FormRenderer` and `ContactManager` only ever touch **values**: `createContact` loops
`schema.fields` and writes `fm[field.key] = value ?? field.default ?? ''`
(`ContactManager.ts:129-133`); `updateFrontmatter` is a merge of the collected dict
(`ContactManager.ts:163-167`). Nothing in the plugin creates, renames, or types a *field
definition* from a running UI. HANDOFF is consistent: §14.7's table marks the field editor
as a separate configurable surface, and §14.5's delete/quarantine action is described as
*"The settings action."* So the baseline is: **field definitions are authored in a settings
surface; the create/edit contact form authors only values.** That gives a clean split —
contact form = values, field editor = definitions, type-change pre-flight (§14.4) = field
editor only.

### Q3 (owner). Does the create/edit contact form offer an inline "add a field" affordance?

This is a genuine fork, and it is the one with the most product ripple:

- **Settings-only.** Defining a field is strictly a trip to the field-editor settings
  screen. Simple boundary; the contact form never runs DDL. Con: the moment a user is
  mid-edit and realises they want a "How we met" field, they must leave, define it, come
  back — friction, against the product's core thesis.
- **Inline "+ Add field" on the edit form.** Lower friction, but it fires the §14.1
  create-field transaction (`INSERT` def row **+** `ALTER TABLE contact_custom_values ADD
  COLUMN`) *from inside the contact-save flow*, and it makes the `label → col_name`
  slugifier + collision handling (01-data `[data → fields]` exports, F16.3/F17) reachable
  from the form, not just the editor. That is a heavier, riskier operation to embed in a
  routine edit.

01-data already established the two-table model and the untrusted-`col_name` hazard; this
question decides whether the contact form becomes a *second producer* of field definitions
(after the field editor and the importer), which the identifier-safety work must then
account for.

---

## 3. `show_on_new` authoring and the create-form field set

Confirmed against the source: `show_on_new` is a column on `custom_field_defs` (§14.1), set
in the field editor (§14.10 item 1 lists it among what the editor authors), and read only by
the new-contact form (§14.7). The create form's field set is therefore:

> **(fixed create fields) + (custom fields WHERE show_on_new = true AND quarantined_at IS NULL)**

Two gaps worth surfacing, both small but real:

1. **"Fixed create fields" is undefined.** The plugin's new-person form shows 7 fields
   (`new-person.schema.ts`), but 01-data added `phone`, `email`, ordered favourites, and a
   `last_contact` tri-state, and §14.7 itself observes *"birthdays are rarely known at first
   meeting."* So **which fixed columns appear on create** (does `birthday` appear? do
   `phone`/`email`? does `favourite rank`?) is not decided anywhere — it is the fixed-column
   analogue of `show_on_new`, but with no flag because fixed columns are app-controlled.
   This wants an explicit list, not a default inherited from the plugin's 7.
2. **`show_on_new` has no default in §14.** When the field editor mints a new custom field,
   does it default to shown-on-new or hidden? Minor, but the field editor must pick one.

Fixed columns have **no** `show_on_new` flag and **cannot** be `show_on_new`-configured — a
point worth stating so an implementer doesn't add one. Symmetrically, §14.7's edit rule
("always shows every non-quarantined field") is about *custom* fields; fixed columns are
implicitly always shown on edit. Confirm that reading.

---

## 4. Validation-at-entry — two regimes meeting on one form

§14.3 defines validation-at-entry **per custom-field type** (number→numeric keypad,
date→picker, dropdown→constrained, toggle→switch, text/textarea→accept anything,
photo→native picker). The plugin's own validation is HTML5 `required` only
(`FormRenderer.tsx:108,120,140,169,186,237`) — so on RN **all** validation is net-new.

The conflict is that the fixed columns carry validation needs that the §14.3 type table does
**not** cover, because §14.3 was written for custom fields:

- **Duplicate-name warning** — 01-data `[DECIDED]`: *"You already have a Chris," + Create
  anyway.* This is a DB-query-driven soft warning on `name`, not any parser in §14.3's seven.
- **Birthday optional-year** — needs a partial-date validator (§1), absent from §14.3.
- **Phone format** — a fixed free-text column; §14.3 has no phone type. Left unvalidated it
  accepts anything, which is arguably fine (the SMS composer tolerates it) but is a choice.
- **Category must resolve** — must exist in the `categories` table or trigger inline-add;
  not a §14.3 dropdown-over-static-options.
- **Frequency interval** — must be a positive integer; §14.3's `number` keypad is close but
  the semantics (an interval, not a free number) differ.

Also note a structural asymmetry: **custom fields are never `required`** — §14.1's
`custom_field_defs` has no required column — whereas fixed `name` is required. So `required`
is a fixed-column-only concept on mobile, diverging from the plugin's per-`FieldDef`
`required` (`types.ts:35`). This reinforces that fixed and custom validation are two
regimes. **Design question (mostly planner, fixed-set is owner input):** does the form route
fixed columns through the same validation dispatcher as §14.3 custom types (requiring the
dispatcher to grow bespoke fixed-column validators), or a separate one? No conflict *reverses*
§14.3 — the fixed columns simply sit outside its scope and need their own rules.

---

## 5. Inline contact creation from capture (03-fuel) — a leaner form, with a `last_contact` twist

03-fuel `[DECIDED]` (`03-fuel.md:149`, exported `:383-385`): the capture picker *"can create
a contact inline."* The capture flow writes the fuel row **the instant a contact is picked**
(`03-fuel.md:136`) because `useShareIntent` defaults `resetOnBackground:true` and destroys
unsaved state — so the friction ceiling here is far lower than the normal create form.

This forces two questions at the crud↔fields seam:

### Q4 (owner). Is capture-inline-create a stripped-down create form, and what is the minimum field set?

Running the full `show_on_new` set (which can be many custom fields plus the fixed create
block) inside the one flow HANDOFF §6 says *must never fail* fights the capture design. The
leaner alternative is **name-only**, with required fixed columns (`category`, `frequency`)
taking silent defaults (the plugin defaulted `category:'Family'`, `frequency:'Monthly'` —
`new-person.schema.ts:25,42`). Whether capture-inline-create runs `show_on_new` at all, or
something even leaner than the normal create form, is undecided and is an owner call because
it trades capture speed against how complete a just-created contact is.

### The `last_contact` default inverts here — flag.

The normal create form defaults `last_contact` to **today** (01-data cluster C). But 03-fuel
`[DECIDED]` the capture picker *includes never-contacted contacts* precisely because *"the
saved thing is often the only reason to reach out"* (`03-fuel.md:151-154`). A contact created
inline **from capture** is, by construction, usually someone not yet contacted — so its
`last_contact` should default **empty** (landing on the never-contacted screen), the opposite
of the standard form's default. This is not a §14 issue but it is a create-form behaviour that
diverges by entry point, and the inline-create form must not blindly reuse the standard form's
"default today". Surfaced so it is decided, not inherited.

---

## 6. The fixed/custom split forces a namespace-and-write decision the plugin never had

The plugin collects one flat `Record<string,any>` keyed by `field.key`
(`FormRenderer.tsx:37,254`) and writes it to one destination — frontmatter — via one
`processFrontMatter` merge (`ContactManager.ts:123-142` / `:163-167`). On mobile that single
dict must be **split at submit** into two writers in one transaction: fixed keys → `contacts`
columns, custom keys → the contact's `contact_custom_values` row (one column per field,
§14.1). Two consequences:

1. **Reserved-name collision (planner call, but fixed-set is the owner's input).** Because the
   merged form namespace is keyed by field name (plugin pattern), a custom field whose
   `col_name` equals a fixed column (`phone`, `birthday`, `category`, `last_contact`, …) is
   ambiguous at both render and submit. 01-data F17 already showed the plugin had exactly this
   class of bug — a user field named `tags`/`last_contact` silently overwrote plugin state
   because `RESERVED_KEYS` (`loader.ts:23-29`) protected only schema metadata, not contact
   fields. The mobile `label → col_name` slugifier must therefore reserve the **entire fixed
   column set** (name, category, frequency, social_battery, birthday, phone, email,
   contact_link, photo, last_contact, favourite rank, ring_seq, id, created_at, archived_at…).
   That set is the fixed-column decisions from 01-data cluster F + E; enumerating it is a
   prerequisite for the slugifier, and it is the same reserved-list the importer needs.
2. **Edit-form initial values require a JOIN.** The plugin's `initialValues`
   (`FormRenderer.tsx:37`) came from one object. On mobile the edit form's initial state must
   be assembled by the dynamic query layer (§14.10 item 3) joining `contacts` + the contact's
   `contact_custom_values` row + resolving `category_id` to a label. Not a fork, but a
   confirmation that the "one flat dict" the renderer wants is a *view* the query layer builds,
   not a table.

---

## Design questions for the owner (summary)

Each has divergent, migration-or-product downstream consequences; none is a planner's to make.

- **Q1 — Renderer unification.** One extended schema renderer driving both fixed and custom
  fields, or a hand-built fixed section + the ported 7-type renderer for custom only? Forced by
  `category`/`frequency`/`birthday`/`last_contact`/`photo` needing widgets outside the
  `FieldType` union (§1).
- **Q2 — Ordering.** Fixed-then-custom or interleaved (§1)? And confirm the migration-1
  addition of a display-order column to `custom_field_defs`, absent from §14.1 but required by
  §14.10's "reorder" (§1.2).
- **Q3 — Inline field definition.** Does the create/edit contact form offer an inline "add a
  field" affordance (making the form a producer of field *definitions* and firing DDL mid-edit),
  or is defining a field strictly a settings trip (§2)?
- **Q4 — Fixed create set.** Which fixed columns appear on the *create* form (birthday?
  phone/email?) — the fixed-column analogue of `show_on_new`, currently undefined (§3.1).
- **Q5 — Capture inline-create.** Stripped-down name-only form or the full `show_on_new` set?
  And confirm `last_contact` defaults **empty** (not today) for capture-created contacts (§5).
- **Validation regime (planner, owner supplies the fixed set).** Fixed-column validations
  (duplicate-name warning, optional-year birthday, phone format, category resolution) sit
  outside §14.3's per-type table and need their own rules (§4).

## Cross-domain constraints this seam imposes

- **→ `fields` (2):** §14.1's `custom_field_defs` needs a **display-order column from migration
  1** (reorder cannot be backfilled) — additive to §14, not a reversal.
- **→ `fields` (2) / `data` (1):** the `label → col_name` slugifier must reserve the **complete
  fixed-column name set**; the create/edit form is a potential **third producer** of field
  definitions (after field editor and importer) if Q3 chooses inline-create.
- **→ `data` (1):** the create form's `last_contact` default is **entry-point-dependent** —
  today from the normal form, empty from capture inline-create.
- **→ `capture` (10):** capture inline-create is a distinct, leaner create surface; its minimum
  field set and whether it runs `show_on_new` are unresolved (Q5).
- **→ `photos` (7):** the native image-picker widget is shared by the fixed `contacts.photo`
  column and the custom `photo` field type (different storage, same widget); §14.3 rewrites the
  plugin's URL-input `photo` case entirely.
- **→ `dashboard` (8) / `notify` (11):** 01-data exported that `phone`, `email` and the
  now-actionable `contact_link` compete for one "reach them" job and need coherent presentation
  on the form as well as the card.

---

*Prepared for `/oa-interrogate 6` (`crud`), feeding the crud↔fields seam. Investigation only —
no decisions taken; every Q above is the owner's. HANDOFF §14 and completed dossier `[DECIDED]`
items were treated as fixed constraints; §1.2's ordering column and §6.1's reserved-name set
are additive to §14, not reversals of it.*
