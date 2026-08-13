# Workpaper — 04 `log` × 13 `ai`

**Seam:** Interaction log & touchpoint updates ↔ AI message suggestions.
**Method:** every claim below was verified by opening the file on disk. Plugin paths are relative
to `~/projects/Orbit`; dossier paths to `~/projects/orbit-app`. Nothing here re-litigates an
upstream `[DECIDED]`; where a decision has an unstated consequence, that is said explicitly.

---

## 1. What the plugin's prompt contains today — read in full, not summarised

`src/services/AiService.ts` is 540 lines. The prompt pipeline is lines 18–141; everything below
`:143` is the five provider implementations and the orchestrator.

### 1.1 The shipped default template (`AiService.ts:18-38`)

Seven substitution points, in two classes:

| Placeholder | Class | Resolved by |
|---|---|---|
| `{{name}}` `{{category}}` `{{daysSinceContact}}` `{{socialBattery}}` `{{lastInteraction}}` | known scalar | `assemblePrompt` step 1, `AiService.ts:127-132` |
| `{{Conversational Fuel}}` `{{Small Talk Data}}` | markdown section | `assemblePrompt` step 2, `AiService.ts:135-137` → `extractSection` |

Guidelines follow at `:32-38`, including `:34` *"Reference specific topics from their
Conversational Fuel or Small Talk Data if available."*

**The default template contains no interaction-history placeholder at all.** History reaches the
prompt only if the user types one.

### 1.2 `extractContext` (`AiService.ts:95-111`) — the whole of the structured context

`MessageContext` (`AiService.ts:45-51`) has exactly five fields. There is **no history field, no
count, no cadence, no channel list**. The only history-adjacent value is a single composed string:

```ts
// AiService.ts:97-102
let lastInteraction = 'No previous interaction recorded';
if (contact.lastContact) {
    const dateStr = formatLocalDate(contact.lastContact);
    const type = contact.lastInteraction ?? 'unknown';
    lastInteraction = `${dateStr} (${type})`;
}
```

Both halves come from frontmatter scalars (`OrbitIndex.ts:128`, `:159`) — never from the log.
This is 01-data's F5 (`01-data.md:629-634`), and `[data → ai]` (`01-data.md:455-457`) fixes it by
sourcing the channel from the newest interaction row. See §5 for why that fix is not yet complete.

### 1.3 `assemblePrompt` (`AiService.ts:125-141`) — step 2 is an open resolver

```ts
// AiService.ts:135-137
result = result.replace(/\{\{([^}]+)\}\}/g, (_match, sectionName: string) => {
    return extractSection(fileContent, sectionName.trim());
});
```

Every placeholder the step-1 whitelist did not consume is treated as a markdown heading name.
`extractSection` (`AiService.ts:62-86`) builds `^##\s+.*<name>.*$` with the `m` flag (`:66-69`),
captures from the end of that heading to the next `^##\s+` **or EOF** (`:78-82`), and returns the
literal string `'None available'` on a miss (`:72`, `:85`).
`AiService.ts:139` then writes the fully assembled prompt to the debug logger.

### 1.4 The `## Interaction Log` claim — verified true, and stronger than stated

The brief asked me to check that the log is user-reachable via a custom template placeholder. It
is, on four independent pieces of evidence:

1. **The section exists in every default-created contact.** `ContactManager.ts:20-26`
   `DEFAULT_TEMPLATE` emits `## Conversational Fuel` and `## Interaction Log` and nothing else.
   `loader.ts:416`'s generated example schema emits it too.
2. **`extractSection` will match it.** Nothing in the resolver is allow-listed;
   `AiService.ts:135` catches any `{{…}}`.
3. **The plugin's own tests pin the behaviour.** `test/unit/services/ai-context.test.ts:58-62`
   asserts `extractSection(…, 'Interaction Log')` returns log lines, and `:88-91` asserts it
   matches through the `📝` emoji prefix. `docs/AI Features.md:82-90` documents `{{Any Heading}}`
   as a headline feature and `:90` invites the user to invent sections.
4. **It is the worst case of the over-capture hazard.** Because `## Interaction Log` is the *last*
   heading in `DEFAULT_TEMPLATE` (`ContactManager.ts:25`), `extractSection`'s run-to-EOF branch
   (`AiService.ts:80-82`) means `{{Interaction Log}}` transmits the section **plus everything the
   user ever wrote below it**. `ai-context.test.ts:58-62` is literally a test of that branch.

Two more properties of the plugin's log that matter for the port:

