# Workpaper — `fuel` ↔ `capture` (domain 3 ↔ domain 10)

**Seam:** Conversational Fuel storage & interaction ↔ Android share-sheet capture
**Investigated:** 2026-08-12

**Method:** full reads of `~/projects/Orbit/src/services/LinkListener.ts`,
`src/components/FuelTooltip.tsx`, `src/components/ContactPickerGrid.tsx`,
`src/utils/ImageScraper.ts`; targeted reads of `src/main.ts`, `src/components/ContactCard.tsx`,
`src/settings.ts`, `docs/Feature Priority List.md`, `docs/UX Overhaul - Implementation Plan.md`;
`~/projects/orbit-app/HANDOFF.md` §1/§3/§4/§6, `docs/dossier/INDEX.md`, `docs/dossier/01-data.md`,
and the sibling workpaper `03-fuel/overlap-ai.md`. Platform facts verified against Android
developer documentation and against the **actual Kotlin source** of `expo-share-intent`
(`android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt`, fetched from `main`
on 2026-08-12; line numbers below refer to that fetched file). Every plugin `file:line` was
opened and confirmed first-hand, per CLAUDE.md "Review the code, not the diff."

**Hypothesis under test:** what a share intent delivers dictates what a fuel record must hold, and
the pick-contact step is where capture speed lives.

**Verdict: confirmed on both halves, and the payload half is worse than assumed.** The intent
delivers *less* structure than the design language ("share a link, article, or text") implies; the
one free source of a human-readable label is **sender-optional**, and the obvious library reads the
**wrong Android extra** for it. Separately, the pick-contact step turns out to sit *behind* the
app's launch-time sweeps, which nobody has recorded.

---

## 0. Verified ground truth

| Claim | Evidence |
|---|---|
| Plugin has zero fuel write path; fuel is hand-typed markdown, read at hover | `FuelTooltip.tsx:40-68`, `types.ts:87-88` (established; re-confirmed) |
| LinkListener never writes fuel — it writes `last_contact` and nothing else | `LinkListener.ts:147-164` |
| LinkListener resolves a contact by exact lowercase basename equality, first match wins | `LinkListener.ts:91-102` |
| LinkListener's `settings` field is stored and never read — detection cannot be turned off | `LinkListener.ts:17, 22, 176-178`; no other reference in the file |
| Its prompt-suppression set is cleared only from `saveSettings()` | `LinkListener.ts:82`, `main.ts:374` |
| The plugin's only contact picker: autofocused search + 3 dropdowns + a toggle | `ContactPickerGrid.tsx:107-163`, `autoFocus` at `:118` |
| Picker default order is status (`decay→wobble→stable→snoozed`) | `ContactPickerGrid.tsx:26-31, 94-95` |
| Initials-avatar fallback is a deterministic HSL hash (ports to mobile) | `ContactCard.tsx:40-42` |
| The plugin's one non-AI network egress was photo scraping, gated `'ask' \| 'always' \| 'never'`, default `'ask'` | `ImageScraper.ts:54`, `settings.ts:49, 70` |
| HANDOFF §6 says "a link, article, or text"; INDEX.md says "text/link/image" | `HANDOFF.md:149` vs `INDEX.md:159` |
| Chrome for Android puts the page **title** in `EXTRA_SUBJECT` and the URL in `EXTRA_TEXT` | paul.kinlan.me, *Parsing the screenshot that Chrome for Android includes via ACTION_SEND intent* |
| Android documents `EXTRA_SUBJECT` only as an optional email-ish extra; `EXTRA_TITLE` is the *preview* title set before `createChooser()` | developer.android.com/training/sharing/send |
| `expo-share-intent` reads `Intent.EXTRA_TITLE` — **not** `EXTRA_SUBJECT` | `ExpoShareIntentModule.kt:132` |
| It only takes the text branch when `intent.type` starts with `text/plain`; everything else goes to the file branch | `ExpoShareIntentModule.kt:125` |
| The file branch never reads `EXTRA_TEXT` — a caption/URL shared alongside an image is dropped | `ExpoShareIntentModule.kt:141-153` |
| It requires prebuild + a custom dev client; Expo Go cannot do this | expo-share-intent README: "we can't use Expo Go and have to use a custom dev client" |
| A `content://` grant from `ACTION_SEND` lasts only while the receiving activity/task lives | developer.android.com; CommonsWare, *Uri Access Lifetime: Shorter Than You Might Think* |
| Direct Share targets: Sharing Shortcuts API only from Android 11; count capped by `getMaxShortcutCountPerActivity()`; sharesheet shows "a fixed number … sorted by rank" | developer.android.com/training/sharing/direct-share-targets |
| Dynamic shortcuts are **not** backed up; all shortcut info lives in credential-encrypted storage | developer.android.com/…/managing-shortcuts |

