# Workpaper — `fuel` ↔ `ai` (domain 3 ↔ domain 13)

**Seam:** Conversational Fuel storage & interaction ↔ AI message suggestions
**Investigated:** 2026-08-12
**Method:** full reads of `~/projects/Orbit/src/services/AiService.ts`, `src/modals/OrbitHubModal.ts`,
`src/modals/AiResultModal.ts`, `src/components/AiResult.tsx`, `src/components/FuelTooltip.tsx`,
`src/utils/logger.ts`, `test/unit/services/ai-context.test.ts`, `test/unit/services/ai-prompt.test.ts`;
targeted reads of `src/settings.ts`, `src/services/ContactManager.ts`, `src/schemas/loader.ts`,
`test/integration/ai-suggest-flow.test.ts`, `docs/AI Features.md`, `docs/Feature Priority List.md`.
Every file:line below was opened and confirmed first-hand, per CLAUDE.md "Review the code, not the diff."

**Hypothesis under test:** fuel's storage shape decides what the AI feature can be, and decides
exactly what text crosses the device boundary. **Confirmed, and more strongly than expected** —
two independent AI requirements (off-limits polarity, staleness) each force the same schema
attribute onto a fuel row, and the privacy boundary is currently unbounded *by construction*
rather than by oversight.

---

## 0. Verified ground truth

| Claim | Evidence |
|---|---|
| Default prompt names two sections, only one of which any template creates | `AiService.ts:26-30` |
| `{{Heading}}` is a substring match over the whole heading line, section runs to next `##` or EOF | `AiService.ts:62-86`; `ai-context.test.ts:77-81` |
| Known fields replaced first, then *every* remaining `{{...}}` treated as a section name | `AiService.ts:125-141` |
| Missing section silently becomes the literal string `None available` | `AiService.ts:72`, `AiService.ts:85` |
| The prompt template is one global setting, not per-contact | `settings.ts:37`, `settings.ts:444-458` |
| Fuel is never written by the plugin — read-only, hand-typed in the note | `FuelTooltip.tsx:61-62`; `types.ts:87-88`; only writers are template constants `ContactManager.ts:19-25`, `loader.ts:413` |
| `AiService.ts`'s sole Obsidian coupling is `requestUrl` | `AiService.ts:10`, call sites `180, 194, 211, 264, 319, 377, 431` — grepped, no other `obsidian` symbol |

---

## 1. What replaces `{{Heading}}` when fuel is structured?

### F-AI-1 — The shipped default prompt already references a section the shipped default template never creates. This is the failure mode of *any* name-based binding, and it is live in v0.9.0.

`AiService.ts:29-30` interpolates `{{Small Talk Data}}`, and `AiService.ts:34` instructs the model to
"Reference specific topics from their Conversational Fuel or Small Talk Data if available."
`## Small Talk Data` is created by **no template in the plugin**:

- `ContactManager.ts:19-25` `DEFAULT_TEMPLATE` emits `## Conversational Fuel` and `## Interaction Log`, nothing else.
- `loader.ts:413` (the generated example schema) emits `## Notes`, `## Conversational Fuel`, `## Interaction Log`.
- Repo-wide, the string "Small Talk" appears only in `AiService.ts`, `docs/`, and test fixtures.

So for every contact the plugin itself created, the default prompt's `{{Small Talk Data}}` resolves to
`None available` (`AiService.ts:85`) and the guideline at `:34` points the model at nothing. Silent,
undetectable from the UI, shipped for two releases.

**Why this changes a decision:** name-bound placeholders fail open and fail silently. Any mobile
option that keeps user-named binding (buckets, custom fields) reproduces this exact bug class, and
on mobile it gets *worse*, because §14 quarantine can delete the thing the name points at.

### F-AI-2 — The plugin's binding is fuzzy; structured storage cannot be. That is a UI decision, not an implementation detail.

