# Dossier 06 — `crud` — Contact create/edit flows & forms

**Status:** complete · Interrogated 2026-08-13 · 12 questions over 4 rounds · No `[OPEN]`
items remain. This run **reverses 01-data** on `contact_link`'s shape (single column → a
`contact_links` child table — owner's explicit call), and **assigns three editing surfaces
away from this domain** to dashboard/orrery/widget (favourites rank, `ring_seq`, sun).

## Scope

Add-person and edit-person, rebuilt as native screens driven by the schema-renderer
pattern. The plugin's `FormRenderer` (316 lines, 7 field types) ports structurally; the
markdown-file plumbing around it dies. This domain owns: the create flow (what is asked up
front versus later, per §14.7 `show_on_new`), the edit flow (§14.7 always-show), the
inline-create path the capture flow depends on (03-fuel), validation-at-entry rules (§14.3),
and the whole-contact lifecycle surfaces — archive, restore, and the separate explicit purge
(01-data settled the *semantics*; the *surfaces* land here). It also owns where the
per-contact settings with no other home get edited (favourites rank, `ring_seq`, sun
assignment, "Rarely responds"), and how the fixed reach columns (`phone`, `email`,
`contact_link`) are collected. Excludes: the custom-field *definition editor* internals and
type-change machinery (HANDOFF §14 / domain `fields`), photo capture mechanics (domain
`photos`), and the profile/dashboard read surfaces themselves.

---

## Decisions

> **Inherited and already settled — not reopened here.** The edit form **always shows every
> non-quarantined field** (HANDOFF §14.7); rename is a **metadata-only UPDATE** on the surrogate
> key (01-data A); **duplicate names warn but do not block** at create (01-data A); removing a
> contact is **archive** (hidden, restorable) with a **separate explicit purge** (01-data A);
> the create form **asks "when did you last speak," default today, with an explicit "not yet /
> don't know"** (01-data C); answering it **must insert an interaction row through the
> single-writer DAO** (04-log → crud); purge must **delete interactions, events, fuel, custom
> values, the photo file and scheduled notifications explicitly in one transaction** (01-data,
> 04-log, 03-fuel → crud); validation is **the UI's job, per field type** (§14.3); the
> `contact_link` column **survives and is actionable** — only its form presentation is live
> (01-data F). These bound this run; the questions below sit at their edges.

### Cluster A — The create form

**[DECIDED] The create form asks a lean fixed set: name, category, frequency, the "when did
you last speak" question, and phone.** Everything else fixed (email, birthday, photo, social
battery, contact link) is edit-only. Custom fields flagged `show_on_new` append after the
fixed block regardless.
Rationale: matches §14.7's "creating a contact should not demand 15 fields" and the product's
friction thesis (HANDOFF §1/§6). **Phone is the one non-obvious inclusion** — the decay→SMS
core loop (HANDOFF §6) needs a number, and deferring it to edit makes it the field everyone
forgets, breaking the app's headline action for that contact.
**[REJECTED] Minimal** (no phone) — saves one field but starves the notify loop.
**[REJECTED] Rich** (the plugin's 7 + email/photo/battery/birthday on create) — the long form
§14.7 explicitly argues against.

**[DECIDED] Fixed columns render as a block first, custom fields grouped after — not
interleaved.** No cross-cutting display-order sequence spanning both.
Rationale: cleaner, lets the owner's later design pass style two distinct sections, and avoids
coupling fixed and custom rendering through a shared order column. *Consequence recorded:* this
does **not** eliminate the separate need for a display-order column on `custom_field_defs`
itself — §14.10 requires "reorder" and §14.1's table has no such column (see exported
constraint). Ordering *custom fields among themselves* still needs that column; this decision
only fixes that custom never interleaves *with fixed*.
**[REJECTED] Fully interleaved** — more flexible (a custom "Nickname" right after Name) but
forces a single unified renderer and a form-spanning order sequence.

**[DECIDED] Defining a custom field is a settings trip; the contact form fills values only.**
No inline "+ Add field" on the create/edit form.
Rationale: keeps the `ALTER TABLE ADD COLUMN` DDL (§14.1) out of the routine contact-save
path, and keeps the `label→col_name` slugifier to a single producer (the field editor), which
the identifier-safety work (01-data F17: whitelist *construction*, never escaping) must guard.
An inline affordance would make the contact form a second untrusted producer firing DDL
mid-edit.
**[REJECTED] Inline "+ Add field"** — lower friction, materially higher risk on the one
operation that is irreversible per-user (a mistyped column name), for a workflow (mid-edit
field invention) that is not the common case.