---

## 1. What a share intent actually delivers, and what it forces onto a fuel row

### F-CAP-1 — The payload is a 3-slot envelope, not a typed object. Every shape the product wants has to be *inferred* from it.

An `ACTION_SEND` intent carries, at most: a MIME type, `EXTRA_TEXT` (a `CharSequence`),
`EXTRA_SUBJECT` (optional), and `EXTRA_STREAM` (a `content://` URI, or a list under
`ACTION_SEND_MULTIPLE`). There is no "this is a link" flag and no "this is an article" flag.

| What the user thinks they shared | What arrives | What the app must infer |
|---|---|---|
| A web page (Chrome) | `text/plain`, `EXTRA_TEXT` = URL, `EXTRA_SUBJECT` = page title | that the text *is* a URL; that the subject is a title and not a mail subject |
| A selected paragraph | `text/plain`, `EXTRA_TEXT` = the prose, usually no subject | nothing — this is the only clean case |
| A social post | `text/plain`, `EXTRA_TEXT` = prose **containing** a URL | whether to store prose, URL, or both |
| A photo | `image/*`, `EXTRA_STREAM` = URI, **no text** | whether this is fuel at all (see F-CAP-3) |
| A photo with caption | `image/*` + `EXTRA_STREAM` + `EXTRA_TEXT` | that there are two payloads in one share |
| Several photos | `ACTION_SEND_MULTIPLE`, list of URIs | one fuel row or N (see F-CAP-5) |

**Decision this forces:** a fuel row cannot have a single `text` column that means "whatever was
shared." The minimum honest shape is **`text` (nullable) + `url` (nullable) + `media_path`
(nullable)**, with a discriminator. Collapsing them into one string is the FuelTooltip mistake
repeated — the plugin's whole fuel model is "put structure in a blob and regex it back out later"
(`FuelTooltip.tsx:240-305`), which the AI seam already condemned (`overlap-ai.md:266-276`).

### F-CAP-2 — HANDOFF §6 and INDEX.md disagree about whether images are in scope, and nobody has noticed.

`HANDOFF.md:149` `[DECIDED]`: *"Share a link, article, or text into Orbit → pick a contact →
attaches as Conversational Fuel."* No image.
`INDEX.md:159` (domain 10 description): *"share text/link/image → pick contact → lands as fuel."*

The index widened a `[DECIDED]` item. Per CLAUDE.md this is exactly the class of thing that is not
an agent's to settle: it changes what the fuel table stores, whether the photos domain owns the
file, and whether capture needs storage-quota thinking. **Owner ruling needed**, and it is cheap to
make now and expensive later — an image fuel item needs a file on disk, and `[data → photos]`
(`01-data.md:464-465`) already establishes that files on disk are unreachable by foreign key and
need explicit purge handling.

Note the two plausible answers are genuinely different products:
- **Images are fuel** → fuel rows own files; purge, export and quota all grow a file dimension.
- **Images are a photos-domain concern** → a shared image either sets the contact's photo (a
  completely different action from "attach fuel") or is refused. Refusing is defensible: the
  share sheet will still list Orbit for images unless the intent filter deliberately omits
  `image/*`, so "refuse" must be implemented as *not registering the filter*, not as a runtime error.

### F-CAP-3 — With the obvious library, a photo-plus-caption share silently loses the caption, and a non-`text/plain` text share errors.

`ExpoShareIntentModule.kt:125` gates the text branch on `intent.type!!.startsWith("text/plain")`.
Anything else — `text/html`, `*/*`, `image/jpeg` — falls to the file branch (`:141-153`), which
reads **only** `EXTRA_STREAM` and never `EXTRA_TEXT`. So:

