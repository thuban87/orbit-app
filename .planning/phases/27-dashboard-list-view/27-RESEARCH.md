# Phase 27: Dashboard List View - Research

**Researched:** 2026-09-05
**Domain:** React Native / Expo virtualized list rendering, gesture-driven row actions, on-device SQLite read/preference plumbing
**Confidence:** HIGH

> **Scope note.** This phase is heavily pre-decided. The dossier, planning-notes, ADR-075, and the gsd-ui-checker-VERIFIED 27-UI-SPEC fix the visual/interaction contract. This document does **not** re-derive design decisions. It pins the exact library/API patterns for the two riskiest under-specified areas (virtualization, swipe rows), confirms the migration/preference plumbing shape on disk, resolves the deterministic line-3 source, and enumerates the landmines. Every code cite below was opened with `Read` this session.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-11 — verbatim intent)
- **D-01:** Read the dossier IN FULL; its dated 2026-09-01 amendment overrides older text. `[DECIDED]`/`[REJECTED]` are settled — reopening/reversing an Accepted ADR or HANDOFF.md entry is an owner decision (stop and ask).
- **D-02:** Read the planning-notes as a binding appendix — every REPLAN finding reflected in the plan; **every trip-wire is a stop-and-ask.**
- **D-03:** This phase ships one small SQLite migration adding the right-swipe logging preference column. Never assume a migration number — verify head+1 on disk. May be folded into the Dashboard-Data preference migration if planned together — **decide once.** All new durable prefs are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage (R-16).
- **D-04 (E-01, ADR-075):** Binary favourites. Star = membership only; immediate fill/unfill + light haptic; no success snackbar; visual revert + error notification on persistence failure. Drag-reorder Manage-favourites screen and `favourite_rank` retired as UX; the List never sorts by rank.
- **D-05 (R-17):** Status glyphs / semantic icon registry / reduced-motion hook — Theme phase (23) delivers them; consume, never fork a second source. **(Now confirmed built — see Verified Codebase State.)**
- **D-06:** Every colour resolves through theme tokens; no hardcoded colour in row rendering.
- **D-07:** Unsnoozed state = two redundant channels (same-weight status-coloured border + distinct non-tappable lower-right status glyph). No status evaluation → neutral border and **no status icon** (no fabricated fifth "Unknown"). Snoozed → neutral border + snooze icon.
- **D-08 (E-02):** `No interactions yet` + neutral border is the **row presentation** for never-contacted rows inside All Contacts / Not Contacted — **not** a change to the Active predicate (Active still excludes never-contacted).
- **D-09:** Right swipe = configured logging action; left swipe = Edit Contact; one row swipe-revealed at a time; tapping a partially swiped row closes the swipe (does not navigate); no destructive swipe actions. Right-swipe choice is a **global** preference (Quick Log vs Log Contact, default Quick Log) — this phase owns storage + read; Settings phase owns UI; onboarding owns early choice.
- **D-10:** AT users get row actions equivalent to gestures (Log Interaction, Edit Contact) + a description covering name, category, recency, favourite state, relationship/snooze state without relying on colour.
- **D-11:** Line 3 is a **deterministic** adaptive context item from existing structured/user-authored knowledge, or one of ~10 lightweight completeness prompts — stable per contact, not changing on re-render. Birthdays excluded; no AI.

### Claude's Discretion
Everything the dossier marks `[DERIVED]`, plus open implementation details not touching a `[DECIDED]` item, an ADR, or HANDOFF.md — including final status-icon artwork, exact row/avatar/spacing tokens, gesture thresholds, animation timings, virtualization tuning, and whether to extend `ContactCard` or add a dedicated `ListRow`.

### Deferred Ideas (OUT OF SCOPE)
Per-contact swipe configuration, additional swipe actions, multi-button swipe drawers, destructive swipe actions; a permanent in-List gesture tutorial (belongs to onboarding); contact-frequency goals beside recency; AI-generated adaptive row copy; profile-completeness scoring/gamification; multi-category semantics; user-controlled density.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LISTV-01 | Full-width medium-compact row: large circular avatar + three-line stack (name / recency+category / adaptive context); ~5–6 rows visible | FlatList (incumbent) + reuse `Avatar`; row anatomy in UI-SPEC; token set (ICON_SIZE/RADII/SPACING) confirmed on disk |
| LISTV-02 | Line 2 = recency + category, or `No interactions yet` for never-contacted | **GAP:** `DashboardRow` does not expose `last_contact` — read model must be additively widened (§ Common Pitfalls P-1). Recency string via a calendar-day formatter modeled on `fuel-age.ts` |
| LISTV-03 | Line 3 = deterministic adaptive item from contact knowledge (imminent → pinned/high-value → other), or stable per-contact completeness prompt | **GAP:** knowledge corpus (`memories`/`relationships`/`current_state_entries`) is not in the read model; reads are per-contact. Recommend a batch knowledge read (§ Deterministic Line 3) |
| LISTV-04 | Always-visible Favorite star; binary toggle, immediate fill/unfill + light haptic, no snackbar, revert + notify on failure | `favourites-dao.ts` `setFavouriteRank`/`clearFavouriteRank`; `Haptics.impactAsync(...Light)`; optimistic-then-revert in row state |
| LISTV-05 | Two redundant channels; neutral border + no glyph for unevaluated; neutral border + snooze glyph for snoozed | `ringVisual().color` (constant width — F-2 trap), `StatusGlyph`, `statusGlyph()`; `StatusDisplayState` union |
| LISTV-06 | Search: name on line 1, lines 2–3 → match explanation + highlighted snippet | `listDashboardSearch` returns `snippet`; match-count/categories rendering is List-side presentation |
| LISTV-07 | Tap opens Profile (partial swipe closes first); right/left swipe; one open at a time; no destructive | `ReanimatedSwipeable` (gesture-handler 2.32.0); open-row coordination via a shared "open ref" (§ Swipe) |
| LISTV-08 | Global Quick Log vs Log Contact (default Quick Log), durable + backup-portable, executes on commit | Migration 020 `app_settings` column; `getAppSettings`; `PORTABLE_SETTINGS_KEYS` allowlist (§ Migration) |
| LISTV-09 | AT row actions equivalent to gestures + colour-free description | `accessibilityActions` on the row Pressable; reuse `StatusGlyph` state labels |
| LISTV-10 | In-place updates + restrained transitions (reduced-motion), skeletons only on initial/delayed load, shared empty/error semantics | `useReducedMotion()`; `MOTION.fast`/`MOTION.base`/`EASING.decelerate`; shared `selectDashboardEmptyState` |
</phase_requirements>

