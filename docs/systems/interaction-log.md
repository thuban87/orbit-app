# Interaction Log

**Last updated:** 2026-09-02
**Updated by phase:** 33-group-interaction-logging
**Owners:** `src/db/recency-dao.ts`, `src/db/events-dao.ts`, `src/db/timeline-read.ts`, `src/db/log-guards.ts`, `src/db/impact-read.ts`, `src/services/impact.ts`, `src/services/quick-log-command.ts`, `src/db/bulk-actions-dao.ts`, `src/db/interaction-vocabulary.ts`

## Purpose

The interaction log records contact touchpoints and lifecycle events on-device, then gives the profile one correctable, chronological history. It makes logging cheap while keeping optional detail, connection policy, derived gravity, and intensity readable without a backend or stored score.

## Architecture

### Data Model

Group-linked `interactions` add nullable `group_event_id` and `ge_follow_channel` / `ge_follow_quality` / `ge_follow_duration` columns. The ordinary Channel/Tone/Duration values stay resolved on each child, and its `note` remains participant-owned. Shared Group Note belongs only to `group_events`; the partial UNIQUE index enforces one child per event/contact pair. See [Group Events](group-events.md) for the full parent schema.

All log data lives in local SQLite. A touchpoint is distinct from a lifecycle event: only qualifying interaction rows can advance a contact's maintained `last_contact`.

**Tables:**
- `interactions` — editable touchpoints belonging to one contact.
  - `uid` (`TEXT`) — stable interaction identity.
  - `contact_id` (`INTEGER`) — owning contact.
  - `occurred_at` / `recorded_at` (`TEXT`) — local wall-clock time of the touchpoint and immutable log time.
  - `channel` (`TEXT`) — the migrated user-facing vocabulary `Message`, `Call`, or `In Person`, with `other`/`unspecified` retained as representable legacy values. The SQL column keeps the name `channel` (values migrate, the column name does not — a locked invariant so backup round-trips).
  - `direction` (`TEXT`, nullable) — `outbound`, `inbound`, or `mutual`.
  - `connected` (`INTEGER`) — whether the touchpoint connected; it controls qualifying recency for Rarely-responds contacts.
  - `quality` (`TEXT`, nullable) — the Tone vocabulary `Positive`, `Neutral`, or `Negative` when refined (`NULL` when unset; omitted ≠ Neutral). The SQL column keeps the name `quality` though its user-facing label is Tone.
  - `duration` (`INTEGER`, nullable) — optional interaction length in canonical seconds; absent → `NULL`, never `0`. Descriptive only — it never affects Status, Gravity, or Intensity, and Quick Log never sets it.
  - `allow_ai` (`INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1))`) — the durable per-interaction AI-egress consent gate, defaulting OFF (see `ai-suggestions.md`).
  - `note` (`TEXT`, nullable) — local timeline detail.
  - `source` (`TEXT`) — `manual`, `widget`, `notification`, `ai`, or `assist` creation route (free text, no CHECK constraint).
- `events` — immutable, read-only lifecycle history.
  - `uid` (`TEXT`) — stable event identity.
  - `contact_id` (`INTEGER`) — owning contact.
  - `type` (`TEXT`, CHECK-less) — `archive`, `restore`, `snooze`, `unsnooze`, `bind`, or `unbind`. Because the column has no `CHECK`, adding the `bind`/`unbind` moments is a TypeScript union change with no migration.
  - `occurred_at` / `recorded_at` (`TEXT`) — local wall-clock event and immutable record times.
  - `detail` (`TEXT`, nullable) — event-specific display detail.

**Types** (`src/db/recency-dao.ts`, `src/db/timeline-read.ts`, and `src/db/events-dao.ts`):
- `RecordTouchpointInput` / `EditTouchpointFullInput` — scoped mutable touchpoint write contracts, now carrying optional `duration` and `allow_ai`.
- `TimelineItem` — discriminated union of editable touchpoints and read-only events.
- `RecordEventInput` — immutable lifecycle event input.
- `EventType` — `archive | restore | snooze | unsnooze | bind | unbind`.