- Share an image with a caption → the caption is discarded before JS ever sees it.
- Share `text/html` (some apps do) → `EXTRA_STREAM` is null → `notifyError("empty uri for file sharing")`.

Also observed in the same file, and worth a version check before anyone builds on it:
`:145` emits `mapOf("files" to arrayOf(getFileInfo(uri), "type" to "file"))` — the `"type"` pair is
nested *inside* the array, so a single-file share emits an object with no top-level `type`, unlike
the multi-file branch at `:152`. And `getFileInfo` (`:59`) does `resolver.query(uri, …)!!` at `:69`,
a non-null assertion on a cursor a content provider is allowed to return null for.

**Why this changes a decision:** the capture phase cannot treat "which share library" as an
implementation detail delegated to the executor. What the library reads *is* the payload contract,
and this one reads less than the intent carries.

### F-CAP-4 — A fuel row can never store a `content://` URI. The copy has to happen inside capture, before the user is finished.

The read grant on `EXTRA_STREAM` lasts only as long as the receiving activity/task
(Android docs; CommonsWare, *Uri Access Lifetime*). A URI persisted into SQLite is dead the next
time the app opens — silently, with no error, months later. The library's `filePath`
(`ExpoShareIntentModule.kt:104`, produced by the legacy `getAbsolutePath` routine at `:220`) is
likewise not a durable handle under scoped storage.

**Consequence:** if images are in scope (F-CAP-2), capture must copy bytes into app storage **during
the share activity**, i.e. inside the friction-critical path, offline, before or while the user
picks a contact. That is a real cost, and it is an argument on the "images are not fuel" side.

### F-CAP-5 — Payload type and fuel `kind` are two different axes. Do not let them become one column.

`overlap-ai.md:266-276` establishes that a fuel row needs a `kind` — because *polarity*
(`off_limits` must never be transmitted, `overlap-ai.md:133-166`) and *staleness* (event-shaped fuel
expires, timeless fuel does not, `overlap-ai.md:246-264`) both require it. That `kind` is semantic:
`last_talked_about` / `safe_topic` / `off_limits`.

Capture wants a *different* discriminator: `link` / `text` / `image`. These are orthogonal — a shared
link can be a safe topic, and an off-limits note is plain text. One enum cannot carry both without
producing a cross-product (`link_safe`, `link_off_limits`, …) that the AI filter then has to
pattern-match. **Two columns.** Cheap now; a migration against unreachable devices later.

---

## 2. Provenance

### F-CAP-6 — `url` as its own column is the reversibility hinge for the entire title question. Without it, "add titles later" is not actually available.

The whole readability debate in §3 assumes it can be deferred. It can — **but only if the URL is
stored in a column of its own**, separate from whatever text is displayed.

- With `url`: display text starts as the bare URL (or the subject, or nothing), the user may edit it
  freely, and a later feature can still find, dedupe, or enrich every captured link, because the
  canonical URL was never mixed into user-editable prose.
- Without it: the URL lives inside a text blob the user has since edited. Recovering it means a
  regex over user prose, forever — which is precisely the mechanism `overlap-ai.md:36-52` shows
  failing silently in production today.

`01-data.md:497` already records the precedent for this class: `created_at` and `ring_seq` "cannot
be backfilled truthfully and must be present from the start."

### F-CAP-7 — Minimum provenance on a fuel row from migration 1, and what breaks without each.

| Column | Why it must exist at v1 | What breaks without it |
|---|---|---|
| `source` (`user`/`share`/`ai`/`import`) | Already required by `[fuel → ai]` (`overlap-ai.md:335-337`) | Cannot distinguish typed from captured from model-invented; export cannot be audited |
| `created_at` | Ordering, staleness in the prompt, and picker recency (F-CAP-9) | The "how was the trip?" bug (`overlap-ai.md:246-256`); no MRU ordering |
| `url` | F-CAP-6 | Title enrichment, dedupe and link affordance all become regex-over-prose |
| `label` / display text, and **`label_source`** | Distinguishes a title the *user* wrote from one a *machine* produced | A fetched or sender-supplied title is indistinguishable from the user's own words — and a page title is attacker-controlled text |
| `media_path` (if F-CAP-2 says images are fuel) | F-CAP-4 | Dead `content://` URIs |

