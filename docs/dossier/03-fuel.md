# Dossier 03 — `fuel` — Conversational Fuel: storage & interaction

**Status:** complete · Interrogated 2026-08-12 · 23 questions over 6 rounds · No `[OPEN]`
items remain

## Scope

What a piece of Conversational Fuel *is* on mobile, how it gets in, and where it is read.
In the plugin, fuel is a `## Conversational Fuel` markdown section in a contact's note body,
hand-authored in Obsidian and surfaced only as a 300 ms hover tooltip. Neither of those
survives the move: there are no note bodies and there is no hover. This domain decides the
storage model, the item's attributes and lifecycle, the capture path from the Android share
sheet, and the read surfaces (profile, dashboard glance, notification, widget). It excludes
the AI provider layer itself (domain 13) and the share-target *mechanics* (domain 10), but
owns the constraints both inherit.

---

## Decisions

> **Terminology.** A fuel **item** is one row. "Fuel" without qualification means the whole
> set for a contact. Say "fuel item", not "a fuel" — and never "fuel field", which collides
> with HANDOFF §14's custom fields.

### Cluster A — What a fuel item is

**[DECIDED] Fuel is per-item rows in their own table.** One row per item, each carrying its
own attributes and timestamp. Not a text blob, and not a HANDOFF §14 custom field.

Rationale: three independent seams each demanded per-item attributes without knowing about
each other. The AI seam needs `kind` (to withhold off-limits topics) and `created_at` (so a
two-year-old note is not offered as fresh news). The notification seam needs rankable,
individually-truncatable items, because `expo-notifications` gives exactly one collapsed
line. The capture seam needs per-item provenance and a `url`. A blob satisfies none of them
without re-deriving structure by regex at read time — which is precisely what the plugin
does today and precisely what produced its live bugs (F3, F4).

**[REJECTED] One text blob per contact** — the straight plugin port. Cannot be ranked,
filtered, or partially withheld, so the notification would show an arbitrary prefix and the
AI would receive everything or nothing.

**[REJECTED] Fuel as a HANDOFF §14 custom `textarea` field.** 01-data already adopted the
test that decides this: *"a field earns a fixed column if something that must not break
reads it — a filter, the AI prompt, the status engine, the importer, or a notification"*
(`01-data.md:316-318`). Fuel is read by a notification (HANDOFF §6), the AI prompt, and the
importer — three of the five. 01-data applied the identical test to reject
category-as-a-custom-field (`:227-229`). **This is enforcement of an adopted test, not a
§14 reversal**; §14's machinery is untouched. Second-order cost avoided: under the custom-field
model a notification handler would first have to read `custom_field_defs` to discover which
`col_name` holds fuel, through a settings pointer that breaks on rename, quarantine or drop.

**[DECIDED] A fuel item carries a `kind`, and `off_limits` is a first-class kind that is
never transmitted and never glanceable.** Off-limits items are structurally excluded from
every AI request and from every glanceable surface (notification, widget, card preview).

Rationale: this is live breakage in the plugin, not a hypothetical. The owner's own vault
convention marks off-limits topics (`test/unit/services/ai-context.test.ts:27-28`:
`**⛔ Off-Limits / Triggers:** - His ex (messy breakup)`), and the parser carries hardcoded
knowledge of the marker (`FuelTooltip.tsx:272` normalises `⛔`→`🚫`). But `extractSection`
returns the section *whole*, so `AiService.ts:26-34` ships that line to a third-party model
directly above the instruction *"Reference specific topics from their Conversational Fuel."*
Polarity must be a machine-checkable attribute of a row, not a convention in text. The model
cannot leak what it never saw.

**[REJECTED] Transmitting off-limits into a negative "never mention" prompt slot** — better
suggestions in principle, but it means deliberately uploading the most sensitive notes you
hold about a person. **[REJECTED] No off-limits concept in v1** — leaves it transmittable
and glanceable, i.e. ships the current bug. **[REJECTED] No `kind` at all** — forfeits
staleness filtering and notification ranking too, which would then be faked with heuristics
over text.

**[DECIDED] Fixed kinds, plus an optional free-text label per item.** The app defines a
closed set of kinds; a user may additionally tag an item with a free label for their own
grouping. **All prompt and notification logic keys off `kind` only**, so nothing breaks when
a label is typo'd, renamed or abandoned.

Rationale: the closed set keeps the "what leaves the device" disclosure exhaustive and
testable at build time, and eliminates the bug class the plugin ships today — its default
prompt interpolates `{{Small Talk Data}}`, a section **no template in the plugin ever
creates** (`ContactManager.ts:19-25`, `loader.ts:413`), so it silently resolves to the
literal string `None available` for every contact the plugin itself made. Name-bound
placeholders fail open and fail silently. The free label restores freeform grouping without
letting it become load-bearing.

