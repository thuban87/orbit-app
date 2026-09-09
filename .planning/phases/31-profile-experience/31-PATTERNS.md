# Phase 31: Profile Experience - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 43 new/modified files
**Analogs found:** 43 / 43

The graph was used first for discovery. Its `governs` results for `ContactProfileScreen.tsx`, `database.ts`, `photo-pipeline.ts`, and `memories-read.ts` were all **INFERRED** ADR key-file edges, not code assertions. It correctly flagged the relevant supersessions (ADR-079 over ADR-052 for the Profile AI entry; ADR-078 partially over ADR-036 for human-visible Off Limits). Every assignment below was then checked against the complete live files.

Current schema head is **23** (`TARGET_VERSION = 23`, migrations 001–023). Therefore the next migration is 024 if that remains true when implementation starts.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/profile/types.ts` | model | transform | `src/logic/orrery-system-logic.ts` | role-match |
| `src/profile/module-registry.ts` | config | transform | `src/db/memory-registry.ts` | exact |
| `src/profile/presentation-schema.ts` | utility | transform | `src/components/orrery/system-builder-logic.ts` | role-match |
| `src/profile/resolve-presentation.ts` | service | transform | `src/logic/system-rule-resolver.ts` | exact |
| `src/profile/pack-overview.ts` | utility | transform | `src/logic/orrery-reorder-logic.ts` | role-match |
| `src/profile/layout-editor-reducer.ts` | utility | event-driven | `src/components/orrery/system-builder-logic.ts` | exact |
| `src/profile/knowledge-presentation.ts` | utility | transform | `src/screens/contact-profile-logic.ts` | exact |
| `src/profile/relationship-sheet-model.ts` | utility/controller | event-driven | `src/components/control-surface/PopulationPanelContent.tsx` | role-match |
| `src/db/migrations/024-profile-presentation.ts` | migration | batch | `src/db/migrations/022-orrery-systems.ts` | exact |
| `src/db/database.ts` | config | batch | existing migration registration in same file | exact |
| `src/db/app-settings-dao.ts` | model/service | CRUD | existing theme/dashboard preference fields in same file | exact |
| `src/db/profile-presentation-read.ts` | service | request-response | `src/db/systems-catalog-read.ts` | exact |
| `src/db/profile-presentation-dao.ts` | service | CRUD | `src/db/systems-dao.ts` | exact |
| `src/db/profile-read.ts` | service | request-response | `src/db/orrery-system-read.ts` + `src/db/transaction.ts` | exact |
| `src/db/profile-knowledge-read.ts` | service | request-response | `src/db/memories-read.ts`, `relationships-read.ts`, `fuel-read.ts` | exact |
| `src/db/profile-history-read.ts` | service | request-response | `src/db/timeline-read.ts` | exact |
| `src/db/profile-relationship-actions.ts` | service | CRUD/event-driven | `src/db/snooze-dao.ts` | exact |
| `src/services/profile-metrics.ts` | service | transform | `src/services/impact.ts` + `src/db/contact-status-read.ts` | exact |
| `src/components/profile/ProfileHero.tsx` | component | request-response | `src/screens/ContactProfileScreen.tsx` | role-match |
| `src/components/profile/RelationshipOverview.tsx` | component | transform | `src/components/control-surface/PopulationPanelContent.tsx` | role-match |
| `src/components/profile/ProfileRelationshipSheets.tsx` | component/controller | event-driven | `src/components/ui/Sheet.tsx` + `src/components/control-surface/PopulationPanelContent.tsx` | exact |
| `src/components/profile/ThingsToRemember.tsx` | component | request-response | `src/components/MemoryCard.tsx` | exact |
| `src/components/profile/ProfileModuleHost.tsx` | component/provider | transform | `src/components/ui/BackgroundHost.tsx` | role-match |
| `src/components/profile/ProfileLayoutEditor.tsx` | component | event-driven | `src/screens/SystemBuilderScreen.tsx` | exact |
| `src/components/profile/ProfileTemplateManager.tsx` | component | CRUD | `src/screens/SystemsManagementScreen.tsx` | exact |
| `src/components/profile/ProfileBackgroundManager.tsx` | component | file-I/O/CRUD | `src/screens/CropPhotoScreen.tsx` + `src/components/ui/Sheet.tsx` | exact |
| `src/services/photos/background-crop-geometry.ts` | utility | transform | `src/services/photos/crop-geometry.ts` | exact |
| `src/services/photos/background-pipeline.ts` | service | file-I/O | `src/services/photos/photo-pipeline.ts` | exact |
| `src/services/photos/background-storage.ts` | service | file-I/O | `src/services/photos/photo-storage.ts` | exact |
| `src/screens/ContactProfileScreen.tsx` | controller/component | request-response | current file (extract-and-compose refactor) | exact |
| `src/profile/presentation-schema.test.ts` | test | transform | `src/logic/system-rule-resolver.test.ts` | exact |
| `src/profile/resolve-presentation.test.ts` | test | transform | `src/logic/system-rule-resolver.test.ts` | exact |
| `src/profile/pack-overview.test.ts` | test | transform | `src/logic/orrery-reorder-logic.test.ts` | exact |
| `src/profile/layout-editor-reducer.test.ts` | test | event-driven | `src/components/orrery/system-builder-logic.test.ts` | exact |
| `src/db/migrations/024-profile-presentation.test.ts` | test | batch | `src/db/migrations/022-orrery-systems.test.ts` | exact |
| `src/db/profile-presentation-dao.test.ts` | test | CRUD | `src/db/systems-dao.test.ts` | exact |
| `src/services/profile-metrics.test.ts` | test | transform | `src/services/impact.test.ts` | exact |
| `src/db/profile-relationship-actions.test.ts` | test | CRUD/event-driven | `src/db/snooze-dao.test.ts` | exact |
| `src/db/profile-knowledge-read.test.ts` | test | request-response | `src/db/memories-read.test.ts` + `fuel-read.test.ts` | exact |
| `src/profile/knowledge-presentation.test.ts` | test | transform | `src/screens/contact-profile-logic.test.ts` | exact |
| `src/profile/relationship-sheet-model.test.ts` | test | event-driven | `src/logic/dashboard-query-logic.test.ts` | role-match |
| `src/db/profile-history-read.test.ts` | test | request-response | `src/db/timeline-read.test.ts` | exact |
| `src/db/contact-methods-read.test.ts` (modify) | test | request-response | existing file | exact |

## Pattern Assignments

### Pure Profile contracts and algorithms

**Files:** `src/profile/types.ts`, `module-registry.ts`, `presentation-schema.ts`, `resolve-presentation.ts`, `pack-overview.ts`, `layout-editor-reducer.ts`, `knowledge-presentation.ts`

**Primary analog:** `src/logic/system-rule-resolver.ts`

Keep these modules Node-pure: no React Native, Expo, SQLite singleton, or component imports. Persist and resolve closed semantic tokens, not renderer/component names. Follow the resolver's pattern of validating and mapping durable tokens before applying explicit overrides:

```ts
// src/logic/system-rule-resolver.ts:195-216
export function applyMembershipOverrides(input: {
  candidateIds: readonly number[];
  includeIds: readonly number[];
  excludeIds: readonly number[];
  eligibleIncludeIds: readonly number[];
}) {
  const candidates = new Set(input.candidateIds);
  const eligibleIncludes = new Set(input.eligibleIncludeIds);
  const effectiveExcludes = new Set(
    input.excludeIds.filter((id) => candidates.has(id)),
  );
  const memberIds = [
    ...input.candidateIds,
    ...input.includeIds.filter(
      (id) => !candidates.has(id) && eligibleIncludes.has(id),
    ),
  ].filter((id) => !effectiveExcludes.has(id));
  return { memberIds: [...new Set(memberIds)], prunableExclusionContactIds };
}
```

For Profile, the pure resolution order is `factory -> global template -> Category template -> explicit contact template/freeform -> contact collapse overrides`. Missing referenced UIDs fall through to the next layer. Never copy Category/global resolved values into contact rows.

`module-registry.ts` is the one source of semantic IDs, parentage, factory visibility/order/expanded state, legal tile variants, and fixed/non-hideable flags. `presentation-schema.ts` must reject duplicates, unknown IDs, illegal parents/sizes, and third-level nesting, then canonicalize. `layout-editor-reducer.ts` owns both drag and Move Up/Down actions so both paths produce identical drafts.

### Migration and registration

**Files:** `src/db/migrations/024-profile-presentation.ts`, `src/db/database.ts`, `src/db/app-settings-dao.ts`

**Analog:** `src/db/migrations/022-orrery-systems.ts`

Copy the UID-addressed definition/assignment structure, FK cascade for contact/Category-owned rows, `CHECK` constraints for closed values, and exported SQL constants for tests:

```ts
// src/db/migrations/022-orrery-systems.ts:7-28
export const CREATE_SYSTEMS = `
CREATE TABLE systems (
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);`;