## Summary

Phase 27 is a **renderer** over already-shipped foundations. Nearly all its primitives exist on disk and are confirmed accurate: the semantic icon registry (`icon-registry.ts`), `Icon`/`StatusGlyph`, the pure `ringVisual()`/`statusGlyph()` mappers, `Avatar` with the recycling-safe `contactId`/`cacheBust` keys, `useReducedMotion()`/`useReducedMotionShared()`, `favourites-dao`, the shared read model `dashboard-read.ts`, and the full theme-token set. **No new external package is required.**

The three genuinely under-specified implementation areas are: (1) which virtualized list — resolved to the incumbent **FlatList** (no FlashList dependency exists, and adding one is not justified for a full-width single-column three-line row list); (2) the swipe-to-action row — resolved to **`ReanimatedSwipeable` from `react-native-gesture-handler` 2.32.0** (already a dependency, worklet-driven, `GestureHandlerRootView` already mounted at the app root); and (3) two data gaps in the shared read model — it exposes neither **recency (`last_contact`)** for line 2 nor any **contact-knowledge** for line 3. Both must be filled by **additively widening the Phase 25 batch read** (or adding a sibling batch read keyed by `contact_id IN (...)`), never by per-row queries inside the recycling list.

The migration facts are confirmed exactly as CONTEXT stated: migrations run 001–019, `TARGET_VERSION = 19`, and `019-dashboard-prefs.ts` shipped — so the fold-into-Phase-25 option is foreclosed and the swipe preference is a standalone **migration 020** (head+1), an `app_settings` column following the established `ALTER TABLE ADD COLUMN ... NOT NULL DEFAULT ... CHECK(...)` pattern.

**Primary recommendation:** Build a dedicated `ListRow` component consuming the shared primitives (do not fork them), render it through the existing `FlatList`, wrap each row in `ReanimatedSwipeable` with a single-open coordinator, and additively widen the Phase 25 read to carry `last_contact` + one deterministic top-knowledge item per contact. Ship migration 020 for the global right-swipe preference and allowlist its key in `PORTABLE_SETTINGS_KEYS` (no format bump — that is Phase 36).

## Project Constraints (from CLAUDE.md)

- **Local-first, no network on any read path.** The row render path reads only on-device SQLite via the shared Phase 25 read model. Any new knowledge read is a pure async local `getAllAsync`.
- **Never drive animation from React state.** Swipe translation and result transitions use Reanimated worklets, never `setState`-per-frame. This is the single biggest correctness risk in the phase.
- **All colour resolves through theme tokens** (`src/theme/`). No hardcoded colour, including in any draw call. `npm run check:colors` enforces this.
- **All animation pauses on `useIsFocused === false` and AppState background.**
- Use `formatLocalDate()` from `src/utils/dates.ts`, never `toISOString().split('T')[0]`.
- **Never push; never `git worktree`.** Agents commit in place on the current branch.
- **Review the code, not the diff.** Every writer of a shared table must be read before asserting an invariant; a widened read must be verified against every existing caller of `DashboardRow`.
- DAOs own all SQL; components never inline queries. Zustand for stores; Biome for lint/format.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contact/knowledge/recency reads | Database / DAO (`src/db/dashboard-read.ts`, knowledge reads) | — | Single read chokepoint; no per-row queries in the list |
| Row rendering (avatar, lines, star, glyph, border) | UI component (`ListRow`) | Theme tokens | Presentational; explicit props, no DB access |
| Virtualization / recycling | UI list (`FlatList` on `HomeScreen`) | — | RN built-in; owns scroll surface and cell recycling |
| Swipe gesture + translation | UI worklet (`ReanimatedSwipeable`) | gesture-handler/Reanimated | Worklet thread — never React state (CLAUDE.md) |
| Favourite mutation | Database / DAO (`favourites-dao.ts`) | UI optimistic state | Binary membership write; UI reverts on failure |
| Right-swipe preference storage/read | Database (migration 020 + `app-settings-dao`) | Backup allowlist | Durable `app_settings` column; backup-portable |
| Log / Edit / Profile routing | App Shell / navigation (Phase 22) | UI (gesture exposure) | List owns exposure/routing only, not form/business rules |

## Standard Stack

