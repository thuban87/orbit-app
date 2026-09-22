# Group Events

**Last updated:** 2026-09-02
**Updated by phase:** 38-your-week
**Owners:** `src/db/group-events-dao.ts`, `src/db/group-events-read.ts`, `src/logic/group-inheritance.ts`, `src/screens/GroupLogScreen.tsx`, `src/screens/GroupEventDetailScreen.tsx`

## Purpose

Group Events let the user record one shared social encounter once while preserving one ordinary Interaction per participating contact. They support event-first capture with zero participants, independent participant refinements, and local browsing and management without duplicating contact history or derived metrics.

## Architecture

### Data Model

All records live in on-device SQLite. Migration 026 adds the parent and nullable child-linkage columns after the ordinary interaction vocabulary, duration, and permission schema.

**Tables:**
- `group_events` — durable encounter parent.
  - `id` (`INTEGER PRIMARY KEY`) — device-local identity.
  - `uid` (`TEXT NOT NULL UNIQUE`) — durable identity.
  - `title` (`TEXT NOT NULL`) — required nonblank title, validated by the writer.
  - `occurred_at` (`TEXT NOT NULL`) — authoritative local event date/time; future completed events are rejected.
  - `channel` / `quality` (`TEXT`, nullable) — shared Channel and Tone defaults.
  - `duration` (`INTEGER`, nullable) — optional duration in whole seconds.
  - `group_note` (`TEXT`, nullable) — one distinct shared note, never AI-eligible.
  - `created_at` / `modified_at` (`TEXT NOT NULL`) — local metadata.
- `interactions` — ordinary participant-owned canonical child.
  - `group_event_id` (`INTEGER`, nullable) — parent reference with `ON DELETE SET NULL`.
  - `ge_follow_channel`, `ge_follow_quality`, `ge_follow_duration` (`INTEGER`, nullable) — explicit follow state: `1` follows, `0` overrides, `NULL` accompanies standalone linkage.
  - Ordinary values remain resolved on the child; Direction, Connected, note, and Allow-AI remain child-owned.
- `idx_group_member_unique` — partial UNIQUE index on `(group_event_id, contact_id)` where the parent link is non-NULL.
- `tombstones` — durable `group_event` evidence on parent dissolve/delete.

**Types:**
- `CreateGroupEventInput`, `UpdateGroupEventInput`, `AddParticipantsInput`, `SaveParticipantEditsInput` (`src/db/group-events-dao.ts`) — caller drafts for transaction-owned mutations.
- `GroupEventDetail`, `GroupEventParticipant` (`src/db/group-events-read.ts`) — local presentation shapes including the actual child `allowAi` value.
- `InheritableGroupField` (`src/logic/group-inheritance.ts`) — exactly `channel`, `quality`, and `duration`.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Writer | `src/db/group-events-dao.ts` | Creates/edits parents and children, membership, lifecycle, and conversion under one outer transaction per operation. |
| Read | `src/db/group-events-read.ts` | Parameter-bound parent browse/search/detail and ordinary child participant projections. |
| Pure logic | `src/logic/group-inheritance.ts` | Follow-versus-override display and selective fan-out targets. |
| Recency | `src/db/recency-dao.ts` | Non-mutexed canonical interaction cores and `last_contact` recomputation. |
| Picker logic | `src/components/contact-picker-multiselect.ts` | Ordered selection, exclusions, and awaited owner outcomes. |
| Presentation logic | `src/screens/group-event-detail-logic.ts` | Shared seconds-aware duration label and truthful child Detail projection. |

No Group Event Zustand store or background scheduler is required; screens hold unsaved local drafts and reads use SQLite.

### Key Files

