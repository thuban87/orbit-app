# Dossier 21 — Interaction Assist & Reach Out

**Status:** draft-complete from owner interrogation · 2026-08-26 · revised 2026-08-31 (pre-planning code audit + owner rulings; see Revision Log)  
**Purpose:** decision dossier for future GSD Phase 21 planning/discuss flow.  
**Scope:** reusable in-app Reach Out routing, durable Interaction Assist intent lifecycle, post-handoff confirmation UX, native Call/Text/Email handoff, optional notes, app-global persistent assist banner, and larger-widget Contact integration.  
**Out of scope:** passive call/text detection, notification-listener ingestion, background monitoring, delivery/read verification, per-endpoint interaction history, new widget grid behavior, generic communication-provider taxonomy.

---

## Phase Boundary

### Phase 20 — Contact Reconciliation & Merge

Phase 20 maintains imported/linkable contact data and resolves duplicates.

### Phase 21 — Interaction Assist & Reach Out

Phase 21 helps users start communication from Orbit and then quickly confirm/log what actually happened.

Core flow:

1. user initiates contact from Orbit,
2. Orbit writes a durable pending assist immediately before native handoff,
3. Orbit launches the relevant native app,
4. when the user returns, Orbit surfaces a persistent assist banner,
5. user confirms or dismisses,
6. confirmed interactions are written through the existing authoritative interaction/recency path.

**[DECIDED] Phase 21 is user-initiated assist, not passive activity detection.**

No call-log reading.
No SMS database reading.
No notification listener.
No background surveillance.

Those are separate future/post-v1 concerns.

---

# Reach Out

## Cluster A — Reach Out Entry Point

**[DECIDED] Add a new profile-level Reach Out / Contact action.**

The exact final copy may be `Reach Out` or `Contact`; product behavior is fixed.

Tapping the action opens a reusable in-app routing modal.

Available high-level routes:

- Call
- Text / Message
- Email

Only routes with actionable stored methods should be enabled.

**[DECIDED · 2026-08-31] If a contact has NO actionable stored methods at all, the Reach Out / Contact action is hidden entirely.**

No dead entry point: the action does not render (rather than opening an empty modal) when there is neither an actionable phone nor an actionable email.

**[DECIDED · 2026-08-31] Route enabling is phone/email-granular, not channel-granular.**

Verified against shipped code: `contact_methods.is_actionable` (`src/logic/contact-method-normalization.ts`) records only "valid phone" vs "valid email"; phone line-type (mobile vs landline) is parsed and then discarded. Therefore any actionable phone enables BOTH Call and Text (a landline will be offered as textable), and any actionable email enables Email. Orbit does not gate Text separately from Call per endpoint. Per-endpoint call-vs-text capability is net-new work, explicitly not in Phase 21.

---

## Cluster B — Maximum Routing Depth

**[DECIDED] Reach Out uses a maximum three-tap path when endpoint ambiguity exists.**

Conceptual flow:

1. Contact / Reach Out
2. choose Call / Text / Email
3. if multiple endpoints exist, choose endpoint

If only one usable endpoint exists for the selected channel:
- launch directly after choosing the channel.

If multiple endpoints exist:
- show a second method-selection menu.

**[DECIDED] The primary phone/email is visually emphasized in the method-selection UI.**

Distinct secondary methods remain selectable.

This extra step only appears where Orbit cannot safely infer the desired endpoint.

---

## Cluster C — Channel Scope

**[DECIDED] Initial Phase 21 channels:**

- Call
- Text
- Email

**[DECIDED] In-person is not part of Interaction Assist.**

Reason:
There is no native-app handoff event to anchor the intent.

**[DECIDED] Provider-specific channels remain out of the user-facing taxonomy.**

Examples not promoted to first-class interaction channels:
- WhatsApp
- Signal
- SMS vs RCS
- Gmail vs Outlook

Final interaction history remains intentionally coarse.

---

## Cluster D — Endpoint Selection vs Interaction History

**[DECIDED] The selected phone/email endpoint is operational handoff context only.**

