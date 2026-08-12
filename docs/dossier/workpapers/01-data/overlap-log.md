# Workpaper — Seam: domain 1 (`data`) × domain 4 (`log`)

**Scope.** The boundary between the `contacts` scalar columns (`last_contact`, `last_interaction`)
that the status engine reads, and the interaction-log records that the plugin writes in parallel.

**Method.** Full read of the actual plugin source on disk at `~/projects/Orbit` (not diffs, not
summaries), plus every test covering the update/logging path, plus the user-facing docs. All
line numbers verified by opening the file.

**Verdict on the stated hypothesis: confirmed, and worse than stated.** The plugin has not two
but *four* writers of "when did I last talk to this person," only one of which touches the log at
all, and that one writes the log's timestamp from a different clock than the scalar it writes
alongside it.

---

## 1. What each path actually writes

### 1a. The full update flow (Orbit Hub → select → Update → Save)

Order of operations, `src/modals/OrbitHubModal.ts:191-234`:

1. `updateFrontmatter(app, file, { last_contact: data.lastContact, last_interaction: data.interactionType })`
   — `OrbitHubModal.ts:200-203`. Merge-only write; `ContactManager.ts:158-169` iterates
   `Object.entries(data)` and assigns into the frontmatter object, preserving all other keys.
2. **Only if `data.note` is truthy** (`OrbitHubModal.ts:206`): build `logEntry = \`${data.interactionType}: ${data.note}\``
   (`OrbitHubModal.ts:207`) and call `appendToInteractionLog(app, file, logEntry, settings.interactionLogHeading)`
   (`OrbitHubModal.ts:208-213`).
3. `new Notice(...)`, then `await this.plugin.index.scanVault()` + `trigger('change')`
   (`OrbitHubModal.ts:216-222`).

The two writes are **not** in a shared transaction and there is no rollback. A `catch` at
`OrbitHubModal.ts:224-227` logs the error and shows a Notice, then execution falls through to
`OrbitHubModal.ts:230-233` which resets state and re-renders regardless. If step 1 succeeds and
step 2 throws, the scalar has moved and the log has not, and the user sees only a generic
"Failed to update" toast.

**The note is optional and gates the entire log write.** This is not incidental — it is an
explicitly asserted behavior:
`test/unit/modals/orbit-hub-modal.test.ts:652-671`, "handleSave() no note → skips log append",
asserts `expect(appendToInteractionLog).not.toHaveBeenCalled()`. So the *normal* case — tap
Update, pick "text", hit Save without typing anything — advances `last_contact` and
`last_interaction` and writes **no log record at all**. The interaction is invisible in history.

The `note` is trimmed in the panel before it leaves (`UpdatePanel.tsx:44`,
`note: note.trim()`), so whitespace-only notes collapse to `''` and also skip the log.

### 1b. The one-tap quick action ("✓ Mark as contacted today")

`src/components/ContactCard.tsx:146-161`, wired to the context-menu item at
`ContactCard.tsx:81-88`:

```
const today = formatLocalDate();
await plugin.app.fileManager.processFrontMatter(contact.file, (frontmatter) => {
    frontmatter.last_contact = today;
});
```

**The hypothesis is confirmed exactly.** The quick action writes `last_contact` and nothing
else. It does not write `last_interaction`. It does not append a log line — `ContactCard.tsx`
has no import of `appendToInteractionLog` (verified: the only `ContactManager` import path in
the repo is `OrbitHubModal.ts:23`). Test coverage matches and asserts only the one key:
`test/unit/components/contact-card-modes.test.tsx:235-240`.

### 1c. The snooze actions

`ContactCard.tsx:163-181` writes `snooze_until` only. `ContactCard.tsx:183-197` (unsnooze)
`delete`s the key. Neither writes `last_contact`, `last_interaction`, or a log line. **Snoozing
leaves no record anywhere** — there is no audit trail of "I deferred this person three times in
a row," which is arguably the single most diagnostic signal a relationship CRM could surface.