| File | Role |
|---|---|
| `src/db/migrations/026-group-events-schema.ts` | Parent/link/follow schema and membership index. |
| `src/db/group-events-dao.ts` | Atomic persistence and lifecycle surface. |
| `src/db/group-events-read.ts` | Local browse, literal-safe search, and participant Detail reads. |
| `src/logic/group-inheritance.ts` | Three-field follow/override rules. |
| `src/logic/group-log-participant-inputs.ts` | Distinct child UID builder. |
| `src/screens/GroupLogScreen.tsx` | Required-title event-first create form and discard guard. |
| `src/screens/EditGroupEventScreen.tsx` | Shared-value/date/note editing and saved-participant additions. |
| `src/screens/EditParticipantScreen.tsx` | Participant-scoped save route. |
| `src/screens/GroupEventsScreen.tsx` | Reverse-chronological local browse and search. |
| `src/screens/GroupEventDetailScreen.tsx` | Presentation-first parent and virtualized participant cards. |
| `src/screens/group-event-detail-logic.ts` | Child consent read-through and whole-second duration display. |
| `src/components/group/ParticipantOverrideEditor.tsx` | Restricted child controls and Follow event affordances. |
| `src/components/group/ParticipantCard.tsx` | Compact participant rows and scoped overflow. |
| `src/components/group/RemoveParticipantSheet.tsx` | Delete / Keep individual / Cancel intent. |
| `src/components/group/GroupTitlePromptSheet.tsx` | Nonblank conversion-title entry. |
| `src/components/ContactPicker.tsx` | Canonical multi-select Modal with awaited Done. |
| `src/db/recency-dao.ts` | Canonical child mutation and recency cores. |
| `src/db/tombstones-dao.ts` | Fetched-UID parent deletion evidence. |

## How It Works

### Event-first capture

1. Universal FAB → Group Log opens `GroupLogScreen`; Dashboard multi-select can preload `participantIds` into the same form.
2. The draft requires title/date/time but permits no participants. Channel starts In Person; Tone and Duration are unset regardless of the ordinary channel preference.
3. The shared multi-select picker gathers contacts; archived contacts appear through explicit search and snoozed contacts remain selectable. No product participant cap exists.
4. `toGroupParticipantInputs` mints distinct child UIDs; Save calls `createGroupEvent` once with a distinct parent UID.
5. The transaction inserts the parent, then each canonical child via `insertInteractionCore` and `recomputeLastContactCore`, and bumps revision once. An empty event creates no children.
6. Save failure leaves draft input intact. The initial timestamp and dirty baseline share one seed so mount timing cannot manufacture unsaved changes.

### Live inheritance and participant edits

1. `resolveDisplay` uses each explicit follow flag rather than comparing values for equality.
2. A shared Channel/Tone/Duration edit changes only followers; an event timestamp edit changes every linked child.
3. `updateGroupEvent` composes full-edit recency cores inside one transaction, retaining untouched child fields and Allow-AI state. Group Note edits update only the parent.
4. `ParticipantOverrideEditor` exposes Channel, Tone, Duration, Direction, Connected, and participant note. Title/date and Group Note are not participant-editable.
5. Follow event clears an override and resumes live inheritance. `EditParticipantScreen` invokes `saveParticipantEdits` once so ordinary values and follow flags commit together.

### Adding saved participants

1. Edit or Detail excludes existing members from the same canonical picker.
2. Done invokes `addParticipants` once. The transaction re-reads current parent/membership state and rejects duplicate contacts before inserting children.
3. New children use current parent shared values, the event’s occurrence timestamp, and all three follow flags set to `1`.
4. A late child failure rolls back every child, recency change, and revision increment. Success awaits one reload before picker cleanup; rejection preserves the Modal, selection, and visible error.
5. Archived contacts’ recency advances without restoration; they remain archived.

### Browsing, inspecting, and choosing edit scope

1. The Events root opens `GroupEventsScreen`. `listGroupEvents` sorts newest occurrence first with a deterministic ID tie-break.
2. `searchGroupEvents` binds an escaped literal LIKE term against title and participant name; EXISTS prevents duplicate parent rows.
3. Detail shows shared fields and compact participant cards. Card tap opens that child’s canonical Interaction Detail with its own note plus distinctly labeled Group Note.
4. `buildGroupEventDetailInteraction` preserves the stored child Allow-AI state; duration display uses `formatDurationLabel` through the Detail helper.
5. Group-linked Edit asks individual versus Group Event scope. Detail and focused editors are registered in the Events stack and every profile-hosting stack that can preserve an origin-local return.
6. Parent records never enter contact aggregation as extra interactions; contact consumers continue reading child rows only.

### Contributing to Digest activity

1. Digest reads a Group Event parent as one event record for metrics, heatmap activity, and selected-day detail.
2. Its aggregate excludes linked child interactions from event activity, preventing one event from appearing once per participant.
3. Unique non-archived participants may still contribute to the separate People reached metric; this read never changes canonical Group Event persistence.

### Removing, dissolving, deleting, and converting

