# Phase 27: Dashboard List View - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 9 (5 NEW, 4 MODIFIED)
**Analogs found:** 8 / 9 (swipe row has no in-repo analog — see § No Analog Found)

> Every file:line reference below was opened with `Read` this session and verified on disk (CLAUDE.md "review the code, not the diff"). Where the research (`27-RESEARCH.md`) and this map diverge, this map is on-disk-authoritative.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ListRow.tsx` (NEW) | component | render / request-response | `src/components/ContactCard.tsx` | role-match (denser 3-line anatomy; reuse primitives, do not fork raw px) |
| `src/components/list-row-content.ts` (NEW) | utility (pure) | transform | `src/services/fuel-age.ts` | role+flow match (calendar-day formatter) |
| `src/logic/list-row-selection.ts` (NEW) | utility (pure) | transform / deterministic-selection | `src/components/contact-card-ring.ts` (pure mapper idiom) | partial (no existing line-3 selector) |
| `src/db/dashboard-knowledge-read.ts` (NEW, option B) | read model (DAO) | batch read (`contact_id IN`) | `src/db/knowledge-search-read.ts` | exact (batch `contact_id IN (${placeholders})`) |
| `src/db/migrations/020-<name>.ts` (NEW) | migration | schema (additive column) | `src/db/migrations/019-dashboard-prefs.ts`, `002-app-settings.ts` | exact |
| `src/db/dashboard-read.ts` (MODIFIED, additive widen) | read model (DAO) | CRUD read (projection widen) | itself (additive to `DashboardRow` + `CARD_*` projections) | in-place widen |
| `src/db/app-settings-dao.ts` (MODIFIED) | DAO | CRUD (pref read/write/validate) | itself (`dashboardSort` field pattern) | in-place widen |
| `src/backup/backup-schema.ts` (MODIFIED) | config (allowlist) | validation | itself (Phase 25 dashboard keys block) | in-place widen |
| `src/components/icons/icon-registry.ts` (MODIFIED) | config (registry) | lookup | itself (`favorite` pair edit) | in-place edit |
| `src/screens/HomeScreen.tsx` (WIRE) | screen | render/list host | itself (existing `FlatList`+`ContactCard`) | in-place wire |

---

## Pattern Assignments

### `src/components/ListRow.tsx` (component, render)

**Analog:** `src/components/ContactCard.tsx` (read in full). **Reuse the composition idiom and prop contract; do NOT copy its raw pixel styles** — the row must consume theme tokens + typography roles per 27-UI-SPEC.

**Purely-presentational contract (copy this discipline)** — `ContactCard.tsx:1-72`: no DB read, no `getExecutor`, no `useNavigation`; caller wires `onPress` and passes explicit props scoped by `dashboard-read`; no `.filter()` that could resurface private data. `ListRow` follows the same rule.

**Imports pattern** (`ContactCard.tsx:40-49`):
```typescript
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { ProfileStatus } from "@/db/contact-status-read";
import { useTheme } from "@/theme";
import { ringVisual } from "./contact-card-ring";
```
Add for the row: `import { Icon } from "@/components/icons/Icon";`, `import { StatusGlyph } from "@/components/icons/StatusGlyph";`, `import { statusGlyph, type StatusDisplayState } from "@/components/contact-card-ring";`.

**Theme resolution + status colour** (`ContactCard.tsx:107-113`):
```typescript
const { colors } = useTheme();
const ring = ringVisual(status, colors);
```
**F-2 / Pitfall P-2:** use `ring.color` with a **constant** border width (UI-SPEC recommends 2px). Never wire `ring.width` (escalates 2/3/4/3, verified `contact-card-ring.ts:51-60`) into the row border.

**Avatar reuse (recycling-safe — CORRECTNESS, not optimization)** (`ContactCard.tsx:127-133`):
```typescript
<Avatar photo={photo} name={name} contactId={contactId} size={/* 64-72 class */} cacheBust={modifiedAt} />
```

**Line 1 name (ellipsize idiom)** (`ContactCard.tsx:151-158`):
```typescript
<Text numberOfLines={1} ellipsizeMode="tail" style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
```

**Favourite marker — REPLACE the literal glyph.** `ContactCard.tsx:182-191` renders a literal `"★"` string in `colors.accent`. The new row must render through the registry instead (F-4, OWNER DECIDED — star):
```typescript
<Icon name="favorite" state={isFav ? "active" : "default"} tone={isFav ? "accent" : "textSecondary"} />
```
with a ≥44px tappable hit area (UI-SPEC Row Anatomy). No success snackbar (D-04).

**Status glyph — branch on null (F-3 / Pitfall P-3).** `statusGlyph(null)` returns `"status-neutral"` and `StatusGlyph state={null}` renders it (verified `contact-card-ring.ts:99-102`, `StatusGlyph.tsx:55-63`). §J mandates NO glyph for never-contacted:
```typescript
{displayState !== null && <StatusGlyph state={displayState} size="md" />}
```
Compose `"snoozed"` onto the computed `ProfileStatus` when `snooze_until` is active (border→neutral, glyph→moon) — snooze is not a query-time status (`contact-card-ring.ts:64-73`).

**Accessibility (D-10 / LISTV-09):** row description covers name, category, recency, favourite state, relationship/snooze state without colour. Reuse the exact state labels already defined in `StatusGlyph.tsx:37-44` (`Stable`/`Wobbling`/`Decaying`/`Rogue`/`Snoozed`/`Not yet contacted`). Add `accessibilityActions` (Log Interaction, Edit Contact) on the row Pressable — the glyph stays decorative (state carried by the row description; do not double-announce).

**Do NOT copy** (`ContactCard.tsx:214-265`): `fontSize: 15/13`, `borderRadius: 10`, raw `gap:12`. Consume `SPACING`, `RADII.lg` (16), and typography roles per UI-SPEC.

---

### `src/components/list-row-content.ts` (utility, transform)

**Analog:** `src/services/fuel-age.ts` (read `fuel-age.ts:33-122`). Reuse the **calendar-day math**, write List-specific copy — do NOT call `formatFuelAge` verbatim (it emits `"3 days ago"`; the row wants compact `"18d ago"`).

**DST-safe calendar-day diff to copy** (`fuel-age.ts:33-73`) — `parseLocalMs` (regex-parses local Y/M/D, never `new Date(string)`), `calendarDaysBetween` (UTC-anchored local midnights, no DST skew). This is the repo's fix for the evening off-by-one; never `toISOString().split('T')[0]`, use `formatLocalDate()` for any date rendering.

Row-recency rules (LISTV-02 / D-08): `null last_contact` → `"No interactions yet"` (row presentation only, NOT an Active-predicate change); same day → `"Today"`; 1 day → `"Yesterday"`; else `"{n}d ago"`. Compose line 2 as `"{recency} · {category}"` (UI-SPEC copy). Pure, node-tested (`list-row-content.test.ts`).

---

### `src/logic/list-row-selection.ts` (utility, deterministic selection)

**Analog:** the **pure-mapper idiom** in `src/components/contact-card-ring.ts:45-103` (PURE, TOTAL, deterministic switch, `react-native`-free, node-tested). No existing line-3 selector — the selection *logic* is net-new, but follow that module's purity contract so it is Vitest-testable.

Priority order (D-11 / dossier §F, deterministic): imminent/time-sensitive (`memories.meaningful_date` near window, **birthdays excluded**) → pinned/high-value (`memories.pinned` / `relationships.pinned`) → other useful knowledge (most-recent non-hidden/non-outdated/non-deleted) → completeness prompt. Prompt selection is a **stable per-contact hash** (`contactId % PROMPTS.length`) so it never changes on re-render. No AI. Prompt strings are canon in 27-UI-SPEC Copywriting Contract — reuse verbatim.

---

### `src/db/dashboard-knowledge-read.ts` (read model, batch — option B)

**Analog:** `src/db/knowledge-search-read.ts` (batch `contact_id IN` pattern verified this session):
```typescript
// knowledge-search-read.ts:105,113,137 — batch keyed by the visible contact ids
AND contact_id IN (${placeholders(eligibleIds)})
```
Given the list's contact ids, return at most one candidate line-3 item per contact. **Never per-row queries inside `renderItem`** (anti-pattern; single-read-chokepoint rule). Apply the same in-query exclusions the shared read uses — `hidden`/`deleted_at IS NOT NULL`/`outdated`, and `RANKED_FUEL_EXCLUSIONS` for any fuel reuse (`dashboard-read.ts:43-50`). All runtime values `?`-bound; only closed code-constants interpolated. (Alternative: correlated subqueries widened into `dashboard-read.ts` — A3, Claude's discretion; batch read is cleaner to node-test.)

---

### `src/db/migrations/020-<name>.ts` (migration, additive schema)

**Analog:** `src/db/migrations/019-dashboard-prefs.ts` (read in full). **Verified head+1:** `ls src/db/migrations/` head is `019`; `src/db/database.ts:54` `export const TARGET_VERSION = 19` — so this is **020**.

**Exact pattern** (`019-dashboard-prefs.ts:10-29`):
```typescript
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";
export const migration020: Migration = {
  version: 20,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN dashboard_right_swipe_action TEXT NOT NULL DEFAULT 'quick-log'
          CHECK(dashboard_right_swipe_action IN ('quick-log', 'log-contact'));
    `);
  },
};
```
`NOT NULL DEFAULT 'quick-log'` seeds the singleton row (default Quick Log, D-09/O) on any v-any→v20 jump. Register `migration020` in the `MIGRATIONS` array and bump `TARGET_VERSION` to 20 (`database.ts:54,153`). Forward-only, never edit a shipped migration. **Re-verify head+1 at plan time** — schema numbers drift every phase. Test: `020-*.test.ts` (column + default + forward-jump).

---

### `src/db/dashboard-read.ts` (read model, ADDITIVE widen — NOT a fork, NOT per-row)

**Analog:** itself. **Pitfall P-1 (LISTV-02 blocker):** `DashboardRow` (verified `dashboard-read.ts:91-113`) exposes `status`/`progress` but **not** `last_contact`; `ContactCard` deliberately shows nothing log-derived (`ContactCard.tsx:16-18`). Line 2 recency has no data source today.

**Widen additively:**
- Add `c.last_contact` to the `listDashboardPopulation` + `listDashboardSearch` projections and to `DashboardRow` (`dashboard-read.ts:91-113`). `c.last_contact` is already selected/used in `CARD_STATUS` (`:148-149`) and `SORT` (`:185-186`) — it exists on `contacts`, just not projected out.
- **Pitfall P-4:** also project `c.snooze_until` (additive) so the row composes the `"snoozed"` display state per-row. Snooze storage contract at `dashboard-read.ts:33-36`; no shipped writer yet (Phase 11) — the branch simply never triggers until then, do not skip it (Open Q1).
- Follow the injection posture at `dashboard-read.ts:43-51`: static query strings, closed-constant fragments, `?`-bound runtime values, `escapeLike` on the term.

**Per A2 / "review the code, not the diff":** open every existing `DashboardRow` consumer before landing — `HomeScreen.tsx:680-693` (ContactCard mapping), `ContactCard.tsx` prop contract, and `dashboard-read.test.ts`. Additive optional fields are safe but confirm each typechecks.

---

### `src/db/app-settings-dao.ts` (DAO, pref read/write/validate)

**Analog:** itself — mirror the `dashboardSort` field end-to-end (all verified this session):
- **Read:** add `dashboard_right_swipe_action` to the `getAppSettings` SELECT (`app-settings-dao.ts:417-436`) and to `AppSettings`/`AppSettingsRow`.
- **Key→column map:** add to the camelCase→snake map alongside `dashboardSort: "dashboard_sort"` (`app-settings-dao.ts:400`).
- **Validator** (mirror `assertDashboardSort`, `app-settings-dao.ts:744-753`):
```typescript
export function assertDashboardRightSwipeAction(field: string, v: unknown): void {
  if (typeof v !== "string" || !(RIGHT_SWIPE_ACTIONS as readonly string[]).includes(v)) {
    throw new Error(`updateAppSettings: ${field} must be a known right-swipe action, got ${String(v)}`);
  }
}
```
- **Whitelist:** add the `patch.dashboardRightSwipeAction !== undefined` guard in `validateAppSettingsPatch` alongside `:843-845`, and add the field to `AppSettingsPatch`.
- **Closed union:** define `RIGHT_SWIPE_ACTIONS` mirroring `DASHBOARD_SORT_MODES` (`dashboard-query-logic.ts:118-126`).
- **This phase owns storage + read only.** Settings UI = Phase 15; onboarding early choice = Phase 17.

---

### `src/backup/backup-schema.ts` (config, allowlist)

**Analog:** the Phase 25 dashboard keys block (verified `backup-schema.ts:166-173`). Add the camelCase key **allowlist-only, now**:
```typescript
// after "dashboardSort" — allowlist NOW so a future format backup can carry it.
"dashboardRightSwipeAction",
```
Do NOT emit it in `getPortableSettingsSnapshot`, do NOT bump `BACKUP_FORMAT_VERSION`, do NOT add a `FORWARD_MIGRATIONS` entry — those are **Phase 36** scope (the exact posture the Phase 25 keys took, `:166-168`). `assertPortableSettings` (`:194-204`) rejects any non-allowlisted key, so the allowlist must precede any format-N backup that carries the key.

---

### `src/components/icons/icon-registry.ts` (config, registry — OWNER DECIDED)

**Analog:** itself. Change the single `favorite` pair (verified `icon-registry.ts:37`):
```typescript
favorite: { outline: "star-outline", filled: "star" },   // was heart-outline / heart
```
**Safety confirmed this session:** grep across `src/` (excluding tests) for `"favorite"` returns **only** `icon-registry.ts:37` — there is **no `<Icon name="favorite">` consumer anywhere**. The only favourite marker rendered today is the literal `"★"` in `ContactCard.tsx:189` (Card View / Phase 28). Ionicons provides `star`/`star-outline`, validated at `tsc` by `Icon.tsx`. Single-source change; no fork.

---

### `src/screens/HomeScreen.tsx` (screen, list host — WIRE)

**Analog:** its existing `FlatList` (verified `HomeScreen.tsx:677-708`) — incumbent virtualization, `keyExtractor={(item) => String(item.id)}`, `renderItem` returning `ContactCard`, `RefreshControl`, `ListEmptyComponent`/`ListHeaderComponent`. Wire: render `ListRow` (wrapped in the swipe row) when `query.viewMode === "list"`; keep `ContactCard` for card mode (Phase 28). Reuse the shared empty/error host (`selectDashboardEmptyState`, `dashboard-empty-logic.ts`) unchanged — copy is shared with Card View. No new `FlatList` dependency (FlashList absent; adopting it is a device-UAT decision, not plan-time).

---

## Shared Patterns

### Optimistic favourite toggle (LISTV-04 / D-04)
**Source:** `src/db/favourites-dao.ts:32-76` (`setFavouriteRank`/`clearFavouriteRank` — `inWriteTransaction`, `?`-bound single-column UPDATE, `changes===1` guard, `modified_at` bump). Light haptic via `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` (established `UniversalFab.tsx:165`).
**Apply to:** `ListRow` star. Flip local state + haptic immediately; on DAO failure revert + notify (`Couldn't update favourite. Try again.`), no success snackbar. **Pitfall P-6:** treat as binary membership only — never read `favourite_rank` as order; the List never calls `listFavourites`/sorts by rank (`dashboard-read.ts:465-472`, ADR-075).

### Status colour + glyph + label (single source — LISTV-05/09)
**Source:** `src/components/contact-card-ring.ts` (`ringVisual`, `statusGlyph`, `StatusDisplayState`) + `src/components/icons/StatusGlyph.tsx` (labels at `:37-44`).
**Apply to:** `ListRow`. `ring.color` + constant width (F-2); no glyph for `null` (F-3); compose `"snoozed"` (P-4). Never fork a second status source (D-05).

### Reduced-motion result transitions (LISTV-10)
**Source:** `src/theme/use-reduced-motion.ts` (`useReducedMotion()` React twin — re-renders on live OS toggle, unlike RN's boot-only hook) + `src/theme/tokens/motion.ts` (`MOTION.fast`=120/`base`=200, `EASING.decelerate`).
**Apply to:** `ListRow`/list transitions. Keep content visible on fast query changes; skeletons only on initial/delayed load.

### Local-first read path
**Source:** `dashboard-read.ts:43-51` injection posture.
**Apply to:** every read (widened `dashboard-read`, new knowledge read). Pure async local `getAllAsync`; no network on any read path; exclusions in-query, never a UI `.filter()`.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| Swipe row wrapper (`ReanimatedSwipeable`) inside `ListRow` / HomeScreen | UI worklet | gesture / event-driven | **No `Swipeable`/`ReanimatedSwipeable` usage exists anywhere in `src/`** (grep this session: only raw `Gesture`/`GestureDetector` in `CropPhotoScreen.tsx:58`, `OrreryScreen.tsx:56`, `OrreryCanvas.tsx:35`). Use the library API per 27-RESEARCH Pattern 1: `renderLeftActions`/`renderRightActions`, `onSwipeableWillOpen`/`onSwipeableOpen(direction)`, `friction`/`*Threshold`/`overshoot*={false}`, list-level `openRowRef` for single-open (D-09). **Worklet thread only — never mirror translation into React state** (CLAUDE.md hard rule). Commit callbacks run on JS thread (safe for nav/DAO). Thresholds `[DEFERRED]` to Pixel UAT. `GestureHandlerRootView` already mounted (`App.tsx:408`). |

The raw `Gesture.Pan()` usages in Orrery/CropPhoto are a *fallback* reference for hand-rolling only if `ReanimatedSwipeable` cannot express execute-on-commit (research says it can — prefer the built-in).

---

## Metadata

**Analog search scope:** `src/components/`, `src/db/`, `src/db/migrations/`, `src/backup/`, `src/screens/`, `src/services/`, `src/logic/`, `src/theme/`
**Files opened & verified this session:** `ContactCard.tsx`, `dashboard-read.ts` (:30-204), `favourites-dao.ts`, `contact-card-ring.ts`, `StatusGlyph.tsx`, `icon-registry.ts`, `migrations/019-dashboard-prefs.ts`, `app-settings-dao.ts` (:400-436, :740-753, :835-889), `backup-schema.ts` (:150-209), `fuel-age.ts` (:30-122), `HomeScreen.tsx` (:670-713); grep-confirmed: `database.ts:54` TARGET_VERSION, no `favorite` Icon consumer, no Swipeable usage, batch-`IN` pattern in `knowledge-search-read.ts`.
**Pattern extraction date:** 2026-09-05
```