- **Newest-first and unbounded.** `ContactManager.ts:212` splices the new line at
  `headerLineIndex + 1`. A `{{Interaction Log}}` placeholder therefore sends the entire history,
  newest first, with no cap.
- **It transmitted little in practice, by accident.** The append is gated on a non-empty note
  (`OrbitHubModal.ts:206`), so the plugin's log is sparse — 01-data F3 (`01-data.md:604-619`).
  `01-data.md:71-81` reverses that: on mobile **every touchpoint from every route writes a row.**
  The same placeholder idea, ported unchanged onto a complete log, multiplies egress silently.
  (03-fuel's workpaper reached the same point from the fuel side — `overlap-ai.md:278-289`,
  exported as `[ai → log]` at `:345-346`. This workpaper is the log-side resolution of it.)

### 1.5 The plugin's disclosure copy, for reference

`docs/AI Features.md:126-133` lists six rows, including "Last interaction — for continuity
reference" and "Note section content — for topic-specific suggestions". Note that "note section
content" means an *Obsidian note section*, not an interaction note. If mobile transmits log rows,
the disclosure needs a row that names the interaction log, because no existing copy covers it.
The only runtime disclosure is a one-time 10-second `Notice` (`settings.ts:338-344`) that names
nothing.

---

## 2. DECISION 1 — Does interaction history reach the prompt, and at what resolution?

The four options are genuinely different products, not gradations. For each: what **new** bytes
leave the device relative to the already-decided baseline, and what the model gains.

**Baseline already decided** (`01-data.md:455-457`, `03-fuel.md:387-396`): name, category, days
since contact, social battery, the newest interaction row's **date + channel**, and fuel items
carrying kind, label and age — minus `off_limits` items and minus unconfirmed `source='ai'` items.

| # | Option | New content leaving the device | Suggestion-quality gain |
|---|---|---|---|
| **A** | **Nothing beyond the baseline.** The log is a local-only feature. | None. | None. Model knows *when* and *how* you last spoke, nothing about the shape of the relationship. Cannot avoid repeating itself, cannot vary channel. |
| **B** | **Aggregates only** — e.g. "6 touchpoints in 90 days; 5 text, 1 call; median gap 14 days; last was a call." | Derived integers and channel **enum names**. No free text. No third-party content whatsoever. It does reveal the *distribution* of your contact over time — behavioural metadata about you, not content about them. | Real and cheap. Lets the model calibrate register ("you two talk weekly" vs "once a year") and is the only option below C that makes the channel-variety suggestion (§4) possible inside the model. |
| **C** | **Newest N rows' channel + date**, notes withheld. | Up to N timestamps and N enum values — a partial timeline rather than an aggregate. | Marginal over B for *more* disclosure than B, since raw dates are strictly more than the summary computed from them. Included because it is the obvious middle and should be rejected on the record rather than by omission. |
| **D** | **Newest N rows' notes verbatim.** | **Free text the user wrote about a third party**, captured in the moment and never reviewed for transmission. "Told me his marriage is in trouble." "Seemed depressed about the diagnosis." | The largest by far. Continuity — "last time he mentioned a job interview, ask how it went" — is the difference between a suggestion that reads as personal and one that reads as a template. |

**Why D is the sharp edge, and why the fuel controls do not cover it.**

1. **There is no `off_limits` on an interaction row.** `03-fuel.md:389-391` makes `off_limits`
   fuel *never transmitted* and absent from the resolver's search space. That control lives on the
   fuel row. `[data → log]` (`01-data.md:426-427`) gives the interaction row "a nullable note" —
   one free-text field, no polarity, no kind. **Transmitting notes routes around the single
   strongest privacy control the AI seam has**, and does so for the data that is more sensitive,
   not less: fuel is curated *in order to be discussed*; an interaction note is whatever you
   typed after the conversation.
2. **It attacks the friction goal at the point of maximum friction.** HANDOFF §1 and §6 make
   cheap capture the product's reason to exist, and `01-data.md:71-77` made every touchpoint write
   a row precisely so the fast paths cost nothing. If notes are transmittable, the user must now
   consider disclosure at the moment of the app's most-fired action.
3. **The v0.9.0 experience is not evidence that this is safe.** `{{Interaction Log}}` existed and
   was reachable, but over a log gated on a typed note (`OrbitHubModal.ts:206`) and with zero
   other readers in `src/` — grep confirms the writer at `ContactManager.ts:182-217`, the template
   at `:20-26`, the settings string at `settings.ts:187-198` and `loader.ts:416` are the only
   occurrences. The mobile log is a different object.

