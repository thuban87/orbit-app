# Workpaper — Seam: domain 4 (`log`) × domain 5 (`import`) × domain 6 (`crud`) × domain 15 (`backup`)

**Investigated 2026-08-12.** Every `file:line` below was opened and confirmed first-hand, per
CLAUDE.md "Review the code, not the diff." Plugin source read in place at `~/projects/Orbit`;
nothing copied into this repo. Two claims were verified by **executing** transcribed plugin
code rather than by reading it — both are marked and both changed the finding.

**Binding inputs treated as settled and not reopened:** `docs/dossier/01-data.md` in full
(especially its `[data → log]`, `[data → import]`, `[data → crud]`, `[data → backup]`
exports, and F18); `docs/dossier/03-fuel.md`'s `[fuel → import]` routing rule and
`[fuel → backup]` amendment; `HANDOFF.md` §3, §14, §15; `CLAUDE.md`.

---

## 0. Executive summary — the six things that change a decision

1. **The importer's log parser must be written against the vault the owner actually has, not
   against the writer's format string.** The plugin writes
   `- ${date}: ${type}: ${note}` (`ContactManager.ts:189`, composed at
   `OrbitHubModal.ts:207`) — but **not one of the six real, human-authored log lines anywhere
   in the plugin repo uses that shape**, and a parser written from the writer drops **6 of 6**
   of them. Verified by grep and by execution (§1.2, §1.3). Two of the six also wrap the date
   in `**bold**`, and that convention appears in the owner's own test fixtures.
2. **Time of day is unrecoverable, and 01-data made time load-bearing.** `formatLocalDate()`
   emits `YYYY-MM-DD` only (`~/projects/Orbit/src/utils/dates.ts:17-22`), while
   `01-data.md:112-116` `[DECIDED]` that interaction rows store a **local datetime**. Every
   imported row therefore needs a synthesized time, and that synthesized value is
   *observable* — it decides intra-day ordering and it decides which row wins `MAX` on the
   day the import runs. This is an owner-visible choice, not an implementation detail.
3. **Multi-line notes are structurally destroyed by the plugin's own writer.** Verified by
   execution: a note containing a newline is spliced as one array element and re-joined
   (`ContactManager.ts:212-213`), producing continuation lines with no bullet and no date —
   and a continuation line the user began with `- ` becomes indistinguishable from a separate
   log entry (§1.4). The vault contains lines that are *not recoverable* as entries.
4. **Re-runnability is a migration-1 decision, and it is the same decision as backup restore.**
   The source line has no ID. Any content-derived dedupe key (`contact + date + note-hash`)
   is invalidated the moment the user edits an imported row — which `01-data.md:95-100` made
   a **primary workflow**, not an edge case. The only stable identity is a column written at
   import time, and per `01-data.md:497` it cannot be backfilled truthfully. **Export/restore
   has the identical problem and the identical fix**, so one decision serves both (§3, §5.3).
5. **The create form's "when did you last speak" cannot be a scalar write.** `01-data.md:186`
   states the never-contacted predicate as `last_contact IS NULL` *"(equivalently, zero
   interaction rows)"*, and `01-data.md:59-61` gives `last_contact` exactly one writer that
   also inserts the row. So answering the question **must** insert an interaction row. The
   surviving fork is not row-vs-scalar; it is **what that row looks like on the timeline**
   (§4.1) — and option (a) reproduces exactly the row `01-data.md:146-147` rejected.
6. **Exporting `last_contact` as data is a silent corruption vector.** `last_contact` is a
   *maintained materialisation of MAX* (`01-data.md:102-108`), i.e. derived. If the export
   dumps it and the importer restores it as a column value, a single dropped or skipped
   interaction row produces a `last_contact` no row supports — breaking both the single-writer
   rule and the `NULL ⟺ zero rows` equivalence, invisibly (§5.2).

---

## 1. What can actually be parsed out of a real vault log section

### 1.1 The writer, confirmed

`~/projects/Orbit/src/services/ContactManager.ts:182-217`:

```
const timestamp = formatLocalDate();            // :188  — TODAY, no parameter
const logEntry = `- ${timestamp}: ${entry}`;    // :189  — two-space-free, one leading "- "
...
if (line.startsWith('## ') && line.includes(heading))   // :199 — substring match
...
lines.splice(headerLineIndex + 1, 0, logEntry);  // :212 — PREPEND under the heading
return lines.join('\n');                         // :213
```

