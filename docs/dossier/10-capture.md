# Dossier 10 — `capture` — Share-sheet capture

**Status:** complete · Interrogated 2026-08-13 · 10 questions over 3 rounds · No `[OPEN]` items remain

## Scope

Registering Orbit as an Android share target so that sharing a link, article, or text
into Orbit lands it as Conversational Fuel against a chosen contact. This domain owns the
*mechanics and the flow*: the intent-filter registration, what payload shapes are accepted,
the pick-contact step (where all the speed lives), what concretely gets stored, and the
Expo/native build implications. It does **not** own the fuel table shape (domain 3, complete)
or the inline contact-create form (domain 6, complete) — both of which already settled the
constraints this domain inherits.

Much of this domain was investigated and pre-decided during the 03-fuel and 06-crud runs.
Those settled decisions are recorded first (as inherited, binding) so this interrogation only
opens what genuinely remains.

---

## Inherited & binding (settled in 03-fuel / 06-crud / 01-data — not reopened here)

- **Images are out of scope.** No `image/*` intent filter. Text and links only. (HANDOFF §6 vs
  INDEX.md widening; HANDOFF won — `03-fuel.md`.)
- **Library is `expo-share-intent`**, patched to read `EXTRA_SUBJECT` (it reads `EXTRA_TITLE`;
  Chrome puts the page title in `EXTRA_SUBJECT`), or Chrome links arrive unlabelled. A fallback
  is still required — senders are not obliged to set the extra.
- **No network fetch of page titles.** (Fuel [REJECTED] the network-fetch label option.)
- **Capture writes the fuel row the moment a contact is picked**, before any further prompting —
  `useShareIntent` defaults `resetOnBackground: true`, so an unsaved payload dies on background.
- **Default kind for a captured item is `topic`** (never `off_limits`, never anything otherwise
  transmitted — it is load-bearing because capture saves before asking).
- **The picker must not inherit `WHERE last_contact IS NOT NULL`** — it includes never-contacted
  contacts, excludes archived, and supports inline contact creation.
- **Inline-create-from-capture is name-only**; `last_contact` defaults **empty** (never-contacted),
  refined later on the profile — opposite of the standard create form's "today". (06-crud.)
- **Multi-attach writes N independent rows, not a join table** — each contact owns its copy, so
  purge semantics are unchanged. (03-fuel.)
- **Sharing a link is NOT a touchpoint.** Capture must not write `last_contact` or an interaction
  row as a side effect. (`overlap-capture.md` F-CAP; LinkListener's port hazard.)
- **The contact-pick step must be an in-app screen** backed by local SQLite, never a system picker
  (a system picker backgrounds the app and destroys the payload).
- Fuel rows carry `url`, `created_at`, `kind`, `source='share'` **from migration 1** — none can be
  backfilled truthfully.
- **Custom dev client / prebuild is already required** (widget), so share capture adds zero
  incremental build-infrastructure cost.

---

## Decisions

<!-- filled per round -->

### Cluster 1 — The pick-contact flow

**[DECIDED] The capture picker is a grid of contact faces with the keyboard closed; search is
a demoted, tap-to-reveal affordance.** Not the plugin's autofocus-search picker (raises the
keyboard over the grid) and not the reused dashboard (which carries filter/sort chrome and the
`WHERE last_contact IS NOT NULL` exclusion the capture picker must not inherit).
Rationale: at HANDOFF §10 scale (7–8 active contacts) everyone fits on one screen, so search is
unnecessary for the common case; `overlap-capture.md` F-CAP-11 flags the literal plugin port as
a keyboard-in-the-fast-path hazard.
**[REJECTED] Search-first / autofocused field; reuse of the full dashboard as the picker.**

**[DECIDED] Picker order: favourites first, then most-recently-captured-to (capture-MRU), then
the rest.** Capture-MRU is free — fuel rows already carry `created_at` and `contact_id` — and
matches the real pattern (you share several things to the same person in a week).
Rationale: F-CAP-11. Favourites-rank already exists (01-data); MRU needs no new column.
**[REJECTED] Most-overdue/status order** (reshuffles overnight — the muscle-memory hazard
01-data rejected for the widget); **[REJECTED] plain alphabetical** and **favourites-then-alpha**
(no recency signal).