**Sub-forks that only exist if D is chosen** (do not decide these unless D is on the table):

- **The control's shape.** A per-row exclusion flag (an `off_limits` analogue on `interactions`,
  which must then exist from migration 1) vs. a single global "never send interaction notes"
  setting vs. a send-time picker. Note the third is already ruled out by precedent:
  `03-fuel.md:307-308` **[REJECTED] per-item exclusion at send time** for fuel, on the grounds
  that it cannot survive Regenerate without re-asking. Re-proposing it for the log would be
  inconsistent with a decision made one domain earlier.
- **The row cap N**, and whether the cap is rows or characters. The plugin had none (§1.4).
- **The prompt inspector's fidelity.** `03-fuel.md:295-297` decided a settings inspector "always
  shows exactly what a request contains". With aggregates (B) a schematic inspector is honest;
  with verbatim notes (D) the inspector must render a *real contact's* rows or it under-discloses.

**Anything above A also enlarges an existing port hazard.** `AiService.ts:139` writes the
assembled prompt to the debug logger — flagged for fuel as F-AI-9 in
`workpapers/03-fuel/overlap-ai.md:190-195`. Under D the same line puts third-party interaction
notes into logcat.

---

## 3. DECISION 2 — Does AI output become an interaction row, and does `interactions` need `source`?

### 3.1 The plugin: verified, no such path exists

`OrbitHubModal.handleSuggest` (`:260-299`) reads the file, assembles, generates, and displays.
It writes nothing. `AiResultModal` offers exactly Copy / Regenerate / Dismiss
(`AiResultModal.ts:126-142`; `handleCopy` at `:127-130` is a clipboard write and nothing more),
and imports no function from `ContactManager`. **Suggesting a message and logging a touchpoint are
completely disjoint in v0.9.0.** The user copies, leaves the app, sends, comes back, taps Update.

### 3.2 The fork mobile creates

`03-fuel.md:403-404` decided the notification action opens an **in-app compose screen**, and
`03-fuel.md:427-428` deferred whether that screen offers message drafts. So mobile will have one
screen where the suggestion and the send are adjacent — which the plugin never had.

| Option | What it costs |
|---|---|
| **(a) Nothing is logged.** An interaction is something that happened; the user marks contacted separately. | The single highest-intent moment in the app — you just sent a message from inside it — still costs a second deliberate tap. That is exactly the friction HANDOFF §6 blames for the plugin falling out of use. |
| **(b) Hand-off to the SMS composer logs a touchpoint optimistically.** | **Fabricates a fact in the local database.** The user may back out of the composer without sending. That row moves `last_contact` (`01-data.md:102-108`), suppresses a decay notification, and is then read back as ground truth by the next prompt. |
| **(c) Log only on a confirmed send result.** | Requires knowing whether Android returns a trustworthy result from the SMS hand-off. **Unverified — needs a platform check before this option can be costed.** `03-fuel.md:404` establishes only that `expo-sms` cannot run headless (`SMSModule.kt:76`). |
| **(d) Log a *draft*/pending row the user confirms.** | A third state on the most-fired action; probably worse than (a). |

### 3.3 The `source='ai'` analogue — and why it forces a migration-1 decision

`03-fuel.md:321-330` decided AI-proposed fuel is stored with `source='ai'` and **excluded from
prompts until confirmed**, explicitly to break the loop "where a model reads its own earlier
invention back as ground truth and reinforces it on each pass."

That loop reappears here, in a strictly worse form, if **both** (i) a suggested message can become
an interaction note and (ii) notes reach the prompt (Decision 1 option D). The model would read
its own prior output back as "what I actually said to him."

But provenance on `interactions` is needed on a wider argument than AI, and this is the part that
changes a decision:

