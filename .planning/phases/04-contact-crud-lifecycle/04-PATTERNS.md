# Phase 4: Contact CRUD & Lifecycle - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 16 (9 new, 5 modified, 2 reuse-verbatim)
**Analogs found:** 16 / 16 (all in-repo; no external port needed for data layer)

> Ground truth already verified upstream and NOT re-derived here: `contacts` and `contact_links`
> tables already carry every needed column in `src/db/migrations/001-initial.ts` (read on disk,
> lines 62-94) — **no migration this phase.** `contact_links` DDL:
> `id, uid TEXT UNIQUE, contact_id → contacts ON DELETE CASCADE, url TEXT NOT NULL, label TEXT (nullable),
> display_order INTEGER NOT NULL, created_at, modified_at`. `contacts` has `rarely_responds`,
> `reminders_off`, `archived_at`, `social_battery`, `birthday`, `phone`, `email`, `photo`, `last_contact`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/contacts-dao.ts` (new) | DAO | CRUD + composed-txn | `src/db/recency-dao.ts` + `src/db/field-ddl.ts` (core/wrapper) | exact |
| `src/db/contact-links-dao.ts` (new) | DAO | CRUD (child table) | `src/db/field-defs-dao.ts` (assertOneChange + uid + timestamps) | exact |
| `src/db/contact-read.ts` (new) | DAO (read/assembly) | request-response | `src/db/field-values-dao.ts` (`getValuesForContact`) | role-match |
| `src/db/purge-dao.ts` (new) | DAO | batch delete (fan-out) | `src/db/field-ddl.ts` (`deleteOrQuarantineField` one-txn) | role-match |
| `src/db/recency-dao.ts` (MODIFY) | DAO | CRUD | itself — extract non-mutexed cores + export `recomputeLastContact` | exact |
| `src/db/field-values-dao.ts` (MODIFY, maybe extract core) | DAO | CRUD | itself — expose `upsertValueCore` for composition | exact |
| `src/screens/CreateContactScreen.tsx` (new) | screen | form/request-response | `src/screens/CustomFieldsScreen.tsx` + `FieldDefForm` | role-match |
| `src/screens/EditContactScreen.tsx` (new) | screen | form/request-response | `src/screens/CustomFieldsScreen.tsx` | role-match |
| `src/screens/ContactProfileScreen.tsx` (new, scaffold) | screen | request-response | `src/screens/CustomFieldsScreen.tsx` (header chrome) | partial |
| `src/screens/SettingsScreen.tsx` (new) | screen | navigation host | `src/screens/HomeScreen.tsx` (route relocation) | role-match |
| `src/screens/ArchivedContactsScreen.tsx` (new) | screen | list + actions | `src/screens/CustomFieldsScreen.tsx` (list + Alert confirm) | exact |
| `src/components/FrequencyPicker.tsx` (new) | component | input | `src/components/field-widgets/DropdownFieldWidget.tsx` + `TextFieldWidget.tsx` | role-match |
| `src/components/TriStateLastSpoke.tsx` (new) | component | input | (no analog — see No Analog Found) | none |
| `src/components/LinksEditor.tsx` (new) | component | repeatable input | `CustomFieldsScreen` row+`iconBtn` pattern | partial |
| `src/components/OverflowMenu.tsx` (new) | component | menu | `DropdownFieldWidget.tsx` (Modal sheet) | role-match |
| `src/theme/theme-presets.ts` + `theme-types.ts` (MODIFY) | config | — | themselves (add `danger` token) | exact |

**Reuse verbatim (do NOT rebuild):** `src/components/FieldValueInput.tsx` + `src/components/field-widgets/*`
(the custom-field block); `defsForCreateForm` / `defsForEditForm` / `visibleDefsForProfile`
(`field-values-dao.ts`); `FREQUENCY_DAYS` (`src/types.ts`).

---

## Pattern Assignments

### `src/db/contacts-dao.ts` (DAO — CRUD + composed atomic write)

**Analogs:** `src/db/recency-dao.ts` (single-writer + interval guard + composed create) and
`src/db/field-ddl.ts` (non-mutexed core / wrapper split).

**The composed-core rule (CRITICAL — the phase's central task).** The shared mutex is non-reentrant.
`inWriteTransaction` header, `src/db/transaction.ts:11-29`:

```typescript
// NON-REENTRANCY — READ BEFORE CALLING:
//   A function already running inside inWriteTransaction must NEVER call another
//   inWriteTransaction (or withMutex) — the inner acquisition queues behind the
//   outer's settlement while the outer awaits the inner: a PERMANENT hang.
//   To COMPOSE two transactional operations, do NOT nest. Extract a NON-mutexed
//   transaction-body core (a plain async (exec) => {...} that assumes BEGIN is
//   already open) and call that core inside the ONE outer inWriteTransaction.
```

**Core/wrapper precedent to copy — `src/db/field-ddl.ts:12-30` header + `deleteOrQuarantineField`:**
`dropFieldColumns` is a private non-mutexed core (no BEGIN, no withMutex); `dropField` wraps it in
exactly one `inWriteTransaction`; `deleteOrQuarantineField` opens ONE `inWriteTransaction` and calls
the core directly so check + drop are atomic. Mirror this for `contacts-dao`: extract
`insertContactCore(exec, input)`, reuse recency's `insertInteractionCore` + `recomputeCore`, reuse
`upsertValueCore` — compose all inside ONE outer `inWriteTransaction`.

**Composition pattern (from `createContactWithInteraction`, `recency-dao.ts:278-330`):**

```typescript
// interval_days guard runs BEFORE opening any txn (recency-dao.ts:289-298):
if (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0) {
  return Promise.reject(new Error(`intervalDays must be a positive integer, got ${input.intervalDays}`));
}
return inWriteTransaction(exec, async () => {
  const contactId = await insertContactCore(exec, input);
  if (input.firstInteraction) {            // "Not yet" omits this → NULL last_contact, no interaction
    await insertInteractionCore(exec, contactId, input.now, input.firstInteraction);
    await recomputeCore(exec, contactId, input.now);
  }
  for (const cv of input.customValues) {
    await upsertValueCore(exec, contactId, input.rowUid, cv.col, cv.value, input.now);
  }
  return { contactId };
});
```

**Metadata edit — writes every column EXCEPT `last_contact`** (single-writer invariant, `recency-dao.ts:1-12`).
Use `?`-binds for every value (`recency-dao.ts:32-33`). Column list matches migration `contacts`
(lines 62-82):

```typescript
// UPDATE contacts SET name=?, category_id=?, interval_days=?, social_battery=?, birthday=?,
//   phone=?, email=?, rarely_responds=?, reminders_off=?, modified_at=? WHERE id=?
// Then: IF rarely_responds changed → await recomputeCore(exec, id, now)  ◄── Pitfall 2 (mandatory)
```

**Why the recompute is mandatory** — the recompute filters connected-only when the flag is on
(`recomputeLastContact`, `recency-dao.ts:137-154`):

```sql
SET last_contact = (SELECT MAX(i.occurred_at) FROM interactions i
   WHERE i.contact_id = contacts.id
     AND (contacts.rarely_responds = 0 OR i.connected = 1))
```
Flipping the flag without re-running this leaves `last_contact` computed under the OLD flag → status math silently wrong.

**Archive / restore — metadata `archived_at` UPDATE with `assertOneChange`** (copy `renameField`,
`field-defs-dao.ts:45-69`):

```typescript
function assertOneChange(op: string, id: number, changes: number): void {
  if (changes !== 1) throw new Error(`${op}: no def matched id=${id} (changed ${changes})`);
}
// archive:  UPDATE contacts SET archived_at=?,    modified_at=? WHERE id=?
// restore:  UPDATE contacts SET archived_at=NULL, modified_at=? WHERE id=?
```

---

### `src/db/contact-links-dao.ts` (DAO — child-table CRUD)

**Analog:** `src/db/field-defs-dao.ts` (uid + timestamps + `assertOneChange` + `inWriteTransaction`).

Child table already exists (migration lines 84-94): `url TEXT NOT NULL`, `label TEXT` nullable,
`display_order INTEGER NOT NULL`, `uid TEXT UNIQUE`. Mint `uid` via `newUid()` (`src/db/uid.ts`,
imported in `database.ts:28`). Every value `?`-bound.

```typescript
// addLink core: display_order = current MAX(display_order)+1 for this contact (append)
// INSERT INTO contact_links (uid, contact_id, url, label, display_order, created_at, modified_at)
//   VALUES (?, ?, ?, ?, ?, ?, ?)
// updateLink: UPDATE ... SET url=?, label=?, modified_at=? WHERE id=? AND contact_id=?  + assertOneChange
// removeLink: DELETE FROM contact_links WHERE id=? AND contact_id=?                     + assertOneChange
// listLinks:  SELECT ... WHERE contact_id=? ORDER BY display_order
```
Scope mutations by BOTH `id` AND `contact_id` and assert exactly one change — the WR-04 both-keys
precedent (`recency-dao.ts:228-246`).

---

### `src/db/contact-read.ts` (DAO — edit-form assembly + duplicate-name)

**Analog:** `src/db/field-values-dao.ts` `getValuesForContact` (`field-values-dao.ts:63-87`) — read-only,
`exec.getFirstAsync`, `?`-bound `contactId`, returns a plain map. Compose: `contacts` row JOIN
`categories` (label) + `getValuesForContact(exec, id, defsForEditForm(defs))` + `listLinks(id)`.

**Duplicate-name-on-save query (Pitfall 6 — one query at submit, never per keystroke):**
```sql
SELECT 1 FROM contacts WHERE name = ? AND archived_at IS NULL AND id != ?   -- id != ? excludes self on edit
```

**Every live-contact read MUST filter `archived_at IS NULL`** (Pitfall 4). `STATUS_SCAN` (`queries.ts`)
already does; the Archived list does the inverse (`archived_at IS NOT NULL`).

---

### `src/db/purge-dao.ts` (DAO — one-transaction fan-out)

**Analog:** `src/db/field-ddl.ts` `deleteOrQuarantineField` — compute-then-act in ONE
`inWriteTransaction`, explicit statements, no reliance on side effects.

FK cascade IS live (`PRAGMA foreign_keys = ON`, `database.ts:102`) but explicit deletes are required
(counts + auditable blast radius). `field_history` has NO FK to contacts → never cascades (add it
explicitly if in-scope, OQ2). Order: children first, contact last, all inside one `inWriteTransaction`:

```sql
DELETE FROM interactions          WHERE contact_id = ?;
DELETE FROM events                WHERE contact_id = ?;
DELETE FROM fuel                  WHERE contact_id = ?;
DELETE FROM contact_custom_values WHERE contact_id = ?;
DELETE FROM contact_links         WHERE contact_id = ?;
DELETE FROM contacts              WHERE id = ?;
```
`computeImpact()` = COUNT(*) per child for the impact-summary copy; omit any zero-count line (UI-SPEC).
Photo-file + notification cleanup are Phase-5/11 extension points — do NOT fabricate them now.

---

### `src/db/recency-dao.ts` (MODIFY) and `src/db/field-values-dao.ts` (MODIFY)

Extract non-mutexed cores (`insertInteractionCore`, `recomputeCore` from recency; `upsertValueCore`
from field-values — the body of `upsertValue` at `field-values-dao.ts:107-118` minus the
`inWriteTransaction` wrapper) so `contacts-dao` can compose them in one txn. **Keep the existing
wrapped exports unchanged** for standalone callers (the field-ddl `dropField`/`dropFieldColumns`
split precedent). Export a public `recomputeLastContact(exec, contactId, now)` entry for the
rarely_responds edit path.

---

### Screens — `Create/Edit/Archived/Settings/ContactProfile`

**Analog:** `src/screens/CustomFieldsScreen.tsx` (read on disk in full).

**Screen chrome to copy verbatim** (`CustomFieldsScreen.tsx:325-362` + styles `505-574`):
`ScrollView` root with `backgroundColor: colors.background`, `contentContainer` padding 16 gap 12;
header row (`backBtn` border 1 / radius 8 / pad 14·8, `title` 24/700); primary `newBtn` = `accent`
fill, `background`-coloured 600 text. Every element carries `testID` + `accessibilityLabel` +
`accessibilityRole` (device UAT is the only screen test — RESEARCH Validation Architecture).

**DAO access pattern** (`CustomFieldsScreen.tsx:107-121`): `const exec = getExecutor();` then
`await <dao>(exec, ...)`; timestamps via `localDateTime()` (`database.ts:45`); load-on-mount via
`useCallback` + `useEffect` + `void load()`; errors → `Logger.error(LOG_SCOPE, ...)` + `Alert.alert`.

**Custom-field block on the forms — REUSE, do not rebuild** (RESEARCH Pattern 1):
`defsForCreateForm(defs)` on create / `defsForEditForm(defs)` on edit
(`field-values-dao.ts:144-155`), mapped through `<FieldValueInput field={def}
value={values[def.col_name]} onChange={...} />` (`FieldValueInput.tsx:49-78`). Render as a block
AFTER the fixed columns — never interleave.

**Impact-summary + duplicate-name confirms — copy `confirmSummary`** (`CustomFieldsScreen.tsx:85-98`),
a Promise-wrapped `Alert.alert` reading as one gate. The native `Alert` keeps RN's built-in
`style: "destructive"` (`CustomFieldsScreen.tsx:273`) — no token needed for the OS-rendered confirm.

---

### `src/components/FrequencyPicker.tsx` / `LinksEditor.tsx` / `OverflowMenu.tsx`

- **FrequencyPicker:** preset list → `interval_days` via `FREQUENCY_DAYS` (`src/types.ts:17`;
  Daily=1…Yearly=365); "Custom…" reveals an integer input (copy `TextFieldWidget` styling,
  below) + unit affordance (×1/×7/×30). Validate `Number.isInteger && > 0` (message
  "Enter a whole number greater than 0.").
- **LinksEditor:** repeatable rows using the `CustomFieldsScreen` row + `iconBtn` shape
  (`styles.row` radius 10 pad 12; `iconBtn` border 1 radius 8). Remove `✕` needs
  `accessibilityLabel` + 44px hit area (UI-SPEC D2). Open: prepend `https://` when no scheme,
  `await Linking.openURL(url)` in try/catch → "Couldn't open this link."
- **OverflowMenu:** low-emphasis `textSecondary` `⋯` glyph (44px hit area, `accessibilityLabel`) →
  Modal sheet copying `DropdownFieldWidget` (`surfaceElevated` sheet, `background` scrim ~0.85).

**Input styling to copy verbatim — `TextFieldWidget.tsx:37-45`:**
```typescript
input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 }
// color: textPrimary, backgroundColor: surface, borderColor: border
```
Phone → `keyboardType="phone-pad"`; email → `keyboardType="email-address"` + `autoCapitalize="none"`.
Toggles ("Rarely responds", "Turn off reminders", "Year unknown") → reuse `ToggleFieldWidget`
pattern (`ToggleFieldWidget.tsx`: `Switch`, on↔"1"/off↔"0", `trackColor` false=border true=accent).

---

### `src/theme/theme-presets.ts` + `theme-types.ts` (MODIFY — add `danger` token)

Add `danger: string;` to the `ThemePalette` interface (`theme-types.ts:29-38`, currently 8 tokens)
and `danger: "#E5484D"` to `space-dark.dark` (`theme-presets.ts:22-31`). This is the ONLY file where
a hex literal may appear. Owner-approved value `#E5484D` (UI-SPEC front-matter + sign-off).
`check:colors` fails the build on any hex referenced outside this file, so the purge "Delete
permanently" button and inline warning text must reference `colors.danger`, never an inline hex.

---

## Shared Patterns

### Atomic multi-table write (core/wrapper)
**Source:** `src/db/transaction.ts:42-57` (`inWriteTransaction`) + `src/db/field-ddl.ts:12-30`
(core/wrapper split precedent).
**Apply to:** `contacts-dao` (create + edit), `purge-dao`.
Never nest `inWriteTransaction`; extract non-mutexed cores and compose inside ONE outer wrapper.

### Single-writer `last_contact`
**Source:** `src/db/recency-dao.ts:1-12, 137-154`.
**Apply to:** every contact write. Only recency writes `last_contact`; `contacts-dao` metadata edit
writes every OTHER column and routes a recompute when `rarely_responds` flips.

### assertOneChange + both-key scoping
**Source:** `src/db/field-defs-dao.ts:45-50`; `src/db/recency-dao.ts:228-246` (WR-04 both keys).
**Apply to:** every UPDATE/DELETE in `contacts-dao` and `contact-links-dao`.

### Local timestamps
**Source:** `src/db/database.ts:45-49` (`localDateTime()`); `formatLocalDate()` (`src/utils/dates.ts`).
**Apply to:** every DAO write. Never `toISOString()`; SQL uses `date('now','localtime')`.

### Injection boundary
**Source:** `src/db/field-values-dao.ts:11-17, 45-50` (`isSafeColName` guard).
**Apply to:** custom-value writes only. Contact metadata, links (url/label/phone/name) are all
`?`-bound — no new interpolation site this phase.

### Screen chrome + Promise-wrapped confirm
**Source:** `src/screens/CustomFieldsScreen.tsx:85-98, 325-362, 505-574`.
**Apply to:** all five new screens.

### Custom-field block reuse
**Source:** `src/components/FieldValueInput.tsx:49-78`; `field-values-dao.ts:144-171`.
**Apply to:** Create + Edit forms (custom block after fixed columns).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/TriStateLastSpoke.tsx` | component | input | No segmented-control exists in the repo. Build fresh: three `Pressable` segments (`Today · Pick date · Not yet`), selected = `accent` fill EXCEPT "Not yet" (muted `textSecondary` text + `borderStrong` border per UI-SPEC). 44px min segment height. Widget contract can still mirror `FieldWidgetProps` (`field-widgets/types.ts`). |
| Native pickers (`@react-native-picker/picker`, `@react-native-community/datetimepicker`) | component | input | Not installed; native modules requiring a desktop-pipeline rebuild (Pitfall 5). Zero-dep Phase-3 fallbacks exist (`DropdownFieldWidget`, `DateFieldWidget`) if the owner declines the new deps. Trigger styling should match the custom widget's trigger for visual parity. |
| Navigation shell (`@react-navigation/native` + native-stack) | provider | — | No nav library installed; owner-approved in CONTEXT (native-stack). Migrates `HomeScreen`'s hand-rolled `useState<Route>` (`HomeScreen.tsx:23-31`) into the navigator; relocates the Custom-Fields route into a Settings stack. Native module → desktop rebuild required. |

---

## Metadata

**Analog search scope:** `src/db/`, `src/screens/`, `src/components/`, `src/components/field-widgets/`,
`src/theme/`, `src/db/migrations/`.
**Files read on disk:** `recency-dao.ts`, `transaction.ts`, `field-values-dao.ts`,
`CustomFieldsScreen.tsx`, `HomeScreen.tsx`, `theme-presets.ts`, `theme-types.ts`,
`FieldValueInput.tsx`, `field-ddl.ts` (header), `field-defs-dao.ts` (excerpts), `TextFieldWidget.tsx`,
`ToggleFieldWidget.tsx`, `001-initial.ts` (contacts + contact_links + interactions DDL),
`database.ts` (helpers), `types.ts` (FREQUENCY_DAYS).
**Pattern extraction date:** 2026-08-14
</content>
</invoke>
