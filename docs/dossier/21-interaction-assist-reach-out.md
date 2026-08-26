# Dossier 21 — Interaction Assist & Reach Out

**Status:** draft-complete from owner interrogation · 2026-08-26  
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

---

## Cluster AB — Purged Contact

**[DECIDED] If the target identity has been permanently purged before confirmation:**

- do not recreate it,
- do not create an orphan interaction,
- expire/dismiss the assist.

Exact internal status choice can be a planning detail so long as no interaction is written.

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
- exact merge-survivor redirect lookup,
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
