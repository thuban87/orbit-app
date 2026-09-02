# Phase 35: Messaging & AI Compose - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Deliver Compose as an AI-assisted drafting workspace with a lightweight external delivery handoff — not an in-app messaging client. It helps the user write manually, optionally recall contact context, optionally draft or rewrite with configured AI, hand the finished composition to the right external app, and afterwards confirm follow-through so Orbit can log the interaction truthfully.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema — no new entity tables, but new `app_settings` columns for the Compose default message mode and its remembered value. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Phase-specific constraints
- **D-04:** The Compose-attached "Did you send it?" confirmation must **coexist with** ADR-070/071's durable assist lifecycle, not replace it (R-14). It is an *additional* surface: the app-global in-app banner and pending-confirmations sheet must stay for assists whose Compose session is gone (process death, the 24 h window). **ESCALATE trip-wire:** removing the app-global banner, removing the dismissal path, or stamping the write at confirmation time reverses ADR-070/071 — stop and ask.
- **D-05:** "Not yet" is **not** "Don't log" — keep a dismissal path or assist rows linger until expiry. The write stays `markAssistLogged` stamped at `handoff_at`, never at confirmation time. Only explicit confirmation creates the canonical Message interaction, and Transmit never claims Orbit delivered anything.
- **D-06:** `markAssistLogged` must **translate** transport values to the new vocabulary (text/email → Message, call → Call), not copy them (R-03). **Trip-wire:** leaving it a straight copy writes legacy transport values into `interactions.channel`, a silent inconsistency the CHECK will not catch. `interaction_assists` is not rebuilt, and this change ships **with** the Tone/channel migration owned by Phase 32 or 34 — never before it.
- **D-07:** AI availability is **three-state**, not binary (AF-01, amended). AI Off removes every AI affordance from Compose and Research; AI On + Ready exposes the normal actions; AI On + Needs Attention replaces the AI actions with a restrained "AI needs attention" repair notice rather than letting AI silently vanish. The repair notice does **not** restore Draft/Rewrite/Add to AI/Message Focus, does not reopen the deferred "AI setup prompts inside Compose", and does not make Compose a provider-troubleshooting surface. This phase **consumes** the state from Phase 36; it computes none of it.
- **D-08:** Compose context may include an interaction note **only** where that interaction's Allow AI flag is ON (E-05); today AI context reads only `channel, quality, connected` and `off_limits` is excluded in SQL everywhere. **Group Notes are never AI-eligible in Compose context**, under any state. The Off Limits half touches ADR-050's "never … off-limits fuel" and ADR-036's rejected UI-side privacy filter — ADR-078 is the superseding decision; confirm it before changing `fuel-read.ts`'s exclusions, and treat any further widening of egress as an owner decision.
- **D-09:** ADR-079 governs AI entry and invocation here: AI is reached via Message → Draft with AI (the Profile AI-draft entry is removed by Phase 31), AI never writes automatically on open, and each request returns exactly three unlabeled, meaningfully varied suggestions on a non-destructive review surface that leaves the editor untouched until "Choose this". Try Again replaces the three; no generation history stack.
- **D-10:** Compose session state (body, subject, mode, destination, Message Focus) survives in-app navigation and ordinary backgrounding but is **not** a durable draft across relaunch — no message-drafts table and no backup contract is added. Message Focus is capped at three AI-authorized items, is session-only, and **Add to AI grants no AI permission**.
- **D-11:** ADR-035/036 still say Send/Copy "never write to SQLite", already superseded in practice by ADR-072's assist row (R-14 note). Flag the overdue superseding note rather than relying on the stale text — and do not "fix" the discrepancy by removing the assist write.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-14-messaging-ai-compose-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-14-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-070-durable-pending-interaction-assist-lifecycle-and-portable-opt-out.md` — the durable assist row, app-global banner, dismissal path, and 24 h expiry the Compose prompt must coexist with
- `docs/decisions/ADR-071-user-attested-handoff-time-interaction-logging-through-the-sole-recency-writer.md` — confirmed sends log at `handoff_at` through the sole recency writer
- `docs/decisions/ADR-078-negative-constraint-off-limits-and-gated-recent-interaction-ai-context.md` — what Compose may send: gated interaction notes, Off Limits as avoidance constraints, never Group Notes
- `docs/decisions/ADR-079-on-demand-ai-transparency-and-compose-only-three-suggestion-invocation.md` — Compose-only AI invocation, three suggestions, on-demand transparency

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: in-app messaging, an inbox, threads, transport, or delivery receipts; third-party Messenger/WhatsApp/Signal/Instagram integrations; durable per-contact message drafts with backup or sync; per-generation full-context authorization screens or AI-generated suggestion labels; and freeform "Adjust" instructions, prompt personalization, or provider/model/API-key management — all owned by Phase 36.
</deferred>

---
*Phase: 35-messaging-ai-compose*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