`label_source` is the non-obvious one. A page title is a string chosen by a third-party website and
rendered on a screen that otherwise contains only things the user wrote about a friend. If it is
ever fetched (§3), the app must be able to say "this line came from the page, not from you" — for
display, for export, and because `overlap-ai.md:221-236` already argues the same point for
AI-written fuel: unattributed machine text feeding back into a prompt is a corruption loop.

### F-CAP-8 — "Which app did this come from" is not reliably obtainable, so do not design a feature on it.

There is no `EXTRA_SOURCE_APP`. `getCallingPackage()` is null for a plain `startActivity`, and
`Activity.getReferrer()` may return the system sharesheet rather than the originating app. **Flagged
as unverified** — I did not test this on the device. Design consequence either way: source-app
provenance must be treated as best-effort and nullable, never as a filter, a grouping key, or
anything a user is shown as fact.

---

## 3. The conflict: a bare URL is unreadable later, and fixing it wants the network

The problem is real and it is the whole reason this seam matters. Three weeks after capture, a fuel
row that reads `https://www.theatlantic.com/technology/archive/2026/…` tells the user nothing at the
one moment it exists to help: standing in front of the person.

### The four options, priced

| Option | Network? | Cost | Fails when |
|---|---|---|---|
| **A. Store the bare URL** | No | Zero. Ships offline, instantly. | Always readable-later problem; a link list is not conversational fuel |
| **B. Use `EXTRA_SUBJECT` when present** | **No** | Small — one extra read, plus a fallback path that must exist anyway | The sender didn't set it (F-CAP-1); **and the obvious library doesn't read it** (F-CAP-3) |
| **C. Fetch the page title** | **Yes** | HTML parsing, redirects, consent/paywall walls, timeouts, an offline failure mode inside the flow that must never fail, and Orbit becomes an HTTP client to arbitrary URLs | Offline; slow network; site blocks non-browser agents; hostile/oversized responses |
| **D. Require the user to type a label** | No | A keyboard in the capture path — the exact friction HANDOFF §6 exists to remove | Always: it converts a 2-tap action into a typing session |

### F-CAP-9a — Precisely how far `EXTRA_SUBJECT` gets you: it removes the network for the *common browser case only*, and it is not a decision that can stand alone.

To answer the question exactly as asked — **does `EXTRA_SUBJECT` avoid the network entirely?**

- **For a page shared from Chrome: yes, completely.** Chrome sets `EXTRA_SUBJECT` to the page title
  (Kinlan). The title arrives in the intent. Zero bytes leave the device, no permission, no latency,
  works on a plane.
- **In general: no**, because `EXTRA_SUBJECT` is optional and sender-defined. Android documents it as
  an optional extra ("the email subject", developer.android.com/training/sharing/send) — there is no
  contract that a sharing app sets it, and text-selection shares typically do not.
- **Therefore B is never a complete answer.** A fallback is *mandatory*, and the fallback is A or D.
  Which means the real decision is "what is the fallback," and B is a free improvement layered on top.
- **And B is not free with the obvious library.** `ExpoShareIntentModule.kt:132` reads
  `Intent.EXTRA_TITLE`, which is the *sharesheet preview* title a sender sets before
  `createChooser()` — a different extra from the one Chrome populates. Taking option B means
  patching/forking the library or handling the intent natively. Anyone assuming `meta.title` yields
  Chrome page titles will find it null in testing and conclude, wrongly, that "Android doesn't give
  you the title."

### F-CAP-9b — What option C actually costs, stated without hand-waving

CLAUDE.md's rule is *"Contact data never leaves the device"* with the AI feature as the sole
exception, plus *"Never put a blocking network call on a read path."* Being precise:

- A title fetch sends **no contact data**. It sends the URL (which the user just obtained *from* that
  site) and the device's IP to a server the user was already talking to. It is not the same category
  of egress as the AI feature, and calling it one would be sloppy.