export const CREATE_SYSTEM_RULES = `
CREATE TABLE system_rules (
  id         INTEGER PRIMARY KEY,
  uid        TEXT NOT NULL UNIQUE,
  system_id  INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  family     TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(system_id, family, value)
);`;
```

```ts
// src/db/migrations/022-orrery-systems.ts:58-68
export const migration022: Migration = {
  version: 22,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_SYSTEMS);
    // ...each statement in deterministic order; runner owns the transaction
  },
};
```

Implement four durable entities: named layout templates, named background templates, Category assignments, and contact presentation overrides/freeform/collapse state. Add nullable global layout/background UIDs to `app_settings`. At implementation time update the import, `MIGRATIONS`, and `TARGET_VERSION` together following `src/db/database.ts:25-85`.

For the two new settings, copy all of the existing preference integration points in `src/db/app-settings-dao.ts`: `AppSettings`, optional `PortableSettingsSnapshot` declarations, `WritableSettingsKey`, persisted row type, `COLUMN_OF`, selection mapping, and patch validation. The optional declaration is deliberate: it admits writes/restores now without widening backup emission before Phase 36.

### Presentation DAO and inheritance reads

**Files:** `src/db/profile-presentation-dao.ts`, `src/db/profile-presentation-read.ts`

**Analog:** `src/db/systems-dao.ts`

Use `*Core` functions for transaction-body composition and one public mutexed wrapper that bumps the revision once:

```ts
// src/db/systems-dao.ts:315-341
export async function createCustomSystemCore(exec: SqlExecutor, input) {
  const name = normalizeSystemName(input.name);
  await assertUniqueSystemName(exec, { name });
  const uid = newUid();
  const result = await exec.runAsync(
    "INSERT INTO systems (uid, name, created_at, modified_at) VALUES (?, ?, ?, ?)",
    [uid, name, input.now, input.now],
  );
  return { id: result.lastInsertRowId, uid, name, createdAt: input.now, modifiedAt: input.now };
}