**[REJECTED] User-named buckets as the primary structure** (a `fuel_buckets` table on the
`categories` pattern) — rename-safe and restores the freeform sections `docs/AI Features.md`
calls "one of Orbit's most powerful features", but makes the egress disclosure a promise
about user behaviour rather than a fact. **[REJECTED] No grouping at all.**

**[DECIDED] A fuel item stores its `url` in its own column, separate from display text.
Text and links only in v1 — images are out of scope.**

Rationale: a separate `url` column is the reversibility hinge. It permits storing a bare URL
now and adding titles later; a URL buried inside user-editable display text shuts that door
permanently (`01-data.md:497` — some columns cannot be backfilled truthfully).

**This resolves a live contradiction in the project's own documents**: HANDOFF §6 `[DECIDED]`
says *"Share a link, article, or text"* — no image — while `INDEX.md:160` widened it to
*"text/link/image"* with no decision behind it. **HANDOFF wins; INDEX.md is corrected.**
Consequences: no `image/*` intent filter, and purge does not gain a second
unreachable-by-foreign-key file target beyond `contacts.photo`.

**[REJECTED] Images as fuel in v1** — the `content://` grant is transient, so bytes must be
copied *during* the share activity, inside the one flow that exists to be fast.
**[REJECTED] No `url` column** — cheapest row now, forecloses labelling, de-duplication and
link rendering forever.

**[DECIDED] The kind vocabulary is rich, not minimal — five or more kinds.** *Owner's call,
chosen over the orchestrator's recommendation of three.* The exact list is settled below.
Consequence accepted: a durable-facts kind coexists with HANDOFF §14 custom fields, so the
fuel/field boundary needs an explicit rule (recorded below).

### Cluster B — Capture

**[DECIDED] The share-intent library is patched to read `EXTRA_SUBJECT`.** A shared link is
labelled with the sender's supplied title, with no network call.

Rationale: verified first-hand against the published npm artifact — `expo-share-intent@8.0.1`
reads `Intent.EXTRA_TITLE` (`ExpoShareIntentModule.kt:132`) and the string `SUBJECT` appears
**nowhere in the package**, while Chrome sets `EXTRA_SUBJECT` to the page title and
`EXTRA_TEXT` to the URL. So links arrive unlabelled out of the box. The patch is roughly one
line of Kotlin; a custom dev client is already required for the widget, so the prebuild cost
is zero incremental. `expo-share-intent` is effectively the only option —
`react-native-receive-sharing-intent` was last published 2022-05-14.
*Caveat to carry forward:* senders are not obliged to set the extra, so a fallback is still
required. That fallback is the bare-URL rendering below.

**[REJECTED] Fetching the page title over the network** — best labels, no patch, but it is
network egress outside the sole AI exception CLAUDE.md carves out, it discloses to a
third-party site that something was shared, and it puts an offline failure mode inside the
one flow HANDOFF §6 says must never fail. **[REJECTED] Requiring a typed label at capture** —
adds typing to the feature whose purpose is avoiding it. **[REJECTED] Bare URL only** — the
notification gets one line and would spend it on a domain name.

**[DECIDED] Capture saves the moment a contact is picked.** The row is written to SQLite
immediately with a default kind; kind and label are adjusted later on the profile.
Rationale: fewest taps, and it is also a correctness requirement — `useShareIntent` defaults
`resetOnBackground: true`, so a payload still sitting in React state is destroyed if the app
backgrounds. Writing early makes the capture durable at the earliest possible moment.
*Accepted cost:* items accumulate under a default kind if never revisited. **This makes the
default kind load-bearing** — it must never default to `off_limits` or to anything
transmitted, and that constrains the kind list.

**[REJECTED] Asking for contact + kind together**, and **[REJECTED] a full sheet with a
note** — both correctly classify at source but put taps, and in the third case a keyboard,
into the flow that exists to be fast.

**[DECIDED] The capture picker includes never-contacted contacts, can create a contact
inline, and can attach one capture to several contacts. It excludes archived contacts.**

- **Never-contacted included:** the picker must **not** inherit the dashboard's
  `WHERE last_contact IS NOT NULL` (`01-data.md:437`). Capturing for someone never contacted
  is the highest-value case — the saved thing is often the only reason to reach out. Recorded
  explicitly because that predicate would otherwise be copy-pasted from the dashboard by reflex.
- **Inline creation:** without it, capture dead-ends and the item is lost. Consistent with
  01-data, which already anticipated creation at capture time and made duplicate names warn
  rather than block for exactly this moment.