### 1d. The Tether — automatic wikilink detection (a fourth writer, not in the brief)

`src/services/LinkListener.ts:147-164`, `updateContactDate()`:

```
frontmatter.last_contact = dateStr;   // LinkListener.ts:155
```

Same shape as the quick action: `last_contact` only, no `last_interaction`, no log line. This
fires from a *notification button* after a 2s-debounced editor scan (`LinkListener.ts:30-48`),
i.e. the user may advance `last_contact` without ever opening Orbit's UI. `docs/Updating and
Editing.md:28-40` describes this as "Orbit's killer feature."

`LinkListener.ts` is on HANDOFF §4's **delete** list, so this specific writer does not port — but
its *replacements* on mobile do. HANDOFF §6 commits to actionable notifications and a home-screen
widget whose primary preset action is "mark contacted," and CLAUDE.md's widget note confirms
`RemoteViews` cannot accept text input. **The widget is structurally incapable of collecting a
note or a type.** So the mobile app will ship at least three low-ceremony writers that are, by
platform constraint, exactly as impoverished as `markAsContacted` is today.

### 1e. Contact creation

`ContactManager.ts:135-141` sets `last_contact = formatLocalDate()` if absent and
`last_interaction = ''`. No log line is written. **Every contact is born with a `last_contact` of
today and an empty interaction history.** This is load-bearing for §6 below.

### Divergence table

| Path | `last_contact` | `last_interaction` | log line | citation |
|---|---|---|---|---|
| Hub update, note typed | ✅ user-chosen date | ✅ | ✅ (stamped today) | `OrbitHubModal.ts:200-213` |
| Hub update, **no note** | ✅ user-chosen date | ✅ | ❌ | `OrbitHubModal.ts:206`; test `:652` |
| Quick action | ✅ today | ❌ **stale** | ❌ | `ContactCard.tsx:146-161` |
| Tether prompt | ✅ today | ❌ **stale** | ❌ | `LinkListener.ts:147-164` |
| Snooze / unsnooze | ❌ | ❌ | ❌ | `ContactCard.tsx:163-197` |
| Create contact | ✅ today | ✅ `''` | ❌ | `ContactManager.ts:135-141` |

---

## 2. What a log entry contains, verbatim — and whether anything reads it

### Verbatim format

`ContactManager.ts:188-189`:

```ts
const timestamp = formatLocalDate();          // ← today, NOT the user's chosen date
const logEntry = `- ${timestamp}: ${entry}`;
```

`entry` is composed by the caller at `OrbitHubModal.ts:207` as `` `${interactionType}: ${note}` ``.
The line actually written to disk is therefore:

```
- 2026-02-19: call: Discussed the project
```

Two colons. Type and note are concatenated into a single free-text tail with no delimiter that
distinguishes them from a note that happens to contain a colon. There is no ID, no time-of-day,
no link back to anything.

**The user docs are wrong about this.** `docs/Updating and Editing.md:96-98` shows:

```
- 2026-02-19: Called to catch up about the new job
```

— no type token. The shipped code always emits the type. Per the INDEX.md note on domain 8
("its docs disagree with its code here; trust code"), the same caution applies here. The
integration test at `test/unit/modals/orbit-hub-modal.test.ts:644-650` pins the real behavior:
`'call: Discussed the project'`.

Note also the function is named `appendToInteractionLog` but it **prepends**:
`ContactManager.ts:212`, `lines.splice(headerLineIndex + 1, 0, logEntry)` inserts immediately
after the heading. The section is newest-first. Only the heading-not-found fallback
(`ContactManager.ts:205-209`) appends, and only once, since it creates the heading.

### Is it write-only? Effectively yes.

Grepped every `.ts`/`.tsx` in `src/`. `appendToInteractionLog` has exactly one call site
(`OrbitHubModal.ts:208`) and **zero readers**. Specifically:

- `OrbitIndex.parseContact()` (`OrbitIndex.ts:111-162`) reads frontmatter only — it never reads
  the note body. The returned `OrbitContact` (`types.ts:47-89`) has no field for log history.
- `calculateStatus()` (`types.ts:98-123`) takes `lastContact: Date | null` and `frequency`. The
  status engine sees the scalar and only the scalar.
- The weekly digest (`main.ts:294-356`) buckets on `contact.status`, `contact.daysSinceContact`
  and `contact.lastContact` — never the log.
- `saveStateToDisk()` (`OrbitIndex.ts:366-412`) serializes 12 scalar fields; the log is not among
  them.
- `FuelTooltip` parses `## Conversational Fuel`, a different section.

