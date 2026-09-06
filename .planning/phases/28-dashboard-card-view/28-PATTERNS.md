# Phase 28: Dashboard Card View - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 11 new/modified
**Analogs found:** 11 / 11 (every new file has a strong in-repo analog)

> **Scope note.** This map complements `28-RESEARCH.md`, which already carries a deep, on-disk-verified **Data-Layer Composition Map** (mutex mechanics, the `*Core` extraction requirement, per-writer file:line). This document does **not** re-derive that — it cites it — and adds the concrete component/store `<read_first>`/`<action>` excerpts the planner needs. Every excerpt below was re-read on disk 2026-09-06.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/GridCard.tsx` (or extend `ContactCard.tsx`) | component | request-response (render) | `src/components/ListRow.tsx` | exact (sibling renderer) |
| `src/components/CardGrid.tsx` (grid renderer branch) | component | render / virtualized list | `src/screens/HomeScreen.tsx` card branch (1055-1104) | role-match |
| `src/stores/dashboard-selection-store.ts` | store (Zustand) | event-driven (in-memory session) | `src/stores/dashboard-session-store.ts` | role-match |
| `src/db/bulk-actions-dao.ts` (bulk composers + extracted `*Core`s) | service (DAO) | batch / transform (N-in-1-txn) | `src/db/bulk-review-dao.ts` | exact (core/wrapper idiom) |
| `archiveContactCore` (extract in `src/db/contacts-dao.ts`) | service (DAO core) | CRUD write | `setContactPhotoCore` / `resolveBulkReviewFlagCore` | exact |
| `setFavouriteRankCore`/`clearFavouriteRankCore` (extract in `favourites-dao.ts`) | service (DAO core) | CRUD write | `setFavouriteRank`/`clearFavouriteRank` (mutexed twins) | exact |
| snooze cores (extract in `src/db/snooze-dao.ts`) | service (DAO core) | CRUD + event write | `snoozeContact`/`clearSnooze` (mutexed twins) | exact |
| `setContactCategoryCore`/`setContactFrequencyCore` (new single-column, `contacts-dao.ts`) | service (DAO core) | CRUD write | `setContactPhotoCore` (contacts-dao.ts:637-658) | role-match |
| `src/logic/card-line3-selection.ts` | utility (pure logic) | transform | `@/logic/list-row-selection` (`selectLine3`) | role-match |
| Icon registry entries (`src/components/icons/icon-registry.ts`) | config | — | existing `ICON_REGISTRY` entries | exact |
| `src/screens/HomeScreen.tsx` (card branch + selection wiring) | screen (host) | orchestration | its own list branch (1055-1090) | exact |

---

## Pattern Assignments

### `src/components/GridCard.tsx` (component, render) — extend-vs-new is planner discretion (UI-SPEC F-5)

**Primary analog:** `src/components/ListRow.tsx` (sibling renderer — same shared primitives, differs in layout only).
**Secondary analog:** `src/components/ContactCard.tsx` (legacy grid card — **reference only**; do NOT copy its literal `★` or its 48px corner-ring anatomy).

**Imports pattern** — copy verbatim from `ListRow.tsx:5-27` (this is the exact primitive set UI-SPEC mandates reusing):
```typescript
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { StatusGlyph } from "@/components/icons/StatusGlyph";
import { Icon } from "@/components/icons/Icon";
import { ringVisual, type StatusDisplayState } from "@/components/contact-card-ring";
import type { ProfileStatus } from "@/db/contact-status-read";
import { useTheme } from "@/theme";
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { isSnoozed } from "@/utils/dates";
import {
  buildRowAccessibilityDescription,
  formatMatchCategories,
  formatMatchExplanation,
  formatListRecency,
} from "./list-row-content";
```

**Snooze-composition + ring + a11y pattern** — copy verbatim from `ListRow.tsx:105-121` (this is the load-bearing status semantics; UI-SPEC §Status Presentation requires it be identical to List):
```typescript
const { colors } = useTheme();
const displayState: StatusDisplayState = isSnoozed(snoozeUntil, now) ? "snoozed" : status;
// Snooze has a neutral border; all other states reuse their shared hue.
const ring = ringVisual(displayState === "snoozed" ? null : displayState, colors);
const recency = formatListRecency(lastContact, now);
const accessibilityLabel = buildRowAccessibilityDescription({
  name, category: categoryLabel, recency, isFavourite, displayState,
});
```

**Never-contacted glyph guard** — copy the `ListRow.tsx:267-275` conditional. `displayState !== null` gates mounting `<StatusGlyph>`; for `null`, render neutral ring + NO glyph (UI-SPEC §J / D-11). Do NOT show `status-neutral`:
```typescript
{displayState !== null ? (
  <View accessible={false} accessibilityElementsHidden style={styles.statusGlyph}>
    <StatusGlyph state={displayState} size="md" />
  </View>
) : null}
```

**Favourite star pattern** — copy `ListRow.tsx:251-266`. `Icon name="favorite"` (a real star), `state`/`tone` toggle on membership, `hitSlop={SPACING.sm}` for the ≥44px hit area. During selection mode make it visually-readable but non-interactive (drop `onPress`, keep the glyph). Do NOT copy `ContactCard`'s literal `"★"` (UI-SPEC F-2):
```typescript
<Pressable accessibilityRole="button"
  accessibilityLabel={isFavourite ? "Remove favourite" : "Add favourite"}
  accessibilityState={{ selected: isFavourite }}
  hitSlop={SPACING.sm} onPress={onToggleFavourite} style={styles.favouriteButton}>
  <Icon name="favorite" state={isFavourite ? "active" : "default"} size="md"
    tone={isFavourite ? "accent" : "textSecondary"} />
