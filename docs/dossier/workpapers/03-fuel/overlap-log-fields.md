# Workpaper — Seam: domain 3 (`fuel`) × domain 4 (`log`) × domain 2 (`fields`)

**Investigated 2026-08-12.** Every file:line below was opened and confirmed first-hand, per
CLAUDE.md "Review the code, not the diff." Plugin source read in place at `~/projects/Orbit`;
nothing copied into this repo.

**HANDOFF §14 is `[DECIDED]` and is not reopened here.** This workpaper looks for places
where a fuel design would *collide* with §14, and for the one question that decides whether
fuel belongs inside §14 at all.

**Binding inputs treated as settled:** `docs/dossier/01-data.md` in full (its `[data → log]`
exports especially), HANDOFF §1, §6, §14, and CLAUDE.md "Custom fields — invariants."

---

## 0. Executive summary — the four things that change a decision

1. **Fuel is network-egress-by-default; interaction notes are not.** The plugin's shipped
   prompt template sends `{{Conversational Fuel}}` and `{{Small Talk Data}}` and never the
   interaction log (`AiService.ts:26-30`, cf. the default template's full text). Any model in
   which an interaction note becomes fuel — automatically or by a promote button — widens
   what the app's sole network egress transmits. CLAUDE.md: *"Any change that widens what
   that feature transmits is an owner decision."* **This is an escalation, not a design
   detail.**
2. **01-data's own fixed-column test already disqualifies fuel-as-a-custom-field.**
   `01-data.md:316-318`: *"a field earns a fixed column if something that must not break
   reads it — a filter, the AI prompt, the status engine, the importer, or a notification."*
   Fuel is read by a notification (HANDOFF §6), the AI prompt (`AiService.ts:26-27`), and the
   importer (domain 5). §14.5 lets the user quarantine and then permanently `DROP COLUMN` any
   field. The test is already adopted; applying it is enforcement, not a new decision.
3. **Hypotheses 2 and 4 are the same question.** Every lifecycle option except "none" is
   per-item state, and §14.1 gives exactly **one value per contact per field**. So deciding
   fuel has *any* dismissal/aging/provenance decides fuel is not a custom field — and
   conversely, choosing the custom-field model forecloses lifecycle permanently. One owner
   question resolves both.
4. **`01-data.md:461-463`'s export list omits fuel.** Verbatim: *"Export must cover: contacts,
   interactions, the `categories` table, the separate profile record, `ring_seq`, favourites
   rank, custom field defs and values, and (decide) `field_history`."* Fuel is absent, while
   `01-data.md:459-460` makes export *"the only thing standing between a wiped phone and total
   loss."* This seam must close that gap. (Note fairly: under the custom-field model the
   omission is harmless, since "custom field defs and values" would cover it — that is a
   genuine point *for* that model.)

---

## 1. What the plugin actually is at this seam — verified

### 1a. Fuel and the interaction log are siblings by construction, distinguished only by heading text

`ContactManager.ts:20-26` — the default body template creates both sections at once:

```
# {{name}}

## Conversational Fuel
- 

## Interaction Log
```

The same pairing is repeated in the generated example schema (`loader.ts:413-416`) and taught
in `docs/Getting Started.md:48-51` and `docs/Adding People.md:34`. Structurally they are the
same object: a `##` heading followed by a bullet list in one markdown file. Nothing but the
heading string separates them.

This matters because it is the plugin's *implicit* answer to hypothesis 1 — it chose
**"one storage medium, two named sections."** That is neither "two tables" nor "one table
with a kind discriminator"; it is closest to *one table keyed by a user-typed section name*,
with no schema anywhere.

### 1b. Fuel has no write path. Confirmed exhaustively.

Repo-wide grep for `fuel` (case-insensitive, `.ts`/`.tsx`/`.md`) returns: the reader
(`FuelTooltip.tsx`), the type field (`types.ts:87-88`), the two template strings above, docs,
and session logs. **There is no writer.** Further, `parseContact` (`OrbitIndex.ts:147-161`)
constructs its return object with no `fuel` key at all, so `contact.fuel` is permanently
`undefined` and `FuelTooltip.tsx:61-62`'s cached branch is dead code — confirming
`01-data.md:660-664` (F8).