The resulting interaction record stores the coarse channel:
- `call`
- `text`
- `email`

Phase 21 does not add permanent endpoint-level history such as:
- which mobile number was used,
- which email address was used,
- which provider handled the message.

The endpoint may exist temporarily on the assist row if needed to perform/recover the handoff.

---

# Durable Assist Creation

## Cluster E — Write Before Native Handoff

**[DECIDED] Orbit creates the durable pending assist immediately before launching the native app.**

Order:

1. user completes Reach Out routing,
2. Orbit writes pending assist,
3. Orbit launches dialer/messages/mail app,
4. handoff succeeds or fails.

Reason:
If Orbit is backgrounded/killed immediately after handoff, the intent still exists and can be recovered.

---

## Cluster F — Failed Handoff

**[DECIDED] If native handoff fails after the assist row was written:**

- mark the assist `failed`,
- show the user an appropriate error,
- do not surface it later as a pending confirmation.

Failed handoff does not create an interaction.

**[DECIDED · 2026-08-31] "Failed handoff" means the native launch itself failed — not that the user declined to complete the action.**

Detectability is limited by the platform (verified): the Text path uses `expo-sms` `sendSMSAsync`, which returns `unknown` on Android — sent vs cancelled is NOT observable; Call/Email use `tel:`/`mailto:` (both greenfield — no existing handoff code) which succeed if any app can handle them. So "failed" is detectable only as a thrown launch error / no compatible native app (see Cluster AD and the no-compatible-app planning item), never as "message not actually sent." This is consistent with the attestation model (Cluster J): whether the user actually communicated is confirmed by the user, not observed by Orbit.

---

## Cluster G — Interaction Assist Global Setting

**[DECIDED] Add a global Interaction Assist toggle.**

Suggested behavior/copy:

> **Interaction Assist**  
> Ask me to log calls, texts and emails started from Orbit.

Default:
- **On**

When On:
- Reach Out creates durable assist intents,
- return-to-Orbit confirmation behavior is active.

When Off:
- Reach Out still launches native communication apps normally,
- no durable assist intent is created,
- no assist banner appears.

**[DECIDED · 2026-08-31] Toggling Interaction Assist OFF clears any already-pending assists immediately.**

"Off means off": turning the setting off wipes the pending-assist queue and hides the banner at once, rather than letting previously-created assists continue to prompt. Re-enabling starts fresh; cleared assists are not restored and create no interactions.

The Reach Out feature is therefore not dependent on Interaction Assist being enabled.

---

# Return UX

## Cluster H — Banner, Not Modal

**[DECIDED] Return confirmation uses a persistent in-app banner/toast-like overlay.**

It is:
- app-global while Orbit is foregrounded,
- persistent until resolved/dismissed/expired,
- non-modal,
- not a dashboard card,
- not tied to the screen where the handoff began.

The banner may appear on:
- profile,
- Compose,
- dashboard,
- other normal foreground screens.

**[DECIDED · 2026-08-31] The Android Back button passes through the banner.**

The assist banner is NOT a Back-dismissible transient layer. Back navigates normally; the banner persists until resolved, dismissed via its own control, or expired. This is an explicit exception to the M2 app-shell rule (`milestone-2` phase-01 §C: "Back dismisses the topmost transient layer before navigating") — the assist banner is durable state, not a transient overlay, so Back does not consume it.

**[REJECTED] Blocking modal after every return.**

**[REJECTED] Dedicated dashboard card for assist backlog.**

---

## Cluster I — Minimum Away-Time Buffer

**[DECIDED] Apply a 15-second minimum buffer after native handoff before the assist becomes eligible to prompt.**

Reason:
Avoid immediate false prompts when the user bounces back accidentally or the native app fails to remain foregrounded.

Returning before the 15-second threshold does not itself confirm anything.

The assist remains pending until:
- it later becomes eligible,
- it is dismissed,
- it expires,
- or it is otherwise resolved.

---

## Cluster J — Confirmation Actions

### Call