`src/db/interaction-vocabulary.ts` is the single canonical `remapLegacyQuality`/`remapLegacyChannel` map. Migration 025, restore-apply, and `markAssistLogged` all consume it, so no writer can reintroduce a retired value; the migration's frozen CASE arms are test-pinned equal to it but never import it at upgrade time.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Touchpoint writer | `src/db/recency-dao.ts` | Serializes touchpoint writes and remains the sole `last_contact` recomputer. |
| Event writer | `src/db/events-dao.ts` | Provides mutexed and transaction-composed insert-only lifecycle event writes. |
| Timeline read | `src/db/timeline-read.ts` | Reads both tables with a deterministic newest-first `UNION ALL`. |
| Input guard | `src/db/log-guards.ts` | Rejects malformed or future local occurrence times before writes. |
| Impact read | `src/db/impact-read.ts` | Supplies the shared read snapshot for gravity and intensity. |
| Derived service | `src/services/impact.ts` | Applies owner-approved gravity and intensity policy without persistence. |

### Key Files

| File | Role |
|---|---|
| `src/db/recency-dao.ts` | Writes, fully edits, or deletes touchpoints and recomputes qualifying recency. |
| `src/db/events-dao.ts` | Insert-only lifecycle event vocabulary and transaction core. |
| `src/db/timeline-read.ts` | Interleaves event and touchpoint history deterministically. |
| `src/db/log-guards.ts` | Enforces future-date rejection before a write transaction. |
| `src/db/impact-read.ts` | Reads contact policy and history for both derived quantities. |
| `src/services/impact.ts` | Orchestrates gravity and intensity from a shared snapshot. |
| `src/services/gravity-logic.ts` | Computes floor-bounded familiarity tiers. |
| `src/services/intensity-logic.ts` | Computes outbound/mutual neutral rate and trailing cadence. |
| `src/services/quick-log-command.ts` | Runs the shared commit-truthful Quick Log command, including single-flight Retry and Undo feedback. |
| `src/db/bulk-actions-dao.ts` | Composes atomic multi-contact Quick Log, Undo, and archive paths from transaction-owned cores. |
| `src/components/TimelineRow.tsx` | Renders touchpoints as editable and events as read-only. |
| `src/components/TouchpointRefineForm.tsx` | Controls optional touchpoint-detail refinement. |
| `src/components/GravityBar.tsx` | Displays a named gravity tier without a raw score. |
| `src/components/IntensityLine.tsx` | Displays neutral intensity and trailing cadence. |
| `src/screens/ContactProfileScreen.tsx` | Hosts one-tap logging, history correction, and profile-only impact views. |
| `src/db/group-events-dao.ts` | Composes ordinary child mutations within atomic Group Event operations. |

## How It Works

### Logging and refining a touchpoint

1. The profile's one-tap action creates an outbound, connected, `unspecified`-channel manual touchpoint.
2. `recordTouchpoint()` rejects a future `occurred_at`, opens the serialized transaction, inserts the row, and recomputes qualifying `last_contact`.
3. The profile reloads its status, timeline, and impact views together.
4. The user can open `TouchpointRefineForm` to correct channel, direction, connection, quality, note, and local date/time; `editTouchpointFull()` writes every editable column then recomputes recency.
5. Deletion is explicitly confirmed, permanently removes the row, and recomputes recency.

### Quick Logging from the shell

1. The universal FAB and Dashboard List right-swipe action both select the current Profile contact or canonical picker as needed, then run `runQuickLog()` with the established outbound, connected, manual, unspecified-channel defaults.
2. The shared command shows success and Undo only after `recordTouchpoint()` resolves. Undo calls `deleteTouchpoint()` with both the interaction and contact IDs; a failed write or undo shows retryable feedback rather than a false success.
3. The command publishes browse and widget refreshes only after a committed write or delete. Its single-flight guards prevent a rapid tap or swipe from creating or deleting more than one row.

### Quick Logging and archiving a Dashboard selection

1. Dashboard Card View validates a selection, then `bulkQuickLog()` opens one transaction and writes one canonical outbound, connected, manual, unspecified-channel interaction per selected contact.
2. The composer runs `insertInteractionCore()` and `recomputeLastContactCore()` for each row, returns the exact interaction receipt, and bumps data revision once. Undo composes `deleteInteractionCore()` for that receipt in one transaction, so it cannot remove another batch's history.
3. `bulkArchive()` invokes the guarded archive core for every selected contact in its one transaction. Each archive receives its immutable event; a failed ID rolls the entire batch back.

### Recording notification actions

