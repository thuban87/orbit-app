# Interaction Assist & Reach Out

**Last updated:** 2026-09-23
**Updated by phase:** 38.4-audit-remediation-ui-performance-release
**Owners:** `src/services/assist-commit.ts`, `src/db/interaction-assist-dao.ts`, `src/db/interaction-assist-read.ts`, `src/logic/assist-eligibility.ts`, `src/services/reach-out/handoff.ts`, `src/services/interaction-assist-sweep.ts`, `src/stores/assist-store.ts`, `src/components/ReachOutRouter.tsx`, `src/components/EndpointSelector.tsx`, `src/components/AssistBanner.tsx`, `src/components/AssistConfirmation.tsx`, `src/components/PendingConfirmationsSheet.tsx`

## Purpose

Interaction Assist lets a user start a Call, Text, or Email from Orbit, hands off to the native app, and — when they return — asks whether the interaction happened so it can be logged. Reach Out is the shared, reusable router that every surface (profile, Compose, larger widget) uses to launch a communication. The system is user-initiated assist, not passive activity detection: Orbit never reads call logs, the SMS database, or notifications.

## Architecture

### Data Model

One durable local table plus one settings column, shipped by migration 014. There is no backend; all state is on-device SQLite.

**Tables:**
- `interaction_assists` — one durable pending-handoff intent per reach-out, retained briefly after resolution.
  - `id` (`INTEGER PK`) / `uid` (`TEXT UNIQUE`) — local and portable identity.
  - `contact_id` (`INTEGER NOT NULL`) — `REFERENCES contacts(id) ON DELETE CASCADE`; the cascade is how purge removes assists.
  - `channel` (`TEXT`) — `CHECK IN ('call','text','email')`; the coarse channel that becomes the interaction's channel.
  - `endpoint_value` (`TEXT`) — the selected phone/email, operational handoff context only; never projected onto the interaction row.
  - `status` (`TEXT`) — `CHECK IN ('pending','logged','dismissed','expired','failed')`, default `pending`.
  - `handoff_at` (`TEXT`) — local wall-clock time of native launch; the eligibility window and the logged interaction's `occurred_at` both derive from it.
  - `resolved_at` / `created_at` / `modified_at` (`TEXT`) — lifecycle timestamps; `created_at DESC` drives the 5-pending cap.
- `app_settings.interaction_assist_enabled` (`INTEGER NOT NULL DEFAULT 1`) — the default-on master toggle.

**Types:**
- Assist rows are read for the banner via `src/db/interaction-assist-read.ts` (joined to `contacts` for a display name); the setting is read through `getAppSettings().interactionAssistEnabled` (`src/db/app-settings-dao.ts`).

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| DAO (write) | `src/db/interaction-assist-dao.ts` | Cap-5 `createPendingAssist`, and the status-guarded `markAssistLogged` / `markAssistDismissed` / `markAssistFailed` transitions — each inside the shared write mutex. |
| DAO (read) | `src/db/interaction-assist-read.ts` | The eligible pending queue (15s–24h window) and pending count, joined to `contacts`. |
| Logic | `src/logic/assist-eligibility.ts` | Pure 15s/24h local-wall-clock eligibility + newest-eligible banner selection. |
| Service | `src/services/reach-out/handoff.ts` | `performReachOut`: shared write-before-launch handoff that returns launch status and the created assist UID when one exists. |
| Service | `src/services/interaction-assist-sweep.ts` | Foreground launch-sweep: 24h expiry of pending rows + 30-day prune of terminal rows. |
| Service | `src/services/assist-commit.ts` | The shared confirmation contract: `runAssistAction` (synchronous in-flight latch, typed failure classification) and the post-commit publishers `publishAssistCommit` (widget + shell tick + queue) / `publishAssistDismissal` (queue). Node-testable; callers inject the real side effects. |
| Store | `src/stores/assist-store.ts` | SQLite-backed eligible-queue state; refreshed at launch, on a real background→active return, and after every committed confirm/dismiss. Only the most recently started refresh may publish (latest-request authority). |

### Key Files

