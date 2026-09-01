# ADR-070: Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out

**Status:** Accepted
**Date:** 2026-08-31
**Phase:** 21-interaction-assist-reach-out
**Source decisions:** dossier `21-interaction-assist-reach-out` clusters E, G, I, M, N, O, Q, V, W, X, AI
**Reversibility:** one-way
**Migration:** 014
**Supersedes:** None
**Superseded by:** None

## Context

When a user starts a Call/Text/Email from Orbit and hands off to a native app, Orbit must remember the intent so it can later ask "did that happen?" — even if Orbit is backgrounded or killed the instant after launch. That state must survive process death and reboot, stay lightweight (not become backlog management), and never require a backend. SQLite has no scheduler, so nothing can watch a timestamp.

## Decision

The system writes a durable `interaction_assists` row **immediately before** launching the native app, and manages it through a small explicit lifecycle: `pending → logged | dismissed | expired | failed`. At most the 5 newest unresolved pending rows are kept (a 6th expires the oldest); an assist becomes prompt-eligible only 15 seconds after handoff and expires 24 hours after it. A launch-time foreground sweep (never a timer) expires aged-out pending rows and prunes terminal rows after 30 days. A default-on `interactionAssistEnabled` setting gates assist creation; turning it **off clears the pending queue immediately** ("off means off") and it rides in the portable backup manifest.

## Alternatives Considered

- **Create the assist after handoff / on return** — rejected because a kill immediately after launch would lose the intent; write-before-launch makes it recoverable.
- **A background timer or scheduler for expiry** — rejected because SQLite triggers fire only on data events and there is no OS scheduler; a launch-time sweep is the only durable mechanism.
- **Unbounded pending queue** — rejected because five ignored prompts already prove older ones are unlikely useful; the cap keeps the feature lightweight.
- **Toggle off leaves already-pending assists to keep prompting** — rejected by owner ruling (2026-08-31): off means off, clear at once.

## Consequences

### Positive

- Intents survive termination, process death, and reboot with no backend, and the queue can never grow without bound.

### Negative

- Expiry/retention only advance while the app is foregrounded; a never-reopened app keeps stale rows until the next launch sweep.

### Risks

- The foreground sweep must never run inside a headless widget task; growth is bounded by cap-5 + 24h expiry (accepted low-DoS risk T-21-03/T-21-12).

## Implementation

**Key files:**
- `src/db/migrations/014-interaction-assists.ts` — the `interaction_assists` table (CHECK-constrained `channel`/`status`, FK cascade, pending index) and the `interaction_assist_enabled` settings column, default 1.
- `src/db/interaction-assist-dao.ts` — cap-5 `createPendingAssist` plus the status-guarded `markAssistDismissed`/`markAssistFailed` terminal transitions, each inside the shared write mutex.
- `src/db/interaction-assist-read.ts` — the eligible pending queue and pending count, joined to `contacts` for banner names.
- `src/logic/assist-eligibility.ts` — the 15-second/24-hour local-wall-clock eligibility bounds and newest-eligible banner selection.
- `src/services/interaction-assist-sweep.ts` — the foreground launch-sweep hook that expires aged pending rows and prunes terminal rows after 30 days.
- `src/db/app-settings-dao.ts` — the canonical `interactionAssistEnabled` read/write, the one-transaction opt-out that expires every pending row, and the portable projection.
- `src/backup/backup-schema.ts` — includes `interactionAssistEnabled` in the portable manifest allow-list.
- `src/stores/assist-store.ts` — the SQLite-backed queue that refreshes only on a real background→active return.
- `src/services/reach-out/handoff.ts` — orders `createPendingAssist` before the native launch.
- `src/components/AssistBanner.tsx` — the app-global non-modal banner surfacing the newest eligible assist and the remaining count.
- `src/components/PendingConfirmationsSheet.tsx` — the transient multi-item pending-queue review surface.
- `App.tsx` — mounts the banner app-wide, registers the sweep hook, and refreshes the queue on foreground.

**Depends on:** None
**Required by:** None
