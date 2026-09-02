# Phase KB Manifest: 21-interaction-assist-reach-out

**Phase:** 21 — Interaction Assist & Reach Out
**Processed:** 2026-09-01
**Decision-source tier:** dossier + context-prose — `docs/dossier/21-interaction-assist-reach-out.md` (revised 2026-08-31, Revision Log) is primary; overlaid by `21-CONTEXT.md` (prose shim), the six 21-0x PLAN/SUMMARY sets, `21-REVIEW.md`, `21-SECURITY.md`, and `21-VERIFICATION.md`.
**Source docs consumed:** 13 (dossier + CONTEXT + HANDOFF + 6 SUMMARYs + REVIEW + SECURITY + VERIFICATION + deferred-items)
**Ship date used:** 2026-08-31 (all phase-21 research/plan/execution/review commits; the `git log --reverse` head is a 2026-08-26 bulk "phases 18–21 roadmap" seed and was not used).

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-070 | Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out | dossier clusters E, G, I, M, N, O, Q, V, W, X, AI |
| ADR-071 | User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer | dossier clusters F, J, K, R, S, T, U, AJ |
| ADR-072 | Shared Actionable Reach Out Router with Native Channel Handoff | dossier clusters A, B, C, D, AC, AD |
| ADR-073 | Merge-Reparented, Purge-Cascaded Interaction Assists | dossier clusters AA, AB (data-layer half) |
| ADR-074 | Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe | dossier clusters AE, AF, AG, AH, AB (nav half) |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/contact-methods.md` | Compose Send routes through shared `performReachOut` (pending assist, no send-time interaction); actionable-primary selection reused by the router; +ADR-072. |
| `docs/systems/interaction-log.md` | Added assist confirmation as a new touchpoint writer (`source='assist'`, outbound, handoff-time, connected per Call outcome); +ADR-071. |
| `docs/systems/contacts.md` | Purge cascade-deletes pending assists (documented exception); assist logging reuses the sole recency recomputer; +ADR-071, +ADR-073. |
| `docs/systems/contact-reconciliation.md` | Merge reparent loop extended to pending `interaction_assists`; +ADR-073. |
| `docs/systems/widget.md` | Larger `Message → Compose` action replaced by `Contact → orbit://reach` into the shared router with a fail-safe guard; +ADR-074 (ADR-044 partial supersession). |
| `docs/systems/app-shell.md` | App-global non-modal assist banner (Back passes through), Settings toggle, launch-sweep, `orbit://reach` bridge + consumed-once param; +ADR-070, +ADR-074. |
| `docs/systems/backup-restore.md` | `interactionAssistEnabled` added to portable manifest (transient assist rows excluded); +ADR-070. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/interaction-assist.md` | The Interaction Assist & Reach Out subsystem: Reach Out router + native handoff, durable assist lifecycle, attestation logging, and merge/purge/widget wiring. |

## Runbooks Updated

_None._

## Runbooks Created

_None._ — Migration 014 followed the existing `sqlite-migration-pipeline` runbook; device UAT reused `android-contact-reconciliation-uat` patterns.

## ADRs Superseded

| Existing ADR | Superseded by | Reason |
|--------------|---------------|--------|
| ADR-044 (Headless Widget Actions and Dashboard-Rooted Deep Links) | ADR-074 (partial) | The larger widget `Message → Compose` action becomes `Contact → orbit://reach`; headless-mark/log + strict-parse/reset architecture stands. |

## Index Changes

- `docs/systems/README.md`: ADDED the `Interaction assist / Reach Out` row (anchor 21) and replaced the phase-21 open routing note with the resolved home. `CLAUDE.md`: none.

## Deferred / Not Captured

- **Review IN-02** (widget `Contact` on a method-less favourite strands `openReachOut`) — owner-deferred (fix-now vs backlog); recorded as an open gotcha in `interaction-assist.md` and `widget.md`.
- **Review IN-03 / IN-04 / IN-05** (no try/catch on confirm/dismiss handlers; cap-vs-eligibility edge; silent null-canonical + purge cascade style) — backlog; recorded as open gotchas.
- **Review WR-01** (dismiss/failed bypassed the write mutex) — fixed in-phase; recorded as a past-tense "used to bite" gotcha.
- **Review IN-01** (banner surfaces archived-contact assists) — not a defect; dossier Cluster Z decided behavior; recorded as an intentional-behavior gotcha, not a bug.
- Dossier "Explicitly Deferred" list (passive monitoring, call-log/SMS reading, endpoint-level history, email compose screen, provider channels, background polling) — captured as ADR-071/072 scope guards, no separate ADRs.

## Phase Stats

- **Plans in phase:** 6 (21-01 … 21-06)
- **Decisions captured:** 23 dossier clusters as 5 ADRs
- **Systems touched:** interaction-assist (new), contact-methods, interaction-log, contacts, contact-reconciliation, widget, app-shell, backup-restore
- **New gotchas added:** 12 (6 new-doc + 6 across updated docs)