**One latent read path.** `AiService.assemblePrompt()` (`AiService.ts:117-138`) resolves any
unrecognized `{{Placeholder}}` as a markdown section name via `extractSection()`
(`AiService.ts:62-85`). The default template (`AiService.ts:19-37`) pulls
`{{Conversational Fuel}}` and `{{Small Talk Data}}` but **not** `{{Interaction Log}}`. A user who
edits the template (`settings.ts:453-455`; documented at `docs/AI Features.md:43, 86-90`) can make
the log readable. So: write-only in shipped behavior, user-reachable by configuration, read by
nothing in the product's own logic.

**Consequence for the rewrite.** The plugin gives us no evidence about what the log is *for*,
because nothing ever consumed it. Any mobile design that reads interaction rows back — a history
list on the profile, "3rd call this month," AI context, streak/cadence analytics — is **new
product surface with no predecessor**, not a port. Do not let a planning artifact describe it as
carried over.

---

## 3. Backdating — and the timestamp mismatch

Backdating is fully supported and untested against the log.

`UpdatePanel.tsx:39` initializes `lastContact` to `formatLocalDate()` (today) and
`UpdatePanel.tsx:87-92` renders a free `<input type="date">` with **no min, no max, and no
validation**. `handleSubmit` (`UpdatePanel.tsx:43-45`) passes the chosen string straight through.
Future dates are equally accepted — nothing clamps forward. `test/unit/components/update-panel.test.tsx:216-232`
confirms an arbitrary date (`'2026-01-15'`) flows to `onSave` unmodified.

**The mismatch.** `OrbitHubModal.handleSave` writes `data.lastContact` — the user's chosen date —
into frontmatter (`OrbitHubModal.ts:201`). It then calls `appendToInteractionLog`, which **ignores
the chosen date entirely** and stamps the line with `formatLocalDate()` evaluated inside the
function at call time (`ContactManager.ts:188`). The chosen date is never passed to it; the
function signature (`ContactManager.ts:182-187`) has no date parameter.

So logging a coffee you had last Tuesday, on Friday, with a note, produces:

```
frontmatter:  last_contact: 2026-02-12
body:         - 2026-02-19: in-person: Coffee at the market
```

Every backdated entry is self-contradicting on disk. The plugin's own test suite encodes both
halves without noticing: `test/unit/modals/orbit-hub-modal.test.ts:622` asserts
`last_contact: '2026-02-19'` from a hand-supplied date, while
`test/unit/services/contact-manager.test.ts:387-399` ("includes today's date in the log entry")
asserts the log matches `/- \d{4}-\d{2}-\d{2}: Test entry/` against the system clock. Neither test
compares the two.

**This is not the known UTC off-by-one.** `formatLocalDate()` (`src/utils/dates.ts`) correctly uses
local getters and CLAUDE.md forbids reintroducing the `toISOString().split('T')[0]` bug. This is a
distinct, second date defect: two clocks, one intentional and one incidental, feeding one logical
event. Worth stating plainly because a reviewer who knows about the UTC bug will pattern-match to
it and mark this closed.

**There is no monotonic guard.** Nothing compares `data.lastContact` to the existing
`last_contact`. Backdating to a date *older* than the stored value silently moves `last_contact`
backwards, which flips a `stable` contact to `decay` on the next scan (`OrbitIndex.ts:137`).

---

## 4. Concrete drift scenarios

Both directions are reachable, several of them in one tap.