### Core (all already installed — no new dependency)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native` `FlatList` | 0.86.2 | Virtualized single-column row list | Incumbent; `HomeScreen` already renders `ContactCard`s through it `[VERIFIED: src/screens/HomeScreen.tsx uses FlatList]` |
| `react-native-gesture-handler` | 2.32.0 | Swipe-to-action rows via `ReanimatedSwipeable` | Already a dependency; ships `ReanimatedSwipeable` (worklet-driven) `[VERIFIED: node_modules/react-native-gesture-handler/lib/typescript/components/ReanimatedSwipeable, package.json version 2.32.0]` |
| `react-native-reanimated` | 4.5.1 | Worklet-driven translation + result transitions | Already a dependency; `useReducedMotionShared()` twin already built on it `[VERIFIED: package.json / node_modules version]` |
| `expo-haptics` | ~57.0.2 | Light haptic on favourite toggle | Established: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` `[VERIFIED: src/components/UniversalFab.tsx:165]` |
| `expo-sqlite` | ~57.0.1 | On-device reads + migration 020 | Local-first data layer `[VERIFIED: package.json]` |

### Supporting (shared Orbit primitives — reuse, never reinvent)
| Module | On-disk location | Purpose |
|--------|------------------|---------|
| `Avatar` | `src/components/Avatar.tsx` | Recycling-safe avatar; `contactId` recyclingKey + `cacheBust=modified_at` `[VERIFIED: src/components/Avatar.tsx:45-82]` |
| `Icon` / `ICON_REGISTRY` | `src/components/icons/Icon.tsx`, `icon-registry.ts` | Semantic-name icons only `[VERIFIED: read this session]` |
| `StatusGlyph` / `statusGlyph()` / `ringVisual()` | `src/components/icons/StatusGlyph.tsx`, `src/components/contact-card-ring.ts` | Status glyph + border colour + `StatusDisplayState` `[VERIFIED: contact-card-ring.ts:45-103]` |
| `useReducedMotion()` | `src/theme/use-reduced-motion.ts` | React-twin reduced-motion boolean for crossfade-vs-instant `[VERIFIED: use-reduced-motion.ts:122-132]` |
| `favourites-dao` | `src/db/favourites-dao.ts` | `setFavouriteRank`/`clearFavouriteRank` (binary mark/clear) `[VERIFIED: favourites-dao.ts:32-76]` |
| `dashboard-read` | `src/db/dashboard-read.ts` | Shared population/search/count read model `[VERIFIED: read in full this session]` |
| `app-settings-dao` | `src/db/app-settings-dao.ts` | `getAppSettings` read + `updateAppSettings` write + validators `[VERIFIED: app-settings-dao.ts:417, 880]` |
| Theme tokens | `src/theme/tokens/{icon-size,radii,motion,spacing,typography}.ts` | `ICON_SIZE.md=20`, `RADII.lg=16`, `MOTION.fast=120`/`base=200`, `EASING.decelerate="out"` `[VERIFIED: token files read this session]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `FlatList` | `@shopify/flash-list` | **Not installed** (`[VERIFIED: absent from package.json]`). A new dependency needs justification per the dossier §U reuse rule; a full-width single-column three-line row list is well within FlatList's performance envelope. Recycling correctness for avatars is already solved by `Avatar`'s `recyclingKey`, which works identically under FlatList. Only adopt FlashList if device UAT on the Pixel proves a concrete scroll-jank problem — and that is a device-testing decision, not a plan-time default. |
| `ReanimatedSwipeable` | legacy `Swipeable` | gesture-handler 2.32.0 ships both `[VERIFIED: node_modules .../components/Swipeable.d.ts and ReanimatedSwipeable/]`. The legacy `Swipeable` is Animated-API based; `ReanimatedSwipeable` is the worklet-driven successor and aligns with the CLAUDE.md "never drive animation from React state" rule. Prefer `ReanimatedSwipeable`. |
| `ReanimatedSwipeable` | hand-rolled `Gesture.Pan()` + `useAnimatedStyle` | A raw pan gesture gives finer control but re-implements threshold/resistance/snap-back/open-close state that `ReanimatedSwipeable` provides. Only hand-roll if the built-in cannot express "execute-on-commit with no revealed button" (it can — via `onSwipeableWillOpen`/`onSwipeableOpen` + a small friction/threshold config; see § Swipe). |

**Installation:** none — every library above is already in `package.json`.

## Package Legitimacy Audit

> No external packages are installed by this phase. All libraries used are already present in `package.json` and shipped in prior phases.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none) | — | — | No new dependency introduced |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
  on-device SQLite  │  dashboard-read.ts (single read choke)   │
  (no network)  ───▶│  listDashboardPopulation / …Search       │
                    │  + WIDEN: last_contact (recency)          │
                    │  + WIDEN: one top-knowledge item/contact  │◀── memories / relationships /
                    └───────────────────┬──────────────────────┘    current_state_entries
                                        │  DashboardRow[] (+recency,+knowledge)
                                        ▼
                    ┌─────────────────────────────────────────┐
   HomeScreen  ────▶│  FlatList (scroll surface, recycling)    │
   (freshness:      │   renderItem → <ReanimatedSwipeable>     │
    focus/AppState/ │                  └─▶ <ListRow>           │
    pull-refresh)   └───────────────────┬──────────────────────┘
                                        │
        ┌───────────────────────────────┼─────────────────────────────────┐
        ▼                ▼               ▼               ▼                  ▼
   Avatar          line1 name      line2 recency    line3 adaptive     star (accent)
  (recyclingKey)   line1           +category        /completeness      + StatusGlyph
                                                     (deterministic)    (border colour,
                                                                         const width)
        │                                                                  │
   swipe right → configured log action (pref)        tap(closed)→Profile   │
   swipe left  → Edit Contact                        tap(open)→close swipe │
        │                                                                  │
        ▼                                                                  ▼
   App Shell / navigation (Phase 22)                        favourites-dao (optimistic)
```

### Recommended Project Structure
```
src/
├── components/
│   ├── ListRow.tsx              # NEW — dedicated dense three-line row (F-5: do not overload ContactCard)
│   ├── list-row-content.ts      # NEW — pure, node-tested: recency string, line-3 selection, a11y description
│   └── icons/…                  # REUSE — Icon, StatusGlyph (unchanged)
├── db/
│   ├── dashboard-read.ts        # WIDEN additively — last_contact + top-knowledge projection
│   ├── dashboard-knowledge-read.ts  # NEW (option B) — batch knowledge read keyed by contact_id IN (...)
│   ├── app-settings-dao.ts      # WIDEN — swipe-pref field + validator + updateAppSettings whitelist
│   └── migrations/020-<name>.ts  # NEW — right-swipe preference column
├── logic/
│   └── list-row-selection.ts    # NEW — pure deterministic line-3 priority + prompt selection
└── screens/
    └── HomeScreen.tsx           # WIRE — render ListRow when view mode = list; swipe callbacks
