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
- **D-08:** Compose context may include an interaction note **only** where that interaction's Allow AI flag is ON (E-05); today AI context reads only `channel, quality, connected` and `off_limits` is excluded in SQL everywhere. **Group Notes are never AI-eligible in Compose context**, under any state. The Off Limits half touches ADR-050's "never … off-limits fuel" and ADR-036's rejected UI-side privacy filter — ADR-078 is the superseding decision; confirm it before changing `fuel-read.ts`'s exclusions, and treat any further widening of egress as an owner decision. **⚠ AMENDED by D-14 (ADR-107):** off-limits is now excluded from AI egress entirely — `fuel-read.ts`'s off-limits exclusion must stay unrelaxed; do NOT carry off-limits as an avoidance constraint. The interaction-note `allow_ai` gate and Group Notes ban in this decision are unchanged.
- **D-09:** ADR-079 governs AI entry and invocation here: AI is reached via Message → Draft with AI (the Profile AI-draft entry is removed by Phase 31), AI never writes automatically on open, and each request returns exactly three unlabeled, meaningfully varied suggestions on a non-destructive review surface that leaves the editor untouched until "Choose this". Try Again replaces the three; no generation history stack.
- **D-10:** Compose session state (body, subject, mode, destination, Message Focus) survives in-app navigation and ordinary backgrounding but is **not** a durable draft across relaunch — no message-drafts table and no backup contract is added. Message Focus is capped at three AI-authorized items, is session-only, and **Add to AI grants no AI permission**.
- **D-11:** ADR-035/036 still say Send/Copy "never write to SQLite", already superseded in practice by ADR-072's assist row (R-14 note). Flag the overdue superseding note rather than relying on the stale text — and do not "fix" the discrepancy by removing the assist write.
- **D-12 [owner-resolved 2026-09-13, plan-time]:** Resolves RESEARCH Open Question 1 (three-state AI availability source, D-07/COMP-09). Phase 35 defines a **stable 3-state consumer adapter** (Off / On+Ready / On+Needs-Attention) **and** ships a **working provisional implementation** deriving the state from what exists today: Off = `aiProvider === 'none'`; Ready = provider set + credential present; Needs-Attention = provider set but credential missing/invalid. The Needs-Attention repair notice routes to the **existing AI settings surface** as an interim target — kept minimal, no new provider-troubleshooting UI. Phase 36 later replaces the adapter's internals and the polished repair flow **without touching Compose**. Owner note: phases 35→36 are being sprinted back-to-back, so a briefly-incomplete interim repair route is acceptable; do NOT over-build anything Phase 36 will replace.
- **D-13 [owner-resolved 2026-09-13, plan-time] [AMENDED by D-14 2026-09-13]:** Resolves RESEARCH Open Question 2 (ADR-078 egress-construction ownership, D-08). Phase 35 builds the **human-facing + shape-carrying** half only: the Research-side "Avoid" group, the never-Message-Focus rule for Off Limits, and an extension of `PromptContext` / `ai-context-read.ts` to **carry** the avoidance-constraint and gated-recent-interaction-note shapes. The **exact prompt-template rendering/transmission** of those NEW ADR-078 additions is **Phase 36's** job (§U defers generation-context construction). Net: Phase 35 does **not** widen actual egress beyond today's authorized projection; SC-11 is satisfied at the "display + carry the shape" level this phase. Do not add off-limits text or interaction notes as *positive* context, transmit an AI-disabled off-limits item, or include a Group Note — any further widening remains an owner decision (D-08). **⚠ AMENDED by D-14:** the *off-limits avoidance-constraint* carry is removed entirely (off-limits never goes to AI); only the *gated recent-interaction-note* carry survives from this decision.

- **D-14 [owner-resolved 2026-09-13, convergence-time — reverses ADR-078 (off-limits portion)]:** Off Limits is **never transmitted to the AI provider in any form** — not as positive context (already excluded) and not as a negative avoidance constraint. This **reverses ADR-078's off-limits egress widening** (the owner confirmed the reversal knowingly after being shown the conflict; it re-adopts ADR-050's exclusion for off-limits). Recorded as **ADR-107**, which supersedes ADR-078's off-limits portion only. Scope of the reversal: (1) `PromptContext`/`ai-context-read.ts` carry **no** off-limits avoidance-constraint shape — plan 35-05 drops `avoidanceConstraints` entirely; (2) `fuel-read.ts`'s exclusion of off-limits from every AI-facing read stands **unrelaxed**; (3) **no** `fuel` AI-permission column is added. **Unchanged / still in force:** the Research-side "Avoid" group and never-Message-Focus rule (human-facing display, D-13); the **gated recent-interaction-note** carry (note only where `interactions.allow_ai=1`, D-08); the absolute **Group Notes** ban (D-08). SC-11 (COMP-11) is now satisfied as "Off Limits shown to the human on Research + never sent to AI," not "sent as an avoidance constraint."

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