**A. `last_contact` newer than the newest log entry — the common case.**
Any quick action (`ContactCard.tsx:146-161`), any Tether confirmation
(`LinkListener.ts:147-164`), or any Hub update with an empty note (`OrbitHubModal.ts:206`)
advances the scalar with no corresponding log record. In routine use this is the *majority* of
touchpoints — the whole point of the quick action is that it is the cheap one.

**B. `last_contact` older than the newest log entry.**
Backdate a note-bearing update to a date before the current `last_contact`. The scalar moves
backwards (§3, no guard) while the log gains a line stamped today. The log's newest entry is now
dated *after* `last_contact`.

**C. `last_interaction` stale relative to `last_contact` — and fed to an LLM as fact.**
The quick action and the Tether never touch `last_interaction`. It retains whatever the last full
Hub update set, or `''` from creation (`ContactManager.ts:141`). `AiService.extractContext()`
then does, at `AiService.ts:96-101`:

```ts
const dateStr = formatLocalDate(contact.lastContact);
const type = contact.lastInteraction ?? 'unknown';
lastInteraction = `${dateStr} (${type})`;
```

It composes a *new* date with an *old* type into one string and injects it into the prompt as
`{{lastInteraction}}` — documented to the user as "Date + type" at `docs/AI Features.md:80`. Text
someone yesterday after a phone call three months ago, and the model is told "2026-08-10 (call)."
This is a fabricated fact assembled from two independently-updated scalars, and it is the clearest
single argument in the plugin's source for not keeping the pair as free-floating columns.

**D. Manual frontmatter editing.** Obsidian users edit `last_contact` by hand in the editor;
`OrbitIndex.handleFileChange` (`OrbitIndex.ts:194-218`) reindexes on any change with no
validation. The log never moves. Mobile removes this specific vector, but a JSON import
(HANDOFF §3, §15.4) reintroduces exactly the same class of externally-supplied inconsistency.

**E. Partial failure of the two-step write.** §1a — no transaction, no rollback.

---

## 5. Deliberate edge-case handling that a SQLite rewrite would silently lose

Each of these solves a real problem that has a different shape — not no shape — on SQLite.

| Plugin behavior | Citation | What it defends against | Does it survive? |
|---|---|---|---|
| **Atomic append via `vault.process()`** | `ContactManager.ts:191`; rationale in the doc comment at `:174-176` — "avoids conflicts when the file is open in the active editor" | Read-modify-write race against a concurrently-open editor buffer | The *hazard* is Obsidian-specific; the *discipline* is not. SQLite gives us real transactions — but only if the scalar update and the log insert are actually wrapped in one. Today they are not (§1a). **Free win, easy to miss.** |
| **Heading-not-found fallback** | `ContactManager.ts:205-209` — creates `## {heading}` at EOF rather than dropping the entry | Never lose a user's note because the note's structure was unexpected | Analogue: writing an interaction row for a `contact_id` that no longer exists, or a value for a quarantined/dropped custom field. **A FK with `ON DELETE CASCADE` is the opposite policy** — it discards silently where the plugin recovers loudly. That inversion is a decision, not a default. |
| **Tolerant heading match** | `ContactManager.ts:199` — `line.startsWith('## ') && line.includes(heading)`, matching `## 📝 Interaction Log` | User-customized headings still resolve | No analogue needed; disappears with markdown. Note it also *over*-matches (`## Interaction Log Archive` wins if it comes first) — a latent bug, not worth porting. |
| **Configurable heading** | `settings.ts:187-199`, default `"Interaction Log"` at `settings.ts:58` | User owns their note structure | Meaningless on SQLite. Confirm the owner does not read this as losing customization. |
| **Idempotence-by-day on the Tether** | `LinkListener.ts:107-118` (`isContactedToday`) + `:71-82` (per-session `processedLinks` dedupe) | Prevents nagging and duplicate marks for the same person on the same day | **Directly relevant.** Notifications and the widget (HANDOFF §6) will fire repeatedly. Does a second "mark contacted" on the same day create a second interaction row? The plugin's answer was "don't even ask." |
| **Merge-only frontmatter write** | `ContactManager.ts:163-167`; test `contact-manager.test.ts:318` "preserves existing keys" | An update never clobbers unrelated fields | Trivially true of a targeted `UPDATE`, *unless* someone writes a DAO that rewrites the whole row from a partially-populated object. Worth an explicit rule given custom fields live in a sibling table. |
| **Reverse-chronological insertion** | `ContactManager.ts:212` | Newest first without re-sorting | Free via `ORDER BY`. Mentioned only so nobody "fixes" the ordering as a bug. |

