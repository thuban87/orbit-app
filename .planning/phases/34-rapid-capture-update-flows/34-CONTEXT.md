# Phase 34: Rapid Capture & Update Flows - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Deliver Orbit's release-quality ordinary single-contact capture and update workflows — Add Contact, Quick Log, detailed Log Interaction, and Update Contact — optimizing for the smallest reasonable work needed to record or update relationship information while preserving full Edit Contact as a separate administrative surface. It consumes Phase 33's canonical Group Log without redefining Group Event semantics.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** The ordinary Log form **owns** the per-interaction **Allow AI** toggle at capture time, placed with the Note field and shipping **default OFF**, initialized from Phase 36's new-items-only type default (E-05). Today AI context never reads an interaction note, so this gate is what makes any note eligible at all. **Trip-wire:** shipping default-ON, or routing a **Group Note** through the toggle, reverses the owner resolution and widens AI egress — stop and ask. Group Notes are never transmitted to AI regardless of any Allow AI value, including for group-linked children (ADR-078).
- **D-05:** ADR-016's tri-state last-spoke control (today / on date / not yet) **stays** in Add Contact's Relationship Basics, defaulting to "today" (R-13, ESCALATE trip-wire — the streamlined form was silent on it, and dropping it silently is the reversal). "Not yet" must continue to create **no interaction at all** — never an interaction with a null date.
- **D-06:** Channel vocabulary becomes exactly Message / Call / In Person (R-03). `interactions.channel` has no CHECK but `interaction_assists.channel` does, and `markAssistLogged` copies it into `interactions.channel`: the assists CHECK stays as the transport and is **mapped to Message at log time** — no table rebuild. **Trip-wire:** update every literal consumer of `quality` (`ai-context-read`, `digest-read`, timeline rendering, the backup serializer) **with** the migration, not after it; legacy `other`/`unspecified` must stay representable.
- **D-07:** Decide **once** whether this phase or Phase 32 owns the shared `interactions` migration (Tone/channel data migration + per-interaction Allow AI defaulting OFF), with the other consuming it, coordinated with Phase 33's group linkage as one strictly ordered sequence. All interaction writes still go through the single recency spine — `insertInteractionCore` / `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore`, composed inside one transaction (ADR-010 / ADR-024 / ADR-071); no direct or set-based writes to `interactions`.
- **D-08:** Tone offers Positive / Neutral / Negative, is optional, defaults null/unset, and an omitted Tone is **never** silently treated as Neutral. Quick Log writes immediately at the current time, never backdates, and never asks for duration.
- **D-09:** The Default Interaction Channel preference and its remembered value are new durable `app_settings` columns, portable via the backup manifest, not AsyncStorage (R-16). Remembered updates **only after a successful ordinary save** — a cancelled unsaved form never mutates it — and Group Log is exempt and defaults In Person.
- **D-10:** The Bound/Unbound supersession is compatible with ADR-062 (verified against `tracking_enabled`, dormant cadence, and the `contacts_prevent_cadence_clear` trigger) — no finding, but re-verify on disk before touching cadence writes. Phase 24's Contact Knowledge model gates Update Contact and the Memory editor (R-01); do not plan against an unbuilt knowledge model.
- **D-11:** Two owner reconciliation blockers must be settled **before** planning proceeds: the default/general built-in Memory type name (D-13-060 / D-RM-056 / D-13-190), and "Log Contact" vs "Log Interaction" naming (D-13-184, a taste call). Do not fabricate either inside the plan.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-13-rapid-capture-update-flows-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-13-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-016-fixed-first-contact-forms-and-atomic-contact-creation.md` — the tri-state last-spoke control and atomic contact creation; "Not yet" creates no interaction
- `docs/decisions/ADR-078-negative-constraint-off-limits-and-gated-recent-interaction-ai-context.md` — the AI context boundary the per-interaction Allow AI toggle gates; supersedes ADR-050/ADR-036

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: a second multi-contact detailed logging form (Group Event semantics belong to Phase 33); automatic extraction or classification of Memories from interaction notes; a more granular Channel taxonomy (separate Email, SMS, WhatsApp, Video Call); user-defined Tone scales or expanded Tone analytics; and a comprehensive redesign of the Memory type taxonomy.
</deferred>

---
*Phase: 34-rapid-capture-update-flows*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