1. Saved participant removal asks Delete interaction / Keep as individual interaction / Cancel. Draft removal needs no persisted lifecycle operation.
2. `deleteGroupChild` removes only the scoped child through the recency deletion core. `detachParticipant` preserves resolved values and participant note while clearing parent/follow state together.
3. Confirmed `dissolveGroupEvent` detaches all children, removes parent/shared note, and records the parent’s fetched UID tombstone. Group Note is never copied into child prose.
4. Confirmed `deleteGroupEventAndInteractions` permanently removes linked children through recency cores and then the parent, with tombstones and one revision increment in the same transaction.
5. A parent with no children remains valid. Contact purge removes its own children, never unrelated Group Event parents.
6. `convertInteractionToGroupEvent` checks a contact-scoped standalone source in the transaction, creates a title-bearing parent seeded from the original values, and links the original child in place without changing its ID/UID.

### Portable identity handoff

The phase’s portability contract uses parent UIDs, parent-before-child mapping, and all three follow flags. The locked orphan outcome preserves a valid child as standalone with link/follow state cleared together. Full wire/restore implementation is assigned to the coordinated later backup phase. The Phase-33 format-4 exporter temporarily omits unsupported parent tombstones while keeping them durable locally; that boundary does not claim completed Group Event portability.

## Configuration

| Setting | Value | File | Purpose |
|---|---|---|---|
| `GROUP_EVENTS_SCHEMA_VERSION` | `26` | `src/db/migrations/026-group-events-schema.ts` | Strict additive schema version. |
| Initial Channel | `In Person` | `src/screens/GroupLogScreen.tsx` | Exempts Group Log from ordinary channel preference. |
| Initial Tone / Duration | `null` / `null` | `src/screens/GroupLogScreen.tsx` | No guessed descriptive values. |
| Follow fields | Channel / Tone / Duration | `src/logic/group-inheritance.ts` | Exactly three inheritable field classes. |
| Participant cap | None | `src/components/ContactPicker.tsx` | Searchable, virtualized selection. |

## Decisions
- **[ADR-010: Single-Writer Interaction Recency Spine](../decisions/ADR-010-single-writer-interaction-recency-spine.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-011: Query-Time Status and Never-Contacted Segregation](../decisions/ADR-011-query-time-status-and-never-contacted-segregation.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-016: Fixed-First Contact Forms and Atomic Contact Creation](../decisions/ADR-016-fixed-first-contact-forms-and-atomic-contact-creation.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-023: Structured Touchpoints and One-Tap Defaults](../decisions/ADR-023-structured-touchpoints-and-one-tap-defaults.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-024: Editable Touchpoint History and Recomputed Recency](../decisions/ADR-024-editable-touchpoint-history-and-recomputed-recency.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-026: Rogue Status for Unresponsive or Far-Overdue Contacts](../decisions/ADR-026-rogue-status-for-unresponsive-or-far-overdue-contacts.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-056: Tombstone-Backed UID Reconciliation for Portable Restores](../decisions/ADR-056-tombstone-backed-uid-reconciliation-for-portable-restores.md)** — governs `src/db/tombstones-dao.ts`.
- **[ADR-060: Versioned Portable Method Graph and Collision-Normalized Restoration](../decisions/ADR-060-versioned-portable-method-graph-and-collision-normalized-restoration.md)** — governs `src/db/tombstones-dao.ts`.
- **[ADR-082: Universal Capture FAB, Canonical Picker, and Truthful Quick Log](../decisions/ADR-082-universal-capture-fab-canonical-picker-and-truthful-quick-log.md)** — governs `src/components/ContactPicker.tsx`, `src/db/recency-dao.ts`.
- **[ADR-103: Atomic Composed Dashboard Bulk Mutations](../decisions/ADR-103-atomic-composed-dashboard-bulk-mutations.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-116: Value-Remapped Interaction Vocabulary and Optional Descriptive Duration](../decisions/ADR-116-value-remapped-interaction-vocabulary-and-descriptive-duration.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-117: Per-Interaction Allow-AI Consent Gate, Default-Off and Fail-Closed on Restore](../decisions/ADR-117-per-interaction-allow-ai-consent-gate.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-122: Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet Through the Sole Recency Writer](../decisions/ADR-122-canonical-interaction-detail-edit-and-shared-detail-sheet.md)** — governs `src/db/recency-dao.ts`.
- **[ADR-124: Group Event Parents with Canonical Per-Contact Children](../decisions/ADR-124-group-event-parents-with-canonical-per-contact-children.md)** — governs `src/db/group-events-dao.ts`, `src/db/migrations/026-group-events-schema.ts`, `src/db/recency-dao.ts`.
- **[ADR-125: Three-Field Live Inheritance with Separate Local-Only Group Notes](../decisions/ADR-125-three-field-live-inheritance-with-separate-local-only-group-notes.md)** — governs `src/components/group/ParticipantOverrideEditor.tsx`, `src/db/group-events-dao.ts`, `src/db/migrations/026-group-events-schema.ts`, `src/logic/group-inheritance.ts`.
- **[ADR-126: Explicit Group Lifecycle and Identity-Preserving Conversion](../decisions/ADR-126-explicit-group-lifecycle-and-identity-preserving-conversion.md)** — governs `src/components/group/GroupTitlePromptSheet.tsx`, `src/components/group/RemoveParticipantSheet.tsx`, `src/db/group-events-dao.ts`, `src/db/tombstones-dao.ts`.
- **[ADR-127: Canonical Event-First Group Logging and Explicit Child Edit Scope](../decisions/ADR-127-canonical-event-first-group-logging-and-explicit-child-edit-scope.md)** — governs `src/components/ContactPicker.tsx`, `src/db/group-events-read.ts`, `src/screens/EditGroupEventScreen.tsx`, `src/screens/EditParticipantScreen.tsx`, `src/screens/GroupEventDetailScreen.tsx`, `src/screens/GroupEventsScreen.tsx`, `src/screens/GroupLogScreen.tsx`, `src/screens/group-event-detail-logic.ts`.
- **[ADR-128: Same-Group Contact Merge Refusal with Remediation](../decisions/ADR-128-same-group-contact-merge-refusal-with-remediation.md)** — governs `src/db/migrations/026-group-events-schema.ts`.
- **[ADR-129: Portable Group Identity and History-Preserving Orphan Disposition](../decisions/ADR-129-portable-group-identity-and-history-preserving-orphan-disposition.md)** — governs `src/db/group-events-dao.ts`, `src/db/tombstones-dao.ts`.
- **ADR-148:** Portable Your Week Period and Group-Deduplicated Activity Aggregation — projects each parent as one Digest event while leaving participant child history canonical.

