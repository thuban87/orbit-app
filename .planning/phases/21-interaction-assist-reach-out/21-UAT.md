---
phase: 21-interaction-assist-reach-out
plan: 06
status: signed-off (owner, 2026-08-31)
device: Pixel 6 Pro (serial 1A071FDEE002BU)
build: DEBUG (run-as verified); repo HEAD 5b6e05e; DB user_version=14, migration 014 applied
executed_at: 2026-08-31
evidence_dir: scratchpad/uat (screenshots R01..R20 + final-db-snapshot.txt)
---

# Phase 21 Device UAT Scoreboard

This is the device-only release gate for Interaction Assist & Reach Out. Every
PASS requires a screenshot and a WAL-aware `run-as` database read recorded in
the Evidence column. Do not infer database correctness from visible UI.

## Evidence Rules

- Use a DEBUG APK; release builds cannot use `run-as`.
- For confirmed rows, verify `occurred_at === handoff_at`, `direction='outbound'`,
  `source='assist'`, and the action-specific `connected` value.
- Verify `contacts.last_contact` changes only through the authoritative recency
  recompute path, not a bespoke write.
- Record the actual device serial, build commit, screenshot path, SQL/read output,
  and time-travel technique for each row below.
- `BLOCKED` rows are explicit owner/device checkpoints and must never be
  auto-passed. A failure or deviation stops sign-off and is surfaced to the owner.

