# Phase 29: Orrery Camera, Scale & Exploration — Pattern Map

**Mapped:** 2026-09-06
**Scope:** CONTEXT, approved UI-SPEC, canonical camera dossier and planning-notes appendix, then the arriving RESEARCH. New filenames below are proposed implementation seams, not additional product requirements. Tests belong with their implementation slices.

## File Classification

The map groups small related files to keep plan references usable. Exact means the same role/data flow exists; it does **not** mean copy the old behavior unchanged.

| New/modified file or explicit file family | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `src/logic/orrery-world-logic.ts` | utility | transform | `orrery-geometry-logic.ts` | exact |
| `src/logic/orrery-camera-logic.ts` | utility | transform | `orrery-geometry-logic.ts` | role-match; projection is new |
| `src/logic/orrery-hit-logic.ts` | utility | transform | `orrery-geometry-logic.ts` | exact; ambiguity replaces nearest |
| `src/logic/orrery-label-logic.ts` | utility | transform | `orrery-geometry-logic.ts` | role-match |
| `src/logic/orrery-gesture-logic.ts` | utility | event-driven | `OrreryScreen.tsx` gesture handlers | partial |
| `src/logic/orrery-geometry-logic.ts` | utility | transform | existing file | exact |
| `src/logic/orrery-ring-logic.ts` | utility | transform | existing ring treatment | exact; nullable health needs a branch |
| `src/logic/orrery-system-logic.ts` | utility | transform | `dashboard-query-logic.ts` | exact |
| `src/db/orrery-system-read.ts` | service | request-response | `orrery-read.ts`, `dashboard-read.ts` | exact |
| `src/db/orrery-read.ts` | service | request-response | existing default read | exact; preserve default segregation |
| `src/db/relationships-read.ts` | service | request-response | existing structured relationship read | exact; add batch seam if needed |
| `src/logic/orrery-satellite-logic.ts` | utility | transform | `relationships-read.ts` visibility + world geometry | partial |
| `src/db/ring-seq-dao.ts` | service | CRUD | existing complete-permutation transaction | exact; filtered merge is new |
| `src/logic/orrery-ring-order-logic.ts` | utility | transform | `computeRingReorder` in `src/logic/ring-reorder-logic.ts` | exact |
| `src/stores/orrery-preferences-store.ts` | store | CRUD | `dashboard-query-store.ts` | exact; strengthen race/error state |
| `src/stores/orrery-session-store.ts` | store | event-driven | `dashboard-session-store.ts` | exact; visit reset is new |
| `src/services/orrery-snapshot-controller.ts` | service | request-response | query-store generation and reduced-motion controller disposal | role-match |
| `src/components/orrery/use-orrery-camera.ts` | hook | event-driven | existing screen shared values and body derived values | partial |
| `src/components/orrery/OrreryCanvas.tsx` | component | streaming | existing clock-owning canvas | exact |
| `src/components/orrery/OrbitBody.tsx` | component | streaming | existing keyed image/Paragraph child | exact |
| `src/components/orrery/SunBody.tsx` | component | streaming | existing keyed image/pulse child | exact |
| `src/components/orrery/OrbitRing.tsx`, `SatelliteBody.tsx`, `Polaris.tsx` | component | streaming | `OrbitBody.tsx`, `SunBody.tsx` | role-match; projected ring/landmark new |
| `src/components/orrery/OrreryControls.tsx` | component | event-driven | `DashboardControlRow.tsx` | exact; do not copy Dashboard state |
| `src/components/orrery/OrreryContactsSheet.tsx` | component | event-driven | `ui/Sheet.tsx` | exact |
| `src/components/orrery/OrreryClusterPanel.tsx` | component | event-driven | `control-surface/AnchoredPanel.tsx` | role-match; preserve interactive canvas |
| `src/stores/shell-obstacle-store.ts` and shell measurement consumers | store/component | event-driven | shell transient store + control-row measurement | partial; no existing complete obstacle registry |
| `src/screens/OrreryScreen.tsx` | component | event-driven | existing screen | exact; composition refactor |
| `src/theme/use-reduced-motion.ts` and its test | hook/test | event-driven | existing injected controller | exact; delayed seed race |
| `src/db/migrations/021-orrery-preferences.ts` and its test | migration/test | batch | `020-dashboard-swipe-pref.ts` and test | exact; recheck head before numbering |
| `src/db/database.ts` | config | batch | existing `MIGRATIONS`/`TARGET_VERSION` | exact |
| `src/db/app-settings-dao.ts` and its test | service/test | CRUD | existing preference allowlist/core | exact |
| `src/backup/backup-schema.ts` and existing backup tests | model/test | transform | `PORTABLE_SETTINGS_KEYS` existing deferred keys | exact; no emission/bump |
| Co-located `orrery-{world,camera,hit,label,gesture,system,satellite,session,preferences}*.test.ts` | test | transform/event-driven/request-response | geometry Vitest + migration Node SQLite fixture | exact scaffolding; new behaviors |