`entry` is composed at `~/projects/Orbit/src/modals/OrbitHubModal.ts:207` as
`` `${data.interactionType}: ${data.note}` `` and the whole append is gated at `:206`
(`if (data.note)`), so **a touchpoint with no typed note leaves no line at all**. Pinned as
intended by `~/projects/Orbit/test/unit/modals/orbit-hub-modal.test.ts:653-671`
(`handleSave() no note → skips log append`).

`data.note` is `note.trim()` from a `<textarea>` (`~/projects/Orbit/src/components/UpdatePanel.tsx:44`,
`:110-116`). `data.interactionType` is one of exactly five values
(`UpdatePanel.tsx:20-26`): `call` · `text` · `in-person` · `email` · `other`.

### 1.2 What the vault actually contains — every log-shaped line in the plugin repo

Exhaustive grep (`^\s*-\s+(\*\*)?\d{4}-\d{2}-\d{2}`) across `docs/`, `test/`, `src/`:

| Source | Line |
|---|---|
| `~/projects/Orbit/docs/Updating and Editing.md:96` | `- 2026-02-19: Called to catch up about the new job` |
| `~/projects/Orbit/docs/Updating and Editing.md:97` | `- 2026-02-12: Ran into them at the coffee shop` |
| `~/projects/Orbit/docs/Updating and Editing.md:98` | `- 2026-02-01: Quick text to check in` |
| `~/projects/Orbit/test/unit/services/ai-context.test.ts:42` | `- **2026-01-05**: Game night at his place` |
| `~/projects/Orbit/test/unit/services/ai-context.test.ts:43` | `- **2026-02-02**: Texted about the Super Bowl` |
| `~/projects/Orbit/test/integration/ai-suggest-flow.test.ts:57` | `- **2026-02-02**: Texted about the Super Bowl` |

A complementary grep for the shipped writer's shape
(`^\s*-\s+\d{4}-\d{2}-\d{2}:\s*(call|text|in-person|email|other):`) across the same three
trees returns **zero hits**.

**This is the finding.** The two-colon channel-bearing format exists only in code and in one
mock assertion (`orbit-hub-modal.test.ts:647` asserts the argument
`'call: Discussed the project'`, never a rendered file). Every example the owner wrote by hand
— in the user-facing documentation that *teaches the format*
(`docs/Updating and Editing.md:92-99`) and in his own AI fixtures — is the **one-colon,
channel-free** form, and two of six additionally **bold the date**.

`docs/Updating and Editing.md:92` even introduces its block with *"Every update appends an
entry to the `## Interaction Log` section"* — i.e. the documentation asserts these lines are
what the code produces. They are not.

### 1.3 A naive parser, executed against that corpus

Transcribed the regex an agent would write from `ContactManager.ts:189`
(`/^-\s+(\d{4}-\d{2}-\d{2}):\s*([^:]+):\s*(.*)$/`) plus the channel vocabulary from
`UpdatePanel.tsx:20-26`, and ran it:

```
DROPPED   | docs/Updating and Editing.md:96   | - 2026-02-19: Called to catch up about the new job
DROPPED   | docs/Updating and Editing.md:97   | - 2026-02-12: Ran into them at the coffee shop
DROPPED   | docs/Updating and Editing.md:98   | - 2026-02-01: Quick text to check in
DROPPED   | ai-context.test.ts:42             | - **2026-01-05**: Game night at his place
DROPPED   | ai-context.test.ts:43             | - **2026-02-02**: Texted about the Super Bowl
DROPPED   | contact-manager.test.ts:374       | - 2025-01-10: Previous entry
parsed    | code-emitted                     | date=2026-02-19 channel=call note="Discussed the project"
parsed    | code-emitted, colon in note      | date=2026-02-20 channel=text note="Re: the party"
```

Six of six human-authored lines dropped. The *lenient* repair (accept one colon, treat
segment 2 as the channel) is worse, not better: it silently sets
`channel = "Called to catch up about the new job"` — a bogus channel on a row that
`01-data.md:456-457` routes into the AI prompt as the authoritative last-channel fact.

### 1.4 Multi-line notes — verified by execution, and a real unguarded bug

The note is a free `<textarea>` (`UpdatePanel.tsx:110-116`). `appendToInteractionLog` splices
the composed string — newlines and all — as **one array element** (`ContactManager.ts:212`)
and then `lines.join('\n')` (`:213`) writes them out as real lines.