1. The shared notification action handler routes Mark contacted through `recordTouchpoint()` with `source='notification'`, `direction='outbound'`, `channel='unspecified'`, `connected=1`, and `quality=NULL`.
2. Snooze and Clear use the snooze DAO, which composes `recordEventCore()` inside its one write transaction to append `snooze` or `unsnooze` history.
3. Deterministic action UIDs make a re-delivered notification response collide harmlessly with the existing unique event or interaction row.

### Recording a widget mark

1. A headless `WIDGET_MARK` validates its contact ID, opens and migrates SQLite, and calls `widgetMarkContacted()`.
2. That seam delegates to `recordTouchpoint()` with `source='widget'`, outbound, connected, unspecified-channel defaults, and `quality=NULL`.
3. Each genuine widget tap receives a fresh UID and produces a complete interaction row; the renderer refreshes only after this serialized write commits.

### Recording an assist confirmation

1. When the user confirms an Interaction Assist banner, `markAssistLogged` (`src/db/interaction-assist-dao.ts`) re-reads the assist row inside one transaction and writes a single interaction with `source='assist'`, `direction='outbound'`, the assist's original `handoff_at` as `occurred_at`, and `connected=1` (Call Yes, Text/Email Yes) or `connected=0` (Call No answer).
2. It composes `insertInteractionCore` + `recomputeLastContactCore` (`src/db/data-revision-dao.ts`) directly rather than the `recordTouchpoint()` wrapper, so the insert, the recency recompute, and the assist status flip commit atomically — but recency still advances only through the same sole recomputer.
3. A `Don't log` outcome writes no interaction and leaves `last_contact` untouched. See `interaction-assist.md`.

### Reading history and lifecycle events

1. Archive and restore update contact lifecycle state only when their state guard matches.
2. The same transaction records an immutable event through `recordEventCore()`.
3. `bindContact`/`unbindContact` (Contacts subsystem) likewise compose one insert-only `recordEventCore()` inside their already-open transaction — never a nested transaction, since the write mutex is non-reentrant — emitting a `bind` or `unbind` event at the moment of the cadence change.
4. `listTimeline()` returns touchpoints and events newest first, ordering ties by id and kind.
5. `TimelineRow` permits touchpoint refinement/deletion but keeps events read-only. The History & Insights Detail Sheet is now the profile's live lifecycle-event surface and consumes the shared `EVENT_LABELS` (with the new Bound/Unbound labels) exported from `TimelineRow`; see `interaction-history.md`.

### Restoring interaction history

1. Portable reconciliation treats an interaction UID and timestamp as the conflict boundary; a tombstone wins an equal timestamp.
2. A restored interaction cannot write unless its contact survives reconciliation.
3. After restore commits, the recency DAO recomputes `last_contact` from the resulting interaction rows.

### Deriving gravity and intensity

1. `getImpactInputs()` reads a contact's interval, Rarely-responds policy, and touchpoints once.
2. `computeContactGravity()` filters non-connected rows for Rarely-responds contacts, then sums age-decayed weights into a named tier.
3. `computeContactIntensity()` uses the same connection scope, counts outbound/mutual rows over the contact interval, and sorts qualifying history ascending for trailing cadence.
4. The profile presents both values together; neither produces a database write or appears on the dashboard card.

### Group-linked canonical interactions

An Interaction may reference `group_events` through nullable `group_event_id`, with exactly three follow flags for Channel, Tone/quality, and Duration. It remains the participant’s one canonical touchpoint, containing resolved ordinary values and its own note. A Group Event parent contributes no extra History or metric count; an empty event has no recency effect.

`createGroupEvent` and `addParticipants` compose `insertInteractionCore` and `recomputeLastContactCore` for each contact. `updateGroupEvent` and `saveParticipantEdits` compose `editTouchpointFullCore`; child deletion uses `deleteInteractionCore`. All run under the Group Event operation’s single transaction, with one trailing revision bump. Linked timestamps follow the authoritative event date/time through the future-date guard. Group Note remains separately owned parent context, never merged into `interactions.note` or authorized for AI by a child toggle.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `HALF_LIFE_DAYS` | `365` | `src/services/impact.ts` | Gravity's owner-approved age-decay half-life. |
| `FLOOR_W` | `0.15` | `src/services/impact.ts` | Minimum weight retained by old interactions. |
| `GRAVITY_TIERS` | thin, building, solid, deep | `src/services/impact.ts` | Named, non-gamified gravity presentation tiers. |
| `ROGUE_K` | `3` | `src/db/status.ts` | Shared overdue multiple used by the related status system. |