Consequence: **every write-side question in this domain is net-new product surface with no
predecessor to port**, including the one HANDOFF §6 already `[DECIDED]` (share-sheet capture
"attaches as Conversational Fuel").

### 1c. Fuel content is structured; log entries are flat, machine-formatted strings

`parseFuelLines` (`FuelTooltip.tsx:267-305`) recognises exactly three line shapes:

| Shape | Detection | Line |
|---|---|---|
| `listItem` | starts with `- ` | `:277-287` |
| `subheader` | whole line wrapped in `**…**`, no inner `**` | `:288-293` |
| `text` | anything else, inline bold extracted | `:294-301` |

Log entries have exactly one shape. `appendToInteractionLog` writes
`` `- ${timestamp}: ${entry}` `` (`ContactManager.ts:189`) where `entry` is
`` `${data.interactionType}: ${data.note}` `` (`OrbitHubModal.ts:207`). So a log line is
always `- YYYY-MM-DD: type: note` — a `listItem` with no formatting and no sub-header.

**A promoted interaction note is structurally a legal fuel item. A fuel sub-header has no log
analogue.** The compatibility is one-directional.

### 1d. Ordering rules are opposite, and both are load-bearing

`appendToInteractionLog` **prepends**: `lines.splice(headerLineIndex + 1, 0, logEntry)`
(`ContactManager.ts:212`) inserts immediately after the heading, so the log is newest-first
and fully automatic. Fuel ordering is whatever the user typed — hand-authored, semantic,
grouped under sub-headers.

Merging the two into one table (Model C below) forces one ordering rule and one of these
loses. That is a concrete cost, not a stylistic one.

### 1e. The log heading is user-configurable and matched by substring — the two sections can collide

`settings.ts:25,58` declare `interactionLogHeading`, defaulted to `"Interaction Log"` and
editable at `settings.ts:196-198`. `appendToInteractionLog` matches it with
`line.startsWith('## ') && line.includes(heading)` (`ContactManager.ts:199`). A user who sets
the heading to `"Fuel"` would have every logged touchpoint prepended into
`## Conversational Fuel`.

Not a bug worth porting — but it is direct evidence that in the plugin the two things are the
same *kind* of thing, separated only by a string a user controls. On mobile the schema is the
separation, and choosing the schema *is* the decision.

### 1f. The plugin has no single definition of "fuel" — the tooltip and the AI disagree

- Tooltip: `FuelTooltip.tsx:242` — `/^##\s*(?:🗣️\s*)?Conversational Fuel\s*$/im`. Exact
  heading, optional 🗣️ prefix, **nothing else on the line**.
- AI: `extractSection` (`AiService.ts:62-69`) builds `` `^##\\s+.*${escaped}.*$` `` with the
  `m` flag and takes the first match — any heading *containing* the phrase.

So `## 📌 Conversational Fuel (work)` feeds the AI and renders an empty tooltip. Two readers,
two definitions, no schema. This is the strongest argument that fuel needs a *declared*
storage shape on mobile rather than a parsed one.

### 1g. Sub-grouping exists at TWO different levels, and both are schemaless

1. **Bold sub-headers inside the fuel section** — `FuelTooltip.tsx:288-293`, rendered as
   `orbit-fuel-subheader` (`:189-193`). Purely visual, only inside the tooltip, never read by
   anything else.
2. **Sibling `##` sections** — `## Small Talk Data`, `## Work Notes`, `## Birthday Gift Ideas`
   (`docs/AI Features.md:48-58, 63-65, 86-88`). These are addressable **by name** from the AI prompt
   template: `assemblePrompt` step 2 (`AiService.ts:125-138`) replaces any leftover `{{...}}`
   by calling `extractSection(fileContent, name)`, so `{{Any Heading}}` works for a heading the user
   invented five seconds ago. `DEFAULT_PROMPT_TEMPLATE` ships with two of them
   (`AiService.ts:26-30`).