The shell measurement consumer filenames must be pinned after the planner reads the actual shell/FAB/tab owners. This map does not invent a shell layout API or authorize unrelated shell changes. Research's optional batched impact adapter likewise needs its own file scope if selected.

## Pattern Assignments

### 1. Pure world/camera/hit/label/reorder functions and tests

**Primary analog:** `src/logic/orrery-geometry-logic.ts`. Keep its pure imported-domain-constant boundary and top-level tunables. Existing timestamp angle and canonical north convention are reusable (lines 109–127):

```ts
export function progressToAngle(progress: number): number {
  const frac = progress - Math.floor(progress);
  return frac * 2 * Math.PI;
}

// polarToXY return, lines 124–127
return {
  x: cx + radius * Math.sin(angle),
  y: cy - radius * Math.cos(angle),
};
```

Imports at lines 42–43 reuse `ProfileStatus`, `ROGUE_K`, and `WOBBLE_MAX`. Keep null progress separate from this numeric function. Shared shortest-yaw arithmetic is available in `shortestAngleDelta`, lines 221–229.

**Do not copy:** `deriveOrreryMetrics` lines 249–275 compresses rings against viewport bounds; `drawnRadius` line 163 clamps to the viewport; `hitTest` lines 197–213 selects nearest/last-drawn. All three behaviors conflict with the new contract. Preserve the useful single-source geometry principle, replacing it with world geometry plus one current projected frame consumed by both render and interaction. Reorder must invert the same displacement the renderer applies; `driftPush` lines 175–181 illustrates that relation.

**Test scaffold:** `src/logic/orrery-geometry-logic.test.ts` lines 11–25 uses Vitest and `@/logic/…` imports; lines 55–59 assert a geometric anchor:

```ts
const { x, y } = polarToXY(cx, cy, r, 0);
expect(x).toBeCloseTo(cx);
expect(y).toBeCloseTo(cy - r);
```

Extend with project/inverse round trips, legal-pose finite bounds, anchored pinch, label priority, neutral placement, membership-invariant density, and intermediate-animation hit sets. Replace obsolete nearest-hit/morph/viewport-clamp expectations instead of preserving them as acceptance criteria. No RN or Skia mocks are needed for pure math.

### 2. Keyed Skia renderer and UI-thread camera

**Primary analog:** `src/components/orrery/OrbitBody.tsx` lines 25–43 imports Skia primitives, `useMemo`, `SharedValue`, `useDerivedValue`, and the local photo resolver. Each dynamic body is a keyed component; hooks never run inside the parent's `.map()`.

Photo loading and circular billboard fallback are directly reusable (line 103; lines 128–150 and 160–183):

```ts
const image = useImage(photo ? resolvePhotoUri(photo) : null);
```

The existing derived transform (lines 112–117) demonstrates direct Skia SharedValue consumption:

```ts
const bodyTransform = useDerivedValue(() => {
  const angle = statusAngle + morph.value * angleDelta;
  const dx = orbitRadius * (Math.sin(angle) - Math.sin(statusAngle));
  const dy = -orbitRadius * (Math.cos(angle) - Math.cos(statusAngle));
  return [{ translateX: dx }, { translateY: dy }];
});
```

Copy the shared-value plumbing, **replace the morph mathematics and props** with current projected center/scale/depth. Draw avatar circles and horizontal Paragraph labels in screen coordinates; projecting the orbital plane must not squash the avatars. Project ring paths with the same camera. Research supplies the installed-Skia depth-order strategy; this map claims no existing app-level 2.5D renderer analog.

**Ambient lifecycle:** `OrreryCanvas.tsx` lines 101–117 owns the clock and reads the live signal:

```ts
const clock = useClock();
const reducedMotion = useReducedMotionShared();
const twinkle = useDerivedValue(() => {
  if (reducedMotion.value) return TWINKLE_STATIC;
  const t = (Math.sin(clock.value * TWINKLE_SPEED) + 1) / 2;
  return TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * t;
});
```

