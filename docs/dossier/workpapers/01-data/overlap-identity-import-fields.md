# Workpaper — Seam: domain 1 (`data`) × domain 2 (`fields`) × domain 5 (`import`) × domain 6 (`crud`)

**Scope.** What a contact's *identity* is, and the boundary between the fixed `contacts` schema,
the custom-fields system (HANDOFF §14, `[DECIDED]`), and the vault importer. Concretely: which
Obsidian frontmatter keys become fixed columns, which become auto-created `custom_field_defs`
rows, and which are dropped.

**Method.** Full read of the actual plugin source on disk at `~/projects/Orbit` (not diffs, not
summaries): `schemas/loader.ts` (all 479 lines), `schemas/types.ts`, both built-in schemas,
`services/ContactManager.ts`, `services/OrbitIndex.ts`, `services/LinkListener.ts`,
`utils/paths.ts`, `modals/OrbitFormModal.ts`, `modals/OrbitHubModal.ts`,
`components/ContactCard.tsx`, `components/FormRenderer.tsx`, `main.ts`, `settings.ts`, `types.ts`;
plus `test/integration/edit-flow.test.ts`, `test/unit/modals/orbit-hub-modal.test.ts`,
`test/unit/modals/orbit-form-modal-prefill.test.ts`, `test/unit/schemas/loader.test.ts`,
`test/unit/services/contact-manager.test.ts`; plus `docs/Adding People.md`,
`docs/Custom Schemas.md`, `docs/Updating and Editing.md`, `docs/Getting Started.md`. Every line
number below was verified by opening the file. HANDOFF §14 is `[DECIDED]` and is treated here as
a constraint to be satisfied, never re-litigated.

**Headline.** The brief's hypothesis is confirmed on every point, and the plugin's identity model
is weaker than "filename is identity" makes it sound. There is **no stable identifier of any kind**
— not a UUID, not a slug, not a creation timestamp. The index is keyed by a *mutable file path*
(`OrbitIndex.ts:78`), display name is a *derived substring of that path* (`OrbitIndex.ts:149`),
and the one place a name is resolved to a contact does a **first-match-wins linear scan on
lowercased basenames** (`LinkListener.ts:88-100`). Three independent things the SQLite rewrite
must decide are currently all the same thing, by accident.

---

## 1. Identity

### 1a. Confirmed: the filename is the identity, and `name` is never written to frontmatter

Both halves verified.

- **Read.** `OrbitIndex.parseContact()` builds `name: file.basename` (`OrbitIndex.ts:149`). It
  never reads a `name` key. `OrbitContact.name` is documented as "derived from file basename"
  (`types.ts:51-52`).
- **Write.** `ContactManager.createContact()` iterates the schema's fields and skips exactly one:

  ```ts
  for (const field of schema.fields) {
      if (field.key === 'name') continue; // name is the filename, not frontmatter
      const value = formData[field.key];
      fm[field.key] = value ?? field.default ?? '';
  }
  ```
  `ContactManager.ts:129-133`. The comment is the plugin author's own.

  This is an asserted invariant, not an accident:
  `test/unit/services/contact-manager.test.ts:152-158`, *"does not set 'name' in frontmatter (name
  is the filename)"*, asserts `expect(getCapturedFm().name).toBeUndefined()`.

- The same skip is repeated independently in the edit path, `OrbitHubModal.ts:146`
  (`if (field.key === 'name') continue; // name is filename, handled separately`), asserted at
  `test/integration/edit-flow.test.ts:204, 232`.

`name` is therefore **not** a frontmatter key at all. It is a projection of the file path. On
SQLite there is no file path, so `name` becomes a real column for the first time — a change of
kind, not of storage.

### 1b. Rename: the index re-keys and re-derives, and loses nothing because it holds nothing

`OrbitIndex.handleFileRename()` (`OrbitIndex.ts:296-310`):

```ts
this.contacts.delete(oldPath);
if (!this.isIgnoredPath(file.path)) {
    const contact = this.parseContact(file);
    if (contact) this.contacts.set(file.path, contact);
}
```

Delete the old key, re-parse from scratch, insert under the new key. Wired at `main.ts:91-96`.

This is lossless **only because the index is a pure derived cache** — everything it holds comes
from the file, so re-deriving is total. Nothing is anchored to the old identity: no history rows,
no relations, no foreign keys. There is nothing to orphan.

The moment contacts have children in SQLite — interaction rows, fuel items, `contact_custom_values`
rows, `field_history` rows, photo files on disk — that property evaporates. **The plugin gives no
guidance here because the problem does not exist in it.**

Note also `handleFileRename` reacts to Obsidian's `rename` event, which also fires for *moves*.
A move between category folders re-keys the contact but does **not** update `category` frontmatter
— path and `category` drift silently (see §1e).

### 1c. Two contacts with the same name in different folders: both exist; name resolution is arbitrary

- **The index tolerates it.** Keyed by `file.path` (`OrbitIndex.ts:78`), so `People/Work/Chris.md`
  and `People/Friends/Chris.md` are two distinct entries. `getContact(path)` (`OrbitIndex.ts:332`)
  is path-based and unambiguous.