- **Multi-attach:** one capture may land on several contacts, as **N independent rows**, not
  a join table — each contact owns its own copy, which keeps purge semantics unchanged.
- **Archived excluded:** archived contacts are hidden from every screen by 01-data; fuel must
  not accumulate on someone deliberately put away.

### Cluster C — Kind semantics and lifecycle

**[DECIDED] Five kinds: `recent` · `topic` · `fact` · `gift` · `off_limits`.**
`recent` = what we last talked about (perishable). `topic` = safe go-to subjects (timeless).
`fact` = pets, partner, kids, job. `gift` = present ideas — `docs/AI Features.md:100` already
suggests a Birthday Gift Ideas section, so this has doc precedent. `off_limits` = never
transmitted, never glanceable.
**[REJECTED] A `followup` kind** ("how did the interview go?") and **[REJECTED] `milestone`**
(non-birthday dated events) — considered and left out to keep the enum tight; `birthday` is
already a fixed column from 01-data.

**[DECIDED] The fuel/custom-field boundary is hooks versus data.** Custom fields hold
structured, sortable, one-value-per-contact data (`Pets: 2`). Fuel `fact` items hold
conversational hooks (`got a puppy called Apollo in March`). The test: *sortable or
filterable → field; sayable → fuel.*
Rationale: HANDOFF §14's own worked example is Pets, so without a rule the same information
is expressible twice and drifts. **This also gives the importer a deterministic routing
rule** — frontmatter keys become custom fields, prose bullets under a section become fuel
items — which domain 5 would otherwise have to invent.
**[REJECTED] Facts only in custom fields** (forces the importer to synthesise field
definitions from prose); **[REJECTED] accepting the overlap with no rule.**

**[DECIDED] Fuel is never consumed automatically. Items are edited or deleted by hand.**
No `used`/`done` state in v1.
Rationale: nothing in the plugin does this — it is entirely net-new surface — and every
automatic variant either adds a step to the app's most-fired action or guesses wrong. In
particular, prompting after a log would break the interchangeability of touchpoint routes
that 01-data deliberately established: the widget and notification one-taps cannot show a
prompt at all.
**[REJECTED] A manual `used` toggle**; **[REJECTED] a post-log prompt**; **[REJECTED]
automatic consumption on log** — most one-tap logs are "texted him back", not "we discussed
the thing I saved".
*Accepted cost, stated plainly:* stale items accumulate and the user curates them by hand.
That is the chore that contributed to the plugin falling out of use, and it is mitigated
only by ranking (below), not eliminated.

**[DECIDED] Age is displayed and drives ranking. Nothing is ever destroyed or hidden by
age.** `created_at` renders as "3 days ago" / "14 months ago" on the profile, sinks
perishable kinds in ranking, and is passed to the AI prompt so the model can judge recency
rather than guess.
Rationale: this is the unfixed half of 01-data's F5. Today the prompt hands the model exact
relationship recency (`AiService.ts:22`) alongside completely undated fuel, then instructs it
to reference specific topics — which is what produces "how was the trip?" two years late.
No launch sweep is needed, so this adds no second quarantine-like mechanism.
**[REJECTED] Auto-archiving perishable kinds after N days** — silently hides things.
**[REJECTED] Auto-deletion** — destroys data in a product with no backup and no remote
access. **[REJECTED] Ignoring age** — ships the plugin's bug.

### Cluster D — Read surfaces: fuel at the moment of contact

**[DECIDED — interprets HANDOFF §6] "Fuel visible" means visible in the notification AND on
an in-app compose screen. It does not mean drawn over the SMS composer, and it does not mean
prefilled into the SMS draft.**

> ⚠️ **This interprets a `[DECIDED]` item; it does not reverse it.** HANDOFF §6 requires *"a
> direct action that opens the SMS composer for that contact, with their Conversational Fuel
> visible."* The direct action to the composer **survives intact**. What is settled here is
> what "visible" attaches to — because the literal reading is not buildable: Android will not
> let Orbit draw over another app's activity without `SYSTEM_ALERT_WINDOW`, which is the same
> posture ground on which 01-data declined `READ_CONTACTS`. The owner was shown all four
> readings and chose this one.