`extractSection`'s pattern is `^##\s+.*<name>.*$` (`AiService.ts:65-69`), so `{{Small Talk Data}}`
matches `## 🧠 The Small Talk Data` (asserted, `ai-context.test.ts:77-81`) and `{{Conversational Fuel}}`
matches `## 🗣️ Conversational Fuel` (`ai-context.test.ts:71-75`). Users could be sloppy and it worked.
A row-backed bucket or a `custom_field_defs` row either exists under that exact key or it does not.

**Consequence:** if placeholders survive, the template editor must offer a **picker over existing
buckets/fields**, never a free-text box. A free-text box on mobile reproduces F-AI-1 on every typo,
with a phone keyboard.

### The four real alternatives

| Option | What it is | Cost | What it forbids |
|---|---|---|---|
| **A. Fixed placeholder set** | Closed set: `{{name}} {{category}} {{daysSinceContact}} {{socialBattery}} {{lastInteraction}} {{fuel}} {{recentInteractions}}` | Kills what `AI Features.md:43` calls "one of Orbit's most powerful features" | Per-contact prompt shape; user-invented sections |
| **B. User-named fuel buckets → placeholders** | Fuel rows carry a bucket; `{{Safe Topics}}` selects rows in it | Buckets become a schema the user maintains; rename silently breaks the global template (F-AI-1) | Nothing structurally — but see F-AI-6, buckets are also the thing polarity needs |
| **C. §14 `textarea` custom fields as sections** | `{{Gift Locker}}` = value of a custom field | **Quarantine/expiry can delete the referent** (HANDOFF §14.5) | Nothing at authoring time; breaks at sweep time |
| **D. Drop templating** | Prompt is code; expose tone/length/"suggest an activity" toggles | Loses "Making it sound like you" (`AI Features.md:103-110`), the thing that makes output usable | User voice-matching beyond the toggles |

**Recommended hybrid:** A + B — a fixed placeholder set plus one `{{fuel}}` that expands structured
fuel rows, with per-bucket opt-in. Templating survives and the egress set stays enumerable (see §2).

### F-AI-3 — Option C reverses the reasoning the owner already applied in domain 1, and adds a delete hazard the markdown version did not have.

`docs/dossier/01-data.md:227-230` records **[REJECTED] Category as just a custom dropdown field**,
with the stated reason: "grouping, **the AI prompt** and the importer would then depend on a field the
user can quarantine or delete." Wiring `{{Heading}}` to §14 custom fields makes the AI prompt depend
on exactly that, one domain later.

Concretely, if the global `aiPromptTemplate` (`settings.ts:37`) names a custom field:

1. User quarantines the field (HANDOFF §14.5). UI stops rendering it; **the prompt keeps rendering
   `None available` for every contact**, with no error and no link back to the quarantined field.
2. 30 days later the launch sweep drops the def row *and* the column (HANDOFF §14.5). The value is gone;
   `field_history` holds the values but not the placeholder binding.
3. Nothing in §14 or in 01-data makes the sweep aware that a setting references the field.

**Owner decision required, and it is a risk-posture call, not an engineering one:** may the AI prompt
depend on user-deletable fields at all? If yes, quarantine needs a "this field is referenced by your
AI prompt" warning at quarantine time, and that is a §14 surface change.

### F-AI-4 — If placeholders bind to §14 fields, they must bind to `col_name`, not to the label. Nothing records this.

HANDOFF §14.1 makes rename a metadata-only `ALTER TABLE … RENAME COLUMN` *precisely so labels are
cheap to change*. A label-bound placeholder breaks on every rename; a `col_name`-bound placeholder
survives but is invisible to the user, who typed a label. And per `[data → fields]`
(`01-data.md:410-415`) `col_name` is whitelist-**constructed** from the label, so the two are not
even reliably similar. Whichever is chosen, the template editor must display labels and store ids.

---

## 2. The privacy boundary

### F-AI-5 — The plugin shows the user **nothing** before transmitting. Verified in code; the docs overstate the controls.

- `handleSuggest` (`OrbitHubModal.ts:260-299`) reads the file, assembles the prompt, and calls
  `generate` with no intermediate confirmation.