| File | Role |
|------|------|
| `src/db/migrations/014-interaction-assists.ts` | Creates `interaction_assists` (+ pending index, FK cascade) and the settings column. |
| `src/components/ReachOutRouter.tsx` | Themed channel chooser; hides on no-route, launches directly on one endpoint, opens the selector on many. |
| `src/components/EndpointSelector.tsx` | Scrollable phone/email chooser with the primary method emphasized. |
| `src/components/AssistBanner.tsx` | App-global non-modal banner, in flow above the tab navigator (38.6 D-38); runs confirm/dismiss through the shared `assist-commit` runner and publishers. |
| `src/components/AssistConfirmation.tsx` | Presentational attestation controls (Yes / No answer / Don't log) + optional Notes expander; disabled while the owner's write is `pending`. |
| `src/components/PendingConfirmationsSheet.tsx` | Transient multi-item pending-queue review surface. |
| `src/screens/ComposeScreen.tsx` | Compose-attached Yes / Not yet panel that supplements, never replaces, the durable queue surfaces. |
| `src/screens/SettingsInteractionsScreen.tsx` | Hosts the toggle through the specialized queue-clearing settings writer. |

## How It Works

### Reaching out (profile / widget)

1. On a profile, `ContactProfileScreen` derives available routes synchronously from its already-loaded method groups (`src/db/contact-methods-read.ts` actionable-primary selection) — no second query, and the entry is hidden entirely if there is no actionable phone or email.
2. Tapping Reach out opens `ReachOutRouter`. Any actionable phone enables **both** Call and Text; any actionable email enables Email. The primary channel (Call, else Email) is accent-emphasized.
3. Choosing a channel with exactly one endpoint launches directly (2 taps); with ≥2 endpoints it opens `EndpointSelector` (3rd tap), where the `is_primary` row is accent-filled and tagged "Primary".
4. `launch()` calls `performReachOut` with the canonical method value. When Interaction Assist is enabled, `performReachOut` writes a pending assist **before** `SMS.sendSMSAsync` / `Linking.openURL('tel:'|'mailto:')`. A thrown launch marks the assist `failed` and shows a per-channel Alert; a resolved OS call is treated only as a successful handoff request, never as delivery.
5. The larger widget's `Contact` action deep-links `orbit://reach/<id>` into this same router (see `widget.md` / `app-shell.md`); the widget never writes assist rows.

### Compose-attached confirmation

1. `ComposeScreen` presents `Did you send it?` only when `performReachOut()` reports both a started handoff and an assist UID.
2. `Yes, log interaction` calls `markAssistLogged()` with that UID and `connected: 1` through the shared `runAssistAction`; the DAO re-reads the pending row and writes at its original `handoff_at` through the sole recency writer. After the commit it publishes through `publishAssistCommit` (widget, shell tick, queue) before leaving Compose.
3. `Not yet` closes only the local panel and preserves the Compose session. It does not dismiss the assist, leaving the app-global banner and pending-confirmations sheet available after navigation, process death, or the 24-hour window.

### Returning and confirming

1. On a real background→active return, `assist-store` re-queries the eligible queue; `AssistBanner` (mounted app-wide in `App.tsx`) surfaces the newest eligible assist and a "{N} more pending" count.
2. `AssistConfirmation` offers, for Call: **Yes** (`connected=1`), **No answer** (`connected=0`, still logs), **Don't log**; for Text/Email: **Yes**, **Don't log**. An optional Notes expander (default closed) rides on any confirmation that writes an interaction.
3. **Yes / No answer** call `markAssistLogged`, which re-reads the assist row **inside** one transaction, inserts a single outbound interaction at `handoff_at` via `insertInteractionCore`, recomputes recency via `recomputeLastContactCore` (the sole `last_contact` writer), then flips the assist to `logged`. It resolves an outcome: `logged`, `already-logged` (a harmless repeat confirm) or `closed` (the assist was dismissed, expired, failed or gone, so nothing was written). `runAssistAction` maps `closed` to its own result: the surface shows "Already closed" copy, refreshes only the queue, and Compose does not take its "logged" exit. **Don't log** calls `markAssistDismissed` — no interaction. (See ADR-071; the write path composes the cores from `src/db/data-revision-dao.ts`.)
4. The banner exposes `PendingConfirmationsSheet` for multiple pending items; resolving the last one leaves the sheet in a calm empty state.
5. **One publication and failure contract (38.3 RG-023).** Banner, sheet and Compose all run the write through `runAssistAction` in `src/services/assist-commit.ts`. A committed confirmation publishes widget notify, the shell refresh tick and an assist-queue refresh; a dismissal refreshes the queue only. A write failure shows an Alert and leaves the assist pending; a publication failure after the commit is logged, never reported as a failed log.

### Lifecycle housekeeping

- **Cap:** every `createPendingAssist` expires all but the 5 newest pending rows.
- **Eligibility / expiry:** a pending assist is eligible 15s–24h after `handoff_at`; the foreground `interaction-assist-sweep` (registered at launch, never a timer) expires aged pending rows and prunes terminal rows after 30 days.
- **Toggle off:** `SettingsInteractionsScreen` routes disabling through `setInteractionAssistEnabled`, which expires every pending row in one transaction, then re-reads settings and refreshes the banner immediately — "off means off"; generic settings persistence is forbidden here and re-enabling starts fresh (no resurrection).
- **Merge / purge:** a merge reparents pending assists to the survivor inside the merge transaction; a purge removes them via the FK cascade (see `contacts.md` / `contact-reconciliation.md`, ADR-073).

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `ELIGIBLE_AFTER_SECONDS` | `15` | `src/logic/assist-eligibility.ts` | Minimum away-time before an assist can prompt. |
| `EXPIRE_AFTER_HOURS` | `24` | `src/logic/assist-eligibility.ts` | Global pending-assist expiry window. |
| `RETAIN_RESOLVED_DAYS` | `30` | `src/services/interaction-assist-sweep.ts` | Retention of terminal rows before the sweep prunes them. |
| pending cap | `LIMIT 5` | `src/db/interaction-assist-dao.ts` | Newest-5 unresolved pending assists kept; a 6th expires the oldest. |

## Decisions

- **ADR-070:** Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out — the table, status taxonomy, cap/expiry/retention sweep, write-before-handoff, and the default-on/off-clears portable setting.
- **ADR-071:** User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer — one outbound interaction at `handoff_at` through the authoritative recency writer; attestation, not delivery verification.
- **ADR-072:** Shared Actionable Reach Out Router with Native Channel Handoff — phone/email-granular routing, ≤3 taps, primary emphasis, hidden-when-method-less, `tel:`/`sms:`/`mailto:` handoff, Compose Send seam.
- **ADR-073:** Merge-Reparented, Purge-Cascaded Interaction Assists — redirect-to-survivor without a lazy lookup.
- **ADR-074:** Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe — the widget entry into this router.
- **ADR-133:** Session-Scoped Compose Modes and Truthful External Handoff — adds a Compose-attached confirmation without weakening the durable assist lifecycle.
- **ADR-140:** Navigation-First Settings Directory and Canonical Sub-Routes — moves the toggle to Interactions while retaining ADR-070's specialized write path.
- **ADR-164:** Shared Post-Commit Assist Publisher with Surfaced Assist Failures — routes every confirm/dismiss through `runAssistAction` with one post-commit publisher, latched surfaces, surfaced failures, and a `closed` outcome.
- **ADR-173:** Universal FAB Semantic Visibility, Open-Dial Containment, Non-Collapsable Shell Overlays, Border, and Bottom Clearance — closed dial is inert to assistive tech, box-none overlays are `collapsable={false}`, permanent `onAccent` ring, route-derived clearance.
- **ADR-174:** Fit-to-Width Heatmaps and Large-Text Reachability for Dialogs and Sheets — measured, centred heatmaps with capped tap zones; dialog, sheet and prompt actions stay reachable at maximum text.

## Gotchas

1. **All four DAO writers must stay inside `inWriteTransaction`.** `markAssistDismissed`/`markAssistFailed` originally issued bare `UPDATE`s (review WR-01); on the single shared connection a bare write executes inside whatever transaction the launch sweep is holding and is lost if that transaction rolls back. Fixed in-phase — both now wrap in the shared mutex like `createPendingAssist`/`markAssistLogged`. Never reintroduce a bare assist write.
2. **The banner intentionally shows assists for archived contacts.** `ELIGIBILITY_SQL` has no `archived_at IS NULL` gate — dossier Cluster Z decided that a contact archived while an assist is pending can still be confirmed. This is deliberate, not the same as the widget guard (which blocks a *new* reach to an archived target). Do not "fix" it by adding the filter.
3. **A method-less contact tapped via the widget strands `openReachOut`.** `ContactProfileScreen` clears the param only when `hasReachRoute` is true, so a widget "Contact" tap on a favourite with no phone/email opens nothing and leaves the param set (review IN-02, owner-deferred). Clearing it unconditionally is the recommended fix.
4. **Every confirm/dismiss goes through `runAssistAction` in `src/services/assist-commit.ts`** (38.3 RG-023; D-04, D-08, D-21; closes Phase 21 IN-03 and `react-native/AUD-RN-013`). Banner, pending sheet and Compose share it. Its rules:
   - A rejected write shows an Alert, and the assist stays pending: the DAO guard fires before the transaction opens, or the transaction rolls back. The ADR-071 future-`handoff_at` (clock-rollback) guard throws the typed `FutureOccurredAtError` from `src/db/log-guards.ts` (same message text) and gets its own "Check your device clock" copy; anything else gets the generic copy.
   - A synchronous in-flight latch blocks double taps on Yes / No answer / Don't log (per surface; per assist in the sheet), released in `finally`. `AssistConfirmation` disables its controls while `pending` and awaits its handlers instead of dropping rejections with `void`.
   - Publication (widget + queue + shell tick) runs only after the commit, each step isolated, and never rejects — a committed write is never presented as failed or invited to replay (D-04).
   - Do not bypass the runner with a direct DAO call from a new surface, and do not change the guard, the handoff-time timestamp or the pending recheck (ADR-071).
5. **`endpoint_value` is not history.** It exists only to perform the handoff; the interaction row records the coarse `channel` only. Do not add endpoint/provider columns to `interactions` — that is explicitly out of scope.
6. **Failed = the native launch threw**, not "the user didn't send." `expo-sms` returns `unknown` on Android and `tel:`/`mailto:` only report that some app can handle them, so "sent" is never observable — confirmation is user attestation.
7. **Not yet is not Don't log.** The Compose panel must not call `markAssistDismissed`; durable dismissal remains available from the pending-confirmations sheet.
8. **Do not use generic settings persistence for this toggle.** It would skip the atomic pending-row expiry and immediate banner refresh required by ADR-070.

## Related Systems

- **Contacts** — assist confirmation writes an interaction and recomputes `last_contact` through the sole recency writer; purge cascade-deletes pending assists.
- **Interaction log** — the assist path is a new caller of the `interactions` touchpoint writer (outbound, handoff-time, `connected` per Call outcome).
- **Contact methods** — the router selects actionable-primary phone/email; Compose Send routes through the shared handoff.
- **Contact reconciliation** — merge reparents pending assists to the survivor.
- **Widget** / **App shell** — the widget `Contact` deep-link and the app-global banner mount + Settings toggle live there.
- **Backup & restore** — `interactionAssistEnabled` rides in the portable manifest.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-08-31 | 21-interaction-assist-reach-out | New subsystem: migration 014 `interaction_assists` + `interaction_assist_enabled`; shared Reach Out router + native handoff; app-global assist banner; durable lifecycle (cap-5 / 15s–24h / 30-day sweep); attestation logging through the sole recency writer; merge/purge wiring; widget `Contact` deep-link. |
| 2026-09-02 | 35 | Added the Compose-attached confirmation panel while preserving the banner, sheet, dismissal path, and handoff-time interaction write. |
| 2026-09-02 | 37 | Moved the toggle to Interactions and preserved its specialized opt-out writer and banner refresh. |
| 2026-09-26 | 38.3 | `markAssistLogged` now resolves `logged` / `already-logged` / `closed`; a confirm of a dismissed or expired assist is shown as "Already closed" and never as logged (Compose no longer exits as "logged" for it). Guard, handoff-time stamp and pending recheck unchanged (review B-WR-05). |
| 2026-09-25 | 38.3 | Shared assist publisher + RN-013 failure handling (RG-023): banner, pending sheet and Compose share `assist-commit.ts` (latched runner, widget + queue + shell-tick publication that never reports a post-commit failure, Alert on write failure with typed clock-rollback copy); the queue refresh is latest-request gated. |
| 2026-09-23 | 38.4 | While the FAB speed dial is open, the AssistBanner is hidden from accessibility, and its root is `collapsable={false}` so Fabric cannot re-form it as a touch sink (D-42 A, D-33/GAP-G2; ADR-173). The pending-confirmations sheet was checked at maximum text and kept as an RN `Modal` with explicit-action exits; its minor large-text findings are in todo `2026-09-28-pending-confirmations-sheet-large-text.md` (D-49). |
| 2026-09-30 | 38.6 | The banner renders in flow at the top of the navigator's safe-area column instead of as an absolute overlay, so it no longer covers other screens' app bars (D-38). |