**[DECIDED — owner, over the recommendation] The v1 frequency picker offers the 7 named
presets PLUS a custom "every N" interval.** Not presets-only.
Rationale (owner's call): the integer-days storage (01-data C) already supports arbitrary
intervals, so exposing custom entry in v1 costs only UI, not schema, and the owner wanted it
available from the start rather than as a later add.
**[REJECTED] Presets-only in v1** (the orchestrator's recommendation) — simpler, but the owner
judged the custom entry worth building now.
*Deferred to planning:* the custom entry's unit affordance (days / weeks / months, all writing
`interval_days`) and its positive-integer validation.

### Cluster B — Reach fields & the capture create path

**[DECIDED] On the edit form, phone and email are dedicated inputs; `contact_link` is
presented inside a small "links" area.** Phone/email keep their own labels and keyboards
(`phone-pad`, `email-address`); the link sits in a grouped links affordance rather than a bare
third labelled field.
**[OPEN → resolved in Round 3] Whether "links" is one link or many.** The chosen option's
mock showed a `+ add link` control, which would imply *multiple* links — but 01-data stores
`contact_link` as a **single** fixed column and **rejected a multi-valued `reach_methods`
table for v1** (cluster E). Multiple links is therefore either a purely visual grouping of the
one column (no schema change) or a reversal of that rejection. Flagged and carried into the
next round rather than recorded as decided.

**[DECIDED] Inline-create-from-capture is a name-only quick-create.** Category and frequency
take silent defaults; `last_contact` defaults **empty** (never-contacted), and the contact is
refined later on the profile.
Rationale: the capture flow "must never fail" (HANDOFF §6; `useShareIntent` destroys unsaved
state on background, 03-fuel), so it stays at one field. **The `last_contact` default inverts
by entry point** — the normal create form defaults to *today*, but a captured contact is by
construction usually someone not yet reached (03-fuel: "the saved thing is often the only
reason to reach out"), so inline-create leaves it empty and the contact lands on the
never-contacted screen. Recorded so the inline path does not blindly reuse the standard form's
"default today."
**[REJECTED] The full create field set inline** — a more complete contact immediately, but a
multi-field form inside the flow whose whole purpose is speed.

**[DECIDED — REVERSES 01-data] A contact holds MANY links, in a new `contact_links` child
table. Phone and email stay single columns.**

> ⚠️ **This reverses a recorded decision.** 01-data cluster F decided *"`contact_link`
> survives as a **fixed column**,"* and cluster E **[REJECTED for v1]** a multi-valued
> `reach_methods` table ("costs a table plus CRUD UI now"). The owner was shown that "many
> links" reverses that and chose it explicitly.
>
> **What dies:** `contact_link` as a single scalar column on `contacts`.
> **What survives untouched:** `phone` and `email` remain single nullable columns (cluster E's
> phone/email decision is *not* touched — the reversal is scoped to links only); the link's
> **actionable** property (tap to open, cluster F) is preserved and now applies per-row.

The links become a `contact_links` table — stable uid, `contact_id`, `url`, optional label,
sort order — consistent with 04-log's rule that every user-data table carries a stable,
globally-unique id so a restore can merge. On the edit form: phone and email are dedicated
inputs; links are a repeatable `+ add link` area.
Rationale (owner's): one URL per person is genuinely too few — LinkedIn *and* Instagram *and* a
personal site are common. The cost 01-data named (a table plus CRUD UI) is accepted.
**[REJECTED] One link, grouped** (the orchestrator's recommendation) — preserves the single
column, but the owner judged multi-link worth the reversal.
*Exported to data, backup, and this domain's own purge list below.*

### Cluster C — Contact lifecycle: archive, restore, purge

**[DECIDED] Archive, restore and purge are a two-stage flow gated by a dedicated
archived-contacts list.** Archive is a low-emphasis action on the contact profile. **Purge and
restore live only on the archived list** — a contact must be archived first, then purged from
the archive.
Rationale: makes permanent deletion a deliberate two-stage act by construction, mirroring the
§14.5 quarantine model that 01-data's archive/purge split was explicitly built to match. The
irreversible action never sits one tap from the reversible one.
**[REJECTED] Archive and purge both on the profile** — fewer screens, but places the one
unrecoverable operation adjacent to the recoverable one.
*Restore has a data contract already waiting (04-log): it writes an `events` row and must merge,
not replace.*

**[DECIDED] Purge shows an impact-summary confirmation that names exactly what will be
destroyed.** *"Permanently delete Chris and 12 interactions, 4 fuel items, 1 photo? This cannot
be undone."* A single strong confirm — no name-typing.
Rationale (owner's risk-posture call): purge fans out to foreign-key-unreachable targets (the
photo file, scheduled notifications) and there is no server, backup or remote repair, so the
gate must show the blast radius — but typing the name is friction the summary already earns
without.
**[REJECTED] Type-the-name** — strongest, but more friction than the summary warrants at this
scale. **[REJECTED] A plain yes/no dialog** — least protection for the only unrecoverable action.

**[DECIDED] Never-contacted and archived are SEPARATE homes.** The never-contacted screen
(01-data) stays its own surface for live-but-unlogged contacts; archived contacts live behind a
distinct, low-traffic "Archived" nav/settings entry.
Rationale: the two populations are semantically different — "new, awaiting first contact" versus
"retired, put away" — and merging them is a category error. **This resolves 01-data's deferred
question** ("whether archived contacts appear on the never-contacted screen") in the negative.
**[REJECTED] One combined "off-dashboard" screen with two sections** — fewer surfaces, but mixes
active with retired.
*Consequence carried from 04-log (still open there): whether an archived contact's clock keeps
running changes what restore must warn about — if it does, restoring lands the contact in
instant deep decay. Exported below.*

### Cluster D — Where net-new settings are edited

**[DECIDED] "Rarely responds" is set with a toggle in the contact edit form, and its label
renders on the profile.** When on, the profile shows *"Rarely responds · attempts don't reset
the orbit."*
Rationale: it is a genuine per-contact property that changes recency math (04-log's filtered
MAX), so it belongs with the other editable contact attributes; the profile shows its effect.
It must **not** fold into the frequency picker (04-log rejected "one control carrying two
unrelated ideas").
**[REJECTED] Profile-toggle only** — keeps the edit form shorter, but splits contact settings
across two surfaces for no clear gain.

**[DECIDED] Favourites rank, `ring_seq`, and sun assignment are NOT this domain's — they are
edited elsewhere and the contact edit form carries none of them.** Favourites rank → widget /
dashboard config (domains 12/8); `ring_seq` → the orrery, by dragging a body (domain 9); sun
assignment → an orrery/profile action writing the global `sun_contact_id` setting (domain 9).
Rationale: these are global, ordering, or visual controls, not per-contact attributes. A global
orrery-ordering override and an app-global sun pointer do not belong in a per-contact form —
that is the category error the "Rarely responds" placement deliberately avoids. This is an
ownership assignment that moves work to domains 8, 9 and 12; recorded as exported constraints so
those runs inherit it.
**[REJECTED] Putting all three in the contact edit form** — one place to edit everything, at the
cost of a busier, heterogeneous form mixing per-contact data with app-global controls.

---

## Cross-domain constraints exported

- **[crud → data]** ⚠ **`contact_link` changes shape: single scalar column → a `contact_links`
  child table** (stable uid, `contact_id`, `url`, optional label, sort order). This **reverses**
  01-data cluster F's "fixed column" form of `contact_link` and is a links-scoped instance of the
  reach-methods table cluster E rejected — owner's explicit call. `phone` and `email` stay single
  columns; the actionable-tap property survives per row.
- **[crud → data]** The **create transaction is multi-row**: a `contacts` row plus, when a
  last-contact date is given, an `interactions` row — written **through 01-data's single-writer
  DAO**, never a create-specific insert. "Not yet / don't know" writes the contact row and **no**
  interaction row (NULL `last_contact` → never-contacted). The create picker applies 04-log's
  future-`occurred_at` rejection.
- **[crud → data]** A create-form backdated interaction row is `source='manual'`, `direction=null`
  (genuinely unknown — must **not** default to `outbound`, which would pollute `intensity`).
- **[crud → fields]** `custom_field_defs` needs a **display-order column from migration 1** —
  §14.10 requires "reorder" and §14.1's table has none; insertion order cannot be backfilled
  (same logic as `created_at`/`ring_seq`). Additive to §14, not a reversal. Custom fields render as
  a block after the fixed columns (never interleaved with them), but still need ordering among
  themselves.
- **[crud → fields / data]** The `label→col_name` slugifier stays a **single producer** (the
  settings field editor) — the contact form does **not** create field definitions. The slugifier
  must reserve the **entire fixed-column name set** (id, name, category_id, interval_days,
  social_battery, birthday, phone, email, photo, last_contact, favourite rank, ring_seq,
  created_at, archived_at, …) so a custom field cannot collide with a fixed column (01-data F17).
- **[crud → fields]** New custom fields default to `show_on_new = false` (see Decisions made
  without you); the create set is (name, category, frequency, last-spoke, phone) + custom fields
  where `show_on_new AND NOT quarantined`.
- **[crud → capture]** Inline-create-from-capture is **name-only**; category/frequency take silent
  defaults and `last_contact` defaults **empty** (never-contacted) — the opposite of the standard
  form's "today". The capture path must not reuse the standard form's default.
- **[crud → data / backup]** Export/restore must include the new `contact_links` table; **purge
  must `DELETE FROM contact_links` explicitly** in the same transaction (FKs are decorative inside
  `withExclusiveTransactionAsync`), alongside the interactions, events, fuel, custom-values, photo
  file and scheduled notifications already named by 01/03/04.
- **[crud → dashboard (8)]** Favourites **rank** is edited on the dashboard/widget config, not the
  contact form — this domain does **not** own that surface.
- **[crud → orrery (9)]** **`ring_seq` (drag-a-body) and sun assignment are edited on the orrery**,
  not the contact form. Domain 9 owns both editing surfaces.
- **[crud → widget (12)]** Favourites selection/ordering is the widget's to edit.
- **[crud → data / log]** Whether an **archived contact's clock keeps running** (04-log left this
  open) determines what the **restore** confirmation must warn about — if it does, restore lands
  the contact in instant deep decay/`rogue`. The restore surface inherits that warning.
- **[crud → notify / photos]** `phone` and `email` are collected as dedicated inputs on the edit
  form (with `phone-pad`/`email-address` keyboards); `photo` uses the native image picker (domain
  7), edit-only, not on the create form.

---

## Deferred to phase discussion

- Exact layout/emphasis of the profile "Archive" action and the archived-contacts list screen
  (naming, nav placement, whether it carries a count).
- Whether the "Archived" entry is a nav item or lives in settings.
- The `contact_links` edit affordance: whether links carry a required label, autocomplete over
  labels already used, and how the actionable tap resolves `tel:`/`mailto:`/`https:`.
- How `phone`, `email` and the links area present together on the **read** side (profile/
  dashboard) — 01-data's deferred "three competing reach affordances" question, now with links
  multi-valued.
- The "add detail / refine later" path for a capture-created name-only contact (which fields it
  surfaces first).
- Whether the "not yet / don't know" create option is visually distinct enough from the "today"
  default that the hand-typed backlog case reads honestly.
- Copy for the "Rarely responds" toggle and its profile label.

---

## Deferred to phase planning

- The single-renderer-vs-two-sections architecture for the form (fixed columns need widgets the
  7-type `FieldType` union cannot express — category-over-a-live-table, `interval_days`,
  partial-date birthday, tri-state last-contact, native image picker). Structural, no
  owner-visible ripple beyond the block-ordering already decided.
- The edit form's initial-values assembly — a JOIN of `contacts` + the contact's
  `contact_custom_values` row + `category_id`→label resolution, built by the §14.10 dynamic query
  layer.
- Splitting the submitted form dict into two writers (fixed `contacts` columns + custom values
  row) in one transaction.
- The custom-interval frequency entry: unit affordance (days/weeks/months → `interval_days`) and
  positive-integer validation.
- Per-type validation-at-entry wiring for the fixed columns (duplicate-name query, partial-date
  birthday, phone format-or-not, category resolution) — these sit outside §14.3's custom-field
  parser table.
- The `AndroidManifest` `<queries>` config plugin if `canOpenURL` guards the actionable-link taps
  (Android 11+ package visibility) — or a plain `openURL` in try/catch to sidestep it.
- The `contact_links` table DDL (stable uid, order column) and its inclusion in export/restore.

---

## Decisions made without you

Orchestrator's picks with no articulable divergence. **Read each as the decision AS ADOPTED.**
Veto any cheaply at review.

1. **Editing a contact's name to collide with an existing name warns the same way create does**
   ("You already have a Chris," + save anyway) — symmetry with 01-data cluster A; the warning is
   UI-only and cheap, and it stops edit silently diverging from create the way the plugin's
   sanitizer did (create sanitized, edit did not — F1).
2. **New custom fields default to `show_on_new = false`** — matches §14.7's intent that the create
   form stay curated; the user opts a field into the create form deliberately.
3. **Fixed columns are always shown on the edit form** (§14.7's "always shows every field" is about
   custom fields; fixed columns are implicitly always-on) and are **never `show_on_new`-configurable**
   — `show_on_new` is a custom-field-only flag.
4. **Custom fields are never `required`** — §14.1's `custom_field_defs` has no required column, so
   `required` is a fixed-column-only concept on mobile (only `name` uses it), diverging from the
   plugin's per-`FieldDef` `required`.
5. **A year-optional birthday is handled with an app-level "year unknown" affordance** (a toggle
   beside the picker; month/day stored, year nullable). Forced by the platform — the native Android
   date picker has **no month+day-only mode** (see Findings F3). This is mechanism, not a product
   choice.
6. **The create form's date picker rejects a future `occurred_at`** at entry — inherited from
   04-log; a future last-contact date silently pins a contact permanently `stable`.
7. **The dropdown "raw value" escape hatch is dropped.** The plugin's `<select>` preserved an
   out-of-options value (`FormRenderer.tsx:124-126`) to survive vault frontmatter drift; with the
   importer cut and category a foreign key to a live table, there is no drifted value to preserve.

---

## Findings

Investigation 2026-08-13. The orchestrator read the plugin's full CRUD path on disk —
`FormRenderer.tsx` (all 316 lines), `ContactManager.ts` (createContact / updateFrontmatter /
appendToInteractionLog), the two built-in schemas, `schemas/types.ts`, `paths.ts`,
`OrbitHubModal.ts:100-234` (handleEdit/handleSave), `main.ts:232-289` (the new-person flow), and
the `Adding People` / `Updating and Editing` docs. Three subagents produced workpapers in
`workpapers/06-crud/`. **Every load-bearing claim below was verified first-hand against the file
cited**, per CLAUDE.md.

### F1 — The plugin's edit form is structurally the create form, with divergent name handling

`handleEdit` (`OrbitHubModal.ts:103-176`) always renders `editPersonSchema`'s **seven hardcoded
fields** (`edit-person.schema.ts:14-70`) — the same seven as create — never the schema that
created the contact, so custom-schema contacts are permanently uneditable (this domain's
inheritance of 01-data F19; §14.7 fixes it by decree). Name handling diverges dangerously: create
routes through `sanitizeFileName` (`paths.ts:15-17`), edit does a bare positional
`contact.file.path.replace(contact.file.name, …)` (`OrbitHubModal.ts:157-160`) with **no
sanitization and no collision check**. Both defects are moot on mobile (name is a metadata column,
not a path), but they are why "warn on edit-rename too" is worth stating (Decision-without-you 1).

### F2 — There is no contact deletion, archive, or lifecycle anywhere in the plugin

Confirmed first-hand: `ContactCard.tsx:78-143`'s context menu is mark-contacted / snooze-1wk /
snooze-1mo / unsnooze / open-note / open-in-new-tab — **no delete or archive**. The Hub edit form
has no delete path. `Archive` appears only as an ignored-path default string (01-data F2). So every
archive/restore/purge surface in Cluster C is net-new; there is nothing to port.

### F3 — The native Android date picker cannot collect month+day without a year

Platform-verified against current docs: `@react-native-community/datetimepicker` (Expo SDK 57
recommends 9.1.0) has no "month/day, no year" mode — none of the Android `display` values drops the
year, and `startOnYearSelection` only changes the opening view. The year-optional birthday (01-data
F) is therefore **app logic**, not a picker mode (Decision-without-you 5). Native pickers *do* exist
for the category and social-battery dropdowns (`@react-native-picker/picker` 2.11.4 or `@expo/ui`
57.0.10), so no JS `<select>` shim is needed. Actionable `tel:`/`mailto:`/`https:` links work via
`Linking.openURL`, but `canOpenURL` as a guard needs an `AndroidManifest <queries>` declaration on
Android 11+ (deferred to planning). Full citations in `platform-form-widgets.md`.

### F4 — The plugin form abstraction is single-destination; mobile splits it in two

`FormRenderer` collects one flat `Record<string,any>` keyed by `field.key`
(`FormRenderer.tsx:37,254`) and `createContact` writes it to one destination via one
`processFrontMatter` (`ContactManager.ts:123-142`). On mobile the same form spans two storage
destinations (fixed `contacts` columns + the `contact_custom_values` row) and two definition
sources (app-hardcoded fixed fields + user `custom_field_defs`). That split is the origin of the
Cluster A questions — renderer unification, ordering, and where field *definitions* are authored —
and of the reserved-name constraint exported above.

### Workpapers

- `workpapers/06-crud/overlap-fields.md` — the `crud` ↔ custom-fields seam (renderer, ordering,
  inline-field, show_on_new, validation regimes)
- `workpapers/06-crud/overlap-data-log.md` — the `crud` ↔ data/log/fuel seam (lifecycle surfaces,
  atomic create, reach methods, settings ownership, frequency)
- `workpapers/06-crud/platform-form-widgets.md` — RN/Expo form-widget verification, versions and URLs