**[DECIDED] Call confirmation asks whether the user connected.**

Primary actions:

- Yes
- No answer
- Don’t log

### Text / Email

**[DECIDED] Text and email confirmations ask whether the user sent/contacted the person.**

Primary actions:

- Yes
- Don’t log

**[DECIDED] Text/email confirmation is user attestation, not delivery verification.**

Orbit does not claim:
- delivered,
- read,
- accepted by server,
- received by recipient.

---

## Cluster K — Optional Notes

**[DECIDED] Assist confirmation offers an optional Notes toggle/expander.**

Default:
- closed/off

If opened:
- user may add notes before confirming/logging.

Reason:
Keep the default interaction lightweight while avoiding the extra friction of later locating the contact and editing the interaction.

Notes flow into the resulting interaction record.

**[DECIDED · 2026-08-31] The Notes expander is offered on every confirmation that writes an interaction.**

That means call `Yes`, call `No answer` (which still writes a row, Cluster T), and text/email `Yes`. `Don't log` writes no interaction and therefore offers no notes.

---

# Pending Assist Queue

## Cluster L — Banking Unresolved Assists

**[DECIDED] Unresolved assists may be banked.**

Because the banner is intentionally non-blocking, the user may continue using Orbit without answering immediately.

The system therefore supports multiple pending assists.

---

## Cluster M — Queue Cap

**[DECIDED] Keep at most the 5 most recent unresolved pending assists.**

When a sixth unresolved assist is created:
- the oldest unresolved assist expires/prunes automatically.

Reason:
Interaction Assist should remain lightweight, not become backlog management.

Five ignored assists is already sufficient evidence that older prompts are unlikely to be useful.

---

## Cluster N — Global Expiration Window

**[DECIDED] Pending assists expire after 24 hours.**

One global window applies to:
- calls,
- texts,
- emails.

An assist is therefore pruned by whichever occurs first:

1. it ages past 24 hours, or
2. it falls outside the five-most-recent unresolved window.

Expired assists do not create interactions.

---

## Cluster O — Repeated Actions

**[DECIDED] Repeated actions to the same contact/channel create separate assist intents.**

Example:
- text Sarah,
- ignore banner,
- text Sarah again 20 minutes later

→ two separate pending assists.

Reason:
They may represent distinct real-world attempts.

The queue cap prevents unbounded accumulation.

---

## Cluster P — Multiple Pending Banner Behavior

**[DECIDED] When multiple assists are pending:**

- surface the newest eligible assist,
- indicate the remaining pending count,
- allow access to a lightweight pending-assists review surface/queue.

Example:
> Did you reach Sarah?  
> 4 more pending

The review surface is not a permanent dashboard feature.

---

## Cluster Q — Restart / Process Death

**[DECIDED] Pending non-expired assists survive:**

- app termination,
- process death,
- device reboot,
- normal restart,
- long absence within the 24-hour window.

When Orbit becomes usable again:
- unresolved eligible assists resume through the banner.

Durability is a core reason for using SQLite-backed assist state.

---

# What Gets Logged

## Cluster R — Interaction Timestamp

**[DECIDED] Confirmed interactions use the assist start/handoff time, not the later confirmation time.**

Example:
- call initiated 2:00 PM
- user confirms 2:18 PM

→ interaction timestamp = approximately 2:00 PM.

---

## Cluster S — Direction

**[DECIDED] All Phase 21 interactions are outbound.**

Because the user initiated them from Orbit:

- Call → outbound
- Text → outbound
- Email → outbound

Direction is not asked during assist confirmation.

---

## Cluster T — Call No Answer

**[DECIDED] `No answer` still creates an interaction row.**

Conceptually:
- channel = call
- direction = outbound
- connected = false

This preserves attempted-contact history.

**[DECIDED] Phase 21 does not invent new recency semantics for failed calls.**

The existing authoritative interaction/recency machinery determines downstream effects.

---

## Cluster U — Existing Writer Is Authoritative

**[DECIDED] Interaction Assist never directly invents alternate recency logic.**