**One thing the plugin does *not* do that is worth naming:** there is no de-duplication, no
"already logged today" check, and no uniqueness of any kind on log lines. Nothing prevents ten
identical entries. The file format made that harmless; a table with a history view does not.

---

## 6. Design questions for the owner — each with divergent downstream consequences

Framed as decisions, with the specific fork each one creates. **These are the owner's calls, not
the planner's** — every one of them is a product/risk-posture question, and several would be
expensive to reverse after migration 1 ships to a device we cannot reach.

### Q1. Is `contacts.last_contact` a stored column, or derived from `MAX(interactions.date)`?

The single highest-leverage decision at this seam. Everything below is downstream of it.

- **Stored scalar** (faithful port). Status math ports verbatim (`types.ts:98-123`, HANDOFF §4
  "copy verbatim"). Dashboard and orrery read one indexed column. **Cost: it reproduces the exact
  drift class documented in §4, on a platform where the widget and notification paths structurally
  cannot write anything richer.** Two sources of truth, permanently.
- **Derived** (`MAX(date)`). Drift becomes impossible by construction. **Cost — and this one bites
  immediately: a brand-new contact has zero interaction rows, so `MAX` is `NULL`, and
  `calculateStatus(null, …)` returns `"decay"` (`types.ts:102-103`).** Every contact would be born
  red. The plugin sidesteps this by seeding `last_contact = today` at creation
  (`ContactManager.ts:135-138`), which under a derived model means **creating a contact must also
  insert a synthetic interaction row** — an event that never happened, now in the user's history.
  Also makes "I know I talked to them but I don't remember when" unrepresentable.
- **Cached/denormalized column, single writer.** Keep the column for read performance; make one
  DAO function the *only* writer, recomputing from the interactions table inside the same
  transaction as every insert/update/delete. Best of both, at the cost of a discipline that must
  be enforced by convention — and note CLAUDE.md's own warning that **the graph cannot enumerate
  writers of a table** (no TS→SQL edges), so nothing tooling-side will catch a second writer.

*Downstream of Q1:* whether Q2 is even a question, whether import (domain 5) can populate
`last_contact` without inventing interactions, and whether the widget's one-tap action is a
one-row write or two.

### Q2. Does deleting an interaction move `last_contact` backwards?

Only live under "stored" or "cached." A user deletes a mis-tapped entry from their history.

- **Recompute** — honest, and the contact may jump straight to `decay`. Status visibly changes as
  a side effect of an edit the user thought was cosmetic.
- **Leave the scalar** — reintroduces drift deliberately, and the profile now shows a
  "last contacted" date with no record behind it.
- **Forbid deletion** (append-only, matching the plugin's markdown section, which had no delete
  affordance) — cheapest, and arguably correct for a log. But a mis-tap on the widget is now
  permanent, and there is no server-side repair (HANDOFF §3).

Same question applies to *editing* an interaction's date. Note HANDOFF §14.6 already establishes
`field_history` + snapshot-before-destructive-operation as this project's recovery pattern for
custom fields; whether interactions get the same treatment is an owner call.

### Q3. Is an interaction row required to have a type?

- **Required** (`NOT NULL`) — clean data; forces the widget and notification paths to pick a
  default, and a default that is wrong lies in the history forever. The plugin's UpdatePanel
  already defaults to `'call'` unconditionally (`UpdatePanel.tsx:40`), so a user who texts and
  doesn't touch the dropdown records "call" today.