```

### Pattern 1: `ReanimatedSwipeable` execute-on-commit, single row open
**What:** Wrap each row in `ReanimatedSwipeable`; execute the action when the row commits open (crosses the threshold), never on a revealed button tap.
**When to use:** LISTV-07/08 swipe rows.
**Key API surface (react-native-gesture-handler 2.32.0):**
- `renderLeftActions` / `renderRightActions` — draw the progressive-reveal action surface behind the row (semantic action icon + optional short label). Note gesture-handler's convention: `renderLeftActions` renders on the left and is revealed by a **rightward** swipe.
- `onSwipeableWillOpen(direction)` / `onSwipeableOpen(direction)` — fire the action **on commit**; do not require a second tap. Direction is `"left"` | `"right"`.
- `friction`, `leftThreshold` / `rightThreshold`, `overshootLeft`/`overshootRight={false}` — tune resistance and commit distance (values `[DEFERRED]` to Pixel UAT per dossier §U).
- Hold a `ref` to the currently-open row's `SwipeableMethods` (`.close()`) at the list level; on any row's `onSwipeableWillOpen`, close the previously-open ref → "exactly one open at a time" (D-09).
- Tap-on-partially-swiped-row-closes: gate the row's `onPress` — if this row is the open one, call `.close()` and return instead of navigating.
**Worklet/JS boundary:** the translation animation runs on the **UI/worklet thread** inside `ReanimatedSwipeable`. The **commit callbacks** (`onSwipeableOpen`) run on the **JS thread** — safe to call navigation/DAO there. Never mirror translation into React state.

### Pattern 2: Recency string via calendar-day formatter
**What:** Reuse the calendar-day math from `fuel-age.ts` (DST-safe, local-midnight, no UTC off-by-one) to render line 2 `"18d ago"` / `"Today"` / `"Yesterday"` from `last_contact`.
**Example:**
```typescript
// Source: modeled on src/services/fuel-age.ts:65-122 (calendarDaysBetween / formatFuelAge)
// [VERIFIED: src/services/fuel-age.ts read this session]
// Build a pure, node-tested list-recency formatter — do NOT toISOString; use local parts.
// null last_contact → "No interactions yet" (D-08 row presentation, not an Active-predicate change).
```
Note the UI-SPEC copy pattern is `18d ago · Friend` (compact `d`), whereas `formatFuelAge` emits `3 days ago`. Line 2 is List-specific copy — write a small dedicated formatter (reusing the calendar-day helper) rather than calling `formatFuelAge` verbatim.

### Pattern 3: Optimistic favourite toggle with revert
**What:** Flip local row favourite state immediately + light haptic; call the DAO; on failure revert and notify.
**Example:**
```typescript
// Source: src/db/favourites-dao.ts:32-76 + src/components/UniversalFab.tsx:165
// [VERIFIED: both read this session]
// setState(optimistic); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
// try { await (isFav ? clearFavouriteRank : setFavouriteRank)(exec, id, localDateTime()); }
// catch { setState(revert); notify("Couldn't update favourite. Try again."); }
// No success snackbar (D-04). The DAO writes favourite_rank but the UI treats it as binary membership (ADR-075).
```

### Anti-Patterns to Avoid
- **Per-row DB reads inside `renderItem`.** N queries against a recycling list; violates the single-read-chokepoint rule and the local-first read-path perf posture. Batch knowledge into the list read.
- **Wiring `ringVisual().width` into the row border.** It escalates 2/3/4/3 — see F-2. Use `.color` with a **constant** width.
- **Mounting `StatusGlyph` for `state === null`.** It renders `status-neutral`; §J mandates no glyph. See F-3.
- **Driving swipe translation or result transitions from `setState`.** CLAUDE.md hard rule — use worklets.
- **Copying `ContactCard`'s raw pixel styles** (`fontSize: 15`, `borderRadius: 10`, etc. — `[VERIFIED: ContactCard.tsx:214-265]`). The Phase 27 row must consume role-based typography + `SPACING`/`RADII` tokens per the UI-SPEC, not raw px.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture + threshold + snap-back | Custom `PanResponder`/Animated | `ReanimatedSwipeable` | Threshold/resistance/overshoot/open-close all provided; worklet-driven |
| Reduced-motion live signal | `AccessibilityInfo` subscription | `useReducedMotion()` | Already built + node-tested; RN's own `useReducedMotion` reads only at boot (`[VERIFIED: use-reduced-motion.ts:22-25 comment]`) |
| Status colour/glyph/label mapping | New status→visual map | `ringVisual()` / `statusGlyph()` / `StatusGlyph` | Single source; a fork is a D-05 violation |
| Avatar recycling correctness | Bare `<Image>` | `Avatar` | `recyclingKey`/`cacheKey` fold `contactId`+`modified_at`+per-write rev (anti-face-flash) |
| Relative recency math | New date diff | Calendar-day helper from `fuel-age.ts` | DST-safe local-midnight diff; avoids the evening off-by-one bug the repo already fixed |
| Favourite write | New "list favourite" concept | `favourites-dao` | One favourite concept across Profile/List/Card/widget (ADR-075) |

**Key insight:** Every visual/behavioural primitive this phase needs already exists and is verified accurate. The only genuinely new code is the row layout, the swipe wiring, the deterministic line-3 selection logic, the two read-model widenings, and migration 020.

## Runtime State Inventory

> Not a rename/refactor/migration-of-existing-data phase. It ships one additive schema column (migration 020). No existing stored data is renamed or reshaped.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None reshaped. New `app_settings` column (right-swipe pref) seeded by DEFAULT on the singleton row | Additive migration 020 only |
| Live service config | None — no external service | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

## Deterministic Line 3 (LISTV-03 / D-11 / dossier §F/§G)

**On-disk knowledge sources (the corpus a deterministic line-3 item draws from):**
- `memories` table — `type`, `value`, `note`, `url`, `meaningful_date`, `pinned`, `outdated`, `hidden`, `deleted_at` `[VERIFIED: src/db/migrations/016-contact-knowledge.ts:10-27]`. Reads are **per-contact**: `listMemoriesForContact(exec, contactId)` `[VERIFIED: src/db/memories-read.ts:56 WHERE contact_id = ?]`.
- `relationships` table — `person_name`, `relation_type`, `note`, `pinned`, `hidden` `[VERIFIED: 016-contact-knowledge.ts:30-40]`; `listRelationshipsForContact` `[VERIFIED: src/db/relationships-read.ts:31 WHERE contact_id = ?]`.
- `current_state_entries` — `getCurrentStateValue` / `getAllCurrentState` per-contact `[VERIFIED: src/db/current-state-history-read.ts:23,31,48 WHERE contact_id = ?]`.
- `fuel` — the shared read already projects `fuelText` (top ranked fuel line) `[VERIFIED: dashboard-read.ts:136-141, DashboardRow.fuelText:103]`.

**What the Phase 25 read model surfaces today:** `fuelText` and (search only) `snippet`. It does **not** surface `memories`/`relationships`/`current_state_entries` at all `[VERIFIED: DashboardRow interface, dashboard-read.ts:91-113]`.

**Recommended selection approach (deterministic, stable per contact):**
1. **Batch, not per-row.** Add a sibling batch read (e.g. `dashboard-knowledge-read.ts`) that, given the list's contact ids, returns at most one candidate line-3 item per contact via a `contact_id IN (...)` query — the pattern `knowledge-search-read.ts` already uses `[VERIFIED: only knowledge-search-read.ts does batch contact_id IN among the read modules]`. This keeps the read-path single-query and local-first. Alternatively widen `dashboard-read.ts` with a correlated subquery per priority tier, but a dedicated batch read is cleaner to node-test.
2. **Priority order (dossier §F, deterministic):** imminent/time-sensitive (`memories.meaningful_date` within a near window, excluding birthdays — D-11) → pinned/high-value (`memories.pinned = 1` or `relationships.pinned = 1`) → other useful knowledge (most-recent non-hidden, non-outdated, non-deleted memory/relationship/current-state) → fall through to a completeness prompt.
3. **Exclusions:** `deleted_at IS NOT NULL`, `hidden = 1`, `outdated = 1`, and any birthday-typed item are excluded from line 3. Off-limits/`source='ai'`/blank fuel are already excluded by `RANKED_FUEL_EXCLUSIONS` when reusing `fuelText`.
4. **Completeness prompt (no useful context):** pick one of the ~10 prompts (UI-SPEC Copywriting Contract) by a **stable per-contact hash** — e.g. `contactId % PROMPTS.length` — so it never changes on re-render (dossier §G `[DERIVED]`). Put this in a pure, node-tested module.
5. **Leading icon (dossier §F, optional):** if shown, it must resolve to a **registered `IconName`**. The memory registry's `iconSemantic` values (`"memory"`, `"custom_memory"`) are **not** registered in `ICON_REGISTRY` `[VERIFIED: icon-registry.ts has no "memory"/"custom_memory" keys]` — either register a semantic name in Theme's registry (single source — do not fork) or omit the leading icon (§F permits plain text). Registering a new name is a registry edit; confirm it does not collide.

**No AI, no birthdays, stable per contact** — all three are hard constraints (D-11).

## Common Pitfalls

### Pitfall P-1: The shared read model has no recency (LISTV-02 blocker)
**What goes wrong:** `DashboardRow` exposes `status`/`progress` but **not** `last_contact` `[VERIFIED: dashboard-read.ts:91-113]`. `ContactCard` deliberately shows nothing log-derived `[VERIFIED: ContactCard.tsx:16-18 comment]`. So line 2 `"18d ago"` has no data source in the current read.
**How to avoid:** Additively add `c.last_contact` to the `listDashboardPopulation` and `listDashboardSearch` projections and to `DashboardRow`. This is a pure additive read change; verify every existing `DashboardRow` consumer (HomeScreen, ContactCard mapping, tests) still typechecks — additive optional/added fields are safe, but per "review the code, not the diff," open each caller.
**Warning signs:** a plan that renders line 2 recency without touching `dashboard-read.ts` is wrong.

### Pitfall P-2: `ringVisual().width` escalation on the row border (F-2)
**What goes wrong:** `ringVisual()` returns escalating widths — stable 2 / wobble 3 / decay 4 / rogue 3 / null 2 `[VERIFIED: contact-card-ring.ts:51-60]`. Wiring `.width` into the row border makes severity change border thickness, violating §I's same-weight rule.
**How to avoid:** Use `ringVisual(status, colors).color` with a **constant** border width (UI-SPEC recommends 2px). Never read `.width` for the row border.

### Pitfall P-3: Fabricating a status glyph for never-contacted (F-3)
**What goes wrong:** `statusGlyph(null)` returns `"status-neutral"` and `StatusGlyph state={null}` renders it `[VERIFIED: contact-card-ring.ts:99-102, StatusGlyph.tsx:55-63]`. §J mandates **no** glyph for `null`.
**How to avoid:** In the row, branch: if `displayState === null` render the neutral border and **do not mount `StatusGlyph`**. Only mount it for the four real states and `"snoozed"`.

### Pitfall P-4: Snooze is composed by the consumer, not a query-time status
**What goes wrong:** `StatusDisplayState = ProfileStatus | "snoozed" | null` `[VERIFIED: contact-card-ring.ts:73]`, but the read model's `status` is `ProfileStatus | null` — it never returns `"snoozed"`. Snooze is `contacts.snooze_until`, a separate condition.
**How to avoid:** The row composes `"snoozed"` onto the computed status when the contact is currently snoozed (border → neutral, glyph → `status-snoozed`). Note: `snooze_until` is **not** in `DashboardRow` today either — a snoozed row inside a snoozed population is known via the `isSnoozed` match flag, but for per-row snooze presentation the read may need `snooze_until` projected too (additive). Confirm which populations can contain a snoozed row before deciding.

### Pitfall P-5: Star icon still maps to a heart (F-4)
**What goes wrong:** `ICON_REGISTRY.favorite = { outline: "heart-outline", filled: "heart" }` `[VERIFIED: icon-registry.ts:37]`. The dossier/REQUIREMENTS say "Favorite **star**."
**Resolution (OWNER DECIDED — use star):** Change the single registry pair to `star-outline`/`star`. This is **safe**: there is **no `<Icon name="favorite">` consumer anywhere** — the only favourite marker rendered today is a literal `"★"` string in `ContactCard.tsx:189` (Card View / Phase 28 concern) `[VERIFIED: grep for "favorite" across src returns only icon-registry.ts:37 and its existence-check test; no Icon consumer]`. Ionicons provides both `star` and `star-outline` `[VERIFIED: node_modules/@expo/vector-icons Ionicons glyphmap contains "star" and "star-outline"]`, validated at `tsc` by `Icon.tsx` `[VERIFIED: Icon.tsx:43-44]`. The Phase 27 row should render `<Icon name="favorite" state={isFav ? "active" : "default"} tone={isFav ? "accent" : "textSecondary"}>` rather than a literal glyph. Editing the registry is a Theme-owned single-source change — confirm no future consumer depends on a heart before landing.

### Pitfall P-6: `favourite_rank` leaking back as order
**What goes wrong:** `favourites-dao` still writes `favourite_rank` (append pattern) `[VERIFIED: favourites-dao.ts:39-44]` and `listFavourites` orders by it `[VERIFIED: dashboard-read.ts:465-472]`. ADR-075 forbids any ranked-favourites UX and the List never sorts by rank.
**How to avoid:** The List consumes favourites through the normal population/Default ordering, never `listFavourites`/`favourite_rank`. Treat the star as binary membership only.

### Pitfall P-7: DST / UTC off-by-one in recency
**How to avoid:** Reuse the local-midnight calendar-day diff from `fuel-age.ts` `[VERIFIED: fuel-age.ts:33-73]`; never `toISOString()`; use `formatLocalDate()` for any date rendering.

## Migration & Preference Plumbing (D-03 / R-16 / LISTV-08)

**Confirmed facts (read on disk this session):**
- Migrations run **001–019**; `TARGET_VERSION = 19` `[VERIFIED: ls src/db/migrations/ shows 001..019; src/db/database.ts:54 `export const TARGET_VERSION = 19;`]`.
- `019-dashboard-prefs.ts` **shipped** (executed) `[VERIFIED: src/db/migrations/019-dashboard-prefs.ts read this session]`. Therefore the fold-into-Phase-25 option is **foreclosed** — the swipe preference is a **standalone migration 020 (head+1)**.

**Exact column pattern (mirror 019 / 002):**
```sql
-- migration 020: additive, forward-only, runs inside the runner's per-step transaction.
-- Source pattern: 019-dashboard-prefs.ts:13-27 + 002-app-settings.ts:38-50 [VERIFIED both read this session]
ALTER TABLE app_settings
  ADD COLUMN dashboard_right_swipe_action TEXT NOT NULL DEFAULT 'quick-log'
    CHECK(dashboard_right_swipe_action IN ('quick-log', 'log-contact'));