Confirmed assists must flow through the existing authoritative interaction write/recompute path, including the current `recordTouchpoint()`/recency invariants.

This preserves:
- `last_contact` rules,
- `rarely_responds` behavior,
- gravity/history behavior,
- other existing interaction-derived calculations.

---

# Assist Lifecycle

## Cluster V — Status Taxonomy

**[DECIDED] Assist rows use a small explicit lifecycle.**

Statuses:

- `pending`
- `logged`
- `dismissed`
- `expired`
- `failed`

Semantics:

### pending
Native handoff was initiated and the assist awaits resolution.

### logged
User confirmed and an interaction was successfully created.

### dismissed
User chose Don’t log.

### expired
Assist aged out or was pruned from the pending window.

### failed
Native handoff failed before meaningful communication could occur.

---

## Cluster W — Don’t Log

**[DECIDED] `Don’t log` marks the assist dismissed.**

It:
- creates no interaction,
- never prompts again for that assist.

---

## Cluster X — Resolved Assist Retention

**[DECIDED] Resolved assist rows may remain temporarily for operational safety/debugging, then be pruned after 30 days.**

Applies to:
- logged
- dismissed
- expired
- failed

The permanent relationship history is the `interactions` table, not Interaction Assist.

Resource/storage cost is expected to be negligible.

---

# Contact Lifecycle Edge Cases

## Cluster Y — Unbound Contacts

**[DECIDED] Reach Out and Interaction Assist work normally for Unbound contacts.**

Logging an interaction:
- does not automatically Bind the contact,
- does update normal relationship history through existing interaction logic,
- may affect gravity/history where those systems apply independently of Bound state.

Bound/Unbound controls proactive cadence management, not whether a person can be contacted/logged.

---

## Cluster Z — Archived Contact

**[DECIDED] If a contact becomes archived while an assist is pending, confirmation/logging is still allowed.**

Reason:
The interaction may have actually occurred before/around the archive action.

Archive status does not rewrite real-world history.

---

## Cluster AA — Merged Contact

**[DECIDED] If the target contact was merged before the assist resolves:**

- redirect/log the confirmed interaction against the surviving contact identity.

Do not resurrect the absorbed identity.

This must honor Phase 20 merge-retirement semantics.

**[DECIDED · 2026-08-31 · implementation constraint] Redirect is achieved by the assist row participating in Phase 20's existing merge reparent, NOT by a lazy survivor lookup at confirmation time.**

Verified against shipped code: `mergeContacts` (`src/db/merge-dao.ts`) reparents its child tables (`interactions`, `events`, `fuel`, `custom_field_values`, `contact_links`, `contact_methods`, `external_contact_links`, `field_history`) to the survivor, writes a tombstone carrying only the *absorbed* uid, then hard-deletes the absorbed `contacts` row. There is NO survivor pointer anywhere in the schema, and merge and purge write identical `{contact, uid}` tombstones — so a stale `contact_id` cannot be resolved to a survivor after the fact, and "merged" cannot be distinguished from "purged" by tombstone alone. Therefore Phase 21 MUST add the new assist table to `mergeContacts`' reparent loop so a pending assist is moved to the survivor inside the merge transaction, and MUST NOT rely on `ON DELETE CASCADE` for merge (which would delete the assist and defeat redirect). This *extends* Phase 20's merge writer to cover a new child table — it enforces, not reverses, Phase 20's reparent-then-retire intent, so it is in scope for Phase 21 planning; but it is a cross-phase change, not the minor "lookup" detail the earlier draft implied.

---

## Cluster AB — Purged Contact

**[DECIDED] If the target identity has been permanently purged before confirmation:**

- do not recreate it,
- do not create an orphan interaction,
- expire/dismiss the assist.

Exact internal status choice can be a planning detail so long as no interaction is written.

**[DECIDED · 2026-08-31 · implementation constraint] On purge, the pending assist is removed with the identity so it can never resolve.**