export function createCustomSystem(exec: SqlExecutor, input) {
  return inWriteTransaction(exec, async () => {
    const system = await createCustomSystemCore(exec, input);
    await bumpDataRevisionCore(exec);
    return system;
  });
}
```

Assignments use parameter-bound upsert/delete and a loud row-count guard (`systems-dao.ts:598-637`). A layout switch clears collapse overrides in that same transaction. Reset deletes only the contact-presentation row.

Template deletion must first count/read usages, then clear direct settings/Category/contact references and delete the template in one transaction. Copy the deletion-fallout shape from `systems-dao.ts:404-486`; never materialize inherited values onto contacts. Background byte deletion happens only after DB commit and is best-effort/orphan-reconcilable.

### Coherent Profile aggregate read

**Files:** `src/db/profile-read.ts`, `src/db/profile-knowledge-read.ts`, `src/db/profile-history-read.ts`

**Analogs:** `src/db/transaction.ts`, `src/db/memories-read.ts`, `src/db/relationships-read.ts`, `src/db/fuel-read.ts`, `src/db/timeline-read.ts`

Load the cross-table renderer-neutral snapshot under the existing read mutex:

```ts
// src/db/transaction.ts:74-88
export function inReadSnapshot<T>(
  exec: SqlExecutor,
  body: (ro: ReadOnlyExecutor) => Promise<T>,
): Promise<T> {
  return withMutex(async () => {
    await exec.execAsync("BEGIN");
    try {
      const value = await body(exec);
      await exec.execAsync("COMMIT");
      return value;
    } catch (error) {
      await exec.execAsync("ROLLBACK").catch(() => {});
      throw error;
    }
  });
}
```

The screen's current `Promise.all` load (`ContactProfileScreen.tsx:239-294`) is an inventory of established sources, but the final aggregate must call them from one snapshot rather than expose screen-local parallel state.

Knowledge stays typed by owner. Memory visibility uses the existing fail-visible resolver:

```ts
// src/db/memories-read.ts:101-121
export function resolveVisibility(type: string, hidden: number | null) {
  if (!isMemoryTypeKey(type)) return "show";
  if (hidden === 1) return "hide";
  if (hidden === 0) return "show";
  return MEMORY_TYPE_REGISTRY[type].visibilityDefault;
}
```

Relationships remain relationship rows, custom fields remain normalized typed values grouped only by `field_group`, and current-state/history remain their existing models. For Off Limits add a dedicated bound query `WHERE contact_id = ? AND kind = 'off_limits'`; do not reuse all-kinds editor data and do not alter this load-bearing projection exclusion:

```ts
// src/db/fuel-read.ts:133-141
export const RANKED_FUEL_EXCLUSIONS = `kind != 'off_limits'
     AND source != 'ai'
     AND NULLIF(TRIM(text, char(9) || char(10) || char(11) || char(12) || char(13) || char(160) || ' '), '') IS NOT NULL`;
