# ADR-256: Digest Overlooked Lists Everyone Who Needs Attention, Minus Up Next, from One Shared Needs-Attention Predicate, and Horizon Birthdays Show Avatars

**Status:** Accepted
**Date:** 2026-10-19
**Phase:** 38.13-contacts-list-search-digest-ux
**Source decisions:** D-61, D-48 (38.13-CONTEXT.md; ledger Q-07 and its Batch 3 confirmation, Batch 4 triage); carried D-06
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-147 (partial — "overlooked" no longer means the rogue condition; Horizon's Overlooked is the needs-attention set minus Up Next; Up Next's first claim, the single dedupe, canonical status semantics and persisted drills survive); ADR-054 (partial — the rogue and rarely-responding Overlooked read in `digest-read.ts` is retired, and Overlooked now shows nearing-decay and decaying people too, partly adopting its rejected "full decay list"; the local live read, the never-contacted backlog and snooze exclusion survive)
**Superseded by:** None

## Context

The Digest's Overlooked section read rogue people only (`readOverlooked`), but its "See everyone needing attention →" link opened the wider needs-attention set (wobble, decay and rogue) on Contacts, so the section and its link disagreed. The owner: "show everybody who legit needs attention, not sure why it was limited to rogue." Horizon birthday rows were the only Digest rows without an avatar.

## Decision

Overlooked lists everyone who needs attention — nearing decay (wobble), decaying and rogue, snoozed people excluded — minus the people Up Next already shows. It still previews three names, and its link opens the same set on Contacts. One predicate, `NEEDS_ATTENTION_WHERE` in `src/db/status.ts` (cadence precondition + progress at or past `STABLE_MAX` + not snoozed, built only from code constants), serves the Contacts needs-attention filter, the drill and `readUpNextCandidates`, which now returns the whole set with no LIMIT. `DigestScreen` takes Up Next's three and passes the rest through the one dedupe (`dedupOverlooked`) to `HorizonSection`. The rogue-only read (`readOverlooked`, `OverlookedRow`, `splitOverlooked`) is removed. The predicate's cadence precondition keeps Unbound people out. Horizon birthday rows render the contact's `Avatar` in the neutral ring, from `photo` added to the `BirthdayCandidate` read; no migration (D-48, owner condition "if it's small").

## Alternatives Considered

- **Keep Overlooked rogue-only and relabel the link (OV2)** — rejected (Q-07).
- **Rogue plus decaying only** — offered at confirmation; owner chose the full needs-attention set ("Yes, that's it").
- **Reasons on Overlooked rows and an Up Next / Overlooked caption (C-13)** — dropped by owner triage (D-68).

## Consequences

### Positive

- Section and drill agree, pinned by a real-SQLite set-equality test; Up Next plus Overlooked cover the drill set with no overlap.
- One status predicate instead of a Digest-specific one (ADR-147's rejection of Digest-specific urgency kept).

### Negative

- Overlooked can be much longer than before; it still previews three names.
- `digest-read.ts` and `digest-logic.ts` keep exports with no production consumer (later cleanup).

### Risks

- Reimplementing needs-attention anywhere else would split the section from its drill again.

## Implementation

**Key files:**
- `src/db/status.ts` — `NEEDS_ATTENTION_WHERE`.
- `src/db/up-next-read.ts` — `readUpNextCandidates` over the shared predicate, no LIMIT.
- `src/logic/dashboard-query-logic.ts` — the needs-attention filter through the same predicate.
- `src/logic/digest-composition.ts` — `dedupOverlooked`, the one dedupe.
- `src/screens/DigestScreen.tsx` — Overlooked = candidates minus Up Next.
- `src/components/digest/HorizonSection.tsx` — the deduplicated list; birthday avatars.
- `src/db/digest-read.ts` — the retired `readOverlooked`.
- `src/logic/digest-logic.ts` — the retired `splitOverlooked`.
- `src/db/dashboard-read.ts` — `BirthdayCandidate.photo`.

**Depends on:** ADR-026 (Rogue Status for Unresponsive or Far-Overdue Contacts); ADR-147 (Derived Digest Composition and Canonical Contacts Drill-Through); ADR-234 (Per-Person Mute Becomes an Indefinite Snooze, Stored as a Far-Future Date and Converted by Migration 034 and on Restore)
**Required by:** None
