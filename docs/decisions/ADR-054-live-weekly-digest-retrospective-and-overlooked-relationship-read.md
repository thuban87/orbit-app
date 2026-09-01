# ADR-054: Live Weekly Digest Retrospective and Overlooked Relationship Read

**Status:** Accepted
**Date:** 2026-08-23
**Phase:** 15-weekly-digest
**Source decisions:** dossier `14-digest.md` Clusters A–C; 15-CONTEXT Grey Areas 1–3
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The always-current dashboard already shows who needs attention, but it cannot provide a calm retrospective or regularly surface the populations excluded from decay pushes. The digest needs to respect the no-obligation posture: all touchpoints count, the quality signal is gentle, and neither a scoreboard nor a duplicate due-list is introduced.

## Decision

The system uses a live-computed weekly digest screen, reachable from the dashboard and from its notification, with a person-list retrospective of every non-archived touchpoint in the trailing seven-day window. It separately presents non-archived rogue and rarely-responding contacts plus the never-contacted backlog, deliberately ignoring the decay-push mute, and shows a conservative, named effortful-relationship line only when recent quality marks clearly skew hard.

## Alternatives Considered

- **An in-app screen with no notification** — Rejected because the plugin's manual digest demonstrated weak discoverability.
- **A notification that opens the dashboard** — Rejected because it provides neither the retrospective nor the non-nagged-populations home.
- **Connected-only or outbound-only retrospective rows** — Rejected because they penalize a user for silence or omit valuable inbound reconnections.
- **A full decay list, snoozed bucket, or a bare reached-count** — Rejected because these duplicate dashboard work or create a streak-like scoreboard.
- **No quality callout or an unlabeled signal** — Rejected because the quality marker's intended digest purpose needs a kind, explicit, non-verdict presentation.

## Consequences

### Positive

- The digest supplies a distinct local retrospective and an unpressured home for overlooked contacts.
- Shared status SQL, the rogue threshold, and the never-contacted count remain single sources of truth.

### Negative

- The screen needs several live SQLite reads and careful local-wall-clock window handling.
- The conservative quality gate can intentionally omit a borderline relationship signal.

### Risks

- Reusing the decay-suppression predicate would hide exactly the muted, rogue, and rarely-responding people the digest must show.
- UTC conversion of stored local timestamps can move a window-boundary touchpoint to the wrong day.

## Implementation

**Key files:**
- `src/db/digest-read.ts` — performs the read-only retrospective, overlooked, and quality-mark queries.
- `src/logic/digest-logic.ts` — owns local date shaping, group caps, and the conservative effortful gate.
- `src/screens/DigestScreen.tsx` — renders the live sections, calm empty state, and profile/backlog destinations.
- `src/screens/HomeScreen.tsx` — exposes the non-badged dashboard entry to the digest.

**Depends on:** ADR-024 (Editable Touchpoint History and Recomputed Recency); ADR-026 (Rogue Status for Unresponsive or Far-Overdue Contacts)
**Required by:** None.
