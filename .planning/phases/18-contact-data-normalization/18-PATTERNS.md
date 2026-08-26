# Phase 18: Contact Data Normalization - Pattern Map

**Mapped:** 2026-08-26  
**Files analyzed:** 40 planned new/modified files  
**Analogs found:** 40 / 40

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `package.json` | config | transform | existing Expo dependency declarations | role-match |
| `src/db/migrations/009-contact-data-normalization.ts` | migration | transform | `src/db/migrations/001-initial.ts` + `008-restore-photo-journal.ts` | role-match |
| `src/db/migrations/009-contact-data-normalization.test.ts` | test | transform | `src/db/contact-links-dao.test.ts` | role-match |
| `src/db/database.ts` | config | batch | itself / migration registration | exact |
| `src/db/contact-methods-dao.ts` | service | CRUD | `src/db/contact-links-dao.ts` | exact |
| `src/db/contact-methods-dao.test.ts` | test | CRUD | `src/db/contact-links-dao.test.ts` | exact |
| `src/db/contact-methods-read.ts` | service | request-response | `src/db/contact-links-dao.ts` (`listLinks`) | role-match |
| `src/db/contact-lifecycle-dao.ts` | service | CRUD | `src/db/contacts-dao.ts` | role-match |
| `src/db/contact-lifecycle-dao.test.ts` | test | CRUD | `src/db/contacts-dao.test.ts` | role-match |
| `src/logic/contact-method-normalization.ts` | utility | transform | `src/logic/compose-logic.ts` | role-match |
| `src/logic/contact-method-normalization.test.ts` | test | transform | `src/logic/*-logic.test.ts` | role-match |
| `src/db/contact-read.ts` | service | request-response | itself (`getContactHeader`, `getContactForEdit`) | exact |
| `src/db/contacts-dao.ts` | service | CRUD | itself (`createContactFull`, `updateContactFull`) | exact |
| `src/db/dashboard-read.ts` | service | request-response | itself (`listNeverContacted`, favourites branch) | exact |
| `src/db/unbound-read.ts` | service | request-response | `src/db/dashboard-read.ts` | exact |
| `src/db/orrery-read.ts` | service | request-response | itself (`listOrbitingContacts`) | exact |
| `src/db/notification-read.ts` | service | request-response | itself (`listDecayEligibleCandidates`) | exact |
| `src/services/notifications/decay-suppression.ts` | utility | transform | itself (`DECAY_ELIGIBLE_WHERE`) | exact |
| `src/services/widget/widget-data.ts` | service | transform | itself (`loadWidgetTiles`) | exact |
| `src/db/impact-read.ts` | service | request-response | itself (`getImpactInputs`) | exact |
| `src/db/app-settings-dao.ts` | service | CRUD | itself (`AppSettingsPatch`) | exact |
| `src/screens/CreateContactScreen.tsx` + `create-contact-logic.ts` | component + utility | request-response | existing create form | exact |
| `src/screens/EditContactScreen.tsx` + `edit-contact-logic.ts` | component + utility | request-response | existing edit form | exact |
| `src/components/ContactMethodsEditor.tsx` | component | event-driven | `src/components/LinksEditor.tsx` | exact |
| `src/screens/ContactProfileScreen.tsx` | component | request-response | itself (header load and action callbacks) | exact |
| `src/screens/HomeScreen.tsx` | component | request-response | existing counted-footer pattern | exact |
| `src/screens/UnboundContactsScreen.tsx` | component | request-response | `src/screens/NeverContactedScreen.tsx` | exact |
| `src/screens/SettingsScreen.tsx` | component | request-response | existing Settings settings-patch/modal pattern | exact |
| `src/screens/ComposeScreen.tsx` | component | request-response | existing `getContactHeader` SMS gate | exact |
| `src/navigation/types.ts` + `src/navigation/RootNavigator.tsx` | route + config | event-driven | existing `NeverContacted` registration | exact |
| `src/backup/types.ts` | model | transform | existing `BackupManifest` entities | exact |
| `src/backup/export-manifest.ts` | service | batch | itself (`readManifest`) | exact |
| `src/backup/backup-schema.ts` | utility | transform | itself (`validate`) | exact |
| `src/backup/restore-apply.ts` | service | batch | itself (`entities` reconciliation graph) | exact |
| existing source-adjacent tests for the modified reads/UI/backup files | test | request-response | matching `*.test.ts` / `*.test.tsx` | exact |

