# Interaction Assist & Reach Out

**Last updated:** 2026-08-31
**Updated by phase:** 21-interaction-assist-reach-out
**Owners:** `src/db/interaction-assist-dao.ts`, `src/db/interaction-assist-read.ts`, `src/logic/assist-eligibility.ts`, `src/services/reach-out/handoff.ts`, `src/services/interaction-assist-sweep.ts`, `src/stores/assist-store.ts`, `src/components/ReachOutRouter.tsx`, `src/components/EndpointSelector.tsx`, `src/components/AssistBanner.tsx`, `src/components/AssistConfirmation.tsx`, `src/components/PendingConfirmationsSheet.tsx`

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
| Service | `src/services/reach-out/handoff.ts` | `performReachOut`: the one shared write-before-launch native handoff for all callers. |
| Service | `src/services/interaction-assist-sweep.ts` | Foreground launch-sweep: 24h expiry of pending rows + 30-day prune of terminal rows. |
| Store | `src/stores/assist-store.ts` | SQLite-backed eligible-queue state; refreshes only on a real background→active return. |

### Key Files

| File | Role |
|------|------|
| `src/db/migrations/014-interaction-assists.ts` | Creates `interaction_assists` (+ pending index, FK cascade) and the settings column. |
| `src/components/ReachOutRouter.tsx` | Themed channel chooser; hides on no-route, launches directly on one endpoint, opens the selector on many. |
| `src/components/EndpointSelector.tsx` | Scrollable phone/email chooser with the primary method emphasized. |
| `src/components/AssistBanner.tsx` | App-global non-modal overlay; owns the confirm/dismiss DB writes and widget invalidation. |
| `src/components/AssistConfirmation.tsx` | Presentational attestation controls (Yes / No answer / Don't log) + optional Notes expander. |
| `src/components/PendingConfirmationsSheet.tsx` | Transient multi-item pending-queue review surface. |

## How It Works

### Reaching out (profile / widget)

1. On a profile, `ContactProfileScreen` derives available routes synchronously from its already-loaded method groups (`src/db/contact-methods-read.ts` actionable-primary selection) — no second query, and the entry is hidden entirely if there is no actionable phone or email.
2. Tapping Reach out opens `ReachOutRouter`. Any actionable phone enables **both** Call and Text; any actionable email enables Email. The primary channel (Call, else Email) is accent-emphasized.
3. Choosing a channel with exactly one endpoint launches directly (2 taps); with ≥2 endpoints it opens `EndpointSelector` (3rd tap), where the `is_primary` row is accent-filled and tagged "Primary".
4. `launch()` calls `performReachOut` with the canonical method value. When Interaction Assist is enabled, `performReachOut` writes a pending assist **before** `SMS.sendSMSAsync` / `Linking.openURL('tel:'|'mailto:')`. A thrown launch marks the assist `failed` and shows a per-channel Alert; a resolved OS call is treated only as a successful handoff request, never as delivery.
5. The larger widget's `Contact` action deep-links `orbit://reach/<id>` into this same router (see `widget.md` / `app-shell.md`); the widget never writes assist rows.

### Returning and confirming

1. On a real background→active return, `assist-store` re-queries the eligible queue; `AssistBanner` (mounted app-wide in `App.tsx`) surfaces the newest eligible assist and a "{N} more pending" count.
2. `AssistConfirmation` offers, for Call: **Yes** (`connected=1`), **No answer** (`connected=0`, still logs), **Don't log**; for Text/Email: **Yes**, **Don't log**. An optional Notes expander (default closed) rides on any confirmation that writes an interaction.
3. **Yes / No answer** call `markAssistLogged`, which re-reads the assist row **inside** one transaction, inserts a single outbound interaction at `handoff_at` via `insertInteractionCore`, recomputes recency via `recomputeLastContactCore` (the sole `last_contact` writer), then flips the assist to `logged`. **Don't log** calls `markAssistDismissed` — no interaction. (See ADR-071; the write path composes the cores from `src/db/data-revision-dao.ts`.)
4. The banner exposes `PendingConfirmationsSheet` for multiple pending items; resolving the last one leaves the sheet in a calm empty state.

### Lifecycle housekeeping

- **Cap:** every `createPendingAssist` expires all but the 5 newest pending rows.
- **Eligibility / expiry:** a pending assist is eligible 15s–24h after `handoff_at`; the foreground `interaction-assist-sweep` (registered at launch, never a timer) expires aged pending rows and prunes terminal rows after 30 days.
- **Toggle off:** disabling Interaction Assist in Settings expires every pending row in one transaction and refreshes the banner immediately — "off means off"; re-enabling starts fresh (no resurrection).
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

## Gotchas

1. **All four DAO writers must stay inside `inWriteTransaction`.** `markAssistDismissed`/`markAssistFailed` originally issued bare `UPDATE`s (review WR-01); on the single shared connection a bare write executes inside whatever transaction the launch sweep is holding and is lost if that transaction rolls back. Fixed in-phase — both now wrap in the shared mutex like `createPendingAssist`/`markAssistLogged`. Never reintroduce a bare assist write.
2. **The banner intentionally shows assists for archived contacts.** `ELIGIBILITY_SQL` has no `archived_at IS NULL` gate — dossier Cluster Z decided that a contact archived while an assist is pending can still be confirmed. This is deliberate, not the same as the widget guard (which blocks a *new* reach to an archived target). Do not "fix" it by adding the filter.
3. **A method-less contact tapped via the widget strands `openReachOut`.** `ContactProfileScreen` clears the param only when `hasReachRoute` is true, so a widget "Contact" tap on a favourite with no phone/email opens nothing and leaves the param set (review IN-02, owner-deferred). Clearing it unconditionally is the recommended fix.
4. **Confirm/dismiss handlers have no try/catch** (review IN-03, backlog): a rejected `markAssistLogged`/`markAssistDismissed` (e.g. the LOG-06 future-`handoff_at` guard on a backward clock) is currently an unhandled rejection. Mirror `doLogContact`'s Alert if you touch these.
5. **`endpoint_value` is not history.** It exists only to perform the handoff; the interaction row records the coarse `channel` only. Do not add endpoint/provider columns to `interactions` — that is explicitly out of scope.
6. **Failed = the native launch threw**, not "the user didn't send." `expo-sms` returns `unknown` on Android and `tel:`/`mailto:` only report that some app can handle them, so "sent" is never observable — confirmation is user attestation.

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