</Pressable>
```

**Search-row presentation + highlight** — reuse the `HighlightedSnippet` inner component and the `isSearchMode`/`strongestMatch`/`formatMatchExplanation` block from `ListRow.tsx:29-58,122-134,178-233` verbatim. Card differs only in that all three rows are `numberOfLines={1}` (UI-SPEC Typography). The highlight run is label-weight-on-textPrimary, no background colour (`ListRow.tsx:332-337`).

**Divergence from ListRow (intentional, UI-SPEC F-3):** GridCard wires BOTH `ring.color` AND `ring.width` (escalating weight) onto the **avatar ring** — mirror `ContactCard.tsx:113,134-147` (`ringVisual(status, colors)` → `borderColor: ring.color, borderWidth: ring.width, opacity: ring.opacity`). This is the planet-ring escalation, not List's constant-weight full-row border. Category chip and recency-dot row from ListRow are **omitted** on the card (UI-SPEC §D).

**Presentational contract (both analogs agree):** NO DB read, NO `getExecutor`, NO `useNavigation` — caller wires `onPress`/`onToggleFavourite`/nav (`ContactCard.tsx:1-9`, `ListRow.tsx:1-3`). Keep this.

---

### `src/components/CardGrid.tsx` (grid renderer) + `HomeScreen.tsx` wiring

**Analog:** the existing `FlatList` + `renderItem` viewMode branch in `HomeScreen.tsx:1055-1104`.

**Current stub to replace** (`HomeScreen.tsx:1091-1104`): the `"card"` branch renders legacy `ContactCard` single-column with a non-functional star (`isFavourite={item.favourite_rank !== null}`, no `onToggle`). Phase 28 replaces this branch with the grid renderer.

**Favourite overlay + toggle pattern to REUSE from the list branch** (`HomeScreen.tsx:1071-1079`) — the card star must wire the same optimistic overlay, not the stub's read-only membership:
```typescript
isFavourite={favouriteOverlay.get(item.id) ?? (item.favourite_rank !== null)}
onToggleFavourite={() => {
  const renderedMembership = favouriteOverlay.get(item.id) ?? (item.favourite_rank !== null);
  toggleFavourite(item.id, !renderedMembership);
}}
```

**`numColumns` re-mount gotcha** (RESEARCH Pitfall 4 / Grid Architecture): a responsive-column grid `FlatList` must set `key={`grid-${numColumns}`}`. RESEARCH recommends a dedicated grid renderer rather than overloading the shared single-column `FlatList` — column count derived from measured width + text scale. `DashboardRow` already carries every field the card needs (`dashboard-read.ts:91-110`, VERIFIED in RESEARCH); no new base read.

**Avatar recycling correctness:** pass `contactId={item.id}` + `cacheBust={item.modified_at}` (both analogs do this; `Avatar.tsx:32-45,78`). Required in a virtualized grid, not an optimization.

**Multi-select tap semantics:** when the selection store's mode is on, card `onPress` toggles selection (not `goToProfile`); Profile nav is suppressed (UI-SPEC §Q/§AC). HomeScreen owns this branch, same as it owns `goToProfile`/`onLogInteraction` today.

---

### `src/stores/dashboard-selection-store.ts` (store, in-memory session)

**Analog:** `src/stores/dashboard-session-store.ts` (the closest existing pure in-memory, non-persisted Zustand session store — no DB, no `exec` params).

**Pattern to copy** (`dashboard-session-store.ts:1-27`): a plain `create<T>()((set) => ({...}))` with synchronous setters and a `clear*()` reset. Selection state is pure UI session state — **no persistence, no DB, no `exec` argument** (contrast `dashboard-query-store.ts`, whose setters all take `exec` and hit `updateAppSettings` — the selection store must NOT do that):
```typescript
import { create } from "zustand";