Verified: `purgeContact` (`src/db/purge-dao.ts`) is a distinct, archived-only permanent-deletion path that tombstones and deletes every child plus the `contacts` row. Because merge reparents the assist away *before* deletion (Cluster AA) while purge has no survivor, the assist table SHOULD cascade-delete (or be explicitly deleted in `purgeContact`) on purge — which cleanly satisfies AB (no interaction written) without needing to detect "purged vs merged" at confirmation time. The merge-vs-purge tombstone ambiguity is thus sidestepped by handling both at deletion time rather than at confirmation.

**[DECIDED · 2026-08-31] Navigation half of AB — a widget/deep-link "Contact" action whose target was purged fails safe.**

Per M2 `milestone-2` phase-01 §D ("Missing/deleted deep-link contacts fail safely"): show a friendly "contact no longer available" message and route to Dashboard — do not crash or silently retarget. This complements the data-layer rule above.

---

# Existing Compose Integration

## Cluster AC — Text Compose

**[DECIDED] Existing Compose remains an in-app pre-handoff surface.**

Updated text flow:

1. user opens Compose,
2. writes/reviews message,
3. taps Send/Open Messages,
4. Orbit creates pending assist,
5. Orbit launches native Messages,
6. return banner asks for confirmation,
7. only confirmation writes the interaction.

**[DECIDED] Compose itself does not directly create the interaction row at handoff time.**

This preserves the distinction between:
- intent to contact,
- user-confirmed actual contact.

---

# Email

## Cluster AD — Basic Email Handoff

**[DECIDED] Phase 21 includes basic Email Reach Out even without a dedicated Orbit email-compose screen.**

Flow:
- choose Email,
- choose endpoint if needed,
- create assist,
- launch native mail app,
- confirm on return.

A richer Orbit email compose surface may be designed later.

---

# Widget Integration

## Cluster AE — Why Widget Changes Belong in Phase 21

The existing larger home-screen widget currently includes a `Message` action that deep-links into the in-app Compose flow.

**[DECIDED] Phase 21 intentionally supersedes that action with a broader `Contact` action.**

Reason:
Phase 21 introduces a reusable Reach Out router, and leaving the widget Message-only would create an intentionally inconsistent communication path that would immediately need revisiting.

This is a bounded integration change, not a widget redesign.

---

## Cluster AF — Larger Widget Contact Action

**[DECIDED] Replace the larger widget's existing `Message` action with `Contact`.**

New widget flow:

1. user taps `Contact` on the larger widget,
2. Orbit opens directly into the shared Reach Out modal for that contact,
3. modal offers Call / Message / Email,
4. if one endpoint exists for the chosen route, launch it,
5. if multiple endpoints exist, show endpoint selector,
6. create assist immediately before native handoff,
7. normal Interaction Assist lifecycle continues.

**[DECIDED] The widget itself does not write assist rows.**

It deep-links into the authoritative in-app Reach Out flow.

---

## Cluster AG — Widget Scope Guardrails

**[DECIDED] Phase 21 does not otherwise reopen widget architecture.**

Unchanged:
- small-widget behavior,
- favourites model,
- ranking,
- grid behavior,
- quick mark behavior,
- Log contact behavior,
- status presentation,
- widget persistence model,
- no per-widget contact-method state.

**[DECIDED] No widget-specific Call/Text/Email implementation is added.**

The widget has one communication entry point:
- Contact

The shared in-app router owns all channel selection.

---

## Cluster AH — Dossier 12 Supersession

**[SUPERSEDES] Dossier 12's larger-widget `Message` action becomes `Contact`.**

The original intent remains:
- provide a direct communication path from the widget.

The mechanism changes from:
- Message → Compose

to:
- Contact → shared Reach Out router → Call/Text/Email

**[DECIDED] Small-widget behavior is not changed by this supersession.**

---

# Privacy and Product Principles

## Cluster AI — Local-First State

**[DECIDED] Interaction Assist state is stored locally in Orbit's existing local-first database.**

No backend is required for:
- pending assists,
- confirmation banners,
- queue management,
- expiration,
- resolved-assist retention.

---