```

History copies `timeline-read.ts`'s parameter-bound, deterministic ordering, but adds a hard latest-few limit and returns only the interim summary/rows needed by the stable History module ID.

### Metrics and immediate relationship actions

**Files:** `src/services/profile-metrics.ts`, `src/db/profile-relationship-actions.ts`

**Analogs:** `src/services/impact.ts`, `src/db/contact-status-read.ts`, `src/db/snooze-dao.ts`

Guard cadence before arithmetic and return tagged availability, not a fabricated interval:

```ts
// src/services/impact.ts:134-146
export function computeContactIntensity(inputs: ImpactInputs, now: string) {
  if (inputs.trackingEnabled !== 1 || inputs.intervalDays === null) {
    return { available: false };
  }
  return computeIntensity(
    inputs.interactions,
    intensityPeriodDays(inputs.intervalDays),
    inputs.rarelyResponds,
    now,
  );
}
```

`contact-status-read.ts:72-90` independently guards Unbound/never-contacted Status. Phase 31's shared helper must resolve Unbound Intensity to the current local calendar month (`This month`) and be reused by Phase 32; it must not use `intervalDays!` or `?? 30`.

Frequency and custom-snooze writers should expose public composed operations. Each owns one outer `inWriteTransaction`, calls existing non-mutexed cores, records required immutable lifecycle/snooze events, schedules side effects consistently, and bumps data revision exactly once. Never import a `*Core` directly into TSX.

### Profile host and renderers

**Files:** `ProfileHero.tsx`, `RelationshipOverview.tsx`, `ThingsToRemember.tsx`, `ProfileModuleHost.tsx`, `ContactProfileScreen.tsx`

**Analogs:** current `ContactProfileScreen.tsx`, `MemoryCard.tsx`, `contact-methods-read.ts`

The existing screen proves origin-aware reloads, local writes, method actionability, and guarded impact reads, but should be decomposed rather than extended. The new host owns route/focus, one aggregate load, resolved presentation, topmost sheet state, and renderer lookup. Remove the obsolete `contact-profile-ai-draft` block at `ContactProfileScreen.tsx:1105`; Message is the only Compose entry.

Contact methods must reuse the normalized complete groups and effective-primary projection:

```ts
// src/db/contact-methods-read.ts:10-38
const select = (rows: ContactMethodRow[]) =>
  rows.find((row) => row.is_primary === 1 && row.is_actionable === 1) ??
  rows.find((row) => row.is_actionable === 1) ??
  null;