> **`01-data.md:102-108` makes `last_contact` a maintained materialisation of MAX over interaction
> rows, and `:59-61` gives that DAO the job of inserting the corresponding row. Therefore every
> imported vault contact that has a `last_contact` must be given an interaction row — otherwise
> MAX ≠ `last_contact` on day one.** (`01-data.md:422-423` covers only the *empty* case: "do not
> fabricate a touchpoint" for contacts with no `last_contact`.) That synthesised import row has no
> note, no channel, and — with no `source` column — is **indistinguishable from a real touchpoint**.
> It is also, necessarily, the **newest row for every imported contact**, which is where the AI
> prompt's channel now comes from (`01-data.md:118-119`). The first AI suggestion after import
> would assert a date/channel pair derived entirely from a row the importer invented.

`source` on `interactions` cannot be backfilled truthfully — the identical argument `03-fuel.md:328-329`
and `01-data.md:496-498` used for fuel `created_at`, `ring_seq` and fuel `source`. **This must be
settled before migration 1 ships, not at the AI phase.**

Candidate values, mirroring `03-fuel.md:471`: `user` (full update panel) · `quick` (widget tile /
notification one-tap) · `import` · `ai` (if 3.2b–d is ever adopted). The `quick` vs `user`
distinction is separately useful — see §4.

---

## 4. DECISION 3 — Where does "vary the channel" live, and what does it need?

**Citation correction.** The brief cites `docs/Feature Priority List.md:29`. Line 29 of that file
is blank. The claim is real but lives at **`docs/Feature Priority List.md:98`**, which is *row 29*
of the phase table: *"Last Interaction Type — Track `last_interaction: call | text | in-person |
email` for variety suggestions."*

**Verified: nothing consumes it that way, anywhere.** `last_interaction` is written at
`OrbitHubModal.ts:202` and `ContactManager.ts:141`, read at `OrbitIndex.ts:159`, and consumed at
exactly two sites: `AiService.ts:100` (the prompt) and `OrbitIndex.ts:391` (a JSON debug dump).
The weekly digest (`main.ts:294-356`) reads only status, `lastContact` and `daysSinceContact` —
it never touches the channel and never opens the log. So the variety feature has **no predecessor
in any of the three candidate homes**; whichever is chosen, it is net-new work.

| Home | What it is | Consequences |
|---|---|---|
| **AI feature** | Channel history goes into the prompt; the model is asked to vary. | Requires Decision 1 ≥ option B. Nondeterministic — the model may ignore it. **And it does not work when AI is off, which is the default** (`settings.ts:321`: "Default is disabled"; mobile has no zero-egress provider at all, `03-fuel.md:310-317`). |
| **Log / status feature** | A deterministic on-device rule: last K rows share a channel → surface "try calling" on the profile or card. | Zero egress. Works with AI disabled. Needs a home on a surface — the dashboard card is already carrying a required one-line fuel preview (`03-fuel.md:408-409`), so this competes for the same pixels. |
| **Digest feature** | A weekly rollup line. | Makes the feature conditional on **HANDOFF open question #7** (`HANDOFF.md:267`) — whether the digest ships on mobile at all. Routing it here defers it indefinitely. |

**The schema implication is the same in all three, and it is a problem.**

The rule needs a channel on the rows it counts. `01-data.md:71-73` decided that every touchpoint
writes a row **and that "the channel may be unspecified"** on the one-tap paths. Those one-tap
paths — widget tile, notification action — are the paths the product is built around
(HANDOFF §6). So **the most-fired write path contributes no channel, and a run of five NULLs is
not "you've texted five times running."** The feature is structurally starved by a decision
already made.

Fork, and it is decidable now:

- **The notification path's channel is knowable.** `03-fuel.md:403-404` routes that action to an
  in-app compose screen; if that screen sends SMS, the row can be written with `channel='text'`
  honestly. No user input required.
- **The widget tile's channel is not knowable** — it is a bare "mark contacted". Options: leave
  NULL; adopt a per-contact default channel; or configure the tile action (HANDOFF §6 lists the
  preset widget action set as **[OPEN]**, `HANDOFF.md:163`, so this is a live slot).
- **Or accept NULL and compute variety only over channel-bearing rows** — cheapest, but it means
  the statistic silently describes a minority of touchpoints, which is its own fabrication risk.

---

## 5. Stale or fabricated facts assemblable from the new table and shipped to a provider

F5's class of bug is "two independently-maintained values composed into one asserted fact." The
interactions table does not eliminate that class; it relocates it. Six concrete instances:

**S1 — The date half still comes from the denormalised column, so F5 is only half fixed.**
`[data → ai]` (`01-data.md:455-457`) sources the *channel* from the newest row. But
`daysSinceContact` derives from `contacts.last_contact`, which `01-data.md:102-108` makes a
**maintained materialisation** of MAX — a stored column, recomputed after every insert, edit and
delete. Two values, two sources, two reads. Any lag or missed recompute path (`01-data.md:501`
defers "the precise recompute-MAX trigger points" to phase planning) re-creates exactly the F5
pairing. **The cheap structural fix, stated as a constraint rather than a decision:** the AI path
reads its recency facts from a single query over `interactions` and does not read
`contacts.last_contact` at all.

**S2 — "Newest row" is ambiguous under the owner's own workflow.** `01-data.md:95-100` records
the primary workflow as *log now with no date, fix the date and time later*, and rows are fully
editable. Two rows edited to the same datetime make `ORDER BY date DESC` nondeterministic — the
channel shipped to the provider then depends on SQLite's row order. Needs an explicit tiebreaker
(`date DESC, id DESC`).

**S3 — A NULL-channel fallback silently rebuilds F5.** Per §4, one-tap rows may carry no channel,
and they will frequently be the newest. If the prompt assembler falls back to "the most recent row
that *has* a channel," it composes today's date with a months-old channel — **F5 exactly, in new
code, after the decision that was meant to kill it.** The alternatives are to render an explicit
"unspecified" or to omit the channel clause entirely. This is a decision, not an implementation
detail, because it changes what the model is told.

**S4 — Imported synthetic rows are the newest row for every imported contact.** See §3.3. Without
`source`, the first prompt after import asserts a channel/date pair manufactured by the importer.

**S5 — Optimistic logging from the compose screen.** See §3.2(b). A row for a message that was
never sent moves status, suppresses a notification, and becomes prompt input on the next round.

**S6 — Age arithmetic across the SQL/TS boundary.** Rows store a local datetime via
`date('now','localtime')` (`01-data.md:112-116`, `:538-539`); `formatLocalDate()` is the only TS
formatter (`:540`). Rendering "3 days ago" into the prompt in the wrong layer reintroduces the
UTC off-by-one CLAUDE.md says has already been fixed once. Cheap to get right, invisible when wrong.

**Two live fabrications in the plugin today, recorded because they are the same class and neither
is in 01-data's findings:**

- **The empty-string channel.** `ContactManager.ts:141` initialises `fm.last_interaction = ''` on
  every new contact; `OrbitIndex.ts:159` passes frontmatter through uncoerced; `AiService.ts:100`
  guards with `??`, which does **not** catch `''`. A brand-new contact's prompt therefore reads
  `**Last interaction:** 2026-08-12 ()`. `types.ts:82` types the field as `LastInteractionType`,
  so the type system asserts a value the runtime does not hold.
- **The silent `'call'` default.** `UpdatePanel.tsx:40` initialises the channel select to `'call'`.
  A user who never touches the dropdown writes `last_interaction: call` and the app asserts it to
  a third party as fact. Mobile's "channel may be unspecified" (`01-data.md:71-73`) is the fix —
  but only if the **UI** also defaults to unspecified rather than to a plausible-looking value.

---

## 6. Constraints to export from this seam

- **[log → ai]** Any log-derived prompt input needs an explicit row cap **and** a note-content
  policy. Interaction notes are free text about a third party with **no `off_limits` analogue** —
  the fuel privacy control (`03-fuel.md:389-391`) does not reach them.
- **[log → ai]** The AI path must read recency facts from **one** query over `interactions`, never
  composing `contacts.last_contact` with a separately-read channel (S1).
- **[log → ai]** "Newest row" needs a deterministic tiebreaker; a NULL channel must render as
  unspecified or be omitted, never fall back to an older row (S2, S3).
- **[log → data]** `interactions` needs a **`source`** column from migration 1 — non-backfillable,
  the `03-fuel.md:328-329` / `01-data.md:496-498` argument. Driven by the importer (S4)
  independently of whether AI ever writes a row.
- **[log → import]** `01-data.md:102-108` implies every imported contact with a `last_contact`
  gets a synthesised interaction row. `01-data.md:422-423` covers only the empty case. That row
  needs `source='import'` and a NULL channel, and the importer domain should be told it is
  creating prompt input.
- **[log → ai]** If the prompt inspector (`03-fuel.md:295-297`) must show "exactly what a request
  contains" and log rows are included, the inspector must render real per-contact content.
- **[log → widget/notify]** The channel-variety feature depends on one-tap rows carrying a channel.
  The notification path's channel is derivable (`03-fuel.md:403-404`); the widget tile's is not,
  and the widget preset action set is still `[OPEN]` (`HANDOFF.md:163`).
- **[log → ai]** The disclosure copy has no row covering interaction notes; `docs/AI Features.md:133`'s
  "Note section content" means an Obsidian note section, not a log entry.

## 7. Not checked

- Whether Android's SMS hand-off returns a trustworthy send/cancel result (blocks costing
  §3.2 option c). `03-fuel.md:404` establishes only the headless limitation.
- Token/cost impact of any of Decision 1's options B–D at realistic history depth.
- Whether any surface other than the AI prompt would want cadence aggregates (the digest is the
  obvious candidate but its existence is HANDOFF open question #7).