interface DashboardSelectionStore {
  mode: boolean;
  selectedIds: Set<number>;         // toggle membership
  frozenUniverse: number[];         // eligible ids captured when mode began (D-12/§S)
  enterSelection: (universe: number[], seedId?: number) => void;
  toggle: (id: number) => void;
  selectAll: () => void;            // over frozenUniverse only
  removeFromUniverse: (ids: number[]) => void; // after Archive, cards vanish (§AB)
  exitSelection: () => void;
}
```

**Key invariants from D-12/§R/§S (RESEARCH Pitfall 6):** `frozenUniverse` is snapshotted at `enterSelection` and never recomputed while mode is on (Population/Filters/Search are locked). `selectAll` operates over `frozenUniverse`, not the live result set. After an ordinary bulk op, mode + selection persist; Archive removes archived ids from both `selectedIds` and `frozenUniverse` (§AB). Provide a `.test.ts` (RESEARCH Wave 0).

---

### `src/db/bulk-actions-dao.ts` (service, N-in-1-transaction batch)

**Analog:** `src/db/bulk-review-dao.ts` — the established core/wrapper split (VERIFIED on disk, `bulk-review-dao.ts:72-137`).

**The idiom to replicate** (`bulk-review-dao.ts:72-75,125-130`): define a non-mutexed `xxxCore(exec, input)` that assumes an already-open transaction, and a thin mutexed public wrapper `export function xxx(exec, input) { return inWriteTransaction(exec, () => xxxCore(exec, input)); }`. For bulk, the composer opens **one** `inWriteTransaction` and loops the extracted `*Core`s N times, calling `bumpDataRevisionCore(exec)` **once** at the end (RESEARCH §bumpDataRevisionCore).

**Change-guard helper to copy** (`bulk-review-dao.ts:34-44`): `assertOneChange(result, op, id)` — throw when `result.changes !== 1`. Every extracted `*Core` uses this loud-failure guard.

**Bulk Quick Log** — cores already exist (`insertInteractionCore` + `recomputeLastContactCore`, aliased at `recency-dao.ts:425-428`). Compose per RESEARCH §1 / Code Examples; call `rejectFutureOccurredAt` before the transaction; NEVER set-wise `INSERT INTO interactions`. (Trip-wire D-05.)

**Bulk Archive** — no core exists; extract `archiveContactCore` from `contacts-dao.ts:536-563` and compose `recordEventCore` (`events-dao.ts:63-82`) per contact. See RESEARCH §2 Code Example (verbatim body given there). (Trip-wire D-06.)

**Bulk Favourite / Snooze / Category / Frequency** — extract non-mutexed cores per RESEARCH §3–6. **All mutex mechanics, signatures, and the non-reentrancy hazard are in RESEARCH's Data-Layer Composition Map — cite it, do not re-investigate.** One `.test.ts` covers all composers (node:sqlite; RESEARCH Wave 0).

---

### Extracted single-column cores (`favourites-dao.ts`, `snooze-dao.ts`, `contacts-dao.ts`)

**Analog for favourites/snooze extraction:** the existing mutexed twins are the exact bodies to lift. `favourites-dao.ts:32-52` (`setFavouriteRank`) and `59-76` (`clearFavouriteRank`) each are `inWriteTransaction(exec, async () => { <UPDATE>; assertChanges; bumpDataRevisionCore })`. **Extraction rule (matches the file's own header comment `favourites-dao.ts:1-15` referencing the `setContactPhoto` pattern):** move the inner arrow body into `setFavouriteRankCore(exec, id, now)` (assumes open txn, no `bump`), keep the public mutexed wrapper delegating to it. Do NOT introduce a rank-rewrite path — membership is `favourite_rank !== null`; rank must never leak into Card order (ADR-075/D-09, RESEARCH Pitfall 5).

**Analog for new single-column category/frequency cores:** `setContactPhotoCore` (`contacts-dao.ts:637-658`, cited VERIFIED in RESEARCH §5) — a `?`-bound single-column `UPDATE contacts SET <col> = ?, modified_at = ? WHERE id = ?` with a `changes === 1` guard. Do NOT route category/frequency through `updateContactMetadataCore` (clobbers unrelated columns — RESEARCH §5/§6, Anti-Patterns). Frequency must carry the positive-integer guard (`!Number.isInteger(x) || x <= 0`) to respect the v11 CHECK + `contacts_prevent_cadence_clear` trigger (RESEARCH §6).

---

### `src/logic/card-line3-selection.ts` (utility, pure transform)

**Analog:** `@/logic/list-row-selection` (`selectLine3`), consumed in `HomeScreen.tsx:600-630` over `readLine3Candidates` (`dashboard-knowledge-read.ts:161`).

**Pattern:** reuse the **same candidate read** (`readLine3Candidates`) — do NOT fork it (RESEARCH Grid Architecture §Adaptive context). Add a compactness-biased selection variant (prefer short values, exclude birthdays, deterministic-per-contact). `Line3CandidateKind = "memory" | "relationship" | "current-state"`. Pure logic + `.test.ts` (RESEARCH Wave 0).

---

### Icon registry entries (`src/components/icons/icon-registry.ts`)

**Analog:** every existing entry in `ICON_REGISTRY` (`icon-registry.ts:33-73`) — an `as const` map of `semantic-name: { outline, filled }` Ionicons pairs. `IconName = keyof typeof ICON_REGISTRY`; **a missing entry fails `tsc` at `Icon.tsx`** (comment line 75).

**Action** (UI-SPEC F-1): add semantic names `select`, `select-all`, `archive`, `snooze` (action), `category`, `frequency`, `overflow`. Follow the exact pair shape:
```typescript
select: { outline: "ellipse-outline", filled: "checkmark-circle" },
"select-all": { outline: "checkmark-done-outline", filled: "checkmark-done" },
archive: { outline: "archive-outline", filled: "archive" },
snooze: { outline: "alarm-outline", filled: "alarm" },
category: { outline: "pricetag-outline", filled: "pricetag" },
frequency: { outline: "repeat-outline", filled: "repeat" },
overflow: { outline: "ellipsis-horizontal", filled: "ellipsis-horizontal" },
```
Confirm exact glyph choices at plan time (F-1). Never fork a second icon source (D-11).

---

## Shared Patterns

### Transaction / mutex composition (all bulk DAO work)
**Source:** `src/db/transaction.ts:49-64` (`inWriteTransaction`), `src/db/mutex.ts:32-36` (non-reentrant), `src/db/bulk-review-dao.ts:72-137` (core/wrapper idiom).
**Apply to:** every bulk composer and every extracted `*Core`.
One `inWriteTransaction` per bulk op; loop non-mutexed `*Core`s inside; `bumpDataRevisionCore` once at the end. NEVER loop a mutexed top-level writer inside a transaction (permanent hang). Full mechanics + per-writer file:line in RESEARCH's Data-Layer Composition Map.

### Loud single-row write guard
**Source:** `bulk-review-dao.ts:34-44` (`assertOneChange`), `favourites-dao.ts:45-49`.
**Apply to:** every extracted single-contact `*Core`. Throw on `changes !== 1` → transaction rolls back → partial-write safety.

### Status ring + glyph + a11y (all card status rendering)
**Source:** `ListRow.tsx:105-121,267-275` + `contact-card-ring.ts` (`ringVisual`/`statusGlyph`/`StatusDisplayState`) + `StatusGlyph.tsx`.
**Apply to:** GridCard. Single source; snooze composed via `isSnoozed`; never-contacted (`null`) → neutral ring + no glyph.

### Presentational-component contract
**Source:** `ContactCard.tsx:1-9`, `ListRow.tsx:1-3`.
**Apply to:** GridCard. No DB read / no navigation inside the card; the host (HomeScreen) wires everything.

### Local wall-clock time
**Source:** `dashboard-query-store.ts:3,88` (`localDateTime()`); CLAUDE.md.
**Apply to:** every `now`/`occurred_at` in bulk writes. Never `toISOString().split('T')[0]` (RESEARCH Pitfall 7).

---

## No Analog Found

None. Every new file has a strong in-repo analog. The two "newest" concepts — the selection store and the compactness-biased line3 selector — have close role-matches (`dashboard-session-store.ts` and `list-row-selection`/`selectLine3` respectively).

---

## Metadata

**Analog search scope:** `src/components/`, `src/components/control-surface/`, `src/components/icons/`, `src/stores/`, `src/db/`, `src/logic/`, `src/screens/HomeScreen.tsx`.
**Files opened & verified this session:** `ListRow.tsx`, `ContactCard.tsx`, `HomeScreen.tsx` (1040-1160), `dashboard-session-store.ts`, `dashboard-query-store.ts`, `bulk-review-dao.ts`, `favourites-dao.ts`, `DashboardControlRow.tsx`, `icon-registry.ts`. Data-layer core file:line claims cited from RESEARCH's on-disk-verified Data-Layer Composition Map (not re-opened, per scope guidance).
**Pattern extraction date:** 2026-09-06
</content>
</invoke>