```
- `NOT NULL DEFAULT 'quick-log'` seeds the existing singleton row (default Quick Log, D-09/O) with no partial state on a v-any→v20 jump.
- Verify head+1 again **at plan time** (numbers drift every schema phase) — as of 2026-09-05 head is 019, so this is 020. Register `migration020` in the `MIGRATIONS` array and bump `TARGET_VERSION` to 20 `[pattern VERIFIED: database.ts:54, migration runner registration]`.

**Read path:** add the field to `AppSettings` / `AppSettingsRow` and to the `getAppSettings` SELECT `[VERIFIED: app-settings-dao.ts:417-421 getAppSettings]`. Add a validator mirroring `assertDashboardSort` `[VERIFIED: app-settings-dao.ts:744]` and include the field in `AppSettingsPatch` + the `updateAppSettings` whitelist `[VERIFIED: app-settings-dao.ts:229,880]`. Consider a closed union/parse helper in `dashboard-query-logic.ts` mirroring `DASHBOARD_SORT_MODES` `[VERIFIED: dashboard-query-logic.ts:118-126]`. **This phase owns storage + read only; Settings UI is Phase 15, onboarding early choice is Phase 17.**

**Backup portability (R-16):** add the camelCase key `dashboardRightSwipeAction` to `PORTABLE_SETTINGS_KEYS` **now** — allowlist only. Do **not** emit it in `getPortableSettingsSnapshot`, do **not** bump `BACKUP_FORMAT_VERSION`, do **not** add a `FORWARD_MIGRATIONS` entry — those are **Phase 36** scope, exactly as the Phase 25 dashboard keys were handled `[VERIFIED: src/backup/backup-schema.ts:166-173 + 155-158 comments]`. `assertPortableSettings` rejects any non-allowlisted key `[VERIFIED: backup-schema.ts:200-204]`, so a future format-N backup carrying the key must be allowlisted ahead of time — hence "allowlist now."

## Code Examples

### Single-open swipe coordination (list-level)
```typescript
// Source: react-native-gesture-handler 2.32.0 ReanimatedSwipeable API
// [CITED: react-native-gesture-handler docs — ReanimatedSwipeable]
// A ref to the currently-open row's SwipeableMethods; closed when another opens.
const openRowRef = useRef<SwipeableMethods | null>(null);
// In each row: onSwipeableWillOpen={() => { if (openRowRef.current && openRowRef.current !== self) openRowRef.current.close(); openRowRef.current = self; }}
// Row onPress: if (openRowRef.current === self) { self.close(); openRowRef.current = null; return; } navigateToProfile();
// onSwipeableOpen(direction) — JS thread: direction === "right" ? executeConfiguredLogAction() : routeToEdit();
```

### Reduced-motion result transitions
```typescript
// Source: src/theme/use-reduced-motion.ts:122-132 + src/theme/tokens/motion.ts [VERIFIED both read this session]
const reduced = useReducedMotion();          // React-twin boolean (re-renders on live toggle)
// enter transition: reduced ? instant apply : LayoutAnimation/withTiming(MOTION.fast=120, EASING.decelerate="out")
// Keep current content visible on fast Population/Filter/Sort/Search changes; skeletons only on initial/delayed load (LISTV-10).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| R-17: "status glyphs / icon registry / reduced-motion do not exist" | All three shipped by Theme phase 23 | 2026 (Phase 23) | Phase 27 **consumes**; never forks. CONTEXT D-05 is stale; UI-SPEC "Verified Codebase State" is authoritative |
| gesture-handler legacy `Swipeable` (Animated) | `ReanimatedSwipeable` (worklet) | gesture-handler 2.x | Prefer the worklet variant (CLAUDE.md no-setState-per-frame) |