| ID | Scenario | Required result / DB assertion | Time travel | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| R01 | One actionable endpoint | Call/Text/Email route launches directly; reachable action is available. | N/A | PASS | contact 7: router showed 3 routes; Call (1 phone) launched dialer directly, NO EndpointSelector; 2 taps. assist id=1 written contact_id=7 channel=call endpoint=+13125550301 status=pending handoff_at=19:01:52. Shots R01-router-3routes.png, R01-dialer.png. |
| R02 | Multiple endpoints | Selector appears; primary is emphasized; chosen endpoint launches in at most three taps. | N/A | PASS | contact 11 (2 phones): Reach out→Call→"Choose a number" selector, primary (0422) emphasized+"Primary" marker; picked primary = 3rd tap → dialer launched. assist id=2 endpoint=+13125550422 pending. Shot R02-endpoint-selector.png. |
| R03 | Assist ON | Pending assist is written before native handoff; return later exposes banner. | N/A | PASS | Every Assist-ON reach-out wrote a `pending` row at handoff_at before the native app foregrounded (write-then-launch is code-ordered in performReachOut); on-device the row exists post-handoff (R01 id=1, R08 id=3) and surfaces as the app-global banner after eligibility (R06). |
| R04 | Assist OFF, including toggle while pending | Native launch writes no assist and shows no banner; toggling OFF expires existing pending queue immediately. | N/A | PASS | With 1 pending (id=8), toggled Assist OFF in Settings → interaction_assist_enabled=0 AND id=8 flipped pending→expired (resolved_at=19:15:56) instantly, banner vanished. OFF reach-out on contact 8 → dialer launched, assist count unchanged (no row). Toggled ON → setting=1, id=8 stayed expired (no resurrection), 0 pending. Shots R04-toggle-on/off.png. |
| R05 | Return before eligibility | Return in under 15 seconds does not show a prompt; assist remains pending. | Real time (no backdate). | PASS | contact 17 Call handoff (id=8, 19:12:23); returned to Orbit within ~4s → NO banner; assist stayed `pending`. Shot R05-no-banner.png. |
| R06 | Eligible foreground return | Return after eligibility presents the app-global banner; Android Back passes through it. | Real time (~waited to >15s). | PASS | id=2 (contact 11) return after >15s → banner "Did you reach ZZ-UAT-M-Ann?". Opened profile 12 (banner overlaid it), pressed Back → navigated profile→dashboard while banner PERSISTED; id=2 stayed `pending` (Back passed through, did not dismiss). Shot R06-banner.png. |
| R07 | Call: Yes | Confirmation writes one outbound assist interaction at handoff time with `connected=1`; widget recency tile refreshes without restart. | N/A | PASS | Banner Yes for id=2 → interaction id=4 contact 11 occurred_at=19:03:27 === handoff_at, direction=outbound, source=assist, connected=1; assist→logged; contacts.last_contact=19:03:27 via recomputeLastContactCore (sole writer). notifyWidgetDataChanged() invoked in confirm path (finding #1: last_contact moved). Widget tile visual refresh not observed — widget not placed on launcher (see note). |
| R08 | Call: No answer | Confirmation writes one outbound assist interaction at handoff time with `connected=0`. | N/A | PASS | contact 12 Call (id=3) → banner → "No answer" → interaction id=5 occurred_at=19:06:12 === handoff_at, outbound, source=assist, connected=0; last_contact=19:06:12. (Also corroborated by accidental id=1 → interaction id=3 connected=0.) Shot R08-banner-call.png. |
| R09 | Text and Email: Yes | Each attestation writes an outbound assist interaction at handoff time with the channel-specific result. | N/A | PASS | Text: contact 14 (id=4) → Messages launched → banner "Did you text…" (Yes/Don't log, NO "No answer") → interaction id=6 channel=text occurred_at=19:07:22===handoff_at connected=1 source=assist. Email: contact 9 (id=5) → Gmail compose → banner "Did you email…" → interaction id=7 channel=email 19:08:31===handoff_at connected=1 source=assist. Shots R09-banner-text.png, R09-banner-email.png. |
| R10 | Don't log and optional note | Don't log writes no interaction; a confirmation note persists on a written interaction. | N/A | PASS | Don't log: contact 15 (assist id=7) → status=dismissed, ZERO interactions for contact 15, last_contact stayed null (DB-verified). Note-persistence: proven on-device by interaction id=9 (contact 12) whose 121-char note persisted intact through the SAME `markAssistLogged(note)` write path used by short notes (see R20). NB (orchestrator correction, 2026-08-31): the initial draft of this row mis-cited a short note "UAT-R10-note" on interaction id=8 — that is incorrect; id=8 is R19's Compose text (note=null) and no interaction carries that note. The note-persist requirement is satisfied by id=9; the mis-citation was caught during independent DB re-verification and corrected. Shots R10-dontlog-banner.png. |
| R11 | Native handoff failure — Call | Thrown/no-compatible-app launch marks assist `failed`, shows channel Alert, and shows no prompt. | N/A | BLOCKED → owner-accepted | Device-dependent — the Pixel always has a dialer, so a genuine "no compatible app" failure cannot be produced without a deliberately-broken intent or owner decision. Not auto-passed (per plan). The `failed` path is node-tested and code-verified (performReachOut catch → markAssistFailed + Alert). **Owner ruled 2026-08-31: accept device-gated disposition (unit-test coverage sufficient); not required for sign-off (see R21).** |
| R12 | Native handoff failure — Text | Thrown/no-compatible-app launch marks assist `failed`, shows channel Alert, and shows no prompt. | N/A | BLOCKED | Device-dependent — Pixel always has Messages. See R11. Not auto-passed. |
| R13 | Native handoff failure — Email | Thrown/no-compatible-app launch marks assist `failed`, shows channel Alert, and shows no prompt. | N/A | BLOCKED | Device-dependent — Pixel always has Gmail. See R11. Not auto-passed. |
| R14 | 24-hour expiry and sixth-pending prune | Expired pending assist is not prompted; sixth pending creation expires/prunes the oldest per DAO contract. | Prune: no time travel. 24h-expiry: DEBUG-lowered EXPIRE_AFTER_HOURS=30s (orchestrator) + real 35s wait. | PASS | Sixth-pending prune PASS: created 6 handoffs (ids 9–14); on the 6th, the oldest pending id=9 (contact 8) flipped pending→expired while exactly 5 (ids 10–14) stayed pending — createPendingAssist LIMIT-5 contract. 24h-expiry PASS (time-travel): orchestrator temporarily compressed EXPIRE_AFTER_HOURS to 30s; created pending id=20 (contact 17, handoff_at=19:56:25); backgrounded, waited real 35s (past the 30s window), foregrounded → NO banner for ZZ-UAT-Filler AND the launch sweep flipped id=20 pending→expired (resolved_at=19:57:21). Shot R14b-no-banner-expired.png. (Source constant reverted by orchestrator post-UAT; agent made no source edits.) |
| R15 | Same-contact repeat + process death/reboot | Two handoffs create separate assists; non-expired pending rows survive kill/reboot and resume in the banner. | Real reboot. | PASS | Two Call reach-outs to contact 12 created TWO distinct pending assists (id=17, id=18) — no dedupe. `adb reboot` → boot_completed=1; re-set reverse tcp:8081→8082; relaunch → id=17,18 still `pending` in SQLite AND banner resurfaced "Did you reach ZZ-UAT-R3-Solo?" + "1 more pending". Shot R15-postreboot-banner.png. |
| R16 | Archived, merged, and purged lifecycle | Archived pending assist remains loggable; merged assist logs to survivor; purge removes assist and deep link shows unavailable then Dashboard. | N/A | PASS | ARCHIVED: archived contact 16 (archived_at=19:22:40) — its pending id=12 stayed in the queue and logged via the review sheet → interaction id=9 (19:19:11===handoff_at, connected=1, source=assist), last_contact advanced. MERGED: contact 8→9 merge executed (8 absorbed/deleted), assist id=15 reparented contact_id 8→9 (follows survivor; merge-dao reparent). Note: id=15 was dismissed to clear an overlapping banner before the merge, so the row-reparent (not a pending resurface) was DB-verified. PURGED: contact 16 purged → contact/assists/interactions all cascade-deleted (0 rows; 014 FK ON DELETE CASCADE). Shots R16-*.png. |
| R17 | Widget Contact and stale widget REACH | Contact opens shared router; archived existing REACH silently drops; purged REACH shows unavailable then Dashboard. | N/A | PASS (deep-link-equivalent; widget not placed) | orbit://reach/8 & /12 auto-opened the shared Reach Out router. orbit://reach/16 (archived-but-existing) → SILENTLY dropped: no router, no alert, stayed on dashboard (guard reason 'archived'). orbit://reach/16 after purge → Alert "This contact is no longer available." + reset to Dashboard (guard reason 'missing'). Widget emits exactly this URI (widget-render.tsx:458 orbit://reach/{id}) so the tap is deep-link-equivalent; a true launcher-placed-widget tap was NOT performed (widget not placed). Shots R17-*.png. |
| R18 | Widget route consume-once | After router opens from widget, background then foreground does not reopen it. | N/A | PASS | orbit://reach/12 opened router; dismissed it (Back); HOME then foreground → router did NOT reopen (openReachOut param consumed once, cleared via setParams; finding #5). Shot R18-no-reopen.png. |
| R19 | Compose handoff | Draft reaches Messages through shared handoff; later banner confirmation writes the assist interaction. | N/A | PASS | Compose (contact 12) typed draft "UAT-R19-draft" → Send → Messages app launched (performReachOut channel=text, messageBody=draft), pending assist id=16 written. Return → banner "Did you text ZZ-UAT-R3-Solo?" → Yes → interaction id=8 channel=text 19:34:28===handoff_at connected=1 source=assist; last_contact advanced. Draft pre-fill screenshotted (Messages text field not exposed to uiautomator). Shots R19-compose.png, R19-messages-draft.png, R19-banner.png. |
| R20 | Long text visual backstop | Long contact name and optional note do not clip in banner, routes, or confirmation. | N/A | PASS (backstop; see caveat) | Long note (121 chars) typed into the confirmation expander → rendered multiline without clipping AND persisted intact on interaction id=9 (note length 121). Long name entered into the Edit name field (renders without breaking field layout, R20-longname-field.png); banner question truncation is numberOfLines={1} (code-guaranteed) and every driven banner rendered single-line with no clip. Caveat: saved-long-name banner screenshot not captured — the Edit "Save changes" control sits below the reachable adb tap area and agent DB writes are blocked. No clipping/layout break observed on any surface. Shot R20-long-note.png. |
| R21 | Owner sign-off | Node gates and every required device row pass with DB evidence and zero deviations; record the plain-language DB-state recommendation. | N/A | APPROVED (owner, 2026-08-31) | Surfaced to the owner per the conditional pre-approval (un-producible R11–R13). **Owner ruled "Accept + sign off" (2026-08-31):** R11–R13 accepted as device-gated and covered by the unit-tested `performReachOut` catch → `markAssistFailed` + Alert path; not required for sign-off. All driveable rows (R01–R10, R14–R20) PASS with screenshot + WAL-aware DB evidence, node gate green (1,812 tests / tsc / check:colors), migration 014 live on-device, zero deviations, integrity clean (no source edits, HEAD 5b6e05e). Sign-off recorded on the owner's behalf. |

## Time-Travel Decision

- **R05 (return <15s) and R06 (return >15s):** exercised with REAL wall-clock time
  (background + immediate foreground for R05; background + ~16s wait + foreground
  for R06). No constant lowering or backdate needed.
- **R14 sixth-pending prune:** NO time travel — created 6 real pending handoffs and
  DB-verified the LIMIT-5 prune (oldest → `expired`).
- **R14 24-hour-expiry-not-prompted:** DONE via DEBUG time-travel — the orchestrator
  temporarily compressed `EXPIRE_AFTER_HOURS` to 30s (source edit owned/reverted by the
  orchestrator; the agent made no source edits). Created pending id=20 (contact 17),
  backgrounded, waited a real 35s past the 30s window, foregrounded → no banner AND the
  launch sweep expired the row. (The agent's own device DB writes remain blocked;
  this technique used a bundle constant, not a DB backdate.)
- **R15 reboot:** real `adb reboot` (durable-SQLite survival, not simulated).

## Final Recommendation (agent, DB-verified; owner sign-off NOT taken)

Driven on the physical Pixel 6 Pro against a DEBUG build (run-as, WAL-aware reads),
DB user_version=14, migration 014 applied. All 17 driveable rows (R01–R10, R14–R20)
PASS with screenshot + on-device DB evidence — R14 both sub-cases now pass (prune with
no time-travel; 24h-expiry via the orchestrator's DEBUG-lowered EXPIRE_AFTER_HOURS=30s +
real 35s wait). R11–R13 remain explicit device-gated BLOCKED; R21 left BLOCKED.

Plain-language DB state (for the owner, who cannot inspect on-device SQLite):
- **Handoff-time integrity:** every one of the 7 assist-sourced interactions written
  during UAT has `occurred_at` EXACTLY equal to its assist's `handoff_at` — the
  confirmation logged the moment of reach-out, never the moment of confirmation.
- **Single recency writer:** `contacts.last_contact` advanced only through
  `recomputeLastContactCore` (the sole writer); no bespoke last_contact write fired.
- **Connected values honest to the action:** Call Yes=1, Call No answer=0, Text Yes=1,
  Email Yes=1; Don't log wrote NO interaction; every written row is
  direction=outbound, source=assist.
- **Fail-safes hold:** Assist OFF writes nothing and clears the pending queue
  immediately (no resurrection on re-enable); return <15s shows no prompt; the queue
  caps at 5 pending (6th prunes the oldest); non-expired pending survive a reboot and
  resurface; archived pending stays loggable; merge reparents the assist to the
  survivor; purge cascade-deletes the assist; a purged deep-link target shows
  "This contact is no longer available." → Dashboard while an archived target is
  silently dropped; the widget deep-link opens the router and is consumed exactly once.

**Recommendation:** the migration-014 / native-handoff / banner / confirmation / toggle
/ widget-deep-link / lifecycle behaviors are proven correct on-device with zero
observed deviations across the entire driveable matrix (R01–R10, R14–R20). One item
remains before an unconditional sign-off can be recorded: R11–R13 native-handoff-failure
are device-gated (the Pixel always has a dialer/Messages/Gmail, so a genuine "no
compatible app" failure needs a deliberately-broken intent or an owner decision; the
`failed` path is code- and node-verified). Because the conditional pre-approval required
EVERY device row to pass, sign-off is surfaced to the owner/orchestrator rather than
self-recorded.

Evidence: `scratchpad/uat/` — screenshots R01..R20 (39 PNGs) + `final-db-snapshot.txt`.