**Both are create-by-typing.** No declaration, no registry, no migration. §14 is
declare-then-fill: creating a field is *"one transaction: `INSERT` a def row **and**
`ALTER TABLE contact_custom_values ADD COLUMN`"* (§14.1). That mismatch is the whole cost of
"buckets are custom fields" — see finding F4.

### 1h. Nothing consumes, dismisses, ages, or archives fuel. Stated plainly.

There is no fuel state anywhere: no timestamp, no flag, no counter, no writer, no sweep.
Fuel is read on hover and rendered. Logging an interaction does not touch it — `handleSave`
(`OrbitHubModal.ts:191-234`) writes frontmatter and optionally appends a log line, and never
reads or writes the fuel section.

**One suggestive detail, offered as inference and not as a stated design:**
`FuelTooltip.tsx:272` normalises `⛔` to `🚫` on every fuel line before parsing —
`line.trim().replace(/⛔/g, "🚫")`. That is a display substitution of one prohibition emoji
for another. Someone was hand-marking fuel items with a "don't" symbol and cared enough about
their appearance to normalise it in code. Read cautiously, that is **hand-rolled per-item
state in a system that has none** — evidence the need is real, met by typing. It is not proof
of intent; the owner should confirm what he was marking.

---

## 2. Hypothesis 1 — fuel vs interaction note

The real product question underneath: **is "we talked about his new dog" a record of a past
conversation, or a prompt for the next one?** In the plugin they were physically different
(log written by code, fuel written by hand in a desktop editor). On mobile both are typed into
the same phone by the same thumb, seconds apart. That is what makes this a live question and
not a port decision.

Three models, and what each forbids downstream. Binding 01-data rules referenced by line.

### Model A — strictly separate tables (`fuel_items`, `interactions`)

**Forbids nothing in 01-data.** Every `[data → log]` export survives untouched: touchpoints
insert interaction rows (`01-data.md:71-77`), rows stay fully editable and edits move status
(`:95-100`), `last_contact` stays MAX-over-current-values with exactly one writer
(`:102-108`, `:428-431`), and the `(contact_id, date DESC)` index (`:132-136`) keeps covering
only interactions so the newest-per-contact seek estimate at `:118-127` remains valid.

**Cost, and it is the product's stated failure mode.** The user types "we talked about his new
dog" into the note and it does not become fuel. Capturing it as fuel is a second action.
HANDOFF §6: *"The Obsidian version fell out of use because capture was too high-friction. This
is the primary product risk."* Model A re-imposes double entry at exactly the moment the note
was already typed.