**[DECIDED — owner refinement] Single tap commits to that one contact and closes; a long-press
enters multi-select mode** (checkmarks + an explicit Done) for attaching one capture to several
contacts. Neither offered option alone — the owner combined them.
Rationale: keeps the 95% single-contact case at exactly one tap while still supporting
multi-attach without a per-capture Done tax. Long-press is unused on the picker screen, so it is
free here (unlike the dashboard card, where long-press is the action menu). Multi-attach still
writes **N independent rows** per 03-fuel.
**[REJECTED] Always multi-select + Done** (a confirm tap on every single capture); **[REJECTED]
dropping multi-attach** (reverses 03-fuel).

**[DECIDED — owner, against the orchestrator's fire-and-forget recommendation] The capture flow
offers an optional, skippable note field.** The user may add their own words ("for Dad — he
asked about this") at capture time, or skip and refine later on the profile.
Rationale: owner's call — captures intent while it is fresh. The row is still written on
contact-pick before the note (payload-durability is preserved); the note edits the fuel item's
**editable display text**, while the canonical `url` stays in its own column untouched
(`overlap-capture.md` F-CAP-15: user prose must never overwrite the captured payload).
**No new column** is required beyond the fuel shape 03-fuel already set — the note is display
text, `url` is separate. Exact composition when both a shared title and a user note exist is
deferred to phase planning.
**[REJECTED] Fire-and-forget with no note field** (orchestrator's pick — overridden);
**[REJECTED] always-prompt** (typing in the fast path on every capture).

### Cluster 2 — What capture writes

**[DECIDED] After the row is written, a brief "Saved to <Contact>" confirmation shows, then
Orbit finishes and returns the user to the app they shared from.** If the user added an optional
note (Cluster 1), that happens first, in Orbit; on commit, they return to source.
Rationale: fastest resumption of what they were doing; the explicit toast closes LinkListener's
silent-loss failure mode (a missed/timed-out prompt was indistinguishable from decline and the
capture was lost). Platform-verified achievable: Android 15's rule returns a **top-of-task**
activity's `finish()` to the last-active task (the sharing app); the library's `singleTask` +
`FLAG_ACTIVITY_NEW_TASK` re-launch makes capture the task root, i.e. the return-to-source case.
Use a plain `finish()`, **not** `finishAndRemoveTask()` (which lands on home).
**[REJECTED] Staying in Orbit on the profile** (strands the user from their source app);
**[REJECTED] landing on the dashboard** (in Orbit, on nothing relevant).

**[DECIDED] Payload → row mapping is a split: the URL is always canonical in its own `url`
column; the display text is the best available label; a prose-with-URL share stores both.**
- Bare URL (Chrome): `url` = the URL; display text = the page title from `EXTRA_SUBJECT` once the
  library is patched, else the bare URL as fallback.
- Plain text selection: display text = the shared text; `url` = null.
- Prose containing a URL (social post): display text = the prose; `url` = the first `http…` match.
Rationale: keeps link enrichment, dedupe and an actionable-link affordance available later —
`overlap-capture.md` F-CAP-6, the reversibility hinge; a URL buried in editable prose shuts that
door permanently. Consistent with 03-fuel's separate `url` column.
**[REJECTED] Raw text always, URL only when the whole share is a URL** (leaves prose-with-URL
links un-actionable); **[REJECTED] one text field** (reverses 03-fuel's `url` column).

**[DECIDED] The intent filter registers `text/plain` only.** Not the library's `text/*` default,
not `image/*`.
Rationale: platform-verified — the module gates its text branch on
`intent.type.startsWith("text/plain")`, so registering `text/*` makes Orbit appear for
`text/html` shares that then fall to the file branch and error (`"empty uri for file sharing"`).
Mainstream sources (browsers, social, messaging) share as `text/plain`; the only cost is not
appearing for the rare `text/html`-only sharer, in exchange for zero error surface.
*Owner should know:* if a share source ever only offers `text/html`, Orbit will silently not
appear in its share sheet — by design.
**[REJECTED] `text/*`** (error branch for non-plain subtypes); **[REJECTED] `text/*` + `image/*`**
(reverses images-out-of-scope).

**[DECIDED] Capture never marks a contact contacted. Sharing is not a touchpoint in v1.** No
`last_contact` write, no interaction row, not even as an opt-in.
Rationale: the core status signal is elapsed ÷ interval (01-data); letting sharing/reading habits
write touchpoints corrupts it. This deliberately keeps out LinkListener's "mention ⇒ mark
contacted" instinct (`overlap-capture.md`). Mark-contacted keeps its own surfaces (widget,
notification, profile).
**[REJECTED] An explicit opt-in "and mark contacted"** — considered, declined for v1 to keep the
capture semantic clean; it remains a cheap later addition since it would be an explicit tap, never
a side effect.

### Cluster 3 — Scope & schema reservations

**[DECIDED] No Direct Share targets in v1. Every capture goes through Orbit's own in-app
grid-of-faces picker.** Not deferred-with-reservation — it needs no schema, so it can be added
any time.
Rationale: platform-verified today that no RN/Expo library provides Android Sharing Shortcuts;
it requires a custom native module. Beyond the native cost, three things count against it and all
three are owner-bucket concerns: (1) the **system ranks** which contacts appear, re-opening the
muscle-memory hazard 01-data rejected for the widget; (2) it pushes **contact names and avatars
into Android's system `ShortcutManager`**, outside the app sandbox — directly against the "data
never leaves the device" differentiator (HANDOFF §8); (3) Android suppresses Direct Share targets
with **no activity in ~30 days**, i.e. exactly the decayed contacts Orbit exists to resurface.
Closes `overlap-capture.md` F-CAP-12.
**[REJECTED] Building the native module in v1** (the trade-offs above); **[not chosen] Defer with
intent to build later** — recorded as simply "no for v1," reconsiderable freely.

**[DECIDED] No capture inbox. A contact is always chosen at capture; the fuel row's `contact_id`
stays NOT NULL.** This is the one capture decision that is not retrofittable, so it is settled now.
Rationale: inline name-only create (06-crud) already covers "I don't have this person in my list
yet," so an unattached-fuel concept earns nothing it does not already have, while a nullable owner
adds a triage surface and complicates every query and purge path that assumes fuel belongs to
someone. Fuel is always owned by a contact. Closes `overlap-capture.md` F-CAP-15.
**[REJECTED] Reserving a nullable `contact_id` in migration 1 for a later inbox** (pays the schema
and conceptual cost now for a UI that may never come); **[REJECTED] building the inbox in v1**
(new surface, out of the v1 capture scope).

---

## Cross-domain constraints exported

- **[capture → fuel/backup]** The captured display text is **user-editable prose**; the `url`
  column stays **canonical and separate** (F-CAP-6). Export must carry `url` and `source` so a
  user can tell a captured link from what they typed. (Reaffirms 03-fuel's `url`/`source`.)
- **[capture → fuel]** `contact_id` on the fuel row is **NOT NULL** — no unattached fuel, ever.
  Settled here because it is not retrofittable.
- **[capture → data/fields/self]** A share to a **cold** app runs migrations + the launch-time
  sweeps (quarantine expiry, `field_history` retention) **before** the picker can query contacts.
  Whether the picker may read before the sweeps complete is a phase-planning call: a read-only
  `contacts` query is untouched by a `contact_custom_values` `DROP COLUMN`, but that must be
  decided, not assumed (F-CAP-10).
- **[capture → dashboard]** Capture onto a never-contacted contact — including one **inline-created
  during capture** — produces fuel that appears on **no main surface** unless the never-contacted
  screen (domain 8-owned) renders fuel. Domain 8 must render fuel on that screen, or captured items
  for new/never-contacted people are invisible until first contact (F-CAP-13).
- **[capture → notify/widget]** Adopting `expo-share-intent` imposes `launchMode="singleTask"` on
  `.MainActivity` **app-wide** (platform FINDING E). Notification taps, widget taps, launcher
  shortcuts and deep links all now reuse one activity instance and arrive via `onNewIntent`, not a
  fresh `onCreate`. Combined with Android 15's background-activity-launch restrictions, the
  back-stack after a notification/widget tap needs explicit design in domains 11/12 — decided here
  as a side effect, recorded so it is not discovered later.
- **[capture → log]** Reaffirmed: capture is **not** a touchpoint — no `last_contact` or interaction
  write, not even opt-in. The status engine's input stays uncorrupted by sharing habits.
- **[capture → crud]** Reaffirmed: capture is a contact-creation entry point via the **name-only**
  inline create (06-crud); the created contact lands never-contacted.

## Deferred to phase discussion

- The optional note field's exact composition when both a shared title (`EXTRA_SUBJECT`) and a
  user note exist: does the note prepend/append to the title, or replace it as display text?
- The confirmation toast's wording and style ("Saved to <Contact>").
- The multi-select visual entered by long-press (checkmarks, the Done affordance, how to exit).
- The picker's empty/near-empty state (0–1 contacts), where inline-create is effectively the
  only path.
- Whether the picker surfaces a lightweight "add detail now?" affordance after an inline create,
  or defers entirely to the profile.

## Deferred to phase planning

- The `EXTRA_SUBJECT` patch mechanism (patch-package vs a config-plugin mod) and its re-verify
  cost on each Expo SDK bump; upstreaming it to `expo-share-intent` is the better long-term play.
- Whether the capture picker may query `contacts` before the launch-time sweeps/migrations
  complete on a cold-start share (F-CAP-10).
- Multi-attach writing N rows in one transaction through the single-writer DAO.
- Measuring cold-start-to-picker latency on the **physical Pixel 6 Pro** (not the emulator) —
  "zero-friction" is bounded by full-app cold start; if slow, the fix is startup work, not
  share-sheet work (platform FINDING F).
- An on-device check that the patched intent + the library's intent re-launch survive Android 16
  intent-redirection hardening on an API-36 device (platform FINDING, §6).
- Confirming `expo-share-intent` is still the current pinned version at build time (single
  maintainer; ~380-line Kotlin module, forkable if it lapses).

## Decisions made without you

Orchestrator picks on items with no articulable owner-visible divergence. Read each as adopted;
veto cheaply at review.

1. **Library remains `expo-share-intent`**, config-plugin registration to `.MainActivity`. It is
   the only maintained route on SDK 57 (re-verified 2026-08-13); `react-native-receive-sharing-intent`
   is dead (2021).
2. **`ACTION_SEND_MULTIPLE` is not registered** (`androidMultiIntentFilters` left unset). Multi-item
   shares are rare for text/links and the single-`ACTION_SEND` path covers the use case.
3. **`ACTION_PROCESS_TEXT` (text-selection toolbar) and clipboard capture are not v1 entry points.**
   Additional surfaces into the same fuel row; noted as future options, not built now.
4. **Return uses a plain `finish()`, never `finishAndRemoveTask()`** — the former returns to the
   sharing app, the latter to home (platform-verified).

## Findings

Investigation 2026-08-13. The deep investigation for this seam was largely produced during the
03-fuel run and read first-hand by this orchestrator:

- `workpapers/03-fuel/overlap-capture.md` — the `fuel` ↔ `capture` seam (F-CAP-1 … F-CAP-15)
- `workpapers/03-fuel/platform-share-intent.md` — share-target verification, versions, findings A–H
- `workpapers/10-capture/platform-refresh.md` — this run's refresh of the time-sensitive facts

Plugin conceptual heir `~/projects/Orbit/src/services/LinkListener.ts` read in full: it *detected*
a contact (from a typed `[[wikilink]]`), never *picked* one, and its only write was
`last_contact` — so the pick step is entirely net-new and its "mention ⇒ mark contacted" instinct
is a hazard to keep out of capture.
</content>
</invoke>