## Pattern Assignments

### Database migration and registration

**Apply to:** `009-contact-data-normalization.ts`, its test, and `database.ts`.

**Analogs:** `src/db/migrations/001-initial.ts`, `src/db/migrations/008-restore-photo-journal.ts`, `src/db/migrations/runner.ts`, `src/db/database.ts`.

Migration files are thin `Migration` objects over the injected `SqlExecutor`; do not open an Expo connection or transaction inside `apply`. The runner owns one transaction and rolls back its original error.

**Migration shape** — `src/db/migrations/008-restore-photo-journal.ts:1-22`:

```ts
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const migration008: Migration = {
  version: 8,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_RESTORE_PHOTO_JOURNAL);
  },
};
```

**Transactional contract** — `src/db/migrations/runner.ts:47-67`:

```ts
await exec.execAsync("BEGIN");
try {
  await migration.apply(exec, deps);
  await exec.execAsync(`PRAGMA user_version = ${next}`);
  await exec.execAsync("COMMIT");
} catch (e) {
  await exec.execAsync("ROLLBACK").catch(() => {});
  throw e;
}
```

**Schema baseline to rebuild** — `src/db/migrations/001-initial.ts:63-86`: `contacts` has `interval_days INTEGER NOT NULL` and scalar `phone`/`email`; preserve every non-retired field while rebuilding the table. Child tables follow parent-before-child FK creation from `CREATE_STATEMENTS` (`001-initial.ts:168-181`). Migration 009 must set all legacy contacts `tracking_enabled = 1`, convert scalar values once into primary method rows, and retire scalar endpoint authority.

**Registration** — `src/db/database.ts:25-47`: append the import and `migration009`, then change `TARGET_VERSION` from 8 to 9. Tests should use `runMigrations` against `node:sqlite`, like `src/db/contact-links-dao.test.ts:35-55`; include the real v8 chain, not hand-created Phase 9 tables.

### Ordered contact methods and provenance

**Apply to:** `contact-methods-dao.ts`, `contact-methods-read.ts`, method tests, and the migration’s method/link/provenance tables.

**Analog:** `src/db/contact-links-dao.ts`.

Use the existing child-entity convention: a stable `uid`, contact-scoped ordering, core functions which assume the outer transaction, standalone transaction-owning wrappers, and a seeded-versus-current diff for form Save. The method DAO must normalize before comparing drafts, collapse only same-contact canonical duplicates, maintain at most one primary per type, and promote the next ordered method after primary removal. Canonical values are not globally unique: two contacts may share a canonical phone/email.

**Imports and data shape** — `src/db/contact-links-dao.ts:29-61`:

```ts
import { inWriteTransaction } from "@/db/transaction";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import type { SqlExecutor } from "@/db/types";

export interface DraftLink {
  id?: number;
  uid: string;
  url: string;
  label: string | null;
}
```

**Per-contact append order** — `src/db/contact-links-dao.ts:83-115`:

```ts
const order = await exec.getFirstAsync<{ next: number }>(
  `SELECT COALESCE(MAX(display_order) + 1, 0) AS next
     FROM contact_links
    WHERE contact_id = ?`,
  [params.contactId],
);
await exec.runAsync(
  `INSERT INTO contact_links
     (uid, contact_id, url, label, display_order, created_at, modified_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [...],
);
```

**Atomic draft diff** — `src/db/contact-links-dao.ts:202-284`: insert id-less rows, tombstone/delete seeded rows absent from the current draft, update changed seeded rows, then call `bumpDataRevisionCore` only if something changed. `contact-links-dao.test.ts:223-314` proves the whole diff rolls back on a later failure; use the same fixture/lifecycle for contact methods.

For system-contact links, model local source evidence as a separate UID-bearing child; never cascade source disappearance into a method or Orbit contact. Add an active-link uniqueness constraint/index for `(provider, external_contact_id)` that applies only to active links, so an existing stale row stays provenance but exactly one active link wins lookup.

### Normalization boundary

**Apply to:** `src/logic/contact-method-normalization.ts`, the method DAO, migration, and form save adapters.

**Analog:** source-adjacent pure `src/logic/*-logic.ts` modules and their tests.

Keep normalization pure and separate from React/SQLite: input raw/display text and default region in; output trimmed raw text, canonical value or `null`, separate extension, actionable flag, and derived display data. Persist nonblank invalid input as a non-actionable row. Phone uses the approved parser integration; email equality is trimmed ASCII case-folding only. Neither migration nor UI may implement a competing canonicalization rule.

### Bound/Unbound lifecycle writes

**Apply to:** `contact-lifecycle-dao.ts`, its test, and create/edit DAO integration.

**Analog:** `src/db/contacts-dao.ts:101-178`, `src/db/contacts-dao.ts:281-330`.

The project guards invalid input before opening the transaction, performs related writes in one `inWriteTransaction`, binds every value, and throws on an unexpected affected-row count.

```ts
if (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0) {
  return Promise.reject(new Error(`intervalDays must be a positive integer, got ${input.intervalDays}`));
}

return inWriteTransaction(exec, async () => {
  const result = await exec.runAsync(
    `UPDATE contacts SET ... modified_at=? WHERE id=?`,
    [..., input.now, input.id],
  );
  if (result.changes !== 1) throw new Error("...no contact matched...");
});
```

Make `tracking_enabled`, rather than nullability, authoritative. SQL and DAO guards must jointly enforce `interval_days IS NULL OR interval_days > 0`, Bound ⇒ positive interval, and forbid a previously non-null interval becoming `NULL`. Unbind updates only lifecycle state; it never resets `last_contact`, interactions, or a saved positive interval. Preserve `favourite_rank` on the row as dormant state; all active favourite and widget reads must hide it until rebinding.

### Read owners and downstream consumers

**Apply to:** `contact-read.ts`, `dashboard-read.ts`, `unbound-read.ts`, `orrery-read.ts`, `notification-read.ts`, `decay-suppression.ts`, `widget-data.ts`, `impact-read.ts`, and their tests.

**Analogs:** existing named query owners. Add lifecycle predicates in SQL, not React filters. Search and direct profile reads may retain both states; cadence/status/reminder/favourite/widget projections must include `tracking_enabled = 1`.

**Additive by-id projection** — `src/db/contact-read.ts:65-130`:

```ts
return exec.getFirstAsync<{
  id: number; name: string; ...
  favourite_rank: number | null;
  phone: string | null;
  snooze_until: string | null;
}>(
  "SELECT id, name, rarely_responds, archived_at, photo, modified_at, favourite_rank, phone, snooze_until FROM contacts WHERE id = ?",
  [contactId],
);
```

Replace scalar `phone`/`email` in this projection and the edit assembly with method projections. `getContactForEdit` already composes contact, custom values, and ordered links (`contact-read.ts:183-208`); extend that same aggregate with ordered methods.

**Single-source read predicate** — `src/db/notification-read.ts:73-98`:

```ts
return exec.getAllAsync<DecayEligibleCandidate>(
  `SELECT id, name, last_contact, interval_days, snooze_until
     FROM contacts
    WHERE ${DECAY_ELIGIBLE_WHERE}
    ORDER BY id`,
);
```

`DECAY_ELIGIBLE_WHERE` is a closed SQL fragment and must gain Bound eligibility once, at `src/services/notifications/decay-suppression.ts:51-62`. Birthday reads stay independent: the new setting narrows birthday *notifications* for Unbound contacts, not birthday data/banner reads by default.

**Derived projections** — `src/db/orrery-read.ts:87-100` and `src/db/impact-read.ts:54-88`: preserve the existing status/impact SQL composition and deterministic order. Orrery becomes Bound-only. Impact must still return interaction history/gravity for Unbound but make cadence-dependent intensity unavailable there rather than attempting arithmetic with `NULL` interval values.

**Dormant favourite rank** — `src/services/widget/widget-data.ts:74-91`:

```ts
const rows = await listDashboard(exec, {
  filter: "favourites",
  sort: "status",
});
return shapeWidgetTiles(rows, { ... });
```

Do not add widget filtering; make `listDashboard`'s favourites SQL require Bound, so the widget automatically hides dormant ranks. Extend `dashboard-read.test.ts`, `orrery-read.test.ts`, `notification-read.test.ts`, and `impact-read.test.ts` with Bound/Unbound cases at their owning query.

### Contact-method editor and lifecycle UI

**Apply to:** `ContactMethodsEditor.tsx`, `CreateContactScreen.tsx`, `EditContactScreen.tsx`, `ContactProfileScreen.tsx`, `ComposeScreen.tsx`, and related logic tests.

**Editor analog:** `src/components/LinksEditor.tsx:42-58`, `:99-205`.

```tsx
export interface LinksEditorProps {
  links: LinkDraft[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<Pick<LinkDraft, "url" | "label">>) => void;
  onRemove: (index: number) => void;
  testID?: string;
}

{links.length === 0 ? <Text>No links yet</Text> : links.map((link, index) => (
  <View key={link.uid} ...>
    <TextInput value={link.url} onChangeText={(v) => onUpdate(index, { url: v })} />
    <Pressable onPress={() => onRemove(index)} ...><Text>✕</Text></Pressable>
  </View>
))}
```

Copy its controlled-draft ownership, stable UID key, explicit empty/add state, 44px controls, theme-only colours, accessibility labels, and no DB access. The parent saves one atomic methods diff. Adapt its card rows to type-grouped phones/emails, primary radio/selection, label/custom label, invalid helper, and reversible draft-only removal. Do not add reorder UI polish.

**Screen/save pattern** — `src/screens/CreateContactScreen.tsx:92-163`:

```tsx
try {
  const exec = getExecutor();
  const input = buildCreateInput(formState, {
    now: localDateTime(), contactUid: newUid(), interactionUid: newUid(), createDefs,
  });
  const { contactId } = await createContactFull(exec, input);
  navigation.replace("Profile", { contactId });
} catch (err) {
  Logger.error(LOG_SCOPE, "failed to save contact", err);
  Alert.alert("Couldn't save contact. Please try again.");
} finally { setSaving(false); }
```

Keep logic/data shaping in `create-contact-logic.ts` and `edit-contact-logic.ts`; screens remain asynchronous RN shells. Bind/Unbind actions should use the same non-optimistic write/reload/error-Alert posture as existing profile actions. Compose must read one actionable primary phone from the new read boundary; never pass raw/incomplete values to `SMS.sendSMSAsync`.

### Dedicated Unbound screen, dashboard, settings, and navigation

**Unbound screen analog:** `src/screens/NeverContactedScreen.tsx:50-95`, `:161-211`.

```tsx
useFocusEffect(useCallback(() => {
  let cancelled = false;
  (async () => {
    try {
      const next = await listNeverContacted(getExecutor(), { sort });
      if (!cancelled) setRows(next);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load never-contacted list", err);
      if (!cancelled) setRows([]);
    }
  })();
  return () => { cancelled = true; };
}, [sort]));
```

Follow its themed root/header/back/FlatList structure and cancellation guard, but use the dedicated `listUnbound` read, neutral rows (no `ContactCard` status/favourite action), required loading/error/empty copy, and alphabetical population. Add the dashboard footer count/load alongside the existing Never Contacted count, never by filtering the displayed list.

For Settings, extend the existing portable `AppSettings` / `PortableSettingsSnapshot` / `AppSettingsPatch` allowlists in `src/db/app-settings-dao.ts:31-196`; update the one-row DAO mapping/validation and include both settings in portable backup. Reuse existing Settings modal/Switch shells; keep device region only as a default and persist an explicit override. Add the `UnboundContacts` route additively to both `src/navigation/types.ts` and `src/navigation/RootNavigator.tsx:59-85`, matching `NeverContacted`'s serializable no-param route.

### Backup, restore, and tombstones

**Apply to:** `src/backup/types.ts`, `export-manifest.ts`, `backup-schema.ts`, `restore-apply.ts`, and their tests.

**Export snapshot pattern** — `src/backup/export-manifest.ts:39-83`:

```ts
const [categories, ..., contacts, ..., tombstones] = await Promise.all([
  ro.getAllAsync<Record<string, unknown>>(
    `SELECT c.id AS localContactId, c.uid, ... FROM contacts c ... ORDER BY c.uid`,
  ),
  ...
]);
const manifest: BackupManifest = { ..., contacts, ..., tombstones: tombstones.map(...) };
return parseBackupManifest(manifest);
```

Export normalized rows as first-class UID-bearing arrays (methods, external links, method provenance), and export `tracking_enabled` plus nullable/dormant cadence with contacts. Update the scalar contact projection rather than retaining `phone`/`email` compatibility fields.

**Strict schema graph** — `src/backup/backup-schema.ts:77-175`: add all child arrays to the required-array list, UID uniqueness checks, allowed tombstone entity types, parent-reference validation, and same-file survivor validation. This is the correct place to prove a child cannot survive a tombstoned parent; it must not encode a source-disappearance delete rule.

**Restore graph** — `src/backup/restore-apply.ts:35-45` uses a closed `entities` array/table map and applies plan results inside one write transaction. Register normalized children with the same UID reconciliation mechanism and preserve stale source links/provenance unless explicitly tombstoned. Extend the source-adjacent integration tests from their real migration chain; assert export→parse→restore preserves dormant `favourite_rank`, active-link uniqueness, methods, extensions, primary/order, provenance, nullable cadence, and history.

## Shared Patterns

### Transactions, binding, and data revision

**Sources:** `src/db/contact-links-dao.ts:150-196`, `src/db/contacts-dao.ts:101-178`.

All writes use `inWriteTransaction`, `?`-bound data, a precise row-count guard, and `bumpDataRevisionCore`. Core functions never nest transactions; outer composed Save flows call cores directly.

### Stable local identity and deletes

**Source:** `src/db/contact-links-dao.ts:130-148`.

```ts
await insertTombstoneCore(exec, {
  entityType: "contact_link",
  entityUid: target.uid,
  deletedAt: params.now,
}, { bumpRevision: params.bumpRevision });
await exec.runAsync("DELETE FROM contact_links WHERE id = ? AND contact_id = ?", [params.id, params.contactId]);
```

New sync-ready child entities carry `uid`; actual local deletion creates an appropriate tombstone. A stale external-source link is not a local delete.

### Bound-only queries, dormant favourites

**Sources:** `src/db/notification-read.ts:73-98`, `src/services/widget/widget-data.ts:74-91`.

Lifecycle constraints belong in each read owner. Preserve `favourite_rank` during Unbind, but add `tracking_enabled = 1` to all favourites/dashboard/widget selection SQL; rebinding then exposes the original rank without a rank rewrite.

### Tests

**Sources:** `src/db/contact-links-dao.test.ts:35-55,223-314`; `src/backup/backup-schema.test.ts:20-62`.

Tests are source-adjacent Vitest tests using `nodeSqliteExecutor(openTestDb())`, real migrations via `runMigrations`, deterministic `NOW` and UID counters, plus explicit rollback/constraint assertions. Prefer real query-owner tests over screen-only filter tests.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| none | — | — | Every required role has a close project analog; parser internals use the approved library API behind a new pure module. |

## Metadata

**Analog search scope:** `src/db`, `src/logic`, `src/components`, `src/screens`, `src/navigation`, `src/services`, `src/backup`, `src/schemas`, `package.json`  
**Files scanned:** 100+ source/test files via role and retired-column consumer searches  
**Pattern extraction date:** 2026-08-26