- It is also **not a read path** — capture is a write. The literal letter of both rules survives.
- What it does violate is **the spirit of §6 and the stated measure of every design decision**
  (`HANDOFF.md:17`: *"does this reduce the number of taps between the reminder and the message
  actually being sent"*). It puts a network round-trip, with a timeout, inside the one flow whose
  entire justification is that the previous product died of friction. Capture must work on the
  Underground.
- It makes the app an HTTP client to **arbitrary, attacker-influenceable URLs**, parsing untrusted
  HTML, following redirects, and storing the resulting attacker-chosen string as a display label.
  Per CLAUDE.md, "risk and security posture" is explicitly the owner's bucket — so **C is not an
  engineering call even though its trigger is technical.**
- It adds a Play Store data-safety surface and an "Orbit is contacting websites" claim that the
  privacy positioning (`HANDOFF.md:46, 211`) has to answer for.

**Precedent worth knowing:** the plugin *did* do this class of thing — `ImageScraper.ts:54`
downloads from arbitrary URLs — and it was gated by a tri-state setting `'ask' | 'always' | 'never'`
defaulting to `'ask'` (`settings.ts:49, 70`). That is a ready-made shape for C if the owner wants it,
and note that **HANDOFF §4 deleting `ImageScraper.ts` (`HANDOFF.md:117`) is not a ruling against
outbound fetch** — it is deleted because mobile uses a native image picker. Do not cite it as
precedent either way.

### F-CAP-9c — The sequencing finding: A + B now is strictly compatible with C later; A alone is not.

Given F-CAP-6, capture can ship as **A + B** (bare URL, upgraded to the subject line when the sender
supplies one) and keep the door open for C — because a stored `url` column plus `label_source` means
a later "fetch titles" feature can enrich old rows and mark them as machine-derived. The reverse is
not true: ship the URL inside a free-text blob and the door is shut. **This is the finding that lets
the owner defer the hard privacy question without paying for the deferral.**

---

## 4. The pick-contact step

### F-CAP-10 — Capture cold-starts the app, so it lands *behind* the launch-time sweeps. Nobody has recorded that.

Two sweeps are already `[DECIDED]` to run at app launch, both against SQLite:
custom-field quarantine expiry (`HANDOFF.md:391`: *"The sweep runs on app launch"*, plus the
`DELETE` + `DROP COLUMN` transaction at `:395-400`) and `field_history` retention
(`HANDOFF.md:410`). Migrations also run on launch and are now transaction-wrapped per step
(`01-data.md:381-391`).

A share intent to a cold app runs all of that before the picker can query contacts. The one flow
whose entire purpose is speed is queued behind DDL. **Design question this forces:** must the picker
render from a path that does not wait on the sweeps (sweeps deferred to idle, or the picker allowed
to read before they complete)? A `DROP COLUMN` against `contact_custom_values` does not touch
`contacts`, so a read-only contact query could legitimately proceed — but that has to be decided,
not assumed, because it means two code paths reach the DB at different readiness levels.

### F-CAP-11 — What state must exist for a fast picker, and which of it already exists

| Ordering strategy | State needed | Status |
|---|---|---|
| Favourites first | Nullable rank column | **Exists** — `01-data.md:255-260` |
| Most-overdue first (plugin default) | Continuous progress value | **Exists** — `01-data.md:152-159`; plugin equivalent `ContactPickerGrid.tsx:94-95` |
| Most-recently-contacted | `last_contact` | **Exists** — `01-data.md:59-65` |
| **Most-recently-*captured-to*** | MAX(`fuel.created_at`) per contact | **Free if and only if fuel rows carry `created_at` and `contact_id`** — F-CAP-7 |

That last row is the useful one: capture-MRU is the ordering most likely to be right (you share three
articles to the same person in a week), and it needs **no new column** provided fuel rows are
per-item with a timestamp. If fuel is one blob per contact, capture-MRU requires new state. Another
independent argument for per-item rows, alongside the two in `overlap-ai.md:266-276`.

**Anti-precedent, and it is a direct port hazard:** the plugin's picker autofocuses its search box
(`ContactPickerGrid.tsx:118`) and stacks three dropdowns and a toggle above the grid (`:122-163`).
Ported literally, the first thing a mobile capture does is raise the keyboard over the grid. At
HANDOFF §10's scale — "seven to eight active contacts" (`HANDOFF.md:243-245`) — **every contact fits
on one screen and search is unnecessary**. The picker should be a grid of faces, keyboard closed,
with search demoted to a secondary affordance.

### F-CAP-12 — Direct Share can remove the picker entirely, but the system, not the app, decides the ordering — which re-opens a hazard the owner already rejected once.

Android's Sharing Shortcuts API puts *contacts* directly in the system share sheet ("share this link
to **Phil**"), skipping Orbit's picker and cutting capture to a single tap. Verified constraints:

- **Sharing Shortcuts is the only mechanism** from Android 11+ (`ChooserTargetService` is dead).
- Count is capped by `getMaxShortcutCountPerActivity()`, and the sharesheet "shows a fixed number of
  Direct Share targets … sorted by rank" — **the system ranks them, not the app.**
- Dynamic shortcuts are **not backed up**, which is consistent with `android:allowBackup="false"`
  (`01-data.md:360-361`) but means they must be re-published after a reinstall.
- All shortcut info lives in **credential-encrypted storage**, so the app cannot touch shortcuts
  before first unlock — another constraint on any launch-time publish.

**The decision this changes:** `01-data.md:255-260` chose an *ordered* favourites rank over
status-ordering specifically because *"tiles that reshuffle by status overnight make muscle memory
log the wrong person."* Direct Share reintroduces exactly that hazard and **the app cannot fix it** —
ranking is the system's. So either Direct Share is accepted with system ordering (and the muscle-
memory argument is knowingly conceded for the share sheet, where the action is "attach fuel," not the
undoable-free "mark contacted"), or Direct Share is declined and every capture goes through Orbit's
own picker. That is an owner call, and it also silently pushes **contact names and avatars into the
system ShortcutManager**, outside the app sandbox — a privacy-posture question in a product whose
first differentiator is "data never leaves the device" (`HANDOFF.md:211`).