## Cluster AJ — No Passive Monitoring

**[DECIDED] Phase 21 intentionally does not verify what happened inside the native app.**

Orbit knows:
- what the user intended to do,
- when they initiated it,
- what they later confirmed.

Orbit does not know:
- actual call duration,
- telecom completion,
- SMS delivery status,
- email delivery/read state,
- inbound replies.

This limitation is a product choice, not a bug.

---

# Cross-Domain Invariants

1. **Reach Out works whether Interaction Assist is enabled or disabled.**
2. **Assist rows are created immediately before native handoff, never after-the-fact as a best guess.**
3. **Failed handoff cannot become a pending confirmation.**
4. **Confirmation is non-modal and app-global.**
5. **Pending assists are capped at 5 and 24 hours.**
6. **Repeated contact attempts remain separate intents.**
7. **Confirmed interaction time comes from the original assist start.**
8. **Phase 21 interactions are outbound by construction.**
9. **Call No Answer is a real interaction attempt with `connected=false`.**
10. **Text/email success is user attestation, not verified delivery.**
11. **Notes are optional and collapsed by default.**
12. **All confirmed writes reuse the existing authoritative interaction/recency path.**
13. **Unbound contacts participate normally without becoming Bound.**
14. **Merged targets redirect to survivor; purged targets are never resurrected.**
15. **Resolved assist rows are operational state, not permanent relationship history.**
16. **Widget Contact reuses the same Reach Out router as profiles.**
17. **The widget never becomes a second writer of assist state.**
18. **Phase 21 adds no passive phone/SMS/email observation capability.**
19. **Reach Out is hidden when a contact has no actionable methods; route enabling is phone/email-granular, so any actionable phone backs both Call and Text.**
20. **Interaction Assist toggled off clears pending assists immediately (off means off).**
21. **The assist banner is durable state: the Back button passes through it.**
22. **Notes are available on any confirmation that writes an interaction, including call No answer.**
23. **Merge redirect works by reparenting the assist inside Phase 20's merge; purge removes it at deletion time — neither relies on resolving a stale id after the fact.**

---

## Cross-Milestone Coherence Notes (2026-08-31)

- **Card View long-press "Message" (M2 `milestone-2` phase-07 §M).** The newer milestone-2 Card View dossier — interrogated *after* this dossier — specifies a single-channel `Message` long-press action, the same "Message-only" pattern Cluster AE identified as an inconsistency and converted to a `Contact` → Reach Out router on the widget. Phase 21 does not own the Card menu, so this is not a `[DECIDED]` conflict; it is a seam to reconcile when M2 Phase 9 (Profile Experience) / Phase 12 (Messaging & AI Compose) are interrogated. The Reach Out router built here is the natural target for that reconciliation. Flagged so it is not lost.
- **M2 confirms Reach Out is not a FAB action** (phase-01 universal FAB set excludes it) — it stays profile/widget/card-scoped, consistent with Cluster A.
- **Banner inherits M2 shell/theme transient contracts** (phase-01 §C shell layering, roadmap Phase 2 theme-aware transient surfaces) for styling, with the Back-pass-through exception recorded in Cluster H.
- **Compose "Send" carried into M2 Phase 12.** M2 Phase 12 (Messaging & AI Compose, PLANNED) will own Compose's Copy/Send/Cancel UX; its "Send" MUST map to Phase 21's handoff-to-native + assist-creation model, never a direct interaction write at Send time (Cluster AC). Record as a constraint when Phase 12 is interrogated.

---

## Explicitly Deferred

- Android notification-listener assist experiment.
- Reading call logs.
- Reading SMS/RCS history.
- Inbound interaction detection.
- Automatic interaction creation from OS events.
- Call duration capture.
- Delivery/read verification.
- WhatsApp/Signal/etc. as first-class interaction channels.
- Permanent endpoint-level interaction history.
- Dedicated Orbit email compose screen.
- System-notification-based Interaction Assist prompt.
- New small-widget communication actions.
- New widget-specific Call/Email buttons.
- Background assist polling or monitoring.