`SunBody.tsx` lines 87–111 independently gates its two ambient derived values. Keep both gates and unmount the clock-owning subtree on blur/background. `orrery-clock-context.ts` lines 20–27 keeps the clock context nullable for static fallbacks. Camera state can outlive that subtree in navigation-session memory; ambient animation cannot.

`use-reduced-motion.ts` lines 61–95 provides an injectable subscribe/seed/dispose controller, and lines 103–114 bridges it to a shared boolean. Its disposal guard is reusable; its unresolved-seed logic currently permits an older seed to overwrite a live event, so add an event-generation guard and regression test when extending it. Manual gestures remain enabled when motion is reduced.

### 3. Explicit System reads, relationship satellites and guarded reorder

**Primary analog:** `src/db/orrery-read.ts` (default render read) plus the pure closed predicates in `src/logic/dashboard-query-logic.ts`. Do not read `useDashboardQueryStore` from the System resolver.

The exact reusable predicates (dashboard-query-logic lines 154–160) are:

```ts
export const DASHBOARD_POPULATION_SCOPE_WHERE = `c.archived_at IS NULL
     AND c.tracking_enabled = 1`;
export const NOT_CONTACTED_WHERE = "c.last_contact IS NULL";
export const FAVOURITES_WHERE = "c.favourite_rank IS NOT NULL";
export const SNOOZED_WHERE = `c.snooze_until IS NOT NULL
     AND date(c.snooze_until) > date('now','localtime')`;
```

`buildFilterWhere` lines 83–110 binds Category and `Charger` values and derives Needs Attention using imported `PROGRESS_SQL`/`STABLE_MAX` with snooze suppression. `buildPopulationWhere` lines 183–215 returns `{ sql, params }`. Reuse these semantics or extract shared closed fragments; the Orrery needs its own System identity and ring ordering, not Dashboard search/sort/population state.

`src/db/dashboard-read.ts` lines 152–153 is the nullable projection analog:

```ts
const CARD_STATUS = `CASE WHEN c.tracking_enabled = 0 OR c.last_contact IS NULL THEN NULL ELSE (${PROGRESS_SQL}) END AS progress,
    CASE WHEN c.tracking_enabled = 0 OR c.last_contact IS NULL THEN NULL ELSE (${STATUS_SQL}) END AS status`;
```

The default `listOrbitingContacts` keeps its contacted exclusion. Explicit All Contacts/Not Contacted System reads widen it intentionally. Use a coherent loaded member set for world and companion, partitioning a qualifying contact sun out of orbiting bodies while retaining one companion row. Sun presentation remains with `src/logic/sun-occupant-logic.ts`.

**Gravity:** `src/services/impact.ts` lines 88–101 exposes `computeContactGravity(inputs: ImpactInputs, now: string): GravityResult`; it filters connected rows for rarely-responding contacts before calling `computeGravity`. Reuse this entry point for presentation mass/context. Do not derive size from raw interaction count or store a score.

**Satellites:** `src/db/relationships-read.ts` is the existing read choke point and exposes `resolveRelationshipVisibility` (lines 39–43). Its row includes `person_name`, `relation_type`, `linked_contact_id`, `hidden`, and `deleted_at`. Batch the same eligible projection for current parents if needed; reuse visibility semantics, then omit linked/deleted/hidden rows from moon presentation. `relationships-dao.ts` lines 68–93 demonstrates the existing structured fields; no graph schema is needed. The satellite identity is the relationship identity, not a new contact ID. Accessible parent context must expose name/relation even when no precise moon tap is possible.

**Reorder:** `src/db/ring-seq-dao.ts` owns the existing transactional completeness, uniqueness, sun and lifecycle validation. Preserve those guards. A filtered System's IDs are not a complete reorder payload; derive a complete contacted permutation that moves eligible selected IDs within their existing slots and preserves unselected order, then revalidate expected population/sun/order under the write lock. Never-contacted display approval does not by itself widen persisted reorder eligibility; RESEARCH records that decision seam explicitly. This map does not claim an exhaustive audit of every contact writer; the implementing plan must read contacts/recency/lifecycle/merge/import/restore writers before changing any rank invariant.

### 4. Async snapshot/session/preferences and conventional overlays

**Primary analog:** `src/stores/dashboard-query-store.ts` imports Zustand, typed DAO operations and `SqlExecutor` (lines 1–14). Hydration protects newer committed settings (lines 70–77):