### F-CAP-13 — Never-contacted and archived contacts collide with the picker, and one of the collisions makes captured fuel invisible.

`01-data.md:183-190` `[DECIDED]`: never-contacted contacts are excluded from the dashboard **and the
orrery entirely**, via `WHERE last_contact IS NOT NULL` (`01-data.md:437-439`), and get their own
screen "which no domain in this index owns yet" (`INDEX.md:253-254`).

Consequences nobody has recorded:

1. **Capture onto a never-contacted contact produces fuel that appears on no main surface.** Fuel's
   payoff is being visible right before you reach out; if the contact is invisible on dashboard and
   orrery, the fuel is too. Does the never-contacted screen render fuel? That screen has no owner.
2. **If capture can create a contact** — and `01-data.md:42` implies it must, since the `UNIQUE`
   index was rejected partly because it "blocks creation at capture time — the one moment the product
   exists to make cheap" — then the brand-new contact is born with `last_contact IS NULL` and lands
   immediately in case 1. So "capture can create a contact" and "never-contacted contacts are
   invisible" interact badly, and were decided in different sessions.
3. **Archived contacts:** `01-data.md:44-46` says archived contacts are "hidden from every screen."
   The picker is a screen, so they are excluded — meaning sharing something about an archived person
   offers no path at all. Is a capture attempt a signal to offer *unarchive*? Undecided.

### F-CAP-14 — One capture → several contacts is a storage decision, not a UI toggle, and purge semantics pick the answer.

An article genuinely relevant to three people is common. Two shapes:

- **N denormalized rows** (one per contact). Editing one does not edit the others; `url` repeats.
  Purge stays trivial — `01-data.md:83-88` already says purge destroys everything the contact owns.
- **One shared item + a join table.** Deduplicated, but purging one contact must not delete the item
  another contact still references, which means refcounting inside the purge path — new complexity in
  the one operation that must be exactly right, on a device nobody can reach.

**Recommendation: N rows.** But it must be decided in `fuel`, because it decides the table shape, and
"attach to multiple" cannot be added later without a migration if the second shape is ever wanted.

---

## 5. Annotate at capture, or fire-and-forget?

### F-CAP-15 — This is a storage question disguised as a UX question, and the answer is "both, if and only if the row has two text slots."

If capture is fire-and-forget, the row holds only what the intent delivered. If the user may add
"for Dad — he asked about this last week," that is *the user's* text, and it must not overwrite the
captured payload, because F-CAP-6/F-CAP-7 depend on the captured parts staying canonical.