const rows = await exec.getAllAsync<ContactMethodRow>(
  `SELECT ... FROM contact_methods
    WHERE contact_id = ?
    ORDER BY method_type, display_order, id`,
  [contactId],
);
```

Compact Memory cards should copy `MemoryCard.tsx:35-110`: semantic theme tokens, optional rows omitted, two-line value/note previews, explicit Pinned/Outdated labels, and sparkle only when the source model explicitly carries `allow_ai === 1`. Ordinary Off Limits fuel rows have no permission field and therefore render no sparkle in Phase 31; their adapter may accept only a future explicit durable permission and must never infer it. Long-press management must also be reachable through accessibility actions or detail.

All action controls stay rendered when unavailable and set `accessibilityState.disabled` plus a discoverable reason. All styles use `AppText`, semantic `Icon`, `GlassSurface`, spacing/radius tokens, and theme colors; no raw glyph or hardcoded color.

### Focused layout/template/background sheets

**Files:** `ProfileLayoutEditor.tsx`, `ProfileTemplateManager.tsx`, `ProfileBackgroundManager.tsx`

**Analogs:** `SystemBuilderScreen.tsx`, `SystemsManagementScreen.tsx`, `Sheet.tsx`

Copy the controlled-draft/dirty-guard/save-error pattern:

```ts
// src/screens/SystemBuilderScreen.tsx:263-278
const [draft, setDraft] = useState<SystemBuilderDraft>({ ... });
const initialDraft = useRef<SystemBuilderDraft>(draft);
const bypassRef = useRef(false);
const meaningful = isMeaningfulChange(initialDraft.current, draft);
useDiscardKeepGuard({ hasUnsavedChanges: meaningful, bypassRef });
```

```ts
// src/screens/SystemBuilderScreen.tsx:424-455
setSaving(true);
try {
  await saveCustomBuilderDraft(/* complete draft */);
  bypassRef.current = true;
  navigation.goBack();
} catch (cause) {
  setError(saveErrorMessage(cause, draft.name));
} finally {
  setSaving(false);
}
```

Adapt the guard to sheet dismissal/Android Back. No drag, visibility toggle, size choice, or live preview writes SQLite before Save. Failed Save retains the entire draft.

Relationship explanation/selection sheets use the same topmost `Sheet` framing but are not intent-only: a pure controller model supplies truthful Status/Gravity/Intensity explanation rows, the current-History action plus Phase-32 `onOpenInsights` seam, complete Frequency choices, Snooze presets, and validated custom duration/date state. Copy `PopulationPanelContent`'s explicit selected/disabled labels and committed-state publication pattern; a failed write retains the committed selection and offers Retry.

Use the shared sheet's `BaseOverlay` pattern (`Sheet.tsx:33-62`) for scrim/Back behavior and themed safe-area framing. The approved editor needs an expanded/near-full variant; extend the shared primitive only if necessary rather than creating a second overlay implementation. While open, underlying Profile/FAB/nav must be pointer-inert and removed from accessibility focus.

### Background crop, pipeline, and storage

**Files:** `background-crop-geometry.ts`, `background-pipeline.ts`, `background-storage.ts`, `ProfileBackgroundManager.tsx`

**Analogs:** `crop-geometry.ts`, `photo-pipeline.ts`, `photo-storage.ts`, `CropPhotoScreen.tsx`

Copy the UI-thread gesture composition and clamp math, generalized to the actual Hero aspect ratio:

```ts
// src/screens/CropPhotoScreen.tsx:212-245
const pan = Gesture.Pan().onUpdate((e) => {
  // clamp tx/ty so the image keeps covering the viewport
});
const pinch = Gesture.Pinch().onUpdate((e) => {
  const s = Math.max(1, Math.min(startScale.value * e.scale, MAX_SCALE));
  scale.value = s;
  // re-clamp pan for the new scale
});
const gesture = Gesture.Simultaneous(pan, pinch);
```

Copy `photo-pipeline.ts:76-104`: manipulate the original source-pixel crop, resize once to a screen-class derivative, JPEG encode, persist outside cache, and return only the safe relative path. Create a background-specific namespace and UID-derived filename; do not add a background case to avatar identity unless the storage contracts are deliberately generalized.

Copy `photo-storage.ts:391-439`'s crash-safe replacement order: copy new bytes to `.tmp`, move old destination to `.bak`, move `.tmp` into place, then best-effort delete `.bak`. Never pre-delete the current background. DB references commit before obsolete background bytes are best-effort deleted.

## Test Patterns

Node tests use Vitest plus the real migration chain through the Node SQLite adapter:

```ts
// src/db/migrations/022-orrery-systems.test.ts:1-24
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-sqlite", () => ({}));
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";