---

## Remaining Phase 21 Planning Details

These are implementation/planning items rather than unresolved product direction:

- final copy: `Reach Out` vs `Contact` in profile UI,
- exact modal/component reuse architecture,
- exact deep-link payload from widget to Reach Out modal,
- exact assist table schema,
- whether selected endpoint ID/value is persisted on pending assists and for how long,
- exact 15-second eligibility implementation across foreground/background lifecycle,
- exact pruning job timing,
- exact banner stacking/animation behavior,
- exact pending-queue review UI,
- exact Notes expander design,
- exact dialer URL / platform handoff API,
- exact mail-app handoff API,
- exact handling when no compatible native app exists,
- exact text Compose handoff wiring,
- exact failed-handoff detection behavior per platform,
- exact app-restart resume logic,
- exact merge/purge assist-table wiring (mechanism decided in Clusters AA/AB — reparent participation on merge, cascade/delete on purge; only the wiring remains a detail),
- exact purge detection behavior,
- exact setting storage/default migration,
- exact analytics/testing hooks if any,
- exact widget label/icon replacement from Message → Contact,
- regression testing against existing widget Quick mark / Log contact paths,
- test matrix for:
  - one endpoint vs multiple endpoints,
  - primary endpoint styling,
  - Assist setting On vs Off,
  - immediate return <15 seconds,
  - normal return >15 seconds,
  - call Yes,
  - call No answer,
  - text/email Yes,
  - Don’t log,
  - optional Notes,
  - handoff failure,
  - 24-hour expiry,
  - sixth-pending pruning,
  - multiple same-contact intents,
  - process death/reboot,
  - archived target,
  - merged target,
  - purged target,
  - widget Contact deep-link,
  - Compose → Messages → banner → interaction write.

---

## Revision Log

### 2026-08-31 — Pre-planning code audit + owner rulings

Triggered by `/gsd-discuss-phase 21`. CONTEXT.md remains a shim pointing here; this dossier is the ground truth and was revised directly. Three parallel read-only audits (shipped Phases 18–20 code, milestone-2 UI/UX v0.4 docs, current Widget/Compose code) plus four owner product rulings. Load-bearing code claims were verified against files on disk.

**Owner product rulings (new [DECIDED] items):**
- IA toggled off while assists pending → **clear immediately** (Cluster G).
- Contact with zero actionable methods → **hide the Reach Out action** (Cluster A).
- Back button vs assist banner → **pass through**; banner is durable, not a transient layer (Cluster H).
- Notes expander → available on **any confirmation that writes an interaction**, including call No answer (Cluster K).

**Factual corrections from the code audit:**
- Merge/purge redirect (Clusters AA/AB) promoted from "planning detail" to a named cross-phase implementation constraint: no survivor pointer exists in shipped Phase 20 code (`merge-dao.ts`/`purge-dao.ts`/`007-tombstones.ts`), so redirect must be done by reparenting the assist inside Phase 20's merge and removing it at purge time — not by a lazy lookup.
- Cluster F: "failed handoff" is only detectable as a launch failure (`expo-sms` returns `unknown`; `tel:`/`mailto:` are greenfield) — reinforced attestation model.
- Clusters A/B/D: no per-endpoint call-vs-text gating exists; any actionable phone backs both Call and Text.

**Confirmed solid (no change needed):** `recordTouchpoint` (`recency-dao.ts:217`) already supports outbound direction, `connected=0`, caller-supplied `occurredAt`, `note`, and free-text `channel`; the `interactions` schema has every needed column; recency/`rarely_responds`/gravity reuse is automatic; Compose already writes nothing at handoff (Cluster AC is additive); the larger widget's `Message` action is real and swappable in isolation (note: the widget deep-link needs a NEW allow-list URI in `widget-linking.ts`, not just a label swap).

**Cross-milestone seam surfaced (not a conflict):** M2 phase-07 §M keeps a single-channel Card View "Message" long-press — reconcile at M2 Phase 9/12 (see Cross-Milestone Coherence Notes).
