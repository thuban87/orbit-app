# ADR-193: Activity-First History Stream in Profile, Replacing the Rolodex

**Status:** Accepted
**Date:** 2026-10-09
**Phase:** 38.8-history-navigation-ux
**Source decisions:** D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-18, D-32..D-47, D-60 (38.8-CONTEXT.md; ledger Q-01..Q-06, Q-21..Q-37, Batch 15)
**Reversibility:** reversible (inferred; UI only, no storage change, the Rolodex is archived)
**Migration:** None
**Supersedes:** ADR-121 (Rolodex Month/Day/Year History Browser); ADR-123 (partial — the Heatmap + Intensity + Rolodex composition and its rejection of a conventional timeline; in-Profile mounting, the empty-history predicate, the typed `LogContact` route and knowledge-row navigation survive)
**Superseded by:** None

## Context

Profile History hid every record behind the Rolodex: pick a date on three wheels, then press See details. The owner found the wheels unintuitive, and no recorded evidence or owner rationale supported them (ledger E-11, E-12). The phase-11 dossier (§A/§B :195, :206, :866, :922) had chosen "a temporal experience rather than a conventional activity feed"; this phase partially supersedes that framing, while the heatmap and Intensity stay as analysis surfaces.

## Decision

History browsing is an activity-first chronological stream of the contact's actual records, inside the existing in-Profile `interaction-history` module (no new screen, no "See all" route). The section stacks lens row, heatmap, Intensity, a 'Jump to date' button, then the stream. The stream is newest first, grouped year → month header → day label, with only dates that have records. Only the current calendar year is open by default; each older year with records is a collapsed row reading '<year> · <n> interaction(s)' (interaction rows only). An empty current year shows 'Nothing logged in <year> yet'. An open year shows its newest `STREAM_INITIAL_VISIBLE` (20) records, then 'Show older' adds `STREAM_CHUNK` (20), snapped to a day end. Day labels read Today / Yesterday / 'Fri Oct 2'; accessible labels carry the full date. It is a flat list with no sticky headers, gap markers, per-day cards or day counts. Across families, equal timestamps order interactions → lifecycle → knowledge → id descending, with stable family+id keys. Interaction rows show channel, minute time, direction/quality meta, two note lines and a group-event title for group-linked children. The whole row opens `InteractionDetail`. Lifecycle rows are muted and read-only; knowledge rows keep today's look and open `MemoryHistory`. Rows have no long-press, AI sparkle or duration. The section's visible title is 'History'; the module key is unchanged. The Rolodex files are archived to `docs/archive/history-rolodex/`, excluded from tsc, vitest, Biome and graphify, with no production imports.

## Alternatives Considered

- **Keep the wheels and fix them** — Rejected; records would still sit behind a date pick (Q-01).
- **Calendar + day agenda** — Rejected; a day must be picked before anything shows (Q-01).
- **Period-paged list** — Rejected; old records need many page flips (Q-01).
- **Profile preview plus a full-screen stream, or full screen only** — Rejected; either reverses ADR-165 (Q-02).
- **Delete the Rolodex outright** — Rejected; the owner wants it archived as reference (Q-03).
- **Show the whole open year without 'Show older'** — Rejected by the owner (Q-28b).
- **Open recent records across a year boundary** — Rejected; strictly the current year opens (Q-23).
- **Sticky month headers, or Jump in the section title bar** — Rejected (Q-21).
- **Gap markers, per-day cards, long-press menus, the AI sparkle, duration or day counts on rows** — Rejected (Q-26, Q-27, Q-34..Q-37).

## Consequences

### Positive

- Records show immediately on opening History, with no date selection first.
- The stream reuses the canonical read and the existing row presentation; no route, preference, backup or migration changes.

### Negative

- The canonical read stays unbounded, and the stream renders as chunked plain Views in Profile's ScrollView. The deepest Jump took about 1 s on the release build (judged adequate).
- An older year holding only lifecycle or knowledge records reads '<year> · 0 interactions' (D-35 applied literally; left as an owner look item).

### Risks

- The archived Rolodex must stay out of every toolchain; a stray `src/` import would bring it back into the bundle.

## Implementation

**Key files:**
- `src/components/history/history-stream-logic.ts` — the stream model, cross-family order, chunking, day/year labels and tunables.
- `src/components/history/HistoryStream.tsx` — the presentational stream (open years, collapsed year rows, months, days, Show older).
- `src/components/history/HistoryStreamRows.tsx` — interaction, lifecycle and knowledge rows, relocated from the retired sheet.
- `src/components/history/HistorySection.tsx` — mounts the stream after Intensity and owns its transient view state.
- `src/components/history/history-section-logic.ts` — shared section logic the stream extends.
- `src/db/history-read.ts` — the canonical read the stream consumes (group title already joined).
- `src/profile/module-registry.ts` — the visible title 'History' on the unchanged `interaction-history` key.
- `src/components/history/RolodexBrowser.tsx` — removed from `src/` (archived).
- `src/components/history/RolodexWheel.tsx` — removed from `src/` (archived).
- `src/components/history/rolodex-logic.ts` — removed from `src/` (archived).
- `docs/archive/history-rolodex/README.md` — the archive's reference note and tool exclusions.

**Depends on:** ADR-119 (Reusable Count-Only History Aggregation and Canonical History Read); ADR-122 (Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet); ADR-165 (In-Profile History Reveal, Today-Following Rollover, and Snapshot-Coherent History)
**Required by:** None