## Decisions

- **ADR-010:** Single-Writer Interaction Recency Spine — supplies the one maintained recency write path used by touchpoint mutations.
- **ADR-023:** Structured Touchpoints and One-Tap Defaults — preserves independent interaction axes and explicit fast-path defaults.
- **ADR-082:** Universal Capture FAB, Canonical Picker, and Truthful Quick Log — exposes the established fast path from the shell with commit-only feedback and canonical Undo.
- **ADR-099:** Durable Global Dashboard Right-Swipe Action — lets the List choose shared Quick Log or detailed logging from one constrained global preference.
- **ADR-024:** Editable Touchpoint History and Recomputed Recency — makes the timeline the correction path and retains one writer.
- **ADR-025:** Immutable Lifecycle Events in a Unified Timeline — separates event storage while unifying the profile read.
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — shares the connection-policy filter used by impact reads.
- **ADR-027:** Derived Profile-Only Gravity and Intensity — derives two non-stored relationship signals from this history.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — maps notification actions onto the established structured-write contracts.
- **ADR-044:** Headless Widget Actions and Dashboard-Rooted Deep Links — maps widget marks onto the same single-writer contract.
- **ADR-071:** User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer — adds assist confirmation as a new outbound touchpoint writer at handoff time, composing the shared recency cores in one transaction.
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — records interaction deletion evidence and blocks orphan restoration.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — includes interaction history in full-state exports.
- **ADR-103:** Atomic Composed Dashboard Bulk Mutations — preserves recency and immutable-event invariants in Dashboard batch work.

- **ADR-110:** Coherent Local Profile Snapshot and Source-Owned Knowledge Projection — supplies bounded history and impact inputs inside one read snapshot.
- **ADR-111:** Cadence-Guarded Profile Metrics and Composed Relationship Actions — defines the Bound interval and Unbound local-month Profile views.
- **ADR-116:** Value-Remapped Interaction Vocabulary and Optional Descriptive Duration — remaps the stored `quality`/`channel` values to the Tone / Message-Call-In Person vocabulary and adds nullable descriptive `duration` (migration 025), keeping the SQL column names. Partially supersedes ADR-023's value vocabulary.
- **ADR-117:** Per-Interaction Allow-AI Consent Gate — adds the durable `allow_ai` flag (default OFF, fail-closed on restore) to every interaction row.
- **ADR-118:** Bind/Unbind Immutable Lifecycle Events Without a Migration — extends `EventType` and emits insert-only bind/unbind events inside the existing cadence-change transaction.
- **[ADR-011: Query-Time Status and Never-Contacted Segregation](../decisions/ADR-011-query-time-status-and-never-contacted-segregation.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-016: Fixed-First Contact Forms and Atomic Contact Creation](../decisions/ADR-016-fixed-first-contact-forms-and-atomic-contact-creation.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-028: Per-Item Conversational Fuel with Fixed Kinds](../decisions/ADR-028-per-item-conversational-fuel-with-fixed-kinds.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-029: In-Query Fuel Eligibility and a Shared Ranked Projection](../decisions/ADR-029-in-query-fuel-eligibility-and-a-shared-ranked-projection.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-030: Explicit Confirmation of AI-Proposed Fuel](../decisions/ADR-030-explicit-confirmation-of-ai-proposed-fuel.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-033: Profile Marking and Shared Drag-Reordered Favourites](../decisions/ADR-033-profile-marking-and-shared-drag-reordered-favourites.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-036: Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails](../decisions/ADR-036-entry-agnostic-compose-navigation-and-transmittable-fuel-guardrails.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-052: Compose-Owned AI Draft Lifecycle and Acknowledged Egress](../decisions/ADR-052-compose-owned-ai-draft-lifecycle-and-acknowledged-egress.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-061: DAO-Selected Actionable Primary SMS Handoff](../decisions/ADR-061-dao-selected-actionable-primary-sms-handoff.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-072: Shared Actionable Reach Out Router with Native Channel Handoff](../decisions/ADR-072-shared-actionable-reach-out-router-with-native-channel-handoff.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-074: Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe](../decisions/ADR-074-widget-contact-supersession-and-strict-reach-deep-link-fail-safe.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-079: On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation](../decisions/ADR-079-on-demand-ai-transparency-and-compose-only-three-suggestion-invocation.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-108: Durable Independent-Axis Profile Presentation and Inheritance](../decisions/ADR-108-durable-independent-axis-profile-presentation-and-inheritance.md)** — governs `src/db/bulk-actions-dao.ts`.
- **[ADR-109: Fixed-Hero Semantic Profile Composition and Focused Accessible Editors](../decisions/ADR-109-fixed-hero-semantic-profile-composition-and-focused-accessible-editors.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-114: Route-Aware App-Wide System Background Composition](../decisions/ADR-114-route-aware-app-wide-system-background-composition.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-120: Shared-Window Heatmap and Intensity with Globally-Persisted Lenses](../decisions/ADR-120-shared-window-heatmap-and-intensity-with-persisted-lenses.md)** — governs `src/components/IntensityLine.tsx`.
- **[ADR-122: Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet Through the Sole Recency Writer](../decisions/ADR-122-canonical-interaction-detail-edit-and-shared-detail-sheet.md)** — governs `src/components/TimelineRow.tsx`, `src/db/recency-dao.ts`.
- **[ADR-123: Profile History Section Replacing the Vertical Timeline, with Detailed-Log Backfill Routing](../decisions/ADR-123-profile-history-section-replacing-the-vertical-timeline.md)** — governs `src/screens/ContactProfileScreen.tsx`.
- **[ADR-124: Group Event Parents with Canonical Per-Contact Children](../decisions/ADR-124-group-event-parents-with-canonical-per-contact-children.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-125: Three-Field Live Inheritance with Separate Local-Only Group Notes](../decisions/ADR-125-three-field-live-inheritance-with-separate-local-only-group-notes.md)** — governs `src/db/group-events-dao.ts`.
- **[ADR-126: Explicit Group Lifecycle and Identity-Preserving Conversion](../decisions/ADR-126-explicit-group-lifecycle-and-identity-preserving-conversion.md)** — governs `src/db/group-events-dao.ts`.
- **[ADR-129: Portable Group Identity and History-Preserving Orphan Disposition](../decisions/ADR-129-portable-group-identity-and-history-preserving-orphan-disposition.md)** — governs `src/db/group-events-dao.ts`.