**Deprecated/outdated:** RN's own `react-native-reanimated` `useReducedMotion()` reads the value at boot only and never updates on a live OS toggle — the repo's `use-reduced-motion.ts` exists precisely to fix this `[VERIFIED: use-reduced-motion.ts:22-25]`. Do not substitute the library hook.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FlatList is sufficient for the List View's scroll/recycling performance on the Pixel | Standard Stack / Alternatives | If device UAT shows jank, FlashList adoption is a follow-up dependency decision (owner: risk/perf posture) — not a plan-time default |
| A2 | Adding `last_contact` (and possibly `snooze_until`) to `DashboardRow` is purely additive and breaks no existing consumer | Pitfall P-1/P-4 | A non-additive change would ripple into Card View/HomeScreen/tests; must open every consumer per "review the code, not the diff" |
| A3 | A batch knowledge read (`contact_id IN (...)`) is the right shape for line 3 vs. correlated subqueries in `dashboard-read.ts` | Deterministic Line 3 | Either works; the batch read is easier to node-test and keeps `dashboard-read.ts` from growing a knowledge dependency. Implementation detail (Claude's discretion) |
| A4 | Registering a `memory`-type leading icon in `ICON_REGISTRY` (if a leading icon is shown) is collision-free | Deterministic Line 3 | A registry edit is Theme-owned single-source; confirm no consumer relies on the name. §F permits omitting the icon, so this is optional |

**Note:** Package/version claims and the migration/read facts are `[VERIFIED]` against on-disk files this session, not assumed.

## Open Questions

1. **Does any list-visible population contain snoozed contacts requiring per-row snooze presentation?**
   - What we know: `snooze_until` is not yet written by any shipped writer (Phase 11 owns it) `[VERIFIED: dashboard-read.ts:33-36, 500-508 comments]`; `countSnoozed` is legitimately 0 today.
   - What's unclear: whether the List must render the snoozed presentation (neutral border + moon) now, given no data exists yet.
   - Recommendation: implement the snoozed branch (it is a `[DECIDED]` contract, D-07/K) driven by a projected `snooze_until`; it will simply never trigger until Phase 11 writes the column. Do not skip it.

2. **Leading semantic icon on line 3 — show or omit for v1?**
   - What we know: §F says a small leading icon "may" be shown and "may remain plain text."
   - Recommendation: omit unless the knowledge item's type maps cleanly to an already-registered `IconName`; adding new registry names is a Theme single-source edit. Owner/planner discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-native FlatList | LISTV-01 | ✓ (built-in) | RN 0.86.2 | — |
| react-native-gesture-handler | LISTV-07 | ✓ | 2.32.0 | — |
| react-native-reanimated | LISTV-07/10 | ✓ | 4.5.1 | — |
| expo-haptics | LISTV-04 | ✓ | ~57.0.2 | — |
| GestureHandlerRootView (app root) | LISTV-07 | ✓ mounted | App.tsx:408 | — |
| Physical Pixel 6 Pro (perf UAT) | thresholds/perf | device-dependent | — | Perf/gesture thresholds are `[DEFERRED]` to on-device UAT (dossier §U); emulator cannot assess Skia/gesture perf |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all libraries present.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (node environment) `[VERIFIED: package.json devDependencies + scripts.test]` |
| Config file | none dedicated; `npm test` = `vitest run` |
| Quick run command | `npx vitest run <path/to/file.test.ts>` |
| Full suite command | `npm test` |

> Repo convention (from STATE.md accumulated context): correctness-critical logic is extracted into pure, `react-native`-free `*-logic.ts` / `*-read.ts` / `*.ts` modules and node-tested with Vitest; `.tsx` render/gesture is verified by on-device Pixel UAT (the repo has no react-test-renderer).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LISTV-02 | Recency string (`Today`/`18d ago`/`No interactions yet`) from `last_contact` | unit | `npx vitest run src/components/list-row-content.test.ts` | ❌ Wave 0 |
| LISTV-03 | Deterministic line-3 priority + stable prompt selection | unit | `npx vitest run src/logic/list-row-selection.test.ts` | ❌ Wave 0 |
| LISTV-02/03 | Widened read projects last_contact + knowledge; never-contacted → null | unit | `npx vitest run src/db/dashboard-read.test.ts` (extend) / new knowledge read test | ⚠️ extend + ❌ Wave 0 |
| LISTV-08 | Migration 020 adds column + default; up from v-any | unit | `npx vitest run src/db/migrations/020-*.test.ts` | ❌ Wave 0 |
| LISTV-08 | `getAppSettings`/`updateAppSettings`/validator round-trip the pref | unit | `npx vitest run src/db/app-settings-dao.test.ts` (extend) | ⚠️ extend |
| LISTV-08 | Portable key allowlisted; `assertPortableSettings` accepts it | unit | `npx vitest run src/backup/backup-schema.test.ts` (extend) | ⚠️ extend |
| LISTV-05/09 | `statusGlyph`/`ringVisual`/`StatusGlyph` composition + a11y labels | unit | existing `contact-card-ring` / `icon-registry` tests + a11y-description unit test | ⚠️ extend |
| LISTV-04/05/06/07/09/10 | Row render, swipe gestures, in-place transitions, a11y actions | manual (device) | Pixel UAT (desktop-build-pipeline) | manual |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed test file>` + `npx tsc --noEmit` + `npm run check:colors`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + `npm run check:colors` green before `/gsd-verify-work`; then Pixel UAT for gesture/render/transition (LISTV-04..10 UI-observable behaviors).

### Wave 0 Gaps
- [ ] `src/components/list-row-content.test.ts` — recency string + a11y description (LISTV-02/09)
- [ ] `src/logic/list-row-selection.test.ts` — deterministic line-3 selection (LISTV-03)
- [ ] `src/db/migrations/020-*.test.ts` — column + default + forward-jump (LISTV-08)
- [ ] New batch knowledge read test (LISTV-03) — if option B chosen
- [ ] Extend `dashboard-read.test.ts`, `app-settings-dao.test.ts`, `backup-schema.test.ts`
- [ ] Framework install: none needed — Vitest present

## Security Domain

> `security_enforcement: true` `[VERIFIED: .planning/config.json]`. This is a read-render phase over local SQLite plus one additive preference column; the threat surface is narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-first, no accounts |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user on-device DB |
| V5 Input Validation | yes | The right-swipe pref is validated by a closed-union `CHECK` constraint (migration 020) **and** an `assert*` validator in `app-settings-dao` before any UPDATE (mirror `assertDashboardSort` `[VERIFIED: app-settings-dao.ts:744]`); a hand-edited backup value is re-validated at restore. Search term is `?`-bound + `escapeLike` in the shared read (`[VERIFIED: dashboard-read.ts:411-420]`) — the List does not re-implement query logic |
| V6 Cryptography | no | No new crypto in this phase |

### Known Threat Patterns for RN/SQLite renderer
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via search / new knowledge read | Tampering | All runtime values `?`-bound; only closed code-constants interpolated (established pattern in `dashboard-read.ts`) `[VERIFIED: dashboard-read.ts:43-51 injection note]` |
| Tampered backup preference value | Tampering | `CHECK` constraint + `assertPortableSettings` allowlist + validator on restore |
| Network on a read path | Info disclosure / product-breach | None — the row render path is pure local SQLite; no fetch anywhere (CLAUDE.md local-first) |
| Private data resurfacing (off-limits/AI fuel) | Info disclosure | Exclusions applied **in-query** by the shared read (`RANKED_FUEL_EXCLUSIONS`), never a UI `.filter()` `[VERIFIED: dashboard-read.ts:45-50]`; a new knowledge read must apply the same `hidden`/`deleted_at`/`outdated` exclusions |

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/db/dashboard-read.ts` — read model, `DashboardRow`, injection posture, never-contacted guard
- `src/db/migrations/019-dashboard-prefs.ts`, `002-app-settings.ts` — app_settings column pattern; `src/db/database.ts:54` TARGET_VERSION
- `src/db/app-settings-dao.ts` — `getAppSettings`, `updateAppSettings`, validators
- `src/backup/backup-schema.ts` — `PORTABLE_SETTINGS_KEYS`, allowlist-now / emit-later posture
- `src/components/contact-card-ring.ts` — `ringVisual` (width escalation), `statusGlyph`, `StatusDisplayState`
- `src/components/icons/{icon-registry.ts,Icon.tsx,StatusGlyph.tsx}` — favorite=heart, tsc-validated glyphs, null→neutral
- `src/components/Avatar.tsx` — recyclingKey/cacheBust; `src/components/ContactCard.tsx` — legacy row, raw px, literal ★
- `src/theme/use-reduced-motion.ts`; `src/theme/tokens/{icon-size,radii,motion}.ts` — token values
- `src/services/fuel-age.ts` — DST-safe calendar-day recency formatter
- `src/db/{memories-read,relationships-read,current-state-history-read,first-class-knowledge-read}.ts`, `memory-registry.ts`, `migrations/016-contact-knowledge.ts` — knowledge corpus
- `package.json`, `node_modules/react-native-gesture-handler` (2.32.0, ReanimatedSwipeable), `node_modules/react-native-reanimated` (4.5.1), Ionicons glyphmap (star/star-outline)
- `App.tsx:408` — GestureHandlerRootView mounted

### Secondary (MEDIUM confidence)
- react-native-gesture-handler `ReanimatedSwipeable` API surface (`renderLeftActions`/`onSwipeableOpen`/`friction`/`*Threshold`/`SwipeableMethods.close()`) — from the library's public docs/types

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified in package.json/node_modules; no new dependency
- Architecture / read-model gaps: HIGH — read model + gaps verified against source this session
- Migration/preference plumbing: HIGH — head=019/TARGET_VERSION=19, patterns read verbatim
- Swipe API specifics: MEDIUM — library present + `ReanimatedSwipeable` confirmed shipped; exact prop tuning is device-UAT deferred
- Deterministic line 3: HIGH on the corpus/read facts; MEDIUM on the exact selection shape (Claude's discretion)

**Research date:** 2026-09-05
**Valid until:** 2026-10-05 (stable local stack; re-verify TARGET_VERSION / migration head at plan time — schema numbers drift every schema phase)