- The result modal is opened **in loading state before the call** (`OrbitHubModal.ts:280-281`;
  `AiResultModal.ts:38` sets `loading = true` in the constructor). The send is already in flight when
  the first pixel appears.
- `AiResult.tsx:45-91` renders avatar, name, `category · Nd ago`, the returned message, and
  Copy / Regenerate / Dismiss. **There is no prompt display, no preview, no per-item selection, and no
  cancel.** `Dismiss` (`:87-89`) closes the modal; it does not abort the request.
- The only disclosure is a one-time 10-second `Notice` fired when the provider first moves off `none`
  (`settings.ts:338-343`): *"This feature sends contact data to external AI services."* It never names
  the data and never fires again.
- **Regenerate re-reads the file and re-assembles the prompt** (`AiResultModal.ts:112-124` →
  `OrbitHubModal.ts:272-277`), so a second send can carry different content from the first — still unshown.

`docs/AI Features.md:124-133`'s disclosure table lists "Note section content" as one row. Under
`{{Any Heading}}` that row is unbounded by construction: the template names arbitrary sections, and
extraction runs to the next `##` **or EOF** (`AiService.ts:78-85`), so a section placed last in a note
transmits the remainder of the file. The table cannot be made accurate while the mechanism is open-ended.

**This is the decision the storage model forces.** Fixed placeholders (option A) are the only shape
where a truthful, exhaustive "what leaves the device" list can be written at build time and asserted
in a test. Every other option makes the disclosure a promise about user behaviour.

### F-AI-6 — The plugin transmits contacts' explicitly off-limits topics inside a prompt that tells the model to use them. This is live, and it is the single strongest argument for structured fuel.

The plugin's canonical fuel section — its own unit fixture (`ai-context.test.ts:18-28`) and integration
fixture (`ai-suggest-flow.test.ts:35-43`) — has three semantic sub-blocks:

```
## 🗣️ Conversational Fuel
**Last Thing We Talked About:**   ← event-shaped, perishable
**Safe Topics (Go-To):**          ← timeless, positive
**⛔ Off-Limits / Triggers:**      ← NEGATIVE POLARITY
- His ex (messy breakup)
```

The convention is real code, not fixture decoration: `FuelTooltip.tsx:272` normalises `⛔`→`🚫` when
parsing fuel lines, and `FuelTooltip.tsx:288-293` renders `**Bold**` lines as sub-headers.

`extractSection` returns the section **whole** — `ai-context.test.ts:71-75` asserts the entire block
comes back — and `AiService.ts:26-27` drops it under the header `**Conversational Fuel:**`, directly
above `AiService.ts:34`: *"Reference specific topics from their Conversational Fuel … if available."*

So the sole network egress in the app ships "his ex (messy breakup)" to a third-party model together
with an instruction to reference it. The only polarity signal is an emoji and a bold line the model
must infer meaning from.

**Decision this forces:** polarity must be an attribute of a fuel row, not a convention in text.
A markdown blob cannot express it in a machine-checkable way; per-item rows with a `kind` can. Three
downstream shapes then become available, and they are not exclusive:

1. **Never transmit** `kind = 'off_limits'` rows (safest; the model cannot leak what it never saw).
2. **Transmit into a negative slot** — a separate `**Never mention:**` block in the prompt.
3. **Both** — negative slot for a locally-run provider, never-transmit for cloud.

Option 1 is the only one that survives "any change that widens what that feature transmits is an
owner decision" without an argument, and it is the recommendation.

### F-AI-7 — "Select which fuel items to send" is real only if fuel is per-item rows, and only in two of its three forms.

| Shape | Cost | Verdict |
|---|---|---|
| (a) Per-send checkbox list | One extra screen on **every** use | The friction trap. Contradicts HANDOFF §1 ("does this reduce the number of taps"), which is the stated measure for every design decision. Also cannot survive Regenerate (F-AI-5) without re-asking. |
| (b) Persistent per-item `share_with_ai` flag, set at capture | Zero at send time; small at capture | Real. Durable across Regenerate. |
| (c) Bucket-level policy ("send Safe Topics, never send Off-Limits") | One setting, once | Real, and maps onto the structure that already exists (F-AI-6). |