Transcribed both functions verbatim and ran them with a note containing newlines. Output:

```
## Interaction Log
- 2026-02-20: text: Re: the party
- 2026-02-19: call: Talked about the move.
He's stressed: work is bad.
- also: his mum is ill
```

Three distinct hazards in four lines:

- `He's stressed: work is bad.` — a continuation line with **no bullet and no date**. Any
  line-oriented parser drops it, silently losing note content the user typed.
- `- also: his mum is ill` — the user pressed Enter and typed a dash. It is now
  **indistinguishable from a malformed log entry**. A parser lenient enough to salvage
  §1.2's real lines will try to read `also` as a date or a channel.
- `- 2026-02-20: text: Re: the party` — **three** colons; the note itself contains one. Any
  "split on the last colon" or "split on all colons" strategy corrupts it.

### 1.5 The section heading is user data, not a constant

`interactionLogHeading` is a **user-editable setting** (`~/projects/Orbit/src/settings.ts:58`,
UI at `:187-199`), and the writer matches it by *substring* against any `## ` line
(`ContactManager.ts:199`). The owner's own fixtures use `## 📝 Interaction Log`
(`ai-context.test.ts:41`, `ai-suggest-flow.test.ts:56`) while the default template writes
`## Interaction Log` (`ContactManager.ts:25`) and the schema generator writes it too
(`~/projects/Orbit/src/schemas/loader.ts:416`).

**Consequence for the importer:** the heading cannot be hardcoded, and the true value lives
in the plugin's settings blob (`.obsidian/plugins/…/data.json`), not in the contact files. So
the importer either reads that blob — which is *outside* the set of files domain 5 currently
plans to ingest — or it accepts any `##` heading and guesses, or it asks the user. Same class
of problem as the `## Conversational Fuel` heading that `03-fuel.md`'s F2 already documented
(two parsers, disagreeing in 5 of 8 cases).

### 1.6 Recovery table — what an importer can and cannot get

| Datum | Recoverable? | Evidence / caveat |
|---|---|---|
| **Date** | **Yes** (`YYYY-MM-DD`) — but it is the **write** date | `ContactManager.ts:188` stamps `formatLocalDate()` with no date parameter, while `OrbitHubModal.ts:201` writes the user's *chosen* date to frontmatter. For any backdated update the line and the frontmatter contradict each other (01-data F4). The importer cannot tell which entries were backdated. |
| **Time of day** | **No — never** | `~/projects/Orbit/src/utils/dates.ts:17-22` returns date only. `01-data.md:112-116` requires datetime storage. Every imported row's time is **synthesized by the importer**. |
| **Channel** | **Only for Hub-written lines, and ambiguously** | Requires the two-colon form (`OrbitHubModal.ts:207`), which **zero** real fixture lines use (§1.2). Notes legally contain colons (§1.4), so segment-2 extraction is unsafe without validating against the closed vocabulary in `UpdatePanel.tsx:20-26`. |
| **Note** | **Yes for single-line notes; partially for multi-line** | §1.4 — continuation lines are unrecoverable as attached content by a line parser. |
| **Chronological order** | **No — position ≠ chronology** | `ContactManager.ts:212` *prepends*, so file order is write order, not event order; F4 backdating breaks even that. Sort by parsed date, never by line position. |
| **Whether a touchpoint happened at all** | **No** | `OrbitHubModal.ts:206` gates on a note; quick actions (`ContactCard.tsx:146-161`) and tether updates (`~/projects/Orbit/src/services/LinkListener.ts:145-163`) write `last_contact` and **no line**. The log is a strict, unknowably-sized subset of history. |
| **The newest touchpoint's channel** | **One scalar, of unknown vintage** | `last_interaction` is written only by the Hub path (`OrbitHubModal.ts:200-203`); the quick-action and tether paths leave it stale (01-data F3/F5). The pair `(last_contact, last_interaction)` is coherent **iff** the last write was a Hub update — which the vault does not record. |

**Salvage worth naming:** for a note-less Hub update, `last_interaction` is the *only* trace
that touchpoint ever happened. It is a real datum the log does not carry.

---

## 2. The reconciliation fork

**The setup.** A vault contact has a frontmatter `last_contact` (`OrbitIndex.ts:120`,
parsed by `types.ts:163-183`) plus zero-or-more log lines whose dates may be older, newer, or
contradictory. `01-data.md:102-108` `[DECIDED]` that `contacts.last_contact` is a maintained
materialisation of `MAX` over the interaction rows' *current* values, with exactly one writer
(`:59-61`). So the importer does not get to choose what `last_contact` becomes — it only gets
to choose **which rows exist**.