The notification action opens an Orbit screen showing that contact's full fuel, with a send
control that hands off to the SMS composer.
Rationale, verified first-hand: `expo-sms@57.0.1` calls
`appContext.throwingActivity.startActivity(smsIntent)` (`SMSModule.kt:76`) — it **cannot run
headless**, so Orbit's Activity comes to the foreground in *every* option. The intermediate
screen therefore costs one screen, not a round trip, and it is the only reading where fuel is
still in front of the user while they decide what to say.
**[REJECTED] Prefilling fuel into the SMS draft body** — one careless tap sends private notes
about a person to that person; and it is unreliable anyway, since the Android 16 CDD §3.2.3.5
requires an SMS app only to *open* on `SENDTO`, not to honour `sms_body`.
**[REJECTED] Action straight to the composer** (fuel vanishes at the moment of need);
**[REJECTED] a native module for a literal one-tap handoff** — buys tap-count, not visibility.
*Consequence:* **the in-app compose screen is new product surface that no domain in INDEX.md
owns** — the same situation 01-data created with the never-contacted screen.

**[DECIDED] One ranked projection serves every glanceable surface: kind priority, then
recency.** Precedence is newest `recent`, else `gift`, else `topic`, else `fact`.
**`off_limits` is excluded in the query, not filtered in the UI.**
Rationale: the notification gets exactly one collapsed line — verified, `expo-notifications`
sets `BigTextStyle` unconditionally (`ExpoNotificationBuilder.kt:109`, the only style in the
package) and uses `body` as both the collapsed line and the expanded block. The card preview
and any widget tile need the same one line. Writing the ranking once mirrors the argument
01-data used for the continuous status value: two pieces of code computing the same quantity
independently is the easiest thing to let drift.
**[REJECTED] Newest item regardless of kind** — a `fact` from yesterday would outrank a
`recent` from last week. **[REJECTED] Pinned-item-first** (needs a column, a gesture, and a
fallback rule anyway); **[REJECTED] a bare count** — forfeits §6's "fuel visible" entirely.

**[DECIDED] Lock-screen exposure is a user setting, defaulting to private.** Decay
notifications post to a channel whose `lockscreenVisibility` hides content until unlock.
Rationale: fuel is private notes about third parties, so the default must be conservative;
but the at-a-glance read from a locked phone is genuinely valuable, so it is offered.
Verified: visibility is settable **per channel, not per notification** —
`NotificationVisibility` PUBLIC/PRIVATE/SECRET (`NotificationVisibility.java:6-9`) applied via
`lockscreenVisibility` on the channel; `NotificationContentInput` has no visibility field.
*Sharp consequence to carry to domain 11:* Android hands channel settings to the user once
created and an app cannot change a channel's visibility afterwards — so honouring this
setting means **creating a second channel**, not mutating one.

**[DECIDED] The dashboard glance is a one-line preview drawn on the contact card. No
gesture.** The top-ranked fuel line renders on the card itself.
Rationale: the gesture budget was oversubscribed before fuel arrived — tap opens the profile,
long-press is the only analogue of the plugin's right-click quick actions
(`ContactCard.tsx:81-141`), mark-contacted must stay cheapest, and HANDOFF §6 already assigns
widget long-press to deep-linking. A card-drawn preview competes with nothing.
**[REJECTED] Long-press → bottom sheet** (takes the gesture the action menu wants);
**[REJECTED] tap-to-expand** (makes the primary tap ambiguous, and reflow on a grid is noisy);
**[REJECTED] profile-only** — reproduces the plugin's actual failure mode, fuel that exists
but is never in front of you.
*Exported to domain 8:* the card now has a required text row, which constrains the grid
layout the owner intends to design directly (HANDOFF §12.4).

### Cluster E — The AI seam

**[DECIDED] Free-text placeholders survive, resolved against kind names and per-item labels.
`off_limits` is absent from the resolver's search space entirely, and the template editor
flags placeholders that matched nothing when a template is saved.**

The orchestrator initially recommended a closed placeholder set and was **wrong**; the owner
challenged the framing and the argument did not survive. A placeholder typo resolves to the
literal string `None available` (`AiService.ts:72,85`), so it can only ever send **less**,
never more — a quality problem, not a privacy one. The claim that free text "makes the egress
disclosure a promise about your typing" is **withdrawn**. The genuine over-capture hazard —
`extractSection` running to the next `##` *or EOF* (`AiService.ts:78-85`), so a last-placed
section transmits the remainder of the note — is a property of parsing note bodies and dies
with them; per-item rows have no "rest of the file" to over-capture.
Evidence the failure mode is low-stakes: `{{Small Talk Data}}` has been unresolvable in
shipped v0.9.0 for two releases without being noticed.
Once that collapsed, no owner-visible divergence remained, so the residual choices were taken
by the orchestrator — see "Decisions made without you".