```ts
const generation = get().generation;
const stored = parseStoredState(await getAppSettings(exec));
set((state) =>
  state.generation === generation
    ? { ...stored, hydrated: true }
    : { hydrated: true },
);
```

Its view setter (lines 83–89) awaits `updateAppSettings` before publishing the new value and generation. Reuse commit-before-publish and no-op guards, then add explicit pending/read-error/write-error/retry state and serialize conflicting writes. The existing generation counter alone does not solve arbitrary out-of-order System reads or concurrent setting requests. A snapshot loader needs a request generation incremented at request start, selected-System identity checks, and disposal/invalidation guards. Distinguish first load, same-System stale refresh, and failed switch; do not label old System rows as the new selection.

`src/stores/dashboard-session-store.ts` lines 21–27 supplies an ephemeral-store shape:

```ts
export const useDashboardSessionStore = create<DashboardSessionStore>()((set) => ({
  searchText: "",
  scrollOffset: 0,
  setSearchText: (searchText) => set({ searchText }),
  setScrollOffset: (scrollOffset) => set({ scrollOffset }),
  clearSession: () => set({ searchText: "", scrollOffset: 0 }),
}));
```

Use the shape for settled camera/focus snapshots, not per-frame updates. Add explicit Profile-return versus fresh-visit lifecycle; backgrounding alone must not clear the session. Cluster exits before Profile navigation.

**Overlay lifecycle:** `src/components/control-surface/AnchoredPanel.tsx` lines 84–96 registers one transient and cleans it up:

```ts
shellTransientStore
  .getState()
  .openTransient("dashboard-panel", () => onDismissRef.current());
const handle = findNodeHandle(contentRef.current);
if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
return () => shellTransientStore.getState().closeTransient("dashboard-panel");
```

Use Orrery-specific IDs and a stable latest-callback ref. Add trigger-focus restoration. `shell-transient-store.ts` lines 46–53 removes the top entry before invoking dismissal, making callback cleanup harmless. Reuse shell Back/tab-retap handling rather than adding competing screen navigation rules.

**Measurement:** `DashboardControlRow.tsx` lines 123–132 calls `triggerRef.current?.measureInWindow((x, y, width, height) => …)` and records `{ x, y, width, height }`. Use that coordinate discipline for shell/FAB/tab/panel obstacles, subtracting the measured canvas window origin before camera framing. Recompute after layout changes. There is no verified complete existing shell obstacle registry to copy.

**Containers:** `src/components/ui/Sheet.tsx` lines 33–61 composes `BaseOverlay` and bottom safe area with `variant="detail"`; use it for the modal companion. Cluster is a separate nonmodal floating panel and must preserve canvas interaction. `AnchoredPanel` is currently centered despite accepting `anchorRect` (lines 64–75); do not copy that placement for the specified top-left System dropdown.

**Do not copy two failure patterns:** DashboardControlRow's category read catch converts errors to an empty array (lines 45–46), conflicting with the approved error states. DashboardOverlayHost's dismiss callback closes the request before looking up its `onDismiss` (lines 32–35); capture the request/callback before clearing it in any new host. These observations are analog limitations, not authorization for unrelated fixes.

### 5. Forward preference migration and portable allowlist

**Primary analog:** `src/db/migrations/020-dashboard-swipe-pref.ts` lines 1–18:

```ts
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const migration020: Migration = {
  version: 20,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN dashboard_right_swipe_action TEXT NOT NULL DEFAULT 'quick-log'
          CHECK(dashboard_right_swipe_action IN ('quick-log','log-contact'));
    `);
  },
};
```

Add a separate phase-29 step for density, satellite toggle and last System. Current head is 20; recheck before using 021. Register it in `src/db/database.ts`; never edit prior migrations or persist camera/focus. The migration runner owns each DDL/user_version transaction (`runner.ts` lines 56–66), so the migration body does not add its own transaction.

In `src/db/app-settings-dao.ts`, extend all relevant shape/mapping/validation seams: `AppSettings`, optional `PortableSettingsSnapshot` fields, `WritableSettingsKey`, `AppSettingsRow`, `COLUMN_OF`, SELECT/return, `validateAppSettingsPatch`, and the portable schema allowlist. Enum validators at lines 746–777 and `assertToggle` at 602–608 are direct analogs. Runtime values remain bound.

Transaction wrapper at lines 917–921:

```ts
validateAppSettingsPatch(patch);
return inWriteTransaction(exec, async () => {
  await updateAppSettingsCore(exec, patch, now);
  await bumpDataRevisionCore(exec);
});
```

The core revalidates for restore callers (lines 961–979) and checks exactly one updated singleton (998–1005). Keep validation in the core as well as the public entry point.

**Portable seam:** Existing theme/dashboard fields are optional and allowlisted while snapshot emission is deferred (`app-settings-dao.ts` lines 205–229; `backup-schema.ts` `PORTABLE_SETTINGS_KEYS`). Follow that shape: add the new ordinary preference keys, but do not modify emitted snapshots or bump the backup format in phase 29. **Actual `src/backup/types.ts:14` declares `BACKUP_FORMAT_VERSION = 4`; older comments mentioning current format 3 are stale.** Phase 36 owns coordinated future emission/versioning. Review category System identity at that future wire boundary rather than assuming device-local IDs are portable.

**Real-SQL tests:** `020-dashboard-swipe-pref.test.ts` lines 1–16 imports the production `MIGRATIONS` and `runMigrations`, mocks only `expo-sqlite`, and creates `nodeSqliteExecutor(openTestDb())`. `src/db/__testkit__/node-sqlite.ts` lines 19–22 opens real in-memory SQLite with foreign keys enabled. Use the production chain for upgrade/default/invalid-value/rollback tests and retain earlier-jump coverage. Add allowlist acceptance plus current-export omission tests; do not silently change wire compatibility.

## Shared Patterns

- **Imports:** external libraries first, `@/` for project modules; sibling `./` imports within the rendering/overlay family. Keep pure math/controllers independent of React Native and native SQLite.
- **Authentication:** no auth/controller/server pattern applies. These are on-device reads and existing local mutation boundaries.
- **Errors:** DAO validation throws; UI distinguishes loading, empty, failed initial read, stale refresh and write rollback with the UI-SPEC's exact recovery copy. Never catch a read into `[]` and present it as empty.
- **Data lifecycle:** member/status/relationship refresh is discrete. Camera animation consumes shared values independently. Revalidate focus and gesture intents against the current successful System snapshot before navigation or rank writes.
- **Colors and motion:** existing token-resolved props, local photo paths, Paragraph fonts and live Reduced Motion are reusable. No new animation clock or per-frame React state.
- **Testing:** Vitest pure transforms/controllers plus real SQLite; native drawing, gesture arbitration, TalkBack and phone performance need later device evidence. No tests or device checks were run for this map.

## No Complete Analog Found

| New capability | Why research/new tests are needed |
|---|---|
| Bounded 2.5D projection/inverse and arbitrary-body framing | Existing geometry is viewport-relative 2D only |
| One animated projected frame shared by drawing/hit candidates | Existing endpoint hit map can diverge during morph |
| Semantic label allocation and overlapping-target clusters | Existing hitTest intentionally chooses one nearest/topmost body |
| Shell obstacle registry in canvas coordinates | Existing controls measure anchors, but no complete camera exclusion API was verified |
| Pan/pinch/yaw/tilt/prolonged-reorder arbitration | Existing radial drag is not this multi-gesture camera |
| Filtered-System complete rank merge with stale snapshot checks | Existing DAO only accepts the complete contacted permutation |

## Review-mode additions — 2026-09-07

The executable plans now own three concrete additions absent from the original pattern inventory: plan04 readOrreryImpactInputsCore/read-only full-history batch (single-contact analog getImpactInputs), plan08 readOrreryContactTargetValidation/narrow bound identity/member/sun probe (shared buildOrrerySystemWhere and sunOccupantIsSelf), and plan09 openSqliteLocalDayFixture/test-only per-connection clock function (node-sqlite adapter; exact local-day interception and native date delegation). The fixture is new test infrastructure, not an existing adapter feature. D-11 gates satellite parent context on System membership even for the visible global sun.

## Metadata

**Search scope:** `src/{logic,db,stores,components,theme,services,screens}`, phase artifacts, dossier/planning notes and Orrery system doc. Five strong analog families were selected; neighboring files were opened for compatibility rather than expanding the analog hunt.

**Governance discovery:** `npm run graph:ask -- governs src/screens/OrreryScreen.tsx` reported ADR-048 partially superseded by ADR-077. Those links were **INFERRED** from ADR key-file attribution, not assertions extracted from source. The approved dossier/CONTEXT/UI-SPEC governs the canonical-view replacement.

**Limits:** This is a pattern map, not a complete every-writer invariant audit. Source-file reads informed the excerpts; no claim is made that unrelated writers or every restore path has been audited. Planning must perform that audit before changing shared-table semantics. The map writes only this file and changes no application source.