- **The dashboard renders both as "Chris."** `ContactCard` shows `contact.name`
  (`ContactCard.tsx:303`) with no disambiguator. The initials-avatar colour is
  `stringToColor(contact.name)` (`ContactCard.tsx:34-43, 297`) — a hash of the name — so two
  same-named contacts get the *same* fallback avatar colour. Visually indistinguishable.
- **Name→contact resolution is first-match-wins.** `LinkListener.findContactByName()`
  (`LinkListener.ts:88-100`):

  ```ts
  const normalizedName = name.toLowerCase().trim();
  for (const contact of contacts) {
      if (contact.file.basename.toLowerCase() === normalizedName) return contact;
  }
  return null;
  ```

  Iteration order is `Map` insertion order, i.e. vault-scan order (`OrbitIndex.ts:73-80`), which
  is filesystem-dependent. Typing `[[Chris]]` in a daily note marks **whichever Chris was scanned
  first** as contacted today, silently, via a one-click notification (`LinkListener.ts:117-136`).
  Matching is case-insensitive, so `[[chris]]` also resolves.

  `LinkListener.ts` is on HANDOFF §4's *delete* list, so this exact code does not port. Its
  *function* does: any mobile feature that resolves a human-typed or externally-supplied name to a
  contact — share-sheet capture (domain 10), the importer (domain 5), a JSON restore (domain 15) —
  needs an answer this codebase does not contain.

