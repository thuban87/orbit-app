# Phase 32: Interaction History & Insights - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Replace the app's weak chronological timeline with a dedicated temporal relationship-history experience reached from the Contact Profile: an interaction Activity Heatmap, an Intensity chart sharing the same selected time window, and a Rolodex-style History Browser for precise date navigation — plus a canonical Interaction Detail surface, a new Edit Interaction route, optional interaction duration, and reusable temporal aggregation seams for future analytics.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01 [informational]:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02 [informational]:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** Per-interaction **Allow AI** defaults **OFF** (E-05, owner resolution). This phase consumes the toggle in two places: Interaction Detail shows a restrained sparkle when ON and nothing when OFF; Edit Interaction can change it (so a note allowed in error can be withdrawn, or a withheld note later permitted). Today AI context reads only `channel, quality, connected` and never a note (`src/db/ai-context-read.ts:114-120`) — the gate must exist before any note is transmitted. **Trip-wire:** shipping the toggle default-ON, or letting a Group Note through, reverses an owner decision — stop and ask. Group Notes are never transmitted to AI and get no toggle (ADR-078).
- **D-05:** Every group-linked edit and delete must still route through `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore` (`src/db/recency-dao.ts:159-214,258-346`), composing the cores inside **one transaction** (R-02). The write mutex is non-reentrant; any set-based write to `interactions` that bypasses the recency cores is a correctness bug, not an optimization (ADR-010 / ADR-024 / ADR-071). Read every writer of `interactions` and `contacts.last_contact` before asserting an invariant — the graph cannot enumerate SQL writers.
- **D-06:** Tone replaces Quality and Message/Call/In Person replaces the six-value channel vocabulary — a **real data migration** (R-03): `good→Positive, fine→Neutral, hard→Negative`; `text`/`email`→Message, `call`→Call, `in-person`→In Person, with `other`/`unspecified` kept as legacy representable values. **Trip-wire:** update *every* literal consumer of `quality` (`ai-context-read.ts:130-134`, `digest-read.ts:158-161`, the timeline row renderer, the backup serializer) **with** the migration — a partial rename silently corrupts AI context and digest text. `interaction_assists` is **not** rebuilt; its channel CHECK stays as the transport and is mapped to Message at log time.
- **D-07:** Decide **once** whether this phase or Phase 34 owns the shared `interactions` migration (Tone/channel, nullable `duration` in seconds, per-interaction Allow AI defaulting OFF), with the other consuming it, and coordinate with Phase 33's `group_event_id` column as one strictly ordered sequence — never competing edits to the same table.
- **D-08:** Bind/Unbind lifecycle events do not exist (R-12): `EventType` covers only archive/restore/snooze/unsnooze and `contact-lifecycle-dao.ts:62-98` writes no event. Add the two types with **insert-only producers inside the existing bind/unbind transactions** (ADR-025 — lifecycle events are immutable), and verify the new type strings pass restore validation. No migration is needed (`events.type` has no CHECK) — a TS union plus producers.
- **D-09:** The Cycles lens is undefined for contacts with no cadence (R-15): `interval_days` is nullable and ADR-062 requires every cadence consumer to guard it; Unbound profiles are reachable. Define the fallback **once**, jointly with Phase 31's identical note.
- **D-10:** Heatmap encodes **interaction count only** — lifecycle and other non-interaction records never affect saturation or the context popup, and a Group Event parent is never a second History row and never increments heatmap counts, Intensity, Last Interaction, Status, or Gravity. Deleting a group-linked child removes only that participant's Interaction; group-linked timestamps are event-owned; group-linked Edit requires an explicit individual-vs-group scope prompt (no hybrid editor).
- **D-11:** History lens and cycle-count preset are new durable preferences as `app_settings` columns, portable via the backup manifest, not AsyncStorage (R-16). Interaction deletion stays hard-delete with an explicit irreversible confirmation — no trash or quarantine subsystem is added.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-11-interaction-history-insights-dossier-v0.2-group-events.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-11-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-062-bound-unbound-lifecycle-and-one-way-cadence-assignment.md` — nullable cadence must be guarded by every consumer, including the Cycles lens and Intensity
- `docs/decisions/ADR-025-immutable-lifecycle-events-in-a-unified-timeline.md` — lifecycle events (incl. the new Bind/Unbind types) are immutable and insert-only
- `docs/decisions/ADR-010-single-writer-interaction-recency-spine.md` — all interaction writes go through the single recency spine
- `docs/decisions/ADR-024-editable-touchpoint-history-and-recomputed-recency.md` — edits/deletes recompute recency rather than mutating it directly
- `docs/decisions/ADR-071-user-attested-handoff-time-interaction-logging-through-the-sole-recency-writer.md` — the sole recency writer is the only path for logging, including assists

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: a conventional vertical timeline as a first-class target view (this phase replaces it, it does not polish it); duration-based Gravity/Status/Intensity weighting (duration is descriptive only this milestone); Intensity prediction/forecasting or Heatmap channel encoding; and History search/filtering, batch interaction editing, an interaction trash/quarantine, or account-level analytics dashboards.
</deferred>

---
*Phase: 32-interaction-history-insights*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
