# Phase KB Manifest: 35

**Phase:** 35-messaging-ai-compose
**Processed:** 2026-09-21
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-14-messaging-ai-compose-dossier.md`, resolved through `35-CONTEXT.md` because the phase-dossier map has no Milestone-2 rows.
**Source docs consumed:** 31 files (729,105 bytes); all 29 phase Markdown artifacts (`35-01` through `35-09` plans/summaries; CONTEXT, PATTERNS, RESEARCH, REVIEW, REVIEWS, UAT, UI-SPEC, VALIDATION, VERIFICATION, COVERAGE, deferred-items), the mapped dossier, and binding appendix `docs/dossier/milestone-2/planning-notes/phase-14-planning-notes.md`.

## ADRs Produced

| ADR | Title | Source Decisions |
|---|---|---|
| [ADR-107](../../../docs/decisions/ADR-107-off-limits-excluded-from-all-ai-egress.md) | Off Limits Excluded from All AI Egress | Existing owner-ratified D-14 (2026-09-13); preserved and cross-linked. |
| [ADR-133](../../../docs/decisions/ADR-133-session-scoped-compose-modes-and-truthful-external-handoff.md) | Session-Scoped Compose Modes and Truthful External Handoff | dossier §§C–I, W; D-03–D-06, D-10 |
| [ADR-134](../../../docs/decisions/ADR-134-read-only-compose-research-and-permission-bounded-message-focus.md) | Read-Only Compose Research and Permission-Bounded Message Focus | dossier §§J–O; D-08, D-10, D-13 |

## System Docs Updated

| System Doc | What Changed |
|---|---|
| `docs/systems/persistence-core.md` | Added migration 028 and the durable Compose-mode preference boundary. |
| `docs/systems/app-shell.md` | Added origin-aware, session-scoped Compose and dual-stack Research navigation. |
| `docs/systems/contact-methods.md` | Documented actionable Text/Email fallback and native external handoff. |
| `docs/systems/interaction-assist.md` | Added Compose-attached, handoff-time truthful confirmation. |
| `docs/systems/contact-knowledge.md` | Added the source-owned, read-only Compose Research projection. |
| `docs/systems/ai-suggestions.md` | Documented three-state Compose AI, review fan-out, and bounded consent gates. |
| `docs/systems/backup-restore.md` | Recorded declaration-only Compose preference allowlisting without a format bump. |
| `docs/systems/profile.md` | Recorded Profile as the explicit Compose origin. |

## System Docs Created

_None._

## Runbooks Updated / Created

_None._ No repeatable engineering procedure changed.

## ADRs Superseded

| Existing ADR | Superseded by | Scope |
|---|---|---|
| ADR-078 | ADR-107 (partial, pre-existing) | Off Limits is excluded from every AI egress path; gated recent-interaction-note rules remain. |

## Deferred / Not Captured

- D-11's stale ADR-035/036 Send/Copy wording — flagged only; no authoritative superseding decision exists, and removing the assist write would reverse ADR-070/071.
- Backup wire emission/format bump, exact prompt rendering, provider management, durable drafts, transport/inbox features, and advanced Message Focus weighting — explicitly deferred to Phase 36 or later.
- App Shell was already over the system-doc split threshold (438 lines before this update); the structural split procedure was not requested.

## Phase Stats and Verification

9 plans; 2 new ADRs plus 1 preserved owner-ratified ADR; 8 system docs updated; 0 created; 0 runbooks; 1 pre-existing partial supersession recorded. Generated ADR index, registry, and graph verification follow this manifest commit.

## Local Commits

- `0752a3f` ADR-133 Compose handoff contract
- `e6104a9` ADR-134 Compose research focus
- `ee39aa7` through `a56d23a` subsystem-documentation updates
- `99b8d8c` bidirectional dependency links and AI egress cross-link

Nothing is pushed; no branch or worktree was created.
