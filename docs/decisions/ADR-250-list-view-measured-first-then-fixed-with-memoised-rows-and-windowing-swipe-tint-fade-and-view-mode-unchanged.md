# ADR-250: List View Measured First, Then Fixed with Memoised Rows and Windowing — Swipe, Tint, Fade and View Mode Unchanged

**Status:** Accepted
**Date:** 2026-10-19
**Phase:** 38.13-contacts-list-search-digest-ux
**Source decisions:** D-55, D-56, D-81, D-44, D-86 (38.13-CONTEXT.md; ledger Q-01, Q-02, Batch 8, Batch 11 D1); carried D-12, D-13
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

On ~1,000 contacts the Contacts List view used about 1.7 GB on a release build against about 0.3 GB for Card view, and a tap on a control answered about 2 s late. The cause was unknown. List is the default view, and Phase 39's Contacts step runs on it. The list also went blank during a change (the result fade was reset to 0 before the heavy commit) and search could show a stale "1 match".

## Decision

We measure first, then fix, on a release build on a physical phone, naming the thread each figure covers (D-55, D-13). Measurement builds may be local-only (a `profileable` release is allowed) but are never shipped, uploaded or committed to the release path, and the shipped manifest is unchanged (D-56). The bisects showed every row mounted (1,016 of 1,016) and every row re-rendering on every change. The fix is **WM** (D-81): a memoised row host (`SwipeableListRow`) with scalar props and id-taking stable callbacks, a `useCallback` `renderItem` plus `extraData`, and explicit windowing (`LIST_WINDOW_SIZE` 5, `LIST_INITIAL_NUM_TO_RENDER` 8, `LIST_MAX_TO_RENDER_PER_BATCH` 5). Swipe, the UI-thread swipe tint, the result fade and view mode stay as they were. Rows and the count stay visible through a change: the fade start is published with the rows and applied in a layout effect only when the publish generation advances, and the `?? 1` match default is gone, replaced by a "Searching…" header (D-44). The remaining one-frame full-opacity flash when a population change lengthens the list is accepted (D-86).

## Alternatives Considered

- **Report only, fix in Phase 40** — rejected (Q-01, P1 chosen).
- **Fix even if swipe or the fade change** — rejected (Q-01); any such fix comes back as its own question.
- **Debug-only native profiling** — not chosen (Q-02); debug overhead distorts attribution.
- **W, windowing only** — not chosen (D-81); rows would still re-render on every change once scrolling mounts more.
- **G, one list-level swipe gesture (F4)** — not chosen (D-81); it re-implements swipe and was not indicated by the bisects.
- **Fix the one-frame flash** — not chosen (D-86); it would change the fade.

## Consequences

### Positive

- Release, Pixel 6 Pro, full set: List memory 1,749 → 308 MB (process-wide, equal to Card), Views 23,455 → 586, Population panel tap 1,898 → 42 ms and population change 3,721 → 34 ms first response (end to end), JS CPU per change 48–78 % → 0.8 % (`mqt_v_js`).
- The right-swipe path is one function, `onSwipeRightAction`, the hook point Phase 39 D-53 needs.

### Negative

- Every row callback must stay stable for the screen's life; an AST contract (`home-list-host-contract.test.ts`) pins their deps.
- Why the FlatList defaults mounted every row was never isolated; the props are set explicitly instead.

### Risks

- A new per-row inline closure or non-scalar prop silently brings back whole-list re-renders. Perf claims from the desktop emulator or a debug build are not evidence.

## Implementation

**Key files:**
- `src/screens/HomeScreen.tsx` — memoised `SwipeableListRow`, `renderListRow`, `listExtraData`, `LIST_WINDOW_*` tunables, `publishedFadeStart` / `lastAppliedGenerationRef`, `onSwipeRightAction`.
- `src/components/ListRow.tsx` — scalar row props; no `?? 1` match count.
- `src/components/GridCard.tsx` — no `?? 1` match count.
- `src/screens/dashboard-refresh-scheduler.ts` — read outcomes carry the search term they were issued for.
- `src/screens/home-list-host-contract.test.ts` — pins memo, stable callback deps and the layout-effect fade start.
- `scripts/dev/contacts-perf/list_memory.py` — M1 process-wide memory curves (list, card, scroll).
- `scripts/dev/contacts-perf/tap_latency.py` — M7 end-to-end tap latency from screenrecord.
- `scripts/dev/contacts-perf/README.md` — what each figure measures and which thread it covers.

**Depends on:** ADR-099 (Durable Global Dashboard Right-Swipe Action); ADR-100 (Relevance-First, Visibility-Safe Dashboard List Search); ADR-162 (Sweep-Ordered Foreground Refresh and Latest-Request Publication Authority); ADR-176 (Authored Native Platform Configuration — the shipped release manifest stays unchanged); ADR-179 (Owner-Ruled Art Treatments Beyond the Signed Table)
**Required by:** None