- **Nullable / an explicit `unknown` member** — honest about the one-tap paths, and the profile
  must render the absence. Note `LastInteractionType` (`types.ts:42`) already has an `"other"`
  member; "other" and "unspecified" are semantically different and collapsing them loses the
  distinction permanently.

### Q4. Does every "mark contacted" create an interaction row, or only note-bearing updates?

The plugin's answer is "only note-bearing" (`OrbitHubModal.ts:206`), which is why its log is
sparse and untrustworthy.

- **Always insert** — the log becomes complete and the history view becomes real. Cost: history
  fills with contentless rows (`2026-08-11 · call`), and if Q1 is "derived," this is mandatory
  anyway.
- **Only when the user says something** — preserves a curated, readable history. Cost: the log can
  never be the source of truth for recency, which forecloses the derived option in Q1.

This decision and Q1 are coupled; deciding them independently will produce an incoherent model.

### Q5. What is the log entry's date, when the user backdates?

Given §3 established the plugin gets this wrong: does an interaction row carry **one** date (the
event) or **two** (event date + recorded-at)?

- **One** — simple, and "logged 3 months late" is invisible.
- **Two** — supports honest history and future streak/cadence analysis, and costs one column now
  versus a migration later against unreachable devices (HANDOFF §3: "anything a migration gets
  wrong is permanent for that user"). Cheap insurance.

Also: bound the date picker, or not? The plugin bounds nothing — future dates are accepted and
make a contact permanently `stable` (`types.ts:112-113`, `daysSince` goes negative).

### Q6. Are `last_interaction` and `last_contact` one fact or two?

§4-C shows the plugin treats them as two and then presents them as one to an LLM. If they are
one fact, `last_interaction` should not be an independent column at all — it should come from the
same row that supplies the date, which again is Q1.

### Q7. Are snoozes logged?

Currently nothing records them (`ContactCard.tsx:163-197`). Repeated snoozing is a real signal
about a relationship. Is a snooze an interaction row with a distinct type, a separate table, or
still invisible? Decide now — retrofitting an event stream after the fact means the earliest and
most interesting history is simply absent.

### Q8. Same-day duplicate policy.

Notifications and the widget will fire repeatedly, and the plugin's only defense was the Tether's
`isContactedToday` guard (`LinkListener.ts:107-118`) on a path that does not port. Does the second
tap on the same day insert a second row, update the first, or no-op? A no-op is the friendliest
and the least honest.

---

## Cross-domain constraints this seam imposes

For INDEX.md's constraint log, once decided:

- **→ `widget` (12), `notify` (11):** whatever a one-tap "mark contacted" writes is fixed by Q1/Q3/Q4.
  The widget **cannot** collect a note or a type (`RemoteViews`, CLAUDE.md) — so if interactions
  require a type, the widget must supply a synthetic one, and that value lands in permanent history.
- **→ `import` (5):** vault frontmatter carries `last_contact` with no matching log entries, and
  markdown log lines carry dates that contradict it (§4). The importer needs an explicit
  reconciliation rule, and under a derived model it must fabricate interaction rows or leave every
  imported contact reading `decay`.
- **→ `ai` (13):** `{{lastInteraction}}` is composed from two independently-updated scalars
  (`AiService.ts:96-101`) and is currently capable of asserting a false fact to a third-party
  provider. Since this is the app's sole network egress (HANDOFF §3, CLAUDE.md), what it sends must
  be true by construction.
- **→ `dashboard` (8), `orrery` (9):** both read recency on every frame. If Q1 chooses "derived,"
  that is an aggregate on a joined table in a render path — measurable only on the physical phone
  (CLAUDE.md), never the emulator.
- **→ `backup` (15):** JSON export shape depends on whether `last_contact` is authoritative data or
  a derived cache. Exporting a derived value and re-importing it as authoritative is a silent
  corruption vector.

---

*Prepared for `/oa-interrogate 1` (`data`) and `/oa-interrogate 4` (`log`). Investigation only —
no decisions taken; every question in §6 is the owner's.*