So the row wants: `url` (canonical, machine), `label` + `label_source` (display, provenance-tagged),
and `note` (the user's own words, always nullable). One text column cannot serve all three.

Two further constraints from decisions already made:

- **Annotation must be optional and deferrable.** The owner's stated workflow in the neighbouring
  domain is exactly this pattern: `01-data.md:98-100` records that he logs the touchpoint fast and
  fixes the details "later that night or a day or two after," and calls it "a primary workflow, not
  an edge case." Capture should behave the same way: land the row instantly, edit later.
- **A "capture inbox" is the obvious way to make deferral real** (capture with no contact chosen,
  triage later). That would require `contact_id` to be **nullable** on fuel — a schema decision that
  cannot be retrofitted without a migration, and one that conflicts with fuel being conceptually
  owned by a contact. **Flag for the owner:** decide now whether fuel may exist unattached, even if
  the inbox UI ships later.

---

## 6. LinkListener — what it really was, and why it is not the precedent for "pick a contact fast"

Read in full. `HANDOFF.md:117` lists it as delete, and that is correct, but for a subtler reason than
"Obsidian-shaped."

**It never picked a contact.** It *detected* one. The user typed `[[Dad]]`; a regex pulled the token
(`LinkListener.ts:54-64`) and matched it against contact file basenames by exact lowercase equality,
first match wins (`:91-102`). The disambiguation problem capture has — *which* of my people is this
for — never arose, because the user had already named the person in the act of writing. On mobile
there is no such token, so **the pick step is entirely net-new and has no ancestor**. The real
ancestor for the picker UI is `ContactPickerGrid`, and F-CAP-11 explains why porting it literally is
wrong.

**It also never wrote content.** Its only write is `frontmatter.last_contact = today`
(`:147-164`) — no fuel, no note, no log line. This independently re-confirms the established fact
that fuel has zero write path anywhere in the plugin.

**The trap it sets for capture:** LinkListener's entire semantic is *mention ⇒ offer to mark
contacted*. Porting that instinct into capture would make sharing an article about someone stamp
`last_contact` — and per `01-data.md:59-77` that would also insert an interaction row and move the
status engine. **Sharing a link is not a touchpoint.** You have not spoken to them. If capture ever
offers "…and mark contacted," it must be an explicit, separately-tapped second action, never a side
effect, or the product's core signal (elapsed ÷ interval — `01-data.md:152-159`) is corrupted by
reading habits.

**Its failure modes, and what each warns capture about:**

| LinkListener behaviour | Evidence | Warning for capture |
|---|---|---|
| Prompt is a `Notice` with a 10-second timeout and a **"Yes" button only** | `:123-142` | Ignoring is indistinguishable from declining. A capture confirmation that can time out loses the capture. |
| Suppression set is keyed `path::name` and cleared only via `saveSettings()` | `:71, 82`; `main.ts:374` | A missed prompt never returns — the capture is lost silently, with no inbox and no error. |
| Debounced 2s **with leading edge `true`**, re-reads the entire file and re-scans every link per fire | `:30-48` | It interrupted the user *while typing*. The mobile analogue is a capture flow that interrupts rather than queues. |
| `this.settings` is stored and never read | `:17, 22, 176-178` | The feature could not be turned off. Capture registers an intent filter that puts Orbit in the share sheet **for every applicable share, forever** — that is the same "always on" property, and it is only escapable in system settings. |
| `isContactedToday` compares local Y/M/D | `:107-118` | Correct, and consistent with `formatLocalDate` (`:149`) / CLAUDE.md. Nothing to fix. |

---

## Design questions this raises for the owner

1. **Are images in scope for capture at all?** `HANDOFF.md:149` says no; `INDEX.md:159` says yes
   (F-CAP-2). If yes, does a shared image become a fuel item or the contact's photo, and who owns
   the file on disk?
2. **What is the fallback label for a shared link — bare URL (A) or user-typed (D)?** Using
   `EXTRA_SUBJECT` (B) is free but sender-dependent, so a fallback must exist regardless (F-CAP-9a).
3. **Is fetching page titles (C) ever acceptable?** It is a risk-posture call, not an engineering one
   (F-CAP-9b). Deciding "not now" costs nothing **if** `url` is its own column (F-CAP-9c).
4. **Direct Share targets: yes or no?** One-tap capture, but system-ranked ordering re-opens the
   hazard `01-data.md:255-260` rejected, and it pushes contact names/avatars into system storage
   (F-CAP-12).
5. **May capture create a new contact?** `01-data.md:42` assumes it can. If so, where does that
   contact's fuel appear, given never-contacted contacts are excluded from every main screen
   (F-CAP-13)?
6. **Does the picker show archived contacts, or offer to unarchive?** (F-CAP-13.)
7. **May one capture attach to several contacts?** Decides the table shape now, not later (F-CAP-14).
8. **May a fuel row exist with no contact — a capture inbox?** `contact_id` nullability cannot be
   retrofitted cheaply (F-CAP-15).
9. **Does capture ever offer "…and mark contacted"?** LinkListener's semantics say yes; the status
   engine says it must never be automatic (§6).

## Constraints to export from this seam

- **[capture → fuel]** A fuel row needs `url` and `media_path` as **their own nullable columns**,
  separate from display text. This is what keeps title enrichment, dedupe and link affordances
  available later; a URL inside a text blob closes those doors permanently (F-CAP-6).
- **[capture → fuel]** Payload type (`link`/`text`/`image`) is a **second** discriminator, orthogonal
  to the semantic `kind` the AI seam requires. Two columns, not one enum (F-CAP-5).
- **[capture → fuel]** `label_source` must record whether a display label came from the user, the
  sender's `EXTRA_SUBJECT`, or a fetched page — attacker-chosen text must be attributable (F-CAP-7).
- **[capture → fuel]** Fuel rows carrying `contact_id` + `created_at` make capture-MRU picker
  ordering free. A per-contact blob does not (F-CAP-11).
- **[capture → fuel]** Decide now whether `contact_id` may be NULL (capture inbox) — not
  retrofittable (F-CAP-15).
- **[capture → log]** Sharing a link is **not** a touchpoint. Capture must not write `last_contact`
  or an interaction row as a side effect; any "mark contacted too" is a separate explicit tap (§6).
- **[capture → data/fields]** Launch-time sweeps (quarantine expiry `HANDOFF.md:391`, history
  retention `:410`, migrations `01-data.md:381-391`) sit in front of a share-intent cold start.
  Decide whether the picker may read before sweeps complete (F-CAP-10).
- **[capture → dashboard]** The un-owned never-contacted screen must render fuel, or capture onto a
  new contact produces invisible data (F-CAP-13).
- **[capture → crud]** Capture is a contact-creation entry point; `01-data.md:42` already assumes it.
  The create-at-capture form must be minimal, and it lands the contact on the never-contacted screen.
- **[capture → photos]** If images are fuel, bytes must be copied into app storage during the share
  activity — the `content://` grant dies with it — and purge must delete those files (F-CAP-4,
  `01-data.md:464-465`).
- **[capture → backup]** Export must carry `url`, `label_source` and `source` so a user can tell what
  they wrote from what a website or a model supplied.
- **[capture → capture]** `expo-share-intent` as shipped reads `EXTRA_TITLE`, not `EXTRA_SUBJECT`,
  and drops `EXTRA_TEXT` on non-`text/plain` shares. Library choice is a payload-contract decision,
  not an implementation detail (F-CAP-3, F-CAP-9a).

## Not checked

- Whether `Activity.getReferrer()` yields the originating app or the sharesheet on a current Pixel
  (F-CAP-8). Testable on the owner's device in minutes; not done here.
- Which non-browser apps set `EXTRA_SUBJECT` in practice. Only Chrome's behaviour was verified from a
  source; the general rule (optional, sender-defined) is from Android's own docs.
- Whether a newer `expo-share-intent` release fixes `:145` / adds `EXTRA_SUBJECT`. `main` as of
  2026-08-12 does not; pin and re-verify at phase time.
- Alternative capture routes not investigated: `ACTION_PROCESS_TEXT` (Orbit in the text-selection
  toolbar) and the Android clipboard. Both are additional entry points into the same fuel row shape.
- Storage-quota behaviour for image fuel, and any Play Store data-safety declaration implications of
  option C.