## Gotchas

1. **Do not nest mutex-owning writers.** Compose recency cores within the one Group Event transaction; the write mutex is non-reentrant.
2. **Follow state is not value equality.** An explicit override equal to today’s parent value remains detached until Follow event is chosen.
3. **FK cleanup is incomplete by itself.** SET NULL clears the link only; lifecycle/orphan handling must clear all three follow flags together.
4. **Group Note has no AI permission equivalent.** It remains parent-only local context under every participant Allow-AI state, including detachment and dissolve.
5. **Atomic saved additions were repaired.** Initial per-contact transactions could leave a committed prefix on failure. One batch plus awaited picker outcome now preserves rollback and visible retry state.
6. **Detail units and consent were repaired.** Initial raw seconds/minutes display and static consent were replaced with the shared formatter and stored child permission read-through.
7. **Do not reconcile a merge collision silently.** Same-event duplicate contacts require typed refusal and explicit membership remediation.
8. **Native verification has limits.** Final Pixel UAT records three passes. Its long-content case has three participants; this is not large-list performance evidence. The phase’s full suite had an unrelated Orrery parser failure despite passing targeted checks.
9. **Do not use participant children as Digest event rows.** The aggregate must count the Group Event parent once; participant identity belongs only in People reached semantics.

## Related Systems

- **[Interaction log](interaction-log.md)** — owns canonical child touchpoints and the sole recency spine.
- **[Interaction history](interaction-history.md)** — presents local group context and explicit child/event edit scope.
- **[Contacts](contacts.md)** — owns participant identity, archive state, and contact purge.
- **[Contact reconciliation](contact-reconciliation.md)** — refuses same-event membership collisions losslessly.
- **[Contacts](dashboard.md)** and **[App shell](app-shell.md)** — provide preloaded capture, shared picker, and stack registrations.
- **[Digest](digest.md)** — aggregates each parent once for Your Week while preserving child history elsewhere.
- **[Backup & restore](backup-restore.md)** — consumes the deferred stable-UID entity and orphan contract.
- **[AI suggestions](ai-suggestions.md)** — cannot authorize Group Note egress.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-09-02 | 33 | Introduced event-first Group Event parents, canonical children, live inheritance, explicit lifecycle/scope, local browse/detail, atomic saved additions, and portability handoff. |
| 2026-09-02 | 38 | Documented the read-only Your Week parent-once activity projection and Events-detail Profile return path. |