## Gotchas

1. **The full History & Insights surface has replaced the interim bounded read.** Phase 31's bounded Profile snapshot timeline is superseded — `ProfileModuleHost.renderHistory()` now mounts the complete History section (Heatmap, Intensity, Rolodex, Detail Sheet). The canonical single-contact read is `src/db/history-read.ts`; see `interaction-history.md`. `timeline-read.ts` remains only for other consumers (e.g. fuel).
2. **Unbound activity is not cadence-relative.** Profile Intensity uses the current local calendar month and labels it `This month` when active cadence is unavailable.

1. **Use local wall-clock strings.** Never convert a user-entered interaction time through `toISOString()`; it can change the recorded day.
2. **Do not add a second recency writer.** Every touchpoint mutation must recompute through `recency-dao`.
3. **Treat events as immutable.** `events-dao` has no update path; record a new event rather than altering history.
4. **Keep timeline identity prefixed by kind.** Event and touchpoint IDs can collide across tables.
5. **Sort cadence inputs ascending.** The DAO returns newest-first rows, which would otherwise produce negative gaps.
6. **Do not turn snooze into a touchpoint.** It is a lifecycle event and must not advance `last_contact` or alter derived relationship status.
7. **Do not bypass the recency DAO from a widget task.** A raw `last_contact` update or nested transaction breaks the serialized history/summary invariant.
8. **Do not import a recency summary.** Restore derives `last_contact` from the reconciled interaction set after its write transaction.
9. **The assist path still recomputes through the sole recomputer.** `markAssistLogged` composes `insertInteractionCore`/`recomputeLastContactCore` directly instead of `recordTouchpoint()` (to run inside its in-transaction re-read), but it must never write `last_contact` itself — the single-writer invariant is preserved by reusing `recomputeLastContactCore`.
10. **Quick Log success is transaction truth, not an optimistic UI state.** Do not expose Undo or a success haptic until `recordTouchpoint()` resolves, and keep Retry/Undo single-flight.
11. **List swipe must use the shared command.** A List-specific direct touchpoint write would drift from the FAB's haptic, Undo, Retry, and refresh guarantees.
12. **A Dashboard batch must compose cores, not SQL shortcuts.** A direct batch interaction insert leaves recency stale, and a direct archive update omits immutable history.
13. **Bulk Undo is receipt-scoped.** Use the exact interaction receipt from the committed batch; the single-contact Undo controller cannot reverse an N-contact write.
14. **Never rename the `quality`/`channel` SQL columns.** Their values are the Tone / Message-Call-In Person vocabulary but the column names are a locked invariant so export/restore round-trip without a backup-format bump. Do not "fix" the mismatch by renaming to `tone`.
15. **Route every `quality`/`channel` literal comparison through `interaction-vocabulary.ts`.** A new reader that compares against the retired `good/fine/hard` or `text/email` values silently miscounts (the D-06 trip-wire). AI-context and digest were lockstepped in the migration commit for exactly this reason.
16. **`allow_ai` defaults OFF and restore is fail-closed on both paths.** A fresh insert takes the column `DEFAULT 0`; the merge/update arm must explicitly set `allow_ai=0` (SQLite's `DEFAULT` fires only on fresh INSERT). Never ship a serializer that could restore an interaction more AI-permissive than the backup.
17. **`duration` is descriptive only.** Persist canonical seconds, present minutes/hours, show it only when present, and never feed it into Status, Gravity, or Intensity.
18. **Bind/unbind events write inside the cadence transaction.** The producer composes `recordEventCore()` within the existing bind/unbind transaction (non-reentrant mutex), never after it, and the events are immutable like every other lifecycle event.

- **Parent removal and child removal differ.** Direct child deletion removes only that participant. Dissolve detaches all children; full event deletion removes all linked children. The parent can remain valid with no participants.

## Related Systems

- **Contacts** — owns contact policy, lifecycle transitions, and the materialized `last_contact` value.
- **Status engine** — derives rogue status and reason from qualifying recency.
- **App shell** — supplies the theme tokens used by the rogue and gravity profile presentation.
- **Notifications** — supplies the foreground and headless action paths that use these writers.
- **Widget** — supplies a separate headless one-tap source with the same DAO-owned write invariant.
- **Backup & Restore** — exports interactions and applies them only after their contact survives UID reconciliation.
- **Interaction Assist & Reach Out** — confirmation writes an `source='assist'` outbound touchpoint at the original handoff time through the shared recency cores.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-15 | 06 | Created structured touchpoint logging, lifecycle history, and profile-only derived impact views. |
| 2026-08-16 | 11 | Added notification-sourced one-tap writes and durable snooze/unsnooze event producers. |
| 2026-08-16 | 12 | Added widget-sourced headless one-tap writes through the existing recency DAO. |
| 2026-08-24 | 17 | Added interaction deletion tombstones and restored-history recency recomputation. |
| 2026-08-31 | 21 | Added assist confirmation as a new touchpoint writer (`source='assist'`, outbound, handoff-time `occurred_at`, connected per Call outcome) composing the shared recency cores in one transaction. |
| 2026-09-02 | 22 | Added shell Quick Log as a guarded consumer of the existing canonical insert/delete paths. |
| 2026-09-02 | 27 | Extracted the shared Quick Log command for Dashboard List gestures while retaining commit-only feedback and the sole recency writer. |
| 2026-09-02 | 28 | Added atomic Dashboard batch logging, receipt-scoped Undo, and archive event fan-out through composed cores. |
| 2026-09-02 | 31 | Added snapshot-compatible impact reads, bounded interim Profile history, and the shared no-cadence calendar-month activity contract. |
| 2026-09-02 | 32 | Migration 025 remapped the stored `quality`/`channel` values to the Tone / Message-Call-In Person vocabulary (column names kept), added nullable descriptive `duration`, and added the default-OFF `allow_ai` consent gate; added `bind`/`unbind` immutable lifecycle events (no migration); single-sourced the vocabulary in `interaction-vocabulary.ts`. The full History & Insights surface replaced the interim bounded Profile timeline. |
| 2026-09-02 | 33 | Documented canonical Group Event children, three-field inheritance, parent-only note ownership, and recency-safe lifecycle composition. |