**Decision it forces:** does the log-a-touchpoint sheet carry a second affordance ("…and keep
as fuel")? That is one extra tap in the most-fired flow, which HANDOFF §1 says every decision
must be measured against.

### Model B — interaction notes promotable to fuel

Two sub-variants that diverge sharply and must not be conflated.

**B1 — promotion copies the text** into a new `fuel_items` row.
Breaks against `01-data.md:95-100`, which makes after-the-fact editing of interaction rows a
**primary workflow, stated verbatim by the owner** ("log the touchpoint quickly with no date
so it auto-stamps now, then fix the date and time later"). Editing the note after promotion
leaves two divergent truths with no reconciliation. Cheap; silently wrong.

**B2 — promotion references the interaction row** (`fuel_items.source_interaction_id`).
Breaks against `01-data.md:102-108`, which makes interaction **deletion** a live, supported
path (MAX is recomputed "after every insert, edit and delete"). Deleting a mis-logged
touchpoint would silently delete the fuel item the user derived from it. Requires an explicit
FK rule — `ON DELETE SET NULL` with the text denormalised into `fuel_items`, or a documented
cascade — and `PRAGMA foreign_keys = ON` is itself only decorative unless set per
`01-data.md:534-535`, and is unconditionally **off** inside `withExclusiveTransactionAsync`
(`01-data.md:763-766`).

**Both variants trip the egress escalation** — §0 item 1 and Q2 in §7.

### Model C — one table with a `kind` discriminator

Collides with 01-data in three named places:

1. **The MAX predicate.** `contacts.last_contact` = MAX over interaction rows
   (`01-data.md:102-108`). Unified, every recompute must carry `WHERE kind = 'interaction'`.
   One omission and adding a fuel item marks the contact as contacted — moving status,
   resetting the orrery angle, and cancelling a decay notification. This is exactly the class
   of bug 01-data rejected an `is_self` flag to avoid: *"every query would need
   `WHERE is_self = 0`, and one omission puts the user in their own digest, notifications, or
   decay list"* (`01-data.md:265-267`). The precedent is already adopted.
2. **One column, two meanings.** Interactions store a **local datetime of a touchpoint**
   (`01-data.md:112-116`) and carry a channel (`:118-127`). A fuel item's timestamp means
   *captured at*, and it has no channel. Same column, two facts.
3. **The index.** `(contact_id, date DESC)` (`01-data.md:132-136`) would now span fuel rows,
   so every newest-interaction seek reads through them. Small at HANDOFF §10 scale, but it
   invalidates the stated O(N log M) reasoning at `01-data.md:123-127`.

Model C's only genuine upside — one insert path, one editor — is available inside Model A by
putting a shared UI over two tables. **The upside does not require the schema.**

### The one-tap constraint cuts across all three

`01-data.md:71-77` and `:430`: *every* touchpoint from *every* route inserts a row, including
widget tiles and notification actions, with a **null note**. Those are the most-fired paths.
So whatever fuel↔note relationship is chosen, it must degrade to nothing when the note is
null — no promotion prompt, no "did you talk about this?", no blocking. Any design that
assumes a note exists is wrong for the majority of rows.

---

## 3. Hypothesis 2 — is fuel just a `textarea` custom field?

### The strongest case FOR

- **§14 already delivers exactly this shape.** `textarea` is a shipped field type (§14.3,
  §14.8; `schemas/types.ts:20`), and §14 gives user-named free text, one value per contact.
- **A single TEXT blob is a *faithful* port.** `parseFuelSection` returns one string
  (`FuelTooltip.tsx:240-261`); the cached form was `string[]` immediately re-joined with
  `"\n"` (`:62`). The plugin's fuel genuinely is one blob of markdown per contact.
- **Everything downstream is already built.** Field editor, edit form ("always shows every
  non-quarantined field", §14.7), profile display ("shows whenever it has a value", §14.7),
  export (`02-fields.md:28`), quarantine + `field_history` undo (§14.5, §14.6), and the
  importer's unknown-key→custom-field mapping (`02-fields.md:27`). Fuel costs **zero new
  tables and zero new UI**.
- **It makes user-named buckets free and 1:1 with the plugin's AI model.** A user who wants
  `Small Talk Data` and `Work Notes` creates two textarea fields — the same
  `{{Any Heading}}` scheme (`docs/AI Features.md:86-88`) with a declaration behind it.
- **It closes the export gap by construction** — see F5.

### The strongest case AGAINST — each claim checked against §14's text

| What fuel needs | §14's actual text | Verdict |
|---|---|---|
| **Per-item rows** | §14.1: *"one COLUMN per field and one ROW per contact"* | Structurally impossible. One value per (contact, field). Per-item anything means parsing the blob — reintroducing exactly the regex-markdown-parsing (`FuelTooltip.tsx:267-305`) the mobile rewrite exists to delete. |
| **Per-item timestamp / provenance** | Same | Impossible. HANDOFF §6 `[DECIDED]` share-sheet capture attaches a link as fuel; a blob cannot record when, or from which app, or the source URL. |
| **Per-item dismissal** | Same | Impossible. See §4. |
| **Ordering within the value** | §14.2's `sortExpr()` sorts *contacts by a field's value*; there is no item-level concept | No mechanism exists. |
| **Indexing / search across fuel** | §14.11 + CLAUDE.md: *"Never add an index or a UNIQUE constraint to a column in `contact_custom_values`"* — `DROP COLUMN` fails on indexed columns | Permanently unindexable. **Honest caveat:** at HANDOFF §10 scale (tens of contacts) a full scan is free, so this only bites if fuel is ever searched. Weak objection today. |
| **Survives the user's own settings screen** | §14.5: any field holding values gets **Quarantine**, and the launch sweep then `DROP COLUMN`s it permanently | **Decisive.** The notification action (HANDOFF §6) and the AI prompt would depend on a field the user can delete. |
| **Survives a type change** | §14.4: type is user-editable; changing to `number` runs the number parser, flags every value, and renders *"unrecognized value — tap to fix"* on every profile (§14.4 step 5) | Data survives (§14.4 destroys nothing), but the feature dies until manually repaired. A dedicated table cannot be typed into uselessness. |
| **Long-lived undo** | §14.6: `field_history` is swept on the same 30-day schedule | Mismatch. Fuel accrues over years; its only backstop expires in a month. |

### The decisive argument is already adopted, not new

`01-data.md:316-318` states the test verbatim:

> *"a field earns a fixed column if something that must not break reads it — a filter, the AI
> prompt, the status engine, the importer, or a notification. Custom fields can be quarantined
> or deleted by the user."*

Fuel is read by **a notification** (HANDOFF §6: the decay notification opens the SMS composer
"with their Conversational Fuel visible"), **the AI prompt** (`AiService.ts:26-27`), and
**the importer** (domain 5 parses the `## Conversational Fuel` section). It scores three of
the five triggers. 01-data applied this same test to reject exactly this shape for `category`:

> *"**[REJECTED] Category as just a custom dropdown field** — §14 machinery would cover it,
> but grouping, the AI prompt and the importer would then depend on a field the user can
> quarantine or delete."* (`01-data.md:227-229`)

Fuel has the identical property, more strongly. **Applying an adopted test is a planner call;
it does not reopen §14 and does not reverse anything §14 decided** — §14 remains exactly as
written and simply does not own fuel.

### A concrete second-order cost nobody has costed: the notification can't find the field

There is no fixed `col_name` in §14 — column names are constructed from user labels, and per
`01-data.md:410-414` they must be **whitelist-constructed, never escaped**, with the importer
as a second untrusted producer (F17). So a notification handler (running with the app possibly
cold) that wants "the fuel field" must first read `custom_field_defs` to discover *which*
column that is, via a settings pointer the user set. That pointer breaks when the field is
renamed, quarantined, or dropped. That indirection is a real design object with a real failure
mode, and it exists only under the custom-field model.

---

## 4. Hypothesis 4 — consumption and lifecycle

**Plainly: nothing in the plugin does any of this.** See §1h — there is no fuel state of any
kind, and `handleSave` (`OrbitHubModal.ts:191-234`) never touches the fuel section. The only
trace of per-item marking is the hand-typed ⛔ normalised at `FuelTooltip.tsx:272`, offered
above as inference.

### Options and their storage costs, ranked by tap cost against HANDOFF §1

| Option | Storage | Taps | What it buys / breaks |
|---|---|---|---|
| **None** — items permanent until manually deleted | zero | 0 | Matches the plugin exactly. Fuel becomes a stale wall; *"did I already talk about the dog?"* is unanswerable, and the user re-reads the whole list before every message — friction inside the exact loop §1 exists to minimise. |
| **`dismissed_at` nullable column** on `fuel_items` | one nullable column, one `UPDATE`, one predicate on read | 1, only when wanted | Hide-used, show-dismissed toggle, and undo by nulling it — no `field_history` involvement. Cheapest non-trivial lifecycle. |
| **`used_count` + `last_used_at`** | two columns | 1 | Supports *"we've talked about this three times."* Strictly more than dismissal; decide if the extra fact is real. |
| **Auto-consume on logging an interaction** | reuses either of the above | **0** | The only self-cleaning option, and free in taps — but **wrong for the majority of rows**. `01-data.md:71-77, :430` make widget-tile and notification one-taps first-class, note-less touchpoints. The user tapped a home-screen tile and never opened the app; nothing was discussed. Gating auto-consume on the route makes routes stop being interchangeable, which 01-data deliberately made them. |
| **Explicit "used it" checkbox in the send flow** | reuses the above | 1, **always** | Accurate; costs a tap in precisely the flow §1 says to keep cheapest. |

### The finding that collapses two hypotheses into one question

Every row above except "None" is **per-item state**. §14.1 gives one value per contact per
field. Therefore:

> **Deciding fuel has any lifecycle at all decides fuel is not a custom field. Choosing the
> custom-field model forecloses lifecycle permanently, on every device, with no migration
> path that isn't a new table anyway.**

Ask the owner one question, not two.

---

## 5. Hypothesis 3 — sub-grouping

The plugin supports two grouping levels (§1g). The question is whether mobile fuel items carry
a user-named bucket, and whether §14 fields can be those buckets.

### Can §14 custom fields be the buckets? What breaks

**F4 — quarantining a bucket orphans fuel rows, and §14's own reasoning says so.**
§14.5 states: *"Deleting a defs row does not drop a column. `ON DELETE CASCADE` deletes rows,
never columns. Both statements must appear explicitly in one transaction."* The **inverse**
hazard applies to fuel: **dropping a column does not delete rows in another table that
reference that field by name.** Nothing in §14 has, or can have, a foreign key to a
`col_name` — a column name is schema, not data. So:

- **At quarantine:** `quarantined_at` is set and *"the UI stops rendering the field
  everywhere"* (§14.5). Fuel items in that bucket vanish from the profile while their rows
  survive. Data is intact but invisible, with no error state (§14.4's error rendering covers
  unparseable *values*, not orphaned references).
- **At expiry:** the launch sweep runs `DELETE FROM custom_field_defs` + `ALTER TABLE
  contact_custom_values DROP COLUMN` in one transaction (§14.5). The fuel rows referencing
  that bucket are untouched by both statements and become permanent orphans pointing at a
  name that no longer exists.
- **Nothing watches a timestamp** (§14.5, CLAUDE.md), so this surfaces at a launch sweep days
  or weeks after the user's action, with no connection in their mind between the two.

Repairing this means teaching §14's sweep about a fuel table — i.e. giving §14 a dependency it
was explicitly designed not to have. That is a collision worth naming to the owner.

**F4b — a bucket the AI prompt names must not be quarantinable.** The plugin's prompt template
references sections *by name* (`AiService.ts:26-30`, `docs/AI Features.md:86-88`). If buckets
are custom fields, a prompt template naming a bucket depends on a user-deletable field —
`01-data.md:227-229`'s rejected `category` shape, exactly.

### Alternatives worth putting to the owner

1. **No buckets.** One flat list per contact. Cheapest; matches what `parseFuelLines`
   actually renders for a flat bullet list. The sub-header capability existed and we have no
   evidence of how heavily it was used — ask.
2. **A free-text `section` string on `fuel_items`.** Create-by-typing, like the plugin. Zero
   DDL, no defs table, no quarantine interaction. Downside: typos fragment buckets (this is
   what produced F6's category incoherence, `01-data.md:636-649`), and nothing constrains the
   AI prompt's names.
3. **A small dedicated `fuel_sections` table** (id, label, sort order), FK from `fuel_items`.
   Rename is a one-row `UPDATE`; delete cascades or re-parents by real FK with
   `PRAGMA foreign_keys = ON`. This is precisely the shape 01-data chose for `categories`
   (`01-data.md:218-224`) and for the same reason. Costs one table.
4. **Buckets are §14 custom fields.** Free UI, but F4 and F4b above.

The `categories` precedent (option 3) is the closest structural analogue in the project and it
was already argued and adopted.

---

## 6. Hypothesis 5 — purge and export

### Purge

`01-data.md:83-88` already names fuel: *"Purge destroys everything the contact owns…
Interactions, fuel, custom values, the photo file on disk, scheduled notifications, and field
history all go."* So purge is **decided** for the dedicated-table model — a `contact_id` FK
with `PRAGMA foreign_keys = ON` set in `onInit` before any transaction opens
(`01-data.md:533-535`), noting that foreign keys are unconditionally **off** inside
`withExclusiveTransactionAsync` (`01-data.md:763-766`), so the purge transaction must delete
fuel rows explicitly rather than trusting a cascade.

**Two purge questions fuel adds that 01-data did not answer:**

- **F6a — fuel provenance may put files on disk.** `01-data.md:92-93` names only *the photo
  file* as unreachable-by-FK. Share-sheet capture (HANDOFF §6) can hand the app an image, a
  cached thumbnail, or an OG-preview asset. If a fuel item stores any of those, purge gains a
  **second** application-level file-cleanup target, and 01-data's list is incomplete.
  `01-data.md:464-465` (`[data → photos]`) covers only `contacts.photo`.
- **F6b — under Model B2, purge order matters.** Deleting interactions before fuel rows that
  reference them will fire the FK rule mid-transaction. Needs an explicit ordering.

**F6c — two destroy paths with different scopes, if fuel is a custom field.** Purging a
contact deletes their row in `contact_custom_values` (correct, scoped to one contact), while
§14.5's quarantine sweep can `DROP COLUMN` the fuel field for **all** contacts at once —
different scope, different trigger, different undo (`field_history` vs. nothing, and
`01-data.md:83-91` deliberately scoped `field_history` away from purged contacts). Two ways to
destroy the same data with divergent semantics is a design smell the owner should see before
choosing.

### Export

**F5 — fuel is missing from 01-data's export list.** `01-data.md:461-463` enumerates
contacts, interactions, `categories`, the profile record, `ring_seq`, favourites rank, custom
field defs and values, and (decide) `field_history`. **Fuel is not there**, while
`01-data.md:459-460` promotes export to *"load-bearing, not optional"* and *"the only thing
standing between a wiped phone and total loss."* Whatever shape fuel takes, this list needs
amending. Stated fairly: under the custom-field model the list is already complete, which is a
real point in that model's favour.

**F5b — fuel is the one payload with a plausible round-trip back to Obsidian.** A
`## Conversational Fuel` section is exactly what `FuelTooltip.parseFuelSection`
(`FuelTooltip.tsx:240-261`) reads. If fuel is per-item rows carrying `captured_at`,
`dismissed_at`, source URL and bucket, a markdown export **loses all of it** and a re-import
cannot reconstruct it. HANDOFF §3 says "JSON export/import"; if that is the only format, the
anti-lock-in promise (HANDOFF §8) means "your data in JSON," not "back into your vault." Worth
deciding explicitly rather than discovering later.

**F5c — export shape must survive the sub-grouping choice.** If buckets are §14 fields, export
already covers them (`02-fields.md:28`) but fuel rows would carry a `col_name` reference that
is meaningless after a re-import into a database where the field was created with a different
`col_name` (labels → slugs are constructed, `01-data.md:410-414`). Export must carry the
bucket **label**, not the column name.

---

## 7. Design questions for the owner — each changes a decision

**Q1. Does an interaction note ever become fuel?** (Model A / B1 / B2 / C above.)
Divergence: A costs a duplicate-entry tap in the flow HANDOFF §6 blames for the plugin's
failure; B1 creates two divergent truths against 01-data's *primary* edit workflow
(`01-data.md:95-100`); B2 makes fuel deletable by correcting a log; C puts a `kind` predicate
on the MAX that maintains `last_contact` (`01-data.md:102-108`), which 01-data already
rejected the analogous shape of at `:265-267`.

**Q2. ⚠ Owner-only — egress.** If notes can become fuel, an interaction note the user typed
for themselves becomes prompt content sent to a third-party provider by default
(`AiService.ts:26-30` sends fuel, never the log). CLAUDE.md: *"Any change that widens what that
feature transmits is an owner decision."* Sub-question: does a promoted item get an
"exclude from AI" flag, or is the promote button itself the consent?

**Q3. Does a fuel item have any lifecycle?** (§4.) This single answer also settles Q4.
If yes → fuel needs per-item rows → fuel is not a §14 custom field, permanently.

**Q4. Is fuel a §14 `textarea` custom field, or its own table?** (§3.) The adopted fixed-column
test at `01-data.md:316-318` already answers this — fuel is read by a notification, the AI
prompt and the importer — but the owner should see the trade named, because the custom-field
model is genuinely free and closes the export gap by construction.

**Q5. Do fuel items carry a user-named bucket, and what owns the bucket names?** (§5.)
Four options; the `categories` table precedent (`01-data.md:218-224`) is the closest analogue.
If buckets are §14 fields, F4's orphan-on-`DROP COLUMN` needs an owner-visible answer.

**Q6. Do fuel items carry a timestamp?** If yes, the profile now has two reverse-chronological
free-text lists about the same person (fuel and the interaction timeline unlocked by
`01-data.md:74-77`). Whether they render merged or separate is a `dashboard`/`crud` call, but
whether the timestamp exists is a **data** call and must be made here.

**Q7. Does share-sheet capture store anything on disk?** (F6a.) If yes, purge gains a second
file-cleanup target that `01-data.md:92-93` does not list.

**Q8. Does export round-trip fuel back to Obsidian markdown, or JSON only?** (F5b.)

---

## 8. Cross-domain constraints this seam imposes

- **[fuel → ai] ⚠ ESCALATION.** Fuel is network-egress-by-default (`AiService.ts:26-30`); the
  interaction log is not. Mechanism confirmed: `assemblePrompt` returns the *rendered
  template*, so only sections the template names by placeholder leave the device
  (`AiService.ts:125-138`; `handleSuggest` passes that string straight to `generate`,
  `OrbitHubModal.ts:288-292`). The default template names fuel and never the log. Any
  note→fuel path — automatic or by button — therefore widens the app's sole network egress
  and is an owner decision per CLAUDE.md. Corollary for domain 13: on mobile there is no note
  body to `{{Any Heading}}` against, so whatever fuel's schema is *becomes* the definition of
  what the prompt can reach.
- **[fuel → backup] `01-data.md:461-463`'s export list must be amended to name fuel** (and its
  buckets, timestamps and provenance, if those exist). Export is load-bearing
  (`01-data.md:459-460`).
- **[fuel → data]** If fuel gets its own table, `01-data.md:83-88`'s purge decision already
  covers it — but the delete must be explicit inside the transaction, because foreign keys are
  unconditionally off inside `withExclusiveTransactionAsync` (`01-data.md:763-766`).
- **[fuel → data]** If share-sheet capture writes files, purge gains a second
  unreachable-by-FK cleanup target beyond `contacts.photo` (`01-data.md:92-93`, `:465`).
- **[fuel → log]** Whatever fuel↔note relationship is chosen must degrade to nothing when the
  note is null — the highest-volume touchpoint routes write note-less rows
  (`01-data.md:71-77`, `:430`).
- **[fuel → log]** If fuel references interactions, the FK rule on interaction **delete** must
  be explicit; deletion is a supported path (`01-data.md:102-108`).
- **[fuel → fields]** If fuel or its buckets live in §14, the launch sweep gains a dependency
  §14 was designed not to have: `DROP COLUMN` cannot cascade to rows in another table, so
  orphan handling must be added to the sweep (§14.5).
- **[fuel → fields]** If buckets are §14 fields, export must carry the bucket **label**, not
  the constructed `col_name` (`01-data.md:410-414`).
- **[fuel → notify]** HANDOFF §6 requires a notification action to display fuel with the app
  possibly cold. Under the custom-field model this requires a settings pointer to "which field
  is fuel," which breaks on rename/quarantine/drop.
- **[fuel → import]** The plugin has two disagreeing definitions of the fuel section
  (`FuelTooltip.tsx:242` strict vs. `AiService.extractSection` substring). The importer must
  pick one and it should be the loose one, or real vault files with decorated headings import
  as empty.
- **[fuel → capture]** HANDOFF §6's share-sheet capture is the **first and only write path
  fuel has ever had**; there is nothing to port. Its payload shape (text? URL? title? source
  app? image?) is what decides whether a single TEXT blob can hold fuel at all.

---

## 9. Honest limits of this investigation

- The ⛔→🚫 normalisation (`FuelTooltip.tsx:272`) is read here as evidence of hand-rolled
  per-item marking. That is **inference from a display-only regex**, not a documented design.
  The owner should confirm what he was marking before it is weighted.
- I did not find real vault fuel content — only the plugin's templates and the doc examples
  (`docs/AI Features.md:48-58`). How heavily sub-headers and sibling sections were actually
  used is an owner question, and it materially affects Q5.
- No claim here rests on the graph; `graph:ask` cannot see SQL and there is no `src/` yet
  (`01-data.md:778-779`, F16.1).