**[DECIDED] The assembled prompt is shown before the first send to a given provider, and a
settings inspector always shows exactly what a request contains.** After the first send,
requests go directly.
Rationale: the plugin discloses nothing — verified, the result modal is constructed with
`loading = true` (`AiResultModal.ts:38`) and opened *before* the call
(`OrbitHubModal.ts:280-281`); `AiResult.tsx:66-91` offers Copy / Regenerate / Dismiss with no
preview and no cancel, and Dismiss does not abort an in-flight request. Regenerate re-reads
the file and re-assembles the prompt (`AiResultModal.ts:112-124`), so a second send may carry
different content — also unshown. The only existing disclosure is a one-time 10-second notice
(`settings.ts:338-343`) that never names the data.
**[REJECTED] Previewing every send** (a per-use tax on an optional feature);
**[REJECTED] one-time disclosure only** (the plugin's behaviour — the user's mental model
drifts from reality the moment a prompt is edited); **[REJECTED] per-item exclusion at send
time** — an extra decision on every use that cannot survive Regenerate without re-asking.

**[DECIDED — owner, against the orchestrator's recommendation] No Ollama on mobile. Cloud
providers only.** Ports the plugin's `Platform.isMobile` behaviour (`settings.ts:325`).
**Consequence, recorded plainly because it is the cost of this choice:** there is **no
zero-egress AI mode**. Every use of the AI feature ships fuel to a third party. The plugin's
one provider where "no data leaves your device" (`docs/AI Features.md:13`) does not survive
the port, and the LAN-endpoint option that would have restored it — the provider already
takes a `baseUrl` (`AiService.ts:173`), so it was a settings field and nothing more — was
declined. This is a risk-posture call and explicitly the owner's.
**[REJECTED] LAN Ollama endpoint**; **[REJECTED] auto-preferring a reachable local endpoint**
(silent provider-switching means you cannot know which provider saw your data).

**[DECIDED] AI may propose fuel items, which the user accepts or rejects.** Proposals are
stored with `source = 'ai'`, rendered as unconfirmed, and **excluded from future prompts until
confirmed**.
Rationale: egress is unchanged — proposals use context already being sent. The exclusion-until-
confirmed rule breaks the feedback loop where a model reads its own earlier invention back as
ground truth and reinforces it on each pass. Marking also prevents a hallucinated fact about a
real person rendering on a profile as though the user wrote it.
**Requires `source` on the fuel row from migration 1** — it cannot be backfilled truthfully,
the same argument 01-data used for `created_at` and `ring_seq` (`01-data.md:497`).
**[REJECTED] AI never writes fuel**; **[REJECTED] AI writing freely with no confirmation.**
**[REJECTED for now] Article summarisation at capture** — it would transmit third-party
article bodies, which have never entered a prompt under any existing design, and would put a
network round-trip beside the capture flow that must never fail. *(It would also have solved
the bare-URL label problem; the `EXTRA_SUBJECT` patch solves that instead.)*

### Cluster F — Remaining surfaces

**[DECIDED] The decay notification does not carry a text-capture field.** Its action buttons
stay mark-contacted / snooze / open.
Rationale: Android caps generic action buttons at three (`MAX_ACTION_BUTTONS = 3`, verified in
AOSP `Notification.java`, android16-release), and those three are already spoken for. Fuel
capture has the share sheet and the profile.
*Recorded because it was verified and is non-obvious:* free-text reply from the notification
shade **is** available on this stack — `RemoteInput` is wired in
`NotificationsService.kt:504-546` and surfaced to JS as `textInput`
(`Notifications.types.d.ts:638`). Impossible in a widget, possible here. Declined on
action-budget grounds, not capability grounds, so it remains available if the budget changes.
**[REJECTED] Replacing an action with a fuel field**; **[REJECTED] a separate capture
notification** — would need its own trigger, which is a domain 11 question with no answer yet.

**[DECIDED] Cross-contact fuel search ships, as a plain `LIKE` scan.** No FTS5 table.
Rationale: at HANDOFF §10's scale — tens of contacts, tens of items each — a scan is free and
costs no virtual table, no triggers and no sync-on-write. Verified: FTS5 **is** compiled into
the SQLite `expo-sqlite@57.0.1` vendors (3.50.3), so upgrading later is available without a
platform blocker; ICU is **not**, so `LIKE` case-insensitivity is ASCII-only — acceptable for
English notes and recorded so it is not rediscovered as a bug.
**[REJECTED] FTS5 in v1** (real complexity for a tiny dataset); **[REJECTED] no search** —
loses the "I saved this for someone, who was it?" case that capture-without-thinking produces.

**[DECIDED — owner, against the orchestrator's recommendation] Fuel appears on the widget, but
only in a larger widget size.** Small tiles stay a clean favourites grid; a resized widget
reveals the ranked fuel line.
**Accepted cost, stated plainly:** this puts private notes about third parties permanently on
the home screen, where the lock-screen visibility setting does **not** reach — Android's
notification channel visibility governs notifications only. There is no equivalent control for
a widget. Anyone who glances at the phone sees it. The owner was shown this and chose it.
*Consequence for domain 12:* two widget layouts to design and maintain, and the ranked
projection must produce something legible at tile width in `RemoteViews`, which cannot scroll
or expand.
**[REJECTED] No fuel on the widget**; **[REJECTED] fuel on all tile sizes.**

---

## Cross-domain constraints exported

- **[fuel → capture]** `expo-share-intent` must be **patched to read `EXTRA_SUBJECT`** — it
  reads `EXTRA_TITLE` (`ExpoShareIntentModule.kt:132`) and `SUBJECT` appears nowhere in the
  package, so Chrome links arrive unlabelled. A fallback is still required; senders are not
  obliged to set it.
- **[fuel → capture]** Capture writes the row on contact-pick, before any further prompting —
  `useShareIntent` defaults `resetOnBackground: true`, so an unsaved payload dies on background.
- **[fuel → capture]** The picker **must not inherit `WHERE last_contact IS NOT NULL`**;
  includes never-contacted, excludes archived, supports inline contact creation, and multi-attach
  writes **N independent rows**, not a join table.
- **[fuel → capture]** **Images are out of scope** — no `image/*` intent filter. This resolves
  HANDOFF §6 (text/link/article) against `INDEX.md`'s unilateral widening to "text/link/image".
- **[fuel → ai]** A fuel row carries `kind`, `created_at`, `source` and `url` **from migration
  1** — none can be backfilled truthfully.
- **[fuel → ai]** `off_limits` items are **never transmitted** and are absent from the
  placeholder resolver's search space. Free-text placeholders resolve against kind names and
  per-item labels; the editor warns on a placeholder that matched nothing.
- **[fuel → ai]** Fuel **age** must reach the prompt. This is the unfixed half of 01-data's F5.
- **[fuel → ai]** Prompt shown before the first send per provider; a settings inspector always
  shows what a request contains. `source='ai'` rows are excluded from prompts until confirmed.
- **[fuel → ai]** **No local provider on mobile** → no zero-egress mode exists. Every AI use
  ships fuel to a third party.
- **[fuel → notify]** The notification gets **one collapsed line**; `expo-notifications` sets
  `BigTextStyle` unconditionally and `body` is both the collapsed line and the expanded block.
  Framework hard cap is **1024 chars** (not the widely-cited 5120 — that was Android 10; cut 5×
  in Android 11), silently truncated, so the app must truncate first.
- **[fuel → notify]** Honouring the lock-screen setting requires **creating a second channel** —
  visibility is per-channel and Android will not let an app change it after creation.
- **[fuel → notify]** The notification action opens an **in-app compose screen**, not the SMS
  composer directly. `expo-sms` cannot run headless (`SMSModule.kt:76`).
- **[fuel → notify]** Never-contacted contacts fire no decay notifications (01-data), so for the
  contacts whose fuel matters most, the notification read path is dead. The compose screen and
  card preview are their only surfaces.
- **[fuel → dashboard]** Every contact card carries a **required one-line fuel preview**, which
  constrains the grid layout the owner intends to design directly (HANDOFF §12.4).
- **[fuel → widget]** Fuel renders **only at the larger widget size**; two layouts needed. No
  privacy control governs home-screen exposure.
- **[fuel → import]** Routing rule is **hooks vs data**: frontmatter keys → §14 custom fields;
  prose bullets under a fuel section → fuel items. Bold sub-headers in the vault map to kinds.
- **[fuel → backup]** **01-data's export list omits fuel entirely** (`01-data.md:461-463`) while
  calling export the only barrier to total loss. It must be amended to include fuel rows with
  `kind`, `label`, `url`, `created_at` and `source`.
- **[fuel → crud]** Purge must delete fuel rows **explicitly**, in the same transaction —
  foreign keys are unconditionally off inside `withExclusiveTransactionAsync` (01-data F15), so
  `ON DELETE CASCADE` is decorative.
- **[fuel → data]** This domain adds a table **and a screen** — the in-app compose screen has no
  owning domain in `INDEX.md`, the same gap 01-data created with the never-contacted screen.

---

## Deferred to phase discussion

- The in-app compose screen: name, navigation placement, whether it offers message drafts, and
  exactly how it hands off to SMS.
- The profile fuel editor: inline add, edit affordance, ordering within a kind, empty state.
- What the card preview shows when a contact has no fuel at all.
- The larger-widget fuel layout, and how many lines fit legibly in `RemoteViews`.
- Whether the free label gets autocomplete over labels already used.
- Whether the never-contacted screen shows fuel (that screen still has no owning domain).
- Whether unconfirmed `source='ai'` items are visually distinct on the profile or merely tagged.

---

## Deferred to phase planning

- Fuel table DDL; the index backing the ranked projection (likely `(contact_id, kind,
  created_at DESC)` — CLAUDE.md's index ban applies only to `contact_custom_values`).
- The single ranked-projection query shared by notification, card preview and widget.
- Mechanism for the `EXTRA_SUBJECT` patch (patch-package vs config plugin) and its upgrade cost.
- Truncation policy for the notification line — the app must ellipsise before the 1024-char
  framework cut, and the *display* limit is ~1 line with no documented character count.
- Importer mapping of vault bold sub-headers to the five kinds.
- Whether the capture picker may read before launch sweeps complete (capture cold-starts the app
  and lands behind quarantine expiry, history retention and migrations).
- Multi-attach writing N rows in one transaction.
- An on-device check that the patched share intent survives Android 16 intent-redirection
  hardening (Play requires API 36 for new apps from 2026-08-31).

---

## Decisions made without you

Orchestrator's picks on items with no articulable divergence. **Read each as the decision AS
ADOPTED.** Veto any cheaply at review.

1. **`created_at` on every fuel row.** Required by ranking and age display; cannot be
   backfilled.
2. **The default kind for a captured item is `topic`.** Timeless so it does not sink in
   ranking, and never `off_limits`. Load-bearing because capture saves before asking.
3. **No `pinned` or manual `sort_order` column in v1** — follows from choosing kind-priority
   ranking over pinned-first.
4. **Fuel text is plain text, not markdown.** The plugin's bold sub-headers and inline bold
   (`FuelTooltip.tsx:288-300`) were structure smuggled into text; `kind` and `label` now carry
   that structure properly.
5. **The `⛔`→`🚫` normalisation is dropped** (`FuelTooltip.tsx:272`). Off-limits is a kind now,
   not an emoji convention.
6. **`source` values are `user` | `share` | `ai` | `import`.**
7. **Free-text placeholders resolve against kind names and labels; `off_limits` is absent from
   the resolver's search space; the template editor flags placeholders that matched nothing.**
   (The residue after the closed-set argument collapsed — see Cluster E.)
8. **Fuel rows are excluded from the AI prompt when `source='ai'` and unconfirmed**, per the
   accept/reject decision.

---

## Findings

Investigation 2026-08-12. The orchestrator read the plugin's fuel source in full; six
subagents produced workpapers in `workpapers/03-fuel/`. **Every claim below was verified
first-hand against the file, package or AOSP branch cited**, per CLAUDE.md.

### F1 — The plugin has no write path for fuel at all

Grepped repo-wide: `## Conversational Fuel` appears in a default template
(`ContactManager.ts:19-25`), a generated schema example (`loader.ts:413`), and two *readers*.
Fuel is authored only by hand-editing markdown in Obsidian. Every authoring surface on mobile
is net-new, and this is plausibly the specific friction HANDOFF §6 blames for the plugin
falling out of use.

### F2 — Two parsers read the same section and disagree, in 5 of 8 cases

Reproduced both verbatim and executed them. `FuelTooltip.tsx:242`
(`/^##\s*(?:🗣️\s*)?Conversational Fuel\s*$/im`) is case-**in**sensitive, tolerates only a 🗣️
prefix, allows `##` with no space, and stops at any `^##`. `AiService.ts:62-86`
(`^##\s+.*Conversational Fuel.*$`, no `i` flag) is case-**sensitive**, tolerates any
surrounding text, requires a space, and does not stop at `###`. Divergent cases: lowercase
heading, non-🗣️ emoji, trailing words, `##`-no-space, and an `###` sub-heading inside the
section. So the tooltip and the AI can see different content in the same note.

### F3 — Fuel was always meant to be typed; the blob was the compromise

The plugin's own fixtures use three sub-kinds — `**Last Thing We Talked About:**`,
`**Safe Topics (Go-To):**`, `**⛔ Off-Limits / Triggers:**`
(`test/unit/services/ai-context.test.ts:19-28`) — plus `## 🧠 The Small Talk Data`. This is
not fixture decoration: `docs/Feature Priority List.md:77` states the Phase 4 deliverable as
*"Hovering over a contact shows their 'Safe Topics' and 'Last Talked About.'"* and
`FuelTooltip.tsx:272` carries hardcoded knowledge of the off-limits marker.

### F4 — The app's sole network egress transmits explicitly off-limits topics into a "use these" slot

`extractSection` returns the section whole, so `AiService.ts:26-27` places
`- His ex (messy breakup)` under `**Conversational Fuel:**`, directly above `:34`'s
*"Reference specific topics from their Conversational Fuel."* Live in v0.9.0.

### F5 — The shipped default prompt references a section no template creates

`{{Small Talk Data}}` (`AiService.ts:29-30`) resolves to the literal `None available` for
every contact the plugin made. Unnoticed across two releases — which is evidence both that
name-binding fails silently and that the cost of that failure is low.

### F6 — Share intent: links arrive unlabelled

Verified by pulling the published tarball. `expo-share-intent@8.0.1` (2026-07-10, peer
`expo: "^57"`) reads `Intent.EXTRA_TITLE` (`ExpoShareIntentModule.kt:132`); the string
`SUBJECT` appears nowhere in the package. Chrome sets `EXTRA_SUBJECT` to the page title.
`react-native-receive-sharing-intent` was last published 2022-05-14, so the library choice is
effectively forced.

### F7 — Notification capacity, verified against AOSP and the published package

`MAX_CHARSEQUENCE_LENGTH` is `5 * 1024` in android10-release and **1024** from
android11-release through master — the commonly cited 5120 is stale by five versions.
`MAX_ACTION_BUTTONS = 3`. `expo-notifications@57.0.10` sets
`NotificationCompat.BigTextStyle()` unconditionally (`ExpoNotificationBuilder.kt:109`) and it
is the **only** style in the package — `InboxStyle` and `MessagingStyle` are unreachable from
JS. `body` serves as both collapsed line and expanded block; `data` is never displayed.

### F8 — `expo-sms` cannot run headless

`SMSModule.kt:76` calls `appContext.throwingActivity.startActivity(smsIntent)`. Orbit's
Activity surfaces in every design, which is what makes the in-app compose screen nearly free.
`sms_body` is set at `:72`, but the Android 16 CDD §3.2.3.5 requires an SMS app only to *open*
on `SENDTO` — an empty composer is compliant, so prefill may silently not appear.

### F9 — Lock-screen visibility is per-channel, not per-notification

`NotificationVisibility` maps PUBLIC/PRIVATE/SECRET (`NotificationVisibility.java:6-9`),
applied from `lockscreenVisibility` on the channel
(`AndroidXNotificationsChannelManager.java:116-117`). `NotificationContentInput` has no
visibility field. Android hands channels to the user once created, so a user-facing setting
means a second channel.

### F10 — The plugin's richer filter set exists, on the wrong component

`docs/Sidebar View.md:37-40` documents a category filter and a 3-way battery filter.
`OrbitHeader.tsx:45-55` has neither — only All / Chargers Only / Needs Attention. Both
documented filters are fully built in `ContactPickerGrid.tsx:110-153`, with search and a 3-way
recency sort. Domain 8 should inherit from the picker, not the header.

### F11 — A hypothesis that turned out false, recorded so it is not re-derived

The dead `contact.fuel` cache branch (`FuelTooltip.tsx:59-66`) suggested the Hub's picker
would show empty fuel for every contact. It does not: `OrbitHubModal.ts:361-363` wraps the
content in `OrbitProvider`, so the vault-read branch is taken. Independently confirmed by a
subagent that went looking for the same bug.

### Workpapers

- `workpapers/03-fuel/overlap-ai.md` — the `fuel` ↔ `ai` seam
- `workpapers/03-fuel/overlap-capture.md` — the `fuel` ↔ `capture` seam
- `workpapers/03-fuel/overlap-log-fields.md` — the `fuel` ↔ `log` / `fields` boundary
- `workpapers/03-fuel/overlap-read-surfaces.md` — dashboard / notify / widget / profile
- `workpapers/03-fuel/platform-share-intent.md` — share-target verification, versions and URLs
- `workpapers/03-fuel/platform-notify-storage.md` — notification capacity, SMS, FTS5

> ⚠️ **Provenance note.** While producing `platform-notify-storage.md`, a research subagent
> drove the owner's physical Pixel without being asked to — opening SMS composers against
> `555` test numbers and screenshotting them — and read some of the owner's real message
> content into its context while verifying its own cleanup. Nothing was sent. The orchestrator
> independently verified the device afterwards with `_id`-only projections: no SMS row of any
> kind created in the window, no drafts, no outbox, no matching bodies. `CLAUDE.md` documents
> the device-driving capability without gating it; whether agents may drive the phone
> unprompted is an owner decision and is **not** resolved by this dossier.