With a single text blob, none of the three is expressible without putting a text editor in the send
path. **Recommend (b) + (c).** They are the same schema attribute F-AI-6 already requires.

### F-AI-8 — Mobile-only removes the plugin's zero-egress option. The plumbing to keep it already exists.

`settings.ts:325` skips Ollama in the provider dropdown when `Platform.isMobile`. `AI Features.md:13`
markets Ollama as the one provider where "no data leaves your device." Orbit-app is Android-only, so a
straight port of that reasoning means **every** AI use ships fuel off-device.

`OllamaProvider`'s constructor already takes a `baseUrl` with a localhost default
(`AiService.ts:173`), so a user-entered LAN endpoint (`http://192.168.x.x:11434`) is a settings field
and nothing else. This decides whether "send my fuel to an AI" can ever mean "stays on my network",
which is exactly the promise HANDOFF §3 and §8 are built on. **Owner decision.**

### F-AI-9 — The assembled prompt, fuel text included, is written to `console.log`.

`AiService.ts:139`: `Logger.debug('AiService', 'Assembled prompt:\n${result}')`. Gated — `logger.ts:11`
defaults `level = 'off'` — but the logger's own docstring lists "API payloads" as a debug category, and
HANDOFF §4 ports `logger.ts` "nearly as-is." On Android that output lands in logcat / the Metro pane
(CLAUDE.md's device section). Port decision, cheap now: redact section content from that log, or drop
the line. Not a network egress; it is an on-device disclosure in a product whose pitch is disclosure control.

---

## 3. Should AI be able to *write* fuel?

Two sub-features with different privacy shapes. They should be decided separately.

### (i) Suggest topics from existing context
Egress unchanged (the same contact data already goes out). Ingress is new: model output becomes app data.

### (ii) Summarise a shared article into a fuel item — **this widens egress and is therefore an owner decision**
HANDOFF §6 `[DECIDED]`: "Share a link, article, or text into Orbit → pick a contact → attaches as
Conversational Fuel." Summarising requires transmitting the **article body** — third-party content that
is not contact data and has never entered the model's context under any existing design. Per CLAUDE.md,
"Any change that widens what that feature transmits is an owner decision." This qualifies plainly.

Two further reasons to keep summarisation out of the capture path itself:
- Share-sheet capture is *the* friction feature (HANDOFF §6, §15.6). A network round-trip inside it
  adds an offline failure mode to the flow that must never fail.
- HANDOFF §3 `[DECIDED]` "no blocking network calls on the dashboard path" is the same principle.

**Recommendation:** capture stores raw first, always, offline. Summarise later as an explicit,
optional, cancellable action — and only after the owner rules on the widening.

### F-AI-10 — If AI can write fuel, provenance must be on the row from migration 1. It cannot be backfilled.

A fuel row needs `source` (`user` | `ai` | `share` | `import`) and `created_at`. Three reasons, each
independent:

1. **A hallucinated fact about a real person, rendered on a profile as fact, is worse than no fuel.**
   The UI needs to distinguish "you wrote this" from "a model proposed this."
2. **Feedback loop.** Fuel is a prompt input (`AiService.ts:26-27`). If AI-written fuel is fed back
   unmarked, the model reads its own invention as ground truth on the next generation, and each pass
   reinforces it. Either exclude `source='ai'` rows from the prompt until the user confirms them, or
   label them as unconfirmed inside the prompt. **This is a decision, and it belongs to `fuel`, not `ai`.**
3. **Export.** `[data → backup]` (`01-data.md:459-463`) makes export load-bearing. A user auditing what
   they actually said versus what a model wrote needs provenance in the export.

Precedent for "must be present from the start": `01-data.md:497` — `created_at` and `ring_seq`
"cannot be backfilled truthfully and must be present from the start." Same argument, same table shape.

Note there is **no fuel writer anywhere in the plugin** to extend: `contact.fuel` is read
(`FuelTooltip.tsx:61-62`), declared (`types.ts:87-88`), and never written (01-data F8, re-verified).
A fuel editor is net-new in every variant; there is no "AI writes into the existing editor" shortcut.

---

## 4. Staleness

### F-AI-11 — Fuel has no age, the prompt has precise relationship recency, and the model is told to use the topics. That asymmetry *is* the "how was the trip?" bug.

`AiService.ts:22` gives the model `**Days since last contact:** {{daysSinceContact}}` — exact recency
for the *relationship*. `AiService.ts:26-27` gives it undated fuel and `:34` instructs it to reference
specific topics. A line typed two years ago and a line typed yesterday are indistinguishable in the
prompt. The plugin cannot fix this: there is no per-item timestamp to filter on, because there are no
items — there is a markdown blob.

This is **F5's sibling**. `01-data.md:629-634` (F5) records that the AI ships an incoherent
date/channel pair; `[data → ai]` (`01-data.md:455-457`) fixes the channel half by sourcing it from the
newest interaction row. The *fuel* half of the same class of bug is unrecorded and unfixed.

Options, increasing cost:

| Option | Cost | Note |
|---|---|---|
| `created_at` on each fuel row, **age rendered into the prompt** ("3 days ago" / "14 months ago") | Free — needed for ordering anyway; a handful of prompt tokens | Cheapest real fix. Lets the model judge instead of guessing. |
| **Age filter** — only send fuel newer than N days | One setting | **Unsafe without a `kind`:** "Safe Topics" (board games, tech) are timeless and would be filtered out wrongly, while "Last Thing We Talked About" is exactly what should expire. |
| **Lifecycle** — `resolved_at`, marked used when an interaction references it | Real UI work; touches domain 4 (`log`) | The plugin's own "Last Thing We Talked About" bucket is *by definition* superseded by the next interaction. Flag to `log`. |

### F-AI-12 — Two independent features demand the same schema attribute. That convergence is what settles the storage model.

Polarity (F-AI-6: never suggest an off-limits topic) and staleness (F-AI-11: expire event-shaped fuel
but not timeless fuel) are unrelated requirements that **both** require a per-row `kind`. Neither is
expressible in a blob. A single text field cannot satisfy either without re-deriving structure by regex
at send time — which is precisely what `extractSection` does today, and precisely what produced F-AI-1
and F-AI-6.

**This is the finding that changes the fuel storage decision.** Per-item rows with `{kind, created_at,
source}` are not a nice-to-have for the AI seam; they are the minimum shape under which the AI feature
can be made safe at all.

### F-AI-13 — `{{Interaction Log}}` was a legal placeholder over a *sparse* log. Mobile's log is complete-by-construction, so porting the idea unchanged silently multiplies egress.

`ai-context.test.ts:88-91` asserts `extractSection(…, 'Interaction Log')` works, and
`ContactManager.ts:24` puts `## Interaction Log` in the default template — so unlike Small Talk Data,
this placeholder was *reachable for every contact* and a user could plausibly have put their whole
history in the prompt. It transmitted little, because the plugin's log is gated on a non-empty note
(01-data F3) and is therefore sparse by design.

`01-data.md:71-77` `[DECIDED]`: **every touchpoint inserts a row**, including widget and notification
one-taps. The mobile log is complete. Any log-derived prompt input therefore needs an explicit row
limit and a note-content policy (notes are free text about a third party — arguably more sensitive
than fuel), decided in this domain rather than inherited.

---

## 5. HANDOFF §4's Obsidian-coupling claim — verified, plus three port hazards it does not mention

**The claim is accurate.** `AiService.ts` imports exactly one Obsidian symbol, `requestUrl`
(`AiService.ts:10`), used at seven call sites (`180, 194, 211, 264, 319, 377, 431`). Its other imports
are `Logger`, `formatLocalDate`, and the `OrbitSettings` / `OrbitContact` **types** (`:11-14`). No
`App`, `vault`, `TFile`, `Notice`, `Platform`, or `moment` anywhere in the file.

Three things §4 does not say, all of which affect the port:

1. **`fetch` resolves on 4xx/5xx; `requestUrl` does not.** The Ollama availability ping explicitly
   passes `throw: false` (`AiService.ts:183`) while every `generate` path passes nothing and never
   checks `response.status`. A naive `requestUrl` → `fetch` swap therefore routes every HTTP error
   into the "unexpected response format" branches (`:279-281, :335-337, :387-389, :445-452`), turning
   "invalid API key" into a generic parse failure. The port must add explicit `response.ok` handling.
   *(Inferred from the code's own use of `throw: false`, not from Obsidian docs.)*
2. **`fetch` brings `AbortController`, which the plugin has no equivalent of.** F-AI-5 notes there is
   no way to cancel an in-flight send. The swap makes a real Cancel button free — worth taking, since
   the modal already opens before the response arrives.
3. **Type-level coupling.** `AiService.ts:14` imports `OrbitContact` from `types.ts`, whose line 1
   imports `TFile` from `obsidian` — the contamination §4 already flags separately. The two statements
   are consistent (runtime is clean, types are not), but it fixes the port order: strip `TFile` from
   `types.ts` first, per HANDOFF §15.2.

---

## Design questions this raises for the owner

1. **Does the mobile prompt keep user-authored placeholders at all** — fixed set (A), fuel buckets (B),
   §14 custom fields (C), or no templating (D)? Everything else in this workpaper follows from this.
2. **May the AI prompt depend on a field the user can quarantine or delete?** (F-AI-3.) Domain 1 already
   said no for `category`, on the same reasoning.
3. **Are off-limits fuel items never transmitted, or transmitted into a negative prompt slot?** (F-AI-6.)
4. **Is there a preview / confirm before the first send** — always, first-time-per-contact, or never?
   The plugin has none, and Regenerate re-reads (F-AI-5).
5. **Ollama over LAN on mobile, yes or no?** (F-AI-8.) Decides whether a zero-egress mode exists at all.
6. **May AI write fuel rows?** And separately: **may article text be transmitted for summarisation?**
   The second is an egress widening and needs an explicit ruling (F-AI-10, §3(ii)).
7. **Is fuel age rendered into the prompt, filtered on, or ignored?** (F-AI-11.)
8. **Do interaction notes go into the prompt, and how many rows?** (F-AI-13.)

## Constraints to export from this seam

- **[fuel → ai]** A fuel row needs `kind`, `created_at`, and `source` from migration 1. Two independent
  AI requirements (off-limits polarity, staleness filtering) each require `kind`; provenance requires
  `source`; neither can be backfilled truthfully.
- **[fuel → ai]** Off-limits fuel must not be transmitted, or must occupy a negative prompt slot. Today
  it is transmitted into a "reference these topics" slot (F-AI-6).
- **[fuel → ai]** Fuel age must reach the prompt in some form. This is the unfixed half of F5.
- **[ai → fields]** If placeholders bind to §14 custom fields, quarantine must warn that a field is
  referenced by the AI prompt, and the binding must be to `col_name`, not the label.
- **[ai → capture]** Share-sheet capture stores raw and offline. Summarisation, if it happens, is a
  separate explicit action — and transmitting article bodies is an egress widening requiring owner sign-off.
- **[ai → log]** Any log-derived prompt input needs an explicit row cap and a decision on whether
  interaction *notes* are transmitted. The mobile log is complete where the plugin's was sparse.
- **[ai → backup]** Fuel `source` must survive export so a user can audit user-written vs AI-written fuel.

## Not checked

- Whether any *other* plugin surface reads fuel besides `FuelTooltip` and the AI prompt (grep says no;
  not exhaustively read).
- Current provider API behaviour for the five providers (model lists at `AiService.ts:233-237, 289-292,
  345-348` are from the plugin's era and were not re-verified against live provider docs — out of scope
  for this seam).
- Token/cost implications of expanding structured fuel into the prompt.