- **Creation does not collide-check.** `createContact` calls `app.vault.create(filePath, …)`
  (`ContactManager.ts:119`) with no prior existence check, and the caller
  (`main.ts:240-269`, `openNewPersonFlow`'s `onSubmit`) has **no `try`/`catch`**. Creating a second
  "Chris" in the same category throws an unhandled rejection. Same name in a *different* category
  succeeds silently, because the category is a path segment (`ContactManager.ts:106-110`).

**Conclusion: names are not unique in the plugin, and nothing enforces or even detects it.** The
duplicate case is reachable, unflagged, and silently mis-resolving.

### 1d. Is there a stable ID anywhere? No.

Grepped the full `src/` tree. There is no UUID, no `id` frontmatter key, no `created` timestamp,
no content hash. `OrbitContact` (`types.ts:47-89`) carries `file: TFile` and `name: string`; the
serialized state dump (`OrbitIndex.saveStateToDisk`, `OrbitIndex.ts:366-412`) writes `name` and
`filePath` and nothing else identity-like. The only two candidate keys are:

| Candidate | Stability | Uniqueness |
|---|---|---|
| `file.path` | Breaks on rename **and on move** | Unique (filesystem-enforced) |
| `file.basename` (= `name`) | Breaks on rename | **Not unique** — §1c |

Neither is a primary key. **This is the strongest single argument in the plugin's source for a
surrogate key in SQLite.**

### 1e. What the edit form does when `name` changes: it renames the file — imperfectly

Traced precisely through `OrbitHubModal.handleEdit()` (`OrbitHubModal.ts:103-176`).

**Step 1 — prefill.** `initialValues` is built from seven hardcoded keys (`OrbitHubModal.ts:111-119`),
six from the `OrbitContact` object and `contact_link` read directly from the raw metadata cache
(`OrbitHubModal.ts:108-109, 118`). `name: contact.name` — i.e. the basename.

**Step 2 — write frontmatter.** On submit, it loops `editPersonSchema.fields`, skips `name`, and
merges the rest (`OrbitHubModal.ts:144-153`) via the merge-only `updateFrontmatter`
(`ContactManager.ts:158-169`).

**Step 3 — rename.** `OrbitHubModal.ts:155-162`:

```ts
if (formData.name && formData.name !== contact.name) {
    const newPath = contact.file.path.replace(
        contact.file.name,
        `${formData.name}.md`
    );
    await this.plugin.app.fileManager.renameFile(contact.file, newPath);
}
```

So: **it renames the file. It does not silently do nothing.** Asserted twice —
`test/integration/edit-flow.test.ts:235-257` (expects exactly `'People/Alice Smith.md'`) and
`test/unit/modals/orbit-hub-modal.test.ts:361-386`; the no-op-on-unchanged case at
`edit-flow.test.ts:259-277` and `orbit-hub-modal.test.ts:388-404`.

Four defects in those eight lines, each of which is a requirement in disguise for the rewrite:

1. **No sanitization.** `formData.name` goes into the path raw. Compare creation, which routes
   through `buildContactPath()` → `sanitizeFileName()`, stripping `\ / : * ? " < > |`
   (`paths.ts:15-30`, called at `ContactManager.ts:110`). Renaming to `John/Jane` builds
   `People/John/Jane.md`. **Create and edit disagree about what a legal name is.**
   `FormRenderer` validation is HTML5 `required` only (`FormRenderer.tsx:108, 120, 140, 169, 186, 237`)
   — no trim, no charset check, no uniqueness check.
2. **No collision check.** Renaming Alice to an existing "Bob" hands a duplicate path to
   `renameFile`.
3. **`String.replace` on a path is positional.** It replaces the *first* occurrence of
   `file.name` in `file.path`, not the last segment.
4. **The category folder is never reconciled.** The rename preserves the existing directory. In
   the plugin's own fixture the contact sits at `People/Alice.md` while carrying
   `category: 'Friends'` (`edit-flow.test.ts:106-119`), and the test changes category to
   `'Friends'` and still expects `People/Alice Smith.md` (`edit-flow.test.ts:244, 253-256`).
   **Category and location are already permanently out of sync in the plugin**, even though
   creation derives location *from* category (`ContactManager.ts:106-110`, documented at
   `docs/Adding People.md` "File placement").

**Consequence for identity in SQLite.** The plugin's rename is a *destructive re-identification*:
it changes the identity and the display name in one indivisible act, and the only reason that is
safe is §1b (nothing is anchored to identity). Splitting `name` (a mutable display column) from a
surrogate `id` (immutable) is not a "nice to have" — it is the thing that makes rename a
one-column `UPDATE` instead of a cascade.

---

## 2. The complete frontmatter key set

Every key the plugin reads or writes on a **contact note**, from all sources. Enumerated by
grepping every `frontmatter.*` / `fm.*` access and every `processFrontMatter` call site in `src/`,
then cross-checked against the built-in schemas, the tests, and the four user docs.

| Key | Direction | Read by | Written by | Notes |
|---|---|---|---|---|
| `tags` | **both** | `OrbitIndex.hasPersonTag()` — `OrbitIndex.ts:167-188` | `ContactManager.ts:125` (`fm.tags = [settings.personTag]`) | **The membership gate.** No matching tag ⇒ not a contact at all (`OrbitIndex.ts:116`). Default `"people"` (`settings.ts:53`). Matching is case-insensitive and accepts **either** a frontmatter array **or** an inline `#people` tag in the body (`OrbitIndex.ts:180-186`). |
| `frequency` | both | `OrbitIndex.ts:122-125` → `isValidFrequency` | `ContactManager.ts:132`; `OrbitHubModal.ts:150` | Invalid/missing silently defaults to `"Monthly"` (`OrbitIndex.ts:123-125`). |
| `last_contact` | both | `OrbitIndex.ts:128` | `ContactManager.ts:136-138`; `OrbitHubModal.ts:201`; `ContactCard.tsx:153`; `LinkListener.ts:155` | **Four writers.** See the `data`×`log` workpaper. |
| `snooze_until` | both | `OrbitIndex.ts:131-134` | `ContactCard.tsx:173` (set); `ContactCard.tsx:189` (`delete`) | Only key the plugin ever *removes*. Not in either built-in schema — unreachable from any form; documented as hand-editable (`docs/Updating and Editing.md`, "Snoozing contacts"). |
| `category` | both | `OrbitIndex.ts:150`; `ContactManager.ts:107` (path building) | `ContactManager.ts:132`; `OrbitHubModal.ts:150` | Typed `string` on `OrbitContact` (`types.ts:55`), **not** a union — the four options exist only in the two schemas (`new-person.schema.ts:25`, `edit-person.schema.ts:26`). Doubles as a filesystem path segment. |
| `photo` | both | `OrbitIndex.ts:156`; `ContactCard.tsx:241-264` | `ContactManager.ts:132`; `OrbitHubModal.ts:148`; `OrbitIndex.autoScrape` `:258`; `main.ts:132` | Three formats resolved at read time: URL / `[[wikilink]]` / vault path (`ContactCard.tsx:244-263`). |
| `social_battery` | both | `OrbitIndex.ts:157` | `ContactManager.ts:132`; `OrbitHubModal.ts:150` | Unvalidated — typed `SocialBattery` (`types.ts:37`) but assigned from raw frontmatter with no guard. |
| `last_interaction` | both | `OrbitIndex.ts:159` | `ContactManager.ts:141` (init `''`); `OrbitHubModal.ts:202` | Same: typed `LastInteractionType` (`types.ts:42`), no runtime validation. |
| `birthday` | both | `OrbitIndex.ts:160` → `BirthdayBanner` | `ContactManager.ts:132`; `OrbitHubModal.ts:150` | `MM-DD` **or** `YYYY-MM-DD` (`types.ts:84`, `docs/Adding People.md`). |
| `contact_link` | **write + self-prefill only** | `OrbitHubModal.ts:118` — *only* to prefill its own edit form | `ContactManager.ts:132`; `OrbitHubModal.ts:150` | **Dead data.** Grepped the whole repo: never rendered, never opened, never in `OrbitContact` (`types.ts:47-89`), never in the state dump (`OrbitIndex.ts:369-393`), never in an AI prompt. Formerly `google_contact` (`docs/UX Overhaul Session Log.md:476`). |
| `name` | **neither** | — | — | Skipped on write (`ContactManager.ts:130`, `OrbitHubModal.ts:146`); never read. §1a. |

**Schema-file-only keys**, reserved and never present on a contact note:
`schema_id`, `schema_title`, `output_path`, `submit_label`, `cssClass` (`loader.ts:23-29`,
documented at `docs/Custom Schemas.md`, "Reserved frontmatter keys").

**Everything else is user-authored and invisible to the plugin** — see §3.

### Adjacent surface the importer must also parse: body sections

Not frontmatter, but they carry contact data and the importer meets them in the same file:

| Section | Matcher | Citation |
|---|---|---|
| `## Conversational Fuel` | `/^##\s*(?:🗣️\s*)?Conversational Fuel\s*$/im` — tolerates one specific emoji, anchored, exact | `FuelTooltip.tsx:242` |
| `## Interaction Log` | `line.startsWith('## ') && line.includes(heading)` — **substring**, tolerates any prefix; heading is user-configurable, default `"Interaction Log"` | `ContactManager.ts:199`; `settings.ts:58` |
| arbitrary `## Anything` | `extractSection()` matches any `##` line *containing* the name; reachable from a user-edited AI prompt template | `AiService.ts:62-85`, `:19-37` |

The two matchers disagree (anchored-exact vs. substring) on files the same plugin wrote. The
importer will meet both conventions in a real vault.

### Docs cross-check

`docs/Getting Started.md` ("Create manually") tells users a contact is a file with
`tags / frequency / category / last_contact / social_battery` — a **five-key minimum**, no `name`,
no `photo`, no `birthday`. `docs/Adding People.md` ("Built-in fields") lists the seven
`new-person.schema.ts` form fields. Neither mentions `snooze_until`; only
`docs/Updating and Editing.md` does. **A vault built by following the docs contains files with
different key sets than a vault built by using the form.**

---

## 3. Custom schemas — the direct ancestor of HANDOFF §14

### 3a. How arbitrary can a key be?

There is **no validation, no sanitization, and no reserved-key protection** on user field keys.
The only constraint is incidental — the regex in the hand-rolled frontmatter parser:

```ts
const kvMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
```
`loader.ts:133` (frontmatter) and `loader.ts:75` (the ```` ```fields ```` block, identical).

So a key must start with `[A-Za-z0-9_]` and continue with word characters, `_`, or `-`. Lines that
do not match are **silently dropped** (`loader.ts:135` `continue`). A key containing a space, a
dot, or a non-ASCII character never becomes a field and never produces an error.

Beyond that regex:

- **Flat frontmatter keys get zero validation.** Every non-reserved key becomes a `text` field
  with `label: keyToLabel(key)` (`loader.ts:269-278`). No type guard runs on this path — `isFieldDef`
  is only applied to ```` ```fields ```` entries (`loader.ts:107`).
- **`RESERVED_KEYS` (`loader.ts:23-29`) protects schema metadata, not contact data.** It contains
  the five schema keys and **nothing else**. `tags`, `last_contact`, `frequency`, `snooze_until`,
  `category`, `photo` are all legal user field keys.
- **Consequence — a live footgun.** `createContact` sets the membership tag *first*
  (`ContactManager.ts:125`), then loops the schema's fields (`:129-133`). A user schema declaring
  a `tags` key therefore **overwrites `fm.tags` with the form value**, and the contact becomes
  invisible to `hasPersonTag` (`OrbitIndex.ts:167-188`) — created successfully, then absent from
  the app, with no error. Same mechanism lets a user schema write `last_contact: "soon"`, which
  `parseDate` (`types.ts:163-183`) resolves to `null`, which `calculateStatus` (`types.ts:102-103`)
  turns into permanent `decay`.
- **No collision detection between schemas.** Only *schema IDs* are deduped (`loader.ts:323-336`).
  Two schemas may define the same key with different types; each contact simply carries whatever
  its own schema wrote.

`keyToLabel()` (`loader.ts:36-39`) is cosmetic — `replace(/_/g, ' ')` plus capitalize-first. It is
**not** a sanitizer and does not run on the write path.

### 3b. What the index does with keys it does not know: confirmed — it ignores them, totally

`parseContact()` (`OrbitIndex.ts:111-162`) never enumerates the frontmatter. It reads eight named
keys and constructs a fixed-shape `OrbitContact` (`types.ts:47-89`). There is no passthrough bag,
no `extra`, no `Record<string, unknown>`. `saveStateToDisk()` (`OrbitIndex.ts:369-393`) serializes
twelve named scalars. The dashboard, orrery, digest, and birthday banner all read only that object.

Unknown keys therefore:

- **survive on disk indefinitely** — `updateFrontmatter` is merge-only (`ContactManager.ts:163-167`;
  the plugin's own fixture carries `custom_field: 'should be preserved'` at
  `edit-flow.test.ts:118`);
- **are unreachable from the UI after creation** — `handleEdit` builds `initialValues` from seven
  hardcoded keys (`OrbitHubModal.ts:111-119`) and always renders `editPersonSchema`
  (`OrbitHubModal.ts:122`), *never* the schema the contact was created with. **A contact created
  from a custom schema can never have its custom fields edited in Orbit.** The user must open the
  markdown file.

That last point is the plugin's central failure at this seam, and it is exactly what HANDOFF §14.7
fixes by decree: *"Edit contact form — None. Always shows every non-quarantined field."*

### 3c. What is worth salvaging from `loader.ts` beyond `keyToLabel()`

HANDOFF §14.9 is `[DECIDED]`: "*Salvage only `keyToLabel()` (~9 lines) for deriving `col_name` from
a user-entered label.*" Two observations that refine — not reverse — that instruction:

1. **`keyToLabel()` runs the opposite direction from the §14.9 use case.** It is
   `key → label` (`"social_battery"` → `"Social battery"`, `loader.ts:36-39`). Deriving `col_name`
   from a user-entered label is `label → key` — a *different* function, and a harder one: it needs
   case folding, whitespace→underscore, charset restriction, SQL-keyword avoidance, and collision
   suffixing, none of which `keyToLabel` has. **The field editor's slugifier must be written new.**
   `keyToLabel` is genuinely useful in its own direction — for the **importer**, deriving a human
   label for an auto-created `custom_field_defs` row from a vault key. That is a real salvage, just
   for a different consumer than §14.9 names.
2. **The parsers must not be reused for contact frontmatter, and the reason is concrete.**
   `parseFrontmatter` (`loader.ts:120-157`) is single-line-only: it matches `key: value` per line
   and skips everything else. It therefore **cannot parse a YAML block sequence** — the exact form
   the plugin itself writes for `tags` and the exact form `docs/Getting Started.md` instructs users
   to type:

   ```yaml
   tags:
     - people
   ```

   Line 1 yields `tags: ''`; line 2 (`  - people`) fails the `^(\w…)` anchor and is dropped. The
   parser would classify every plugin-created contact as untagged. It also coerces numeric-looking
   values via `Number()` (`loader.ts:148-149`) — fine for schema files, wrong for a `birthday` of
   `12-25`. `INDEX.md` (domain 5) records these ~250 lines as "portable but hand-rolled — decide
   whether to reuse or replace." **The evidence says replace:** the importer needs a real YAML
   parser, because the plugin's own parser cannot read the plugin's own output.

---

## 4. The importer's problem

`HANDOFF §15.4`: *"Write the importer that parses existing Obsidian markdown frontmatter into
SQLite. The existing vault files are effectively the schema specification."* Given §2 and §3, that
sentence hides three distinct decisions.

### 4a. The three-way sort every vault key must pass through

| Bucket | Consequence |
|---|---|
| **Fixed `contacts` column** | Permanent. Adding one later is a migration against devices you cannot reach (HANDOFF §3). Removing one later is worse. Gets typed storage, indexes, and direct participation in the status engine. |
| **Auto-created `custom_field_defs` row** | TEXT storage forever (§14.2), sorts only via `sortExpr()`, deletable/quarantinable by the user (§14.5), user-renameable. Costs one `ALTER TABLE ADD COLUMN` per key at import time. |
| **Dropped** | Data loss with no server-side recovery (HANDOFF §3). Irreversible the moment the user stops keeping the vault. |

### 4b. The unambiguous cases

**Clear fixed columns** — read by the status engine or a core screen, and every one of them is
read by name in `OrbitIndex.parseContact`: `frequency`, `last_contact`, `snooze_until`, `category`,
`social_battery`, `last_interaction`, `birthday`, `photo` — plus `name`, which becomes a column
for the first time (§1a).

**Clear custom fields** — any key not in the §2 table and not in `RESERVED_KEYS`. These are exactly
the keys `loader.ts:269-278` turned into text fields and `OrbitIndex` ignored (§3b). They arrive
with a key but **no type information whatsoever** (the type lived in the *schema file*, not the
contact file, and the importer will not have the schema folder).

### 4c. The genuinely ambiguous keys

**`tags` — the hardest one, and it is not a field.** In the plugin it is a *membership predicate*
(`OrbitIndex.ts:167-188`), not contact data. But it is a real frontmatter key holding a real list,
and in a real Obsidian vault it will hold **more than the person tag** — `#people`, `#work`,
`#book-club`, `#college`. Four incompatible readings, each defensible:

1. Drop entirely (it was only ever a gate; SQLite membership is "row exists in `contacts`") — loses
   the user's own taxonomy.
2. Strip the configured person tag, import the remainder as one multi-value custom field — but
   §14's field types (`text · textarea · dropdown · date · toggle · number · photo`) have **no
   multi-value type**, so this becomes a comma-joined text field that no longer filters.
3. Map to `category` — but `category` is single-valued and already occupied.
4. Promote to a real `tags`/`labels` table — **new product surface**, not in HANDOFF, not in any
   domain in `INDEX.md`.

There is no defaulting to safety here: the choice between (1) and (2) is data-loss versus
data-degradation.

**`contact_link` — write-only in the plugin (§2), so the vault will contain values nobody ever
saw.** Fixed column, custom field, or dropped? It is the only key with *zero* read consumers, which
argues for custom field — but it is also in both built-in schemas
(`new-person.schema.ts:64-69`, `edit-person.schema.ts:64-69`), so it is "built-in" by provenance
and "custom" by usage. Mobile arguably wants it to be *more* than it was: a phone can dial, text,
and open a URL, so a contact-method field is a candidate first-class column that the desktop plugin
had no reason to build. That is a product decision, not a migration decision.

**`photo`.** The *key* is clearly a fixed column, but its **values are three different things**
(URL / wikilink / vault path — `ContactCard.tsx:244-263`), and HANDOFF §14.3 already decided mobile
uses a native picker with local file storage, "differs from the plugin." So the importer must
resolve or discard each format. A `[[wikilink]]` is meaningless without the vault; a vault-relative
path is meaningless without the vault; an `https://` URL is the only form that survives the
transfer — **and following it is a network call**, which needs an explicit owner ruling against
HANDOFF §3's local-first commitment. (This overlaps domain 7 and is flagged, not resolved, here.)

**`snooze_until`.** Fixed column by function, but semantically transient. Importing a stale value
from a vault last touched a year ago is harmless (`OrbitIndex.ts:134` treats past dates as
unsnoozed); importing a *future* one silently hides a contact on first launch.

**Enum-shaped keys with free-text values.** `frequency`, `social_battery`, `last_interaction`, and
`category` are all typed as unions in TypeScript but never validated at read
(`OrbitIndex.ts:150, 157, 159`). Only `frequency` has a guard, and it silently coerces to
`"Monthly"` (`OrbitIndex.ts:123-125`). Any hand-edited vault will contain out-of-range values —
and `test/unit/modals/orbit-form-modal-prefill.test.ts:88-97` (*"preserves raw dropdown value not
in options list"*) proves the plugin deliberately **preserved** them rather than coercing. A
`CHECK` constraint or a `NOT NULL` on any of these four columns turns "preserved oddity" into
"import failure."

### 4d. Two structural hazards the importer creates that HANDOFF §14 does not cover

1. **Auto-creating a `custom_field_defs` row means auto-generating a `col_name` from an untrusted
   vault key** — and that `col_name` is interpolated directly into DDL
   (`ALTER TABLE contact_custom_values ADD COLUMN {col_name}`, HANDOFF §14.1) and into `ORDER BY`
   via `sortExpr()` (§14.2, which returns `` `CAST(${field.col_name} AS REAL)` ``). Vault keys may
   legally contain hyphens (`loader.ts:133`: `\w[\w_-]*`), so `contact-link` is a legal key and an
   **illegal bare SQL identifier**. Every col_name the field *editor* mints comes from the UI and
   is under our control; every col_name the *importer* mints comes from a file we did not write.
   This is the first untrusted input to the DDL path.
2. **Column-count and collision limits.** One `ALTER TABLE ADD COLUMN` per distinct unknown key
   across the whole vault. A vault with several custom schemas plus hand-edited notes can present
   dozens of distinct keys, and two keys differing only by case or by `-` vs `_` collide after
   slugification. Silent merge and hard failure are both wrong; the third option (suffixing) needs
   deciding before the first import runs.

---

## 5. Deletion and archival

### 5a. Confirmed: the plugin has no contact delete or archive operation of any kind

Grepped `src/` for `delete`, `archive`, `trash`, `deleteFile`, `fileManager.trash`, and every
removal verb. Complete inventory of matches:

| Match | What it is |
|---|---|
| `ContactCard.tsx:189` | `delete frontmatter.snooze_until` — unsnooze, a *key* removal |
| `main.ts:84-90` | `vault.on("delete", …)` — **reacts** to Obsidian deleting a file |
| `OrbitIndex.ts:285-291` | `handleFileDelete` — removes the entry from the in-memory `Map` |
| `OrbitIndex.ts:196, 213, 298` | `Map.delete` during change/rename handling |
| `OrbitIndex.ts:279` | `Set.delete` on the scrape re-entrancy guard |
| `settings.ts:54, 124` | `ignoredPaths: ["Templates", "Archive"]` — a **path filter**, not an archive feature |

`handleFileDelete` (`OrbitIndex.ts:285-291`) purely reacts:

```ts
if (this.contacts.has(file.path)) {
    this.contacts.delete(file.path);
    this.trigger("change");
    this.saveStateToDisk();
}
```

No UI affords it. `OrbitHubModal`'s action bar is Update / Edit / Add / Digest / Suggest / Done
(`OrbitHubModal.ts:321-358`) — no Delete. `ContactCard`'s context menu is mark-contacted / snooze /
unsnooze / open note / open in new tab (`ContactCard.tsx:78-143`) — no Delete. No command in
`main.ts`. Removing a contact means deleting the file in Obsidian's file explorer.

The `"Archive"` entry in `ignoredPaths` is the closest thing to archival: a user could *manually*
move a contact file into a folder the scanner skips (`OrbitIndex.isIgnoredPath`,
`OrbitIndex.ts:101-106`). That is a filesystem convention the user performs, not a feature — and it
is exactly the "soft delete" the mobile app has to build, because there is no file explorer on a
phone.

`INDEX.md` (domain 6) already states this: *"the plugin has none — vault files were the user's
problem; SQLite makes it ours."* **Confirmed, in full.**

### 5b. What SQLite therefore makes the app newly responsible for

Everything. This is a **greenfield subsystem with no predecessor to port**, and it has more
interacting parts than it looks:

- **The affordance itself** — there is no file explorer. If the app does not ship a delete, a
  mis-created contact is permanent, and the *first* thing a new user does is create a test contact.
- **Cascade scope.** A contact in the mobile schema owns: interaction rows (domain 4), conversational
  fuel (domain 3), a `contact_custom_values` row (§14.1), `field_history` rows (§14.6), a photo
  file **outside the database** (§14.3, "local file storage"), and any scheduled local notification
  (domain 11). `ON DELETE CASCADE` covers the first four. It does **not** cover the photo file or
  the notification — those are OS-level resources, and orphaning them is silent.
- **The `field_history` interaction is genuinely subtle.** §14.6 makes `field_history` "the only
  recovery mechanism that exists." Cascading a contact delete into `field_history` **destroys the
  undo records for that contact** — including snapshots taken by a *field-level* operation that has
  nothing to do with this contact's deletion. Not cascading leaves rows pointing at a contact that
  no longer exists. Both are wrong in different ways, and §14 does not address it because §14 was
  scoped to fields, not contacts.
- **Undo.** There is no server and no backup (HANDOFF §3). §14.5/§14.6 established
  quarantine-plus-snapshot as this project's answer for *fields*; whether contacts get the same
  treatment is unasked.
- **The launch sweep already exists as a pattern.** §14.5: nothing can watch a timestamp; expiry
  runs at app launch. A contact soft-delete window would ride the same sweep — cheap **if** decided
  before the sweep is written, a retrofit after.

### 5c. Open questions this creates

Soft delete or hard? What is the recovery window (§14.5's 30-day working assumption is itself
`[OPEN]`)? Does a soft-deleted contact still hold its custom values and interactions? Does it
still count toward "total contacts"? Do its scheduled notifications get cancelled at
soft-delete time or at expiry? Is "archive" a *separate* user-facing concept from "delete" —
i.e. stop tracking someone without erasing the history — which is arguably what the plugin's
`ignoredPaths: ["Archive"]` convention was reaching for, and which a relationship CRM plausibly
needs more than it needs deletion?

---

## 6. Design questions for the owner

Each is a decision with divergent downstream consequences. **All are the owner's** — every one is
either a data-model commitment that a later migration cannot cheaply reverse (HANDOFF §3), a
product/taste call, or a risk-posture call. None is a planner's to make.

### Q1. Does `contacts` get a surrogate primary key, or is `name` the key?

The foundational decision; §1d says the plugin offers no usable candidate.

- **Surrogate `id` (INTEGER PK or UUID).** Rename becomes a one-column `UPDATE` touching zero
  children. Duplicate names become legal. Interactions, fuel, `contact_custom_values`,
  `field_history`, photos, widget targets, and deep links all reference something immutable.
  Cost: `name` needs its own resolution path everywhere a human types one (§1c), and the export
  format (domain 15) must decide whether IDs are exported — a UUID survives export/reimport and an
  autoincrement INTEGER does not.
- **`name` as PK.** Simpler; mirrors the plugin exactly. Cost: **every rename becomes a cascading
  update**, names must be `UNIQUE` (which the plugin never enforced — §1c), and the two-Chrises
  case becomes a hard error the user must resolve at the moment they least want to. Note also
  HANDOFF §14.1's diagram illustrates `contact_custom_values` keyed by names (`Bob`, `Phil`,
  `Andrew`) — **illustrative, but it will be read as normative** by an implementer if this is not
  settled explicitly.
- If UUID: minted where? Client-generated at insert is required if export/reimport must preserve
  identity across devices.

*Downstream:* Q2, Q3, the entire delete cascade (§5b), the widget's contact reference, deep-link
URLs, and the export format.

### Q2. Must contact names be unique?

Independent of Q1 — a surrogate key permits duplicates but does not require allowing them.

- **Unique.** Names resolve deterministically for share-sheet capture, import, and notifications.
  Cost: the user cannot have two friends named Chris without inventing a disambiguator, and
  **import must resolve collisions**, which the plugin never had to (§1c).
- **Not unique.** Honest — people share names. Cost: every name→contact resolution needs a
  disambiguation UI, and the initials-avatar hash (`ContactCard.tsx:34-43`) gives identical
  fallback avatars, so the dashboard needs a second differentiator.
- **Unique-with-warning** (soft): allow, but flag at creation.

### Q3. Is a name change a rename, or is `name` just an editable column?

The plugin conflates them (§1e). With a surrogate key they separate cleanly, and this becomes a
one-line answer — but it must be *stated*, because the plugin's code models the opposite and an
implementer reading `OrbitHubModal.ts:155-162` will port the conflation.

Related, and cheap now: what characters are legal in a name? The plugin sanitizes on create
(`paths.ts:15-17`) and not on edit (§1e) — a filesystem constraint that **has no reason to exist**
in SQLite. Carrying it over would be cargo-culting; dropping it silently is also a decision.

### Q4. Which of the eleven vault keys become fixed columns?

The eight `parseContact` reads plus `name` are near-automatic. The real questions:

- **`contact_link`** — fixed column, custom field, or dropped? It was write-only in the plugin
  (§2), but a phone can act on it in ways a desktop vault could not. Promoting it is a product
  decision about whether Orbit stores contact *methods* at all (which also bears on the SMS-composer
  handoff, domain 11).
- **`category`** — stays as the plugin's four hardcoded buckets, becomes user-editable data, or
  collapses into whatever answers Q5? Note it currently doubles as a filesystem path segment
  (`ContactManager.ts:106-110`), a role that simply disappears.
- **The four enum-shaped columns** (`frequency`, `category`, `social_battery`, `last_interaction`)
  — `CHECK` constraint, or free text with UI-level validation? §14.3 already decided *"type
  enforcement is the UI's job, not the database's"* for custom fields. Applying the same rule to
  fixed columns is consistent and lets messy vault values import; applying a `CHECK` is stricter and
  **will reject rows the plugin deliberately preserved**
  (`orbit-form-modal-prefill.test.ts:88-97`). Choose deliberately — this is the kind of thing that
  gets decided by whoever writes migration 1 if nobody decides it first.

### Q5. What happens to `tags`?

§4c. Four incompatible options, no safe default, and option (4) — a real tags/labels table — is
new product surface not currently in any domain in `INDEX.md`. Worth answering before the roadmap
is drawn rather than after, because it may *be* a domain.

### Q6. Does the importer auto-create custom fields for unknown keys, or ask?

- **Auto-create silently.** Nothing is lost, import is one tap. Cost: a messy vault yields dozens
  of `text` fields (unknown keys arrive with no type — §4b), each an `ALTER TABLE`, each now
  cluttering the edit form, which §14.7 decreed *always shows every non-quarantined field*. The
  user's first edit screen after import could be unusable.
- **Ask, with a pre-import review screen** — mapping each unknown key to import-as-field / map-to-
  existing / skip, with a type picker. Materially more work, and it is the only point at which type
  information can be recovered at all.
- **Drop unknown keys.** Cheapest, and irreversibly discards precisely the data the user cared
  enough to hand-author.

Note this is the mirror image of §14.7's `show_on_new` reasoning: *"creating a contact should not
demand 15 fields."* Auto-import can produce exactly the 15 fields §14.7 was protecting against.

### Q7. Is the importer one-shot or re-runnable — and what is a re-run's match key?

If re-runnable, matching an incoming vault file to an existing row requires an identity, which is
Q1/Q2 again; if names are not unique, a re-run cannot reliably match. If one-shot, the user gets
exactly one attempt at Q6's mapping, on data they have not seen rendered yet, with no server-side
repair (HANDOFF §3). "One-shot" also makes the importer the *de facto* seed-data mechanism only —
never a sync.

### Q8. Delete, archive, both, or neither in v1?

§5. Note "archive" (stop tracking, keep history) and "delete" (erase) are different products and
a relationship CRM plausibly needs the first more than the second — the plugin's
`ignoredPaths: ["Archive"]` convention (`settings.ts:54`) is a user reaching for exactly that.
Shipping neither means the first test contact is permanent.

### Q9. What does a contact delete cascade to — specifically the two that `ON DELETE CASCADE` cannot reach?

The photo file on disk (§14.3 local storage) and any scheduled local notification are OS-level
resources outside SQLite's cascade. And the `field_history` question in §5b is a real conflict with
§14.6's *"only recovery mechanism that exists"* — cascading destroys undo records, not cascading
orphans them. **This one is flagged rather than proposed** because either resolution touches an
existing `[DECIDED]` item, and per CLAUDE.md that boundary is the owner's, not a planner's.

---

## Cross-domain constraints this seam imposes

For `INDEX.md`'s constraint log, once decided:

- **→ `fields` (2):** the importer is a **second, untrusted producer** of `custom_field_defs` rows
  and `col_name` values (§4d.1). HANDOFF §14 assumed one producer — the field editor UI, driven by
  user-typed labels. Identifier safety, hyphen handling, and collision policy on the import path
  are not covered by §14 and are additive to it, not a revision of it.
- **→ `crud` (6):** §14.7 already fixes the edit form ("always shows every non-quarantined field"),
  which resolves the plugin's worst defect (§3b: custom-schema contacts are uneditable). Q6's
  auto-create choice determines whether that decision produces a usable screen or an unusable one
  after import.
- **→ `photos` (7):** the importer meets three photo formats (`ContactCard.tsx:244-263`); only
  `https://` survives the move off the vault, and resolving it is a network call requiring an
  explicit ruling against HANDOFF §3.
- **→ `log` (4), `fuel` (3):** both are children of a contact, so both inherit Q1's key and Q8/Q9's
  cascade. The `data`×`log` workpaper's Q1 (stored vs. derived `last_contact`) is independent of
  this one but shares the same delete cascade.
- **→ `capture` (10), `notify` (11), `widget` (12):** all three resolve a contact from something
  that is not a row handle — a share-sheet pick, a notification payload, a widget cell. Each needs
  Q1's stable reference; the widget in particular must persist a reference that survives a rename
  (§1e).
- **→ `backup` (15):** whether IDs are exported decides whether reimport preserves identity or
  creates duplicates. A client-generated UUID survives; an autoincrement INTEGER does not.
- **→ `dashboard` (8):** if Q2 permits duplicate names, cards need a differentiator; the initials
  fallback hashes on name (`ContactCard.tsx:297`) and will render two same-named contacts
  identically.

---

*Prepared for `/oa-interrogate 1` (`data`), with findings feeding domains 2, 5, and 6.
Investigation only — no decisions taken; every question in §6 is the owner's.*