`01-data.md:422-423` already settles the empty case: *"Vault contacts with no `last_contact`
import with it genuinely empty and land on the never-contacted screen. Do not fabricate a
touchpoint."* What is **not** settled is the case where `last_contact` exists and disagrees
with the log.

### Option A — import log lines as rows; let MAX decide, and accept that it moves

Import every parseable line as a row. `last_contact` becomes `MAX(line dates)`.

- **When the log is sparse** (the normal case — §1.6, note-gating), `MAX(lines)` is *older*
  than the frontmatter `last_contact`. Because the log records only note-bearing updates, the
  gap is systematic, not random: quick actions and tether updates are precisely the
  *high-frequency* paths (`docs/Updating and Editing.md:26` calls the quick action *"the
  fastest way"* and `:34` markets the tether as *"Orbit's killer feature"*).
- **First-run experience:** contacts move **backwards** in recency, sometimes by months.
  Status is `elapsed ÷ interval` (`01-data.md:152-158`), so contacts the vault showed as
  `stable` land in the app as `wobble` or `decay`. Day one is a wall of red for a vault the
  user believed was healthy. Worse, this is the *opposite* of the direction the user can
  self-diagnose — they will read it as the app being wrong about them, not as a fidelity
  limit of their old log.
- **Second-order:** per `01-data.md:452` the decay notification path and (domain 11's) launch
  sweep read the same value, so a first launch after import could fire a batch of decay
  notifications for relationships that are not actually decayed.

### Option B — import lines as rows, **plus** synthesize one row from frontmatter `last_contact` when it is newer than every line

Recency is preserved and status matches what the vault showed. The cost is precise:

- **It invents an event.** `01-data.md:20-24`'s terminology note says every touchpoint creates
  a row and the note/channel are optional — so a note-less, channel-less row is *legal*. But
  it will render on the profile timeline as a touchpoint the user cannot remember and cannot
  distinguish from one they logged.
- **Of what channel?** Three sub-options, all with costs:
  - `NULL` — honest, but `01-data.md:456-457` routes "newest row's channel" into the AI
    prompt. A `NULL` newest channel means the prompt's channel slot degrades for exactly the
    contacts the user most recently spoke to.
  - Copy `last_interaction` — the pair is coherent only if the last vault write was a Hub
    update (§1.6), which is unknowable. This re-manufactures 01-data F5's incoherent
    date/channel pair inside the app's own data, at import time, permanently.
  - `other` — a lie with a friendly face.
- **Of what time?** Frontmatter carries no time (§1.6). If the synthesized row is stamped
  local midnight it sorts *before* any same-day imported line; if end-of-day, after. The
  choice decides which row is "newest" and therefore which channel the AI prompt sees.
- **First-run experience:** the dashboard matches the vault, and the timeline has one
  unexplained entry per contact at the top. That entry is the *most prominent* one.

### Option C — import `last_contact` as an authoritative scalar, no synthesized row

**Do not adopt. Stated for completeness with its cost, per the interrogation's rules.**

This reverses `01-data.md:59-61` (`[DECIDED]`, single writer that also inserts the row) and
falsifies `01-data.md:186`'s stated equivalence *"`last_contact IS NULL` (equivalently, zero
interaction rows)"*. Concretely it recreates the plugin's F3 four-writer drift inside SQLite
on day one, and it puts the database into a state the app's own invariants say is impossible
— a non-NULL `last_contact` with no supporting row. The first edit or delete of any
interaction row then triggers the MAX recompute, which **silently overwrites the imported
scalar** with a value derived from the (sparse) rows, i.e. Option A's outcome arrives later
and without warning. Per CLAUDE.md this is an owner decision to reverse, not an engineering
call, and it is worse than either A or B.

### Option D — import lines as rows; do not synthesize; carry the discrepancy to the user

Import parseable lines. Where frontmatter `last_contact` is newer than `MAX(lines)`, show the
user the list at the end of the import ("Your vault said you spoke to Dad on 12 May, but the
log's most recent entry is 3 February — the plugin only logged updates where you typed a
note") and let them accept-all / pick / skip. Accepted items take Option B's shape; the rest
take Option A's.

- **Cost:** it is a screen, at the end of the one flow that is a user's *first* experience of
  the app, and it can be long (one row per contact with a note-less recent touchpoint — i.e.
  most of them).
- **Benefit:** it is the only option where the invented event is invented *by the user*, and
  it converts an unexplainable data artifact into a comprehensible one-time reconciliation.

**Nothing here is decided.** The fork is genuinely owner-visible: A trades first-run
credibility for timeline honesty, B trades timeline honesty for first-run credibility, D buys
both at the cost of a first-run chore.

---

## 3. Re-runnability

### 3.1 There is no identity in the source

The log line carries no ID, no UUID, no created-at (01-data F1: the plugin has **no stable
identity anywhere**). A second import run has nothing to match on except content.

### 3.2 Every content-derived key is defeated by a decision already adopted

Candidate key: `(contact_id, parsed_date, hash(note))`.

- **`01-data.md:95-100` `[DECIDED]` interaction rows are fully editable after the fact,
  including date and time, and those edits DO change status** — and records the owner's
  workflow verbatim as *"log the touchpoint quickly with no date so it auto-stamps now, then
  fix the date and time later… This is a primary workflow, not an edge case."* The moment the
  user corrects an imported row's date or fixes a typo in its note, the content key no longer
  matches its source line. **Re-run → the row is imported again as a duplicate, and the
  corrected version survives beside it.** MAX then recomputes over both, so the *un*corrected
  date can win and walk status back to the value the user just fixed.
- **Genuine same-day collisions.** Two real touchpoints on one day with the same note text
  ("checked in") are indistinguishable. Note that the *stated* worst case — "two genuine
  texts on the same day with no note" — cannot occur in the **vault** (note-less updates
  write no line, `OrbitHubModal.ts:206`), but it **does** occur in the app under
  `01-data.md:71-77` (every one-tap writes a note-less row), which matters for §5's export
  restore path, not for the vault importer.
- **Multi-line notes** (§1.4) hash differently on each run if the parser's line-joining
  heuristic changes at all between app versions.

### 3.3 The fork

**Fork 3a — one-shot import.** The importer runs once; running it again is blocked, or is
"import into a fresh database only."

- Costs nothing in schema.
- Costs the user: a partial import (a parse failure, a crash, a vault they were still
  editing) has no repair path except wiping and starting over. Given `01-data.md:401` (DB
  deleted on uninstall, `allowBackup="false"`), "start over" means re-doing everything they
  did after the first import.
- Also forecloses **incremental** import — "I added ten people in Obsidian last month before
  I switched, import just those."

**Fork 3b — re-runnable, via a stable external key written at import time.**
`interactions.external_key` (and the same on `contacts`), e.g.
`sha256(vault_relative_path + ' ' + raw_line)` captured at the moment of parse. Re-import
skips any row whose key is already present, regardless of subsequent user edits.

- **This column must exist in migration 1.** Per `01-data.md:497` — *"`created_at` and
  `ring_seq` cannot be backfilled truthfully and must be present from the start"* — and per
  `03-fuel.md:328-329`, which applied the identical argument to fuel's `source`. Adding
  `external_key` later gives every pre-existing row a NULL key, and a NULL key cannot dedupe.
  **A one-shot importer that later wants to be re-runnable requires a migration with no
  truthful values for existing rows, on devices you cannot reach.**
- **Residual breakage, stated honestly:** the key is derived from the *raw line*. If the user
  edits the vault after importing (fixes a typo in an old log entry) the key changes and the
  entry re-imports as a new row. Path-based keys also break if the vault contact file is
  renamed — and `01-data.md`'s F1 documents that the plugin's rename is *lossless by
  accident*, so renames are common.
- **Cheaper variant:** `import_batch_id` only — "delete batch N, re-import." Idempotent, but
  it **destroys user edits** made to imported rows, which is the primary workflow again.

**Fork 3c — contact-level identity is the same question, one level up.** `contacts` has **no
`UNIQUE` on `name`** (`01-data.md:40-42`, `[REJECTED]` deliberately). So a second import run
creates duplicate *contacts* unless contacts also carry an external key. Sharpest case: a
contact the user **archived** (`01-data.md:44-50`) is invisible to any name-match the importer
does against live rows — so a re-import silently **resurrects someone the user deliberately
put away**, as a fresh duplicate with a fresh history. Whatever key decision is made for
interactions must be made for contacts in the same breath.

---

## 4. CRUD seam

### 4.1 "When did you last speak" — the fork is not the one it looks like

`01-data.md:140-145` `[DECIDED]`: *"The create form asks when you last spoke, defaulting to
today, with an explicit 'not yet / don't know' that leaves the value genuinely empty."* The
phrasing (*"the value"*) reads scalar. **It cannot be one.** `01-data.md:59-61` gives
`last_contact` exactly one writer, which *also inserts the interactions row in the same
transaction*, and `01-data.md:186` states the never-contacted predicate as `last_contact IS
NULL` *"(equivalently, zero interaction rows)"*. A scalar-only write breaks both.

**So: answering the question inserts a row. That half is forced, not open.** Recording it
here because a crud-domain planner reading `01-data.md:140-145` alone would build a scalar
write and quietly break the equivalence.

`01-data.md:146-147` `[REJECTED]` *"Always seeding a synthetic 'Added to Orbit' row — puts an
event in the timeline that never happened."* That rejection is about *always*, unasked. A row
created because the user answered "we spoke on the 3rd" is a different thing — the user
asserted the event. **But if that row is rendered indistinguishably from a logged touchpoint,
the outcome on the timeline is identical to the rejected one.** The remaining fork is
therefore about *rendering and provenance*:

- **(a) A plain row: channel `NULL`, note `NULL`, date = the answer.** Simplest.
  Indistinguishable on the timeline from a widget one-tap (`01-data.md:71-77`). Reproduces
  the visual outcome `:146-147` rejected, minus the "always." Also: the answer is a **date**
  and the row wants a **datetime** (`01-data.md:112-116`) — same synthesized-time question as
  §1.6.
- **(b) A row carrying provenance, so the timeline can say what it is.** `03-fuel.md:471`
  already adopted `source` ∈ `user | share | ai | import` for fuel rows and required it from
  migration 1 (`:387-388`). An analogous `interactions.source` would let the profile render
  this row as *"you said you last spoke around here"* rather than as a touchpoint, and would
  simultaneously mark **imported** rows and let §3's reconciliation options be visually
  honest. **Same not-backfillable argument** (`01-data.md:497`) — migration 1 or never.
- **(c) Ask for the channel too, at create time.** Removes the NULL-channel degradation in
  the AI prompt (`01-data.md:456-457`) at the cost of a field in the flow
  `01-data.md:343-344` explicitly wants kept cheap.

**Downstream fork this opens:** if `interactions.source` is adopted, does the *ranked/derived*
read side treat `source='import'` or `source='create-form'` rows differently — do they count
for cadence statistics? for the AI prompt's channel? That is a domain 4/13 question, but the
**column** is a migration-1 question.

### 4.2 Archive — decided at the contact level, undecided at the interaction level

`01-data.md:44-50` `[DECIDED]`: archived contacts are *"hidden from every screen with data
untouched, and are restorable."* `:542-543` implements it as an `archived_at IS NULL`
predicate. So **interaction rows survive archive and return on restore** — that follows
directly and needs no new decision.

Three things do **not** follow and are open:

1. **Does the clock run while archived?** `01-data.md:196-200` decided *snooze* is suppression
   only, clock keeps running, explicitly because *"time really did pass and the app must not
   pretend otherwise."* Archive is a different affordance and was not given the same ruling.
   If the clock runs, restoring after a year returns a contact instantly in deep decay and —
   per `01-data.md:451-452` — immediately eligible for a decay notification. If the clock is
   frozen, that requires storing something at archive time (an offset, or a "paused at"), and
   **that cannot be backfilled** for contacts archived before the column existed.
2. **Can anything still write interaction rows to an archived contact?** `03-fuel.md:159-160`
   already ruled that the capture picker **excludes archived contacts**, on the reasoning that
   *"fuel must not accumulate on someone deliberately put away."* The identical argument
   applies to the importer (§3c) and to any widget/notification path that holds a stale
   `contact_id`. Whether the single `last_contact` writer refuses archived contacts, or
   accepts silently, is unstated.
3. **Does archive itself need to be recorded as history?** `01-data.md:204-205` left the
   analogous snooze question open (*"whether expired snoozes are retained as history — the
   plugin discards them"*). Same shape.

### 4.3 Purge — an enforcement point 01-data understates

`01-data.md:83-93` `[DECIDED]`: purge destroys everything the contact owns — interactions,
fuel, custom values, the photo file, scheduled notifications, field history. Its mechanism
note at `:92-93` says only *"the photo file and scheduled notifications are unreachable by
foreign key and need explicit application-level cleanup."*

**That understates it.** `01-data.md:758-765` (F15) established that `PRAGMA foreign_keys` is
OFF by default *and* that `withExclusiveTransactionAsync` opens a fresh connection and issues
`BEGIN` before the callback runs, with no hook to set a PRAGMA first — *"so foreign keys are
unconditionally off inside every exclusive transaction."* `03-fuel.md:417-419` already drew
the conclusion for fuel: purge must delete fuel rows **explicitly**, in the same transaction,
because `ON DELETE CASCADE` is decorative there.

**The identical conclusion applies to `interactions`.** If purge runs inside an exclusive
transaction (which `01-data.md:406-407` implies it must, for atomicity), a bare
`DELETE FROM contacts` leaves orphaned interaction rows. Because `last_contact` is derived
from those rows and the contact is gone, they are unreachable — invisible garbage that a
later name-matched re-import (§3c) could re-attach to a new contact with the same name.

This is **enforcement of an adopted decision, not a new one** — flagged so it is not lost
between `01-data.md:92-93`'s narrower phrasing and F15.

---

## 5. Export / backup seam

### 5.1 Interactions are named, but not shaped

`01-data.md:459-463` `[data → backup]`: *"Export must cover: contacts, interactions, the
`categories` table, the separate profile record, `ring_seq`, favourites rank, custom field
defs and values, and (decide) `field_history`."* `03-fuel.md:414-416` already amended that
list to add fuel rows with `kind`, `label`, `url`, `created_at` and `source`.

So `interactions` is **named** — the omission 03-fuel caught for fuel does not repeat. But the
list gives fuel a **column enumeration** and interactions only a table name, and the columns
are exactly where the risk is (§5.2, §5.3).

### 5.2 The sharp risk: exporting a derived value beside the rows that derive it

`contacts.last_contact` is *"a maintained materialisation of MAX, still a stored column with a
single writer"* (`01-data.md:102-108`). It is **stored but derived**. `status`, `daysSince`,
`daysUntilDue` and the continuous progress value are *"never stored"*
(`01-data.md:175-181`, `:524-527`) and so cannot leak into an export by accident — but
`last_contact` **can**, because it is a real column and a naive
`SELECT * FROM contacts` will emit it.

**The corruption vector, concretely.** Export dumps `contacts.last_contact = 2026-05-12` and
the interaction rows. On import, anything that causes the row set to differ from the exported
one — a skipped duplicate under §3's dedupe, a row rejected by a validator, a partial restore,
a merge into a database that already has some of these rows, a schema version that dropped a
column — leaves `last_contact` asserting a date no row supports. Nothing detects it: the value
is a legal date in a legal column. It then propagates to status, to the orrery's angular
position, to notification eligibility, and to the AI prompt. It is corrected only by accident,
the next time the user edits or deletes an interaction row and triggers the MAX recompute —
at which point their dashboard silently changes for no reason they can see.

**The same class, one level down:** `contacts.photo` is a device-local path
(`01-data.md:541`) and is meaningless on another device or after a reinstall; and any
`interactions.id` surrogate key is meaningless across databases.

### 5.3 What the format must do

Three requirements, each traceable to an adopted decision:

1. **Never restore `last_contact` from the file.** Either omit it entirely, or emit it under a
   clearly derived key (e.g. a `_derived` block) that the importer **recomputes and compares**
   rather than writes. Restore must go through the single writer
   (`01-data.md:59-61`, `:431`) so recency is reconciled *by construction* on the way in,
   exactly as it is in normal operation. If the recomputed value disagrees with the exported
   one, **the rows win** — and it is worth reporting, because a disagreement means rows went
   missing.
2. **Interactions must round-trip with a stable identity, and it is §3's identity.** A backup
   restored twice (or merged into a database that already holds some of it) duplicates
   history and moves `MAX` unless rows carry a key that survives the trip. Surrogate `id` is
   not that key across databases. **This is the same `external_key` decision as §3b, and one
   column can serve both** — vault-imported rows key off the vault line, app-created rows key
   off a generated UUID at insert. Deciding these separately produces two mechanisms; deciding
   them together produces one, and both must land in **migration 1**
   (`01-data.md:497`; the precedent is `03-fuel.md:387-388`'s `source`/`created_at`).
   *Note the collision case is real here in a way it is not in the vault:* under
   `01-data.md:71-77` every one-tap writes a note-less, channel-less row, so **two one-taps on
   the same contact on the same day are byte-identical** and content-hashing genuinely cannot
   tell them apart.
3. **Enumerate the interaction columns in the export contract, not just the table.** At
   minimum: the local datetime (`01-data.md:112-116` — and it must round-trip as *local*, not
   as a UTC instant, or `01-data.md:539-540`'s off-by-one returns through the back door),
   nullable note, channel, and whichever of `source` / `external_key` §3b and §4.1 adopt.

### 5.4 One more thing the export decision touches

`01-data.md:186-190` makes never-contacted contacts a population defined *entirely* by having
zero interaction rows. An export that carries contacts but drops or fails on their interaction
rows therefore does not merely lose history — it **relocates those contacts to a different
screen**. The failure mode is not "some data is missing"; it is "these people have vanished
from my dashboard."

---

## 6. The forks, stated as decisions

Nothing below is decided here.

1. **Reconciliation (§2).** A (rows only; recency walks backwards, day-one wall of red) ·
   B (synthesize a row from frontmatter — and then: what channel, what time) · D (show the
   discrepancy and let the user choose). C is stated only to be refused.
2. **The importer's synthesized time-of-day (§1.6, §2).** Not an implementation detail — it
   decides intra-day ordering and which channel the AI prompt reads.
3. **Re-runnable or one-shot (§3)** — and if re-runnable, `external_key` on `interactions`
   **and** `contacts`, in **migration 1**. A one-shot importer forecloses incremental import
   and has no repair path for a partial run.
4. **Whether `interactions` carries a `source` column (§4.1)**, mirroring `03-fuel.md:471`.
   Decides whether the create form's "when did you last speak" row, and imported rows, can be
   rendered honestly on the timeline instead of as touchpoints the user never logged.
   Migration 1 or never.
5. **Whether the create form also asks for the channel (§4.1c)** — one more field in the flow
   that must stay cheap, versus a NULL channel in the AI prompt for the most recent contact.
6. **Whether the clock runs while a contact is archived (§4.2)** — and whether the importer
   and any stale `contact_id` may write rows to archived contacts.
7. **Whether the export omits `last_contact` or emits it as explicitly-derived-and-verified
   (§5.3.1).** Either is defensible; dumping it as data is not.
8. **Whether §3's import identity and §5's backup identity are one column or two (§5.3.2).**

## 7. Enforcement points (not decisions — adopted rules that need naming in the dossier)

- **Purge must `DELETE FROM interactions` explicitly**, in the same transaction, for the same
  reason `03-fuel.md:417-419` requires it for fuel: foreign keys are unconditionally off
  inside `withExclusiveTransactionAsync` (`01-data.md:758-765`). `01-data.md:92-93` currently
  names only the photo file and notifications as needing explicit cleanup.
- **The create form's "when did you last speak" answer inserts an interaction row**; a
  scalar-only write breaks `01-data.md:59-61` and `:186`.
- **`loader.ts`'s parsers are replaced, not reused** (`01-data.md:420-421`, F18) — and the
  log-section parser is **net-new besides**: nothing in the plugin reads the interaction log
  into structured form. `extractSection` (`~/projects/Orbit/src/services/AiService.ts:62-86`)
  returns the section as an undifferentiated string, and only if a user hand-writes
  `{{Interaction Log}}` into their prompt template — which no shipped template does
  (`AiService.ts:18-38`), though `~/projects/Orbit/test/integration/ai-suggest-flow.test.ts:275`
  demonstrates it as a supported configuration.

---

## Appendix — verification method

- Plugin source read in place at `~/projects/Orbit`; nothing copied into this repo, per
  CLAUDE.md.
- §1.2's corpus is an exhaustive `grep -rnE '^\s*-\s+(\*\*)?[0-9]{4}-[0-9]{2}-[0-9]{2}'` over
  `docs/`, `test/` and `src/`, plus a complementary grep for the writer's two-colon shape
  which returned zero hits.
- §1.3 and §1.4 were produced by transcribing `ContactManager.ts:188-214` and
  `OrbitHubModal.ts:207` verbatim into Node and **executing** them, not by reading. §1.4's
  multi-line hazard was not visible from reading the source and was found by running it.
- Every `01-data.md` and `03-fuel.md` citation was opened and quoted from the file, not from
  memory or from another agent's summary.