async function migrateTo(version: number): Promise<void> {
  await runMigrations(exec, MIGRATIONS, version, { now: NOW, newUid });
}
```

Migration tests cover fresh→024 and 023→024, FKs, unique constraints, checks, Category/contact cascade, and fallback after deleted templates. DAO tests assert atomic reset/switch/delete, one revision bump, no semantic contact-data changes, and rollback on injected failure. Pure tests cover malformed documents, old-version factory merge, every precedence combination, missing-template fallthrough, width/font-scale packing, and drag/Move action parity. Knowledge tests assert source separation, hidden-over-pinned precedence, Off Limits isolation, caps/counts, and no inferred AI permission.

## Shared Patterns

### Transactions and errors

Use one outer `inWriteTransaction` and only non-mutexed `*Core` calls inside it (`transaction.ts:49-63`). Validation occurs before writes where possible. SQL values are always `?`-bound; interpolated identifiers/fragments come only from closed code constants. DAO failures throw; UI catches, logs with a stable scope, preserves committed/draft state, and presents actionable copy.

### Local-only read path

Every Profile read comes from SQLite or app-owned local files. No network, telemetry, or AI request belongs in load/render. AI invocation remains Compose-only under ADR-079.

### Nullable cadence

Every Status, Frequency, Intensity, and explanation consumer receives a tagged Bound/Unbound model. `interval_days` is nullable and must never be coerced into a cadence. The calendar-month fallback applies only to Intensity; Status is `Not tracked` and Phase 32 Cycles is omitted.

### Presentation versus semantic data

Hidden/collapsed/template/background state is presentation. It must not change privacy, deletion, pinning, AI permission, Favorite, Snooze, contact fields, Memories, relationships, custom-field values, or interactions. Reset deletes only the contact presentation override.

### Data-owner boundaries

The same Profile snapshot reads `contacts`, `contact_methods`, `interactions`, `events`, `memories`, `relationships`, `custom_field_defs`, `custom_field_values`, value/current-state history, and Profile-only `fuel`. Existing writers remain authoritative; Phase 31 adds only presentation-table writers plus the narrow composed frequency/snooze public operations. It must not introduce a generic knowledge writer.

### Accessibility and theme

Minimum targets are 44×44. Reordering has Move Up/Down parity and position announcements. Expand/collapse, selected/inherited/override, disabled, hidden, and busy states are textual/programmatic. Colors, radii, spacing, icon names, typography, background/scrim density, status, and Gravity visuals use the shared theme system.

## No Analog Found

None. The full Profile composition system is new, but every implementation role has a strong local analog. No single existing file should be copied wholesale: combine the Orrery Systems persistence/draft patterns, current Profile domain readers, and photo pipeline while preserving their separate ownership boundaries.

## Metadata

**Analog search scope:** `src/profile` (planned), `src/db`, `src/services`, `src/components`, `src/screens`, `src/logic`, `src/backup`, migrations/tests, Graphify governing-ADR discovery
**Files scanned/read:** 52 relevant source/test files; 5 primary analog families extracted
**Primary analog families:** Orrery Systems, current Contact Profile, Contact Knowledge readers/cards, transaction/migration stack, photo crop/storage pipeline
**Pattern extraction date:** 2026-09-09
